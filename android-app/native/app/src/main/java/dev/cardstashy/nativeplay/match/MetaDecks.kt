package dev.cardstashy.nativeplay.match

import android.content.Context
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Http
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * The CPU's list for Quick Play: a random tournament list in your deck's format, from the same
 * site route the web's Meta source reads (/api/meta/mtg). Kept on disk for a day so a second
 * match never waits on it. Quick Play is random on purpose and never a copy of your own list.
 */
object MetaDecks {
    private const val SITE = "https://cardstashy.com"
    private const val DAY = 24 * 3600 * 1000L

    private fun routeFormat(format: String) = if (format == "Commander") "EDH" else format
    private fun file(context: Context, format: String) = File(context.filesDir, "meta-${routeFormat(format)}.json")

    /** Tournament lists for a format as Forge-ready decks (commanders first, as play-deck-sources.js). */
    fun parse(body: JsonObject, format: String): List<JsonObject> = (body.getAsJsonArray("decks") ?: JsonArray()).mapNotNull { e ->
        val d = e as? JsonObject ?: return@mapNotNull null
        val key = d.get("key")?.asString ?: return@mapNotNull null
        val main = d.getAsJsonArray("main") ?: return@mapNotNull null
        val commanders = d.getAsJsonArray("commanders") ?: JsonArray()
        if (main.size() == 0) return@mapNotNull null
        JsonObject().apply {
            addProperty("schema", 1); addProperty("id", "play-meta:$key"); addProperty("name", d.get("name")?.asString ?: "Tournament list")
            addProperty("format", format)
            commanders.firstOrNull()?.let { c -> (c as? JsonObject)?.get("name")?.asString?.let { addProperty("commander", it) } }
            add("cards", JsonArray().apply { commanders.forEach { add(it) }; main.forEach { add(it) } })
            add("side", d.getAsJsonArray("side") ?: JsonArray())
        }
    }

    suspend fun lists(context: Context, format: String): List<JsonObject> = withContext(Dispatchers.IO) {
        val f = file(context, format)
        fun fromDisk() = try { parse(JsonParser.parseString(f.readText()).asJsonObject, format) } catch (_: Exception) { emptyList() }
        if (f.isFile && System.currentTimeMillis() - f.lastModified() < DAY) fromDisk().takeIf { it.isNotEmpty() }?.let { return@withContext it }
        try {
            val body = Http.call("GET", "$SITE/api/meta/mtg?format=${java.net.URLEncoder.encode(routeFormat(format), "UTF-8")}&days=30", timeoutMs = 5000)?.asJsonObject
            if (body != null && body.has("decks")) { f.writeText(body.toString()); parse(body, format) } else fromDisk()
        } catch (_: Exception) { fromDisk() }
    }

    /** A random list that is not your own card list; null when the format has none. */
    fun pick(lists: List<JsonObject>, yours: JsonObject): JsonObject? {
        fun key(d: JsonObject) = (d.getAsJsonArray("cards") ?: JsonArray()).mapNotNull { r -> (r as? JsonObject)?.let { it.get("name")?.asString?.lowercase() + "x" + (it.get("qty")?.asInt ?: 0) } }.sorted()
        val own = key(yours)
        return lists.filter { key(it) != own }.randomOrNull()
    }
}
