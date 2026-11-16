package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Gap audit H1 step 2: Compare drawn as the preview (a whole card, its facts under it, the site's verdict, Swap into the deck, Clear,
 * an empty side's name box and Look up), from the model the engine reads back (CompareEngineTest), and a card opening its page.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CardCompareSheetTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private val m = JsonParser.parseString("""{"game":"mtg","title":"Compare cards","sides":[
        {"i":0,"name":"Lightning Bolt","picture":{"src":"https://cards.scryfall.io/normal/front/a.jpg"},"id":"","lines":["MV 1 · $1.14","3 free in collection","Straightforward"],"chips":["Removal"],"facts":[],"effects":""},
        {"empty":true,"i":1}],
        "verdict":"Lightning Strike costs 1 more mana. Price difference −$0.91. In Izzet Tempo: engine score +2.","swap":"Swap into Izzet Tempo","foot":"","clear":true}""").asJsonObject

    @Test fun magicFactsAsThePreviewLabelsThem() {
        val side = m["sides"].asJsonArray[0].asJsonObject
        assertEquals(listOf("Mana value" to "1", "Price" to "$1.14", "Free in collection" to "3"), compareFacts("mtg", side))
        assertEquals(listOf("Straightforward"), compareNotes("mtg", side))
    }

    @Test fun sidesVerdictAndButtons() {
        var opened = ""; var swapped = 0; var cleared = 0; var looked = 0
        rule.setContent { Column {
            CompareSide(m["sides"].asJsonArray[0].asJsonObject, "mtg", "", {}, {}, { n, _ -> opened = n }, androidx.compose.ui.Modifier)
            CompareSide(m["sides"].asJsonArray[1].asJsonObject, "mtg", "Lightning Strike", {}, { looked++ }, { _, _ -> }, androidx.compose.ui.Modifier)
            CompareVerdict(m, "", false, { swapped++ }, { cleared++ })
        } }
        rule.onNodeWithText("Mana value").assertExists()
        rule.onNodeWithText("Removal").assertExists()
        rule.onNodeWithText("Straightforward").assertExists()
        rule.onNodeWithContentDescription("Open Lightning Bolt").performSemanticsAction(SemanticsActions.OnClick)
        assertEquals("Lightning Bolt", opened)
        rule.onNodeWithText("Look up").performSemanticsAction(SemanticsActions.OnClick); assertEquals(1, looked)
        rule.onNodeWithText(m["verdict"].asString).assertExists()
        rule.onNodeWithText("Swap into Izzet Tempo").performSemanticsAction(SemanticsActions.OnClick); assertEquals(1, swapped)
        rule.onNodeWithText("Clear").performSemanticsAction(SemanticsActions.OnClick); assertEquals(1, cleared)
    }

    @Test fun cardPageCompareOpensTheAppSheet() {
        CollectionWrites.comparing.value = null
        CollectionWrites.comparing.value = CollectionWrites.CompareOpen("ygo", first = "46986414")
        assertEquals("46986414", CollectionWrites.comparing.value?.first)
        CollectionWrites.comparing.value = null
    }
}
