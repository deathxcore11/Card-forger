package dev.cardstashy.nativeplay.match

import kotlinx.coroutines.Job
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** Loading screens L2 (specs/loading-screens-brief.md): pressing Play no longer cancels the two match decks' downloads. */
class LobbyWarmKeptTest {
    /** L6: your decks are warmed on any connection when they are 260 rows or fewer; a bigger one waits for Wi-Fi. */
    @Test fun ownedDecksWarmOnAnyConnectionWhenSmall() {
        assertTrue(QuickPlay.warmsOwned(60, unmetered = false)); assertTrue(QuickPlay.warmsOwned(260, unmetered = false))
        assertFalse(QuickPlay.warmsOwned(261, unmetered = false)); assertTrue(QuickPlay.warmsOwned(261, unmetered = true))
        assertFalse("an empty deck asks for nothing", QuickPlay.warmsOwned(0, unmetered = true))
    }

    @Test fun playStopsTheOtherDecksAndKeepsTheTwoSeats() {
        val general = Job(); val you = Job(); val cpu = Job()
        QuickPlay.holdForTest(general, you, cpu)
        try {
            QuickPlay.pauseBackground()
            assertTrue("the warm-up of your other decks stops", general.isCancelled)
            assertFalse("your deck keeps downloading", you.isCancelled)
            assertFalse("the CPU's deck keeps downloading", cpu.isCancelled)
            assertSame(you, QuickPlay.seatJobs()[0]); assertSame(cpu, QuickPlay.seatJobs()[1])
        } finally { you.cancel(); cpu.cancel(); QuickPlay.holdForTest(null, null, null) }
    }
}
