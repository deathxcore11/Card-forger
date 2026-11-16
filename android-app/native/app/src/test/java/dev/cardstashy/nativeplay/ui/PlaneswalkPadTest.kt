package dev.cardstashy.nativeplay.ui

import android.net.Uri
import android.os.SystemClock
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import androidx.compose.ui.geometry.Offset
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Gap audit G6 step 4: Planeswalk with a controller. The left stick moves the app's cursor over the page and A taps there; B sends
 * Escape (the page's pause menu), B again with the menu up leaves to Play, and the page's own Exit ("/#play") lands on the app's Play.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PlaneswalkPadTest {
    @After fun clean() { PadCursor.freeTap = false; PadCursor.shown = false; PadCursor.pos = null }

    private class Seen(ctx: android.content.Context) : View(ctx) {
        val touches = mutableListOf<Triple<Int, Float, Float>>(); val keys = mutableListOf<Pair<Int, Int>>()
        override fun dispatchTouchEvent(e: MotionEvent): Boolean { touches += Triple(e.actionMasked, e.x, e.y); return true }
        override fun dispatchKeyEvent(e: KeyEvent): Boolean { keys += e.action to e.keyCode; return true }
    }

    @Test fun aTapsWhereTheCursorIs() {
        val v = Seen(RuntimeEnvironment.getApplication()); PadCursor.attach(v)
        PadCursor.pos = Offset(120f, 340f); PadCursor.shown = true; PadCursor.lastMove = SystemClock.uptimeMillis()
        PadCursor.freeTap = false
        assertFalse("off the page, A with nothing under the cursor is the ring's", PadCursor.pressA())
        assertTrue(v.touches.isEmpty())
        PadCursor.freeTap = true
        assertTrue(PadCursor.pressA())
        assertEquals(listOf(Triple(MotionEvent.ACTION_DOWN, 120f, 340f), Triple(MotionEvent.ACTION_UP, 120f, 340f)), v.touches)
        // The cursor faded: A goes back to the ring.
        PadCursor.shown = false; v.touches.clear()
        assertFalse(PadCursor.pressA()); assertTrue(v.touches.isEmpty())
    }

    @Test fun bPausesThenLeaves() {
        val v = Seen(RuntimeEnvironment.getApplication()); var left = 0
        PlaneswalkPack.back("\"shut\"", { PlaneswalkPack.escape(v) }, { left++ })
        assertEquals(listOf(KeyEvent.ACTION_DOWN to KeyEvent.KEYCODE_ESCAPE, KeyEvent.ACTION_UP to KeyEvent.KEYCODE_ESCAPE), v.keys)
        assertEquals(0, left)
        PlaneswalkPack.back("\"open\"", { PlaneswalkPack.escape(v) }, { left++ })
        assertEquals(1, left); assertEquals(2, v.keys.size)
        // No answer from the page (still loading): pause, never leave by surprise.
        PlaneswalkPack.back(null, { PlaneswalkPack.escape(v) }, { left++ })
        assertEquals(1, left)
    }

    @Test fun pageExitIsTheAppsPlay() {
        assertTrue(PlaneswalkPack.leaves(Uri.parse("https://cardstashy.com/#play")))
        assertFalse(PlaneswalkPack.leaves(Uri.parse("https://cardstashy.com/#collection")))
        assertFalse(PlaneswalkPack.leaves(Uri.parse("https://cardstashy.com/planeswalk.html#play")))
        // The menu the B check reads is the page's own .pw-menu.
        val page = java.io.File(System.getProperty("repoRoot"), "planeswalk.html")
        if (page.isFile) assertTrue(page.readText().contains("pw-menu"))
    }
}
