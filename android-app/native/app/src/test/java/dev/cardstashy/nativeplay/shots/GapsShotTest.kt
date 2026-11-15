package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Du
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.ScryOne
import dev.cardstashy.nativeplay.ui.ScryOneView
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.chromeU
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Gaps list 15 Nov on the Fold (884 x 796 dp): the one-card scry with its card (item 1), Main 2's one End turn (item 3) and a gold
 * label that fits whole (item 7, "Pay automa…"). Pictures in table-gaps, for the eye.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class GapsShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()

    private fun shot(st: MatchState, name: String, scry: Boolean = false) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    if (scry) ScryOne.of(st)?.let { n -> BoxWithConstraints(Modifier.fillMaxSize()) { ScryOneView(st, n, true, Du(chromeU(maxWidth, maxHeight)), {}, {}) } }
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-gaps/$name.png").path)
    }

    @Test fun scryOne() {
        val st = base.copy(inputType = "InputConfirm", buttons = Buttons("Top", "Bottom", true, true), stack = emptyList(),
            message = "Plains (12)\n\nPut Plains on the top or bottom of your library?", phase = "COMBAT_DECLARE_ATTACKERS", activePlayer = base.viewer)
        assertEquals("Plains", ScryOne.of(st))
        shot(st, "scry-one", scry = true)
    }

    @Test fun main2() = shot(base.copy(inputType = "InputPassPriority", phase = "MAIN2", activePlayer = base.viewer, priorityPlayer = base.viewer, stack = emptyList(),
        buttons = Buttons("OK", "End Turn", true, true)), "main2")

    @Test fun payAutomatically() = shot(base.copy(inputType = "InputPayManaOfCostPayment", activePlayer = base.viewer, priorityPlayer = base.viewer,
        buttons = Buttons("Auto", "Cancel", true, true), message = "Seam Rip (12) - \n\nPay Mana Cost: {1}"), "pay-auto")
}
