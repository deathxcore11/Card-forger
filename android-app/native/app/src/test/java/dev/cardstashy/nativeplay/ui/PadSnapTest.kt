package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** 0.4.59 T6 (input): the left stick snaps the ring to the nearest legal answer the way it is pushed, never a free cursor. */
class PadSnapTest {
    private fun at(x: Float, y: Float) = Rect(x - 10, y - 10, x + 10, y + 10)
    // The ring is on a card at (500, 300). Around it: a card right, one up-right, one left, a seat below.
    private val stops = listOf("right" to at(700f, 310f), "upRight" to at(700f, 100f), "left" to at(250f, 300f), "seat" to at(520f, 600f))
    private val from = Offset(500f, 300f)

    @Test fun eachPushGoesToWhatLiesThatWay() {
        assertEquals("right", TableZones.nearest(from, Offset(1f, 0f), stops))
        assertEquals("left", TableZones.nearest(from, Offset(-1f, 0f), stops))
        assertEquals("seat", TableZones.nearest(from, Offset(0f, 1f), stops))
        assertEquals("upRight", TableZones.nearest(from, Offset(.7f, -.7f), stops))
    }

    @Test fun nothingThatWayMovesNothing() {
        assertNull(TableZones.nearest(from, Offset(0f, -1f), listOf("left" to at(250f, 300f))))
        assertNull(TableZones.nearest(from, Offset(0f, 0f), stops))
    }

    @Test fun aPushSnapsOnceThenRepeatsWhileHeldAndAgainOnANewPush() {
        val got = mutableListOf<Offset>()
        val s: (Offset) -> Boolean = { got += it; true }
        PadCursor.snapStick(0f, 0f, s, now = 0)
        PadCursor.snapStick(.3f, 0f, s, now = 10)      // a nudge: nothing
        PadCursor.snapStick(.9f, 0f, s, now = 20)      // a push: one snap
        PadCursor.snapStick(.9f, 0f, s, now = 100)     // still held, too soon
        PadCursor.snapStick(.9f, 0f, s, now = 20 + PadCursor.SNAP_REPEAT_MS) // held: repeats
        PadCursor.snapStick(0f, 0f, s, now = 300)      // let go
        PadCursor.snapStick(0f, .9f, s, now = 310)     // a new push snaps at once
        assertEquals(listOf(Offset(.9f, 0f), Offset(.9f, 0f), Offset(0f, .9f)), got)
    }
}
