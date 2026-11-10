package dev.cardstashy.nativeplay.ui

import android.view.KeyEvent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import android.os.Looper

/** The handheld prompt bar (Randall 7 Nov): only what works on the focused thing, A Y X then B or shoulders, buttons do what it says. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w800dp-h450dp-xhdpi")
class PadPromptsTest {
    @get:Rule val rule = createComposeRule()

    private fun key(code: Int, action: Int, repeat: Int = 0) = KeyEvent(0, 0, action, code, repeat, 0, 0, 0, 0, android.view.InputDevice.SOURCE_GAMEPAD).let { PadPrompts.key(it) { } }
    private fun press(code: Int) { key(code, KeyEvent.ACTION_DOWN); key(code, KeyEvent.ACTION_UP) }

    @Test fun focusedCardShowsItsButtonsAndTheyRun() {
        val did = mutableListOf<String>()
        val ring = FocusRequester()
        val tabs = mutableListOf<Int>()
        rule.setContent {
            Box(Modifier.fillMaxSize().padRoot()) {
                PadScreen(PadActs(tabs = { tabs += it }))
                Column {
                    Box(Modifier.size(80.dp).focusRequester(ring)
                        .padActs(PadActs(a = "Open", y = PadAct("Peek") { did += "peek" }, x = PadAct("Add a copy") { did += "add" })).clickable { did += "open" })
                    Box(Modifier.size(80.dp).clickable { })
                }
            }
        }
        rule.runOnIdle { ring.requestFocus() }
        rule.waitForIdle()
        assertEquals(listOf("A" to "Open", "Y" to "Peek", "X" to "Add a copy", "LB RB" to "Tabs"), PadPrompts.prompts())
        press(KeyEvent.KEYCODE_BUTTON_Y); press(KeyEvent.KEYCODE_BUTTON_X); press(KeyEvent.KEYCODE_BUTTON_R1); press(KeyEvent.KEYCODE_BUTTON_L1)
        assertEquals(listOf("peek", "add"), did)
        assertEquals(listOf(1, -1), tabs)
    }

    /** Randall 10 Nov ("2 buttons that say next when one should say skip"): no two buttons ever carry the same words. */
    @Test fun noTwoButtonsSayTheSameWords() {
        assertEquals(listOf("A" to "Inspect", "B" to "Back"), PadPrompts.prompts(PadActs(a = "Inspect", y = PadAct("Inspect") { })))
        assertEquals(listOf("A" to "Next", "X" to "Skip"), PadPrompts.prompts(PadActs(a = "Next", x = PadAct("Skip") { }, b = "Skip")))
        assertEquals(listOf("A" to "Cast", "Y" to "Inspect", "X" to "To combat", "B" to "Back"),
            PadPrompts.prompts(PadActs(a = "Cast", y = PadAct("Inspect") { }, x = PadAct("To combat") { })))
    }

    @Test fun nothingFocusedNoActsMeansOnlyBack() {
        rule.setContent { Box(Modifier.fillMaxSize().padRoot()) }
        rule.waitForIdle()
        assertEquals(listOf("B" to "Back"), PadPrompts.prompts())
    }

    @Test fun opaqueSheetHidesTheScreenUnderIt() {
        rule.setContent {
            PadScreen(PadActs(x = PadAct("To combat") { }, start = PadAct("Menu") { }))
            PadScreen(PadActs(b = "Close", opaque = true))
        }
        rule.waitForIdle()
        assertEquals(listOf("B" to "Close"), PadPrompts.prompts())
    }

    @Test fun holdingYTiltsAndAShortPressPeeks() {
        val did = mutableListOf<String>()
        rule.setContent { PadScreen(PadActs(y = PadAct("Inspect") { did += "inspect" }, yHold = { did += if (it) "tilt" else "rest" })) }
        rule.waitForIdle()
        press(KeyEvent.KEYCODE_BUTTON_Y)
        assertEquals(listOf("inspect"), did)
        key(KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.ACTION_DOWN)
        shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(400))
        key(KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.ACTION_UP)
        assertEquals(listOf("inspect", "tilt", "rest"), did)
    }

    @Test fun barShowsOnlyWithAController() {
        Pad.forget()
        rule.setContent { Box(Modifier.fillMaxSize()) { PadScreen(PadActs(x = PadAct("Pass") { })); PadPromptBar() } }
        rule.onNodeWithContentDescription("Controller", substring = true).assertDoesNotExist()
        Pad.used()
        rule.waitForIdle()
        rule.onNodeWithContentDescription("Controller", substring = true).assertExists()
        assertTrue(PadPrompts.prompts().contains("X" to "Pass"))
    }

    @Test fun aPhoneKeyboardMenuKeyIsLeftAlone() {
        var ran = 0
        rule.setContent { PadScreen(PadActs(start = PadAct("Menu") { ran++ })) }
        rule.waitForIdle()
        assertEquals(false, PadPrompts.key(KeyEvent(0, 0, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MENU, 0, 0, 0, 0, 0, android.view.InputDevice.SOURCE_KEYBOARD)) { })
        assertEquals(0, ran)
    }

    @Test fun aSheetOverTheFocusedCardSilencesItAndTakesTheRing() {
        val did = mutableListOf<String>()
        val ring = FocusRequester()
        var sheet by androidx.compose.runtime.mutableStateOf(false)
        val inSheet = mutableListOf<Boolean>()
        Pad.used()
        rule.setContent {
            Box(Modifier.fillMaxSize().padRoot()) {
                Box(Modifier.size(80.dp).focusRequester(ring).padActs(PadActs(a = "Open", x = PadAct("Add a copy") { did += "add" })).clickable { })
                if (sheet) {
                    PadScreen(PadActs(b = "Close", opaque = true))
                    Column(Modifier.padLayer()) {
                        Box(Modifier.size(40.dp).androidx_onFocus { inSheet += it }.clickable { })
                    }
                }
            }
        }
        rule.runOnIdle { ring.requestFocus() }
        rule.waitForIdle()
        sheet = true
        rule.waitForIdle()
        press(KeyEvent.KEYCODE_BUTTON_X)
        assertEquals(emptyList<String>(), did)
        assertTrue("the ring moved into the sheet", inSheet.contains(true))
        assertEquals("B" to "Close", PadPrompts.prompts().last())
    }

    /** The match on a handheld (dual-screen spec): LB/RB step the hand, RT passes (the gold button), LT cancels, X stays gold. */
    @Test fun matchMapStepsHandPassesAndCancels() {
        val did = mutableListOf<String>()
        rule.setContent {
            Box(Modifier.fillMaxSize().padRoot()) {
                PadScreen(PadActs(x = PadAct("Pass") { did += "gold" }, tabs = { did += "hand$it" }, tabsLabel = "Hand",
                    page = { if (it > 0) did += "pass" else did += "cancel" }, pageLabel = "Cancel / Pass"))
            }
        }
        rule.waitForIdle()
        assertEquals(listOf("X" to "Pass", "LB RB" to "Hand", "LT RT" to "Cancel / Pass"), PadPrompts.prompts().filter { it.first != "B" })
        press(KeyEvent.KEYCODE_BUTTON_R1); press(KeyEvent.KEYCODE_BUTTON_L1); press(KeyEvent.KEYCODE_BUTTON_R2); press(KeyEvent.KEYCODE_BUTTON_L2); press(KeyEvent.KEYCODE_BUTTON_X)
        assertEquals(listOf("hand1", "hand-1", "pass", "cancel", "gold"), did)
    }

    /** An outer screen's shoulders (Story's battle / act) stay while the page inside it sets only X. */
    @Test fun outerShouldersMergeWithInnerX() {
        val did = mutableListOf<String>()
        rule.setContent {
            Box(Modifier.fillMaxSize().padRoot()) {
                PadScreen(PadActs(tabs = { did += "battle$it" }, tabsLabel = "Battle", page = { did += "act$it" }, pageLabel = "Act"))
                PadScreen(PadActs(x = PadAct("Duel") { did += "duel" }))
            }
        }
        rule.waitForIdle()
        assertEquals(listOf("X" to "Duel", "LB RB" to "Battle", "LT RT" to "Act"), PadPrompts.prompts().filter { it.first != "B" })
        press(KeyEvent.KEYCODE_BUTTON_X); press(KeyEvent.KEYCODE_BUTTON_R1); press(KeyEvent.KEYCODE_BUTTON_L2)
        assertEquals(listOf("duel", "battle1", "act-1"), did)
    }
}

private fun Modifier.androidx_onFocus(f: (Boolean) -> Unit) = this.then(androidx.compose.ui.Modifier.onFocusChangedCompat(f))
private fun Modifier.Companion.onFocusChangedCompat(f: (Boolean) -> Unit) = androidx.compose.ui.Modifier.onFocusChanged { f(it.isFocused) }
