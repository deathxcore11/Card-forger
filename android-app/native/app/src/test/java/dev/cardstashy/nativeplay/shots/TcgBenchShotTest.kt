package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionDeckRoute
import dev.cardstashy.nativeplay.ui.CollectionGame
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
 * Deck Bench for a Yu-Gi-Oh! and a Pokémon deck of the Collection (specs/deck-editor-native.md, "All three games"), through the
 * real route and engine over TcgCollectionShotTest's collection: the Dark Magician deck (Main by Monsters / Spells, the Side Deck
 * after → side) and the Pikachu ex deck (Pokémon / Trainers / Energy, its Rules review). At the spec's sizes with the APK's bars,
 * at 100% and 130% text, each writing what it found (cut names, small text, small targets). A collection card's + and a row's
 * → side save through the site's own handlers (tcg.js tDeckAdd, tDeckMove) and the Bench draws again.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class TcgBenchShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val shots = File(System.getProperty("shotsDir")!!)
    private val cache = shots.parentFile.resolve("app/build/shot-art/bench").apply { mkdirs() }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(shots, "tbench-$name.png").path)
    private fun key(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(url: String): ByteArray? = cache.resolve(key(url)).let { f ->
        if (f.exists()) f.readBytes() else runCatching { Thread.sleep(80)
            java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0"); setRequestProperty("Accept", "*/*") }.getInputStream().use { it.readBytes() } }
            .getOrNull()?.also { f.writeBytes(it) } }
    private fun shows(t: String) = rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty()

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

    private val pikachu = "1c5ee49c-a4ba-4506-ae2b-1e0761e20324"
    private val magician = "094ab313-b1e1-4778-aefc-52ceb9c90ae5"

    private fun run(g: CardGame, tag: String, status: Int, nav: Int, scale: Float, steps: Boolean, shelves: Boolean = false) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> get(url)?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } ?: url }
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        CollectionGame.init(app); CollectionGame.set(g)
        val (id, title) = if (g == CardGame.YGO) magician to "Dark Magician" else pikachu to "Pikachu ex"
        WindowCompat.setDecorFitsSystemWindows(rule.activity.window, false)
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, scale)) {
                CollectionDeckRoute(id, onPlay = {}, onProfile = {}, onBack = {}, onHome = {}, onCards = {}, onPractice = { _, _ -> }, web = { _, _ -> }, game = g)
            }
        }
        if (status > 0 || nav > 0) rule.runOnUiThread {
            val px = rule.activity.resources.displayMetrics.density
            ViewCompat.dispatchApplyWindowInsets(rule.activity.window.decorView, WindowInsetsCompat.Builder()
                .setInsets(WindowInsetsCompat.Type.statusBars(), Insets.of(0, (status * px).toInt(), 0, 0))
                .setInsets(WindowInsetsCompat.Type.navigationBars(), Insets.of(0, 0, 0, (nav * px).toInt())).build())
        }
        rule.waitUntil(60_000) { rule.onAllNodesWithText(title).fetchSemanticsNodes().isNotEmpty() }
        // The deck reopens on the tab it was left on (tcg.js S.ui.tdeckTab): Cards, as these shots look at it.
        rule.onAllNodes(hasContentDescription("Cards") and androidx.compose.ui.test.hasClickAction()).fetchSemanticsNodes().firstOrNull()?.let {
            rule.onAllNodes(hasContentDescription("Cards") and androidx.compose.ui.test.hasClickAction()).onFirst().performClick() }
        // The collection browser fills in once the engine has the pool.
        rule.waitUntil(60_000) { rule.onAllNodes(hasContentDescription("Add ", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        settle(40)
        val found = Found()
        audit(found)
        shot("${g.id}-$tag")
        if (shelves) {
            // All cards, shelf by shelf (the engine's shelvesStart): the format's staples first, then the newest sets, each as it shows.
            rule.onAllNodesWithText("All cards").onFirst().performClick()
            rule.waitUntil(90_000) { rule.onAllNodesWithText("For this deck").fetchSemanticsNodes().isNotEmpty() }
            settle(80); shot("${g.id}-$tag-all"); audit(found)
            rule.onNode(hasContentDescription("Cards to add, a shelf at a time")).performScrollToIndex(2); settle(60)
            shot("${g.id}-$tag-all-sets"); audit(found)
            File(shots, "tbench-${g.id}-$tag-all.txt").writeText(buildString {
                appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
                appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
                appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
            })
            return
        }
        val groups = if (g == CardGame.YGO) listOf("MONSTERS", "SPELLS") else listOf("POKÉMON", "TRAINERS", "ENERGY")
        // Each type group is in the deck list (scrolled to: the list composes what is on screen).
        for (w in groups) rule.onNode(hasScrollToIndexAction() and hasContentDescription("Deck list")).performScrollToNode(hasText(w, substring = true))
        rule.onNode(hasScrollToIndexAction() and hasContentDescription("Deck list")).performScrollToIndex(0); settle()
        if (steps && g == CardGame.YGO) {
            // A row's big view moves a copy to the Side Deck (tcg.js tDeckMove, worded as the page words it), and the Side Deck shows.
            rule.onNode(hasScrollToIndexAction() and hasContentDescription("Deck list")).performScrollToNode(hasContentDescription("3 Dark Magician")); settle()
            rule.onAllNodes(hasContentDescription("3 Dark Magician")).onFirst().performClick(); settle()
            shot("${g.id}-$tag-peek"); audit(found)
            rule.onAllNodesWithText("→ side").onFirst().performClick()
            rule.waitUntil(30_000) { rule.onAllNodes(hasContentDescription("2 Dark Magician")).fetchSemanticsNodes().isNotEmpty() }
            settle()
            rule.onNode(hasScrollToIndexAction() and hasContentDescription("Deck list")).performScrollToNode(hasText("SIDE DECK", substring = true)); settle()
            assertTrue("the moved copy is in the Side Deck", rule.onAllNodes(hasContentDescription("1 Dark Magician")).fetchSemanticsNodes().isNotEmpty())
            shot("${g.id}-$tag-side"); audit(found)
            // Maxx "C" is Forbidden in the TCG format (SOURCES.ygo.limit 0): no diamonds, its + is off.
            rule.onNode(hasContentDescription("Cards to add")).performScrollToNode(hasContentDescription("Maxx \"C\"")); settle()
            assertTrue("Maxx \"C\"'s + is off", rule.onAllNodes(hasContentDescription("Add Maxx \"C\" to the deck") and androidx.compose.ui.test.isNotEnabled()).fetchSemanticsNodes().isNotEmpty())
        }
        if (steps && g == CardGame.PTCG) {
            // Charizard ex (regulation G) is not legal in Standard: tcg.js addToDeck would refuse it, so its + is off and it says why.
            rule.onNode(hasContentDescription("Cards to add")).performScrollToNode(hasContentDescription("Add Charizard ex to the deck")); settle()
            assertTrue("Charizard ex's + is off", rule.onAllNodes(hasContentDescription("Add Charizard ex to the deck") and androidx.compose.ui.test.isNotEnabled()).fetchSemanticsNodes().isNotEmpty())
            assertTrue("it says Not legal", shows("Not legal"))
            // Pikachu ex's big view: − is tcg.js tDeckQty on its row; then the browser's + puts the copy back (the same row's tDeckQty).
            rule.onAllNodes(hasContentDescription("4 Pikachu ex")).onFirst().performClick(); settle()
            rule.onAllNodes(hasContentDescription("Remove one")).onFirst().performClick()
            rule.waitUntil(30_000) { rule.onAllNodes(hasContentDescription("3 Pikachu ex")).fetchSemanticsNodes().isNotEmpty() }
            settle(); rule.activity.onBackPressedDispatcher.let { d -> rule.runOnUiThread { d.onBackPressed() } }; settle()
            rule.onNode(hasContentDescription("Cards to add")).performScrollToNode(hasContentDescription("Add Pikachu ex to the deck")); settle()
            rule.onAllNodes(hasContentDescription("Add Pikachu ex to the deck")).onFirst().performClick()
            rule.waitUntil(30_000) { rule.onAllNodes(hasContentDescription("4 Pikachu ex")).fetchSemanticsNodes().isNotEmpty() }
            settle(); shot("${g.id}-$tag-steps")
            // The hero's review count opens the page's Rules review over the Bench (tcg.js A.tIssues).
            rule.onAllNodesWithText("to fix", substring = true).onFirst().performClick(); settle()
            assertTrue("the Rules review opens", shows("Rules review"))
            shot("${g.id}-$tag-review")
            rule.onAllNodesWithText("Rules review", substring = true).onFirst().performClick(); settle()
            // The page's price tools sit in the action row.
            assertTrue("the price tools show", shows("Cheapest printings"))
        }
        File(shots, "tbench-${g.id}-$tag.txt").writeText(buildString {
            appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
            appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
            appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
        })
    }

    @Test fun yugiohPhone() = run(CardGame.YGO, "390x844", 48, 34, 1f, steps = true)
    @Test fun yugiohShelves() = run(CardGame.YGO, "390x844", 48, 34, 1f, steps = false, shelves = true)
    @Test fun pokemonShelves() = run(CardGame.PTCG, "390x844", 48, 34, 1f, steps = false, shelves = true)
    @org.robolectric.annotation.Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun pokemonShelvesUnfolded() = run(CardGame.PTCG, "954x860", 48, 34, 1f, steps = false, shelves = true)
    @Test fun pokemonPhone() = run(CardGame.PTCG, "390x844", 48, 34, 1f, steps = true)
    @Test fun yugiohBigText() = run(CardGame.YGO, "390x844-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun pokemonSmall() = run(CardGame.PTCG, "360x780", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun yugiohUnfolded() = run(CardGame.YGO, "954x860", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun pokemonUnfoldedBigText() = run(CardGame.PTCG, "954x860-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun pokemonLandscape() = run(CardGame.PTCG, "844x390", 0, 0, 1f, steps = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun yugiohTablet() = run(CardGame.YGO, "1024x768", 48, 34, 1f, steps = false)
}
