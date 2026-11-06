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
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.foundation.background
import dev.cardstashy.nativeplay.ui.Site
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
 * A deck's share sheet (views.js shareSheet; tcg.js A.tShare for Yu-Gi-Oh! and Pokémon), opened from the Magic deck page's Share
 * and a Yu-Gi-Oh! deck's ⋯ menu: who it's shown as and the deck's note, Create link (saved first, app.js A.shareMake), then the
 * link (share.js encodeShare's "z.", made here), Copy link and Preview. At the spec's sizes, 100% and 130% text, each writing what it
 * found. Nothing else hands off to the website; Preview opens the link itself.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionShareShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val webs = ArrayList<Pair<String, String?>>()
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(120); rule.mainClock.advanceTimeBy(120); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "share-$name.png").path)
    private fun shows(t: String, substring: Boolean = true) = rule.onAllNodesWithText(t, substring = substring).fetchSemanticsNodes().isNotEmpty()
    private fun wait(t: String) = rule.waitUntil(60_000) { shows(t) }
    private fun tap(t: String, substring: Boolean = false) { rule.onAllNodes(hasText(t, substring = substring) and hasClickAction()).onFirst().performScrollTo().performClick(); settle(8) }
    private fun saved() = kotlinx.coroutines.runBlocking { JsonParser.parseString(CollectionEngine.saved()).asJsonObject }
    private val magician = "094ab313-b1e1-4778-aefc-52ceb9c90ae5"

    @After fun closeSheets() { CollectionWrites.share.value = null; CollectionWrites.menu.value = null }

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

    private fun report(tag: String, found: Found) = File(System.getProperty("shotsDir"), "share-$tag.txt").writeText(buildString {
        appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
        appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
        appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
    })

    /** Magic: Sheoldred Black's page, its Share. */
    private fun magic(tag: String, scale: Float, steps: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/mtg-deck/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
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
        tap("Share")
        wait("Share this deck"); settle()
        assertTrue("the form", shows("Shown as creator") && shows("About this deck") && shows("Create link"))
        audit(found); shot("mtg-$tag")
        if (steps) {
            rule.onNode(hasSetTextAction() and hasContentDescription("Shown as creator")).performTextReplacement("Randall")
            settle(3)
            tap("Create link")
            wait("Copy link"); settle()
            assertEquals("Randall", saved().getAsJsonObject("settings")["authorName"].asString)
            assertTrue("Update link", shows("Update link") && shows("characters. The link holds the list itself"))
            audit(found); shot("mtg-$tag-link")
            tap("Copy link")
            wait("Link copied — paste it anywhere.")
            val clip = (app.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).primaryClip?.getItemAt(0)?.text?.toString().orEmpty()
            assertTrue(clip, clip.startsWith("https://cardstashy.com/#shared/z."))
            tap("Preview")
            assertEquals(clip, webs.lastOrNull()?.first)
            webs.removeAt(webs.size - 1)
        }
        assertTrue("nothing else handed to the website: $webs", webs.isEmpty())
        report("mtg-$tag", found)
    }

    /** Yu-Gi-Oh!: Dark Magician's ⋯ menu, its Share deck. */
    private fun yugioh(tag: String, scale: Float) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
        }
        CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(magician, tab = {}, web = { a, _ -> webs += a to null }, openDeck = {}, deleted = {}, game = "ygo",
            share = { CollectionWrites.share.value = CollectionWrites.ShareOpen(magician, "ygo", preview = { l -> webs += l to null }) })
        wait("Share deck"); settle()
        tap("Share deck")
        wait("Copy link"); settle()
        assertTrue("the link", shows("https://cardstashy.com/#shared/z."))
        val found = Found()
        audit(found); shot("ygo-$tag")
        assertTrue("nothing handed to the website: $webs", webs.isEmpty())
        report("ygo-$tag", found)
    }

    @Test fun phone() = magic("390x844", 1f, steps = true)
    @Test fun phoneBigText() = magic("390x844-130", 1.3f, steps = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun small() = magic("360x780", 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfolded() = magic("954x860", 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfoldedBigText() = magic("954x860-130", 1.3f, steps = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun landscape() = magic("844x390", 1f, steps = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun tablet() = magic("1024x768", 1f, steps = false)
    @Test fun yugiohPhone() = yugioh("390x844", 1f)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun yugiohUnfolded() = yugioh("954x860", 1f)
}
