package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.ui.QuickPick.Dir
import dev.cardstashy.nativeplay.ui.QuickPick.Stop
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** 0.4.59 T8: the Quick Play grid's rules: columns, the d-pad walk over 25 decks, the chips and the empty words. */
class QuickPickTest {
    @Test fun columnsBySize() {
        assertEquals(5, QuickPick.columns(844f, dual = false))   // phone, landscape
        assertEquals(5, QuickPick.columns(841f, dual = false))   // Fold unfolded
        assertEquals(5, QuickPick.columns(882f, dual = false))   // Fold folded, landscape
        assertEquals(6, QuickPick.columns(1280f, dual = false))  // tablet
        assertEquals(5, QuickPick.columns(620f, dual = true))    // Thor bottom: 5 by 5
        assertEquals(3, QuickPick.columns(540f, dual = false))   // an upright small tablet
        assertEquals(2, QuickPick.columns(390f, dual = false))   // an upright phone
    }

    @Test fun theRingWalksTwentyFiveDecksFiveAcross() {
        val n = 25; val c = 5
        // Right along the top row stops at its end.
        var i = 0; val right = mutableListOf(0)
        while (true) { val s = QuickPick.next(i, Dir.RIGHT, c, n) as? Stop.Deck ?: break; i = s.i; right += i }
        assertEquals(listOf(0, 1, 2, 3, 4), right)
        // Down the first column to the last row, then it stays.
        i = 0; val down = mutableListOf(0)
        while (true) { val s = QuickPick.next(i, Dir.DOWN, c, n) as? Stop.Deck ?: break; i = s.i; down += i }
        assertEquals(listOf(0, 5, 10, 15, 20), down)
        // Up from any deck in the top row reaches the format chips; Left from a row's start stays.
        for (t in 0 until c) assertEquals(Stop.Chips, QuickPick.next(t, Dir.UP, c, n))
        assertNull(QuickPick.next(5, Dir.LEFT, c, n))
        assertEquals(Stop.Deck(23), QuickPick.next(24, Dir.LEFT, c, n))
        // Every deck, deck 25 too, is reachable from the first.
        val seen = hashSetOf(0); val todo = ArrayDeque(listOf(0))
        while (todo.isNotEmpty()) { val at = todo.removeFirst(); for (d in Dir.entries) (QuickPick.next(at, d, c, n) as? Stop.Deck)?.let { if (seen.add(it.i)) todo += it.i } }
        assertEquals((0 until n).toSet(), seen)
        // From the chips, Down comes back to the same column's deck.
        assertEquals(3, QuickPick.fromChips(3, c, n)); assertEquals(4, QuickPick.fromChips(7, c, n)); assertNull(QuickPick.fromChips(0, c, 0))
    }

    @Test fun aShortLastRow() {
        // Six across, 25 decks: the last row holds one; Down from a column it lacks lands on it.
        assertEquals(Stop.Deck(24), QuickPick.next(19, Dir.DOWN, 6, 25))
        assertNull(QuickPick.next(24, Dir.DOWN, 6, 25))
        assertNull(QuickPick.next(24, Dir.RIGHT, 6, 25))
        assertEquals(Stop.Chips, QuickPick.next(0, Dir.UP, 6, 0))
    }

    @Test fun chipsAndWords() {
        assertEquals(listOf(null) + LIVE_FORMATS, QuickPick.chips(LIVE_FORMATS))
        assertEquals("All", QuickPick.chipLabel(null))
        assertEquals("No Modern decks here yet.", QuickPick.empty("Modern"))
        assertEquals("No decks here yet.", QuickPick.empty(null))
    }

    @Test fun colourPips() {
        assertEquals(listOf("W", "G"), QuickPick.colors("GW", listOf("R")))      // the commander's identity wins
        assertEquals(listOf("U", "R"), QuickPick.colors(null, listOf("R", "U", "R")))
        assertEquals(listOf("C"), QuickPick.colors(null, emptyList()))
    }

    // ---- T8b, two screens: 25 a page, LT/RT turn it, the chips walked by Left and Right.

    @Test fun twoScreensPagesOfTwentyFive() {
        assertEquals(1, QuickPick.pages(0)); assertEquals(1, QuickPick.pages(25)); assertEquals(2, QuickPick.pages(26)); assertEquals(3, QuickPick.pages(60))
        assertEquals(0 until 25, QuickPick.pageRange(0, 60)); assertEquals(50 until 60, QuickPick.pageRange(2, 60))
        // The walk stays on its page: Right from the last of page one's top row stops, Down from its last row stops (LT/RT turn).
        assertNull(QuickPick.nextOnPage(4, Dir.RIGHT, 60)); assertNull(QuickPick.nextOnPage(24, Dir.DOWN, 60))
        assertEquals(Stop.Deck(30), QuickPick.nextOnPage(25, Dir.DOWN, 60))
        assertEquals(Stop.Chips, QuickPick.nextOnPage(27, Dir.UP, 60))
        // Page three holds 10: Down from its second row's column 3 stays (no third row).
        assertNull(QuickPick.nextOnPage(58, Dir.DOWN, 60))
        // Every deck of a full page, deck 25 too, is reached by the pad from the first.
        val seen = hashSetOf(0); val todo = ArrayDeque(listOf(0))
        while (todo.isNotEmpty()) { val at = todo.removeFirst(); for (d in Dir.entries) (QuickPick.nextOnPage(at, d, 25) as? Stop.Deck)?.let { if (seen.add(it.i)) todo += it.i } }
        assertEquals((0 until 25).toSet(), seen)
        // LT/RT: the same place on the next page, else its last deck; the ends stay.
        assertEquals(28, QuickPick.turnPage(3, 1, 60)); assertEquals(3, QuickPick.turnPage(28, -1, 60)); assertEquals(59, QuickPick.turnPage(44, 1, 60))
        assertEquals(3, QuickPick.turnPage(3, -1, 60)); assertEquals(0, QuickPick.turnPage(0, 1, 0))
    }

    @Test fun twoScreensChips() {
        assertEquals(1, QuickPick.chipStep(5, 0, Dir.RIGHT)); assertNull(QuickPick.chipStep(5, 0, Dir.LEFT)); assertNull(QuickPick.chipStep(5, 4, Dir.RIGHT))
        assertNull(QuickPick.chipStep(5, 2, Dir.UP))
    }

    @Test fun theTopScreensNumbersComeFromTheDecklist() {
        fun fact(t: String, m: Double) = dev.cardstashy.nativeplay.play.CardFacts.Fact("", t, m, "", "", "", "", com.google.gson.JsonObject())
        val facts = mapOf("Llanowar Elves" to fact("Creature — Elf Druid", 1.0), "Ghalta, Primal Hunger" to fact("Legendary Creature — Dinosaur", 12.0),
            "Giant Growth" to fact("Instant", 1.0), "Forest" to fact("Basic Land — Forest", 0.0))
        val L = dev.cardstashy.nativeplay.play.DeckEdit::Line
        val s = QuickPick.stats(listOf(L("Forest", 24, null), L("Llanowar Elves", 4, null), L("Ghalta, Primal Hunger", 2, null), L("Giant Growth", 4, null), L("Unknown Card", 1, null))) { facts[it] }
        assertEquals(listOf("Creatures" to 6, "Instants" to 4, "Cards" to 1, "Lands" to 24), s.types)
        // 1-drops: 4 elves and 4 Growth; Ghalta's 12 counts as 7+; lands and the card with no facts yet are off the curve.
        assertEquals(listOf(0, 8, 0, 0, 0, 0, 0, 2), s.curve)
        assertEquals(24, s.lands)
    }
}
