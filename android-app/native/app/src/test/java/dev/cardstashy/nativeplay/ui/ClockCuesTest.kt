package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.TurnClock
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The turn clock's sounds (table additions 5): TT-007 is "the noise when it gets red". It must sound once for each of the last ten
 * seconds whatever order the controller's per-second re-emission and the sound loop's poll come in (the old effect restarted on each
 * new Clock and lost the tick whenever the controller saw the second first).
 */
class ClockCuesTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun prompt() = base.copy(revision = 1, status = "running", turn = 5, activePlayer = base.viewer + 1, inputType = "InputPassPriority", prompt = null, busy = false,
        buttons = base.buttons.copy(ok = "OK", okEnabled = true, cancel = null, cancelEnabled = false))

    /** The real TurnClock.Timer feeding MatchController's Clock mapping, ticked every 250 ms; the cues polled every 100 ms from [phase]. */
    private fun run(timerPhase: Long, pollPhase: Long, held: (Long) -> Boolean = { false }, own: Boolean = true): List<String> {
        var t = 10_000L; var s: MatchState? = prompt(); var clock: MatchController.Clock? = null
        val timer = TurnClock.Timer(snapshot = { s }, paused = { held(t) }, act = { _, _, done -> s = null; done(true) },
            onChange = { c -> clock = c?.let { MatchController.Clock(t + it.remaining, it.total, if (it.paused) it.remaining else null, it.own && own) } }, now = { t })
        val played = mutableListOf<String>()
        val cues = ClockCues { id, _ -> played += id }
        val end = t + TurnClock.PROMPT_MS + 60_000
        timer.tick()
        while (t < end) {
            t++
            if ((t - timerPhase) % 250 == 0L) timer.tick()
            if ((t - pollPhase) % 100 == 0L) cues.step(clock, t)
        }
        return played
    }

    @Test fun tenTicksWhateverTheOrder() {
        for (tp in listOf(0L, 1L, 37L, 99L, 124L, 249L)) for (pp in listOf(0L, 1L, 50L, 99L)) {
            val p = run(tp, pp)
            assertEquals("timer $tp poll $pp: $p", 10, p.count { it == "TT-007" })
            assertEquals("timer $tp poll $pp: $p", 1, p.count { it == "TT-008" })
            assertEquals("timer $tp poll $pp: $p", 1, p.count { it == "TT-006" })
            assertEquals(listOf("TT-006") + List(10) { "TT-007" } + "TT-008", p)
        }
    }

    @Test fun aHeldClockAndTheRivalsAreSilent() {
        // Held from the start for a minute: no tick, no zero.
        assertEquals(emptyList<String>(), run(0, 0, held = { true }).filter { it != "TT-006" })
        assertEquals(emptyList<String>(), run(0, 0, own = false))
    }

    @Test fun aHoldInTheLastSecondsResumesWithoutRepeats() {
        // Held for 5 s in the middle of the warning: every second still sounds exactly once.
        val p = run(0, 30, held = { it in 10_000 + 25_200 until 10_000 + 30_200 })
        assertEquals(10, p.count { it == "TT-007" }); assertEquals(1, p.count { it == "TT-008" })
    }

    /** An answer given in time (250 ms before the end) is not a time-out: no TT-008. The timer's own answer at zero still sounds it. */
    @Test fun anAnswerJustInTimeIsSilent() {
        fun last(answerAt: Long): List<String> {
            val played = mutableListOf<String>(); val cues = ClockCues { id, _ -> played += id }
            val c = MatchController.Clock(endsAt = 40_000, totalMs = TurnClock.PROMPT_MS)
            var t = 10_000L
            while (t + 100 <= answerAt) { cues.step(c, t); t += 100 }
            cues.step(null, answerAt)
            return played
        }
        val inTime = last(40_000 - 250)
        assertEquals(inTime.toString(), 10, inTime.count { it == "TT-007" }); assertEquals(inTime.toString(), 0, inTime.count { it == "TT-008" })
        val atZero = last(40_000 + 20)
        assertEquals(atZero.toString(), 1, atZero.count { it == "TT-008" })
    }
}
