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
 * One change from the site, for Android only: the site keeps "drawn lines" in the mask's alpha and stroke strength in the relief's
 * alpha. Android premultiplies bitmap alpha, which would corrupt both, so the maps here are opaque and the lines move to the
 * relief's green channel. The site's shader never reads the stroke direction or strength, so they are not kept.
 */
object MtgFoil {
    /** readFoilPixels(img, 372): half the scan's width, between 64 and 372 pixels, height to scale (488 x 680 -> 244 x 340). */
    fun analysisSize(w: Int, h: Int): Pair<Int, Int> {
        val W = max(64, min(372, (w / 2f).roundToInt()))
        return W to (W.toFloat() * h / w).roundToInt()
    }

    /** True when the recipe reads the measured maps; a plain traditional foil looks the same without them, so it skips the work. */
    fun needsMaps(cover: Float, relief: Float, film: Float, pat: Float) = cover > 1.5f || relief > 0f || film > .5f || abs(pat - 5f) < .5f

    /** mask: R gold ink, G fluorescent ink, B bare paper-white, A 255. relief: R smoothed height, G drawn lines, B 0, A 255. */
    class Maps(val w: Int, val h: Int, val mask: ByteArray, val relief: ByteArray)

    private fun ss(a: Float, b: Float, x: Float): Float { val t = ((x - a) / (b - a)).coerceIn(0f, 1f); return t * t * (3 - 2 * t) }
    private fun q(v: Float): Byte = (v.coerceIn(0f, 1f) * 255).roundToInt().toByte()

    /** analyzeMtgCard(rgba, W, H) over ARGB pixels at analysis size. */
    fun analyze(argb: IntArray, W: Int, H: Int): Maps {
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
        val edge0 = FloatArray(N)
        for (j in 1 until H - 1) for (i in 1 until W - 1) {
            val k = j * W + i; val dx = lum[k + 1] - lum[k - 1]; val dy = lum[k + W] - lum[k - W]
            edge0[k] = hypot(dx, dy)
        }
        val edge = YgoFoil.boxBlur(edge0, W, H, 1, 1)
        val goldS = YgoFoil.boxBlur(gold, W, H, 1, 1); val neonS = YgoFoil.boxBlur(neon, W, H, 1, 1); val paperS = YgoFoil.boxBlur(paper, W, H, 1, 1)
        val mask = ByteArray(N * 4); val relief = ByteArray(N * 4)
        for (k in 0 until N) {
            mask[k * 4] = q(goldS[k]); mask[k * 4 + 1] = q(neonS[k]); mask[k * 4 + 2] = q(paperS[k]); mask[k * 4 + 3] = -1
            relief[k * 4] = q(height[k]); relief[k * 4 + 1] = q(ss(.05f, .22f, edge[k])); relief[k * 4 + 2] = 0; relief[k * 4 + 3] = -1
        }
        return Maps(W, H, mask, relief)
    }
}
