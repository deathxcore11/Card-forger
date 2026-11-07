package dev.cardstashy.nativeplay.ui

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.onClick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

/** The stick cursor (Randall 7 Nov "Love it"): the left stick carries the ring onto what it is over; A presses a gesture-only target there. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w800dp-h450dp-xhdpi")
class PadCursorTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()

    private fun frames(ms: Long) { repeat((ms / 16).toInt()) { rule.runOnUiThread { PadCursor.step(1 / 60f) } } }

    @Test fun stickCarriesTheRingAndAPressesGestureTargets() {
        val focused = mutableListOf<String>()
        var tapped = 0
        rule.setContent {
            Box(Modifier.fillMaxSize()) {
                Row {
                    Box(Modifier.size(120.dp).onFocusChanged { if (it.isFocused) focused += "left" }.clickable { })
                    Box(Modifier.size(200.dp))
                    Box(Modifier.size(120.dp).onFocusChanged { if (it.isFocused) focused += "right" }.clickable { })
                }
                // Only a click, no focus stop (as a gesture target's semantics might be).
                Box(Modifier.size(120.dp).align(androidx.compose.ui.Alignment.BottomEnd).androidx_semClick { tapped++ })
            }
        }
        rule.waitForIdle()
        PadCursor.manual = true
        rule.runOnUiThread { PadCursor.attach(rule.activity.window.decorView) }
        PadCursor.pos = null; PadCursor.shown = false
        PadCursor.left(-1f, -.49f); frames(250)
        PadCursor.left(0f, 0f); frames(32)
        rule.waitForIdle()
        assertTrue("ring followed the cursor: $focused", focused.isNotEmpty())
        // Down to the bottom-right target and press A.
        val d = rule.activity.resources.displayMetrics.density
        PadCursor.pos = androidx.compose.ui.geometry.Offset(740 * d, 390 * d)
        PadCursor.left(.2f, 0f); frames(64); PadCursor.left(0f, 0f)
        var pressed = false
        rule.runOnUiThread { pressed = PadCursor.pressA() }
        assertTrue(pressed)
        assertEquals(1, tapped)
        PadCursor.dpad()
        assertEquals(false, PadCursor.shown)
    }
}

private fun Modifier.androidx_semClick(f: () -> Unit) = semantics { onClick { f(); true } }
