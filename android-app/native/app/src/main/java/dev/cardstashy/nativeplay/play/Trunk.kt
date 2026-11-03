package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject

/**
 * The Trunk's logic, from play-econ-ui.js: state.cards rows, holoSplit, filterPlayCards, sortPlayCards,
 * playSetRows / allPlaySets, and the Play lens of app.js (owned, stamp, holo, craft, setProgress).
 * Play only: reads /api/progress state, never the real collection, never prices.
 */
object Trunk {
    /** One state.cards row; [holo] marks the holo tile holoSplit makes. p = the printing pulled first. */
    data class Card(val o: String, val n: String, val r: String, val c: Int, val h: Int, val s: List<String>, val pid: String?, val pset: String?,
                    val pimage: String?, val pnumber: String?, val a: String, val holo: Boolean = false)

    fun cards(state: JsonObject?): List<Card> = state?.getAsJsonArray("cards")?.mapNotNull { e -> val o = e as? JsonObject ?: return@mapNotNull null
        val p = o.getAsJsonObject("p")
        Card(o.s("o"), o.s("n"), o.s("r"), o.i("c"), o.i("h"), o.getAsJsonArray("s")?.mapNotNull { it.takeIf { x -> x.isJsonPrimitive }?.asString } ?: emptyList(),
            p?.s("id")?.ifBlank { null }, p?.s("set")?.ifBlank { null }, p?.s("image")?.ifBlank { null }, p?.s("number")?.ifBlank { null }, o.s("a"))
    } ?: emptyList()

    /** Normal and holo copies of one card as separate tiles: the holo tile right after its card. */
    fun holoSplit(cards: List<Card>): List<Card> = cards.flatMap { c -> val h = minOf(c.h, c.c); val rest = c.c - h
        buildList { if (rest > 0) add(c.copy(c = rest)); if (h > 0) add(c.copy(c = h, holo = true)) } }

    val TYPES = listOf("Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Lands")
    val COLORS = listOf("W" to "White", "U" to "Blue", "B" to "Black", "R" to "Red", "G" to "Green", "C" to "Colorless")
    val RARITIES = listOf("" to "All", "common" to "Common", "uncommon" to "Uncommon", "rare" to "Rare", "mythic" to "Mythic")
    val SORTS = listOf("" to "Recently added", "name" to "Name", "rarity" to "Rarity", "set" to "Newest set", "cmc" to "Mana value", "count" to "Most copies")
    val SET_FORMATS = listOf("" to "All sets", "standard" to "Standard", "modern" to "Modern", "eternal" to "Vintage & Legacy", "started" to "Started")

    /** cardGroup (play-econ-cards.js): the deck builder's group for a type line. */
    fun group(type: String): String {
        if (type.isBlank()) return "Cards"
        val front = type.split("//")[0]
        for ((g, w) in listOf("Lands" to "Land", "Creatures" to "Creature", "Planeswalkers" to "Planeswalker", "Instants" to "Instant", "Sorceries" to "Sorcery",
            "Artifacts" to "Artifact", "Enchantments" to "Enchantment", "Battles" to "Battle")) if (Regex("\\b$w\\b").containsMatchIn(front)) return g
        return "Cards"
    }

    data class Filter(val query: String = "", val rarity: String = "", val color: String = "", val type: String = "", val set: String = "")

    fun filter(cards: List<Card>, facts: (String) -> CardFacts.Fact?, f: Filter): List<Card> {
        val q = f.query.trim().lowercase()
        return cards.filter { c ->
            if (q.isNotEmpty() && !c.n.lowercase().contains(q)) return@filter false
            if (f.rarity.isNotEmpty() && c.r != f.rarity) return@filter false
            if (f.set.isNotEmpty() && f.set !in c.s) return@filter false
            val fact = facts(c.o)
            if (f.color.isNotEmpty() && (fact == null || (if (f.color == "C") fact.k != "" else !fact.k.contains(f.color)))) return@filter false
            if (f.type.isNotEmpty() && (fact == null || group(fact.t) != f.type)) return@filter false
            true
        }
    }

