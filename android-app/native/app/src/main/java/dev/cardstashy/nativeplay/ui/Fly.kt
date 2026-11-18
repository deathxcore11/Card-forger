package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The site's flight into the collection (feel.js flyToCollection, style.css .fly-card, nav-pop, nav-glow), shared by the pack
 * screen, scan saves and Adds (pack finish brief A, Randall 18 Nov "Yes, with the ring"). A copy of the card picture leaves where
 * it sits and lands on a named target, which pops, glows in the game colour and sends out one gold ring. One tick per landing.
 * Reduced motion: no flight and no ring; the target just counts the landing.
 */
object Fly {
    /** style.css :root --game-color. */
    val GameColor = Color(0xFFF08A5D)
    /** feel.js: { duration: 650, easing: "cubic-bezier(.45,.05,.35,1)" }, applied to the whole flight (Web Animations). */
    const val FLIGHT_MS = 650
    val FLIGHT_EASE = CubicBezierEasing(.45f, .05f, .35f, 1f)
    /** app.js econLand: one card every 85 ms; at most 15 copies in flight. */
    const val GAP_MS = 85L
    const val MAX = 15
    /** nav-pop .5s cubic-bezier(.3,1.4,.5,1) per keyframe step; nav-glow .6s ease-out; the approved ring 420 ms ease-out. */
    const val POP_MS = 500; const val GLOW_MS = 600; const val RING_MS = 420
    val POP_EASE = CubicBezierEasing(.3f, 1.4f, .5f, 1f)
    val OUT = CubicBezierEasing(0f, 0f, .58f, 1f)

    class Flight(val id: Long, val from: Rect, val to: String, val delayMs: Long, val count: Int, val face: @Composable (Modifier) -> Unit)

    /** One pose of the flying copy: translation in px, scale, rotation in degrees, alpha. */
    data class Pose(val x: Float, val y: Float, val scale: Float, val rot: Float, val alpha: Float)

    /**
     * feel.js keyframes at overall progress [t] (0..1, before easing), for a flight of [dx], [dy] px; [lift] is 80 css px in px:
     * 0: (0,0) scale 1 rotate 0 alpha 1; .45: (dx*.35, dy*.15 - 80) scale .62 rotate -8 alpha 1; 1: (dx, dy) scale .12 rotate 6 alpha .2.
     */
    fun pose(t: Float, dx: Float, dy: Float, lift: Float): Pose = poseEased(FLIGHT_EASE.transform(t.coerceIn(0f, 1f)), dx, dy, lift)

    /** The keyframes at eased progress [e]: linear between 0, .45 and 1 (Web Animations eases the whole flight, not each step). */
    fun poseEased(e: Float, dx: Float, dy: Float, lift: Float): Pose {
        fun l(a: Float, b: Float, f: Float) = a + (b - a) * f
        return if (e <= .45f) { val f = e / .45f; Pose(l(0f, dx * .35f, f), l(0f, dy * .15f - lift, f), l(1f, .62f, f), l(0f, -8f, f), 1f) }
        else { val f = (e - .45f) / .55f; Pose(l(dx * .35f, dx, f), l(dy * .15f - lift, dy, f), l(.62f, .12f, f), l(-8f, 6f, f), l(1f, .2f, f)) }
    }

    /** nav-pop at [t]: scale 1, 1.22 and up 3 px at 35 %, .95 at 65 %, 1; each step eased. Returns scale and lift in css px. */
    fun pop(t: Float): Pair<Float, Float> {
        val c = t.coerceIn(0f, 1f)
        fun l(a: Float, b: Float, f: Float) = a + (b - a) * POP_EASE.transform(f)
        return when {
            c < .35f -> { val f = c / .35f; l(1f, 1.22f, f) to l(0f, 3f, f) }
            c < .65f -> { val f = (c - .35f) / .3f; l(1.22f, .95f, f) to l(3f, 0f, f) }
            else -> { val f = (c - .65f) / .35f; l(.95f, 1f, f) to 0f }
        }
    }

    val flights = mutableStateListOf<Flight>()
    /** Where each target is on screen (window px), and how many copies have landed on it. */
    internal val targets = HashMap<String, Rect>()
    val landings = mutableStateMapOf<String, Int>()
    /** Copies on their way to each target (a bar stays up until its last one lands). */
    val pending = mutableStateMapOf<String, Int>()
    private var next = 0L
    /** Tests: true skips every flight and ring. */
    @Volatile var off = false
    /** Android's Remove animations (animator scale 0), read by the flight layer. */
    @Volatile internal var reduced = false

