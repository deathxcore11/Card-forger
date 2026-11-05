package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.swipeLeft
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.MetaLists
import dev.cardstashy.nativeplay.ui.DecksScreen
import dev.cardstashy.nativeplay.ui.DecksTabs
import dev.cardstashy.nativeplay.ui.FinderUi
import dev.cardstashy.nativeplay.ui.OpenPrecon
import dev.cardstashy.nativeplay.ui.PlayNav
import dev.cardstashy.nativeplay.ui.PlayTab
import dev.cardstashy.nativeplay.ui.PreconLayer
import dev.cardstashy.nativeplay.ui.PreconPage
import dev.cardstashy.nativeplay.ui.PreconStore
import dev.cardstashy.nativeplay.ui.PreconUi
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
 * Play › Decks as three tabs (Randall 5 Nov 16:58Z-17:16Z): My decks, Precons (product rails, then Standard + White
 * filtered), a precon's page (Red-White: what it needs, Craft these first, the list), Meta (the Finder embedded) and
 * the Random deck sheet (Deck Forge).
 * The five starter precons are the app's own list with Scryfall's cards; the meta lists are the site's
 * /api/meta/mtg answer saved on 5 Nov (the shots never wait on the network).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PlayDecksTabsShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "play-decks-$name.png").path)
    private val ua = "CardStashyTests/1.0"

    private fun post(url: String, body: String): JsonObject { val c = java.net.URI(url).toURL().openConnection() as java.net.HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("User-Agent", ua)
        c.outputStream.use { it.write(body.toByteArray()) }; return JsonParser.parseString(c.inputStream.bufferedReader().readText()).asJsonObject }

    @Test fun tabs() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", ua) }
            .getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url }
        val all = JsonParser.parseString(File(System.getProperty("repoRoot"), "data/play-starters/precons.json").readText()).asJsonObject["decks"].asJsonArray.map { it.asJsonObject }
            .filter { it["format"].asString == "Standard" }
        // Scryfall's card for every row: the printing the precon names, else the card by name.
        val ids = LinkedHashMap<String, JsonObject>()
        for (p in all) for (r in p["rows"].asJsonArray.map { it.asJsonObject }) { val k = r["name"].asString + "|" + (r["number"]?.asString ?: "")
            ids.putIfAbsent(k, JsonObject().apply { if (r.has("number")) { addProperty("set", r["set"].asString); addProperty("collector_number", r["number"].asString) } else addProperty("name", r["name"].asString) }) }
        val cards = ids.entries.chunked(75).flatMap { chunk -> Thread.sleep(120)
            post("https://api.scryfall.com/cards/collection", JsonObject().apply { add("identifiers", JsonArray().apply { chunk.forEach { add(it.value) } }) }.toString())["data"].asJsonArray.map { it.asJsonObject } }
        CardFacts.seed(cards)
        fun cardFor(r: JsonObject) = cards.firstOrNull { r.has("number") && it["collector_number"].asString == r["number"].asString && it["set"].asString == r["set"].asString }
            ?: cards.firstOrNull { it["name"].asString == r["name"].asString || it["name"].asString.split(" // ")[0] == r["name"].asString }
        fun rows(p: JsonObject) = p["rows"].asJsonArray.map { it.asJsonObject }.map { r -> val c = cardFor(r)
            Decks.Row(r["name"].asString, r["qty"].asInt, r["board"]?.asString, c?.get("set")?.asString ?: "", c?.get("collector_number")?.asString ?: "", c?.get("id")?.asString ?: "", c?.get("rarity")?.asString ?: "common") }
        PreconStore.clearForTest()
        val index = all.map { p -> val face = cards.first { it["name"].asString == p["face"].asString }
            Decks.PreconEntry(p["name"].asString, face["set"].asString.uppercase(), "Starter Kit", p["released"].asString, p["key"].asString + ".json") }
        for (p in all) { val rs = rows(p); val colors = HashSet<String>()
            rs.forEach { r -> mapOf("Plains" to "W", "Island" to "U", "Swamp" to "B", "Mountain" to "R", "Forest" to "G")[r.name]?.let { colors.add(it) }
                cards.firstOrNull { it["id"].asString == r.id }?.getAsJsonArray("color_identity")?.forEach { colors.add(it.asString) } }
            val face = cards.first { it["name"].asString == p["face"].asString }
            PreconStore.summaries[p["key"].asString + ".json"] = PreconStore.Summary(face["name"].asString to face["id"].asString, "WUBRG".map { it.toString() }.filter { it in colors }, listOf("Standard", "Pioneer"), rs) }
        // The Trunk: Blue-Black bought whole, a few Hare Raising and Red-White cards; seals c6 u3 r2 m1 and 1,250 coins.
        fun owned(p: String, take: (Decks.Row) -> Boolean) = rows(all.first { it["key"].asString == p }).filter { !Decks.isBasicLand(it.name) && take(it) }
        val have = owned("fin-ub") { true } + owned("blb-gw") { it.rarity != "rare" && it.rarity != "mythic" } +
            owned("fin-rw") { it.name in setOf("Coeurl", "Dwarven Castle Guard", "Slash of Light", "Item Shopkeep", "Warrior's Sword", "Adelbert Steiner", "G'raha Tia", "Rosa, Resolute White Mage") }
        val trunk = JsonArray().apply { have.groupBy { it.name }.forEach { (n, rs) -> val c = cards.first { it["id"].asString == rs[0].id }
            add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", n); addProperty("r", c["rarity"].asString); addProperty("c", rs.sumOf { it.qty }); addProperty("h", 0)
                add("s", JsonArray().apply { add(c["set"].asString) }); add("p", JsonObject().apply { addProperty("id", c["id"].asString); addProperty("set", c["set"].asString); addProperty("number", c["collector_number"].asString) }) }) } }
        fun saved(p: String, id: String) = JsonObject().apply { val pr = all.first { it["key"].asString == p }; addProperty("id", id); addProperty("name", pr["name"].asString); addProperty("format", "Standard")
            add("cards", JsonArray().apply { rows(pr).forEach { r -> add(JsonObject().apply { addProperty("name", r.name); addProperty("qty", r.qty); addProperty("set", r.set); addProperty("number", r.number); addProperty("id", r.id) }) } }) }
        val state = JsonParser.parseString("""{"wallet":{"coins":1250,"xp":2750,"seal_c":6,"seal_u":3,"seal_r":2,"seal_m":1},"packs":[],"config":{"holoSeals":2}}""").asJsonObject.apply {
            add("cards", trunk); add("decks", JsonArray().apply { add(saved("fin-ub", "d1")); add(saved("blb-gw", "d2")) }) }
        // Meta: the Standard feed (/api/meta/mtg, saved 5 Nov), as the Finder loads it.
        MetaLists.seed("Standard", JsonParser.parseString(javaClass.classLoader!!.getResource("play-decks/meta-standard.json")!!.readText()).asJsonObject)
        val meta = FinderUi().apply { format = "Standard"; lists = MetaLists.cached("Standard"); loadedFor = "Standard" }
        val pc = PreconUi().apply { this.index = index }
        val tabs = DecksTabs()
        val rw = all.first { it["key"].asString == "fin-rw" }
        val owned = Decks.ownedByName(state)

        rule.setContent {
            androidx.compose.foundation.layout.Box {
                DecksScreen(state, {}, {}, {}, {}, { PlayNav(PlayTab.DECKS, {}) }, pc, tabs = tabs, meta = meta,
                    onOpenPrecon = { e -> val p = all.first { it["key"].asString + ".json" == e.fileName }
                        pc.open = OpenPrecon(e.fileName, p["name"].asString, "Final Fantasy Starter Kit", p["released"].asString, listOf("Standard", "Pioneer"), rows(p)) })
                PreconLayer(pc) { o, back -> PreconPage(state, o, owned, pc, onBack = back, onCard = {}, toast = {}, nav = { PlayNav(PlayTab.DECKS, {}) }) }
                if (tabs.randomOpen) dev.cardstashy.nativeplay.ui.RandomDeckSheet(onClose = { tabs.randomOpen = false }) { _, _ -> }
            }
        }
        settle(30); shot("mine")
        rule.onRoot().performTouchInput { swipeLeft() }; settle(30)
        assertEquals("a swipe moves to Precons", 1, tabs.tab)
        shot("precons")
        rule.onNodeWithText("Standard").performClick(); rule.onNodeWithContentDescription("White").performClick(); settle(20)
        assertTrue("Standard + White keeps Red-White and Hare Raising", rule.onAllNodesWithText("Red-White").fetchSemanticsNodes().isNotEmpty())
        assertTrue("…and leaves Blue-Black out", rule.onAllNodesWithText("Blue-Black").fetchSemanticsNodes().isEmpty())
        shot("precons-filtered")
        rule.onNodeWithText("Red-White").performClick(); settle(30)
        shot("precon-page")
        val page = rule.onAllNodes(hasScrollAction())[rule.onAllNodes(hasScrollAction()).fetchSemanticsNodes().size - 1]
        page.performScrollToNode(hasText("The list")); page.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, 1300f) }; settle(20)
        rule.onAllNodesWithText("Craft ×2")[0].performClick(); settle(5)
        assertTrue("one tap arms a card's craft", rule.onAllNodesWithText("Tap to craft").fetchSemanticsNodes().isNotEmpty())
        shot("precon-list")
        rule.onNodeWithContentDescription("Back to the precons").performClick(); settle(20)
        assertEquals("back returns to the same tab", 1, tabs.tab)
        assertTrue("…with the filters kept", pc.filters.format == "Standard" && "W" in pc.filters.colors)
        rule.onRoot().performTouchInput { swipeLeft() }; settle(40)
        assertEquals(2, tabs.tab)
        shot("meta")
        // Random deck: the My decks tile opens Deck Forge's sheet (Standard or Commander, classic or infinite mana).
        rule.onNodeWithText("My decks").performClick(); settle(20)
        assertEquals(0, tabs.tab)
        rule.onNodeWithText("Random deck").performClick(); settle(10)
        assertTrue("the tile opens the Deck Forge sheet", rule.onAllNodesWithText("Build random deck").fetchSemanticsNodes().isNotEmpty())
        shot("random")
    }
}
