package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Preview for the black bars (19 Nov recordings on the Fold's 1080 x 1200 screen): the table locked sideways is letterboxed by
 * Android to 1080 x 974. "now" is that letterboxed size; "full" is the whole screen the table would get if it were not locked
 * sideways on a large screen. Pictures in table-fullscreen, for the eye.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
@org.junit.FixMethodOrder(org.junit.runners.MethodSorters.NAME_ASCENDING)
class FullScreenTableShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private fun shot(name: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent { Box(Modifier.fillMaxSize().background(Palette.Night)) {
            ForgeBoard(base, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}) } }
        rule.waitForIdle(); rule.mainClock.advanceTimeBy(3000); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-fullscreen/$name.png").path)
    }
    @Config(qualifiers = "w720dp-h648dp-xhdpi") @Test fun a0warm() = shot("warm")
    @Config(qualifiers = "w720dp-h648dp-xhdpi") @Test fun b1now() = shot("now-letterboxed")
    @Config(qualifiers = "w720dp-h800dp-xhdpi") @Test fun b2full() = shot("full-screen")
}
