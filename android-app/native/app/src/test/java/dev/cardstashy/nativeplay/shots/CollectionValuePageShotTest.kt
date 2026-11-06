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
 * Collection › Value (Magic page): Magic from the site's own views.js collectionValueView (app/build/shot-art/home/collection-value.json, written
 * by CollectionEngineTest.valueModel) under the Cards tab's head at every size, big text too; and Pokémon / Yu-Gi-Oh! through the
 * real route (tcg.js tcgValueView), opened from the tab.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CollectionValuePageShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        return f?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } ?: runCatching { java.net.URI(url).toURL().openConnection().apply { setRequestProperty("User-Agent", "CardStashyTests/1.0") }
            .getInputStream().use { BitmapFactory.decodeStream(it) }?.asImageBitmap()?.also { _ -> } }.getOrNull()
    }

    private fun shot(name: String, w: Int, h: Int, scale: Float = 1f, content: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "$name-${w}x$h-${(scale * 100).toInt()}.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, scale)) { content() }
        }
    }

    @Test fun magicValue() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        val vf = home.resolve("collection-value.json"); val cf = home.resolve("collection-cards.json")
        assumeTrue("write the fixtures first (CollectionEngineTest.valueModel, cardsModel)", vf.exists() && cf.exists())
        val m = CollectionCardsModel.parse(JsonParser.parseString(cf.readText()).asJsonObject)
        val v = CollectionValueModel.parse(JsonParser.parseString(vf.readText()).asJsonObject)
        val page = @Composable {
            CollectionCards(m, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = false, onSwitch = {}, onProfile = {}, middle = tabs) },
                nav = { vert -> CollectionNav(CollectionTab.CARDS, vertical = vert, scan = !vert) {} }, tab = "value",
                body = { gutter, narrow -> collectionValueItems(v, CollectionValueActions(), gutter, narrow) })
        }
        shot("collection-value", 390, 844) { page() }
        shot("collection-value-page", 390, 2600) { page() }
        shot("collection-value-page", 360, 2600, 1.3f) { page() }
        shot("collection-value", 360, 780) { page() }
        shot("collection-value-page", 954, 1800) { page() }
        shot("collection-value", 1024, 768) { page() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-value", 844, 390) { page() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
    }

}