    fun landed(key: String) = landings[key] ?: 0

    /** Sends one copy of a card picture from [from] (window px) to [to]. False when it cannot fly (reduced motion, two screens, full). */
    fun send(from: Rect, to: String, delayMs: Long = 0, count: Int = 1, face: @Composable (Modifier) -> Unit): Boolean {
        if (off || reduced || Motion.still || DualScreen.active || from.width <= 0f) { land(to); return false }
        if (flights.size >= MAX) return false
        pending[to] = (pending[to] ?: 0) + 1
        flights += Flight(++next, from, to, delayMs, count, face)
        return true
    }

    fun land(key: String) { landings[key] = landed(key) + 1 }

    /** A card picture an Add can fly from (app.js lastActTarget): the one last touched, else the one last laid out. */
    class Source(val face: @Composable (Modifier) -> Unit) { var rect: Rect = Rect.Zero; var at = 0L }
    internal val sources = ArrayList<Source>()

    /**
     * app.js commit: a write whose toast says "Added…" flies the card picture into the Trunk tab when the bottom bar is on screen,
     * else into the save bar's Trunk mark. [count] rides on the copy when several were saved (.scan-saved-fly).
     */
    fun added(text: String) {
        val count = Regex("^Added (\\d+)").find(text)?.groupValues?.get(1)?.toIntOrNull() ?: 1
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            val src = sources.filter { it.rect.width > 0f }.maxByOrNull { it.at } ?: return@post
            send(src.rect, if (targets["trunk"] != null) "trunk" else SAVE_MARK, 140, count, src.face)
        }
    }
    const val SAVE_MARK = "save"

    internal fun done(f: Flight, arrived: Boolean) {
        flights.remove(f)
        pending[f.to] = ((pending[f.to] ?: 1) - 1).coerceAtLeast(0)
        if (arrived) land(f.to)
    }
}

/** A landing spot: records where it is, and pops, glows and rings each time a copy lands (nav-pop, nav-glow and the approved ring). */
fun Modifier.flyTarget(key: String, glow: Color = Fly.GameColor): Modifier = composed {
    DisposableEffect(key) { onDispose { Fly.targets.remove(key) } }
    val n = Fly.landed(key)
    val pop = remember { Animatable(1f) }; val glowT = remember { Animatable(1f) }; val ring = remember { Animatable(1f) }
    val context = LocalContext.current
    var seen by remember { mutableStateOf(n) }
    LaunchedEffect(n) {
        if (n == seen) return@LaunchedEffect
        seen = n
        if (Fly.off || Motion.still || Playmats.reduced(context)) return@LaunchedEffect
        launch { pop.snapTo(0f); pop.animateTo(1f, tween(Fly.POP_MS, easing = LinearEasing)) }
        launch { glowT.snapTo(0f); glowT.animateTo(1f, tween(Fly.GLOW_MS, easing = Fly.OUT)) }
        launch { ring.snapTo(0f); ring.animateTo(1f, tween(Fly.RING_MS, easing = Fly.OUT)) }
    }
    this.onGloballyPositioned { Fly.targets[key] = it.boundsInWindow() }
        .drawBehind {
            val g = glowT.value
            if (g < 1f) {
                // nav-glow: inset 4px 18%, a 0 to 14 px spread from 70 % game colour to nothing.
                val spread = 14.dp.toPx() * g
                val l = size.width * .18f - spread; val t = 4.dp.toPx() - spread
                drawRoundRect(glow.copy(alpha = .7f * (1f - g)), Offset(l, t), Size(size.width - 2 * l, size.height - 2 * t), CornerRadius(14.dp.toPx() + spread))
            }
            val r = ring.value
            if (r < 1f) {
                // The ring: from the target's edge to 1.9x, 2 dp gold at about 80 %, fading.
                val base = maxOf(size.width, size.height) / 2f
                drawCircle(Color(0xFFF2CF7E).copy(alpha = .8f * (1f - r)), base * (1f + .9f * r), center, style = Stroke(2.dp.toPx()))
            }
        }
        .graphicsLayer { val (s, up) = Fly.pop(pop.value); scaleX = s; scaleY = s; translationY = -up * density }
}

