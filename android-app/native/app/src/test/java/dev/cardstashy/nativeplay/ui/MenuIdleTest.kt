package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.createComposeRule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Gap audit G4: menus go idle 20 s after the last input, wake on the next one, never on the table; a menu loop holds its frame meanwhile. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MenuIdleTest {
    @get:Rule val rule = createComposeRule()

    @Test fun clock() {
        MenuIdle.resetForTest()
        val t0 = 1_000_000L
        assertFalse("not idle at launch", MenuIdle.tick(t0))
        assertFalse(MenuIdle.tick(t0 + 19_999))
        assertTrue(MenuIdle.tick(t0 + 20_000))
        assertTrue(MenuIdle.idle.value)
        MenuIdle.input(t0 + 25_000)
        assertFalse("input wakes the menus at once", MenuIdle.idle.value)
        assertFalse(MenuIdle.tick(t0 + 44_999))
        assertTrue(MenuIdle.tick(t0 + 45_000))
        MenuIdle.onMenu = false
        assertFalse("the table never goes idle", MenuIdle.idle.value)
        assertFalse(MenuIdle.tick(t0 + 999_000))
        MenuIdle.resetForTest()
    }

    @Test fun loopHoldsWhileIdle() {
        MenuIdle.resetForTest()
        var seen = 0f
        rule.mainClock.autoAdvance = false
        rule.setContent { val v by menuLoop(4000); seen = v }
        rule.mainClock.advanceTimeBy(1000); rule.waitForIdle()
        val moving = seen
        assertNotEquals(0f, moving)
        MenuIdle.tick(1L); MenuIdle.tick(1L + MenuIdle.AFTER_MS)
        rule.mainClock.advanceTimeBy(64); rule.waitForIdle()
        val held = seen
        rule.mainClock.advanceTimeBy(2000); rule.waitForIdle()
        assertEquals("held while idle", held, seen)
        MenuIdle.input(2L + MenuIdle.AFTER_MS)
        rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        assertTrue("goes on from the same frame", seen > held && seen < held + .2f)
        MenuIdle.resetForTest()
    }
}
