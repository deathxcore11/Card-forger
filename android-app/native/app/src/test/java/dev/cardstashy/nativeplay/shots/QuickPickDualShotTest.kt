package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.ui.BottomRoot
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.LobbyModel
import dev.cardstashy.nativeplay.ui.LobbyScreen
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.PadFocus
import dev.cardstashy.nativeplay.ui.PadPrompts
import dev.cardstashy.nativeplay.ui.padRoot
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import dev.cardstashy.nativeplay.account.Decks as Workspace

/**
 * 0.4.59 T8b, Quick Play on the Thor's two screens: 30 of your decks. The bottom screen (620 by 540) holds the first 25 as a 5 by 5
 * grid, every tile whole with no scrolling, every name whole; the pad walks to deck 25 and RT turns to the next page. The top screen
 * (960 by 540) reads the deck under the ring: its name, card types, mana curve and its cards as the deck list's rows in two columns.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h1080dp-xhdpi")
class QuickPickDualShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    @After fun off() { DualScreen.pretend(null); Pad.forget() }

    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() } ?: return null
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    private val cards by lazy { JsonParser.parseString(javaClass.classLoader!!.getResource("lobby-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject } }
    private val starters = listOf(
        Triple("w", "White angels", "Plains") to listOf("Healer's Hawk", "Hinterland Sanctifier", "Ajani's Pridemate", "Lifecreed Duo", "Helpful Hunter", "Dazzling Angel", "Inspiring Overseer", "Angel of Vitality", "Bovine Intervention"),
        Triple("u", "Blue fliers", "Island") to listOf("Spectral Sailor", "Harrier Strix", "Plumecreed Escort", "Floodpits Drowner", "Bellowing Crier", "Mocking Sprite", "Geyser Drake", "Essence Scatter", "Unsummon"),
        Triple("b", "Black drain", "Swamp") to listOf("Greedy Freebooter", "Infestation Sage", "Sanguine Syphoner", "Burglar Rat", "Marauding Blight-Priest", "Vampire Nighthawk", "Vile Entomber", "Murder", "Feed the Swarm"),
        Triple("r", "Red burn", "Mountain") to listOf("Fanatical Firebrand", "Reckless Lackey", "Firebrand Archer", "Sunset Strikemaster", "Scytheclaw Raptor", "Spitfire Lagac", "Volley Veteran", "Shock", "Lightning Strike"),
        Triple("g", "Green creatures", "Forest") to listOf("Llanowar Elves", "Bear Cub", "Ordinary Bear", "Ghalta, Primal Hunger", "Lashwhip Predator", "Tarmogoyf", "Tapestry Warden", "Virulent Emissary", "Scarecrow Guide"))
    private fun rows(land: String, names: List<String>) = JsonArray().apply {
        add(JsonObject().apply { addProperty("name", land); addProperty("qty", 24) }); names.forEach { n -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", 4) }) } }

    private var model: LobbyModel? = null
    private fun show() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        CardFacts.seed(cards)
        Account.setForTest(Account.Session("a", "r", Long.MAX_VALUE, "u1", "r@example.com"), Account.Profile("Randall", null, "randall"))
        val state = JsonObject().apply {
            add("wallet", JsonParser.parseString("""{"coins":170,"xp":230,"seal_c":0,"seal_u":0,"seal_r":0,"seal_m":0}"""))
            add("cards", JsonArray().apply { cards.forEach { c ->
                add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", c["name"].asString); addProperty("r", c["rarity"].asString); addProperty("c", 4); addProperty("h", 0) }) } })
            // 30 Play decks, the five starters again and again, one with a very long name; all Standard so the 30 are one list.
            add("decks", JsonArray().apply { (0 until 30).forEach { i -> val (t, names) = starters[i % starters.size]; add(JsonObject().apply {
                addProperty("id", "d$i"); addProperty("name", if (i == 7) "The Extremely Long Named Deck of Angels and Their Friends" else "${t.second} ${i + 1}")
                addProperty("format", "Standard"); add("cards", rows(t.third, names)) }) } })
        }
        Progress.setForTest(state, null)
        Workspace.setForTest(emptyList())
        Pad.used()
        val m = LobbyModel("quick").apply { format = "Standard" }; model = m
        rule.setContent {
            CompositionLocalProvider(LocalIndication provides PadFocus) {
                Column(Modifier.fillMaxSize().background(Color.Black)) {
                    Box(Modifier.fillMaxWidth().height(540.dp).padRoot()) { LobbyScreen(m, {}, {}, {}, {}, {}, online = false) }
                    // The Thor's bottom panel: 1240 by 1080 px, 620 by 540 dp.
                    Box(Modifier.width(620.dp).height(540.dp)) { BottomRoot() }
                }
            }
        }
        rule.waitForIdle()
    }

    private fun tag(n: SemanticsNode) = n.config.getOrNull(SemanticsProperties.TestTag)
    private fun tagged(prefix: String) = rule.onAllNodes(SemanticsMatcher(prefix) { tag(it)?.startsWith(prefix) == true }, useUnmergedTree = true).fetchSemanticsNodes()
    private fun press(code: Int) { rule.runOnUiThread { PadPrompts.navigate(code) }; rule.waitForIdle() }
    private fun topName(): String = tagged("qtop.name").single().config.getOrNull(SemanticsProperties.Text)?.joinToString("") { it.text }.orEmpty()

    @Test fun thorTwoScreens() {
        show()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "quickpick-thor-dual.png").path)
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        val half = 540f * dm.density; val bottomW = 620f * dm.density
        // Bottom: the first 25 decks, five rows of five, whole on the bottom screen with nothing to scroll.
        val tiles = tagged("bdeck:")
        assertEquals("25 tiles on the bottom page", 25, tiles.size)
        assertEquals("five across", 5, tiles.map { (it.boundsInRoot.center.x / 20f).toInt() }.distinct().size)
        assertEquals("five down", 5, tiles.map { (it.boundsInRoot.center.y / 20f).toInt() }.distinct().size)
        for (a in tiles) {
            assertTrue("${tag(a)} whole on the bottom screen ${a.boundsInRoot}", a.boundsInRoot.top >= half - 1f && a.boundsInRoot.bottom <= 2 * half + 1f && a.boundsInRoot.left >= 0f && a.boundsInRoot.right <= bottomW + 1f)
            for (b in tiles) if (a !== b) assertTrue("${tag(a)} meets ${tag(b)}", !a.boundsInRoot.overlaps(b.boundsInRoot))
        }
        assertTrue("no scrolling on the bottom grid", rule.onAllNodes(androidx.compose.ui.test.hasScrollAction()).fetchSemanticsNodes().none { it.boundsInRoot.top >= half && it.boundsInRoot.height > half / 2 })
        for (n in tagged("bdeckname:")) {
            val res = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
            n.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult)?.action?.invoke(res)
            res.firstOrNull()?.let { r -> val text = r.layoutInput.text.text
                assertTrue("${tag(n)} is cut", r.lineCount <= 3 && r.getLineEnd(r.lineCount - 1, visibleEnd = true) >= text.trimEnd().length) }
        }
        assertTrue("page 1 of 2 shown", rule.onAllNodes(androidx.compose.ui.test.hasText("Page 1 of 2")).fetchSemanticsNodes().isNotEmpty())
        // Top: the ringed deck read in full, on the top screen.
        assertEquals("White angels 1", topName())
        for (t in listOf("qtop.deck", "qtop.types", "qtop.curve", "qtop.list")) assertTrue("$t on the top screen", tagged(t).single().boundsInRoot.bottom <= half + 1f)
        val list = tagged("qrow:")
        assertTrue("the deck's cards as rows (${list.size})", list.size >= 6)
        assertEquals("two columns of rows", 2, list.map { it.boundsInRoot.left.toInt() }.distinct().size)
        assertTrue("Plains is listed with its count", rule.onAllNodes(androidx.compose.ui.test.hasContentDescription("24 Plains"), useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty())
    }

    @Test fun padReachesDeckTwentyFiveThenTurnsThePage() {
        show()
        repeat(4) { press(android.view.KeyEvent.KEYCODE_DPAD_RIGHT) }
        repeat(4) { press(android.view.KeyEvent.KEYCODE_DPAD_DOWN) }
        assertEquals("the pad's ring on deck 25 shows it on top", "Green creatures 25", topName())
        // Up from the top row reaches the format chips; Right steps the chip (Standard after All); Down comes back to the decks.
        repeat(5) { press(android.view.KeyEvent.KEYCODE_DPAD_UP) }
        press(android.view.KeyEvent.KEYCODE_DPAD_RIGHT)
        assertEquals("Right on the chips: the next format", dev.cardstashy.nativeplay.ui.QuickPick.chips(dev.cardstashy.nativeplay.ui.LIVE_FORMATS)[1], model!!.pickFormat)
        rule.runOnUiThread { model!!.pickFormat = null }; rule.waitForIdle()
        press(android.view.KeyEvent.KEYCODE_DPAD_DOWN)
        // RT: page two (decks 26 to 30), the ring at its first.
        val acts = PadPrompts.current()
        assertTrue("LT/RT turn the page", acts.pageLabel == "Page" && acts.page != null)
        rule.runOnUiThread { acts.page!!(1) }; rule.waitForIdle()
        assertTrue("page 2 of 2", rule.onAllNodes(androidx.compose.ui.test.hasText("Page 2 of 2")).fetchSemanticsNodes().isNotEmpty())
        assertEquals("five decks on page two", 5, tagged("bdeck:").size)
        assertEquals("RT keeps the ring's place: deck 26", "White angels 26", topName())
    }
}
