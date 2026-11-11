package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.59 T1 (specs/table-look-0459.md): the battlefield tiles sized from the screen, the same size on both sides.
 * 0.4.60 Z2 (specs/table-zones-brief.md, "Tile height is fixed, crowding squeezes sideways"): a tile's height comes from the usable
 * height alone and never changes with what is on the table; a crowded row crops its tiles narrower (down to 0.74 x the height),
 * then overlaps its piles from the right. Several T1 tests asserted that crowding shrank the height; the brief changes that on
 * purpose, so they now assert the height stays and the width or the overlap gives way.
 */
class TableGeometryTest {
    private val sizes = listOf(844f to 390f, 904f to 386f, 884f to 796f, 960f to 540f, 1280f to 800f, 1920f to 1080f)
    private fun zones(w: Float, h: Float, dual: Boolean = false) = ZoneLayout.of(w, h, dual = dual)
    private fun rows(w: Float, h: Float, dual: Boolean = false) = ZoneLayout.rows(zones(w, h, dual), dual)
    private fun tiles(w: Float, h: Float, cf: List<Int>, mf: List<Int>, cb: List<Int>, mb: List<Int>, dual: Boolean = false): TableGeometry.Tiles {
        val z = zones(w, h, dual)
        return TableGeometry.tiles(rows(w, h, dual), z.board.w, z.board.w - 12f, cf, mf, cb, mb, k = z.k)
    }
    /** The spare height the board has past the tiles, the outer rows' tapped margins and the creature rows' least gap. */
    private fun spare(w: Float, h: Float, dual: Boolean): Float {
        val z = zones(w, h, dual); val r = rows(w, h, dual)
        val c = r.cpuFront.height; val l = r.cpuBack.height
        return z.board.h - (2 * (TableGeometry.TAPPED_HALF - .5f) * l + 2 * l + 2 * c + maxOf(TableGeometry.MID_GAP * z.hb, (2 * TableGeometry.TAPPED_HALF - 1) * c))
    }

