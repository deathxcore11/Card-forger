package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 0.4.60 Z1 (specs/table-zones-brief.md): the table's zones measured in order from the window inside its insets. */
class ZoneLayoutTest {
    /** The brief's sizes: one screen, and the 1920 × 1080 panel as the dual top screen (the Thor's top, at 1 dp a px and at 2). */
    private val sizes = listOf(Triple(844f, 390f, false), Triple(904f, 386f, false), Triple(884f, 796f, false), Triple(960f, 540f, false),
        Triple(1280f, 800f, false), Triple(1920f, 1080f, true), Triple(960f, 540f, true), Triple(640f, 360f, false))
    /** No insets, a 32 dp cutout on the left (a phone held with its camera left), and bars top and bottom. */
    private val insets = listOf(ZoneLayout.Insets(), ZoneLayout.Insets(left = 32f), ZoneLayout.Insets(top = 24f, bottom = 48f), ZoneLayout.Insets(left = 20f, right = 44f))

    private fun each(f: (String, ZoneLayout.Zones) -> Unit) {
        for ((w, h, dual) in sizes) for (i in insets) f("${w.toInt()}x${h.toInt()}${if (dual) " dual top" else ""} $i", ZoneLayout.of(w, h, i, dual))
    }

    @Test fun noZoneBoxMeetsAnother() = each { tag, z ->
        val all = z.all.entries.toList()
        for (a in all.indices) for (b in a + 1 until all.size)
            assertFalse("$tag: ${all[a].key} ${all[a].value} meets ${all[b].key} ${all[b].value}", all[a].value.meets(all[b].value))
    }

    @Test fun everyZoneIsInsideTheWindowInsideItsInsets() = each { tag, z ->
        for ((k, b) in z.all) {
            assertTrue("$tag: $k $b leaves the window ${z.window}", b.inside(z.window))
            assertTrue("$tag: $k $b has no size", b.w > 0f && b.h > 0f)
        }
    }

    @Test fun theStripsAreMeasuredFirstAndTheBoardIsWhatIsLeft() = each { tag, z ->
        val w = z.window
        assertEquals("$tag left strip", .1425f * w.w, z.leftStrip.w, .01f)
        assertEquals("$tag right strip", .1425f * w.w, z.rightStrip.w, .01f)
        assertEquals("$tag left strip starts at the inset", w.x, z.leftStrip.x, .01f)
        assertEquals("$tag right strip ends at the inset", w.right, z.rightStrip.right, .01f)
        // The board: the middle 71.5 %, from the window's top to just above the tray (on the dual top, just above the hand chip's band).
        assertEquals("$tag board x", z.leftStrip.right, z.board.x, .01f)
        assertEquals("$tag board width", .715f * w.w, z.board.w, .01f)
        assertEquals("$tag board top", w.y, z.board.y, .01f)
        val tray = z.handTray
        if (tray == null) {
            // Z1 review: the dual top's "Hand N · bottom screen" chip covered your lands when the board ran to the window's bottom;
            // the chip now has its own band (36 tall, 4 above the bottom) and the board ends 2 above it.
            val chip = z.handChip ?: error("$tag: no hand chip band on the dual top")
            assertEquals("$tag chip band bottom", w.bottom - 4f * z.k, chip.bottom, .01f)
            assertEquals("$tag chip band height", 36f * z.k, chip.h, .01f)
            assertEquals("$tag chip band spans the board", z.board.x, chip.x, .01f); assertEquals(z.board.w, chip.w, .01f)
            assertEquals("$tag board ends above the chip band", chip.y - 2f * z.k, z.board.bottom, .01f)
        } else {
            if (z.phone) {
                // M5, a phone: the board ends under your creatures; your lands lie in the shelf below it, left of the hand.
                val shelf = z.shelf ?: error("$tag: a phone has a land shelf")
                assertTrue("$tag board ends above the hand", z.board.bottom < tray.y)
                assertEquals("$tag shelf starts under the board", z.board.bottom + 2f * z.k, shelf.y, .01f)
                assertEquals("$tag shelf starts at the board's left", z.board.x, shelf.x, .01f)
                assertTrue("$tag shelf ends left of the hand", shelf.right < tray.x)
            } else {
                assertNull("$tag: only a phone has a land shelf", z.shelf)
                assertTrue("$tag board ends above the hand", z.board.bottom < tray.y && tray.y - z.board.bottom <= 2f * z.k + .01f)
            }
            assertNull("$tag: one screen has no chip band", z.handChip)
        }
    }

