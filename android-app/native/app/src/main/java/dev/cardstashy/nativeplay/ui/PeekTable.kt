package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp

/**
 * Better table (critic section 1, scenes 1, 11, 12): the pieces every view that sits over the table shares, so the scry view, the
 * mulligan and the result read as one family. One dimmer colour, one held "View table" pill that hides the view while it is held,
 * and the short result bubble a choice leaves on the table ("Scry: 0 top, 1 bottom").
 */

/** The one dimmer over the table (the preview's `.dimmer`, rgba(6, 7, 13, .8)): the board shows faintly through. */
internal val TableDimmer = Color(0xCC06070D)

/** How long a result bubble stays on the table (ms): the preview's "for three seconds". */
internal const val TABLE_BUBBLE_MS = 3000L

/** Whether "View table" is held now (a finger on the pill, or a controller's Y held). */
@Stable
internal class TablePeek { var held by mutableStateOf(false) }

@Composable
internal fun rememberTablePeek(): TablePeek = remember { TablePeek() }

/**
 * What hides while the table is peeked at: it fades out (160 ms) and back. It keeps its place and still takes its touches, so a
 * finger that lands on it while hidden reaches nothing under it. Motion.still and reduced motion snap.
 */
@Composable
internal fun Modifier.peekHides(peek: TablePeek): Modifier {
    val ctx = LocalContext.current.applicationContext
    val reduced = Motion.still || remember { Playmats.reduced(ctx) }
    val a by animateFloatAsState(if (peek.held) 0f else 1f, if (reduced) snap() else tween(160), label = "peek")
    return graphicsLayer { alpha = a }
}

/**
 * The held "View table" pill (top right of a view over the table). Hold it and the view hides; let go and it comes back. A dark glass
 * pill with an eye, its rim turning gold while held. Anchor "peektable".
 */
@Composable
internal fun PeekTablePill(peek: TablePeek, d: Du, modifier: Modifier = Modifier) = with(d) {
    val ink = Color(0xFFEEE6D4)
    val gold = Color(0xFFE8B95B)
    Row(modifier.anchorRect("peektable").height(36.du)
        .drawBehind { if (peek.held) drawRoundRect(gold.copy(alpha = .22f), topLeft = Offset(-4.du.toPx(), -4.du.toPx()),
            size = androidx.compose.ui.geometry.Size(size.width + 8.du.toPx(), size.height + 8.du.toPx()), cornerRadius = CornerRadius(size.height)) }
        .clip(RoundedCornerShape(999.dp))
        .background(Brush.verticalGradient(listOf(Color(0xE61A1E2B), Color(0xE60E1017))))
        .border(1.dp, if (peek.held) gold else Color(0xFF3A4260), RoundedCornerShape(999.dp))
        .semantics { contentDescription = "View table"; role = Role.Button }
        .pointerInput(peek) { awaitEachGesture { awaitFirstDown(); peek.held = true; try { waitForUpOrCancellation() } finally { peek.held = false } } }
        .padding(horizontal = 14.du), horizontalArrangement = Arrangement.spacedBy(7.du), verticalAlignment = Alignment.CenterVertically) {
        StrokeIcon(EYE_ICON, if (peek.held) gold else ink.copy(alpha = .85f), 16.du, stroke = 2f)
        Text("View table", style = sans(sp(12.5f), FontWeight.SemiBold, if (peek.held) gold else ink), maxLines = 1)
    }
}

private const val EYE_ICON = "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6"

/**
 * The result a choice leaves on the table for [TABLE_BUBBLE_MS] ("Scry: 0 top, 1 bottom"): a dark glass chip with a gold hairline,
 * the words before the colon in gold. It rises and settles in (spring); Motion.still shows it at rest. Anchor "tablebubble".
 */
@Composable
internal fun TableBubble(text: String, d: Du, modifier: Modifier = Modifier) = with(d) {
    val rise = remember(text) { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(text) { if (!Motion.still) rise.animateTo(1f, spring(dampingRatio = .72f, stiffness = 420f)) }
    val head = text.substringBefore(":", "").takeIf { it.isNotEmpty() && it.length < text.length }
    val gold = Color(0xFFE8B95B)
    Text(buildAnnotatedString {
            if (head != null) { withStyle(SpanStyle(color = gold, fontWeight = FontWeight.ExtraBold)) { append("$head:") }; append(text.substringAfter(":")) } else append(text)
        }, style = sans(sp(14f), FontWeight.SemiBold, Color(0xFFEEE6D4)), maxLines = 1,
        modifier = modifier.anchorRect("tablebubble")
            .graphicsLayer { val q = rise.value; alpha = q.coerceIn(0f, 1f); translationY = (1f - q) * 14.du.toPx(); val s = .94f + .06f * q; scaleX = s; scaleY = s }
            .drawBehind { drawRoundRect(Color(0x66000000), topLeft = Offset(0f, 6.du.toPx()), size = size, cornerRadius = CornerRadius(12.du.toPx())) }
            .clip(RoundedCornerShape(12.du)).background(Brush.verticalGradient(listOf(Color(0xF5151926), Color(0xF50A0B12))))
            .border(1.dp, Brush.verticalGradient(listOf(gold.copy(alpha = .7f), Color(0xFF3A4260))), RoundedCornerShape(12.du))
            .padding(horizontal = 16.du, vertical = 8.du))
}
