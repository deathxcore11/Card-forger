package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Rect
import dev.cardstashy.nativeplay.audio.Cues
import dev.cardstashy.nativeplay.audio.TableAudio
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TravelMoment
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Match sound pass 8b (specs/match-sound-brief.md), cast, landing and turn: each new cue is named by the effect it belongs to
 * and plays once, on that effect's contact frame; the board-change sounds do not play it a second time (walk line 50).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class SoundCastLandTest {
    private val was = Motion.still
    @After fun back() { Motion.still = was }

    private fun card(id: Int, who: Int, name: String, zone: String = "Battlefield", type: String = "Creature", power: Int = 2, tapped: Boolean = false) =
        """{"id":$id,"zone":"$zone","owner":$who,"controller":$who,"hidden":false,"name":"$name","type":"$type","manaCost":"","power":$power,"toughness":2,"tapped":$tapped}"""
    private fun snap(rev: Int, mine: String, hand: String = "", turn: Int = 3, cpuHand: Int = 4, cpuLib: Int = 40, myGrave: String = "") = MatchState.parse("""{"status":"running","viewer":1,"turn":$turn,"revision":$rev,"phase":"MAIN1",
        "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[$mine]},"Hand":{"count":1,"cards":[$hand]},"Graveyard":{"cards":[$myGrave]}}},
                   {"id":2,"life":20,"zones":{"Battlefield":{"cards":[]},"Hand":{"count":$cpuHand},"Library":{"count":$cpuLib}}}]}""")!!
    private fun anchors() = Anchors().apply { for (i in 5..12) putRect("c$i", Rect(100f * i, 600f, 100f * i + 90f, 700f)); putRect("stackcard", Rect(900f, 300f, 1000f, 440f)) }
    private val heard = ArrayList<Triple<String, Float, Float>>()
    private val planned = ArrayList<Set<String>>()
    private fun play(a: MatchState, b: MatchState): Battlefield { Motion.still = false
        val fx = Battlefield(); fx.onCue = { id, v, r -> heard += Triple(id, v, r) }; fx.onPlan = { _, set -> planned += set }
        val an = anchors(); fx.take(a, an); fx.take(b, an); return fx }
    /** Runs the effect clock from 0 to [ms] in 16 ms frames. */
    private fun run(fx: Battlefield, ms: Long) { var t = 5000L; while (t <= 5000L + ms) { fx.tick(t); t += 16 } }
    private fun names() = heard.map { it.first }

    @Test fun eachLandThatPaysTicksOneNoteHigherAndTheSpellBursts() {
        val pay = Director.Travel(30, "Bolt", true, Director.Leg.TAPS, "stackcard", Director.payMs(4), 7, listOf(110, 113, 114), pool = 1)
        val cues = legCues(pay)
        assertEquals(listOf(0L, 80L, 160L, 240L), cues.map { it.at })
        assertTrue(cues.all { it.id == "mana_tick" })
        assertEquals("0, 3, 5, 7 semitones up", List(4) { Cues.ladder(it) }, cues.map { it.rate })
        assertEquals("a land is felt, floating mana is not", listOf(null, "light", "light", "light"), cues.map { it.feel })
        assertTrue("the CPU's lands are heard, not felt", legCues(pay.copy(mine = false)).all { it.feel == null })
        assertEquals(listOf(LegCue(BURST_CUE_MS, "stack_burst")), legCues(pay.copy(leg = Director.Leg.REST, taps = emptyList(), pool = 0)))
        assertEquals("a spell that cost nothing bursts half size and quieter", .6f, legCues(pay.copy(leg = Director.Leg.REST, power = .5f)).single().vol, 0f)
        assertEquals(listOf(LegCue(0L, "undo_taps")), legCues(pay.copy(leg = Director.Leg.UNTAP)))
        assertEquals("by hand, to the floating mana: the same climbing ticks", 3, legCues(pay.copy(leg = Director.Leg.TO_POOL, pool = 0)).size)
        assertTrue(legCues(pay.copy(leg = Director.Leg.TO_STACK)).isEmpty())

        // Frame by frame: each tick once, whatever the frame rate; a new leg starts again.
        val fx = Battlefield(); val felt = ArrayList<String>(); fx.onImpact = { felt += it }
        val cue = { id: String, v: Float, r: Float -> heard += Triple(id, v, r); Unit }
        val m = TravelMoment(pay, 0, 41)
        fx.travelCues(m, 0, cue); assertEquals(1, heard.size)
        fx.travelCues(m, 100, cue); fx.travelCues(m, 100, cue); fx.travelCues(m, 90, cue); assertEquals(2, heard.size)
        fx.travelCues(m, 400, cue)
        assertEquals(List(4) { Triple("mana_tick", 1f, Cues.ladder(it)) }, heard)
        assertEquals(listOf("light", "light", "light"), felt)
        fx.travelCues(TravelMoment(pay.copy(leg = Director.Leg.REST), 0, 42), 16, cue); assertEquals(4, heard.size)
        fx.travelCues(TravelMoment(pay.copy(leg = Director.Leg.REST), 0, 42), 48, cue); fx.travelCues(TravelMoment(pay.copy(leg = Director.Leg.REST), 0, 42), 64, cue)
        assertEquals(listOf("stack_burst"), names().drop(4))
    }

    @Test fun aLandingSoundsOnceOnTheFrameItTouchesDown() {
        fun c(json: String): Card = snap(1, json).me.battlefield.first()
        assertEquals("land_drop", landingCue(c(card(6, 1, "Forest", type = "Basic Land"))))
        assertEquals("enters_tapped", landingCue(c(card(6, 1, "Guildgate", type = "Land", tapped = true))))
        assertEquals("creature_land", landingCue(c(card(7, 1, "Bear", power = 3))))
        // Design thread, 12 Nov: the sound brief said 4 and the living table 5; HEAVY_POWER = 5 decides both, so sound and look agree.
        assertEquals("creature_land", landingCue(c(card(7, 1, "Giant", power = 4))))
        assertEquals("creature_land_heavy", landingCue(c(card(7, 1, "Wurm", power = 5))))
        assertEquals("creature_land", landingCue(c(card(8, 1, "Sol Ring", type = "Artifact"))))
        assertEquals("token", landingCue(c(card(9, 1, "Soldier")).copy(token = true)))
        for (cue in listOf("land_drop", "enters_tapped", "creature_land", "creature_land_heavy", "token")) assertTrue(cue in LANDING_CUES)

        // A big creature comes down from your hand: the heavy landing, once, when it touches (315 ms into its arc) and not before.
        val a = snap(1, card(5, 1, "Bear"), hand = card(7, 1, "Wurm", "Hand", power = 6))
        val b = snap(2, card(5, 1, "Bear") + "," + card(7, 1, "Wurm", power = 6))
        val fx = play(a, b)
        assertEquals(listOf(setOf("creature_land_heavy")), planned)
        run(fx, 300); assertTrue("not before it lands: $heard", heard.isEmpty())
        run(fx, 900); assertEquals(listOf("creature_land_heavy"), names())
    }

    @Test fun aNewTurnUntapsOnceAndEachDrawAndTheSpentSpellSound() {
        // Your turn starts: two lands untap (one sound for the ripple), you draw a card, the CPU drew on its own turn before.
        val lands = { t: Boolean -> card(5, 1, "Forest", type = "Basic Land", tapped = t) + "," + card(6, 1, "Island", type = "Basic Land", tapped = t) }
        val fx = play(snap(1, lands(true), turn = 3), snap(2, lands(false), hand = card(20, 1, "Opt", "Hand", "Instant"), turn = 4).copy(activePlayer = 1))
        assertEquals(setOf("untap", "CARD-001"), planned.single())
        run(fx, 100); assertTrue(heard.isEmpty())
        run(fx, 1600)
        assertEquals("the ripple first (140 ms), the draw after the banner (380)", listOf("untap", "CARD-001"), names())

        // The CPU draws: its quiet card. A spell with no landing leaves the stack: resolve, once.
        heard.clear(); planned.clear()
        val spell = snap(1, "", hand = card(30, 1, "Divination", "Stack", "Sorcery")).me.hand.first()
        val a = snap(3, lands(false), cpuHand = 4, cpuLib = 40).copy(stack = listOf(StackItem(900, "Draw two cards.", spell, 1)))
        val b = snap(4, lands(false), cpuHand = 5, cpuLib = 39, myGrave = card(30, 1, "Divination", "Graveyard", "Sorcery"))
        val fx2 = play(a, b)
        assertEquals(setOf("resolve", "CARD-002", "CARD-018"), planned.single())
        run(fx2, 1200)
        // (8c: the spent card also sounds as it reaches your graveyard.)
        assertEquals(setOf("resolve", "CARD-002", "CARD-018"), names().toSet()); assertEquals(3, heard.size)
        assertEquals("resolve first, the pile last", listOf("resolve", "CARD-018"), names().filter { it != "CARD-002" })
        assertEquals("the CPU's draw stays quiet", .5f, heard.first { it.first == "CARD-002" }.second, 0f)
    }

    @Test fun theBoardChangeDoesNotPlayWhatTheEffectsPlay() {
        val audio = TableAudio(RuntimeEnvironment.getApplication()); val asked = ArrayList<String>(); audio.asked = { asked += it }
        val a = snap(1, card(5, 1, "Forest", type = "Basic Land"), hand = card(7, 1, "Wurm", "Hand", power = 6))
        val b = snap(2, card(5, 1, "Forest", type = "Basic Land", tapped = true) + "," + card(7, 1, "Wurm", power = 6), hand = card(21, 1, "Opt", "Hand", "Instant"))
        // Effects off: the board change plays the draw, the tap and the landing, as before.
        audio.fxCues = false; audio.update(a, b)
        assertEquals(listOf("CARD-001", "CARD-006", "CARD-010"), asked)
        // Effects on and they carry the landing and the draw; the lands are paying on their own frames: nothing is played twice.
        asked.clear(); audio.fxCues = true; audio.paying = true
        audio.planned(2, setOf("creature_land_heavy", "CARD-001")); audio.update(a, b)
        assertTrue("$asked", asked.isEmpty())
        // The next board of the same revision was not read by the effects: its own changes still sound.
        audio.paying = false; audio.update(a, b)
        assertEquals(listOf("CARD-001", "CARD-006", "CARD-010"), asked)
        // A plan for another board does not count.
        asked.clear(); audio.planned(9, setOf("creature_land_heavy", "CARD-001")); audio.update(a, b)
        assertEquals(3, asked.size)
        audio.release()
    }
}
