package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionDeckRoute
import dev.cardstashy.nativeplay.ui.CollectionGame
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
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
 * A Magic deck's Versions and War Chest tabs (views.js deckVersions, warChestMarkup + deckPlaytest), drawn here from the site's
 * markup: Versions compares a saved version with the current list, Save current names a new one, Restore asks first and brings
 * the version back (app.js A.snapshot, A.restoreVer); War Chest's tools, the life tracker, Draw 7 and the game log, a tracked game
 * logged (A.lifeLog), a game saved from the form (A.logGame) and deleted (A.deleteNote), each saved as the site saves it. At the
 * spec's sizes, 100% and 130% text, each writing what it found. Nothing hands off to the website.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class MtgDeckTabsShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val webs = ArrayList<Pair<String, String?>>()
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(120); rule.mainClock.advanceTimeBy(120); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "deck-tabs-$name.png").path)
    private fun shows(t: String, substring: Boolean = true) = rule.onAllNodesWithText(t, substring = substring).fetchSemanticsNodes().isNotEmpty()
    // The page is a lazy list: on a short screen what it waits for may sit below the fold, so it scrolls there as it looks.
    private fun wait(t: String) = rule.waitUntil(60_000) { shows(t) || runCatching { rule.onAllNodes(hasScrollToIndexAction()).onFirst().performScrollToNode(hasText(t, substring = true)) }.isSuccess }
    private fun tap(t: String, substring: Boolean = false) { rule.onAllNodes(hasText(t, substring = substring) and hasClickAction()).onFirst().performScrollTo().performClick(); settle(8) }
    private fun deck() = kotlinx.coroutines.runBlocking { JsonParser.parseString(CollectionEngine.saved()).asJsonObject }
    private fun d5() = deck().getAsJsonArray("decks").map { it.asJsonObject }.first { it["id"].asString == "d5" }

    @After fun closeAsks() { CollectionWrites.askingText.value?.reply?.complete(null); CollectionWrites.askForTest(null) }

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

    private fun run(tag: String, scale: Float, steps: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/mtg-deck/fixture.json")!!.readText()).asJsonObject
        val ws = fx["workspace"].asJsonObject
        // Sheoldred Black with a saved version (its first card only) and a logged win.
        ws.getAsJsonArray("decks").map { it.asJsonObject }.first { it["id"].asString == "d5" }.apply {
            val first = JsonArray().apply { add(getAsJsonArray("cards")[0].deepCopy()) }
            add("versions", JsonArray().apply { add(JsonObject().apply { addProperty("id", "v1"); addProperty("label", "Version 1"); addProperty("date", "2026-11-01T12:00:00Z"); add("cards", first); add("side", JsonArray()) }) })
        }
        ws.add("notes", JsonParser.parseString("""[{"id":"n1","deckId":"d5","sig":"x","date":"11/2/2026","author":"","table":"","result":"Win","turn":6,"note":"Curved out"}]"""))
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.models.clear()
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(ws.toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText(fx["catalog"].toString())
        CollectionGame.init(app); CollectionGame.set(CardGame.MTG)
        webs.clear()
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) {
                Box(Modifier.fillMaxSize()) {
                    CollectionDeckRoute("d5", onPlay = {}, onProfile = {}, onBack = {}, onHome = {}, onCards = {}, onPractice = { _, _ -> },
                        web = { u, p -> webs += u to p }, game = CardGame.MTG, bench = false)
                    CollectionWritesHost(null)
                }
            }
        }
        rule.waitUntil(60_000) { shows("Sheoldred Black", substring = false) }
        settle()
        val found = Found()
        // Versions: Version 1 against the current list.
        tap("Versions")
        wait("Side by side"); settle()
        assertTrue("the compare table", shows("BEFORE") || shows("Before"))
        audit(found); shot("$tag-versions")
        if (steps) {
            tap("Save current")
            rule.waitUntil(20_000) { CollectionWrites.askingText.value != null }
            assertEquals("Name this version", CollectionWrites.askingText.value!!.question)
            assertEquals("Version 2", CollectionWrites.askingText.value!!.value)
            shot("$tag-versions-name")
            CollectionWrites.askingText.value!!.reply.complete("Before tuning"); settle()
            wait("Version saved."); settle()
            assertEquals(2, d5().getAsJsonArray("versions").size())
            wait("Before tuning")
            val before = d5().getAsJsonArray("cards").size()
            // History lists the newest first: Before tuning, then Version 1.
            rule.onAllNodes(hasText("Restore", substring = false) and hasClickAction())[1].performScrollTo().performClick(); settle(8)
            wait("Restore “Version 1”?"); settle(5); shot("$tag-versions-restore")
            rule.onAllNodes(hasText("Restore", substring = false) and hasClickAction()).fetchSemanticsNodes().size.let { assertTrue(it > 0) }
            rule.onAllNodes(hasText("Restore", substring = false) and hasClickAction())[rule.onAllNodes(hasText("Restore", substring = false) and hasClickAction()).fetchSemanticsNodes().size - 1].performClick()
            wait("Version restored."); settle()
            val after = d5()
            assertTrue("the version's list came back: $before → ${after.getAsJsonArray("cards").size()}", after.getAsJsonArray("cards").size() == 1)
            // The current list was already kept as Before tuning, so withSnapshot adds no copy of it.
            assertEquals("no second copy of the current list", 2, after.getAsJsonArray("versions").size())
            audit(found); shot("$tag-versions-restored")
        }
        // War Chest: its tools, the life tracker, the opening hand and the game log (the page back at its top, where its tabs are).
        rule.onAllNodes(hasScrollToIndexAction()).onFirst().performScrollToIndex(0); settle(4)
        tap("War Chest")
        wait("Opening hand"); settle()
        audit(found); shot("$tag-chest")
        if (steps) {
            tap("2 players"); wait("Next turn")
            tap("Next turn"); wait("Turn 2")
            // The two players' cards in view (the tracker's buttons under them).
            rule.onAllNodes(hasScrollToIndexAction()).onFirst().performScrollToNode(hasText("I won · log it")); settle(4)
            audit(found); shot("$tag-chest-life")
            tap("I won · log it"); wait("Game saved to the log."); settle()
            assertEquals(2, deck().getAsJsonArray("notes").size())
            assertTrue("the tracker closed", !shows("Next turn"))
            tap("Save"); wait("Game saved."); settle()
            assertEquals(3, deck().getAsJsonArray("notes").size())
            assertTrue("logged as a win", deck().getAsJsonArray("notes").last().asJsonObject["result"].asString == "Win")
            rule.onAllNodes(hasContentDescription("Delete game") and hasClickAction()).onFirst().performScrollTo().performClick(); settle()
            rule.waitUntil(20_000) { deck().getAsJsonArray("notes").size() == 2 }
            tap("Goldfish")
            wait("DECK POWER")
        }
        assertTrue("nothing handed to the website: $webs", webs.isEmpty())
        File(System.getProperty("shotsDir"), "deck-tabs-$tag.txt").writeText(buildString {
            appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
            appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
            appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
        })
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
