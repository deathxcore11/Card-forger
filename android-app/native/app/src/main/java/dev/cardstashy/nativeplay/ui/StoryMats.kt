package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.ComposeShader
import android.graphics.LinearGradient
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.os.PowerManager
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin

/**
 * Story playmats (the Story playmat thread's MOTION-SPEC.md, brief section 4b): painted per act, app first. Each mat's light map
 * (mats/story-light.json, master pixels 1672x941) adds five layers on top of the painting, all on the scene's one frame clock:
 * rays, motes inside the rays, glints, leaves on the two side edges, and glow pulses. Nothing moves inside the middle
 * 60% x 70% play zone (a feathered cut-out), nothing sits on a Fold's hinge, and the Effects setting gates it all.
 */
object StoryMats {
    data class Rays(val color: Color, val alpha: Float, val to: Int, val slant: Int, val list: List<IntArray>)
    data class Leaves(val count: Int, val sway: Int, val edges: List<IntArray>)
    data class Glow(val x: Int, val y: Int, val r: Int, val color: Color, val alpha: Float, val flicker: Boolean = false)
    data class Smoke(val x: Int, val y: Int, val color: Color, val rise: Int)
    data class Wisp(val box: IntArray, val color: Color)
    data class Flyers(val box: IntArray, val count: Int, val color: Color)
    data class Mat(val id: String, val name: String, val act: Int, val slot: String, val rays: Rays?, val motes: Int,
                   val glints: List<IntArray>, val leaves: Leaves?, val glows: List<Glow>, val battles: List<Int> = emptyList(),
                   val smoke: List<Smoke> = emptyList(), val wisps: List<Wisp> = emptyList(), val flyers: Flyers? = null, val motesBox: IntArray? = null)

    @Volatile private var cache: Map<String, Mat>? = null

    fun all(context: Context): Map<String, Mat> = cache ?: runCatching {
        context.assets.open("play/story-light.json").bufferedReader().use { parse(JsonParser.parseReader(it).asJsonObject) }
    }.getOrDefault(emptyMap()).also { cache = it }

    // "wip" mats (a 3:2 draft awaiting its 16:9 re-export) and any light map not in 1672x941 master pixels do not ship yet.
    private fun ships(o: JsonObject) = !o.has("wip") && (o.getAsJsonArray("master")?.let { it.size() == 2 && it[0].asInt == 1672 && it[1].asInt == 941 } ?: true)
    fun parse(root: JsonObject): Map<String, Mat> = root.entrySet().filter { !it.key.startsWith("_") && it.value.isJsonObject && ships(it.value.asJsonObject) }.associate { (id, v) ->
        val o = v.asJsonObject
        fun ints(a: com.google.gson.JsonElement) = a.asJsonArray.map { it.asInt }.toIntArray()
        fun color(s: String) = Color(android.graphics.Color.parseColor(s))
        val rays = o.getAsJsonObject("rays")?.let { r ->
            Rays(color(r.get("color").asString), r.get("alpha").asFloat, r.get("to").asInt, r.get("slant").asInt, r.getAsJsonArray("list").map(::ints))
        }
        val leaves = o.getAsJsonObject("leaves")?.let { l -> Leaves(l.get("count").asInt, l.get("sway").asInt, l.getAsJsonArray("edges").map(::ints)) }
        val glows = o.getAsJsonArray("glows")?.map { g -> g.asJsonObject.let { Glow(it.get("x").asInt, it.get("y").asInt, it.get("r").asInt, color(it.get("color").asString), it.get("alpha").asFloat, it.get("flicker")?.asBoolean == true) } }.orEmpty()
        val smoke = o.getAsJsonArray("smoke")?.map { e -> e.asJsonObject.let { Smoke(it.get("x").asInt, it.get("y").asInt, color(it.get("color")?.asString ?: "#8C8C8C"), it.get("rise")?.asInt ?: 120) } }.orEmpty()
        val wisps = o.getAsJsonArray("wisps")?.map { e -> e.asJsonArray.let { a -> Wisp(IntArray(4) { a[it].asInt }, color(a.getOrNull(4)?.asString ?: "#9C7CC8")) } }.orEmpty()
        val flyers = o.getAsJsonObject("flyers")?.let { f -> Flyers(ints(f.get("box")), f.get("count")?.asInt ?: 3, color(f.get("color")?.asString ?: "#1E1A18")) }
        id to Mat(id, o.get("name")?.asString ?: id, o.get("act")?.asInt ?: 0, o.get("slot")?.asString ?: "normal", rays,
            o.get("motes")?.asInt ?: 0, o.getAsJsonArray("glints")?.map(::ints).orEmpty(), leaves?.takeIf { it.count > 0 && it.edges.isNotEmpty() }, glows,
            o.getAsJsonArray("battles")?.map { it.asInt }.orEmpty(), smoke, wisps, flyers, o.get("motesBox")?.let(::ints))
    }

