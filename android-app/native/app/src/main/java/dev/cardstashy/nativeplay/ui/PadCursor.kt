package dev.cardstashy.nativeplay.ui

import android.os.SystemClock
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.node.RootForTest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import kotlin.math.abs
import kotlin.math.hypot

/**
 * The handheld's stick cursor (Randall 7 Nov, preview "A stick cursor on handhelds": "Love it"). The left stick moves a soft
 * glowing cursor, like Destiny's: it slows and pulls gently toward the middle of anything that can be pressed, and the gold
 * ring (with its prompts) follows it there, so A, X, Y and the rest act on what the cursor is over. The d-pad keeps stepping the
 * ring and hides the cursor; the right stick scrolls what is under it. It fades after a few seconds still. Never on a phone:
 * it only ever appears once a stick moves.
 */
object PadCursor {
    /** Where the cursor is, in window pixels; null until a stick first moves. */
    internal var pos by mutableStateOf<Offset?>(null)
    internal var shown by mutableStateOf(false)
    internal var lastMove by mutableStateOf(0L)

    private var root: View? = null
    private var lx = 0f; private var ly = 0f; private var rx = 0f; private var ry = 0f
    private var running = false
    private var lastFrame = 0L
    private var frame = 0
    private var target: SemanticsNode? = null
    private var targetBounds: Rect? = null

    fun attach(decor: View) { root = decor }

    private const val DEAD = .18f

    /** The left stick's position (-1..1 each way). */
    fun left(x: Float, y: Float) { lx = x; ly = y; if (hypot(x, y) > DEAD) { if (!shown) appear(); kick() } }
    /**
     * The right stick scrolls like a console's (Randall 9 Nov: "a real controller going up and down pages that call for it"):
     * analog speed (a nudge creeps, the rim races), one axis at a time, easing in. It drives the scroller the way a finger does
     * (a drag the screen can't tell from a real one), so it moves exactly as far as asked each frame, coasts when let go with
     * the phone's own fling, and stretches at the ends. Up/down moves the page the ring is on; sideways the shelf it is on.
     * When it comes to rest, the ring comes along if it was scrolled out of sight.
     */
    fun right(x: Float, y: Float) {
        rx = x; ry = y
        if (hypot(x, y) > DEAD || drag != null) kick()
    }

    /**
     * A screen that pages sideways instead of scrolling (the pack's cards): the right stick pushed left or right steps it once,
     * then keeps stepping while held, quicker the further it is pushed.
     */
    var sideStep: ((Int) -> Unit)? = null
    private var stepAt = 0L

    /** True while the stick is dragging a scroller, so touch-only reactions (the bottom screen's lens) ignore it. */
    var dragging = false; private set
    private class Drag(val down: Long, var x: Float, var y: Float, val horizontal: Boolean, val scroller: Int, var dir: Float = 0f, var hold: Int = 0, var frames: Int = 0, var stuck: Boolean = false)
    private var drag: Drag? = null
    private var speed = 0f
    private var axisX = false
    private val main = android.os.Handler(android.os.Looper.getMainLooper())

    private fun touch(action: Int, d: Drag) {
        val v = root ?: return
        val ev = android.view.MotionEvent.obtain(d.down, SystemClock.uptimeMillis(), action, d.x, d.y, 0)
        ev.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
        runCatching { v.dispatchTouchEvent(ev) }
        ev.recycle()
    }

    private fun lift() {
        val d = drag ?: return
        touch(android.view.MotionEvent.ACTION_UP, d)
        drag = null; dragging = false; speed = 0f
        val id = d.scroller
        main.removeCallbacksAndMessages(SETTLE)
        main.postAtTime({ settle(id) }, SETTLE, SystemClock.uptimeMillis() + 900)
    }
    private val SETTLE = Any()

    /** The scroller this push moves: the smallest one around the ring (or the cursor) that can still move that way, else the page. */
    private fun pickScroller(all: List<SemanticsNode>, horizontal: Boolean, dir: Float): SemanticsNode? {
        val range = if (horizontal) SemanticsProperties.HorizontalScrollAxisRange else SemanticsProperties.VerticalScrollAxisRange
        val list = all.filter { (it.config.getOrNull(range)?.maxValue?.invoke() ?: 0f) > 0f }
        fun can(n: SemanticsNode): Boolean { val r = n.config.getOrNull(range) ?: return false; val v = r.value(); val m = r.maxValue()
            val d = if (r.reverseScrolling) -dir else dir; return if (d > 0) v < m - .5f else v > .5f }
        val view = root
        val anchor = pos?.takeIf { shown }
            ?: all.firstOrNull { it.config.getOrNull(SemanticsProperties.Focused) == true }?.boundsInWindow?.center
            ?: view?.let { Offset(it.width / 2f, it.height / 2f) } ?: return null
        val around = list.filter { it.boundsInWindow.contains(anchor) }
        return around.filter(::can).minByOrNull { it.boundsInWindow.width * it.boundsInWindow.height }
            ?: list.filter(::can).maxByOrNull { it.boundsInWindow.width * it.boundsInWindow.height }
    }

