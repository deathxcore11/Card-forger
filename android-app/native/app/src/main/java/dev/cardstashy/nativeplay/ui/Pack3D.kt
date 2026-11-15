package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas as NativeCanvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/**
 * The 3D booster pack (Randall 15 Nov: "new animations and models … real art"): Randall's Blender pack, lightened for phones
 * (assets/packs/pack3d-mesh.bin, made by design/pack-3d/export_mesh.py), wearing the set's real wrapper photo
 * (assets/packs/real/<set>.webp) on its front and a darkened mirror of it on its back. The body and the strip above the tear line
 * are separate, so the strip can rip off along the line the 2D pack's seam glows on (8.5 % from the top).
 *
 * Drawn with Canvas.drawVertices, not OpenGL: it sits in Compose like any other drawing (the glow, the seam and the flash still
 * layer over it), and screenshot tests can see it. About 4,000 triangles, lit per vertex, sorted back to front each frame.
 */
object Pack3D {
    class Group(val data: FloatArray, val index: ShortArray) { val verts get() = data.size / 8 }
    class Mesh(val h: Float, val cut: Float, val x0: Float, val x1: Float, val y0: Float, val y1: Float, val groups: List<Group>) {
        val width get() = x1 - x0
        val height get() = y1 - y0
        /** The pack's own width : height, so a wrapper photo can stretch the model to its shape. */
        val aspect get() = width / height
    }

    @Volatile private var mesh: Mesh? = null
    fun mesh(context: Context): Mesh? = mesh ?: synchronized(this) { mesh ?: runCatching { context.assets.open("play/pack3d/mesh.bin").use { parse(it.readBytes()) } }.getOrNull()?.also { mesh = it } }

    /** pack3d-mesh.bin: "PK3D", version 1, six floats (height, tear line, x and y bounds), then four groups (body front, body back,
     *  strip front, strip back), each a vertex count, an index count, x y z nx ny nz u v per vertex and 16-bit indices. */
    fun parse(bytes: ByteArray): Mesh {
        val b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        require(bytes.size > 40 && String(bytes, 0, 4) == "PK3D") { "not a pack mesh" }
        b.position(4); require(b.int == 1) { "unknown pack mesh version" }
        val h = b.float; val cut = b.float; val x0 = b.float; val x1 = b.float; val y0 = b.float; val y1 = b.float
        val groups = (0 until 4).map {
            val nv = b.int; val ni = b.int
            val d = FloatArray(nv * 8); b.asFloatBuffer().get(d); b.position(b.position() + nv * 32)
            val ix = ShortArray(ni); b.asShortBuffer().get(ix); b.position(b.position() + ni * 2)
            require(ix.all { (it.toInt() and 0xFFFF) < nv }) { "pack mesh index out of range" }
            Group(d, ix)
        }
        return Mesh(h, cut, x0, x1, y0, y1, groups)
    }

    /** The set's real wrapper photo, when the app carries one (every Magic set in the opener). */
    fun artPath(code: String) = "play/pack3d/${code.lowercase()}.webp"
    fun hasArt(context: Context, code: String): Boolean = runCatching { context.assets.open(artPath(code)).close(); true }.getOrDefault(false)
}

/** The wrapper's two faces and their paints, made once per set. */
class PackSkin(val front: Bitmap, val back: Bitmap) {
    val aspect = front.width.toFloat() / front.height
    internal val frontPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { shader = BitmapShader(front, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }
    internal val backPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { shader = BitmapShader(back, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }

    companion object {
        private val cache = android.util.LruCache<String, PackSkin>(4)
        fun cached(code: String): PackSkin? = cache.get(code.lowercase())

        /** The back: the front mirrored, blurred and darkened, its foil seals kept sharp (as the preview's backTexture). */
        fun make(code: String, photo: Bitmap): PackSkin {
            val src = if (photo.config == Bitmap.Config.HARDWARE) photo.copy(Bitmap.Config.ARGB_8888, false) else photo
            val w = src.width; val h = src.height
            val back = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); val c = NativeCanvas(back)
            val mirror = android.graphics.Matrix().apply { setScale(-1f, 1f); postTranslate(w.toFloat(), 0f) }
            // A blur by scaling down and up: cheap and the same on every phone.
            val small = Bitmap.createScaledBitmap(src, max(1, w / 18), max(1, h / 18), true)
            val dim = Paint(Paint.FILTER_BITMAP_FLAG).apply { colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(.7f); postConcat(ColorMatrix().apply { setScale(.42f, .42f, .42f, 1f) }) }) }
            c.save(); c.concat(mirror); c.drawBitmap(small, null, android.graphics.Rect(0, 0, w, h), dim); c.restore()
            val band = (h * SEAL).toInt()
            c.save(); c.concat(mirror)
            c.drawBitmap(src, android.graphics.Rect(0, 0, w, band), android.graphics.Rect(0, 0, w, band), null)
            c.drawBitmap(src, android.graphics.Rect(0, h - band, w, h), android.graphics.Rect(0, h - band, w, h), null)
            c.restore()
            return PackSkin(src, back).also { cache.put(code.lowercase(), it) }
        }
        const val SEAL = .085f
    }
}

