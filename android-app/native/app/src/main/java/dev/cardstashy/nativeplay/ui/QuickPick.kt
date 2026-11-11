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

    // ---- 0.4.59 T8b, two screens: the bottom screen is a 5 by 5 grid of 25 decks a page (no scrolling); LT/RT turn the page.

    const val PAGE = 25
    const val DUAL_COLS = 5

    fun pages(count: Int): Int = maxOf(1, (count + PAGE - 1) / PAGE)
    fun pageOf(i: Int): Int = maxOf(0, i) / PAGE
    /** The decks on [page] (by index into the whole list). */
    fun pageRange(page: Int, count: Int): IntRange = (page * PAGE) until minOf(count, (page + 1) * PAGE)

    /** The d-pad on the bottom screen: [next] inside the ringed deck's page of 5 columns (a page's top row goes Up to the chips). */
    fun nextOnPage(i: Int, dir: Dir, count: Int): Stop? {
        val base = pageOf(i) * PAGE
        return when (val s = next(i - base, dir, DUAL_COLS, minOf(PAGE, count - base))) { is Stop.Deck -> Stop.Deck(base + s.i); else -> s }
    }

    /** LT (-1) and RT (+1): the same place on the page before or after, else that page's last deck; the first and last pages stay. */
    fun turnPage(i: Int, d: Int, count: Int): Int {
        if (count <= 0) return 0
        val to = (pageOf(i) + d).coerceIn(0, pages(count) - 1)
        return minOf(to * PAGE + (i % PAGE), count - 1)
    }

    /** Left and Right on the format chips (the bottom screen cannot take focus, so the chips are walked here): the chip that way, or null. */
    fun chipStep(chips: Int, at: Int, dir: Dir): Int? {
        val j = when (dir) { Dir.LEFT -> at - 1; Dir.RIGHT -> at + 1; else -> return null }
        return j.takeIf { it in 0 until chips }
    }

    /**
     * The top screen's numbers, worked out from the real decklist: each card type's count (the deck view's groups and order) and the
     * mana curve 0 to 7+ over the cards that are not lands. A card whose facts are not in yet counts under "Cards" and not on the curve.
     */
    data class Stats(val types: List<Pair<String, Int>>, val curve: List<Int>, val lands: Int)

    fun stats(lines: List<dev.cardstashy.nativeplay.play.DeckEdit.Line>, fact: (String) -> dev.cardstashy.nativeplay.play.CardFacts.Fact?): Stats {
        val groups = dev.cardstashy.nativeplay.play.DeckEdit.groups(lines, fact)
        val curve = IntArray(8)
        for ((g, rows) in groups) if (g != "Lands") for (l in rows) fact(l.name)?.let { curve[it.m.toInt().coerceIn(0, 7)] += l.qty }
        return Stats(groups.map { (g, rows) -> g to rows.sumOf { it.qty } }, curve.toList(), groups.firstOrNull { it.first == "Lands" }?.second?.sumOf { it.qty } ?: 0)
    }
}

