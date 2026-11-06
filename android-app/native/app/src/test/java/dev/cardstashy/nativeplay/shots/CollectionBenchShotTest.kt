package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasAnyAncestor
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
import dev.cardstashy.nativeplay.ui.BenchUi
import dev.cardstashy.nativeplay.ui.CollectionBench
import dev.cardstashy.nativeplay.ui.CollectionDeckModel
import dev.cardstashy.nativeplay.ui.CollectionDeckActions
import org.junit.Assume.assumeTrue
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
 * Deck Bench for a Collection deck (specs/deck-editor-native.md): the site's own deck page model (CollectionEngineTest.deckModel's
 * Izzet Tempo, build/shot-art/home/collection-deck-gallery.json) on the Bench, with the collection as its browser (the engine's
 * Collection.benchPool, collection-bench-pool.json). At the spec's sizes with the APK's bars, at 100% and 130% text; each size writes
 * what it found (cut names, small text, small targets). A + on a collection tile and a − in the deck reach the site's handlers.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionBenchShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val shots = File(System.getProperty("shotsDir")!!)
    private val home = shots.parentFile.resolve("app/build/shot-art/home")
    private val cache = shots.parentFile.resolve("app/build/shot-art/bench").apply { mkdirs() }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(shots, "cbench-$name.png").path)
    private fun key(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(url: String): ByteArray? = cache.resolve(key(url)).let { f ->
        if (f.exists()) f.readBytes() else runCatching { Thread.sleep(80)
            java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0"); setRequestProperty("Accept", "*/*") }.getInputStream().use { it.readBytes() } }
            .getOrNull()?.also { f.writeBytes(it) } }

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

    private fun run(tag: String, status: Int, nav: Int, scale: Float, steps: Boolean) {
        val deckFile = home.resolve("collection-deck-gallery.json"); val poolFile = home.resolve("collection-bench-pool.json")
        assumeTrue("write the fixtures first (CollectionEngineTest.deckModel)", deckFile.exists() && poolFile.exists())
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> get(url)?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } ?: url }
        val m = CollectionDeckModel.parse(JsonParser.parseString(deckFile.readText()).asJsonObject)
        val pool = JsonParser.parseString(poolFile.readText()).asJsonArray
        val ui = BenchUi()
        val qtys = mutableListOf<Pair<String, Int>>(); val adds = mutableListOf<String>(); val acts = mutableListOf<String>()
        WindowCompat.setDecorFitsSystemWindows(rule.activity.window, false)
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) {
                CollectionBench(m, pool, ui, CollectionDeckActions(qty = { n, d -> qtys += n to d }, addCard = { n, _ -> adds += n }, act = { a, _ -> acts += a }),
                    tab = { it == "cards" }, tabBody = {})
            }
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
        assertTrue("the deck's title shows", rule.onAllNodesWithText("Izzet Tempo").fetchSemanticsNodes().isNotEmpty())
        if (steps) {
            // A + on a collection card the deck lacks goes through the site's deckAdd; one already in it through deckQty.
            val outside = pool.map { it.asJsonObject["name"].asString }.first { n -> m.groups.none { g -> g.cards.any { it.r.name == n } } && !dev.cardstashy.nativeplay.play.Decks.isBasicLand(n) }
            rule.onNode(hasContentDescription("Cards to add")).performScrollToNode(hasContentDescription(outside)); settle()
            rule.onAllNodes(hasContentDescription("Add $outside", substring = true)).onFirst().performClick(); settle()
            assertEquals(listOf(outside), adds)
            // The sideboard sits under the deck, its cards open the card page; the review chip is the page's (A.deckReview).
            rule.onNode(hasScrollToIndexAction() and hasContentDescription("Deck list")).performScrollToNode(hasText("SIDEBOARD", substring = true)); settle(); shot("$tag-side"); audit(found)
            rule.onNode(hasContentDescription("2 Counterspell") and hasAnyAncestor(hasContentDescription("Deck list"))).let { n ->
                rule.onAllNodes(hasContentDescription("2 Counterspell")).fetchSemanticsNodes().size.let { k -> assertTrue("the sideboard's Counterspell shows", k >= 1) } }
            rule.onAllNodesWithText("2 to review").onFirst().performClick(); settle()
            // The practice button is the page's own (A.deckPlayCpu).
            rule.onAllNodesWithText("Practice").onFirst().performClick(); settle()
            assertEquals(listOf("deckReview", "deckPlayCpu"), acts)
            for ((k, v) in listOf("stacks" to "Stacks", "gallery" to "Gallery")) { rule.onAllNodes(hasContentDescription(v)).onFirst().performClick(); settle(); shot("$tag-$k") }
            rule.onAllNodes(hasContentDescription("List")).onFirst().performClick(); settle()
        }
        File(shots, "cbench-$tag.txt").writeText(buildString {
            appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
            appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
            appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
        })
    }

    @Test fun phone() = run("390x844", 48, 34, 1f, steps = true)
    @Test fun phoneBigText() = run("390x844-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun small() = run("360x780", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfolded() = run("954x860", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun unfoldedBigText() = run("954x860-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun landscape() = run("844x390", 0, 0, 1f, steps = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun tablet() = run("1024x768", 48, 34, 1f, steps = false)
}
