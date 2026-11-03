package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The card picture's lean, ported from the site's feel.js and style.css:
 *  - attachTilt (feel.js:298): a finger on the card leans it toward the finger, ±8° each way
 *    ((x − .5)·16 and (.5 − y)·16), light at the finger, scale 1.035, 80 ms linear (style.css:2181);
 *    it lets go 260 ms after the finger lifts, or at once when the press turns into a scroll.
 *  - attachMotionTilt (feel.js:366): otherwise the phone leans it. beta/gamma clamp(Δ/18), the resting
 *    angle drifts 2 % per frame toward how the phone is held; rotateY x·9°, rotateX −y·9°, light 50 + x·45 %;
 *    no scale, 180 ms ease-out (style.css:2818). Honours "Phone tilt in card views" (motionTilt).
 *  - shine-once (style.css:2820-2823): the first time 60 % of the card is on screen it catches the light,
 *    rotateY −9° → 5° → 0 and rotateX 3° → −1° → 0 over 1.1 s after .15 s; its lamp plays finish-catch.
 *  - the lamp is finish-effects.css .finish-spotlight (the ::before/::after spots are hidden on live, fx:34).
 *    Checked with the card detail thread against live 574ef07.
 * Light ([mx], [my]) is 0..1, for the foil to follow.
 */
class CardLean {
    var tx by mutableFloatStateOf(0f); var ty by mutableFloatStateOf(0f)
    var mx by mutableFloatStateOf(.5f); var my by mutableFloatStateOf(.5f)
    var pressed by mutableStateOf(false); var gyro by mutableStateOf(false)
    internal var catchDone = false
    /** A phone tilt sensor is live: on phones the site's .tilting.gyro rule wins, so a finger gets no 1.035 lift and eases at .18 s. */
    var sensor = false
    /** The light as the foil's -1..1 offset, or null when nothing leans the card. */
    val light: Offset? get() = if (pressed || gyro) Offset((mx - .5f) * 2f, (my - .5f) * 2f) else null
}

private val settle = CubicBezierEasing(.2f, .8f, .2f, 1f)
private val easeOut = CubicBezierEasing(0f, 0f, .58f, 1f)

@Composable
fun rememberCardLean(): CardLean {
    val lean = remember { CardLean() }
    val context = LocalContext.current
    val tiltOn = AppSettings.tilt
    if (tiltOn && !Motion.still) DisposableEffect(lean) {
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val sensor = sm?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        val rot = FloatArray(9); val ori = FloatArray(3)
        var baseB = Float.NaN; var baseG = 0f
        @Suppress("DEPRECATION") val angle = { ((context.getSystemService(Context.WINDOW_SERVICE) as? android.view.WindowManager)?.defaultDisplay?.rotation ?: 0) * 90 }
        lean.sensor = sensor != null
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(rot, e.values); SensorManager.getOrientation(rot, ori)
                // DeviceOrientationEvent: beta = front-back degrees, gamma = left-right degrees.
                val b = Math.toDegrees(-ori[1].toDouble()).toFloat(); val g = Math.toDegrees(ori[2].toDouble()).toFloat()
                if (lean.pressed) return
                if (baseB.isNaN()) { baseB = b; baseG = g }
                baseB += (b - baseB) * .02f; baseG += (g - baseG) * .02f
                val x0 = ((g - baseG) / 18f).coerceIn(-1f, 1f); val y0 = ((b - baseB) / 18f).coerceIn(-1f, 1f)
                // mobile-tilt.js tiltCoordinates: the axes turn with the screen, so landscape leans the right way.
                val r = Math.toRadians(angle().toDouble()); val c = Math.cos(r).toFloat(); val sn = Math.sin(r).toFloat()
                val x = x0 * c + y0 * sn; val y = y0 * c - x0 * sn
                lean.catchDone = true
                lean.gyro = true; lean.tx = x * 9f; lean.ty = -y * 9f; lean.mx = .5f + x * .45f; lean.my = .5f + y * .45f
            }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { sm?.unregisterListener(l) }
    }
    return lean
}

