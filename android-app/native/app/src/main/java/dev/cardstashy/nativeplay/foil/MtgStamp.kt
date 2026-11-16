package dev.cardstashy.nativeplay.foil

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Magic's holographic security stamp, read from the card picture itself: a line-for-line port of the site's measureStamp
 * (mtg-stamp.js, same thresholds, same flood fills, same joining rule, same mask). Stamps differ by printing (oval, triangle, acorn,
 * heart, circle) and sit at different heights, so nothing here assumes a place or a shape: the stamp is the patch of light fully
 * ringed by the dark border at the bottom centre of the card. No stamp found means no stamp drawn. Geometry is for presentation
 * only, not authentication. Pure Kotlin (no Android types), so it runs in plain JUnit (MtgStampTest).
 */
object MtgStamp {
    /** The stamp's box as fractions of the card, and an alpha mask ([mw] x [mh], one byte per pixel) that follows the stamp's
     *  outline and the brightness of its print. */
    class Stamp(val x: Double, val y: Double, val w: Double, val h: Double, val mw: Int, val mh: Int, val mask: ByteArray, val cover: Double)

    private const val RX0 = .36; private const val RX1 = .64; private const val RY0 = .835; private const val RY1 = .992

    private class Comp(val id: Int, var minX: Int, var maxX: Int, var minY: Int, var maxY: Int) { var area = 0 }

    /** [argb]: the full card's pixels ([W] x [H], Android's ARGB ints, as Bitmap.getPixels gives them). Null: no stamp drawn. */
    fun measure(argb: IntArray?, W: Int, H: Int): Stamp? {
        if (argb == null || W < 120 || H < 160) return null
        val x0 = floor(W * RX0).toInt(); val x1 = ceil(W * RX1).toInt(); val y0 = floor(H * RY0).toInt(); val y1 = min(H, ceil(H * RY1).toInt())
        val w = x1 - x0; val h = y1 - y0; val n = w * h
        val lum = FloatArray(n); val bright = ByteArray(n)
        for (y in 0 until h) for (x in 0 until w) {
            val p = argb[(y + y0) * W + x + x0]
            val l = ((p shr 16) and 255) * .299 + ((p shr 8) and 255) * .587 + (p and 255) * .114
            lum[y * w + x] = l.toFloat(); bright[y * w + x] = if (l >= 58) 1 else 0
        }
        // Light that reaches the edge of the search box is frame, text box or art, never the stamp.
        val out = ByteArray(n); val stack = IntArray(n); var sp = 0
        fun push(i: Int) { if (bright[i].toInt() != 0 && out[i].toInt() == 0) { out[i] = 1; stack[sp++] = i } }
        for (x in 0 until w) { push(x); push((h - 1) * w + x) }
        for (y in 0 until h) { push(y * w); push(y * w + w - 1) }
        while (sp > 0) { val i = stack[--sp]; val x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < n - w) push(i + w) }
        // Enclosed islands of light.
        val label = IntArray(n); val comps = ArrayList<Comp>()
        for (s in 0 until n) {
            if (bright[s].toInt() == 0 || out[s].toInt() != 0 || label[s] != 0) continue
            val id = comps.size + 1; val c = Comp(id, w, 0, h, 0); label[s] = id; stack[sp++] = s
            while (sp > 0) {
                val i = stack[--sp]; val x = i % w; val y = (i - x) / w
                c.area++; if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x; if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y
                for (dy in -1..1) for (dx in -1..1) {
                    val X = x + dx; val Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue
                    val j = Y * w + X; if (bright[j].toInt() != 0 && out[j].toInt() == 0 && label[j] == 0) { label[j] = id; stack[sp++] = j }
                }
            }
            comps.add(c)
        }
        val card = W.toDouble() * H; val mid = W * .5 - x0
        val main = comps.filter { it.area >= card * .00035 && abs((it.minX + it.maxX) / 2.0 - mid) <= W * .045 }.sortedByDescending { it.area }.firstOrNull() ?: return null
        // A stamp's own dark lines can split it into pieces. A piece joins when it is level with the main piece, inside the widest
        // box a stamp can take around the centre line, and only a thin dark line away from what is already joined.
        val keep = HashSet<Int>().apply { add(main.id) }
        val rx = W * .058; val gy = (main.maxY - main.minY + 1) * .35; val gap = max(2.0, W * .008)
        var bx0 = main.minX; var bx1 = main.maxX; var by0 = main.minY; var by1 = main.maxY
        var grew = true
        while (grew) {
            grew = false
            for (c in comps) {
                if (c.id in keep || c.area < max(3.0, main.area * .03)) continue
                if (c.minX >= mid - rx && c.maxX <= mid + rx && c.minY >= main.minY - gy && c.maxY <= main.maxY + gy && c.minX <= bx1 + gap && c.maxX >= bx0 - gap) {
                    keep.add(c.id); grew = true; bx0 = min(bx0, c.minX); bx1 = max(bx1, c.maxX); by0 = min(by0, c.minY); by1 = max(by1, c.maxY)
                }
            }
        }
        val mw = bx1 - bx0 + 1; val mh = by1 - by0 + 1
        if (mw < W * .035 || mw > W * .14 || mh < H * .016 || mh > H * .08 || mw.toDouble() / mh < .55 || mw.toDouble() / mh > 3.6) return null
        if (abs((bx0 + bx1) / 2.0 - mid) > W * .04) return null
        // Solid outline: a pixel is inside when it lies between the stamp's first and last pixel on both its row and its column.
        fun on(x: Int, y: Int) = label[(y + by0) * w + x + bx0] in keep
        val rowA = IntArray(mh) { mw }; val rowB = IntArray(mh) { -1 }; val colA = IntArray(mw) { mh }; val colB = IntArray(mw) { -1 }
        var filled = 0
        for (y in 0 until mh) for (x in 0 until mw) if (on(x, y)) { if (x < rowA[y]) rowA[y] = x; if (x > rowB[y]) rowB[y] = x; if (y < colA[x]) colA[x] = y; if (y > colB[x]) colB[x] = y }
        val shape = ByteArray(mw * mh)
        for (y in 0 until mh) for (x in 0 until mw) if (x >= rowA[y] && x <= rowB[y] && y >= colA[x] && y <= colB[x]) { shape[y * mw + x] = 1; filled++ }
        if (filled < mw * mh * .42 || filled < card * .0005 || filled > card * .0065) return null
        // Shine goes where the print is bright (the silver), not on its dark lines; the rim is feathered by one pixel.
        val raw = FloatArray(mw * mh)
        for (y in 0 until mh) for (x in 0 until mw) if (shape[y * mw + x].toInt() != 0) {
            val l = lum[(y + by0) * w + x + bx0].toDouble(); raw[y * mw + x] = max(0.0, min(1.0, (l - 45) / 95)).toFloat()
        }
        val mask = ByteArray(mw * mh)
        for (y in 0 until mh) for (x in 0 until mw) {
            var s = 0.0; var k = 0
            for (dy in -1..1) for (dx in -1..1) { val X = x + dx; val Y = y + dy; k++; if (X >= 0 && Y >= 0 && X < mw && Y < mh) s += raw[Y * mw + X].toDouble() }
            val v = Math.round(255 * (raw[y * mw + x].toDouble() * .6 + s / k * .4) * shape[y * mw + x]).toInt()
            mask[y * mw + x] = v.coerceIn(0, 255).toByte()
        }
        return Stamp((bx0 + x0).toDouble() / W, (by0 + y0).toDouble() / H, mw.toDouble() / W, mh.toDouble() / H, mw, mh, mask, filled.toDouble() / (mw * mh))
    }
}
