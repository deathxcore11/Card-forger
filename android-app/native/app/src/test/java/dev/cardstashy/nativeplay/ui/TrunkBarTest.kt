package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Polish brief 3 on an upright phone: the Trunk's title, one bar, the first card row in the top third, six cards before scrolling. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class TrunkBarTest {
    @get:Rule val rule = createComposeRule()

    private fun state() = JsonObject().apply {
        add("wallet", com.google.gson.JsonParser.parseString("""{"coins":170,"xp":230,"seal_c":0,"seal_u":0,"seal_r":0,"seal_m":0}"""))
        add("cards", JsonArray().apply { repeat(30) { i -> add(JsonObject().apply {
            addProperty("o", "o$i"); addProperty("n", "Card $i"); addProperty("r", listOf("common", "uncommon", "rare")[i % 3]); addProperty("c", 2); addProperty("h", 0)
            add("s", JsonArray().apply { add(if (i % 2 == 0) "dsk" else "fdn") }); addProperty("a", "2026-11-%02d".format(i % 28 + 1)) }) } })
    }

    @Test fun cardsStartHighAndTheSheetFilters() {
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        Motion.still = true
        rule.setContent { TrunkScreen(state(), {}, {}, {}) { } }
        rule.waitForIdle()
        rule.onNodeWithText("Trunk").assertExists()
        rule.onNodeWithText("Find a card").assertExists()
        val h = RuntimeEnvironment.getApplication().resources.displayMetrics.heightPixels
        val tiles = rule.onAllNodes(hasTestTag("trunkcard")).fetchSemanticsNodes().map { it.boundsInRoot }
        val top = tiles.minOf { it.top }
        assertTrue("first card row at ${top}px, want the top third of $h", top < h / 3f)
        assertTrue("${tiles.count { it.bottom <= h }} whole cards before scrolling, want 6", tiles.count { it.top >= 0f && it.bottom <= h } >= 6)
        rule.onNodeWithText("30 cards").assertExists()
        // Rarity now lives in the Filters sheet: pick Rare, the chip and the count follow; its x takes it off.
        rule.onNodeWithContentDescription("Filters").performClick(); rule.waitForIdle()
        rule.onNodeWithText("Rare").performClick(); rule.waitForIdle()
        rule.onNodeWithText("Show 10 cards").performClick(); rule.waitForIdle()
        rule.onNodeWithContentDescription("Filters, 1 on").assertExists()
        rule.onNodeWithText("10 of 30").assertExists()
        rule.onNodeWithContentDescription("Take off Rare").performClick(); rule.waitForIdle()
        rule.onNodeWithText("30 cards").assertExists()
        assertEquals(0, rule.onAllNodes(hasTestTag("trunkFilters")).fetchSemanticsNodes().size)
    }
}
