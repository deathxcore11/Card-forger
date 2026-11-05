package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CollectionDeck
import dev.cardstashy.nativeplay.ui.CollectionDeckModel
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.TopBarItems
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * A deck's page (its Cards tab) from the site's own views.js deckPage() in each of its four views
 * (app/build/shot-art/home/collection-deck-<view>.json, written by CollectionEngineTest.deckModel), upright, unfolded and sideways.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CollectionDeckShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private val missing = java.util.TreeSet<String>()
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        if (f == null) { missing += url; return null }
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    private fun shot(name: String, w: Int, h: Int, content: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in dev.cardstashy.nativeplay.ui.CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "$name-${w}x$h-100.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, 1f)) { content() }
        }
    }

    private fun page(fixture: String): (@Composable () -> Unit)? {
        val fx = home.resolve("collection-deck-$fixture.json")
        if (!fx.exists()) return null
        val m = CollectionDeckModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        val draw: @Composable () -> Unit = {
            CollectionDeck(m, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) },
                nav = { v -> CollectionNav(CollectionTab.DECKS, vertical = v, scan = !v) {} })
        }
        return draw
    }

    private fun setUp() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
    }

    @Test fun artGrid() {
        setUp()
        val page = page("gallery"); assumeTrue("write the fixtures first (CollectionEngineTest.deckModel)", page != null)
        shot("collection-deck-gallery", 390, 844) { page!!() }
        shot("collection-deck-gallery-page", 390, 4300) { page!!() }
        shot("collection-deck-gallery", 884, 1104) { page!!() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-deck-gallery", 844, 390) { page!!() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    @Test fun otherViews() {
        setUp()
        for (v in listOf("stacks", "symbols", "compact")) {
            val page = page(v); assumeTrue("write the fixtures first (CollectionEngineTest.deckModel)", page != null)
            shot("collection-deck-$v", 390, 844) { page!!() }
            shot("collection-deck-$v-page", 390, 2400) { page!!() }
            shot("collection-deck-$v", 884, 1104) { page!!() }
        }
        page("commander")?.let { p -> shot("collection-deck-commander", 390, 844) { p() } }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }
}
