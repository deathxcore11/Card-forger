package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.performScrollTo
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * A card pop-up's "New deck" and "Find it in a precon" (gap audit A3): from Trunk they opened the website, and from the lobby, the
 * Shop and pack opening they did nothing. With no host handler they now ask Play Decks (DecksOpen) and go there; where the app has
 * no way to Play Decks the buttons are hidden instead of dead.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CardDeckLinksTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private fun settle() = repeat(10) { Thread.sleep(30); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private val card = JsonParser.parseString(javaClass.classLoader!!.getResource("abiding-grace.json")!!.readText()).asJsonObject
    private val pick get() = CardPick(card["name"].asString, card["oracle_id"].asString, card["id"].asString, "nonfoil")
    private val state = JsonParser.parseString("""{"wallet":{"coins":0},"packs":[],"cards":[],"decks":[],"config":{}}""").asJsonObject
    init {
        dev.cardstashy.nativeplay.play.CardFacts.seed(listOf(card))
        dev.cardstashy.nativeplay.play.CardData.load(RuntimeEnvironment.getApplication())
    }

    @Test fun buttonsOpenPlayDecks() {
        DecksOpen.ask.value = null
        var went = 0
        rule.setContent {
            CompositionLocalProvider(LocalPlayDecksNav provides { went++ }, LocalShopSetNav provides { }) {
                Box(Modifier.background(Site.Bg)) { CardSheet(pick, state, CardSheetActions(), {}) }
            }
        }
        settle()
        rule.onNodeWithText("New deck").performSemanticsAction(SemanticsActions.OnClick); settle()
        assertEquals(DecksAsk.NewDeck("Abiding Grace"), DecksOpen.ask.value)
        assertEquals(1, went)
        rule.onAllNodesWithText("Get it").let { it[it.fetchSemanticsNodes().size - 1] }.performSemanticsAction(SemanticsActions.OnClick); settle()
        rule.onNodeWithText("Find it in a precon").performSemanticsAction(SemanticsActions.OnClick); settle()
        assertEquals(DecksAsk.Precon("Abiding Grace", card["set"].asString), DecksOpen.ask.value)
        assertEquals(2, went)
        DecksOpen.ask.value = null
    }

    @Test fun hiddenWithNowhereToGo() {
        rule.setContent {
            CompositionLocalProvider(LocalShopSetNav provides { }) {
                Box(Modifier.background(Site.Bg)) { CardSheet(pick, state, CardSheetActions(), {}) }
            }
        }
        settle()
        rule.onNodeWithText("New deck").assertDoesNotExist()
        rule.onAllNodesWithText("Get it").let { it[it.fetchSemanticsNodes().size - 1] }.performSemanticsAction(SemanticsActions.OnClick); settle()
        rule.onNodeWithText("Find it in a precon").assertDoesNotExist()
        rule.onNodeWithText("See the whole set").assertExists()
    }
}
