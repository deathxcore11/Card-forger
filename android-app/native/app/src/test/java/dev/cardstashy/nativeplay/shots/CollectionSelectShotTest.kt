package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
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
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionCardsRoute
import dev.cardstashy.nativeplay.ui.CollectionGame
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Collection › Cards › Select through the real route, engine and sheets, all three games and all three views: Select on (the ticks and
 * the tray), two lots ticked, then (phones) Move into a new binder, Add to deck, Wishlist and Compare, each saved as the site saves it
 * (A.batchApply) and the ticks cleared; Done turns it off. At the spec's sizes with the APK's bars, 100% and 130% text, each writing
 * what it found (cut names, small text, small targets). Nothing hands off to the website.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionSelectShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val shots = File(System.getProperty("shotsDir")!!)
    private val cache = shots.parentFile.resolve("app/build/shot-art/bench").apply { mkdirs() }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(shots, "select-$name.png").path)
    private fun key(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(url: String): ByteArray? = cache.resolve(key(url)).let { f ->
        if (f.exists()) f.readBytes() else runCatching { Thread.sleep(80)
            java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0"); setRequestProperty("Accept", "*/*") }.getInputStream().use { it.readBytes() } }
            .getOrNull()?.also { f.writeBytes(it) } }
    /** The sheets are app-wide (CollectionWrites' flows outlive a test): none is left open for the next test class. */
    @org.junit.After fun closeSheets() {
        dev.cardstashy.nativeplay.ui.CollectionWrites.batch.value = null
        dev.cardstashy.nativeplay.ui.CollectionWrites.collMenu.value = null
        dev.cardstashy.nativeplay.ui.CollectionWrites.importing.value = null
    }
    private fun shows(t: String) = rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty()
    private fun wait(t: String) = rule.waitUntil(60_000) { shows(t) }
    private val unticked = SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Not selected")
    private val ticked = SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Selected")
    /**
     * Ticks the first two lots not yet ticked (a tap on the lot, as app.js attachCardGestures turns it over). The lot's own tap action
     * is used: a tall Gallery card can sit under the sticky tray, where a tap at its middle lands on the tray (as on the site).
     */
    private fun tickTwo() {
        // The list only holds the lots on screen: big text on a phone shows one, so the list is scrolled to the next one first.
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(unticked); settle(3)
        rule.onAllNodes(unticked).onFirst().performSemanticsAction(SemanticsActions.OnClick); wait("1 selected"); settle(3)
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(unticked); settle(3)
        rule.onAllNodes(unticked).onFirst().performSemanticsAction(SemanticsActions.OnClick); wait("2 selected"); settle(5)
    }

    private class Found(val ellipsized: MutableSet<String> = sortedSetOf(), val small: MutableSet<String> = sortedSetOf(), val tight: MutableSet<String> = sortedSetOf())
    private fun audit(into: Found) {
        val d = rule.activity.resources.displayMetrics.density
        fun walk(n: androidx.compose.ui.semantics.SemanticsNode) {
            val cfg = n.config
            cfg.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.let { act ->
                val out = ArrayList<TextLayoutResult>()
                if (act(out)) out.forEach { r ->
                    if (r.lineCount > 0 && r.isLineEllipsized(r.lineCount - 1)) into.ellipsized += r.layoutInput.text.text
                    val sp = r.layoutInput.style.fontSize
                    if (sp.isSp && sp.value < 11f) into.small += "${r.layoutInput.text.text} (${sp.value} sp)"
                }
            }
            if (cfg.contains(SemanticsActions.OnClick) && n.boundsInRoot.width > 0) {
                val w = n.boundsInRoot.width / d; val h = n.boundsInRoot.height / d
                val label = cfg.getOrNull(SemanticsProperties.ContentDescription)?.joinToString() ?: cfg.getOrNull(SemanticsProperties.Text)?.joinToString { it.text } ?: "?"
                if (w < 43.5f || h < 43.5f) into.tight += "$label (${w.toInt()}×${h.toInt()} dp)"
            }
            n.children.forEach(::walk)
        }
        walk(rule.onRoot(useUnmergedTree = true).fetchSemanticsNode())
    }

    /** The account's copy: the TCG fixture (TcgCollectionShotTest's) or, for Magic, the engine test's thirteen lots and a Burn deck. */
    private fun workspace(g: CardGame): JsonObject {
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        val ws = fx["workspace"].asJsonObject
        if (g == CardGame.MTG) {
            val prints = JsonParser.parseString(javaClass.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
            val lots = JsonArray(); val printings = JsonObject()
            prints.forEachIndexed { i, c ->
                printings.add(c["id"].asString, c)
                lots.add(JsonObject().apply {
                    addProperty("id", "l${i + 1}"); addProperty("name", c["name"].asString); addProperty("qty", if (c["name"].asString == "Lightning Bolt") 4 else 1); addProperty("printingId", c["id"].asString)
                    addProperty("set", c["set"].asString); addProperty("setName", c["set_name"].asString); addProperty("collectorNumber", c["collector_number"].asString)
                    addProperty("finish", if (c["name"].asString.startsWith("Ragavan")) "foil" else "nonfoil"); addProperty("condition", "Near Mint"); addProperty("language", "en")
                    addProperty("location", if (i == 1) "Red box" else ""); addProperty("printingVerified", true); addProperty("addedAt", "2026-11-01T12:00:00Z"); add("raw", JsonObject())
                })
            }
            ws.add("collection", lots); ws.add("printings", printings)
            ws.add("decks", JsonParser.parseString("""[{"id":"d1","name":"Burn","format":"modern","cards":[{"name":"Lightning Bolt","qty":4}]}]"""))
            ws["settings"].asJsonObject.addProperty("game", "mtg")
        }
        return fx
    }

    private fun run(g: CardGame, view: String, tag: String, status: Int, nav: Int, scale: Float, steps: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> get(url)?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } ?: url }
        val fx = workspace(g)
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        // The view last chosen (the route's own preference): Gallery, Compact or List.
        app.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE).edit()
            .putString(if (g == CardGame.MTG) "cardsView" else "cardsView-" + g.id, view).commit()
        CollectionGame.init(app); CollectionGame.set(g)
        dev.cardstashy.nativeplay.ui.CollectionWrites.batch.value = null
        dev.cardstashy.nativeplay.ui.CollectionWrites.collMenu.value = null; dev.cardstashy.nativeplay.ui.CollectionWrites.importing.value = null
        WindowCompat.setDecorFitsSystemWindows(rule.activity.window, false)
        var opened = ""
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) {
                Box(Modifier.fillMaxSize()) {
                    CollectionCardsRoute(onPlay = {}, onProfile = {}, onHome = {}, web = { u, p -> opened += "$u $p\n" }, nativeCard = true, onSet = { opened += "set $it\n" })
                    CollectionWritesHost(null)
                }
            }
        }
        if (status > 0 || nav > 0) rule.runOnUiThread {
            val px = rule.activity.resources.displayMetrics.density
            ViewCompat.dispatchApplyWindowInsets(rule.activity.window.decorView, WindowInsetsCompat.Builder()
                .setInsets(WindowInsetsCompat.Type.statusBars(), Insets.of(0, (status * px).toInt(), 0, 0))
                .setInsets(WindowInsetsCompat.Type.navigationBars(), Insets.of(0, 0, 0, (nav * px).toInt())).build())
        }
        rule.waitUntil(60_000) { shows("Binders") && shows("Value") }
        settle(20)
        // Another test in this run may have left the page on Binders or Value, or Select on (the engine and the page caches outlive a test).
        rule.onAllNodesWithText("Cards").onFirst().performClick(); settle(10)
        if (rule.onAllNodes(hasContentDescription("Done selecting")).fetchSemanticsNodes().isNotEmpty()) {
            rule.onAllNodes(hasContentDescription("Done selecting")).onFirst().performClick()
            rule.waitUntil(30_000) { rule.onAllNodes(hasContentDescription("Select cards")).fetchSemanticsNodes().isNotEmpty() }; settle(5)
        }
        // Select: the head button reads Done, each lot gets its tick, the tray says 0 selected with its buttons off.
        rule.onAllNodes(hasContentDescription("Select cards")).onFirst().performClick()
        wait("0 selected"); settle(10)
        val found = Found()
        audit(found); shot("${g.id}-$tag-on")
        tickTwo()
        assertTrue("two lots ticked", shows("2 selected") && rule.onAllNodes(ticked).fetchSemanticsNodes().isNotEmpty())
        audit(found); shot("${g.id}-$tag-two")
        // Compare: the two cards side by side.
        rule.onAllNodesWithText("Compare").onLast().performClick()
        wait("Compare cards"); settle(20)
        audit(found); shot("${g.id}-$tag-compare")
        rule.onAllNodes(hasContentDescription("Close")).onLast().performClick(); settle(10)
        // Move: where they live, a new binder typed in.
        rule.onAllNodesWithText("Move").onLast().performClick()
        wait("Move selected cards"); settle(10)
        audit(found); shot("${g.id}-$tag-move")
        if (steps) {
            rule.onAllNodes(hasContentDescription("Where it lives")).onLast().performClick(); settle(5)
            rule.onAllNodesWithText("＋ Create a binder…").onLast().performClick(); settle(5)
            rule.onNode(hasSetTextAction() and hasContentDescription("New binder name")).performTextReplacement("Trade binder")
            settle(3); shot("${g.id}-$tag-move-binder")
            rule.onAllNodesWithText("Move cards").onLast().performClick()
            wait("Selected cards updated."); wait("0 selected"); settle(10)
            assertTrue("the Move sheet closed", !shows("Move selected cards"))
            val saved = kotlinx.coroutines.runBlocking { CollectionEngine.saved() }
            assertTrue("a Trade binder was made", saved.contains("\"title\":\"Trade binder\""))
            // Add to deck: the deck's draft gets their copies.
            tickTwo()
            rule.onAllNodesWithText("Add to deck").onLast().performClick()
            wait("Add selected cards to a deck"); settle(10)
            audit(found); shot("${g.id}-$tag-deck")
            rule.onAllNodesWithText("Add to draft").onLast().performClick()
            wait("0 selected"); settle(10)
            assertTrue("the Deck sheet closed", !shows("Add selected cards to a deck"))
            // Wishlist.
            tickTwo()
            rule.onAllNodesWithText("Wishlist").onLast().performClick()
            wait("Add selected cards to wishlist"); settle(10)
            audit(found); shot("${g.id}-$tag-wish")
            rule.onAllNodesWithText("Add to wishlist").onLast().performClick()
            wait("0 selected"); settle(10)
            // Clear, then Done: the ticks and the tray go.
            tickTwo()
            rule.onAllNodesWithText("Clear").onLast().performClick(); wait("0 selected"); settle(5)
            rule.onNode(hasScrollToIndexAction()).performScrollToIndex(0); settle(5)
            rule.onAllNodes(hasContentDescription("Done selecting")).onFirst().performClick()
            rule.waitUntil(30_000) { !shows("0 selected") }; settle(10)
            assertTrue("no ticks once Done", rule.onAllNodes(unticked).fetchSemanticsNodes().isEmpty())
            shot("${g.id}-$tag-done")
        }
        assertTrue("Select didn't hand off to the website: $opened", opened.isEmpty())
        File(shots, "select-${g.id}-$tag.txt").writeText(buildString {
            appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
            appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
            appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
        })
    }

    @Test fun magicPhone() = run(CardGame.MTG, "compact", "390x844", 48, 34, 1f, steps = true)
    @Test fun pokemonPhone() = run(CardGame.PTCG, "gallery", "390x844", 48, 34, 1f, steps = true)
    @Test fun yugiohPhone() = run(CardGame.YGO, "symbols", "390x844", 48, 34, 1f, steps = true)
    @Test fun magicBigText() = run(CardGame.MTG, "compact", "390x844-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun pokemonSmall() = run(CardGame.PTCG, "symbols", "360x780", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun magicUnfolded() = run(CardGame.MTG, "gallery", "954x860", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun yugiohUnfoldedBigText() = run(CardGame.YGO, "compact", "954x860-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun magicLandscape() = run(CardGame.MTG, "symbols", "844x390", 0, 0, 1f, steps = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun pokemonTablet() = run(CardGame.PTCG, "compact", "1024x768", 48, 34, 1f, steps = false)
}
