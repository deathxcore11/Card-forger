package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Director
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Match punch P4, the turn change: the banner's length, the untap ripple's order, and your drawn card's path. */
class PunchTurnTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!

    @Test fun theBannerIs1190AndTheNextStepsStartUnderIt() {
        assertEquals(1190L, Director.BANNER_MS); assertEquals(380L, Director.BANNER_LEAD_MS)
        val turn = dev.cardstashy.nativeplay.engine.GameEvent(301, "turn", base.turn + 1, "UNTAP", base.viewer, null, null, null, emptyList(), emptyList(), emptyList(), null, null, null, null, null, null)
        val b = Director.plan(base.copy(turn = base.turn + 1), listOf(turn)).single { it.kind == Director.Kind.BANNER }
        assertEquals(1190L, b.ms); assertTrue(b.focal)
        assertEquals(140L, UNTAP_AT_MS); assertEquals(50L, UNTAP_GAP_MS); assertEquals(240, UNTAP_TURN_MS); assertEquals(380L, DRAW_AT_MS)
    }

    @Test fun theRippleRunsOverTheTilesTheNewTurnReadiedLandsFirst() {
        val me = base.viewer
        // Before: your Mountain 111 (already tapped in the snapshot), Forest 113 and Hill Giant 107 are tapped. Your turn begins: all ready.
        val before = base.copy(activePlayer = base.cpu.id, players = base.players.map { p -> if (p.id == me) p.copy(battlefield = p.battlefield.map { if (it.id in setOf(107, 111, 113)) it.copy(tapped = true) else it }) else p })
        val after = base.copy(turn = base.turn + 1, activePlayer = me, players = base.players.map { p -> if (p.id == me) p.copy(battlefield = p.battlefield.map { it.copy(tapped = false) }) else p })
        assertEquals(listOf(111, 113, 107), untapOrder(before, after))
        // The same turn (an untap effect, an Undo): no ripple. The CPU's tapped Island stays out of your ripple.
        assertTrue(untapOrder(before, after.copy(turn = before.turn)).isEmpty())
        assertTrue(121 !in untapOrder(before, after))
    }

    @Test fun yourDrawLiftsFliesHoldsAndTucksIn() {
        val lib = Offset(100f, 900f); val spot = Offset(1200f, 700f); val home = Offset(1500f, 1000f)
        val start = myDrawAt(0f, lib, spot, home, 3f)
        assertEquals(lib.x, start[0]); assertEquals(lib.y, start[1]); assertEquals(.3f, start[2]); assertEquals("face down", 0f, start[3])
        val lifted = myDrawAt(89.9f, lib, spot, home, 3f)
        assertEquals("18 dp up", lib.y - 54f, lifted[1], 1f); assertEquals(.5f, lifted[2], .01f)
        // Flying: half-way through the flip at 250 ms.
        assertEquals(.5f, myDrawAt(250f, lib, spot, home, 3f)[3], .01f)
        // The hold: at the spot above the hand, 1.6 x, face up, from 410 to 790.
        for (ms in listOf(410f, 600f, 789f)) { val h = myDrawAt(ms, lib, spot, home, 3f); assertEquals(spot.x, h[0]); assertEquals(spot.y, h[1]); assertEquals(1.6f, h[2]); assertEquals(1f, h[3]) }
        // The tuck: home at its own size by 1050.
        val end = myDrawAt(MY_DRAW_MS.toFloat(), lib, spot, home, 3f)
        assertEquals(home.x, end[0], .5f); assertEquals(home.y, end[1], .5f); assertEquals(1f, end[2], .001f)
        assertEquals(90L + 320L + 380L + 260L, MY_DRAW_MS)
    }
}
