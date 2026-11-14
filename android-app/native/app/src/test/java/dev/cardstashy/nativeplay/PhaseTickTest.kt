package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.audio.TableAudio
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

/** Butter pass B1 (Randall 14 Nov): the phase tick sounds only on your own turn, into combat and into the second main phase. */
class PhaseTickTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(turn = 4)
    private fun at(phase: String, mine: Boolean) = base.copy(phase = phase, activePlayer = if (mine) base.viewer else base.viewer + 1)

    @Test fun onlyYourCombatAndSecondMain() {
        val order = listOf("UPKEEP", "DRAW", "MAIN1", "COMBAT_BEGIN", "COMBAT_DECLARE_ATTACKERS", "COMBAT_DAMAGE", "COMBAT_END", "MAIN2", "END_OF_TURN", "CLEANUP")
        for (mine in listOf(true, false)) {
            val ticks = order.zipWithNext().filter { (a, b) -> TableAudio.phaseTick(at(a, mine), at(b, mine)) }.map { it.second }
            assertEquals("mine=$mine", if (mine) listOf("COMBAT_BEGIN", "MAIN2") else emptyList<String>(), ticks)
        }
    }
}
