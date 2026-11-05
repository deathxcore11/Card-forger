package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
 * A Magic deck's Power tab, merged (views.js deckEngine with powerHub: Matchups and Upgrade lab fold into it), over a small
 * workspace (Izzet Tempo, an unfinished Modern list; Sheoldred Black, a full 60 for Standard): the hero, Ramp, How it works and wins,
 * Matchups, Upgrades, the Full breakdown, and the old tabs' buttons opening Power. Rules is the site's interactiveRules("mtg").
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h1600dp-xxhdpi")
class MtgDeckPowerShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private val webs = ArrayList<Pair<String, String?>>()

    private fun settle() = repeat(20) { Thread.sleep(150); rule.mainClock.advanceTimeBy(150); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "deck-power-$name.png").path)
    private fun shows(t: String, substring: Boolean = true) = rule.onAllNodesWithText(t, substring = substring).fetchSemanticsNodes().isNotEmpty()
    private fun tap(t: String, substring: Boolean = false) { rule.onAllNodes(hasText(t, substring = substring) and hasClickAction()).onFirst().performScrollTo().performClick(); settle() }

    private fun open(id: String, title: String, tab: String = "Power", ready: String = "HOW IT WORKS AND WINS") {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/mtg-deck/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText(fx["catalog"].toString())
        CollectionGame.init(app); CollectionGame.set(CardGame.MTG)
        webs.clear()
        rule.setContent { CollectionDeckRoute(id, onPlay = {}, onProfile = {}, onBack = {}, onHome = {}, onCards = {}, onPractice = { _, _ -> },
            web = { u, p -> webs += u to p }, game = CardGame.MTG) }
        rule.waitUntil(60_000) { shows(title, substring = false) }
        settle()
        tap(tab)
        rule.waitUntil(60_000) { shows(ready, substring = false) }
        settle()
    }

    /** A full 60: the tier line, the chips, Ramp's turns and tiles, how it wins, Simulate matchups, Find paired upgrades. */
    @Test fun complete() {
        open("d5", "Sheoldred Black")
        assertTrue(shows("RAMP")); assertTrue(shows("Simulate matchups")); assertTrue(shows("Find paired upgrades")); assertTrue(shows("FULL BREAKDOWN"))
        assertTrue(webs.isEmpty())
        shot("complete")
    }

    /** An unfinished list: no ring or tier yet, Matchups says to finish first, Upgrades offers to fill the open slots. */
    @Test fun unfinished() {
        open("d2", "Izzet Tempo")
        assertTrue(shows("Tier not rated yet")); assertTrue(shows("Finish the deck first"))
        shot("unfinished")
        // Full breakdown: the old Power page, folded.
        tap("FULL BREAKDOWN")
        rule.waitUntil(20_000) { shows("Coach this deck") }
        // Its panels as the site lays them: the coach, the Power panel, the checks, the shuffles, the score, the curve, card by card.
        for ((at, name) in listOf("Coach this deck" to "breakdown", "What holds this deck back" to "breakdown-2", "3,000 shuffles of this list" to "breakdown-3",
                "Score breakdown" to "breakdown-4", "Card by card" to "breakdown-5")) {
            rule.onAllNodes(hasText(at, substring = true)).onFirst().performScrollTo(); settle()
            shot(name)
        }
        assertTrue(shows("SCOUTING REPORT")); assertTrue(shows("Most valuable cards")); assertTrue(shows("1 to fix"))
        // A score row opens to its reason (details.ingredient), and Rules checks to its list.
        tap("Threat density", substring = true)
        assertTrue(shows("Enough threats that removal", substring = true))
        tap("Rules checks", substring = true)
        assertTrue(shows("Modern allows 4", substring = true))
        rule.onAllNodes(hasText("Modern allows 4", substring = true)).onFirst().performScrollTo(); settle()
        shot("breakdown-6")
    }

    /** Ask AI about a specific opponent is the site's sheet (app.js amOpen): the website's Power tab, the same button pressed. */
    @Test fun askAi() {
        open("d2", "Izzet Tempo")
        tap("Ask AI about a specific opponent")
        rule.waitUntil(20_000) { webs.isNotEmpty() }
        assertTrue(webs.last().first, webs.last().first.endsWith("#deck/d2/engine"))
        assertTrue(webs.last().second.orEmpty(), webs.last().second.orEmpty().contains("[data-act=\"amOpen\"][data-tab=\"setup\"]"))
    }

    /** Magic's Rules tab: rule-learning.js for Magic, drawn here. */
    @Test fun rules() {
        open("d2", "Izzet Tempo", tab = "Rules", ready = "Try a turn →")
        assertTrue(shows("LEARN MAGIC") || shows("Learn Magic", substring = true))
        shot("rules")
    }
}
