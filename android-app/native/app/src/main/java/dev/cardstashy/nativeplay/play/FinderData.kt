package dev.cardstashy.nativeplay.play

import android.content.Context
import app.cash.zipline.QuickJs
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URLEncoder

/**
 * The web's Deck Forge (assets/deck-engine.js) in QuickJS: one context on one background thread,
 * JSON in and JSON out. Nothing here builds decks itself; it only hands the site's builder its input.
 */
@OptIn(ExperimentalCoroutinesApi::class)
object DeckEngine {
    /** QuickJS is bound to the thread that made it: one real thread, not a limited view of IO. */
    private val thread = java.util.concurrent.Executors.newSingleThreadExecutor { r -> Thread(r, "deck-engine").apply { isDaemon = true } }.asCoroutineDispatcher()
    private var qjs: QuickJs? = null
    private var source: () -> String = { "" }
    fun init(context: Context) { val app = context.applicationContext; source = { app.assets.open("deck-engine.js").bufferedReader().readText() } }
    /** For tests: the bundle from a file. */
    fun initFrom(file: File) { source = { file.readText() } }

    private fun js(): QuickJs = qjs ?: QuickJs.create().also { it.evaluate(source(), "deck-engine.js"); qjs = it }

    /** trunkDeck: a Deck Forge build from the Trunk alone, or null. */
    suspend fun forgeTrunk(format: String, cards: List<Trunk.Card>, facts: Map<String, CardFacts.Fact>): Finder.MetaList? = withContext(thread) {
        val owned = JsonArray(); val f = JsonObject()
        for (c in cards) { val fact = facts[c.o] ?: continue; owned.add(JsonObject().apply { addProperty("o", c.o); addProperty("c", c.c) }); if (!f.has(c.o)) f.add(c.o, webSlim(fact.card)) }
        val input = JsonObject().apply { addProperty("format", format); add("ownedCards", owned); add("facts", f) }.toString()
        val out = runCatching { js().evaluate("CardStashyEngine.forgeTrunk(" + JsonPrimitive(input) + ")") as? String }.getOrNull() ?: return@withContext null
        val o = runCatching { JsonParser.parseString(out) }.getOrNull()?.takeIf { it.isJsonObject }?.asJsonObject ?: return@withContext null
        Finder.MetaList(o.s("key"), o.s("name"), o.s("format"), o.getAsJsonArray("cards").map { val r = it.asJsonObject; Decks.Row(r.s("name"), r.get("qty").asInt) },
            source = o.s("source"), detail = o.s("detail"), commander = o.s("commander"), size = o.get("size")?.asInt, trunk = true)
    }
    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""

    /** play-econ-cards.js slimCard: exactly the keys the web hands its builder, so the build is the web's. */
    private val WEB_KEYS = listOf("id", "oracle_id", "name", "set", "set_name", "collector_number", "rarity", "color_identity", "colors", "type_line", "mana_cost", "cmc",
        "oracle_text", "power", "toughness", "loyalty", "finishes", "frame", "frame_effects", "border_color", "security_stamp", "full_art", "layout", "promo_types", "released_at",
        "image_uris", "card_faces", "legalities", "edhrec_rank")
    fun webSlim(c: JsonObject): JsonObject = JsonObject().also { out ->
        for (k in WEB_KEYS) c.get(k)?.let { out.add(k, it.deepCopy()) }
        c.getAsJsonObject("image_uris")?.let { u -> out.add("image_uris", JsonObject().apply { u.get("normal")?.let { add("normal", it) }; u.get("art_crop")?.let { add("art_crop", it) } }) }
        c.getAsJsonArray("card_faces")?.let { faces -> out.add("card_faces", JsonArray().apply { faces.forEach { f -> val fo = f.asJsonObject
            add(JsonObject().apply { for (k in listOf("name", "type_line", "mana_cost", "oracle_text", "oracle_id")) fo.get(k)?.let { add(k, it) }
                fo.getAsJsonObject("image_uris")?.let { u -> add("image_uris", JsonObject().apply { u.get("normal")?.let { add("normal", it) }; u.get("art_crop")?.let { add("art_crop", it) } }) } }) } }) }
    }
}

