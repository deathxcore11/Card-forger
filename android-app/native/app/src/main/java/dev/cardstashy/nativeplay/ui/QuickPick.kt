package dev.cardstashy.nativeplay.ui

/**
 * 0.4.59 T8, the Quick Play deck grid's rules, kept apart from the screen so they are tested on their own: how many columns,
 * where the ring goes on the d-pad, which decks a source and format chip show, and the words when none do.
 */
internal object QuickPick {
    /**
     * Columns: 5 on phones (landscape) and on the Fold, 6 on a tablet, 5 by 5 on a dual bottom screen. An upright screen gets
     * fewer (3 under 600 dp, 2 under 480 dp), so a long name stays whole on two lines (the spec counts 5 for landscape).
     */
    fun columns(widthDp: Float, dual: Boolean): Int = when {
        dual -> 5
        widthDp >= 1000f -> 6
        widthDp >= 600f -> 5
        widthDp >= 480f -> 3
        else -> 2
    }

    /** The format chips: All first, then the formats the lobby already plays (LIVE_FORMATS); none added, none dropped. */
    fun chips(live: List<String>): List<String?> = listOf<String?>(null) + live

    fun chipLabel(f: String?) = f ?: "All"

    /** "No <format> decks here yet." (no format named under All). */
    fun empty(format: String?) = if (format == null) "No decks here yet." else "No $format decks here yet."

    enum class Dir { UP, DOWN, LEFT, RIGHT }

    /** Where the ring goes: a deck by index, the format chips (Up from the top row), or nowhere (null: it stays). */
    sealed interface Stop { data object Chips : Stop; data class Deck(val i: Int) : Stop }

    /**
     * The d-pad on the grid of [count] decks in [cols] columns. Left and Right stop at the row's ends; Down from a column the short
     * last row lacks lands on the last deck; Up from the top row reaches the format chips. Search is never on this path (it is on Y).
     */
    fun next(i: Int, dir: Dir, cols: Int, count: Int): Stop? {
        if (count <= 0) return if (dir == Dir.UP) Stop.Chips else null
        val col = i % cols
        return when (dir) {
            Dir.LEFT -> if (col == 0) null else Stop.Deck(i - 1)
            Dir.RIGHT -> if (col == cols - 1 || i + 1 >= count) null else Stop.Deck(i + 1)
            Dir.UP -> if (i < cols) Stop.Chips else Stop.Deck(i - cols)
            Dir.DOWN -> when {
                i + cols < count -> Stop.Deck(i + cols)
                i / cols < (count - 1) / cols -> Stop.Deck(count - 1)
                else -> null
            }
        }
    }

    /** Down from the chips: the deck in the same column of the top row, else the first. */
    fun fromChips(chip: Int, cols: Int, count: Int): Int? = if (count == 0) null else minOf(chip.coerceAtMost(cols - 1), count - 1)

    /**
     * The colour pips for a deck: the commander's colour identity when it has one, else every colour its non-land cards carry,
     * in WUBRG order; colourless ("C") when none.
     */
    fun colors(commanderIdentity: String?, cardColors: List<String>): List<String> {
        val from = commanderIdentity?.takeIf { it.isNotBlank() } ?: cardColors.joinToString("")
        return "WUBRG".filter { it in from.uppercase() }.map { it.toString() }.ifEmpty { listOf("C") }
    }
}
