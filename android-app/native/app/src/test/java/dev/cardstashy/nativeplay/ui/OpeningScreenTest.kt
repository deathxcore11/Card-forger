package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Loading brief L1: the opening screen waits for Play home's own steps, at least 0.6 s and at most 4 s, and fans the last deck. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
class OpeningScreenTest {
    @get:Rule val rule = createComposeRule()

    @Test fun itLiftsAfterTheLastStepButNeverBeforeSixTenthsOfASecond() {
        val g = Opening.Gate()
        Opening.Step.entries.forEach { g.mark(it) }
        assertFalse("everything in at once still shows 0.6 s", g.lifts(300))
        assertTrue(g.lifts(600))
        assertTrue(g.left.isEmpty())
    }

    @Test fun aStepThatNeverComesHoldsItFourSecondsAtMost() {
        val g = Opening.Gate()
        g.mark(Opening.Step.ENGINE); g.mark(Opening.Step.ACCOUNT); g.mark(Opening.Step.BINDER)
        assertFalse(g.lifts(3_999))
        assertTrue(g.lifts(4_000))
        assertEquals(listOf(Opening.Step.PICTURE), g.left)
        assertEquals(.75f, g.fraction)
    }

    @Test fun theFanIsTheDeckLastWorkedOnWithoutBasicLands() {
        val ws = JsonParser.parseString("""{"decks":[
            {"id":"a","cards":[{"name":"Llanowar Elves","qty":4},{"name":"Forest","qty":20}]},
            {"id":"b","cards":[{"name":"Plains","qty":10},{"name":"Serra Angel","qty":2},{"name":"Pacifism","qty":4},{"name":"Serra Angel","qty":1},
              {"name":"Swords to Plowshares"},{"name":"Wrath of God"},{"name":"Glorious Anthem"},{"name":"Baneslayer Angel"}]}],
            "homeDeckActivity":{"mtg":[{"id":"a","at":"2026-11-10T10:00:00.000Z"},{"id":"b","at":"2026-11-12T09:00:00.000Z"},{"id":"gone","at":"2026-11-12T10:00:00.000Z"}]}}""").asJsonObject
        assertEquals(listOf("Serra Angel", "Pacifism", "Swords to Plowshares", "Wrath of God", "Glorious Anthem"), Opening.lastDeckNames(ws))
        ws.remove("homeDeckActivity")
        assertEquals("no history: the first deck with cards", listOf("Llanowar Elves"), Opening.lastDeckNames(ws))
        assertEquals(emptyList<String>(), Opening.lastDeckNames(null))
    }

    @Test fun signedOutNothingButTheEngineIsWaitedFor() {
        dev.cardstashy.nativeplay.account.Account.setForTest(null, null)
        val s = openingSignals()
        assertTrue(Opening.Step.ACCOUNT in s && Opening.Step.BINDER in s && Opening.Step.PICTURE in s)
    }

    @Test fun theScreenShowsItsStepsThenLiftsOncePerLaunch() {
        Motion.still = true
        Opening.shown = false
        var clock = 0L
        var steps = setOf<Opening.Step>()
        rule.mainClock.autoAdvance = false
        rule.setContent { OpeningHost(signals = { steps }, now = { clock }) }
        rule.mainClock.advanceTimeBy(100)
        assertEquals(1, rule.onAllNodesWithContentDescription("Opening CardStashy").fetchSemanticsNodes().size)
        assertEquals(1, rule.onAllNodesWithText("Waking the rules engine").fetchSemanticsNodes().size)
        steps = setOf(Opening.Step.ENGINE, Opening.Step.ACCOUNT)
        clock = 300; rule.mainClock.advanceTimeBy(200)
        assertEquals(1, rule.onAllNodesWithText("Hanging your deck covers").fetchSemanticsNodes().size)
        steps = Opening.Step.entries.toSet()
        clock = 700; rule.mainClock.advanceTimeBy(200)
        clock = 1_000; rule.mainClock.advanceTimeBy(600)
        assertEquals("lifted", 0, rule.onAllNodesWithContentDescription("Opening CardStashy").fetchSemanticsNodes().size)
        assertTrue(Opening.shown)
        Opening.shown = false
    }

    private fun shot(name: String) {
        Motion.still = true
        rule.setContent { OpeningScreen(3, List(5) { null }) }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir") ?: "build/shots", name).path)
    }

    /** The approved look with our card backs (no deck on the device), three of four steps done. */
    @Test fun picturePhone() = shot("opening-390x844.png")
    @Config(qualifiers = "w884dp-h1104dp-mdpi") @Test fun pictureFoldOpen() = shot("opening-884x1104.png")
    @Config(qualifiers = "w1024dp-h768dp-land-mdpi") @Test fun pictureTablet() = shot("opening-1024x768.png")
    @Config(qualifiers = "w960dp-h540dp-land-xhdpi") @Test fun pictureHandheld() = shot("opening-960x540.png")
    @Test fun pictureThorBottom() {
        rule.setContent { OpeningBottom(3) }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir") ?: "build/shots", "opening-bottom.png").path)
    }
}
