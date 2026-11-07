package dev.cardstashy.nativeplay.foil

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Magic foil's measured maps, ported from the site's mtg-foil-analysis.js (analyzeMtgCard, generated port data at 6ceede8c).
 * The site reads each printing's inks from its own scan: gold ink, fluorescent ink, bare paper, the drawn lines, and a smoothed
 * height for relief and thin film. Ink-selective treatments (gilded, neon, invisible ink, textured, raised) then shine only where
 * that ink is printed, instead of across the whole card.
 *
 * One change from the site, for Android only: the site keeps "drawn lines" in the mask's alpha and the stroke direction and strength
 * in the relief's G/B/A. Android premultiplies bitmap alpha, which would corrupt them, so the maps here are opaque: the lines move to
 * the relief's green channel and the stroke (cos 2θ, sin 2θ, strength) gets its own map, which steers the grating along the drawn
 * lines (traditional, raised and textured foils), so the rainbow streaks run along the art like real foil pressed under a plate.
 *
 * Facet foil (app first, 7 Nov): the printed glass shards are cut, each one its own flat mirror. [facets] finds them once, at analysis
 * time: real connected shards split by their printed neon outlines, each with a fixed hashed tilt, so a shard flashes in one piece.
 */
object MtgFoil {
    /** readFoilPixels(img, 372): half the scan's width, between 64 and 372 pixels, height to scale (488 x 680 -> 244 x 340). */
    fun analysisSize(w: Int, h: Int): Pair<Int, Int> {
        val W = max(64, min(372, (w / 2f).roundToInt()))
        return W to (W.toFloat() * h / w).roundToInt()
    }

    /** Facet foil's pattern number (MTG_PATTERN.facet in the site prototype of 7 Nov). */
    const val FACET = 21f

    /** Patterns whose grating follows the drawn lines (traditional, textured, raised): they read the measured stroke. */
    fun steered(pat: Float) = abs(pat - 1f) < .5f || abs(pat - 5f) < .5f || abs(pat - 17f) < .5f

    /** True when the recipe reads the measured maps: ink-selective covers, relief, film, the stroke-steered sheets and facet shards.
     *  Etched and the other fixed patterns look the same without them, so they skip the work. */
    fun needsMaps(cover: Float, relief: Float, film: Float, pat: Float) = cover > 1.5f || relief > 0f || film > .5f || steered(pat) || abs(pat - FACET) < .5f

    /** mask: R gold ink, G fluorescent ink, B bare paper-white, A 255. relief: R smoothed height, G drawn lines, B facet cut edge (0 off
     *  facet foil), A 255. stroke: R/G stroke direction (cos 2θ, sin 2θ as .5 + .5 v), B stroke strength, A 255.
     *  facet (facet foil only): R/G the shard's hashed tilt seed, B shard, A 255. */
    class Maps(val w: Int, val h: Int, val mask: ByteArray, val relief: ByteArray, val stroke: ByteArray, val facet: ByteArray? = null)

    private fun ss(a: Float, b: Float, x: Float): Float { val t = ((x - a) / (b - a)).coerceIn(0f, 1f); return t * t * (3 - 2 * t) }
    private fun q(v: Float): Byte = (v.coerceIn(0f, 1f) * 255).roundToInt().toByte()

