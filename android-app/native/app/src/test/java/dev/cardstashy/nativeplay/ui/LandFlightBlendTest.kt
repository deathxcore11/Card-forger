package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.match.Director.Leg
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Recording 19 Nov (item 12), Meticulous Archive played at 0:25: the land flew as a tiny whole card (frame, text box and all) and
 * snapped into its tile in one frame. A land's flight from the hand into its group crops to its art as spells do (P3).
 */
class LandFlightBlendTest {
    @Test fun aLandFromTheHandBlendsIntoItsArt() {
        assertTrue("land into its group", flightCrops(Leg.TO_GROUP))
        assertTrue("a spell diving to its slot still does", flightCrops(Leg.TO_SLOT))
        assertFalse("a cast going up to the stack stays a whole card", flightCrops(Leg.TO_STACK))
        assertFalse("the pop stays a whole card", flightCrops(Leg.POP))
    }
}
