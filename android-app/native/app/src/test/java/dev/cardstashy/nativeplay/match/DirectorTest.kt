package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** specs/match-director-native.md section 10: the reference round's plan, coverage of a real log, the timing floors, the think ranges. */
class DirectorTest {
    private fun res(n: String) = javaClass.classLoader!!.getResource(n)!!.readText()
    private val duel = MatchState.parse(res("history/duel.json"))!!
    private val me = duel.viewer
    private val cpu = duel.players.first { it.id != me }.id
    private var seq = 0L
    private fun ev(type: String, player: Int? = cpu, card: Ref? = null, source: Ref? = null, targets: List<Ref> = emptyList(), from: String? = null, to: String? = null,
                   attackers: List<Pair<Ref, Ref?>> = emptyList(), lifeFrom: Int? = null, lifeTo: Int? = null, turn: Int = 3) =
        GameEvent(++seq, type, turn, null, player, card, source, null, targets, attackers, emptyList(), from, to, null, lifeFrom, lifeTo, null)
    private fun card(id: Int, name: String) = Ref("card", id, name)

    /** The reference round: CPU Mountain, Lightning Bolt at Llanowar Elves (it dies), Goblin Chariot, attack. */
    @Test fun referenceRound() {
        val elves = card(901, "Llanowar Elves"); val bolt = card(902, "Lightning Bolt"); val chariot = card(903, "Goblin Chariot")
        val events = listOf(
            ev("turn", turn = 3), ev("zone", card = Ref("card", 904, null), from = "Library", to = "Hand"),
            ev("land", card = card(905, "Mountain")),
            ev("cast", source = bolt, targets = listOf(elves)), ev("resolve", source = bolt), ev("damage", source = bolt),
            ev("zone", card = elves, from = "Battlefield", to = "Graveyard", player = me), ev("zone", card = bolt, from = "Stack", to = "Graveyard"),
            ev("cast", source = chariot), ev("resolve", source = chariot), ev("zone", card = chariot, from = "Stack", to = "Battlefield"),
            ev("attack", attackers = listOf(chariot to Ref("player", me, null))),
        )
        val st = duel.copy(activePlayer = cpu, prompt = null)
        val steps = Director.plan(st, events, Director.ThinkClock { .5 })
        val kinds = steps.map { it.kind }
        // 0.4.59 T5: each cast is two steps, the card's flight to the stack and its rest there (no lands tapped on this board).
        assertEquals(listOf(Director.Kind.BANNER, Director.Kind.DRAW, Director.Kind.THINK, Director.Kind.LAND, Director.Kind.THINK, Director.Kind.CAST, Director.Kind.CAST,
            Director.Kind.RESOLVE, Director.Kind.DAMAGE, Director.Kind.DIES, Director.Kind.TO_GRAVE, Director.Kind.THINK, Director.Kind.CAST, Director.Kind.CAST,
            Director.Kind.RESOLVE, Director.Kind.ENTER, Director.Kind.THINK, Director.Kind.ATTACK), kinds)
        // A targeted removal thinks longer than a land; the creature enters and the elf dies as their own steps in one snapshot.
        val thinks = steps.filter { it.kind == Director.Kind.THINK }.map { it.ms }
        assertTrue("land think in 700..1000: $thinks", thinks[0] in 700..1000)
        assertTrue("targeted think in 1500..2100: $thinks", thinks[1] in 1500..2100)
        assertTrue("creature think in 1100..1500: $thinks", thinks[2] in 1100..1500)
        // The caption rides on the rest, never on the flight.
        val bolts = steps.filter { it.kind == Director.Kind.CAST && it.cardId == 902 }
        assertEquals(listOf(Director.Leg.TO_STACK, Director.Leg.REST), bolts.map { it.travel?.leg })
        assertTrue(bolts[0].beat == null && bolts[1].beat != null)
    }

    // ---- 0.4.59 T5, the cast travels: the step order for a creature, an aura and a land (spec table-look-0459.md T5) ----

    private fun permanent(id: Int, name: String, type: String, controller: Int = me, tapped: Boolean = false, zone: String = "Battlefield", attachedTo: Int? = null) =
        dev.cardstashy.nativeplay.engine.Card(id = id, zone = zone, owner = controller, controller = controller, hidden = false, name = name, type = type, manaCost = "", text = "",
            power = if (type.contains("Creature")) 2 else null, toughness = if (type.contains("Creature")) 2 else null, tapped = tapped, attacking = false, blocking = false,
            damage = 0, summoningSick = false, token = false, counters = emptyMap(), keywords = emptyList(), attachedTo = attachedTo, blockingIds = emptyList())
    private fun board(mine: List<dev.cardstashy.nativeplay.engine.Card>, hand: List<dev.cardstashy.nativeplay.engine.Card> = emptyList(), theirs: List<dev.cardstashy.nativeplay.engine.Card> = emptyList()) =
        duel.copy(prompt = null, activePlayer = me, players = duel.players.map { p -> if (p.id == me) p.copy(battlefield = mine, hand = hand) else p.copy(battlefield = theirs) })
    private fun legs(steps: List<Director.Step>) = steps.filter { it.held }.map { "${it.kind}:${it.travel?.leg}:${it.travel?.toKey}:${it.ms}" }

