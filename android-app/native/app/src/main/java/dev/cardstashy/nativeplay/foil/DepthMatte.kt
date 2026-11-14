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
    /** Full arts add two seam checks: [weak] the share of the cut's edge that runs over plain art (no line in the picture to hide it),
     *  [title] how far the cut splits a display title. Framed cards leave both at 0. */
    class Gate(val separation: Float, val area: Float, val softEdge: Float, val weak: Float = 0f, val title: Float = 0f, val edge: Float = 1f) {
        /** Full arts. */
        val pass get() = separation >= .55f && area in .08f..0.70f && softEdge <= .15f && weak <= .25f && title <= .15f
        /**
         * Window cards (take 5). A card with no cut is still a 3D window: the whole picture is one plate behind the frame, which cannot
         * tear. So the cut has to be near certain: a clean split, a believable figure (up to [AREA_MAX] of the window: Jace, the Mind
         * Sculptor fills 81%), a crisp edge, and [EDGE_CUT] of the outline on a real step in depth ([edge]). A planeswalker's figure
         * runs over the frame, and a plate with no cut would shear it at the frame's edge, so there the cut is kept down to [EDGE_WALKER].
         */
        fun cuts(walker: Boolean) = separation >= .55f && area in .08f..AREA_MAX && softEdge <= .15f && edge >= (if (walker) EDGE_WALKER else EDGE_CUT)
        override fun toString() = "sep %.2f area %.2f soft %.3f weak %.2f title %.2f edge %.2f %s".format(separation, area, softEdge, weak, title, edge, if (pass) "pass" else "fail")
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
    private class Split(val soft: FloatArray, val r: Int, val sep: Float, val t: Float)
    private fun split(depth: FloatArray, w: Int, h: Int): Split {
        var (t, sep) = otsu(depth)
        val bw = max(3, (.04f * w).toInt()); val bh = max(3, (.04f * h).toInt())
        val band = ArrayList<Float>(w * bh + 2 * h * bw)
        for (y in 0 until bh) for (x in 0 until w) band += depth[y * w + x]
        for (y in 0 until h) for (x in 0 until bw) band += depth[y * w + x]
        for (y in 0 until h) for (x in w - bw until w) band += depth[y * w + x]
        // A head can touch the name bar, so read the band's middle, not its top.
        t = min(t + .05f, median(band.toFloatArray()) + .10f)
        return Split(FloatArray(w * h) { ((depth[it] - t) / .08f + .5f).coerceIn(0f, 1f) }, max(2, (6f * w / 615f).toInt()), sep, t)
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

    /** [figure] is null when the gate says no: a framed card is then one plate behind its frame, a full art stays flat. */
    class Cut(val w: Int, val h: Int, val figure: FloatArray?, val gate: Gate)

    // ------------------------------------------------------------------------------------------------------------------------------
    // Take 5, window cards (Randall 14 Nov on the 3D Jace: "the mapping is kinda bad"). Reference and its pictures on 18 real
    // cards: design/foil-depth-src/take4 (matte4.py, render4.py). Faults of take 3 it answers: a head or an arm left out of the
    // figure slid off the body (Liliana of the Veil DMU 97, Sheoldred DMU 107); scenery was cut as if it were a figure and tore
    // (Island, Lightning Bolt, Wrath of God); Jace's cloak (81% of the window) failed the gate.
    // ------------------------------------------------------------------------------------------------------------------------------
    /** Most of the window a figure may fill. */
    const val AREA_MAX = .86f
    /** [grow]: how far down from the cut towards the backdrop's own level a part touching the figure may sit and still belong to it. */
    const val GROW = .4f
    /** [edge]: the box each way as a share of the width, and the step in depth that counts as real. */
    const val EDGE_R = .025f; const val EDGE_STEP = .15f
    /** Share of the outline on a real step a cut needs: the nine clean cuts of the test cards are .90 to .97, Tarmogoyf and Behind
     *  the Mask (.88, the cut runs through the helmet) are not; planeswalkers down to .70 (Jace .75). */
    const val EDGE_CUT = .9f; const val EDGE_WALKER = .7f
    /** The figure's edge is drawn this much steeper about one half, so a soft matte never leaves a ghost of the figure behind. */
    const val CRISP = 2.2f
    /** Loose pieces of figure under this share of the window are dropped: a hand or a spark cut off from the body would tear. */
    const val ISLAND = .01f

    /**
     * The figure by two thresholds. A figure is often nearer at the body than at the head or an outstretched arm, so one threshold
     * cuts those off. Everything above the cut [tHi] is a seed; a seed then takes in whatever touches it and is still clearly nearer
     * than the backdrop: above the backdrop's own level (the median of the far side of Otsu's split [otsuT]) by [GROW] of the way
     * up to the cut. Returns the soft cut 0..1 with the grown parts in.
     */
    internal fun grow(depth: FloatArray, w: Int, h: Int, tHi: Float, otsuT: Float): FloatArray {
        val n = w * h
        var far = 0; for (d in depth) if (d <= otsuT) far++
        val base = if (far == 0) 0f else median(FloatArray(far).also { f -> var k = 0; for (d in depth) if (d <= otsuT) f[k++] = d })
        val tLo = base + GROW * (tHi - base)
        val keep = BooleanArray(n); val stack = IntArray(n); var sp = 0
        for (i in 0 until n) if (depth[i] > tHi && depth[i] > tLo) { keep[i] = true; stack[sp++] = i }
        while (sp > 0) {
            val i = stack[--sp]; val x = i % w; val y = i / w
            if (x > 0 && !keep[i - 1] && depth[i - 1] > tLo) { keep[i - 1] = true; stack[sp++] = i - 1 }
            if (x < w - 1 && !keep[i + 1] && depth[i + 1] > tLo) { keep[i + 1] = true; stack[sp++] = i + 1 }
            if (y > 0 && !keep[i - w] && depth[i - w] > tLo) { keep[i - w] = true; stack[sp++] = i - w }
            if (y < h - 1 && !keep[i + w] && depth[i + w] > tLo) { keep[i + w] = true; stack[sp++] = i + w }
        }
        val kb = box(FloatArray(n) { if (keep[it]) 1f else 0f }, w, h, 1)
        return FloatArray(n) {
            val hi = ((depth[it] - tHi) / .08f + .5f).coerceIn(0f, 1f); val lo = (((depth[it] - tLo) / .08f + .5f).coerceIn(0f, 1f) * kb[it]).coerceIn(0f, 1f)
            max(hi, lo)
        }
    }

    /**
     * How much of the cut's outline sits on a real step in depth, 0..1. A figure in front of a backdrop has a step all the way round;
     * a sea, a snow slope or a cloud crossed by the threshold has none (Island .02, Wrath of God .39, Lightning Bolt .40), and cutting
     * there tears the picture. Outline: figure pixels with a backdrop neighbour, the window's own 3 px border left out. Step: the
     * most minus the least depth in a box of [EDGE_R] of the width each way.
     */
    internal fun edge(m: FloatArray, depth: FloatArray, w: Int, h: Int): Float {
        val r = max(2, Math.round(EDGE_R * w)); var n = 0; var on = 0
        for (y in 3 until h - 3) for (x in 3 until w - 3) {
            val i = y * w + x
            if (m[i] <= .5f || (m[i - 1] > .5f && m[i + 1] > .5f && m[i - w] > .5f && m[i + w] > .5f)) continue
            var lo = Float.MAX_VALUE; var hi = -Float.MAX_VALUE
            for (yy in max(0, y - r)..min(h - 1, y + r)) for (xx in max(0, x - r)..min(w - 1, x + r)) { val d = depth[yy * w + xx]; if (d < lo) lo = d; if (d > hi) hi = d }
            n++; if (hi - lo > EDGE_STEP) on++
        }
        return if (n == 0) 0f else on.toFloat() / n
    }

    /** 1 on the pieces of figure kept (each at least [ISLAND] of the window, or the biggest), grown 2 px; 0 on loose crumbs. */
    internal fun keep(m: FloatArray, w: Int, h: Int): FloatArray {
        val n = w * h; val label = IntArray(n); val stack = IntArray(n); val sizes = ArrayList<Int>()
        for (start in 0 until n) {
            if (m[start] <= .5f || label[start] != 0) continue
            val id = sizes.size + 1; var sp = 0; var count = 0; stack[sp++] = start; label[start] = id
            while (sp > 0) {
                val i = stack[--sp]; count++; val x = i % w; val y = i / w
                if (x > 0 && label[i - 1] == 0 && m[i - 1] > .5f) { label[i - 1] = id; stack[sp++] = i - 1 }
                if (x < w - 1 && label[i + 1] == 0 && m[i + 1] > .5f) { label[i + 1] = id; stack[sp++] = i + 1 }
                if (y > 0 && label[i - w] == 0 && m[i - w] > .5f) { label[i - w] = id; stack[sp++] = i - w }
                if (y < h - 1 && label[i + w] == 0 && m[i + w] > .5f) { label[i + w] = id; stack[sp++] = i + w }
            }
            sizes += count
        }
        if (sizes.isEmpty()) return FloatArray(n) { 1f }
        val big = BooleanArray(sizes.size + 1); var any = false
        for (k in sizes.indices) if (sizes[k] >= ISLAND * n) { big[k + 1] = true; any = true }
        if (!any) big[1 + sizes.indices.maxByOrNull { sizes[it] }!!] = true
        val grown = box(FloatArray(n) { if (big[label[it]]) 1f else 0f }, w, h, 2)
        return FloatArray(n) { if (grown[it] > 1e-4f) 1f else 0f }
    }

    /**
     * The phone's cut for a framed card. The gate judges the crop at [lw] x [lh] (at most [CUT_WIDTH] wide); a figure that passes
     * ([Gate.cuts]) is drawn at the full [hw] x [hh] crop by the same guided filter, its coefficients resized up and applied to the
     * sharp picture, without its crumbs and with a crisp edge. [walker]: a planeswalker.
     */
    fun cut(lo: IntArray, depth: FloatArray, lw: Int, lh: Int, hi: IntArray, hw: Int, hh: Int, walker: Boolean = false): Cut {
        val gl = gray(lo); val s = split(depth, lw, lh)
        val (ma, mb) = coeffs(gl, grow(depth, lw, lh, s.t, otsu(depth).first), lw, lh, s.r, 2e-3f)
        val m = FloatArray(lw * lh) { (ma[it] * gl[it] + mb[it]).coerceIn(0f, 1f) }
        val g = gate(m, s.sep).let { Gate(it.separation, it.area, it.softEdge, edge = edge(m, depth, lw, lh)) }
        if (!g.cuts(walker)) return Cut(hw, hh, null, g)
        val k = keep(m, lw, lh)
        if (hw == lw && hh == lh) return Cut(hw, hh, FloatArray(hw * hh) { ((m[it] * k[it] - .5f) * CRISP + .5f).coerceIn(0f, 1f) }, g)
        val gh = gray(hi); val A = resize(ma, lw, lh, hw, hh); val B = resize(mb, lw, lh, hw, hh); val K = resize(k, lw, lh, hw, hh)
        return Cut(hw, hh, FloatArray(hw * hh) { (((A[it] * gh[it] + B[it]).coerceIn(0f, 1f) * K[it] - .5f) * CRISP + .5f).coerceIn(0f, 1f) }, g)
    }

    /** The first [RIM_MAX] of the card's width inside the window is searched for the frame's outline; the art's unevenness is read
     *  [RIM_ART0] to [RIM_ART1] in; a line under [RIM_K] of it is outline. A planeswalker's sides: [RIM_WALKER] at least. */
    const val RIM_MAX = .013f; const val RIM_ART0 = .015f; const val RIM_ART1 = .024f; const val RIM_K = .6f; const val RIM_WALKER = .003f

    /**
     * The frame's own dark outline printed inside the art window, per side, in px of this crop: left, top, right, bottom. The window
     * numbers are a rectangle; the printed outline sits a few px inside it and differs per frame and per side. A line of the outline is
     * even along its length, a line of art is not: the rim ends after the last even line, plus one soft px. Both planes end at the rim
     * and the outline itself never moves. [cardW]: the card's width in px at this crop's scale.
     */
    fun rim(argb: IntArray, w: Int, h: Int, cardW: Float, walker: Boolean = false): IntArray {
        val g = gray(argb); val n = max(2, Math.round(RIM_MAX * cardW)); val a0 = Math.round(RIM_ART0 * cardW); val a1 = Math.round(RIM_ART1 * cardW) + 1
        val my = (.15f * h).toInt(); val mx = (.15f * w).toInt(); val out = IntArray(4)
        for (side in 0 until 4) {
            val cols = side == 0 || side == 2; val len = if (cols) h - 2 * my else w - 2 * mx
            if (len < 2 || a1 > (if (cols) w else h)) continue
            val sd = FloatArray(a1) { i ->
                var sum = 0.0; var sq = 0.0
                for (j in 0 until len) {
                    val v = when (side) { 0 -> g[(my + j) * w + i]; 1 -> g[i * w + mx + j]; 2 -> g[(my + j) * w + w - 1 - i]; else -> g[(h - 1 - i) * w + mx + j] }.toDouble()
                    sum += v; sq += v * v
                }
                kotlin.math.sqrt(max(0.0, sq / len - (sum / len) * (sum / len))).toFloat()
            }
            val art = median(sd.copyOfRange(a0, a1))
            for (i in 0 until min(n, a1)) if (sd[i] < RIM_K * art) out[side] = i + 2
        }
        if (walker) { val k = kotlin.math.ceil(RIM_WALKER * cardW).toInt(); out[0] = max(out[0], k); out[2] = max(out[2], k) }
        return out
    }

    /** A planeswalker's two art windows (card space): four abilities (Jace, the Mind Sculptor) or three. */
    val PW_SHORT = floatArrayOf(.073f, .101f, .923f, .484f); val PW_TALL = floatArrayOf(.073f, .101f, .923f, .553f)
    /** [pwWindow]: Jace reads .23 to .34 at three picture sizes, the tall ones .09 at most. */
    const val PW_LINE_MIN = .15f
    /** [pwPin], measured on Jace (2XM 56) and Teferi (DOM 207), in card widths: how far the frame reaches in at the window's top and
     *  bottom rows, how fast that falls off (px per px of height), and the dark line along it. */
    const val PW_IN = .0208f; const val PW_SLOPE = .17f; const val PW_LINE = .0045f

    /**
     * A planeswalker's art window from the whole card's luminance [g] ([w] x [h], 0..1). The type bar's top edge is a strong line right
     * across the card at one of two heights; a strong line at the upper one means the short window. Row offsets are for a 936 px tall
     * scan and scale with the picture.
     */
    fun pwWindow(g: FloatArray, w: Int, h: Int): FloatArray {
        val x0 = (.2f * w).toInt(); val x1 = (.8f * w).toInt(); val k = h / 936f; val n = max(2, Math.round(8 * k)); val o = max(1, Math.round(2 * k))
        val y = Math.round(PW_SHORT[3] * h); var best = 0f
        for (r in max(o, y - n)..min(h - 1, y + n)) {
            var s = 0.0; for (x in x0 until x1) s += kotlin.math.abs(g[r * w + x] - g[(r - o) * w + x])
            best = max(best, (s / max(1, x1 - x0)).toFloat())
        }
        return if (best > PW_LINE_MIN) PW_SHORT else PW_TALL
    }

    /** A planeswalker frame cuts the corners of its art window: 0..1 over the crop, 1 where the printed frame is. It stays at the glass. */
    fun pwPin(w: Int, h: Int, cardW: Float): FloatArray {
        val o = FloatArray(w * h)
        for (y in 0 until h) {
            val d = min(y, h - 1 - y); var run = PW_IN * cardW - PW_SLOPE * d; run = if (run > 0f) run + PW_LINE * cardW else 0f
            if (run <= 0f) continue
            for (x in 0 until w) o[y * w + x] = (run - min(x, w - 1 - x)).coerceIn(0f, 1f)
        }
        return o
    }

    /**
     * Plate and shadow for a framed card's figure at this size (take 5). The plate hides the figure and all of its soft fringe, grown,
     * and with it [pin] (frame parts printed inside the window), so neither a ghost of the figure nor any frame colour ever slides
     * into view. [figure] all zero with a [pin]: a planeswalker with no cut, whose plate still needs its corners filled.
     */
    fun layersWindow(argb: IntArray, figure: FloatArray, pin: FloatArray?, w: Int, h: Int, gate: Gate, room: Float = 0f): Layers {
        val s = w / PROOF_WINDOW
        val grown = box(FloatArray(w * h) { if (max(figure[it], pin?.get(it) ?: 0f) > .06f) 1f else 0f }, w, h, max(1, Math.round(1.5f * s)))
        val hide = BooleanArray(w * h) { grown[it] > 1e-4f }
        // [room]: how far the backdrop slides behind the figure, a share of the width; the shadow softens with it.
        return Layers(w, h, figure, shadow(figure, w, h, max(1, Math.round(3 * s)), max(boxFor(2 * s), Math.round(.3f * room * w))), fill(argb, hide, w, h), hide, gate)
    }

    /** Take 5's slide budget, a share of the window's width: [SLIDE] for every window card, [SLIDE_WALKER] for a planeswalker whose
     *  figure is cut (it stays at the glass); [FOLLOW] how far the cut figure moves along with the backdrop (0 at the glass, 1 with it). */
    const val SLIDE = .025f; const val SLIDE_WALKER = .02f; const val FOLLOW = .5f

    /** Relief light's depth scale (the first mock-up's 3D window, which Randall approved again on 14 Nov: "Way better"). */
    const val RELIEF_S = .26f
    /** Relief map width. */
    const val RELIEF_W = 256

    /**
     * The measured depth as light, never as movement: one light on the picture's relief, the far parts a little darker. [depth] 0..1
     * (nearer = higher) at [w] x [h] over the window; [px] the card-width share of one relief pixel's width. Returns ARGB at
     * [RELIEF_W] wide: R and G the surface normal's x and y (y up on the card) as .5 + .5 v, B how far back (0 at the front).
     * Same steps as the mock-up (web3d.py): blur by a Gaussian of 1.2 px, the front level is the median above the cut, the back is
     * pressed in by [RELIEF_S], the front stands out by .2 and fades to flat in the window's outer tenth.
     */
    fun relief(depth: FloatArray, w: Int, h: Int, winW: Float): Triple<IntArray, Int, Int> {
        val rw = RELIEF_W; val rh = max(2, Math.round(h.toFloat() * rw / w))
        val d = gauss(resize(depth, w, h, rw, rh), rw, rh, 1.2f)
        val t0 = split(d, rw, rh).t
        var above = 0; for (v in d) if (v > t0) above++
        val d0 = if (above > 0) median(FloatArray(above).also { a -> var k = 0; for (v in d) if (v > t0) a[k++] = v }) else median(d)
        val z = FloatArray(rw * rh) { i ->
            val x = i % rw; val y = i / rw; val u = (x + .5f) / rw; val v = (y + .5f) / rh
            var e = (min(min(u, 1 - u), min(v, 1 - v)) / .1f).coerceIn(0f, 1f); e = e * e * (3 - 2 * e)
            val t = d[i] - d0; min(t, 0f) * RELIEF_S + max(t, 0f) * .2f * e
        }
        val px = winW / rw
        val out = IntArray(rw * rh)
        for (y in 0 until rh) for (x in 0 until rw) {
            val i = y * rw + x
            // numpy.gradient: central differences inside, one-sided at the edges
            val gx = when (x) { 0 -> z[i + 1] - z[i]; rw - 1 -> z[i] - z[i - 1]; else -> (z[i + 1] - z[i - 1]) / 2 } / px
            val gy = when (y) { 0 -> z[i + rw] - z[i]; rh - 1 -> z[i] - z[i - rw]; else -> (z[i + rw] - z[i - rw]) / 2 } / px
            val nx = -gx; val ny = gy; val len = kotlin.math.sqrt(nx * nx + ny * ny + 1f)
            fun b(v: Float) = (v.coerceIn(0f, 1f) * 255).roundToInt()
            out[i] = (255 shl 24) or (b(nx / len * .5f + .5f) shl 16) or (b(ny / len * .5f + .5f) shl 8) or b(-z[i] * 2.2f)
        }
        return Triple(out, rw, rh)
    }

    /** A Gaussian blur of [sigma] px, separable, edges reflected (OpenCV's default). */
    fun gauss(a: FloatArray, w: Int, h: Int, sigma: Float): FloatArray {
        val r = kotlin.math.ceil(sigma * 4).toInt(); val k = FloatArray(2 * r + 1) { val x = (it - r).toFloat(); kotlin.math.exp(-x * x / (2 * sigma * sigma)) }
        val sum = k.sum(); for (i in k.indices) k[i] /= sum
        fun refl(i: Int, n: Int): Int { var j = i; while (j < 0 || j >= n) j = if (j < 0) -j else 2 * n - 2 - j; return j }
        val t = FloatArray(w * h); val o = FloatArray(w * h)
        for (y in 0 until h) for (x in 0 until w) { var s = 0f; for (q in -r..r) s += k[q + r] * a[y * w + refl(x + q, w)]; t[y * w + x] = s }
        for (y in 0 until h) for (x in 0 until w) { var s = 0f; for (q in -r..r) s += k[q + r] * t[refl(y + q, h) * w + x]; o[y * w + x] = s }
        return o
    }

    /**
     * The full-art cut (no window: the whole card). The depth cut as above, then the printed words on the art (name, cost, footer,
     * flavour) are pinned to the glass with it: word-shaped clusters of ink strokes, holes filled. Big display titles stay with the art
     * as one piece, and the gate fails a card whose cut would tear one, or whose cut runs over plain art where a seam would show.
     */
    fun cutFull(lo: IntArray, depth: FloatArray, lw: Int, lh: Int, hi: IntArray, hw: Int, hh: Int): Cut {
        val gl = gray(lo); val s = split(depth, lw, lh)
        val (ma, mb) = coeffs(gl, s.soft, lw, lh, s.r, 2e-3f)
        val m = FloatArray(lw * lh) { (ma[it] * gl[it] + mb[it]).coerceIn(0f, 1f) }
        val ink = ink(gl, lw, lh)
        val (words, title) = words(ink, m, lw, lh)
        val g0 = gate(m, s.sep)
        val g = Gate(g0.separation, g0.area, g0.softEdge, weak(gl, m, lw, lh), title)
        if (!g.pass) return Cut(hw, hh, null, g)
        val pin = box(words, lw, lh, 1).let { b -> FloatArray(b.size) { if (words[it] > 0f) 1f else b[it] } }
        val gh = gray(hi); val A = resize(ma, lw, lh, hw, hh); val B = resize(mb, lw, lh, hw, hh); val P = resize(pin, lw, lh, hw, hh)
        return Cut(hw, hh, FloatArray(hw * hh) { max((A[it] * gh[it] + B[it]).coerceIn(0f, 1f), P[it].coerceIn(0f, 1f)) }, g)
    }

    /** Ink strokes: pixels that stand out from their neighbourhood (a Gaussian of 1/150 of the width) by more than 12%. */
    private fun ink(g: FloatArray, w: Int, h: Int): BooleanArray {
        val r = boxFor(w / 150f); val bl = box(box(g, w, h, r), w, h, r)
        return BooleanArray(w * h) { kotlin.math.abs(g[it] - bl[it]) > .12f }
    }

    /** Printed words to pin (1 on their strokes and filled holes) and the worst split of a display title by the cut [m]. */
    private fun words(ink: BooleanArray, m: FloatArray, w: Int, h: Int): Pair<FloatArray, Float> {
        // join letters into words: dilate 3 px across, 1 px down
        val joined = BooleanArray(w * h)
        for (y in 0 until h) for (x in 0 until w) {
            if (!ink[y * w + x]) continue
            for (yy in max(0, y - 1)..min(h - 1, y + 1)) for (xx in max(0, x - 3)..min(w - 1, x + 3)) joined[yy * w + xx] = true
        }
        val label = IntArray(w * h); var n = 0; val stack = IntArray(w * h)
        val pin = FloatArray(w * h); var title = 0f
        for (start in 0 until w * h) {
            if (!joined[start] || label[start] != 0) continue
            n++; var sp = 0; stack[sp++] = start; label[start] = n
            var x0 = w; var y0 = h; var x1 = -1; var y1 = -1
            val members = ArrayList<Int>()
            while (sp > 0) {
                val i = stack[--sp]; members += i
                val x = i % w; val y = i / w
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
                if (x > 0 && joined[i - 1] && label[i - 1] == 0) { label[i - 1] = n; stack[sp++] = i - 1 }
                if (x < w - 1 && joined[i + 1] && label[i + 1] == 0) { label[i + 1] = n; stack[sp++] = i + 1 }
                if (y > 0 && joined[i - w] && label[i - w] == 0) { label[i - w] = n; stack[sp++] = i - w }
                if (y < h - 1 && joined[i + w] && label[i + w] == 0) { label[i + w] = n; stack[sp++] = i + w }
            }
            val bh = y1 - y0 + 1; val bw = x1 - x0 + 1
            if (bw < 2 * bh) continue
            val strokes = members.filter { ink[it] }
            if (strokes.size < 15) continue
            if (bh >= .012f * h && bh <= .06f * h) {
                // a printed word: its strokes grown a pixel, and the holes inside its letters, stay at the glass
                val bx0 = max(0, x0 - 1); val by0 = max(0, y0 - 1); val bx1 = min(w - 1, x1 + 1); val by1 = min(h - 1, y1 + 1)
                val ww = bx1 - bx0 + 1; val hh = by1 - by0 + 1; val solid = BooleanArray(ww * hh)
                for (i in strokes) { val x = i % w; val y = i / w
                    for (yy in max(by0, y - 1)..min(by1, y + 1)) for (xx in max(bx0, x - 1)..min(bx1, x + 1)) solid[(yy - by0) * ww + xx - bx0] = true }
                val out = BooleanArray(ww * hh); var tp = 0
                for (yy in 0 until hh) for (xx in 0 until ww) if ((yy == 0 || xx == 0 || yy == hh - 1 || xx == ww - 1) && !solid[yy * ww + xx]) { out[yy * ww + xx] = true; stack[tp++] = yy * ww + xx }
                while (tp > 0) {
                    val k = stack[--tp]; val xx = k % ww; val yy = k / ww
                    if (xx > 0 && !solid[k - 1] && !out[k - 1]) { out[k - 1] = true; stack[tp++] = k - 1 }
                    if (xx < ww - 1 && !solid[k + 1] && !out[k + 1]) { out[k + 1] = true; stack[tp++] = k + 1 }
                    if (yy > 0 && !solid[k - ww] && !out[k - ww]) { out[k - ww] = true; stack[tp++] = k - ww }
                    if (yy < hh - 1 && !solid[k + ww] && !out[k + ww]) { out[k + ww] = true; stack[tp++] = k + ww }
                }
                for (yy in 0 until hh) for (xx in 0 until ww) if (!out[yy * ww + xx]) pin[(yy + by0) * w + xx + bx0] = 1f
            } else if (bh > .06f * h && bh <= .14f * h) {
                val fr = strokes.count { m[it] > .5f }.toFloat() / strokes.size
                title = max(title, min(fr, 1 - fr))
            }
        }
        return pin to title
    }

    /** The share of the cut's edge (0.3 to 0.7) where the picture has no line within 2 px to hide a seam. */
    private fun weak(g: FloatArray, m: FloatArray, w: Int, h: Int): Float {
        val G = FloatArray(w * h)
        for (y in 1 until h - 1) for (x in 1 until w - 1) {
            val i = y * w + x; G[i] = min(.5f, kotlin.math.hypot(g[i + 1] - g[i - 1], g[i + w] - g[i - w]))
        }
        var edge = 0; var plain = 0
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x; if (m[i] <= .3f || m[i] >= .7f) continue
            edge++; var best = 0f
            for (yy in max(0, y - 2)..min(h - 1, y + 2)) for (xx in max(0, x - 2)..min(w - 1, x + 2)) best = max(best, G[yy * w + xx])
            if (best < .06f) plain++
        }
        return if (edge == 0) 0f else plain.toFloat() / edge
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

    /**
     * Full arts: the plate runs [pad] px past the card's own edge on every side (and fills its see-through corners), so the slide never
     * uncovers anything but backdrop. Every array is (w + 2 pad) x (h + 2 pad); the card sits in the middle. Proof scale: a 360 px card.
     */
    fun layersFull(argb: IntArray, figure: FloatArray, w: Int, h: Int, pad: Int, gate: Gate): Layers {
        val W = w + 2 * pad; val H = h + 2 * pad; val s = w / 360f
        val a = IntArray(W * H); val f = FloatArray(W * H); val inside = BooleanArray(W * H)
        for (y in 0 until h) for (x in 0 until w) {
            val i = (y + pad) * W + x + pad; a[i] = argb[y * w + x]; f[i] = figure[y * w + x]; inside[i] = (argb[y * w + x] ushr 24) >= 128
        }
        val grown = box(FloatArray(W * H) { if (f[it] > .15f) 1f else 0f }, W, H, max(1, Math.round(s)))
        val hide = BooleanArray(W * H) { grown[it] > 1e-4f || !inside[it] }
        return Layers(W, H, f, shadow(f, W, H, max(1, Math.round(3 * s)), boxFor(2 * s)), fill(a, hide, W, H), hide, gate)
    }

    /** Everything for one window crop at one size (the take-3 pipeline end to end). */
    fun layers(argb: IntArray, depth: FloatArray, w: Int, h: Int): Layers {
        val (m, gate) = matte(gray(argb), depth, w, h)
        if (!gate.pass) return Layers(w, h, m, FloatArray(w * h), argb, BooleanArray(w * h), gate)
        return layers(argb, m, w, h, gate)
    }
}
