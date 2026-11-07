package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** A card opened from a Play pack: its set row closes the pack and opens the set (Randall 7 Nov: the tap did nothing). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PackCardLinksTest {
    @get:Rule val rule = createComposeRule()

    @Test fun setRowFromAPackOpensTheSet() {
        Motion.still = true
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val card = JsonParser.parseString("""{"object":"card","id":"0b1e6d63-0000-4000-8000-000000000001","name":"Feast or Famine","set":"all","set_name":"Alliances",
            "collector_number":"10a","rarity":"common","released_at":"1996-06-10","type_line":"Instant","mana_cost":"{3}{B}","oracle_text":"Choose one",
            "finishes":["nonfoil"],"image_uris":{"normal":"","art_crop":""}}""").asJsonObject
        dev.cardstashy.nativeplay.play.CardFacts.seed(listOf(card))
        val pack = PackResult("all", "Alliances", listOf(Pull(card["id"].asString, "Feast or Famine", "common", "", "", false)), "", "")
        val went = mutableListOf<String>()
        rule.setContent {
            PackOpening(pack, onNext = null, onClose = { went += "closed" }, initial = PackStage.DEALT, revealedAtStart = setOf(0), focusAtStart = 0, inspectAtStart = 0,
                onSet = { went += "set:$it" })
        }
        rule.waitUntil(20_000) { rule.onAllNodesWithText("Alliances  ›").fetchSemanticsNodes().isNotEmpty() }
        rule.onAllNodesWithText("Alliances  ›")[0].performClick()
        rule.waitForIdle()
        assertEquals(listOf("closed", "set:all"), went)
    }
}
