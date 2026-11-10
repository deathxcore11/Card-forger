package dev.cardstashy.nativeplay.ui

import android.view.KeyEvent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import dev.cardstashy.nativeplay.audio.TableAudio
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Live 0.4.57 on the Thor: one pad X on the Defeat screen started a Rematch. As in Arena, X and the ring's start now leave
 * to Home, Rematch takes the ring right then A (or a touch), and neither X nor the ring is live until the card has risen.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class ResultPadTest {
    @get:Rule val rule = createComposeRule()
    @After fun off() { Pad.forget() }

    private fun key(code: Int, action: Int) = KeyEvent(0, 0, action, code, 0, 0, 0, 0, 0, android.view.InputDevice.SOURCE_GAMEPAD).let { PadPrompts.key(it) { } }
    private fun press(code: Int) { rule.runOnUiThread { key(code, KeyEvent.ACTION_DOWN); key(code, KeyEvent.ACTION_UP) } }

    /** A lost match: the snapshot's board, finished, the CPU the winner. */
    private fun lost(): MatchState {
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        return st.copy(status = "finished", winnerPlayerId = st.cpu.id, draw = false)
    }

    /** The result screen with a pad; nothing has moved on the clock yet. */
    private fun show(did: MutableList<String>) {
        rule.mainClock.autoAdvance = false
        Pad.used()
        val st = lost()
        val audio = TableAudio(RuntimeEnvironment.getApplication())
        var modes: androidx.compose.ui.input.InputModeManager? = null
        rule.setContent {
            modes = androidx.compose.ui.platform.LocalInputModeManager.current
            Box(Modifier.fillMaxSize().padRoot()) { Result(st, audio, onHome = { did += "home" }, onRematch = { did += "rematch" }) }
        }
        // The pad was the last thing used: the ring shows (keyboard mode), as on the device after a table X.
        rule.runOnUiThread { modes?.requestInputMode(InputMode.Keyboard) }
    }

    @Test fun xCarriedInFromTheTableDoesNothing() {
        val did = mutableListOf<String>()
        show(did)
        rule.mainClock.advanceTimeBy(100)
        assertNull("X is live before the card has risen", PadPrompts.current().x)
        press(KeyEvent.KEYCODE_BUTTON_X)
        rule.mainClock.advanceTimeBy(100)
        assertEquals(emptyList<String>(), did)
    }

    @Test fun xGoesHomeOnceRisen() {
        val did = mutableListOf<String>()
        show(did)
        rule.mainClock.advanceTimeBy(1000)
        assertEquals("Home", PadPrompts.current().x?.label)
        press(KeyEvent.KEYCODE_BUTTON_X)
        assertEquals(listOf("home"), did)
    }

    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @Test fun ringStartsOnHomeAndRematchIsRightThenA() {
        val did = mutableListOf<String>()
        show(did)
        rule.mainClock.advanceTimeBy(1000)
        rule.onNodeWithText("Home").assertIsFocused()
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionRight) }
        rule.mainClock.advanceTimeBy(300)
        rule.onNodeWithText("Rematch").assertIsFocused()
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }
        rule.mainClock.advanceTimeBy(300)
        assertEquals(listOf("rematch"), did)
    }
}
