package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Live 0.4.57 on the Thor (fault list 4, 12, 14): during a target prompt, attack and block the bottom screen showed a stale hand
 * card ("Seam Rip") and no question. The bottom now asks the question; plain priority still shows the lifted card.
 */
class MatchBottomWordsTest {
    private fun snap(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun card(id: Int, name: String) = Card(id, "Hand", 1, 1, false, name, "Instant", "{1}{W}", "", null, null, false, false, false, 0, false, false, emptyMap(), emptyList(), null, emptyList())
    private val hand = listOf(card(901, "Seam Rip"), card(902, "Sheltered by Ghosts"))

    // Item 4: a target prompt (a spell on the stack) shows the question, never hand[0] or a lift the chip left behind.
    @Test fun targetPromptShowsTheQuestion() {
        val st = snap("targets"); val ask = askLine(st)!!
        for (lifted in listOf(null, hand[0])) {
            val w = bottomWords(st, true, hand, lifted, null, ask)
            assertTrue(w is BottomWords.Ask)
            assertEquals(ask, (w as BottomWords.Ask).text)
            assertTrue(w.card?.id !in hand.map { it.id })
        }
    }

    // Item 14.
    @Test fun attackSaysChooseAttackers() {
        val st = snap("attack")
        assertEquals(BottomWords.Ask("Choose attackers", null), bottomWords(st, true, hand, hand[0], null, askLine(st)))
    }

    @Test fun blockAsksTheBlock() {
        val st = snap("block")
        assertEquals("Block the CPU’s attack?", (bottomWords(st, true, hand, hand[0], null, askLine(st)) as BottomWords.Ask).text)
    }

    // Plain priority is unchanged: the lifted card's words (the lift-then-play flow seen working), and the top keeps its line.
    @Test fun priorityKeepsTheLift() {
        val st = snap("main")
        assertEquals(BottomWords.Words(hand[1]), bottomWords(st, true, hand, hand[1], null, askLine(st)))
        assertNull(bottomAsk(st, true, "Respond to Loot, the Nexus?"))
    }

    // A finger on the bottom fan names the card under it.
    @Test fun fingerCardWins() {
        val st = snap("main")
        assertEquals(BottomWords.Words(hand[1]), bottomWords(st, true, hand, hand[0], hand[1], askLine(st)))
    }

    // A replay (not live) asks nothing.
    @Test fun replayAsksNothing() {
        val st = snap("attack")
        assertEquals(BottomWords.Words(hand[0]), bottomWords(st, false, hand, hand[0], null, null))
    }
}
