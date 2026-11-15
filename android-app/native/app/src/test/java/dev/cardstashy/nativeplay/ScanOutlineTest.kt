package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.collection.ScanOutline
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The camera outline (approved 15 Nov 2026): the scanner's page gives the found card's corners as fractions of the frame it read,
 * and the app draws them on a preview that shows that frame cropped to fill its box. The corners below are the ones the scanner
 * found on the owner's real photo of Twin Twisters (test-fixtures/scan-real/ygo/twin2.jpg, frame 984 × 1210).
 */
class ScanOutlineTest {
    private val twin = """{"tone":"amber","w":984,"h":1210,"quad":[{"x":0.193,"y":0.208},{"x":0.716,"y":0.180},{"x":0.741,"y":0.741},{"x":0.240,"y":0.749}]}"""

    @Test fun readsThePagesOutline() {
        val o = ScanOutline.parse(twin)!!
        assertEquals(false, o.green); assertEquals(984f, o.w, 0f); assertEquals(4, o.quad.size)
        assertTrue(ScanOutline.parse(twin.replace("amber", "green"))!!.green)
    }

    @Test fun nothingToDrawIsNoOutline() {
        assertNull(ScanOutline.parse("")); assertNull(ScanOutline.parse(null)); assertNull(ScanOutline.parse("not json"))
        assertNull(ScanOutline.parse("""{"tone":"amber","w":0,"h":0,"quad":[]}"""))
        assertNull(ScanOutline.parse(twin.replace(""",{"x":0.240,"y":0.749}""", "")))
    }

    /** A preview the frame's own shape: the corners are simply the fractions of the box. */
    @Test fun sameShapeNeedsNoCrop() {
        val at = ScanOutline.parse(twin)!!.inBox(492f, 605f)
        assertArrayEquals(floatArrayOf(.193f * 492, .208f * 605, .716f * 492, .180f * 605, .741f * 492, .741f * 605, .240f * 492, .749f * 605), at, .01f)
    }

    /** A tall phone preview (412 × 706 dp): the frame is scaled to the box's height and its sides are cropped evenly. */
    @Test fun tallPreviewCropsTheSides() {
        val at = ScanOutline.parse(twin)!!.inBox(412f, 706f)
        val k = 706f / 1210f; val cut = (984f * k - 412f) / 2f
        assertEquals(.193f * 984 * k - cut, at[0], .01f); assertEquals(.208f * 706, at[1], .01f)
        assertEquals(.741f * 984 * k - cut, at[4], .01f); assertEquals(.741f * 706, at[5], .01f)
        // The whole card stays inside this preview.
        for (i in 0 until 8) assertTrue(at[i] > 0f && at[i] < (if (i % 2 == 0) 412f else 706f))
    }

    /** A wide preview (a tablet in landscape): scaled to the width, top and bottom cropped. */
    @Test fun widePreviewCropsTopAndBottom() {
        val at = ScanOutline.parse(twin)!!.inBox(1280f, 720f)
        val k = 1280f / 984f; val cut = (1210f * k - 720f) / 2f
        assertEquals(.193f * 1280, at[0], .01f); assertEquals(.208f * 1210 * k - cut, at[1], .01f)
    }
}
