package dev.cardstashy.nativeplay.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Randall's 19 Nov recording of 0.4.98: he picked "Thinking…" at 0:21 and the bubble sat on his seat until the recording ended
 * 47 s later; the CPU's hello had left on time. The table starts the emotes from an effect whose own work ends at once, as
 * TableScreen does; a bubble said after that must still leave after its 2.6 s.
 */
class EmoteLeavesTest {
    @Test fun aBubbleSaidLongAfterTheTableOpenedStillLeaves() = runBlocking {
        val table = CoroutineScope(Dispatchers.Default + Job())
        // LaunchedEffect(Unit) { TableEmotes.start(this) }: the effect's block returns straight away.
        val effect = table.launch { TableEmotes.start(this) }
        effect.join() // the hello (if any) has been said and has left: the effect's own job is over
        assertNull(TableEmotes.cpu)
        TableEmotes.say("you", "Thinking…")
        assertEquals("Thinking…", TableEmotes.you?.text)
        assertNotNull(TableEmotes.you)
        delay(2600 + 260 + 600)
        assertNull("the bubble has left", TableEmotes.you)
        TableEmotes.destroy()
    }
}
