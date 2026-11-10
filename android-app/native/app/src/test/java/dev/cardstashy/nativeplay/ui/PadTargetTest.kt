package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Live 0.4.57 on the Thor (fault list 3, 13, 15): in a target prompt the ring stayed on the hand chip, A lifted a hand card,
 * the d-pad wandered to the menu, LT at priority ended the turn, and the ring's way back to the hand lifted card 1.
 * table/snap-targets.json: Lightning Bolt asks for a target (cards 123, 124, 107, 108, 109, players 2 and 1; Cancel shown).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class PadTargetTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @After fun off() { DualScreen.pretend(null); Pad.forget(); TableZones.ask = null; TableZones.at = 0; TableZones.jumped = false; TablePad.handAt = -1; PadPrompts.keyRepeat = 0 }

    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private val targets = setOf(123, 124, 107, 108, 109)

    private fun step() { rule.mainClock.advanceTimeBy(600) }
    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    private fun center() {
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }
        step()
    }

    private val picked = mutableListOf<Int>()
    private var cancels = 0
    private var sel: Int? = null

    /** The board on two screens with a pad, showing [board]; the hand lift is kept as TableScreen keeps it. */
    private fun show(board: MutableState<MatchState>) {
        Motion.still = true; rule.mainClock.autoAdvance = false
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        Pad.used()
        rule.setContent {
            var s by remember { mutableStateOf<Int?>(null) }
            sel = s
            CompositionLocalProvider(LocalAnchors provides remember { Anchors() }) {
                Box(Modifier.fillMaxSize().padRoot()) {
                    ForgeBoard(board.value, live = true, intents = TableIntents(card = { picked += it }, cancel = { cancels++ }), selectedHand = s, onSelectHand = { s = it },
                        onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        step()
    }

    @Test fun aOnTheHandDuringTargetsNeverLifts() {
        show(mutableStateOf(state("targets")))
        // A refused or skipped jump, or the d-pad landing on the chip: the ring on the hand chip lifts nothing.
        rule.runOnUiThread { TableZones.hand?.requestFocus() }
        step()
        assertNull(sel)
        assertEquals("To target", PadPrompts.current().a)
        center()
        assertNull("A on the chip lifted a hand card", sel)
        assertEquals("Target", PadPrompts.current().a)
        center()
        assertEquals(1, picked.size)
        assertTrue("picked ${picked[0]}", picked[0] in targets)
    }

    @Test fun ltCancelsOnlyWhileTargetingAndIsLabelled() {
        val board = mutableStateOf(state("targets"))
        show(board)
        rule.runOnUiThread { PadPrompts.current().page!!(-1) }
        assertEquals(1, cancels)
        assertEquals("Cancel cast · Hand/Field", PadPrompts.current().pageLabel)
        // Plain priority: Forge's cancel is End turn here, and LT never presses it.
        board.value = state("main")
        step()
        rule.runOnUiThread { PadPrompts.current().page!!(-1) }
        assertEquals(1, cancels)
        assertEquals("Hand / Field", PadPrompts.current().pageLabel)
    }

    @Test fun dpadStaysOnTargets() {
        show(mutableStateOf(state("targets")))
        rule.runOnUiThread { TableZones.toHand() }
        step()
        var sawCancel = false
        repeat(4) { n ->
            rule.runOnUiThread { PadPrompts.navigate(android.view.KeyEvent.KEYCODE_DPAD_UP) }
            step()
            val a = PadPrompts.current().a
            val onCancel = a != "Target" && a != "Choose" && runCatching { rule.onNode(isFocused()).assert(hasText("Cancel")) }.isSuccess
            sawCancel = sawCancel || onCancel
            assertTrue("press ${n + 1}: the ring left the targets (a=$a)", a == "Target" || a == "Choose" || onCancel)
        }
        assertTrue("the walk never reached the Cancel pill", sawCancel)
        assertNull(sel)
    }

    @Test fun returnToHandLiftsNothing() {
        val board = mutableStateOf(state("main"))
        show(board)
        // The ring start puts the ring on the chip by itself (autoRing): nothing lifted.
        assertNull(sel)
        board.value = state("targets")
        step()
        assertEquals("Target", PadPrompts.current().a)
        board.value = state("main")
        step()
        assertNull("the way back lifted a card", sel)
        assertEquals("Lift", PadPrompts.current().a)
        assertTrue(rule.onAllNodesWithText("Hand 7 · bottom screen", substring = true).fetchSemanticsNodes().isNotEmpty())
    }

    @Test fun refusedFocusIsNotAJump() {
        val r = FocusRequester()
        rule.mainClock.autoAdvance = false
        rule.setContent { Box(Modifier.fillMaxSize().padRoot()) { Box(Modifier.size(40.dp).focusRequester(r).focusProperties { canFocus = false }.focusable()) } }
        step()
        TableZones.ask = { r }; TableZones.at = 0
        rule.runOnUiThread { TableZones.handOrField() }
        assertEquals(0, TableZones.at)
    }
}
