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
    class Ready(val plate: Bitmap, val fig: Bitmap, val box: FloatArray) {
        val inputs by lazy { input(plate) to input(fig) }
    }
    /** Bump when the model or the cut changes, so every card is measured again. */
    private const val VERSION = 2
    /** Most width the layers are drawn at: sharper than any phone shows the window, small enough to keep a few cards in memory. */
    private const val MAX_WIDTH = 720
    private val scope = CoroutineScope(SupervisorJob() + Background.dispatcher)
    private val flows = object : LinkedHashMap<String, MutableStateFlow<Ready?>>(16, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, MutableStateFlow<Ready?>>) = size > 6
    }

    private fun key(image: String, win: FloatArray, open: Boolean, facetText: FloatArray?) =
        "$image|${win.joinToString(",")}|$open" + (facetText?.let { "|facet|" + it.joinToString(",") } ?: "")

    /** True when this card's layers are already in memory (no wait, no model). */
    fun known(image: String, win: FloatArray, open: Boolean, facetText: FloatArray? = null): Boolean = synchronized(flows) { flows[key(image, win, open, facetText)]?.value != null }

    /** [open] for a full art: no window, the whole card is cut and the card's own edge is the only clip. [facetText]: a facet foil's
     *  text box; on a full art its glass shards (MtgFoil.facets) then stay at the glass with the figure, rigid, while the art slides behind. */
    fun layers(context: Context, image: String, win: FloatArray, open: Boolean, facetText: FloatArray? = null): StateFlow<Ready?> = synchronized(flows) {
        val key = key(image, win, open, facetText)
        flows[key] ?: MutableStateFlow<Ready?>(null).also { f ->
            flows[key] = f
            scope.launch {
                runCatching { make(context.applicationContext, key, image, win, open, facetText?.takeIf { open }, f) }
                    .onFailure { Log.w("DepthLayers", "no figure layer for $image", it) }
            }
        }
    }

    private val measuring = Mutex()

    /** The art crop at layer size and its depth cut, read from disk or measured once (the model, one card at a time). Null when the
     *  picture cannot be had, or when [wanted] says nobody is waiting for it any more (a pager swiped past). */
    private class Measured(val hi: IntArray, val hw: Int, val hh: Int, val cut: DepthMatte.Cut)
    private suspend fun measure(context: Context, image: String, win: FloatArray, open: Boolean, wanted: () -> Boolean): Measured? {
        val dir = File(context.filesDir, "depth").apply { mkdirs() }
        // The depth cut on disk is the same with or without shards (they are cut from the picture below, in a blink), so it keeps its name.
        val file = File(dir, sha("$VERSION|${key(image, win, open, null)}") + ".bin")
        val req = ImageRequest.Builder(context).data(image).allowHardware(false).build()
        val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return null
        val card = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
        val x0 = (win[0] * card.width).roundToInt().coerceIn(0, card.width - 1); val y0 = (win[1] * card.height).roundToInt().coerceIn(0, card.height - 1)
        val cw = (win[2] * card.width).roundToInt().coerceAtMost(card.width) - x0; val ch = (win[3] * card.height).roundToInt().coerceAtMost(card.height) - y0
        if (cw < 16 || ch < 16) return null
        val crop = Bitmap.createBitmap(card, x0, y0, cw, ch)
        val hw = min(cw, MAX_WIDTH); val hh = (ch.toFloat() * hw / cw).roundToInt()
        val hiBmp = if (hw == cw) crop else Bitmap.createScaledBitmap(crop, hw, hh, true)
        val hi = IntArray(hw * hh).also { hiBmp.getPixels(it, 0, hw, 0, 0, hw, hh) }
        val cut = read(file, hw, hh) ?: measuring.withLock { read(file, hw, hh) ?: run {
            // Another ask for this card may have measured it while this one waited: read again before running the model.
            // Swiping fast through a pager queues cards; the ones nobody is still looking at wait until they open again.
            if (!wanted()) return null
            val d = DepthModel.run(context, crop) ?: return null
            val lw = min(cw, DepthMatte.CUT_WIDTH); val lh = (ch.toFloat() * lw / cw).roundToInt()
            val loBmp = Bitmap.createScaledBitmap(crop, lw, lh, true)
            val lo = IntArray(lw * lh).also { loBmp.getPixels(it, 0, lw, 0, 0, lw, lh) }
            val dl = DepthMatte.resize(d, DepthModel.SIZE, DepthModel.SIZE, lw, lh)
            (if (open) DepthMatte.cutFull(lo, dl, lw, lh, hi, hw, hh) else DepthMatte.cut(lo, dl, lw, lh, hi, hw, hh))
                .also { Log.i("DepthLayers", "$image ${it.gate}"); write(file, it) }
        } }
        return Measured(hi, hw, hh, cut)
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

    private suspend fun make(context: Context, key: String, image: String, win: FloatArray, open: Boolean, facetText: FloatArray?, f: MutableStateFlow<Ready?>) {
        val m = measure(context, image, win, open) { f.subscriptionCount.value > 0 } ?: run { if (f.subscriptionCount.value == 0) forget(key); return }
        val hi = m.hi; val hw = m.hw; val hh = m.hh; val cut = m.cut
        // The gate said no: a framed card keeps the window-only depth, a full art stays flat (facet shards alone never make a figure).
        val cutFigure = cut.figure ?: return
        // Facet foil (full arts): the figure is the matte part of the print (spec zone 3), so the foil learns it here; and the printed
        // glass shards join it at the glass as rigid plates, so the art slides behind them and they read raised, never warped. The
        // shards are the ones the foil maps cut (FoilMaps.mtg, MtgFoil.facets), scaled up: one cut, so glass and shading always agree.
        val shard = facetText?.let { t -> FoilMaps.figure(image, cutFigure, hw, hh); shards(context, image, t, hw, hh) }
        val figure = if (shard == null) cutFigure else FloatArray(hw * hh) { max(cutFigure[it], shard[it]) }
        val pad = if (open) kotlin.math.ceil(1.6f * Depth.K * hw).toInt() + 3 else 0
        val l = if (open) DepthMatte.layersFull(hi, figure, hw, hh, pad, cut.gate) else DepthMatte.layers(hi, figure, hw, hh, cut.gate)
        val fig = IntArray(l.w * l.h) { i -> (255 shl 24) or (q(l.figure[i]) shl 16) or (q(l.shadow[i]) shl 8) or (if (l.hide[i]) 255 else 0) }
        val box = if (open) floatArrayOf(-pad.toFloat() / hw, -pad.toFloat() / hh, 1 + pad.toFloat() / hw, 1 + pad.toFloat() / hh) else win
        f.value = Ready(Bitmap.createBitmap(l.plate, l.w, l.h, Bitmap.Config.ARGB_8888), Bitmap.createBitmap(fig, l.w, l.h, Bitmap.Config.ARGB_8888), box)
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

    /** File: size, the gate's three numbers, then the figure at 8 bits when it passed. Null when absent, unreadable or measured at another size. */
    private fun read(file: File, w: Int, h: Int): DepthMatte.Cut? = runCatching {
        DataInputStream(GZIPInputStream(file.inputStream().buffered())).use { inp ->
            val fw = inp.readInt(); val fh = inp.readInt()
            if (fw != w || fh != h) return null
            val gate = DepthMatte.Gate(inp.readFloat(), inp.readFloat(), inp.readFloat(), inp.readFloat(), inp.readFloat())
            if (!inp.readBoolean()) return DepthMatte.Cut(w, h, null, gate)
            val b = ByteArray(w * h).also { inp.readFully(it) }
            DepthMatte.Cut(w, h, FloatArray(w * h) { (b[it].toInt() and 255) / 255f }, gate)
        }
    }.getOrNull()

    private fun write(file: File, cut: DepthMatte.Cut) = runCatching {
        val tmp = File(file.path + ".tmp")
        DataOutputStream(GZIPOutputStream(tmp.outputStream().buffered())).use { o ->
            o.writeInt(cut.w); o.writeInt(cut.h); o.writeFloat(cut.gate.separation); o.writeFloat(cut.gate.area); o.writeFloat(cut.gate.softEdge)
            o.writeFloat(cut.gate.weak); o.writeFloat(cut.gate.title)
            o.writeBoolean(cut.figure != null)
            cut.figure?.let { m -> o.write(ByteArray(m.size) { q(m[it]).toByte() }) }
        }
        tmp.renameTo(file)
    }

    private fun input(b: Bitmap): Shader = BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR }
}
