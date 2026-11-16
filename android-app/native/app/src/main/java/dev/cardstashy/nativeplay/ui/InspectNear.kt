package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Rect

/**
 * Better table scene 13: a battlefield card read beside its own tile. The whole card stands next to the tile, on the side with more
 * room, never over the tile itself; the panels (the glass box, the keyword boxes, the Attached row) stand on the far side of the
 * card, or on the tile's other side when one side cannot hold both. Sizes follow the preview: the card is 27 % of the table's width
 * (at most 66 % of its height), the panels 33 %.
 *
 * All numbers are dp in the inspect view's own frame (its padded box), so the rule is testable without a screen.
 */
internal object InspectNear {
    /** Between the tile and the card, and between the card and the panels. */
    const val GAP = 14f
    const val CARD_W = .27f
    const val CARD_H = .66f
    const val ASPECT = .716f
    const val PANEL_W = .33f
    /** The narrowest the panels may be, at the glass box's scale (k); narrower falls back to the centred page. */
    const val PANEL_MIN = 180f
    /** A card that would have to shrink below this share of its size falls back to the centred page instead. */
    const val SHRINK_MIN = .72f
    /** The card's flight out of the tile. */
    const val ENTER_MS = 280
    /** How dark the table stays around the lit tile (the preview keeps it readable). */
    const val SCRIM = 0x8C06070DL

    /** Where things stand. [panelX]/[panelW]: the panel column's left edge and width (its height is its content, kept on screen). */
    data class Place(val card: Rect, val panelX: Float, val panelW: Float, val right: Boolean, val panelsAcross: Boolean)

    /** A tapped tile is turned 20°: its anchor is the turned bounding box. This is the tile's own unturned box, about the same centre. */
    fun untilt(r: Rect, tapped: Boolean): Rect {
        if (!tapped) return r
        val a = Math.toRadians(20.0); val c = kotlin.math.cos(a).toFloat(); val s = kotlin.math.sin(a).toFloat()
        val d = c * c - s * s
        val w = ((r.width * c - r.height * s) / d).coerceAtLeast(1f); val h = ((r.height * c - r.width * s) / d).coerceAtLeast(1f)
        return Rect(r.center.x - w / 2, r.center.y - h / 2, r.center.x + w / 2, r.center.y + h / 2)
    }

    fun place(w: Float, h: Float, tile: Rect, k: Float): Place? {
        if (w <= 0f || h <= 0f) return null
        var cardH = minOf(h * CARD_H, w * CARD_W / ASPECT); var cardW = cardH * ASPECT
        val panelMin = PANEL_MIN * k; val panelMax = w * PANEL_W
        val roomR = w - tile.right; val roomL = tile.left
        val right = roomR >= roomL
        val room = if (right) roomR else roomL; val other = if (right) roomL else roomR
        var across = false
        var panelW = minOf(panelMax, room - GAP - cardW - GAP)
        if (panelW < panelMin) {
            val acrossW = minOf(panelMax, other - GAP)
            if (acrossW >= panelMin && room - GAP >= cardW) { across = true; panelW = acrossW }
            else {
                // Shrink the card so it and the panels share the roomier side.
                val fit = room - GAP - GAP - panelMin
                if (fit < cardW * SHRINK_MIN) return null
                cardW = fit; cardH = cardW / ASPECT; panelW = panelMin
            }
        }
        val cardX = if (right) tile.right + GAP else tile.left - GAP - cardW
        val cardY = (tile.center.y - cardH / 2).coerceIn(0f, maxOf(0f, h - cardH))
        val panelX = when {
            across && right -> tile.left - GAP - panelW
            across -> tile.right + GAP
            right -> cardX + cardW + GAP
            else -> cardX - GAP - panelW
        }
        return Place(Rect(cardX, cardY, cardX + cardW, cardY + cardH), panelX, panelW, right, across)
    }
}
