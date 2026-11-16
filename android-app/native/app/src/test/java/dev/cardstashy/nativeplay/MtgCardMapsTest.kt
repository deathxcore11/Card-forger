package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.foil.MtgFoil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.DataInputStream
import java.util.zip.GZIPInputStream
import kotlin.math.abs

/** The app's per-card maps match the site's mtgCardMaps: same pixels in, same mask, boxes and star out. Fixture: the site's own
 *  mtgCardMaps run in Chromium on six real scans at 336 x 468, read exactly as the site reads them (scripts/export-foil-maps-golden.mjs):
 *  silver scroll SOA 157 (pat 23), gleaming Smaug HOB 249 (28), a facet foil (21), Eternal Witness P30A 12 and Counterspell DMR 281
 *  (retro, 2), Fracture FDN 439 (11, filed under 2015). The input RGBA is in the fixture, so no JPEG is decoded here. */
class MtgCardMapsTest {
    private class Scan(val name: String, val pat: Int, val frame: String, val fa: FloatArray, val ft: FloatArray, val W: Int, val H: Int,
                       val argb: IntArray, val mask: ByteArray, val art: DoubleArray, val text: DoubleArray, val star: DoubleArray?)

    private val scans: List<Scan> by lazy {
        DataInputStream(GZIPInputStream(javaClass.getResourceAsStream("/foil/mtg-cardmaps-golden.bin.gz")!!)).use { inp ->
            fun str() = ByteArray(inp.readInt()).also { inp.readFully(it) }.decodeToString()
            fun d4() = DoubleArray(4) { inp.readDouble() }
            List(inp.readInt()) {
                val name = str(); val pat = inp.readInt(); val frame = str()
                val fa = d4(); val ft = d4(); val W = inp.readInt(); val H = inp.readInt(); val N = W * H
                val rgba = ByteArray(N * 4).also { inp.readFully(it) }; val mask = ByteArray(N * 4).also { inp.readFully(it) }
                val art = d4(); val text = d4(); val star = if (inp.readByte().toInt() == 1) doubleArrayOf(inp.readDouble(), inp.readDouble()) else null
                fun u(i: Int) = rgba[i].toInt() and 255
                val argb = IntArray(N) { i -> (255 shl 24) or (u(i * 4) shl 16) or (u(i * 4 + 1) shl 8) or u(i * 4 + 2) }
                Scan(name, pat, frame, FloatArray(4) { fa[it].toFloat() }, FloatArray(4) { ft[it].toFloat() }, W, H, argb, mask, art, text, star)
            }
        }
    }
    private val maps by lazy { scans.associate { it.name to MtgFoil.cardMaps(it.argb, it.W, it.H, it.pat, it.fa, it.ft) } }
    private fun scan(name: String) = scans.first { it.name == name }

    @Test fun mapsMatchTheSite() {
        val report = StringBuilder()
        for (s in scans) {
            assertEquals(MtgFoil.MAP_W to MtgFoil.MAP_H, s.W to s.H)
            val m = maps.getValue(s.name); val N = s.W * s.H
            val within1 = IntArray(3); val within3 = IntArray(3); val worst = IntArray(3)
            for (k in 0 until N) for (c in 0 until 3) {
                val d = abs((m.mask[k * 4 + c].toInt() and 255) - (s.mask[k * 4 + c].toInt() and 255))
                if (d <= 1) within1[c]++; if (d <= 3) within3[c]++; worst[c] = maxOf(worst[c], d)
            }
            val line = "${s.name} (pat ${s.pat}): " + (0 until 3).joinToString { c ->
                "RGB"[c] + " ≤1 %.3f%% ≤3 %.3f%% worst %d".format(100.0 * within1[c] / N, 100.0 * within3[c] / N, worst[c]) }
            report.appendLine(line); println(line)
            for (c in 0 until 3) {
                assertTrue("$line: channel ${"RGB"[c]} within 1/255 on under 99.5%", within1[c] >= .995 * N)
                assertTrue("$line: channel ${"RGB"[c]} within 3/255 on under 99.9%", within3[c] >= .999 * N)
                // Every scan but facet matches to the pixel (facet's shard outlines move a few pixels: float colour tests in facets).
                if (s.pat != 21) assertTrue("$line: channel ${"RGB"[c]} must be within 1/255 everywhere", within1[c] == N && worst[c] <= 1)
            }
            for (e in 0 until 4) {
                assertEquals("${s.name} art box side $e", s.art[e], m.boxes.art[e].toDouble(), 1e-4)
                assertEquals("${s.name} text box side $e", s.text[e], m.boxes.text[e].toDouble(), 1e-4)
            }
            if (s.star == null) assertNull("${s.name}: the site finds no star", m.star)
            else {
                assertNotNull("${s.name}: the site finds a star at ${s.star.toList()}", m.star)
                assertEquals(s.star[0], m.star!![0].toDouble(), 1e-4); assertEquals(s.star[1], m.star[1].toDouble(), 1e-4)
            }
        }
    }

    private fun mean(name: String, c: Int, xs: List<ClosedFloatingPointRange<Double>>, y: ClosedFloatingPointRange<Double>): Double {
        val s = scan(name); val m = maps.getValue(name).mask; var sum = 0.0; var n = 0
        for (j in 0 until s.H) for (i in 0 until s.W) {
            val u = (i + .5) / s.W; val v = (j + .5) / s.H
            if (v in y && xs.any { u in it }) { sum += (m[(j * s.W + i) * 4 + c].toInt() and 255) / 255.0; n++ }
        }
        return sum / n
    }

    /** SOA 157: the name plate beside its letters is silver ink, not paper. */
    @Test fun silverScrollNamePlateIsInk() {
        val xs = listOf(.08..0.12, .16..0.20); val y = .06..0.21
        val ink = mean("silverscroll", 0, xs, y); val paper = mean("silverscroll", 2, xs, y)
        assertTrue("name plate ink $ink", ink > .8); assertTrue("name plate paper $paper", paper < .2)
    }

    /** Eternal Witness P30A 12 carries its star by the rules box's bottom left; Counterspell DMR 281 (nonfoil scan) has none. */
    @Test fun scanStars() {
        val w = scan("retro_witness"); val star = maps.getValue("retro_witness").star
        assertNotNull(star)
        assertEquals(w.fa.let { w.ft[0] + .10f }, star!![0], .03f); assertEquals(w.ft[3], star[1], .03f)
        assertNull(maps.getValue("retro_counterspell").star)
    }

    /** Smaug HOB 249: the picture window is the inside of the gold frame. The frame edge is read on its left side and top, where the
     *  gold runs to the card's edge; on the right the picture spills over the frame to the edge (the site's map keeps it, about .35). */
    @Test fun smaugWindow() {
        val centre = mean("gleaming", 1, listOf(.45..0.55), .45..0.55)
        val left = mean("gleaming", 1, listOf(.0..0.03), .0..1.0); val top = mean("gleaming", 1, listOf(.0..1.0), .0..0.05)
        assertTrue("window centre $centre", centre > .9); assertTrue("frame edge left $left", left < .1); assertTrue("frame edge top $top", top < .1)
    }

    /** Fracture FDN 439 is filed under the 2015 frame, but has no picture box lines: its art box is dropped to the whole card. */
    @Test fun fractureArtBoxDropped() {
        assertTrue(maps.getValue("fracture").boxes.art.contentEquals(floatArrayOf(0f, 0f, 1f, 1f)))
    }
}