    /** analyzeMtgCard(rgba, W, H) over ARGB pixels at analysis size. [facetText]: the frame's text box when the printing is facet foil,
     *  so its shards are cut too (null for every other foil). */
    fun analyze(argb: IntArray, W: Int, H: Int, facetText: FloatArray? = null): Maps {
        val N = W * H
        val lum = FloatArray(N); val gold = FloatArray(N); val neon = FloatArray(N); val paper = FloatArray(N)
        for (i in 0 until N) {
            val p = argb[i]
            val r = (p shr 16 and 255) / 255f; val g = (p shr 8 and 255) / 255f; val b = (p and 255) / 255f
            val mx = max(r, max(g, b)); val mn = min(r, min(g, b)); val c = mx - mn; val s = if (mx > 0f) c / mx else 0f
            lum[i] = .2126f * r + .7152f * g + .0722f * b
            var hue = 0f
            if (c > 1e-4f) { hue = if (mx == r) ((g - b) / c + 6) % 6 else if (mx == g) (b - r) / c + 2 else (r - g) / c + 4; hue *= 60 }
            // Gold ink: warm yellow-orange, moderately saturated, mid-to-bright.
            gold[i] = ss(.28f, .45f, s) * ss(.38f, .55f, mx) * (1 - ss(4f, 10f, abs(hue - 44) - 14))
            // Fluorescent inks sit at the edge of sRGB: nearly full saturation and value.
            neon[i] = ss(.72f, .9f, s) * ss(.72f, .92f, mx)
            paper[i] = (1 - ss(.08f, .2f, s)) * ss(.66f, .82f, lum[i])
        }
        val height = YgoFoil.boxBlur(lum, W, H, 2, 2)
        val edge0 = FloatArray(N); val jxx = FloatArray(N); val jyy = FloatArray(N); val jxy = FloatArray(N)
        for (j in 1 until H - 1) for (i in 1 until W - 1) {
            val k = j * W + i; val dx = lum[k + 1] - lum[k - 1]; val dy = lum[k + W] - lum[k - W]
            edge0[k] = hypot(dx, dy); jxx[k] = dx * dx; jyy[k] = dy * dy; jxy[k] = dx * dy
        }
        val edge = YgoFoil.boxBlur(edge0, W, H, 1, 1)
        // Structure tensor (the site's analyzer): the drawn line's direction as a doubled angle, so a line and its reverse agree.
        val sxx = YgoFoil.boxBlur(jxx, W, H, 3); val syy = YgoFoil.boxBlur(jyy, W, H, 3); val sxy = YgoFoil.boxBlur(jxy, W, H, 3)
        val goldS = YgoFoil.boxBlur(gold, W, H, 1, 1); val neonS = YgoFoil.boxBlur(neon, W, H, 1, 1); val paperS = YgoFoil.boxBlur(paper, W, H, 1, 1)
        val cut = facetText?.let { facets(argb, W, H, it) }
        val mask = ByteArray(N * 4); val relief = ByteArray(N * 4); val stroke = ByteArray(N * 4)
        for (k in 0 until N) {
            mask[k * 4] = q(goldS[k]); mask[k * 4 + 1] = q(neonS[k]); mask[k * 4 + 2] = q(paperS[k]); mask[k * 4 + 3] = -1
            relief[k * 4] = q(height[k]); relief[k * 4 + 1] = q(ss(.05f, .22f, edge[k])); relief[k * 4 + 2] = if (cut != null) q(cut.edge[k]) else 0; relief[k * 4 + 3] = -1
            val a = sxx[k] - syy[k]; val b = 2 * sxy[k]; val m = hypot(a, b); val coh = m / (sxx[k] + syy[k] + 1e-6f)
            stroke[k * 4] = q(a / (m + 1e-9f) * .5f + .5f); stroke[k * 4 + 1] = q(b / (m + 1e-9f) * .5f + .5f)
            stroke[k * 4 + 2] = q(ss(.15f, .7f, coh) * min(1f, m * 400)); stroke[k * 4 + 3] = -1
        }
        return Maps(W, H, mask, relief, stroke, cut?.facet)
    }

    /** Facet foil's cut: [facet] RGBA (R/G the shard's tilt seed, B shard, A 255), [edge] the printed cut edges next to a shard (0..1),
     *  [shard] the shard pieces as a 0/1 mask and [pieces] how many there are. */
    class Facets(val facet: ByteArray, val edge: FloatArray, val shard: FloatArray, val pieces: Int)

