package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The lobby's Precons source, app.js A.finderPrecons + loadConstructedPrecons with play-precon-formats.js
 * (constructedPreconCandidates, constructedPrecon) and strategy.js mtgjsonDeck: each "Load more precons" checks the
 * next ten MTGJSON products for the format and keeps the ones playable as published. Lists are never trimmed or padded.
 */
object LobbyPrecons {
    data class Precon(val file: String, val deck: JsonObject, val formats: List<String>, val detail: String)

    private val FORMATS = linkedMapOf("Standard" to "standard", "Pioneer" to "pioneer", "Modern" to "modern", "Legacy" to "legacy", "Vintage" to "vintage", "Pauper" to "pauper")
    private const val STANDARD_WINDOW_DAYS = 3 * 366
    private var index: List<JsonObject>? = null
    private val checked = HashSet<String>()
    private val precons = ArrayList<Precon>()
    @Volatile var msg = ""; private set

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    private suspend fun fetch(url: String): JsonObject? = withContext(Dispatchers.IO) {
        runCatching { Http.call("GET", url, mapOf("Accept" to "application/json"), null, 30_000) as? JsonObject }.getOrNull() }

    /** playSourceEntries' precon rows for [format]: every checked precon offered in that format. */
    fun entries(format: String): List<Pair<String, JsonObject>> = synchronized(precons) {
        precons.filter { it.formats.contains(format) }.map { p -> p.detail to p.deck.deepCopy().apply { addProperty("format", format); addProperty("id", "play-precon:" + p.file) } }
    }

    /** One "Load more precons": the next ten unchecked products for the format. */
    suspend fun loadMore(format: String) {
        msg = "Loading the precon list…"
        val idx = index ?: fetch("https://mtgjson.com/api/v5/DeckList.json")?.getAsJsonArray("data")?.mapNotNull { it as? JsonObject }
            ?.filter { it.get("fileName")?.isJsonPrimitive == true && it.get("name")?.isJsonPrimitive == true }?.also { index = it }
        if (idx == null) { msg = "Couldn’t reach MTGJSON"; throw IllegalStateException(msg) }
        val safe = Regex("^[A-Za-z0-9_.-]+$")
        if (format in FORMATS) {
            val earliest = when (format) {
                "Standard" -> java.time.LocalDate.now().minusDays(STANDARD_WINDOW_DAYS.toLong()).toString()
                "Pioneer" -> "2012-10-05"; "Modern" -> "2003-07-28"; else -> "1993-08-05" }
            val next = idx.filter { it.s("type") in Decks.CONSTRUCTED_PRECON_TYPES && safe.matches(it.s("fileName")) && it.s("fileName") !in checked && it.s("releaseDate") >= earliest }
                .sortedWith(compareByDescending<JsonObject> { it.s("releaseDate") }.thenBy { it.s("fileName") }).take(10)
            if (next.isEmpty()) { msg = "Every published $format precon has been checked."; return }
            var found = 0
            for (d in next) {
                val p = fetch("https://mtgjson.com/api/v5/decks/" + d.s("fileName").removeSuffix(".json") + ".json")?.let { constructed(it, d) }
                checked += d.s("fileName")
                if (p != null) { synchronized(precons) { precons += p }; if (format in p.formats) found++ }
            }
            msg = "$found of ${next.size} checked products are legal in $format"
        } else if (format == "Commander") {
            val have = synchronized(precons) { precons.map { it.file }.toSet() }
            val next = idx.filter { it.s("type") == "Commander Deck" && it.s("fileName") !in have && safe.matches(it.s("fileName")) }
                .sortedByDescending { it.s("releaseDate") }.take(10)
            if (next.isEmpty()) { msg = "You’ve checked every Commander precon."; return }
            for (d in next) runCatching {
                val p = fetch("https://mtgjson.com/api/v5/decks/" + d.s("fileName").removeSuffix(".json") + ".json")?.let { commander(it, d) }
                if (p != null) synchronized(precons) { precons += p }
            }
            msg = "${synchronized(precons) { precons.count { "Commander" in it.formats } }} precons checked"
        }
    }

