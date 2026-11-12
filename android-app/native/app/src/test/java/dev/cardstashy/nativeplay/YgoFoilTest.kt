package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.foil.CardFinish
import dev.cardstashy.nativeplay.foil.YgoFoil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.GZIPInputStream
import kotlin.math.abs
import kotlin.math.roundToInt

/** The app measures a Yu-Gi-Oh! card exactly like the site: same pixels in, same maps out (fixture made by the site's own
 *  ygo-foil-analysis.js and ygo-name-foil.js on Dracotail Lukias at half size). */
class YgoFoilTest {
    @Test fun measuringMatchesTheSite() {
        val raw = GZIPInputStream(javaClass.getResourceAsStream("/foil/lukias-ref.bin.gz")!!).readBytes()
        val bb = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN); val W = bb.int; val H = bb.int; val N = W * H
        var o = 8
        val rgba = raw.copyOfRange(o, o + N * 4); o += N * 4
        val mask = raw.copyOfRange(o, o + N * 4); o += N * 4
        val relief = raw.copyOfRange(o, o + N * 4); o += N * 4
        val glyph = raw.copyOfRange(o, raw.size)
        val argb = IntArray(N) { i -> (255 shl 24) or ((rgba[i * 4].toInt() and 255) shl 16) or ((rgba[i * 4 + 1].toInt() and 255) shl 8) or (rgba[i * 4 + 2].toInt() and 255) }
        val m = YgoFoil.analyze(argb, W, H)
        val box = YgoFoil.Layout.STANDARD.art
        val ax0 = (box[0] * W).roundToInt() + 1; val ay0 = (box[1] * H).roundToInt() + 1; val ax1 = (box[2] * W).roundToInt() - 1; val ay1 = (box[3] * H).roundToInt() - 1
        fun u(b: Byte) = b.toInt() and 255
        val off = IntArray(5); var worst = 0
        for (j in 0 until H) for (i in 0 until W) {
            val k = (j * W + i) * 4; val art = i >= ax0 && i < ax1 && j >= ay0 && j < ay1
            val pairs = listOf(u(m.mask[k]) to u(mask[k]), u(m.mask[k + 1]) to u(mask[k + 1]),
                u(m.mask[k + 2]) to (if (art) u(relief[k + 3]) else u(mask[k + 2])), u(m.relief[k]) to u(relief[k]), u(m.relief[k + 1]) to u(relief[k + 1]))
            pairs.forEachIndexed { c, (a, b) -> val d = abs(a - b); worst = maxOf(worst, d); if (d > 2) off[c]++ }
        }
        // Float32 (site) vs Kotlin float rounding: allow a step of 2 on a handful of pixels, never a shifted map.
        off.forEachIndexed { c, n -> assertTrue("channel $c: $n of $N pixels differ by more than 2 (worst $worst)", n < N / 1000) }
        assertEquals(glyph.size, m.glyphW * m.glyphH)
        var gOff = 0; for (i in glyph.indices) if (abs(u(glyph[i]) - u(m.glyph[i])) > 2) gOff++
        assertTrue("name letters: $gOff differ", gOff < glyph.size / 1000)
    }

    @Test fun printingsPickTheirOwnFoil() {
        val starlight = CardFinish.ygo("Starlight Rare", "ROTA-EN001", "2024-11-08", "Effect Monster", "x")!!
        assertEquals("ygo-starlight", starlight.effect); assertEquals(1f, starlight.stars)
        assertEquals(YgoFoil.Name.RAINBOW, starlight.recipe!!.name)
        assertEquals("ygo-ultimate-classic", CardFinish.ygo("Ultimate Rare", "SOI-EN001", "2006-02-01", "Effect Monster", "x")!!.effect)
        assertEquals("ygo-ultimate-prismatic", CardFinish.ygo("Ultimate Rare", "OP16-EN001", "2021-01-01", "Effect Monster", "x")!!.effect)
        assertEquals("ygo-super-parallel-shatter", CardFinish.ygo("Duel Terminal Super Parallel Rare", "DT05-EN001", "", "Effect Monster", "x")!!.effect)
        assertEquals(2f, CardFinish.ygo("Ultra Rare", "MP24-EN001", "2024-01-01", "Effect Monster", "x")!!.stars)
        assertEquals(0f, CardFinish.ygo("Ultra Rare", "LOB-EN001", "2002-03-08", "Normal Monster", "x")!!.stars)
        assertEquals(YgoFoil.Layout.PENDULUM, CardFinish.ygo("Secret Rare", "AP08-EN004", "2015-01-01", "Pendulum Normal Monster", "x")!!.layout)
        assertNull(CardFinish.ygo("Common", "LOB-EN001", "", "Normal Monster", "x"))
        assertNull(CardFinish.ygo("Ultra Rare", "RD/KP01", "", "Rush Duel Effect Monster", "x"))
    }
    /** smoothstep(edge0, edge1, x) with edge0 >= edge1 is undefined in the shading language: a phone's graphics driver may answer
     *  anything, and one bad number blanks the whole card. The prism pattern (Prismatic Secret Rare, the one rarity whose picture
     *  stayed empty in Randall's 12 Nov recording) was the only place that wrote it that way. No foil shader may. */
    @Test fun noShaderAsksForAnUndefinedSmoothstep() {
        val call = Regex("""smoothstep\(\s*(-?[0-9]*\.?[0-9]+)\s*,\s*(-?[0-9]*\.?[0-9]+)\s*,""")
        for ((name, src) in listOf("ygo" to YgoFoil.AGSL, "ptcg" to dev.cardstashy.nativeplay.foil.PtcgFoil.AGSL, "depth" to dev.cardstashy.nativeplay.foil.Depth.AGSL)) {
            val bad = call.findAll(src).filter { it.groupValues[1].toFloat() >= it.groupValues[2].toFloat() }.map { it.value }.toList()
            assertTrue("$name shader has reversed smoothstep edges: $bad", bad.isEmpty())
        }
    }
}
