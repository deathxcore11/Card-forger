package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionGame
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
import dev.cardstashy.nativeplay.ui.Site
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

/**
 * A Magic deck's tools that run in the app now: the ⋯ menu's More deck tools (Print playtest proxies, Add deck to collection,
 * Re-import / replace list), the deck page's I got cards (acquireSheet), and the Decks page's New and Import (A.newDeck,
 * deckImportSheet with Preview & match and Save deck). At the spec's sizes, 100% and 130% text, each writing what it found.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class DeckToolsShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val opened = ArrayList<String>()
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(120); rule.mainClock.advanceTimeBy(120); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "decktools-$name.png").path)
    private fun shows(t: String, substring: Boolean = true) = rule.onAllNodesWithText(t, substring = substring).fetchSemanticsNodes().isNotEmpty()
    private fun wait(t: String) = rule.waitUntil(60_000) { shows(t) }
    private fun tap(t: String, substring: Boolean = false) { rule.onAllNodes(hasText(t, substring = substring) and hasClickAction()).onFirst().performScrollTo().performClick(); settle(8) }
    private fun saved() = kotlinx.coroutines.runBlocking { JsonParser.parseString(CollectionEngine.saved()).asJsonObject }

    @After fun closeSheets() {
        CollectionWrites.menu.value = null; CollectionWrites.acquiring.value = null; CollectionWrites.proxySheet.value = null
        CollectionWrites.newDeck.value = null; CollectionWrites.deckImport.value = null
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
    private fun report(tag: String, found: Found) = File(System.getProperty("shotsDir"), "decktools-$tag.txt").writeText(buildString {
        appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
        appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
        appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
    })

    private fun run(tag: String, scale: Float, steps: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/mtg-deck/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText(fx["catalog"].toString())
        CollectionGame.init(app); CollectionGame.set(CardGame.MTG)
        opened.clear()
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
        }
        val found = Found()
        // The ⋯ menu's More deck tools.
        CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen("d5", tab = { opened += "tab:$it" }, web = { a, _ -> opened += "web:$a" }, openDeck = { opened += "deck:$it" },
            deleted = {}, site = { opened += "site:$it" })
        wait("More deck tools"); settle()
        tap("More deck tools", substring = true)
        wait("Add deck to collection"); settle()
        if (steps) {
            // Print playtest proxies: the proxy page opens over the menu (its window holds the page itself).
            tap("Print playtest proxies", substring = true)
            rule.waitUntil(30_000) { CollectionWrites.proxySheet.value != null }
            val p = CollectionWrites.proxySheet.value!!
            assertEquals("Sheoldred Black — deck proxies", p.title)
            assertTrue(p.html.contains("playtest proxies, not for sale"))
            CollectionWrites.proxySheet.value = null; settle(4)
        }
        // Add deck to collection: the menu gives way to the acquire sheet, every card ticked.
        tap("Add deck to collection", substring = true)
        wait("Add the whole deck to my collection"); settle()
        assertTrue("its parts", shows("Store them in") && shows("Select all") && shows("Select none") && shows("Sheoldred, the Apocalypse"))
        audit(found); shot("acquire-$tag")
        if (steps) {
            tap("Add to collection")
            wait("cards added to your collection."); settle()
            val lots = saved().getAsJsonArray("collection").map { it.asJsonObject }
            assertTrue("bought copies saved", lots.any { it["raw"]?.asJsonObject?.get("acquisition")?.asString == "Bought as a deck" && it["location"].asString == "Deck: Sheoldred Black" })
        }
        CollectionWrites.acquiring.value = null; settle(4)

        // Decks › New.
        CollectionWrites.newDeck.value = CollectionWrites.NewDeckOpen(openDeck = { id, t -> opened += "new:$id/$t" })
        wait("Create deck"); settle()
        assertTrue("its parts", shows("100 cards, singleton") && shows("Deck name") && shows("Budget $"))
        audit(found); shot("newdeck-$tag")
        if (steps) {
            tap("Create deck")
            wait("Enter a commander."); settle(4)
            shot("newdeck-error-$tag")
        }
        CollectionWrites.newDeck.value = null; settle(4)

        // Decks › Import (and the menu's Re-import, which offers to replace the deck).
        CollectionWrites.deckImport.value = CollectionWrites.DeckImportOpen(deck = "d5", openDeck = { id, t -> opened += "import:$id/$t" }, web = { opened += "site:$it" })
        wait("Preview & match"); settle()
        assertTrue("its parts", shows("Upload a file") && shows("Credit the creator (optional)") && shows("Save deck"))
        audit(found); shot("import-$tag")
        if (steps) {
            rule.onNode(hasSetTextAction() and hasContentDescription("Decklist")).performTextReplacement("4 Lightning Bolt\n4 Counterspell\n2 Swamp")
            settle(3)
            tap("Preview & match")
            wait("Matched against your collection."); settle()
            assertTrue("results", shows("to finish") && shows("Limited (40-card)"))
            audit(found); shot("import-preview-$tag")
            tap("Save deck")
            wait("Deck imported. Your collection is unchanged."); settle(4)
            assertTrue("the new deck opens on Cards: $opened", opened.any { it.startsWith("import:") && it.endsWith("/cards") })
        }
        assertTrue("nothing handed to the website: $opened", opened.none { it.startsWith("web:") || it.startsWith("site:") })
        report(tag, found)
    }

    @Test fun phone() = run("390x844", 1f, steps = true)
    @Test fun phoneBigText() = run("390x844-130", 1.3f, steps = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun small() = run("360x780", 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfolded() = run("954x860", 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfoldedBigText() = run("954x860-130", 1.3f, steps = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun landscape() = run("844x390", 1f, steps = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun tablet() = run("1024x768", 1f, steps = false)
}
