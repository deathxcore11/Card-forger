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
import dev.cardstashy.nativeplay.ui.CollectionSearch
import dev.cardstashy.nativeplay.ui.CollectionSearchModel
import dev.cardstashy.nativeplay.ui.HomeTest
import dev.cardstashy.nativeplay.ui.SearchShots
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
 * The Search tab (views.js search(), tcg.js tcgSearch()) from the site's own code (app/build/shot-art/home/collection-search-*.json,
 * written by SearchTest.shotFixture with live results), at every size the app is checked at, and at 130% text.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CollectionSearchShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private val missing = java.util.TreeSet<String>()
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        if (f == null) { missing += url; return null }
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    private fun shot(name: String, w: Int, h: Int, font: Float = 1f, page: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in dev.cardstashy.nativeplay.ui.CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "$name-${w}x$h-${(font * 100).toInt()}.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, font)) { page() }
        }
    }

    private val top: @Composable ((@Composable () -> Unit)?) -> Unit = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) }
    private val nav: @Composable (Boolean) -> Unit = { v -> CollectionNav(CollectionTab.SEARCH, vertical = v, scan = !v) {} }

    private fun setUp() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
    }

    private fun model(name: String): CollectionSearchModel? = home.resolve("collection-search-$name.json").takeIf { it.exists() }?.let { CollectionSearchModel.parse(JsonParser.parseString(it.readText()).asJsonObject) }

    private fun sizes(name: String, scale: Boolean = true, page: @Composable () -> Unit) {
        for ((w, h) in listOf(360 to 780, 390 to 844, 954 to 860, 1024 to 768)) shot(name, w, h, page = page)
        HomeTest.forceShort = true
        try { shot(name, 844, 390, page = page) } finally { HomeTest.forceShort = null }
        if (scale) { shot(name, 390, 844, 1.3f, page); shot(name, 360, 780, 1.3f, page) }
    }

    @Test fun empty() {
        setUp()
        val empty = model("empty"); assumeTrue("write the search fixtures first (SearchTest.shotFixture)", empty != null)
        sizes("collection-search") { CollectionSearch(empty!!, top, nav = nav) }
        SearchShots.filters = true
        try { shot("collection-search-filters", 390, 1400) { CollectionSearch(empty!!, top, nav = nav) }; shot("collection-search-filters", 954, 1100) { CollectionSearch(empty!!, top, nav = nav) } } finally { SearchShots.filters = false }
    }

    @Test fun results() {
        setUp()
        val m = model("results"); assumeTrue("write the search fixtures first (SearchTest.shotFixture)", m != null)
        sizes("collection-search-results") { CollectionSearch(m!!, top, nav = nav) }
        shot("collection-search-results-page", 390, 2400) { CollectionSearch(m!!, top, nav = nav) }
        model("saved")?.let { s -> shot("collection-search-saved", 390, 844) { CollectionSearch(s, top, nav = nav) } }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    @Test fun tcg() {
        setUp()
        for (g in listOf("ygo", "ptcg")) model(g)?.let { m -> shot("collection-search-$g", 390, 844) { CollectionSearch(m, top, nav = nav) }; shot("collection-search-$g", 954, 860) { CollectionSearch(m, top, nav = nav) } }
    }
}
