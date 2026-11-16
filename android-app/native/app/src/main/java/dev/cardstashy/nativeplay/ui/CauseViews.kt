package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.round
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.match.Director
import kotlinx.coroutines.launch

/** LAST MOVES (Every Result Names Its Cause): the controller's rows, newest last (TableScreen provides them); the table shows the last three. */
val LocalLastMoves = compositionLocalOf<List<Director.Line>> { emptyList() }

/** The cards held in exile by a permanent on the table: exiled card id to its holder's id (the controller's [dev.cardstashy.nativeplay.match.MatchController.held]). */
val LocalHeld = compositionLocalOf<Map<Int, Int>> { emptyMap() }

/** The CPU's colour on a cause row and round a held card (the approved preview's ice blue); yours is [TRIG_GOLD]. */
internal val CAUSE_ICE = Rule.Cause.Ice
/** The most rows "Last moves" shows. */
internal const val LAST_MOVES_SHOWN = 3
/** A strip with less free room than this (dp) shows its rows without the "LAST MOVES" header: a phone's, where the header would cost a row. */
internal const val LAST_MOVES_HEADER_ROOM = 150

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

/**
 * "LAST MOVES" (approved preview, 14 Nov): the last three results at the left of the table, newest at the bottom and brightest,
 * each with the picture and name of the card that did it and what it did, so a look away costs nothing. It lives in the left
 * strip between the two squares and takes only the room that is free there ([modifier] gives its box): as many of the newest
 * rows as fit, none when there is no room. Whether the header shows is the strip's matter alone (its room, never the rows), so
 * it does not come and go from one result to the next. Yours wear gold, the CPU's ice blue.
 */
@Composable
internal fun LastMoves(modifier: Modifier, d: Du) = with(d) {
    val moves = LocalLastMoves.current
    if (moves.isEmpty()) return@with
    val shown = moves.takeLast(LAST_MOVES_SHOWN)
    val quiet = Motion.still || LocalBattlefield.current?.reduced == true
    androidx.compose.foundation.layout.BoxWithConstraints(modifier.anchorRect("lastmoves")) {
    // A roomy strip (a Fold's, a Thor's) shows the header and lets a long name take two lines; a phone's keeps each name to one
    // line, so two rows fit its 95 dp.
    val roomy = maxHeight >= LAST_MOVES_HEADER_ROOM.dp
    Layout(modifier = Modifier.fillMaxSize(), content = {
        Text("LAST MOVES", style = sans(maxOf(sp(9f).value, 9.5f).sp, FontWeight.ExtraBold, TRIG_GOLD.copy(alpha = .9f)).copy(letterSpacing = 1.4.sp,
            shadow = Shadow(Rule.Cause.Shade, Offset(0f, 1f), 4f)), maxLines = 1)
        // The newest row is spoken once by a screen reader (the plate on the card is not announced a second time).
        shown.forEachIndexed { i, l -> key(l.at, l.sourceId, l.text) { MoveRow(l, shown.lastIndex - i, if (roomy) 2 else 1, if (quiet) Modifier else Modifier.slidesToPlace(), d) } }
    }) { ms, c ->
        val wide = Constraints(minWidth = c.maxWidth, maxWidth = c.maxWidth)
        val headed = roomy
        val head = ms[0].measure(Constraints(maxWidth = c.maxWidth)); val rows = ms.drop(1).map { it.measure(wide) }
        val gap = 3.du.roundToPx()
        val n = lastMovesFit(if (headed) head.height else 0, rows.map { it.height }, gap, c.maxHeight)
        layout(c.maxWidth, c.maxHeight) {
            if (n == 0) return@layout
            var y = 0
            if (headed) { head.place(2.du.roundToPx(), 0); y = head.height + gap }
            for (r in rows.takeLast(n)) { r.place(0, y); y += r.height + gap }
        }
    }
    }
}

/** A row that is given a new place (a newer row came in under it, the oldest left) slides there in 260 ms instead of jumping. */
private fun Modifier.slidesToPlace(): Modifier = composed {
    val scope = rememberCoroutineScope()
    var target by remember { mutableStateOf(IntOffset.Zero) }
    var anim by remember { mutableStateOf<Animatable<IntOffset, androidx.compose.animation.core.AnimationVector2D>?>(null) }
    onPlaced { target = it.positionInParent().round() }.offset {
        val a = anim ?: Animatable(target, IntOffset.VectorConverter).also { anim = it }
        if (a.targetValue != target) scope.launch { a.animateTo(target, tween(260)) }
        a.value - target
    }
}

/**
 * One row: the cause's picture in a ring of its side's colour with its name beside it (up to [nameLines] lines, so a long
 * name is whole where the strip has the room), and under them what it did, the whole width of the strip. [age] 0 is the newest (coloured rim, full
 * strength); older rows keep their glass and dim only their picture and words, so they stay readable on a bright mat.
 */
