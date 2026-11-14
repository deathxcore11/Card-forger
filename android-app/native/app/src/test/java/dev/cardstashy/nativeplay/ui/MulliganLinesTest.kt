package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.59 T9: the opening hand's words use Forge's numbers. The states follow what the real engine did in MulliganProbe (Modern
 * and Commander 1v1): Mulligan, then "Return 1 card(s) to the bottom of your library" counting down as you pick, then Keep or
 * Mulligan with 6; a second mulligan asks to return 2, then Keep with 5.
 */
class MulliganLinesTest {
    private val opening = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-opening.json")!!.readText())!!
    private fun withHand(n: Int, input: String = "InputConfirmMulligan", message: String = opening.message, chosen: Int = 0): MatchState {
        val base = opening.me.hand.first()
        val hand = (0 until n).map { base.copy(id = 500 + it) }
        return opening.copy(inputType = input, message = message, selection = opening.selection.copy(chosenCards = hand.take(chosen).map { it.id }.toSet()),
            players = opening.players.map { if (it.id == opening.viewer) it.copy(hand = hand) else it })
    }

    @Test fun beforeAnyMulligan() {
        val l = mulliganLines(withHand(7))
        assertEquals(0, l.mulls)
        assertEquals("Draw 7 new cards, then put 1 on the bottom.", l.mullLine)
        assertEquals("7 cards · you may mulligan to 6", l.caption)
    }

    @Test fun whileForgeAsksForTheBottom() {
        val ask = mulliganLines(withHand(7, "InputLondonMulligan", "Return 1 card(s) to the bottom of your library"))
        assertEquals(1, ask.mulls); assertNull("no Mulligan button while it asks", ask.mullLine)
        assertEquals("Return 1 card to the bottom of your library", ask.caption)
        // Second mulligan, one picked: Forge says 1 more.
        val second = mulliganLines(withHand(7, "InputLondonMulligan", "Return 1 card(s) to the bottom of your library", chosen = 1))
        assertEquals(2, second.mulls)
        val done = mulliganLines(withHand(7, "InputLondonMulligan", "Return 0 card(s) to the bottom of your library", chosen = 2))
        assertEquals(2, done.mulls); assertEquals("Done. Keep these 5.", done.caption)
    }

    @Test fun afterAMulligan() {
        val six = mulliganLines(withHand(6))
        assertEquals(1, six.mulls); assertEquals("Draw 7 new cards, then put 2 on the bottom.", six.mullLine); assertEquals("You keep 6.", six.caption)
        assertEquals("Draw 7 new cards, then put 3 on the bottom.", mulliganLines(withHand(5)).mullLine)
    }

    @Test fun whileForgeAsksForTheBottomEveryCardInYourHandIsThePick() {
        // Forge lists no cards then (selection.cards is empty); live 0.4.58 only opened the card you tapped.
        val st = withHand(7, "InputLondonMulligan", "Return 1 card(s) to the bottom of your library")
        assertTrue(st.selection.cards.isEmpty())
        for (c in st.me.hand) assertTrue(mullPickable(st, live = true, card = c))
        assertFalse("not while it is not yours", mullPickable(st, live = false, card = st.me.hand[0]))
        // At the keep question no card is a pick.
        val keep = withHand(7)
        for (c in keep.me.hand) assertFalse(mullPickable(keep, live = true, card = c))
    }

    @Test fun yourDeckFromTheMatchInput() {
        val input = """{"input":{"format":"Brawl","humanDeck":{"name":"You","cards":[{"name":"Plains","qty":58},{"name":"Isamaru, Hound of Konda","qty":1}]}}}"""
        assertEquals(MullDeck("Mono-White Auras", "Standard Brawl", 59), mullDeckOf(input, "Mono-White Auras"))
        assertNull("no name, no tile", mullDeckOf(input, null))
    }
}
