package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

class TurnClockTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun st(input: String?, active: Int = base.viewer, ok: Boolean = true, cancel: Boolean = false) =
        base.copy(inputType = input, prompt = null, activePlayer = active, priorityStop = null, turn = 5, status = "running", buttons = base.buttons.copy(okEnabled = ok, cancelEnabled = cancel))

    @Test fun budgets() {
        assertEquals(TurnClock.OWN_PRIORITY_MS, TurnClock.budgetMs(st("InputPassPriority")))
        assertEquals(TurnClock.DECISION_MS, TurnClock.budgetMs(st("InputPassPriority", active = base.viewer + 1)))
        assertEquals(TurnClock.DECISION_MS, TurnClock.budgetMs(st("InputAttack")))
    }

    @Test fun answers() {
        assertEquals(TurnClock.Answer.OK, TurnClock.answer(st("InputPassPriority")))
        assertEquals(TurnClock.Answer.OK, TurnClock.answer(st("InputAttack")))
        assertEquals(TurnClock.Answer.OK, TurnClock.answer(st("InputBlock")))
        assertEquals(TurnClock.Answer.CANCEL, TurnClock.answer(st("InputSelectTargets", ok = false, cancel = true)))
        assertEquals(TurnClock.Answer.CANCEL, TurnClock.answer(st("InputPayMana", ok = true, cancel = true)))
        assertEquals(TurnClock.Answer.NONE, TurnClock.answer(st("InputPassPriority", ok = false)))
    }
}
