package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import kotlin.math.cos
import kotlin.math.sin

/**
 * The CardStashy mark (the site's icon.svg), alive: the three card backs fan out and take turns
 * lifting out of the fan like the site's brand-lift shuffle, the whole mark breathes, and each card
 * carries the site's own subtle foil sweep (brand-sheen), cascading across the fan.
 * Layers are icon.svg's own card groups, rendered upright by scripts (art/brand-*.webp).
 */
/** Screenshots and tests: no endless animations (Compose would never go idle). */
object Motion { @Volatile var still = false; /** Frame used when still: cycle 0..1 and light angle. */ var cycle = .5f; var light = .7f; var breathe = .5f }

@Composable
fun BrandMark(markSize: Dp, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val context = LocalContext.current
    val layers = listOf("left", "center", "right").associateWith { name ->
        produceState<ImageBitmap?>(AssetImages.cached("play/brand-$name.webp@384")) { value = AssetImages.load(context, "play/brand-$name.webp", maxWidth = 384) }
    }
    val still = Motion.still
    var breathe = Motion.breathe; var cycle = Motion.cycle; var drift = Motion.light
    if (!still) {
        val t = rememberInfiniteTransition(label = "brand")
        // stashy-breathe: 4.8 s, up 1 px and 2.5 % larger at the middle.
        breathe = t.animateFloat(0f, 1f, infiniteRepeatable(tween(2400, easing = CubicBezierEasing(.42f, 0f, .58f, 1f)), RepeatMode.Reverse), label = "breathe").value
        // brand-lift: 6 s cycle; each card lifts 10 units and straightens to 55 % of its angle from 14 % to 22 %, back by 36 %.
        cycle = t.animateFloat(0f, 1f, infiniteRepeatable(tween(6000, easing = LinearEasing)), label = "cycle").value
        // brand-sheen: 7.5 s; the light rests off the card, then crosses it between 55 % and 85 % of the loop.
        drift = t.animateFloat(0f, 1f, infiniteRepeatable(tween(7500, easing = LinearEasing)), label = "sheen").value
    }
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    Box(modifier.size(markSize).graphicsLayer {
        val k = (.98f + .045f * breathe) * (if (pressed) .92f else 1f)
        scaleX = k; scaleY = k; translationY = -breathe * markSize.toPx() / 128f
    }.let { if (onClick != null) it.clickable(press, null, onClick = onClick) else it }.semantics { contentDescription = "CardStashy" }) {
        // Paint order as in icon.svg: right, centre, left on top.
        for ((name, rest) in listOf("right" to (3f to 14f), "center" to (0f to 0f), "left" to (-3f to -14f))) {
            val img = layers.getValue(name).value ?: continue
            val delay = when (name) { "left" -> 0f; "center" -> 4f / 6f; else -> 2f / 6f }
            val lift = lift((cycle + delay) % 1f)
            // The site's cascade: right card a half second ahead, centre a quarter, left last.
            val sheen = sheenAt(((drift + when (name) { "left" -> 0f; "center" -> .25f / 7.5f; else -> .5f / 7.5f }) % 1f))
            Image(img, null, Modifier.fillMaxSize().graphicsLayer {
                val u = this.size.width / 128f
                transformOrigin = TransformOrigin(.5f, 102f / 128f)
                translationX = rest.first * (1f - .2f * lift) * u
                translationY = -10f * lift * u
                rotationZ = rest.second * (1f - .45f * lift)
                compositingStrategy = CompositingStrategy.Offscreen
            }.drawWithContent {
                drawContent()
                // Foil exactly as the site's brand-sheen: a thin upright band of white, .5 at its centre,
                // 11 units wide, travelling 78 units from where icon.svg starts it on each card.
                val u = size.width / 128f
                val cx = ((if (name == "right") 56f else 24f) + 78f * sheen) * u; val half = 5.6f * u
                drawRect(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x80FFFFFF), Color(0x00FFF6DC)), startX = cx - half, endX = cx + half),
                    topLeft = Offset(cx - half, 0f), size = androidx.compose.ui.geometry.Size(half * 2, size.height), blendMode = BlendMode.SrcAtop)
            })
        }
    }
}

/** brand-lift keyframes: 0 at rest, up from 0 to 14 %, held to 22 %, down by 36 %, the bezier (.45,.05,.55,.95) on each leg. */
/** brand-sheen keyframes: still to 55 %, across by 85 %, eased (.4,0,.2,1). */
private val sheenEase = CubicBezierEasing(.4f, 0f, .2f, 1f)
private fun sheenAt(p: Float): Float = when {
    p < .55f -> 0f
    p < .85f -> sheenEase.transform((p - .55f) / .3f)
    else -> 1f
}

private val liftEase = CubicBezierEasing(.45f, .05f, .55f, .95f)
private fun lift(p: Float): Float = when {
    p < .14f -> liftEase.transform(p / .14f)
    p < .22f -> 1f
    p < .36f -> 1f - liftEase.transform((p - .22f) / .14f)
    else -> 0f
}

class Tilt(val x: Float, val y: Float, val live: Boolean)

/** The phone's tilt in -1..1 on each axis from the game rotation vector (no magnetometer jitter); not live without a sensor. */
@Composable
fun rememberTilt(): State<Tilt> {
    val context = LocalContext.current
    val state = remember { mutableStateOf(Tilt(0f, 0f, false)) }
    DisposableEffect(Unit) {
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val sensor = sm?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        val rot = FloatArray(9); val ori = FloatArray(3)
        var base: FloatArray? = null
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(rot, e.values); SensorManager.getOrientation(rot, ori)
                val b = base ?: ori.copyOf().also { base = it }
                // Ease the resting point toward how the phone is held, so the light reacts to movement, not posture.
                for (i in 1..2) b[i] += (ori[i] - b[i]) * .02f
                val x = ((ori[2] - b[2]) / .5f).coerceIn(-1f, 1f); val y = ((ori[1] - b[1]) / .5f).coerceIn(-1f, 1f)
                state.value = Tilt(x, y, true)
            }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { sm?.unregisterListener(l) }
    }
    return state
}
