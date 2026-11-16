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
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn

/**
 * Live 0.4.59 (Randall, 11 Nov): the CPU's land flew to the board, then flew to the same spot again. The host pauses the CPU on its
 * land play and publishes the board before it writes the land event (onCpuLand runs before logLand), so one board ends on the
 * land's move from the hand and the next brings the "land" event. The land travels once, from the first of the two boards.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class CpuLandOnceTest {
    private fun card(id: Int, name: String, controller: Int) =
        Card(id = id, zone = "Battlefield", owner = controller, controller = controller, hidden = false, name = name, type = "Basic Land — Forest", manaCost = "", text = "",
            power = null, toughness = null, tapped = false, attacking = false, blocking = false,
            damage = 0, summoningSick = false, token = false, counters = emptyMap(), keywords = emptyList(), attachedTo = null, blockingIds = emptyList())
    private fun ev(seq: Long, type: String, player: Int?, card: Ref, from: String? = null, to: String? = null) =
        GameEvent(seq, type, 6, "MAIN1", player, card, null, null, emptyList(), emptyList(), emptyList(), from, to, null, null, null, null)

    @Suppress("UNCHECKED_CAST")
    private fun <T> field(c: MatchController, name: String) = MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.get(c) as T
    private fun set(c: MatchController, name: String, v: Any?) = MatchController::class.java.getDeclaredField(name).apply { isAccessible = true }.set(c, v)

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val cpu = base.cpu.id
    private val forest = card(960, "Forest", cpu)
    private val f = Ref("card", 960, "Forest")
    private fun board(withLand: Boolean, rev: Long, events: List<GameEvent>) = base.copy(busy = true, prompt = null, stack = emptyList(), events = events, revision = rev,
        activePlayer = cpu, players = base.players.map { p -> if (p.id == cpu) p.copy(battlefield = if (withLand) listOf(forest) else emptyList()) else p })
    private val move = ev(101, "zone", cpu, f, from = "Hand", to = "Battlefield")
    private val land = ev(102, "land", cpu, f)

    @Test fun theBoardThatEndsOnTheMoveTellsThePlayAndTheLandEventAfterItDoesNothing() {
        val before = board(false, 10, emptyList())
        val paused = board(true, 11, listOf(move))
        val plan1 = Director.plan(paused, paused.events, before = before)
        assertEquals("the move is the play: one land step", listOf(Director.Leg.TO_GROUP), plan1.mapNotNull { it.travel?.leg })
        assertEquals("CPU plays Forest", plan1.single { it.travel != null }.beat?.title)
        val next = board(true, 12, listOf(move, land))
        assertTrue("the land event after it: nothing more", Director.plan(next, listOf(land), before = paused).none { it.travel != null || it.beat != null })
        // One board with both events: one play, from the land event, as before.
        val both = Director.plan(next, listOf(move, land), before = before)
        assertEquals(1, both.count { it.travel?.leg == Director.Leg.TO_GROUP })
        // A land put onto the board from the hand by a spell (more events after its move) is not told as a play.
        val put = board(true, 12, listOf(move, ev(103, "resolve", null, f)))
        assertTrue(Director.plan(put, put.events, before = before).none { it.travel != null })
    }

    @Test fun onTheTableTheLandFliesOnce() {
        val before = board(false, 10, emptyList())
        val paused = board(true, 11, listOf(move))
        val next = board(true, 12, listOf(move, land))
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

        val flights = LinkedHashSet<Any>()
        var onBoardBeforeFlight = false
        for (t in 0L..5000L step 10) {
            ShadowLooper.idleMainLooper(10, java.util.concurrent.TimeUnit.MILLISECONDS)
            val m = c.travel.value
            if (m != null && m.travel.cardId == 960) flights += m
            val s = c.shown.value ?: continue
            if (flights.isEmpty() && s.cpu.battlefield.any { it.id == 960 }) onBoardBeforeFlight = true
        }
        scope.cancel()
        assertEquals("the land travels once", 1, flights.size)
        assertTrue("it is off the board until its flight", !onBoardBeforeFlight)
        assertTrue("it ends on the board", c.shown.value!!.cpu.battlefield.any { it.id == 960 })
    }
}
