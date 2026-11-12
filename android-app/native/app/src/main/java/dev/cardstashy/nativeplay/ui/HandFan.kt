package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.Card
import kotlinx.coroutines.delay
import androidx.compose.ui.draw.drawBehind
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
    /** forge-table.mjs data-forge-blocked: why a card can't be played, shown on it while lifted ("Not enough mana"). */
    blockedOf: (Card) -> String? = { null },
    /** A controller: where the ring goes when A plays the last card in the hand (the table's gold button). */
    padEmpty: (() -> Unit)? = null,
    /** Two screens: A on a card that is not the lifted one only lifts it ([onTap]); A on the lifted card plays it. */
    padLift: Boolean = false,
    /** 0.4.59 T7, a dual bottom screen: a lifted card does not grow (it is already full size); it rises a little with a thicker ring. */
    flatLift: Boolean = false,
    /** A's words on a card that cannot be played (a card to discard: "Pick", "Discard"). */
    padA: (Card) -> String? = { null },
    /** glow-rules.md: the card being carried now (dragged, under the finger or under the controller's ring), null when none. */
    onCarry: ((Int?) -> Unit)? = null,
    /** 0.4.60 Z5: the most room between two cards while they fit side by side (the tray's 6), and how far the arc drops a card. */
    gap: Dp = 4.dp,
    arc: Dp = 2.dp,
    /** Mobile table M5: how far a lifted card rises (the hand's foot is below the screen's edge, so it rises until its foot is on screen). */
    liftRise: Dp? = null,
) {
    val cardH = cardW * 1.4f
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val drawFx = LocalBattlefield.current
    // 0.4.59 T5: where each card sits, so the one you cast travels to the stack from its own place.
    val handAnchors = LocalAnchors.current
    var focus by remember { mutableStateOf<Int?>(null) }        // card id under the finger
    var dragging by remember { mutableStateOf<Int?>(null) }     // card id under the finger, moving up
    var leaving by remember { mutableStateOf<Int?>(null) }      // card id flying out after a play
    var putBack by remember { mutableStateOf<Int?>(null) }      // card id springing back into the hand after a drag let go
    val drag = remember { Animatable(Offset.Zero, Offset.VectorConverter) }
    // Match punch P7, holding a card. [over]: the carried card is past the play line (over the table) and can be played: its ring
    // turns from ice blue to gold with one pulse. [leanTo]: it leans into its travel (up to 18 degrees) and settles when still.
    // [heldOut]: it was let go over the table, so it casts from where it is (its place there is the cast's starting point).
    var over by remember { mutableStateOf(false) }
    var leanTo by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    var movedAt by remember { androidx.compose.runtime.mutableLongStateOf(0L) }
    var heldOut by remember { mutableStateOf(false) }
    val overPulse = remember { Animatable(1f) }
    // The match sound pass: the pick-up, the card crossing onto the table, and a drop that is refused (S1: the card shakes
    // once, two swings in 160 ms, then slides home).
    val cueCb by androidx.compose.runtime.rememberUpdatedState(LocalTableCue.current)
    var refused by remember { mutableStateOf<Int?>(null) }
    val shake = remember { Animatable(1f) }
    val places = remember { HashMap<Int, androidx.compose.ui.layout.LayoutCoordinates>() }
    val calm = Motion.still || drawFx?.reduced == true
    val lean by androidx.compose.animation.core.animateFloatAsState(if (calm) 0f else leanTo, spring(dampingRatio = .6f, stiffness = 260f), label = "lean")
    val carrying = dragging != null && dragging != putBack && !flatLift
    // The rest of the hand drops and dims while one card is carried (180 ms), and comes back when it is let go.
    val dropped by androidx.compose.animation.core.animateFloatAsState(if (carrying) 1f else 0f, if (calm) androidx.compose.animation.core.snap() else tween(HOLD_DROP_MS), label = "handDrop")
    LaunchedEffect(dragging) { if (dragging == null) { leanTo = 0f; over = false } else while (true) { delay(40); if (android.os.SystemClock.uptimeMillis() - movedAt > 70) leanTo = 0f } }
    LaunchedEffect(over) { if (over && !calm) { overPulse.snapTo(0f); overPulse.animateTo(1f, tween(320)) } }
    val flight = remember { Animatable(0f) }
    val current by rememberUpdatedState(cards)
    val tapCb by rememberUpdatedState(onTap); val playCb by rememberUpdatedState(onPlay)
    val holdCb by rememberUpdatedState(onHold); val canPlayCb by rememberUpdatedState(canPlay)
    val dealCb by rememberUpdatedState(onDeal); val reorderCb by rememberUpdatedState(onReorder)
    val padEmptyCb by rememberUpdatedState(padEmpty)
    // Each hand card's FocusRequester, so the controller's ring can step to the neighbour of a card A just played.
    val padFocusers = remember { HashMap<Int, FocusRequester>() }
    // Sideways drag (Randall 3 Nov, approved): the card lifts and follows the finger; its neighbours slide to open a gap.
    var moving by remember { mutableStateOf<Int?>(null) }      // card id being moved sideways
    var moveTo by remember { mutableStateOf(0) }               // the slot it would drop into
    var moveX by remember { mutableStateOf(0f) }               // its left edge, px
    val seen = remember { HashSet<Int>() }
    var shownOnce by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shownOnce = true }
    // The carried card (dragged, under the finger, under the controller's ring): dropped, cast (it leaves) or put back, and it is
    // no longer carried. A lift by a tap ([raised]) is the caller's to count: it knows when that lift is still live.
    val carryCb by rememberUpdatedState(onCarry)
    val carriedNow = (dragging?.takeIf { it != putBack } ?: focus)?.takeIf { id -> id != leaving && cards.any { it.id == id } }
    LaunchedEffect(carriedNow) { carryCb?.invoke(carriedNow) }
    DisposableEffect(Unit) { onDispose { carryCb?.invoke(null) } }
    val popScale = if (flatLift) 1f else pop ?: maxOf(1.5f, minOf(2.2f, 110f / cardW.value))
    val rise = if (flatLift) BOTTOM_LIFT else liftRise ?: 18.dp

    BoxWithConstraints(modifier.fillMaxWidth().height(cardH + 8.dp), contentAlignment = Alignment.BottomStart) {
        val width = maxWidth
        // The slots: the card flying out after a play no longer holds one, so the fan closes behind it.
        val held = cards.filter { it.id != leaving }
        val slots = moving?.let { id -> held.firstOrNull { it.id == id }?.let { m -> held.filter { it.id != id }.toMutableList().apply { add(moveTo.coerceIn(0, size), m) } } } ?: held
        val n = slots.size
        val step: Dp = if (n <= 1) 0.dp else maxOf(cardW / 4, minOf(cardW + gap, (width - cardW) / (n - 1)))
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
        // T6: a card coming back from the stack (Cancel) is not dealt in: it waits unseen in its place while it flies there.
        val backId = LocalTravel.current?.travel?.takeIf { it.leg == dev.cardstashy.nativeplay.match.Director.Leg.BACK }?.cardId
        if (backId != null && slots.any { it.id == backId }) seen.add(backId)
        val arriving = if (shownOnce || dealIn) slots.filter { it.id !in seen }.map { it.id } else emptyList()
        if (!shownOnce && !dealIn) slots.forEach { seen.add(it.id) }
        // A on a hand card (a controller): a card you can play goes as a slide up past the line does (the same arc and play);
        // any other card does what a tap does.
        fun padPress(card: Card) {
            if (padLift && card.id != raised && canPlayCb(card)) { tapCb(card); return }
            if (canPlayCb(card)) {
                val was = leaving
                // The cast starts from where the card is drawn now (its box as it stands, lifted), not from where it was first laid out.
                places[card.id]?.takeIf { it.isAttached }?.let { handAnchors?.putRect("hand${card.id}", it.boundsInRoot()) }
                leaving = card.id; dragging = null; focus = null; heldOut = false
                playCb(card)
                // The ring steps to the card that closes into its slot (the next one, else the one before), or off the hand when it was the last.
                if (Pad.connected.value) {
                    val inHand = current.filter { it.id != was }
                    val at = inHand.indexOfFirst { it.id == card.id }
                    val rest = inHand.filter { it.id != card.id }
                    val next = rest.getOrNull(at.coerceAtMost(rest.size - 1))?.let { padFocusers[it.id] }
                    if (next != null) runCatching { next.requestFocus() } else padEmptyCb?.invoke()
                }
                scope.launch {
                    drag.snapTo(Offset.Zero); flight.snapTo(0f); flight.animateTo(1f, tween(380, easing = FastOutSlowInEasing))
                    delay(1100); if (leaving == card.id) leaving = null
                }
            } else tapCb(card)
        }

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
                        // P7: the lean follows how fast the card is moving sideways; the ring turns as it crosses the play line.
                        val dt = (ch.uptimeMillis - ch.previousUptimeMillis).coerceAtLeast(1L)
                        leanTo = holdLean(leanTo, (ch.position.x - ch.previousPosition.x) / dt / density.density); movedAt = android.os.SystemClock.uptimeMillis()
                        val o = !stretching && v.y < -playLine
                        if (o != over) { over = o; haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); if (o) cueCb?.invoke("card_hold", 1f, 1f) }
                        scope.launch { drag.snapTo(v) }; continue
                    }
                    val card = hand.getOrNull(idx)
                    if (card != null && d.y < -slop * 1.5f && abs(d.y) > abs(d.x) * 1.2f) {
                        stretching = !canPlayCb(card); scope.launch { drag.snapTo(Offset.Zero) }; dragging = card.id; putBack = null; anchor = ch.position
                        cueCb?.invoke("card_lift", 1f, 1f); continue
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
                    // P7: released over the table, it casts from where it is. Its place under the finger becomes the cast's
                    // starting point (the travelling card leaves from there), and it stays put until the cast takes it; the
                    // slot closes behind it at once. If nothing takes it, it fades after a beat.
                    places[card.id]?.takeIf { it.isAttached }?.let { handAnchors?.putRect("hand${card.id}", it.boundsInRoot()) }
                    heldOut = true
                    leaving = card.id; dragging = null; focus = null
                    playCb(card)
                    scope.launch {
                        flight.snapTo(0f); delay(240); flight.animateTo(1f, tween(260, easing = FastOutSlowInEasing))
                        delay(900); if (leaving == card.id) { leaving = null; heldOut = false; drag.snapTo(Offset.Zero) }
                    }
                } else if (lifted != null) {
                    putBack = lifted
                    // S1: a card that cannot be played was pulled up and let go: it is refused with its sound and one shake.
                    val no = stretching
                    if (no) cueCb?.invoke("card_refuse", 1f, 1f)
                    // P7: released early, it springs back to its place (280 ms, a small overshoot).
                    scope.launch { if (no && !calm) { refused = lifted; shake.snapTo(0f); shake.animateTo(1f, tween(REFUSE_MS, easing = androidx.compose.animation.core.LinearEasing)); refused = null }
                        drag.animateTo(Offset.Zero, tween(HOLD_BACK_MS, easing = androidx.compose.animation.core.Easing { backOut(it) })); if (dragging == lifted) dragging = null; if (putBack == lifted) putBack = null }
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
                    val y = if (isLift || card.id == moving) -rise else arc * (t * t)
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
                    // P7, pick-up: the card grows to its lifted size with a bounce (140 ms); it settles back on the spring.
                    val asc = rememberSpring(if (isLift) popScale else 1f, null, 0L, bounceUp = !calm)
                    val isDrag = dragging == card.id
                    // A controller: the ring on the card; it stands up and pops as under a finger. A casts what can be cast, Y opens it.
                    val padSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                    val padFocus = remember { FocusRequester() }
                    DisposableEffect(card.id) { padFocusers[card.id] = padFocus; onDispose { if (padFocusers[card.id] === padFocus) padFocusers.remove(card.id) } }
                    val padCast = canPlayCb(card)
                    val padWord = if (!padCast) padA(card) else if (padLift && card.id != raised) "Lift" else if (card.isLand) "Play land" else "Cast"
                    val padHere = remember(card.id, padWord) {
                        PadActs(a = padWord, y = PadAct("Inspect") { current.firstOrNull { it.id == card.id }?.let(holdCb) })
                    }
                    Box(Modifier.zIndex(if (isDrag || isLeaving || card.id == moving) 3f else if (isLift) 2f else 0f).graphicsLayer {
                        transformOrigin = TransformOrigin(.5f, 1f)
                        val f = if (isLeaving) flight.value else 0f
                        val held = isLeaving && heldOut
                        // The cards not being carried drop 58 % of a card and dim (P7), as the hand does for a question.
                        val down = if (isDrag || isLeaving) 0f else dropped
                        translationX = ax + (if (isDrag || isLeaving) drag.value.x else 0f) + (if (card.id == refused) refuseShake(shake.value) * REFUSE_DP.dp.toPx() else 0f)
                        translationY = ay + (if (isDrag || isLeaving) drag.value.y else 0f) - (if (held) 0f else f * cardH.toPx() * 1.1f) + down * cardH.toPx() * AskTuck.DIP
                        // Living table F3: your hand hops 6 dp when a creature of yours lands heavy.
                        drawFx?.handHop()?.let { if (it != 0f) translationY -= it.dp.toPx() }
                        rotationZ = if (isDrag && !isLeaving) lean else if (held) 0f else ar
                        val sc = if (held) popScale else if (isLeaving) 1f + .15f * sin(f * PI.toFloat()) + (asc - 1f) * (1f - f) else asc
                        scaleX = sc; scaleY = sc
                        // Match punch P4: a card you are drawing is its own picture on its way here; its place stays clear until it tucks in.
                        alpha = if (card.id == backId || drawFx?.drawHides(card.id) == true) 0f else if (isLeaving) 1f - f * f else 1f - (1f - HOLD_DIM) * down
                    }.then(if (handAnchors != null && !isLeaving) Modifier.onGloballyPositioned { places[card.id] = it; handAnchors.putRect("hand${card.id}", it.boundsInRoot()) } else Modifier.onGloballyPositioned { places[card.id] = it })
                        .onFocusChanged { if (it.isFocused) focus = card.id else if (focus == card.id && dragging == null) focus = null }
                        .padActs(padHere).matchPadTap(padSource, padFocus) { current.firstOrNull { it.id == card.id }?.let { padPress(it) } }) {
                        CardFace(card, cardW, cardH, mark = markOf(card))
                        // P7: the carried card's ring. Ice blue in the hand; over the table (it would be played) gold, with one pulse.
                        if (isDrag && !flatLift) { val col by androidx.compose.animation.animateColorAsState(if (over) HOLD_GOLD else HOLD_ICE, tween(120), label = "holdRing")
                            Box(Modifier.matchParentSize().drawBehind { val rad = androidx.compose.ui.geometry.CornerRadius(cardW.toPx() * (6f / 66f))
                                drawRoundRect(col, cornerRadius = rad, style = androidx.compose.ui.graphics.drawscope.Stroke(2.5.dp.toPx()))
                                val q = overPulse.value; if (q < 1f) { val g = 10.dp.toPx() * q
                                    drawRoundRect(HOLD_GOLD.copy(alpha = .9f * (1f - q)), Offset(-g, -g), androidx.compose.ui.geometry.Size(size.width + 2 * g, size.height + 2 * g), androidx.compose.ui.geometry.CornerRadius(rad.x + g), style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx() * (1f - q) + 1f)) } }.anchorRect("holdring")) }
                        // T7: the bottom screen's lift is a thicker ring (ice, with a white edge), not a bigger card.
                        if (isLift && flatLift) Box(Modifier.matchParentSize().border(3.dp, Color(0xFF5CC8FF), RoundedCornerShape(cardW * (6f / 66f)))
                            .padding(3.dp).border(1.5.dp, Color.White.copy(alpha = .85f), RoundedCornerShape(cardW * (5f / 66f))).anchorRect("b.lift"))
                        // .play-match-card[data-forge-blocked]::after: bottom 8, #140d0be8, #ff9a7a77 hairline, #ffd4c6 700 11px.
                        if (isLift) blockedOf(card)?.let { why ->
                            androidx.compose.material3.Text(why, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                                style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Sans, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = (cardW.value * 11f / 66f).sp, color = Color(0xFFFFD4C6)),
                                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = cardW * (8f / 66f)).widthIn(max = cardW * .92f)
                                    .clip(RoundedCornerShape(999.dp)).background(Color(0xE8140D0B)).border(1.dp, Color(0x77FF9A7A), RoundedCornerShape(999.dp))
                                    .padding(horizontal = cardW * (8f / 66f), vertical = cardW * (3f / 66f)))
                        }
                    }
                }
            }
        }
    }
}

