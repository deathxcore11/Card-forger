package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The living table F1 (specs/living-table-build-guide.md, "F1 Turn light"): a turn change sets the light to the new player and
 * schedules one flash per land that turn readied, in the land's colour, on P4's ripple. Nothing is predicted: both come from
 * the two boards. The setting maps to Full, Reduced and Off, and the guide's numbers are the constants.
 */
class TableFeelTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val cpu = base.cpu.id; private val me = base.viewer

    /** The board before your turn (the CPU's turn, your lands tapped) and your turn's board (the same lands readied). */
    private fun turn(to: Int): Pair<MatchState, MatchState> {
        val from = if (to == me) cpu else me
        fun tap(st: MatchState, who: Int, on: Boolean) = st.copy(players = st.players.map { p -> if (p.id == who) p.copy(battlefield = p.battlefield.map { if (it.isLand) it.copy(tapped = on) else it }) else p })
        val a = tap(base.copy(turn = base.turn, activePlayer = from), to, true)
        val b = tap(base.copy(turn = base.turn + 1, activePlayer = to), to, false)
        return a to b
    }

    @Test fun aTurnChangeLightsTheNewPlayersSideAndFlashesEachReadiedLand() {
        val (a, b) = turn(me)
        val c = TableFeel.turnChange(a, b)!!
        assertTrue("the light goes to you", c.mine)
        val lands = b.me.battlefield.filter { it.isLand }
        assertTrue(lands.isNotEmpty())
        assertEquals("one flash per readied land", lands.map { it.id }.toSet(), c.flashes.map { it.card }.toSet())
        assertEquals(lands.size, c.flashes.size)
        // Each in the land's own colour, on P4's ripple (140 ms in, 50 ms apart).
        for ((i, f) in c.flashes.withIndex()) {
            assertEquals(frameTone(cardColors(b.card(f.card)!!)).first, f.tone)
            assertEquals(UNTAP_AT_MS + i * UNTAP_GAP_MS, f.delayMs)
        }
        // The CPU's turn: the light goes to its side; its lands flash, not yours.
        val (a2, b2) = turn(cpu)
        val c2 = TableFeel.turnChange(a2, b2)!!
        assertFalse(c2.mine)
        assertEquals(b2.cpu.battlefield.filter { it.isLand }.map { it.id }.toSet(), c2.flashes.map { it.card }.toSet())
        // No turn change, nothing starts.
        assertNull(TableFeel.turnChange(b, b.copy(revision = b.revision + 1)))
    }

    /** F2 (the guide's test): paying with four lands lights four glows in the lands' colours, with a line while your spell is on the stack; the turn's end clears them. */
    @Test fun payingFourLandsLightsFourGlowsAndTheTurnsEndClearsThem() {
        val lands = base.me.battlefield.filter { it.isLand }.take(4)
        assertEquals(4, lands.size)
        fun set(st: MatchState, tapped: Set<Int>) = st.copy(players = st.players.map { p -> if (p.id == me) p.copy(battlefield = p.battlefield.map { if (it.isLand) it.copy(tapped = it.id in tapped) else it }) else p })
        val before = set(base.copy(stack = emptyList()), emptySet())
        val spell = base.me.hand.first { !it.isLand }
        val paid = set(before.copy(stack = listOf(dev.cardstashy.nativeplay.engine.StackItem(7, spell.text, spell.copy(zone = "Stack"), me))), lands.map { it.id }.toSet())
        val c = TableFeel.manaChange(before, paid)
        assertFalse(c.clear)
        assertEquals(lands.map { it.id }, c.glows.map { it.card })
        for (g in c.glows) { assertEquals(frameTone(cardColors(base.card(g.card)!!)).first, g.tone); assertTrue("a line to your spell", g.line) }
        // A land tapped by hand with no spell: the glow, no line. A land already tapped lights nothing new.
        val byHand = TableFeel.manaChange(before, set(before, setOf(lands[0].id)))
        assertEquals(listOf(lands[0].id), byHand.glows.map { it.card }); assertFalse(byHand.glows.single().line)
        assertTrue(TableFeel.manaChange(paid, paid.copy(revision = paid.revision + 1)).glows.isEmpty())
        // The CPU's taps light nothing at your edge; the next turn clears every glow.
        val cpuTaps = before.copy(players = before.players.map { p -> if (p.id == cpu) p.copy(battlefield = p.battlefield.map { it.copy(tapped = true) }) else p })
        assertTrue(TableFeel.manaChange(before.copy(players = before.players.map { p -> if (p.id == cpu) p.copy(battlefield = p.battlefield.map { it.copy(tapped = false) }) else p }), cpuTaps).glows.isEmpty())
        val next = TableFeel.manaChange(paid, paid.copy(turn = paid.turn + 1))
        assertTrue(next.clear); assertTrue(next.glows.isEmpty())
        assertEquals(.46f, TableFeel.MANA_RADIUS); assertEquals(.24f, TableFeel.MANA_GLOW); assertEquals(320L, TableFeel.MANA_IN_MS); assertEquals(400L, TableFeel.MANA_OUT_MS)
        assertEquals(2.2f, TableFeel.LEY_WIDTH); assertEquals(.12f, TableFeel.LEY_BOW); assertEquals(200L, TableFeel.LEY_HOLD_MS); assertEquals(700L, TableFeel.LEY_FADE_MS)
    }

    @Test fun theSettingAndTheGuidesNumbers() {
        assertEquals(TableFeel.Mode.FULL, TableFeel.mode("full")); assertEquals(TableFeel.Mode.REDUCED, TableFeel.mode("reduced"))
        assertEquals(TableFeel.Mode.OFF, TableFeel.mode("off")); assertEquals(TableFeel.Mode.FULL, TableFeel.mode("anything else"))
        assertEquals(5, TableFeel.HEAVY_POWER); assertEquals(5, TableFeel.CLOCK_STOP_COST)
        assertEquals(.26f, TableFeel.LIGHT_YOURS); assertEquals(.28f, TableFeel.LIGHT_CPU)
        assertEquals(.30f, TableFeel.LIGHT_YOURS_END); assertEquals(.70f, TableFeel.LIGHT_CPU_END)
        assertEquals(750, TableFeel.TURN_FADE_MS); assertEquals(240L, TableFeel.UNTAP_FLASH_MS); assertEquals(.7f, TableFeel.UNTAP_FLASH)
        // The band: strongest half way (50 %), nothing at either end.
        assertEquals(.5f, TableFeel.sweepStrength(.5f), .001f); assertEquals(0f, TableFeel.sweepStrength(0f)); assertEquals(0f, TableFeel.sweepStrength(1f))
        // The four drawn mats carry the showpiece's colours; any other mat the plain profile until F10.
        assertEquals(androidx.compose.ui.graphics.Color(0xFFD8F08A), TableFeel.profile("forest-temple").lightYours)
        assertEquals(androidx.compose.ui.graphics.Color(0xFFFF5A2A), TableFeel.profile("ashen-forge").lightCpu)
        assertEquals(TableFeel.PLAIN, TableFeel.profile("charcoal-table")); assertEquals(TableFeel.PLAIN, TableFeel.profile(null))
    }

    /** F6: one attack that lands schedules pull-back, dash, hit and return in that order (P5's approved durations), in the card's colour. */
    @Test fun aChargeIsPullBackDashHitReturnInTheCardsColour() {
        val was = Motion.still; Motion.still = false
        try {
            fun card(id: Int, who: Int, extra: String = "") = """{"id":$id,"zone":"Battlefield","owner":$who,"controller":$who,"hidden":false,"name":"Bear","type":"Creature","manaCost":"{1}{G}","power":2,"toughness":2$extra}"""
            fun snap(rev: Int, phase: String, mine: String, life: Int) = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":$rev,"phase":"$phase",
                "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[$mine]}}},{"id":2,"life":$life,"zones":{"Battlefield":{"cards":[]}}}]}""")!!
            val an = Anchors().apply { putRect("c5", androidx.compose.ui.geometry.Rect(100f, 600f, 230f, 700f)); putRect("orb1", androidx.compose.ui.geometry.Rect(20f, 800f, 120f, 900f)); putRect("orb2", androidx.compose.ui.geometry.Rect(20f, 20f, 120f, 120f)) }
            val a0 = snap(1, "COMBAT_BEGIN", card(5, 1), 20)
            val a = snap(2, "COMBAT_DECLARE_ATTACKERS", card(5, 1, ""","attacking":true"""), 20)
            val b = snap(3, "COMBAT_DAMAGE", card(5, 1, ""","attacking":true"""), 18)
            fun plan(setting: String): Pair<FxItem, FxItem> { AppSettings.applyMatchEffects(setting)
                val fx = Battlefield(); fx.take(a0, an); fx.take(a, an); val up = fx.items.single { it.kind == Fx.ATTACK }
                fx.take(b, an); return up to fx.items.single { it.kind == Fx.LUNGE } }
            val (up, lunge) = plan("full")
            val green = frameTone(cardColors(a.card(5)!!)).first
            assertEquals("the declare's rim is gold", TableFeel.DECLARE_GOLD, up.tone)
            assertEquals("the trail and ring are the card's colour", green, lunge.tone); assertEquals("orb2", lunge.toKey)
            // At a player: pull back 160, dash 200, a 125 ms freeze on the hit, home 120 later in 320, inside the lunge's 1100.
            val beats = TableFeel.charge(true)
            assertEquals(listOf("pull-back", "dash", "hit", "return"), beats.map { it.name })
            assertEquals(listOf(0f, 160f, 360f, 605f), beats.map { it.at }); assertEquals(listOf(160f, 200f, 125f, 320f), beats.map { it.ms })
            assertTrue("each beat starts when the one before has ended, or later", beats.zipWithNext().all { (x, y) -> y.at >= x.at + x.ms })
            assertTrue(beats.last().let { it.at + it.ms } <= lunge.dur)
            // At a blocker: 150, 85, a 100 ms freeze, home in 240.
            assertEquals(listOf(150f, 85f, 100f, 240f), TableFeel.charge(false).map { it.ms })
            assertEquals("it grows to 1.14 on the pull back", 1.14f, Strike.scale(false, Strike.wind(false), TableFeel.chargeSwell()), .001f)
            // Reduced: no freeze; the burst comes with the contact. Off: the strike as it was (coral, 1.10).
            AppSettings.applyMatchEffects("reduced")
            assertEquals(0f, TableFeel.charge(true)[2].ms, 0f); assertEquals(Strike.hit(true), Strike.after(true), 0f)
            val (upOff, lungeOff) = plan("off")
            assertEquals(TableFeel.CORAL, upOff.tone); assertEquals(TableFeel.CORAL, lungeOff.tone); assertEquals(1.1f, TableFeel.chargeSwell(), 0f)
        } finally { AppSettings.applyMatchEffects("full"); Motion.still = was }
    }
}