    /**
     * Match punch P2 (was T5): your creature lifts to the stack (70 dip + 300), its two lands pay into it (80 ms apart, a streak each:
     * 460), it bursts and rests (370 + 525), then goes to its slot (380).
     */
    @Test fun ownCreatureTapsFliesRestsAndGoesToItsSlot() {
        val forests = listOf(permanent(40, "Forest", "Basic Land — Forest"), permanent(41, "Forest", "Basic Land — Forest"))
        val bears = permanent(950, "Grizzly Bears", "Creature — Bear")
        val before = board(forests, hand = listOf(bears.copy(zone = "Hand")))
        val st = board(forests.map { it.copy(tapped = true) } + bears)
        val c = card(950, "Grizzly Bears")
        // Forge's own order (snap-realblock.json): to the stack, the cast, off the stack onto the battlefield, the resolve.
        val events = listOf(ev("zone", card = c, from = "Hand", to = "Stack", player = null), ev("cast", player = me, source = c).copy(stackId = 7),
            ev("zone", card = c, from = "Stack", to = "Battlefield", player = me), ev("resolve", source = c))
        val steps = Director.plan(st, events, before = before)
        assertEquals(listOf("CAST:TO_STACK:stackcard:370", "CAST:TAPS:stackcard:460", "CAST:REST:stackcard:895", "ENTER:TO_SLOT:c950:330"), legs(steps))
        val taps = steps.first { it.travel?.leg == Director.Leg.TAPS }.travel!!.taps
        assertEquals(listOf(40, 41), taps)
        // One by one: the second land starts 80 ms after the first; its streak leaves 60 ms later and reaches the spell 280 ms after
        // that, and the pay ends 40 ms on (80 + 60 + 280 + 40 = 460).
        assertEquals(listOf(0L, 80L), taps.map { dev.cardstashy.nativeplay.ui.tapDelay(taps, it) })
        assertEquals(Director.tapsMs(2), dev.cardstashy.nativeplay.ui.tapDelay(taps, 41)!! + Director.TAP_TURN_MS)
        assertEquals(420L, Director.streakArrives(1)); assertEquals(460L, Director.payMs(2))
        // With one of your prompts waiting the pay never runs under 200 ms; paid in full, the burst is full size.
        val pay = steps.first { it.travel?.leg == Director.Leg.TAPS }
        assertEquals(Director.PAY_MIN_MS, Director.lengthOf(pay, true, 0L))
        assertEquals(1f, steps.first { it.travel?.leg == Director.Leg.REST }.travel!!.power)
        assertEquals(null, dev.cardstashy.nativeplay.ui.tapDelay(taps, 99))
        assertTrue(steps.mapNotNull { it.travel }.all { it.mine && it.cardId == 950 && it.stackId == 7 || it.leg == Director.Leg.TO_SLOT })
        // No step of the travel plays a sound of its own: the cast sound stays the table audio's one.
        assertTrue(steps.filter { it.travel != null }.all { it.cue == null })
        // The rest is focal, so a waiting prompt or a long queue never cuts its burst and read (370 + 525).
        val rest = steps.first { it.travel?.leg == Director.Leg.REST }
        assertTrue(rest.focal)
        for (w in listOf(true, false)) for (q in listOf(0L, 9000L)) assertTrue(Director.lengthOf(rest, w, q) >= Director.BURST_MS + Director.CAST_READ_MS)
        assertEquals(Director.BURST_MIN_MS + Director.CAST_READ_PROMPT_MS, rest.minMs)
    }

