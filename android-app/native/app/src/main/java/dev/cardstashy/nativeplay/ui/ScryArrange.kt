package dev.cardstashy.nativeplay.ui

/**
 * The arrangement behind the scry / surveil view (specs/scry-view-brief.md): one row, the library card in the middle.
 * Cards left of it go to the bottom (surveil: the graveyard), cards right of it stay on top, and the card furthest right is drawn next.
 * Pure state, no engine words: a card is an opaque key (its position in the engine's list, library order, 0 = top). How the engine's
 * replies read this arrangement is decided from the captured prompts, not here.
 */
enum class ScryKind(val word: String) { SCRY("Scry"), SURVEIL("Surveil") }

class ScryArrange private constructor(val kind: ScryKind, private val row: List<Int>, val split: Int) {
    /** Cards left to right. The first [split] are on the left of the library card, the rest on its right. */
    val cards: List<Int> get() = row
    /** Left of the library card: the bottom (scry) or the graveyard (surveil), in row order. */
    val left: List<Int> get() = row.take(split)
    /** Right of the library card, in row order; the last one is drawn next. */
    val right: List<Int> get() = row.drop(split)
    /** What stays on top in the order it will be drawn (the card furthest right first). */
    val topInDrawOrder: List<Int> get() = right.reversed()

    /** Moves the card at row position [from] along the row. It never crosses the library card; [hop] does that. */
    fun slide(from: Int, by: Int): ScryArrange {
        if (from !in row.indices || by == 0) return this
        val onLeft = from < split
        val lo = if (onLeft) 0 else split
        val hi = if (onLeft) split - 1 else row.lastIndex
        val to = (from + by).coerceIn(lo, hi)
        if (to == from) return this
        return ScryArrange(kind, row.toMutableList().apply { add(to, removeAt(from)) }, split)
    }

    /** A drag: the card at [from] dropped on the same side at row position [to]. */
    fun dragTo(from: Int, to: Int): ScryArrange = slide(from, to - from)

    /** A tap or the A button: the card hops to the other side of the library card, landing next to it. */
    fun hop(from: Int): ScryArrange {
        if (from !in row.indices) return this
        val c = row[from]
        val rest = row.toMutableList().apply { removeAt(from) }
        return if (from < split) ScryArrange(kind, rest.apply { add(split - 1, c) }, split - 1)
        else ScryArrange(kind, rest.apply { add(split, c) }, split + 1)
    }

    /** The tag under the card at row position [at]. */
    fun tag(at: Int): String {
        if (at !in row.indices) return ""
        if (at < split) return if (kind == ScryKind.SURVEIL) "To graveyard" else "Bottom"
        val n = row.lastIndex - at
        return if (n == 0) "You draw this next" else "Drawn ${ordinal(n + 1)}"
    }

    /** The chip left on the table: "Scry · 2 on top, 1 on the bottom". A side with nothing on it is left out. */
    fun chip(): String = chipFor(kind, right.size, left.size)

    /** True when nothing moved: Done alone keeps every card on top in library order. */
    val untouched: Boolean get() = split == 0 && row == initialRow(row.size)

    companion object {
        /** Library order is 0 = top. Every card starts on the right with the top card furthest right, so Done alone keeps everything. */
        fun start(kind: ScryKind, count: Int) = ScryArrange(kind, initialRow(count), 0)
        /** What the turn clock answers when it runs out: keep all on top, in library order. */
        fun timeout(kind: ScryKind, count: Int) = start(kind, count)
        private fun initialRow(n: Int) = (n - 1 downTo 0).toList()

        fun chipFor(kind: ScryKind, top: Int, away: Int): String {
            val parts = buildList {
                if (top > 0) add("$top on top")
                if (away > 0) add(if (kind == ScryKind.SURVEIL) "$away to the graveyard" else "$away on the bottom")
            }
            return kind.word + " · " + parts.joinToString(", ")
        }
        /** What the CPU's scry shows on the table: only a count, never its cards. */
        fun cpuChip(count: Int) = "CPU scries $count"
        private fun ordinal(n: Int) = when (n) { 2 -> "2nd"; 3 -> "3rd"; else -> "${n}th" }
    }
}
