package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.UserDeck
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Progress
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import dev.cardstashy.nativeplay.account.Decks as Workspace

/**
 * Live 0.4.57 on the Thor (fault list 2): in the signed-in Quick Play lobby the d-pad never reached a deck with a ring.
 * The first press (or an A with nothing ringed) now lands on the first deck, and each Down keeps the ringed deck's top
 * clear of the pinned Play bar. Seeded as LobbyShotTest: the five starters and one Collection deck, all Standard.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class PadLobbyTest {
    @get:Rule val rule = createComposeRule()
    @After fun off() { Pad.forget() }

    private val cards by lazy { JsonParser.parseString(javaClass.classLoader!!.getResource("lobby-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject } }
    private val starters = listOf(
        Triple("w", "White angels · Starter", "Plains") to listOf("Healer's Hawk", "Hinterland Sanctifier", "Ajani's Pridemate", "Lifecreed Duo", "Helpful Hunter", "Dazzling Angel", "Inspiring Overseer", "Angel of Vitality", "Bovine Intervention"),
        Triple("u", "Blue fliers · Starter", "Island") to listOf("Spectral Sailor", "Harrier Strix", "Plumecreed Escort", "Floodpits Drowner", "Bellowing Crier", "Mocking Sprite", "Geyser Drake", "Essence Scatter", "Unsummon"),
        Triple("b", "Black drain · Starter", "Swamp") to listOf("Greedy Freebooter", "Infestation Sage", "Sanguine Syphoner", "Burglar Rat", "Marauding Blight-Priest", "Vampire Nighthawk", "Vile Entomber", "Murder", "Feed the Swarm"),
        Triple("r", "Red burn · Starter", "Mountain") to listOf("Fanatical Firebrand", "Reckless Lackey", "Firebrand Archer", "Sunset Strikemaster", "Scytheclaw Raptor", "Spitfire Lagac", "Volley Veteran", "Shock", "Lightning Strike"),
        Triple("g", "Green creatures · Starter", "Forest") to listOf("Llanowar Elves", "Bear Cub", "Ordinary Bear", "Ghalta, Primal Hunger", "Lashwhip Predator", "Tarmogoyf", "Tapestry Warden", "Virulent Emissary", "Scarecrow Guide"))

    private fun rows(land: String, names: List<String>) = JsonArray().apply {
        add(JsonObject().apply { addProperty("name", land); addProperty("qty", 24) }); names.forEach { n -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", 4) }) } }

    private fun step() { rule.mainClock.advanceTimeBy(600) }

    /** The signed-in Quick Play lobby with a pad, the app's ring look and its pad root. */
    private fun show() {
        Motion.still = true; rule.mainClock.autoAdvance = false
        CardFacts.seed(cards)
        Account.setForTest(Account.Session("a", "r", Long.MAX_VALUE, "u1", "r@example.com"), Account.Profile("Randall", null, "randall"))
        val owned = starters.filter { it.first.first != "u" }.flatMap { it.second }.toSet() + "Mountain"
        val state = JsonObject().apply {
            add("wallet", JsonParser.parseString("""{"coins":170,"xp":230,"seal_c":0,"seal_u":0,"seal_r":0,"seal_m":0}"""))
            add("cards", JsonArray().apply { cards.filter { it["name"].asString in owned }.forEach { c ->
                add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", c["name"].asString); addProperty("r", c["rarity"].asString); addProperty("c", 4); addProperty("h", 0) }) } })
            add("decks", JsonArray().apply { starters.forEach { (t, names) -> add(JsonObject().apply {
                addProperty("id", "starter:" + t.first); addProperty("name", t.second); addProperty("format", "Standard"); add("cards", rows(t.third, names)) }) } })
        }
        Progress.setForTest(state, null)
        val col = JsonParser.parseString("""{"id":"col1","name":"Mono-red aggro","format":"Standard","cards":[{"name":"Mountain","qty":22},{"name":"Monastery Swiftspear","qty":4},{"name":"Shock","qty":4}],"side":[]}""").asJsonObject
        Workspace.setForTest(listOf(UserDeck("col1", "Mono-red aggro", "Standard", col)))
        Pad.used()
        val m = LobbyModel("quick").apply { format = "Standard" }
        rule.setContent {
            CompositionLocalProvider(LocalIndication provides PadFocus) {
                Box(Modifier.fillMaxSize().padRoot()) { LobbyScreen(m, {}, {}, {}, {}, {}, online = false) }
            }
        }
        step()
    }

    private fun tag(n: SemanticsNode) = n.config.getOrNull(SemanticsProperties.TestTag)
    private fun decks() = rule.onAllNodes(SemanticsMatcher("deck tile") { tag(it)?.startsWith("deck:") == true }).fetchSemanticsNodes()
    private fun ringed() = rule.onAllNodes(isFocused()).fetchSemanticsNodes().firstOrNull()
    /** The pinned Play bar's plate (Quick Play with no deck chosen reads "Pick your deck"). */
    private fun barTop() = rule.onAllNodesWithText("Pick your deck", substring = true).fetchSemanticsNodes().maxOf { it.boundsInRoot.top }

    /** The ringed deck is on screen and its top (where the ring shows) is above the Play bar. */
    private fun assertRingShows(at: String): SemanticsNode {
        val f = ringed()
        assertTrue("$at: the ring is not on a deck (${f?.let(::tag)})", f != null && tag(f)?.startsWith("deck:") == true)
        val top = f!!.boundsInRoot.top; val bar = barTop()
        assertTrue("$at: ${tag(f)} top $top is off the top of the screen", top >= 0f)
        assertTrue("$at: ${tag(f)} top $top is under the Play bar ($bar)", top < bar)
        return f
    }

    @Test fun quickLobbyDownReachesAVisibleDeck() {
        show()
        rule.runOnUiThread { PadPrompts.navigate(android.view.KeyEvent.KEYCODE_DPAD_DOWN) }
        step()
        // The first press: the first deck (top left of the decks), not the head's Back.
        val first = assertRingShows("first Down")
        val all = decks()
        assertTrue("first Down: ${tag(first)} is not the first deck", all.all { it.boundsInRoot.top >= first.boundsInRoot.top - 1f } &&
            all.filter { kotlin.math.abs(it.boundsInRoot.top - first.boundsInRoot.top) < 1f }.all { it.boundsInRoot.left >= first.boundsInRoot.left - 1f })
        // Down walks the decks, a new one each press, and the list scrolls with the ring.
        val seen = mutableListOf(tag(first))
        repeat(2) { n ->
            rule.runOnUiThread { PadPrompts.navigate(android.view.KeyEvent.KEYCODE_DPAD_DOWN) }
            step()
            val f = assertRingShows("Down ${n + 2}")
            assertTrue("Down ${n + 2}: the ring went back to ${tag(f)} ($seen)", tag(f) !in seen)
            seen += tag(f)
        }
    }

    @Test fun aWithNothingRingedStartsOnFirstDeck() {
        show()
        assertTrue("the lobby set no entry for the ring", PadPrompts.entry != null)
        rule.runOnUiThread { PadPrompts.entry!!() }
        // The entry scrolls first and rings on the next frame.
        step(); step()
        assertRingShows("A with nothing ringed")
    }
}
