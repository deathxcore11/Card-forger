package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.PaintingStyle
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.size
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.TurnClock
import kotlinx.coroutines.delay

/*
 * The turn clock, ported from the site (play-forge-table.css "The turn clock", forge-table.mjs showTimer): a 3 px ring drains
 * clockwise around the gold action button for the whole window, the thin line under the phase track drains with it (blue-grey on
 * the rival's window), and in the last 10 s both turn coral, the ring pulses once a second and the seconds sit in a 32 px circle
 * 44 px left of the button. Nothing is drawn on the battlefield (table additions 5: the rope is gone).
 */

/** The clock a match screen is showing; the gold button and the phase track read it. */
internal val LocalMatchClock = androidx.compose.runtime.compositionLocalOf<MatchController.Clock?> { null }

private val TtGold = Color(0xFFF2C46F)
private val TtRival = Color(0xFF9DB4D8)
private val TtCoral = Color(0xFFFF6A4A)
private val TtTrackRing = Color(0x24FFFFFF)
private val TtTrackLine = Color(0x1FFFFFFF)
/** @keyframes forge-tt-pulse { 50% { opacity: .55 } }, ease-in-out, 1 s. */
private val EaseInOut = CubicBezierEasing(.42f, 0f, .58f, 1f)

/**
 * Milliseconds left on a clock as state, ticking each frame (each second under Minimal motion); a held clock stands still.
 * Read it inside a draw block so only the drawing follows the clock, never the composition.
 */
@Composable
internal fun clockLeftState(c: MatchController.Clock?): State<Long> {
    val left = remember(c) { mutableLongStateOf(c?.let { it.frozenLeft ?: (it.endsAt - android.os.SystemClock.elapsedRealtime()).coerceAtLeast(0) } ?: 0L) }
    if (c != null && c.frozenLeft == null) LaunchedEffect(c) {
        while (true) {
            left.longValue = (c.endsAt - android.os.SystemClock.elapsedRealtime()).coerceAtLeast(0)
            if (left.longValue <= 0) break
            if (Motion.still) delay(1000) else androidx.compose.runtime.withFrameMillis { }
        }
    }
    return left
}

/** conic-gradient(col calc(left*360deg), track 0) from 12 o'clock; a sweep starts at 3 o'clock, so the colour starts at .75. */
private fun conic(frac: Float, col: Color, rest: Color, center: Offset): Brush {
    if (frac >= 1f) return Brush.sweepGradient(listOf(col, col), center)
    if (frac <= 0f) return Brush.sweepGradient(listOf(rest, rest), center)
    val end = .75f + frac
    return if (end <= 1f) Brush.sweepGradient(0f to rest, .75f to rest, .75f to col, end to col, end to rest, 1f to rest, center = center)
    else Brush.sweepGradient(0f to col, (end - 1f) to col, (end - 1f) to rest, .75f to rest, .75f to col, 1f to col, center = center)
}

/** A blurred copy of [path] in [brush]: the site's drop-shadow / box-shadow glow. */
private fun DrawScope.glow(path: Path, brush: Brush, stroke: Float?, blur: Float, alpha: Float) = drawIntoCanvas { canvas ->
    val p = Paint()
    if (stroke != null) { p.style = PaintingStyle.Stroke; p.strokeWidth = stroke }
    brush.applyTo(size, p, alpha)
    p.asFrameworkPaint().maskFilter = android.graphics.BlurMaskFilter(blur, android.graphics.BlurMaskFilter.Blur.NORMAL)
    canvas.drawPath(path, p)
}

/** Set where the gold button stands in a row with another button to its left (a big board): the count goes before the row instead. */
internal val LocalTurnCountOutside = androidx.compose.runtime.compositionLocalOf { false }

/** forge-tt-pulse (opacity 1 → .55 → 1 each second) while [on], none under Minimal motion. */
@Composable
private fun turnPulse(on: Boolean): State<Float>? = if (on && !Motion.still) rememberInfiniteTransition(label = "tt-pulse")
    .animateFloat(1f, .55f, infiniteRepeatable(tween(500, easing = EaseInOut), RepeatMode.Reverse), label = "a") else null

