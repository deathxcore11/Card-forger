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
    /** The right stick's position: scrolls what is under the cursor. */
    fun right(x: Float, y: Float) {
        val was = hypot(rx, ry) > DEAD; val now = hypot(x, y) > DEAD
        if (now && !was) { pushStart = SystemClock.uptimeMillis(); lastScrolled = null; peak = 0f; peakX = 0f; peakY = 0f }
        if (now && hypot(x, y) > peak) { peak = hypot(x, y); peakX = x; peakY = y }
        rx = x; ry = y
        if (now) kick() else if (was) release()
    }

    // The right stick's last push: a quick flick to the rim turns a page; a slow scroll settles on the nearest card or row edge.
    private var pushStart = 0L; private var peak = 0f; private var peakX = 0f; private var peakY = 0f
    private var lastScrolled: Int? = null
    private const val FLICK_MS = 230L

    private fun release() {
        val id = lastScrolled ?: return
        val node = nodes()?.firstOrNull { it.id == id } ?: return
        val scrollBy = node.config.getOrNull(SemanticsActions.ScrollBy)?.action ?: return
        val b = node.boundsInWindow
        val axisX = abs(peakX) > abs(peakY)
        if (SystemClock.uptimeMillis() - pushStart <= FLICK_MS && peak > .8f) {
            // A flick: one page that way (sideways on a shelf, up or down in a list), keeping a sliver of the last page in view.
            val sign = if (axisX) Math.signum(peakX) else Math.signum(peakY)
            if (axisX) scrollBy(sign * b.width * .85f, 0f) else scrollBy(0f, sign * b.height * .85f)
            return
        }
        // Snap: the child whose leading edge is nearest the scroller's leading edge comes to rest exactly there.
        val edges = node.children.map { it.boundsInWindow }.filter { it.width > 0f && it.height > 0f }
            .map { if (axisX) it.left - b.left else it.top - b.top }
        val half = (if (axisX) b.width else b.height) * .4f
        val d = edges.filter { abs(it) < half }.minByOrNull { abs(it) } ?: return
        if (abs(d) > 1f) { if (axisX) scrollBy(d, 0f) else scrollBy(0f, d) }
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
        if (l <= DEAD && r <= DEAD) return false
        val view = root ?: return false
        val density = view.resources.displayMetrics.density
        if (l > DEAD && shown) move(dt, density, view)
        if (r > DEAD) scroll(dt, density)
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

    private fun scroll(dt: Float, density: Float) {
        val p = pos ?: root?.let { Offset(it.width / 2f, it.height / 2f) } ?: return
        val l = hypot(rx, ry); val k = ((l - DEAD) / (1 - DEAD)).coerceIn(0f, 1f)
        val speed = 1800f * density * k * k * dt
        val dx = rx / l * speed; val dy = ry / l * speed
        // The smallest scrollable under the cursor that can move this way; else the biggest one on screen.
        val all = nodes()?.filter { it.config.getOrNull(SemanticsActions.ScrollBy) != null } ?: return
        val pick = all.filter { it.boundsInWindow.contains(p) }.minByOrNull { it.boundsInWindow.width * it.boundsInWindow.height }
            ?: all.maxByOrNull { it.boundsInWindow.width * it.boundsInWindow.height } ?: return
        val axisX = abs(dx) > abs(dy)
        pick.config.getOrNull(SemanticsActions.ScrollBy)?.action?.invoke(if (axisX) dx else 0f, if (axisX) 0f else dy)
        lastScrolled = pick.id
        if (frame++ % 6 == 0) aim()
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
