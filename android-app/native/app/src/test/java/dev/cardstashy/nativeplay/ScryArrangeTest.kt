package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.ui.ScryArrange
import dev.cardstashy.nativeplay.ui.ScryKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScryArrangeTest {
    private fun tags(a: ScryArrange) = a.cards.indices.map { a.tag(it) }

    @Test fun everyCardStartsOnTheRightInLibraryOrderSoDoneAloneKeepsAll() {
        val a = ScryArrange.start(ScryKind.SCRY, 3)
        assertEquals(listOf(2, 1, 0), a.cards); assertEquals(emptyList<Int>(), a.left)
        assertEquals(listOf(0, 1, 2), a.topInDrawOrder)   // library order: card 0 is drawn first
        assertEquals(listOf("Drawn 3rd", "Drawn 2nd", "You draw this next"), tags(a))
        assertTrue(a.untouched); assertEquals("Scry · 3 on top", a.chip())
    }

    @Test fun scry1SentDownIsTheOnlyCardOnTheLeft() {
        val a = ScryArrange.start(ScryKind.SCRY, 1).hop(0)
        assertEquals(listOf(0), a.left); assertEquals(emptyList<Int>(), a.right)
        assertEquals(listOf("Bottom"), tags(a)); assertEquals("Scry · 1 on the bottom", a.chip())
        // Tapped again it hops back.
        assertEquals(listOf(0), a.hop(0).right); assertTrue(a.hop(0).untouched)
    }

    @Test fun scry3TwoOnTopInOrderOneOnTheBottom() {
        // Library top to bottom: 0, 1, 2. Send 1 down; swap so 2 is drawn before 0.
        var a = ScryArrange.start(ScryKind.SCRY, 3)          // row [2, 1, 0]
        a = a.hop(1)                                          // 1 goes left: [1 | 2, 0]
        assertEquals(listOf(1), a.left); assertEquals(listOf(2, 0), a.right)
        a = a.slide(1, 1)                                     // [1 | 0, 2]: 2 is now furthest right
        assertEquals(listOf(2, 0), a.topInDrawOrder)
        assertEquals(listOf("Bottom", "Drawn 2nd", "You draw this next"), tags(a))
        assertEquals("Scry · 2 on top, 1 on the bottom", a.chip()); assertTrue(!a.untouched)
    }

    @Test fun surveil2OneOnTopOneToTheGraveyard() {
        val a = ScryArrange.start(ScryKind.SURVEIL, 2).hop(1)  // row [1, 0] -> card 0 (the top card) goes to the graveyard
        assertEquals(listOf(1), a.topInDrawOrder); assertEquals(listOf(0), a.left)
        assertEquals(listOf("To graveyard", "You draw this next"), tags(a))
        assertEquals("Surveil · 1 on top, 1 to the graveyard", a.chip())
    }

    @Test fun slidingNeverCrossesTheLibraryCardAndStaysInTheRow() {
        val a = ScryArrange.start(ScryKind.SCRY, 3).hop(2).hop(1)   // [0, 1 | 2]? left two, right one
        assertEquals(2, a.left.size)
        assertEquals(a, a.slide(0, -5).let { a })
        val b = a.slide(0, 9)
        assertEquals(2, b.left.size); assertEquals(a.right, b.right)
        assertEquals(a.cards, a.slide(2, 3).cards)                  // one card on the right: nowhere to go
        assertEquals(a.cards, a.slide(7, 1).cards)                  // out of range does nothing
    }

    @Test fun dragMovesWithinASideAndOthersMakeRoom() {
        val a = ScryArrange.start(ScryKind.SCRY, 4)                  // [3, 2, 1, 0]
        assertEquals(listOf(2, 1, 0, 3), a.dragTo(0, 3).cards)
        assertEquals(listOf(0, 3, 2, 1), a.dragTo(3, 0).cards)
    }

    @Test fun timeoutKeepsAllOnTopInLibraryOrder() {
        val t = ScryArrange.timeout(ScryKind.SURVEIL, 2)
        assertEquals(listOf(0, 1), t.topInDrawOrder); assertEquals(emptyList<Int>(), t.left); assertTrue(t.untouched)
    }

    @Test fun cpuScryShowsOnlyACount() {
        assertEquals("CPU scries 2", ScryArrange.cpuChip(2))
    }

    @Test fun chipLeavesOutAnEmptySide() {
        assertEquals("Scry · 2 on the bottom", ScryArrange.chipFor(ScryKind.SCRY, 0, 2))
        assertEquals("Surveil · 2 on top", ScryArrange.chipFor(ScryKind.SURVEIL, 2, 0))
    }
}
