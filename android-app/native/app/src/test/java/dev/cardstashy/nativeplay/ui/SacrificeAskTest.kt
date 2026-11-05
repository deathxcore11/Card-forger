package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Randall 5 Nov: the CPU's Break Under Pressure made him pick a creature to sacrifice; the table said only "Break Under Pressure (94)"
 *  over a dead OK, so the match looked stuck. The state is the real engine's (SacrificeProbe). */
class SacrificeAskTest {
    private val st = MatchState.parse(javaClass.getResource("/forge/sacrifice-choice-state.json")!!.readText())!!

    @Test fun saysWhatToDo() {
        assertEquals("InputSelectCardsFromList", st.inputType)
        assertEquals("Tap a creature or planeswalker to sacrifice", askLine(st))
    }

    @Test fun theTapCommitsSoNoDeadOk() {
        assertTrue(onePick(st))
        assertTrue(!st.buttons.okEnabled)
    }
}
