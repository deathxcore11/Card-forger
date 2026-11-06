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
 * A Magic deck's Power tab: power.js powerPageHtml (views.js powerHub, 4.3.131) over a small workspace (Goblin Horde, a Commander
 * list; Izzet Tempo, an unfinished Modern list; Sheoldred Black, a full 60 for Standard): the hero band, Tempo, How it wins, Curve
 * and colors, Matchups and Upgrades as cards, one column on a phone and paired from 820 wide, then the folded panels (Why Bracket N,
 * Mana base and payment, AI coach, rules checks). Rules is the site's interactiveRules("mtg").
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
    private fun scrollTo(t: String) { rule.onAllNodes(hasText(t, substring = true)).onFirst().performScrollTo(); settle() }

    private fun open(id: String, title: String, tab: String = "Power", ready: String = "DECK POWER", edit: (com.google.gson.JsonObject) -> Unit = {}) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/mtg-deck/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        edit(fx["workspace"].asJsonObject)
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText(fx["catalog"].toString())
        CollectionGame.init(app); CollectionGame.set(CardGame.MTG)
        webs.clear()
        rule.setContent { CollectionDeckRoute(id, onPlay = {}, onProfile = {}, onBack = {}, onHome = {}, onCards = {}, onPractice = { _, _ -> },
            web = { u, p -> webs += u to p }, game = CardGame.MTG, bench = false) }
        rule.waitUntil(60_000) { shows(title, substring = false) }
        settle()
        tap(tab)
        rule.waitUntil(60_000) { shows(ready, substring = false) }
        settle()
    }

    /** A full 60: the hero, Tempo's turns and tiles, How it wins, Curve and colors, Simulate matchups, Find paired upgrades, the folded panels. */
    @Test fun complete() {
        open("d5", "Sheoldred Black")
        for (t in listOf("TEMPO", "HOW IT WINS", "CURVE AND COLORS", "MATCHUPS", "UPGRADES", "Simulate matchups", "Find paired upgrades", "Mana base and payment", "AI coach"))
            assertTrue(t, shows(t))
        assertTrue(webs.isEmpty())
        shot("complete")
        scrollTo("CURVE AND COLORS"); shot("complete-2")
        scrollTo("AI coach"); shot("complete-3")
    }

    /** The same deck from 820 wide (an unfolded phone, a tablet): the cards two to a row at the taller one's height. */
    @Test @Config(qualifiers = "w884dp-h1400dp-xhdpi") fun wide() {
        open("d5", "Sheoldred Black")
        shot("wide")
        scrollTo("Estimates from this list"); shot("wide-2")
    }

    /** An unfinished list: no ring, Tier not rated yet, Matchups says to finish first; Mana base and payment and the rules checks open in place. */
    @Test fun unfinished() {
        open("d2", "Izzet Tempo")
        assertTrue(shows("Tier not rated yet")); assertTrue(shows("Finish the deck first"))
        shot("unfinished")
        tap("Mana base and payment")
        scrollTo("Mana base and payment"); shot("mana")
        tap("rules checks to fix", substring = true)
        assertTrue(shows("Modern allows 4", substring = true))
        scrollTo("Modern allows 4"); shot("checks")
    }

    /** A Commander list (saved as the site saves it, "Commander"): Bracket in the hero, Why Bracket N folded under the cards. */
    @Test fun commander() {
        open("d1", "Goblin Horde") { ws -> ws.getAsJsonArray("decks").map { it.asJsonObject }.first { it["id"].asString == "d1" }.addProperty("format", "Commander") }
        assertTrue(shows("Why Bracket", substring = true))
        shot("commander")
        tap("Why Bracket", substring = true)
        scrollTo("Why Bracket"); shot("commander-bracket")
    }

    /** Ask AI about an opponent is the site's sheet (app.js amOpen): the website's Power tab, the same button pressed. */
    @Test fun askAi() {
        open("d2", "Izzet Tempo")
        tap("Ask AI about an opponent")
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
