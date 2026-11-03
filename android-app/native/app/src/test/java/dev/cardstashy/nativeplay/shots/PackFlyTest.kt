package dev.cardstashy.nativeplay.shots

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.AssetImages
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Randall 3 Nov 22:17Z: the cards must visibly fly out of the top of the pack when it rips. Frames at the same times as the site's (fly.mjs). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PackFlyTest {
    @get:Rule val rule = createComposeRule()

    @Test fun flyOutOfTheTop() {
        dev.cardstashy.nativeplay.ui.Motion.still = false
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        val pack = dev.cardstashy.nativeplay.ui.packResult(out, "Reality Fracture")
        kotlinx.coroutines.runBlocking { AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-fra.webp", maxWidth = 600) }
        val dir = System.getProperty("shotsDir")
        var run by androidx.compose.runtime.mutableIntStateOf(0)
        rule.setContent { androidx.compose.runtime.key(run) { dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = null, onClose = {}) } }
        for ((name, at) in listOf("tear-120" to 120L, "tear-300" to 300L, "deal-120" to 560L, "deal-260" to 700L, "deal-420" to 860L, "deal-650" to 1090L, "deal-900" to 1340L)) {
            rule.mainClock.autoAdvance = false; run++
            rule.mainClock.advanceTimeBy(500)
            rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(width / 2f, height / 2f)) }
            rule.mainClock.advanceTimeBy(at); Thread.sleep(200)
            rule.onRoot().captureRoboImage(File(dir, "native-fly-$name.png").path)
        }
    }
}
