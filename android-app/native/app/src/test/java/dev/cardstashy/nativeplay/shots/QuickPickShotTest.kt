package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.UserDeck
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.ui.LobbyModel
import dev.cardstashy.nativeplay.ui.LobbyScreen
import dev.cardstashy.nativeplay.ui.SeatDeck
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import dev.cardstashy.nativeplay.account.Decks as Workspace

/**
 * The lobby in the same states as the site harness (scratchpad site/lobby.mjs on web 4.3.87): the five starter decks as
 * Play decks (Blue fliers missing its cards from the Trunk) and one Collection deck (Mono-red aggro, missing Swiftspear).
 */
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import org.junit.Rule

/**
 * 0.4.59 T8, Quick Play's deck grid at five sizes: 25 of your decks (four formats, one long name, one missing cards), All. Each
 * row holds the size's columns (5 on a phone and the Fold, 6 on a tablet, 2 on an upright phone-wide screen), no tile meets another or
 * leaves the screen, and every name is whole on its two lines.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class QuickPickShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private val missing = java.util.TreeSet<String>()
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        if (f == null) { missing += url; return null }
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    private val cards by lazy { JsonParser.parseString(javaClass.classLoader!!.getResource("lobby-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject } }
    private val starters = listOf(
        Triple("w", "White angels · Starter", "Plains") to listOf("Healer's Hawk", "Hinterland Sanctifier", "Ajani's Pridemate", "Lifecreed Duo", "Helpful Hunter", "Dazzling Angel", "Inspiring Overseer", "Angel of Vitality", "Bovine Intervention"),
        Triple("u", "Blue fliers · Starter", "Island") to listOf("Spectral Sailor", "Harrier Strix", "Plumecreed Escort", "Floodpits Drowner", "Bellowing Crier", "Mocking Sprite", "Geyser Drake", "Essence Scatter", "Unsummon"),
        Triple("b", "Black drain · Starter", "Swamp") to listOf("Greedy Freebooter", "Infestation Sage", "Sanguine Syphoner", "Burglar Rat", "Marauding Blight-Priest", "Vampire Nighthawk", "Vile Entomber", "Murder", "Feed the Swarm"),
        Triple("r", "Red burn · Starter", "Mountain") to listOf("Fanatical Firebrand", "Reckless Lackey", "Firebrand Archer", "Sunset Strikemaster", "Scytheclaw Raptor", "Spitfire Lagac", "Volley Veteran", "Shock", "Lightning Strike"),
        Triple("g", "Green creatures · Starter", "Forest") to listOf("Llanowar Elves", "Bear Cub", "Ordinary Bear", "Ghalta, Primal Hunger", "Lashwhip Predator", "Tarmogoyf", "Tapestry Warden", "Virulent Emissary", "Scarecrow Guide"))

    private fun rows(land: String, names: List<String>) = JsonArray().apply {
        add(JsonObject().apply { addProperty("name", land); addProperty("qty", 24) }); names.forEach { n -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", 4) }) } }

    private fun setup() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        CardFacts.seed(cards)
        Account.setForTest(Account.Session("a", "r", Long.MAX_VALUE, "u1", "r@example.com"), Account.Profile("Randall", null, "randall"))
        val owned = starters.filter { it.first.first != "u" }.flatMap { it.second }.toSet() + "Mountain"
        val state = JsonObject().apply {
            add("wallet", JsonParser.parseString("""{"coins":170,"xp":230,"seal_c":0,"seal_u":0,"seal_r":0,"seal_m":0}"""))
            add("cards", JsonArray().apply { cards.filter { it["name"].asString in owned }.forEach { c ->
                add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", c["name"].asString); addProperty("r", c["rarity"].asString); addProperty("c", 4); addProperty("h", 0) }) } })
            // 24 Play decks: the five starters again and again in four formats, one with a very long name.
            val formats = listOf("Standard", "Modern", "Pioneer", "Pauper")
            add("decks", JsonArray().apply { (0 until 24).forEach { i -> val (t, names) = starters[i % starters.size]; add(JsonObject().apply {
                addProperty("id", "starter:" + t.first + i); addProperty("name", if (i == 7) "The Extremely Long Named Deck of Angels and Their Friends" else t.second.replace(" · Starter", " ${i + 1}"))
                addProperty("format", formats[i % formats.size]); add("cards", rows(t.third, names)) }) } })
        }
        Progress.setForTest(state, null)
        val col = JsonParser.parseString("""{"id":"col1","name":"Mono-red aggro","format":"Standard","cards":[{"name":"Mountain","qty":22},{"name":"Monastery Swiftspear","qty":4},{"name":"Shock","qty":4}],"side":[]}""").asJsonObject
        Workspace.setForTest(listOf(UserDeck("col1", "Mono-red aggro", "Standard", col)))
    }


    private fun shoot(size: String, cols: Int, rows: Int = 1) {
        setup()
        val m = LobbyModel("quick").apply { format = "Standard" }
        rule.setContent { LobbyScreen(m, {}, {}, {}, {}, {}, online = false) }
        rule.waitForIdle()
        // The decks start under the head and seats: scroll so the first row is at the top, as the ring's entry does (LIB_HEAD + 2).
        rule.onAllNodes(androidx.compose.ui.test.hasScrollToIndexAction()).onFirst().performScrollToIndex(4)
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "quickpick-$size.png").path)
        fun tag(n: androidx.compose.ui.semantics.SemanticsNode) = n.config.getOrNull(SemanticsProperties.TestTag)
        val tiles = rule.onAllNodes(SemanticsMatcher("tile") { tag(it)?.startsWith("deck:") == true }, useUnmergedTree = true).fetchSemanticsNodes()
        assertTrue("$size: tiles drawn", tiles.isNotEmpty())
        val top = tiles.minOf { it.boundsInRoot.top }
        val row = tiles.filter { kotlin.math.abs(it.boundsInRoot.top - top) < 2f }
        assertEquals("$size: the first row holds $cols", cols, row.size)
        // Whole tiles on screen, above the pinned Play bar: [rows] full rows at once (a phone on its side: two, 10 decks).
        val bar = rule.onAllNodes(androidx.compose.ui.test.hasText("Pick your deck", substring = true)).fetchSemanticsNodes().minOf { it.boundsInRoot.top }
        val whole = tiles.filter { it.boundsInRoot.top >= 0f && it.boundsInRoot.bottom <= bar }
        assertTrue("$size: ${whole.size} whole tiles above the bar, want ${rows * cols}", whole.size >= rows * cols)
        val w = RuntimeEnvironment.getApplication().resources.displayMetrics.widthPixels
        for (a in tiles) {
            assertTrue("$size: ${tag(a)} on screen ${a.boundsInRoot}", a.boundsInRoot.left >= 0f && a.boundsInRoot.right <= w + 1f)
            for (b in tiles) if (a !== b) assertTrue("$size: ${tag(a)} meets ${tag(b)}", !a.boundsInRoot.overlaps(b.boundsInRoot) || a.boundsInRoot.intersect(b.boundsInRoot).let { it.width < 1f || it.height < 1f })
        }
        // Names: whole (the size steps down until two lines hold it).
        val names = rule.onAllNodes(SemanticsMatcher("name") { tag(it)?.startsWith("deckname:") == true }, useUnmergedTree = true).fetchSemanticsNodes()
        for (n in names) {
            val res = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
            n.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult)?.action?.invoke(res)
            // Whole: every character of the name sits on its (at most two) lines.
            res.firstOrNull()?.let { r -> val text = r.layoutInput.text.text
                assertTrue("$size: ${tag(n)} is cut (lines ${r.lineCount}, ends ${r.getLineEnd(r.lineCount - 1, visibleEnd = true)} of ${text.trimEnd().length}, w ${r.didOverflowWidth} h ${r.didOverflowHeight})",
                    r.lineCount <= 2 && r.getLineEnd(r.lineCount - 1, visibleEnd = true) >= text.trimEnd().length) }
        }
    }

    @Test @Config(qualifiers = "w844dp-h390dp-land-xxhdpi") fun phone() = shoot("phone-844x390", 5, rows = 2)
    @Test @Config(qualifiers = "w374dp-h832dp-xxhdpi") fun foldFoldedUpright() = shoot("fold-folded-374x832", 2)
    @Test @Config(qualifiers = "w841dp-h701dp-xhdpi") fun foldUnfolded() = shoot("fold-unfolded-841x701", 5)
    @Test @Config(qualifiers = "w1280dp-h800dp-land-mdpi") fun tablet() = shoot("tablet-1280x800", 6)
    @Test @Config(qualifiers = "w960dp-h540dp-land-xhdpi") fun thorOneScreen() = shoot("thor-960x540", 5)
}
