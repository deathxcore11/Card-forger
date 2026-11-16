package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.match.Director
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Match punch P3, the landing: its timings and the spring a squashed tile and its neighbours ride back on. */
class PunchLandTest {
    @Test fun theDiveIsARiseOf90AndADiveOf240() {
        assertEquals(90L, Director.RISE_MS); assertEquals(400L, Director.TO_SLOT_MS) // mobile table M6: the drop is 400
        assertEquals("neighbours spring for 620 ms", 620L, IMPACT_MS)
    }

    @Test fun theSpringStartsSquashedOvershootsAndSettles() {
        assertEquals(0f, elasticOut(0f)); assertEquals(1f, elasticOut(1f))
        val peak = (1..99).maxOf { elasticOut(it / 100f) }
        assertTrue("it overshoots: $peak", peak > 1.1f && peak < 1.5f)
        assertTrue("and has settled by the end", kotlin.math.abs(elasticOut(.95f) - 1f) < .01f)
        // The lift's small overshoot (P2) ends exactly on its place.
        assertEquals(0f, backOut(0f), 1e-4f); assertEquals(1f, backOut(1f), 1e-4f)
        assertTrue((1..99).maxOf { backOut(it / 100f) } in 1.05f..1.2f)
    }
}
