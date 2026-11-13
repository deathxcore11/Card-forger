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
 * Gap audit H3 steps 2 to 4: Ask CardStashy drawn from the chat the engine reads back (AskEngineTest): the greeting and starter
 * questions, your line, "Thinking" with its step, an answer with its source label, tile, deck choices and follow-up questions; a tile
 * taking the app to its own card page, Sets or Wiki (askGo); the wiki's ask box leaving its words in the bar.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class AskSheetTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()); Motion.still = true }
    @get:Rule val rule = createComposeRule()
    private fun j(s: String) = JsonParser.parseString(s).asJsonObject

    @Test fun greetingAndStarters() {
        val asked = mutableListOf<String>()
        val m = j("""{"hello":"What do you want to know about your Magic cards?","blurb":"I can use CardStashy’s cards, prices, sets, tournament decks, your collection and your decks.",
            "examples":["What's my most valuable card?","Build me a mono-red deck for $50"]}""")
        rule.setContent { Column { AskEmpty(m, true) { asked += it } } }
        rule.onNodeWithText("What do you want to know about your Magic cards?").assertExists()
        rule.onNodeWithText("What's my most valuable card?").performSemanticsAction(SemanticsActions.OnClick)
        assertEquals(listOf("What's my most valuable card?"), asked)
    }

    @Test fun chatLinesTilesChoicesAndFollowUps() {
        val asked = mutableListOf<String>(); val chosen = mutableListOf<String>(); val opened = mutableListOf<JsonObject>()
        val lines = listOf(j("""{"who":"me","text":"What's my most valuable card?","pending":false}"""),
            j("""{"who":"ai","source":"From your app data","sourceKind":"app","text":"Sheoldred, the Apocalypse is worth the most.",
                "items":[{"show":{"kind":"card","game":"mtg","ref":"Sheoldred, the Apocalypse"},"title":"Sheoldred, the Apocalypse","lines":["DMU · #107"],"price":"$62.00","art":"","build":false,"status":"","label":"Open Sheoldred, the Apocalypse"}],
                "choices":[{"id":"format:Standard","label":"Standard","turn":2}],"follow":["What is my whole collection worth?"]}"""),
            j("""{"who":"thinking","step":"Checking your collection…"}"""))
        rule.setContent { Column { lines.forEach { AskLine(it, false, { q -> asked += q }, { c -> chosen += c["id"].asString }, { s -> opened += s }) } } }
        rule.onNodeWithText("What's my most valuable card?").assertExists()
        rule.onNodeWithText("FROM YOUR APP DATA").assertExists()
        rule.onNodeWithText("Checking your collection…").assertExists()
        rule.onNodeWithContentDescription("Open Sheoldred, the Apocalypse").performSemanticsAction(SemanticsActions.OnClick)
        assertEquals("Sheoldred, the Apocalypse", opened.single()["ref"].asString)
        rule.onNodeWithText("Standard").performSemanticsAction(SemanticsActions.OnClick); assertEquals(listOf("format:Standard"), chosen)
        rule.onNodeWithText("What is my whole collection worth?").performSemanticsAction(SemanticsActions.OnClick)
        assertEquals(listOf("What is my whole collection worth?"), asked)
    }

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

    @Test fun wikiAskBoxLeavesItsWordsInTheBar() {
        CollectionWrites.asking.value = CollectionWrites.AskOpen("mtg", draft = "What is trample?")
        assertEquals("What is trample?", CollectionWrites.asking.value?.draft)
        assertEquals("", CollectionWrites.asking.value?.prefill)
        CollectionWrites.asking.value = null
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

    @Test fun thorTopScreenShowsWhatTheAnswerNames() {
        val opened = mutableListOf<String>()
        val lines = listOf(j("""{"who":"me","text":"Best deck?"}"""), j("""{"who":"ai","source":"From your app data","sourceKind":"app","text":"Snake-Eye leads.",
            "items":[{"show":{"kind":"meta","game":"ygo","ref":"snake-eye"},"title":"Snake-Eye Fire King","lines":["Meta deck · Yu-Gi-Oh!"],"price":"","art":"","build":false,"status":"","label":""}],"choices":[],"follow":[]}"""))
        rule.setContent { Column { AskNamed(lines) { opened += it["ref"].asString } } }
        rule.onNodeWithContentDescription("Open Snake-Eye Fire King").performSemanticsAction(SemanticsActions.OnClick)
        assertEquals(listOf("snake-eye"), opened)
    }
}
