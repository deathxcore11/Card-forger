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

    /** A refresh ten caps long: a paint at each cap, never sooner, then the last one. */
    @Test fun aSlowRefreshPaintsAtEachCapThenAtTheEnd() {
        val p = run(capMs = 100, refreshMs = 450)
        assertEquals(true, p.last())
        assertTrue("about one paint per cap: $p", p.count { !it } in 3..4)
    }

    @Test fun aRefreshThatFailsPaintsNothingAfter() {
        assertEquals(emptyList<Boolean>(), run(capMs = 2_000, refreshMs = 20, fail = true))
        assertTrue(run(capMs = 100, refreshMs = 150, fail = true) == listOf(false))
    }

    @Test fun theCapIsFourSeconds() = assertTrue(CALM_CAP_MS == 4_000L)
}