/**
 * The last-10 warning (TurnClock's Shown.warn): your window with 10 s or less left. A window that ran out and now waits on you (a
 * discard against the CPU: TurnClock holds it at INF, the controller sends it held at 0) is not a warning: the site drops
 * data-turn-warn and the count there, and the controller's own line ("Time's up. Choose a card to discard.") says it.
 */
internal fun turnWarn(c: MatchController.Clock, left: Long) = c.frozenLeft != 0L && left <= TurnClock.WARN_MS

private fun countText(left: Long) = ((left + 999) / 1000).toString()

/** .forge-turn-count: a 32 px circle, its right edge at [right], centred on [cy]: coral 2 px rim and glow, #ffd9cf 16 px numerals on #120e08e6. */
private fun DrawScope.drawTurnCount(laid: androidx.compose.ui.text.TextLayoutResult, right: Float, cy: Float, u: Float, a: Float) {
    val d = 32f * u * density
    val top = cy - d / 2
    val box = Path().apply { addOval(androidx.compose.ui.geometry.Rect(right - d, top, right, top + d)) }
    glow(box, androidx.compose.ui.graphics.SolidColor(Color(0x88FF6A4A)), null, 14f * u * density, a)
    drawPath(box, Color(0xE6120E08), alpha = a)
    val rim = 2f * u * density
    drawCircle(TtCoral, (d - rim) / 2, Offset(right - d / 2, cy), alpha = a, style = Stroke(rim))
    drawText(laid, topLeft = Offset(right - d / 2 - laid.size.width / 2f, cy - laid.size.height / 2f), alpha = a)
}

private fun countStyle(u: Float) = sans((16f * u).sp, FontWeight.ExtraBold, Color(0xFFFFD9CF))

/** Where the last-10 count stands beside a ringed button: the site's spot (its right edge 12 px left of the button), right of it (a
 *  button with others to its left in a dialog row), above its right end (a full-width dock button with the hand to its left and
 *  the screen's edge to its right), or nowhere here (the table draws [TurnCount] on its own). */
internal enum class CountAt { LEFT, RIGHT, ABOVE, NONE }

/**
 * .forge-turn-ring and .forge-turn-count on the gold action button (or a prompt's confirm button, [PromptRingLayer]), from
 * [LocalMatchClock] (your window only). [u] is the board's design unit, so the ring's 6 px gap, 3 px band and the count's 32 px
 * circle scale with the button. [cornerDu] is the button's corner radius in design units (null: a pill). The number appears only
 * in the last 10 s, where [count] says (the site: its left edge 44 px left of the button).
 */
@Composable
internal fun Modifier.turnRing(u: Float, cornerDu: Float? = null, count: CountAt = CountAt.LEFT): Modifier {
    val c = LocalMatchClock.current
    if (c == null || !c.own) return this
    val at = if (LocalTurnCountOutside.current) CountAt.NONE else count
    val leftState = clockLeftState(c)
    val warn by remember(c) { derivedStateOf { turnWarn(c, leftState.value) } }
    val pulse = turnPulse(warn)
    val measurer = rememberTextMeasurer()
    val total = c.totalMs.coerceAtLeast(1)
    val anchors = LocalAnchors.current
    val dens = androidx.compose.ui.platform.LocalDensity.current.density
    return this.then(if (anchors == null) Modifier else Modifier.onGloballyPositioned { lc ->
        // Tests read where the ring and the count are drawn (the ring's outer edge is 6 px out; the count 32 px, 12 px off the button).
        val b = lc.boundsInRoot(); val px = u * dens
        anchors.putRect("turnring", androidx.compose.ui.geometry.Rect(b.left - 6f * px, b.top - 6f * px, b.right + 6f * px, b.bottom + 6f * px))
        // With the count drawn on its own ([TurnCount]) that element records its own box.
        if (at == CountAt.NONE) return@onGloballyPositioned
        if (warn) {
            val right = when (at) { CountAt.LEFT -> b.left - 12f * px; CountAt.RIGHT -> b.right + 44f * px; else -> b.right }
            val cy = if (at == CountAt.ABOVE) b.top - 26f * px else b.center.y
            anchors.putRect("turncount", androidx.compose.ui.geometry.Rect(right - 32f * px, cy - 16f * px, right, cy + 16f * px))
        } else anchors.rects.remove("turncount")
    }).drawWithContent {
        drawContent()
        val left = leftState.value
        val frac = (left.toFloat() / total).coerceIn(0f, 1f)
        val col = if (warn) TtCoral else TtGold
        val a = pulse?.value ?: 1f
        // The ring: 6 px out from the button, a 3 px band (the stroke runs down its middle), rounded as the button is (+ the gap).
        val gap = 6f * u * density; val band = 3f * u * density; val m = gap - band / 2
        val r = cornerDu?.let { it * u * density + m } ?: (size.height / 2 + m)
        val ring = Path().apply { addRoundRect(RoundRect(-m, -m, size.width + m, size.height + m, CornerRadius(r))) }
        val center = Offset(size.width / 2, size.height / 2)
        drawPath(ring, TtTrackRing, alpha = a, style = Stroke(band))
        if (frac > 0f) {
            val fill = conic(frac, col, Color.Transparent, center)
            glow(ring, fill, band, 5f * u * density, .65f * a)
            drawPath(ring, fill, alpha = a, style = Stroke(band))
        }
        if (!warn || at == CountAt.NONE) return@drawWithContent
        val right = when (at) { CountAt.LEFT -> -12f * u * density; CountAt.RIGHT -> size.width + 44f * u * density; else -> size.width }
        // ABOVE: 10 px clear of the button's top (the ring's 6 px and 4 more).
        val cy = if (at == CountAt.ABOVE) -26f * u * density else size.height / 2
        drawTurnCount(measurer.measure(countText(left), countStyle(u)), right, cy, u, a)
    }
}

