package dev.cardstashy.nativeplay.ui

import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Regression, recording 20261119_100903 (app 0.4.98, Quick Play on the Fold): the table opened at 0:16.4, the CPU's "Good luck,
 * have fun." came and went (0:18.2 to about 0:21.1), he picked "Thinking…" at about 0:21.4, and his bubble then stayed on his
 * seat until the recording ended at 1:08 (it should leave after 2.6 s).
 *
 * The exact input: the table mounts the emotes as TableScreen does, from an effect whose block returns at once
 * (`LaunchedEffect(Unit) { TableEmotes.start(this) }`), and the player picks a line five seconds later, after the CPU's hello has
 * gone. By then that effect's scope has finished, so the timer that should take the bubble away is never started.
 *
 * Real time on purpose (about 9 s): the timers under test are plain delays on the scope the table hands over.
 */
class EmoteBubbleLeavesTest {
    @After fun off() { TableEmotes.destroy(); TableEmotes.random = { kotlin.random.Random.nextDouble() }; TableEmotes.now = { android.os.SystemClock.elapsedRealtime() } }

    @Test fun aLinePickedAfterTheHelloHasGoneStillLeaves() = runBlocking {
        var clock = 0L
        TableEmotes.now = { clock }
        // No CPU answer: only the player's own bubble is under test.
        TableEmotes.random = { 1.0 }
        // TableScreen: LaunchedEffect(Unit) { TableEmotes.start(this) }. The block returns at once.
        val mount = launch { TableEmotes.start(this) }
        // 0:16.4 to 0:21.4 in the recording: the hello (1.8 s in) shows for 2.6 s and fades for 0.26 s, then he picks.
        delay(5_000); clock = 5_000
        TableEmotes.pick("thinking", "Thinking…")
        assertNotNull("the bubble shows when a line is picked", TableEmotes.you)
        // A bubble stays 2.6 s and takes 0.26 s to leave.
        delay(3_400)
        assertNull("the player's bubble has left 3.4 s after it was picked", TableEmotes.you)
        mount.join()
    }
}
