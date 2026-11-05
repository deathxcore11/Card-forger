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
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionSet
import dev.cardstashy.nativeplay.ui.CollectionSetModel
import dev.cardstashy.nativeplay.ui.CollectionSets
import dev.cardstashy.nativeplay.ui.CollectionSetsModel
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.SetsTest
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
 * All sets (set-list-ui.js renderSetBrowser) and one set's page (set-list-ui.js renderSetDetail) from the site's own code
 * (app/build/shot-art/home/collection-sets.json and collection-set-2x2.json, written from the engine bundle with the site's
 * live data), upright, unfolded and sideways.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CollectionSetsShotTest {
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

    private val top: @Composable ((@Composable () -> Unit)?) -> Unit = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) }
    private val nav: @Composable (Boolean) -> Unit = { v -> CollectionNav(CollectionTab.SEARCH, vertical = v, scan = !v) {} }

    private fun setUp() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
    }

    @Test fun sets() {
        setUp()
        val fx = home.resolve("collection-sets.json"); assumeTrue("write the sets fixture first", fx.exists())
        val m = CollectionSetsModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        val page: @Composable () -> Unit = { CollectionSets(m, top, nav = nav) }
        shot("collection-sets", 390, 844) { page() }
        shot("collection-sets-page", 390, 3200) { page() }
        shot("collection-sets", 884, 1104) { page() }
        shot("collection-sets-page", 884, 2400) { page() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-sets", 844, 390) { page() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        SetsTest.open = true
        try { shot("collection-sets-filters", 390, 844) { page() }; shot("collection-sets-filters", 884, 1104) { page() } } finally { SetsTest.open = null }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** Yu-Gi-Oh! and Pokémon (tcg.js tcgSets / tcgSet): collection-sets-<game>.json and collection-set-<game>.json from the engine. */
    @Test fun tcgSets() {
        setUp()
        for (g in listOf("ygo", "ptcg")) {
            val fx = home.resolve("collection-sets-$g.json"); assumeTrue("write the $g sets fixture first", fx.exists())
            val m = CollectionSetsModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
            val page: @Composable () -> Unit = { CollectionSets(m, top, nav = nav) }
            shot("collection-sets-$g", 390, 844) { page() }
            shot("collection-sets-$g-page", 390, 2400) { page() }
            shot("collection-sets-$g", 884, 1104) { page() }
            val sx = home.resolve("collection-set-$g.json"); assumeTrue("write the $g set fixture first", sx.exists())
            val sm = CollectionSetModel.parse(JsonParser.parseString(sx.readText()).asJsonObject)
            val setPage: @Composable () -> Unit = { CollectionSet(sm, top, nav = nav) }
            shot("collection-set-$g", 390, 844) { setPage() }
            shot("collection-set-$g-page", 390, 2400) { setPage() }
            shot("collection-set-$g", 884, 1104) { setPage() }
        }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    @Test fun set() {
        setUp()
        val fx = home.resolve("collection-set-2x2.json"); assumeTrue("write the set fixture first", fx.exists())
        val m = CollectionSetModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        val page: @Composable () -> Unit = { CollectionSet(m, top, nav = nav) }
        shot("collection-set", 390, 844) { page() }
        shot("collection-set-page", 390, 2400) { page() }
        shot("collection-set", 884, 1104) { page() }
        shot("collection-set-page", 884, 2000) { page() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-set", 844, 390) { page() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }
}