/** The count as its own element, for a big board's button row (see [LocalTurnCountOutside]); nothing outside the last 10 s. */
@Composable
internal fun TurnCount(u: Float, modifier: Modifier = Modifier) {
    val c = LocalMatchClock.current
    if (c == null || !c.own) return
    val leftState = clockLeftState(c)
    val warn by remember(c) { derivedStateOf { turnWarn(c, leftState.value) } }
    if (!warn) return
    val pulse = turnPulse(true)
    val measurer = rememberTextMeasurer()
    androidx.compose.foundation.layout.Box(modifier.size((32f * u).dp).anchorRect("turncount").drawBehind {
        drawTurnCount(measurer.measure(countText(leftState.value), countStyle(u)), size.width, size.height / 2, u, pulse?.value ?: 1f)
    })
}

/**
 * .forge-phase-track::after: a 3 px line 12 px in from each end, 1 px under the track, draining with the clock. Gold for your window,
 * blue-grey #9db4d8 for the rival's, coral for your last 10 s (no pulse: the site pulses only the ring and the count).
 */
@Composable
internal fun Modifier.turnLine(u: Float): Modifier {
    val c = LocalMatchClock.current ?: return this
    val leftState = clockLeftState(c)
    val total = c.totalMs.coerceAtLeast(1)
    return this.drawBehind {
        val left = leftState.value
        val frac = (left.toFloat() / total).coerceIn(0f, 1f)
        val col = if (!c.own) TtRival else if (turnWarn(c, left)) TtCoral else TtGold
        val inset = 12f * u * density; val h = 3f * u * density; val y = size.height + 1f * u * density
        val w = size.width - inset * 2
        if (w <= 0f) return@drawBehind
        val r = CornerRadius(2f * u * density)
        // box-shadow: 0 0 6px (--tt-line at 60 %) is on the whole ::after line, drained part included, so it glows its full length.
        glow(Path().apply { addRoundRect(RoundRect(inset, y, inset + w, y + h, r)) }, androidx.compose.ui.graphics.SolidColor(col), null, 6f * u * density, .6f)
        drawRoundRect(TtTrackLine, Offset(inset, y), Size(w, h), r)
        if (frac > 0f) drawPath(Path().apply { addRoundRect(RoundRect(inset, y, inset + w * frac, y + h, r)) }, col)
    }
}

/**
 * The clock's sounds (cue map): a quiet TT-006 as a fresh prompt window opens, TT-007 each second of the last 10, TT-008 at zero.
 * Yours only, never while held. Fed the current clock every ~100 ms: it keeps its count across the clock's re-emissions (the
 * controller sends a new Clock every second), so a second the controller reports first is never lost.
 */
