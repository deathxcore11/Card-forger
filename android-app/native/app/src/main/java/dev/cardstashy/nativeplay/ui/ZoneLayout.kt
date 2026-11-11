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
    ) {
        /** The boxes that must never meet one another (the strips hold the corners and are not listed themselves; [undo] lies in [stack]). */
        val all: Map<String, Box> get() = buildMap {
            put("board", board); handTray?.let { put("handTray", it) }; handChip?.let { put("handChip", it) }
            put("cpuSquare", cpuSquare); put("mySquare", mySquare); put("menu", menu); put("phase", phase); put("stack", stack); put("actions", actions)
        }
        /** The stack card's room: the whole stack slot, or, while Undo shows in its slot, the part above it (8 between). */
        fun stackAbove(undoShown: Boolean): Box = if (!undoShown) stack else Box(stack.x, stack.y, stack.w, (undo.y - 8f * k - stack.y).coerceAtLeast(0f))
    }

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
        val fC = if (dual) .235f else .205f
        val c = minOf(fC * win.h, bw / (if (dual) 4.15f else 4.6f) / 1.3f)
        val hb = c / fC
        // 3. The hand tray: whole cards (20 % of the usable height, .716 as wide), centred on the board, its bottom 4 above the window's.
        val tray = if (dual) null else {
            val hh = .20f * hb; val hw = hh * .716f; val n = hand.coerceAtLeast(1)
            val tw = minOf(bw, n * hw + (n - 1) * 6f * u + 14f * u)
            val th = hh + 6f * u
            Box(bx + (bw - tw) / 2, win.bottom - 4f * u - th, tw, th)
        }
        // The dual top has no tray, but the hand keeps a chip there ("Hand 7 · bottom screen", the d-pad's way into the hand on the
        // bottom screen): a band of its own across the board's width at the bottom, 36 tall, 4 above the window's bottom.
        val chip = if (!dual) null else Box(bx, win.bottom - 4f * u - 36f * u, bw, 36f * u)
        // 4. The board: the middle of the width, from the window's top to just above the tray (above the chip's band on the dual top).
        val boardBottom = (tray ?: chip)?.let { it.y - 2f * u } ?: win.bottom
        val board = Box(bx, win.y, bw, boardBottom - win.y)
        // 5. The corners. The players' squares in the left strip, 21.5 % of the usable height each.
        val ph = .215f * hb; val sw = rail - 2 * pad
        val cpuSquare = Box(left.x + pad, win.y + pad, sw, ph)
        val mySquare = Box(left.x + pad, win.bottom - pad - ph, sw, ph)
        // The right strip, top to bottom: menu (and the turn), the phase box, the stack card, the action buttons.
        val qx = right.x + pad; val qw = rail - 2 * pad
        val menu = Box(qx, win.y + pad, qw, 44f * u)
        val phase = Box(qx, menu.bottom + 6f * u, qw, 40f * u)
        // The gold button (44), 6 between, the quiet one above it (44: touch targets, not the drawing's 36).
        val ah = 44f * u + 6f * u + 44f * u
        val actions = Box(qx, win.bottom - pad - ah, qw, ah)
        val sy = phase.bottom + 8f * u
        val stackRight = minOf(qx + qw, win.right - STACK_EDGE)
        val stack = Box(qx, sy, (stackRight - qx).coerceAtLeast(0f), (actions.y - 8f * u - sy).coerceAtLeast(0f))
        // Undo (36, a glass pill): the foot of the stack slot, 8 above the quiet button's 44, never in End turn's place (U6).
        val undo = Box(qx, stack.bottom - 36f * u, qw, 36f * u)
        return Zones(win, u, hb, left, right, board, tray, cpuSquare, mySquare, menu, phase, stack, actions, chip, undo)
    }
}
