package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import dev.cardstashy.nativeplay.progressStateText

/** Polish brief 1 on the parity fixture, upright phone: the stage shows the deck, the mode row picks, Play starts the chosen mode. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PlayStageTest {
    @get:Rule val rule = createComposeRule()

    private fun home(deck: HomeDeck?, log: MutableList<String>) {
                dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        Motion.still = true
        val state = JsonParser.parseString(progressStateText()).asJsonObject
        val rules = PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        val act = PlayHomeActions(mode = { log += "mode:$it" }, story = { log += "story" }, play = { log += "play:$it" })
        rule.setContent { PlayHome(PlayHomeData(state, rules, PlayMath.StoryHome(1, 0, false), "2026-11-03", deck = deck), top = {}, act = act, nav = {}) }
        rule.waitForIdle()
    }

    @Test fun playStartsQuickPlayWithTheShownDeck() {
        val log = mutableListOf<String>()
        home(HomeDeck("d1", "Mono-White Auras", "Standard", 60, null), log)
        rule.onNodeWithText("Mono-White Auras").assertExists()
        rule.onNodeWithText("Standard · 60 cards").assertExists()
        rule.onNodeWithContentDescription("Quick Play").assertIsSelected()
        rule.onNodeWithContentDescription("Play, Quick Play").performClick()
        assertEquals(listOf("play:d1"), log)
    }

    @Test fun choosingAModeChangesWhatPlayStarts() {
        val log = mutableListOf<String>()
        home(HomeDeck("d1", "Mono-White Auras", "Standard", 60, null), log)
        rule.onNodeWithContentDescription("Practice").performClick(); rule.waitForIdle()
        rule.onNodeWithContentDescription("Play, Practice").performClick()
        rule.onNodeWithText("Change deck").performClick()
        assertEquals(listOf("mode:practice", "mode:quick"), log)
    }

    @Test fun noDeckOpensQuickPlay() {
        val log = mutableListOf<String>()
        home(null, log)
        rule.onNodeWithText("Pick a deck").assertExists()
        rule.onNodeWithContentDescription("Play, Quick Play").performClick()
        assertEquals(listOf("mode:quick"), log)
    }
}
