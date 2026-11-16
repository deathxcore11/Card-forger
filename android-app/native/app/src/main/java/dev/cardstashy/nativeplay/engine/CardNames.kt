package dev.cardstashy.nativeplay.engine

import android.content.Context
import com.google.gson.stream.JsonReader
import java.io.InputStreamReader

/**
 * The card names offered when a card asks you to name one (Kai Winn, Pithing Needle, Meddling Mage). Forge offers every card
 * face it knows; the names here are the engine's own card list (the rules data shipped in the app, one row per Forge card,
 * split and double-faced cards as their faces), so what you pick is a name Forge has. Forge still checks it (nonland, etc.).
 */
object CardNames {
    @Volatile private var cached: List<String>? = null

    /** All face names, sorted, read once from the app's rules seed (about 33,000 rows). */
    fun all(context: Context): List<String> = cached ?: synchronized(this) {
        cached ?: context.assets.open("forge-rules-seed/cards.json").use { faces(keys(JsonReader(InputStreamReader(it, Charsets.UTF_8)))) }.also { cached = it }
    }

    internal fun keys(r: JsonReader): List<String> {
        val out = ArrayList<String>(40_000)
        r.beginObject(); while (r.hasNext()) { out += r.nextName(); r.skipValue() }; r.endObject()
        return out
    }

    /** Forge card identities to face names: "Fire // Ice" is two names, Arena rebalanced copies (A-) are left out. */
    internal fun faces(identities: List<String>): List<String> =
        identities.asSequence().flatMap { it.split(" // ").asSequence() }.map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("A-") }
            .distinct().sortedWith(String.CASE_INSENSITIVE_ORDER).toList()

    /** Names to offer for what was typed: names that start with it first, then names that contain it; [limit] at most. */
    fun suggest(names: List<String>, typed: String, limit: Int = 6): List<String> {
        val q = typed.trim()
        if (q.length < 2) return emptyList()
        val starts = names.filter { it.startsWith(q, ignoreCase = true) }
        if (starts.size >= limit) return starts.take(limit)
        return (starts + names.filter { !it.startsWith(q, ignoreCase = true) && it.contains(q, ignoreCase = true) }).take(limit)
    }
}
