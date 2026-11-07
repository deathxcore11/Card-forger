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

    /** The drawn lines' direction and strength (the site's relief G/B/A, our stroke map RGB) match the site's analyzer: the grating
     *  follows the same lines on both. Fixture: the site's relief.png G/B/A for two of the cards above (mtg-golden). */
    @Test fun strokesMeasureLikeTheSite() {
        val inputs = HashMap<String, IntArray>()
        DataInputStream(GZIPInputStream(javaClass.getResourceAsStream("/foil/mtg-golden.bin.gz")!!)).use { inp ->
            repeat(inp.readInt()) {
                val name = ByteArray(inp.readInt()).also { inp.readFully(it) }.decodeToString()
                val N = inp.readInt() * inp.readInt()
                val rgb = ByteArray(N * 3).also { inp.readFully(it) }; inp.skipNBytes(N * 5L)
                inputs[name] = IntArray(N) { i -> (255 shl 24) or ((rgb[i * 3].toInt() and 255) shl 16) or ((rgb[i * 3 + 1].toInt() and 255) shl 8) or (rgb[i * 3 + 2].toInt() and 255) }
            }
        }
        val inp = DataInputStream(GZIPInputStream(javaClass.getResourceAsStream("/foil/mtg-golden-stroke.bin.gz")!!))
        repeat(inp.readInt()) {
            val name = ByteArray(inp.readInt()).also { inp.readFully(it) }.decodeToString()
            val W = inp.readInt(); val H = inp.readInt(); val N = W * H
            val site = ByteArray(N * 3).also { inp.readFully(it) }
            val m = MtgFoil.analyze(inputs.getValue(name), W, H)
            val off = IntArray(2); var strong = 0; var kept = 0; var ours = 0L; var theirs = 0L
            for (k in 0 until N) {
                // The direction only counts where there is a line (in flat paper it is rounding noise and the shader ignores it).
                val line = (site[k * 3 + 2].toInt() and 255) > 12
                for (c in 0 until 2) if (line && abs((m.stroke[k * 4 + c].toInt() and 255) - (site[k * 3 + c].toInt() and 255)) > 2) off[c]++
                val b = m.stroke[k * 4 + 2].toInt() and 255; val sb = site[k * 3 + 2].toInt() and 255
                ours += b; theirs += sb
                if (sb > 128) { strong++; if (b * 2 >= sb) kept++ }
                assertEquals(-1, m.stroke[k * 4 + 3].toInt()); assertEquals(0, m.relief[k * 4 + 2].toInt()) // no facet edges off facet foil
            }
            assertTrue("$name has drawn lines to follow ($strong strong pixels)", strong > N / 50)
            off.forEachIndexed { c, n -> assertTrue("$name stroke channel $c: $n of $N pixels differ by more than 2", n < N / 500) }
            // Strength is the site's, gated by line evidence: the drawn lines keep it, smooth shading loses it, never the other way.
            assertTrue("$name keeps its strong strokes ($kept of $strong)", kept > strong * .45)
            assertTrue("$name strength only ever gated down ($ours vs the site's $theirs)", ours <= theirs)
        }
    }

    /** Line evidence gates the steering: a smooth shaded gradient (a halo blade) has a coherent direction but no lines, so it keeps
     *  the plain sweep; a field of drawn lines steers. */
    @Test fun smoothShadingIsNotSteered() {
        val W = 244; val H = 340
        val px = IntArray(W * H) { k -> val x = k % W; val y = k / W
            val v = if (y < 170) (60 + x * 150 / W) else if ((x / 3) % 2 == 0) 20 else 230  // top: a smooth ramp; bottom: hard vertical lines
            (255 shl 24) or (v shl 16) or (v shl 8) or v }
        val m = MtgFoil.analyze(px, W, H)
        fun b(x: Int, y: Int) = m.stroke[(y * W + x) * 4 + 2].toInt() and 255
        assertEquals(0, b(120, 80)); assertTrue("lines steer: ${b(120, 260)}", b(120, 260) > 128)
    }

    /** Facet foil: shards are cut once, as real connected pieces split by their printed outline; each piece is one facet with one
     *  tilt, its outline is a cut edge, nothing is cut in the text box, and pale art with no printed outline is not glass. */
    @Test fun facetShardsAreConnectedPieces() {
        val W = 244; val H = 340
        val glass = 0xFFB4BCCC.toInt(); val dark = 0xFF1C2238.toInt(); val neon = 0xFFF2E61A.toInt(); val art = 0xFF6A5A30.toInt()
        val px = IntArray(W * H) { art }
        fun rect(x0: Int, y0: Int, x1: Int, y1: Int, c: Int) { for (y in y0 until y1) for (x in x0 until x1) px[y * W + x] = c }
        rect(20, 60, 120, 140, glass); rect(60, 90, 80, 110, dark)           // shard A, a dark facet inside it
        rect(122, 60, 220, 140, glass)                                        // shard B, touching A but for the outline
        rect(120, 55, 122, 145, neon)                                         // the printed outline between them
        rect(40, 230, 200, 280, glass)                                        // pale paint inside the text box: not a shard
        rect(150, 170, 154, 174, glass)                                       // a crumb: too small to be a shard
        rect(150, 185, 200, 215, glass)                                       // pale art with no outline (teeth, a highlight): not glass
        val text = floatArrayOf(.07f, .62f, .93f, .92f)
        val f = MtgFoil.facets(px, W, H, text)
        assertEquals(2, f.pieces)
        fun seed(x: Int, y: Int) = f.facet[(y * W + x) * 4].toInt() and 255
        fun shard(x: Int, y: Int) = f.facet[(y * W + x) * 4 + 2].toInt() and 255
        assertEquals(255, shard(45, 100)); assertEquals(255, shard(171, 100)); assertEquals(255, shard(70, 100)) // deep inside; the dark facet joins
        assertTrue(shard(21, 100) in 1..120)                                                                     // soft toward the outline
        assertEquals(seed(30, 70), seed(110, 130)); assertEquals(seed(30, 70), seed(70, 100))                  // one piece, one tilt
        assertEquals(seed(30, 70), seed(19, 100))                                                              // carried past the rim, unblurred
        assertTrue(seed(30, 70) != seed(200, 130))                                                             // the next shard tilts its own way
        assertEquals(0, shard(100, 250)); assertEquals(0, shard(152, 172)); assertEquals(0, shard(10, 10)); assertEquals(0, shard(175, 200))
        for (k in 0 until W * H) assertEquals(0, f.facet[k * 4 + 1].toInt())                                  // no figure until the depth cut
        val fig = MtgFoil.withFigure(f.facet, FloatArray(W * H) { 1f })
        assertEquals(255, fig[(200 * W + 175) * 4 + 1].toInt() and 255); assertEquals(0, fig[(100 * W + 70) * 4 + 1].toInt()) // matte off the shards
        assertTrue(f.edge[100 * W + 121] > .8f)                                // the outline between the shards is a cut edge
        assertEquals(0f, f.edge[250 * W + 121], 0f)                            // ink far from a shard is not
        // Same card in, same cut out (cached once, never re-cut per frame).
        assertTrue(MtgFoil.facets(px, W, H, text).facet.contentEquals(f.facet))
        val maps = MtgFoil.analyze(px, W, H, text)
        assertTrue(maps.facet!!.contentEquals(f.facet)); assertEquals(null, MtgFoil.analyze(px, W, H).facet)
    }

    @Test fun onlyInkSelectiveRecipesMeasure() {
        assertTrue(MtgFoil.needsMaps(cover = 0f, relief = 0f, film = 0f, pat = 1f))    // traditional: its grating follows the drawn lines
        assertTrue(MtgFoil.needsMaps(cover = 0f, relief = 0f, film = 0f, pat = 21f))   // facet: the shards
        assertTrue(!MtgFoil.needsMaps(cover = 1f, relief = 0f, film = 0f, pat = 4f))   // etched frame
        assertTrue(!MtgFoil.needsMaps(cover = 0f, relief = 0f, film = 0f, pat = 11f))  // fracture: a fixed pattern
        assertTrue(MtgFoil.needsMaps(cover = 2f, relief = 0f, film = 0f, pat = 18f))   // gilded: gold ink
        assertTrue(MtgFoil.needsMaps(cover = 0f, relief = .3f, film = 0f, pat = 5f))   // textured
        assertTrue(MtgFoil.needsMaps(cover = 0f, relief = 0f, film = 1f, pat = 1f))    // oil slick film
    }
}
