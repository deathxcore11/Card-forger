package dev.cardstashy.nativeplay.foil

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The figure layer of a framed card, made on the phone from the card's own measured depth (Randall 4 Nov: "on the phone").
 * Port of the approved take-3 pipeline (scratchpad d3/depthmatte.py + layers3d3.py), pure Kotlin so it is tested on the JVM:
 *
 *  1. depth (Depth Anything V2 small, run by DepthModel) over the art window, nearer = higher;
 *  2. the backdrop's depth is read from the window's top and side band (a figure rarely touches them), and the cut sits just
 *     above it, capped by Otsu, so wings and tails that run deep stay with the figure; Otsu's separability is the gate's first test;
 *  3. the soft cut is snapped to the picture's own edges with a guided filter;
 *  4. the gate: a clean split (separability), a believable figure (8 to 70% of the window) and a crisp edge, or no figure layer
 *     at all and the card keeps the window-only depth, which cannot fail;
 *  5. the backdrop plate: the figure and its fringe filled in smoothly from the backdrop around it;
 *  6. the figure's shadow on the backdrop: its silhouette pulled in 3 px and softened, so it is fully hidden at rest.
 * The gate judges the crop at most [CUT_WIDTH] wide, as approved; the figure is then drawn at the full crop size ([cut]).
 */
object DepthMatte {
    class Gate(val separation: Float, val area: Float, val softEdge: Float) {
        val pass get() = separation >= .55f && area in .08f..0.70f && softEdge <= .15f
        override fun toString() = "sep %.2f area %.2f soft %.3f %s".format(separation, area, softEdge, if (pass) "pass" else "fail")
    }
    /** [figure] 0..1 per pixel; [hide] where the plate was filled in; [plate] ARGB backdrop; [shadow] 0..1 softened silhouette. */
    class Layers(val w: Int, val h: Int, val figure: FloatArray, val shadow: FloatArray, val plate: IntArray, val hide: BooleanArray, val gate: Gate)

    /** Edge-padded box mean, radius r (numpy pad 'edge' + cumulative sums in depthmatte.py). */
    fun box(a: FloatArray, w: Int, h: Int, r: Int): FloatArray {
        val pw = w + 2 * r + 1; val ph = h + 2 * r + 1
        val c = DoubleArray(pw * ph) // c[(y+1)*pw + (x+1)] = sum of padded[0..y][0..x]
        for (y in 0 until h + 2 * r) {
            var row = 0.0
            val sy = (y - r).coerceIn(0, h - 1)
            for (x in 0 until w + 2 * r) {
                row += a[sy * w + (x - r).coerceIn(0, w - 1)]
                c[(y + 1) * pw + x + 1] = c[y * pw + x + 1] + row
            }
        }
        val n = ((2 * r + 1) * (2 * r + 1)).toDouble(); val o = FloatArray(w * h); val k = 2 * r + 1
        for (y in 0 until h) for (x in 0 until w)
            o[y * w + x] = ((c[(y + k) * pw + x + k] - c[y * pw + x + k] - c[(y + k) * pw + x] + c[y * pw + x]) / n).toFloat()
        return o
    }

    /** The guided filter's smoothed coefficients (mean a, mean b): the output is a * I + b, at this size or, resized, at any larger one. */
    fun coeffs(I: FloatArray, p: FloatArray, w: Int, h: Int, r: Int, eps: Float): Pair<FloatArray, FloatArray> {
        val n = w * h
        val mI = box(I, w, h, r); val mp = box(p, w, h, r)
        val II = FloatArray(n) { I[it] * I[it] }; val Ip = FloatArray(n) { I[it] * p[it] }
        val cI = box(II, w, h, r).also { for (i in 0 until n) it[i] -= mI[i] * mI[i] }
        val cIp = box(Ip, w, h, r).also { for (i in 0 until n) it[i] -= mI[i] * mp[i] }
        val a = FloatArray(n) { cIp[it] / (cI[it] + eps) }; val b = FloatArray(n) { mp[it] - a[it] * mI[it] }
        return box(a, w, h, r) to box(b, w, h, r)
    }

    fun guided(I: FloatArray, p: FloatArray, w: Int, h: Int, r: Int, eps: Float): FloatArray {
        val (ma, mb) = coeffs(I, p, w, h, r, eps)
        return FloatArray(w * h) { ma[it] * I[it] + mb[it] }
    }

    /** Bilinear resize with pixel centres aligned (PIL's convention), edges clamped. */
    fun resize(a: FloatArray, w: Int, h: Int, W: Int, H: Int): FloatArray {
        if (w == W && h == H) return a.copyOf()
        val o = FloatArray(W * H); val sx = w.toFloat() / W; val sy = h.toFloat() / H
        for (y in 0 until H) {
            val fy = ((y + .5f) * sy - .5f).coerceIn(0f, h - 1f); val y0 = fy.toInt(); val y1 = min(y0 + 1, h - 1); val ty = fy - y0
            for (x in 0 until W) {
                val fx = ((x + .5f) * sx - .5f).coerceIn(0f, w - 1f); val x0 = fx.toInt(); val x1 = min(x0 + 1, w - 1); val tx = fx - x0
                val top = a[y0 * w + x0] * (1 - tx) + a[y0 * w + x1] * tx; val bot = a[y1 * w + x0] * (1 - tx) + a[y1 * w + x1] * tx
                o[y * W + x] = top * (1 - ty) + bot * ty
            }
        }
        return o
    }

