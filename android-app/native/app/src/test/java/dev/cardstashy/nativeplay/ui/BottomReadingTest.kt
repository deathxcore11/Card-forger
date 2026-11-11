package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 0.4.59 T7: the bottom screen's panel reads, in order, the asking card, the top stack item, the lifted hand card, the card under
 * the ring, then the first hand card; and its one status line says what the question wants, that it is on the stack, or whether you
 * can play it (else the table's own reason).
 */
class BottomReadingTest {
    private fun snap(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun card(id: Int, name: String, type: String = "Instant") = Card(id, "Hand", 1, 1, false, name, type, "{1}{W}", "", null, null, false, false, false, 0, false, false, emptyMap(), emptyList(), null, emptyList())
    private val hand = listOf(card(901, "Seam Rip"), card(902, "Sheltered by Ghosts"), card(903, "Plains", "Basic Land — Plains"))
    private val yes: (Card) -> Boolean = { true }; private val no: (Card) -> Boolean = { false }
    private val noWhy: (Card) -> String? = { null }
    private fun read(st: MatchState, lifted: Card? = null, carried: Card? = null, can: (Card) -> Boolean = yes, why: (Card) -> String? = noWhy) =
        bottomReading(st, true, hand, lifted, carried, askLine(st), can, why)

    @Test fun theAskingCardFirst() {
        val st = snap("targets")
        val r = read(st, lifted = hand[0], carried = null)!!
        assertEquals("Lightning Bolt", r.card.name)
        assertEquals(Reading.Tone.ASK, r.tone)
        assertEquals("Legal targets are ringed on the top screen.", r.status)
        // A question with no card of its own reads nothing, never a lift left behind (fault 4).
        assertNull(read(snap("attack"), lifted = hand[0]))
    }

    @Test fun thenTheTopOfTheStack() {
        // A spell with its card reads that card.
        val bolt = card(904, "Lightning Bolt").copy(zone = "Stack")
        val main = snap("main")
        val spell = main.copy(stack = listOf(dev.cardstashy.nativeplay.engine.StackItem(5, "", bolt, main.viewer)))
        val r = read(spell, lifted = hand[0])!!
        assertEquals("Lightning Bolt", r.card.name); assertEquals("On the stack", r.tag); assertEquals("On the stack now.", r.status)
        // The crowded stack's top is a Soul Warden trigger Forge sent with no source: it reads the Soul Warden on the board by name.
        val st = snap("crowded")
        assertNull(st.stack.first().source)
        val warden = card(905, "Soul Warden", "Creature — Human Cleric").copy(zone = "Battlefield")
        val withWarden = st.copy(players = st.players.map { if (it.id == st.stack.first().controller) it.copy(battlefield = it.battlefield + warden) else it })
        val w = read(withWarden, lifted = hand[0])!!
        assertEquals("Soul Warden", w.card.name); assertEquals("Ability on the stack", w.tag); assertEquals("On the stack now.", w.status)
        // With no such card anywhere it reads nothing invented: the lifted card, as with an empty stack.
        assertEquals("Seam Rip", read(st, lifted = hand[0])!!.card.name)
    }

    @Test fun thenTheLiftThenTheRingThenTheHand() {
        val st = snap("main").let { it.copy(stack = emptyList()) }
        assertEquals("Sheltered by Ghosts", read(st, lifted = hand[1], carried = hand[0])!!.card.name)
        assertEquals("Seam Rip", read(st, carried = hand[0])!!.card.name)
        assertEquals("Seam Rip", read(st)!!.card.name)
        assertEquals("You can play this land.", read(st, lifted = hand[2])!!.status)
        assertEquals("You can cast this. The lands that pay are lit in gold.", read(st, lifted = hand[1])!!.status)
        val dark = read(st, lifted = hand[1], can = no, why = { "Not enough mana" })!!
        assertEquals(Reading.Tone.NO, dark.tone); assertEquals("Not enough mana.", dark.status)
        // No reason known: no line made up.
        assertNull(read(st, lifted = hand[1], can = no)!!.status)
    }
}
