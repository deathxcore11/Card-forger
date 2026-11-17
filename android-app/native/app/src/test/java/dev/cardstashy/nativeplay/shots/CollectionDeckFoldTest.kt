package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.CollectionDeck
import dev.cardstashy.nativeplay.ui.CollectionDeckModel
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Polish brief 4 (Randall 17 Nov 18:16Z), done looks like: on 390x844 the deck page opens with at least one full row of cards and the
 * next group's header on screen. The site's own deck model (CollectionEngineTest.deckModel's gallery fixture).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionDeckFoldTest {
    @get:Rule val rule = createComposeRule()

    @Test fun cardsAboveTheFold() {
        val fx = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home/collection-deck-gallery.json")
        assumeTrue("write the fixtures first (CollectionEngineTest.deckModel)", fx.exists())
        dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication())
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val m = CollectionDeckModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        rule.setContent { CollectionDeck(m, top = { }, nav = { }) }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-deck-open-390x844.png").path)
        val h = RuntimeEnvironment.getApplication().resources.displayMetrics.heightPixels
        val row = rule.onAllNodes(hasTestTag("deckline:0:0")).fetchSemanticsNodes().singleOrNull()?.boundsInRoot
        assertTrue("the first row of cards is whole on screen ($row, screen $h)", row != null && row.top >= 0f && row.bottom <= h)
        val next = rule.onAllNodes(hasTestTag("grouphead:1")).fetchSemanticsNodes().firstOrNull()?.boundsInRoot
        assertTrue("the next group's header is on screen ($next, screen $h)", next != null && next.bottom <= h)
    }
}
