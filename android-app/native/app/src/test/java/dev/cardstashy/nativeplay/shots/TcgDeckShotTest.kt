package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
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
 * A Pokémon and a Yu-Gi-Oh! deck's page (tcg.js tcgDeck, its Cards tab) over the collection TcgCollectionShotTest uses: the Pikachu ex
 * deck (one zone, the rules review, the price panel) and the Dark Magician deck (Main / Extra / Side, → side), in the four views.
 * Tall enough that the whole page shows, to set beside the site's own captures.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h2300dp-xxhdpi")
class TcgDeckShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()

    private fun setUp(g: CardGame, view: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0") }
            .getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url }
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        app.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE).edit().putString("deckView-" + g.id, view).commit()
        CollectionGame.init(app); CollectionGame.set(g)
    }
    private fun settle() = repeat(30) { Thread.sleep(200); rule.mainClock.advanceTimeBy(200); rule.waitForIdle() }

    private fun deck(g: CardGame, id: String, view: String, title: String, words: List<String>, shot: Boolean = true) {
        setUp(g, view)
        rule.setContent { CollectionDeckRoute(id, onPlay = {}, onProfile = {}, onBack = {}, onHome = {}, onCards = {}, onPractice = { _, _ -> }, web = { _, _ -> }, game = g, bench = false) }
        rule.waitUntil(60_000) { rule.onAllNodesWithText(title).fetchSemanticsNodes().isNotEmpty() }
        // The page reopens on the tab it was left on (tcg.js S.ui.tdeckTab, kept while the app runs): Cards, as these tests look at it.
        rule.onAllNodes(hasText("Cards", substring = false) and hasClickAction()).fetchSemanticsNodes().firstOrNull()?.let {
            rule.onAllNodes(hasText("Cards", substring = false) and hasClickAction())[0].performClick() }
        settle()
        if (shot) rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tcg-deck-${g.id}-$view-390.png").path)
        for (w in words) assertTrue("$w shows", rule.onAllNodesWithText(w, substring = true).fetchSemanticsNodes().isNotEmpty())
    }

    private val pikachu = "1c5ee49c-a4ba-4506-ae2b-1e0761e20324"
    private val magician = "094ab313-b1e1-4778-aefc-52ceb9c90ae5"

    @Test fun pokemonGallery() = deck(CardGame.PTCG, pikachu, "gallery", "Pikachu ex", listOf("Rules review", "7 cards to get", "Cheapest printings", "Need 1", "Deck view"))
    @Test fun pokemonStacks() = deck(CardGame.PTCG, pikachu, "stacks", "Pikachu ex", listOf("Pokémon", "Trainers", "Energy"))
    @Test fun yugiohGallery() = deck(CardGame.YGO, magician, "gallery", "Dark Magician", listOf("Main Deck", "Extra Deck", "Side Deck", "Empty.", "→ side", "Export .ydk"))
    @Test fun yugiohStacks() = deck(CardGame.YGO, magician, "stacks", "Dark Magician", listOf("Monsters", "Spells", "→ side"))
    @Test fun yugiohCompact() = deck(CardGame.YGO, magician, "compact", "Dark Magician", listOf("Limited", "edition not specified"))
    @Test fun yugiohSymbols() = deck(CardGame.YGO, magician, "symbols", "Dark Magician", listOf("Pot of Prosperity", "→ side"))

    /** A row's − and → side save through the site's handlers (tcg.js tDeckQty, tDeckMove) and the page draws again. */
    @Test fun pokemonSaves() {
        deck(CardGame.PTCG, pikachu, "symbols", "Pikachu ex", listOf("16 · 60"), shot = false)
        rule.onAllNodes(androidx.compose.ui.test.hasContentDescription("Remove one"))[0].performClick()
        rule.waitUntil(30_000) { rule.onAllNodesWithText("15 · 60", substring = true).fetchSemanticsNodes().isNotEmpty() }
    }
    @Test fun yugiohSaves() {
        deck(CardGame.YGO, magician, "symbols", "Dark Magician", listOf("11 · 40–60", "0 · 0–15"), shot = false)
        rule.onAllNodesWithText("→ side")[0].performClick()
        rule.waitUntil(30_000) { rule.onAllNodesWithText("1 · 0–15", substring = true).fetchSemanticsNodes().isNotEmpty() }
        assertTrue("→ deck shows", rule.onAllNodesWithText("→ deck").fetchSemanticsNodes().isNotEmpty())
    }
}
