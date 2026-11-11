package dev.cardstashy.nativeplay.ui

/**
 * 0.4.60 Z1 (specs/table-zones-brief.md, "Measure zones in order"): the table laid out from the real window, its insets (cutouts,
 * bars) taken off first, never from the display's size. Zones are measured in order: the left and right strips (each 14.25 % of
 * the width inside the insets), then the hand tray at the bottom, and the board is what is left: the middle 71.5 %, full height
 * above the tray (the dual top screen has no tray, so its board runs the full height).
 *
 * Corners: the CPU's square top left, yours bottom left; the menu (with the turn) and the phase box top right; the action buttons
 * bottom right; the stack card in the right strip between the phase box and the buttons. Nothing in a strip ever takes board width.
 *
 * Numbers follow the approved mockup (design/roomier-table-mockup.html, lines 257 to 332), with [k] its chrome scale. Two changes
 * from the drawing, as the brief says: the menu and the buttons are 44 (dp at k = 1), not the drawing's 36. Pure numbers in dp,
 * no Compose, so the rule is unit tested (ZoneLayoutTest).
 *
 * Z1 review: the dual top keeps a band of its own under the board for the "Hand N · bottom screen" chip ([handChip]; the board ends
 * above it), and Undo has its own slot ([undo]) at the foot of the stack slot, never where End turn was (U6): while Undo shows, the
 * stack card stands above it ([stackAbove]).
 */
internal object ZoneLayout {
    /** A zone's box in dp: its left, top, width and height. */
    data class Box(val x: Float, val y: Float, val w: Float, val h: Float) {
        val right get() = x + w
        val bottom get() = y + h
        /** True when the two boxes share any point (touching edges count as meeting). */
        fun meets(o: Box): Boolean = x <= o.right && o.x <= right && y <= o.bottom && o.y <= bottom
        /** True when this box lies wholly inside [o] (a hair of rounding allowed). */
        fun inside(o: Box, eps: Float = .01f): Boolean = x >= o.x - eps && y >= o.y - eps && right <= o.right + eps && bottom <= o.bottom + eps
    }

    /** What the system takes off each edge of the window (status and navigation bars, display cutouts), in dp. */
    data class Insets(val left: Float = 0f, val top: Float = 0f, val right: Float = 0f, val bottom: Float = 0f)

    /**
     * The table's zones. [window] is the area inside the insets; [hb] the mockup's usable height (the window's height, or less once
     * the tile cap holds on a tall screen); [handTray] is null on the dual top screen (the hand is on the bottom screen), and
     * [handChip] is null on one screen (the dual top's band under the board for the hand's chip). [undo] is Undo's slot: the
     * foot of the [stack] slot, right-aligned like the buttons under it.
     */
    data class Zones(
        val window: Box, val k: Float, val hb: Float,
        val leftStrip: Box, val rightStrip: Box, val board: Box, val handTray: Box?,
        val cpuSquare: Box, val mySquare: Box, val menu: Box, val phase: Box, val stack: Box, val actions: Box,
        val handChip: Box?, val undo: Box,
        /** Mobile table M5: a phone-size window (not the dual top, not a big board): the phone's measured sizes apply. */
        val phone: Boolean = false,
        /** M5: a hand card's height (a share of the window's height), 0 on the dual top. */
        val handH: Float = 0f,
        /** M5, the phone: the room left of the hand where your lands lie (your back row), null elsewhere (the row is in [board]). */
        val shelf: Box? = null,
    ) {
        /** The boxes that must never meet one another (the strips hold the corners and are not listed themselves; [undo] lies in [stack]). */
        val all: Map<String, Box> get() = buildMap {
            put("board", board); shelf?.let { put("shelf", it) }; handTray?.let { put("handTray", it) }; handChip?.let { put("handChip", it) }
            put("cpuSquare", cpuSquare); put("mySquare", mySquare); put("menu", menu); put("phase", phase); put("stack", stack); put("actions", actions)
        }
        /** The stack card's room: the whole stack slot, or, while Undo shows in its slot, the part above it (8 between). */
        fun stackAbove(undoShown: Boolean): Box = if (!undoShown) stack else Box(stack.x, stack.y, stack.w, (undo.y - 8f * k - stack.y).coerceAtLeast(0f))
    }

