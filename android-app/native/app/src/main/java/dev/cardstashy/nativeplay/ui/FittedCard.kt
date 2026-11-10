package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp

/*
 * WHOLE CARD, NEVER CUT (Randall 10 Nov 14:44Z, standing rule): wherever a full card is drawn, on either screen and at any
 * size, it keeps the card's ratio, fits inside its box with a margin all round, and is never sliced by a screen edge, a
 * sheet edge, a hint bar or a system bar. Art-crop headers are not full cards and stay as they are.
 */

/** A Magic card's width over its height (63 × 88 mm). */
const val CARD_RATIO = 63f / 88f

/** The biggest card of [ratio] that fits in [box] with [margin] on every side (never negative). */
fun fitCard(box: DpSize, margin: Dp = 12.dp, ratio: Float = CARD_RATIO): DpSize {
    val w = (box.width - margin * 2).coerceAtLeast(0.dp)
    val h = (box.height - margin * 2).coerceAtLeast(0.dp)
    return if (w / h > ratio) DpSize(h * ratio, h) else DpSize(w, w / ratio)
}

/**
 * Fills its box and draws [card] at the fitted size, centred: the content gets a modifier with that exact size. [max] caps the
 * card's width (a phone sheet keeps its 340 dp card).
 */
@Composable
fun FittedCard(modifier: Modifier = Modifier, margin: Dp = 12.dp, ratio: Float = CARD_RATIO, max: Dp = Dp.Infinity, card: @Composable (Modifier) -> Unit) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        var s = fitCard(DpSize(maxWidth, maxHeight), margin, ratio)
        if (s.width > max) s = DpSize(max, max / ratio)
        Box(Modifier.size(s)) { card(Modifier.size(s)) }
    }
}