    fun gray(argb: IntArray) = FloatArray(argb.size) { i -> val p = argb[i]; (.299f * (p shr 16 and 255) + .587f * (p shr 8 and 255) + .114f * (p and 255)) / 255f }

    /** Otsu over 256 bins of 0..1: the threshold (a bin's lower edge) and the separability (between-class / total variance). */
    fun otsu(v: FloatArray): Pair<Float, Float> {
        val hist = DoubleArray(256); var mean = 0.0
        for (x in v) { hist[min(255, max(0, (x * 256).toInt()))]++; mean += x }
        mean /= v.size; var vr = 0.0; for (x in v) vr += (x - mean) * (x - mean); vr /= v.size
        val total = v.size.toDouble(); var w0 = 0.0; var m = 0.0; var mAll = 0.0
        for (i in 0 until 256) mAll += hist[i] * (i / 256.0 + 1 / 512.0)
        var best = -1.0; var k = 0
        for (i in 0 until 256) {
            w0 += hist[i]; m += hist[i] * (i / 256.0 + 1 / 512.0)
            val w1 = total - w0; val mu0 = m / max(w0, 1.0); val mu1 = (mAll - m) / max(w1, 1.0)
            val s = w0 * w1 * (mu0 - mu1) * (mu0 - mu1)
            if (s > best) { best = s; k = i }
        }
        return (k / 256f) to (best / (total * total * vr + 1e-9)).toFloat()
    }

    private fun median(v: FloatArray): Float { val s = v.sortedArray(); val n = s.size; return if (n % 2 == 1) s[n / 2] else (s[n / 2 - 1] + s[n / 2]) / 2 }

    /** The soft depth cut and the guided filter's radius for a window crop; [sep] is Otsu's separability. */
    private class Split(val soft: FloatArray, val r: Int, val sep: Float)
    private fun split(depth: FloatArray, w: Int, h: Int): Split {
        var (t, sep) = otsu(depth)
        val bw = max(3, (.04f * w).toInt()); val bh = max(3, (.04f * h).toInt())
        val band = ArrayList<Float>(w * bh + 2 * h * bw)
        for (y in 0 until bh) for (x in 0 until w) band += depth[y * w + x]
        for (y in 0 until h) for (x in 0 until bw) band += depth[y * w + x]
        for (y in 0 until h) for (x in w - bw until w) band += depth[y * w + x]
        // A head can touch the name bar, so read the band's middle, not its top.
        t = min(t + .05f, median(band.toFloatArray()) + .10f)
        return Split(FloatArray(w * h) { ((depth[it] - t) / .08f + .5f).coerceIn(0f, 1f) }, max(2, (6f * w / 615f).toInt()), sep)
    }
    private fun gate(m: FloatArray, sep: Float): Gate {
        var area = 0; var edge = 0
        for (x in m) { if (x > .5f) area++; if (x > .15f && x < .85f) edge++ }
        return Gate(sep, area.toFloat() / m.size, edge.toFloat() / m.size)
    }

    /** The figure matte over a window crop: [gray] 0..1 luminance, [depth] 0..1 at the same size (nearer = higher). */
    fun matte(gray: FloatArray, depth: FloatArray, w: Int, h: Int): Pair<FloatArray, Gate> {
        val s = split(depth, w, h)
        val m = guided(gray, s.soft, w, h, s.r, 2e-3f).also { for (i in it.indices) it[i] = it[i].coerceIn(0f, 1f) }
        return m to gate(m, s.sep)
    }

    /** Most width the cut is judged at: the gate's numbers were tuned on crops 225 to 307 px wide (take 3). */
    const val CUT_WIDTH = 320

    /**
     * The phone's cut. The gate judges the crop at [lw] x [lh] (at most [CUT_WIDTH] wide, as approved); a figure that passes is then
     * drawn at the full [hw] x [hh] crop by the same guided filter, its coefficients resized up and applied to the sharp picture, so the
     * edge follows the art's own lines at any zoom. [figure] is null when the gate fails: that card keeps the window-only depth.
     */
    class Cut(val w: Int, val h: Int, val figure: FloatArray?, val gate: Gate)
    fun cut(lo: IntArray, depth: FloatArray, lw: Int, lh: Int, hi: IntArray, hw: Int, hh: Int): Cut {
        val gl = gray(lo); val s = split(depth, lw, lh)
        val (ma, mb) = coeffs(gl, s.soft, lw, lh, s.r, 2e-3f)
        val m = FloatArray(lw * lh) { (ma[it] * gl[it] + mb[it]).coerceIn(0f, 1f) }
        val g = gate(m, s.sep)
        if (!g.pass) return Cut(hw, hh, null, g)
        if (hw == lw && hh == lh) return Cut(hw, hh, m, g)
        val gh = gray(hi); val A = resize(ma, lw, lh, hw, hh); val B = resize(mb, lw, lh, hw, hh)
        return Cut(hw, hh, FloatArray(hw * hh) { (A[it] * gh[it] + B[it]).coerceIn(0f, 1f) }, g)
    }