    /** 0.4.60 Z6: the gold action button and the quiet row above it are at least this tall, in dp (the brief's 44 dp). */
    const val BUTTON = 44f
    /** Each side strip's share of the width inside the insets. */
    const val RAIL = .1425f
    /** The board's share: what the two strips leave. */
    const val BOARD = 1f - 2 * RAIL
    /** The stack card and its words end at least this far inside the right edge (W3: "CPU's ability" cut at the edge). */
    const val STACK_EDGE = 16f

    /**
     * The chrome scale: 1 on a big board (600 × 480 dp and up), else the 844 × 390 design scaled to fit (chromeU). The mockup's
     * hand-picked 1.3 (Portal, Fold, Thor) and 1.6 (tablet) are not used yet: [k] drives every du of the table's chrome (seats,
     * buttons, ring, piles), so growing it is the text and squares items' rule to set (Z3 "scale with the tile on bigger screens",
     * Z4 squares), not Z1's.
     */
    /**
     * Mobile table M5 (specs/mobile-table-arena-parity-brief.md, measured from Randall's Arena recordings): every size here is a
     * share of the window's height, kept in one place so it is easy to tune. A phone is a window short of the big board
     * (600 x 480 dp); the Fold open, a tablet and the Portal are big.
     */
    fun phone(w: Float, h: Float): Boolean = !(w >= 600f && h >= 480f)
    /** A hand card's height: 31 % of the height on a phone, 24 % on a big screen. */
    const val HAND_PHONE = .31f
    const val HAND_BIG = .24f
    /** How much of the hand card shows on your turn (its foot is below the screen's edge): 94 % on a phone, 84 % on a big screen. */
    const val HAND_SHOW_PHONE = .94f
    const val HAND_SHOW_BIG = .84f
    /** On the CPU's turn the hand sinks until this share of the height still shows: 14 % on a phone, 9 % on a big screen. */
    const val HAND_SUNK_PHONE = .14f
    const val HAND_SUNK_BIG = .09f
    /** Hand cards overlap: each steps this share of a card's width at the most; each leans this many degrees per place from the middle and drops along a shallow arc. */
    const val HAND_STEP = .78f
    const val HAND_TILT = 2f
    const val HAND_ARC = 1.6f
    /** The phone: the hand starts this far (dp at k = 1) in from the board's left edge; your lands lie in that room. */
    const val HAND_LEFT = 182f
    /** The card on the stack is this share of the height tall: 58 % on a phone, 43 % on a big screen (the dual top keeps its strip size). */
    const val STACK_PHONE = .58f
    const val STACK_BIG = .43f
    fun stackShare(z: Zones): Float = if (z.phone) STACK_PHONE else STACK_BIG
    /** A cast card pops to this share of the height to be read: 82 % on a phone, 64 % on a big screen. */
    const val POP_PHONE = .82f
    const val POP_BIG = .64f
    fun popShare(z: Zones): Float = if (z.phone) POP_PHONE else POP_BIG
    /** A lifted hand card is this share of the height tall: 80 % on a phone, 45 % on a big screen. */
    const val HAND_RAISE_PHONE = .80f
    const val HAND_RAISE_BIG = .45f
    /** The phone's four rows, each row's centre as a share of the height: the CPU's lands, its creatures, your creatures, your lands. */
    // (Measured in Arena: 15, 33, 56 and 73 %. With our taller tile, 18.5 %, the creature rows part by a quarter of the height so
    // tapped tiles and aura strips never meet, and the lands step out by as much.)
    const val ROW_CPU_BACK = .115f
    const val ROW_CPU_FRONT = .32f
    const val ROW_MY_FRONT = .57f
    const val ROW_MY_BACK = .775f

    fun scale(w: Float, h: Float): Float = if (w >= 600f && h >= 480f) 1f else minOf(w / 844f, h / 390f)

