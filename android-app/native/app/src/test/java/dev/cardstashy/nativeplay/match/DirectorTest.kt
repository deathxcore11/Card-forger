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
        assertEquals(listOf(Director.Kind.BANNER, Director.Kind.DRAW, Director.Kind.THINK, Director.Kind.LAND, Director.Kind.THINK, Director.Kind.CAST,
            Director.Kind.RESOLVE, Director.Kind.DAMAGE, Director.Kind.DIES, Director.Kind.TO_GRAVE, Director.Kind.THINK, Director.Kind.CAST,
            Director.Kind.RESOLVE, Director.Kind.ENTER, Director.Kind.THINK, Director.Kind.ATTACK), kinds)
        // A targeted removal thinks longer than a land; the creature enters and the elf dies as their own steps in one snapshot.
        val thinks = steps.filter { it.kind == Director.Kind.THINK }.map { it.ms }
        assertTrue("land think in 700..1000: $thinks", thinks[0] in 700..1000)
        assertTrue("targeted think in 1500..2100: $thinks", thinks[1] in 1500..2100)
        assertTrue("creature think in 1100..1500: $thinks", thinks[2] in 1100..1500)
        assertTrue(steps.first { it.kind == Director.Kind.CAST }.beat != null)
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
