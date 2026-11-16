package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionSearch
import dev.cardstashy.nativeplay.ui.CollectionSearchModel
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
 * The search box's answer card on the Search tab, drawn from the answers the engine gave against live data (AnswerEngineTest
 * writes app/build/shot-art/home/answer-*.json; SearchTest.shotFixture writes the page under it).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class AnswerCardShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? = (home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() })?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() }
    private val top: @Composable ((@Composable () -> Unit)?) -> Unit = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) }
    private val nav: @Composable (Boolean) -> Unit = { v -> CollectionNav(CollectionTab.SEARCH, vertical = v, scan = !v) {} }
    private fun json(name: String): JsonObject? = home.resolve("$name.json").takeIf { it.exists() }?.let { JsonParser.parseString(it.readText()).asJsonObject }

    @Test fun answers() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        val page = json("collection-search-empty")?.let(CollectionSearchModel::parse); assumeTrue("write the search fixtures first (SearchTest.shotFixture)", page != null)
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in dev.cardstashy.nativeplay.ui.CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        var drawn = 0
        for (name in listOf("meta", "set", "wiki", "keyword", "filter", "miss", "which")) {
            val a = json("answer-$name") ?: continue
            for ((w, h) in listOf(390 to 1100, 954 to 860)) {
                RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
                captureRoboImage(File(System.getProperty("shotsDir"), "answer-$name-${w}x$h.png").path) { CollectionSearch(page!!, top, nav = nav, query = a.get("q").asString, answer = a) }
            }
            drawn++
        }
        assumeTrue("write the answer fixtures first (AnswerEngineTest)", drawn > 0)
    }
}