    @Test fun rowsHaveTheBriefsHeightsAndEachSideHugsItsEdge() {
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val z = zones(w, h, dual); val r = rows(w, h, dual); val tag = "$w×$h dual=$dual"
            // Creature tile 20.5 % of the usable height, land 12.5 % (23.5 % and 13 % on the dual top; M5: 14 % on a phone).
            assertEquals(tag, (if (dual) .235f else if (z.phone) .14f else .205f) * z.hb, r.cpuFront.height, .01f)
            assertEquals(tag, r.cpuFront.height, r.myFront.height, .001f)
            assertEquals(tag, (if (dual) .13f else .125f) * z.hb, r.cpuBack.height, .01f)
            assertEquals(tag, r.cpuBack.height, r.myBack.height, .001f)
            r.all.zipWithNext().forEach { (a, b) -> assertTrue(tag, a.bottom <= b.top + .01f) }
            assertTrue(tag, r.divider > r.cpuFront.bottom && r.divider < r.myFront.top)
            // The aura strips' gap between the creature rows: at least 6.5 % of the usable height.
            assertTrue(tag, r.myFront.top - r.cpuFront.bottom >= TableGeometry.MID_GAP * z.hb - .01f)
            // On the board, each side at its own edge (a tapped outer tile's corner just inside it).
            val m = (TableGeometry.TAPPED_HALF - .5f) * r.cpuBack.height
            if (!z.phone) { assertEquals(tag, z.board.y + m, r.cpuBack.top, .01f); assertEquals(tag, z.board.bottom - m, r.myBack.bottom, .01f) }
            else {
                // M5, a phone: each row's centre is a share of the height; your lands lie in the shelf beside the hand.
                assertEquals(tag, .15f * h, r.cpuBack.centre, .01f); assertEquals(tag, .33f * h, r.cpuFront.centre, .01f)
                assertEquals(tag, .56f * h, r.myFront.centre, .01f); assertEquals(tag, .735f * h, r.myBack.centre, .01f)
                val shelf = z.shelf!!
                assertTrue("$tag creatures on the board", r.cpuBack.top - m >= z.board.y && r.myFront.centre + TableGeometry.TAPPED_HALF * r.myFront.height <= z.board.bottom)
                assertTrue("$tag your lands in the shelf", r.myBack.top >= shelf.y && r.myBack.bottom + m <= shelf.bottom)
            }
            // The cap: never more than 4.6 full tiles across the board (4.15 on the dual top).
            assertTrue(tag, z.board.w / (r.cpuFront.height * TableGeometry.ASPECT) >= (if (dual) 4.15f else 4.6f) - .01f)
        }
    }

    @Test fun onATallScreenTheSpareHeightIsOpenTableBetweenTheSides() {
        // The Fold open (884 × 796) caps the tile; the spare height lies between the creature rows, not over the tiles.
        val z = zones(884f, 796f); val r = rows(884f, 796f)
        assertTrue(z.hb < 796f)
        assertTrue(r.myFront.top - r.cpuFront.bottom > .2f * z.hb)
        assertEquals(105.7f, r.cpuFront.height, .1f)
    }

    @Test fun aTileIsAsTallWhateverIsOnTheTable() {
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val one = tiles(w, h, listOf(1), listOf(1), listOf(1), listOf(1), dual)
            val full = tiles(w, h, List(14) { 1 }, List(14) { 3 }, List(14) { 4 }, List(14) { 1 }, dual)
            assertEquals(one.front, full.front, .001f); assertEquals(one.back, full.back, .001f)
            assertEquals(one.front * 1.3f, one.frontW, .01f)
            assertTrue(full.frontW < one.frontW)
            // (M5: on a phone a land is nearly as tall as a creature tile, as measured: 12.5 % and 14 % of the height.)
            if (!zones(w, h, dual).phone) assertTrue(one.back <= one.front * TableGeometry.LAND_MAX + .01f)
        }
    }

    @Test fun tilesGrowWithTheScreen() {
        val small = tiles(844f, 390f, listOf(1, 1, 1), listOf(1, 1), listOf(3), listOf(4))
        val big = tiles(1920f, 1080f, listOf(1, 1, 1), listOf(1, 1), listOf(3), listOf(4))
        assertTrue(big.front > small.front * 2)
    }

    @Test fun bothCreatureRowsShareOneTileSize() {
        // Ten piles on the CPU's side, one on yours: both rows take the narrower tile; the height stays the band's.
        val t = tiles(844f, 390f, List(10) { 1 }, listOf(1), listOf(1), listOf(1))
        val r = rows(844f, 390f)
        assertEquals(r.cpuFront.height, t.front, .001f)
        assertTrue(t.frontW < t.front * 1.3f && t.frontW >= t.front * TableGeometry.CROP_MIN - .01f)
        val z = zones(844f, 390f)
        val lay = TableGeometry.layRow(t.frontW, t.front, z.board.w, List(10) { 1 }, false, gap = TableGeometry.gap(10, z.k))
        assertTrue(lay.total <= z.board.w + .5f)
    }

    @Test fun cropFirstThenOverlap() {
        val z = zones(844f, 390f); val c = rows(844f, 390f).cpuFront.height
        // Four piles: full width. Nine: cropped, not overlapping. Sixteen: at the crop's floor, overlapping from the right.
        // (M5: a phone's tile is 14 % of the height, so more fit before the crop starts.)
        for ((n, crop, over) in listOf(Triple(4, false, false), Triple(9, true, false), Triple(16, true, true))) {
            val t = tiles(844f, 390f, List(n) { 1 }, List(n) { 1 }, listOf(1), listOf(1))
            assertEquals("$n", crop, t.frontW < c * 1.3f - .01f)
            val lay = TableGeometry.layRow(t.frontW, t.front, z.board.w, List(n) { 1 }, false, gap = TableGeometry.gap(n, z.k))
            assertEquals("$n", over, lay.visible != null)
            assertTrue("$n", lay.total <= z.board.w + .5f)
            if (over) assertEquals(c * TableGeometry.CROP_MIN, t.frontW, .01f)
            // Every pile starts right of the one before (overlap from the right, like a fan).
            lay.xs.zipWithNext().forEach { (a, b) -> assertTrue(b > a) }
        }
    }

    @Test fun tenPilesASideMeetTheBriefsSizes() {
        // The brief: with ten different piles a side, a phone tile at least 59 × 80 dp, the Portal (960 × 540) 82 × 111 (the
        // mockup's 81.9 × 110.7, so half a dp is allowed for rounding).
        // M5 replaces the phone's size: a tile 14 % of the height (54.6), at least 56 wide with ten piles.
        for ((size, want) in listOf((844f to 390f) to (56f to 54.6f), (960f to 540f) to (82f to 111f))) {
            val t = tiles(size.first, size.second, List(10) { 1 }, List(10) { 1 }, List(6) { 2 }, List(6) { 2 })
            assertTrue("$size ${t.frontW}×${t.front}", t.frontW >= want.first - .5f && t.front >= want.second - .5f)
        }
    }

    @Test fun twelvePermanentsASideFitEverySize() {
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val z = zones(w, h, dual)
            val t = tiles(w, h, List(12) { 1 }, List(12) { 1 }, List(12) { 1 }, List(12) { 1 }, dual)
            val front = TableGeometry.layRow(t.frontW, t.front, z.board.w, List(12) { 1 }, false, gap = TableGeometry.gap(12, z.k))
            val back = TableGeometry.layRow(t.backW, t.back, z.board.w - 12f, List(12) { 1 }, true, gap = TableGeometry.gap(12, z.k))
            assertTrue("$w×$h front", front.total <= z.board.w + .5f)
            assertTrue("$w×$h back", back.total <= z.board.w - 12f + .5f)
            assertEquals(rows(w, h, dual).cpuFront.height, t.front, .001f)
        }
    }

    @Test fun aLandIsNeverTallerThanSevenTenthsOfACreature() {
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val t = tiles(w, h, List(14) { 1 }, List(14) { 1 }, listOf(3), listOf(4), dual)
            if (!zones(w, h, dual).phone) assertTrue(t.back <= t.front * TableGeometry.LAND_MAX + .01f)
        }
    }

    @Test fun tappedTilesOfNeighbouringRowsNeverMeet() {
        // Review fix: a tapped tile turns 20 degrees and its corners reach past its row. Z2 fixes the heights, so the rows cannot shrink
        // to make room: the two creature rows' tapped tiles never meet anywhere (their gap is at least what that needs), an attacker never
        // reaches the row it faces, and a back row parts from its creature row as far as the board's height allows: fully wherever the
        // board has the height, and otherwise by all the height there is (on a phone the brief's tiles fill the board).
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val r = rows(w, h, dual)
            val t = tiles(w, h, listOf(1), listOf(1), listOf(1), listOf(1), dual)
            val half = TableGeometry.TAPPED_HALF
            val tag = "$w×$h dual=$dual"
            assertTrue("$tag creatures", r.cpuFront.centre + half * t.front <= r.myFront.centre - half * t.front + .01f)
            val step = TableGeometry.advance(r, t.front, 12f)
            assertTrue("$tag attack", r.cpuFront.centre + step + half * t.front <= r.myFront.centre - t.front / 2 + .01f)
            assertTrue(step >= 0f && step <= 12f)
            val need = (half - .5f) * (t.back + t.front)
            val phone = zones(w, h, dual).phone
            if (!phone) {
                val side = minOf(need, spare(w, h, dual) / 2)
                assertEquals("$tag CPU back", side, r.cpuFront.top - r.cpuBack.bottom, .01f)
                assertEquals("$tag your back", side, r.myBack.top - r.myFront.bottom, .01f)
            }
            // M5: a phone's rows are placed so that tapped tiles of neighbouring rows never meet.
            if (phone || spare(w, h, dual) >= 2 * need) {
                assertTrue("$tag CPU back tapped", r.cpuBack.centre + half * t.back <= r.cpuFront.centre - half * t.front + .01f)
                assertTrue("$tag your back tapped", r.myFront.centre + half * t.front <= r.myBack.centre - half * t.back + .01f)
            }
        }
        // The tall screens have that height.
        assertTrue(spare(884f, 796f, false) >= 2 * (TableGeometry.TAPPED_HALF - .5f) * (rows(884f, 796f).cpuBack.height + rows(884f, 796f).cpuFront.height))
        assertTrue(spare(1920f, 1080f, true) >= 2 * (TableGeometry.TAPPED_HALF - .5f) * (rows(1920f, 1080f, true).cpuBack.height + rows(1920f, 1080f, true).cpuFront.height))
    }

    @Test fun loosePermanentsStandAtTheRightEndOfTheBackRow() {
        // Mobile table M13: lands on the left, the permanents that are neither land nor creature at the right end, the mirror.
        val plain = TableGeometry.layRow(60f, 46f, 600f, listOf(2, 1, 1, 1), true, laneAt = 2)
        val lay = TableGeometry.layRow(60f, 46f, 600f, listOf(2, 1, 1, 1), true, laneAt = 2, rightFrom = 2)
        assertEquals("the lands stay where they were", plain.xs.take(2), lay.xs.take(2))
        assertEquals("the last one ends at the row's right end", 600f, lay.xs.last() + 60f, .01f)
        assertEquals("they keep their own spacing", plain.xs[3] - plain.xs[2], lay.xs[3] - lay.xs[2], .01f)
        assertEquals(600f, lay.total, .01f)
        // No lands: the whole row is at the right.
        assertEquals(600f, TableGeometry.layRow(60f, 46f, 600f, listOf(1, 1), true, rightFrom = 0).xs.last() + 60f, .01f)
        // A crowded row stays as it was: nothing moves, nothing leaves the room.
        val crowd = List(14) { 1 }
        assertEquals(TableGeometry.layRow(60f, 46f, 600f, crowd, true, laneAt = 10).xs, TableGeometry.layRow(60f, 46f, 600f, crowd, true, laneAt = 10, rightFrom = 10).xs)
    }

    @Test fun yourBackRowEndsBeforeAButtonAtItsHeight() {
        // A narrower room for your back row alone narrows the back tiles for both sides alike (Z2: the width, never the height), and
        // your row still fits that room.
        val r = rows(960f, 540f)
        val piles = listOf(4, 4, 4, 4, 4, 4, 2, 2)
        val open = TableGeometry.tiles(r, 690f, 640f, listOf(1), listOf(1), listOf(1), piles)
        val held = TableGeometry.tiles(r, 690f, 640f, listOf(1), listOf(1), listOf(1), piles, myBackRoom = 380f)
        assertEquals(open.back, held.back, .001f)
        assertTrue(held.backW < open.backW)
        assertTrue(TableGeometry.layRow(held.backW, held.back, 380f, piles, true, gap = TableGeometry.gap(8, 1f)).total <= 380.5f)
    }

    @Test fun auraStripsNeverReachAnotherRow() {
        // T4: two strips above your creature (30 % of a tile) rise into the gap between the creature rows (Z2: the brief's 6.5 %) and
        // never reach the CPU's creatures standing; where the board has the height, not even tapped ones. Strips never shrink a tile.
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val z = zones(w, h, dual); val r = rows(w, h, dual)
            val t = TableGeometry.tiles(r, z.board.w, z.board.w - 12f, listOf(1), listOf(1), listOf(1), listOf(1))
            val rise = TableGeometry.STRIP * TableGeometry.STRIPS_MAX * t.front
            assertTrue("$w×$h dual=$dual yours", r.myFront.centre - t.front / 2 - rise >= r.cpuFront.bottom - .01f)
            if (r.myFront.top - r.cpuFront.bottom >= rise + (TableGeometry.TAPPED_HALF - .5f) * t.front)
                assertTrue(r.myFront.centre - t.front / 2 - rise >= r.cpuFront.centre + TableGeometry.TAPPED_HALF * t.front - .01f)
        }
        val z = zones(884f, 796f); val r = rows(884f, 796f)
        assertTrue(r.myFront.top - TableGeometry.STRIP * TableGeometry.STRIPS_MAX * r.myFront.height >= r.cpuFront.centre + TableGeometry.TAPPED_HALF * r.cpuFront.height)
        assertTrue(z.hb > 0f)
    }

    @Test fun tappedBackTilesStayOnTheBoardBox() {
        // 0.4.60 Z1: the board runs to the window's top (and, on the dual top, down to the hand chip's band); a tapped land in an outer row stays on it.
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val z = ZoneLayout.of(w, h, dual = dual)
            val r = TableGeometry.rows(dual, z.board.y, z.board.bottom, z.hb)
            val t = TableGeometry.tiles(r, z.board.w, z.board.w - 12f, listOf(1), listOf(1), listOf(1), listOf(1))
            assertTrue("$w×$h dual=$dual CPU back", r.cpuBack.centre - TableGeometry.TAPPED_HALF * t.back >= z.board.y - .01f)
            assertTrue("$w×$h dual=$dual your back", r.myBack.centre + TableGeometry.TAPPED_HALF * t.back <= z.board.bottom + .01f)
        }
    }

    @Test fun aBoardTooShortForTheRowsShrinksThemAllAlike() {
        // A pod's rail takes the board's top: only then do the tiles shrink, all four rows by the same share, still in order.
        val z = zones(844f, 390f)
        val full = TableGeometry.rows(false, z.board.y, z.board.bottom, z.hb)
        val pod = TableGeometry.rows(false, z.board.y + 58f, z.board.bottom, z.hb)
        assertTrue(pod.cpuFront.height < full.cpuFront.height)
        assertEquals(full.cpuBack.height / full.cpuFront.height, pod.cpuBack.height / pod.cpuFront.height, .001f)
        pod.all.zipWithNext().forEach { (a, b) -> assertTrue(a.bottom <= b.top + .01f) }
        assertTrue(pod.cpuBack.top >= z.board.y + 58f && pod.myBack.bottom <= z.board.bottom + .01f)
    }

    @Test fun theStackNeverNarrowsTheBoard() {
        // 0.4.60 Z1 (table-zones brief, walk line 27): the stack card stands in the right strip and never takes board width, so the
        // board's room and the tiles are the same with the stack open or not. (Until 0.4.59 an open stack took an 80 dp lane off
        // the board and shrank the tiles: theStackLaneNarrowsTheBoard asserted that; the brief changes it on purpose.)
        for ((w, h) in sizes) for (dual in listOf(false, true)) {
            val z = ZoneLayout.of(w, h, dual = dual)
            assertTrue("$w×$h dual=$dual: the stack starts right of the board", z.stack.x > z.board.right)
            assertEquals(w * TableGeometry.BOARD_W, z.board.w, .01f)
            assertEquals(w * TableGeometry.BOARD_X, z.board.x, .01f)
            // ZoneLayout has no input for the stack at all: its board is what the tiles are sized for (BOARD_W of the width).
        }
        // This checks only the zones' side. ForgeBoard works out the rows' room from these zones with no stack term, and what proves
        // walk line 27 on the drawn table (the same tiles at the same places and sizes with the stack open and shut) is
        // TableLookZ1ShotTest.theStackOpeningMovesNoTile.
    }
}
