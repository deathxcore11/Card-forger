package dev.cardstashy.nativeplay.ui

import kotlinx.coroutines.sync.withLock

/*
 * The Deck Bench's filters (deck view redesign, approved by Randall 14 Nov 15:03Z; preview https://claude.ai/artifact/QucmK6B1f62hKLej98CUuZ):
 * the bar's colours and the Filters panel's Mana value, Type, Does, Rarity, Copies you own, Set and Sort. Pure logic, so the same
 * rules decide what the grid, the live "N cards" count and the chips show on every screen size.
 */

/** The panel's word lists, in the order they show. */
object BenchFilters {
    /** W U B R G, then C (colourless, not a land) and M (two colours or more). */
    val COLORS = listOf("W", "U", "B", "R", "G", "C", "M")
    val COLOR_NAMES = mapOf("W" to "White", "U" to "Blue", "B" to "Black", "R" to "Red", "G" to "Green", "C" to "Colourless", "M" to "Multicolour")
    /** 0..6, then 7 for 7 and up. */
    val MANA = (0..7).toList()
    fun manaLabel(v: Int) = if (v >= 7) "7+" else "$v"
    val TYPES = listOf("Creature", "Planeswalker", "Instant", "Sorcery", "Enchantment", "Artifact", "Battle", "Land")
    /** The builder's own role tags (deck-forge.js forgeTags) and the words the panel shows for them. */
    val DOES = listOf("ramp" to "Ramp", "draw" to "Draw", "removal" to "Removal", "wipe" to "Sweeper", "protection" to "Protection", "wincon" to "Finisher")
    val RARITIES = listOf("common" to "Common", "uncommon" to "Uncommon", "rare" to "Rare", "mythic" to "Mythic")
    /** 1..3, then 4 for 4 and up. */
    val COPIES = (1..4).toList()
    val SORTS = listOf("mv" to "Mana value", "name" to "Name", "rarity" to "Rarity", "new" to "Newest", "copies" to "Most copies")
    private val RANK = mapOf("mythic" to 0, "rare" to 1, "uncommon" to 2, "common" to 3)
    fun rank(r: String) = RANK[r.lowercase()] ?: 4
    /** A card's mana value bucket: 0..6, 7 for 7 and up. */
    fun bucket(cmc: Double) = cmc.toInt().coerceIn(0, 7)
}

/** What the browser is filtered and sorted by. The bar's colours live in [BenchUi.colors] (the callers' searches read them too). */
data class BenchFilter(
    val mana: Set<Int> = emptySet(),
    val types: Set<String> = emptySet(),
    val does: Set<String> = emptySet(),
    val rarity: Set<String> = emptySet(),
    val copies: Set<Int> = emptySet(),
    val notInDeck: Boolean = false,
    /** A set code, "" for every set. */
    val set: String = "",
    val sort: String = "mv",
) {
    /** The Filters button's badge: how many panel picks are on (colours show on the bar itself, Sort is not a filter). */
    val count: Int get() = mana.size + types.size + does.size + rarity.size + copies.size + (if (notInDeck) 1 else 0) + (if (set.isNotEmpty()) 1 else 0)
    val on: Boolean get() = count > 0

    /** Does [t] pass every filter on? [find] is the bar's search, [colors] its colour buttons, [roles] the builder's tags by card name. */
    fun keeps(t: BenchTile, find: String, colors: Set<String>, roles: Map<String, List<String>>): Boolean {
        val q = find.trim()
        if (q.isNotEmpty() && !t.name.contains(q, ignoreCase = true)) return false
        if (colors.isNotEmpty() && !colorKeeps(t, colors)) return false
        if (mana.isNotEmpty() && (t.land || BenchFilters.bucket(t.cmc) !in mana)) return false
        // Either face's type counts (Scryfall's t: reads both), so a spell // land shows under Land too.
        if (types.isNotEmpty() && types.none { w -> Regex("\\b$w\\b", RegexOption.IGNORE_CASE).containsMatchIn(t.typeLine) }) return false
        if (does.isNotEmpty()) { val r = roles[t.name] ?: roles[t.name.split(" // ")[0]] ?: return false; if (r.none { it in does }) return false }
        if (rarity.isNotEmpty() && t.rarity.lowercase() !in rarity) return false
        if (copies.isNotEmpty() && copies.none { n -> if (n >= 4) t.own >= 4 else t.own == n }) return false
        if (notInDeck && t.inDeck > 0) return false
        if (set.isNotEmpty() && !t.set.equals(set, ignoreCase = true) && t.sets.none { it.equals(set, ignoreCase = true) }) return false
        return true
    }

    /** The tiles in the Sort's order (Mana value keeps the browser's own order: its sections sort themselves). */
    fun sorted(tiles: List<BenchTile>): List<BenchTile> = when (sort) {
        "name" -> tiles.sortedBy { it.name.lowercase() }
        "rarity" -> tiles.sortedWith(compareBy<BenchTile> { BenchFilters.rank(it.rarity) }.thenBy { it.name })
        "new" -> tiles.sortedWith(compareByDescending<BenchTile> { it.released }.thenBy { it.name })
        "copies" -> tiles.sortedWith(compareByDescending<BenchTile> { it.own }.thenBy { it.name })
        else -> tiles
    }

    /** The chips under the bar: one per pick, with the filter that is left when its × is tapped. */
    fun chips(setName: (String) -> String): List<Pair<String, BenchFilter>> = buildList {
        for (v in mana.sorted()) add("Mana ${BenchFilters.manaLabel(v)}" to copy(mana = mana - v))
        for (t in BenchFilters.TYPES.filter { it in types }) add(t to copy(types = types - t))
        for ((k, w) in BenchFilters.DOES) if (k in does) add(w to copy(does = does - k))
        for ((k, w) in BenchFilters.RARITIES) if (k in rarity) add(w to copy(rarity = rarity - k))
        for (n in copies.sorted()) add((if (n >= 4) "Own 4+" else "Own $n") to copy(copies = copies - n))
        if (notInDeck) add("Not in this deck" to copy(notInDeck = false))
        if (set.isNotEmpty()) add(setName(set) to copy(set = ""))
    }

    /** LT/RT on the controller: one mana value at a time, through none, 0, 1 … 7+ and back to none. */
    fun stepMana(d: Int): BenchFilter {
        val now = if (mana.size == 1) mana.first() else -1
        val next = now + d
        return copy(mana = if (next < 0 || next > 7) emptySet() else setOf(next))
    }

    companion object {
        fun colorKeeps(t: BenchTile, colors: Set<String>): Boolean {
            if (t.colors.any { it in colors }) return true
            if ("C" in colors && t.colors.isEmpty() && !t.land) return true
            if ("M" in colors && t.colors.size >= 2) return true
            return false
        }
        /** Scryfall's words for the panel's picks it can search itself (All cards): mana value, type, rarity, set. Does and copies stay local. */
        fun query(f: BenchFilter): List<String> = buildList {
            if (f.mana.isNotEmpty()) add(f.mana.sorted().joinToString(" or ", "(", ")") { if (it >= 7) "mv>=7" else "mv=$it" })
            if (f.types.isNotEmpty()) add(f.types.joinToString(" or ", "(", ")") { "t:" + it.lowercase() })
            if (f.rarity.isNotEmpty()) add(f.rarity.joinToString(" or ", "(", ")") { "r:$it" })
            if (f.set.isNotEmpty()) add("s:" + f.set.lowercase())
        }
    }
}

