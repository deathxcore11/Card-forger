package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.click
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
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
 * Deck Bench (specs/deck-editor-native.md): the Final Fantasy Starter Kit's Blue-Black deck as a Play deck, two of its cards still to
 * craft, at the spec's sizes with the APK's bars and at 100% and 130% text. On the phone it also lifts a deck card over the browser
 * (the dock shrinks), lifts a Trunk card over the deck (the dock grows), drops both, and opens the big view. Each size writes what
 * it found (cut names, small text, small targets) next to its shots. Cards and art are Scryfall's, cached under build/shot-art/bench.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class DeckBenchShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val shots = File(System.getProperty("shotsDir")!!)
    private val cache = shots.parentFile.resolve("app/build/shot-art/bench").apply { mkdirs() }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(shots, "bench-$name.png").path)
    private fun key(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(url: String): ByteArray? = cache.resolve(key(url)).let { f ->
        if (f.exists()) f.readBytes() else runCatching { Thread.sleep(80)
            java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0"); setRequestProperty("Accept", "*/*") }.getInputStream().use { it.readBytes() } }
            .getOrNull()?.also { f.writeBytes(it) } }

    private val deck: JsonObject by lazy {
        val all = JsonParser.parseString(File(System.getProperty("repoRoot"), "data/play-starters/precons.json").readText()).asJsonObject
        val p = all["decks"].asJsonArray.map { it.asJsonObject }.first { it["key"].asString == "fin-ub" }
        JsonObject().apply { addProperty("id", "play-precon-fin-ub"); addProperty("name", p["name"].asString); addProperty("format", p["format"].asString); add("cards", p["rows"]) }
    }

    /** Scryfall's cards for the list (each printing the precon names, the rest by name) plus a few more for the Trunk, cached. */
    private fun scryfall(rows: List<JsonObject>, extra: List<String>): List<JsonObject> {
        val f = cache.resolve("cards-fin-ub.json")
        if (f.exists()) return JsonParser.parseString(f.readText()).asJsonArray.map { it.asJsonObject }
        val ids = JsonArray().apply {
            rows.distinctBy { it["name"].asString + (it["number"]?.asString ?: "") }.forEach { r -> add(JsonObject().apply {
                if (r.has("number")) { addProperty("set", r["set"].asString); addProperty("collector_number", r["number"].asString) } else addProperty("name", r["name"].asString) }) }
            extra.forEach { n -> add(JsonObject().apply { addProperty("name", n) }) } }
        val c = java.net.URI("https://api.scryfall.com/cards/collection").toURL().openConnection() as java.net.HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Accept", "application/json"); c.setRequestProperty("User-Agent", "CardStashyTests/1.0")
        c.outputStream.use { it.write(JsonObject().apply { add("identifiers", ids) }.toString().toByteArray()) }
        val text = c.inputStream.bufferedReader().readText()
        val data = JsonParser.parseString(text).asJsonObject["data"].asJsonArray
        f.writeText(data.toString())
        return data.map { it.asJsonObject }
    }

    private class Found(val ellipsized: MutableSet<String> = sortedSetOf(), val small: MutableSet<String> = sortedSetOf(), val tight: MutableSet<String> = sortedSetOf())

    /** What the screen shows right now: text cut with "…", text under 11 sp, and tap targets under 44 dp. */
    private fun audit(into: Found) {
        val d = rule.activity.resources.displayMetrics.density
        val root = rule.onRoot(useUnmergedTree = true).fetchSemanticsNode()
        fun walk(n: androidx.compose.ui.semantics.SemanticsNode) {
            val cfg = n.config
            cfg.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.let { act ->
                val out = ArrayList<TextLayoutResult>()
                if (act(out)) out.forEach { r ->
                    val text = r.layoutInput.text.text
                    if (r.lineCount > 0 && r.isLineEllipsized(r.lineCount - 1)) into.ellipsized += text
                    val sp = r.layoutInput.style.fontSize
                    if (sp.isSp && sp.value < 11f) into.small += "$text (${sp.value} sp)"
                }
            }
            if (cfg.contains(SemanticsActions.OnClick) && n.boundsInRoot.width > 0) {
                val w = n.boundsInRoot.width / d; val h = n.boundsInRoot.height / d
                val label = cfg.getOrNull(SemanticsProperties.ContentDescription)?.joinToString() ?: cfg.getOrNull(SemanticsProperties.Text)?.joinToString { it.text } ?: "?"
                if (w < 43.5f || h < 43.5f) into.tight += "$label (${w.toInt()}×${h.toInt()} dp)"
            }
            n.children.forEach(::walk)
        }
        walk(root)
    }

    private fun run(tag: String, status: Int, nav: Int, scale: Float, gestures: Boolean, shelves: Boolean = false) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> get(url)?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } ?: url }
        val rows = deck["cards"].asJsonArray.map { it.asJsonObject }
        val extra = listOf("Brazen Borrower", "Counterspell", "Go for the Throat", "Polluted Delta", "Thoughtseize", "Fatal Push")
        val cards = scryfall(rows, extra); CardFacts.seed(cards)
        // The deck's cards in the Trunk, but Sephiroth not yet and only one Il Mheg Pixie of three; a few more cards besides.
        val trunk = JsonArray().apply { cards.distinctBy { it["name"].asString }.forEach { c -> val n = c["name"].asString
            val inDeck = rows.filter { it["name"].asString == n }.sumOf { it["qty"].asInt }
            val have = when (n) { "Sephiroth, Planet's Heir" -> 0; "Il Mheg Pixie" -> 1; else -> if (inDeck == 0) 2 else inDeck + (if (n == "Undercity Dire Rat") 1 else 0) }
            if (have == 0) return@forEach
            val img = c.getAsJsonObject("image_uris")?.get("normal")?.asString ?: c.getAsJsonArray("card_faces")[0].asJsonObject.getAsJsonObject("image_uris")["normal"].asString
            add(JsonObject().apply { addProperty("o", c["oracle_id"].asString); addProperty("n", n); addProperty("r", c["rarity"].asString)
                addProperty("c", have); addProperty("h", 0); add("s", JsonArray().apply { add(c["set"].asString) })
                add("p", JsonObject().apply { addProperty("id", c["id"].asString); addProperty("set", c["set"].asString); addProperty("image", img); addProperty("number", c["collector_number"].asString) })
                addProperty("a", "2026-11-05T12:00:00Z") }) } }
        val state = JsonParser.parseString("""{"wallet":{"coins":1250,"xp":2750,"seal_c":6,"seal_u":3,"seal_r":2,"seal_m":0},"packs":[],"config":{"holoSeals":2},"decks":[]}""").asJsonObject.apply { add("cards", trunk) }
        // The engine's read (random-build-entry.mjs benchContext), answered here: example numbers in its shape.
        RandomBuild.benchEngine = { _, d ->
            val names = d["cards"].asJsonArray.map { it.asJsonObject["name"].asString }
            JsonObject().apply { addProperty("power", 58.4); addProperty("bracket", 2)
                add("roles", JsonParser.parseString("""[["Removal",9],["Draw",6],["Ramp",2]]"""))
                add("cards", JsonObject().apply { names.forEach { n -> add(n, JsonArray().apply { when {
                    n.contains("Intervention") || n.contains("Rat") -> add("Removal"); n.contains("Dreams") || n.contains("Esper") -> add("Draw") } }) } }) }
        }
        val ui = EditorUi().apply { adding = false; edit = DeckEdit.open(deck) }
        assertEquals("Island and Swamp come three rows each, as the precon lists them", 6, ui.edit.cards.count { it.name == "Island" || it.name == "Swamp" })

        WindowCompat.setDecorFitsSystemWindows(rule.activity.window, false)
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) { DeckEditor(state, ui, {}, {}, {}, {}) }
        }
        if (status > 0 || nav > 0) rule.runOnUiThread {
            val px = rule.activity.resources.displayMetrics.density
            ViewCompat.dispatchApplyWindowInsets(rule.activity.window.decorView, WindowInsetsCompat.Builder()
                .setInsets(WindowInsetsCompat.Type.statusBars(), Insets.of(0, (status * px).toInt(), 0, 0))
                .setInsets(WindowInsetsCompat.Type.navigationBars(), Insets.of(0, 0, 0, (nav * px).toInt())).build())
        }
        settle(40)
        val found = Found()
        audit(found)
        shot(tag)
        assertTrue("the engine's read reached the hero", rule.onAllNodesWithText("58").fetchSemanticsNodes().isNotEmpty())

        if (shelves) {
            // All cards, shelf by shelf (AllShelves.kt): "For this deck" and the newest sets from Scryfall, each loaded as it shows.
            rule.runOnUiThread { ui.mode = "all" }; settle(90)
            shot("$tag-all"); audit(found)
            assertTrue("For this deck shelf", rule.onAllNodesWithText("For this deck").fetchSemanticsNodes().isNotEmpty())
            rule.onNode(hasContentDescription("Cards to add, a shelf at a time")).performScrollToIndex(3); settle(60)
            shot("$tag-all-sets"); audit(found)
            File(shots, "bench-$tag-all.txt").writeText(buildString {
                appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
                appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
                appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
            })
            return
        }
        // The list's Lands, where the three Island rows sit (this stopped the old editor), then back to the top.
        val list = rule.onNode(hasScrollToIndexAction() and hasContentDescription("Deck list"))
        list.performScrollToNode(hasText("LANDS", substring = true))
        settle(); shot("$tag-lands"); audit(found)
        list.performScrollToIndex(0); settle()

        if (gestures) {
            val d = rule.activity.resources.displayMetrics.density
            val root = rule.onRoot().fetchSemanticsNode().boundsInRoot
            // Hold a deck card 400 ms, carry it down over the browser: the dock eases down to its small share.
            val rat = rule.onNode(hasContentDescription("4 Undercity Dire Rat")).fetchSemanticsNode().boundsInRoot
            val grid = rule.onNode(hasContentDescription("Cards to add")).fetchSemanticsNode().boundsInRoot
            val before = ui.edit.cards.filter { it.name == "Undercity Dire Rat" }.sumOf { it.qty }
            rule.onRoot().performTouchInput { down(rat.center) }
            rule.mainClock.advanceTimeBy(400); rule.waitForIdle()
            rule.onRoot().performTouchInput { moveTo(Offset(rat.center.x, rat.center.y + 40 * d)) }; settle(3)
            rule.onRoot().performTouchInput { moveTo(Offset(root.width * .45f, grid.top + grid.height * .55f)) }; settle(6)
            shot("$tag-drag-out")
            rule.onRoot().performTouchInput { up() }; settle(6)
            assertEquals("dropped on the browser, one copy comes out", before - 1, ui.edit.cards.filter { it.name == "Undercity Dire Rat" }.sumOf { it.qty })

            // Hold a Trunk card and carry it up over the deck: the dock grows.
            rule.onNode(hasContentDescription("Cards to add")).performScrollToNode(hasContentDescription("Counterspell")); settle()
            val tile = rule.onNode(hasContentDescription("Counterspell")).fetchSemanticsNode().boundsInRoot
            rule.onRoot().performTouchInput { down(tile.center) }
            rule.mainClock.advanceTimeBy(400); rule.waitForIdle()
            rule.onRoot().performTouchInput { moveTo(Offset(tile.center.x, tile.center.y - 40 * d)) }; settle(3)
            val dock = rule.onNode(hasContentDescription("Deck list")).fetchSemanticsNode().boundsInRoot
            rule.onRoot().performTouchInput { moveTo(Offset(root.width * .5f, dock.top + 60 * d)) }; settle(6)
            shot("$tag-drag-in")
            rule.onRoot().performTouchInput { up() }; settle(6)
            assertEquals("dropped on the deck, Counterspell goes in", 1, ui.edit.cards.filter { it.name == "Counterspell" }.sumOf { it.qty })

            // A tap on a deck card: the big view with its stepper and craft button (Sephiroth isn't owned yet).
            list.performScrollToNode(hasContentDescription("1 Sephiroth, Planet's Heir")); settle()
            rule.onNode(hasContentDescription("1 Sephiroth, Planet's Heir")).performTouchInput { click() }; settle()
            shot("$tag-peek"); audit(found)
            rule.onNode(hasContentDescription("Sephiroth, Planet's Heir, open the card")).fetchSemanticsNode()
            rule.activity.onBackPressedDispatcher.let { b -> rule.runOnUiThread { b.onBackPressed() } }; settle()

            // The other views of the deck.
            for ((k, v) in listOf("stacks" to "Stacks", "gallery" to "Gallery", "detail" to "Detailed")) {
                rule.onAllNodes(hasContentDescription(v)).onFirst().performClick(); settle(); shot("$tag-$k")
            }
            rule.onAllNodes(hasContentDescription("List")).onFirst().performClick(); settle()
        }
        File(shots, "bench-$tag.txt").writeText(buildString {
            appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
            appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
            appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
        })
    }

    @Test fun phone() = run("390x844", 24, 24, 1f, gestures = true)
    @Test fun phoneShelves() = run("390x844", 24, 24, 1f, gestures = false, shelves = true)
    @Test fun phoneShelvesBigText() = run("390x844-130", 24, 24, 1.3f, gestures = false, shelves = true)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfoldedShelves() = run("954x860", 24, 24, 1f, gestures = false, shelves = true)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun landscapeShelves() = run("844x390", 0, 0, 1f, gestures = false, shelves = true)
    @Test fun phoneBigText() = run("390x844-130", 24, 24, 1.3f, gestures = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun small() = run("360x780", 24, 48, 1f, gestures = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun smallBigText() = run("360x780-130", 24, 48, 1.3f, gestures = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfolded() = run("954x860", 24, 24, 1f, gestures = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfoldedBigText() = run("954x860-130", 24, 24, 1.3f, gestures = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun landscape() = run("844x390", 0, 0, 1f, gestures = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun landscapeBigText() = run("844x390-130", 0, 0, 1.3f, gestures = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun tablet() = run("1024x768", 24, 24, 1f, gestures = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun tabletBigText() = run("1024x768-130", 24, 24, 1.3f, gestures = false)
}
