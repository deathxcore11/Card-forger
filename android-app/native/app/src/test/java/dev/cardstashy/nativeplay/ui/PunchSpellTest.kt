package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.StackItem
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Match punch P6 (specs/match-punch-brief.md, "Targeted spell"): what the board plans when a spell with a target resolves. Fire
 * (110 + 130), the impact on the frame the streak lands, the spent spell leaving for its owner's square 160 later, and a card it
 * killed breaking 300 after the impact. A friendly spell has no shake and no freeze. Abilities keep their light thread.
 */
class PunchSpellTest {
    private val was = Motion.still
    @After fun back() { Motion.still = was }

    private fun card(id: Int, who: Int, name: String, zone: String = "Battlefield", type: String = "Creature", cost: String = "") =
        """{"id":$id,"zone":"$zone","owner":$who,"controller":$who,"hidden":false,"name":"$name","type":"$type","manaCost":"$cost","power":2,"toughness":2}"""
    private fun snap(rev: Int, theirs: String, myGrave: String = "", theirGrave: String = "") = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":$rev,"phase":"MAIN1",
        "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[${card(5, 1, "Bear")}]},"Graveyard":{"cards":[$myGrave]}}},
                   {"id":2,"life":20,"zones":{"Battlefield":{"cards":[$theirs]},"Graveyard":{"cards":[$theirGrave]}}}]}""")!!
    private fun anchors() = Anchors().apply {
        putRect("c5", Rect(100f, 600f, 230f, 700f)); putRect("c7", Rect(100f, 300f, 230f, 400f)); putRect("stackcard", Rect(900f, 300f, 1000f, 440f))
        putRect("grave1", Rect(30f, 830f, 60f, 870f)); putRect("grave2", Rect(30f, 130f, 60f, 170f))
    }
    private fun spell(id: Int, name: String, cost: String): Card = MatchState.parse("""{"status":"running","viewer":1,"players":[{"id":1,"isViewer":true,"zones":{"Hand":{"count":1,"cards":[${card(id, 1, name, "Stack", "Instant", cost)}]}}},{"id":2,"zones":{}}]}""")!!.me.hand.first()
    private fun play(a: MatchState, b: MatchState): Battlefield { Motion.still = false; val fx = Battlefield(); val an = anchors(); fx.take(a, an); fx.take(b, an); return fx }

    @Test fun aBoltFiresLandsKillsAndGoesToItsOwnersSquare() {
        val bolt = spell(30, "Lightning Bolt", "{R}")
        val a = snap(1, card(7, 2, "Goblin")).copy(stack = listOf(StackItem(900, "Lightning Bolt deals 3 damage to any target.", bolt, 1, targets = listOf(Ref("card", 7, "Goblin")))))
        val b = snap(2, "", myGrave = card(30, 1, "Lightning Bolt", "Graveyard", "Instant", "{R}"), theirGrave = card(7, 2, "Goblin", "Graveyard"))
        val fx = play(a, b)
        fun one(kind: Fx) = fx.items.single { it.kind == kind }
        val fire = one(Fx.FIRE); assertEquals(0L, fire.t0); assertEquals(FIRE_MS, fire.dur); assertEquals("c7", fire.toKey); assertEquals(240L, FIRE_MS)
        val hit = one(Fx.BOLT); assertEquals("on the frame the streak lands", FIRE_MS, hit.t0); assertEquals(7, hit.card); assertEquals(1f, hit.power, 0f)
        assertEquals("in the spell's own colour", frameTone(listOf('R')).first, hit.tone)
        val spent = one(Fx.SPENT); assertEquals(FIRE_MS + 160L, spent.t0); assertEquals("grave1", spent.toKey); assertEquals(30, spent.ghost?.id); assertEquals(1, spent.level)
        // The Goblin breaks 300 after the impact and its embers go to the CPU's square, not after everything else.
        val death = one(Fx.DEATH); assertEquals(FIRE_MS + 300L, death.t0); assertEquals("grave2", death.toKey)
        assertEquals(FIRE_MS + 540L, one(Fx.EMBERS).t0)
        assertTrue("the old light thread is not played as well", fx.items.none { it.kind == Fx.RESOLVE })
    }

    @Test fun aFriendlySpellGlowsWithNoShakeAndNoFreeze() {
        val growth = spell(31, "Giant Growth", "{G}")
        val a = snap(1, card(7, 2, "Goblin")).copy(stack = listOf(StackItem(901, "Target creature gets +3/+3 until end of turn.", growth, 1, targets = listOf(Ref("card", 5, "Bear")))))
        val b = snap(2, card(7, 2, "Goblin"), myGrave = card(31, 1, "Giant Growth", "Graveyard", "Instant", "{G}"))
        val fx = play(a, b)
        val hit = fx.items.single { it.kind == Fx.BOLT }
        assertEquals(5, hit.card); assertEquals("power 0: no freeze, no shake, no spikes", 0f, hit.power, 0f); assertEquals(TRIG_GREEN, hit.tone)
        assertTrue(fx.items.none { it.kind == Fx.DEATH })
        // The effect clock is never held by it.
        fx.now.longValue = FIRE_MS + 10
        assertEquals(1000L, fx.effectClock(1000L)); assertEquals(1100L, fx.effectClock(1100L))
    }

    @Test fun anAbilityKeepsItsThreadAndAnUntargetedSpellStillLeavesForTheSquare() {
        val bear = snap(1, "").me.battlefield.first()
        val a = snap(1, card(7, 2, "Goblin")).copy(stack = listOf(StackItem(902, "Bear deals 1 damage to any target.", bear, 1, ability = true, targets = listOf(Ref("card", 7, "Goblin")))))
        val fx = play(a, snap(2, card(7, 2, "Goblin")))
        assertTrue(fx.items.none { it.kind == Fx.FIRE || it.kind == Fx.BOLT || it.kind == Fx.SPENT })
        assertEquals("c7", fx.items.single { it.kind == Fx.RESOLVE }.toKey)
        val opt = spell(32, "Opt", "{U}")
        val fx2 = play(snap(1, "").copy(stack = listOf(StackItem(903, "Scry 1. Draw a card.", opt, 1))), snap(2, "", myGrave = card(32, 1, "Opt", "Graveyard", "Instant", "{U}")))
        val spent = fx2.items.single { it.kind == Fx.SPENT }
        assertEquals(0L, spent.t0); assertEquals("grave1", spent.toKey)
        assertTrue(fx2.items.none { it.kind == Fx.FIRE })
    }

    @Test fun aLockedThreadMakesItsTargetFlinchOnce() {
        Motion.still = false
        val fx = Battlefield(); fx.now.longValue = 500L
        fx.aimLock("c7", Color.Red)
        val aim = fx.items.single(); assertEquals(Fx.AIM, aim.kind); assertEquals(7, aim.card); assertEquals(500L, aim.t0); assertEquals(AIM_MS, aim.dur); assertEquals(1, aim.level)
        fx.aimLock("orb2", Color.Red)
        assertEquals("a player is ringed, no tile flinches", null, fx.items.last().card)
        fx.reduced = true; fx.aimLock("c5", Color.Red)
        assertEquals("reduce motion: nothing", 2, fx.items.size)
    }
}
