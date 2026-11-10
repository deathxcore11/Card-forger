package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.TapPlan
import dev.cardstashy.nativeplay.ui.Glow
import dev.cardstashy.nativeplay.ui.Mark
import dev.cardstashy.nativeplay.ui.Affordability
import dev.cardstashy.nativeplay.ui.ShortCasts
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The playable glow means "you can do this now" (Randall 4 Nov: Cid glowed on turn 1 with one land). */
class GlowTest {
    private fun card(id: Int, zone: String, name: String, type: String, cost: String, text: String, tapped: Boolean = false) =
        """{"id":$id,"zone":"$zone","owner":1,"controller":1,"hidden":false,"name":"$name","type":"$type","manaCost":"$cost","text":"$text","tapped":$tapped}"""

    private fun state(actionable: String, hand: List<String>, field: List<String>, input: String = "InputPassPriority") = MatchState.parse("""{"status":"running","viewer":1,"turn":1,
        "players":[{"id":1,"isViewer":true,"zones":{"Hand":{"count":${hand.size},"cards":[${hand.joinToString(",")}]},"Battlefield":{"cards":[${field.joinToString(",")}]}},"mana":{}},
                   {"id":2,"zones":{}}],
        "inputType":"$input","selection":{"actionable":[$actionable]}}""")!!

    private val cid = card(10, "Hand", "Cid, Freeflier Pilot", "Legendary Creature — Human Warrior Pilot", "{1}{W}",
        "Equipment and Vehicle spells you cast cost {1} less to cast.\\nJump — During your turn, Cid has flying.\\n{2}, {Q}: Return target Equipment or Vehicle card from your graveyard to your hand.")
    private val ridge = card(20, "Battlefield", "Wooded Ridgeline", "Land", "", "This land enters tapped.\\n({T}: Add {R} or {G}.)", tapped = true)

    @Test fun cidWithOneTappedLandIsNotEnoughMana() {
        val st = state("""{"kind":"card","id":10}""", listOf(cid), listOf(ridge))
        assertTrue(Affordability.provenUnaffordable(st.card(10)!!, st, emptyMap()))
        assertEquals("Not enough mana", ShortCasts().blocked(st)[10])
    }

    @Test fun ownCostReducersStillStayLit() {
        val c = MatchState.parseCard(com.google.gson.JsonParser.parseString(card(11, "Hand", "Ghalta", "Creature", "{10}{G}{G}", "This spell costs {X} less to cast, where X is the total power of creatures you control.")).asJsonObject)
        assertTrue(Affordability.costBends(c))
        val other = MatchState.parseCard(com.google.gson.JsonParser.parseString(card(12, "Hand", "Goblin Electromancer", "Creature", "{R}{R}", "Instant and sorcery spells you cast cost {1} less to cast.")).asJsonObject)
        assertFalse(Affordability.costBends(other))
    }

    @Test fun forgeUnprovenCardsStayDarkButProvenOnesGlow() {
        val bolt = card(30, "Hand", "Lightning Bolt", "Instant", "{R}", "Lightning Bolt deals 3 damage to any target.")
        val x = card(31, "Hand", "Fireball", "Sorcery", "{X}{R}", "Fireball deals X damage.")
        val st = state("""{"kind":"card","id":30,"affordability":"available"},{"kind":"card","id":31,"affordability":"unknown"}""", listOf(bolt, x), emptyList())
        val sc = ShortCasts(); val blocked = sc.blocked(st)
        assertEquals(setOf(31), sc.quiet(st, blocked))
    }