/** Leans the card (see [CardLean]); put it on the card picture's box, outside its clip. [foil]: a foil layer is drawn, so no light spot. */
fun Modifier.cardLean(lean: CardLean, foil: Boolean, shape: androidx.compose.ui.graphics.Shape = androidx.compose.foundation.shape.RoundedCornerShape(16f)): Modifier = composed {
    val still = Motion.still
    val view = LocalView.current
    val spec = when { lean.pressed && !lean.sensor -> tween<Float>(80, easing = LinearEasing); lean.gyro || lean.sensor -> tween(180, easing = easeOut); else -> tween(350, easing = settle) }
    val leaning = lean.pressed || lean.gyro
    val rx by animateFloatAsState(if (leaning && !still) lean.ty else 0f, spec, label = "rx")
    val ry by animateFloatAsState(if (leaning && !still) lean.tx else 0f, spec, label = "ry")
    val sc by animateFloatAsState(if (lean.pressed && !lean.sensor && !still) 1.035f else 1f, spec, label = "sc")
    // shine-once: rotateY −9 → 5 (55 %) → 0, rotateX 3 → −1 → 0.
    val shine = remember { Animatable(0f) }
    var seen by remember { mutableStateOf(false) }
    LaunchedEffect(seen) {
        if (!seen || still || lean.catchDone) return@LaunchedEffect
        delay(150); shine.animateTo(1f, tween(1100, easing = LinearEasing)); lean.catchDone = true
    }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var release by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    this
        .onGloballyPositioned { c ->
            if (seen) return@onGloballyPositioned
            val r = c.boundsInWindow(); val h = c.size.height.toFloat()
            if (h > 0 && r.height / h >= .6f && r.bottom <= view.height + 1) seen = true
        }
        .pointerInput(lean) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                release?.cancel()
                fun set(p: Offset) {
                    val x = (p.x / size.width).coerceIn(0f, 1f); val y = (p.y / size.height).coerceIn(0f, 1f)
                    lean.tx = (x - .5f) * 16f; lean.ty = (.5f - y) * 16f; lean.mx = x; lean.my = y
                }
                lean.catchDone = true; lean.pressed = true; set(down.position)
                var scrolled = false
                while (true) {
                    // Final pass: after the page has had its say, so a press the page turned into a scroll is seen as one.
                    val ev = awaitPointerEvent(PointerEventPass.Final)
                    val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                    if (!ch.pressed) break
                    // A press that becomes a scroll lets go at once (the site ends tilt on scroll).
                    if (ch.isConsumed && ch.position != ch.previousPosition) { scrolled = true; break }
                    set(ch.position)
                }
                if (scrolled) { lean.pressed = false; lean.gyro = false }
                else release = scope.launch { delay(260); lean.pressed = false }
            }
        }
        .graphicsLayer {
            val p = shine.value
            val (cy, cx) = if (p <= 0f || p >= 1f || leaning) 0f to 0f else if (p < .55f) { val k = settle.transform(p / .55f); (-9f + 14f * k) to (3f - 4f * k) }
                else { val k = settle.transform((p - .55f) / .45f); (5f - 5f * k) to (-1f + 1f * k) }
            // perspective(700px): Compose's camera distance is in density units of 72 px.
            cameraDistance = 700f / 72f * density
            rotationX = rx + cx; rotationY = ry + cy; scaleX = sc; scaleY = sc
        }
        .clip(shape)
        .drawWithContent {
            drawContent()
            if (still) return@drawWithContent
            // finish-effects.css .finish-spotlight: a neutral lamp at the light on every enlarged card, screen blend, .65;
            // shine-once plays finish-catch on it (opacity 0 → .9 → .65, translateX −35 % → 0, 1.1 s ease-out).
            val p = shine.value
            val (alpha, dx) = if (p > 0f && p < 1f) { val k = easeOut.transform(p)
                (if (k < .55f) .9f * (k / .55f) else .9f - .25f * ((k - .55f) / .45f)) to (-.35f * (1f - k)) } else .65f to 0f
            val cx = lean.mx * size.width + dx * size.width; val cy = lean.my * size.height
            // radial-gradient(ellipse at x y): farthest-corner ellipse, radii √2 × the farthest side on each axis.
            val rx = maxOf(cx, size.width - cx) * 1.4142f; val ry = maxOf(cy, size.height - cy) * 1.4142f
            withTransform({ scale(1f, ry / rx, Offset(cx, cy)) }) {
                drawCircle(Brush.radialGradient(0f to Color(1f, 1f, 1f, .46f), .18f to Color(245 / 255f, 249 / 255f, 1f, .18f), .55f to Color.Transparent,
                    center = Offset(cx, cy), radius = rx), radius = rx, center = Offset(cx, cy), alpha = alpha, blendMode = BlendMode.Screen)
            }
        }
}