    @Test fun cornersAndStripsHoldWhatTheBriefSays() = each { tag, z ->
        // CPU square top left, yours bottom left, in the left strip.
        for ((k, b) in listOf("cpuSquare" to z.cpuSquare, "mySquare" to z.mySquare)) assertTrue("$tag: $k $b outside the left strip", b.inside(z.leftStrip))
        assertTrue("$tag: CPU square on top", z.cpuSquare.bottom < z.mySquare.y)
        assertTrue("$tag: your square at the bottom", z.mySquare.bottom > z.window.bottom - 16f * z.k)
        // Menu, phase, stack, actions top to bottom in the right strip: the stack never takes board width.
        val order = listOf(z.menu, z.phase, z.stack, z.actions)
        for (b in order) assertTrue("$tag: $b outside the right strip", b.inside(z.rightStrip))
        order.zipWithNext().forEach { (a, b) -> assertTrue("$tag: $a not above $b", a.bottom < b.y) }
        assertTrue("$tag: the stack starts right of the board", z.stack.x > z.board.right)
        assertTrue("$tag: the stack ends 16 dp inside the edge", z.stack.right <= z.window.right - ZoneLayout.STACK_EDGE + .01f)
        // The menu and the buttons are 44 (dp at k = 1): touch targets, not the drawing's 36. 0.4.60 Z6: the gold button and the quiet
        // row above it never go under 44 dp (the brief's "44 dp tall"), whatever the chrome scale; 6 between them.
        assertEquals("$tag menu height", 44f * z.k, z.menu.h, .01f)
        assertEquals("$tag actions", 2 * maxOf(44f * z.k, 44f) + 6f * z.k, z.actions.h, .01f)
        // Nothing of the menu, turn or phase in the top middle.
        assertTrue("$tag: the top middle is board", z.menu.x > z.board.right && z.phase.x > z.board.right)
    }

    @Test fun undoHasItsOwnSlotInTheRightStrip() = each { tag, z ->
        // Z1 review: Undo stood left of the right strip, on the board's box (phone) or the tray's (Portal, tablet). Its slot is the
        // foot of the stack slot: in the right strip, off the board, the phase box and the buttons, never in End turn's place (U6).
        val u = z.undo
        assertTrue("$tag: undo $u outside the right strip", u.inside(z.rightStrip))
        assertEquals("$tag: undo 36 tall", 36f * z.k, u.h, .01f)
        assertEquals("$tag: undo at the foot of the stack slot", z.stack.bottom, u.bottom, .01f)
        for ((k, b) in z.all) if (k != "stack") assertFalse("$tag: undo $u meets $k $b", u.meets(b))
        // While Undo shows, the stack card's room ends 8 above it; otherwise it is the whole slot.
        assertEquals(z.stack, z.stackAbove(false))
        val above = z.stackAbove(true)
        assertTrue("$tag: the stack above Undo $above meets it", !above.meets(u) && above.inside(z.stack))
    }

    @Test fun theDualTopHasNoTrayAndOneScreenHasOne() {
        assertNull(ZoneLayout.of(1920f, 1080f, dual = true).handTray)
        val tray = assertNotNullAndGet(ZoneLayout.of(844f, 390f).handTray)
        // M5, a phone: a hand card is 31 % of the height and 94 % of it shows; its foot is below the screen's edge.
        assertEquals(.31f * 390f * .94f, tray.h, .01f)
        assertEquals(390f, tray.bottom, .01f)
        // A big screen (the Fold open): 24 % of the height, 84 % showing, across the board's width.
        val big = ZoneLayout.of(884f, 796f); val bt = assertNotNullAndGet(big.handTray)
        assertEquals(.24f * 796f * .84f, bt.h, .01f); assertEquals(big.board.x, bt.x, .01f); assertEquals(big.board.w, bt.w, .01f)
    }

    @Test fun theMockupsPhoneNumbers() {
        // design/roomier-table-mockup.html at 844 × 390 (k = 1): strips 120.3, board 603.5, plates 104.3 × 83.8, phase at y 58.
        val z = ZoneLayout.of(844f, 390f)
        assertEquals(1f, z.k, .0001f)
        assertEquals(120.27f, z.board.x, .01f); assertEquals(603.46f, z.board.w, .01f)
        assertEquals(104.27f, z.cpuSquare.w, .01f); assertEquals(83.85f, z.cpuSquare.h, .01f)
        assertEquals(8f, z.cpuSquare.y, .01f); assertEquals(390f - 8f - 83.85f, z.mySquare.y, .01f)
        assertEquals(58f, z.phase.y, .01f); assertEquals(40f, z.phase.h, .01f)
        assertEquals(390f - 8f - 44f, z.actions.bottom - 44f, .01f)
        // A tall screen: the tile cap holds (Fold 884 × 796: usable height 515.6), the tray from that height, not the whole screen.
        assertEquals(515.6f, ZoneLayout.of(884f, 796f).hb, .2f)
    }

