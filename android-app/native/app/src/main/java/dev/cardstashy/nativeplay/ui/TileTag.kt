package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import kotlinx.coroutines.delay

/**
 * Better table (critic step 4): one short note that hangs on a tile for a few seconds, the preview's `tile(...,{tag})`: scene 2's
 * "No mana · skipped" on the trigger's source when its payment is declined for you, scene 9's "No legal target" later. Posted by
 * whoever knows (the match controller), drawn by the tile itself, gone after [TAG_MS].
 */
internal object TileTags {
    data class Tag(val text: String, val seq: Long)
    private var next = 0L
    /** The tags showing now, by card id. */
    val shown = mutableStateMapOf<Int, Tag>()
    fun post(cardId: Int, text: String) { shown[cardId] = Tag(text, ++next) }
    fun clear(cardId: Int, seq: Long) { if (shown[cardId]?.seq == seq) shown.remove(cardId) }
}

/** How long a tile tag stays (ms), as the controller's note. */
internal const val TAG_MS = 3200L
/** Its rise in and fade out (ms). */
internal const val TAG_IN_MS = 220; internal const val TAG_OUT_MS = 260

/** Scene 2's tag on a trigger's source whose optional payment was declined because no mana was open. */
internal const val NO_MANA_SKIPPED = "No mana · skipped"

/**
 * The pill every tile tag wears: a full round, a hairline [edge], one line of [text] that is cut with … rather than run wider than
 * [maxW]. The M2 owner tag (sidetag) and the timed tag both draw with it.
 */
@Composable
internal fun TagPill(text: String, fill: Color, edge: Color, ink: Color, d: Du, modifier: Modifier = Modifier, maxW: Dp = Dp.Infinity,
                     size: Float = 10f, weight: FontWeight = FontWeight.ExtraBold, track: Float = .06f, padH: Float = 6f, padV: Float = 1.5f) = with(d) {
    Text(text, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis, style = sans(sp(size), weight, ink).copy(letterSpacing = track.em),
        modifier = modifier.widthIn(max = maxW).clip(RoundedCornerShape(999.dp)).background(fill).border(1.dp, edge, RoundedCornerShape(999.dp))
            .padding(horizontal = padH.du, vertical = padV.du))
}

/**
 * The timed tag itself: dark glass, a gold hairline and gold words (the preview's `.tile .tag`). It rises 6 du into place and fades
 * in, holds, and fades out; with [Motion.still] it simply shows and goes (no animation runs on).
 */
@Composable
internal fun TimedTileTag(cardId: Int, tag: TileTags.Tag, d: Du, modifier: Modifier, maxW: Dp) = with(d) {
    val k = remember(tag.seq) { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(tag.seq) {
        if (!Motion.still) k.animateTo(1f, tween(TAG_IN_MS))
        delay(TAG_MS)
        if (!Motion.still) k.animateTo(0f, tween(TAG_OUT_MS))
        TileTags.clear(cardId, tag.seq)
    }
    TagPill(tag.text, Color(0xF20C0E16), Color(0xFFE8C36F), Color(0xFFF0CF85), d, modifier.graphicsLayer {
        val q = k.value; alpha = q; translationY = (1f - q) * -6.du.toPx() }.anchorRect("tiletag$cardId"),
        maxW = maxW, size = 11f, weight = FontWeight.SemiBold, track = .02f, padH = 9f, padV = 2.5f)
}
