package dev.cardstashy.nativeplay.shots

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

/** Randall 7 Nov on the AYN Portal 2: pack cards were tiny on a wide, short screen. The big card now takes the height beside the hand. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w853dp-h480dp-xhdpi")
class PackWideTest {
    @get:Rule val rule = createComposeRule()

    @Test fun wideShortScreen() {
        dev.cardstashy.nativeplay.ui.Motion.still = false
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        val pack = dev.cardstashy.nativeplay.ui.packResult(out, "Reality Fracture")
        kotlinx.coroutines.runBlocking { AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/pack-fra.webp", maxWidth = 600) }
        val dir = System.getProperty("shotsDir")
        rule.setContent { dev.cardstashy.nativeplay.ui.PackOpening(pack, onNext = null, onClose = {}) }
        for ((name, at) in listOf("deal-420" to 860L, "landed" to 3200L)) {
            rule.mainClock.autoAdvance = false
            if (name == "deal-420") { rule.mainClock.advanceTimeBy(500); rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(width / 2f, height / 2f)) } }
            rule.mainClock.advanceTimeBy(at); Thread.sleep(200)
            rule.onRoot().captureRoboImage(File(dir, "native-pack-wide-$name.png").path)
        }
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(width * .24f, height / 2f)) }
        rule.mainClock.advanceTimeBy(1500); Thread.sleep(200)
        rule.onRoot().captureRoboImage(File(dir, "native-pack-wide-flipped.png").path)
    }
}
