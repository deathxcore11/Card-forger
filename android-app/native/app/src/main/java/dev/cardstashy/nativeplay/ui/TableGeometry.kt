package dev.cardstashy.nativeplay.ui

/**
 * 0.4.59 T1 (specs/table-look-0459.md, fault 18; Randall 10 Nov "we had that already but you changed it so just make it bigger and
 * better ... scale it right"): the battlefield's existing art tiles, sized from the screen and never from a fixed dp.
 *
 * The brief's rows are shares of the screen's height, drawn for the preview, which has no menu, phase track or seat dock. Here the
 * same four rows, in the same proportions, fill the height the table's own chrome leaves free: from under the menu and phase
 * track to above your seat and hand. One screen has the hand below them; the dual top screen has no hand and its rows are taller
 * (the brief's dual proportions). A tile is 1.3 times as wide as it is tall. The board is the middle 71.5 % of the width.
 *
 * Scale rule: each creature row works out the height its piles need to fit the board's width, and BOTH rows take the smaller one,
 * so your tiles and the CPU's are always the same size. Same for the two back rows (lands first). A land tile is never taller than
 * 70 % of a creature tile. Pure numbers, so the rule is unit tested (TableGeometryTest).
 */
internal object TableGeometry {
    /** One row: its top and its height (shares of the screen in the brief, dp once placed). */
    data class Band(val top: Float, val height: Float) { val centre get() = top + height / 2; val bottom get() = top + height }

    /** The four rows top to bottom: the CPU's back row, its creatures, your creatures, your back row. */
    data class Rows(val cpuBack: Band, val cpuFront: Band, val myFront: Band, val myBack: Band) {
        /** The divider between the halves, midway between the two creature rows. */
        val divider get() = (cpuFront.bottom + myFront.top) / 2
        val all get() = listOf(cpuBack, cpuFront, myFront, myBack)
    }

    /** The brief's rows, as shares of the screen's height. */
    val ONE_SCREEN = Rows(Band(.015f, .11f), Band(.155f, .20f), Band(.395f, .20f), Band(.635f, .11f))
    val DUAL_TOP = Rows(Band(.03f, .13f), Band(.21f, .235f), Band(.535f, .235f), Band(.83f, .13f))

    const val BOARD_X = .115f
    const val BOARD_W = .715f
    /** Back rows start this share of the width in from the board's left edge, clear of the seat plate, never centred like a hand. */
    const val BACK_INSET = .045f
    const val ASPECT = 1.3f
    /** The gap between piles, as a share of the tile's width. */
    const val GAP = .16f
    /** How much of each card under a pile's top shows, as a share of the tile's width (T2 revises the fan). */
    const val STEP = .18f
    /** The gap before a back row's second lane (its non-land permanents), as a share of the tile's width. */
    const val LANE = .3f
    /** A land tile is at most this share of a creature tile's height. */
    const val LAND_MAX = .7f

    fun shares(dualTop: Boolean) = if (dualTop) DUAL_TOP else ONE_SCREEN

    /** The brief's rows for this screen, laid into the free height from [top] to [bottom] (dp), in the brief's proportions. */
    fun rows(dualTop: Boolean, top: Float, bottom: Float): Rows {
        val s = shares(dualTop)
        val from = s.cpuBack.top; val to = s.myBack.bottom
        val k = (bottom - top).coerceAtLeast(1f) / (to - from)
        fun place(b: Band) = Band(top + (b.top - from) * k, b.height * k)
        return Rows(place(s.cpuBack), place(s.cpuFront), place(s.myFront), place(s.myBack))
    }

    /** The width a row of [piles] (each the number of cards in it, at most [PILE_EDGES] showing) takes at tile height [h]. */
    fun rowWidth(h: Float, piles: List<Int>, lane: Boolean = false): Float {
        if (piles.isEmpty()) return 0f
        val w = h * ASPECT
        return piles.sumOf { (w * (1 + STEP * (minOf(it, PILE_EDGES) - 1))).toDouble() }.toFloat() + w * GAP * (piles.size - 1) + if (lane) w * LANE else 0f
    }

    /** The tile height a row can have: its band's height, or less when its piles would not fit [room]. */
    fun fitHeight(band: Float, room: Float, piles: List<Int>, lane: Boolean = false): Float {
        val need = rowWidth(band, piles, lane)
        return if (need <= room || need <= 0f) band else band * room / need
    }

    /** The tile heights for the table: one for both creature rows, one for both back rows. */
    data class Tiles(val front: Float, val back: Float) { val frontW get() = front * ASPECT; val backW get() = back * ASPECT }

    /**
     * [rows] placed in dp; [room] the creature rows' width, [backRoom] the back rows'. Each list holds a row's pile sizes;
     * [cpuLane] / [myLane] say whether that back row has a second lane (lands and other permanents).
     */
    fun tiles(rows: Rows, room: Float, backRoom: Float, cpuFront: List<Int>, myFront: List<Int>, cpuBack: List<Int>, myBack: List<Int>,
              cpuLane: Boolean = false, myLane: Boolean = false): Tiles {
        val front = minOf(fitHeight(rows.cpuFront.height, room, cpuFront), fitHeight(rows.myFront.height, room, myFront))
        val back = minOf(fitHeight(rows.cpuBack.height, backRoom, cpuBack, cpuLane), fitHeight(rows.myBack.height, backRoom, myBack, myLane), front * LAND_MAX)
        return Tiles(front, back)
    }
}