    /** Where the finger goes down: inside the scroller, clear of any smaller scroller on the same axis inside it. */
    private fun grip(all: List<SemanticsNode>, s: SemanticsNode, horizontal: Boolean): Offset {
        val range = if (horizontal) SemanticsProperties.HorizontalScrollAxisRange else SemanticsProperties.VerticalScrollAxisRange
        val b = s.boundsInWindow
        val inner = all.filter { it.id != s.id && it.config.getOrNull(range) != null && b.contains(it.boundsInWindow.center) &&
            it.boundsInWindow.width * it.boundsInWindow.height < b.width * b.height }
        val tries = listOf(.5f to .5f, .5f to .25f, .5f to .75f, .2f to .5f, .8f to .5f, .15f to .15f, .85f to .85f, .5f to .08f, .5f to .92f)
        return tries.map { (fx, fy) -> Offset(b.left + b.width * fx, b.top + b.height * fy) }.firstOrNull { p -> inner.none { it.boundsInWindow.contains(p) } } ?: b.center
    }

    /** The glide ended: if the ring was scrolled out of sight, it comes to the nearest thing it can rest on inside the scroller. */
    private fun settle(id: Int) {
        if (shown || drag != null) return
        val all = nodes() ?: return
        val box = all.firstOrNull { it.id == id }?.boundsInWindow ?: return
        fun inside(b: Rect) = b.top >= box.top - 1 && b.bottom <= box.bottom + 1 && b.left >= box.left - 1 && b.right <= box.right + 1
        val focused = all.firstOrNull { it.config.getOrNull(SemanticsProperties.Focused) == true }
        val fb = focused?.boundsInWindow
        if (fb != null && inside(fb)) return
        val view = root ?: return
        val max = view.width.toFloat() * view.height * .5f
        val near = fb?.center ?: box.center
        all.filter { n -> n.config.getOrNull(SemanticsActions.RequestFocus) != null && n.boundsInWindow.let { b -> b.width > 0f && b.width * b.height < max && inside(b) } }
            .minByOrNull { val c = it.boundsInWindow.center; if (axisX) abs(c.x - box.center.x) + abs(c.y - near.y) * .5f else abs(c.y - box.center.y) + abs(c.x - near.x) * .5f }
            ?.config?.getOrNull(SemanticsActions.RequestFocus)?.action?.invoke()
    }

    /** The d-pad moved the ring: the cursor steps aside until the stick moves again. */
    fun dpad() { if (shown) shown = false }

    /**
     * A was pressed. With the cursor up over something the ring cannot rest on (a gesture-only target), press it here and
     * swallow A; otherwise A goes on as d-pad centre to whatever has the ring (which the cursor already moved onto its target).
     */
    fun pressA(): Boolean {
        if (!shown) return false
        val t = target ?: return false
        if (t.config.getOrNull(SemanticsProperties.Focused) == true) return false
        val click = t.config.getOrNull(SemanticsActions.OnClick)?.action ?: return false
        lastMove = SystemClock.uptimeMillis()
        click(); return true
    }

    private fun appear() {
        val r = root ?: return
        if (pos == null || !shown) {
            // Start where the ring is, else the middle of the screen.
            val f = nodes()?.firstOrNull { it.config.getOrNull(SemanticsProperties.Focused) == true }?.boundsInWindow
            pos = f?.center ?: pos ?: Offset(r.width / 2f, r.height / 2f)
        }
        shown = true
    }

    private fun kick() {
        lastMove = SystemClock.uptimeMillis()
        if (running || manual) return
        running = true; lastFrame = 0L
        Choreographer.getInstance().postFrameCallback(tick)
    }

    private val tick = object : Choreographer.FrameCallback {
        override fun doFrame(now: Long) {
            val dt = if (lastFrame == 0L) 1f / 60 else ((now - lastFrame) / 1e9f).coerceIn(.001f, .05f)
            lastFrame = now
            if (step(dt)) Choreographer.getInstance().postFrameCallback(this) else running = false
        }
    }

