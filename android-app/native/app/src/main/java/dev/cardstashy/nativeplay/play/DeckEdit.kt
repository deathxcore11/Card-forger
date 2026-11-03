package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonObject

/**
 * The Play deck editor's logic, from play-econ-ui.js deckBuilderMarkup and app.js's playEcon* handlers:
 * the edit being worked on (main rows, the sideboard kept untouched), craftPlan, the grouped list, the
 * hero's numbers, pack goals and the body Save posts. Proven against the web in DeckEditTest.
 */
object DeckEdit {
    data class Line(val name: String, val qty: Int, val extra: JsonObject? = null)
    /** econUi.edit: main rows editable; side holds the saved sideboard rows exactly as they came. */
    data class Edit(val id: String?, val name: String, val format: String, val cards: List<Line>, val side: JsonArray = JsonArray(), val dirty: Boolean = false)

    fun open(deck: JsonObject?): Edit {
        if (deck == null) return Edit(null, "", "Standard", emptyList())
        val all = deck.getAsJsonArray("cards")?.mapNotNull { it as? JsonObject } ?: emptyList()
        val side = JsonArray().apply { all.filter { it.has("board") && it.get("board").let { b -> b.isJsonPrimitive && b.asString.isNotEmpty() } }.forEach { add(it.deepCopy()) } }
        val main = all.filter { o -> !(o.has("board") && o.get("board").let { b -> b.isJsonPrimitive && b.asString.isNotEmpty() }) }
            .map { o -> Line(o.s("name"), o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble?.toInt() ?: 0, o.deepCopy()) }
        return Edit(deck.s("id").ifBlank { null }, deck.s("name"), deck.s("format").ifBlank { "Standard" }, main, side)
    }

    /** playEconSaveEdit: {id, name || 'Play deck', format, cards: [...main, ...side]}; main rows keep their own fields. */
    fun saveBody(e: Edit): JsonObject = JsonObject().apply {
        if (e.id != null) addProperty("id", e.id)
        addProperty("name", e.name.ifBlank { "Play deck" }); addProperty("format", e.format)
        add("cards", JsonArray().apply {
            e.cards.forEach { l -> add((l.extra?.deepCopy() ?: JsonObject()).apply { addProperty("name", l.name); addProperty("qty", l.qty) }) }
            e.side.forEach { add(it.deepCopy()) }
        })
    }

    /** stepDeckCard with owned forced to 4 (playEconStep): +1 within the format's copies, −1 drops empty rows. */
    fun step(cards: List<Line>, name: String, step: Int, format: String): List<Line> {
        val row = cards.firstOrNull { it.name == name }
        if (step > 0) {
            val inDeck = cards.filter { it.name == name }.sumOf { it.qty }
            if (!Decks.isBasicLand(name) && minOf(4, Decks.deckRules(format).copies) - inDeck < 1) return cards
            return if (row != null) cards.map { if (it === row) it.copy(qty = it.qty + 1) else it } else cards + Line(name, 1)
        }
        if (row == null) return cards
        return cards.map { if (it === row) it.copy(qty = it.qty - 1) else it }.filter { it.qty > 0 }
    }
    fun room(cards: List<Line>, name: String, format: String): Int =
        if (Decks.isBasicLand(name)) Int.MAX_VALUE else maxOf(0, Decks.deckRules(format).copies - cards.filter { it.name == name }.sumOf { it.qty })

    data class PlanRow(val name: String, val miss: Int, val seal: String, val now: Int)
    data class Plan(val rows: List<PlanRow>, val need: Map<String, Int>, val have: Map<String, Int>, val craftable: Int, val missing: Int)
    private val SEAL = mapOf("common" to "c", "uncommon" to "u", "rare" to "r", "mythic" to "m", "special" to "r", "bonus" to "m")

