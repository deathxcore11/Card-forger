package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Where a tapped tile of a search answer takes the app: its own card page, Sets, Wiki, a deck, a tournament deck or Build a deck
 * (askGo, askTo). The AI chat these once belonged to (Ask CardStashy) is gone.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class AskSheetTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()); Motion.still = true }
    @get:Rule val rule = createComposeRule()
    private fun j(s: String) = JsonParser.parseString(s).asJsonObject

    @Test fun tilesGoToTheAppsOwnPages() {
        val cards = mutableListOf<CardOpen>(); val went = mutableListOf<String>()
        fun go(d: String) = askGo(j(d), "https://cardstashy.com/#search", card = { cards += it }, sets = { went += "sets:$it" }, set = { g, c -> went += "set:$g:$c" },
            wiki = { g, t -> went += "wiki:$g:$t" }, web = { u, _ -> went += "web:$u" })
        go("""{"to":"card","game":"mtg","name":"Lightning Bolt"}""")
        go("""{"to":"card","game":"ygo","id":"14558127","setId":""}""")
        go("""{"to":"route","hash":"#set/dmu","game":"mtg"}""")
        go("""{"to":"route","hash":"#sets","game":"ptcg"}""")
        go("""{"to":"wiki","game":"mtg","topic":"Trample"}""")
        assertEquals("Lightning Bolt", cards[0].name)
        assertEquals("14558127", cards[1].id); assertEquals("ygo", cards[1].game)
        assertEquals(listOf("set:mtg:dmu", "sets:ptcg", "wiki:mtg:Trample"), went)
    }

    @Test fun decksTournamentDecksAndDraftsOpenInTheApp() {
        val o = CollectionWrites.AskOpen("ygo")
        val went = mutableListOf<String>()
        CollectionWrites.deckNav = { id, g -> went += "deck:$g:$id" }
        try {
            askTo(j("""{"to":"route","hash":"#tdeck/d-7","game":"ygo"}"""), o)
            askTo(j("""{"to":"route","hash":"#deck/abc","game":"mtg"}"""), o)
            assertEquals(listOf("deck:ygo:d-7", "deck:mtg:abc"), went)
            askTo(j("""{"to":"meta","game":"ygo"}"""), o)
            assertEquals("ygo", CollectionWrites.metaDeck.value?.game)
            askTo(j("""{"to":"build","game":"ptcg","request":{"game":"ptcg","seed":"Charizard ex","format":"standard","budget":40}}"""), o)
            assertEquals("Charizard ex", CollectionWrites.building.value?.request?.get("seed")?.asString)
            assertEquals("openDeckFlow", CollectionWrites.building.value?.act)
        } finally { CollectionWrites.deckNav = null; CollectionWrites.metaDeck.value = null; CollectionWrites.building.value = null }
    }
}
