package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.match.Plate
import dev.cardstashy.nativeplay.ui.VersusScreen
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Quick Play's reveal (play-forge-pregame.js forge-intro-power): the matchup line under the CPU's deck on the versus beat. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-xxhdpi")
class VersusShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    @Test fun quickMatchup() {
        rule.setContent {
            VersusScreen(Plate("Elder Owyn Lyons", "You", null), Plate("Sisay, Weatherlight Captain", "CPU · Commander", null, "Wild Card · Bracket 4 Optimized · 83 · You’re the underdog"), intro = false)
        }
        repeat(20) { Thread.sleep(30); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
        assertTrue(rule.onAllNodesWithText("Wild Card · Bracket 4 Optimized · 83 · You’re the underdog").fetchSemanticsNodes().isNotEmpty())
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "versus-quick-matchup.png").path)
    }
}
