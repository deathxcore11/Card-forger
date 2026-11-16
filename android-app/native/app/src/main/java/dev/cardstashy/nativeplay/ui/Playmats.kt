package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalContext
import dev.cardstashy.nativeplay.play.PlayRules
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Table playmats, port of play-playmats.js (web live branch) and the .playmat-scene rules in play-forge-table.css.
 * Randall's fourteen painted mats, each with its own light edge effects. A player picks one in Practice, or gets a new
 * one each match (never the same twice in a row). The choice is a look only; it never touches the game.
 * The mat list itself (PLAYMATS) comes from play-rules.json, exported from play-playmats.js at build time.
 */
object Playmats {
    // play-playmats.js 4: CHOICE / LAST, kept per device like the site's localStorage.
    const val CHOICE = "cardstashy.playmat"
    const val LAST = "cardstashy.playmat.last"
    const val ROTATE = "rotate"

    fun list(context: Context): List<Pair<String, String>> = PlayRules.load(context).playmats
    private fun prefs(context: Context): SharedPreferences = context.applicationContext.getSharedPreferences("play", Context.MODE_PRIVATE)

    /** readPlaymatChoice: a known mat id, else "rotate". */
    fun readChoice(context: Context): String = readChoice(list(context).map { it.first }, prefs(context))
    fun readChoice(ids: List<String>, p: SharedPreferences): String = p.getString(CHOICE, "").orEmpty().takeIf { it in ids } ?: ROTATE

    /** setPlaymatChoice. */
    fun setChoice(context: Context, choice: String): String = setChoice(list(context).map { it.first }, prefs(context), choice)
    fun setChoice(ids: List<String>, p: SharedPreferences, choice: String): String {
        val next = if (choice in ids) choice else ROTATE
        p.edit().putString(CHOICE, next).apply(); return next
    }

    /** nextPlaymat: the chosen mat, or on Random any mat but the last one shown. */
    fun next(context: Context, random: () -> Double = Math::random): String = next(list(context).map { it.first }, prefs(context), random)
    fun next(ids: List<String>, p: SharedPreferences, random: () -> Double = Math::random): String {
        val choice = readChoice(ids, p)
        if (choice != ROTATE) { p.edit().putString(LAST, choice).apply(); return choice }
        val last = p.getString(LAST, "").orEmpty()
        val pool = ids.filter { it != last }
        val pick = pool[minOf(pool.size - 1, floor(random() * pool.size).toInt())]
        p.edit().putString(LAST, pick).apply(); return pick
    }

    // ------------------------------------------------------------ scene data (play-playmats.js 22-30), painting pixels 1672x941

    /** Floating hedron cut-outs on the two Zendikar mats: x, y, w, h. */
    val HEDRONS = mapOf(
        "wild-hedrons" to listOf(intArrayOf(113, 490, 68, 79), intArrayOf(186, 551, 132, 149), intArrayOf(1553, 118, 68, 88), intArrayOf(1588, 484, 88, 176), intArrayOf(615, -3, 74, 77), intArrayOf(448, 53, 48, 63)),
        "zendikar-expedition" to listOf(intArrayOf(1523, 389, 147, 237), intArrayOf(1535, 160, 59, 85), intArrayOf(96, 301, 52, 74), intArrayOf(284, 11, 46, 74)))

    data class Halo(val x: Int, val y: Int, val r: Int, val color: Long)
    /** Soft halos on moons, orbs and the sun: centre x, y, radius, colour. */
    val HALOS = mapOf(
        "drowned-archive" to listOf(Halo(990, 26, 70, 0xFFDFE8FF)), "moonlit-courtyard" to listOf(Halo(995, 30, 62, 0xFFE6ECFF)),
        "innistrad-graveyard" to listOf(Halo(965, 31, 66, 0xFFE6ECFF)), "artifact-vault" to listOf(Halo(990, 30, 64, 0xFFE8EEFF)),
        "star-observatory" to listOf(Halo(98, 48, 34, 0xFFD8DCFF), Halo(150, 872, 110, 0xFF7D9CFF), Halo(1468, 882, 92, 0xFF7D9CFF), Halo(332, 30, 52, 0xFF8FA8FF),
            Halo(1305, 22, 46, 0xFF8FA8FF), Halo(1555, 60, 60, 0xFFC9A8FF), Halo(835, 30, 60, 0xFFF3E2B8), Halo(835, 880, 60, 0xFFF3E2B8)),
        "white-sanctuary" to listOf(Halo(1040, 32, 120, 0xFFFFE6A8)), "ashen-forge" to listOf(Halo(965, 26, 90, 0xFFFF7A2A)))
    /** Sparkle crossfades cut from the art (moonlit waves, stars, lava rivers, city lights). */
    val SPARKLES = mapOf(
        "drowned-archive" to listOf(intArrayOf(600, 58, 625, 87)),
        "star-observatory" to listOf(intArrayOf(0, 0, 175, 360), intArrayOf(1495, 0, 177, 720), intArrayOf(600, 0, 480, 140), intArrayOf(600, 800, 480, 141)),
        "ashen-forge" to listOf(intArrayOf(690, 0, 540, 112)), "ravnica-guild-city" to listOf(intArrayOf(560, 0, 770, 95)))
    /** Slow cloud drift across distant skies. */
    val CLOUDS = mapOf(
        "drowned-archive" to listOf(intArrayOf(600, 40, 625, 70)), "moonlit-courtyard" to listOf(intArrayOf(500, 0, 760, 70)),
        "innistrad-graveyard" to listOf(intArrayOf(640, 60, 420, 90)), "artifact-vault" to listOf(intArrayOf(640, 40, 480, 90)),
        "white-sanctuary" to listOf(intArrayOf(640, 50, 520, 100)), "ashen-forge" to listOf(intArrayOf(700, 0, 520, 70)))

