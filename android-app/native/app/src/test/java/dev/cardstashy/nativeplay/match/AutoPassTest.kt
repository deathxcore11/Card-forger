package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

/** Finding B (Thor 0.4.56): Main 1 lost after your own saga trigger resolved. The auto-pass decides on Forge's state only. */
class AutoPassTest {
    private val forge = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!

    @Test fun aResolvedTriggerHeldOnTheBoardIsNoReasonToPass() {
        // Your own MAIN1, Forge's stack empty; the replay holds the resolved chapter trigger on top (yours) for its read.
        assertEquals("MAIN1", forge.phase); assertEquals(emptyList<StackItem>(), forge.stack)
        val board = forge.copy(stack = listOf(StackItem(999, "Chapter I", null, forge.viewer, ability = true, trigger = true)))
        // Before: decide(board) saw "your own spell or ability on top" and passed Main 1. Now nothing is decided on that board.
        assertNull(AutoPass.basis(board, forge))
        // The final show of Forge's own state decides on Forge's state.
        assertSame(forge, AutoPass.basis(forge, forge))
        // A board whose cards differ (results still to land) but whose stack is Forge's decides on Forge's state, not the board.
        val numbers = forge.copy(turn = forge.turn)
        assertSame(forge, AutoPass.basis(numbers, forge))
    }

    @Test fun anOlderRevisionDecidesNothing() {
        assertNull(AutoPass.basis(forge, forge.copy(revision = forge.revision + 1)))
        assertNull(AutoPass.basis(forge, null))
    }
}
