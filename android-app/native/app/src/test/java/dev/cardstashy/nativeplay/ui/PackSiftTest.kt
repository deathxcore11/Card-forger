package dev.cardstashy.nativeplay.ui

import android.view.KeyEvent
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Sifting a pack with a controller (Randall 9 Nov: "use my D-pad or whatever to go left and right of the cards… or use my finger"):
 * LB/RB step through the cards, LT/RT jump to the next face-down one, the right stick sideways steps, and the d-pad on the card steps.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class PackSiftTest {
    @get:Rule val rule = createComposeRule()

    private fun key(code: Int) = listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP).forEach {
        PadPrompts.key(KeyEvent(0, 0, it, code, 0, 0, 0, 0, 0, android.view.InputDevice.SOURCE_GAMEPAD)) { }
    }
    private fun on(card: Int) = rule.onAllNodesWithContentDescription("Card $card, face down", substring = true).fetchSemanticsNodes().isNotEmpty()

    @OptIn(ExperimentalTestApi::class)
    @Test fun shouldersTriggersStickAndDpadSiftTheCards() {
        Motion.still = true
        dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication())
        Pad.used()
        try {
            val pulls = (1..5).map { Pull("id$it", "Card $it", "common", "", "", false) }
            val pack = PackResult("all", "Alliances", pulls, "", "")
            rule.setContent { PackOpening(pack, onNext = null, onClose = {}, initial = PackStage.DEALT, revealedAtStart = setOf(1, 2), focusAtStart = 0) }
            rule.waitForIdle()
            assertTrue(on(1))
            // RT: the next face-down card skips the two already turned.
            rule.runOnIdle { key(KeyEvent.KEYCODE_BUTTON_R2) }; rule.waitForIdle()
            assertTrue("RT jumps to card 4", on(4))
            // LB: one back (card 3, face up).
            rule.runOnIdle { key(KeyEvent.KEYCODE_BUTTON_L1) }; rule.waitForIdle()
            val descs = rule.onAllNodes(androidx.compose.ui.test.SemanticsMatcher.keyIsDefined(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription)).fetchSemanticsNodes().flatMap { it.config[androidx.compose.ui.semantics.SemanticsProperties.ContentDescription] }
            assertTrue("LB steps back: $descs", descs.any { it.startsWith("Card 3. ") })
            // RB twice: card 5.
            rule.runOnIdle { key(KeyEvent.KEYCODE_BUTTON_R1); key(KeyEvent.KEYCODE_BUTTON_R1) }; rule.waitForIdle()
            assertTrue("RB steps forward", on(5))
            // The right stick sideways steps too.
            rule.runOnIdle { PadCursor.sideStep?.invoke(-1) }; rule.waitForIdle()
            assertTrue("stick steps", on(4))
            // The d-pad on the big card.
            rule.onNodeWithContentDescription("Card 4, face down", substring = true).performKeyInput { pressKey(Key.DirectionRight) }
            rule.waitForIdle()
            assertTrue("d-pad steps", on(5))
        } finally { Pad.forget() }
    }
}