/** Meta lists (/api/meta/mtg, 30 days) as finderLists reads them; one load per format per visit. */
object MetaLists {
    private val cache = HashMap<String, List<Finder.MetaList>>()
    private const val SITE = "https://cardstashy.com"
    fun metaKey(format: String) = if (format == "Commander") "EDH" else format
    private val HAS_META = setOf("Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "EDH")
    fun hasMeta(format: String) = metaKey(format) in HAS_META

    /** null = could not load; empty = this format has no feed (Standard Brawl). */
    suspend fun load(format: String): List<Finder.MetaList>? = withContext(Dispatchers.IO) {
        if (!hasMeta(format)) return@withContext emptyList()
        cache[format]?.let { return@withContext it }
        val body = runCatching { Http.call("GET", "$SITE/api/meta/mtg?format=" + URLEncoder.encode(metaKey(format), "UTF-8") + "&days=30", emptyMap(), null, 20_000) as? JsonObject }.getOrNull()
            ?: return@withContext null
        parse(format, body).also { cache[format] = it }
    }
    /** Only what has loaded already (the Decks page's emblems never fetch meta on their own). */
    fun cached(format: String): List<Finder.MetaList>? = cache[format]
    /** For shots: a saved /api/meta/mtg answer stands in for the network. */
    fun seed(format: String, body: JsonObject) { cache[format] = parse(format, body) }
    private fun parse(format: String, body: JsonObject): List<Finder.MetaList> {
        return (body.getAsJsonArray("decks") ?: JsonArray()).mapNotNull { it as? JsonObject }.filter { it.has("key") && it.get("main")?.isJsonArray == true }.map { d ->
            val commanders = (d.getAsJsonArray("commanders") ?: JsonArray()).map { r -> if (r.isJsonPrimitive) Decks.Row(r.asString, 1) else r.asJsonObject.let { Decks.Row(it.s("name"), it.get("qty")?.asInt ?: 1) } }
            val main = d.getAsJsonArray("main").mapNotNull { it as? JsonObject }.filter { it.s("board").let { b -> b.isEmpty() || b == "main" } }.map { Decks.Row(it.s("name"), it.get("qty")?.asInt ?: 1) }
            Finder.MetaList("meta:" + d.s("key"), d.s("name").ifEmpty { d.s("archetype") }.ifEmpty { "Meta deck" }, format, commanders + main,
                archetype = d.s("archetype").ifEmpty { d.s("name") }, source = "Meta", detail = listOf(d.s("place"), d.s("event")).filter { it.isNotEmpty() }.joinToString(" · "),
                commander = commanders.firstOrNull()?.name ?: "")
        }
    }
    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}

/**
 * createCraftRarity: the cheapest rarity each card was ever printed at in paper (common first, 40 names
 * a search), and the printing that crafting stamps. Kept on the device for 30 days, like the web.
 */
object CraftRarity {
    data class Entry(val r: String, val id: String, val set: String, val at: Long)
    val low = MutableStateFlow<Map<String, Entry>>(emptyMap())
    val busy = MutableStateFlow(false)
    private val tried = HashSet<String>(); private val missed = HashSet<String>(); private val lock = Mutex()
    private var file: File? = null
    private const val DAYS = 30L
    private val RARITIES = listOf("common", "uncommon", "rare", "mythic")
    private fun front(n: String) = n.split(" // ")[0]

    fun init(context: Context) {
        if (file != null) return
        val f0 = File(context.filesDir, "craft-rarity.json"); file = f0
        Thread({ runCatching { JsonParser.parseString(f0.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
            k to Entry(o["r"].asString, o["id"].asString, o["set"]?.asString ?: "", o["at"].asLong) } }.getOrNull()?.let { synchronized(this) { low.value = it + low.value } } }, "craft-rarity").start()
    }
    private fun fresh(e: Entry?) = e != null && System.currentTimeMillis() - e.at < DAYS * 86_400_000L
    fun entry(name: String): Entry? = (low.value[name] ?: low.value[front(name)]).takeIf { fresh(it) }
    fun rarity(name: String) = entry(name)?.r ?: ""
    fun id(name: String) = entry(name)?.id ?: ""
    fun missed(name: String) = name in missed

    suspend fun want(names: List<String>) = withContext(Dispatchers.IO) {
        val need = names.distinct().filter { it.isNotBlank() && !Decks.isBasicLand(it) && entry(it) == null && tried.add(it) }
        if (need.isEmpty()) return@withContext
        lock.withLock {
            busy.value = true
            try {
                for (chunk in need.chunked(40)) {
                    var left = chunk
                    for (r in RARITIES) {
                        if (left.isEmpty()) break
                        val q = "(" + left.joinToString(" or ") { "!\"" + front(it).replace("\"", "") + "\"" } + ") r:${r[0]} game:paper"
                        val body = runCatching { Http.call("GET", "https://api.scryfall.com/cards/search?q=" + URLEncoder.encode(q, "UTF-8") + "&unique=cards", emptyMap(), null, 15_000) as? JsonObject }
                        val ok = body.getOrNull(); val notFound = (body.exceptionOrNull() as? Http.Failure)?.status == 404
                        if (ok == null && !notFound) break  // offline or busy: ask again next visit
                        val found = HashSet<String>(); val add = HashMap<String, Entry>()
                        for (c in ok?.getAsJsonArray("data")?.mapNotNull { it as? JsonObject } ?: emptyList()) {
                            val cn = c["name"].asString; val e = Entry(r, c["id"].asString, c["set"]?.asString ?: "", System.currentTimeMillis())
                            for (n in left) if (n == cn || front(n) == front(cn)) { add[n] = e; found += n }
                        }
                        low.value = low.value + add
                        left = left.filter { it !in found }
                        delay(110)
                        if (r == "mythic") missed += left
                    }
                    save()
                }
            } finally { busy.value = false }
        }
    }
    private fun save() = runCatching { file?.writeText(JsonObject().apply { low.value.forEach { (k, e) -> add(k, JsonObject().apply {
        addProperty("r", e.r); addProperty("id", e.id); addProperty("set", e.set); addProperty("at", e.at) }) } }.toString()) }
}