    private val RANK = mapOf("mythic" to 0, "rare" to 1, "uncommon" to 2, "common" to 3)
    fun setOf(c: Card) = c.pset ?: c.s.firstOrNull() ?: ""

    fun sort(cards: List<Card>, facts: (String) -> CardFacts.Fact?, sort: String, sets: List<SetRow>): List<Card> {
        val byName = Comparator<Card> { a, b -> a.n.compareTo(b.n) }
        val rel = sets.associate { it.code to it.released }
        val cmp: Comparator<Card> = when (sort) {
            "rarity" -> compareBy<Card> { RANK[it.r] ?: 4 }.then(byName)
            "set" -> Comparator<Card> { a, b -> (rel[setOf(b)] ?: "").compareTo(rel[setOf(a)] ?: "") }.thenBy { setOf(it) }.then(byName)
            "cmc" -> compareBy<Card> { facts(it.o)?.m ?: 99.0 }.then(byName)
            "count" -> compareByDescending<Card> { it.c }.then(byName)
            "name" -> byName
            else -> Comparator<Card> { a, b -> b.a.compareTo(a.a) }.then(byName)
        }
        return cards.sortedWith(cmp)
    }

    data class SetRow(val code: String, val name: String, val icon: String, val released: String, val total: Int?, val owned: Int, val format: String = "eternal")

    /** playSetRows: every set you own cards from (plus the reward set), newest first. */
    fun setRows(state: JsonObject?): List<SetRow> {
        val owned = LinkedHashMap<String, Int>()
        for (c in cards(state)) for (code in c.s) owned[code] = (owned[code] ?: 0) + 1
        val reward = state?.getAsJsonObject("rewardSet")
        reward?.s("code")?.takeIf { it.isNotBlank() }?.let { owned.putIfAbsent(it, 0) }
        return owned.map { (code, have) -> val f = SetFacts.set(code)
            SetRow(code, f?.name?.ifBlank { null } ?: reward?.takeIf { it.s("code") == code }?.s("name")?.ifBlank { null } ?: code.uppercase(), SetFacts.icon(code), f?.released ?: "", f?.total, have) }
            .sortedWith(compareByDescending<SetRow> { it.released }.thenBy { it.name })
    }

    /** allPlaySets: the Merchant's sets plus every set you own cards from. */
    fun allSets(state: JsonObject?): List<SetRow> {
        val own = setRows(state).associateBy { it.code }; val out = LinkedHashMap<String, SetRow>()
        state?.getAsJsonArray("shop")?.forEach { e -> val x = e as? JsonObject ?: return@forEach; val code = x.s("code"); val f = SetFacts.set(code)
            out[code] = SetRow(code, x.s("name"), SetFacts.icon(code), x.s("released").ifBlank { f?.released ?: "" }, f?.total ?: x.get("count")?.takeIf { it.isJsonPrimitive }?.asInt,
                own[code]?.owned ?: 0, x.s("format").ifBlank { "eternal" }) }
        for ((code, o) in own) if (code !in out) out[code] = o
        return out.values.sortedWith(compareByDescending<SetRow> { it.released }.thenBy { it.name })
    }

    // ---------------------------------------------------------------- the Play lens (app.js setPlayLensSource)

    private val SEAL = mapOf("common" to "c", "uncommon" to "u", "rare" to "r", "mythic" to "m")
    val SEAL_NAME = mapOf("c" to "common", "u" to "uncommon", "r" to "rare", "m" to "mythic")

    /** ownedByName (play-econ-rules.js): each name's count, and the front face's name when it is free. */
    fun byName(list: List<Card>): Map<String, Int> { val out = LinkedHashMap<String, Int>()
        for (c in list) { out[c.n] = c.c; val front = c.n.split(" // ")[0]; if (front != c.n && front !in out) out[front] = c.c }
        return out }

