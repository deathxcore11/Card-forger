package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.StackItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A TRIGGER SHOWS ITSELF (match-table-master.md): each resolve tied to what it changed, from fixture event sequences in the
 * order the bridge writes them (ForgeHttpBridge: a stack item's effects are logged first, its "resolve" last; counters carry
 * counter/from/to and the resolving card as source; a token's zone event carries token=true and by).
 */
class TriggerResultTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val me = base.viewer
    private val cpu = base.players.first { it.id != me }.id
    private var seq = 1000L

    // Your side: Hill Giant 107 (3/3), Grizzly Bears 108 (2/2), Goblin Guide 109 (2/2). CPU: Grizzly Bears 123 (2/2), Hill Giant 124 (3/3).
    private val scavenger = base.me.battlefield.first { it.id == 107 }.copy(id = 200, name = "Optimistic Scavenger", power = 1, toughness = 1,
        text = "Eerie — Whenever an enchantment you control enters and whenever you fully unlock a Room, put a +1/+1 counter on target creature.")

    private fun ref(id: Int, name: String? = null) = Ref("card", id, name)
    private fun ev(type: String, player: Int? = null, card: Ref? = null, source: Ref? = null, targets: List<Ref> = emptyList(), from: String? = null, to: String? = null,
                   amount: Int? = null, lifeFrom: Int? = null, lifeTo: Int? = null, target: Ref? = null, fizzled: Boolean = false, token: Boolean = false,
                   stackId: Int? = null, counter: String? = null, by: Ref? = null, combat: Boolean = false) =
        GameEvent(++seq, type, 5, "MAIN1", player, card, source, target, targets, emptyList(), emptyList(), from, to, amount, lifeFrom, lifeTo, null,
            fizzled = fizzled, token = token, stackId = stackId, counter = counter, by = by, combat = combat)

    /** [st] with each battlefield card [change]d (by id), plus [add] on your side. */
    private fun board(st: MatchState, add: List<Card> = emptyList(), change: (Card) -> Card = { it }) = st.copy(players = st.players.map { p ->
        p.copy(battlefield = (p.battlefield + if (p.id == me) add else emptyList()).map(change)) })
    private fun pt(c: Card, p: Int, t: Int, counters: Map<String, Int> = c.counters) = c.copy(power = p, toughness = t, counters = counters)

    /** Randall's case on live 0.4.56: an enchantment enters, Optimistic Scavenger triggers and its +1/+1 counter lands on Grizzly Bears, all in one poll. */
    @Test fun scavengerCounterInOnePoll() {
        val before = board(base.copy(stack = emptyList()), listOf(scavenger))
        val after = board(before) { if (it.id == 108) pt(it, 3, 3, mapOf("P1P1" to 1)) else it }
        val armor = ref(300, "Ethereal Armor")
        val events = listOf(
            ev("cast", me, source = armor, targets = listOf(ref(108)), stackId = 5),
            ev("zone", card = armor, from = "Stack", to = "Battlefield"),
            ev("resolve", source = armor),
            ev("trigger", me, source = ref(200, "Optimistic Scavenger"), targets = listOf(ref(108, "Grizzly Bears")), stackId = 6),
            ev("counters", card = ref(108, "Grizzly Bears"), counter = "P1P1", from = "0", to = "1", source = ref(200)),
            ev("resolve", source = ref(200, "Optimistic Scavenger")),
        )
        val res = Director.resolutions(before, after, events)
        assertEquals(2, res.size)
        val (spell, trig) = res
        assertFalse(spell.trigger); assertTrue("the enchantment's resolve owns nothing: $spell", spell.empty)
        assertTrue(trig.trigger); assertEquals(6, trig.stackId); assertEquals(200, trig.sourceId); assertEquals(me, trig.controller)
        assertEquals(listOf(Director.CounterChange(108, "Grizzly Bears", "P1P1", 1)), trig.counters)
        assertEquals(listOf(Director.PtChange(108, "Grizzly Bears", 2, 2, 3, 3)), trig.pt)
        assertEquals(listOf(108), trig.changed)
        assertEquals("Optimistic Scavenger: +1/+1 counter on Grizzly Bears", trig.line(me))

        // The plan: your cast travels first (0.4.59 T5: to the stack, its rest, onto the board), then the source beat with its stack
        // hold (never on a snapshot), then the landing, all held, yours.
        val all = Director.plan(after, events, before = before).filter { it.held }
        // M6: to the stack, the pop, the rest.
        assertEquals(listOf(Director.Kind.CAST, Director.Kind.CAST, Director.Kind.CAST, Director.Kind.ENTER, Director.Kind.TRIGGER, Director.Kind.RESULT), all.map { it.kind })
        assertTrue(all.take(4).all { it.travel?.mine == true && it.travel.cardId == 300 })
        val steps = all.drop(4)
        val t = steps[0].trig!!
        assertTrue(t.yours); assertTrue(t.resolvedHere); assertEquals(200, t.sourceId)
        assertEquals(Director.SOURCE_MS + Director.STACK_HOLD_MS, steps[0].ms)
        // Its item stays up after its read: the result is still to land.
        assertTrue(Director.keepsStack(t, listOf(trig))); assertEquals(trig, Director.resultFor(t, listOf(trig)))
        assertEquals(trig, steps[1].result); assertEquals(Director.RESULT_MS, Director.lengthOf(steps[1], true, 9000))

        // Until its beat the Bears keep their old numbers and no counter.
        val shownBefore = Director.beforeResults(after, before, listOf(trig))
        val bears = shownBefore.me.battlefield.first { it.id == 108 }
        assertEquals(2, bears.power); assertEquals(2, bears.toughness); assertTrue(bears.counters.isEmpty())
        // Its own words when no snapshot showed the item: the source's trigger line.
        assertEquals("Whenever an enchantment you control enters, put a +1/+1 counter on target creature.", Director.triggerText("Flying\nWhenever an enchantment you control enters, put a +1/+1 counter on target creature."))
    }

    /** Two triggers in one poll, one each side: the stack resolves the top one first; each result goes to its own resolve. */
    @Test fun twoTriggersInOnePoll() {
        val before = base.copy(stack = emptyList())
        // Your Hill Giant's trigger gives Goblin Guide +2/+0 (no counters); the CPU's Hill Giant's puts a +1/+1 counter on its Bears.
        val after = board(before) { when (it.id) { 109 -> pt(it, 4, 2); 123 -> pt(it, 3, 3, mapOf("P1P1" to 1)); else -> it } }
        val events = listOf(
            ev("trigger", cpu, source = ref(124, "Hill Giant"), targets = listOf(ref(123)), stackId = 10),
            ev("trigger", me, source = ref(107, "Hill Giant"), targets = listOf(ref(109)), stackId = 11),
            ev("resolve", source = ref(107, "Hill Giant")),
            ev("counters", card = ref(123, "Grizzly Bears"), counter = "P1P1", from = "0", to = "1", source = ref(124)),
            ev("resolve", source = ref(124, "Hill Giant")),
        )
        val res = Director.resolutions(before, after, events)
        assertEquals(2, res.size)
        val (mine, theirs) = res
        assertEquals(11, mine.stackId); assertEquals(me, mine.controller); assertTrue(mine.counters.isEmpty())
        assertEquals(listOf(Director.PtChange(109, "Goblin Guide", 2, 2, 4, 2)), mine.pt)
        assertTrue(mine.pt.single().up)
        assertEquals(10, theirs.stackId); assertEquals(cpu, theirs.controller)
        assertEquals(listOf(Director.CounterChange(123, "Grizzly Bears", "P1P1", 1)), theirs.counters)
        assertEquals(listOf(Director.PtChange(123, "Grizzly Bears", 2, 2, 3, 3)), theirs.pt)
        assertEquals("Hill Giant: Goblin Guide +2/+0", mine.line(me))

        val steps = Director.plan(after, events, before = before).filter { it.held }
        assertEquals(listOf(Director.Kind.TRIGGER, Director.Kind.TRIGGER, Director.Kind.RESULT, Director.Kind.RESULT), steps.map { it.kind })
        assertFalse("the CPU's trigger is drawn in its colour", steps[0].trig!!.yours); assertTrue(steps[0].cpu)
        assertTrue(steps[1].trig!!.yours)
        assertEquals(listOf(107, 124), steps.drop(2).map { it.result!!.sourceId })
    }

    /** A trigger seen on an earlier poll whose target left: it fizzles, nothing lands, and the trail says why. */
    @Test fun fizzle() {
        val item = StackItem(7, "Hill Giant — Whenever this attacks, it deals 1 damage to target creature.", base.me.battlefield.first { it.id == 107 }, me,
            ability = true, targets = listOf(ref(123, "Grizzly Bears")))
        val before = base.copy(stack = listOf(item))
        val after = board(base.copy(stack = emptyList())) { it }.let { st -> st.copy(players = st.players.map { p -> p.copy(battlefield = p.battlefield.filter { it.id != 123 }) }) }
        val events = listOf(
            ev("zone", card = ref(123, "Grizzly Bears"), from = "Battlefield", to = "Graveyard"),
            ev("resolve", source = ref(107, "Hill Giant"), fizzled = true),
        )
        val res = Director.resolutions(before, after, events, triggerIds = setOf(7)).single()
        assertTrue(res.trigger); assertTrue(res.fizzled); assertEquals(7, res.stackId); assertTrue(res.empty)
        assertEquals(item.text, res.text)
        assertEquals("Hill Giant: no legal targets", res.line(me))
        val steps = Director.plan(after, events, before = before, triggerIds = setOf(7)).filter { it.held }
        assertEquals(listOf(Director.Kind.RESULT), steps.map { it.kind })
        assertEquals(Director.FIZZLE_MS, steps.single().ms)
        // Without the trigger mark (an ability or a spell) a fizzle stays the quiet step it was.
        assertTrue(Director.plan(after, events, before = before).none { it.held })
    }

    /** A pump with no counters, its trigger put up on the poll before: the P/T comes from the board diff around the resolve. */
    @Test fun pumpWithoutCounters() {
        val item = StackItem(8, "Hill Giant — Whenever you cast a spell, target creature gets +1/+1 until end of turn.", base.me.battlefield.first { it.id == 107 }, me,
            ability = true, targets = listOf(ref(108, "Grizzly Bears")))
        val before = base.copy(stack = listOf(item))
        val after = board(base.copy(stack = emptyList())) { if (it.id == 108) pt(it, 3, 3) else it }
        // A counter Forge tied to another resolving card (source 999) is never this resolve's.
        val events = listOf(ev("counters", card = ref(124, "Hill Giant"), counter = "P1P1", from = "0", to = "1", source = ref(999)), ev("resolve", source = ref(107, "Hill Giant")))
        val r = Director.resolutions(before, after, events, triggerIds = setOf(8)).single()
        assertTrue(r.trigger); assertTrue(r.counters.isEmpty())
        assertEquals(listOf(Director.PtChange(108, "Grizzly Bears", 2, 2, 3, 3)), r.pt)
        assertEquals("Hill Giant: Grizzly Bears +1/+1", r.line(me))
        assertEquals(listOf(Director.Kind.RESULT), Director.plan(after, events, before = before, triggerIds = setOf(8)).filter { it.held }.map { it.kind })
        // Down: coral. The same diff across a turn is not given to anyone (an "until end of turn" ending).
        val shrunk = board(base.copy(stack = emptyList())) { if (it.id == 108) pt(it, 1, 1) else it }
        assertFalse(Director.resolutions(before, shrunk, events, setOf(8)).single().pt.single().up)
        val crossed = Director.resolutions(before.copy(stack = emptyList()), after, listOf(ev("cast", me, source = ref(301, "Shock"), stackId = 9), ev("resolve", source = ref(301)), ev("turn", me)))
        assertTrue(crossed.single().pt.isEmpty())
        // Without a before board there is no P/T to compare and nothing is made up.
        assertTrue(Director.resolutions(null, after, events, setOf(8)).single().pt.isEmpty())
    }

    /** Three copies of one trigger on one card are one beat ×3 (I1 addition a); tokens a trigger makes are its result, from the source. */
    @Test fun collapseAndTokens() {
        val before = board(base.copy(stack = emptyList()), listOf(scavenger))
        val after = board(before) { if (it.id == 108) pt(it, 5, 5, mapOf("P1P1" to 3)) else it }
        val src = ref(200, "Optimistic Scavenger")
        val events = (0 until 3).map { ev("trigger", me, source = src, targets = listOf(ref(108)), stackId = 20 + it) } + (0 until 3).flatMap { i ->
            listOf(ev("counters", card = ref(108, "Grizzly Bears"), counter = "P1P1", from = "$i", to = "${i + 1}", source = src), ev("resolve", source = src)) }
        val r = Director.resolutions(before, after, events).single()
        assertEquals(3, r.count); assertEquals(3, r.counters.sumOf { it.delta })
        assertEquals(listOf(Director.PtChange(108, "Grizzly Bears", 2, 2, 5, 5)), r.pt)
        assertEquals("Optimistic Scavenger ×3: 3 +1/+1 counters on Grizzly Bears", r.line(me))
        val steps = Director.plan(after, events, before = before).filter { it.held }
        assertEquals(listOf(Director.Kind.TRIGGER, Director.Kind.RESULT), steps.map { it.kind })
        assertEquals(3, steps[0].count); assertEquals(3, steps[1].count)

        val token = Ref("card", 400, "Goblin Token")
        val tokEvents = listOf(ev("trigger", cpu, source = ref(124, "Hill Giant"), stackId = 30),
            ev("zone", card = token, to = "Battlefield", token = true, by = ref(124)), ev("resolve", source = ref(124, "Hill Giant")))
        val goblin = base.cpu.battlefield.first { it.id == 123 }.copy(id = 400, name = "Goblin Token", token = true, power = 1, toughness = 1)
        val withToken = base.copy(stack = emptyList(), players = base.players.map { p -> if (p.id == cpu) p.copy(battlefield = p.battlefield + goblin) else p })
        val t = Director.resolutions(base.copy(stack = emptyList()), withToken, tokEvents).single()
        assertEquals(listOf(400), t.tokens.map { it.id }); assertEquals("Hill Giant: created a Goblin Token", t.line(me))
        assertTrue(Director.beforeResults(withToken, base, listOf(t)).cpu.battlefield.none { it.id == 400 })
        assertNull(Director.resolutions(base, base, listOf(ev("resolve", source = ref(124)))).single().line(me))
    }

    /** A trigger Forge resolved in the poll that changed nothing shown (a draw): no landing, and its item leaves the stack after its read. */
    @Test fun emptyResultLeavesStack() {
        val before = board(base.copy(stack = emptyList()), listOf(scavenger))
        val events = listOf(
            ev("trigger", me, source = ref(200, "Optimistic Scavenger"), stackId = 60),
            ev("draw", me, card = ref(501)),
            ev("resolve", source = ref(200, "Optimistic Scavenger")),
        )
        val steps = Director.plan(before, events, before = before).filter { it.held }
        assertEquals(listOf(Director.Kind.TRIGGER), steps.map { it.kind })
        val t = steps.single().trig!!
        assertTrue(t.resolvedHere)
        val pending = steps.mapNotNull { it.result }
        assertFalse("nothing is left to land, so the item comes off after its read", Director.keepsStack(t, pending))
        // A result of another trigger from the same source never lends its words or keeps this one up.
        val other = Director.Resolution(1, 61, 200, "Optimistic Scavenger", me, true, false, "other text", emptyList(), counters = listOf(Director.CounterChange(108, "Grizzly Bears", "P1P1", 1)))
        assertFalse(Director.keepsStack(t, listOf(other))); assertNull(Director.resultFor(t, listOf(other)))
    }

    /** Forge's real order for repeats (trigger, its counter, its resolve; again): one source beat ×3 and one landing ×3, not three lifts. */
    @Test fun interleavedRepeatIsOneBeat() {
        val before = board(base.copy(stack = emptyList()), listOf(scavenger))
        val after = board(before) { if (it.id == 108) pt(it, 5, 5, mapOf("P1P1" to 3)) else it }
        val src = ref(200, "Optimistic Scavenger")
        val events = (0 until 3).flatMap { i -> listOf(ev("trigger", me, source = src, targets = listOf(ref(108)), stackId = 70 + i),
            ev("counters", card = ref(108, "Grizzly Bears"), counter = "P1P1", from = "$i", to = "${i + 1}", source = src), ev("resolve", source = src)) }
        val r = Director.resolutions(before, after, events).single()
        assertEquals(3, r.count); assertEquals(listOf(70, 71, 72), r.stackIds)
        assertEquals(listOf(Director.PtChange(108, "Grizzly Bears", 2, 2, 5, 5)), r.pt)
        val steps = Director.plan(after, events, before = before).filter { it.held }
        assertEquals(listOf(Director.Kind.TRIGGER, Director.Kind.RESULT), steps.map { it.kind })
        assertEquals(3, steps[0].count); assertEquals(70, steps[0].trig!!.stackId); assertTrue(steps[0].trig!!.resolvedHere)
        assertTrue(Director.keepsStack(steps[0].trig!!, listOf(r)))
    }

    /** A P/T change Forge never tied to the resolve (a lord it killed, a pump ending across a turn) is not credited to it. */
    @Test fun ptOnlyWhatForgeTied() {
        // Your Hill Giant's trigger deals 2 to the CPU's Hill Giant (say a lord); it dies and the CPU's Bears drop to 1/1.
        val before = base.copy(stack = emptyList())
        val after = before.copy(players = before.players.map { p -> p.copy(battlefield = p.battlefield.filter { it.id != 124 }.map { if (it.id == 123) pt(it, 1, 1) else it }) })
        val events = listOf(ev("trigger", me, source = ref(107, "Hill Giant"), targets = listOf(ref(124)), stackId = 80),
            ev("damage", source = ref(107), target = ref(124, "Hill Giant"), amount = 2), ev("resolve", source = ref(107, "Hill Giant")))
        val r = Director.resolutions(before, after, events).single()
        assertEquals(1, r.damage.size); assertTrue("the Bears' drop is not this trigger's: ${r.pt}", r.pt.isEmpty())
        assertEquals("Hill Giant: 2 damage to Hill Giant", r.line(me))

        // Across a turn: a +1/+1 counter lands while a +3/+3 ends (5/5 to 3/3). The counter shows; the plate does not tick coral.
        val pumped = board(board(base.copy(stack = emptyList()), listOf(scavenger))) { if (it.id == 108) pt(it, 5, 5) else it }
        val ended = board(pumped) { if (it.id == 108) pt(it, 3, 3, mapOf("P1P1" to 1)) else it }
        val turn = listOf(ev("turn", me), ev("trigger", me, source = ref(200, "Optimistic Scavenger"), targets = listOf(ref(108)), stackId = 81),
            ev("counters", card = ref(108, "Grizzly Bears"), counter = "P1P1", from = "0", to = "1", source = ref(200)), ev("resolve", source = ref(200)))
        val c = Director.resolutions(pumped, ended, turn).single()
        assertEquals(1, c.counters.single().delta); assertTrue(c.pt.isEmpty())
        // The same counter across a turn with nothing else moving keeps its plate tick (the counter explains it all).
        val plain = board(board(base.copy(stack = emptyList()), listOf(scavenger))) { if (it.id == 108) pt(it, 3, 3, mapOf("P1P1" to 1)) else it }
        assertEquals(listOf(Director.PtChange(108, "Grizzly Bears", 2, 2, 3, 3)), Director.resolutions(board(base.copy(stack = emptyList()), listOf(scavenger)), plain, turn).single().pt)
    }

    /** A dies trigger: no player on the event and its source off the battlefield, still read as yours (gold, "Your trigger"). */
    @Test fun diesTriggerKeepsItsSide() {
        val guide = base.me.battlefield.first { it.id == 109 }
        val before = base.copy(stack = emptyList())
        val after = before.copy(players = before.players.map { p -> if (p.id == me) p.copy(battlefield = p.battlefield.filter { it.id != 109 }, graveyard = p.graveyard + guide.copy(controller = -1)) else p })
        val events = listOf(ev("trigger", source = ref(109, "Goblin Guide"), stackId = 90), ev("life", player = cpu, lifeFrom = 20, lifeTo = 19), ev("resolve", source = ref(109)))
        val t = Director.plan(after, events, before = before).first { it.trig != null }.trig!!
        assertTrue(t.yours); assertEquals(me, t.controller)
    }

    /** The auto-pass with a trigger on top: waits until it is on screen, then for the rest of its 900 ms read. */
    @Test fun passWaitsForTheRead() {
        assertNull(Director.passWait(null, 5000, 200))
        assertEquals(600L, Director.passWait(4700, 5000, 200))
        assertEquals(200L, Director.passWait(3000, 5000, 200))
        assertEquals(Director.STACK_HOLD_MS, Director.passWait(5000, 5000, 0))
        // 0.4.59 T5: a spell (not a trigger) on top rests its 900 ms too; nothing on the stack passes after the base delay.
        assertEquals(800L, Director.passWaitFor(7, mapOf(7 to 4900L), listOf(7), 5000, 200))
        assertNull(Director.passWaitFor(7, mapOf(7 to 4900L), emptyList(), 5000, 200))
        assertEquals(200L, Director.passWaitFor(null, emptyMap(), emptyList(), 5000, 200))
    }
}
