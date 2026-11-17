package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Randall's 0.4.91 Fold video (16 Nov 20:49 ET): he held a card over the deck's header, the gold "Deck art" target showed, and
 * letting go did nothing. The lifted card is drawn above the finger, so a card that covers the header can have the finger
 * still on the list below it. The header now takes a drop where the card is seen, as well as where the finger is.
 * Sizes from a Fold at 2.625 px per dp: header 0..250 px tall, the card's middle 33 dp (87 px) above the finger.
 */
class DeckArtDropTest {
    private fun drag(fingerY: Float) = Drag().apply {
        name = "Plains"; from = "deck"; cardLift = 87f
        hero = Rect(0f, 0f, 1000f, 250f); deck = Rect(0f, 250f, 1000f, 2000f)
        pos = Offset(500f, fingerY)
    }
    @Test fun fingerOnHeader() = assertEquals("hero", drag(200f).zone)
    @Test fun cardOnHeaderFingerJustBelow() = assertEquals("hero", drag(300f).zone)
    @Test fun cardOnTheList() = assertEquals("deck", drag(400f).zone)
}