    /** Copies owned: by oracle id, else by name (or the front face's name). */
    fun owned(state: JsonObject?, name: String, oracle: String?): Int {
        val list = cards(state)
        oracle?.let { o -> list.firstOrNull { it.o == o }?.c?.takeIf { it > 0 }?.let { return it } }
        val m = byName(list)
        return m[name]?.takeIf { it > 0 } ?: m[name.split(" // ")[0]] ?: 0
    }

    private fun basic(name: String) = name in setOf("Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes") || name.startsWith("Snow-Covered ")
    /** stepDeckCard +1 with owned forced to 4 (the card view's Add to deck): null when no more copies fit. */
    fun addOne(rows: List<Pair<String, Int>>, name: String, format: String): List<Pair<String, Int>>? {
        val copies = if (format == "Commander") 1 else 4
        val inDeck = rows.filter { it.first == name }.sumOf { it.second }
        if (!basic(name) && minOf(4, copies) - inDeck < 1) return null
        return if (rows.any { it.first == name }) rows.map { if (it.first == name) it.first to it.second + 1 else it } else rows + (name to 1)
    }

    private fun wallet(state: JsonObject?, key: String) = state?.getAsJsonObject("wallet")?.i("seal_$key") ?: 0
    private fun holoSeals(state: JsonObject?) = state?.getAsJsonObject("config")?.get("holoSeals")?.takeIf { it.isJsonPrimitive }?.asInt ?: 2

    data class Stamp(val id: String, val have: Int, val seals: Int, val rarity: String, val key: String, val holoCost: Int, val canFoil: Boolean, val sold: Boolean)
    fun stamp(state: JsonObject?, card: JsonObject?): Stamp? {
        val id = card.s("id"); val o = card.s("oracle_id"); if (id.isBlank() || o.isBlank()) return null
        val key = SEAL[card.s("rarity")] ?: return null
        val have = cards(state).firstOrNull { it.o == o }?.c ?: 0
        val sold = state?.getAsJsonArray("shop")?.any { (it as? JsonObject)?.s("code") == card.s("set") } == true || state?.getAsJsonObject("rewardSet")?.s("code") == card.s("set")
        return Stamp(id, have, wallet(state, key), SEAL_NAME.getValue(key), key, 1 + maxOf(1, holoSeals(state)),
            card?.getAsJsonArray("finishes")?.any { it.asString == "foil" } == true, sold)
    }

    data class Holo(val oracle: String, val can: Boolean, val afford: Boolean, val cost: Int, val seal: String)
    fun holo(state: JsonObject?, name: String, card: JsonObject?): Holo? {
        val list = cards(state)
        val c = list.firstOrNull { it.o == card.s("oracle_id") } ?: list.firstOrNull { it.n == name || it.n.split(" // ")[0] == name } ?: return null
        val seal = SEAL[c.r]; val cost = maxOf(1, holoSeals(state))
        return Holo(c.o, c.h < c.c && seal != null, seal != null && wallet(state, seal) >= cost, cost, seal?.let { SEAL_NAME[it] } ?: "")
    }

    data class Craft(val id: String, val seal: String, val room: Int, val seals: Int, val label: String)
    fun craft(state: JsonObject?, name: String, card: JsonObject?): Craft? {
        val seal = mapOf("common" to "c", "uncommon" to "u", "rare" to "r", "mythic" to "m", "special" to "r", "bonus" to "m")[card.s("rarity")] ?: return null
        val id = card.s("id").ifBlank { return null }
        return Craft(id, seal, maxOf(0, 4 - owned(state, name, card.s("oracle_id").ifBlank { null })), wallet(state, seal), SEAL_NAME.getValue(seal))
    }

    /** lens.setProgress: distinct cards owned whose sets include the code, of the set's total. */
    fun setProgress(state: JsonObject?, code: String): Pair<Int, Int?> = cards(state).count { code in it.s } to SetFacts.set(code)?.total

    fun decks(state: JsonObject?): List<JsonObject> = state?.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject } ?: emptyList()

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    private fun JsonObject.i(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0
}
