package dev.cardstashy.nativeplay.match

import kotlinx.coroutines.Job
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** Loading screens L2 (specs/loading-screens-brief.md): pressing Play no longer cancels the two match decks' downloads. */
class LobbyWarmKeptTest {
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
