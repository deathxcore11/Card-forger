package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The player's hand patch, Thor (Randall 21 Nov: "the bottom screen keeps on scaling" with the hand size and the card text).
 * Approved mock-up https://claude.ai/artifact/8KfkdBkKNxx7JnhJ7L5f2C. Band sizes from that mock-up: 566 wide, hand band 194 high.
 */
class ThorHandBandTest {
    @Test fun theHandsCardsKeepOneSizeFromThreeToFourteenCards() {
        // Before: width / (1 + (n-1) * .46) and a sag of 2*mid^2 dp, so 3, 9 and 14 cards gave three sizes.
        val sizes = listOf(3, 9, 14).map { bottomCardW(194.dp, 566.dp, it) }
        assertEquals(1, sizes.distinct().size)
    }

    @Test fun theReadingPanelIsOneFixedShareWhateverItReads() {
        assertEquals(.56f, BOTTOM_PANEL_SHARE)
        assertEquals(44.dp, BOTTOM_RAIL)
    }

    @Test fun aLongQuestionStepsDownToStayOnOneLine() {
        assertEquals(16f, railQuestionSp("Choose target creature"))
        assertEquals(14f, railQuestionSp("Choose a creature to return to hand"))
        assertEquals(12.5f, railQuestionSp("Choose up to two target creatures you control"))
    }
}
