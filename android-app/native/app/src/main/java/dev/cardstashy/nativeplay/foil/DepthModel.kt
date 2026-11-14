package dev.cardstashy.nativeplay.foil

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Shader
import android.util.Log
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.nio.FloatBuffer
import java.security.MessageDigest
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Depth Anything V2 small (Apache-2.0, MODEL-LICENSE.txt), 8-bit, run on the phone (Randall 4 Nov: "on the phone").
 * Loaded on first use, let go after a minute idle. Phones where the runtime cannot load (32-bit Android, x86) simply get no
 * figure layer: the card keeps the window-only depth, which cannot fail.
 */
object DepthModel {
    const val SIZE = 518
    private const val TAG = "DepthModel"
    private val lock = Mutex()
    private var session: OrtSession? = null
    private var release: Job? = null
    @Volatile private var broken = false
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Relative depth of [crop] at [SIZE] x [SIZE], 0..1, nearer = higher; null when the model cannot run here. */
    suspend fun run(context: Context, crop: Bitmap): FloatArray? = lock.withLock {
        if (broken) return null
        release?.cancel()
        try {
            val env = OrtEnvironment.getEnvironment()
            // The model is not in the app (gap audit G2): it comes from the site on first use. Until it is on the phone the card
            // keeps the window-only depth, and nothing waits for it.
            val model = DepthModelFile.ready(context) ?: run { DepthModelFile.fetchOnce(context); return null }
            val s = session ?: env.createSession(model.path,
                // Two threads that sleep when idle (no spin-waiting), created from the background thread so they share its low priority.
                OrtSession.SessionOptions().apply { setIntraOpNumThreads(2); setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
                    runCatching { addConfigEntry("session.intra_op.allow_spinning", "0"); addConfigEntry("session.inter_op.allow_spinning", "0") } }
            ).also { session = it }
            val img = Bitmap.createScaledBitmap(crop, SIZE, SIZE, true)
            val px = IntArray(SIZE * SIZE); img.getPixels(px, 0, SIZE, 0, 0, SIZE, SIZE)
            val n = SIZE * SIZE; val buf = FloatBuffer.allocate(3 * n)
            val mean = floatArrayOf(.485f, .456f, .406f); val std = floatArrayOf(.229f, .224f, .225f)
            for (c in 0 until 3) { val sh = 16 - 8 * c; for (i in 0 until n) buf.put(c * n + i, ((px[i] shr sh and 255) / 255f - mean[c]) / std[c]) }
            val out = OnnxTensor.createTensor(env, buf, longArrayOf(1, 3, SIZE.toLong(), SIZE.toLong())).use { x ->
                s.run(mapOf(s.inputNames.first() to x)).use { r -> (r[0] as OnnxTensor).floatBuffer.let { b -> FloatArray(b.remaining()).also { b.get(it) } } }
            }
            var lo = Float.MAX_VALUE; var hi = -Float.MAX_VALUE
            for (v in out) { lo = min(lo, v); hi = max(hi, v) }
            val k = 1f / (hi - lo + 1e-8f)
            for (i in out.indices) out[i] = (out[i] - lo) * k
            out
        } catch (t: Throwable) {
            Log.w(TAG, "depth model unavailable, cards keep window-only depth", t)
            broken = true; session?.close(); session = null; null
        } finally {
            release = scope.launch { delay(60_000); lock.withLock { session?.close(); session = null } }
        }
    }
}

/**
 * The depth model's file (gap audit G2: about 28 MB off the APK). The site keeps it in parts under the 25 MiB file limit
 * (downloads/models, as the APK); the first card that asks for depth fetches it once per launch in the background, joins the
 * parts, checks its sha256 and only then puts it in place. A missing or wrong file never reaches ONNX Runtime.
 */