    /**
     * T6 (Arena clip 1): a spell that asks goes up first. The poll that asks for its target has its leg to the stack (and no
     * silent 380 ms step); the poll after you answer has its taps and its rest only, never a second flight.
     */
    @Test fun aTargetedSpellGoesUpThenAsksThenTapsAndRests() {
        val mountain = permanent(40, "Mountain", "Basic Land — Mountain")
        val bolt = permanent(951, "Lightning Bolt", "Instant")
        val bears = permanent(960, "Grizzly Bears", "Creature — Bear", controller = cpu)
        val c = card(951, "Lightning Bolt")
        val start = board(listOf(mountain), hand = listOf(bolt.copy(zone = "Hand")), theirs = listOf(bears))
        val up = ev("zone", card = c, from = "Hand", to = "Stack", player = null)
        val asking = board(listOf(mountain), theirs = listOf(bears)).copy(inputType = "InputSelectTargets", message = "Select targets for Lightning Bolt", events = listOf(up))
        assertEquals(951, dev.cardstashy.nativeplay.ui.pendingCast(asking)?.id)
        assertEquals(listOf("CAST:TO_STACK:stackcard:370"), legs(Director.plan(asking, listOf(up), before = start)))
        val done = board(listOf(mountain.copy(tapped = true)), theirs = emptyList()).copy(inputType = null, message = "")
        val events = listOf(ev("cast", player = me, source = c, targets = listOf(card(960, "Grizzly Bears"))).copy(stackId = 8),
            ev("zone", card = c, from = "Stack", to = "Graveyard", player = me), ev("resolve", source = c))
        assertEquals(listOf("CAST:TAPS:stackcard:380", "CAST:REST:stackcard:895"), legs(Director.plan(done, events, before = asking)))
        // Cast in one poll with no question (nothing waited on the stack): the flight is there as before.
        assertTrue(legs(Director.plan(done, listOf(up) + events, before = start)).contains("CAST:TO_STACK:stackcard:370"))
    }

    /** T6: Cancel while it asks: one leg from the stack back to its place in your hand, no other step and no card-to-hand sound. */
    @Test fun cancelPutsTheCardBackInYourHand() {
        val mountain = permanent(40, "Mountain", "Basic Land — Mountain")
        val bolt = permanent(951, "Lightning Bolt", "Instant")
        val c = card(951, "Lightning Bolt")
        val up = ev("zone", card = c, from = "Hand", to = "Stack", player = null)
        val asking = board(listOf(mountain)).copy(inputType = "InputSelectTargets", message = "Select targets for Lightning Bolt", events = listOf(up))
        val down = ev("zone", card = c, from = "Stack", to = "Hand", player = me)
        val back = board(listOf(mountain), hand = listOf(bolt.copy(zone = "Hand"))).copy(inputType = null, message = "", events = listOf(up, down))
        val steps = Director.plan(back, listOf(down), before = asking)
        assertEquals(listOf("TO_HAND:BACK:hand951:380"), legs(steps))
        assertEquals(1, steps.size)
        assertEquals(null, steps[0].cue)
        // Forge gave the card a new id on the way back: the same name still goes back.
        val renamed = ev("zone", card = card(977, "Lightning Bolt"), from = "Stack", to = "Hand", player = me)
        assertEquals(listOf("TO_HAND:BACK:hand977:380"), legs(Director.plan(back, listOf(renamed), before = asking)))
        // A card bounced from the stack with nothing waiting is the usual card-to-hand step.
        assertEquals("CARD-020", Director.plan(back, listOf(down), before = board(listOf(mountain))).single().cue)
    }

    /** An aura goes from the stack to its host (380), not to a slot of its own, and its attach is not a second trip. */
    @Test fun auraGoesFromTheStackToItsHost() {
        val giant = permanent(960, "Hill Giant", "Creature — Giant")
        val armor = permanent(961, "Ethereal Armor", "Enchantment — Aura", attachedTo = 960)
        val before = board(listOf(giant), hand = listOf(armor.copy(zone = "Hand", attachedTo = null)))
        val st = board(listOf(giant.copy(attachments = listOf(961)), armor))
        val a = card(961, "Ethereal Armor")
        val events = listOf(ev("zone", card = a, from = "Hand", to = "Stack", player = null), ev("cast", player = me, source = a, targets = listOf(card(960, "Hill Giant"))),
            ev("zone", card = a, from = "Stack", to = "Battlefield", player = me), ev("attach", card = a), ev("resolve", source = a))
        val steps = Director.plan(st, events, before = before)
        assertEquals(listOf("CAST:TO_STACK:stackcard:370", "CAST:REST:stackcard:895", "ENTER:TO_HOST:c960:380"), legs(steps))
        assertTrue(steps.any { it.kind == Director.Kind.ATTACH && it.travel == null })
        // When Forge reports only the attach (no zone move), the attach carries the trip to the host.
        val bare = Director.plan(st, events.filter { it.type != "zone" }, before = before)
        assertEquals(listOf("CAST:TO_STACK:stackcard:370", "CAST:REST:stackcard:895", "ATTACH:TO_HOST:c960:380"), legs(bare))
    }

    /** A land skips the stack: hand to its group, 380 ms, and no cast step. */
    @Test fun ownLandGoesStraightToItsGroup() {
        val forest = permanent(42, "Forest", "Basic Land — Forest")
        val before = board(emptyList(), hand = listOf(forest.copy(zone = "Hand")))
        val st = board(listOf(forest))
        val f = card(42, "Forest")
        val steps = Director.plan(st, listOf(ev("zone", card = f, from = "Hand", to = "Battlefield", player = me), ev("land", player = me, card = f)), before = before)
        assertEquals(listOf("LAND:TO_GROUP:c42:380"), legs(steps))
        assertTrue(steps.none { it.kind == Director.Kind.CAST })
    }

