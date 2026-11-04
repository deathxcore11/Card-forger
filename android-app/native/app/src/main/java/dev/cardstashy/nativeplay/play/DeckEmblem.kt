package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject

/**
 * Line-for-line port of the site's play-deck-emblem.js deckEmblem (web 4.3.90): a Play deck's mana colours,
 * its plan in one word read from what its cards do, the meta archetype it is close to, and whether it is a
 * precon (real printings on every row). Pure: card facts (name -> Scryfall card) and meta lists come in.
 */
object DeckEmblem {
    data class Emblem(val colors: List<String>, val style: String, val meta: String, val precon: Boolean)
    class Meta(val archetype: String, val cards: List<Decks.Row>)

    private fun overlap(a: Map<String, Int>, b: Map<String, Int>): Double {
        var num = 0; var den = 0
        for (k in a.keys + b.keys) { val x = a[k] ?: 0; val y = b[k] ?: 0; num += minOf(x, y); den += maxOf(x, y) }
        return if (den > 0) num.toDouble() / den else 0.0
    }
    private val BASIC_COLOR = mapOf("Plains" to "W", "Island" to "U", "Swamp" to "B", "Mountain" to "R", "Forest" to "G",
        "Snow-Covered Plains" to "W", "Snow-Covered Island" to "U", "Snow-Covered Swamp" to "B", "Snow-Covered Mountain" to "R", "Snow-Covered Forest" to "G")
    private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    private fun faces(c: JsonObject) = c.getAsJsonArray("card_faces")?.mapNotNull { it as? JsonObject } ?: emptyList()
    private fun typeOf(c: JsonObject) = c.s("type_line").ifEmpty { faces(c).firstOrNull().s("type_line") }
    private fun textOf(c: JsonObject) = c.s("oracle_text").ifEmpty { faces(c).joinToString("\n") { it.s("oracle_text") } }
    private fun rx(p: String) = Regex(p, RegexOption.IGNORE_CASE)
    private val RAMP = rx("""\badd \{|search your library for (?:a|up to \w+) (?:basic )?(?:land|plains|island|swamp|mountain|forest)""")
    private val PLAN = linkedMapOf(
        "lifegain" to rx("""\bgain (?:\d+|x|that much) life|\blifelink\b|whenever you gain life"""),
        "drain" to rx("""(?:each opponent|target opponent|that player|defending player) loses \d+ life|opponent loses (?:\d+|x|that much) life"""),
        "burn" to rx("""deals? (?:\d+|x) damage to (?:any target|each opponent|target (?:player|opponent))"""),
        "removal" to rx("""\b(?:destroy|exile) target (?:creature|nonland permanent|permanent)|deals? (?:\d+|x) damage to (?:any target|target creature)|target creature gets -\d+/-\d+"""),
        "counter" to rx("""\bcounter target\b"""),
        "bounce" to rx("""return target (?:creature|nonland permanent)[^.]*to (?:its|their) owner'?s? hand"""),
        "tokens" to rx("""\bcreate (?:a|an|two|three|four|x|\d+) [^.]*token"""),
        "draw" to rx("""\bdraw (?:a|two|three|\d+) cards?"""),
    )
    private val FLYING = rx("""\bflying\b""")

    private fun planOf(n: Map<String, Int>, nonland: Int, creatures: Int, avg: Double, flyers: Int, ramp: Int): String {
        val share = if (nonland > 0) creatures.toDouble() / nonland else 0.0
        fun at(k: String) = (n[k] ?: 0).toDouble() / maxOf(1, nonland)
        if (ramp >= 8 && avg >= 3) return "Ramp"
        if (at("burn") >= 0.25) return "Burn"
        if (at("drain") >= 0.2) return "Drain"
        if (at("lifegain") >= 0.3) return "Lifegain"
        if (at("counter") + at("bounce") >= 0.15 && flyers >= creatures * 0.4) return "Tempo"
        if (creatures > 0 && flyers >= creatures * 0.5) return "Fliers"
        if (at("tokens") >= 0.25) return "Go wide"
        if (share < 0.3 && at("removal") + at("counter") + at("draw") >= 0.35) return "Control"
        if (avg >= 3.8) return "Big"
        if (avg <= 2.4 && share >= 0.6) return "Aggro"
        if (creatures >= 20 && avg <= 3) return "Creatures"
        return "Midrange"
    }
    /** A tournament list counts as this deck's archetype when they share most of the same cards. */
    const val META_MATCH = 0.55

    fun of(rows: List<Decks.Row>, cardOf: (String) -> JsonObject? = { null }, metaLists: List<Meta> = emptyList()): Emblem {
        val main = rows.filter { it.name.isNotEmpty() && it.board != "side" }
        val colors = HashSet<String>()
        var nonland = 0; var creatures = 0; var mv = 0.0; var ramp = 0; var known = 0; var flyers = 0
        val n = HashMap<String, Int>()
        for (r in main) {
            val qty = maxOf(1, r.qty); val basic = BASIC_COLOR[r.name]
            if (basic != null) { colors.add(basic); continue }
            val c = cardOf(r.name) ?: continue
            c.getAsJsonArray("color_identity")?.forEach { val k = it.asString; if (k != "C") colors.add(k) }
            val t = typeOf(c)
            if (Regex("""\bLand\b""").containsMatchIn(t)) continue
            known += qty; nonland += qty; mv += (c.get("cmc")?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble ?: 0.0) * qty
            if ("Creature" in t) creatures += qty
            val text = textOf(c)
            if (RAMP.containsMatchIn(text)) ramp += qty
            if ("Creature" in t && FLYING.containsMatchIn(text)) flyers += qty
            for ((k, re) in PLAN) if (re.containsMatchIn(text)) n[k] = (n[k] ?: 0) + qty
        }
        val avg = if (nonland > 0) mv / nonland else 0.0
        // Needs most of the deck's cards loaded before it names a style.
        val want = main.filter { BASIC_COLOR[it.name] == null }.sumOf { maxOf(1, it.qty) }
        val style = if (nonland == 0 || known < want * 0.7) "" else planOf(n, nonland, creatures, avg, flyers, ramp)
        var meta: Pair<Double, String>? = null
        if (metaLists.isNotEmpty()) {
            val mine = HashMap<String, Int>(); fun key(s: String) = s.lowercase()
            for (r in main) if (BASIC_COLOR[r.name] == null) mine[key(r.name)] = (mine[key(r.name)] ?: 0) + maxOf(1, r.qty)
            for (l in metaLists) {
                val theirs = HashMap<String, Int>()
                for (r in l.cards) if (BASIC_COLOR[r.name] == null && r.board != "side") theirs[key(r.name)] = (theirs[key(r.name)] ?: 0) + maxOf(1, r.qty)
                val sim = overlap(mine, theirs)
                if (sim >= META_MATCH && (meta == null || sim > meta.first)) meta = sim to l.archetype
            }
            if (meta != null && meta.second.isEmpty()) meta = null
        }
        // A bought precon is saved with its real printings (set and collector number on every row).
        val precon = main.isNotEmpty() && main.all { it.set.isNotEmpty() && it.number.isNotEmpty() }
        return Emblem("WUBRG".map { it.toString() }.filter { it in colors }, style, meta?.second ?: "", precon)
    }
}