    /**
     * Finds the printed glass shards once per card (never per pixel per frame). A shard's face is pale, low-saturation glass (sat < .3,
     * lum > .35, blue at least red) outside the text box and the name bar; its printed outline is a saturated neon line. Faces are split
     * into real connected pieces by those lines (4-connected; the lines and boxes are walls), crumbs (a letter, a highlight) are let go,
     * and each piece then takes in its own darker blue facets, grown a few pixels, never across a line or into a box, so a shard
     * flashes in one piece. Each piece's tilt seed is hashed from where it starts, so the same card always cuts the same way.
     * Sizes are set at the analysis width of a normal scan (244 px) and scale with [W]. [text] is the frame's text box in card space.
     */
    fun facets(argb: IntArray, W: Int, H: Int, text: FloatArray): Facets {
        val N = W * H; val s = W / 244f
        val line = BooleanArray(N); val wall = BooleanArray(N); val seed = BooleanArray(N); val grow = BooleanArray(N)
        for (k in 0 until N) {
            val p = argb[k]; val u = (k % W + .5f) / W; val v = (k / W + .5f) / H
            val r = (p shr 16 and 255) / 255f; val g = (p shr 8 and 255) / 255f; val b = (p and 255) / 255f
            val mx = max(r, max(g, b)); val mn = min(r, min(g, b)); val sat = if (mx > 0f) (mx - mn) / mx else 0f
            val lum = .2126f * r + .7152f * g + .0722f * b
            val across = u >= text[0] && u <= text[2]
            val boxed = across && (v >= text[1] && v <= text[3] || v >= .035f && v <= .105f)
            line[k] = sat > .55f && mx > .6f
            wall[k] = boxed || line[k]
            if (wall[k]) continue
            seed[k] = sat < .3f && lum > .35f && b >= r
            grow[k] = seed[k] || (b - r > .04f && b > .12f) || (sat < .3f && lum > .3f && b >= r - .01f)
        }
        val label = IntArray(N); val queue = IntArray(N); val starts = ArrayList<Int>(); var pieces = 0
        val minArea = max(8, (40 * s * s).roundToInt())
        for (k0 in 0 until N) {
            if (!seed[k0] || label[k0] != 0) continue
            val id = starts.size + 1; var head = 0; var tail = 0; queue[tail++] = k0; label[k0] = id
            while (head < tail) {
                val k = queue[head++]; val x = k % W
                if (x > 0 && seed[k - 1] && label[k - 1] == 0) { label[k - 1] = id; queue[tail++] = k - 1 }
                if (x < W - 1 && seed[k + 1] && label[k + 1] == 0) { label[k + 1] = id; queue[tail++] = k + 1 }
                if (k >= W && seed[k - W] && label[k - W] == 0) { label[k - W] = id; queue[tail++] = k - W }
                if (k < N - W && seed[k + W] && label[k + W] == 0) { label[k + W] = id; queue[tail++] = k + W }
            }
            starts.add(k0)
            if (tail < minArea) for (i in 0 until tail) label[queue[i]] = -1 else pieces++
        }
        // Darker facets join their shard one ring of pixels at a time (all shards grow together, so none steals another's).
        var front = (0 until N).filter { label[it] > 0 }.toIntArray()
        repeat(max(1, (10 * s).roundToInt())) {
            val next = ArrayList<Int>()
            for (k in front) {
                val x = k % W; val id = label[k]
                if (x > 0 && grow[k - 1] && label[k - 1] == 0) { label[k - 1] = id; next.add(k - 1) }
                if (x < W - 1 && grow[k + 1] && label[k + 1] == 0) { label[k + 1] = id; next.add(k + 1) }
                if (k >= W && grow[k - W] && label[k - W] == 0) { label[k - W] = id; next.add(k - W) }
                if (k < N - W && grow[k + W] && label[k + W] == 0) { label[k + W] = id; next.add(k + W) }
            }
            front = next.toIntArray()
        }
        // Pinholes (a speck of print the rules missed) close: a free pixel held on three sides by one shard joins it.
        repeat(2) {
            val fill = IntArray(N)
            for (k in 0 until N) {
                if (label[k] > 0 || wall[k]) continue
                val x = k % W
                val n = intArrayOf(if (x > 0) label[k - 1] else 0, if (x < W - 1) label[k + 1] else 0, if (k >= W) label[k - W] else 0, if (k < N - W) label[k + W] else 0)
                n.firstOrNull { id -> id > 0 && n.count { it == id } >= 3 }?.let { fill[k] = it }
            }
            for (k in 0 until N) if (fill[k] > 0) label[k] = fill[k]
        }
        val shard = FloatArray(N); val jx = FloatArray(N); val jy = FloatArray(N)
        for (k in 0 until N) {
            val id = label[k]
            if (id > 0) {
                val k0 = starts[id - 1]; val sx = (k0 % W).toFloat() / W * 97f; val sy = (k0 / W).toFloat() / H * 97f
                shard[k] = 1f; jx[k] = hash(sx, sy); jy[k] = hash(sx + 17.31f, sy + 17.31f)
            }
        }
        // Soft rims, so a shard's outline is smooth when the map is drawn at card size. The seed is stored multiplied by the shard
        // (premultiplied), so the shader reads it back exactly as seed = RG / B even where the map is filtered across the rim.
        val soft = YgoFoil.boxBlur(shard, W, H, 1, 1); val sjx = YgoFoil.boxBlur(jx, W, H, 1, 1); val sjy = YgoFoil.boxBlur(jy, W, H, 1, 1)
        val facet = ByteArray(N * 4)
        for (k in 0 until N) { facet[k * 4] = q(sjx[k]); facet[k * 4 + 1] = q(sjy[k]); facet[k * 4 + 2] = q(soft[k]); facet[k * 4 + 3] = -1 }
        // Cut edges: the printed neon outline within a few pixels of a shard, not every saturated ink on the card.
        val reach = YgoFoil.boxBlur(shard, W, H, max(1, (3 * s).roundToInt()), 1)
        val edge0 = FloatArray(N) { if (line[it] && reach[it] > 1e-3f) 1f else 0f }
        val rim = YgoFoil.boxBlur(edge0, W, H, 1, 1)
        return Facets(facet, FloatArray(N) { max(edge0[it] * .85f, min(1f, rim[it] * 1.6f)) }, shard, pieces)
    }

    /** The shader's hash() (Foil.AGSL), so a shard's seed is spread like the prototype's hashed facet ids. */
    private fun hash(x: Float, y: Float): Float {
        fun fr(v: Float) = v - kotlin.math.floor(v)
        var px = fr(x * 234.34f); var py = fr(y * 435.345f)
        val d = px * (px + 34.23f) + py * (py + 34.23f); px += d; py += d
        return fr(px * py)
    }
}