    /** play-forge-table.css .playmat-scene[data-playmat=…]: --mat-light, --mat-light-s, --mat-motes, --mat-rise (default 30 s). */
    data class Look(val light: String, val lightS: Float, val motes: String?, val rise: Float = 30f)
    val LOOKS = mapOf(
        "moonlit-courtyard" to Look("mat-candle", 3.4f, "dust", 48f), "white-sanctuary" to Look("mat-candle-soft", 4.6f, "dust", 48f),
        "ashen-forge" to Look("mat-lava", 6.5f, "embers", 22f), "drowned-archive" to Look("mat-candle", 3.4f, "mist", 40f),
        "black-ossuary" to Look("mat-candle", 3.4f, "dust", 48f), "star-observatory" to Look("mat-shimmer", 5.5f, "stardust", 60f),
        "forest-temple" to Look("mat-firefly", 4f, "fireflies", 36f), "keldon-battlefield" to Look("mat-lava", 6.5f, "embers", 22f),
        "wild-hedrons" to Look("mat-water", 2.6f, "mist", 40f), "artifact-vault" to Look("mat-shimmer", 5.5f, "dust", 48f),
        "innistrad-graveyard" to Look("mat-candle", 3.4f, "mist", 40f), "ravnica-guild-city" to Look("mat-candle", 3.4f, "dust", 48f),
        "zendikar-expedition" to Look("mat-water", 2.6f, "mist", 40f), "charcoal-table" to Look("mat-candle", 3.4f, null))

    /** The glow keyframes (opacity), play-forge-table.css @keyframes mat-*. */
    val LIGHTS = mapOf(
        "mat-candle" to listOf(0f to .78f, .09f to .6f, .13f to .9f, .31f to .72f, .47f to 1f, .52f to .8f, .70f to .92f, .84f to .66f, 1f to .78f),
        "mat-candle-soft" to listOf(0f to .45f, .40f to .62f, .62f to .5f, .80f to .6f, 1f to .45f),
        "mat-lava" to listOf(0f to .5f, .14f to .82f, .19f to .66f, .38f to 1f, .55f to .6f, .72f to .9f, .86f to .7f, 1f to .5f),
        "mat-shimmer" to listOf(0f to .55f, .5f to .95f, 1f to .55f),
        "mat-firefly" to listOf(0f to .35f, .30f to .9f, .45f to .5f, .70f to 1f, 1f to .35f),
        "mat-water" to listOf(0f to .4f, .5f to .85f, 1f to .4f))

    // The upright crop is the middle 529 px (x 571 to 1100), so its positions are derived (pct, offTall).
    fun offTall(x: Int, w: Int) = x + w < 571 || x > 1100

    /** Every bundled file a mat's scene draws, wide or upright. */
    fun files(id: String, tall: Boolean): List<String> = files(id, if (tall) "-tall" else "")
    /** [t] is the crop suffix: "" wide, "-tall" upright, "-fold" (Story mats only) for an open Fold or tablet held upright. */
    fun files(id: String, t: String): List<String> {
        return listOf("play/playmat-$id$t.webp", "play/playmat-$id-glow$t.webp", "play/playmat-$id-glow-b$t.webp") +
            HEDRONS[id].orEmpty().indices.map { "play/playmat-$id-hedron$it.webp" } +
            SPARKLES[id].orEmpty().indices.flatMap { i -> listOf("a", "b").map { "play/playmat-$id-tw$i$it.webp" } } +
            (if (CLOUDS[id] != null) listOf("play/playmat-fx-cloud.webp") else emptyList()) +
            listOfNotNull(LOOKS[id]?.motes?.let { "play/playmat-fx-$it.webp" })
    }
    suspend fun preload(context: Context, id: String, crop: String): Map<String, ImageBitmap> =
        files(id, crop).mapNotNull { f -> AssetImages.load(context, f)?.let { f to it } }.toMap()

