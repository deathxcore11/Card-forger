package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Director.Went
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * EVERY RESULT NAMES ITS CAUSE (Randall, 14 Nov: "a card will do something and ill just not know"). The boards and events here
 * are not made up: they are the bridge's own /state bodies from two real matches played on the rules engine by CauseProbe
 * (14 Nov, engine pack cc375dd3), kept whole in table/cause-cpu.jsonl and table/cause-murder.jsonl, one board per line.
 * You: Savannah Lions (33) wearing Sheltered by Ghosts (40) and Feather of Flight (3). CPU: Memnite (64), two Ravenous
 * Chupacabra (68, then 65). What the bridge really writes: a zone event carries no cause, a countered item gets no event at
 * all, and the card held in exile comes back before its Aura's own move to the graveyard.
 */
class CauseResultTest {
    private fun boards(name: String) = javaClass.classLoader!!.getResource("table/$name")!!.readText().lines().filter { it.isNotBlank() }
        .map { MatchState.parse(it)!! }.associateBy { it.revision }
    private val cpu = boards("cause-cpu.jsonl")
    private val murder = boards("cause-murder.jsonl")
    /** The events of [after] the table had not seen at [before], as the controller takes them. */
    private fun fresh(before: MatchState, after: MatchState): List<GameEvent> = before.events.maxOf { it.seq }.let { last -> after.events.filter { it.seq > last } }
    private fun results(all: Map<Long, MatchState>, from: Long, to: Long, triggers: Set<Int> = emptySet(), held: Map<Int, Int> = emptyMap()) =
        Director.resolutions(all[from]!!, all[to]!!, fresh(all[from]!!, all[to]!!), triggers, held)
    private fun steps(all: Map<Long, MatchState>, from: Long, to: Long, triggers: Set<Int> = emptySet(), held: Map<Int, Int> = emptyMap()) =
        Director.plan(all[to]!!, fresh(all[from]!!, all[to]!!), before = all[from]!!, triggerIds = triggers, held = held).filter { it.held }
    private fun field(st: MatchState) = st.players.flatMap { it.battlefield }.map { it.id }.toSet()
    private val me = 0

    /** Scene 1 of the approved preview: your Aura's trigger exiles a CPU card. Forge wrote only "Memnite: Battlefield to Exile". */
    @Test fun shelteredByGhostsExilesAndHolds() {
        val r = results(cpu, 71, 75, setOf(7)).single()
        assertTrue(r.trigger); assertEquals(40, r.sourceId); assertEquals("Sheltered by Ghosts", r.sourceName); assertEquals(me, r.controller)
        assertEquals(listOf(Went.EXILED), r.moves.map { it.went }); assertEquals(64, r.moves[0].cardId); assertEquals("Memnite", r.moves[0].cardName)
        assertTrue("its words say until it leaves the battlefield", r.holds)
        assertEquals("Sheltered by Ghosts: exiled Memnite", r.line(me))
        assertEquals(listOf(Director.Line(40, "Sheltered by Ghosts", true, "exiled Memnite")), r.lines(me).map { it.copy(at = 0) })
        // It gets its own beat, and Memnite stays on the table until that beat.
        val result = steps(cpu, 71, 75, setOf(7)).single { it.kind == Director.Kind.RESULT }
        assertEquals(r, result.result); assertEquals(Director.NAMED_MS, result.ms)
        val shown = Director.beforeResults(cpu[75]!!, cpu[71]!!, listOf(r))
        assertTrue("Memnite waits on the battlefield", 64 in field(shown)); assertTrue(shown.players.none { p -> p.exile.any { it.id == 64 } })
        assertFalse(64 in field(Director.beforeResults(cpu[75]!!, cpu[71]!!, emptyList())))
    }

    /** Scene 3: a card draws a card. Forge wrote only "Plains: Library to Hand". */
    @Test fun featherOfFlightDrawsYouACard() {
        val r = results(cpu, 128, 132, setOf(11)).single()
        assertEquals(3, r.sourceId); assertEquals(listOf(Went.DREW), r.moves.map { it.went }); assertFalse(r.holds)
        assertEquals("Feather of Flight: drew you a card", r.line(me))
        assertEquals(1, steps(cpu, 128, 132, setOf(11)).count { it.kind == Director.Kind.RESULT })
    }

    /** Found in the real match, not in the preview: the CPU could not pay ward, so its trigger was countered, and Forge wrote nothing for it. */
    @Test fun wardNobodyPaidCountersTheTrigger() {
        val r = results(cpu, 189, 195, setOf(21, 22)).single()
        assertEquals(33, r.sourceId); assertTrue(r.trigger); assertNull(r.paid)
        assertEquals(listOf(Director.Countered(21, 68, "Ravenous Chupacabra", 1, ability = true)), r.countered)
        assertEquals("Savannah Lions: countered Ravenous Chupacabra's ability", r.line(me))
        assertEquals(r, steps(cpu, 189, 195, setOf(21, 22)).single { it.kind == Director.Kind.RESULT }.result)
    }

