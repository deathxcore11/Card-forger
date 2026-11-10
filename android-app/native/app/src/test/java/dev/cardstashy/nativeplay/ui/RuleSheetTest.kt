package dev.cardstashy.nativeplay.ui

import android.os.Looper
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** Rulebook R4: the one sheet is in the app's own tree, B cancels and X is the action. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w800dp-h450dp-xhdpi")
class RuleSheetTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()

    private fun press(code: Int) { for (a in listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP))
        PadPrompts.key(KeyEvent(0, 0, a, code, 0, 0, 0, 0, 0, android.view.InputDevice.SOURCE_GAMEPAD)) { } }

    @Test fun confirmSaysItsButtonsAndXRunsTheAction() {
        val did = mutableListOf<String>(); var open by mutableStateOf(true)
        rule.setContent { Box(Modifier.fillMaxSize().padRoot()) { if (open) RuleConfirm("", "Delete", title = "Delete this Play deck?", onAction = { did += "ok"; open = false }, onCancel = { did += "cancel"; open = false }, danger = true); RuleSheetHost() } }
        rule.waitForIdle()
        rule.onNodeWithText("Delete this Play deck?").assertExists()
        assertTrue(("B" to "Cancel") in PadPrompts.prompts()); assertTrue(("X" to "Delete") in PadPrompts.prompts())
        press(KeyEvent.KEYCODE_BUTTON_X); rule.waitForIdle()
        assertEquals(listOf("ok"), did)
        rule.onNodeWithText("Delete this Play deck?").assertDoesNotExist()
    }

    @Test fun bCancels() {
        val did = mutableListOf<String>(); var open by mutableStateOf(true)
        rule.setContent { Box(Modifier.fillMaxSize().padRoot()) { if (open) RuleConfirm("", "Sign out", title = "Sign out?", onAction = { did += "ok"; open = false }, onCancel = { did += "cancel"; open = false }); RuleSheetHost() } }
        rule.waitForIdle()
        // B is always the system back (PadActs.b only names it).
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }; shadowOf(Looper.getMainLooper()).idle(); rule.waitForIdle()
        assertEquals(listOf("cancel"), did)
        rule.onNodeWithText("Sign out?").assertDoesNotExist()
    }

    @Test fun menuRowClosesThenRuns() {
        val did = mutableListOf<String>(); var open by mutableStateOf(true)
        rule.setContent { Box(Modifier.fillMaxSize().padRoot()) { if (open) RuleMenu("Deck", listOf(RuleRow("Rename") { did += "rename" }, RuleRow("Delete", danger = true) { did += "delete" })) { did += "close"; open = false }; RuleSheetHost() } }
        rule.waitForIdle()
        rule.onNodeWithText("Rename").performClick(); rule.waitForIdle()
        assertEquals(listOf("close", "rename"), did)
    }
}
