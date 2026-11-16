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
 * Match sound pass 8c (specs/match-sound-brief.md), combat and spells: the attackers' steps climb, the dive and the hit sound on
 * their own frames (5 or more to a player is the big hit), a spell's shot, impact and its way to the graveyard each sound once.
 */
class SoundCombatSpellTest {
    private val was = Motion.still
    @After fun back() { Motion.still = was }

    private fun card(id: Int, who: Int, name: String, pt: Int = 2, extra: String = "", zone: String = "Battlefield", type: String = "Creature", cost: String = "") =
        """{"id":$id,"zone":"$zone","owner":$who,"controller":$who,"hidden":false,"name":"$name","type":"$type","manaCost":"$cost","power":$pt,"toughness":$pt$extra}"""
    private fun snap(rev: Int, phase: String, mine: String, theirs: String, grave: String = "", life: Int = 20, myGrave: String = "") = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":$rev,"phase":"$phase",
        "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[$mine]},"Graveyard":{"cards":[$myGrave]}}},
                   {"id":2,"life":$life,"zones":{"Battlefield":{"cards":[$theirs]},"Graveyard":{"cards":[$grave]}}}]}""")!!
    private fun anchors() = Anchors().apply {
        putRect("c5", Rect(100f, 600f, 230f, 700f)); putRect("c6", Rect(300f, 600f, 430f, 700f)); putRect("c7", Rect(100f, 300f, 230f, 400f)); putRect("stackcard", Rect(900f, 300f, 1000f, 440f))
        putRect("orb1", Rect(20f, 800f, 120f, 900f)); putRect("orb2", Rect(20f, 20f, 120f, 120f)); putRect("grave1", Rect(30f, 830f, 60f, 870f)); putRect("grave2", Rect(30f, 130f, 60f, 170f))
    }
    /** Each cue with the effect clock's time it played at (ms from the board change) and its rate. */
    private val heard = ArrayList<Triple<String, Long, Float>>()
    private val planned = ArrayList<Set<String>>()
    private fun play(a: MatchState, b: MatchState): Battlefield { Motion.still = false
        val fx = Battlefield(); fx.onCue = { id, _, r -> heard += Triple(id, fx.now.longValue - 5000L, r) }; fx.onPlan = { _, set -> planned += set }
        val an = anchors(); fx.take(a, an); fx.take(b, an); return fx }
    private fun run(fx: Battlefield, ms: Long) { var t = 5000L; while (t <= 5000L + ms) { fx.tick(t); t += 16 } }
    private fun at(id: String) = heard.filter { it.first == id }.map { it.second }
    /** Played once, on the first 16 ms frame at or after [ms]. */
    private fun once(id: String, ms: Long) { val t = at(id); assertEquals("$id once: $heard", 1, t.size); assertTrue("$id at $ms, was ${t[0]}", t[0] in ms..ms + 16) }

    @Test fun attackersStepUpEachANoteHigher() {
        val a = snap(1, "COMBAT_BEGIN", card(5, 1, "Bear") + "," + card(6, 1, "Wolf", 3), card(7, 2, "Goblin", 1))
        val b = snap(2, "COMBAT_DECLARE_ATTACKERS", card(5, 1, "Bear", 2, ""","attacking":true""") + "," + card(6, 1, "Wolf", 3, ""","attacking":true"""), card(7, 2, "Goblin", 1))
        val fx = play(a, b)
        assertEquals("the board change leaves the attack sound to the steps", setOf("CMB-001"), planned.single())
        run(fx, 400)
        assertEquals(listOf("CMB-001", "CMB-001"), heard.map { it.first })
        assertEquals(1f, heard[0].third, 0f); assertEquals("the second 6 % up", 1.06f, heard[1].third, .0001f)
        assertTrue("95 ms apart", heard[1].second - heard[0].second in DECLARE_GAP_MS - 16..DECLARE_GAP_MS + 16)
    }

    @Test fun theDiveTheClashTheDeathAndTheFaceHitSoundOnTheirFrames() {
        val bear = card(5, 1, "Bear", 2, ""","attacking":true"""); val wolf = { p: Int -> card(6, 1, "Wolf", p, ""","attacking":true""") }
        val goblin = card(7, 2, "Goblin", 1, ""","blocking":true,"blockingIds":[5]""")
        val dead = card(7, 2, "Goblin", 1, zone = "Graveyard")
        val fx = play(snap(1, "COMBAT_DECLARE_BLOCKERS", "$bear,${wolf(3)}", goblin),
            snap(2, "COMBAT_DAMAGE", card(5, 1, "Bear", 2, ""","attacking":true,"damage":1""") + "," + wolf(3), "", grave = dead, life = 17))
        run(fx, 2600)
        // The clash: lit 140, the dive as the pull-back ends (150), contact at 235.
        val clash = STAGE_LEAD_MS
        assertEquals(2, at("attack_go").size)
        assertTrue(at("attack_go")[0] in clash + 150..clash + 166)
        once("CMB-022", clash + 235)
        // The Goblin breaks after the freeze, on its white flash.
        once("CMB-009", clash + 335 + (DEATH_MS * .54f).toLong())
        // Then the Wolf at the CPU: its dive, and a hit of 3 on contact (360): the plain face hit, never both.
        val face = STAGE_LEAD_MS + Strike.CLASH_MS + STAGE_LEAD_MS
        assertTrue(at("attack_go")[1] in face + 160..face + 176)
        once("CMB-023", face + 360)
        assertTrue(at("face_hit_big").isEmpty())

        // Five or more to a player: the big hit instead.
        heard.clear()
        val fx2 = play(snap(3, "COMBAT_DECLARE_BLOCKERS", wolf(5), ""), snap(4, "COMBAT_DAMAGE", wolf(5), "", life = 15))
        run(fx2, 1400)
        once("face_hit_big", STAGE_LEAD_MS + 360); assertTrue(at("CMB-023").isEmpty())
    }

    @Test fun aSpellsShotImpactAndGraveyardEachSoundOnce() {
        fun spell(id: Int, name: String, cost: String): Card = MatchState.parse("""{"status":"running","viewer":1,"players":[{"id":1,"isViewer":true,"zones":{"Hand":{"count":1,"cards":[${card(id, 1, name, zone = "Stack", type = "Instant", cost = cost)}]}}},{"id":2,"zones":{}}]}""")!!.me.hand.first()
        val a = snap(1, "MAIN1", card(5, 1, "Bear"), card(7, 2, "Goblin")).copy(stack = listOf(StackItem(900, "Lightning Bolt deals 3 damage to any target.", spell(30, "Lightning Bolt", "{R}"), 1, targets = listOf(Ref("card", 7, "Goblin")))))
        val b = snap(2, "MAIN1", card(5, 1, "Bear"), "", grave = card(7, 2, "Goblin", zone = "Graveyard"), myGrave = card(30, 1, "Lightning Bolt", zone = "Graveyard", type = "Instant", cost = "{R}"))
        val fx = play(a, b)
        run(fx, 1800)
        once("bolt", 0)
        once("CMB-018", FIRE_MS)
        once("CMB-009", FIRE_MS + 300 + (DEATH_MS * .54f).toLong())
        // The spent card leaves 160 after the impact and sounds as it reaches your pile.
        once("CARD-018", FIRE_MS + 160 + SPENT_MS - 60)
        assertTrue("no plain resolve under a shot", at("resolve").isEmpty())

        // On your own creature: the shot, then the soft resolve where the hit would be. No hit sound.
        heard.clear()
        val a2 = snap(3, "MAIN1", card(5, 1, "Bear"), card(7, 2, "Goblin")).copy(stack = listOf(StackItem(901, "Target creature gets +3/+3 until end of turn.", spell(31, "Giant Growth", "{G}"), 1, targets = listOf(Ref("card", 5, "Bear")))))
        val fx2 = play(a2, snap(4, "MAIN1", card(5, 1, "Bear"), card(7, 2, "Goblin"), myGrave = card(31, 1, "Giant Growth", zone = "Graveyard", type = "Instant", cost = "{G}")))
        run(fx2, 1400)
        once("bolt", 0); once("resolve", FIRE_MS); once("CARD-018", FIRE_MS + 160 + SPENT_MS - 60)
        assertTrue(at("CMB-018").isEmpty())

        // The aim: the lock sounds once as the thread closes on its target.
        heard.clear()
        fx2.aimLock("c7", Color.Red); run(fx2, 1400 + 400)
        assertEquals(listOf("target_lock"), heard.map { it.first })
    }
}