    /** prefers-reduced-motion: Android's "Remove animations" (animator duration scale 0), which Chrome reports the same way. */
    fun reduced(context: Context): Boolean = try { Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f } catch (_: Exception) { false }

    /** Tests: draw the scene frozen at this many seconds (the web harness pauses every animation at the same time). */
    @Volatile var frozenAt: Float? = null
}

// ---------------------------------------------------------------- CSS timing

private val EaseInOut = CubicBezierEasing(.42f, 0f, .58f, 1f)

/** An infinite CSS animation's progress at time t: delay (negative starts part-way), alternate runs every other pass backwards. */
private fun cssProgress(t: Float, dur: Float, delay: Float = 0f, alternate: Boolean = false): Float {
    val local = max(0f, t - delay); val it = floor(local / dur); val p = local / dur - it
    return if (alternate && it.toInt() % 2 == 1) 1f - p else p
}
/** Keyframe value at progress p, the animation's ease-in-out applied to each keyframe segment (CSS animation-timing-function). */
private fun keyframes(p: Float, stops: List<Pair<Float, Float>>): Float {
    for (i in 0 until stops.size - 1) {
        val (a, va) = stops[i]; val (b, vb) = stops[i + 1]
        if (p <= b) return va + (vb - va) * EaseInOut.transform(((p - a) / (b - a)).coerceIn(0f, 1f))
    }
    return stops.last().second
}
private fun eased(p: Float, from: Float, to: Float) = from + (to - from) * EaseInOut.transform(p)

/** filter: brightness(.8) on the hedrons. */
private val Brightness80 = ColorFilter.colorMatrix(ColorMatrix(floatArrayOf(.8f, 0f, 0f, 0f, 0f, 0f, .8f, 0f, 0f, 0f, 0f, 0f, .8f, 0f, 0f, 0f, 0f, 0f, 1f, 0f)))
/** Ashen Forge's smoke: filter: brightness(.35) sepia(.6), brightness first. */
private val AshenSmoke = run {
    val k = 1f - .6f
    val sepia = ColorMatrix(floatArrayOf(
        .393f + .607f * k, .769f - .769f * k, .189f - .189f * k, 0f, 0f,
        .349f - .349f * k, .686f + .314f * k, .168f - .168f * k, 0f, 0f,
        .272f - .272f * k, .534f - .534f * k, .131f + .869f * k, 0f, 0f,
        0f, 0f, 0f, 1f, 0f))
    sepia.timesAssign(ColorMatrix(floatArrayOf(.35f, 0f, 0f, 0f, 0f, 0f, .35f, 0f, 0f, 0f, 0f, 0f, .35f, 0f, 0f, 0f, 0f, 0f, 1f, 0f)))
    ColorFilter.colorMatrix(sepia)
}

// ---------------------------------------------------------------- the scene

/** The table's mat for this match: nextPlaymat() once, as the site does when the table opens. */
@Composable
fun PlaymatScene(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val id = remember { Playmats.next(context) }
    PlaymatScene(id, modifier)
}

/**
 * mountPlaymatScene + the .playmat-scene CSS: a stage that covers the screen like background-size:cover (the upright crop
 * when the screen is portrait), then in order the art, cloud drift, hedrons, the shade, the two glow halves flickering out
 * of step, sparkles and halos; motes rise over the whole screen. One frame clock drives every layer, read only while drawing.
 */