    @Test fun insetsMoveEveryZoneInside() {
        val bare = ZoneLayout.of(844f, 390f)
        val cut = ZoneLayout.of(844f, 390f, ZoneLayout.Insets(left = 32f))
        assertEquals(32f, cut.leftStrip.x, .01f)
        assertTrue(cut.cpuSquare.x >= 32f && cut.mySquare.x >= 32f)
        // The width inside the insets is what is shared out: the board is 71.5 % of 812, not of 844.
        assertEquals(.715f * 812f, cut.board.w, .01f)
        assertTrue(cut.board.w < bare.board.w)
        val bars = ZoneLayout.of(844f, 390f, ZoneLayout.Insets(top = 24f, bottom = 48f))
        assertTrue(bars.menu.y >= 24f && bars.cpuSquare.y >= 24f && bars.board.y >= 24f)
        assertTrue(bars.handTray!!.bottom <= 390f - 48f && bars.actions.bottom <= 390f - 48f && bars.mySquare.bottom <= 390f - 48f)
    }

    /**
     * 0.4.60 Z5 (specs/table-zones-brief.md, "Hand tray"): the hand's glass tray holds whole cards inside the window inside its
     * insets, clear of the bottom edge and the navigation bar, at every size and inset, from 1 to 12 cards; a lifted card (any of
     * them) grows upward and stays inside the window; the tray stays in its band and on the board.
     */
    @Test fun theHandStaysInItsRoomAndALiftedCardStaysOnScreen() = each { tag, z ->
        if (z.handTray == null) { assertNull("$tag: the dual top has no hand", ZoneLayout.hand(z, 7)); return@each }
        val band = z.handTray!!
        for (n in 1..12) {
            val h = assertNotNullAndGet(ZoneLayout.hand(z, n))
            val t = h.tray
            // The cards' reach: inside the hand's band (on a phone that starts right of your lands), down to the window's bottom.
            assertTrue("$tag $n cards: hand $t leaves its band $band", t.inside(band))
            assertEquals("$tag $n cards: the hand's top", band.y, t.y, .01f); assertEquals("$tag $n cards: the hand's height", band.h, t.h, .01f)
            assertFalse("$tag $n cards: hand meets the board", t.meets(z.board))
            z.shelf?.let { assertFalse("$tag $n cards: hand meets your lands' shelf", t.meets(it)) }
            // The foot of a card is below the window's edge (M5), and a card is 1.4 times as tall as wide.
            assertTrue("$tag $n cards: the foot is below the edge", h.fan.y + h.cardH > z.window.bottom)
            assertEquals("$tag: a hand card is 1.4 times as tall as wide", 1.4f, h.cardH / h.cardW, .001f)
            assertEquals("$tag: a hand card's height", (if (z.phone) .31f else .24f) * z.window.h, h.cardH, .01f)
            // Cards overlap: each steps at most 78 % of a card.
            assertEquals("$tag: overlap", -.22f * h.cardW, h.gap, .01f)
            // Sunk (the CPU's turn): 14 % of the height still shows on a phone, 9 % on a big screen.
            assertEquals("$tag: sunk", (if (z.phone) .14f else .09f) * z.window.h, band.h - h.sunk, .01f)
            for (i in 0 until n) {
                val up = assertNotNullAndGet(ZoneLayout.hand(z, n, lift = i)?.lifted)
                assertTrue("$tag $n cards: lifted card $i $up leaves the window ${z.window}", up.inside(z.window))
                assertTrue("$tag $n cards: lifted card $i grows upward", up.y < h.fan.y && up.bottom <= t.bottom)
                assertTrue("$tag $n cards: lifted card $i is bigger", up.h > h.cardH)
            }
        }
    }

    @Test fun thePhonesHand() {
        // M5 at 844 x 390: cards 120.9 tall (31 %), the hand's top at 276.4, starting 182 in from the board's left (your lands lie there)
        // and ending 6 into the right strip or short of the gold button's 138 and a tilted corner (here 674), whichever comes first. A lifted card is 80 % of the height.
        val z = ZoneLayout.of(844f, 390f)
        val h = assertNotNullAndGet(ZoneLayout.hand(z, 5))
        assertEquals(120.9f, h.cardH, .01f)
        assertEquals(390f - 120.9f * .94f, h.tray.y, .01f)
        assertEquals(z.board.x + 182f, h.fan.x, .01f); assertEquals(minOf(z.rightStrip.x + 6f, 844f - 8f - 162f), h.fan.right, .01f)
        assertEquals(.8f * 390f, assertNotNullAndGet(ZoneLayout.hand(z, 5, lift = 2)?.lifted).h, .5f)
        // Five cards, each stepping 78 % of a card, centred in that room.
        assertEquals(h.cardW * (1f + 4 * .78f), h.tray.w, .01f)
        assertEquals(h.fan.x + h.fan.w / 2, h.tray.x + h.tray.w / 2, .01f)
        // A very short window: the lift is cut so the card's top stays 4 inside it.
        val low = ZoneLayout.of(640f, 200f)
        val lifted = assertNotNullAndGet(ZoneLayout.hand(low, 7, lift = 3)?.lifted)
        assertTrue("short window: $lifted", lifted.y >= low.window.y + 4f * low.k - .01f)
    }

    private fun <T : Any> assertNotNullAndGet(v: T?): T { assertNotNull(v); return v!! }
}
