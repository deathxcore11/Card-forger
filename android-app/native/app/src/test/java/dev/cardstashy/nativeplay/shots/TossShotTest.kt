package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.Plate
import dev.cardstashy.nativeplay.ui.TossScreen
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The coin before the opening hand: mid-toss, then landed with the result. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-hdpi")
class TossShotTest {
    @get:Rule val rule = createComposeRule()
    @Test fun toss() {
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        rule.mainClock.autoAdvance = false
        rule.setContent { TossScreen(MatchController.Toss(youFirst = false, flip = true), Plate("Ashen Raiders", "CPU · Commander", null), onDone = {}) }
        rule.mainClock.advanceTimeBy(700)
        rule.onRoot().captureRoboImage("shots/toss-flip.png")
        rule.mainClock.advanceTimeBy(1500)
        rule.onRoot().captureRoboImage("shots/toss-landed.png")
    }
}