    /**
     * Fills hidden pixels from the visible ones with a push-pull pyramid: each hidden pixel takes the blurred colour of the nearest
     * backdrop around it, with none of the streaks that neighbour-averaging rings leave. Visible pixels are kept exactly.
     */
    fun fill(argb: IntArray, hide: BooleanArray, w: Int, h: Int): IntArray {
        val n = w * h
        val c = arrayOf(FloatArray(n) { (argb[it] shr 16 and 255).toFloat() }, FloatArray(n) { (argb[it] shr 8 and 255).toFloat() }, FloatArray(n) { (argb[it] and 255).toFloat() })
        val f = pushPull(c, BooleanArray(n) { !hide[it] }, w, h)
        return IntArray(n) { i -> if (!hide[i]) argb[i] else (255 shl 24) or (f[0][i].roundToInt().coerceIn(0, 255) shl 16) or (f[1][i].roundToInt().coerceIn(0, 255) shl 8) or f[2][i].roundToInt().coerceIn(0, 255) }
    }
    private fun pushPull(c: Array<FloatArray>, known: BooleanArray, w: Int, h: Int): Array<FloatArray> {
        if (known.none { it }) return c
        val w2 = (w + 1) / 2; val h2 = (h + 1) / 2
        val c2 = Array(3) { FloatArray(w2 * h2) }; val k2 = FloatArray(w2 * h2)
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x; if (!known[i]) continue
            val j = (y / 2) * w2 + x / 2; for (ch in 0 until 3) c2[ch][j] += c[ch][i]; k2[j]++
        }
        for (j in k2.indices) if (k2[j] > 0f) for (ch in 0 until 3) c2[ch][j] /= k2[j]
        val known2 = BooleanArray(w2 * h2) { k2[it] > 0f }
        val f2 = if (known2.any { !it } && min(w2, h2) > 1) pushPull(c2, known2, w2, h2) else c2
        val out = Array(3) { c[it].copyOf() }
        for (ch in 0 until 3) {
            val up = resize(f2[ch], w2, h2, w, h)
            for (i in 0 until w * h) if (!known[i]) out[ch][i] = up[i]
        }
        return out
    }

    /** Binary erosion by [e] px (square), then a two-pass box blur of radius [b]: the shadow's silhouette, hidden under the figure at rest. */
    fun shadow(fig: FloatArray, w: Int, h: Int, e: Int, b: Int): FloatArray {
        val on = FloatArray(w * h) { if (fig[it] > .5f) 1f else 0f }
        val mean = box(on, w, h, e)
        val core = FloatArray(w * h) { if (mean[it] > .999f) 1f else 0f }
        return box(box(core, w, h, b), w, h, b)
    }

    /** A box radius whose two passes blur like a Gaussian of this sigma (variance 2r(r+1)/3). */
    private fun boxFor(sigma: Float) = max(1, Math.round((-1 + kotlin.math.sqrt(1 + 6 * sigma * sigma)) / 2))

    /** The take-3 numbers were set on a 360 px card, where a window is about 272 px wide: erode 3 px, soften by a Gaussian of 2. */
    private const val PROOF_WINDOW = 272f

    /**
     * Plate and shadow for a figure already cut at this size. The plate hides the figure and its soft fringe, grown a pixel or two,
     * so the backdrop the slide uncovers carries no ghost of the figure's outline.
     */
    fun layers(argb: IntArray, figure: FloatArray, w: Int, h: Int, gate: Gate): Layers {
        val s = w / PROOF_WINDOW
        val grown = box(FloatArray(w * h) { if (figure[it] > .15f) 1f else 0f }, w, h, max(1, Math.round(s)))
        val hide = BooleanArray(w * h) { grown[it] > 1e-4f }
        return Layers(w, h, figure, shadow(figure, w, h, max(1, Math.round(3 * s)), boxFor(2 * s)), fill(argb, hide, w, h), hide, gate)
    }

    /** Everything for one window crop at one size (the take-3 pipeline end to end). */
    fun layers(argb: IntArray, depth: FloatArray, w: Int, h: Int): Layers {
        val (m, gate) = matte(gray(argb), depth, w, h)
        if (!gate.pass) return Layers(w, h, m, FloatArray(w * h), argb, BooleanArray(w * h), gate)
        return layers(argb, m, w, h, gate)
    }
}
