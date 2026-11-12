package dev.cardstashy.nativeplay.ui

import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Lighter Collection home C2: Home is painted once when its refresh is done, with at most one paint before that. */
class CalmUpdateTest {
    private fun run(capMs: Long, refreshMs: Long, fail: Boolean = false): List<Boolean> {
        val paints = mutableListOf<Boolean>()
        runBlocking {
            try { calmUpdate(capMs, refresh = { delay(refreshMs); if (fail) error("offline") }, paint = { paints += it }) } catch (e: IllegalStateException) { }
        }
        return paints
    }

    @Test fun aQuickRefreshPaintsOnce() = assertEquals(listOf(true), run(capMs = 2_000, refreshMs = 20))

    /** Ten caps long: the 1.2 s loop would have painted about ten times here. */
    @Test fun aSlowRefreshPaintsOnceAtTheCapThenOnceAtTheEnd() = assertEquals(listOf(false, true), run(capMs = 40, refreshMs = 400))

    @Test fun aRefreshThatFailsPaintsNothingAfter() {
        assertEquals(emptyList<Boolean>(), run(capMs = 2_000, refreshMs = 20, fail = true))
        assertEquals(listOf(false), run(capMs = 40, refreshMs = 200, fail = true))
    }

    @Test fun theCapIsFourSeconds() = assertTrue(CALM_CAP_MS == 4_000L)
}
