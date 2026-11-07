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
import dev.cardstashy.nativeplay.ui.CollectionGame
import dev.cardstashy.nativeplay.ui.CollectionHomeRoute
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Pokémon and Yu-Gi-Oh! Home with the collection the live site saved for tcghome/fixture.cjs (six Pokémon cards and a Pikachu ex deck;
 * five Yu-Gi-Oh! cards and a Dark Magician deck), with the card data the site kept for them. The real path: this device's copy, the
 * engine, the route; the Card of the Day, Meta and News from the live services. On the Fold's cover screen, the whole page.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h1700dp-xxhdpi")
class TcgHomeShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()

    private fun run(g: CardGame, deck: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0") }
            .getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url }
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.models.clear()
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        CollectionGame.init(app); CollectionGame.set(g)
        rule.setContent { CollectionHomeRoute(onPlay = {}, onProfile = {}, web = { _, _ -> }, open = {}) }
        rule.waitUntil(60_000) { rule.onAllNodesWithText(deck).fetchSemanticsNodes().isNotEmpty() }
        rule.waitUntil(120_000) { rule.onAllNodesWithText("Card of the Day").fetchSemanticsNodes().isNotEmpty() && rule.onAllNodesWithText("Original source").fetchSemanticsNodes().isNotEmpty() }
        repeat(30) { Thread.sleep(200); rule.mainClock.advanceTimeBy(200); rule.waitForIdle() }
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tcg-home-${g.id}-390.png").path)
    }

    @Test fun pokemon() = run(CardGame.PTCG, "Pikachu ex")
    @Test fun yugioh() = run(CardGame.YGO, "Dark Magician")
}
