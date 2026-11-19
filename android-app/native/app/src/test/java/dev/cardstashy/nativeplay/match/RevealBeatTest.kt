package dev.cardstashy.nativeplay.match

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Regression, Randall's recording of 19 Nov, 4:31 PM (app 0.4.99, Quick Play on the Fold): after the CPU's North Wind Avatar,
 * "CPU reveals" stayed over the table for the rest of the recording, the buttons dim, on his own turn. The reveal's beat was set
 * and never taken down (every other beat is); nothing else came to replace it on his turn, so the match stood still.
 */
class RevealBeatTest {
    private val beat = Beat(Beat.Kind.ACTION, "CPU reveals", 7, "North Wind Avatar", null, durationMs = 30)

    @Test fun theRevealComesDownOnceAnswered() = runBlocking {
        val c = MatchController(CoroutineScope(SupervisorJob() + Dispatchers.Unconfined), "{}")
        var answered = 0
        c.revealBeat(beat, 30) { assertEquals("the beat shows while it is answered", beat, c.beat.value); answered++ }
        assertEquals(1, answered)
        assertNull("the reveal's beat came down", c.beat.value)
    }

    @Test fun theRevealComesDownWhenCutShort() = runBlocking {
        val c = MatchController(CoroutineScope(SupervisorJob() + Dispatchers.Unconfined), "{}")
        // You press something while it shows: the reveal's job is cancelled before it answers.
        val job = launch { c.revealBeat(beat, 5_000) { } }
        delay(50); assertEquals(beat, c.beat.value)
        job.cancelAndJoin()
        assertNull("a cut-short reveal still comes down", c.beat.value)
    }
}
