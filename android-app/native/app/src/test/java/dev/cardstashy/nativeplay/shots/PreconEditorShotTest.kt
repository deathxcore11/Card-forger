package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performSemanticsAction
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.DeckEdit
import dev.cardstashy.nativeplay.ui.DeckEditor
import dev.cardstashy.nativeplay.ui.EditorUi
import dev.cardstashy.nativeplay.ui.PlayNav
import dev.cardstashy.nativeplay.ui.PlayTab
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The Final Fantasy Starter Kit's Blue-Black deck (Sephiroth, Planet's Heir) in the Play deck editor, as Randall opened it on 5 Nov:
 * its list holds Island and Swamp three times each (one row a printing), which stopped the editor when Lands came into view. Here it
 * opens, scrolls to Lands, folds Instants with a tap on the heading and opens it again, with a 24 dp status bar over the top.
 * The cards and art are Scryfall's, fetched here as the app would.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PreconEditorShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "precon-editor-$name.png").path)

    private val deck: JsonObject by lazy {
        val all = JsonParser.parseString(File(System.getProperty("repoRoot"), "data/play-starters/precons.json").readText()).asJsonObject
        val p = all["decks"].asJsonArray.map { it.asJsonObject }.first { it["key"].asString == "fin-ub" }
        JsonObject().apply { addProperty("id", "play-precon-fin-ub"); addProperty("name", p["name"].asString); addProperty("format", p["format"].asString); add("cards", p["rows"]) }
    }

    /** Scryfall's cards for the list: each printing the precon names, the rest by name. */
    private fun scryfall(rows: List<JsonObject>): List<JsonObject> {
        val ids = JsonArray().apply { rows.distinctBy { it["name"].asString + (it["number"]?.asString ?: "") }.forEach { r -> add(JsonObject().apply {
            if (r.has("number")) { addProperty("set", r["set"].asString); addProperty("collector_number", r["number"].asString) } else addProperty("name", r["name"].asString) }) } }
        val c = java.net.URI("https://api.scryfall.com/cards/collection").toURL().openConnection() as java.net.HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Accept", "application/json"); c.setRequestProperty("User-Agent", "CardStashyTests/1.0")
        c.outputStream.use { it.write(JsonObject().apply { add("identifiers", ids) }.toString().toByteArray()) }
        return JsonParser.parseString(c.inputStream.bufferedReader().readText()).asJsonObject["data"].asJsonArray.map { it.asJsonObject }
    }

    private fun run(statusBar: Int) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0") }
            .getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url }
        val rows = deck["cards"].asJsonArray.map { it.asJsonObject }
        val cards = scryfall(rows); CardFacts.seed(cards)
        // A bought precon: every card of it in the Trunk.
        val trunk = JsonArray().apply { cards.distinctBy { it["name"].asString }.forEach { c -> val n = c["name"].asString
            val img = c.getAsJsonObject("image_uris")?.get("normal")?.asString ?: c.getAsJsonArray("card_faces")[0].asJsonObject.getAsJsonObject("image_uris")["normal"].asString
            add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", n); addProperty("r", c["rarity"].asString)
                addProperty("c", rows.filter { it["name"].asString == n }.sumOf { it["qty"].asInt }); addProperty("h", 0); add("s", JsonArray().apply { add(c["set"].asString) })
                add("p", JsonObject().apply { addProperty("id", c["id"].asString); addProperty("set", c["set"].asString); addProperty("image", img); addProperty("number", c["collector_number"].asString) })
                addProperty("a", "2026-11-05T12:00:00Z") }) } }
        val state = JsonParser.parseString("""{"wallet":{"coins":1250,"xp":2750,"seal_c":6,"seal_u":3,"seal_r":2,"seal_m":1},"packs":[],"config":{"holoSeals":2},"decks":[]}""").asJsonObject.apply { add("cards", trunk) }
        val ui = EditorUi().apply { edit = DeckEdit.open(deck) }
        assertEquals("Island and Swamp come three rows each, as the precon lists them", 6, ui.edit.cards.count { it.name == "Island" || it.name == "Swamp" })

        WindowCompat.setDecorFitsSystemWindows(rule.activity.window, false)
        rule.setContent { DeckEditor(state, ui, {}, {}, {}, {}) { PlayNav(PlayTab.DECKS, {}) } }
        if (statusBar > 0) rule.runOnUiThread {
            val px = (statusBar * rule.activity.resources.displayMetrics.density).toInt()
            ViewCompat.dispatchApplyWindowInsets(rule.activity.window.decorView,
                WindowInsetsCompat.Builder().setInsets(WindowInsetsCompat.Type.statusBars(), Insets.of(0, px, 0, 0)).build())
        }
        settle(40)
        val tag = if (statusBar > 0) "-bar" else ""
        shot("top$tag")
        // The first row of the list (Sephiroth's group) scrolled up to the top, where the status bar sits.
        val list = rule.onNode(hasScrollAction())
        list.performScrollToNode(hasText("Ultimecia, Temporal Threat")); settle(); shot("ultimecia$tag")
        list.performScrollToNode(hasText("Lands")); list.performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, 300f) }; settle(30); shot("lands$tag")
        list.performScrollToNode(hasText("Instants")); settle()
        rule.onNode(hasText("Instants")).performClick(); settle(); shot("instants-folded$tag")
        rule.onNode(hasText("Dreams of Laguna")).assertDoesNotExist()
        rule.onNode(hasText("Instants")).performClick(); settle(); shot("instants-open$tag")
        list.performScrollToNode(hasText("Dreams of Laguna"))
    }

    @Test fun cover() = run(0)
    @Test fun coverUnderStatusBar() = run(24)
}