    /** Scene 2, first plate: the CPU pays ward. Its trigger is still on the stack after the ward resolves. */
    @Test fun wardPaidSaysWhoPaid() {
        val r = results(cpu, 275, 281, setOf(28, 29)).single()
        assertEquals(33, r.sourceId); assertTrue(r.countered.isEmpty()); assertEquals("2", r.paid); assertEquals(1, r.paidBy)
        assertEquals("Savannah Lions: ward: the CPU paid 2", r.line(me))
    }

    /** Scene 2, the chain: destroyed by the Chupacabra, the Auras fall off, the card Sheltered by Ghosts held comes back. */
    @Test fun destroyThenAurasFallOffThenHeldCardReturns() {
        val held = mapOf(64 to 40)
        val all = results(cpu, 281, 285, setOf(28), held)
        assertEquals(3, all.size)
        val (kill, fell, back) = all
        assertEquals(65, kill.sourceId); assertTrue(kill.trigger); assertEquals(1, kill.controller)
        assertEquals("Ravenous Chupacabra: destroyed Savannah Lions", kill.line(me))
        assertTrue(fell.follow); assertEquals(33, fell.sourceId); assertEquals(listOf(40, 3), fell.moves.map { it.cardId }); assertTrue(fell.moves.all { it.went == Went.FELL_OFF })
        assertEquals(listOf(Director.Line(40, "Sheltered by Ghosts", true, "fell off and went to your graveyard"), Director.Line(3, "Feather of Flight", true, "fell off and went to your graveyard")), fell.lines(me).map { it.copy(at = 0) })
        assertTrue(back.follow); assertEquals(40, back.sourceId); assertEquals(listOf(Went.RETURNED), back.moves.map { it.went })
        assertEquals(listOf(Director.Line(40, "Sheltered by Ghosts", true, "left, so Memnite returns")), back.lines(me).map { it.copy(at = 0) })
        // Three beats, in the order they read.
        assertEquals(listOf(kill, fell, back), steps(cpu, 281, 285, setOf(28), held).filter { it.kind == Director.Kind.RESULT }.map { it.result })
        // The table before each beat: all three still to come, then the Lions gone and its Auras loose, then only Memnite to come.
        val before = cpu[281]!!; val after = cpu[285]!!
        val b0 = Director.beforeResults(after, before, all)
        assertTrue(field(b0).containsAll(listOf(33, 40, 3))); assertFalse(64 in field(b0)); assertEquals(33, b0.card(40)?.attachedTo)
        assertTrue("Memnite is still in exile", b0.players.any { p -> p.exile.any { it.id == 64 } })
        val b1 = Director.beforeResults(after, before, listOf(fell, back))
        assertFalse(33 in field(b1)); assertTrue(field(b1).containsAll(listOf(40, 3))); assertNull("fell off: loose, no host", b1.card(40)?.attachedTo)
        val b2 = Director.beforeResults(after, before, listOf(back))
        assertFalse(40 in field(b2)); assertFalse(64 in field(b2))
        assertTrue(64 in field(Director.beforeResults(after, before, emptyList())))
        // The hold ends with it.
        assertTrue(Director.stillHeld(held, before).isNotEmpty()); assertTrue(Director.stillHeld(held, after).isEmpty())
    }

    /** Without the hold on record (the app was restarted mid-match), the return is not told: the table never guesses a cause. */
    @Test fun aReturnWithNoHoldOnRecordIsNotTold() {
        val all = results(cpu, 281, 285, setOf(28))
        assertEquals(2, all.size); assertTrue(all.none { r -> r.moves.any { it.went == Went.RETURNED } })
    }

    /** A spell names its result too: your own Murder on your own creature. */
    @Test fun murderIsNamedAsTheCause() {
        val all = results(murder, 182, 186, held = mapOf(64 to 40))
        val kill = all.first()
        assertFalse(kill.trigger); assertEquals("Murder: destroyed Savannah Lions", kill.line(me))
        assertEquals(listOf(true, true), all.drop(1).map { it.follow })
        assertEquals(3, steps(murder, 182, 186, held = mapOf(64 to 40)).count { it.kind == Director.Kind.RESULT })
    }

    /** The word comes from the item's own text; a move its text does not name is not told as its doing. */
    @Test fun aMoveTheWordsDoNotNameIsNotClaimed() {
        val exile = fresh(cpu[71]!!, cpu[75]!!).first { it.type == "zone" }
        assertEquals(Went.EXILED, Director.went(exile, "when sheltered by ghosts enters, exile target nonland permanent"))
        assertNull(Director.went(exile, "when feather of flight enters, draw a card."))
        val dies = fresh(murder[182]!!, murder[186]!!).first { it.type == "zone" && it.from == "Battlefield" }
        assertEquals(Went.DESTROYED, Director.went(dies, "destroy target creature."))
        assertEquals(Went.SACRIFICED, Director.went(dies, "each player sacrifices a creature."))
        assertNull("a death the item's words do not explain (state-based)", Director.went(dies, "target creature gets -3/-3 until end of turn."))
    }
}
