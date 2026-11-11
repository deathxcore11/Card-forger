package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.59 T6 (the arc): while you choose a target, a thread runs from the card you cast to the legal target under your finger or
 * ring, and stays on each target you picked; every stack item keeps its own threads through the question; a thread carries its
 * caster (gold yours, coral the CPU's); nothing of the question is left once it is gone.
 */
class RelationsTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
    private val cpu = base.players.first { it.id != base.viewer }.id
    // The CPU's Counterspell on the stack, aimed at one of your creatures.
    private val countered = base.copy(stack = base.stack.map { it.copy(targets = listOf(Ref("card", 123, null))) })
    private fun targets(st: MatchState, aim: String?) = relations(st, aim).filter { it.kind == "target" }

    @Test fun theArcFollowsTheAimAndThePickStays() {
        val rels = targets(base, "c123")
        assertEquals(listOf(Rel("target", "owncast", "c124", caster = base.viewer), Rel("target", "owncast", "c123", caster = base.viewer, aim = true)), rels)
        // To a player too, and only to a legal one not yet chosen.
        assertTrue(targets(base, "orb$cpu").any { it.to == "orb$cpu" && it.aim })
        assertEquals("the chosen one is not drawn twice", 1, targets(base, "c124").size)
        assertEquals("not a legal target", 1, targets(base, "c999").size)
        assertEquals("no aim yet", 1, targets(base, null).size)
    }

    @Test fun stackThreadsStayWhileYouChooseInTheirCastersColour() {
        val rels = targets(countered, "c107")
        assertTrue("the Counterspell's thread stays: $rels", Rel("target", "stackcard", "c123", caster = cpu) in rels)
        assertTrue("yours are yours: $rels", rels.filter { it.from == "owncast" }.all { it.caster == base.viewer })
        assertEquals(3, rels.size)
    }

    @Test fun afterTheQuestionOnlyTheStackThreadsRemain() {
        val gone = countered.copy(inputType = null, message = "")
        assertEquals(listOf(Rel("target", "stackcard", "c123", caster = cpu)), targets(gone, "c107"))
        assertEquals(emptyList<Rel>(), targets(base.copy(inputType = null, message = ""), "c123"))
    }
}
