package dev.cardstashy.nativeplay.foil

/** The card scaled to the foil maps' size the way the site's canvas draws it with high-quality smoothing (a downscale averages each
 *  target pixel's whole footprint). Pure Kotlin, so tests run it on real scans off the phone. */
object MapScale {
    /** Box (area) resample of [sp] from [sw] x [sh] down to [W] x [H]; every source pixel weighs by the share of it a target pixel covers. */
    fun area(sp: IntArray, sw: Int, sh: Int, W: Int, H: Int): IntArray {
        val fx = sw.toDouble() / W; val fy = sh.toDouble() / H
        val out = IntArray(W * H)
        for (y in 0 until H) {
            val y0 = y * fy; val y1 = y0 + fy
            for (x in 0 until W) {
                val x0 = x * fx; val x1 = x0 + fx
                var a = 0.0; var r = 0.0; var g = 0.0; var bl = 0.0; var wsum = 0.0
                var sy = y0.toInt()
                while (sy < y1 && sy < sh) {
                    val wy = minOf(y1, sy + 1.0) - maxOf(y0, sy.toDouble())
                    var sx = x0.toInt()
                    while (sx < x1 && sx < sw) {
                        val w = wy * (minOf(x1, sx + 1.0) - maxOf(x0, sx.toDouble())); val p = sp[sy * sw + sx]
                        a += w * (p ushr 24); r += w * ((p shr 16) and 255); g += w * ((p shr 8) and 255); bl += w * (p and 255); wsum += w
                        sx++
                    }
                    sy++
                }
                fun c(v: Double) = (v / wsum + .5).toInt().coerceIn(0, 255)
                out[y * W + x] = (c(a) shl 24) or (c(r) shl 16) or (c(g) shl 8) or c(bl)
            }
        }
        return out
    }
}