    /** Tests drive the frames themselves with [step]. */
    internal var manual = false

    /** One frame of movement; false once both sticks are at rest. */
    internal fun step(dt: Float): Boolean {
        val l = hypot(lx, ly); val r = hypot(rx, ry)
        if (l <= DEAD && r <= DEAD && drag == null) return false
        val view = root ?: return false
        val density = view.resources.displayMetrics.density
        if (l > DEAD && shown) move(dt, density, view)
        if (r > DEAD || drag != null) scroll(dt, density)
        return true
    }

    private fun move(dt: Float, density: Float, view: View) {
        val p = pos ?: return
        // Speed grows with the push (squared): fine aim near the centre, 1400 dp/s at the rim; a third of that over a target.
        val l = hypot(lx, ly); val k = ((l - DEAD) / (1 - DEAD)).coerceIn(0f, 1f)
        val over = targetBounds?.contains(p) == true
        val speed = 1400f * density * k * k * (if (over) .38f else 1f)
        var x = p.x + lx / l * speed * dt; var y = p.y + ly / l * speed * dt
        // A gentle pull toward the middle of what it is over, strongest when the push is light.
        targetBounds?.takeIf { over }?.let { b -> val pull = (1f - k) * .12f; x += (b.center.x - x) * pull; y += (b.center.y - y) * pull }
        pos = Offset(x.coerceIn(0f, view.width.toFloat()), y.coerceIn(0f, view.height.toFloat()))
        if (frame++ % 2 == 0) aim()
    }

    /** What is under the cursor: the smallest thing that can be pressed or take the ring (never a whole-screen scrim). */
    private fun aim() {
        val p = pos ?: return; val view = root ?: return
        val max = view.width.toFloat() * view.height * .5f
        var best: SemanticsNode? = null; var bestArea = Float.MAX_VALUE
        nodes()?.forEach { n ->
            val c = n.config
            if (c.getOrNull(SemanticsActions.OnClick) == null && c.getOrNull(SemanticsActions.RequestFocus) == null) return@forEach
            val b = n.boundsInWindow
            if (!b.contains(p)) return@forEach
            val area = b.width * b.height
            if (area <= 0f || area > max) return@forEach
            if (area < bestArea) { best = n; bestArea = area }
        }
        val t = best
        if (t?.id != target?.id) {
            target = t; targetBounds = t?.boundsInWindow
            // The ring follows the cursor, so the prompt bar and every button act on what it is over.
            t?.config?.getOrNull(SemanticsActions.RequestFocus)?.action?.invoke()
        } else targetBounds = t?.boundsInWindow
    }

    /**
     * The right stick as a smooth scroll wheel (Randall 9 Nov: "needs to be a smooth scroll, think of gaming or webpage"): the page
     * moves at a speed set by how far the stick is pushed, starts at once, and when the stick is let go it eases to a stop in a
     * blink and stays there. No fling, no coast, no jump. At the end of a page it simply stops instead of stretching.
     */
    private fun scroll(dt: Float, density: Float) {
        val r = hypot(rx, ry)
        sideStep?.let { st ->
            if (r <= DEAD) { stepAt = 0L; lift(); return }
            if (abs(rx) > .5f && abs(rx) > abs(ry)) {
                val now = SystemClock.uptimeMillis()
                if (stepAt == 0L || now >= stepAt) {
                    st(if (rx > 0) 1 else -1)
                    stepAt = now + if (stepAt == 0L) 380L else (320 - 200 * ((abs(rx) - .5f) / .5f).coerceIn(0f, 1f)).toLong()
                }
            } else stepAt = 0L
            return
        }
        var d = drag
        if (r <= DEAD) {
            // Let go: ease out over about a tenth of a second, then hold still a few frames so the page reads no speed, then lift.
            if (d == null) return
            speed *= kotlin.math.exp(-dt / .07f)
            if (speed < 24f * density) { speed = 0f; if (++d.hold >= 4) { lift(); return } }
            push(d, dt)
            return
        }
        val horizontal = abs(rx) > abs(ry) * 1.15f
        val dir = Math.signum(if (horizontal) rx else ry)
        // Changing axis or reversing: put the finger down afresh (the old drag stops dead, it never flings).
        if (d != null && (horizontal != d.horizontal || (d.dir != 0f && dir != d.dir))) { speed = 0f; lift(); d = null }
        axisX = horizontal
        // Speed follows the push closely: a nudge reads slowly, the rim runs about 2,400 dp a second. It answers within a few frames.
        val k = ((r - DEAD) / (1 - DEAD)).coerceIn(0f, 1f)
        val target = 2400f * density * (.08f + .92f * k * k)
        speed += (target - speed) * (dt * 22f).coerceAtMost(1f)
        if (d == null) {
            val all = nodes()?.filter { it.config.getOrNull(SemanticsActions.ScrollBy) != null } ?: return
            val s = pickScroller(all, horizontal, dir) ?: return
            val p = grip(all, s, horizontal)
            main.removeCallbacksAndMessages(SETTLE)
            d = Drag(SystemClock.uptimeMillis(), p.x, p.y, horizontal, s.id, dir); drag = d; dragging = true
            touch(android.view.MotionEvent.ACTION_DOWN, d)
            // Past the touch slop at once, so the scroller takes the drag and nothing under the finger counts it as a tap.
            val slop = android.view.ViewConfiguration.get(root!!.context).scaledTouchSlop + 2f
            if (horizontal) d.x -= dir * slop else d.y -= dir * slop
            touch(android.view.MotionEvent.ACTION_MOVE, d)
        }
        d.dir = dir; d.hold = 0
        push(d, dt)
        if (shown && frame++ % 6 == 0) aim()
    }

