package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.foil.MtgFoil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.DataInputStream
import java.util.zip.GZIPInputStream
import kotlin.math.abs

/** The app measures a Magic card's inks exactly like the site: same pixels in, same maps out. Fixture: the site's own
 *  analyzeMtgCard on five real printings at analysis size (mtg-foil-port.json goldenAnalysis: gilded, neon ink, textured,
 *  traditional M15, etched), packed as input RGB + the site's mask RGBA + relief R. */
class MtgFoilTest {
    @Test fun inksMeasureLikeTheSite() {
        val inp = DataInputStream(GZIPInputStream(javaClass.getResourceAsStream("/foil/mtg-golden.bin.gz")!!))
        repeat(inp.readInt()) {
            val name = ByteArray(inp.readInt()).also { inp.readFully(it) }.decodeToString()
            val W = inp.readInt(); val H = inp.readInt(); val N = W * H
            val rgb = ByteArray(N * 3).also { inp.readFully(it) }
            val mask = ByteArray(N * 4).also { inp.readFully(it) }
            val height = ByteArray(N).also { inp.readFully(it) }
            fun u(b: Byte) = b.toInt() and 255
            val argb = IntArray(N) { i -> (255 shl 24) or (u(rgb[i * 3]) shl 16) or (u(rgb[i * 3 + 1]) shl 8) or u(rgb[i * 3 + 2]) }
            assertEquals(W to H, MtgFoil.analysisSize(488, 680))
            val m = MtgFoil.analyze(argb, W, H)
            // gold, neon, paper in the mask's RGB; the site's "drawn lines" (its mask alpha) in our relief green; height in relief red
            val off = IntArray(5); var worst = 0
            for (k in 0 until N) {
                val pairs = intArrayOf(u(m.mask[k * 4]) - u(mask[k * 4]), u(m.mask[k * 4 + 1]) - u(mask[k * 4 + 1]), u(m.mask[k * 4 + 2]) - u(mask[k * 4 + 2]),
                    u(m.relief[k * 4 + 1]) - u(mask[k * 4 + 3]), u(m.relief[k * 4]) - u(height[k]))
                pairs.forEachIndexed { c, d -> worst = maxOf(worst, abs(d)); if (abs(d) > 1) off[c]++ }
                assertEquals(-1, m.mask[k * 4 + 3].toInt()); assertEquals(-1, m.relief[k * 4 + 3].toInt())
            }
            // Float32 (site) vs Kotlin float: a step of 1 is rounding; more than that must be (nearly) nowhere.
            off.forEachIndexed { c, n -> assertTrue("$name channel $c: $n of $N pixels differ by more than 1 (worst $worst)", n < N / 2000) }
        }
    }

    @Test fun onlyInkSelectiveRecipesMeasure() {
        assertTrue(!MtgFoil.needsMaps(cover = 0f, relief = 0f, film = 0f, pat = 1f))   // traditional
        assertTrue(!MtgFoil.needsMaps(cover = 1f, relief = 0f, film = 0f, pat = 4f))   // etched frame
        assertTrue(MtgFoil.needsMaps(cover = 2f, relief = 0f, film = 0f, pat = 18f))   // gilded: gold ink
        assertTrue(MtgFoil.needsMaps(cover = 0f, relief = .3f, film = 0f, pat = 5f))   // textured
        assertTrue(MtgFoil.needsMaps(cover = 0f, relief = 0f, film = 1f, pat = 1f))    // oil slick film
    }
}
