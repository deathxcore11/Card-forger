package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.TurnClock.Kind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Test

/** The site's test-play-forge-turn-timer.mjs, case for case, on a fake clock. */
class TurnClockTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun snap(turn: Int = 5, revision: Long = 1, active: Int = base.viewer, input: String? = "InputPassPriority", awaiting: Boolean = true) =
        base.copy(revision = revision, status = "running", turn = turn, activePlayer = active, inputType = if (awaiting) input else null, prompt = null, busy = false,
            buttons = base.buttons.copy(ok = "OK", okEnabled = true, cancel = "End turn", cancelEnabled = true))

    private inner class Rig(first: MatchState, friend: Boolean = false, val refuse: Boolean = false) {
        var t = 1000L; var s = first; var held = false; var host: Pair<Boolean, Pair<dev.cardstashy.nativeplay.engine.Afk, Long>?> = false to null
        val acts = mutableListOf<Pair<Kind, String?>>(); val changes = mutableListOf<TurnClock.Shown?>(); val strikes = mutableListOf<Pair<Int, Int?>>(); var conceded = 0; var calls = 0
        val timer = TurnClock.Timer(snapshot = { s }, paused = { held }, act = { w, x, done -> calls++; if (!refuse) acts += w.kind to x.inputType; done(!refuse) },
            concede = { conceded++ }, onChange = { changes += it }, onStrike = { n, l -> strikes += n to l }, friend = friend, now = { t }, host = { host })
        fun run(ms: Long) { repeat((ms / 250).toInt()) { t += 250; timer.tick() } }
        fun last() = changes.last()!!
    }

    @Test fun windows() {
        assertEquals(Kind.TURN to TurnClock.TURN_MS, TurnClock.waitingOn(snap())!!.let { it.kind to it.total })
        assertEquals(Kind.PROMPT to TurnClock.PROMPT_MS, TurnClock.waitingOn(snap(input = "InputAttack"))!!.let { it.kind to it.total })
        assertEquals(TurnClock.PROMPT_MS, TurnClock.waitingOn(snap(input = "InputConfirmMulligan"))!!.total)
        assertEquals(Kind.RESPONSE, TurnClock.waitingOn(snap(active = base.viewer + 1))!!.kind)
        assertNull(TurnClock.waitingOn(snap(awaiting = false)))
    }

    @Test fun drainsWarnsAndPasses() {
        val r = Rig(snap())
        r.run(1000); assertEquals(Kind.TURN, r.last().kind); assertEquals(false, r.last().warn)
        r.run(TurnClock.TURN_MS - 1000 - TurnClock.WARN_MS - 500); assertEquals(false, r.last().warn)
        r.run(1000); assertEquals(true, r.last().warn)
        r.run(TurnClock.WARN_MS)
        assertEquals(listOf(Kind.TURN to "InputPassPriority"), r.acts)
        assertEquals(listOf(1 to null as Int?), r.strikes)
    }

    @Test fun pausesAndResumes() {
        val r = Rig(snap())
        r.run(10000); val before = r.last().remaining
        r.held = true; r.run(60000)
        assertEquals(true, r.last().paused); assertTrue(kotlin.math.abs(r.last().remaining - before) <= 1300)
        r.held = false; r.run(5000); assertTrue(r.last().remaining < before - 3500 && r.last().remaining > before - 6500)
        assertTrue(r.acts.isEmpty())
    }

    @Test fun promptInTurnHasItsOwnTime() {
        val r = Rig(snap())
        r.run(20000); val turnLeft = r.last().remaining
        r.s = snap(input = "InputSelectTargets", revision = 2); r.run(250)
        assertEquals(Kind.PROMPT, r.last().kind); assertTrue(r.last().remaining > TurnClock.PROMPT_MS - 1000)
        r.run(10000)
        r.s = snap(revision = 3); r.run(250)
        assertEquals(Kind.TURN, r.last().kind); assertTrue(kotlin.math.abs(r.last().remaining - turnLeft) <= 1300)
    }

    @Test fun touchRestartsPromptNotTurn() {
        val r = Rig(snap(input = "InputBlock"))
        r.run(25000); assertTrue(r.last().remaining <= 6200)
        r.timer.poke(); r.run(250); assertTrue(r.last().remaining > TurnClock.PROMPT_MS - 1000)
        val t = Rig(snap()); t.run(30000); val left = t.last().remaining; t.timer.poke(); t.run(250)
        assertTrue(t.last().remaining <= left)
    }

    @Test fun soloPassesFriendConcedesOnThird() {
        val solo = Rig(snap())
        for (turn in 5 until 10) { solo.s = snap(turn = turn, revision = turn.toLong()); solo.run(TurnClock.TURN_MS + 500) }
        assertEquals(5, solo.acts.size); assertEquals(0, solo.conceded)
        val friend = Rig(snap(), friend = true)
        for (turn in 5 until 8) { friend.s = snap(turn = turn, revision = turn.toLong()); friend.run(TurnClock.TURN_MS + 500) }
        assertEquals(listOf(1 to 3, 2 to 3, 3 to 3), friend.strikes.map { it.first to it.second })
        assertEquals(2, friend.acts.size); assertEquals(1, friend.conceded)
    }

    @Test fun touchBetweenMissesKeepsMatch() {
        val r = Rig(snap(), friend = true)
        for (turn in 5 until 9) { r.s = snap(turn = turn, revision = turn.toLong()); r.run(TurnClock.TURN_MS + 500); if (turn == 6) r.timer.poke() }
        assertEquals(0, r.conceded)
    }

    @Test fun friendsTurnNeverActs() {
        val r = Rig(snap(active = base.viewer + 1, awaiting = false), friend = true)
        r.run(TurnClock.TURN_MS + 5000)
        assertEquals(false, r.last().own); assertTrue(r.acts.isEmpty()); assertEquals(0, r.conceded)
    }

    @Test fun refusedAnswerRetriesAFewTimes() {
        val r = Rig(snap(input = "InputAttack"), refuse = true)
        r.run(100_000)
        assertTrue("tried ${r.calls} times", r.calls in 1..3)
    }

    @Test fun safeAnswers() {
        val w = TurnClock.Window("x", Kind.PROMPT, 1)
        assertEquals(TurnClock.Answer.Cancel, TurnClock.answer(w, snap(input = "InputSelectTargets")))
        assertEquals(TurnClock.Answer.Cancel, TurnClock.answer(w, snap(input = "InputPayManaOfCostPayment")))
        assertEquals(TurnClock.Answer.Ok, TurnClock.answer(w, snap(input = "InputAttack")))
        assertEquals(TurnClock.Answer.Cancel, TurnClock.answer(TurnClock.Window("t", Kind.TURN, 1), snap()))
    }

    /** test-play-forge-host-clock.mjs: a friend match draws the host's clock and never answers or concedes for itself. */
    @Test fun friendDrawsHostClock() {
        val r = Rig(snap(), friend = true)
        r.host = true to (dev.cardstashy.nativeplay.engine.Afk(true, "turn", 90_000, 60_000, 0, 3) to r.t)
        r.run(5000)
        assertEquals(Kind.TURN, r.last().kind); assertTrue(r.last().remaining in 54_000..56_000)
        r.host = true to (dev.cardstashy.nativeplay.engine.Afk(true, "turn", 90_000, 1_000, 2, 3) to r.t)
        r.run(120_000)
        assertTrue("never answers locally", r.acts.isEmpty()); assertEquals(0, r.conceded)
        assertEquals(listOf(2 to 3), r.strikes.map { it.first to it.second })
        r.host = true to null; r.run(250); assertNull(r.changes.last())
        // A host without a clock: the local clock runs as before.
        val local = Rig(snap(), friend = true); local.run(TurnClock.TURN_MS + 500); assertEquals(1, local.acts.size)
    }

    /** E3c: a prompt nothing can answer is never replied to; the clock asks to leave, once, and does not loop. */
    @Test fun deadEndPromptLeavesAndNeverRetriesAReply() {
        val p = dev.cardstashy.nativeplay.engine.Prompt(id = 7, method = "manipulateCardList", message = "", min = 1, max = 1, options = emptyList(), supported = false, ordered = false,
            destinationIndexes = emptyList(), assignAmount = null, assignMaxima = emptyList(), maySkip = false, assignLethal = emptyList(), defenderIndex = null, supportedExact = false)
        val dead = snap().copy(prompt = p)
        assertEquals(true, p.deadEnd)
        assertEquals(TurnClock.Answer.Leave, TurnClock.answer(TurnClock.waitingOn(dead)!!, dead))
        // The controller stops handing the clock a board once it has left (snapshot null), so one expiry is one Leave and nothing after.
        var left = false; var leaves = 0; var replies = 0; var t = 1000L
        val timer = TurnClock.Timer(snapshot = { if (left) null else dead }, act = { w, x, done ->
            when (TurnClock.answer(w, x)) { TurnClock.Answer.Leave -> { leaves++; left = true }; else -> replies++ }; done(true) }, now = { t })
        repeat(((TurnClock.PROMPT_MS + 20_000) / 250).toInt()) { t += 250; timer.tick() }
        assertEquals(1, leaves); assertEquals(0, replies)
    }

    /** U1 (Thor 10 Nov): the cleanup discard has no prompt and no input name. Against the CPU the clock holds and asks; with a
     *  friend it discards the newest card and counts the miss. */
    @Test fun cleanupDiscard() {
        val hand = base.me.hand
        require(hand.isNotEmpty())
        val msg = "Cleanup Phase\nSelect 1 card(s) to discard to bring your hand down to the maximum of 7 cards."
        val d = snap(input = "").copy(message = msg, phase = "CLEANUP", selection = base.selection.copy(cards = hand.map { it.id }.toSet(), chosenCards = emptySet(), actionable = emptySet(), min = 1, max = 1))
        assertEquals(1, TurnClock.discardCount(d)); assertEquals(7, TurnClock.discardTo(d))
        assertEquals("discard:5", TurnClock.waitingOn(d)!!.id)
        assertEquals(TurnClock.Answer.Discard(hand.last().id, hand.last().name), TurnClock.answer(TurnClock.waitingOn(d)!!, d))
        assertEquals("Discard down to 7: tap 1 card", dev.cardstashy.nativeplay.ui.askLine(d))
        // Against the CPU: nothing is discarded for you, no missed turn, one nag.
        var nags = 0; var acts = 0; var t = 1000L
        val shown = mutableListOf<TurnClock.Shown?>()
        val cpu = TurnClock.Timer(snapshot = { d }, act = { _, _, done -> acts++; done(true) }, onNag = { nags++ }, onChange = { shown += it }, now = { t })
        // Thor 0.4.56 (finding D): two shots 8 s apart both read 30. The discard window counts down while it is open ...
        repeat((8000 / 250)) { t += 250; cpu.tick() }
        shown.last()!!.let { assertTrue("8 s in: ${it.remaining} ms left", it.remaining in 21_000L..23_000L); assertEquals(false, it.paused) }
        repeat(((TurnClock.PROMPT_MS + 5000 - 8000) / 250).toInt()) { t += 250; cpu.tick() }
        // ... and once it ran out against the CPU it reads 0, held: never its full 30 s again.
        shown.last()!!.let { assertEquals(0L, it.remaining); assertEquals(true, it.paused) }
        assertEquals(0, acts); assertEquals(1, nags); assertEquals(0, cpu.strikes())
        // With a friend: the clock acts (the controller discards the newest card) and the miss counts.
        val r = Rig(d, friend = true); r.run(TurnClock.PROMPT_MS + 500)
        assertEquals(1, r.acts.size); assertEquals(1, r.strikes.size)
        // Not a discard: an ordinary choose-cards input is untouched.
        assertNull(TurnClock.discardCount(d.copy(message = "Select 1 creature to sacrifice.")))
    }
}
