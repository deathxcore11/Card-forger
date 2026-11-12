package dev.cardstashy.nativeplay.ui

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Living table F9 (specs/living-table-build-guide.md, "F9 Vibration"): a land is a light tick, a landing is felt by its weight
 * step, the winning hit is heavy with a long fade, the clock stop gives one soft pulse per loyalty piece. It has its own setting,
 * on by default, and is off in Reduced.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class LivingF9Test {
    private var was = false
    @Before fun on() { was = Motion.still; Motion.still = false }
    @After fun back() { Motion.still = was; AppSettings.applyMatchEffects("full") }
    private fun felt(vararg items: FxItem, ms: Long = 3000L): List<String> {
        val fx = Battlefield(); val got = ArrayList<String>(); fx.onImpact = { got += it }
        for (it in items) { it.t0 = 0L; it.dur = it.baseMs; fx.items += it }
        fx.reindex()
        var t = 5000L; while (t <= 5000L + ms) { fx.tick(t); t += 16 }
        return got
    }

    @Test fun itsOwnSettingOnByDefaultAndNeverInReduced() {
        assertTrue(AppSettings.matchVibration)
        assertTrue(TableFeel.vibrates(true, "full")); assertTrue("the table as it was still vibrates", TableFeel.vibrates(true, "off"))
        assertFalse(TableFeel.vibrates(true, "reduced")); assertFalse(TableFeel.vibrates(false, "full"))
        assertEquals(listOf("pack-deal", "pack-reveal", "pack-rumble", "table-win", "table-soft"), listOf("light", "medium", "heavy", "win", "soft").map { TableFeel.vibration(it) })
    }

    @Test fun aLandingIsFeltByItsWeightStep() {
        fun landing(land: Boolean, step: Int) = FxItem(Fx.IMPACT, 1, 400, card = 7, land = land).also { it.points = step }
        assertEquals("a land", listOf("light"), felt(landing(true, 0)))
        assertEquals("power 1 to 2, or not a creature", listOf("light"), felt(landing(false, TableFeel.weight(2).ordinal)))
        assertEquals("power 3 to 4", listOf("medium"), felt(landing(false, TableFeel.weight(4).ordinal)))
        // Power 5 or more: once, heavy, where the heavy landing touches down (not a second time for its impact).
        assertEquals(listOf("heavy"), felt(landing(false, TableFeel.weight(6).ordinal), FxItem(Fx.HEAVY, 2, 900, card = 7)))
        assertEquals("heavy with Match effects off (no heavy landing is drawn)", listOf("heavy"), felt(landing(false, TableFeel.weight(6).ordinal)))
    }

    @Test fun theWinningHitIsFeltOnceAndADrawIsNot() {
        assertEquals(listOf("win"), felt(FxItem(Fx.WIN, 2, TableFeel.WIN_HOLD_MS, player = 2, toKey = "orb2")))
        assertTrue(felt(FxItem(Fx.WIN, 2, TableFeel.WIN_HOLD_MS, player = null, ids = setOf(1, 2))).isEmpty())
    }

    @Test fun theClockStopGivesOneSoftPulseForEachPieceOffTheShield() {
        fun clock(cost: Int) = FxItem(Fx.CLOCK, 1, TableFeel.clockMs(cost), card = 970, label = "1").also { it.points = cost }
        assertEquals(List(6) { "soft" }, felt(clock(6)))
        assertEquals(List(5) { "soft" }, felt(clock(5)))
        // Cut short by Forge 500 ms in (two pieces were off): no more pulses.
        val fx = Battlefield(); val got = ArrayList<String>(); fx.onImpact = { got += it }
        val c = clock(6).also { it.t0 = 0L; it.dur = it.baseMs }; fx.items += c; fx.reindex()
        var t = 5000L; while (t <= 5500L) { fx.tick(t); t += 16 }
        c.dur = TableFeel.clockCut(500L, c.dur)
        while (t <= 8000L) { fx.tick(t); t += 16 }
        assertEquals(listOf("soft", "soft"), got)
    }
}
