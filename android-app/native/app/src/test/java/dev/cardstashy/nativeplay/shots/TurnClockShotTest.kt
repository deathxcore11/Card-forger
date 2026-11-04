package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.ui.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The turn clock over the real table: a decision with time to spare, and the last seconds. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-hdpi")
class TurnClockShotTest {
    @get:Rule val rule = createComposeRule()
    @Test fun clock() {
        Motion.still = true
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val now = android.os.SystemClock.elapsedRealtime()
        val clocks = listOf("clock-mid" to MatchController.Clock(now + 62_000, 90_000), "clock-warn" to MatchController.Clock(now + 6_000, 30_000))
        val which = androidx.compose.runtime.mutableStateOf(clocks[0].second)
        rule.setContent {
            val anchors = remember { Anchors() }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    ClockPill(which.value, Modifier.align(Alignment.CenterEnd).androidx_padding())
                }
            }
        }
        for ((name, c) in clocks) { which.value = c; rule.waitForIdle(); rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "$name.png").path) }
    }
}
private fun Modifier.androidx_padding() = this.then(Modifier.padding(end = 10.dp).offset(y = (-44).dp))
