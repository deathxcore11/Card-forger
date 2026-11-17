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

    /** Names to offer for what was typed: names that start with it first, then names that contain it; [limit] at most; only those [fits]. */
    fun suggest(names: List<String>, typed: String, limit: Int = 6, fits: (String) -> Boolean = { true }): List<String> {
        val q = typed.trim()
        if (q.length < 2) return emptyList()
        val starts = names.filter { it.startsWith(q, ignoreCase = true) && fits(it) }
        if (starts.size >= limit) return starts.take(limit)
        return (starts + names.filter { !it.startsWith(q, ignoreCase = true) && it.contains(q, ignoreCase = true) && fits(it) }).take(limit)
    }

    @Volatile private var typesCached: Map<String, String>? = null

    /**
     * Each face's card types as letters (A artifact, B battle, C creature, E enchantment, I instant, K kindred, L land,
     * P planeswalker, S sorcery), from forge-rules-seed/card-types.json (scripts/bake-card-types.mjs, Scryfall's Oracle list).
     */
    fun types(context: Context): Map<String, String> = typesCached ?: synchronized(this) {
        typesCached ?: context.assets.open("forge-rules-seed/card-types.json").use { readTypes(JsonReader(InputStreamReader(it, Charsets.UTF_8))) }.also { typesCached = it }
    }

    internal fun readTypes(r: JsonReader): Map<String, String> {
        val out = HashMap<String, String>(40_000)
        r.beginObject()
        while (r.hasNext()) {
            if (r.nextName() != "types") { r.skipValue(); continue }
            r.beginObject(); while (r.hasNext()) { val l = r.nextName(); r.beginArray(); while (r.hasNext()) out[r.nextString()] = l; r.endArray() }; r.endObject()
        }
        r.endObject()
        return out
    }

    private val LETTER = mapOf("artifact" to 'A', "battle" to 'B', "creature" to 'C', "enchantment" to 'E', "instant" to 'I', "kindred" to 'K',
        "tribal" to 'K', "land" to 'L', "planeswalker" to 'P', "sorcery" to 'S')

    /** A type line ("Basic Land — Island", "Artifact Creature — Golem") as the same letters. */
    fun letters(typeLine: String): String = typeLine.split(Regex("\\s+[—-]\\s+"))[0].split(Regex("\\s+"))
        .mapNotNull { LETTER[it.lowercase()] }.toSortedSet().joinToString("")

    /**
     * What a "name a card" prompt asks for, read from Forge's words ("Choose a land card card name.", "Choose a nonland card name.",
     * "Choose an artifact or creature card name."): a card of any of [any] (none: any type) with none of [none]. Null when the
     * words hold something this cannot check ("basic", a creature type), so every name stays offered and Forge checks it.
     */
    class Want(val any: Set<Char>, val none: Set<Char>) {
        /** [letters] null: a name the type list does not hold (a card newer than it), offered. */
        fun fits(letters: String?): Boolean = letters == null || ((any.isEmpty() || letters.any { it in any }) && letters.none { it in none })
    }

    fun want(message: String): Want? {
        val m = Regex("choose an? (.+?)\\s*card name", RegexOption.IGNORE_CASE).find(message) ?: return null
        val words = m.groupValues[1].replace(Regex("\\bcards?\\b", RegexOption.IGNORE_CASE), " ").split(Regex("\\s*(?:,|\\bor\\b|\\band\\b)\\s*|\\s+"))
            .map { it.trim().lowercase() }.filter { it.isNotEmpty() }
        if (words.isEmpty()) return Want(emptySet(), emptySet())
        val any = HashSet<Char>(); val none = HashSet<Char>()
        for (w in words) {
            val neg = w.startsWith("non") && w.length > 3
            val t = LETTER[(if (neg) w.removePrefix("non").removePrefix("-") else w)] ?: return null
            if (neg) none += t else any += t
        }
        return Want(any, none)
    }
}
