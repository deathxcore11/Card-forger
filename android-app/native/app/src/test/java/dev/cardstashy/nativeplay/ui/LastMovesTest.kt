package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** "Last moves" takes only the room the left strip has free: how many rows, and whether the header stays. */
class LastMovesTest {
    /** Heights in px. A Fold's strip takes the header and all three; a short strip the newest ones; no room, nothing. */
    @Test fun lastMovesTakesOnlyTheRoomTheStripHas() {
        val rows = listOf(50, 38, 50)
        assertEquals(3 to true, lastMovesPlan(header = 13, rows = rows, gap = 4, room = 400))
        assertEquals(3 to true, lastMovesPlan(13, rows, 4, 13 + 4 + 50 + 4 + 38 + 4 + 50))
        // One px short of all three with the header: the header gives way to the third row.
        assertEquals(3 to false, lastMovesPlan(13, rows, 4, 13 + 4 + 50 + 4 + 38 + 4 + 50 - 1))
        // A phone: the newest two and no header (with it only one would fit).
        assertEquals(2 to false, lastMovesPlan(13, rows, 4, 100))
        assertEquals(1 to true, lastMovesPlan(13, rows, 4, 70))
        assertEquals(1 to false, lastMovesPlan(13, rows, 4, 55))
        assertEquals(0, lastMovesPlan(13, rows, 4, 40).first)
        // The newest are the ones kept.
        assertEquals(2, lastMovesFit(0, listOf(500, 38, 50), 4, 100))
        assertEquals(0, lastMovesFit(0, listOf(38, 50, 500), 4, 100))
    }
}
