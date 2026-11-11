package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Match punch P1, the shared pieces: the particle cap and lifetime, and the freeze that holds the effect clock only. */
class PunchPiecesTest {
    @Test fun neverMoreThan160AndSparksGoBeforeSmoke() {
        val b = Particles()
        b.smoke(Offset.Zero, 40, Color.Gray, 0L, 20f)
        b.sparks(Offset.Zero, 200, Color.Yellow, 0L, 300f)
        assertEquals(Particles.CAP, b.count)
        assertEquals("all the smoke stays while sparks fill the rest", 40, b.kinds().count { it == Bit.SMOKE })
        // More smoke pushes sparks out, not smoke.
        b.smoke(Offset.Zero, 30, Color.Gray, 10L, 20f)
        assertEquals(Particles.CAP, b.count)
        assertEquals(70, b.kinds().count { it == Bit.SMOKE })
        // A spark cannot push smoke out.
        repeat(200) { b.sparks(Offset.Zero, 1, Color.Yellow, 20L, 300f, seed = it) }
        assertEquals(70, b.kinds().count { it == Bit.SMOKE })
        assertEquals(Particles.CAP, b.count)
    }

    @Test fun everyParticleIsGoneWithinASecond() {
        val b = Particles()
        b.embers(Offset.Zero, 10, Color.Yellow, 100L, 40f, lifeMs = 5000)
        b.smoke(Offset.Zero, 10, Color.Gray, 100L, 20f, lifeMs = 4000)
        b.ring(Offset.Zero, 50f, Color.White, 100L, lifeMs = 9000)
        assertTrue("held to 1 s: ${b.lastEnd()}", b.lastEnd()!! <= 100L + Particles.MAX_LIFE)
        b.sweep(100L + Particles.MAX_LIFE)
        assertEquals(0, b.count)
    }

    @Test fun theFreezeHoldsTheEffectClockOnly() {
        val fx = Battlefield()
        assertEquals(1000L, fx.effectClock(1000L))
        fx.freeze(70L)
        assertEquals("held during the freeze", 1000L, fx.effectClock(1050L))
        assertEquals(1000L, fx.effectClock(1070L))
        assertEquals("then runs again, 70 ms behind", 1030L, fx.effectClock(1100L))
        // With one of your questions open, a freeze is dropped.
        fx.promptWaiting = true
        fx.freeze(200L)
        assertEquals(1080L, fx.effectClock(1150L))
        // Reduce motion: no freeze.
        fx.promptWaiting = false; fx.reduced = true
        fx.freeze(200L)
        assertEquals(1130L, fx.effectClock(1200L))
    }

    @Test fun aJoltShakesAndPushesInThenSettles() {
        val j = listOf(Jolt(0L, 4f, 300L, .03f))
        val (dx, dy, z) = joltAt(j, 60L)
        assertTrue(dx * dx + dy * dy > 0f && z > 1f && z <= 1.03f)
        assertEquals(Triple(0f, 0f, 1f), joltAt(j, 301L))
    }
}
