package dev.cardstashy.nativeplay.play

import android.content.Context
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URLEncoder

/**
 * The web's createCardFacts().set(code) (play-econ-cards.js): a set's name, icon, release date,
 * booster card count and wrapper art (the set's most played booster card), from Scryfall, saved
 * on the device so wrappers never wait twice. Two sets at a time with a pause, like the web.
 */
object SetFacts {
    data class Set(val name: String, val icon: String, val released: String, val total: Int?, val art: String, val artCard: String = "")

    private const val SCRYFALL = "https://api.scryfall.com"
    val sets = MutableStateFlow<Map<String, Set>>(emptyMap())
    private var file: File? = null
    /** Sets being fetched or waiting to retry: a miss retries after 1 s, 3 s and 9 s, then again whenever a screen asks (never blank for good). */
    private val inFlight = HashSet<String>()
    private val misses = HashMap<String, Int>()
    private val lock = Mutex()

    fun init(context: Context) {
        if (file != null) return
        val f0 = File(context.filesDir, "set-facts.json"); file = f0
        Thread({
            try {
                val loaded = JsonParser.parseString(f0.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                    k to Set(o.s("name"), o.s("icon"), o.s("released"), o.get("total")?.takeIf { it.isJsonPrimitive }?.asInt, o.s("art").takeIf { o.s("artCard").isNotBlank() } ?: "", o.s("artCard")) } // facts saved before one-picture-per-set are fetched again once
                synchronized(this) { sets.value = loaded + sets.value }
            } catch (_: Exception) {}
        }, "set-facts").start()
    }

    fun set(code: String): Set? = sets.value[code]
    /** Scryfall's set icon when the facts are not in yet (setIconUrl). */
    fun icon(code: String) = set(code)?.icon?.ifBlank { null } ?: "https://svgs.scryfall.io/sets/$code.svg"

    /** Codes are fetched in the order given, so a screen puts what it shows first. */
    suspend fun ensure(codes: Collection<String>): Unit = withContext(Dispatchers.IO) {
        val need = synchronized(inFlight) { codes.distinct().filter { Regex("^[a-z0-9]{2,8}$").matches(it) && sets.value[it]?.art.isNullOrBlank() && inFlight.add(it) } }
        if (need.isEmpty()) return@withContext
        val missed = ArrayList<String>()
        lock.withLock {
            for (chunk in need.chunked(2)) {
                for (code in chunk) { runCatching { fetch(code) }; if (sets.value[code]?.art.isNullOrBlank()) missed += code }
                save(); delay(600)
            }
        }
        synchronized(inFlight) { inFlight.removeAll(need.toSet() - missed.toSet()) }
        if (missed.isEmpty()) return@withContext
        // Backoff: 1 s, 3 s, 9 s; after that the next screen that asks tries again.
        val n = synchronized(inFlight) { missed.maxOf { misses[it] ?: 0 }.also { missed.forEach { c -> misses[c] = (misses[c] ?: 0) + 1 } } }
        synchronized(inFlight) { inFlight.removeAll(missed.toSet()) }
        if (n < 3) { delay(listOf(1000L, 3000L, 9000L)[n]); ensure(missed) }
    }

    private fun get(url: String) = runCatching { Http.call("GET", url, mapOf("Accept" to "application/json"), null, 12_000) as? JsonObject }.getOrNull()
    private fun find(q: String) = get("$SCRYFALL/cards/search?unique=cards&order=edhrec&q=" + URLEncoder.encode(q, "UTF-8"))

    private fun fetch(code: String) {
        val info = get("$SCRYFALL/sets/$code")
        var search = find("e:$code is:booster")
        if (search?.getAsJsonArray("data")?.size() ?: 0 == 0) search = find("e:$code")
        // One picture per set: a card a sibling set already wears (lea and 2ed share their top card) is skipped for the next one.
        val used = sets.value.filterKeys { it != code }.values.map { it.artCard }.filter { it.isNotBlank() }.toSet()
        val candidates = search?.getAsJsonArray("data")?.mapNotNull { e -> val c = e.asJsonObject
            val url = c.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null } ?: c.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null }
            url?.let { c.s("name") to it } }.orEmpty()
        val pick = candidates.firstOrNull { it.first !in used } ?: candidates.firstOrNull()
        val lead = pick?.second
        val old = sets.value[code]
        val name = info?.s("name")?.ifBlank { null } ?: old?.name ?: return
        sets.value = sets.value + (code to Set(name, info?.s("icon_svg_uri")?.ifBlank { null } ?: old?.icon ?: "", info?.s("released_at")?.ifBlank { null } ?: old?.released ?: "",
            search?.get("total_cards")?.asInt ?: old?.total ?: info?.get("card_count")?.asInt, lead ?: old?.art ?: "", pick?.first ?: old?.artCard ?: ""))
    }

    private fun save() {
        val o = JsonObject()
        sets.value.forEach { (k, v) -> o.add(k, JsonObject().apply { addProperty("name", v.name); addProperty("icon", v.icon); addProperty("released", v.released); v.total?.let { addProperty("total", it) }; addProperty("art", v.art); addProperty("artCard", v.artCard) }) }
        runCatching { file?.writeText(o.toString()) }
    }

    /** For screenshots and tests: known facts without the network. */
    fun seed(facts: Map<String, Set>) { sets.value = sets.value + facts }

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}
