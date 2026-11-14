package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.foil.DepthMatte
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.DataInputStream
import java.util.zip.GZIPInputStream
import kotlin.math.abs

/**
 * Take 5 of the 3D window (Randall 14 Nov on the 3D Jace, 2XM 56: "the mapping is kinda bad"; the reworked mock-up: "3d is good").
 * The phone must cut, gate and frame each card exactly like the reference that drew the mock-up (design/foil-depth-src/take4,
 * matte4.py). Fixture (golden5.py): five real window crops at the cut's size with their measured depth, 8 bits, and what the
 * reference makes of exactly those bytes: Liliana of the Veil (DMU 97) and Sheoldred (DMU 107), whose head and arm take 3 left out of
 * the figure; Jace, the Mind Sculptor, a planeswalker; Island and Lightning Bolt, scenery that must not be cut. Then three whole
 * planeswalker cards for the window's height.
 */
class DepthTake5Test {
    private class Case(val key: String, val w: Int, val h: Int, val cardW: Int, val walker: Boolean, val argb: IntArray, val depth: FloatArray,
                       val sep: Float, val area: Float, val soft: Float, val edge: Float, val cut: Boolean, val figure: FloatArray, val rim: IntArray,
                       val points: List<Triple<String, Int, Int>>)
    private class Walker(val key: String, val w: Int, val h: Int, val gray: FloatArray, val short: Boolean)

    private fun read(): Pair<List<Case>, List<Walker>> {
        val inp = DataInputStream(GZIPInputStream(javaClass.getResourceAsStream("/foil/depth-take5-golden.bin.gz")!!))
        fun u(b: Byte) = b.toInt() and 255
        val cases = List(inp.readInt()) {
            val key = inp.readUTF(); val w = inp.readInt(); val h = inp.readInt(); val cardW = inp.readInt(); val walker = inp.readByte() != 0.toByte(); val n = w * h
            val rgb = ByteArray(n * 3).also { inp.readFully(it) }; val dep = ByteArray(n).also { inp.readFully(it) }
            val sep = inp.readFloat(); val area = inp.readFloat(); val soft = inp.readFloat(); val edge = inp.readFloat(); val cut = inp.readByte() != 0.toByte()
            val fig = ByteArray(n).also { inp.readFully(it) }
            val rim = IntArray(4) { inp.readInt() }
            val points = List(inp.readInt()) { Triple(inp.readUTF(), inp.readInt(), inp.readInt()) }
            Case(key, w, h, cardW, walker, IntArray(n) { i -> (255 shl 24) or (u(rgb[i * 3]) shl 16) or (u(rgb[i * 3 + 1]) shl 8) or u(rgb[i * 3 + 2]) },
                FloatArray(n) { u(dep[it]) / 255f }, sep, area, soft, edge, cut, FloatArray(n) { u(fig[it]) / 255f }, rim, points)
        }
        val walkers = List(inp.readInt()) {
            val key = inp.readUTF(); val w = inp.readInt(); val h = inp.readInt()
            val g = ByteArray(w * h).also { inp.readFully(it) }
            Walker(key, w, h, FloatArray(w * h) { u(g[it]) / 255f }, inp.readByte() != 0.toByte())
        }
        return cases to walkers
    }

    @Test fun cutsAndGatesLikeTheReference() {
        val (cases, _) = read()
        assertEquals(listOf("liliana", "sheoldred", "jace", "island", "bolt"), cases.map { it.key })
        for (c in cases) {
            val cut = DepthMatte.cut(c.argb, c.depth, c.w, c.h, c.argb, c.w, c.h, c.walker)
            assertEquals("${c.key} separation", c.sep, cut.gate.separation, .01f)
            assertEquals("${c.key} area", c.area, cut.gate.area, .005f)
            assertEquals("${c.key} soft edge", c.soft, cut.gate.softEdge, .005f)
            assertEquals("${c.key} share of the outline on a real step", c.edge, cut.gate.edge, .01f)
            assertEquals("${c.key} is cut", c.cut, cut.figure != null)
            if (!c.cut) continue
            val f = cut.figure!!
            var off = 0; for (i in f.indices) if (abs(f[i] - c.figure[i]) > 3 / 255f) off++
            // The reference ran on the same 8-bit bytes in floats: only a few edge pixels may move a step.
            assertTrue("${c.key}: $off of ${f.size} figure pixels off", off < f.size / 200)
            // The head, the arm: the parts take 3 left out of the figure are in it now.
            for ((what, x, y) in c.points) assertTrue("${c.key}: $what at $x,$y is at the glass (${f[y * c.w + x]})", f[y * c.w + x] > .9f)
        }
        // The two scenery cards and the cut cards, as the mock-up showed them.
        assertTrue(cases.first { it.key == "liliana" }.cut && cases.first { it.key == "sheoldred" }.cut && cases.first { it.key == "jace" }.cut)
        assertTrue(!cases.first { it.key == "island" }.cut && !cases.first { it.key == "bolt" }.cut)
    }