object DepthModelFile {
    const val SHA256 = "c77dcadfc49d3ff57114c5dc7a6986bf4d26dec495209d7e353c5feafdfea124"
    const val SIZE = 28_967_622L
    const val PARTS = 2
    const val URL = "https://cardstashy.com/downloads/models/depth-anything-v2-small.onnx"
    private const val NAME = "depth-anything-v2-small.onnx"
    private val tried = java.util.concurrent.atomic.AtomicBoolean(false)
    @Volatile private var checked: File? = null
    private val fetchScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    internal fun fileIn(dir: File) = File(File(dir, "models"), NAME)
    /** The model on the phone, checked once per launch; null (and a wrong file removed) when it is not there yet. */
    fun ready(context: Context): File? = checked ?: readyIn(context.filesDir)?.also { checked = it }
    internal fun readyIn(dir: File): File? {
        val f = fileIn(dir)
        if (!f.isFile) return null
        if (f.length() == SIZE && sha256(f) == SHA256) return f
        f.delete(); return null
    }
    internal fun sha256(f: File): String = MessageDigest.getInstance("SHA-256").let { md ->
        f.inputStream().buffered().use { s -> val b = ByteArray(1 shl 16); while (true) { val n = s.read(b); if (n < 0) break; md.update(b, 0, n) } }
        md.digest().joinToString("") { "%02x".format(it) }
    }
    /** Joins [parts] (opened in order) into the model's place in [dir] when they make the right file; false and nothing kept if not. */
    internal fun install(dir: File, parts: List<() -> java.io.InputStream>): Boolean {
        val f = fileIn(dir); f.parentFile?.mkdirs()
        val tmp = File(f.path + ".part")
        return try {
            tmp.outputStream().buffered().use { out -> for (p in parts) p().use { it.copyTo(out, 1 shl 16) } }
            if (tmp.length() != SIZE || sha256(tmp) != SHA256) { tmp.delete(); false }
            else { f.delete(); tmp.renameTo(f) }
        } catch (t: Throwable) { tmp.delete(); false }
    }
    /** At most once per launch, in the background: fetch the parts from the site. A failure waits for the next launch. */
    fun fetchOnce(context: Context) {
        if (!tried.compareAndSet(false, true)) return
        val dir = context.applicationContext.filesDir
        fetchScope.launch {
            val client = okhttp3.OkHttpClient.Builder().callTimeout(10, java.util.concurrent.TimeUnit.MINUTES).build()
            val ok = install(dir, (1..PARTS).map { n -> {
                val r = client.newCall(okhttp3.Request.Builder().url("$URL.part$n").build()).execute()
                if (!r.isSuccessful) { r.close(); throw java.io.IOException("part $n: HTTP ${r.code}") }
                r.body?.byteStream() ?: throw java.io.IOException("part $n: empty")
            } })
            Log.i(TAG, if (ok) "depth model downloaded and checked" else "depth model download failed; next launch tries again")
        }
    }
    private const val TAG = "DepthModel"
}

/**
 * The depth work's own threads, at Android's background priority: measuring a card or rebuilding its layers never competes with
 * the screen for a core, so a card opens and tilts at full frame rate while its figure is cut.
 */
internal object Background {
    val dispatcher = java.util.concurrent.Executors.newFixedThreadPool(2) { r ->
        Thread({ android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND); r.run() }, "depth").apply { isDaemon = true }
    }.asCoroutineDispatcher()
}

/**
 * Each card's figure layer, measured once and kept: the cut on disk (filesDir/depth, a few dozen KB a card), the plate and shadow
 * rebuilt from it in a blink when the card comes back. Only cards someone is still looking at get measured, one at a time.
 */
