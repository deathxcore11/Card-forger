package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression, Randall's recording of 19 Nov (0.4.98, Quick Play on the Fold): the CPU's sideways (tapped) creatures covered their
 * neighbours' names ("Abandone… Air Temple", "Bejewele… Warg"). A tapped tile is turned 20° about its middle; the row now stands
 * its neighbours apart by what the turn takes, so each pile shows as much of itself as an upright row would.
 */
class TappedRoomTest {
    private val sin = .342f; private val cos = .9397f
    private val w = 60f; private val h = 70f

    /** How much of pile i's top tile shows left of pile i+1 along the top, where its name is, the 20° turns counted. */
    private fun shows(lay: TableGeometry.RowLay, tapped: List<Boolean>, i: Int): Float {
        // Turned, a tile's top-left corner swings right by w/2(1-cos) + h/2 sin.
        fun t(j: Int) = if (tapped[j]) w / 2 * (1 - cos) + h / 2 * sin else 0f
        return lay.xs[i + 1] + t(i + 1) - (lay.xs[i] + t(i))
    }

    // The recording's CPU row: eight creatures, all but the second and the last tapped.
    private val tappedRow = listOf(true, false, true, true, true, true, true, false)

    @Test fun theCpusRowNarrowsItsTilesSoTappedNamesShow() {
        val room = 520f; val h = 70f
        val turns = tappedRow.zipWithNext().count { (a, b) -> a && !b }
        val narrow = TableGeometry.width(h, listOf(List(8) { 1 } to room), 4f, turns = listOf(turns))
        val full = TableGeometry.width(h, listOf(List(8) { 1 } to room), 4f)
        assertTrue("the tiles narrow for the turned corners: $narrow < $full", narrow < full)
        val lay = TableGeometry.layRow(narrow, h, room, List(8) { 1 }, false, gap = 4f, tapped = tappedRow)
        assertTrue("the row stays in its room: ${lay.total}", lay.total <= room + .01f)
        val top = narrow * (1 - cos) / 2 + h * sin / 2
        fun t(j: Int) = if (tappedRow[j]) top else 0f
        for (i in 0 until 7) assertTrue("pile $i", lay.xs[i + 1] + t(i + 1) - (lay.xs[i] + t(i)) >= narrow + 4f - .01f)
        // On the old layout (full width, nothing apart) a tapped tile's name ran under the next pile.
        val old = TableGeometry.layRow(full, h, room, List(8) { 1 }, false, gap = 4f)
        val oldTop = full * (1 - cos) / 2 + h * sin / 2
        assertTrue(old.xs[1] - (old.xs[0] + oldTop) < full + 4f - 1f)
    }

    @Test fun aRowAtItsNarrowestStaysAsItWas() {
        // No room to spare: lending it from the other piles would only cut their names (tried, 19 Nov).
        val upright = TableGeometry.layRow(w, h, 420f, List(8) { 1 }, false, gap = 4f)
        assertTrue(upright == TableGeometry.layRow(w, h, 420f, List(8) { 1 }, false, gap = 4f, tapped = tappedRow))
    }

    @Test fun aRoomyRowOpensItsGapsAndTilesNeverTouch() {
        val tapped = listOf(false, true, false)
        val lay = TableGeometry.layRow(w, h, 400f, List(3) { 1 }, false, gap = 4f, tapped = tapped)
        assertTrue(lay.total <= 400f)
        for (i in 0 until 2) assertTrue("pair $i: ${shows(lay, tapped, i)}", shows(lay, tapped, i) >= w + 4f - .01f)
    }

    @Test fun noTappedTilesLeavesTheRowAsItWas() {
        val a = TableGeometry.layRow(w, h, 300f, List(8) { 1 }, false, gap = 4f)
        val b = TableGeometry.layRow(w, h, 300f, List(8) { 1 }, false, gap = 4f, tapped = List(8) { false })
        assertTrue(a == b)
    }
}
