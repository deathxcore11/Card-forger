package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performSemanticsAction
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.DeckEdit
import dev.cardstashy.nativeplay.play.RandomBuild
import dev.cardstashy.nativeplay.ui.DeckEditor
import dev.cardstashy.nativeplay.ui.EditorUi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Randall's 26 Nov Commander deck, drawn: a deck of real Commander cards with no commander yet (the photo's 99/100 case), then the
 * commander slot opened, Korvold, Fae-Cursed King set, and the Thor top screen's header folded by its grip. Desktop pictures from
 * real Scryfall cards (cached under build/shot-art/commander): they show the layout, never a device.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CommanderDeckShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val shots = File(System.getProperty("shotsDir")!!)
    private val cache = shots.parentFile.resolve("app/build/shot-art/commander").apply { mkdirs() }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(shots, "commander-$name.png").path)
    private fun key(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(url: String): ByteArray? = cache.resolve(key(url)).let { f ->
        if (f.exists()) f.readBytes() else runCatching { Thread.sleep(80)
            java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0"); setRequestProperty("Accept", "*/*") }.getInputStream().use { it.readBytes() } }
            .getOrNull()?.also { f.writeBytes(it) } }

    private val inDeck = listOf("Sol Ring", "Arcane Signet", "Cultivate", "Blasphemous Act", "Village Rites", "Command Tower", "Blood Crypt", "Stomping Ground",
        "Mayhem Devil", "Viscera Seer", "Deadly Dispute", "Blood Artist")
    private val extra = listOf("Korvold, Fae-Cursed King", "Atraxa, Praetors' Voice", "Yuriko, the Tiger's Shadow", "Lathril, Blade of the Elves")

    private fun scryfall(): List<JsonObject> {
        val f = cache.resolve("cards.json")
        if (f.exists()) return JsonParser.parseString(f.readText()).asJsonArray.map { it.asJsonObject }
        val ids = JsonArray().apply { (inDeck + extra).forEach { n -> add(JsonObject().apply { addProperty("name", n) }) } }
        val c = java.net.URI("https://api.scryfall.com/cards/collection").toURL().openConnection() as java.net.HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Accept", "application/json"); c.setRequestProperty("User-Agent", "CardStashyTests/1.0")
        c.outputStream.use { it.write(JsonObject().apply { add("identifiers", ids) }.toString().toByteArray()) }
        val data = JsonParser.parseString(c.inputStream.bufferedReader().readText()).asJsonObject["data"].asJsonArray
        f.writeText(data.toString()); return data.map { it.asJsonObject }
    }

    private fun setUp(): Pair<JsonObject, EditorUi> {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> get(url)?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } ?: url }
        val cards = scryfall(); CardFacts.seed(cards)
        val trunk = JsonArray().apply { cards.forEach { c -> val n = c["name"].asString
            if (n.startsWith("Yuriko") || n.startsWith("Lathril")) return@forEach   // not owned: these show "craft"
            val img = c.getAsJsonObject("image_uris")?.get("normal")?.asString ?: c.getAsJsonArray("card_faces")[0].asJsonObject.getAsJsonObject("image_uris")["normal"].asString
            add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", n); addProperty("r", c["rarity"].asString)
                addProperty("c", 1); addProperty("h", 0); add("s", JsonArray().apply { add(c["set"].asString) })
                add("p", JsonObject().apply { addProperty("id", c["id"].asString); addProperty("set", c["set"].asString); addProperty("image", img); addProperty("number", c["collector_number"].asString) })
                addProperty("a", "2026-11-05T12:00:00Z") }) } }
        val state = JsonParser.parseString("""{"wallet":{"coins":1250,"xp":2750,"seal_c":6,"seal_u":3,"seal_r":2,"seal_m":0},"packs":[],"config":{"holoSeals":2},"decks":[]}""").asJsonObject.apply { add("cards", trunk) }
        RandomBuild.benchEngine = { _, _ -> JsonObject().apply { addProperty("power", 58.4); addProperty("bracket", 4); add("roles", JsonParser.parseString("""[["Removal",2],["Ramp",3]]""")); add("cards", JsonObject()) } }
        val deck = JsonObject().apply { addProperty("id", "cmd-1"); addProperty("name", "New Commander deck"); addProperty("format", "Commander")
            add("cards", JsonArray().apply { inDeck.forEach { n -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", 1) }) } }) }
        return state to EditorUi().apply { adding = false; edit = DeckEdit.open(deck) }
    }

    @Test fun commanderSlotThenFillGate() {
        val (state, ui) = setUp()
        rule.setContent { DeckEditor(state, ui, {}, {}, {}, {}) }
        settle(40); shot("1-no-commander")
        assertTrue("Commander with no commander says so", rule.onAllNodesWithText("Choose commander").fetchSemanticsNodes().isNotEmpty())
        assertTrue("Fill waits for it", rule.onAllNodesWithText("Pick a commander first").fetchSemanticsNodes().isNotEmpty())
        rule.onNodeWithText("Choose commander").performSemanticsAction(SemanticsActions.OnClick); settle(60); shot("2-picker")
        assertTrue("your own legend is offered", rule.onAllNodesWithText("Korvold, Fae-Cursed King").fetchSemanticsNodes().isNotEmpty())
        rule.onNode(hasContentDescription("Korvold, Fae-Cursed King")).performSemanticsAction(SemanticsActions.OnClick); settle(10); shot("3-picked")
        rule.onNodeWithText("Set Korvold as commander").performSemanticsAction(SemanticsActions.OnClick); settle(40); shot("4-set")
        assertEquals("Korvold, Fae-Cursed King", ui.cmdr)
        assertEquals("the commander is first in the list", "Korvold, Fae-Cursed King", ui.edit.cards.first().name)
        assertTrue("the pill names it", rule.onAllNodesWithText("Commander: Korvold").fetchSemanticsNodes().isNotEmpty())
        assertTrue("Fill is a real button now", rule.onAllNodesWithText("Fill 87 empty slots").fetchSemanticsNodes().isNotEmpty())
    }

    @Test @Config(sdk = [35], qualifiers = "w960dp-h540dp-xxhdpi")
    fun thorTopGripFoldsTheHeader() {
        val (state, ui) = setUp()
        rule.setContent { DeckEditor(state, ui, {}, {}, {}, {}) }
        settle(40); shot("5-thor-open")
        rule.onNode(hasContentDescription("Hide the deck header for more room")).performSemanticsAction(SemanticsActions.OnClick); settle(20); shot("6-thor-folded")
        assertTrue("the grip now offers to open it", rule.onAllNodes(hasContentDescription("Show the deck header")).fetchSemanticsNodes().isNotEmpty())
    }
}