    /**
     * The zones for a [w] × [h] dp window with [insets] taken off, one screen or the dual top screen ([dual]). [k] is the chrome
     * scale (by default worked out from the size inside the insets); [hand] is the number of hand cards the tray is sized for.
     */
    fun of(w: Float, h: Float, insets: Insets = Insets(), dual: Boolean = false, k: Float? = null, hand: Int = 7): Zones {
        // 1. The window inside the insets.
        val win = Box(insets.left, insets.top, (w - insets.left - insets.right).coerceAtLeast(1f), (h - insets.top - insets.bottom).coerceAtLeast(1f))
        val u = k ?: scale(win.w, win.h)
        val pad = 8f * u
        // 2. The strips, each 14.25 % of that width.
        val rail = RAIL * win.w
        val left = Box(win.x, win.y, rail, win.h)
        val right = Box(win.right - rail, win.y, rail, win.h)
        val bx = left.right; val bw = BOARD * win.w
        // The mockup's usable height: a creature tile is 20.5 % of it (23.5 % on the dual top) until 4.6 (4.15) full tiles fill the
        // board's width; past that the tile stops growing and the spare height is open table (Z2 sizes the tiles from it).
        val phone = !dual && phone(win.w, win.h)
        val fC = TableGeometry.front(dual, phone)
        val c = minOf(fC * win.h, bw / TableGeometry.cap(dual) / TableGeometry.ASPECT)
        val hb = c / fC
        // 3. The hand (M5): cards 31 % of the height on a phone (24 % on a big screen), their foot below the window's edge. Nothing is
        // drawn behind them. On a phone the hand starts [HAND_LEFT] in from the board's left (your lands lie there) and ends 6 into
        // the right strip or short of the gold button, whichever comes first; on a big screen it has the board's width. The box is the part of the hand that shows on your turn.
        val handH = if (dual) 0f else (if (phone) HAND_PHONE else HAND_BIG) * win.h
        val tray = if (dual) null else {
            val top = win.bottom - handH * (if (phone) HAND_SHOW_PHONE else HAND_SHOW_BIG)
            val x0 = if (phone) bx + HAND_LEFT * u else bx
            // It ends short of the gold button's least width (138, GoldPill), and a tilted card's corner (24 in all), so no button's words are cut on a phone.
            val x1 = if (phone) minOf(right.x + 6f * u, win.right - pad - (138f + 24f) * u) else bx + bw
            Box(x0, top, x1 - x0, win.bottom - top)
        }
        // The dual top has no tray, but the hand keeps a chip there ("Hand 7 · bottom screen", the d-pad's way into the hand on the
        // bottom screen): a band of its own across the board's width at the bottom, 36 tall, 4 above the window's bottom.
        val chip = if (!dual) null else Box(bx, win.bottom - 4f * u - 36f * u, bw, 36f * u)
        // 4. The board: the middle of the width, from the window's top to just above the tray (above the chip's band on the dual top).
        // On a phone the board ends under your creatures (a tapped tile's turned corner still on it); your lands lie below, in the
        // shelf left of the hand.
        val boardBottom = if (phone) win.y + ROW_MY_FRONT * win.h + TableGeometry.TAPPED_HALF * fC * hb + 2f * u
            else (tray ?: chip)?.let { it.y - 2f * u } ?: win.bottom
        val board = Box(bx, win.y, bw, boardBottom - win.y)
        val shelf = if (phone && tray != null) Box(bx, boardBottom + 2f * u, (tray.x - 6f * u - bx).coerceAtLeast(1f), (win.bottom - 4f * u - boardBottom - 2f * u).coerceAtLeast(1f)) else null
        // 5. The corners. The players' squares in the left strip, 21.5 % of the usable height each.
        val ph = .215f * hb; val sw = rail - 2 * pad
        val cpuSquare = Box(left.x + pad, win.y + pad, sw, ph)
        val mySquare = Box(left.x + pad, win.bottom - pad - ph, sw, ph)
        // The right strip, top to bottom: menu (and the turn), the phase box, the stack card, the action buttons.
        val qx = right.x + pad; val qw = rail - 2 * pad
        val menu = Box(qx, win.y + pad, qw, 44f * u)
        val phase = Box(qx, menu.bottom + 6f * u, qw, 40f * u)
        // The gold button (44), 6 between, the quiet one above it (44: touch targets, not the drawing's 36). Z6: each 44 dp at the
        // least, so a chrome scale under 1 (a phone short of 844 x 390 inside its bars) never makes them smaller to the finger.
        val bh = maxOf(44f * u, BUTTON)
        val ah = bh + 6f * u + bh
        val actions = Box(qx, win.bottom - pad - ah, qw, ah)
        val sy = phase.bottom + 8f * u
        val stackRight = minOf(qx + qw, win.right - STACK_EDGE)
        val stack = Box(qx, sy, (stackRight - qx).coerceAtLeast(0f), (actions.y - 8f * u - sy).coerceAtLeast(0f))
        // Undo (36, a glass pill): the foot of the stack slot, 8 above the quiet button's 44, never in End turn's place (U6).
        val undo = Box(qx, stack.bottom - 36f * u, qw, 36f * u)
        return Zones(win, u, hb, left, right, board, tray, cpuSquare, mySquare, menu, phase, stack, actions, chip, undo, phone, handH, shelf)
    }