    // ---- glow-rules.md, Checks: the set of ids wearing each light, per fixture ----
    private fun fixture(n: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/$n.json")!!.readText())!!
    private val fixtures = listOf("snap-main", "snap-targets", "snap-attack", "snap-block", "snap-realblock", "snap-triggers", "snap-pod",
        "snap-dock-assign", "snap-dock-choice", "snap-dock-confirm", "snap-dock-costs", "snap-dock-input", "snap-dock-inputopts", "snap-dock-reveal", "snap-dock-search2", "snap-dock-unsupported")
    private fun lit(st: MatchState, live: Boolean, m: Mark) = Glow.usableMarks(st, live).filterValues { it == m }.keys

    @Test fun eachFixtureLightsExactlyItsSet() {
        // The board's own light per card (Glow.mark, what ForgeBoard draws): every light the spec names, per fixture.
        val expect: Map<String, Map<Mark, Set<Int>>> = mapOf(
            // Your main phase, empty stack. Arcane Signet (115) only makes mana: no light (rule 3). Path (104) is not offered.
            "snap-main" to mapOf(Mark.PLAYABLE to setOf(100, 101, 102, 103, 105, 106)),
            // Attack and block: the creatures Forge offers are that question's answers.
            "snap-attack" to mapOf(Mark.PICKABLE to setOf(107, 108, 109)),
            "snap-block" to mapOf(Mark.PICKABLE to setOf(107, 108, 109)),
            // Forge's real block prompt: the attacker it already holds is chosen.
            "snap-realblock" to mapOf(Mark.PICKED to setOf(117)),
            // Lightning Bolt's targets: Hill Giant (124) is chosen, the rest are targets.
            "snap-targets" to mapOf(Mark.TARGET to setOf(123, 107, 108, 109), Mark.PICKED to setOf(124)),
        )
        for (n in fixtures) {
            val st = fixture(n)
            val marks = Glow.boardMarks(st, true)
            for (m in Mark.values().filter { it != Mark.NONE })
                assertEquals("$n $m", expect[n]?.get(m) ?: emptySet<Int>(), marks.filterValues { it == m }.keys)
        }
    }

    @Test fun theBoardsOrderPutsTheQuestionFirst() {
        val bolt = card(30, "Hand", "Lightning Bolt", "Instant", "{R}", "Lightning Bolt deals 3 damage to any target.")
        val bear = card(31, "Battlefield", "Grizzly Bears", "Creature — Bear", "{1}{G}", "")
        // Forge's own "unavailable": dark, whatever else would light it.
        val no = state("""{"kind":"card","id":30,"affordability":"unavailable"}""", listOf(bolt), emptyList())
        val sc = ShortCasts(); val bl = sc.blocked(no)
        assertEquals(Mark.NONE, Glow.mark(no.card(30)!!, no, true, bl, sc.quiet(no, bl)))
        // Blocking: the creature you picked to block with is chosen; an attacker it may meet is a target; not live, nothing.
        val block = state("", emptyList(), listOf(bear), input = "InputBlock")
        assertEquals(Mark.PICKED, Glow.mark(block.card(31)!!, block, true, emptyMap(), emptySet(), blockPick = 31))
        assertEquals(Mark.NONE, Glow.mark(block.card(31)!!, block, false, emptyMap(), emptySet(), blockPick = 31))
        // A discard: the lifted card is the pick (gold), the others are red.
        val discard = MatchState.parse("""{"status":"running","viewer":1,"turn":1,"message":"Discard a card.",
            "players":[{"id":1,"isViewer":true,"zones":{"Hand":{"count":2,"cards":[$bolt,${card(32, "Hand", "Shock", "Instant", "{R}", "")}]}}},{"id":2,"zones":{}}],
            "inputType":"InputSelectCardsFromList","selection":{"cards":[{"kind":"card","id":30},{"kind":"card","id":32}],"actionable":[]}}""")!!
        assertEquals(Mark.PICKED, Glow.mark(discard.card(30)!!, discard, true, emptyMap(), emptySet(), selectedHand = 30))
        assertEquals(Mark.DISCARD, Glow.mark(discard.card(32)!!, discard, true, emptyMap(), emptySet(), selectedHand = 30))
    }

    @Test fun whilePayingEverySourceForgeOffersLights() {
        // Forge's payer may offer a source off the battlefield (a card in hand that makes mana): its list decides, not the zone.
        val guide = card(60, "Hand", "Simian Spirit Guide", "Creature — Ape Spirit", "{2}{R}", "Exile Simian Spirit Guide from your hand: Add {R}.")
        val forest = card(40, "Battlefield", "Forest", "Basic Land — Forest", "", "({T}: Add {G}.)")
        val st = state("""{"kind":"card","id":60,"affordability":"available"},{"kind":"card","id":40}""", listOf(guide), listOf(forest), input = "InputPayManaOfCostPayment")
        assertEquals(setOf(60, 40), lit(st, true, Mark.PICKABLE))
    }

    @Test fun aCostlyPlanSaysWhyAndStaysCastable() {
        val ridge = card(20, "Battlefield", "Wooded Ridgeline", "Land", "", "({T}: Add {R} or {G}.)")
        val bolt = { id: Int -> card(id, "Hand", "Lightning Bolt", "Instant", "{R}", "Lightning Bolt deals 3 damage to any target.") }
        val st = state("""{"kind":"card","id":30,"tapPreview":[]},{"kind":"card","id":31,"tapPreview":[20],"tapWarning":"sacrifice"},
            {"kind":"card","id":34,"tapPreview":[20],"tapWarning":"life"},{"kind":"card","id":32,"tapPreview":[20]}""", listOf(bolt(30), bolt(31), bolt(34), bolt(32)), listOf(ridge))
        assertEquals("Not enough mana", Glow.costOf(st, 30)); assertEquals("Costs a sacrifice", Glow.costOf(st, 31))
        assertEquals("Costs life", Glow.costOf(st, 34)); assertEquals(null, Glow.costOf(st, 32))
        val sc = ShortCasts(); val bl = sc.blocked(st); val q = sc.quiet(st, bl)
        // Rule 7 (corrected 10 Nov): a cost in life or a sacrifice is a legal cast, so it stays lit (and asks first: costly);
        // no plan at all stays dark.
        assertEquals(Mark.PLAYABLE, Glow.usable(st.card(31)!!, st, true, bl, q)); assertEquals(Mark.PLAYABLE, Glow.usable(st.card(34)!!, st, true, bl, q))
        assertEquals(Mark.NONE, Glow.usable(st.card(30)!!, st, true, bl, q)); assertEquals(Mark.PLAYABLE, Glow.usable(st.card(32)!!, st, true, bl, q))
        assertTrue(Glow.costly(st, true, st.card(31)!!, bl, q)); assertTrue(Glow.costly(st, true, st.card(34)!!, bl, q))
        assertFalse(Glow.costly(st, true, st.card(30)!!, bl, q)); assertFalse(Glow.costly(st, true, st.card(32)!!, bl, q))
        assertFalse(Glow.costly(st, false, st.card(31)!!, bl, q))
    }

    @Test fun notLiveGivesNoUsableGlow() {
        for (n in fixtures) assertEquals(n, emptySet<Int>(), Glow.usableMarks(fixture(n), false).filterValues { it != Mark.NONE }.keys)
    }

    @Test fun anOpenQuestionGivesNoPlayable() {
        // The dock fixtures carry Forge's actionable list under a prompt: only the question's answers may glow.
        for (n in fixtures.filter { it.startsWith("snap-dock") }) {
            val st = fixture(n); assertTrue(n, st.prompt != null && st.selection.actionable.isNotEmpty())
            assertEquals(n, emptySet<Int>(), lit(st, true, Mark.PLAYABLE) + lit(st, true, Mark.USABLE))
        }
        for (input in listOf("InputSelectTargets", "InputAttack", "InputBlock")) {
            val st = state("""{"kind":"card","id":30}""", listOf(card(30, "Hand", "Lightning Bolt", "Instant", "{R}", "Lightning Bolt deals 3 damage to any target.")), emptyList(), input = input)
            assertEquals(input, Mark.NONE, Glow.usableMarks(st, true)[30])
        }
    }

    @Test fun manaOnlyPermanentsNeverGlowAsUsable() {
        val forest = card(40, "Battlefield", "Forest", "Basic Land — Forest", "", "({T}: Add {G}.)")
        val sol = card(41, "Battlefield", "Sol Ring", "Artifact", "{1}", "{T}: Add {C}{C}.")
        val elves = card(42, "Battlefield", "Llanowar Elves", "Creature — Elf Druid", "{G}", "{T}: Add {G}.")
        val gate = card(43, "Battlefield", "Mishra's Factory", "Land", "", "{T}: Add {C}.\n{1}: Mishra's Factory becomes a 2/2 Assembly-Worker artifact creature until end of turn.")
        val st = state("""{"kind":"card","id":40,"affordability":"available"},{"kind":"card","id":41,"affordability":"available"},{"kind":"card","id":42,"affordability":"available"},{"kind":"card","id":43,"affordability":"available"}""",
            emptyList(), listOf(forest, sol, elves, gate))
        val m = Glow.usableMarks(st, true)
        assertEquals(Mark.NONE, m[40]); assertEquals(Mark.NONE, m[41]); assertEquals(Mark.NONE, m[42])
        // A land with a real non-mana ability you can pay for wears the usable ring, never the playable one.
        assertEquals(Mark.USABLE, m[43])
        // While Forge asks for mana the sources are that question's answers (a pick), never "playable".
        val paying = state("""{"kind":"card","id":40},{"kind":"card","id":41}""", emptyList(), listOf(forest, sol), input = "InputPayManaOfCostPayment")
        assertEquals(setOf(40, 41), lit(paying, true, Mark.PICKABLE)); assertEquals(emptySet<Int>(), lit(paying, true, Mark.PLAYABLE))
    }

    @Test fun anUnaffordableActionableCardIsNotLit() {
        val ridge = card(20, "Battlefield", "Wooded Ridgeline", "Land", "", "({T}: Add {R} or {G}.)")
        val bolt = { id: Int -> card(id, "Hand", "Lightning Bolt", "Instant", "{R}", "Lightning Bolt deals 3 damage to any target.") }
        // provenUnaffordable: Cid with one tapped land.
        assertEquals(Mark.NONE, Glow.usableMarks(state("""{"kind":"card","id":10}""", listOf(cid), listOf(this.ridge)), true)[10])
        // The bridge's pay plan: an empty tapPreview is dark; a payment that costs life or a sacrifice is legal, so it stays lit.
        val st = state("""{"kind":"card","id":30,"tapPreview":[]},{"kind":"card","id":31,"tapPreview":[20],"tapWarning":"sacrifice","tapWarningAmount":1},
            {"kind":"card","id":32,"tapPreview":[20]},{"kind":"card","id":33}""", listOf(bolt(30), bolt(31), bolt(32), bolt(33)), listOf(ridge))
        val m = Glow.usableMarks(st, true)
        assertEquals(Mark.NONE, m[30]); assertEquals(Mark.PLAYABLE, m[31]); assertEquals(Mark.PLAYABLE, m[32]); assertEquals(Mark.PLAYABLE, m[33])
    }

    @Test fun paymentLightsOnlyWhatTheBridgePlanned() {
        val ridge = card(20, "Battlefield", "Wooded Ridgeline", "Land", "", "({T}: Add {R} or {G}.)")
        val sol = card(21, "Battlefield", "Sol Ring", "Artifact", "{1}", "{T}: Add {C}{C}.")
        val bear = card(32, "Hand", "Grizzly Bears", "Creature — Bear", "{1}{G}", "")
        val shock = card(33, "Hand", "Shock", "Instant", "{R}", "Shock deals 2 damage to any target.")
        val st = state("""{"kind":"card","id":32,"tapPreview":[20,21]},{"kind":"card","id":33}""", listOf(bear, shock), listOf(ridge, sol))
        assertEquals(TapPlan(listOf(20, 21), null), st.selection.tapPlans[32])
        val sc = ShortCasts(); val blocked = sc.blocked(st); val quiet = sc.quiet(st, blocked)
        assertEquals(setOf(20, 21), Glow.payment(st, true, st.card(32), blocked, quiet))
        // No preview from the bridge for Shock: nothing lights. Nothing carried, or not your moment: nothing lights.
        assertEquals(emptySet<Int>(), Glow.payment(st, true, st.card(33), blocked, quiet))
        assertEquals(emptySet<Int>(), Glow.payment(st, true, null, blocked, quiet))
        assertEquals(emptySet<Int>(), Glow.payment(st, false, st.card(32), blocked, quiet))
    }

    @Test fun theCpusCardsNeverGlowAsUsable() {
        val st = MatchState.parse("""{"status":"running","viewer":1,"turn":3,
            "players":[{"id":1,"isViewer":true,"zones":{}},
                       {"id":2,"zones":{"Hand":{"count":1,"cards":[{"id":50,"zone":"Hand","owner":2,"controller":2,"hidden":false,"name":"Shock","type":"Instant","manaCost":"{R}","text":""}]},
                                        "Battlefield":{"cards":[{"id":51,"zone":"Battlefield","owner":2,"controller":2,"hidden":false,"name":"Prodigal Sorcerer","type":"Creature","manaCost":"{2}{U}","text":"{T}: This creature deals 1 damage to any target."}]}}}],
            "inputType":"InputPassPriority","selection":{"actionable":[{"kind":"card","id":50,"affordability":"available"},{"kind":"card","id":51,"affordability":"available"}]}}""")!!
        assertEquals(emptySet<Int>(), Glow.usableMarks(st, true).filterValues { it != Mark.NONE }.keys)
    }

    @Test fun combatThatSkipsToMain2StillLunges() {
        dev.cardstashy.nativeplay.ui.Motion.still = false
        fun snap(phase: String, attacking: Boolean, life: Int) = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":${if (attacking) 1 else 2},"phase":"$phase",
            "players":[{"id":1,"isViewer":true,"life":20,"zones":{"Battlefield":{"cards":[{"id":5,"zone":"Battlefield","owner":1,"controller":1,"hidden":false,"name":"Bear","type":"Creature — Bear","power":2,"toughness":2,"attacking":$attacking}]}}},
                       {"id":2,"life":$life,"zones":{}}]}""")!!
        val anchors = dev.cardstashy.nativeplay.ui.Anchors()
        val fx = dev.cardstashy.nativeplay.ui.Battlefield()
        fx.take(snap("COMBAT_DECLARE_ATTACKERS", true, 20), anchors)
        fx.take(snap("MAIN2", false, 18), anchors)
        assertTrue(fx.items.any { it.kind == dev.cardstashy.nativeplay.ui.Fx.LUNGE && it.card == 5 && it.toKey == "orb2" })
    }

    @Test fun updaterComparesVersions() {
        assertFalse(Updater.newer("0.4.9", 0, "0.4.10-test5-native-test", 33))
        assertTrue(Updater.newer("0.4.11", 0, "0.4.10-test5-native-test", 33))
        assertTrue(Updater.newer("0.4.10", 0, "0.4.10-test5-native-test", 33))
        assertFalse(Updater.newer("0.4.10", 0, "0.4.10", 34))
        assertFalse(Updater.newer("0.4.10", 0, "0.4.10-native-test", 35))
        assertTrue(Updater.newer("0.4.10", 35, "0.4.10", 34))
        val rel = Updater.parse(com.google.gson.JsonParser.parseString("""{"nativeTest":{"href":"/downloads/cardstashy-native-test-0.4.9.apk","bytes":74063483,"version":"0.4.9"}}""").asJsonObject)!!
        assertEquals("https://cardstashy.com/downloads/cardstashy-native-test-0.4.9.apk", rel.url)
        assertEquals(null, Updater.parse(com.google.gson.JsonParser.parseString("""{"nativeTest":{"href":"https://evil.example/x.apk","version":"9.9.9"}}""").asJsonObject))
    }

    @Test fun updaterClearsInstalledDownload() {
        val d = kotlin.io.path.createTempDirectory("updates").toFile()
        for (n in listOf("cardstashy-0.4.25.apk", "cardstashy-0.4.26.part", "cardstashy-0.4.24.apk", "stray.tmp")) java.io.File(d, n).writeText("x")
        // 0.4.25 installed: its own download and older ones go; 0.4.26 still on its way stays.
        assertEquals(listOf("cardstashy-0.4.24.apk", "cardstashy-0.4.25.apk", "stray.tmp"), Updater.spent(d, "0.4.25-native-test").map { it.name }.sorted())
        assertEquals(listOf("cardstashy-0.4.24.apk", "stray.tmp"), Updater.spent(d, "0.4.24-native-test").map { it.name }.sorted())
        d.deleteRecursively()
    }
}
