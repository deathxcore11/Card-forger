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
            assertTrue("$tag board ends above the tray", z.board.bottom < tray.y && tray.y - z.board.bottom <= 2f * z.k + .01f)
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
        // The menu and the buttons are 44 (dp at k = 1): touch targets, not the drawing's 36.
        assertEquals("$tag menu height", 44f * z.k, z.menu.h, .01f)
        assertEquals("$tag actions", 94f * z.k, z.actions.h, .01f)
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
        // The mockup's phone tray: 20 % of the height plus 6, its bottom 4 above the edge.
        assertEquals(84f, tray.h, .01f)
        assertEquals(386f, tray.bottom, .01f)
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

    private fun <T : Any> assertNotNullAndGet(v: T?): T { assertNotNull(v); return v!! }
}
