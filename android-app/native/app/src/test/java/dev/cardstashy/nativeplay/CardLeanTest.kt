package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.ui.CardLean
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A plain card stays still with the phone (feel.js; regression log: Avatar of Burgeoning Echoes FRA 122 on 0.4.78, Torrential
 * Gearhulk KLD 67 on 0.4.82, both set to Nonfoil and leaning with the phone in the app). Only its light moves, for its stamp.
 */
class CardLeanTest {
    @Test fun aPlainCardDoesNotTurnWithThePhone() = assertFalse(CardLean.leans(foil = false, pressed = false, gyro = true))
    @Test fun aFingerStillLeansAPlainCard() = assertTrue(CardLean.leans(foil = false, pressed = true, gyro = false))
    @Test fun aFoilTurnsWithThePhone() = assertTrue(CardLean.leans(foil = true, pressed = false, gyro = true))
    @Test fun nothingLeansACardAtRest() = assertFalse(CardLean.leans(foil = true, pressed = false, gyro = false))
}
