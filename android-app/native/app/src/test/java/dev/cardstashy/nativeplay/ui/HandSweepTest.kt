package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The player's hand patch (Randall's 21 Nov recording, 0.4.102): sliding a finger along the hand grabbed a card and dragged it
 * instead of scrubbing, and a drifting thumb carried a card up. Slop here is 24 px (8 dp at 3x).
 */
class HandSweepTest {
    private val slop = 24f

    @Test fun aSidewaysSlideScrubsTheHandInsteadOfPickingUpACard() {
        // 40 px across, a little up, finger moving from the first touch: the exact slide that used to reorder the hand.
        assertEquals(HandMove.SWEEP, handMove(40f, -5f, slop, grabbed = false, swept = false, canReorder = true))
    }

    @Test fun aCardIsReorderedOnlyAfterTheFingerRestedOnIt() {
        assertEquals(HandMove.REORDER, handMove(40f, -5f, slop, grabbed = true, swept = false, canReorder = true))
        assertEquals(HandMove.SWEEP, handMove(40f, -5f, slop, grabbed = true, swept = false, canReorder = false))
    }

    @Test fun aThumbDriftingUpDuringASlideDoesNotCarryTheCard() {
        // Mid-slide, 10 px across and 40 px up: the old rule (more than 1.5 slops, 1.2x across) carried it. 40 < 3.5 slops (84).
        assertEquals(HandMove.SWEEP, handMove(10f, -40f, slop, grabbed = false, swept = true, canReorder = true))
    }

    @Test fun aClearUpwardMoveStillCarriesTheCardToPlayIt() {
        assertEquals(HandMove.CARRY, handMove(10f, -100f, slop, grabbed = false, swept = true, canReorder = true))
        assertEquals(HandMove.CARRY, handMove(5f, -45f, slop, grabbed = false, swept = false, canReorder = true))
    }

    @Test fun aCastableCardTheSlideEndedOnGoesBackDown() {
        // Randall's 21 Nov 7:19 PM recording (0.4.103), 0:32-0:38: thumbing over Unsummon (castable) left it lifted with Cast lit.
        assertEquals(null, sweepEndLift(discardAsk = false, lifted = 42))
        assertEquals(null, sweepEndLift(discardAsk = false, lifted = null))
        // A discard's picked card stays picked.
        assertEquals(42, sweepEndLift(discardAsk = true, lifted = 42))
    }
}