/** A deck row's mana value bucket: its own [BenchRow.cmc], else read from its cost; null for a land or a row with neither. */
fun rowMana(r: BenchRow): Int? = if (r.cmc >= 0) BenchFilters.bucket(r.cmc) else if (r.cost.isNotBlank()) manaValue(r.cost).coerceIn(0, 7) else null

/** The deck's mana curve: copies of its spells (lands and the sideboard left out) at 0..6 and 7+. */
fun benchCurve(groups: List<BenchGroup>): List<Int> {
    val out = IntArray(8)
    for (g in groups) if (g.name != "Lands") for (r in g.rows) if (!r.fixed) rowMana(r)?.let { out[it] += r.qty }
    return out.toList()
}

/** The deck list by mana value (the list's Mana sort): spells at each value, then Lands as they were, then any sideboard. */
fun benchByMana(groups: List<BenchGroup>): List<BenchGroup> {
    val side = groups.filter { g -> g.rows.isNotEmpty() && g.rows.all { it.fixed } }
    val lands = groups.filter { it.name == "Lands" }
    val spells = (groups - side.toSet() - lands.toSet()).flatMap { it.rows }
    // A spell with no mana value to read yet (a card still loading) waits under Other rather than guess, and moves when it arrives.
    val known = spells.filter { rowMana(it) != null }
    val byMv = known.groupBy { rowMana(it)!! }.toSortedMap().map { (v, rows) ->
        BenchGroup("Mana value ${BenchFilters.manaLabel(v)}", rows.sortedBy { it.name }) }
    val other = (spells - known.toSet()).takeIf { it.isNotEmpty() }?.let { listOf(BenchGroup("Other", it.sortedBy { r -> r.name })) }.orEmpty()
    return byMv + other + lands + side
}

/**
 * The builder's role tags (deck-forge.js forgeTags through the app's engine bundle) for the cards the browser shows, by name: asked
 * only while Does has a pick, each card once, in batches. A batch the engine can't answer is asked again next time.
 */
object BenchRoles {
    val tags = kotlinx.coroutines.flow.MutableStateFlow<Map<String, List<String>>>(emptyMap())
    private val asked = HashSet<String>()
    private val lock = kotlinx.coroutines.sync.Mutex()

    /** Only what forgeTags reads: the name, type line, rules text, mana value and each face's. */
    private fun slim(c: com.google.gson.JsonObject) = com.google.gson.JsonObject().apply {
        for (k in listOf("name", "type_line", "oracle_text", "mana_cost", "cmc")) c.get(k)?.takeIf { !it.isJsonNull }?.let { add(k, it) }
        (c.get("card_faces") as? com.google.gson.JsonArray)?.let { faces -> add("card_faces", com.google.gson.JsonArray().apply {
            faces.forEach { f -> (f as? com.google.gson.JsonObject)?.let { o -> add(com.google.gson.JsonObject().apply {
                for (k in listOf("name", "type_line", "oracle_text", "mana_cost")) o.get(k)?.takeIf { !it.isJsonNull }?.let { add(k, it) } }) } } }) }
    }

    suspend fun want(cards: List<com.google.gson.JsonObject>) = lock.withLock {
        val fresh = cards.mapNotNull { c -> c.get("name")?.takeIf { it.isJsonPrimitive }?.asString?.let { it to c } }.distinctBy { it.first }.filter { it.first !in asked }
        for (batch in fresh.chunked(200)) {
            val r = runCatching { dev.cardstashy.nativeplay.play.RandomBuild.roleTags(com.google.gson.JsonArray().apply { batch.forEach { add(slim(it.second)) } }) }.getOrNull() ?: return@withLock
            val got = r.entrySet().associate { (k, v) -> k to ((v as? com.google.gson.JsonArray)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()) }
            asked += batch.map { it.first }
            tags.value = tags.value + got
        }
    }
}