@Composable
private fun MoveRow(l: Director.Line, age: Int, nameLines: Int, modifier: Modifier, d: Du) = with(d) {
    val tone = if (l.yours) TRIG_GOLD else CAUSE_ICE
    val shape = RoundedCornerShape(9.du)
    // A new row comes up from 10 du below in 260 ms; nothing moves in a still picture or with reduce motion.
    val quiet = Motion.still || LocalBattlefield.current?.reduced == true
    val inn = remember { Animatable(if (quiet) 1f else 0f) }
    LaunchedEffect(Unit) { inn.animateTo(1f, tween(260)) }
    val dim = when (age) { 0 -> 1f; 1 -> .88f; else -> .8f }
    Column(modifier.fillMaxWidth()
        .graphicsLayer { alpha = inn.value; translationY = (1f - inn.value) * 10.du.toPx() }
        .background(Brush.verticalGradient(listOf(Rule.Cause.GlassTop, Rule.Cause.GlassBottom)), shape)
        .border(1.dp, if (age == 0) tone else Rule.Cause.Rim, shape)
        .padding(horizontal = 5.du, vertical = 2.du)
        .semantics(mergeDescendants = true) { contentDescription = "${l.sourceName}: ${l.text}"; if (age == 0) liveRegion = LiveRegionMode.Polite }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // No picture for a cause Forge gave no name (the stand-in word is not a card).
            if (l.known) Box(Modifier.padding(end = 4.du).size(15.du).alpha(if (age == 0) 1f else .7f).clip(CircleShape).background(Rule.Cause.Ink).border(1.dp, tone, CircleShape)) {
                CardImage(l.sourceName, Modifier.fillMaxSize(), crop = true) }
            Text(l.sourceName, style = sans(maxOf(sp(9f).value, 9.5f).sp, FontWeight.ExtraBold, tone.copy(alpha = dim)).copy(lineHeight = maxOf(sp(11f).value, 11.5f).sp), maxLines = nameLines, overflow = TextOverflow.Ellipsis)
        }
        // A number at the end stays with its word ("paid 2" never leaves the 2 alone on a line).
        Text(l.text.replace(Regex(" (\\d+)$"), " $1"), style = sans(maxOf(sp(10f).value, 10f).sp, FontWeight.SemiBold, Rule.Cause.Words.copy(alpha = dim)).copy(lineHeight = maxOf(sp(12.5f).value, 12.5f).sp),
            maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 1.du))
    }
}

/**
 * AN EXILED CARD THAT WILL COME BACK STAYS ON THE CARD THAT HOLDS IT (approved preview, 14 Nov): the held cards as small cards
 * (.4 of a tile, turned 7 degrees, an ice blue rim) hung on their holder's top right corner; [modifier] puts the first one's
 * top left there. A tap reads the card (its touch box is never under 44 dp). Two show; more say "+N". A card exiled in the
 * beat being shown pops in after its "Exiled" plate has been read; one that was already held is simply there (a fold, a
 * rebuilt table).
 */
@Composable
internal fun HeldCards(cards: List<Card>, holder: Card, w: Dp, h: Dp, modifier: Modifier, onInspect: (Card) -> Unit) {
    val quiet = Motion.still || LocalBattlefield.current?.reduced == true
    val exiledNow = LocalTrigger.current?.result?.moves?.filter { it.went == Director.Went.EXILED }?.mapNotNull { it.cardId }.orEmpty()
    val cw = w * .4f; val ch = h * .4f
    val tw = maxOf(cw, TextFloors.TOUCH.dp); val th = maxOf(ch, TextFloors.TOUCH.dp)
    val more = cards.size - 2
    cards.take(2).forEachIndexed { i, c ->
        key(c.id) {
            val pop = remember { Animatable(if (quiet || c.id !in exiledNow) 1f else 0f) }
            LaunchedEffect(Unit) { if (pop.value < 1f) pop.animateTo(1f, tween(340, delayMillis = 700)) }
            // Cut from the tile's own size, as a card's corner is.
            val shape = RoundedCornerShape(w * .045f)
            // The touch box is centred on the small card, which keeps its place.
            Box(modifier.offset(x = (w * .16f) * i - (tw - cw) / 2, y = -(th - ch) / 2).size(tw, th)
                .clickable(onClickLabel = "read card") { onInspect(c) }
                .semantics { contentDescription = "${c.name}, held in exile by ${holder.name}" }, contentAlignment = Alignment.Center) {
                Box(Modifier.size(cw, ch).anchorRect("held${c.id}")
                    .graphicsLayer { val k = pop.value; scaleX = k; scaleY = k; alpha = k; rotationZ = 7f }
                    .shadow(6.dp, shape, ambientColor = CAUSE_ICE, spotColor = CAUSE_ICE)
                    .clip(shape).background(Rule.Cause.Ink).border(1.5.dp, CAUSE_ICE, shape)) {
                    CardImage(c.name, Modifier.fillMaxSize(), crop = true)
                    if (i == 1 && more > 0) Text("+$more", style = Rule.Type.sans(11, FontWeight.ExtraBold, Color.White), modifier = Modifier.align(Alignment.BottomEnd).background(Rule.Cause.GlassBottom, RoundedCornerShape(topStart = w * .045f)).padding(horizontal = 3.dp))
                }
            }
        }
    }
}