    /** Move the finger one frame's worth (against the stick: pushing down shows what is below), unless the page is at its end. */
    private fun push(d: Drag, dt: Float) {
        if (d.frames++ % 3 == 0) d.stuck = atEnd(d)
        if (!d.stuck && speed > 0f) { val step = speed * dt * d.dir; if (d.horizontal) d.x -= step else d.y -= step }
        touch(android.view.MotionEvent.ACTION_MOVE, d)
    }

    /** The scroller under the stick has reached its end in the direction pushed. */
    private fun atEnd(d: Drag): Boolean {
        val range = if (d.horizontal) SemanticsProperties.HorizontalScrollAxisRange else SemanticsProperties.VerticalScrollAxisRange
        val r = nodes()?.firstOrNull { it.id == d.scroller }?.config?.getOrNull(range) ?: return false
        val v = r.value(); val m = r.maxValue(); val dir = if (r.reverseScrolling) -d.dir else d.dir
        return if (dir > 0) v >= m - .5f else v <= .5f
    }

    /** Select: a long press on the middle of what the ring is on, so its hold-down quick menu opens as it does under a finger. */
    fun holdFocused() {
        val all = nodes() ?: return
        val f = all.lastOrNull { it.config.getOrNull(SemanticsProperties.Focused) == true } ?: return
        val b = f.boundsInRoot; if (b.width <= 0f || b.height <= 0f) return
        val d = Drag(SystemClock.uptimeMillis(), b.center.x, b.center.y, horizontal = false, scroller = -1)
        touch(android.view.MotionEvent.ACTION_DOWN, d)
        val hold = android.view.ViewConfiguration.getLongPressTimeout().toLong() + 120
        main.postDelayed({ touch(android.view.MotionEvent.ACTION_UP, d) }, hold)
    }

    private fun nodes(): List<SemanticsNode>? {
        val owner = findRoot(root ?: return null)?.semanticsOwner ?: return null
        val out = ArrayList<SemanticsNode>(512)
        fun walk(n: SemanticsNode) { out += n; n.children.forEach(::walk) }
        runCatching { walk(owner.unmergedRootSemanticsNode) }
        return out
    }

    private fun findRoot(v: View): RootForTest? {
        if (v is RootForTest) return v
        if (v is ViewGroup) for (i in 0 until v.childCount) findRoot(v.getChildAt(i))?.let { return it }
        return null
    }
}

/** The cursor itself: a soft white dot in a warm halo, over everything; half strength after a moment still, gone after a few seconds. */
@Composable
fun BoxScope.PadCursorLayer() {
    val p = PadCursor.pos
    val shown = PadCursor.shown && p != null
    var idle by androidx.compose.runtime.remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(PadCursor.lastMove, shown) { idle = false; if (shown) { kotlinx.coroutines.delay(3500); idle = true } }
    val a by animateFloatAsState(if (!shown) 0f else if (idle) 0f else 1f, tween(if (idle) 900 else 120), label = "cursor")
    if (a <= 0f || p == null) return
    Canvas(Modifier.fillMaxSize()) {
        val r = 11f * density
        drawCircle(Brush.radialGradient(listOf(Color(0x66FFE6AA), Color.Transparent), center = p, radius = r * 2.6f), r * 2.6f, p, alpha = a)
        drawCircle(Color(0x8CFFF1CF), r, p, alpha = a)
        drawCircle(Color.White, r * .48f, p, alpha = a)
    }
}
