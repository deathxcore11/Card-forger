package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Rect
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Prompt
import dev.cardstashy.nativeplay.engine.PromptOption

/** Living table F4: one ability of a planeswalker as Forge offers it: the option to send, its loyalty cost and its words. */
internal data class WalkerPlate(val index: Int, val cost: String, val text: String)

/** F4: Forge's "choose an ability" question for one of your planeswalkers, as plates. [cancel]: Forge lets the question be left. */
internal data class WalkerAsk(val card: Card, val plates: List<WalkerPlate>, val cancel: Boolean)

/**
 * Living table F4 (specs/living-table-build-guide.md, "F4 Planeswalker plates"): on one screen a planeswalker's abilities open
 * from the card as plates joined to it by thin lines, while the table dims to half and stays in view. It is Forge's own question
 * (getAbilityToPlay) drawn another way: the same options in Forge's order, and choosing one sends the answer the list sent.
 * Forge lists only the abilities that can be paid, so no plate is ever grey.
 */
internal object WalkerPlates {
    const val PLATE_W = 236f; const val PLATE_H = 46f
    const val BIG_W = 290f; const val BIG_H = 58f
    const val GAP = 8f
    /** The plates between the first and the last stand this much further from the card. */
    const val MID_OUT = 14f
    /** From the card's edge to the nearest plate. */
    const val LEAD = 22f
    const val STAGGER_MS = 140; const val SLIDE_MS = 270
    const val DIM = .5f
    const val FOCUS = 1.05f
    const val CHOSEN_MS = 520L; const val FADE_MS = 220

    /** "+1: Each player discards a card." is the cost "+1" and the words after it; an option with no loyalty cost keeps all its words. */
    private val COST = Regex("^\\s*([+\\-−–]?\\s?(?:\\d+|X))\\s*:\\s*(.+)$", RegexOption.DOT_MATCHES_ALL)
    fun plate(o: PromptOption): WalkerPlate {
        val words = plainText(o.label)
        val m = COST.find(words) ?: return WalkerPlate(o.index, "", words)
        return WalkerPlate(o.index, m.groupValues[1].replace(" ", "").replace('-', '−').replace('–', '−'), m.groupValues[2].trim())
    }

    /** The plates for [p], or null when it is not one planeswalker of yours asking which single ability to play. */
    fun of(p: Prompt?, st: MatchState): WalkerAsk? {
        if (p == null || p.method != "getAbilityToPlay" || !p.supportedExact || p.max != 1 || p.options.isEmpty() || p.options.any { !it.described }) return null
        val id = p.options.map { it.cardId ?: it.rawCardId }.distinct().singleOrNull() ?: return null
        val card = st.me.battlefield.firstOrNull { it.id == id && isWalker(it) } ?: return null
        return WalkerAsk(card, p.options.map(::plate), cancel = p.min == 0)
    }

    /** What choosing [plate] sends: the same single option the list's Confirm sent. */
    fun answer(plate: WalkerPlate): List<Int> = listOf(plate.index)

    /**
     * Where the [n] plates stand (dp) for a card at [card] on a screen [w] by [h]: a column beside the card, on its left when there
     * is room and else on its right, centred on the card's middle and kept on the screen, in Forge's order from the top.
     */
    fun place(n: Int, card: Rect, w: Float, h: Float, big: Boolean): List<Rect> {
        val pw = if (big) BIG_W else PLATE_W; val ph = if (big) BIG_H else PLATE_H
        val total = n * ph + (n - 1) * GAP
        val top = (card.center.y - total / 2).coerceIn(8f, maxOf(8f, h - 8f - total))
        val left = card.left - LEAD - pw - MID_OUT >= 8f
        return (0 until n).map { i ->
            val out = if (i in 1 until n - 1) MID_OUT else 0f
            val x = if (left) card.left - LEAD - pw - out else minOf(card.right + LEAD + out, w - 8f - pw)
            Rect(x, top + i * (ph + GAP), x + pw, top + i * (ph + GAP) + ph)
        }
    }
}
