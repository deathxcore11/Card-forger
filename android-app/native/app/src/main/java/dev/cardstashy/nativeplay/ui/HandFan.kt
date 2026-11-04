package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dev.cardstashy.nativeplay.engine.Card
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.VectorConverter
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.abs
import kotlin.math.floor

/**
 * A held hand of cards (stage 2 plan, section A): fanned on a shallow arc and overlapping, never
 * wrapped and never rescaled. A finger sweeps across it and the card under the finger stands up
 * and pops, its neighbours easing aside, like the web table's hand under a pointer. Sliding a
 * playable card up past 70 dp plays it (it leaves on an arc and the slot closes); a card you
 * cannot play stretches a little and springs back. Letting go without sweeping is a tap; holding
 * still opens the card. Every card is one graphicsLayer; no layout pass happens during a swipe.
 */
@Composable
fun HandFan(
    cards: List<Card>, cardW: Dp, modifier: Modifier = Modifier,
    markOf: (Card) -> Mark = { Mark.NONE },
    raised: Int? = null,
    angleDeg: Float = 3.5f,
    dealIn: Boolean = false,
    canPlay: (Card) -> Boolean = { false },
    onTap: (Card) -> Unit = {},
    onPlay: (Card) -> Unit = {},
    onHold: (Card) -> Unit = {},
    onDeal: () -> Unit = {},
    pop: Float? = null,
    onReorder: ((List<Int>) -> Unit)? = null,
) {
    val cardH = cardW * 1.4f
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    var focus by remember { mutableStateOf<Int?>(null) }        // card id under the finger
    var dragging by remember { mutableStateOf<Int?>(null) }     // card id under the finger, moving up
    var leaving by remember { mutableStateOf<Int?>(null) }      // card id flying out after a play
    val drag = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    val flight = remember { Animatable(0f) }
    val current by rememberUpdatedState(cards)
    val tapCb by rememberUpdatedState(onTap); val playCb by rememberUpdatedState(onPlay)
    val holdCb by rememberUpdatedState(onHold); val canPlayCb by rememberUpdatedState(canPlay)
    val dealCb by rememberUpdatedState(onDeal); val reorderCb by rememberUpdatedState(onReorder)
    // Sideways drag (Randall 3 Nov, approved): the card lifts and follows the finger; its neighbours slide to open a gap.
    var moving by remember { mutableStateOf<Int?>(null) }      // card id being moved sideways
    var moveTo by remember { mutableStateOf(0) }               // the slot it would drop into
    var moveX by remember { mutableStateOf(0f) }               // its left edge, px
    val seen = remember { HashSet<Int>() }
    var shownOnce by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shownOnce = true }
    val popScale = pop ?: maxOf(1.5f, minOf(2.2f, 110f / cardW.value))
    val rise = 18.dp

    BoxWithConstraints(modifier.fillMaxWidth().height(cardH + 8.dp), contentAlignment = Alignment.BottomStart) {
        val width = maxWidth
        // The slots: the card flying out after a play no longer holds one, so the fan closes behind it.
        val held = cards.filter { it.id != leaving }
        val slots = moving?.let { id -> held.firstOrNull { it.id == id }?.let { m -> held.filter { it.id != id }.toMutableList().apply { add(moveTo.coerceIn(0, size), m) } } } ?: held
        val n = slots.size
        val step: Dp = if (n <= 1) 0.dp else maxOf(cardW / 4, minOf(cardW + 4.dp, (width - cardW) / (n - 1)))
        val total = cardW + step * (n - 1).coerceAtLeast(0)
        val start = ((width - total) / 2).coerceAtLeast(0.dp)
        val mid = (n - 1) / 2f
        val focusIndex = slots.indexOfFirst { it.id == focus }.takeIf { it >= 0 }
        val lift = focusIndex ?: slots.indexOfFirst { it.id == raised }.takeIf { it >= 0 }
        val popW = cardW * (popScale - 1f)
        val shares = floatArrayOf(.6f, .35f, .15f)

        val pxStart = with(density) { start.toPx() }; val pxStep = with(density) { step.toPx() }
        fun indexAt(x: Float): Int = if (n <= 1 || pxStep <= 0f) 0 else floor((x - pxStart) / pxStep).toInt().coerceIn(0, n - 1)
        // Arriving cards (a deal, a draw) come in one per 70 ms along the arc from the library side.
        val arriving = if (shownOnce || dealIn) slots.filter { it.id !in seen }.map { it.id } else emptyList()
        if (!shownOnce && !dealIn) slots.forEach { seen.add(it.id) }

        Box(Modifier.fillMaxWidth().height(cardH + 8.dp).pointerInput(n, pxStart, pxStep) {
            val slop = viewConfiguration.touchSlop
            val playLine = with(density) { 70.dp.toPx() }
            val stretch = with(density) { 24.dp.toPx() }
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val hand = current.filter { it.id != leaving }
                if (hand.isEmpty()) return@awaitEachGesture
                var idx = indexAt(down.position.x)
                focus = hand.getOrNull(idx)?.id
                var swept = false
                val moved = withTimeoutOrNull(viewConfiguration.longPressTimeoutMillis) {
                    var result: Boolean? = null
                    while (result == null) {
                        val ev = awaitPointerEvent(); val ch = ev.changes.firstOrNull { it.id == down.id }
                        if (ch == null || !ch.pressed) { ch?.consume(); result = false }
                        else if ((ch.position - down.position).getDistance() > slop) result = true
                    }
                    result
                }
                if (moved == null) { // held still: open the card
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    hand.getOrNull(idx)?.let(holdCb)
                    while (true) { val ev = awaitPointerEvent(); ev.changes.forEach { it.consume() }; if (ev.changes.none { it.pressed }) break }
                    focus = null; return@awaitEachGesture
                }
                if (moved == false) { focus = null; hand.getOrNull(idx)?.let(tapCb); return@awaitEachGesture }
                var anchor = down.position
                var stretching = false
                while (true) {
                    val ev = awaitPointerEvent(); val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                    ch.consume()
                    if (!ch.pressed) break
                    val d = ch.position - anchor
                    if (dragging != null) {
                        val v = if (stretching) Offset(0f, -stretch * (1f - exp(minOf(0f, d.y) / (stretch * 2f)))) else d
                        scope.launch { drag.snapTo(v) }; continue
                    }
                    val card = hand.getOrNull(idx)
                    if (card != null && d.y < -slop * 1.5f && abs(d.y) > abs(d.x) * 1.2f) {
                        stretching = !canPlayCb(card); scope.launch { drag.snapTo(Offset.Zero) }; dragging = card.id; anchor = ch.position; continue
                    }
                    if (reorderCb != null && card != null && (moving != null || abs(d.x) > slop * 1.5f && abs(d.x) > abs(d.y))) {
                        if (moving == null) { moving = card.id; moveTo = idx; focus = null; haptic.performHapticFeedback(HapticFeedbackType.LongPress) }
                        moveX = pxStart + pxStep * idx + (ch.position.x - down.position.x)
                        val next = indexAt(moveX + pxStep / 2)
                        if (next != moveTo) { moveTo = next; haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }
                        swept = true; continue
                    }
                    val next = indexAt(ch.position.x)
                    if (next != idx) { idx = next; swept = true; focus = hand.getOrNull(idx)?.id; haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); anchor = Offset(anchor.x, ch.position.y) }
                }
                moving?.let { id ->
                    val order = hand.filter { it.id != id }.map { it.id }.toMutableList().apply { add(moveTo.coerceIn(0, size), id) }
                    moving = null; focus = null; reorderCb?.invoke(order); return@awaitEachGesture
                }
                val lifted = dragging
                val card = hand.firstOrNull { it.id == lifted }
                if (card != null && !stretching && drag.value.y < -playLine) {
                    // Leaves on a 380 ms arc; the slot closes behind it at once.
                    leaving = card.id; dragging = null; focus = null
                    playCb(card)
                    scope.launch {
                        flight.snapTo(0f); flight.animateTo(1f, tween(380, easing = FastOutSlowInEasing))
                        delay(1100); if (leaving == card.id) { leaving = null; drag.snapTo(Offset.Zero) }
                    }
                } else if (lifted != null) {
                    scope.launch { drag.animateTo(Offset.Zero, spring(.8f, 600f)); if (dragging == lifted) dragging = null }
                    focus = null
                } else {
                    if (!swept) hand.getOrNull(idx)?.let(tapCb)
                    focus = null
                }
            }
        }) {
            var dealOrder = 0
            cards.forEach { card ->
                key(card.id) {
                    val isLeaving = card.id == leaving
                    val i = slots.indexOf(card).coerceAtLeast(0)
                    val t = i - mid
                    val isLift = !isLeaving && lift == i
                    var shift = 0.dp
                    if (lift != null && !isLift && !isLeaving) {
                        val gap = abs(i - lift)
                        if (gap in 1..3) shift = popW * shares[gap - 1] * (if (i > lift) 1f else -1f)
                    }
                    // A popped card keeps its whole scaled rect inside the fan (never over the sidebar).
                    val edge = if (isLift) popW / 2 else 0.dp
                    val x = if (card.id == moving) with(density) { moveX.toDp() } else (start + step * i + shift).coerceIn(edge, (width - cardW - edge).coerceAtLeast(edge))
                    val y = if (isLift || card.id == moving) -rise else 2.dp * (t * t)
                    val newIndex = arriving.indexOf(card.id)
                    val delayMs = if (newIndex >= 0) (dealOrder++) * 70L else 0L
                    val fromX = if (newIndex >= 0) with(density) { (width + cardW).toPx() } else null
                    val fromY = if (newIndex >= 0) with(density) { (cardH * .4f).toPx() } else null
                    if (newIndex >= 0) LaunchedEffect(card.id) { delay(delayMs); dealCb(); seen.add(card.id) }
                    // A card flying out keeps the slot it left from; only the others close the gap.
                    val rest = remember { FloatArray(3) }
                    if (!isLeaving) { rest[0] = with(density) { x.toPx() }; rest[1] = with(density) { (y - if (!isLift && canPlayCb(card)) cardW * (8f / 66f) else 0.dp).toPx() }; // site: a playable card sits 8 px up
                         rest[2] = if (isLift) 0f else t * angleDeg }
                    val ax = rememberSpring(rest[0], fromX, delayMs)
                    val ay = rememberSpring(rest[1], fromY, delayMs)
                    val ar = rememberSpring(rest[2], if (newIndex >= 0) 20f else null, delayMs)
                    val asc = rememberSpring(if (isLift) popScale else 1f, null, 0L)
                    val isDrag = dragging == card.id
                    Box(Modifier.zIndex(if (isDrag || isLeaving || card.id == moving) 3f else if (isLift) 2f else 0f).graphicsLayer {
                        transformOrigin = TransformOrigin(.5f, 1f)
                        val f = if (isLeaving) flight.value else 0f
                        translationX = ax + (if (isDrag || isLeaving) drag.value.x else 0f)
                        translationY = ay + (if (isDrag || isLeaving) drag.value.y else 0f) - f * cardH.toPx() * 1.1f
                        rotationZ = if (isDrag && !isLeaving) (drag.value.x / 40f).coerceIn(-8f, 8f) else ar
                        val sc = if (isLeaving) 1f + .15f * sin(f * PI.toFloat()) + (asc - 1f) * (1f - f) else asc
                        scaleX = sc; scaleY = sc
                        alpha = if (isLeaving) 1f - f * f else 1f
                    }) {
                        CardFace(card, cardW, cardH, mark = markOf(card))
                    }
                }
            }
        }
    }
}

/** A value that springs (stiffness 600, damping 0.8) to each new target; an arriving card starts at [from] after [delayMs]. */
@Composable
private fun rememberSpring(target: Float, from: Float?, delayMs: Long): Float {
    val a = remember { Animatable(from ?: target) }
    var first by remember { mutableStateOf(true) }
    LaunchedEffect(target) {
        if (first) { first = false; if (delayMs > 0) delay(delayMs) }
        a.animateTo(target, spring(dampingRatio = .8f, stiffness = 600f))
    }
    return a.value
}