/** The set's skin for the 3D pack, or null while it loads or when the set has no real wrapper photo (the 2D pack shows then). */
@Composable
fun rememberPackSkin(code: String): PackSkin? {
    val ctx = LocalContext.current
    if (HomeTest.noPictures) return null
    return produceState(PackSkin.cached(code), code) {
        if (value != null) return@produceState
        if (Pack3D.mesh(ctx) == null) return@produceState
        val photo = AssetImages.load(ctx, Pack3D.artPath(code), maxWidth = 720) ?: return@produceState
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { PackSkin.make(code, photo.asAndroidBitmap()) }
    }.value
}

/**
 * Where the pack is in a frame. [yaw] and [pitch] turn it (radians); [tear] 0..1 rips the strip off from the [side] it is torn
 * from (−1 left, 1 right), the strip fading as it goes; [stripGone] hides it (the torn pack the cards leave from); [alpha] fades
 * the whole pack; [glow] lights its open mouth from inside.
 */
class PackPose(val yaw: Float = 0f, val pitch: Float = 0f, val roll: Float = 0f, val tear: Float = 0f, val side: Float = 1f,
               val stripGone: Boolean = false, val alpha: Float = 1f)

/** The 3D pack filling [modifier]'s box (the model is fitted to the box's height and stretched to the photo's shape). */
@Composable
fun Pack3DView(skin: PackSkin, modifier: Modifier, pose: () -> PackPose) {
    val ctx = LocalContext.current
    val mesh = remember { Pack3D.mesh(ctx) } ?: return
    val r = remember(mesh) { PackRenderer(mesh) }
    Canvas(modifier) { drawIntoCanvas { r.draw(it.nativeCanvas, skin, size.width, size.height, pose()) } }
}

