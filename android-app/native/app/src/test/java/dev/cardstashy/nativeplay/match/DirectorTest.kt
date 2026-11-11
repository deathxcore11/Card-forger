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

    /** Your creature: two lands tap one by one (70 ms apart, 140 ms turn), it flies to the stack (440), rests (900), then to its slot (380). */
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
        assertEquals(listOf("CAST:TAPS:null:210", "CAST:TO_STACK:stackcard:440", "CAST:REST:stackcard:900", "ENTER:TO_SLOT:c950:380"), legs(steps))
        assertEquals(listOf(40, 41), steps.first { it.travel?.leg == Director.Leg.TAPS }.travel!!.taps)
        assertTrue(steps.mapNotNull { it.travel }.all { it.mine && it.cardId == 950 && it.stackId == 7 || it.leg == Director.Leg.TO_SLOT })
        // No step of the travel plays a sound of its own: the cast sound stays the table audio's one.
        assertTrue(steps.filter { it.travel != null }.all { it.cue == null })
        // The rest is focal, so a waiting prompt or a long queue never cuts it under 900 ms.
        val rest = steps.first { it.travel?.leg == Director.Leg.REST }
        assertTrue(rest.focal)
        for (w in listOf(true, false)) for (q in listOf(0L, 9000L)) assertTrue(Director.lengthOf(rest, w, q) >= Director.STACK_HOLD_MS)
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
        assertEquals(listOf("CAST:TO_STACK:stackcard:440", "CAST:REST:stackcard:900", "ENTER:TO_HOST:c960:380"), legs(steps))
        assertTrue(steps.any { it.kind == Director.Kind.ATTACH && it.travel == null })
        // When Forge reports only the attach (no zone move), the attach carries the trip to the host.
        val bare = Director.plan(st, events.filter { it.type != "zone" }, before = before)
        assertEquals(listOf("CAST:TO_STACK:stackcard:440", "CAST:REST:stackcard:900", "ATTACH:TO_HOST:c960:380"), legs(bare))
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

    /** The CPU's cast starts from its seat: it still thinks first, its lands tap, and its caption rides on the rest (at least 900 ms). */
    @Test fun cpuCastThinksTapsFliesAndRestsWithItsCaption() {
        val mountain = permanent(70, "Mountain", "Basic Land — Mountain", controller = cpu)
        val chariot = permanent(903, "Goblin Chariot", "Creature — Goblin", controller = cpu)
        val before = board(emptyList(), theirs = listOf(mountain)).copy(activePlayer = cpu)
        val st = board(emptyList(), theirs = listOf(mountain.copy(tapped = true), chariot)).copy(activePlayer = cpu)
        val c = card(903, "Goblin Chariot")
        val steps = Director.plan(st, listOf(ev("cast", source = c), ev("zone", card = c, from = "Stack", to = "Battlefield"), ev("resolve", source = c)),
            Director.ThinkClock { .5 }, before = before).filter { it.held }
        assertEquals(listOf("THINK:null:null", "CAST:TAPS:null", "CAST:TO_STACK:stackcard", "CAST:REST:stackcard", "ENTER:TO_SLOT:c903"),
            steps.map { "${it.kind}:${it.travel?.leg}:${it.travel?.toKey}" })
        assertEquals(Director.tapsMs(1), 140L)
        val rest = steps.first { it.travel?.leg == Director.Leg.REST }
        assertTrue(rest.beat?.title == "CPU casts Goblin Chariot" && rest.ms >= Director.STACK_HOLD_MS && rest.cpu)
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
