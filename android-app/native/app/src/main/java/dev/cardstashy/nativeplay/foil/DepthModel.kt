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
import dev.cardstashy.nativeplay.R
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
            val s = session ?: env.createSession(context.resources.openRawResource(R.raw.depth_anything_v2_small).use { it.readBytes() },
                OrtSession.SessionOptions().apply { setIntraOpNumThreads(2); setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT) }
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
 * Each card's figure layer, measured once and kept: the cut on disk (filesDir/depth, a few dozen KB a card), the plate and shadow
 * rebuilt from it in a blink when the card comes back. Only cards someone is still looking at get measured, one at a time.
 */
object DepthLayers {
    /** [plate] the backdrop with the figure filled in; [fig] R figure, G its shadow, B where the plate was filled; all over the art window. */
    class Ready(val plate: Bitmap, val fig: Bitmap) {
        val inputs by lazy { input(plate) to input(fig) }
    }
    /** Bump when the model or the cut changes, so every card is measured again. */
    private const val VERSION = 1
    /** Most width the layers are drawn at: sharper than any phone shows the window, small enough to keep a few cards in memory. */
    private const val MAX_WIDTH = 720
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val flows = object : LinkedHashMap<String, MutableStateFlow<Ready?>>(16, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, MutableStateFlow<Ready?>>) = size > 6
    }

    fun layers(context: Context, image: String, win: FloatArray): StateFlow<Ready?> = synchronized(flows) {
        val key = "$image|${win.joinToString(",")}"
        flows[key] ?: MutableStateFlow<Ready?>(null).also { f ->
            flows[key] = f
            scope.launch {
                runCatching { make(context.applicationContext, key, image, win, f) }
                    .onFailure { Log.w("DepthLayers", "no figure layer for $image", it) }
            }
        }
    }

    private val measuring = Mutex()

    private suspend fun make(context: Context, key: String, image: String, win: FloatArray, f: MutableStateFlow<Ready?>) {
        val dir = File(context.filesDir, "depth").apply { mkdirs() }
        val file = File(dir, sha("$VERSION|$key") + ".bin")
        val req = ImageRequest.Builder(context).data(image).allowHardware(false).build()
        val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return
        val card = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
        val x0 = (win[0] * card.width).roundToInt().coerceIn(0, card.width - 1); val y0 = (win[1] * card.height).roundToInt().coerceIn(0, card.height - 1)
        val cw = (win[2] * card.width).roundToInt().coerceAtMost(card.width) - x0; val ch = (win[3] * card.height).roundToInt().coerceAtMost(card.height) - y0
        if (cw < 16 || ch < 16) return
        val crop = Bitmap.createBitmap(card, x0, y0, cw, ch)
        val hw = min(cw, MAX_WIDTH); val hh = (ch.toFloat() * hw / cw).roundToInt()
        val hiBmp = if (hw == cw) crop else Bitmap.createScaledBitmap(crop, hw, hh, true)
        val hi = IntArray(hw * hh).also { hiBmp.getPixels(it, 0, hw, 0, 0, hw, hh) }
        val cut = read(file, hw, hh) ?: measuring.withLock {
            // Swiping fast through a pager queues cards; the ones nobody is still looking at wait until they open again.
            if (f.subscriptionCount.value == 0) { forget(key); return }
            val d = DepthModel.run(context, crop) ?: return
            val lw = min(cw, DepthMatte.CUT_WIDTH); val lh = (ch.toFloat() * lw / cw).roundToInt()
            val loBmp = Bitmap.createScaledBitmap(crop, lw, lh, true)
            val lo = IntArray(lw * lh).also { loBmp.getPixels(it, 0, lw, 0, 0, lw, lh) }
            DepthMatte.cut(lo, DepthMatte.resize(d, DepthModel.SIZE, DepthModel.SIZE, lw, lh), lw, lh, hi, hw, hh)
                .also { Log.i("DepthLayers", "$image ${it.gate}"); write(file, it) }
        }
        val figure = cut.figure ?: return // the gate said no: this card keeps the window-only depth
        val l = DepthMatte.layers(hi, figure, hw, hh, cut.gate)
        val fig = IntArray(hw * hh) { i -> (255 shl 24) or (q(l.figure[i]) shl 16) or (q(l.shadow[i]) shl 8) or (if (l.hide[i]) 255 else 0) }
        f.value = Ready(Bitmap.createBitmap(l.plate, hw, hh, Bitmap.Config.ARGB_8888), Bitmap.createBitmap(fig, hw, hh, Bitmap.Config.ARGB_8888))
    }

    private fun forget(key: String) = synchronized(flows) { flows.remove(key) }
    private fun q(v: Float) = (v.coerceIn(0f, 1f) * 255).roundToInt()
    private fun sha(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    /** File: size, the gate's three numbers, then the figure at 8 bits when it passed. Null when absent, unreadable or measured at another size. */
    private fun read(file: File, w: Int, h: Int): DepthMatte.Cut? = runCatching {
        DataInputStream(GZIPInputStream(file.inputStream().buffered())).use { inp ->
            val fw = inp.readInt(); val fh = inp.readInt()
            if (fw != w || fh != h) return null
            val gate = DepthMatte.Gate(inp.readFloat(), inp.readFloat(), inp.readFloat())
            if (!inp.readBoolean()) return DepthMatte.Cut(w, h, null, gate)
            val b = ByteArray(w * h).also { inp.readFully(it) }
            DepthMatte.Cut(w, h, FloatArray(w * h) { (b[it].toInt() and 255) / 255f }, gate)
        }
    }.getOrNull()

    private fun write(file: File, cut: DepthMatte.Cut) = runCatching {
        val tmp = File(file.path + ".tmp")
        DataOutputStream(GZIPOutputStream(tmp.outputStream().buffered())).use { o ->
            o.writeInt(cut.w); o.writeInt(cut.h); o.writeFloat(cut.gate.separation); o.writeFloat(cut.gate.area); o.writeFloat(cut.gate.softEdge)
            o.writeBoolean(cut.figure != null)
            cut.figure?.let { m -> o.write(ByteArray(m.size) { q(m[it]).toByte() }) }
        }
        tmp.renameTo(file)
    }

    private fun input(b: Bitmap): Shader = BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR }
}
