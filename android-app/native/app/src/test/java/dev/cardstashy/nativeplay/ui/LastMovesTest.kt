package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** "Last moves" takes only the room the left strip has free: how many rows, and whether the header stays. */
class LastMovesTest {
    /** Heights in px. A Fold's strip takes the header and all three; a short strip the newest ones; no room, nothing. */
    @Test fun lastMovesTakesOnlyTheRoomTheStripHas() {
        val rows = listOf(50, 38, 50)
        assertEquals(3, lastMovesFit(header = 13, rows = rows, gap = 4, room = 400))
        assertEquals(3, lastMovesFit(13, rows, 4, 13 + 4 + 50 + 4 + 38 + 4 + 50))
        assertEquals(2, lastMovesFit(13, rows, 4, 13 + 4 + 50 + 4 + 38 + 4 + 50 - 1))
        // A phone's strip draws no header (the strip's own choice, by its room): the newest two fit where one would with it.
        assertEquals(1, lastMovesFit(13, rows, 4, 100)); assertEquals(2, lastMovesFit(0, rows, 4, 100))
        assertEquals(0, lastMovesFit(0, rows, 4, 40))
        // The newest are the ones kept.
        assertEquals(2, lastMovesFit(0, listOf(500, 38, 50), 4, 100))
        assertEquals(0, lastMovesFit(0, listOf(38, 50, 500), 4, 100))
        // A phone's free room (about 95 dp) is under the header's line; a Thor's (about 180 dp) and a Fold's are over it.
        assertEquals(150, LAST_MOVES_HEADER_ROOM)
    }
}