@Composable
fun PlaymatScene(id: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    // The living table reads which mat is down (F10: the light, air and marks follow the painting).
    androidx.compose.runtime.SideEffect { TableFeel.mat = id }
    BoxWithConstraints(modifier.background(Color(0xFF0C0C0E)).clipToBounds()) {
        val tall = maxHeight >= maxWidth // @media (orientation:portrait)
        val story = remember(id) { StoryMats.all(context)[id] }
        // Story mats carry a third crop, about 1:1.25, for an open Fold or a tablet held upright (MOTION-SPEC "Crops and safe zones").
        val fold = story != null && (maxWidth / maxHeight) in .68f..1f
        val crop = if (fold) "-fold" else if (tall) "-tall" else ""
        val images by produceState(Playmats.files(id, crop).mapNotNull { f -> AssetImages.cached("$f@0")?.let { f to it } }.toMap(), id, crop) {
            value = Playmats.preload(context, id, crop)
        }
        val reduced = remember { Playmats.reduced(context) }
        val level = StoryMats.level(context, reduced)
        val frozen = Playmats.frozenAt ?: if (Motion.still) 0f else null
        var time by remember { mutableFloatStateOf(frozen ?: 0f) }
        if (frozen == null && !reduced) LaunchedEffect(Unit) {
            val start = withFrameNanos { it }
            while (true) withFrameNanos { time = (it - start) / 1e9f }
        }
        Canvas(Modifier.matchParentSize()) { drawScene(id, crop, images, if (reduced) null else (frozen ?: time), story, level) }
    }
}

