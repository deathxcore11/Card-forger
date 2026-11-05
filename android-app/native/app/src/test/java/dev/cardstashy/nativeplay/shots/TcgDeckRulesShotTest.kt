package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performFirstLinkClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
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
 * A Yu-Gi-Oh! and a Pokémon deck's Rules tab (tcg.js tcgDeck with A.tDeckTab "rules": rule-learning.js interactiveRules with
 * attachRuleLearning), over the collection TcgDeckShotTest uses: the tab as it opens, Try a turn and its steps, a rule word's glass
 * (rule-dex.js showRuleHint), the searchable rulebook (rule-corpus.js, the copy kept on this device) and Ask, which opens the website.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h1600dp-xxhdpi")
class TcgDeckRulesShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val pikachu = "1c5ee49c-a4ba-4506-ae2b-1e0761e20324"
    private val magician = "094ab313-b1e1-4778-aefc-52ceb9c90ae5"
    private val webs = ArrayList<Pair<String, String?>>()

    private fun settle() = repeat(20) { Thread.sleep(150); rule.mainClock.advanceTimeBy(150); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tdeck-rules-$name.png").path)
    private fun shows(t: String, substring: Boolean = true) = rule.onAllNodesWithText(t, substring = substring).fetchSemanticsNodes().isNotEmpty()

    private fun open(g: CardGame, id: String, title: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        // The rulebooks as the device keeps them after a first read (rule-corpus.js loadRulePack, answered from here offline).
        File(app.filesDir, "rulebooks").apply { mkdirs() }.let { dir ->
            File(System.getProperty("repoRoot"), "rulebooks").listFiles()?.forEach { it.copyTo(File(dir, it.name), overwrite = true) } }
        CollectionGame.init(app); CollectionGame.set(g)
        webs.clear()
        rule.setContent { CollectionDeckRoute(id, onPlay = {}, onProfile = {}, onBack = {}, onHome = {}, onCards = {}, onPractice = { _, _ -> },
            web = { u, p -> webs += u to p }, game = g) }
        rule.waitUntil(60_000) { shows(title, substring = false) }
        settle()
        rule.onNode(hasText("Rules", substring = false) and hasClickAction()).performClick()
        rule.waitUntil(60_000) { shows("Try a turn →", substring = false) }
        settle()
    }
    private fun tap(t: String, substring: Boolean = false) { rule.onNode(hasText(t, substring = substring) and hasClickAction()).performScrollTo().performClick(); settle() }

    @Test fun yugioh() {
        open(CardGame.YGO, magician, "Dark Magician")
        assertTrue(shows("LEARN YU-GI-OH!")); assertTrue(webs.isEmpty())
        shot("ygo")
    }

    @Test fun pokemonTurn() {
        open(CardGame.PTCG, pikachu, "Pikachu ex")
        shot("ptcg")
        // [data-learn-start]: Try a turn opens and comes into view; Next step draws step 2 (attachRuleLearning's own turnBody).
        tap("Try a turn →")
        tap("Next step")
        assertTrue(shows("Develop your board"))
        shot("ptcg-turn")
    }

    /** A rule word (Explore a situation › Setup and mulligans: "Bench") opens rule-dex.js's glass with its source; its ✕ closes it. */
    @Test fun pokemonRuleWord() {
        open(CardGame.PTCG, pikachu, "Pikachu ex")
        tap("Explore a situation", substring = true)
        tap("Setup and mulligans", substring = true)
        rule.onNode(hasText("optionally up to five Basics on the", substring = true)).performScrollTo().performFirstLinkClick(); settle()
        rule.waitUntil(20_000) { shows("RULE DEX · POKÉMON") }
        shot("ptcg-glass")
        // Its ✕ (rule-dex.js dismissRuleHint) closes it.
        rule.onNode(androidx.compose.ui.test.hasContentDescription("Close definition") and hasClickAction()).performClick(); settle()
        assertTrue(!shows("RULE DEX · POKÉMON"))
    }

    /** Open searchable rulebook: the kept rulebook loads, checks out (its SHA-256) and searches as typed. */
    @Test fun pokemonRulebook() {
        open(CardGame.PTCG, pikachu, "Pikachu ex")
        tap("Open searchable rulebook")
        rule.waitUntil(60_000) { shows("Search the official books") }
        rule.onNode(hasSetTextAction()).performScrollTo().performTextInput("retreat"); settle()
        shot("ptcg-rulebook")
        assertTrue(shows("PDF page 12"))
    }

    /** Ask about the rules is the site's AI (app.js askRules): it opens the website's Rules tab and presses the same button there. */
    @Test fun pokemonAsk() {
        open(CardGame.PTCG, pikachu, "Pikachu ex")
        tap("Ask about Pokémon rules →")
        rule.waitUntil(20_000) { webs.isNotEmpty() }
        val (url, press) = webs.last()
        assertTrue(url, url.endsWith("#tdeck/$pikachu/rules"))
        assertTrue(press.orEmpty(), press.orEmpty().contains("[data-act=\"askRules\"]"))
    }

    /** Matchups (tcg.js deckMatchupsT): the site's own panel, which says Pokémon and Yu-Gi-Oh! matchups are coming soon. */
    @Test fun pokemonMatchups() {
        open(CardGame.PTCG, pikachu, "Pikachu ex")
        tap("Matchups")
        rule.waitUntil(20_000) { shows("Pokémon matchups are coming soon") }
        assertTrue(shows("AI MATCHUPS")); assertTrue(webs.isEmpty())
        shot("ptcg-matchups")
    }
}