/** A value that springs (stiffness 600, damping 0.8) to each new target; an arriving card starts at [from] after [delayMs]. */
@Composable
private fun rememberSpring(target: Float, from: Float?, delayMs: Long, bounceUp: Boolean = false): Float {
    val a = remember { Animatable(from ?: target) }
    var first by remember { mutableStateOf(true) }
    LaunchedEffect(target) {
        if (first) { first = false; if (delayMs > 0) delay(delayMs) }
        if (bounceUp && target > a.value) a.animateTo(target, tween(HOLD_GROW_MS, easing = androidx.compose.animation.core.Easing { backOut(it) }))
        else a.animateTo(target, spring(dampingRatio = .8f, stiffness = 600f))
    }
    return a.value
}

/** Match punch P7, holding a card: grow with a bounce (140), the rest of the hand drops and dims (180), an early release springs back (280). */
internal const val HOLD_GROW_MS = 140; internal const val HOLD_DROP_MS = 180; internal const val HOLD_BACK_MS = 280
/** How much of the other cards still shows while one is carried. */
internal const val HOLD_DIM = .55f
/** S1, drop refused: the card shakes once, two swings over [REFUSE_MS], [REFUSE_DP] to each side at first and dying away. */
internal const val REFUSE_MS = 160; internal const val REFUSE_DP = 7f
/** The shake at [q] (0..1) of its time: -1..1, two full swings, back at rest at the end. */
internal fun refuseShake(q: Float): Float = if (q <= 0f || q >= 1f) 0f else sin(q * 4f * PI.toFloat()) * (1f - q)
internal const val HOLD_LEAN_MAX = 18f
internal val HOLD_ICE = Color(0xFF5CC8FF); internal val HOLD_GOLD = Color(0xFFF3D27E)
/**
 * The carried card's lean (degrees) after one more move: it leans the way it travels, 18 degrees at 1.2 dp a millisecond or more,
 * eased toward that so a jitter of the finger does not flick it. [was] is the lean before; [dpPerMs] the sideways speed.
 */
internal fun holdLean(was: Float, dpPerMs: Float): Float = (was * .6f + (dpPerMs * 15f).coerceIn(-HOLD_LEAN_MAX, HOLD_LEAN_MAX) * .4f).coerceIn(-HOLD_LEAN_MAX, HOLD_LEAN_MAX)
