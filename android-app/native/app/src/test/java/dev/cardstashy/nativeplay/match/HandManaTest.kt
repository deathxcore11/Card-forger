package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Match punch P2b (Randall 11 Nov: "you can manual tap lands first to drop a card and if no card is dropped then you can take back
 * the taps"): the behaviour is Forge's and is not rebuilt. The look is planned as one step each: lands tapped by hand send their
 * light to the floating mana; a card cast with floating mana draws its streaks from the pool; Undo turns the lands back.
 */
class HandManaTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val me = base.viewer
    private fun land(id: Int, tapped: Boolean) = Card(id = id, zone = "Battlefield", owner = me, controller = me, hidden = false, name = "Forest", type = "Basic Land — Forest", manaCost = "", text = "",
        power = null, toughness = null, tapped = tapped, attacking = false, blocking = false, damage = 0, summoningSick = false, token = false, counters = emptyMap(),
        keywords = emptyList(), attachedTo = null, blockingIds = emptyList())
    private fun board(tapped: Boolean, pool: Int, rev: Long) = base.copy(prompt = null, stack = emptyList(), events = emptyList(), revision = rev, activePlayer = me,
        players = base.players.map { p -> if (p.id == me) p.copy(battlefield = listOf(land(40, tapped), land(41, tapped)), mana = if (pool > 0) mapOf("G" to pool) else emptyMap()) else p })
    private fun travels(steps: List<Director.Step>) = steps.mapNotNull { it.travel }

    @Test fun twoLandsTappedByHandAreOneStepToThePool() {
        val steps = Director.plan(board(true, 2, 11), emptyList(), before = board(false, 0, 10))
        val t = travels(steps).single()
        assertEquals(Director.Leg.TO_POOL, t.leg); assertEquals(listOf(40, 41), t.taps); assertEquals("manapool", t.toKey)
        assertEquals(Director.Kind.MANA, steps.single { it.travel != null }.kind)
        assertEquals(Director.poolMs(2), t.ms)
        // Nothing tapped, nothing planned.
        assertTrue(travels(Director.plan(board(false, 0, 11), emptyList(), before = board(false, 0, 10))).isEmpty())
    }

    @Test fun aCardCastWithFloatingManaDrawsItsStreaksFromThePool() {
        val before = board(true, 2, 11)
        val bears = Ref("card", 950, "Grizzly Bears")
        val cast = GameEvent(201, "cast", 5, "MAIN1", me, null, bears, null, emptyList(), emptyList(), emptyList(), null, null, null, null, null, null, stackId = 7)
        val steps = Director.plan(board(true, 0, 12), listOf(cast), before = before)
        val pay = travels(steps).single { it.leg == Director.Leg.TAPS }
        assertEquals("two streaks from the pool, no land turns again", 2, pay.pool); assertTrue(pay.taps.isEmpty())
        assertEquals(Director.payMs(2), pay.ms)
        assertEquals("paid in full: the burst is full size", 1f, travels(steps).single { it.leg == Director.Leg.REST }.power)
        assertTrue("no hand-tap or undo step beside it", travels(steps).none { it.leg == Director.Leg.TO_POOL || it.leg == Director.Leg.UNTAP })
    }

    @Test fun undoTurnsTheLandsBackInOneStep() {
        val steps = Director.plan(board(false, 0, 12), emptyList(), before = board(true, 2, 11))
        val t = travels(steps).single()
        assertEquals(Director.Leg.UNTAP, t.leg); assertEquals(listOf(40, 41), t.taps); assertEquals(Director.UNDO_MS, t.ms)
        // Your untap step is not an Undo: a new turn readies the lands with no step of this kind.
        val turn = GameEvent(202, "turn", 6, "UNTAP", me, null, null, null, emptyList(), emptyList(), emptyList(), null, null, null, null, null, null)
        assertTrue(travels(Director.plan(board(false, 0, 13).copy(turn = base.turn + 2), listOf(turn), before = board(true, 2, 11))).none { it.leg == Director.Leg.UNTAP })
    }
}
