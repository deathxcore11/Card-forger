package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.foil.MapScale
import dev.cardstashy.nativeplay.foil.MtgFoil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The app's own road to a card's maps, on the scans the phone really downloads: Scryfall's 488 px 'normal' scan (672 px 'large' for
 * silver scroll), scaled to the maps' size the way FoilMaps.mtgCard scales it (MapScale.area), then MtgFoil.cardMaps. Each check is a
 * fault the owner saw on the Foil Test Bench (16 Nov 2026): the silver scroll name plate mapped as paper (Culling the Weak SOA 157),
 * a second shooting star on a scan that already carries one (Eternal Witness P30A 12) and none on a scan without (Counterspell
 * DMR 281), the gold frame's picture window (Smaug HOB 249), a box used where the card has none (Llanowar Elves FDN 439).
 * Decoded with Android's own decoder (Robolectric's native graphics, Skia) on a desktop: this checks the maps, not a phone's screen.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class MtgCardMapsAppPathTest {
    private val W = MtgFoil.MAP_W; private val H = MtgFoil.MAP_H
    private fun px(name: String): IntArray {
        val img = javaClass.getResourceAsStream("/foil/maps/$name.jpg")!!.use { android.graphics.BitmapFactory.decodeStream(it) }
        val sw = img.width; val sh = img.height
        val sp = IntArray(sw * sh).also { img.getPixels(it, 0, sw, 0, 0, sw, sh) }
        return MapScale.area(sp, sw, sh, W, H)
    }
    private fun mean(m: ByteArray, ch: Int, b: FloatArray): Double {
        var s = 0.0; var n = 0
        for (y in (b[1] * H).roundToInt() until (b[3] * H).roundToInt()) for (x in (b[0] * W).roundToInt() until (b[2] * W).roundToInt()) { s += m[(y * W + x) * 4 + ch].toInt() and 255; n++ }
        return s / n / 255
    }
    private fun mean(a: FloatArray, b: FloatArray): Double {
        var s = 0.0; var n = 0
        for (y in (b[1] * H).roundToInt() until (b[3] * H).roundToInt()) for (x in (b[0] * W).roundToInt() until (b[2] * W).roundToInt()) { s += a[y * W + x]; n++ }
        return s / n
    }
    private val f2015 = Pair(floatArrayOf(.075f, .107f, .925f, .560f), floatArrayOf(.075f, .615f, .925f, .908f))
    private val f1997 = Pair(floatArrayOf(.113f, .096f, .884f, .545f), floatArrayOf(.104f, .594f, .897f, .887f))
    private val borderless = Pair(floatArrayOf(0f, 0f, 1f, 1f), floatArrayOf(.070f, .620f, .930f, .920f))

    @Test fun silverScrollPlatesFromTheLargeScan() {
        val m = MtgFoil.cardMaps(px("soa-157-large"), W, H, 23, borderless.first, borderless.second).mask
        val plate = minOf(mean(m, 0, floatArrayOf(.08f, .06f, .12f, .21f)), mean(m, 0, floatArrayOf(.16f, .06f, .2f, .21f)))
        assertTrue("SOA 157: the name plate beside its letters is silver ink (${"%.2f".format(plate)})", plate > .8)
        assertTrue("SOA 157: the plate is not paper", mean(m, 2, floatArrayOf(.04f, .03f, .2f, .24f)) < .05)
        assertTrue("SOA 157: the cat's fur is not plate ink", mean(m, 0, floatArrayOf(.45f, .12f, .6f, .22f)) < .25)
        assertTrue("SOA 157: the cat's fur is not paper", mean(m, 2, floatArrayOf(.45f, .12f, .6f, .22f)) < .1)
        assertTrue("SOA 157: the rules box is paper", mean(m, 2, floatArrayOf(.2f, .7f, .8f, .82f)) > .8)
        assertTrue("SOA 157: the bottom frame is silver ink", mean(m, 0, floatArrayOf(.3f, .955f, .7f, .975f)) > .5)
    }

    @Test fun shootingStarOnlyWhereTheScanHasOne() {
        val star = MtgFoil.findScanStar(px("p30a-12-normal"), W, H, f1997.second)
        assertTrue("P30A 12: the scan's own star is found at the rules box corner (${star?.toList()})",
            star != null && abs(star[0] - (f1997.second[0] + .10f)) < .04f && abs(star[1] - f1997.second[3]) < .03f)
        assertNull("DMR 281 (nonfoil scan): no star, so the shader draws one", MtgFoil.findScanStar(px("dmr-281-normal"), W, H, f1997.second))
    }

    @Test fun gleamingGoldWindow() {
        val a = MtgFoil.artWindow(px("hob-249-normal"), W, H)
        val centre = mean(a, floatArrayOf(.4f, .4f, .6f, .55f)); val left = mean(a, floatArrayOf(0f, .3f, .04f, .6f)); val bottom = mean(a, floatArrayOf(.3f, .9f, .7f, .97f))
        assertTrue("HOB 249: the window is the picture and the gold frame is not ($centre, $left, $bottom)", centre > .9 && left < .1 && bottom < .1)
    }

    @Test fun boxesFollowEachCard() {
        val fdn = MtgFoil.cardBoxes(px("fdn-439-normal"), W, H, f2015.first, f2015.second)
        assertEquals("FDN 439: no standard picture box on this card, so none is used", listOf(0f, 0f, 1f, 1f), fdn.art.toList())
        val dmr = MtgFoil.cardBoxes(px("dmr-281-normal"), W, H, f1997.first, f1997.second)
        assertTrue("DMR 281: the rules box snaps to its own frame lines", dmr.text.indices.any { dmr.text[it] != f1997.second[it] })
    }
}
