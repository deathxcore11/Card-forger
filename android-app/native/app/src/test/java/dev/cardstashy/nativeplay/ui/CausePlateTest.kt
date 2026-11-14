package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Director
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * EVERY RESULT NAMES ITS CAUSE, the table's side: what each plate says and which card it stands on, read from the real boards of
 * CauseProbe's match (table/cause-cpu.jsonl, see CauseResultTest).
 */
class CausePlateTest {
    private val cpu = javaClass.classLoader!!.getResource("table/cause-cpu.jsonl")!!.readText().lines().filter { it.isNotBlank() }.map { MatchState.parse(it)!! }.associateBy { it.revision }
    private fun fresh(before: MatchState, after: MatchState): List<GameEvent> = before.events.maxOf { it.seq }.let { last -> after.events.filter { it.seq > last } }
    private fun results(a: Long, b: Long, triggers: Set<Int>, held: Map<Int, Int> = emptyMap()) = Director.resolutions(cpu[a]!!, cpu[b]!!, fresh(cpu[a]!!, cpu[b]!!), triggers, held)
    private val me = 0
    private fun said(r: Director.Resolution) = causePlates(r, me).map { Triple(it.key, it.title, it.sub) }

    @Test fun thePlateStandsOnTheCardThatChangedAndNamesTheCause() {
        assertEquals(listOf(Triple("c64", "EXILED", "by Sheltered by Ghosts")), said(results(71, 75, setOf(7)).single()))
        val (kill, back) = results(281, 285, setOf(28), mapOf(64 to 40))
        // The creature and the Auras that fell off it, one result: each Aura's plate joins the creature's, with its own picture.
        assertEquals(listOf(Triple("c33", "DESTROYED", "by Ravenous Chupacabra"), Triple("c33", "FELL OFF", "Savannah Lions died"), Triple("c33", "FELL OFF", "Savannah Lions died")), said(kill))
        assertEquals(listOf("Ravenous Chupacabra" to null, "Sheltered by Ghosts" to "aura40", "Feather of Flight" to "aura3"), causePlates(kill, me).map { it.art to it.orKey })
        assertEquals(listOf(Triple("c64", "RETURNED", "Sheltered by Ghosts left")), said(back))
        assertTrue("a card that stays keeps its numbers clear", causePlates(back, me).single().beside)
        // The beat is as long as the plates the table draws for it.
        for (r in listOf(kill, back)) assertEquals(causePlates(r, me).size, r.plateCount)
    }

    @Test fun aDrawStandsOnTheHandAndWardOnTheWardedCard() {
        val draw = causePlates(results(128, 132, setOf(11)).single(), me).single()
        assertTrue(draw.key.startsWith("hand")); assertEquals("DREW 1", draw.title); assertEquals("from Feather of Flight", draw.sub); assertEquals("handTray", draw.orKey)
        // A countered ability: on the card whose ability it was, saying whose ward it did not pay.
        val counter = causePlates(results(189, 195, setOf(21, 22)).single(), me).single()
        assertEquals(Triple("c68", "ABILITY COUNTERED", "Savannah Lions' ward was not paid"), Triple(counter.key, counter.title, counter.sub))
        assertEquals("stackcard", counter.orKey); assertEquals("Ravenous Chupacabra", counter.about); assertTrue(counter.beside)
        assertEquals(listOf(Triple("c33", "WARD 2", "CPU paid 2")), said(results(275, 281, setOf(28, 29)).single()))
    }

    /** A cause Forge gave no name: the plate says "a trigger" and asks the art lookup for no card. */
    @Test fun aCauseWithNoNameCarriesNoPicture() {
        val r = results(71, 75, setOf(7)).single().copy(sourceName = null)
        assertEquals("" to "by a trigger", causePlates(r, me).single().let { it.art to it.sub })
        assertEquals(false, r.lines(me).single().known)
    }

    private fun rect(l: Int, t: Int, r: Int, b: Int) = androidx.compose.ui.unit.IntRect(l, t, r, b)

    /** Where a plate stands (px): on the card; outside a short tile when the card stays; in one column away from the middle line when plates meet. */
    @Test fun aPlateKeepsOffTheNumbersAndPlatesStandInAColumn() {
        val table = 1000 to 600; val w = 300; val h = 60
        fun spot(card: androidx.compose.ui.unit.IntRect, beside: Boolean, taken: List<androidx.compose.ui.unit.IntRect> = emptyList()) = causePlateSpot(card, w, h, beside, table.first, table.second, 6, 4, taken)
        // A tall tile carries the plate a little under its middle, whether the card stays or not.
        val tall = rect(400, 350, 560, 550)
        assertEquals(rect(330, 432, 630, 492), spot(tall, beside = false)); assertEquals(spot(tall, false), spot(tall, true))
        // A phone's short tile: a card that left has the plate where it stood; a card that stays has it just outside, away from the middle line.
        val mine = rect(400, 380, 500, 460); val theirs = rect(400, 120, 500, 200)
        assertEquals(rect(300, 395, 600, 455), spot(mine, beside = false))
        assertEquals(rect(300, 464, 600, 524), spot(mine, beside = true))
        assertEquals(rect(300, 56, 600, 116), spot(theirs, beside = true))
        // Three plates of one result on one creature: one column, running down for yours and up for theirs, none covering another.
        val a = spot(mine, false); val b = spot(rect(404, 350, 496, 400), false, listOf(a)); val c = spot(rect(404, 340, 496, 390), false, listOf(a, b))
        assertEquals(listOf(300, 300, 300), listOf(a, b, c).map { it.left }); assertEquals(listOf(395, 459, 523), listOf(a, b, c).map { it.top })
        val up = spot(theirs, false); val up2 = spot(rect(404, 110, 496, 160), false, listOf(up))
        assertEquals(up.top - 4 - h, up2.top)
        // The table ends first: the column turns and goes on from its other end.
        val low = rect(400, 500, 500, 580); val l1 = spot(low, false); val l2 = spot(low, false, listOf(l1))
        assertTrue(l2.bottom <= table.second - 6 && !l2.overlaps(l1)); assertEquals(l1.top - 4 - h, l2.top)
    }
}
