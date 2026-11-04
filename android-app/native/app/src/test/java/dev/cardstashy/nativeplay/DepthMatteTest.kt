package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.foil.DepthMatte
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.DataInputStream
import java.util.zip.GZIPInputStream
import kotlin.math.abs

/** The phone cuts a card's figure exactly like the approved take-3 pipeline: same art and depth in, same matte and gate out.
 *  Fixture: depthmatte.py on two real window crops (Dracotail Lukias, Chishiro), packed as crop RGB + depth + matte, all 8-bit. */
class DepthMatteTest {
    private class Case(val w: Int, val h: Int, val argb: IntArray, val depth: FloatArray, val matte: FloatArray, val sep: Float, val area: Float, val soft: Float)

    private fun cases(): List<Case> {
        val inp = DataInputStream(GZIPInputStream(javaClass.getResourceAsStream("/foil/depth-matte-golden.bin.gz")!!))
        fun u(b: Byte) = b.toInt() and 255
        return List(inp.readInt()) {
            val w = inp.readInt(); val h = inp.readInt(); val n = w * h
            val rgb = ByteArray(n * 3).also { inp.readFully(it) }
            val dep = ByteArray(n).also { inp.readFully(it) }; val mat = ByteArray(n).also { inp.readFully(it) }
            Case(w, h, IntArray(n) { i -> (255 shl 24) or (u(rgb[i * 3]) shl 16) or (u(rgb[i * 3 + 1]) shl 8) or u(rgb[i * 3 + 2]) },
                FloatArray(n) { u(dep[it]) / 255f }, FloatArray(n) { u(mat[it]) / 255f }, inp.readFloat(), inp.readFloat(), inp.readFloat())
        }
    }

    @Test fun cutsLikeTheApprovedPipeline() {
        for ((k, c) in cases().withIndex()) {
            val l = DepthMatte.layers(c.argb, c.depth, c.w, c.h)
            var off = 0; var worst = 0f
            for (i in l.figure.indices) { val d = abs(l.figure[i] - c.matte[i]); worst = maxOf(worst, d); if (d > 3 / 255f) off++ }
            // The fixture's depth is stored at 8 bits, the reference ran on floats: a few edge pixels may move a step, no more.
            assertTrue("case $k: $off of ${c.w * c.h} pixels off (worst $worst)", off < c.w * c.h / 200)
            assertEquals("case $k separation", c.sep, l.gate.separation, .01f)
            assertEquals("case $k area", c.area, l.gate.area, .005f)
            assertEquals("case $k soft edge", c.soft, l.gate.softEdge, .005f)
        }
    }

    @Test fun plateKeepsTheBackdropAndShadowHidesAtRest() {
        for (c in cases()) {
            val l = DepthMatte.layers(c.argb, c.depth, c.w, c.h)
            assertTrue(l.gate.toString(), l.gate.pass)
            var under = 0.0; var all = 0.0
            for (i in c.argb.indices) {
                // the backdrop is untouched wherever it shows at rest
                if (!l.hide[i]) assertEquals(c.argb[i], l.plate[i])
                all += l.shadow[i]; if (l.figure[i] > .5f) under += l.shadow[i]
            }
            // the shadow is the figure's own silhouette pulled in and softened: nearly all of it lies under the figure
            assertTrue("shadow under the figure ${under / all}", all > 0 && under / all > .97)
        }
    }

    @Test fun theFullSizeCutKeepsTheApprovedFigure() {
        for ((k, c) in cases().withIndex()) {
            val (m, gate) = DepthMatte.matte(DepthMatte.gray(c.argb), c.depth, c.w, c.h)
            // same size: exactly the matte the gate judged
            val same = DepthMatte.cut(c.argb, c.depth, c.w, c.h, c.argb, c.w, c.h)
            assertEquals(gate.toString(), same.gate.toString()); assertTrue(same.figure!!.contentEquals(m))
            // twice the size (each pixel doubled): the same figure, drawn at the larger size
            val W = c.w * 2; val H = c.h * 2
            val big = IntArray(W * H) { i -> c.argb[(i / W / 2) * c.w + (i % W) / 2] }
            val up = DepthMatte.cut(c.argb, c.depth, c.w, c.h, big, W, H).figure!!
            var off = 0
            for (y in 0 until H) for (x in 0 until W) if ((up[y * W + x] > .5f) != (m[(y / 2) * c.w + x / 2] > .5f)) off++
            assertTrue("case $k: $off of ${W * H} pixels changed side", off < W * H / 50)
        }
    }

    @Test fun aFlatPictureHasNoFigure() {
        val w = 120; val h = 90
        val depth = FloatArray(w * h) { .4f + (it % w) * .001f }
        val l = DepthMatte.layers(IntArray(w * h) { -0x777778 }, depth, w, h)
        assertTrue(l.gate.toString(), !l.gate.pass)
        assertTrue(l.plate.contentEquals(IntArray(w * h) { -0x777778 }))
        assertTrue(l.shadow.all { it == 0f })
    }
}
