package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.match.Director

/** LAST MOVES (Every Result Names Its Cause): the controller's rows, newest last (TableScreen provides them); the table shows the last three. */
val LocalLastMoves = compositionLocalOf<List<Director.Line>> { emptyList() }

/** The CPU's colour on a cause row (the approved preview's ice blue); yours is [TRIG_GOLD]. */
internal val CAUSE_ICE = Color(0xFF8FD8FF)
/** The most rows "Last moves" shows. */
internal const val LAST_MOVES_SHOWN = 3

/**
 * How many of the newest rows fit in [room] px, the newest counted first: [rows] are their heights oldest to newest, [gap] the
 * space between two (and under the header), [header] the header's height or 0 without it. At most [LAST_MOVES_SHOWN]; 0 when
 * not even the newest fits (then nothing is drawn).
 */
internal fun lastMovesFit(header: Int, rows: List<Int>, gap: Int, room: Int): Int {
    var used = header; var n = 0
    for (h in rows.asReversed().take(LAST_MOVES_SHOWN)) { val add = (if (used > 0) gap else 0) + h; if (used + add > room) break; used += add; n++ }
    return n
}

/** The header gives way to a row: it is drawn unless leaving it out lets one more row fit (a phone's short strip). The pair is (rows shown, header shown). */
internal fun lastMovesPlan(header: Int, rows: List<Int>, gap: Int, room: Int): Pair<Int, Boolean> {
    val kept = lastMovesFit(header, rows, gap, room); val without = lastMovesFit(0, rows, gap, room)
    return if (without > kept) without to false else kept to true
}

/**
 * "LAST MOVES" (approved preview, 14 Nov): the last three results at the left of the table, newest at the bottom and brightest,
 * each with the picture and name of the card that did it and what it did, so a look away costs nothing. It lives in the left
 * strip between the two squares and takes only the room that is free there ([modifier] gives its box): as many of the newest
 * rows as fit, none when there is no room. Yours wear gold, the CPU's ice blue.
 */
@Composable
internal fun LastMoves(moves: List<Director.Line>, modifier: Modifier, d: Du) = with(d) {
    if (moves.isEmpty()) return@with
    val shown = moves.takeLast(LAST_MOVES_SHOWN)
    Layout(modifier = modifier.anchorRect("lastmoves"), content = {
        Text("LAST MOVES", style = sans(maxOf(sp(9f).value, 9.5f).sp, FontWeight.ExtraBold, TRIG_GOLD.copy(alpha = .85f)).copy(letterSpacing = 1.4.sp), maxLines = 1)
        shown.forEachIndexed { i, l -> key(l.at, l.sourceId, l.text) { MoveRow(l, shown.lastIndex - i, d) } }
    }) { ms, c ->
        val wide = Constraints(minWidth = c.maxWidth, maxWidth = c.maxWidth)
        val head = ms[0].measure(Constraints(maxWidth = c.maxWidth)); val rows = ms.drop(1).map { it.measure(wide) }
        val gap = 3.du.roundToPx()
        val (n, headed) = lastMovesPlan(head.height, rows.map { it.height }, gap, c.maxHeight)
        layout(c.maxWidth, c.maxHeight) {
            if (n == 0) return@layout
            var y = 0
            if (headed) { head.place(2.du.roundToPx(), 0); y = head.height + gap }
            for (r in rows.takeLast(n)) { r.place(0, y); y += r.height + gap }
        }
    }
}

/**
 * One row: the cause's picture in a ring of its side's colour with its name beside it, and under them what it did, the whole
 * width of the strip (a phone's strip is 120 dp: beside the picture the words took four lines). [age] 0 is the newest (bright,
 * coloured rim), older rows dim.
 */
@Composable
private fun MoveRow(l: Director.Line, age: Int, d: Du) = with(d) {
    val tone = if (l.yours) TRIG_GOLD else CAUSE_ICE
    val shape = RoundedCornerShape(9.du)
    // A new row comes up from 10 du below in 260 ms; nothing moves in a still picture or with reduce motion.
    val quiet = Motion.still || LocalBattlefield.current?.reduced == true
    val inn = remember { Animatable(if (quiet) 1f else 0f) }
    LaunchedEffect(Unit) { inn.animateTo(1f, tween(260)) }
    Column(Modifier.fillMaxWidth()
        .graphicsLayer { alpha = inn.value * (when (age) { 0 -> 1f; 1 -> .78f; else -> .55f }); translationY = (1f - inn.value) * 10.du.toPx() }
        .background(Brush.verticalGradient(listOf(Color(0xF2222A3E), Color(0xF50B0E16))), shape)
        .border(1.dp, if (age == 0) tone else Color(0x47E3C070), shape)
        .padding(horizontal = 5.du, vertical = 2.du)
        .semantics(mergeDescendants = true) { contentDescription = "${l.sourceName}: ${l.text}" }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(15.du).clip(CircleShape).background(Color(0xFF141418)).border(1.dp, tone, CircleShape)) { CardImage(l.sourceName, Modifier.fillMaxSize(), crop = true) }
            Text(l.sourceName, style = sans(maxOf(sp(9f).value, 9.5f).sp, FontWeight.ExtraBold, tone), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 4.du))
        }
        Text(l.text, style = sans(maxOf(sp(10f).value, 10f).sp, FontWeight.SemiBold, Color(0xFFEEF0F4)).copy(lineHeight = maxOf(sp(12.5f).value, 12.5f).sp), maxLines = 3, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 1.du))
    }
}