/** Projects, lights and sorts the mesh each frame into the arrays Canvas.drawVertices takes. */
class PackRenderer(private val m: Pack3D.Mesh) {
    private val maxV = m.groups.maxOf { it.verts }
    private val maxT = m.groups.maxOf { it.index.size / 3 }
    // Per-group scratch: screen x y, texture u v (in the bitmap's pixels), depth, colour, highlight.
    private val sx = FloatArray(maxV); private val sy = FloatArray(maxV); private val sz = FloatArray(maxV)
    private val nz = FloatArray(maxV); private val lit = IntArray(maxV); private val spec = IntArray(maxV)
    private val pts = FloatArray(maxV * 2); private val tex = FloatArray(maxV * 2)
    private val order = IntArray(maxT); private val depth = FloatArray(maxT); private val facing = BooleanArray(maxT)
    private val idx = ShortArray(maxT * 3)
    private val inside = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shine = Paint(Paint.ANTI_ALIAS_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.ADD) }

    fun draw(c: NativeCanvas, skin: PackSkin, w: Float, h: Float, p: PackPose) {
        if (w <= 0f || h <= 0f || p.alpha <= 0f) return
        // The camera: 30° field of view, far enough that the pack's height fills the box's height at its middle.
        val dist = m.height / (2f * tan(Math.toRadians(15.0)).toFloat()) * 1.0f
        val focal = h * dist / m.height
        val stretch = skin.aspect / m.aspect          // the photo's shape: a wider wrapper makes a wider pack
        val cy = cos(p.yaw); val syw = sin(p.yaw); val cp = cos(p.pitch); val sp = sin(p.pitch); val cr = cos(p.roll); val sr = sin(p.roll)
        val g = m.groups
        // Body first (inside, then the face turned further away, then the nearer face), then the strip over it.
        drawPart(c, skin, g[0], g[1], w, h, dist, focal, stretch, cy, syw, cp, sp, cr, sr, p, strip = false)
        if (!p.stripGone && p.tear < 1f) drawPart(c, skin, g[2], g[3], w, h, dist, focal, stretch, cy, syw, cp, sp, cr, sr, p, strip = true)
    }

    private fun drawPart(c: NativeCanvas, skin: PackSkin, front: Pack3D.Group, back: Pack3D.Group, w: Float, h: Float, dist: Float, focal: Float, stretch: Float,
                         cy: Float, syw: Float, cp: Float, sp: Float, cr: Float, sr: Float, p: PackPose, strip: Boolean) {
        // The strip holds while it is pulled back, then fades as it flies off.
        val a = (p.alpha * (if (!strip || p.tear < .45f) 1f else 1f - (p.tear - .45f) / .55f)).coerceIn(0f, 1f)
        if (a <= 0f) return
        val ai = (a * 255).toInt()
        skin.frontPaint.alpha = ai; skin.backPaint.alpha = ai; inside.alpha = ai; shine.alpha = ai
        val faces = arrayOf(front, back); val bmps = arrayOf(skin.front, skin.back); val paints = arrayOf(skin.frontPaint, skin.backPaint)
        // Which face looks at the camera: the front's outward normal (+z) after the turn.
        val frontToCamera = cy * cp
        val far = if (frontToCamera >= 0f) 1 else 0
        // The inside of both faces first (seen through the torn top), then the face turned away, then the face turned toward us.
        for (f in 0..1) { project(faces[f], bmps[f], w, h, dist, focal, stretch, cy, syw, cp, sp, cr, sr, p, strip); drawSorted(c, null, wantFacing = false) }
        for (f in intArrayOf(far, 1 - far)) { project(faces[f], bmps[f], w, h, dist, focal, stretch, cy, syw, cp, sp, cr, sr, p, strip); drawSorted(c, paints[f], wantFacing = true) }
    }


    /** Moves one face into place, projects it and lights its vertices; fills the per-triangle depth and facing. */
    private fun project(gr: Pack3D.Group, bmp: Bitmap, w: Float, h: Float, dist: Float, focal: Float, stretch: Float,
                        cy: Float, syw: Float, cp: Float, sp: Float, cr: Float, sr: Float, p: PackPose, strip: Boolean) {
        val d = gr.data; val n = gr.verts
        val bw = bmp.width.toFloat(); val bh = bmp.height.toFloat()
        // The strip hinges at the torn-from corner on the tear line, swings up and out, and tips back (the preview's applyTear).
        val t = p.tear
        val hz = p.side * (t.coerceAtMost(.45f) / .45f * .55f + max(0f, t - .45f) / .55f * 2.05f)
        val hx = -(t.coerceAtMost(.45f) / .45f * .25f + max(0f, t - .45f) / .55f * .65f)
        val chz = cos(hz); val shz = sin(hz); val chx = cos(hx); val shx = sin(hx)
        val px0 = p.side * m.width / 2f * stretch
        val lift = t * .12f + max(0f, t - .45f) * .25f
        // A key light up and to the right, and a soft window high behind the camera for the moving sheen.
        val lx = .35f; val ly = .55f; val lz = .76f
        for (i in 0 until n) {
            val o = i * 8
            var x = d[o] * stretch; var y = d[o + 1]; var z = d[o + 2]
            var nx = d[o + 3] / stretch; var ny = d[o + 4]; var nzz = d[o + 5]
            val nl = sqrt(nx * nx + ny * ny + nzz * nzz).coerceAtLeast(1e-6f); nx /= nl; ny /= nl; nzz /= nl
            if (strip && t > 0f) {
                // around the hinge: z-roll then x-tip
                var rx = x - px0; var ry = y - m.cut
                val x2 = rx * chz - ry * shz; val y2 = rx * shz + ry * chz
                val y3 = y2 * chx - z * shx; val z3 = y2 * shx + z * chx
                x = x2 + px0; y = y3 + m.cut + lift; z = z3
                val nx2 = nx * chz - ny * shz; val ny2 = nx * shz + ny * chz
                val ny3 = ny2 * chx - nzz * shx; val nz3 = ny2 * shx + nzz * chx
                nx = nx2; ny = ny3; nzz = nz3
            }
            // roll (z), yaw (y), pitch (x)
            val xr = x * cr - y * sr; val yr = x * sr + y * cr; x = xr; y = yr
            val nxr = nx * cr - ny * sr; val nyr = nx * sr + ny * cr; nx = nxr; ny = nyr
            val x1 = x * cy + z * syw; val z1 = -x * syw + z * cy; x = x1; z = z1
            val nx1 = nx * cy + nzz * syw; val nz1 = -nx * syw + nzz * cy; nx = nx1; nzz = nz1
            val y1 = y * cp - z * sp; val z2 = y * sp + z * cp; y = y1; z = z2
            val ny1 = ny * cp - nzz * sp; val nz2 = ny * sp + nzz * cp; ny = ny1; nzz = nz2
            val k = focal / (dist - z)
            sx[i] = w / 2f + x * k; sy[i] = h / 2f - y * k; sz[i] = z; nz[i] = nzz
            pts[i * 2] = sx[i]; pts[i * 2 + 1] = sy[i]
            tex[i * 2] = d[o + 6] * bw; tex[i * 2 + 1] = (1f - d[o + 7]) * bh
            // Light: soft ambient plus the key; foil seals shine harder than the printed middle.
            val v = d[o + 7]; val seal = v < PackSkin.SEAL || v > 1f - PackSkin.SEAL
            val diff = (.62f + .48f * max(0f, nx * lx + ny * ly + nzz * lz)).coerceAtMost(1f)
            val g = (diff * 255).toInt().coerceIn(0, 255)
            lit[i] = (0xFF shl 24) or (g shl 16) or (g shl 8) or g
            // Half vector toward a viewer straight ahead.
            val hx2 = lx; val hy2 = ly; val hz2 = lz + 1f; val hl = sqrt(hx2 * hx2 + hy2 * hy2 + hz2 * hz2)
            val ndh = max(0f, (nx * hx2 + ny * hy2 + nzz * hz2) / hl)
            // The window: a band of light caught as the pack turns (reflection's upward part).
            val ry2 = 2f * nzz * ny
            val band = (1f - abs(ry2 - .35f) / .22f).coerceIn(0f, 1f)
            val s = ((if (seal) .55f else .22f) * ndh.pow(if (seal) 14f else 30f) + (if (seal) .35f else .12f) * band * band).coerceIn(0f, 1f)
            val sv = (s * 255).toInt()
            spec[i] = (0xFF shl 24) or (sv shl 16) or (sv shl 8) or sv
        }
        // per triangle
        val ix = gr.index; val tn = ix.size / 3
        for (tI in 0 until tn) {
            val a = ix[tI * 3].toInt() and 0xFFFF; val b = ix[tI * 3 + 1].toInt() and 0xFFFF; val cc = ix[tI * 3 + 2].toInt() and 0xFFFF
            // Screen-space winding: y points down on screen, so a face turned to the camera winds the other way.
            val area = (sx[b] - sx[a]) * (sy[cc] - sy[a]) - (sy[b] - sy[a]) * (sx[cc] - sx[a])
            facing[tI] = area < 0f
            depth[tI] = sz[a] + sz[b] + sz[cc]
        }
        curCount = tn; curIndex = ix; curVerts = n
    }

    private var curCount = 0; private var curIndex: ShortArray = ShortArray(0); private var curVerts = 0

    private val keys = LongArray(maxT)

    /** Sorts the projected face's triangles far to near and draws the ones facing (or turned away from) the camera. */
    private fun drawSorted(c: NativeCanvas, paint: Paint?, wantFacing: Boolean) {
        var k = 0
        // Depth (smaller z is farther) in the high bits, the triangle in the low 20: one primitive sort, no allocation.
        for (t in 0 until curCount) if (facing[t] == wantFacing) keys[k++] = (((depth[t] + 50f) * 65536f).toLong() shl 20) or t.toLong()
        if (k == 0) return
        java.util.Arrays.sort(keys, 0, k)
        var q = 0
        for (j in 0 until k) { val t = (keys[j] and 0xFFFFF).toInt(); idx[q++] = curIndex[t * 3]; idx[q++] = curIndex[t * 3 + 1]; idx[q++] = curIndex[t * 3 + 2] }
        val vc = curVerts * 2
        if (paint == null) {
            // The inside of the pack: dull foil, darker than the outside.
            for (i in 0 until curVerts) { val g = ((lit[i] and 0xFF) * .42f).toInt(); lit[i] = (0xFF shl 24) or (g shl 16) or (g shl 8) or (g + 6).coerceAtMost(255) }
            c.drawVertices(NativeCanvas.VertexMode.TRIANGLES, vc, pts, 0, null, 0, lit, 0, idx, 0, q, inside)
            return
        }
        c.drawVertices(NativeCanvas.VertexMode.TRIANGLES, vc, pts, 0, tex, 0, lit, 0, idx, 0, q, paint)
        c.drawVertices(NativeCanvas.VertexMode.TRIANGLES, vc, pts, 0, null, 0, spec, 0, idx, 0, q, shine)
    }
}