    fun craftPlan(deck: List<Line>, owned: Map<String, Int>, rarityOf: (String) -> String, wallet: JsonObject?): Plan {
        val pre = ArrayList<Triple<String, Int, String>>(); val need = linkedMapOf("c" to 0, "u" to 0, "r" to 0, "m" to 0)
        for (c in deck) { if (Decks.isBasicLand(c.name)) continue; val miss = maxOf(0, c.qty - (owned[c.name] ?: 0)); if (miss == 0) continue
            val seal = SEAL[rarityOf(c.name)] ?: ""; pre += Triple(c.name, miss, seal); if (seal.isNotEmpty()) need[seal] = need.getValue(seal) + miss }
        fun w(k: String) = wallet?.get("seal_$k")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
        val have = linkedMapOf("c" to w("c"), "u" to w("u"), "r" to w("r"), "m" to w("m")); val left = LinkedHashMap(have)
        var craftable = 0
        val rows = pre.map { (n, miss, seal) -> val k = if (seal.isEmpty()) 0 else minOf(miss, left.getValue(seal)); if (seal.isNotEmpty()) left[seal] = left.getValue(seal) - k; craftable += k; PlanRow(n, miss, seal, k) }
        return Plan(rows, need, have, craftable, rows.sumOf { it.miss })
    }

    val GROUP_ORDER = listOf("Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Battles", "Cards", "Lands")
    /** The list grouped as the web: basics are Lands, else cardGroup(fact); each group by mana value then name. */
    fun groups(deck: List<Line>, fact: (String) -> CardFacts.Fact?): List<Pair<String, List<Line>>> {
        val g = LinkedHashMap<String, MutableList<Line>>()
        for (c in deck) g.getOrPut(if (Decks.isBasicLand(c.name)) "Lands" else Trunk.group(fact(c.name)?.t ?: "")) { ArrayList() } += c
        return GROUP_ORDER.filter { it in g }.map { k -> k to g.getValue(k).sortedWith(compareBy<Line> { fact(it.name)?.m ?: 99.0 }.thenBy { it.name }) }
    }

    data class Numbers(val count: Int, val size: Int, val ok: Boolean, val creatures: Int, val lands: Int, val avg: String)
    fun numbers(e: Edit, fact: (String) -> CardFacts.Fact?): Numbers {
        val rules = Decks.deckRules(e.format); val count = e.cards.sumOf { it.qty }; val gs = groups(e.cards, fact).toMap()
        val spells = e.cards.filter { !Decks.isBasicLand(it.name) && fact(it.name) != null && Trunk.group(fact(it.name)!!.t) != "Lands" }
        val n = spells.sumOf { it.qty }
        val avg = if (n > 0) "%.1f".format(java.util.Locale.US, spells.sumOf { it.qty * fact(it.name)!!.m } / n) else "—"
        return Numbers(count, rules.size, if (rules.exact) count == rules.size else count >= rules.size, gs["Creatures"]?.sumOf { it.qty } ?: 0, gs["Lands"]?.sumOf { it.qty } ?: 0, avg)
    }

    data class Goal(val code: String, val name: String, val miss: Int)
    /** packGoals: the sets your missing cards come from, most missing first, up to 4. */
    fun packGoals(plan: Plan, setOf: (String) -> Pair<String, String>?): List<Goal> {
        val by = LinkedHashMap<String, Goal>()
        for (r in plan.rows) { val (code, name) = setOf(r.name) ?: continue; if (code.isEmpty()) continue; val g = by[code] ?: Goal(code, name, 0); by[code] = g.copy(miss = g.miss + r.miss) }
        return by.values.sortedByDescending { it.miss }.take(4)
    }

    /** playEconCopyList. */
    fun copyList(e: Edit): String = e.cards.joinToString("\n") { "${it.qty} ${it.name}" } +
        if (e.side.size() > 0) "\n\nSideboard\n" + e.side.joinToString("\n") { val o = it.asJsonObject; "${(o.get("qty")?.asDouble?.toInt() ?: 0).let { q -> if (q == 0) 1 else q }} ${o.s("name")}" } else ""

    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
}
