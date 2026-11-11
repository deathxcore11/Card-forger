package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper
import java.time.Duration
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn

/**
 * 0.4.59 T5 (the cast travels), the controller's side: your creature spell Forge cast and resolved in one poll plays as its legs,
 * one after another. While its lands tap and it flies, it is on neither the board nor the stack until it goes up; it rests on the
 * stack at least 900 ms (an item put up for it, since no snapshot showed it); it is on the board only once its leg to the slot starts.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class CastTravelControllerTest {
    private fun card(id: Int, name: String, type: String, controller: Int, tapped: Boolean = false, zone: String = "Battlefield") =
        Card(id = id, zone = zone, owner = controller, controller = controller, hidden = false, name = name, type = type, manaCost = "", text = "",
            power = if (type.contains("Creature")) 2 else null, toughness = if (type.contains("Creature")) 2 else null, tapped = tapped, attacking = false, blocking = false,
            damage = 0, summoningSick = false, token = false, counters = emptyMap(), keywords = emptyList(), attachedTo = null, blockingIds = emptyList())
    private var seq = 100L
    private fun ev(type: String, player: Int?, card: Ref? = null, source: Ref? = null, from: String? = null, to: String? = null, stackId: Int? = null) =
        GameEvent(++seq, type, 5, "MAIN1", player, card, source, null, emptyList(), emptyList(), emptyList(), from, to, null, null, null, null, stackId = stackId)

    @Suppress("UNCHECKED_CAST")
    private fun <T> field(c: MatchController, name: String) = MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.get(c) as T
    private fun set(c: MatchController, name: String, v: Any?) = MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.set(c, v)

    @Test fun yourCreatureTapsFliesRestsAndLandsInOrder() {
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val me = base.viewer
        val forests = listOf(card(40, "Forest", "Basic Land — Forest", me), card(41, "Forest", "Basic Land — Forest", me))
        val bears = card(950, "Grizzly Bears", "Creature — Bear", me)
        fun board(mine: List<Card>, hand: List<Card>) = base.copy(busy = true, prompt = null, stack = emptyList(), events = emptyList(),
            players = base.players.map { p -> if (p.id == me) p.copy(battlefield = mine, hand = hand) else p.copy(battlefield = emptyList()) })
        val before = board(forests, listOf(bears.copy(zone = "Hand"))).copy(revision = 10)
        val b = Ref("card", 950, "Grizzly Bears")
        val after = board(forests.map { it.copy(tapped = true) } + bears, emptyList()).copy(revision = 11, events = listOf(
            ev("zone", null, card = b, from = "Hand", to = "Stack"), ev("cast", me, source = b, stackId = 7),
            ev("zone", me, card = b, from = "Stack", to = "Battlefield"), ev("resolve", null, source = b)))

        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val c = MatchController(scope, "{}")
        set(c, "gatePassed", true); set(c, "mulliganSeen", true); set(c, "answeredMulligan", true); set(c, "lastSeq", 100L)
        set(c, "latest", after)
        field<MutableStateFlow<MatchState?>>(c, "_shown").value = before
        field<MutableStateFlow<Stage>>(c, "_stage").value = Stage.PLAYING
        field<java.util.concurrent.atomic.AtomicInteger>(c, "queue").incrementAndGet()
        field<Channel<MatchState>>(c, "snapshots").trySend(after)
        val play = MatchController::class.java.getDeclaredMethod("play", kotlin.coroutines.Continuation::class.java).apply { isAccessible = true }
        scope.launch { suspendCoroutineUninterceptedOrReturn<Any?> { cont -> play.invoke(c, cont) } }

        // Sample the table every 10 ms: the leg playing, and where the bears are.
        data class Frame(val t: Long, val leg: Director.Leg?, val onBoard: Boolean, val onStack: Boolean, val tapped: Int)
        val frames = ArrayList<Frame>()
        for (t in 0L..3000L step 10) {
            ShadowLooper.idleMainLooper(10, java.util.concurrent.TimeUnit.MILLISECONDS)
            val s = c.shown.value ?: continue
            frames += Frame(t, c.travel.value?.travel?.leg, s.me.battlefield.any { it.id == 950 }, s.stack.any { it.source?.id == 950 }, s.me.battlefield.count { it.tapped })
        }
        scope.cancel()

        val order = frames.mapNotNull { it.leg }.distinct()
        assertEquals(listOf(Director.Leg.TO_STACK, Director.Leg.TAPS, Director.Leg.REST, Director.Leg.TO_SLOT), order)
        // Match punch P2: it goes up first, and its lands pay into it while it is on the stack.
        for (f in frames.filter { it.leg == Director.Leg.TO_STACK || it.leg == Director.Leg.TAPS || it.leg == Director.Leg.REST }) assertTrue("up: on the stack only $f", !f.onBoard && f.onStack)
        assertTrue("the lands are untapped until the pay", frames.filter { it.leg == Director.Leg.TO_STACK }.all { it.tapped == 0 })
        for (f in frames.filter { it.leg == Director.Leg.TO_SLOT }) assertTrue("landing: on the board, off the stack $f", f.onBoard && !f.onStack)
        // The rest holds its burst and read (370 + 525), the flight 370; sampled every 10 ms, so each may read one sample short.
        fun span(l: Director.Leg) = frames.filter { it.leg == l }.let { it.last().t - it.first().t + 10 }
        assertTrue("rest ${span(Director.Leg.REST)} ms", span(Director.Leg.REST) >= Director.BURST_MS + Director.CAST_READ_MS - 10)
        assertTrue("flight ${span(Director.Leg.TO_STACK)} ms", span(Director.Leg.TO_STACK) >= Director.TO_STACK_MS - 10)
        // Then the newest board as Forge sent it, nothing travelling.
        val last = frames.last()
        assertTrue("end $last", last.leg == null && last.onBoard && !last.onStack && last.tapped == 2)
    }

    /**
     * Match punch P0: the host pauses the CPU on its cast and publishes the board, and Forge runs its handlers for one event in no
     * fixed order, so that board can end on the card's move to the stack with the cast event only in the next board. The spell
     * flies to the stack once, from the first of the two boards, and is not on the stack before its flight.
     */
    @Test fun aCpuSpellSplitOverTwoBoardsFliesToTheStackOnce() {
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val cpu = base.cpu.id
        val bears = card(970, "Grizzly Bears", "Creature — Bear", cpu, zone = "Hand")
        val b = Ref("card", 970, "Grizzly Bears")
        val item = dev.cardstashy.nativeplay.engine.StackItem(77, "Grizzly Bears", bears.copy(zone = "Stack"), cpu)
        fun board(rev: Long, onStack: Boolean, events: List<GameEvent>) = base.copy(busy = true, prompt = null, revision = rev, activePlayer = cpu, events = events,
            stack = if (onStack) listOf(item) else emptyList(),
            players = base.players.map { p -> if (p.id == cpu) p.copy(battlefield = emptyList(), hand = if (onStack) emptyList() else listOf(bears)) else p.copy(battlefield = emptyList()) })
        val move = ev("zone", cpu, card = b, from = "Hand", to = "Stack")
        val cast = ev("cast", cpu, source = b, stackId = 77)
        val before = board(10, false, emptyList())
        val paused = board(11, true, listOf(move))
        val next = board(12, true, listOf(move, cast))

        // The plan: the move is the cast (its think, flight, pop and rest); the cast event after it adds nothing.
        val plan1 = Director.plan(paused, paused.events, before = before)
        assertEquals(listOf(Director.Leg.TO_STACK, Director.Leg.POP, Director.Leg.REST), plan1.mapNotNull { it.travel?.leg })
        assertEquals("CPU casts Grizzly Bears", plan1.single { it.beat != null }.beat?.title)
        assertEquals(77, plan1.first { it.travel != null }.travel?.stackId)
        assertTrue(Director.plan(next, listOf(cast), before = paused).none { it.travel != null || it.beat != null })
        // One board with both events (the other handler order): one flight, as before.
        assertEquals(1, Director.plan(next, listOf(move, cast), before = before).count { it.travel?.leg == Director.Leg.TO_STACK })

        // On the table: one flight of the card to the stack, and it is not on the stack before it.
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val c = MatchController(scope, "{}")
        set(c, "gatePassed", true); set(c, "mulliganSeen", true); set(c, "answeredMulligan", true); set(c, "lastSeq", 100L)
        set(c, "latest", next)
        field<MutableStateFlow<MatchState?>>(c, "_shown").value = before
        field<MutableStateFlow<Stage>>(c, "_stage").value = Stage.PLAYING
        field<java.util.concurrent.atomic.AtomicInteger>(c, "queue").addAndGet(2)
        field<Channel<MatchState>>(c, "snapshots").trySend(paused)
        field<Channel<MatchState>>(c, "snapshots").trySend(next)
        val play = MatchController::class.java.getDeclaredMethod("play", kotlin.coroutines.Continuation::class.java).apply { isAccessible = true }
        scope.launch { suspendCoroutineUninterceptedOrReturn<Any?> { cont -> play.invoke(c, cont) } }
        val flights = ArrayList<Any>()
        var lastFlight: Any? = null
        var upBeforeFlight = false
        for (t in 0L..6000L step 10) {
            ShadowLooper.idleMainLooper(10, java.util.concurrent.TimeUnit.MILLISECONDS)
            val m = c.travel.value?.takeIf { it.travel.cardId == 970 && it.travel.leg == Director.Leg.TO_STACK }
            if (m != null && m !== lastFlight) flights += m
            lastFlight = m
            val s = c.shown.value ?: continue
            if (flights.isEmpty() && s.stack.any { it.source?.id == 970 }) upBeforeFlight = true
        }
        scope.cancel()
        assertEquals("the spell flies to the stack once", 1, flights.size)
        assertTrue("it is not on the stack before its flight", !upBeforeFlight)
        assertTrue("it ends on the stack", c.shown.value!!.stack.any { it.source?.id == 970 })
    }
}
