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

    /** Design review, 12 Nov: an ability's words are never cut. A plate may widen to this, then its words step down, then it grows taller. */
    const val WIDE_W = 320f; const val BIG_WIDE_W = 400f
    const val TEXT_SP = 11.5f; const val BIG_TEXT_SP = 14f
    const val SMALL_SP = 9.5f; const val BIG_SMALL_SP = 11.5f
    const val LINE = 1.25f
    /** What is not words in a plate's width: the padding and the cost's shield. */
    fun chrome(big: Boolean, cost: Boolean): Float = 12f + 8f + (if (cost) (if (big) 48f else 40f) else 4f)

    /** One plate's size (dp) and the size of its words (sp). */
    data class Fit(val w: Float, val h: Float, val sp: Float)
    /**
     * The plate for words that take [lines] (words at this sp, in this many dp of width) lines: 11.5 sp on two lines; else wider,
     * up to 320 (400 on a big screen); else 9.5 sp; else as many lines as the words need, the plate taller for each line over two.
     */
    fun fit(big: Boolean, cost: Boolean, lines: (sp: Float, widthDp: Float) -> Int): Fit {
        val w0 = if (big) BIG_W else PLATE_W; val w1 = if (big) BIG_WIDE_W else WIDE_W; val h0 = if (big) BIG_H else PLATE_H
        val sp = if (big) BIG_TEXT_SP else TEXT_SP; val small = if (big) BIG_SMALL_SP else SMALL_SP; val c = chrome(big, cost)
        if (lines(sp, w0 - c) <= 2) return Fit(w0, h0, sp)
        if (lines(sp, w1 - c) <= 2) return Fit(w1, h0, sp)
        val n = lines(small, w1 - c)
        // Two lines of the small words fit the plate as it is; each further line adds its own height.
        return Fit(w1, h0 + (n - 2).coerceAtLeast(0) * small * LINE, small)
    }

    /**
     * Where the plates of these [sizes] stand (dp) for a card at [card] on a screen [w] by [h]: a column beside the card, on its
     * left when there is room and else on its right, centred on the card's middle and kept on the screen, in Forge's order from the top.
     */
    fun place(sizes: List<Fit>, card: Rect, w: Float, h: Float): List<Rect> {
        val n = sizes.size
        val total = sizes.sumOf { it.h.toDouble() }.toFloat() + (n - 1) * GAP
        val top = (card.center.y - total / 2).coerceIn(8f, maxOf(8f, h - 8f - total))
        val widest = sizes.maxOf { it.w }
        val left = card.left - LEAD - widest - MID_OUT >= 8f
        var y = top
        return sizes.mapIndexed { i, f ->
            val out = if (i in 1 until n - 1) MID_OUT else 0f
            val x = if (left) card.left - LEAD - f.w - out else minOf(card.right + LEAD + out, w - 8f - f.w)
            Rect(x, y, x + f.w, y + f.h).also { y += f.h + GAP }
        }
    }
    fun place(n: Int, card: Rect, w: Float, h: Float, big: Boolean): List<Rect> = place(List(n) { Fit(if (big) BIG_W else PLATE_W, if (big) BIG_H else PLATE_H, if (big) BIG_TEXT_SP else TEXT_SP) }, card, w, h)
}
