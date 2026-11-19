package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Recording 19 Nov (item 7): on the Keep screen card 4 landed before card 3. Each dealt card waits 70 ms more than the one before;
 * the old wait was skipped whole when the card's target moved before it started. Cards 3 and 4 (140 and 210 ms) when card 4's
 * target moves at 100 ms: card 4 still waits until 210 ms, after card 3.
 */
class DealOrderTest {
    @Test fun aCardWhoseTargetMovesStillWaitsItsTurn() {
        val dealt = 0L; val card3 = dealt + 2 * 70; val card4 = dealt + 3 * 70
        val card4StartsAt = 100 + dealWait(card4, 100)
        assertEquals(210L, card4StartsAt)
        assertTrue("card 4 lands after card 3", card4StartsAt > card3)
        assertEquals("past its start: no wait", 0L, dealWait(card4, 400))
    }
}
