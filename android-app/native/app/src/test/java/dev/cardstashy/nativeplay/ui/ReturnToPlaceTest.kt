package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 0.4.59 T6, Cancel: the card you were casting comes back to the place it left in your hand, even where Forge puts it back at
 * the end (a tie in mana value is ordered by Forge's index); it keeps that place until it leaves the hand again.
 */
class ReturnToPlaceTest {
    private fun c(id: Int, name: String, cost: String, type: String = "Instant") = Card(id, "Hand", 1, 1, false, name, type, cost, "", null, null,
        false, false, false, 0, false, false, emptyMap(), emptyList(), null, emptyList())
    private val shock = c(1, "Shock", "{R}"); private val bolt = c(2, "Lightning Bolt", "{R}"); private val opt = c(3, "Opt", "{U}"); private val giant = c(4, "Hill Giant", "{3}{R}", "Creature")
    private fun ids(l: List<Card>) = l.map { it.id }

    @Test fun backWhereItLeftOnATie() {
        val leftAt = HashMap<Int, Int>()
        val hand0 = listOf(shock, bolt, opt, giant)
        var shown = returnToPlace(orderedHand(hand0, emptyList()), hand0.map { it.id }.toSet(), emptyList(), null, leftAt)
        assertEquals(listOf(1, 2, 3, 4), ids(shown))
        // Bolt goes up and asks.
        val asking = listOf(shock, opt, giant)
        shown = returnToPlace(orderedHand(asking, emptyList()), asking.map { it.id }.toSet(), ids(shown), 2, leftAt)
        assertEquals(listOf(1, 3, 4), ids(shown))
        // Cancel: Forge puts it back last, so by mana value alone it would sit after Opt.
        val back = listOf(shock, opt, giant, bolt)
        assertEquals(listOf(1, 3, 2, 4), ids(orderedHand(back, emptyList())))
        shown = returnToPlace(orderedHand(back, emptyList()), back.map { it.id }.toSet(), ids(shown), null, leftAt)
        assertEquals("back in its second place", listOf(1, 2, 3, 4), ids(shown))
        // It stays there while it is in the hand; once it is played with no question its place is forgotten.
        shown = returnToPlace(orderedHand(back, emptyList()), back.map { it.id }.toSet(), ids(shown), null, leftAt)
        assertEquals(listOf(1, 2, 3, 4), ids(shown))
        val played = listOf(shock, opt, giant)
        returnToPlace(orderedHand(played, emptyList()), played.map { it.id }.toSet(), ids(shown), null, leftAt)
        assertEquals(emptyMap<Int, Int>(), leftAt)
    }

    @Test fun nothingWaitingNothingMoves() {
        val hand = listOf(giant, opt, bolt, shock)
        assertEquals(ids(orderedHand(hand, emptyList())), ids(returnToPlace(orderedHand(hand, emptyList()), hand.map { it.id }.toSet(), emptyList(), null, HashMap())))
    }
}
