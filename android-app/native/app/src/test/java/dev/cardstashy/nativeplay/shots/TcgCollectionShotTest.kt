package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionCardsRoute
import dev.cardstashy.nativeplay.ui.CollectionDecksRoute
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
 * Pokémon and Yu-Gi-Oh! Cards and Decks tabs over tcg.js tcgCollection() and tcgDecks(), with the collection the live site saved for
 * TcgHomeShotTest (six Pokémon cards and a Pikachu ex deck; five Yu-Gi-Oh! cards and a Dark Magician deck) and its card data.
 * The real path: this device's copy, the engine, the route, the game the header chose.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h1100dp-xxhdpi")
class TcgCollectionShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()

    private fun setUp(g: CardGame) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0") }
            .getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url }
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        CollectionGame.init(app); CollectionGame.set(g)
    }
    private fun settle() = repeat(30) { Thread.sleep(200); rule.mainClock.advanceTimeBy(200); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tcg-$name-390.png").path)

    private fun cards(g: CardGame, card: String, words: List<String>) {
        setUp(g)
        rule.setContent { CollectionCardsRoute(onPlay = {}, onProfile = {}, onHome = {}, web = { _, _ -> }) }
        rule.waitUntil(60_000) { rule.onAllNodesWithText(card).fetchSemanticsNodes().isNotEmpty() }
        settle()
        for (w in words) assertTrue("$w shows", rule.onAllNodesWithText(w, substring = true).fetchSemanticsNodes().isNotEmpty())
        shot("cards-${g.id}")
    }
    private fun decks(g: CardGame, deck: String, words: List<String>) {
        setUp(g)
        rule.setContent { CollectionDecksRoute(onPlay = {}, onProfile = {}, onHome = {}, onCards = {}, web = { _, _ -> }) }
        rule.waitUntil(60_000) { rule.onAllNodesWithText(deck).fetchSemanticsNodes().isNotEmpty() }
        settle()
        for (w in words) assertTrue("$w shows", rule.onAllNodesWithText(w, substring = true).fetchSemanticsNodes().isNotEmpty())
        shot("decks-${g.id}")
    }

    @Test fun pokemonCards() = cards(CardGame.PTCG, "Charizard ex", listOf("All sets", "All kinds", "All rarities", "Obsidian Flames", "HP 330"))
    @Test fun yugiohCards() = cards(CardGame.YGO, "Dark Magician", listOf("All sets", "All kinds", "Printing not verified"))
    @Test fun pokemonDecks() = decks(CardGame.PTCG, "Pikachu ex", listOf("to fix", "owned", "to finish", "War Chest"))
    @Test fun yugiohDecks() = decks(CardGame.YGO, "Dark Magician", listOf("to fix", "owned", "Advanced (TCG)"))
}
