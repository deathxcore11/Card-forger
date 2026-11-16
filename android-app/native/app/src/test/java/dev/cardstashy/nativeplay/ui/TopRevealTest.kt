package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Lighter Collection home C3: the pictures at the top of Home show together, once. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class TopRevealTest {
    private var now = 1_000L
    private fun gate() = TopReveal(clock = { now })

    @Test fun withNothingExpectedItIsOpenFromTheStart() {
        val g = gate()
        assertTrue("bundled art and the picture tests: nothing waits", g.open)
        g.giveUp()
        assertTrue(g.open)
    }

    @Test fun thePicturesWaitForTheLastOneThenShowTogetherWithAFade() {
        val g = gate()
        g.expect("daily"); g.expect("lead"); g.expect("elves")
        assertFalse(g.open)
        now += 300; g.landed("lead")
        now += 300; g.landed("daily")
        assertFalse("one cover is still to come", g.open)
        now += 300; g.landed("elves")
        assertTrue(g.open)
        assertFalse("it took 0.9 s: one fade", g.instant)
        assertEquals(1_900L, g.openedAt)
    }

    @Test fun picturesAlreadyInMemoryShowWithNoFade() {
        val g = gate()
        g.expect("daily"); g.expect("lead")
        now += 32; g.landed("daily"); g.landed("lead")
        assertTrue(g.open && g.instant)
    }

    @Test fun aPictureThatNeverLandsHoldsTheOthersForFourSecondsAtMost() {
        val g = gate()
        assertEquals(4_000L, g.capMs)
        g.expect("daily"); g.expect("lead")
        now += 500; g.landed("lead")
        now += 3_500; g.giveUp()
        assertTrue(g.open)
        assertFalse(g.instant)
    }

    @Test fun aTileThatGoesAwayHoldsNothingUpAndOnceOpenItStaysOpen() {
        val g = gate()
        g.expect("daily"); g.expect("old cover")
        now += 200; g.landed("daily")
        g.dropped("old cover")
        assertTrue(g.open)
        g.expect("a new cover")
        assertTrue("a cover that changes later shows as it always did", g.open)
        g.landed("never expected")
        assertTrue(g.open)
    }
}
