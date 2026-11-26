package dev.cardstashy.nativeplay.ui

/**
 * The Play deck editor's Commander rules (Randall 26 Nov, "Make the deck builder smart"): who can lead, what Fill must do first,
 * and how many cards of each job Fill asks for. Pure: DeckEditor.kt asks Scryfall and the Trunk, this decides.
 */
internal object CommanderFill {
    private val LEGEND = Regex("Legendary.*(Creature|Planeswalker)")

    /** A card's type line (and text) says it can lead a Commander deck. */
    fun canLead(typeLine: String, oracle: String = ""): Boolean = LEGEND.containsMatchIn(typeLine) || oracle.contains("can be your commander", ignoreCase = true)

    /** What the Fill pill says: Commander with no commander set asks for one first. */
    fun fillLabel(format: String, leader: String?, open: Int, busy: Boolean): String =
        if (busy) "Finding cards…" else if (format == "Commander" && leader == null) "Pick a commander first" else "Fill $open empty slot${if (open > 1) "s" else ""}"

    /** Scryfall's colour-identity clause for a commander's colours ("bg" -> "id<=bg"; none -> colourless). */
    fun identityClause(identity: String?): String = if (identity == null) "" else " id<=" + identity.lowercase().ifEmpty { "c" }

    /** How many cards of each job Fill asks for, out of [need] open slots with [landsHave] lands already in the deck. */
    data class Plan(val ramp: Int, val draw: Int, val removal: Int, val sweepers: Int, val nonbasic: Int, val basics: Int, val theme: Int) {
        val total get() = ramp + draw + removal + sweepers + nonbasic + basics + theme
    }

    fun plan(need: Int, landsHave: Int, landTarget: Int = 36): Plan {
        if (need <= 0) return Plan(0, 0, 0, 0, 0, 0, 0)
        val lands = (landTarget - landsHave).coerceIn(0, (need * .42).toInt())
        val spells = need - lands
        val ramp = Math.round(spells * .14).toInt(); val draw = Math.round(spells * .14).toInt()
        val removal = Math.round(spells * .12).toInt(); val sweepers = minOf(3, Math.round(spells * .04).toInt())
        val nonbasic = minOf(10, lands / 3)
        return Plan(ramp, draw, removal, sweepers, nonbasic, lands - nonbasic, spells - ramp - draw - removal - sweepers)
    }

    /** How many cards you would craft that Fill may add: Owned only, then 3, 6, 12, or any (Play has no dollars: what a card costs is seals). */
    val CRAFT_STEPS = listOf(0, 3, 6, 12, Int.MAX_VALUE)
    fun craftWord(max: Int) = if (max <= 0) "owned only" else if (max == Int.MAX_VALUE) "owned + any craft" else "owned + craft up to $max"
    fun nextCraft(max: Int) = CRAFT_STEPS[(CRAFT_STEPS.indexOf(max).coerceAtLeast(0) + 1) % CRAFT_STEPS.size]

    /** The first [n] of [candidates] not already in the deck: cards you own first, then up to [craftMax] you would craft. */
    fun select(candidates: List<String>, owned: (String) -> Boolean, craftMax: Int, have: Set<String>, n: Int): List<String> {
        val fresh = candidates.distinct().filter { it.lowercase() !in have }
        val own = fresh.filter(owned).take(n.coerceAtLeast(0))
        return own + fresh.filterNot(owned).take(minOf(craftMax.coerceAtLeast(0), (n - own.size).coerceAtLeast(0)))
    }

    private val BASIC = mapOf('w' to "Plains", 'u' to "Island", 'b' to "Swamp", 'r' to "Mountain", 'g' to "Forest")

    /** [n] basic lands spread over the commander's colours (colourless: Wastes). */
    fun basicsFor(identity: String?, n: Int): List<Pair<String, Int>> {
        if (n <= 0) return emptyList()
        val names = (identity ?: "").lowercase().mapNotNull { BASIC[it] }.ifEmpty { listOf("Wastes") }
        return names.mapIndexed { i, nm -> nm to (n / names.size + if (i < n % names.size) 1 else 0) }.filter { it.second > 0 }
    }
}
