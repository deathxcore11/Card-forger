package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Randall 11 Nov ("What? I do have that many? Why?"): Play Home's shelf said "Your collection · 1,485 cards" while Collection said
 * "Cards 28". They are two pools on purpose: the Trunk (game cards) and the paper-card tracker. Each now says which one it counts.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w411dp-h960dp-xxhdpi")
class PoolLabelsTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    @Test fun playHomeShelfSaysTrunk() {
        val s = JsonObject().apply { add("cards", JsonArray().apply { repeat(1485) { add(JsonObject().apply { add("s", JsonArray().apply { add("dsk") }) }) } }) }
        rule.setContent { androidx.compose.foundation.layout.Column { Collection(s, PlayHomeActions()) } }
        rule.waitForIdle()
        rule.onNodeWithText("Trunk").assertExists()
        rule.onNodeWithText("1,485 cards", substring = true).assertExists()
        assertEquals(0, rule.onAllNodesWithText("Your collection").fetchSemanticsNodes().size)
    }

    @Test fun trackerCountSaysPaperCards() {
        val v = HomeValue("$12.00", "", "28", "26", "", "flat", "")
        rule.setContent { ValueRow(v, 411.dp, CollectionHomeActions()) }
        rule.waitForIdle()
        rule.onNodeWithText("paper cards", substring = true).assertExists()
        rule.onNodeWithText("28", substring = true).assertExists()
    }
}
