package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
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
 * (rule-dex.js showRuleHint), the searchable rulebook (rule-corpus.js, the copy kept on this device) and Ask, which opens the website;
 * Power (tcg.js tcgPowerPage: the merged view Matchups and Upgrade lab open, with its Full breakdown); and the War Chest
 * (war-chest.js warChestMarkup with tcg.js deckPlaytest): its tools, the dice, a sample hand.
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
    private fun shows(t: String, substring: Boolean = true, ignoreCase: Boolean = false) =
        rule.onAllNodesWithText(t, substring = substring, ignoreCase = ignoreCase).fetchSemanticsNodes().isNotEmpty()

    private fun open(g: CardGame, id: String, title: String, tab: String = "Rules", ready: String = "Try a turn →") {
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
        rule.onAllNodes(hasText(tab, substring = false) and hasClickAction()).onFirst().performClick()
        rule.waitUntil(60_000) { shows(ready, substring = false) }
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

    /**
     * Power (tcg.js tcgPowerPage, which Matchups and Upgrade lab now open): power.js's one-page view drawn here; Card odds, roles
     * and Extra Deck opens the old Power panels (deckInsights) in place; Simulate matchups is the site's A.tMuRun, run here (it
     * shows its progress or its answer in the card, never the website).
     */
    @Test fun pokemonPower() {
        open(CardGame.PTCG, pikachu, "Pikachu ex", tab = "Power", ready = "Simulate matchups")
        shot("ptcg-power")
        assertTrue(shows("Tier not rated yet")); assertTrue(shows("Draw or search on turn 1"))
        // Upgrades asks to load tournament decks until they are here (then Against the meta shows what they say).
        assertTrue(shows("Load tournament decks") || shows("Against the meta", ignoreCase = true))
        assertTrue(webs.isEmpty())
        tap("Card odds, roles and Extra Deck")
        rule.waitUntil(20_000) { shows("Card by card") }
        rule.onAllNodes(hasText("Opening hand", substring = false)).onFirst().performScrollTo(); settle()
        shot("ptcg-power-full")
        rule.onNode(hasText("Simulate matchups", substring = false) and hasClickAction()).performScrollTo().performClick()
        rule.waitUntil(120_000) { listOf("Loading tournament results", "Loading ", "No tournament decks to compare", "Couldn", "still loading", "Simulated against").any { shows(it) } }
        assertTrue(webs.isEmpty())
    }

    /** Yu-Gi-Oh! Power: Opening hands in place of Ramp; Matchups and Upgrades as on the site. Matchups and Upgrade lab open it too. */
    @Test fun yugiohPower() {
        open(CardGame.YGO, magician, "Dark Magician", tab = "Power", ready = "Simulate matchups")
        assertTrue(shows("Opening hands", substring = false, ignoreCase = true)); assertTrue(shows("Bricked hand"))
        assertTrue(webs.isEmpty())
        shot("ygo-power")
    }

    /** The War Chest (A.tDeckTab "playtest"): the chest's tools and the sample hand; Dice & coin rolls in place (war-chest.js rollDice). */
    @Test fun pokemonChest() {
        open(CardGame.PTCG, pikachu, "Pikachu ex", tab = "War Chest", ready = "Draw opening 7")
        assertTrue(shows("THE WAR CHEST") || shows("The War Chest")); assertTrue(shows("Shuffles, draws 7"))
        tap("Dice & coin")
        rule.waitUntil(20_000) { shows("d6 rolled") }
        assertTrue(webs.isEmpty())
        shot("ptcg-chest")
    }

    /** Draw opening 7 (tcg.js A.tDraw): 7 in hand, 6 Prizes set aside; Draw a card adds one; a card opens its page. */
    @Test fun pokemonChestDraw() {
        open(CardGame.PTCG, pikachu, "Pikachu ex", tab = "War Chest", ready = "Draw opening 7")
        tap("Draw opening 7")
        rule.waitUntil(20_000) { shows("7 in hand") }
        assertTrue(shows("6 Prize cards set aside")); assertTrue(shows("Peek at Prizes"))
        rule.onNode(hasText("Sample hand", substring = false)).performScrollTo(); settle()
        shot("ptcg-chest-hand")
        tap("Draw a card")
        rule.waitUntil(20_000) { shows("8 in hand") }
    }

    /** Goldfish opens Power (A.tDeckTab "insights"), here; Game Night is the website's (app.js chestTool). */
    @Test fun pokemonChestTools() {
        open(CardGame.PTCG, pikachu, "Pikachu ex", tab = "War Chest", ready = "Draw opening 7")
        // The chest's own Game Night (the deck header has one too).
        rule.onAllNodes(hasText("Game Night", substring = false) and hasClickAction()).onLast().performScrollTo().performClick(); settle()
        rule.waitUntil(20_000) { webs.isNotEmpty() }
        assertTrue(webs.last().first, webs.last().first.endsWith("#tdeck/$pikachu/playtest"))
        assertTrue(webs.last().second.orEmpty(), webs.last().second.orEmpty().contains("[data-act=\"chestTool\"][data-tool=\"gameNight\"]"))
        tap("Goldfish")
        rule.waitUntil(30_000) { shows("Simulate matchups", substring = false) }
        assertTrue(webs.size == 1)
    }

    /** Yu-Gi-Oh!: Going first (5) / Going second (6). */
    @Test fun yugiohChest() {
        open(CardGame.YGO, magician, "Dark Magician", tab = "War Chest", ready = "Going first (5)")
        tap("Going second (6)")
        rule.waitUntil(20_000) { shows("6 in hand") }
        shot("ygo-chest")
    }
}
