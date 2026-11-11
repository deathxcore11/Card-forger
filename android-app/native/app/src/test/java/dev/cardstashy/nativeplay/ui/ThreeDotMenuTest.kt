package dev.cardstashy.nativeplay.ui

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * 0.4.60 Z6 (specs/table-zones-brief.md, "One gold action button"): bottom right, the gold button (44 dp tall) is the current action,
 * End turn a smaller quiet button above it, and Yield in a three-dot menu beside End turn, reachable by touch and by a controller in
 * two presses. Run on a phone a little under the 844 x 390 design (chrome scale about 0.92), where the 44 dp floor matters.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w780dp-h360dp-land-xxhdpi")
class ThreeDotMenuTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @After fun off() { Pad.forget() }

    private val yields = mutableListOf<Pair<Int, Boolean>>()
    private val anchors = Anchors()
    private val dp get() = org.robolectric.RuntimeEnvironment.getApplication().resources.displayMetrics.density

    /** Your priority, a CPU ability on top of the stack (it has Yield), Forge's cancel is End turn. */
    private fun board() {
        Motion.still = true
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-crowded.json")!!.readText())!!
        val top = base.stack.first().copy(id = 9101, controller = base.cpu.id, ability = true, text = "Soul Warden — Whenever another creature enters, you gain 1 life.")
        val st = base.copy(stack = listOf(top), prompt = null, inputType = "InputPassPriority")
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().padRoot().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(yieldSource = { id, on -> yields += id to on }), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
    }

    private fun pad(code: Int) {
        for (a in listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP))
            rule.runOnIdle { PadPrompts.key(KeyEvent(0, 0, a, code, 0, 0, 0, 0, 0, android.view.InputDevice.SOURCE_GAMEPAD)) { } }
        rule.waitForIdle()
    }

    @Test fun theCornerIsGoldBelowEndTurnWithTheDotsBesideIt() {
        board()
        val r = anchors.rects
        val gold = r["gold"] ?: error("no gold button"); val quiet = r["quiet"] ?: error("no End turn"); val dots = r["dots"] ?: error("no three-dot button")
        assertTrue("gold 44 dp tall (${gold.height / dp})", gold.height >= 44f * dp - 1f)
        assertTrue("End turn above the gold button", quiet.bottom <= gold.top)
        assertTrue("End turn no taller than the gold button", quiet.height <= gold.height + 1f)
        assertTrue("the dots beside End turn, at its right", dots.left >= quiet.right && kotlin.math.abs(dots.center.y - quiet.center.y) < 2f)
        assertTrue("the dots 44 dp (${dots.height / dp})", dots.height >= 44f * dp - 1f && dots.width >= 44f * dp - 1f)
        val w = rule.onRoot().fetchSemanticsNode().size
        for ((k, b) in listOf("gold" to gold, "quiet" to quiet, "dots" to dots))
            assertTrue("$k inside the screen", b.left >= 0f && b.top >= 0f && b.right <= w.width + 1f && b.bottom <= w.height + 1f)
        // Yield is no longer a pill under the stack card.
        assertNull("no menu until asked", r[TableActions.YIELD])
    }

    @Test fun yieldInTwoTaps() {
        board()
        rule.onRoot().performTouchInput { click(anchors.rects.getValue("dots").center) }
        rule.waitForIdle()
        val line = anchors.rects[TableActions.YIELD] ?: error("the menu did not open")
        rule.onRoot().performTouchInput { click(line.center) }
        rule.waitForIdle()
        assertEquals(listOf(9101 to true), yields)
        // The menu closed with the pick: the same spot again yields nothing more.
        rule.onRoot().performTouchInput { click(line.center) }
        rule.waitForIdle()
        assertEquals("the menu closed", listOf(9101 to true), yields)
    }

    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @Test fun yieldInTwoPadPresses() {
        Pad.used()
        board()
        assertEquals("LT says what it does", "More / Pass", PadPrompts.current().pageLabel)
        // Press 1: LT opens the menu with its first line ringed.
        pad(KeyEvent.KEYCODE_BUTTON_L2)
        rule.mainClock.advanceTimeBy(100); rule.waitForIdle()
        assertNotNull("the menu opened", anchors.rects[TableActions.YIELD])
        // Press 2: A.
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }
        rule.waitForIdle()
        assertEquals(listOf(9101 to true), yields)
    }
}
