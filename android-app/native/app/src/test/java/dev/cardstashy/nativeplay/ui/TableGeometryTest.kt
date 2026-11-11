package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 0.4.59 T1 (specs/table-look-0459.md): the battlefield tiles sized from the screen, the same size on both sides. */
class TableGeometryTest {
    private val sizes = listOf(844f to 390f, 904f to 386f, 884f to 796f, 1280f to 800f, 1920f to 1080f)
    private fun rows(h: Float, dual: Boolean = false) = TableGeometry.rows(dual, h * .2f, h * .8f)
    private fun tiles(w: Float, h: Float, cf: List<Int>, mf: List<Int>, cb: List<Int>, mb: List<Int>, dual: Boolean = false, lane: Float = 0f) =
        TableGeometry.tiles(rows(h, dual), w * TableGeometry.BOARD_W - lane, w * (TableGeometry.BOARD_W - TableGeometry.BACK_INSET) - lane, cf, mf, cb, mb)

    @Test fun rowsKeepTheBriefsProportionsInTheFreeHeight() {
        for (dual in listOf(false, true)) {
            val r = TableGeometry.rows(dual, 100f, 400f)
            assertEquals(100f, r.cpuBack.top, .01f); assertEquals(400f, r.myBack.bottom, .01f)
            val s = TableGeometry.shares(dual)
            // Creature row to land row as in the brief: 20 % to 11 % on one screen, 23.5 % to 13 % on the dual top screen.
            assertEquals(s.cpuFront.height / s.cpuBack.height, r.cpuFront.height / r.cpuBack.height, .001f)
            r.all.zipWithNext().forEach { (a, b) -> assertTrue(a.bottom <= b.top + .01f) }
            assertTrue(r.divider > r.cpuFront.bottom && r.divider < r.myFront.top)
        }
    }

    @Test fun emptyRowsTakeTheirFullBand() {
        for ((w, h) in sizes) {
            val t = tiles(w, h, listOf(1), listOf(1), listOf(1), listOf(1))
            assertEquals(rows(h).cpuFront.height, t.front, .01f)
            assertEquals(t.front * 1.3f, t.frontW, .01f)
            assertTrue(t.back <= t.front * TableGeometry.LAND_MAX + .01f)
        }
    }

    @Test fun tilesGrowWithTheScreen() {
        val small = tiles(844f, 390f, listOf(1, 1, 1), listOf(1, 1), listOf(3), listOf(4))
        val big = tiles(1920f, 1080f, listOf(1, 1, 1), listOf(1, 1), listOf(3), listOf(4))
        assertTrue(big.front > small.front * 2)
    }

    @Test fun bothCreatureRowsShareTheSmallerSize() {
        val t = tiles(844f, 390f, List(10) { 1 }, listOf(1), listOf(1), listOf(1))
        assertTrue(t.front < rows(390f).cpuFront.height)
        assertTrue(TableGeometry.rowWidth(t.front, List(10) { 1 }) <= 844f * TableGeometry.BOARD_W + .5f)
    }

    @Test fun twelvePermanentsASideFitEverySize() {
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val t = tiles(w, h, List(12) { 1 }, List(12) { 1 }, List(12) { 1 }, List(12) { 1 }, dual)
            assertTrue("$w×$h front", TableGeometry.rowWidth(t.front, List(12) { 1 }) <= w * TableGeometry.BOARD_W + .5f)
            assertTrue("$w×$h back", TableGeometry.rowWidth(t.back, List(12) { 1 }) <= w * (TableGeometry.BOARD_W - TableGeometry.BACK_INSET) + .5f)
        }
    }

    @Test fun aLandIsNeverTallerThanSevenTenthsOfACreature() {
        val t = tiles(844f, 390f, List(14) { 1 }, List(14) { 1 }, listOf(3), listOf(4))
        assertTrue(t.back <= t.front * TableGeometry.LAND_MAX + .01f)
    }

    @Test fun theStackLaneNarrowsTheBoard() {
        val open = tiles(844f, 390f, List(9) { 1 }, List(9) { 1 }, listOf(1), listOf(1))
        val stack = tiles(844f, 390f, List(9) { 1 }, List(9) { 1 }, listOf(1), listOf(1), lane = 80f)
        assertTrue(stack.front < open.front)
    }
}
