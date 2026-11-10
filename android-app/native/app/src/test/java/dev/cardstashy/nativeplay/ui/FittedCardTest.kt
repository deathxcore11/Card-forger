package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** WHOLE CARD, NEVER CUT: the fitted card always lies inside its box, margin included, at the card's own ratio. */
class FittedCardTest {
    private fun check(box: DpSize, label: String) {
        val m = 12.dp
        val s = fitCard(box, m)
        assertTrue("$label: width ${s.width} over ${box.width - m * 2}", s.width.value <= (box.width - m * 2).value + .01f)
        assertTrue("$label: height ${s.height} over ${box.height - m * 2}", s.height.value <= (box.height - m * 2).value + .01f)
        assertEquals("$label: ratio", CARD_RATIO, s.width.value / s.height.value, .001f)
        // It fills one side: never smaller than it has to be.
        assertTrue("$label: not fitted", s.width.value >= (box.width - m * 2).value - .5f || s.height.value >= (box.height - m * 2).value - .5f)
    }

    @Test fun thorSizes() {
        // Thor top 1920 × 1080 and bottom 1240 × 1080 px at 2× (960 × 540 dp, 620 × 540 dp); the bottom loses its hint bar.
        val bar = 48.dp
        check(DpSize(960.dp, 540.dp), "top, whole screen")
        check(DpSize(620.dp, 540.dp - bar), "bottom above the hint bar")
        check(DpSize(620.dp * .45f, 540.dp - bar), "bottom case, card column")
        check(DpSize(620.dp * .62f, 540.dp - bar), "bottom case, wide card column")
        // Phones, portrait and landscape, and a tiny box.
        check(DpSize(360.dp, 640.dp), "phone portrait")
        check(DpSize(800.dp, 360.dp), "phone landscape")
        check(DpSize(40.dp, 30.dp), "tiny")
    }

    @Test fun nothingNegative() {
        val s = fitCard(DpSize(10.dp, 10.dp), 12.dp)
        assertTrue(s.width.value >= 0f && s.height.value >= 0f)
    }
}
