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
        val (kill, fell, back) = results(281, 285, setOf(28), mapOf(64 to 40))
        assertEquals(listOf(Triple("c33", "DESTROYED", "by Ravenous Chupacabra")), said(kill))
        assertEquals(listOf(Triple("c40", "FELL OFF", "Savannah Lions died"), Triple("c3", "FELL OFF", "Savannah Lions died")), said(fell))
        // An Aura's plate wears the Aura's own picture and falls back to its strip behind the creature.
        assertEquals(listOf("Sheltered by Ghosts" to "aura40", "Feather of Flight" to "aura3"), causePlates(fell, me).map { it.art to it.orKey })
        assertEquals(listOf(Triple("c64", "RETURNED", "Sheltered by Ghosts left")), said(back))
    }

    @Test fun aDrawStandsOnTheHandAndWardOnTheWardedCard() {
        val draw = causePlates(results(128, 132, setOf(11)).single(), me).single()
        assertTrue(draw.key.startsWith("hand")); assertEquals("DREW 1", draw.title); assertEquals("from Feather of Flight", draw.sub); assertEquals("handTray", draw.orKey)
        assertEquals(listOf(Triple("stackcard", "COUNTERED", "ward was not paid")), said(results(189, 195, setOf(21, 22)).single()))
        assertEquals(listOf(Triple("c33", "WARD 2", "CPU paid 2")), said(results(275, 281, setOf(28, 29)).single()))
    }
}