    /** The gate judges the crop at the cut's size; the figure is then drawn at the sharp picture's size by the same filter. Twice the
     *  size (each pixel doubled): the same figure. */
    @Test fun theFullSizeCutKeepsTheFigure() {
        for (c in read().first.filter { it.cut }) {
            val same = DepthMatte.cut(c.argb, c.depth, c.w, c.h, c.argb, c.w, c.h, c.walker).figure!!
            val W = c.w * 2; val H = c.h * 2
            val big = IntArray(W * H) { i -> c.argb[(i / W / 2) * c.w + (i % W) / 2] }
            val up = DepthMatte.cut(c.argb, c.depth, c.w, c.h, big, W, H, c.walker).figure!!
            var off = 0
            for (y in 0 until H) for (x in 0 until W) if ((up[y * W + x] > .5f) != (same[(y / 2) * c.w + x / 2] > .5f)) off++
            assertTrue("${c.key}: $off of ${W * H} pixels changed side", off < W * H / 50)
        }
    }

    @Test fun frameOutlineIsFoundPerSide() {
        for (c in read().first) {
            val rim = DepthMatte.rim(c.argb, c.w, c.h, c.cardW.toFloat(), c.walker)
            for (s in 0 until 4) assertTrue("${c.key} rim side $s: ${rim.toList()} vs ${c.rim.toList()}", abs(rim[s] - c.rim[s]) <= 1)
        }
    }

    @Test fun planeswalkerWindowHeight() {
        for (wk in read().second) {
            val win = DepthMatte.pwWindow(wk.gray, wk.w, wk.h)
            assertArrayEquals(wk.key, if (wk.short) DepthMatte.PW_SHORT else DepthMatte.PW_TALL, win, 0f)
        }
    }

    @Test fun planeswalkerCornersStayWithTheFrame() {
        val w = 300; val h = 200; val pin = DepthMatte.pwPin(w, h, 340f)
        assertTrue("top corner is frame", pin[0] > .99f && pin[w - 1] > .99f && pin[(h - 1) * w] > .99f)
        assertEquals("middle of the window is art", 0f, pin[(h / 2) * w + w / 2], 0f)
        assertEquals("middle of the side is art", 0f, pin[(h / 2) * w], 0f)
    }

    /** The relief light (mock-up v9): a flat picture gets a straight-up surface and nothing pressed back; a near square on a far
     *  backdrop gets the backdrop pressed back and its edges turned outwards (R is the normal's x, G its y with y up, B how far back). */
    @Test fun reliefLightsTheDepth() {
        val w = 160; val h = 120
        val (flat, rw, rh) = DepthMatte.relief(FloatArray(w * h) { .5f }, w, h, .85f)
        assertEquals(DepthMatte.RELIEF_W, rw)
        for (p in flat) { assertEquals(128f, (p shr 16 and 255).toFloat(), 1f); assertEquals(128f, (p shr 8 and 255).toFloat(), 1f); assertEquals(0, p and 255) }
        val d = FloatArray(w * h) { i -> val x = i % w; val y = i / w; if (x in 50..110 && y in 35..85) .9f else .2f }
        val (r, _, rh2) = DepthMatte.relief(d, w, h, .85f)
        fun at(x: Int, y: Int) = r[y * rw + x]
        val cx = rw / 2; val cy = rh2 / 2
        assertTrue("the backdrop is pressed back", (at(3, 3) and 255) > 100 && (at(cx, cy) and 255) == 0)
        val right = (110.5f / w * rw).toInt(); val left = (50f / w * rw).toInt(); val top = (35f / h * rh2).toInt()
        assertTrue("right edge faces right", (at(right, cy) shr 16 and 255) > 150)
        assertTrue("left edge faces left", (at(left, cy) shr 16 and 255) < 106)
        assertTrue("top edge faces up", (at(cx, top) shr 8 and 255) > 150)
    }

    @Test fun noCutLeavesNoFigure() {
        val c = read().first.first { it.key == "island" }
        assertNull(DepthMatte.cut(c.argb, c.depth, c.w, c.h, c.argb, c.w, c.h).figure)
    }
}
