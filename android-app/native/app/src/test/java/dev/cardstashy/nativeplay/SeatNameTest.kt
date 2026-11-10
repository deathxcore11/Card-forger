package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

/** Z1 (Randall 10 Nov): no line or seat in a match names the engine ("CardStashy", "Forge AI"); it is You or CPU. */
class SeatNameTest {
    @Test fun seatsAreYouAndCpu() {
        assertEquals("You", MatchState.seatName("CardStashy"))
        assertEquals("CPU", MatchState.seatName("Forge AI"))
        assertEquals("CPU 2", MatchState.seatName("Forge AI — CPU 2"))
        assertEquals("Ramos", MatchState.seatName("Ramos"))
    }

    @Test fun linesNeverNameTheEngine() {
        assertEquals("Your commander", MatchState.tidy("CardStashy's commander"))
        assertEquals("You are going first!", MatchState.tidy("CardStashy is going first!").replace("CardStashy", "x"))
        assertEquals("the CPU's commander", MatchState.tidy("Forge AI's commander"))
    }
}
