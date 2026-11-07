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
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
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
 * Collection › Binders through the real route, engine and sheets, all three games: the shelf (binders.js binderShelf), a binder opened
 * (binderPage), a ★ on the cover (A.featureBinderCard), a page turned (Magic, two pages), Binder options saved (A.saveBinder, the binder
 * opening again), a pocket's card and back (Pokémon), holding a binder (tileMenu) to edit and delete it, and a new binder. At the spec's
 * sizes with the APK's bars, 100% and 130% text, each writing what it found (cut names, small text, small targets). Nothing hands off
 * to the website.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionBindersShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val shots = File(System.getProperty("shotsDir")!!)
    private val cache = shots.parentFile.resolve("app/build/shot-art/bench").apply { mkdirs() }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(shots, "binders-$name.png").path)
    private fun key(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun get(url: String): ByteArray? = cache.resolve(key(url)).let { f ->
        if (f.exists()) f.readBytes() else runCatching { Thread.sleep(80)
            java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0"); setRequestProperty("Accept", "*/*") }.getInputStream().use { it.readBytes() } }
            .getOrNull()?.also { f.writeBytes(it) } }
    private fun shows(t: String) = rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty()
    private fun wait(t: String) = rule.waitUntil(60_000) { shows(t) }

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

    /** The account's copy: the TCG fixture (TcgCollectionShotTest's) or, for Magic, the engine test's thirteen lots; two binders each. */
    private fun workspace(g: CardGame): JsonObject {
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        val ws = fx["workspace"].asJsonObject
        val binders = JsonParser.parseString(when (g) {
            CardGame.PTCG -> """[{"id":"p1","game":"ptcg","title":"Pokémon box","rule":"all","value":"","color":"#176b69","background":"","featured":"","favorites":[]},
                {"id":"p2","game":"ptcg","title":"Rare pulls","rule":"rare","value":"","color":"#942f4c","background":"","featured":"","favorites":[]}]"""
            CardGame.YGO -> """[{"id":"y1","game":"ygo","title":"Duel binder","rule":"all","value":"","color":"#634198","background":"","featured":"","favorites":[]},
                {"id":"y2","game":"ygo","title":"Legend of Blue Eyes","rule":"set","value":"LOB","color":"#285ba4","background":"","featured":"","favorites":[]}]"""
            CardGame.MTG -> """[{"id":"m1","game":"mtg","title":"Everything","rule":"all","value":"","color":"#942f4c","background":"","featured":"l6","favorites":["l6","l10","l12"]},
                {"id":"m2","game":"mtg","title":"Rare finds","rule":"rare","value":"","color":"#285ba4","background":"","featured":"","favorites":[]}]"""
        }).asJsonArray
        ws["settings"].asJsonObject.add("binders", binders)
        if (g == CardGame.MTG) {
            val prints = JsonParser.parseString(javaClass.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
            val lots = JsonArray(); val printings = JsonObject()
            prints.forEachIndexed { i, c ->
                printings.add(c["id"].asString, c)
                lots.add(JsonObject().apply {
                    addProperty("id", "l${i + 1}"); addProperty("name", c["name"].asString); addProperty("qty", if (c["name"].asString == "Lightning Bolt") 4 else 1); addProperty("printingId", c["id"].asString)
                    addProperty("set", c["set"].asString); addProperty("setName", c["set_name"].asString); addProperty("collectorNumber", c["collector_number"].asString)
                    addProperty("finish", if (c["name"].asString.startsWith("Ragavan")) "foil" else "nonfoil"); addProperty("condition", "Near Mint"); addProperty("language", "en")
                    addProperty("location", ""); addProperty("printingVerified", true); addProperty("addedAt", "2026-11-01T12:00:00Z"); add("raw", JsonObject())
                })
            }
            ws.add("collection", lots); ws.add("printings", printings)
            ws["settings"].asJsonObject.addProperty("game", "mtg")
        }
        return fx
    }

    private fun run(g: CardGame, tag: String, status: Int, nav: Int, scale: Float, steps: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> get(url)?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } ?: url }
        val fx = workspace(g)
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.models.clear()
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        CollectionGame.init(app); CollectionGame.set(g)
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
        // The tabs come with the page (All sets sits below a phone's fold, so it isn't waited for).
        rule.waitUntil(60_000) { shows("Binders") && shows("Value") }
        rule.onAllNodesWithText("Binders").onFirst().performClick()
        wait("Your binders"); settle(30)
        val found = Found()
        audit(found); shot("${g.id}-$tag-shelf")
        val first = when (g) { CardGame.PTCG -> "p1"; CardGame.YGO -> "y1"; CardGame.MTG -> "m1" }
        // Landscape: the hero fills the height, so the shelf is scrolled to first.
        rule.onNode(hasScrollAction()).performScrollToNode(hasTestTag("binder:$first")); settle(5)
        rule.onNode(hasTestTag("binder:$first")).performClick()
        wait("CARDSTASHY BINDER"); settle(30)
        audit(found); shot("${g.id}-$tag-open")
        if (steps) {
            // A ★: the card goes on the clear cover, said as the site says it.
            rule.onAllNodes(hasContentDescription("Show ", substring = true) and hasContentDescription("on the binder cover", substring = true)).onFirst().performClick()
            wait("On the cover · "); settle()
            if (g == CardGame.MTG) {
                // Two pages: Next › turns to the second (its empty pockets), ‹ Back to the first.
                assertTrue("13 cards over two pages", shows("page 1 of 2"))
                rule.onAllNodes(hasContentDescription("Next binder page")).onFirst().performClick()
                wait("page 2 of 2"); settle(10); shot("${g.id}-$tag-page2"); audit(found)
                rule.onAllNodes(hasContentDescription("Previous binder page")).onFirst().performClick()
                wait("page 1 of 2"); settle(10)
            }
            if (g == CardGame.PTCG) {
                // A pocket opens its card's page; back from it, the binder is open again.
                rule.onAllNodes(hasContentDescription("Pikachu ex, 4 copies")).onFirst().performClick()
                rule.waitUntil(60_000) { !shows("CARDSTASHY BINDER") }
                settle(30); shot("${g.id}-$tag-card")
                rule.activity.onBackPressedDispatcher.let { d -> rule.runOnUiThread { d.onBackPressed() } }
                wait("CARDSTASHY BINDER"); settle()
            }
            // Binder options: the editor (Binder settings); saved, the binder opens again.
            rule.onAllNodesWithText("Binder options").onFirst().performClick()
            wait("Binder settings"); settle()
            rule.onAllNodesWithText("Cover appearance").onFirst().performClick(); settle()
            audit(found); shot("${g.id}-$tag-edit")
            rule.onNode(hasSetTextAction() and hasContentDescription("Binder name")).performTextReplacement("My binder")
            rule.onNode(hasScrollAction()).let { runCatching { it.performScrollToNode(hasText("Save binder")) } }
            rule.onAllNodesWithText("Save binder").onFirst().performClick()
            wait("Binder saved."); wait("CARDSTASHY BINDER"); settle()
            assertTrue("the renamed binder is open", shows("My binder"))
            // ✕ closes it; holding a binder offers Open binder and Edit cover and cards.
            rule.onAllNodes(hasContentDescription("Close")).onLast().performClick(); settle()
            rule.onNode(hasTestTag("binder:$first")).performTouchInput { longClick() }
            wait("Edit cover and cards"); settle(); shot("${g.id}-$tag-hold")
            rule.onAllNodesWithText("Edit cover and cards").onFirst().performClick()
            wait("Binder settings"); settle()
            runCatching { rule.onAllNodes(hasScrollAction()).onLast().performScrollToNode(hasText("Delete binder")) }
            rule.onAllNodesWithText("Delete binder").onFirst().performClick()
            wait("Deleted binder"); settle(10)
            assertTrue("the binder is gone from the shelf", rule.onAllNodes(hasTestTag("binder:$first")).fetchSemanticsNodes().isEmpty())
            // ＋ New binder: named, saved, on the shelf.
            rule.onAllNodesWithText("New binder").onFirst().performClick()
            wait("Binder name"); settle()
            rule.onNode(hasSetTextAction() and hasContentDescription("Binder name")).performTextReplacement("Trade stack")
            rule.onAllNodesWithText("Save binder").onFirst().performClick()
            wait("Binder saved."); settle(20)
            assertTrue("the new binder is on the shelf", shows("Trade stack"))
            shot("${g.id}-$tag-after")
        }
        assertTrue("Binders didn't hand off to the website: $opened", opened.isEmpty())
        File(shots, "binders-${g.id}-$tag.txt").writeText(buildString {
            appendLine("Cut with …: " + found.ellipsized.joinToString(" | ").ifEmpty { "none" })
            appendLine("Under 11 sp: " + found.small.joinToString(" | ").ifEmpty { "none" })
            appendLine("Targets under 44 dp: " + found.tight.joinToString(" | ").ifEmpty { "none" })
        })
    }

    @Test fun magicPhone() = run(CardGame.MTG, "390x844", 48, 34, 1f, steps = true)
    @Test fun pokemonPhone() = run(CardGame.PTCG, "390x844", 48, 34, 1f, steps = true)
    @Test fun yugiohPhone() = run(CardGame.YGO, "390x844", 48, 34, 1f, steps = true)
    @Test fun magicBigText() = run(CardGame.MTG, "390x844-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    @Test fun pokemonSmall() = run(CardGame.PTCG, "360x780", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun magicUnfolded() = run(CardGame.MTG, "954x860", 48, 34, 1f, steps = false)
    @Config(qualifiers = "w954dp-h860dp-xxhdpi")
    @Test fun yugiohUnfoldedBigText() = run(CardGame.YGO, "954x860-130", 48, 34, 1.3f, steps = false)
    @Config(qualifiers = "w844dp-h390dp-xxhdpi")
    @Test fun magicLandscape() = run(CardGame.MTG, "844x390", 0, 0, 1f, steps = false)
    @Config(qualifiers = "w1024dp-h768dp-xhdpi")
    @Test fun pokemonTablet() = run(CardGame.PTCG, "1024x768", 48, 34, 1f, steps = false)
}
