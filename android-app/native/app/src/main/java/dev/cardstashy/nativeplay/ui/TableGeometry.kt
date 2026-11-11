package dev.cardstashy.nativeplay.ui

/**
 * 0.4.59 T1 (specs/table-look-0459.md, fault 18; Randall 10 Nov "we had that already but you changed it so just make it bigger and
 * better ... scale it right"): the battlefield's existing art tiles, sized from the screen and never from a fixed dp.
 *
 * The four rows lie in the board (ZoneLayout): the CPU's back row and creatures from the top, yours from the bottom. One screen has the
 * hand below them; the dual top screen has no hand and its rows are taller. A full tile is 1.3 times as wide as it is tall. The board
 * is the middle 71.5 % of the width.
 *
 * Scale rule (0.4.60 Z2, specs/table-zones-brief.md): a tile's height is fixed from the usable height (20.5 % for creatures, 12.5 %
 * for lands; 23.5 % and 13 % on the dual top) and never changes with what is on the table. Crowding squeezes sideways: the art is
 * cropped narrower, down to 0.74 x the height, then the piles overlap from the right like a fan. Both creature rows always share one
 * tile size, both back rows another. Pure numbers, so the rule is unit tested (TableGeometryTest).
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

    /**
     * 0.4.60 Z2 (specs/table-zones-brief.md, "Tile height is fixed"): a creature tile is this share of the usable height (ZoneLayout's
     * hb), a land tile this share; the dual top screen's own pair. The usable height stops growing once [CAP_ONE] ([CAP_DUAL]) full
     * tiles fit across the board (ZoneLayout.of works it out), so on a tall screen the tiles stop growing and the spare is open table.
     */
    const val FRONT_ONE = .205f
    const val BACK_ONE = .125f
    const val FRONT_DUAL = .235f
    const val BACK_DUAL = .13f
    const val CAP_ONE = 4.6f
    const val CAP_DUAL = 4.15f
    /** The gap between the two creature rows is at least this share of the usable height (the aura strips rise into it). */
    const val MID_GAP = .065f
    /** A crowded row narrows its tiles by cropping the art, never below this share of the tile's height; past that piles overlap. */
    const val CROP_MIN = .74f
    /** A tile narrower than this share of its full width (1.3 x height) is squeezed: its name may take three lines. */
    const val SQUEEZED = .8f

    /** 0.4.60 Z1: the board starts after the left strip (ZoneLayout.RAIL); it is the middle 71.5 % of the width. */
    const val BOARD_X = ZoneLayout.RAIL
    const val BOARD_W = .715f
    /** Back rows start this share of the width in from the board's left edge, clear of the seat plate, never centred like a hand. */
    const val BACK_INSET = .045f
    const val ASPECT = 1.3f
    /** The gap between piles, as a share of the tile's width. */
    const val GAP = .16f
    /** How much of each card under a pile's top shows, as a share of the tile's width, when the tile size is worked out. */
    const val STEP = .18f
    /**
     * T2 (fans you can read, faults 18 and 19): once the tile size is set, each row fans its piles as wide as it has room for: a
     * creature pile's cards step right by up to 66 % of a tile, a back row's by up to 30 %, never less than 15 % when tight.
     */
    const val FAN_MAX = .66f
    const val FAN_MAX_BACK = .30f
    const val FAN_MIN = .15f
    /** The gap before a back row's second lane (its non-land permanents), as a share of the tile's width. */
    const val LANE = .3f
    /** A land tile is at most this share of a creature tile's height. */
    const val LAND_MAX = .7f
    /**
     * A tapped tile turns 20 degrees and shrinks to 94 % (Tile): half its upright bounding box is this share of its height
     * (.94 x (cos 20 + 1.3 sin 20) / 2). Two neighbouring rows' tiles are never so tall that their tapped tiles meet.
     */
    const val TAPPED_HALF = .6506f
    /** How far past its side a tapped tile's turned corner reaches, as a share of the tile's width (.94 x (cos 20 + sin 20 / 1.3) / 2 - .5). */
    const val TAPPED_SIDE = .0653f
    /**
     * T4 (aura look A): each aura on a creature peeks above its tile as a strip raised this share of the tile's height; at most
     * [STRIPS_MAX] show (a "+N" on the upper one). A row with auras keeps that much clear above its tiles.
     */
    const val STRIP = .15f
    const val STRIPS_MAX = 2

    /**
     * Mobile table M5: a phone's creature tile is 18.5 % of the height. (Arena's is 12 % and carries no name; ours wears its name, its
     * P/T plate and the G1 keyword marks, which 14 % had no room for: the brief's "Phone conflicts from the full picture run".)
     */
    const val FRONT_PHONE = .185f
    /** Z2: the narrowest a squeezed creature tile gets (dp at chrome scale 1). */
    const val FRONT_W_MIN = 59f
    fun front(dualTop: Boolean, phone: Boolean = false) = if (dualTop) FRONT_DUAL else if (phone) FRONT_PHONE else FRONT_ONE
    fun backShare(dualTop: Boolean) = if (dualTop) BACK_DUAL else BACK_ONE
    fun cap(dualTop: Boolean) = if (dualTop) CAP_DUAL else CAP_ONE

    /**
     * 0.4.60 Z2: the four rows in the board from [top] to [bottom] (dp), their heights fixed from the usable height [hb]: a creature
     * row [front] of it, a back row [backShare] of it, whatever is on the table. Each side hugs its own edge, in this order of need:
     *  1. the outer rows sit in by as much as a tapped tile's turned corners reach, so a tapped land stays on the board;
     *  2. the creature rows keep at least [MID_GAP] of [hb] between them (the aura strips), and never less than two tapped creatures need;
     *  3. what is left first parts each back row from its creature row until their tapped tiles cannot meet;
     *  4. the rest is open table between the two sides (a tall screen).
     * Only a board too short for 1 and 2 (a pod's rail along the top) shrinks the tiles, all rows alike.
     */
    fun rows(dualTop: Boolean, top: Float, bottom: Float, hb: Float): Rows {
        var c = front(dualTop) * hb
        var l = backShare(dualTop) * hb
        var mid = maxOf(MID_GAP * hb, (2 * TAPPED_HALF - 1) * c)
        var edge = (TAPPED_HALF - .5f) * l
        val room = (bottom - top).coerceAtLeast(1f)
        val need = 2 * edge + 2 * l + 2 * c + mid
        if (room < need) { val s = room / need; c *= s; l *= s; mid *= s; edge *= s }
        val spare = (room - (2 * edge + 2 * l + 2 * c + mid)).coerceAtLeast(0f)
        val side = minOf((TAPPED_HALF - .5f) * (l + c), spare / 2)
        val cpuBack = Band(top + edge, l)
        val cpuFront = Band(cpuBack.bottom + side, c)
        val myBack = Band(bottom - edge - l, l)
        val myFront = Band(myBack.top - side - c, c)
        return Rows(cpuBack, cpuFront, myFront, myBack)
    }

    /**
     * Mobile table M5, a phone: each row's centre is a share of the window's height (ZoneLayout.ROW_*: the CPU's lands 15 %, its
     * creatures 33 %, yours 56 %, your lands 73 %, beside the hand), in a window from [winTop], [winH] tall. A creature tile is
     * [FRONT_PHONE] of [hb], a land [BACK_ONE]. A pod's rail ([podTop] off the top) pushes the CPU's rows down under it.
     */
    fun rowsPhone(winTop: Float, winH: Float, hb: Float, podTop: Float = 0f): Rows {
        val c = FRONT_PHONE * hb; val l = BACK_ONE * hb
        fun band(share: Float, h: Float) = Band(winTop + share * winH - h / 2, h)
        var cpuBack = band(ZoneLayout.ROW_CPU_BACK, l); var cpuFront = band(ZoneLayout.ROW_CPU_FRONT, c)
        val edge = (TAPPED_HALF - .5f) * l
        if (podTop > 0f && cpuBack.top < winTop + podTop + edge) {
            cpuBack = Band(winTop + podTop + edge, l)
            cpuFront = Band(maxOf(cpuFront.top, cpuBack.bottom + (TAPPED_HALF - .5f) * (l + c)), c)
        }
        return Rows(cpuBack, cpuFront, band(ZoneLayout.ROW_MY_FRONT, c), band(ZoneLayout.ROW_MY_BACK, l))
    }

    /** How far past its side a tapped tile [w] wide and [h] tall reaches (turned 20 degrees, shrunk to 94 %). */
    fun sideReach(w: Float, h: Float): Float = .94f * (w * .9397f + h * .3420f) / 2 - w / 2

    /** The width a row of [piles] (each the number of cards in it, at most [PILE_EDGES] showing) takes at tile height [h]. */
    fun rowWidth(h: Float, piles: List<Int>, lane: Boolean = false, step: Float = STEP, w: Float = h * ASPECT, gap: Float = w * GAP): Float {
        if (piles.isEmpty()) return 0f
        return piles.sumOf { (w * (1 + step * (minOf(it, PILE_EDGES) - 1))).toDouble() }.toFloat() + gap * (piles.size - 1) + if (lane) w * LANE else 0f
    }

    /** T2: the widest fan step (share of the tile's width) that keeps a row of [piles] at tile height [h] inside [room]. */
    fun fanStep(h: Float, room: Float, piles: List<Int>, back: Boolean, lane: Boolean = false, w: Float = h * ASPECT, gap: Float = w * GAP): Float {
        val max = if (back) FAN_MAX_BACK else FAN_MAX
        val edges = piles.sumOf { minOf(it, PILE_EDGES) - 1 }
        if (edges == 0) return max
        val spare = room - rowWidth(h, piles, lane, 0f, w, gap)
        return (spare / (w * edges)).coerceIn(FAN_MIN, max)
    }

    /**
     * 0.4.60 Z2: the tile sizes for the table. The heights are the rows' (fixed); only the width gives way to crowding: one width for
     * both creature rows, one for both back rows. [front] / [back] heights, [frontW] / [backW] widths.
     */
    data class Tiles(val front: Float, val back: Float, val frontW: Float = front * ASPECT, val backW: Float = back * ASPECT) {
        /** The creature tiles are squeezed (their art cropped below 80 % of full width): a name may take three lines. */
        val squeezed get() = frontW < front * ASPECT * SQUEEZED - .01f
    }

    /**
     * The gap between piles in a row whose fuller side has [piles] piles: the mockup's 8 (4 once more than five piles share a row),
     * times the chrome scale [k].
     */
    fun gap(piles: Int, k: Float): Float = (if (piles > 5) 4f else 8f) * k

    /**
     * The widest tile ([h] tall) that lets every row in [rows] (each its pile sizes, and its room) fit side by side at the sizing
     * fan step, gaps [gap] apart: full width (1.3 x [h]) when it fits, else the art cropped, never below [CROP_MIN] x [h].
     */
    fun width(h: Float, rows: List<Pair<List<Int>, Float>>, gap: Float, lanes: List<Boolean> = rows.map { false }): Float {
        var w = h * ASPECT
        rows.forEachIndexed { i, (piles, room) ->
            if (piles.isEmpty()) return@forEachIndexed
            val edges = piles.sumOf { minOf(it, PILE_EDGES) - 1 }
            val fits = (room - gap * (piles.size - 1)) / (piles.size + STEP * edges + if (lanes[i]) LANE else 0f)
            w = minOf(w, fits)
        }
        return w.coerceIn(h * CROP_MIN, h * ASPECT)
    }

    /**
     * [rows] placed in dp; [room] the creature rows' width, [backRoom] the back rows'. Each list holds a row's pile sizes;
     * [cpuLane] / [myLane] say whether that back row has a second lane (lands and other permanents). [k] is the chrome scale.
     * The heights are the rows'; never changed by what is on the table (Z2). Strips no longer shrink a tile: the rows keep room.
     */
    fun tiles(rows: Rows, room: Float, backRoom: Float, cpuFront: List<Int>, myFront: List<Int>, cpuBack: List<Int>, myBack: List<Int>,
              cpuLane: Boolean = false, myLane: Boolean = false, myBackRoom: Float = backRoom, k: Float = 1f): Tiles {
        val front = rows.cpuFront.height; val back = rows.cpuBack.height
        val fg = gap(maxOf(cpuFront.size, myFront.size), k)
        val bg = gap(maxOf(cpuBack.size, myBack.size), k)
        // A creature tile is never squeezed under the brief's 59 (times the chrome scale): its name stays whole on three lines.
        val fw = width(front, listOf(cpuFront to room, myFront to room), fg).coerceAtLeast(minOf(FRONT_W_MIN * k, front * ASPECT))
        val bw = width(back, listOf(cpuBack to backRoom, myBack to myBackRoom), bg, listOf(cpuLane, myLane))
        return Tiles(front, back, fw, bw)
    }

    /**
     * One row laid out: [xs] each pile's left edge from the row's start, [fan] the fan step inside a pile (share of the tile's
     * width), [total] the row's width, [visible] how much of a pile's top tile shows when piles overlap (null: none do).
     */
    data class RowLay(val xs: List<Float>, val fan: Float, val total: Float, val visible: Float?)

    /**
     * 0.4.60 Z2: a row of [piles] tiles [w] wide and [h] tall in [room]. A pile fans as wide as there is room (T2, [fanStep]); then
     * the gaps close (the lane's gap too); past that the piles overlap from the right like a fan, every pile by the same amount,
     * each later pile over the one before. The height never changes. [laneAt] is the first pile of a back row's second lane (-1: none).
     */
    fun layRow(w: Float, h: Float, room: Float, piles: List<Int>, back: Boolean, laneAt: Int = -1, gap: Float = w * GAP,
               /** Mobile table M13: the piles from this one on (the permanents that are neither land nor creature) stand at the row's right end, the mirror of the lands; -1: none do. */
               rightFrom: Int = -1): RowLay {
        if (piles.isEmpty()) return RowLay(emptyList(), 0f, 0f, null)
        val n = piles.size
        val lane = laneAt in 1 until n
        val fan = fanStep(h, room, piles, back, lane, w, gap)
        val pw = piles.map { w * (1 + fan * (minOf(it, PILE_EDGES) - 1)) }
        var g = gap; var lg = if (lane) w * LANE else 0f
        var visible: Float? = null
        if (pw.sum() + g * (n - 1) + lg > room && n > 1) {
            g = (room - pw.sum() - lg) / (n - 1)
            if (g < 0f) { lg = 0f; g = (room - pw.sum()) / (n - 1); visible = (w + g).coerceAtLeast(1f) }
        }
        val xs = ArrayList<Float>(n); var x = 0f
        for (i in 0 until n) { if (i == laneAt && lane) x += lg; xs += x; x += pw[i] + g }
        // M13: with room to spare, the loose permanents move to the right end (a crowded row stays as it was).
        val slack = room - (x - g)
        if (rightFrom in 0 until n && visible == null && slack > 0f) { for (i in rightFrom until n) xs[i] = xs[i] + slack; return RowLay(xs, fan, room, visible) }
        return RowLay(xs, fan, x - g, visible)
    }

    /**
     * How far an attacking tile steps toward the other side (at most [most]): never so far that, tapped, it reaches an upright tile
     * in the row it faces.
     */
    fun advance(rows: Rows, front: Float, most: Float): Float =
        (rows.myFront.centre - rows.cpuFront.centre - (TAPPED_HALF + .5f) * front - 1f).coerceIn(0f, most)
}