/** The copies in flight, drawn over the whole app in one layer (MainActivity's root). */
@Composable
fun FlyLayer() {
    var origin by remember { mutableStateOf(Offset.Zero) }
    val context = LocalContext.current
    Fly.reduced = remember(Fly.flights.size) { Playmats.reduced(context) }
    Box(Modifier.fillMaxSize().onGloballyPositioned { origin = it.positionInWindow() }) {
        for (f in Fly.flights) key(f.id) { FlightCopy(f, origin) }
    }
}

@Composable
private fun FlightCopy(f: Fly.Flight, origin: Offset) {
    val view = LocalView.current
    val density = LocalDensity.current
    val t = remember { Animatable(0f) }
    var to by remember { mutableStateOf<Rect?>(null) }
    LaunchedEffect(f.id) {
        if (f.delayMs > 0) delay(f.delayMs)
        // The target is read when the copy leaves (once the pack screen has gone, the Trunk tab is where it is now).
        val target = Fly.targets[f.to]
        if (target == null || target.width <= 0f) { Fly.done(f, arrived = false); return@LaunchedEffect }
        to = target
        t.animateTo(1f, tween(Fly.FLIGHT_MS, easing = LinearEasing))
        Feel.perform(view, "tick")
        Fly.done(f, arrived = true)
    }
    val b = to ?: return
    with(density) {
        // .fly-card: at most 140 px wide, the picture's own shape, centred where the card was.
        val w = minOf(f.from.width, 140.dp.toPx()); val h = w * (f.from.height / f.from.width).let { if (it > 0f) it else 1.4f }
        val left = f.from.left + (f.from.width - w) / 2 - origin.x; val top = f.from.top + (f.from.height - h) / 2 - origin.y
        val dx = b.center.x - f.from.center.x; val dy = b.center.y - f.from.center.y
        val shape = RoundedCornerShape(8.dp)
        Box(Modifier.offset(left.toDp(), top.toDp()).size(w.toDp(), h.toDp()).graphicsLayer {
            val p = Fly.pose(t.value, dx, dy, 80.dp.toPx())
            translationX = p.x; translationY = p.y; scaleX = p.scale; scaleY = p.scale; rotationZ = p.rot; alpha = p.alpha
        }.testShadow(17.dp, shape).clip(shape).drawBehind { }) {
            f.face(Modifier.fillMaxSize())
            // box-shadow 0 0 0 2px game colour at 60 %; a scan of several copies carries its count (.scan-saved-fly).
            Box(Modifier.fillMaxSize().drawBehind { drawRoundRect(Fly.GameColor.copy(alpha = .6f), cornerRadius = CornerRadius(8.dp.toPx()), style = Stroke(4.dp.toPx())) })
            if (f.count > 1) androidx.compose.material3.Text("×${f.count}", Modifier.align(androidx.compose.ui.Alignment.BottomEnd).clip(RoundedCornerShape(10.dp))
                .drawBehind { drawRect(Color(0xE60D1016)) }.padding(horizontal = 8.dp, vertical = 3.dp),
                style = androidx.compose.ui.text.TextStyle(fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, fontSize = androidx.compose.ui.unit.TextUnit(14f, androidx.compose.ui.unit.TextUnitType.Sp), color = Color(0xFFF2CF7E)))
        }
    }
}

/** Marks a card picture as where an Add flies from ([Fly.added]): its place on screen, and the moment it was last touched. */
fun Modifier.flySource(face: @Composable (Modifier) -> Unit): Modifier = composed {
    val src = remember { Fly.Source(face) }
    DisposableEffect(src) { Fly.sources += src; onDispose { Fly.sources -= src } }
    this.onGloballyPositioned { src.rect = it.boundsInWindow(); if (src.at == 0L) src.at = android.os.SystemClock.uptimeMillis() }
        .pointerInput(src) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial); src.at = android.os.SystemClock.uptimeMillis() } }
}

/** A flying copy of a picture by its address (the card page's own image). */
@Composable
fun FlyPicture(url: String?, modifier: Modifier) {
    val p = heroPainter(url?.takeIf { it.isNotBlank() }?.let(homeArt))
    if (p != null) androidx.compose.foundation.Image(p, null, modifier, contentScale = androidx.compose.ui.layout.ContentScale.Crop)
    else Box(modifier.drawBehind { drawRect(Color(0xFF2A2F3A)) })
}
