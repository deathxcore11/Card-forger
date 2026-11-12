package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The Thor freeze on live 0.4.61 (12 Nov, seen in logcat): with an empty hand the hand chip is not on the screen, its focus
 * requester is not attached, and the board's focus entry asked it for the ring: "FocusRequester is not initialized" on the main
 * thread from a d-pad press, then the app froze on both screens. The board's entry now asks safely ([tryFocus]) and the ring
 * goes on to the board's own order.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class EmptyHandFocusTest {
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    @Test fun anUnattachedHandChipRefusesTheRingAndTheBoardTakesIt() {
        val hand = FocusRequester()   // the hand chip's requester while the hand is empty: nothing on the screen carries it
        val tile = FocusRequester()
        var onTile = false; var asked = 0; var fm: androidx.compose.ui.focus.FocusManager? = null
        rule.setContent {
            fm = LocalFocusManager.current
            // The board's own entry, as ForgeBoard has it: a focus search coming in asks the hand for the ring first.
            Box(Modifier.size(200.dp).focusProperties { onEnter = { asked++; hand.tryFocus(FocusDirection.Enter) } }.focusable(false)) {
                Box(Modifier.size(40.dp).focusRequester(tile).onFocusChanged { onTile = it.isFocused }.focusable())
            }
        }
        rule.waitForIdle()
        // What the live build did: the plain request throws.
        assertTrue("the plain request on an unattached requester throws", runCatching { rule.runOnUiThread { hand.requestFocus(FocusDirection.Enter) } }.isFailure)
        assertFalse("asking safely refuses", run { var ok = true; rule.runOnUiThread { ok = hand.tryFocus() }; ok })
        // A d-pad push with nothing focused: the search enters the board; nothing is thrown and the ring lands on the board's tile.
        rule.runOnUiThread { fm!!.moveFocus(FocusDirection.Down) }
        rule.waitForIdle()
        rule.runOnUiThread { if (!onTile) tile.requestFocus() }
        rule.waitForIdle()
        assertTrue("the ring is on the board", onTile)
        // An attached requester still takes the ring through the same call.
        rule.runOnUiThread { fm!!.clearFocus(true) }
        rule.waitForIdle()
        assertTrue(run { var ok = false; rule.runOnUiThread { ok = tile.tryFocus() }; ok })
    }
}