object DepthLayers {
    /** [plate] the backdrop with the figure filled in; [fig] R what stays at the glass, G the figure's shadow, B where the plate was
     *  filled; both over [box] in card space (the art window, or for a full art the whole card and a margin past its edge). */
    /** Window cards (take 5) also carry: [rel] the relief light over the window (DepthMatte.relief), [win] the window the layers
     *  cover (a planeswalker's is measured from its picture), [rim] the frame's printed outline inside it (card space: left, top,
     *  right, bottom), [room] the slide budget (a share of the window's width), [follow] how far the figure moves with the backdrop. */
    class Ready(val plate: Bitmap, val fig: Bitmap, val box: FloatArray, val rel: Bitmap? = null, val win: FloatArray = box,
                val rim: FloatArray = FloatArray(4), val room: Float = DepthMatte.SLIDE, val follow: Float = 1f) {
        val inputs by lazy { input(plate) to input(fig) }
        val relInput by lazy { rel?.let(::input) }
    }
    /** Bump when the model or the cut changes, so every card is measured again. 3: take 5 (the cut, the gate, and the depth kept
     *  for the relief light). */
    private const val VERSION = 3
    /** Most width the layers are drawn at: sharper than any phone shows the window, small enough to keep a few cards in memory. */
    private const val MAX_WIDTH = 720
    private val scope = CoroutineScope(SupervisorJob() + Background.dispatcher)
    private val flows = object : LinkedHashMap<String, MutableStateFlow<Ready?>>(16, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, MutableStateFlow<Ready?>>) = size > 6
    }

    private fun key(image: String, win: FloatArray, open: Boolean, facetText: FloatArray?, walker: Boolean = false) =
        "$image|${win.joinToString(",")}|$open" + (facetText?.let { "|facet|" + it.joinToString(",") } ?: "") + (if (walker) "|walker" else "")

    /** True when this card's layers are already in memory (no wait, no model). */
    fun known(image: String, win: FloatArray, open: Boolean, facetText: FloatArray? = null, walker: Boolean = false): Boolean =
        synchronized(flows) { flows[key(image, win, open, facetText, walker)]?.value != null }

    /** [open] for a full art: no window, the whole card is cut and the card's own edge is the only clip. [facetText]: a facet foil's
     *  text box; on a full art its glass shards (MtgFoil.facets) then stay at the glass with the figure, rigid, while the art slides behind.
     *  [walker]: a planeswalker; its art window is measured from the picture (DepthMatte.pwWindow), [win] is ignored. */
    fun layers(context: Context, image: String, win: FloatArray, open: Boolean, facetText: FloatArray? = null, walker: Boolean = false): StateFlow<Ready?> = synchronized(flows) {
        val key = key(image, win, open, facetText, walker && !open)
        flows[key] ?: MutableStateFlow<Ready?>(null).also { f ->
            flows[key] = f
            scope.launch {
                runCatching { make(context.applicationContext, key, image, win, open, facetText?.takeIf { open }, walker && !open, f) }
                    .onFailure { Log.w("DepthLayers", "no figure layer for $image", it) }
            }
        }
    }

    private val measuring = Mutex()

    /** The art crop at layer size and its depth cut, read from disk or measured once (the model, one card at a time). Null when the
     *  picture cannot be had, or when [wanted] says nobody is waiting for it any more (a pager swiped past). */
    /** [depth] the measured depth at the cut's size [lw] x [lh] (0..1, nearer = higher), [win] the window measured, [cardW] the card's
     *  width in px at [hi]'s scale. */
    private class Measured(val hi: IntArray, val hw: Int, val hh: Int, val cut: DepthMatte.Cut, val depth: FloatArray, val lw: Int, val lh: Int,
                           val win: FloatArray, val cardW: Float)
    private suspend fun measure(context: Context, image: String, win0: FloatArray, open: Boolean, wanted: () -> Boolean, walker: Boolean = false): Measured? {
        val dir = File(context.filesDir, "depth").apply { mkdirs() }
        // The depth cut on disk is the same with or without shards (they are cut from the picture below, in a blink), so it keeps its name.
        val file = File(dir, sha("$VERSION|${key(image, win0, open, null, walker)}") + ".bin")
        val req = ImageRequest.Builder(context).data(image).allowHardware(false).build()
        val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return null
        val card = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
        // A planeswalker's window: three abilities or four, read off the type bar's edge on the card at 468 px tall (the reference's size).
        val win = if (!walker) win0 else {
            val gh = 468; val gw = (card.width.toFloat() * gh / card.height).roundToInt().coerceAtLeast(16)
            val px = IntArray(gw * gh).also { Bitmap.createScaledBitmap(card, gw, gh, true).getPixels(it, 0, gw, 0, 0, gw, gh) }
            DepthMatte.pwWindow(DepthMatte.gray(px), gw, gh)
        }
        val x0 = (win[0] * card.width).roundToInt().coerceIn(0, card.width - 1); val y0 = (win[1] * card.height).roundToInt().coerceIn(0, card.height - 1)
        val cw = (win[2] * card.width).roundToInt().coerceAtMost(card.width) - x0; val ch = (win[3] * card.height).roundToInt().coerceAtMost(card.height) - y0
        if (cw < 16 || ch < 16) return null
        val crop = Bitmap.createBitmap(card, x0, y0, cw, ch)
        val hw = min(cw, MAX_WIDTH); val hh = (ch.toFloat() * hw / cw).roundToInt()
        val hiBmp = if (hw == cw) crop else Bitmap.createScaledBitmap(crop, hw, hh, true)
        val hi = IntArray(hw * hh).also { hiBmp.getPixels(it, 0, hw, 0, 0, hw, hh) }
        val lw = min(cw, DepthMatte.CUT_WIDTH); val lh = (ch.toFloat() * lw / cw).roundToInt()
        val got = read(file, hw, hh, lw, lh) ?: measuring.withLock { read(file, hw, hh, lw, lh) ?: run {
            // Another ask for this card may have measured it while this one waited: read again before running the model.
            // Swiping fast through a pager queues cards; the ones nobody is still looking at wait until they open again.
            if (!wanted()) return null
            val d = DepthModel.run(context, crop) ?: return null
            val loBmp = Bitmap.createScaledBitmap(crop, lw, lh, true)
            val lo = IntArray(lw * lh).also { loBmp.getPixels(it, 0, lw, 0, 0, lw, lh) }
            val dl = DepthMatte.resize(d, DepthModel.SIZE, DepthModel.SIZE, lw, lh)
            val c = (if (open) DepthMatte.cutFull(lo, dl, lw, lh, hi, hw, hh) else DepthMatte.cut(lo, dl, lw, lh, hi, hw, hh, walker))
            Log.i("DepthLayers", "$image ${c.gate}"); write(file, c, dl, lw)
            c to dl
        } }
        return Measured(hi, hw, hh, got.first, got.second, lw, lh, win, card.width.toFloat() * hw / cw)
    }

    private val figured = HashSet<String>()
    /**
     * Facet foil's matte figure (spec zone 3) for the foil maps, measured with the analysis whether or not the card is ever shown in 3D:
     * the same depth cut the figure layer uses (and its file on disk, so it runs once per card), handed to FoilMaps. A cut the gate turns
     * down gives no figure, and the creature wears the faint background sheet.
     */
    fun facetFigure(context: Context, image: String, wanted: () -> Boolean) {
        // [figured] holds the cards being measured now; the cut on disk keeps a later ask from running the model again.
        synchronized(figured) { if (!figured.add(image)) return }
        scope.launch {
            try {
                // Like the figure layer: a card not measured yet waits until it has settled in view, and nobody still looking stops it.
                delay(Depth.SETTLE_MS); if (!wanted()) return@launch
                val m = measure(context.applicationContext, image, floatArrayOf(0f, 0f, 1f, 1f), true, wanted) ?: return@launch
                m.cut.figure?.let { FoilMaps.figure(image, it, m.hw, m.hh) }
            } catch (e: Exception) { if (e is kotlinx.coroutines.CancellationException) throw e; Log.w("DepthLayers", "no facet figure for $image", e) }
            finally { synchronized(figured) { figured.remove(image) } }
        }
    }

    private suspend fun make(context: Context, key: String, image: String, win0: FloatArray, open: Boolean, facetText: FloatArray?, walker: Boolean,
                             f: MutableStateFlow<Ready?>) {
        val m = measure(context, image, win0, open, { f.subscriptionCount.value > 0 }, walker) ?: run { if (f.subscriptionCount.value == 0) forget(key); return }
        val hi = m.hi; val hw = m.hw; val hh = m.hh; val cut = m.cut
        if (!open) { f.value = window(m, walker); return }
        // The gate said no: a framed card keeps the window-only depth, a full art stays flat (facet shards alone never make a figure).
        val cutFigure = cut.figure ?: return
        // Facet foil (full arts): the figure is the matte part of the print (spec zone 3), so the foil learns it here; and the printed
        // glass shards join it at the glass as rigid plates, so the art slides behind them and they read raised, never warped. The
        // shards are the ones the foil maps cut (FoilMaps.mtg, MtgFoil.facets), scaled up: one cut, so glass and shading always agree.
        val shard = facetText?.let { t -> FoilMaps.figure(image, cutFigure, hw, hh); shards(context, image, t, hw, hh) }
        val figure = if (shard == null) cutFigure else FloatArray(hw * hh) { max(cutFigure[it], shard[it]) }
        val pad = if (open) kotlin.math.ceil(1.6f * Depth.K_FULL * hw).toInt() + 3 else 0
        val l = if (open) DepthMatte.layersFull(hi, figure, hw, hh, pad, cut.gate) else DepthMatte.layers(hi, figure, hw, hh, cut.gate)
        val fig = IntArray(l.w * l.h) { i -> (255 shl 24) or (q(l.figure[i]) shl 16) or (q(l.shadow[i]) shl 8) or (if (l.hide[i]) 255 else 0) }
        val box = if (open) floatArrayOf(-pad.toFloat() / hw, -pad.toFloat() / hh, 1 + pad.toFloat() / hw, 1 + pad.toFloat() / hh) else win0
        f.value = Ready(Bitmap.createBitmap(l.plate, l.w, l.h, Bitmap.Config.ARGB_8888), Bitmap.createBitmap(fig, l.w, l.h, Bitmap.Config.ARGB_8888), box, room = Depth.K_FULL)
    }

    /**
     * Take 5, a window card: always one plate behind the frame. A figure cut near certain (DepthMatte.cut) sits behind it too, at half
     * the depth, so the backdrop moves twice as far; a planeswalker's figure runs over the frame and stays at the glass. With no cut
     * the whole picture is one rigid plate, which cannot tear. Both planes end at the frame's printed outline ([DepthMatte.rim]); the
     * depth lights the picture (DepthMatte.relief). Same steps as the mock-up Randall saw (web3d.py).
     */
    private fun window(m: Measured, walker: Boolean): Ready {
        val hw = m.hw; val hh = m.hh; val win = m.win; val fig = m.cut.figure
        val ok = fig != null
        val room = if (walker && ok) DepthMatte.SLIDE_WALKER else DepthMatte.SLIDE
        val follow = if (ok) (if (walker) 0f else DepthMatte.FOLLOW) else 1f
        val rimPx = DepthMatte.rim(m.hi, hw, hh, m.cardW, walker)
        val ww = win[2] - win[0]; val wh = win[3] - win[1]
        val rim = floatArrayOf(rimPx[0] * ww / hw, rimPx[1] * wh / hh, rimPx[2] * ww / hw, rimPx[3] * wh / hh)
        val pin = if (walker) DepthMatte.pwPin(hw, hh, m.cardW) else null
        val l = if (ok || walker) DepthMatte.layersWindow(m.hi, fig ?: FloatArray(hw * hh), pin, hw, hh, m.cut.gate, (1 - follow) * room)
                else DepthMatte.Layers(hw, hh, FloatArray(hw * hh), FloatArray(hw * hh), m.hi, BooleanArray(hw * hh), m.cut.gate)
        val figPx = IntArray(l.w * l.h) { i -> (255 shl 24) or (q(l.figure[i]) shl 16) or (q(l.shadow[i]) shl 8) or (if (l.hide[i]) 255 else 0) }
        val (rel, rw, rh) = DepthMatte.relief(m.depth, m.lw, m.lh, ww)
        return Ready(Bitmap.createBitmap(l.plate, l.w, l.h, Bitmap.Config.ARGB_8888), Bitmap.createBitmap(figPx, l.w, l.h, Bitmap.Config.ARGB_8888), win,
            Bitmap.createBitmap(rel, rw, rh, Bitmap.Config.ARGB_8888), win, rim, room, follow)
    }

    /** The facet map's shards (its B, the depth inside each piece) at [w] x [h] over the whole card; null with no shards or no maps. */
    private suspend fun shards(context: Context, image: String, text: FloatArray, w: Int, h: Int): FloatArray? {
        val maps = kotlinx.coroutines.withTimeoutOrNull(8000) { FoilMaps.mtg(context, image, text).first { it != null } } ?: return null
        val f = maps.facet ?: return null
        val fw = f.width; val fh = f.height
        val px = IntArray(fw * fh).also { f.getPixels(it, 0, fw, 0, 0, fw, fh) }
        var any = false
        val b = FloatArray(fw * fh) { val v = min(1f, (px[it] and 255) / 255f * 3f); if (v > 0f) any = true; v }
        return if (any) DepthMatte.resize(b, fw, fh, w, h) else null
    }

    private fun forget(key: String) = synchronized(flows) { flows.remove(key) }
    private fun q(v: Float) = (v.coerceIn(0f, 1f) * 255).roundToInt()
    private fun sha(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    /** File: size, the gate's numbers (take 5 adds the edge), the figure at 8 bits when it passed, then the depth at the cut's size
     *  [lw] x [lh], 8 bits. Null when absent, unreadable or measured at another size. */
    private fun read(file: File, w: Int, h: Int, lw: Int, lh: Int): Pair<DepthMatte.Cut, FloatArray>? = runCatching {
        DataInputStream(GZIPInputStream(file.inputStream().buffered())).use { inp ->
            val fw = inp.readInt(); val fh = inp.readInt()
            if (fw != w || fh != h) return null
            val gate = DepthMatte.Gate(inp.readFloat(), inp.readFloat(), inp.readFloat(), inp.readFloat(), inp.readFloat(), inp.readFloat())
            val fig = if (inp.readBoolean()) ByteArray(w * h).also { inp.readFully(it) }.let { b -> FloatArray(w * h) { (b[it].toInt() and 255) / 255f } } else null
            if (inp.readInt() != lw || inp.readInt() != lh) return null
            val d = ByteArray(lw * lh).also { inp.readFully(it) }
            DepthMatte.Cut(w, h, fig, gate) to FloatArray(lw * lh) { (d[it].toInt() and 255) / 255f }
        }
    }.getOrNull()

    private fun write(file: File, cut: DepthMatte.Cut, depth: FloatArray, depthW: Int) = runCatching {
        val tmp = File(file.path + ".tmp")
        DataOutputStream(GZIPOutputStream(tmp.outputStream().buffered())).use { o ->
            o.writeInt(cut.w); o.writeInt(cut.h); o.writeFloat(cut.gate.separation); o.writeFloat(cut.gate.area); o.writeFloat(cut.gate.softEdge)
            o.writeFloat(cut.gate.weak); o.writeFloat(cut.gate.title); o.writeFloat(cut.gate.edge)
            o.writeBoolean(cut.figure != null)
            cut.figure?.let { m -> o.write(ByteArray(m.size) { q(m[it]).toByte() }) }
            o.writeInt(depthW); o.writeInt(depth.size / depthW)
            o.write(ByteArray(depth.size) { q(depth[it]).toByte() })
        }
        tmp.renameTo(file)
    }

    private fun input(b: Bitmap): Shader = BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR }
}
