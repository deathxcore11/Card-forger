package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Gap audit H2 step 2: the alert sheet as the preview draws it (price now, the price line with both marks, the two fields, the site's
 * error line, "Price alert active"), and a card page's priceAlert tap opening it in the app instead of the website.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PriceAlertSheetTest {
    @get:Rule val rule = createComposeRule()
    private val m = JsonParser.parseString("""{"game":"mtg","id":"x|nonfoil","name":"Sheoldred, the Apocalypse","price":62,"exists":true,
        "below":"52.7","above":"77.5","hintBelow":"52.70","hintAbove":"77.50","series":[["2026-10-01",70],["2026-10-20",66],["2026-11-12",62]]}""").asJsonObject

    @Test fun sheetBody() {
        rule.setContent { PriceAlertBody(m, "52.7", "77.5", "The lower price must be less than the upper price.", true, {}, {}) }
        rule.onNodeWithText("Sheoldred, the Apocalypse").assertExists()
        rule.onNodeWithText("$62.00").assertExists()
        rule.onNodeWithContentDescription("Price line with your alert marks").assertExists()
        rule.onNodeWithText("Tell me when it drops below").assertExists()
        rule.onNodeWithText("The lower price must be less than the upper price.").assertExists()
        rule.onNodeWithText("Price alert active").assertExists()
        rule.onNodeWithText("Below $52.70 · Above $77.50").assertExists()
    }

    @Test fun noHistorySaysSo() {
        val bare = m.deepCopy().apply { add("series", com.google.gson.JsonArray()); addProperty("exists", false) }
        rule.setContent { PriceAlertBody(bare, "", "", "", false, {}, {}) }
        rule.onNodeWithText("No earlier dated prices are stored for this version.").assertExists()
        rule.onNodeWithText("Price alert active").assertDoesNotExist()
    }

    @Test fun tapOpensTheAppSheet() {
        CollectionWrites.alerting.value = null
        CollectionWrites.openAlert(mapOf("act" to "priceAlert", "game" to "ygo", "id" to "46986414|reference", "name" to ""))
        val a = CollectionWrites.alerting.value!!
        assertEquals(Triple("ygo", "46986414|reference", "This card"), Triple(a.game, a.cardId, a.name))
        CollectionWrites.alerting.value = null
    }
}