    /** The CPU's cast starts from its seat: it still thinks first, it goes up, its lands pay into it, and its caption rides on the rest (burst 370 + read 525). */
    @Test fun cpuCastThinksTapsFliesAndRestsWithItsCaption() {
        val mountain = permanent(70, "Mountain", "Basic Land — Mountain", controller = cpu)
        val chariot = permanent(903, "Goblin Chariot", "Creature — Goblin", controller = cpu)
        val before = board(emptyList(), theirs = listOf(mountain)).copy(activePlayer = cpu)
        val st = board(emptyList(), theirs = listOf(mountain.copy(tapped = true), chariot)).copy(activePlayer = cpu)
        val c = card(903, "Goblin Chariot")
        val steps = Director.plan(st, listOf(ev("cast", source = c), ev("zone", card = c, from = "Stack", to = "Battlefield"), ev("resolve", source = c)),
            Director.ThinkClock { .5 }, before = before).filter { it.held }
        assertEquals(listOf("THINK:null:null", "CAST:TO_STACK:stackcard", "CAST:TAPS:stackcard", "CAST:REST:stackcard", "ENTER:TO_SLOT:c903"),
            steps.map { "${it.kind}:${it.travel?.leg}:${it.travel?.toKey}" })
        assertEquals(Director.tapsMs(1), 170L); assertEquals(380L, Director.payMs(1))
        val rest = steps.first { it.travel?.leg == Director.Leg.REST }
        assertTrue(rest.beat?.title == "CPU casts Goblin Chariot" && rest.ms >= Director.BURST_MS + Director.CAST_READ_MS && rest.cpu)
        assertTrue(steps.filter { it.travel != null }.none { it.travel!!.mine })
        // Its land: the caption as before, and the card travels from its seat to its group.
        val land = Director.plan(st, listOf(ev("land", card = card(71, "Mountain"))), Director.ThinkClock { .5 }).last()
        assertTrue(land.beat != null && land.travel?.leg == Director.Leg.TO_GROUP && land.travel.toKey == "c71")
    }

    /** Every event in a real match log becomes a step or is on the silent list; no unknown type. */
    @Test fun coverage() {
        for (n in listOf("duel", "pod")) {
            val st = MatchState.parse(res("history/$n.json"))!!
            val unknown = st.events.map { it.type }.filter { it !in Director.KNOWN && it !in setOf("attack", "block") }.distinct()
            assertEquals("unknown event types in $n", emptyList<String>(), unknown)
            Director.plan(st, st.events)
        }
    }

    /** With a prompt waiting or a long queue no held step is shorter than its Min; focal ones keep their length. */
    @Test fun floors() {
        val steps = Director.plan(duel.copy(prompt = null), duel.events, Director.ThinkClock { .3 })
        for (s in steps) for (w in listOf(true, false)) for (q in listOf(0L, 9000L)) {
            val ms = Director.lengthOf(s, w, q)
            if (s.kind != Director.Kind.THINK) assertTrue("$s at $ms", ms >= s.minMs)
            if (s.focal && s.kind != Director.Kind.THINK) assertEquals(maxOf(s.ms, s.minMs), ms)
        }
    }

    /** 1,000 planned think times: inside their range, never the same twice running, at most 8 s a turn, Fast halves them. */
    @Test fun thinkRanges() {
        val r = java.util.Random(7)
        val clock = Director.ThinkClock { r.nextDouble() }
        var last = -1L
        for (turn in 1..250) {
            var spent = 0L
            for (d in Director.Decision.values().take(4)) {
                val ms = clock.next(d, turn)
                spent += ms
                assertTrue("$d $ms", ms <= d.hi)
                if (spent <= Director.CAP_MS && ms != 0L) assertTrue("$d $ms", ms >= d.lo || spent >= Director.CAP_MS - d.hi)
                assertTrue("repeat $ms", ms != last || ms == 0L); last = ms
            }
            assertTrue(spent <= Director.CAP_MS)
        }
        val fast = Director.ThinkClock { .5 }.next(Director.Decision.LAND, 1, fast = true)
        assertEquals(425L, fast)
        // No think while one of your questions or the opening hand is open.
        val prompted = duel.copy(turn = 0, status = "running", hasPriorityView = false)
        assertTrue(Director.plan(prompted, listOf(ev("land", card = card(1, "Mountain"))), Director.ThinkClock()).none { it.kind == Director.Kind.THINK })
    }
}