    /**
     * The four rows for [z] (a pod's rail takes [podTop] dp off the top). On a phone each row's centre is a share of the height
     * (M5: creatures on the centre line, your lands beside the hand); elsewhere the rows hug the board's edges (TableGeometry.rows).
     */
    fun rows(z: Zones, dual: Boolean, podTop: Float = 0f): TableGeometry.Rows =
        if (z.phone) TableGeometry.rowsPhone(z.window.y, z.window.h, z.hb, podTop)
        else TableGeometry.rows(dual, z.board.y + podTop, z.board.bottom, z.hb)

    /** A hand card is this many times as tall as it is wide (HandFan's own card). */
    const val HAND_TALL = 1.4f
    /** How far a lifted hand card rises (HandFan's rise on one screen), in dp. */
    const val HAND_RISE = 18f

    /**
     * Mobile table M5: the hand. Nothing is drawn behind it. [tray] is the cards' own reach (where drawn cards fly to); [fan] is
     * the box HandFan lays the cards out in ([Zones.handTray]'s width, a whole card tall: its foot runs below the window);
     * [cardW] x [cardH] a card, [gap] between two (negative: they overlap, each stepping [HAND_STEP] of a card at the most).
     * [pop] is how much a lifted card grows (to [HAND_RAISE_PHONE] of the height) cut so its top stays inside the window;
     * [lifted] the lifted card's box (the [lift]th card) as HandFan draws it: grown from its bottom centre, risen [rise],
     * and held inside the fan. [sunk] is how far the hand sinks on the CPU's turn.
     */
    data class Hand(val tray: Box, val fan: Box, val cardW: Float, val cardH: Float, val gap: Float, val pop: Float, val lifted: Box?, val sunk: Float = 0f, val rise: Float = HAND_RISE)

    /** The hand of [n] cards in [z] ([lift] the lifted card's place, if any), or null on the dual top (its hand is on the bottom screen). */
    fun hand(z: Zones, n: Int, lift: Int? = null): Hand? {
        val band = z.handTray ?: return null
        val u = z.k
        val cardH = z.handH; val cardW = cardH / HAND_TALL; val gap = -(1f - HAND_STEP) * cardW
        val fan = Box(band.x, band.y, band.w, cardH + 8f)
        // HandFan's slots: each card steps [HAND_STEP] of a card while they fit, else closer (never under a quarter card), centred in the fan.
        val step = if (n <= 1) 0f else maxOf(cardW / 4, minOf(cardW + gap, (fan.w - cardW) / (n - 1)))
        val total = cardW + step * (n - 1).coerceAtLeast(0)
        val start = ((fan.w - total) / 2).coerceAtLeast(0f)
        val tray = Box(fan.x + start, band.y, minOf(fan.w, total), band.h)
        // The lifted card: [HAND_RAISE_PHONE] of the height, never so big that its top leaves the window (4 clear).
        // It rises until its foot is 4 inside the window's bottom.
        val foot = z.window.bottom - 4f * u
        val rise = maxOf(HAND_RISE, fan.y + cardH - foot)
        val room = fan.y + cardH - rise - (z.window.y + 4f * u)
        val pop = minOf((if (z.phone) HAND_RAISE_PHONE else HAND_RAISE_BIG) * z.window.h / cardH, room / cardH).coerceAtLeast(1f)
        val lifted = lift?.takeIf { it in 0 until n }?.let { i ->
            val popW = cardW * (pop - 1f)
            val x = (start + step * i).coerceIn(minOf(popW / 2, (fan.w - cardW) / 2), maxOf((fan.w - cardW - popW / 2), (fan.w - cardW) / 2))
            val bottom = fan.y - rise + cardH
            Box(fan.x + x + cardW / 2 - cardW * pop / 2, bottom - cardH * pop, cardW * pop, cardH * pop)
        }
        val sunk = (band.h - (if (z.phone) HAND_SUNK_PHONE else HAND_SUNK_BIG) * z.window.h).coerceAtLeast(0f)
        return Hand(tray, fan, cardW, cardH, gap, pop, lifted, sunk, rise)
    }
}
