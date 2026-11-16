package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.Progress
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Gap audit A1 and A2: Play home's Build a deck and its deck tiles (and the Thor's Open deck) opened the website. They now ask
 * Play Decks (DecksOpen) and go there; Play Decks opens the finder, or that deck in the editor, once it is on screen.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class DecksAskTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private fun settle() = repeat(10) { Thread.sleep(30); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private val state = JsonParser.parseString("""{"wallet":{"coins":0},"packs":[],"cards":[],"config":{},
        "decks":[{"id":"d1","name":"Sunlit Auras","format":"Standard","cards":[{"name":"Plains","qty":20}]}]}""").asJsonObject

    @After fun clean() { DecksOpen.ask.value = null; Progress.setForTest(null, null) }

    @Test fun deckTileOpensThatDeck() {
        Progress.setForTest(state, null)
        DecksOpen.ask.value = DecksAsk.Deck("d1")
        rule.setContent { DecksRoute(onBack = {}, onWeb = { throw AssertionError("went to the website: $it") }, onNav = {}) }
        settle()
        assertEquals(null, DecksOpen.ask.value)
        assertTrue(rule.onAllNodesWithText("Sunlit Auras").fetchSemanticsNodes().isNotEmpty())
        rule.onNodeWithText("Play deck").assertExists()
    }

    @Test fun buildADeckOpensTheFinder() {
        Progress.setForTest(state, null)
        rule.setContent { DecksRoute(onBack = {}, onWeb = { throw AssertionError("went to the website: $it") }, onNav = {}) }
        settle()
        rule.onNodeWithText("From your Trunk, with meta ideas").assertExists()
        DecksOpen.ask.value = DecksAsk.Finder
        settle()
        assertEquals(null, DecksOpen.ask.value)
        // The finder covers the Decks tabs (their Build a deck tile).
        rule.onNodeWithText("From your Trunk, with meta ideas").assertDoesNotExist()
    }

    @Test fun newDeckHoldsTheCard() {
        Progress.setForTest(state, null)
        DecksOpen.ask.value = DecksAsk.NewDeck("Abiding Grace")
        rule.setContent { DecksRoute(onBack = {}, onWeb = { throw AssertionError("went to the website: $it") }, onNav = {}) }
        settle()
        assertEquals(null, DecksOpen.ask.value)
        rule.onNodeWithText("New Play deck").assertExists()
    }
}
