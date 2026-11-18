package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.UserDeck
import dev.cardstashy.nativeplay.play.Progress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import dev.cardstashy.nativeplay.account.Decks as Workspace

/**
 * Randall's recording (18 Nov, live 0.4.96): Play home showed "Imported Deck" for Quick Play; Play landed in the lobby with no deck,
 * "Quick Play needs a deck with every card in your Trunk." Play home must offer a deck the lobby accepts.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class QuickDeckTest {
    @get:Rule val rule = createComposeRule()

    /** The Trunk holds Shock and Mountains, not Monastery Swiftspear. */
    private val state = JsonParser.parseString("""{"cards":[{"n":"Shock","c":4},{"n":"Mountain","c":30}],"decks":[]}""").asJsonObject
    private val imported = JsonParser.parseString("""{"id":"imp","name":"Imported Deck","format":"Standard","cards":[{"name":"Mountain","qty":22},{"name":"Monastery Swiftspear","qty":4},{"name":"Shock","qty":4}],"side":[]}""").asJsonObject
    private val owned = JsonParser.parseString("""{"id":"own","name":"Shock and Mountains","format":"Standard","cards":[{"name":"Mountain","qty":26},{"name":"Shock","qty":4}],"side":[]}""").asJsonObject
    /** The imported deck is the one last worked on, as on his phone. */
    private val workspace = JsonObject().apply {
        add("decks", com.google.gson.JsonArray().apply { add(imported); add(owned) })
        add("homeDeckActivity", JsonParser.parseString("""{"mtg":[{"id":"own","at":"2026-11-10T10:00:00Z"},{"id":"imp","at":"2026-11-17T20:00:00Z"}]}"""))
    }

    @Test fun playHomeOffersADeckQuickPlayAccepts() {
        // Before: the header deck was the last worked on, missing cards and all.
        assertEquals("imp", Opening.lastDeck(workspace)?.get("id")?.asString)
        assertEquals("own", Opening.quickDeck(workspace, state)?.get("id")?.asString)
        // Nothing accepted: no deck, so Play opens the lobby ("Pick a deck").
        val none = JsonObject().apply { add("decks", com.google.gson.JsonArray().apply { add(imported) }) }
        assertNull(Opening.quickDeck(none, state))
    }

    /** One press of Play: the accepted deck stays seated through start()'s Trunk check; the imported one is unseated (what he saw). */
    @Test fun playFromHomeKeepsTheSeat() {
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        Motion.still = true
        Account.setForTest(Account.Session("a", "r", Long.MAX_VALUE, "u1", "r@example.com"), Account.Profile("Randall", null, "randall"))
        Progress.setForTest(state, null)
        Workspace.setForTest(listOf(UserDeck("imp", "Imported Deck", "Standard", imported), UserDeck("own", "Shock and Mountains", "Standard", owned)))
        try {
            val m = LobbyModel("quick").apply { format = "Standard" }
            rule.setContent { LobbyScreen(m, {}, {}, {}, {}, {}, online = false) }
            rule.waitForIdle()
            m.quickWith("own"); rule.waitForIdle()
            assertNotNull("the accepted deck stays seated", m.player)
            assertEquals("own", m.player?.id)
            m.quickWith("imp"); rule.waitForIdle()
            assertNull("a deck missing Trunk cards is unseated by start()", m.player)
        } finally { Account.setForTest(null, null); Workspace.setForTest(null) }
    }
}
