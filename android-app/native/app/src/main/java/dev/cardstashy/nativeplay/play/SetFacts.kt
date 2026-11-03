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
    data class Set(val name: String, val icon: String, val released: String, val total: Int?, val art: String)

    private const val SCRYFALL = "https://api.scryfall.com"
    val sets = MutableStateFlow<Map<String, Set>>(emptyMap())
    private var file: File? = null
    private val tried = HashSet<String>()
    private val lock = Mutex()

    fun init(context: Context) {
        if (file != null) return
        val f0 = File(context.filesDir, "set-facts.json"); file = f0
        Thread({
            try {
                val loaded = JsonParser.parseString(f0.readText()).asJsonObject.entrySet().associate { (k, v) -> val o = v.asJsonObject
                    k to Set(o.s("name"), o.s("icon"), o.s("released"), o.get("total")?.takeIf { it.isJsonPrimitive }?.asInt, o.s("art")) }
                synchronized(this) { sets.value = loaded + sets.value }
            } catch (_: Exception) {}
        }, "set-facts").start()
    }

    fun set(code: String): Set? = sets.value[code]
    /** Scryfall's set icon when the facts are not in yet (setIconUrl). */
    fun icon(code: String) = set(code)?.icon?.ifBlank { null } ?: "https://svgs.scryfall.io/sets/$code.svg"

    suspend fun ensure(codes: Collection<String>) = withContext(Dispatchers.IO) {
        lock.withLock {
            val need = codes.distinct().filter { Regex("^[a-z0-9]{2,8}$").matches(it) && sets.value[it]?.art.isNullOrBlank() && tried.add(it) }
            for (chunk in need.chunked(2)) {
                for (code in chunk) runCatching { fetch(code) }
                save(); delay(600)
            }
        }
    }

    private fun get(url: String) = runCatching { Http.call("GET", url, mapOf("Accept" to "application/json"), null, 12_000) as? JsonObject }.getOrNull()
    private fun find(q: String) = get("$SCRYFALL/cards/search?unique=cards&order=edhrec&q=" + URLEncoder.encode(q, "UTF-8"))

    private fun fetch(code: String) {
        val info = get("$SCRYFALL/sets/$code")
        var search = find("e:$code is:booster")
        if (search?.getAsJsonArray("data")?.size() ?: 0 == 0) search = find("e:$code")
        val lead = search?.getAsJsonArray("data")?.firstNotNullOfOrNull { e -> val c = e.asJsonObject
            c.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null } ?: c.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null } }
        val old = sets.value[code]
        val name = info?.s("name")?.ifBlank { null } ?: old?.name ?: return
        sets.value = sets.value + (code to Set(name, info?.s("icon_svg_uri")?.ifBlank { null } ?: old?.icon ?: "", info?.s("released_at")?.ifBlank { null } ?: old?.released ?: "",
            search?.get("total_cards")?.asInt ?: old?.total ?: info?.get("card_count")?.asInt, lead ?: old?.art ?: ""))
    }

    private fun save() {
        val o = JsonObject()
        sets.value.forEach { (k, v) -> o.add(k, JsonObject().apply { addProperty("name", v.name); addProperty("icon", v.icon); addProperty("released", v.released); v.total?.let { addProperty("total", it) }; addProperty("art", v.art) }) }
        runCatching { file?.writeText(o.toString()) }
    }

    /** For screenshots and tests: known facts without the network. */
    fun seed(facts: Map<String, Set>) { sets.value = sets.value + facts }

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}
