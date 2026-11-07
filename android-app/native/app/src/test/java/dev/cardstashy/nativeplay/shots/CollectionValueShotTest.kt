package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.CollectionCards
import dev.cardstashy.nativeplay.ui.CollectionCardsModel
import dev.cardstashy.nativeplay.ui.CollectionCardsRoute
import dev.cardstashy.nativeplay.ui.CollectionGame
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.CollectionValueActions
import dev.cardstashy.nativeplay.ui.CollectionValueModel
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.TopBarItems
import dev.cardstashy.nativeplay.ui.collectionValueItems
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Collection › Value: Magic from the site's own views.js collectionValueView (app/build/shot-art/home/collection-value.json, written
 * by CollectionEngineTest.valueModel) under the Cards tab's head at every size, big text too; and Pokémon / Yu-Gi-Oh! through the
 * real route (tcg.js tcgValueView), opened from the tab.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CollectionValueShotTest {
    @get:Rule val rule = createComposeRule()
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        return f?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } ?: runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0") }
            .getInputStream().use { BitmapFactory.decodeStream(it) }?.asImageBitmap()?.also { _ -> } }.getOrNull()
    }

    /** The real route over the TCG fixture (TcgCollectionShotTest's): the Value tab opens natively, with the site's words. */
    private fun tcgValue(g: CardGame, words: List<String>) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        // The lots wear their foils now (FoilMaps loads each picture through the app's image loader).
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        dev.cardstashy.nativeplay.ui.homeArt = { url -> art(url) ?: url }
        val app = RuntimeEnvironment.getApplication()
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.models.clear()
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        CollectionGame.init(app); CollectionGame.set(g)
        RuntimeEnvironment.setQualifiers("w390dp-h1400dp-xxhdpi")
        var opened = ""
        rule.setContent { CollectionCardsRoute(onPlay = {}, onProfile = {}, onHome = {}, web = { u, p -> opened = "$u $p" }) }
        rule.waitUntil(60_000) { rule.onAllNodesWithText("Value").fetchSemanticsNodes().isNotEmpty() && rule.onAllNodesWithText("All sets").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Value").performClick()
        rule.waitUntil(60_000) { rule.onAllNodesWithText("Your collection value", substring = true, ignoreCase = true).fetchSemanticsNodes().isNotEmpty() }
        repeat(10) { Thread.sleep(200); rule.mainClock.advanceTimeBy(200); rule.waitForIdle() }
        for (w in words) {
            rule.onNode(hasScrollAction()).performScrollToNode(hasText(w, substring = true))
            assertTrue("$w shows", rule.onAllNodesWithText(w, substring = true).fetchSemanticsNodes().isNotEmpty())
        }
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("Refresh prices"))
        assertTrue("Value didn't hand off to the website: $opened", opened.isEmpty())
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("Your collection value", substring = true, ignoreCase = true))
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-value-${g.id}-390.png").path)
        // Back to Cards, natively.
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("Cards"))
        rule.onNodeWithText("Cards").performClick()
        rule.waitUntil(30_000) { rule.onAllNodesWithText("All sets").fetchSemanticsNodes().isNotEmpty() }
    }

    @Test fun pokemonValue() = tcgValue(CardGame.PTCG, listOf("Most valuable", "By type", "Price alerts", "Charizard ex"))
    @Test fun yugiohValue() = tcgValue(CardGame.YGO, listOf("Most valuable", "By attribute", "Price alerts", "Dark Magician"))
}
