package dev.cardstashy.nativeplay.ui

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
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
    /** Frames with the clock moving, as on a device (touch velocity reads event times). */
    private fun timedFrames(ms: Long) { repeat((ms / 16).toInt()) { shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(16)); rule.runOnUiThread { PadCursor.step(1 / 60f) } } }

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

    /** The right stick scrolls the page like a console: analog speed, a glide when let go, a stop at the end, the ring kept in view. */
    @Test fun rightStickScrollsGlidesAndBringsTheRing() {
        val scroll = androidx.compose.foundation.ScrollState(0)
        val focused = mutableListOf<Int>()
        rule.setContent {
            androidx.compose.foundation.layout.Column(Modifier.fillMaxSize().androidx_verticalScroll(scroll)) {
                repeat(30) { i -> Box(Modifier.size(200.dp, 100.dp).onFocusChanged { if (it.isFocused) focused += i }.clickable { }) }
            }
        }
        rule.waitForIdle()
        PadCursor.manual = true
        rule.runOnUiThread { PadCursor.attach(rule.activity.window.decorView) }
        PadCursor.pos = null; PadCursor.shown = false
        // A light push creeps; a full push races.
        PadCursor.right(0f, .4f); timedFrames(300)
        val slow = scroll.value
        assertTrue("light push scrolled a little: $slow", slow in 1..600)
        PadCursor.right(0f, 1f); timedFrames(300)
        val fast = scroll.value - slow
        assertTrue("full push scrolls faster: $fast vs $slow", fast > slow * 3)
        // Let go: it eases to a stop within a few frames (no fling), then stays put.
        val atRelease = scroll.value
        PadCursor.right(0f, 0f); timedFrames(800)
        rule.mainClock.advanceTimeBy(1500); rule.waitForIdle()
        val rest = scroll.value
        assertTrue("eased to a stop, no fling: $atRelease -> $rest", rest >= atRelease && rest - atRelease < 400)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1000)); rule.waitForIdle()
        assertEquals("came to rest", rest, scroll.value)
        assertTrue("ring came into view: $focused", focused.isNotEmpty() && focused.last() > 0)
        // Push back up past the top: it stops at 0.
        PadCursor.right(0f, -1f); timedFrames(3000); PadCursor.right(0f, 0f); timedFrames(800)
        rule.mainClock.advanceTimeBy(1500); rule.waitForIdle()
        assertEquals(0, scroll.value)
    }
}

private fun Modifier.androidx_verticalScroll(s: androidx.compose.foundation.ScrollState) = this.verticalScroll(s)

private fun Modifier.androidx_semClick(f: () -> Unit) = semantics { onClick { f(); true } }