internal class ClockCues(private val play: (String, Float) -> Unit) {
    private var said = Int.MAX_VALUE
    private var total = -1L
    private var running: MatchController.Clock? = null

    fun step(c: MatchController.Clock?, now: Long) {
        if (c == null || !c.own) { ended(now); said = Int.MAX_VALUE; total = -1; return }
        val left = (c.frozenLeft ?: (c.endsAt - now)).coerceAtLeast(0)
        val s = ((left + 999) / 1000).toInt()
        if (c.totalMs != total || s > said) {
            // A new window (or the same one sent again with more time): its count starts here, without a tick.
            ended(now)
            total = c.totalMs; said = s
            if (c.frozenLeft == null && left > 0 && c.totalMs <= TurnClock.PROMPT_MS && c.totalMs - left < 500) play("TT-006", .4f)
        } else if (c.frozenLeft == null && s < said) {
            said = s
            if (s == 0) play("TT-008", .8f) else if (s <= 10) play("TT-007", .7f)
        }
        running = if (c.frozenLeft == null && s > 0) c else null
    }

    /**
     * The running window went away: when it went at its end (the timer answered at zero before this poll saw it), its zero still
     * sounds. An answer you gave in time (even 250 ms before the end) is not a time-out and stays silent.
     */
    private fun ended(now: Long) {
        val r = running ?: return
        running = null
        if (said > 0 && now >= r.endsAt - 50) { said = 0; play("TT-008", .8f) }
    }
}

/**
 * The prompt dock's confirm button wears the ring too (forge-table.mjs showTimer: [data-native-key=confirm-prompt]). The dock's
 * buttons sit in scrolling columns and clipped frames, so the button only reports its box ([promptRing]) and [PromptRingLayer],
 * drawn over the whole dock and clipped by nothing, draws the ring and the count there. Shown only while the button is wholly in view.
 */
internal class PromptRing {
    internal class Spot(val owner: Any, val box: androidx.compose.ui.geometry.Rect, val cornerDu: Float, val count: CountAt)
    var spot by androidx.compose.runtime.mutableStateOf<Spot?>(null)
}
internal val LocalPromptRing = androidx.compose.runtime.compositionLocalOf<PromptRing?> { null }

/** Marks this button as the prompt's confirm: [PromptRingLayer] draws the turn ring round it ([cornerDu]: its corner radius in du). */
@Composable
internal fun Modifier.promptRing(cornerDu: Float, count: CountAt = CountAt.LEFT): Modifier {
    val host = LocalPromptRing.current ?: return this
    val owner = remember { Any() }
    androidx.compose.runtime.DisposableEffect(host, owner) { onDispose { if (host.spot?.owner === owner) host.spot = null } }
    return this.onGloballyPositioned { lc ->
        val b = lc.boundsInRoot()
        // Scrolled partly out of its column (or clipped by its frame): no ring until it is in full view.
        val whole = lc.isAttached && b.width >= lc.size.width - 1f && b.height >= lc.size.height - 1f
        val old = host.spot
        val next = if (whole) PromptRing.Spot(owner, b, cornerDu, count) else null
        if (next == null) { if (old?.owner === owner) host.spot = null }
        else if (old == null || old.owner !== owner || old.box != b || old.cornerDu != cornerDu || old.count != count) host.spot = next
    }
}

/** Draws [host]'s ring (and the last-10 count) where the confirm button stands; it fills its parent and takes no touches. */
@Composable
internal fun PromptRingLayer(host: PromptRing, u: Float, modifier: Modifier = Modifier) {
    val spot = host.spot
    var origin by remember { androidx.compose.runtime.mutableStateOf(Offset.Zero) }
    androidx.compose.foundation.layout.Box(modifier.onGloballyPositioned { origin = it.positionInRoot() }) {
        if (spot != null) {
            val dens = androidx.compose.ui.platform.LocalDensity.current
            val b = spot.box
            androidx.compose.foundation.layout.Box(Modifier
                .offset { androidx.compose.ui.unit.IntOffset((b.left - origin.x).toInt(), (b.top - origin.y).toInt()) }
                .size(with(dens) { b.width.toDp() }, with(dens) { b.height.toDp() })
                .turnRing(u, spot.cornerDu, spot.count))
        }
    }
}
