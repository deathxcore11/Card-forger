package dev.cardstashy.nativeplay.collection

import android.content.Context
import app.cash.zipline.QuickJs
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit

/**
 * The site's Collection Home, run as the site's own code (assets/collection-engine.js: store.js, insights.js
 * collectionValue, home-ui.js homeValueModel and the Home rails, meta.js, community-feed.js, news-pulse.js and
 * app.js's resolveNames, bundled by scripts/export-collection-engine.mjs). Nothing about the collection is decided
 * here: this only carries the bundle's fetches over the network, runs its jobs and timers, and reads its models.
 * One thread owns the QuickJS instance; every call goes through it.
 */
object CollectionEngine {
    private val thread = java.util.concurrent.Executors.newSingleThreadExecutor { r -> Thread(null, r, "collection-engine", 8L shl 20).apply { isDaemon = true } }.asCoroutineDispatcher()
    private var qjs: QuickJs? = null
    private var source: () -> String = { "" }
    private val answers = ConcurrentLinkedQueue<Triple<Int, Int, Pair<String, String>>>()
    private val client by lazy { OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS).build() }

    fun init(context: Context) { val app = context.applicationContext; source = { app.assets.open("collection-engine.js").bufferedReader().readText() } }
    /** For tests: the bundle from a file. */
    fun initFrom(file: File) { source = { file.readText() } }

    private fun js(): QuickJs = qjs ?: QuickJs.create().also { q ->
        q.maxStackSize = 6L shl 20
        // QuickJS has no time zone data: the site's daily clock (daily-clock.js, America/New_York) reads the zone's UTC
        // offsets from the device's own rules, three years either side of now (web-locale-prelude.js DateTimeFormat).
        q.evaluate("globalThis.__tz=${zoneTable(listOf("America/New_York"))}")
        q.evaluate(source(), "collection-engine.js")
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        qjs = q
    }

    /** {zone: [[fromMs, offsetMinutes], …]} from java.time's rules for each zone. */
    internal fun zoneTable(zones: List<String>, now: java.time.Instant = java.time.Instant.now()): String = JsonObject().apply {
        for (z in zones) {
            val rules = java.time.ZoneId.of(z).rules
            val from = now.minus(java.time.Duration.ofDays(3 * 366)); val until = now.plus(java.time.Duration.ofDays(3 * 366))
            val rows = com.google.gson.JsonArray()
            fun row(at: Long, off: Int) = rows.add(com.google.gson.JsonArray().apply { add(at); add(off) })
            row(from.toEpochMilli(), rules.getOffset(from).totalSeconds / 60)
            var t = rules.nextTransition(from)
            while (t != null && t.instant.isBefore(until)) { row(t.instant.toEpochMilli(), t.offsetAfter.totalSeconds / 60); t = rules.nextTransition(t.instant) }
            add(z, rows)
        }
    }.toString()

    private suspend fun <T> on(block: (QuickJs) -> T): T = withContext(thread) { block(js()) }
    /**
     * One turn of the bundle: the answers that came in, its jobs and due timers run, and the fetches it asked for sent. A cancelled
     * caller can't cut it short (a fetch the bundle asked for that nobody sent would leave its promise open for good). [after]
     * reads what the caller needs in the same turn ([landed]: an answer came in).
     */
    private suspend fun <T> turn(after: (q: QuickJs, p: JsonObject, landed: Boolean) -> T): Pair<JsonObject, T> = withContext(kotlinx.coroutines.NonCancellable + thread) {
        val q = js(); var landed = false
        while (true) { val a = answers.poll() ?: break; landed = true; q.evaluate("__host.answer(${a.first}, ${a.second}, ${str(a.third.first)}, ${str(a.third.second)})") }
        val p = JsonParser.parseString(q.evaluate("__host.pump(${System.currentTimeMillis()})") as String).asJsonObject
        for (x in p.getAsJsonArray("requests")) send(x.asJsonObject)
        p to after(q, p, landed)
    }
    private fun str(v: String) = JsonPrimitive(v).toString()

    /** app.js normalize() of the account's workspace data, with the catalog this device saved last time. */
    suspend fun load(workspace: JsonObject, catalog: String?): JsonObject = load(workspace.toString(), catalog)
    /** The same from the workspace's JSON text (the device's saved copy), without parsing it here first. */
    suspend fun load(workspace: String, catalog: String?): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.load(${str(workspace)}, ${catalog?.let(::str) ?: "null"})") as String).asJsonObject }

    /** Looks up every card name the catalog lacks (app.js autoEnrich's names) and starts Home's feeds; returns when done or after [maxMs]. */
    /** Resolves the workspace's missing names and loads Home's feeds (and, for a deck page, [deckId]'s format meta). */
    suspend fun refresh(game: String, maxMs: Long = 60_000, deckId: String? = null, onStep: (String) -> Unit = {}): JsonObject {
        on { q -> q.evaluate("Collection.enrich()"); q.evaluate("Collection.feeds(${str(game)}, ${str(deckId ?: "")})") }
        val until = System.currentTimeMillis() + maxMs
        var status = JsonObject()
        while (System.currentTimeMillis() < until) {
            val (p, s) = turn { q, _, _ -> JsonParser.parseString(q.evaluate("Collection.poll()") as String).asJsonObject }
            status = s
            s.get("step")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }?.let(onStep)
            if (!s.get("busy").asBoolean && p.get("open").asInt == 0 && answers.isEmpty()) break
            if (p.get("ran").asInt == 0 && answers.isEmpty()) {
                val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                delay(if (next != null) (next - System.currentTimeMillis()).coerceIn(1, 25) else 15)
            }
        }
        return status
    }

    /** views.js home() / tcg.js tcgHome() as a model: value at a glance, your decks, Top Meta and News. */
    suspend fun home(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.home(${str(game)})") as String).asJsonObject }

    /** views.js collection(): the Cards tab as a model; [opts] = {sort, direction, filter, q, limit}, the site's own control values. */
    suspend fun cards(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cards(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** views.js decks(), My decks, as a model; [opts] = {q} as I.shelfSearch sets it. */
    suspend fun decks(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.decks(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One Cards-tab control as app.js handles it (sort, direction, filter, search, more), then the page again. */
    suspend fun cardsDo(game: String, kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cardsDo(${str(game)}, ${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** views.js deckPage(), the Cards tab of deck [id], as a model; [opts] = {search, filter, sort, view} applied first. */
    suspend fun deck(game: String, id: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.deck(${str(game)}, ${str(id)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One deck-page control as app.js handles it (search, filter, sort, view), then the page again. */
    suspend fun deckDo(game: String, id: String, kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.deckDo(${str(game)}, ${str(id)}, ${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** views.js cardSheet(), a card's page, as a model; [opts] = {name, entry, deck} as the tapped tile has them. */
    suspend fun card(game: String, opts: JsonObject): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.card(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One card-page control as app.js handles it (tab, face, finish, print, source, more), then the page again. */
    suspend fun cardDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.cardDo(${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** Starts the open card page's lookups (app.js loadCardExtras, its printings, the guide and the set index). */
    suspend fun cardLoad() = on { q -> q.evaluate("Collection.cardLoad()"); Unit }

    /**
     * Carries the bundle's open requests and timers until it goes quiet or [maxMs] passes; after each round in which an
     * answer landed, [model] is read again and handed to [onModel] (the page draws what has arrived so far).
     */
    suspend fun settle(maxMs: Long = 30_000, model: String? = null, onModel: (JsonObject) -> Unit = {}) {
        val until = System.currentTimeMillis() + maxMs
        while (System.currentTimeMillis() < until) {
            val (p, m) = turn { q, p, landed -> if (model != null && (landed || p.get("ran").asInt > 0)) JsonParser.parseString(q.evaluate(model) as String).asJsonObject else null }
            m?.let(onModel)
            // Quiet: nothing in flight and no timer due soon (a far timer, such as a cache's expiry, does not hold the page).
            val nt = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
            if (p.get("open").asInt == 0 && p.getAsJsonArray("requests").size() == 0 && answers.isEmpty() && (nt == null || nt - System.currentTimeMillis() > 1500)) break
            if (p.get("ran").asInt == 0 && answers.isEmpty()) {
                val next = p.get("nextTimer")?.takeIf { it.isJsonPrimitive }?.asLong
                delay(if (next != null) (next - System.currentTimeMillis()).coerceIn(1, 25) else 15)
            }
        }
    }
    /** The open card page as a model again (after [settle]); empty when none is open. */
    const val CARD_MODEL = "Collection.cardModel()"
    suspend fun cardModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(CARD_MODEL) as String).asJsonObject }

    /** tcg.js tcgCardSheet(), a Yu-Gi-Oh! or Pokémon card's page, as a model; [opts] = A.tCard's dataset {game, id, setId, setVariant, printing,
     *  edition, entry, deck} (or {pack: i}, a card pulled in Open Pack). */
    suspend fun tcard(opts: JsonObject): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.tcard(${str(opts.toString())})") as String).asJsonObject }
    /** Starts its lookups (the full card, Pokémon's printings, the set list, the open tab's). */
    suspend fun tcardLoad() = on { q -> q.evaluate("Collection.tcardLoad()"); Unit }
    /** One control as app.js / workbench-ui.js handle it (tab, finish, rarity, select, jump, range, historySource), then the page again. */
    suspend fun tcardDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.tcardDo(${str(kind)}, ${str(value)})") as String).asJsonObject }
    const val TCARD_MODEL = "Collection.tcardModel()"
    suspend fun tcardModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(TCARD_MODEL) as String).asJsonObject }

    /** views.js setsPage(), every set by year, as a model; [opts] = {q, family, release, year, sort}, the site's own filter values. */
    suspend fun sets(game: String, opts: JsonObject = JsonObject()): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.sets(${str(game)}, ${str(opts.toString())})") as String).asJsonObject }

    /** One set-browser control as app.js handles it (search, family, type, release, year, sort, more, reset, reload), then the page again. */
    suspend fun setsDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.setsDo(${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** Starts app.js loadSetIndex (the set list); [settle] with [SETS_MODEL] draws it as it lands. */
    suspend fun setsLoad() = on { q -> q.evaluate("Collection.setsLoad()"); Unit }
    const val SETS_MODEL = "Collection.setsModel()"
    suspend fun setsModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(SETS_MODEL) as String).asJsonObject }

    /** views.js setPage(), one set's cards, as a model (app.js's #set/<code> route). */
    suspend fun set(game: String, code: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.set(${str(game)}, ${str(code)})") as String).asJsonObject }

    /** One set-page control as app.js handles it (search, filter, finish, rarity, sort, more, reload, view), then the page again. */
    suspend fun setDo(kind: String, value: String = ""): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.setDo(${str(kind)}, ${str(value)})") as String).asJsonObject }

    /** Starts app.js loadSet for the open set (and the set index for its name and symbol). */
    suspend fun setLoad() = on { q -> q.evaluate("Collection.setLoad()"); Unit }
    const val SET_MODEL = "Collection.setModel()"
    /** The open set page as a model again; empty when none is open. */
    suspend fun setModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(SET_MODEL) as String).asJsonObject }

    /**
     * Open Pack on the open set page (app.js A.openSetPack): starts the draw (the set's booster sheets, then the pack), read with
     * [settle] and [packModel]. Each opening draws from a fresh secure seed (pack-preview.js packRandom: never a fixed or saved seed).
     */
    suspend fun packOpen(game: String): JsonObject = on { q ->
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        JsonParser.parseString(q.evaluate("Collection.packOpen(${str(game)})") as String).asJsonObject
    }
    const val PACK_MODEL = "Collection.packModel()"
    suspend fun packModel(): JsonObject = on { q -> JsonParser.parseString(q.evaluate(PACK_MODEL) as String).asJsonObject }
    /** A new sealed pack from the same set ("Open a new pack"). */
    suspend fun packAgain(): JsonObject = on { q ->
        q.evaluate("__host.seed(${java.security.SecureRandom().nextInt()})")
        JsonParser.parseString(q.evaluate("Collection.packAgain()") as String).asJsonObject
    }
    suspend fun packClose() = on { q -> q.evaluate("Collection.packClose()"); Unit }

    /**
     * One of the site's saving taps (the engine's writeActs: app.js's cardWishlist, cardOwnedQty, qty, wishRemove; tcg.js's
     * tEntryQty, tWish) with the tapped button's dataset, run through app.js's commit; returns once its chain has finished:
     * {done, error, ask (a question to put to the player, then tap again with confirmed), toasts [{text, undo}], writes}.
     */
    suspend fun act(kind: String, data: JsonObject): JsonObject {
        on { q -> q.evaluate("Collection.act(${str(kind)}, ${str(data.toString())})") }
        val until = System.currentTimeMillis() + 15_000
        while (true) {
            val (p, r) = turn { q, _, _ -> JsonParser.parseString(q.evaluate("Collection.actPoll()") as String).asJsonObject }
            if (r.get("done")?.asBoolean == true) return r
            if (System.currentTimeMillis() > until) return r.apply { addProperty("done", true); addProperty("error", "That took too long. Try again.") }
            if (p.get("ran").asInt == 0) delay(10)
        }
    }
    /** Pumps the bundle's jobs, timers and fetches until [poll] says done (or [ms] pass); [each] sees every answer on the way. */
    private suspend fun pumpUntil(poll: String, ms: Long, each: (JsonObject) -> Unit = {}): JsonObject {
        val until = System.currentTimeMillis() + ms
        while (true) {
            val (p, r) = turn { q, _, _ -> JsonParser.parseString(q.evaluate(poll) as String).asJsonObject }
            each(r)
            if (r.get("done")?.asBoolean == true || System.currentTimeMillis() > until) return r
            if (p.get("ran").asInt == 0) delay(10)
        }
    }
    /** The account's sign-in for the site's condition feed. */
    suspend fun auth(token: String?) { on { q -> q.evaluate("Collection.auth(${str(token ?: "")})") } }
    /** app.js addSheet: the add / edit sheet's model ({entry} to edit, {own, fromCard} for Got it, {} empty). */
    suspend fun addOpen(o: JsonObject): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.addOpen(${str(o.toString())})") as String).asJsonObject }
    suspend fun addClose(id: Int) { on { q -> q.evaluate("Collection.addClose($id)") } }
    /** app.js A.cardDeckPicker: {decks: [[id, name]], selected} for a card page's Add to deck. */
    suspend fun deckPick(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.deckPick(${str(game)})") as String).asJsonObject }
    /** app.js A.addLookup: {name, preview, clearPrint} or {error}. */
    suspend fun addLookup(name: String): JsonObject {
        on { q -> q.evaluate("Collection.addLookup(${str(name)})") }
        return pumpUntil("Collection.lookupPoll()", 20_000).also { if (it["done"]?.asBoolean != true) it.addProperty("error", "That took too long. Try again.") }
    }
    /** app.js refreshConditionPrice for the add sheet: [paint] gets {blocks, placeholder} at once and again when the feed answers. */
    suspend fun addPrice(form: JsonObject, retry: Boolean, paint: (JsonObject) -> Unit) {
        on { q -> q.evaluate("Collection.addPrice(${str(form.toString())}, $retry)") }
        var last = ""
        pumpUntil("Collection.pricePoll()", 30_000) { r -> val t = r.toString(); if (t != last) { last = t; paint(r) } }
    }
    /** Saves the bundle made outside a tap since the last ask (condition quotes kept on lots). */
    suspend fun bg(): Int = on { q -> (q.evaluate("Collection.bg()") as Number).toInt() }

    /** app.js A.undo: the state before the last undoable change, written the same way; {writes, toasts}. */
    suspend fun undo(): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.undo()") as String).asJsonObject }
    /** The workspace as the account keeps it (this device's copy, and what a push sends). */
    suspend fun saved(): String = on { q -> q.evaluate("Collection.saved()") as String }
    /** cloud.js workspaceSig and isEmptyWorkspace of [saved]: {sig, empty}. */
    suspend fun syncInfo(): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.syncInfo()") as String).asJsonObject }
    /** cloud.js workspaceSig of an account copy's data. */
    suspend fun sigOf(data: String): String = on { q -> q.evaluate("Collection.sigOf(${str(data)})") as String }
    /** sync-merge.js mergeAccountWorkspaces(base, this device's copy, the account's): the result becomes this device's copy. */
    suspend fun mergeIn(base: String?, cloud: String): JsonObject =
        on { q -> JsonParser.parseString(q.evaluate("Collection.mergeIn(${base?.let(::str) ?: "null"}, ${str(cloud)})") as String).asJsonObject }

    /** search-hints.js: the search field's prompt and the names and questions it fades through. */
    suspend fun hints(game: String): JsonObject = on { q -> JsonParser.parseString(q.evaluate("Collection.hints(${str(game)})") as String).asJsonObject }

    /** The catalog the lookups filled (store.js S.catalog), for the app to keep between visits. */
    suspend fun catalog(): String = on { q -> q.evaluate("Collection.catalog()") as String }

    /** For tests: any expression in the bundle's scope, as a string. */
    internal suspend fun eval(code: String): String = on { q -> q.evaluate("String($code)") as String }

    private val JSON = "application/json".toMediaType()
    private fun send(r: JsonObject) {
        val id = r.get("id").asInt
        val raw = r.get("url").asString
        // The site's own routes are relative ("api/meta/mtg?…", "/api/…"): they resolve against the site.
        val url = if (raw.startsWith("http")) raw else "https://cardstashy.com/" + raw.removePrefix("/")
        val method = r.get("method")?.asString ?: "GET"
        val body = r.get("body")?.takeIf { it.isJsonPrimitive }?.asString
        CoroutineScope(Dispatchers.IO).launch {
            val ans = try {
                val b = Request.Builder().url(url).header("User-Agent", dev.cardstashy.nativeplay.art.CardArt.UA)
                r.getAsJsonObject("headers")?.entrySet()?.forEach { (k, v) -> if (v.isJsonPrimitive) b.header(k, v.asString) }
                b.method(method, body?.toRequestBody(JSON) ?: if (method == "GET" || method == "HEAD") null else ByteArray(0).toRequestBody(JSON))
                client.newCall(b.build()).execute().use { res ->
                    val h = JsonObject(); res.headers.forEach { (k, v) -> h.addProperty(k.lowercase(), v) }
                    Triple(id, res.code, h.toString() to (res.body?.string() ?: ""))
                }
            } catch (_: Exception) { Triple(id, -1, "{}" to "") }
            answers.add(ans)
        }
    }
}
