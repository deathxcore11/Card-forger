package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Mobile table M4 and M11 (specs/mobile-table-arena-parity-brief.md): what the table answers for you, as Arena does. Triggers
 * that happen together are ordered as Forge listed them (the box's own Auto order answer) unless you asked to be asked; a
 * must-target with exactly one legal target is taken. Both read only what Forge offers.
 */
class AnswersForYouTest {
    private fun snap(name: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$name.json")!!.readText())!!

    @Test fun simultaneousTriggersAreOrderedAsForgeListedThem() {
        val st = snap("triggers"); val p = st.prompt!!
        assertEquals("order", p.method); assertEquals(2, p.options.size)
        assertEquals("the Auto order answer: every ability, in Forge's order", p.options.map { it.index }, AutoPass.triggerOrder(st, ask = false))
        assertNull("the player asked to be asked: the box opens", AutoPass.triggerOrder(st, ask = true))
        // Another kind of order (cards for the top of a deck) is the player's to make.
        assertNull(AutoPass.triggerOrder(st.copy(prompt = p.copy(message = "Put these cards on top of your library in any order", rawMessage = "")), ask = false))
        // An order the app cannot answer at all is never answered for you.
        assertNull(AutoPass.triggerOrder(st.copy(prompt = p.copy(ordered = false)), ask = false))
        assertNull(AutoPass.triggerOrder(st.copy(prompt = null), ask = false))
    }

    @Test fun theOneLegalTargetIsTaken() {
        val t = snap("targets")
        fun ask(cards: Set<Int>, players: Set<Int> = emptySet(), min: Int = 1, max: Int = 1) =
            t.copy(selection = t.selection.copy(cards = emptySet(), targetCards = cards, players = players, chosenCards = emptySet(), chosenPlayers = emptySet(), stackTargets = emptySet(), min = min, max = max))
        assertEquals(Ref("card", 124, null), AutoPass.onlyTarget(ask(setOf(124))))
        assertEquals(Ref("player", 2, null), AutoPass.onlyTarget(ask(emptySet(), setOf(2))))
        assertNull("two legal targets: yours to pick", AutoPass.onlyTarget(ask(setOf(124, 107))))
        assertNull("a card and a player: yours to pick", AutoPass.onlyTarget(ask(setOf(124), setOf(2))))
        assertNull("an optional target (up to one) is never taken for you", AutoPass.onlyTarget(ask(setOf(124), min = 0)))
        assertNull("several targets wanted", AutoPass.onlyTarget(ask(setOf(124), max = 2)))
        assertNull("one already chosen", AutoPass.onlyTarget(ask(setOf(124)).let { it.copy(selection = it.selection.copy(chosenCards = setOf(124))) }))
        assertNull("a spell on the stack as the target keeps its own question", AutoPass.onlyTarget(ask(emptySet()).let { it.copy(selection = it.selection.copy(stackTargets = setOf(990))) }))
        assertNull("not a target question", AutoPass.onlyTarget(ask(setOf(124)).copy(inputType = "InputPassPriority")))
    }
}