/** t == null is the reduced-motion look: every animation off, the glow at .7, no motes. */
private fun DrawScope.drawScene(id: String, crop: String, img: Map<String, ImageBitmap>, t: Float?, story: StoryMats.Mat? = null, level: Int = 1) {
    // Story mats have no glow halves or mote tile of their own; their light is the story layer at the end.
    val look = Playmats.LOOKS[id] ?: story?.let { Playmats.Look("mat-shimmer", 5.5f, null) } ?: return
    val W = size.width; val H = size.height
    val tall = crop == "-tall"; val fold = crop == "-fold"
    // .pm-stage: landscape max(100vw,177.7vh) x max(100vh,56.28vw); portrait max(100vw,56.25vh) x max(100vh,177.8vw); centred.
    // The Fold crop (753 x 941, 1:1.25) covers the same way.
    val sw = if (fold) max(W, .8002f * H) else if (tall) max(W, .5625f * H) else max(W, 1.777f * H)
    val sh = if (fold) max(H, 1.2497f * W) else if (tall) max(H, 1.778f * W) else max(H, .5628f * W)
    val sx = (W - sw) / 2f; val sy = (H - sh) / 2f
    val sfx = crop
    val (cropX, cropW) = if (fold) 460 to 753 else if (tall) 571 to 529 else 0 to 1672
    // pct(): left/width from the painting's 1672 px (or the upright crop's 529 px from x 571), top/height from 941 px.
    fun box(x: Int, y: Int, w: Int, h: Int) = Rect(Offset(sx + (x - cropX) / cropW.toFloat() * sw, sy + y / 941f * sh), Size(w / cropW.toFloat() * sw, h / 941f * sh))
    fun shown(x: Int, w: Int) = x + w >= cropX && x <= cropX + cropW
    val stage = Rect(Offset(sx, sy), Size(sw, sh))

    // .pm-art
    img["play/playmat-$id$sfx.webp"]?.let { image(it, stage) }
    // .pm-cloud: an overflow-hidden box with an elliptical mask; inside, a strip twice as wide tiles the cloud and drifts left.
    Playmats.CLOUDS[id].orEmpty().forEach { (x, y, w, h) ->
        if (!shown(x, w)) return@forEach
        val cloud = img["play/playmat-fx-cloud.webp"] ?: return@forEach
        val b = box(x, y, w, h)
        val ashen = id == "ashen-forge"
        val p = t?.let { cssProgress(it, if (ashen) 55f else 80f) } ?: 0f
        drawIntoCanvas { c -> c.saveLayer(b, Paint()) }
        clipRect(b.left, b.top, b.right, b.bottom) {
            val shift = -b.width * p
            for (k in 0..1) image(cloud, Rect(Offset(b.left + shift + k * b.width, b.top), b.size), if (ashen) .8f else .7f, if (ashen) AshenSmoke else null)
            // mask-image: radial-gradient(ellipse closest-side, #000 45%, transparent)
            scale(1f, b.height / b.width, b.center) {
                drawRect(Brush.radialGradient(0f to Color.Black, .45f to Color.Black, 1f to Color.Black.copy(alpha = 0f), center = b.center, radius = b.width / 2f),
                    Offset(b.left, b.center.y - b.width * 4f), Size(b.width, b.width * 8f), blendMode = BlendMode.DstIn)
            }
        }
        drawIntoCanvas { c -> c.restore() }
    }
    // .pm-sprite: hedrons bob (mat-bob, alternate) at brightness .8.
    Playmats.HEDRONS[id].orEmpty().forEachIndexed { i, (x, y, w, h) ->
        if (!shown(x, w)) return@forEachIndexed
        val bmp = img["play/playmat-$id-hedron$i.webp"] ?: return@forEachIndexed
        val b = box(x, y, w, h)
        if (t == null) { image(bmp, b, 1f, Brightness80); return@forEachIndexed }
        val p = cssProgress(t, 6f + i * .8f, -(i * 1.9f), alternate = true)
        translate(0f, eased(p, -.025f, .025f) * b.height) { rotate(eased(p, -.5f, .5f), b.center) { image(bmp, b, 1f, Brightness80) } }
    }
    // .pm-shade
    drawRect(Color(0x38000000), stage.topLeft, stage.size)
    // .pm-glow and .pm-glow-b: the same light keyframes, b 1.37x slower and half a cycle ahead, so candles never blink together.
    val stops = Playmats.LIGHTS.getValue(look.light)
    listOf("glow" to (look.lightS to 0f), "glow-b" to (look.lightS * 1.37f to look.lightS * -.5f)).forEach { (name, timing) ->
        val bmp = img["play/playmat-$id-$name$sfx.webp"] ?: return@forEach
        if (t == null) { image(bmp, stage, .7f); return@forEach }
        val p = cssProgress(t, timing.first, timing.second)
        // mat-water also falls 10 px (translate3d 0,-5px to 0,5px over the whole cycle).
        val dy = if (look.light == "mat-water") eased(p, -5f, 5f) * density else 0f
        translate(0f, dy) { image(bmp, stage, keyframes(p, stops)) }
    }
    // .pm-sparkle: halves a and b crossfade (mat-sparkle .08 to 1, alternate, b 1.6 s ahead).
    Playmats.SPARKLES[id].orEmpty().forEachIndexed { i, (x, y, w, h) ->
        if (!shown(x, w)) return@forEachIndexed
        val b = box(x, y, w, h)
        listOf("a" to 0f, "b" to -1.6f).forEach { (half, delay) ->
            val bmp = img["play/playmat-$id-tw$i$half.webp"] ?: return@forEach
            image(bmp, b, t?.let { eased(cssProgress(it, 3.2f, delay, alternate = true), .08f, 1f) } ?: .55f)
        }
    }
    // .pm-halo: a round box, radial-gradient(circle, colour 0, transparent 68%) to its farthest corner, breathing (mat-halo).
    Playmats.HALOS[id].orEmpty().forEachIndexed { i, hl ->
        val x = hl.x - hl.r; val y = hl.y - hl.r; val d = hl.r * 2
        if (!shown(x, d)) return@forEachIndexed
        val b = box(x, y, d, d)
        val color = Color(hl.color)
        val (alpha, s) = t?.let { val p = cssProgress(it, 5f + i * .7f, -(i * 1.3f)); keyframes(p, listOf(0f to .28f, .5f to .6f, 1f to .28f)) to keyframes(p, listOf(0f to .94f, .5f to 1.07f, 1f to .94f)) } ?: (.35f to 1f)
        val far = sqrt(b.width * b.width + b.height * b.height) / 2f
        scale(s, s, b.center) {
            drawOval(Brush.radialGradient(0f to color, .68f to color.copy(alpha = 0f), center = b.center, radius = far), b.topLeft, b.size, alpha = alpha)
        }
    }
    // Story mats: rays, motes, glints, leaves and glow pulses from their light map, gated by the Effects setting.
    story?.let { drawStoryLight(it, MatStage(sx, sy, sw, sh, cropX, cropW), t, level, hinge = fold) }
    // .pm-motes: over the whole screen, the mote tile at full width repeated down 100% + 112.5vw, rising one tile per --mat-rise, swaying 3 px.
    if (t != null) look.motes?.let { m -> img["play/playmat-fx-$m.webp"]?.let { tile ->
        val th = W * tile.height / tile.width
        val rise = -W * 1.125f * cssProgress(t, look.rise)
        val sway = eased(cssProgress(t, 4.5f, alternate = true), -3f, 3f) * density
        var y = 0f
        while (y < H + W * 1.125f) { image(tile, Rect(Offset(sway, y + rise), Size(W, th)), .85f); y += th }
    } }
}

/** background: url() center/100% 100%: the whole bitmap stretched over dst, at sub-pixel positions (no 1 px jitter while bobbing). */
private fun DrawScope.image(bmp: ImageBitmap, dst: Rect, alpha: Float = 1f, filter: ColorFilter? = null) =
    withTransform({ translate(dst.left, dst.top); scale(dst.width / bmp.width, dst.height / bmp.height, Offset.Zero) }) {
        drawImage(bmp, Offset.Zero, alpha = alpha, colorFilter = filter)
    }
