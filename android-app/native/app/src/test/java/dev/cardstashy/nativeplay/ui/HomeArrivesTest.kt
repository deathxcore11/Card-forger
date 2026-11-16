package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Lighter Collection home C1, C3 and C5 on the whole page (the page's own picture tests need fixture files this test does not):
 * Home is built with pictures that are still to come, with and without the account check, and with Meta below the first screen.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
class HomeArrivesTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    private fun model(): CollectionHomeModel {
        val shelf = HomeShelf("Your decks", null,
            ShelfLead("d1", false, "Last played", "Auras", "60 cards", null, "#deck/d1", "https://art.invalid/lead.jpg"),
            listOf(ShelfDeck("d2", "Elves", "60 cards", "https://art.invalid/elves.jpg", "#deck/d2"), ShelfDeck("d3", "No cover", "", null, "#deck/d3")))
        val meta = HomeMeta("Community Meta decks", null, listOf(MetaSlide("k", "", "Modern", "Boros Energy", "1st", "", "", "", "", null, null, "modern")), false, 8000)
        return CollectionHomeModel(CardGame.MTG, "", "", "Search", DailyCard("c", "Card of the day", "", "https://art.invalid/daily.jpg", "", "", "", ""),
            HomeValue("$12", "", "", "", "", "", ""), "", shelf, meta, HomeNews("News", "", "", emptyList(), 3, emptyList(), true))
    }

    @Test fun thePageIsBuiltWithItsPicturesStillToComeAndTheLineShowsOnlyWhileChecking() {
        Motion.still = true
        var checking by androidx.compose.runtime.mutableStateOf(true)
        val m = model()
        rule.setContent { CollectionHome(m, null, top = {}, checking = checking) }
        rule.waitForIdle()
        assertEquals(1, rule.onAllNodesWithContentDescription("Open Auras").fetchSemanticsNodes().size)
        assertEquals(1, rule.onAllNodesWithContentDescription("Open Elves").fetchSemanticsNodes().size)
        assertEquals(1, rule.onAllNodesWithContentDescription("Checking your account").fetchSemanticsNodes().size)
        checking = false
        rule.waitForIdle()
        assertEquals(0, rule.onAllNodesWithContentDescription("Checking your account").fetchSemanticsNodes().size)
        assertEquals(1, rule.onAllNodesWithContentDescription("Open Auras").fetchSemanticsNodes().size)
    }
}
