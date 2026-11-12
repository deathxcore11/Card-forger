package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The living table F1 (specs/living-table-build-guide.md, "F1 Turn light"): a turn change sets the light to the new player and
 * schedules one flash per land that turn readied, in the land's colour, on P4's ripple. Nothing is predicted: both come from
 * the two boards. The setting maps to Full, Reduced and Off, and the guide's numbers are the constants.
 */
class TableFeelTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val cpu = base.cpu.id; private val me = base.viewer

    /** The board before your turn (the CPU's turn, your lands tapped) and your turn's board (the same lands readied). */
    private fun turn(to: Int): Pair<MatchState, MatchState> {
        val from = if (to == me) cpu else me
        fun tap(st: MatchState, who: Int, on: Boolean) = st.copy(players = st.players.map { p -> if (p.id == who) p.copy(battlefield = p.battlefield.map { if (it.isLand) it.copy(tapped = on) else it }) else p })
        val a = tap(base.copy(turn = base.turn, activePlayer = from), to, true)
        val b = tap(base.copy(turn = base.turn + 1, activePlayer = to), to, false)
        return a to b
    }

    @Test fun aTurnChangeLightsTheNewPlayersSideAndFlashesEachReadiedLand() {
        val (a, b) = turn(me)
        val c = TableFeel.turnChange(a, b)!!
        assertTrue("the light goes to you", c.mine)
        val lands = b.me.battlefield.filter { it.isLand }
        assertTrue(lands.isNotEmpty())
        assertEquals("one flash per readied land", lands.map { it.id }.toSet(), c.flashes.map { it.card }.toSet())
        assertEquals(lands.size, c.flashes.size)
        // Each in the land's own colour, on P4's ripple (140 ms in, 50 ms apart).
        for ((i, f) in c.flashes.withIndex()) {
            assertEquals(frameTone(cardColors(b.card(f.card)!!)).first, f.tone)
            assertEquals(UNTAP_AT_MS + i * UNTAP_GAP_MS, f.delayMs)
        }
        // The CPU's turn: the light goes to its side; its lands flash, not yours.
        val (a2, b2) = turn(cpu)
        val c2 = TableFeel.turnChange(a2, b2)!!
        assertFalse(c2.mine)
        assertEquals(b2.cpu.battlefield.filter { it.isLand }.map { it.id }.toSet(), c2.flashes.map { it.card }.toSet())
        // No turn change, nothing starts.
        assertNull(TableFeel.turnChange(b, b.copy(revision = b.revision + 1)))
    }

    @Test fun theSettingAndTheGuidesNumbers() {
        assertEquals(TableFeel.Mode.FULL, TableFeel.mode("full")); assertEquals(TableFeel.Mode.REDUCED, TableFeel.mode("reduced"))
        assertEquals(TableFeel.Mode.OFF, TableFeel.mode("off")); assertEquals(TableFeel.Mode.FULL, TableFeel.mode("anything else"))
        assertEquals(5, TableFeel.HEAVY_POWER); assertEquals(5, TableFeel.CLOCK_STOP_COST)
        assertEquals(.26f, TableFeel.LIGHT_YOURS); assertEquals(.28f, TableFeel.LIGHT_CPU)
        assertEquals(.30f, TableFeel.LIGHT_YOURS_END); assertEquals(.70f, TableFeel.LIGHT_CPU_END)
        assertEquals(750, TableFeel.TURN_FADE_MS); assertEquals(240L, TableFeel.UNTAP_FLASH_MS); assertEquals(.7f, TableFeel.UNTAP_FLASH)
        // The band: strongest half way (50 %), nothing at either end.
        assertEquals(.5f, TableFeel.sweepStrength(.5f), .001f); assertEquals(0f, TableFeel.sweepStrength(0f)); assertEquals(0f, TableFeel.sweepStrength(1f))
        // The four drawn mats carry the showpiece's colours; any other mat the plain profile until F10.
        assertEquals(androidx.compose.ui.graphics.Color(0xFFD8F08A), TableFeel.profile("forest-temple").lightYours)
        assertEquals(androidx.compose.ui.graphics.Color(0xFFFF5A2A), TableFeel.profile("ashen-forge").lightCpu)
        assertEquals(TableFeel.PLAIN, TableFeel.profile("charcoal-table")); assertEquals(TableFeel.PLAIN, TableFeel.profile(null))
    }
}
