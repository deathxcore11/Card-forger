package dev.cardstashy.nativeplay.shots

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.Pack3D
import dev.cardstashy.nativeplay.ui.PackSkin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The 3D pack (Randall 15 Nov: "Build it and ship … new animations and models … real art"): the model loads, every Magic set in the
 * opener has a real wrapper, and the pack is really drawn (not the 2D pack) while sealed, as it tears and as the cards fly out.
 * Frames at the same times as PackFlyTest, so the two can be laid side by side.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class Pack3DTest {
    @get:Rule val rule = createComposeRule()
    private val app get() = RuntimeEnvironment.getApplication()

    @Test fun meshLoadsAndSplitsAtTheTearLine() {
        val m = Pack3D.mesh(app); assertNotNull("pack mesh missing", m); m!!
        assertEquals(4, m.groups.size)
        // Body front and back, strip front and back, each with triangles.
        m.groups.forEach { g -> assertTrue(g.index.size >= 3 * 50); assertEquals(0, g.index.size % 3) }
        // The tear line is 8.5 % under the top, as the 2D pack's seam.
        assertEquals(.085f, (m.y1 - m.cut) / m.height, .002f)
        // The strip's vertices are all near or above the tear line; the body's all near or under it (the lightened mesh tears a little ragged).
        for (gi in 2..3) { val d = m.groups[gi].data; for (v in 0 until m.groups[gi].verts) assertTrue(d[v * 8 + 1] > m.cut - .08f) }
        for (gi in 0..1) { val d = m.groups[gi].data; for (v in 0 until m.groups[gi].verts) assertTrue(d[v * 8 + 1] < m.cut + .08f) }
        // UVs inside the picture.
        for (g in m.groups) for (v in 0 until g.verts) { assertTrue(g.data[v * 8 + 6] in -.001f..1.001f); assertTrue(g.data[v * 8 + 7] in -.001f..1.001f) }
    }

    @Test fun everySetInTheOpenerHasARealWrapper() {
        val codes = File(System.getProperty("repoRoot"), "pack-wrappers.js").readText().let { Regex("new Set\\(\"([^\"]+)\"").find(it)!!.groupValues[1].split(' ') }
        val missing = codes.filterNot { Pack3D.hasArt(app, it) }
        assertTrue("no real wrapper for $missing", missing.isEmpty())
    }

    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun phone() = frames("phone")
    @Config(sdk = [35], qualifiers = "w800dp-h1280dp-xhdpi") @Test fun tablet() = frames("tablet")
    @Config(sdk = [35], qualifiers = "w960dp-h540dp-xhdpi") @Test fun wide() = frames("wide")

    private fun frames(tag: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = false
        dev.cardstashy.nativeplay.art.CardArt.init(app)
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        val pack = dev.cardstashy.nativeplay.ui.packResult(out, "Reality Fracture")
        // The skin is made before the screen opens, as a pack that was opened before (the screenshot can't wait on a coroutine).
        kotlinx.coroutines.runBlocking {
            AssetImages.load(app, "play/mtg-back.webp", maxWidth = 400)
            val photo = AssetImages.load(app, Pack3D.artPath("fra"), maxWidth = 720)!!
            PackSkin.make("fra", photo.asAndroidBitmap())
        }
        val dir = System.getProperty("shotsDir")
        var run by androidx.compose.runtime.mutableIntStateOf(0)
        rule.setContent { androidx.compose.runtime.key(run) { dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = null, onClose = {}) } }
        rule.mainClock.autoAdvance = false
        rule.mainClock.advanceTimeBy(1200); Thread.sleep(200)
        val sealedFile = File(dir, "pack3d-$tag-sealed.png")
        rule.onRoot().captureRoboImage(sealedFile.path)
        val sealed = android.graphics.BitmapFactory.decodeFile(sealedFile.path)
        // The 3D pack is drawn: its middle is the wrapper's colours, not the dark panel.
        val px = sealed.getPixel(sealed.width / 2, sealed.height / 2)
        val lum = ((px shr 16) and 255) + ((px shr 8) and 255) + (px and 255)
        assertTrue("the pack's middle is dark ($lum): nothing drawn", lum > 90)
        for ((name, at) in listOf("tear-200" to 200L, "tear-400" to 400L, "deal-260" to 700L, "deal-450" to 890L, "deal-650" to 1090L, "deal-900" to 1340L, "landed" to 3200L)) {
            run++
            rule.mainClock.advanceTimeBy(500)
            rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(width / 2f, height / 2f)) }
            rule.mainClock.advanceTimeBy(at); Thread.sleep(150)
            rule.onRoot().captureRoboImage(File(dir, "pack3d-$tag-$name.png").path)
        }
    }
}
