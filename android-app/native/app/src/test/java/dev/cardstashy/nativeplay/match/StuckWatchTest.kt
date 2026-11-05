package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The stuck watch (Randall, 5 Nov: "a lot of getting stuck ... detect that and fix it"): a table Forge waits on that takes
 * no taps is freed after 2.5 s, a tap that never came back after 9 s, and a moment that is only busy is left alone.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class StuckWatchTest {
    private fun state() = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun rig(st: MatchState): MatchController {
        val c = MatchController(CoroutineScope(SupervisorJob() + Dispatchers.Main), "{}")
        fun set(name: String, v: Any?) = MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.set(c, v)
        @Suppress("UNCHECKED_CAST") fun <T> flow(name: String) = MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.get(c) as MutableStateFlow<T>
        set("session", object : EngineSession { override fun call(method: String, path: String, body: String?): Reply = error("no engine"); override fun close() {} })
        set("latest", st)
        flow<MatchState?>("_shown").value = st
        flow<Stage>("_stage").value = Stage.PLAYING
        return c
    }
    private fun flag(c: MatchController, name: String) = (MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.get(c) as MutableStateFlow<*>).value

    @Test fun aDecisionThatTakesNoTapsIsFreed() {
        val st = state(); assertTrue("fixture waits on you", st.waitingOnMe)
        val c = rig(st)
        assertEquals(false, c.live.value)
        c.watchOnce(10_000); c.watchOnce(11_000)
        assertEquals("not yet", 0, c.freed)
        c.watchOnce(12_600)
        assertEquals(1, c.freed)
        assertTrue("live again", c.live.value)
    }

    @Test fun aTapThatNeverCameBackIsFreed() {
        val c = rig(state())
        (MatchController::class.java.getDeclaredField("_sending").apply { isAccessible = true }.get(c) as MutableStateFlow<Boolean>).value = true
        MatchController::class.java.getDeclaredField("sendingAt").apply { isAccessible = true }.setLong(c, 1_000)
        c.watchOnce(5_000); assertEquals(0, c.freed)
        c.watchOnce(10_500); assertEquals(1, c.freed)
        assertEquals(false, flag(c, "_sending"))
        assertTrue(c.live.value)
    }

    @Test fun aBusyEngineIsLeftAlone() {
        val c = rig(state().copy(busy = true))
        for (t in 10_000L..30_000L step 1000) c.watchOnce(t)
        assertEquals(0, c.freed)
        assertFalse(c.live.value)
    }
}
