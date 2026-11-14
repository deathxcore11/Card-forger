package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Match punch P5 (specs/match-punch-brief.md, "Attack, block, clash, kill, face hit"): what the board plans for a declare, a clash
 * that kills and a hit to the face, at the punch timings, and the life pill ticking down from the frame the blow lands.
 */
class PunchCombatTest {
    private val was = Motion.still
    @After fun back() { Motion.still = was }

    private fun card(id: Int, who: Int, name: String, pt: Int, extra: String = "") =
        """{"id":$id,"zone":"Battlefield","owner":$who,"controller":$who,"hidden":false,"name":"$name","type":"Creature","power":$pt,"toughness":$pt$extra}"""
    private fun snap(rev: Int, phase: String, mine: String, theirs: String, grave: String = "", life: Int = 20) = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":$rev,"phase":"$phase",
        "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[$mine]}}},
                   {"id":2,"life":$life,"zones":{"Battlefield":{"cards":[$theirs]},"Graveyard":{"cards":[$grave]}}}]}""")!!
    private fun anchors() = Anchors().apply {
        putRect("c5", Rect(100f, 600f, 230f, 700f)); putRect("c6", Rect(300f, 600f, 430f, 700f)); putRect("c7", Rect(100f, 300f, 230f, 400f))
        putRect("orb1", Rect(20f, 800f, 120f, 900f)); putRect("orb2", Rect(20f, 20f, 120f, 120f)); putRect("grave2", Rect(30f, 130f, 60f, 170f))
    }

    @Test fun newAttackersStepUpOneAfterAnother() {
        Motion.still = false
        val a = snap(1, "COMBAT_BEGIN", card(5, 1, "Bear", 2) + "," + card(6, 1, "Wolf", 3), card(7, 2, "Goblin", 1))
        val b = snap(2, "COMBAT_DECLARE_ATTACKERS", card(5, 1, "Bear", 2, ""","attacking":true""") + "," + card(6, 1, "Wolf", 3, ""","attacking":true"""), card(7, 2, "Goblin", 1))
        assertEquals(listOf(5, 6), declareOrder(a, b))
        assertEquals("one already attacking is not declared again", listOf(6), declareOrder(snap(1, "COMBAT_BEGIN", card(5, 1, "Bear", 2, ""","attacking":true""") + "," + card(6, 1, "Wolf", 3), ""), b))
        val fx = Battlefield(); val an = anchors()
        fx.take(a, an); fx.take(b, an)
        val ups = fx.items.filter { it.kind == Fx.ATTACK }
        assertEquals(listOf(5 to 0L, 6 to DECLARE_GAP_MS), ups.map { it.card to it.t0 })
        assertTrue("a level 1 ring, 300 ms: nothing waits on it", ups.all { it.level == 1 && it.dur == 300L })
        // The tile grows 8 % as it steps; the growth comes off the step, so its leading edge goes no further than before.
        assertEquals(16f, attackShift(1f, 20f, 100f), .001f)
        assertEquals(20f, attackShift(1f, 20f, 100f) + 100f * ATTACK_GROW / 2f, .001f)
        assertEquals("rows too close to step: it stays put", 0f, attackShift(1f, 0f, 100f), .001f)
    }

    @Test fun aClashThatKillsThenAFaceHitAtThePunchTimings() {
        Motion.still = false
        val bear = card(5, 1, "Bear", 2, ""","attacking":true"""); val wolf = card(6, 1, "Wolf", 3, ""","attacking":true""")
        val goblin = card(7, 2, "Goblin", 1, ""","blocking":true,"blockingIds":[5]""")
        val a = snap(1, "COMBAT_DECLARE_BLOCKERS", "$bear,$wolf", goblin)
        val b = snap(2, "COMBAT_DAMAGE", card(5, 1, "Bear", 2, ""","attacking":true,"damage":1""") + "," + wolf, "",
            grave = """{"id":7,"zone":"Graveyard","owner":2,"controller":2,"hidden":false,"name":"Goblin","type":"Creature","power":1,"toughness":1}""", life = 17)
        val fx = Battlefield(); val an = anchors()
        fx.take(a, an); fx.take(b, an)
        fun one(kind: Fx, pick: (FxItem) -> Boolean = { true }) = fx.items.single { it.kind == kind && pick(it) }
        // The clash: lit for 140, then pull back 150, strike 85, freeze 100 (contact at 235, the burst at 335), 800 in all.
        val clash = one(Fx.LUNGE) { it.card == 5 }
        assertEquals("c7", clash.toKey); assertEquals(STAGE_LEAD_MS, clash.t0); assertEquals(Strike.CLASH_MS, clash.dur)
        assertEquals(235f, Strike.hit(false), 0f); assertEquals(335f, Strike.after(false), 0f)
        val lands = STAGE_LEAD_MS + 335L
        assertEquals("both numbers on the frame the freeze ends", setOf(5 to lands, 7 to lands), fx.items.filter { it.kind == Fx.DAMAGE }.map { it.card to it.t0 }.toSet())
        // The kill: shudder and break on that frame (440, holds the table); its embers leave 240 later and hold nothing.
        val death = one(Fx.DEATH); assertEquals(lands, death.t0); assertEquals(DEATH_MS, death.dur); assertEquals("grave2", death.toKey)
        val embers = one(Fx.EMBERS); assertEquals(lands + 240L, embers.t0); assertEquals(1, embers.level); assertEquals("grave2", embers.toKey)
        // The face hit follows the clash's pair: pull back 160, fly 200, freeze 125 (the burst at 485), 1100 in all.
        val face = one(Fx.LUNGE) { it.card == 6 }
        val second = STAGE_LEAD_MS + Strike.CLASH_MS
        assertEquals("orb2", face.toKey); assertEquals(second + STAGE_LEAD_MS, face.t0); assertEquals(Strike.FACE_MS, face.dur)
        assertEquals(485f, Strike.after(true), 0f)
        val life = one(Fx.LIFE); val blow = second + STAGE_LEAD_MS + 485L
        assertEquals(blow, life.t0); assertEquals(3, life.points); assertEquals("−3", life.label)
        // The pill: 20 until the blow lands, then one point every 90 ms.
        fun shown(at: Long): Int { fx.now.longValue = at; return fx.lifeShown(2, 17) }
        assertEquals(20, shown(0)); assertEquals(20, shown(blow - 1))
        assertEquals(19, shown(blow)); assertEquals(19, shown(blow + 89)); assertEquals(18, shown(blow + 90)); assertEquals(17, shown(blow + 180))
        assertEquals("your own life is not held back", 20, fx.lifeShown(1, 20))
        assertTrue(fx.lifePending(2)); assertTrue(!fx.lifePending(1))
        assertEquals("a big hit still ends inside 720 ms", 720L, lifeGap(12) * 12)
    }

    @Test fun theStrikePullsBackHitsHoldsAndComesHome() {
        // A clash: back by the pull at 150, at the target at 235, held through the freeze, home by 575.
        assertEquals(0f, Strike.offset(false, 0f, 100f, 10f), .001f)
        assertEquals(-10f, Strike.offset(false, 149.9f, 100f, 10f), .1f)
        assertEquals(100f, Strike.offset(false, 235f, 100f, 10f), .001f)
        assertEquals(100f, Strike.offset(false, 334f, 100f, 10f), .001f)
        assertTrue("it springs a little past home on the way back", (336..574).any { Strike.offset(false, it.toFloat(), 100f, 10f) < 0f })
        assertEquals(0f, Strike.offset(false, 575f, 100f, 10f), .001f)
        assertEquals(0f, Strike.offset(false, 800f, 100f, 10f), .001f)
        assertEquals(1.1f, Strike.scale(false, 235f), .001f); assertEquals(1f, Strike.scale(false, 800f), .001f)
        // A face hit: at the picture at 360 and small (.45), held 125 + 120, home by 925.
        assertEquals(100f, Strike.offset(true, 360f, 100f, 10f), .001f); assertEquals(.45f, Strike.scale(true, 360f), .001f)
        assertEquals(100f, Strike.offset(true, 604f, 100f, 10f), .001f)
        assertEquals(0f, Strike.offset(true, 925f, 100f, 10f), .001f); assertEquals(1f, Strike.scale(true, 925f), .001f)
        // Never weaker than before P5: the strike still reaches the struck tile's edge, and a face hit goes into the picture.
        val a = Rect(0f, 500f, 130f, 600f); val b = Rect(0f, 100f, 130f, 200f)
        assertEquals(400f - 42f - 30f, strikeReach(a, b, false), .001f)
        assertEquals(400f - 25f, strikeReach(a, b, true), .001f)
        // On the new board the picture is on a square drawn over the rows: the attacker (small by then) stops at the square's
        // edge, 270 px up its line, with only its tip under the glass.
        assertEquals(270f - 130f * .45f * .4f, strikeReach(a, b, true, Rect(-20f, 60f, 200f, 280f)), .001f)
        // F6, the charge: it lands beside the picture on the square's open side (here the right), its middle .42 of its small
        // width from the rim and a little above the picture's middle. With Match effects off, or no square, P5's line stands.
        val orb = Rect(10f, 100f, 110f, 200f)
        assertEquals(Offset(110f + 130f * .45f * .42f, 150f - 12f), chargeAim(a, orb, Rect(0f, 90f, 300f, 260f)))
        assertEquals(Offset(10f - 130f * .45f * .42f, 150f - 12f), chargeAim(a, orb, Rect(-200f, 90f, 120f, 260f)))
        assertEquals(null, chargeAim(a, orb, null)); assertEquals(null, chargeAim(a, orb, Rect(0f, 90f, 300f, 260f), low = true))
        AppSettings.applyMatchEffects("off"); assertEquals(null, chargeAim(a, orb, Rect(0f, 90f, 300f, 260f))); AppSettings.applyMatchEffects("full")
    }
}