    /** The mat for a Story battle: the act's mat for this battle's slot (a boss battle takes the boss mat), else its normal mat; null when the act has none yet. */
    fun forBattle(context: Context, act: Int, slot: Int?, kind: String?): String? {
        val mats = all(context).values.filter { it.act == act }
        slot?.let { n -> mats.firstOrNull { n in it.battles }?.let { return it.id } }
        val slot = when (kind?.lowercase()) { "boss", "final" -> "boss"; "secret", "secret boss" -> "secret"; "event", "lore" -> "event"; else -> "normal" }
        return (mats.firstOrNull { it.slot == slot } ?: mats.firstOrNull { it.slot == "normal" } ?: mats.firstOrNull())?.id
    }

    /** The Effects setting as a level: 2 Cinematic, 1 Balanced, 0 Minimal. Reduce motion and battery saver are Minimal. */
    private fun com.google.gson.JsonArray.getOrNull(i: Int) = if (i < size()) get(i) else null

    fun level(context: Context, reduced: Boolean): Int {
        val saver = runCatching { (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isPowerSaveMode }.getOrDefault(false)
        if (reduced || saver) return 0
        return when (AppSettings.effects) { "cinematic" -> 2; "minimal" -> 0; else -> 1 }
    }
}

/** The stage the painting is drawn on, in screen pixels, and where a master-pixel point lands on it. */
class MatStage(val left: Float, val top: Float, val width: Float, val height: Float, private val cropX: Int, private val cropW: Int) {
    val k get() = width / cropW
    fun x(mx: Float) = left + (mx - cropX) / cropW * width
    fun y(my: Float) = top + my / 941f * height
    fun shows(mx: Float, pad: Float = 0f) = mx + pad >= cropX && mx - pad <= cropX + cropW
}

private fun hash(i: Int, salt: Int): Float { var h = i * 374761393 + salt * 668265263; h = (h xor (h ushr 13)) * 1274126177; return ((h xor (h ushr 16)) and 0xffff) / 65535f }
private fun wave(t: Float, period: Float, phase: Float) = .5f + .5f * sin(2f * PI.toFloat() * (t / period + phase))

/**
 * Draws a Story mat's motion layers over the painted stage. [t] null = still; [level] from [StoryMats.level]; [hinge] true on an
 * open Fold, where nothing may sit on the vertical centre line.
 */
internal fun DrawScope.drawStoryLight(mat: StoryMats.Mat, st: MatStage, t: Float?, level: Int, hinge: Boolean) {
    val W = size.width; val H = size.height
    val live = t != null && level > 0
    val time = t ?: 0f
    val hingeGap = W * .04f
    fun offHinge(x: Float) = !hinge || kotlin.math.abs(x - W / 2f) > hingeGap

    drawIntoCanvas { it.saveLayer(Rect(Offset.Zero, size), Paint()) }

    // 5. GLOW PULSE: a radial glow on a painted object, 4-6 s; Minimal keeps it still at its middle.
    mat.glows.forEachIndexed { i, g ->
        if (!st.shows(g.x.toFloat(), g.r.toFloat())) return@forEachIndexed
        val c = Offset(st.x(g.x.toFloat()), st.y(g.y.toFloat())); val r = g.r * st.k * 1.6f
        val a = g.alpha * (if (!live) .7f else if (g.flicker) flame(time + i * 1.7f) else .45f + .55f * wave(time, 5f + i * .7f, i * .3f))
        drawCircle(Brush.radialGradient(0f to g.color.copy(alpha = a), .55f to g.color.copy(alpha = a * .5f), 1f to Color.Transparent, center = c, radius = r), r, c, blendMode = BlendMode.Screen)
    }

    if (level > 0) mat.rays?.let { rays ->
        // 1. RAYS: soft slanted beams from the top edge, fading to nothing by their end; each breathes 35-100% out of step.
        rays.list.forEachIndexed { i, (ox, w) ->
            if (!st.shows(ox + rays.slant / 2f, w + rays.slant / 2f)) return@forEachIndexed
            val breathe = if (live) .35f + .65f * wave(time, 6.5f + i * 2.3f, hash(i, 7)) else .7f
            val a = rays.alpha * breathe
            val half = w / 2f * st.k; val len = rays.to / 941f * st.height
            val across = LinearGradient(-half, 0f, half, 0f, intArrayOf(0, rays.color.copy(alpha = a).toArgb(), rays.color.copy(alpha = a).toArgb(), 0), floatArrayOf(0f, .32f, .68f, 1f), Shader.TileMode.CLAMP)
            val down = LinearGradient(0f, 0f, 0f, len, intArrayOf(android.graphics.Color.WHITE, 0xB3FFFFFF.toInt(), 0), floatArrayOf(0f, .5f, 1f), Shader.TileMode.CLAMP)
            val paint = android.graphics.Paint().apply { shader = ComposeShader(across, down, PorterDuff.Mode.DST_IN); xfermode = PorterDuffXfermode(PorterDuff.Mode.ADD) }
            drawIntoCanvas { cv ->
                val n = cv.nativeCanvas; n.save()
                n.translate(st.x(ox.toFloat()), st.y(0f)); n.skew(rays.slant * st.k / len, 0f)
                n.drawRect(-half * 1.6f, 0f, half * 1.6f, len, paint); n.restore()
            }
        }
        // 2. MOTES: tiny dots drifting down-right inside a ray only (Cinematic), fading in and out.
        if (level >= 2 && live && mat.motesBox == null && rays.list.isNotEmpty()) for (m in 0 until mat.motes) {
            val (ox, w) = rays.list[m % rays.list.size]
            val p = (hash(m, 3) + time / (14f + hash(m, 5) * 8f)) % 1f
            val v = p * rays.to; val u = (hash(m, 11) - .5f) * w * .7f + 6f * sin(time * .6f + m)
            val mx = ox + u + rays.slant * v / rays.to
            if (!st.shows(mx)) continue
            val a = sin(PI.toFloat() * p).pow(1.5f) * .85f
            drawCircle(Color(0xFFFFF0C8).copy(alpha = a), max(1.5f * st.k, .9f * density), Offset(st.x(mx), st.y(v)), blendMode = BlendMode.Screen)
        }
    }

    // MOTES in a box (sand, ash): same dots, drifting down-right across the box instead of inside a ray (Cinematic).
    if (level >= 2 && live) mat.motesBox?.let { (bx, by, bw, bh) ->
        for (m in 0 until mat.motes) {
            val p = (hash(m, 3) + time / (12f + hash(m, 5) * 8f)) % 1f
            val mx = bx + (hash(m, 11) + p * .25f) % 1f * bw; val my = by + p * bh
            if (!st.shows(mx)) continue
            drawCircle(Color(0xFFFFE6B4).copy(alpha = sin(PI.toFloat() * p) * .7f), max(1.5f * st.k, .9f * density), Offset(st.x(mx), st.y(my)), blendMode = BlendMode.Screen)
        }
    }

    // SMOKE: soft puffs rising from a point, widening and fading (chimneys, braziers). Balanced and up.
    if (level > 0) mat.smoke.forEachIndexed { i, sm ->
        if (!st.shows(sm.x.toFloat(), 40f)) return@forEachIndexed
        for (j in 0 until 4) {
            val p = if (live) (j / 4f + time / (7f + hash(i, 97) * 3f)) % 1f else j / 4f
            val mx = sm.x + p * 30f * sin(time * .4f + i); val my = sm.y - p * sm.rise
            val c = Offset(st.x(mx), st.y(my)); val r = (10f + p * 34f) * st.k
            val a = .32f * sin(PI.toFloat() * p)
            drawCircle(Brush.radialGradient(0f to sm.color.copy(alpha = a), 1f to Color.Transparent, center = c, radius = r), r, c)
        }
    }
    // WISPS: smoke strips drifting slowly right inside their box.
    if (level > 0) mat.wisps.forEachIndexed { i, wp ->
        val (bx, by, bw, bh) = wp.box
        for (j in 0 until 3) {
            val p = if (live) (hash(j, 101 + i) + time / 40f) % 1f else hash(j, 101 + i)
            val mx = bx + p * bw; if (!st.shows(mx, 60f)) continue
            val my = by + bh * (.3f + .4f * hash(j, 103 + i)) + 6f * sin(time * .3f + j)
            val c = Offset(st.x(mx), st.y(my)); val rw = 70f * st.k; val rh = 14f * st.k
            val a = .28f * sin(PI.toFloat() * p)
            withTransform({ scale(1f, rh / rw, c) }) { drawCircle(Brush.radialGradient(0f to wp.color.copy(alpha = a), 1f to Color.Transparent, center = c, radius = rw), rw, c, blendMode = BlendMode.Screen) }
        }
    }
    // FLYERS: tiny silhouettes crossing the sky box, wings flapping on two frames, drifting +-14 px (Cinematic).
    if (level >= 2 && live) mat.flyers?.let { fl ->
        val (bx, by, bw, bh) = fl.box
        for (i in 0 until fl.count) {
            val p = (hash(i, 107) + time / (26f + hash(i, 109) * 10f)) % 1f
            val mx = bx - 40f + p * (bw + 80f); if (!st.shows(mx, 20f)) continue
            val my = by + bh * hash(i, 113) + 14f * sin(time * .9f + i * 2f)
            val c = Offset(st.x(mx), st.y(my)); val s = 9f * st.k
            val up = ((time * 4f + i).toInt() and 1) == 0
            val wing = if (up) -s * .7f else s * .25f
            val body = Path().apply {
                moveTo(c.x - s, c.y + wing); lineTo(c.x - s * .2f, c.y); lineTo(c.x + s * .9f, c.y - s * .1f); lineTo(c.x - s * .2f, c.y + s * .2f); close()
                moveTo(c.x + s * .1f, c.y); lineTo(c.x - s * .4f, c.y + wing * 1.1f); lineTo(c.x + s * .5f, c.y); close()
            }
            drawPath(body, fl.color.copy(alpha = .75f * sin(PI.toFloat() * p).coerceAtLeast(0f).pow(.3f)))
        }
    }

    // 3. GLINTS: twinkles in a box over water, metal or stars, sin^6 so each one flashes briefly.
    if (level > 0) mat.glints.forEachIndexed { b, g ->
        val (gx, gy, gw, gh) = g; val n = g.getOrElse(4) { 22 }
        for (i in 0 until n) {
            val mx = gx + hash(i, 17 + b) * gw; val my = gy + hash(i, 29 + b) * gh
            if (!st.shows(mx)) continue
            val x = st.x(mx); if (!offHinge(x)) continue
            val env = if (live) sin(2f * PI.toFloat() * (time / (2.4f + hash(i, 41) * 1.8f) + hash(i, 43))).coerceAtLeast(0f).pow(6) else .25f * hash(i, 47)
            if (env < .01f) continue
            val c = Offset(x, st.y(my)); val r = (1f + hash(i, 53)) * .6f * density
            drawCircle(Brush.radialGradient(0f to Color.White.copy(alpha = .55f * env), 1f to Color.Transparent, center = c, radius = r * 4f), r * 4f, c, blendMode = BlendMode.Screen)
            drawCircle(Color(0xFFFFF6DC).copy(alpha = env), r, c, blendMode = BlendMode.Screen)
        }
    }

    // 4. LEAVES: 4-6 falling on the outer side edges only (half on Balanced), swaying +-14 px and turning slowly; seamless loop.
    if (live) mat.leaves?.let { lv ->
        val count = if (level >= 2) lv.count else ceil(lv.count / 2f).toInt()
        for (i in 0 until count) {
            val edge = lv.edges[i % lv.edges.size]
            val base = edge[0] + hash(i, 61) * (edge[1] - edge[0])
            val dur = 16f + hash(i, 67) * 8f
            val p = (hash(i, 71) + time / dur) % 1f
            val mx = base + lv.sway * sin(2f * PI.toFloat() * (time / (3.2f + hash(i, 73)) + hash(i, 79)))
            if (!st.shows(mx, 20f)) continue
            val c = Offset(st.x(mx), st.y(-40f + p * 1021f)); if (!offHinge(c.x)) continue
            val turn = 35f * sin(2f * PI.toFloat() * time / (5f + hash(i, 83) * 3f)) + hash(i, 89) * 360f
            val len = 26f * st.k; val wid = 11f * st.k
            val tint = LEAF_TINTS[i % LEAF_TINTS.size]
            rotate(turn, c) {
                val leaf = Path().apply {
                    moveTo(c.x - len / 2f, c.y); quadraticTo(c.x, c.y - wid, c.x + len / 2f, c.y); quadraticTo(c.x, c.y + wid, c.x - len / 2f, c.y); close()
                }
                drawPath(leaf, tint.copy(alpha = .85f))
                drawLine(tint.copy(alpha = .9f, red = tint.red * .6f, green = tint.green * .6f, blue = tint.blue * .6f), Offset(c.x - len / 2f, c.y), Offset(c.x + len / 2f, c.y), max(.6f, .9f * st.k))
            }
        }
    }

    // The play zone: the middle 60% x 70% of the screen stays still. A feathered cut so beams fade into its edge, never past it.
    val feather = 0.06f * max(W, H)
    drawIntoCanvas { cv ->
        val p = android.graphics.Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_OUT); maskFilter = BlurMaskFilter(feather, BlurMaskFilter.Blur.NORMAL) }
        cv.nativeCanvas.drawRect(W * .2f + feather, H * .15f + feather, W * .8f - feather, H * .85f - feather, p)
        cv.restore()
    }
}

/** Flame flicker: the site's mat-candle keyframes on a 3.4 s loop with a faster shiver on top. */
private val CANDLE = listOf(0f to .78f, .09f to .6f, .13f to .9f, .31f to .72f, .47f to 1f, .52f to .8f, .70f to .92f, .84f to .66f, 1f to .78f)
private fun flame(t: Float): Float {
    val p = (t / 3.4f) % 1f
    val i = CANDLE.indexOfFirst { it.first >= p }.coerceAtLeast(1)
    val (a, va) = CANDLE[i - 1]; val (b, vb) = CANDLE[i]
    return (va + (vb - va) * ((p - a) / (b - a))) * (.92f + .08f * sin(t * 23f))
}

/** Autumn leaf tints sampled from the glade painting's fallen leaves. */
private val LEAF_TINTS = listOf(Color(0xFFC07A32), Color(0xFF9C8A3A), Color(0xFFAD5A2C), Color(0xFFCF9A48))
