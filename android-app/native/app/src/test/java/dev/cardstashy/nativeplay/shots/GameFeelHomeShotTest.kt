package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionHome
import dev.cardstashy.nativeplay.ui.CollectionHomeActions
import dev.cardstashy.nativeplay.ui.CollectionHomeModel
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.DailyCard
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.HomeLink
import dev.cardstashy.nativeplay.ui.HomeMeta
import dev.cardstashy.nativeplay.ui.HomeNews
import dev.cardstashy.nativeplay.ui.HomeShelf
import dev.cardstashy.nativeplay.ui.HomeValue
import dev.cardstashy.nativeplay.ui.MetaSlide
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.SearchSuggest
import dev.cardstashy.nativeplay.ui.SearchSuggestItem
import dev.cardstashy.nativeplay.ui.ShelfDeck
import dev.cardstashy.nativeplay.ui.ShelfLead
import dev.cardstashy.nativeplay.ui.TodayPackArt
import dev.cardstashy.nativeplay.ui.TopBarItems
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
 * Game-feel home (specs/game-feel-home-brief.md), the whole page at the four screen shapes with what Randall's phone showed on
 * 12 Nov: one screen with the Card of the Day's art as its top, the pack and name, the value plate, three doors and three deck
 * boxes; the three games as equal tabs; the search box typed in where it sits; Meta decks behind its door.
 * The pictures are plain colour fields unless HOME_SHOT_ART names a folder of real ones (never kept in the repository).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class GameFeelHomeShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }

    private val real = System.getenv("HOME_SHOT_ART")?.takeIf { it.isNotBlank() }?.let(::File)
    private fun art(url: String): Any? {
        val key = url.substringAfterLast('/')
        real?.let { dir -> listOf("png", "jpg").map { dir.resolve("$key.$it") }.firstOrNull { it.exists() }?.let { f -> BitmapFactory.decodeFile(f.path)?.asImageBitmap()?.let { return it } } }
        // A field of the key's own colour, lighter towards the top, so a crop or a mask shows in the picture.
        val w = 240; val h = if (key.startsWith("pack")) 440 else 180
        val hue = (key.hashCode() and 0x7fffffff) % 360
        val px = IntArray(w * h) { i -> android.graphics.Color.HSVToColor(floatArrayOf(hue.toFloat(), .55f, .95f - .45f * (i / w) / h)) }
        return android.graphics.Bitmap.createBitmap(px, w, h, android.graphics.Bitmap.Config.ARGB_8888).asImageBitmap()
    }

    private fun model(g: CardGame): CollectionHomeModel {
        val id = g.id
        val (daily, value, decks) = when (g) {
            CardGame.PTCG -> Triple(DailyCard("sv06-214", "Greninja ex", "2026-11-12", "https://art.invalid/daily-$id", "Card of the Day", "Twilight Masquerade", "sv06", "special illustration rare", "pokemon",
                pack = TodayPackArt("Open today's Twilight Masquerade pack", listOf("https://art.invalid/pack-$id" to false))),
                HomeValue("$978.14", "Known subtotal · 1 unpriced", "55", "5", "", "", ""),
                listOf("Crustle · original" to "Standard · 60 cards", "Pikipek · Standard · best version" to "Standard · 60 cards", "Lampent · Standard · upgraded" to "Standard · 60 cards"))
            CardGame.YGO -> Triple(DailyCard("83968380", "Mystic Mine", "2026-11-12", "https://art.invalid/daily-$id", "Card of the Day", "Dark Neostorm", "", "super rare", setName = "Dark Neostorm",
                pack = TodayPackArt("Open today's Dark Neostorm pack", listOf("https://art.invalid/pack-$id" to false))),
                HomeValue("—", "Value unavailable · 8 unpriced", "8", "11", "", "", ""),
                listOf("Virtual World Hime - Nyannyan" to "Advanced (TCG) · 40 main-deck cards", "Azamina Mitsurugi Dark Magician" to "Advanced (TCG) · 60 main-deck cards", "Cipher Etranger" to "Advanced (TCG) · 40 main-deck cards"))
            else -> Triple(DailyCard("tp", "Teetering Peaks", "2026-11-12", "https://art.invalid/daily-$id", "Card of the Day", "Friday Night Magic 2011", "f11", "rare"),
                HomeValue("$12.46", "", "28", "26", "$0.00 · unchanged since Nov 11, 2026", "flat", ""),
                listOf("Aerid Konstrari deck" to "Commander · 100 cards", "Chishiro · Tokens" to "Commander · 100 cards", "The Arkenstone // Seek the Heart" to "Standard · 60 cards"))
        }
        val crop = if (g == CardGame.PTCG) "pokemon" else ""
        val shelf = HomeShelf("Your decks", HomeLink("All decks", "", "#decks", "go"),
            ShelfLead("d1", false, "Last worked on", decks[0].first, decks[0].second, null, "#deck/d1", "https://art.invalid/d1-$id", crop = crop),
            listOf(ShelfDeck("d2", decks[1].first, decks[1].second, "https://art.invalid/d2-$id", "#deck/d2", crop = crop), ShelfDeck("d3", decks[2].first, decks[2].second, "https://art.invalid/d3-$id", "#deck/d3", crop = crop)))
        val meta = HomeMeta("Community Meta decks", HomeLink("All Meta decks", "", "#decks/inspiration", "go"),
            listOf(MetaSlide("k", "", "Top meta · TCG", "Ars Magna Elfnote", "Top 8 · Mechelen WCQ Regional", "", "", "", "", null, null, "tcg")), false, 8000)
        return CollectionHomeModel(g, "", "", "Find a card or ask a question…", daily, value, "", shelf, meta, HomeNews("News", "", "", emptyList(), 3, emptyList(), true))
    }

    private var game = CardGame.PTCG
    private var asked = ""
    private fun show(act: CollectionHomeActions = CollectionHomeActions()) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        rule.setContent {
            val g = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(game) }
            val a = CollectionHomeActions(game = { g.value = it; game = it }, go = act.go, find = { asked = it }, pick = { asked = it },
                suggest = { q -> if (q.isEmpty()) SearchSuggest("", true, listOf(SearchSuggestItem("Black Chaos", "", "", "")))
                    else SearchSuggest(q, false, listOf(SearchSuggestItem("Black Chaos", "https://art.invalid/d1-ygo", "Crossover Breakers · #CORI-EN001 · Secret Rare", "$4.12"),
                        SearchSuggestItem("Magician of Black Chaos", "https://art.invalid/d2-ygo", "Legendary Collection 3 · Common", "$0.35"))) })
            CollectionHome(model(g.value), null, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = false, onSwitch = {}, onProfile = {}, middle = tabs) }, act = a,
                nav = { v -> CollectionNav(CollectionTab.HOME, vertical = v) {} })
        }
        rule.waitForIdle()
    }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "game-feel-home-$name.png").path)
    private fun bounds(label: String) = rule.onNodeWithContentDescription(label, useUnmergedTree = true).fetchSemanticsNode().boundsInRoot

    /** Phone, upright: everything is on the one screen, and the three games are equal thirds that do not move when the game changes. */
    @Config(qualifiers = "w390dp-h844dp-xhdpi")
    @Test fun phoneIsOneScreenAndTheTabsStandStill() {
        show(); shot("phone-pokemon")
        val root = rule.onRoot().fetchSemanticsNode().boundsInRoot
        for (deck in listOf("Open Crustle · original", "Open Pikipek · Standard · best version", "Open Lampent · Standard · upgraded"))
            assertTrue("$deck is on the first screen", bounds(deck).bottom <= root.bottom)
        val before = CardGame.entries.map { bounds(it.label) }
        assertEquals("three equal tabs", 1, before.map { Math.round(it.width) }.toSet().size)
        rule.onNodeWithContentDescription("Yu-Gi-Oh!", useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertEquals(CardGame.YGO, game)
        assertEquals("the tabs do not move or resize", before, CardGame.entries.map { bounds(it.label) })
        shot("phone-yugioh")
        rule.onNodeWithContentDescription("Magic", useUnmergedTree = true).performClick(); rule.waitForIdle()
        shot("phone-magic")
    }

    /** The search box is typed in on Home: it opens where it sits, lists the matches, and never leaves for the Search tab on a tap. */
    @Config(qualifiers = "w390dp-h844dp-xhdpi")
    @Test fun searchOpensInPlace() {
        game = CardGame.YGO
        var left = false
        show(CollectionHomeActions(go = { left = true }))
        val at = bounds("Find cards or ask CardStashy")
        rule.onNodeWithContentDescription("Find cards or ask CardStashy", useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertEquals("the box stays where it was", at.top, bounds("Find cards or ask CardStashy").top)
        assertEquals("Home's own words are put away while typing", 0, rule.onAllNodesWithText("YOUR COLLECTION").fetchSemanticsNodes().size)
        assertEquals(1, rule.onAllNodesWithText("RECENT").fetchSemanticsNodes().size)
        shot("phone-search-recent")
        rule.onNodeWithText("Black Chaos").performClick(); rule.waitForIdle()
        assertEquals("Black Chaos", asked)
        assertTrue(!left)
        assertEquals("Home is back", 1, rule.onAllNodesWithText("YOUR COLLECTION").fetchSemanticsNodes().size)
    }

    /** Meta decks open from their door over Home, and Home is not a long page under its decks. */
    @Config(qualifiers = "w390dp-h844dp-xhdpi")
    @Test fun metaDecksAreBehindTheirDoor() {
        show()
        assertEquals(0, rule.onAllNodesWithText("Ars Magna Elfnote").fetchSemanticsNodes().size)
        rule.onNodeWithText("Meta decks").performClick(); rule.waitForIdle()
        assertEquals(1, rule.onAllNodesWithText("Ars Magna Elfnote").fetchSemanticsNodes().size)
        shot("phone-meta-door")
        rule.onNodeWithContentDescription("Back to Home").performClick(); rule.waitForIdle()
        assertEquals(0, rule.onAllNodesWithText("Ars Magna Elfnote").fetchSemanticsNodes().size)
    }

    @Config(qualifiers = "w884dp-h1104dp-xhdpi")
    @Test fun foldOpen() { game = CardGame.MTG; show(); shot("fold-magic") }

    @Config(qualifiers = "w1024dp-h768dp-land-xhdpi")
    @Test fun tablet() { game = CardGame.YGO; show(); shot("tablet-yugioh") }

    /** The Thor's top screen: the value is in the case below, so the top has the art, the name, the deck boxes and the doors. */
    @Config(qualifiers = "w731dp-h411dp-land-xhdpi")
    @Test fun thorTop() {
        DualScreen.pretend(DualScreen.Panel(4, "Built-in Screen 2", 1240, 1080, 60f))
        try {
            show(); shot("thor-top-pokemon")
            assertEquals("the value is not said twice", 0, rule.onAllNodesWithText("YOUR COLLECTION").fetchSemanticsNodes().size)
            assertEquals(1, rule.onAllNodesWithContentDescription("Open Crustle · original").fetchSemanticsNodes().size)
        } finally { DualScreen.pretend(null) }
    }
}