    /** play-precon-formats.js constructedPrecon: null unless playable as published in at least one format. */
    fun constructed(payload: JsonObject, entry: JsonObject): Precon? {
        val d = payload.getAsJsonObject("data") ?: payload
        val mainBoard = d.getAsJsonArray("mainBoard") ?: return null
        if ((d.getAsJsonArray("commander")?.size() ?: 0) > 0) return null
        fun rows(a: JsonArray?) = a?.mapNotNull { it as? JsonObject }?.filter { it.get("name")?.isJsonPrimitive == true && (it.get("count")?.asDouble ?: 0.0).let { c -> c > 0 && c == Math.floor(c) } } ?: emptyList()
        val main = rows(mainBoard); val side = rows(d.getAsJsonArray("sideBoard"))
        if (main.size != mainBoard.size() || side.size != (d.getAsJsonArray("sideBoard")?.size() ?: 0)) return null
        val count = { l: List<JsonObject> -> l.sumOf { it.get("count").asInt } }
        if (count(main) < 60 || count(side) > 15) return null
        val copies = HashMap<String, Int>(); (main + side).forEach { copies[it.s("name")] = (copies[it.s("name")] ?: 0) + it.get("count").asInt }
        fun unlimited(c: JsonObject) = c.getAsJsonArray("supertypes")?.any { it.asString == "Basic" } == true || Regex("any number of cards named", RegexOption.IGNORE_CASE).containsMatchIn(c.s("text"))
        val formats = FORMATS.filter { (_, key) -> (main + side).all { c -> c.getAsJsonObject("legalities")?.s(key) == "Legal" } && (main + side).all { unlimited(it) || (copies[it.s("name")] ?: 0) <= 4 } }.keys.toList()
        if (formats.isEmpty()) return null
        fun merge(l: List<JsonObject>) = JsonArray().apply { val m = LinkedHashMap<String, Int>(); l.forEach { m[it.s("name")] = (m[it.s("name")] ?: 0) + it.get("count").asInt }
            m.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }
        val deck = JsonObject().apply {
            addProperty("file", entry.s("fileName")); addProperty("name", d.s("name").ifBlank { entry.s("name") }); addProperty("released", entry.s("releaseDate"))
            addProperty("product", entry.s("type")); addProperty("format", formats[0]); addProperty("commander", ""); add("cards", merge(main)); add("side", merge(side)) }
        return Precon(entry.s("fileName"), deck, formats, listOf(entry.s("type").ifBlank { "Published precon" }, entry.s("releaseDate")).filter { it.isNotBlank() }.joinToString(" · "))
    }

    /** strategy.js mtgjsonDeck, as A.finderPrecons stores a Commander precon (commander added to the cards when missing). */
    fun commander(payload: JsonObject, entry: JsonObject): Precon? {
        val d = payload.getAsJsonObject("data") ?: payload
        val mainBoard = d.getAsJsonArray("mainBoard") ?: return null
        val merged = LinkedHashMap<String, Int>()
        fun key(n: String) = n.trim().lowercase()
        val names = HashMap<String, String>()
        mainBoard.mapNotNull { it as? JsonObject }.forEach { val n = it.s("name"); val k = key(n); names.putIfAbsent(k, n); merged[k] = (merged[k] ?: 0) + (it.get("count")?.asInt ?: 0) }
        val commanders = d.getAsJsonArray("commander")?.mapNotNull { it as? JsonObject } ?: emptyList()
        for (c in commanders) { val k = key(c.s("name")); if (k !in merged) { names[k] = c.s("name"); merged[k] = c.get("count")?.asInt ?: 1 } }
        if (merged.any { (k, q) -> names[k].isNullOrBlank() || q < 1 || q > 100000 }) return null
        // A.finderPrecons (web 4.3.159): each card keeps the decklist's own printing (identifiers.scryfallId), commander zone first.
        val ids = HashMap<String, String>()
        (commanders + mainBoard.mapNotNull { it as? JsonObject }).forEach { c -> c.getAsJsonObject("identifiers")?.s("scryfallId")?.takeIf { it.isNotBlank() }?.let { ids.putIfAbsent(key(c.s("name")), it) } }
        val deck = JsonObject().apply {
            addProperty("file", entry.s("fileName")); addProperty("name", d.s("name").ifBlank { entry.s("name") }); addProperty("commander", commanders.firstOrNull()?.s("name") ?: "")
            if (commanders.size > 1) add("commanders", JsonArray().apply { commanders.forEach { c -> add(JsonObject().apply { addProperty("name", c.s("name")); addProperty("qty", 1) }) } })
            addProperty("released", entry.s("releaseDate")); addProperty("format", "Commander")
            add("cards", JsonArray().apply { merged.forEach { (k, q) -> add(JsonObject().apply { addProperty("name", names[k]); addProperty("qty", q); ids[k]?.let { addProperty("printingId", it) } }) } })
        }
        return Precon(entry.s("fileName"), deck, listOf("Commander"), listOf("Published precon", entry.s("releaseDate")).filter { it.isNotBlank() }.joinToString(" · "))
    }
}
