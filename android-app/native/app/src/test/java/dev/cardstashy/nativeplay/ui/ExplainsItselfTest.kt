package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * specs/explains-itself-briefs.md (approved by Randall 19 Nov 2026), briefs E2 and E4. Written before the build: each test fails on
 * f235316f and names what the build must make true.
 */
class ExplainsItselfTest {
    private val base = MatchState.parse(javaClass.getResource("/table/snap-main.json")!!.readText())!!
    private val cpu = base.players.first { it.id != base.viewer }.id
    /** Randall's 19 Nov recording of 0.4.99, 2:37: the CPU's Ba Sing Se trigger on top, your priority in your own main phase. */
    private val cpuTrigger = base.copy(
        stack = listOf(StackItem(900, "Ba Sing Se — When it dies or is exiled, return it to the battlefield tapped.", null, cpu, ability = true, trigger = true)),
        buttons = Buttons("OK", null, true, false))

    /** E2.1: he held a creature and a sorcery, so nothing could answer. The table passes by itself: it asks nothing and offers no press. */
    @Test fun noQuestionWhenNothingYouHoldCanAnswer() {
        val st = cpuTrigger.copy(selection = cpuTrigger.selection.copy(actionable = emptySet()))
        assertTrue("nothing to stop for", Glow.stopsFor(st).isEmpty())
        assertNull("no \"Respond to Ba Sing Se?\" while the table will pass for you", askLine(st))
        assertEquals("the gold button is not a press", RESOLVING, okLabel(st))
    }

    /** E2.2: with a real answer the table stops, asks, and the gold button reads "Let it resolve" (table-info I7, approved 10 Nov). */
    @Test fun withAnAnswerTheTableAsksAndGoldSaysLetItResolve() {
        val st = cpuTrigger
        assertTrue("the fixture holds something Forge lists and you can pay for", Glow.stopsFor(st).isNotEmpty())
        assertEquals("Respond to Ba Sing Se?", askLine(st))
        assertEquals("Let it resolve", okLabel(st))
    }

    /**
     * E4: Forge's own surveil 1 question, seen in a JVM run of the engine on 11 Nov (builder/surveil-prompt-brief.md): a plain
     * InputConfirm, no prompt, Library is OK and Graveyard is cancel. Today the view knows only the scry words, so no card shows.
     */
    @Test fun surveilOneShowsItsCard() {
        val surveil = base.copy(inputType = "InputConfirm", prompt = null, buttons = Buttons("Library", "Graveyard", true, true),
            message = "Swords to Plowshares (58)\n\nPut Swords to Plowshares on the top of library or graveyard?")
        assertEquals("Swords to Plowshares", ScryOne.of(surveil))
        // A scry stays a scry, and another yes/no is neither.
        assertNull(ScryOne.of(surveil.copy(buttons = Buttons("Yes", "No", true, true))))
    }

    // ---- E1: a card you can't use says why ----
    private val me = base.me
    private fun mine(hand: List<dev.cardstashy.nativeplay.engine.Card>? = null, field: List<dev.cardstashy.nativeplay.engine.Card>? = null, st: MatchState = base) =
        st.copy(players = st.players.map { if (it.id == st.viewer) it.copy(hand = hand ?: it.hand, battlefield = field ?: it.battlefield, mana = it.mana.mapValues { 0 }) else it })
    private val mountains = me.battlefield.filter { it.name == "Mountain" }.map { it.copy(tapped = false) }
    private val serra = me.hand.first { it.name == "Monastery Swiftspear" }.copy(id = 990, name = "Serra Angel", type = "Creature — Angel", manaCost = "{3}{W}{W}",
        text = "Flying, vigilance", keywords = listOf("Flying", "Vigilance"), power = 4, toughness = 4)

    /** E1.1: a 5-cost card with three lands: three pips lit, two missing, "2 mana short"; the three lands wear the payment light. */
    @Test fun fiveCostWithThreeLandsIsTwoShort() {
        val st = mine(hand = listOf(serra), field = mountains)
        val short = Affordability.manaShort(serra, st, st.me.mana)!!
        assertEquals(5, short.pips.size); assertEquals(3, short.pips.count { it.paid }); assertEquals(2, short.missing)
        assertEquals("the red lands pay the plain part, never the white", listOf("W", "W"), short.pips.filter { !it.paid }.map { it.symbol })
        assertEquals("2 mana short", WhyNot.short(short.missing))
        assertEquals(mountains.map { it.id }.toSet(), Affordability.openSources(st))
        // Enough lands: nothing to say. A source the reader cannot count: nothing to say either (the old line stays).
        assertNull(Affordability.manaShort(serra.copy(manaCost = "{2}{R}"), st, st.me.mana))
    }

    /** E1.2: on the CPU's turn a sorcery or a creature Forge does not offer says "Only on your turn"; an instant or a flash card says nothing. */
    @Test fun timingReasonOnlyWhenTheCardTypeCanNeverAllowIt() {
        val theirs = base.copy(activePlayer = cpu, priorityPlayer = cpu, inputType = null, selection = base.selection.copy(actionable = emptySet()))
        val sorcery = me.hand.first { it.name == "Skewer the Critics" }; val bolt = me.hand.first { it.name == "Lightning Bolt" }; val land = me.hand.first { it.name == "Forest" }
        assertEquals(WhyNot.YOUR_TURN, WhyNot.timing(sorcery, theirs))
        assertEquals("Only on your turn", WhyNot.timing(serra.copy(zone = "Hand"), theirs))
        assertNull("an instant could be cast now", WhyNot.timing(bolt, theirs))
        assertNull("flash", WhyNot.timing(serra.copy(text = "Flash\nFlying"), theirs))
        assertNull("a land has no reason the state can prove", WhyNot.timing(land, theirs))
        // Your turn, combat: main phase only. Your main phase: no timing reason. A card Forge offers: never.
        assertEquals(WhyNot.MAIN_PHASE, WhyNot.timing(sorcery, theirs.copy(activePlayer = base.viewer, phase = "COMBAT_DECLARE_ATTACKERS")))
        assertNull(WhyNot.timing(sorcery, theirs.copy(activePlayer = base.viewer, phase = "MAIN1")))
        assertNull(WhyNot.timing(sorcery, base.copy(activePlayer = cpu)))
    }

    /** E1.3: while Forge asks for attackers, your creature that arrived this turn (no haste) or is tapped has a reason; one that can attack has none. */
    @Test fun creatureThatCannotAttackSaysWhy() {
        val bears = me.battlefield.first { it.name == "Grizzly Bears" }; val guide = me.battlefield.first { it.name == "Goblin Guide" }
        val atk = base.copy(inputType = "InputAttack", phase = "COMBAT_DECLARE_ATTACKERS", selection = base.selection.copy(actionable = emptySet()))
        assertEquals(WhyNot.ARRIVED, WhyNot.attack(bears.copy(summoningSick = true), atk))
        assertEquals(WhyNot.TAPPED, WhyNot.attack(bears.copy(tapped = true), atk))
        assertNull("haste", WhyNot.attack(guide.copy(summoningSick = true), atk))
        assertNull("it can attack", WhyNot.attack(bears, atk))
        assertNull("not while Forge asks something else", WhyNot.attack(bears.copy(summoningSick = true), base))
    }

    // ---- E3: any item on the stack can be read ----
    /** The 19 Nov recording, 2:37: Ba Sing Se's trigger ended "([Forest (72)])". The note never shows; the card it named is kept for the About row. */
    @Test fun stackWordsNeverShowEngineNotesAndTheNamedCardIsKept() {
        val raw = "Ba Sing Se \u2014 When it dies or is exiled, return it to the battlefield tapped. ([Forest (72)])"
        val shown = MatchState.engineRefs(raw)
        assertTrue(shown, !Regex("\\(\\[|\\(\\d+\\)").containsMatchIn(shown))
        assertEquals(listOf(dev.cardstashy.nativeplay.engine.Ref("card", 72, "Forest")), MatchState.notedRefs(raw))
        assertEquals(listOf(111), MatchState.notedRefs("Counterspell (Targeting: [[Stock Up (111)]])").map { it.id })
    }

    @Test fun readerSaysWhoseWhenAndOnlyItsOwnWords() {
        val grave = base.players.first { it.id == cpu }.graveyard.first()
        val mineItem = StackItem(901, "Goblin Guide \u2014 Whenever this creature attacks, defending player reveals the top card of their library.", me.battlefield.first { it.name == "Goblin Guide" }, base.viewer, ability = true, trigger = true)
        val theirs = cpuTrigger.stack[0].copy(noted = listOf(dev.cardstashy.nativeplay.engine.Ref("card", grave.id, grave.name)))
        val st = base.copy(stack = listOf(mineItem, theirs))
        assertEquals("Your trigger", StackRead.whose(mineItem, st)); assertEquals("Happens next", StackRead.order(mineItem, st))
        assertEquals("CPU's trigger", StackRead.whose(theirs, st)); assertEquals("Happens 2nd", StackRead.order(theirs, st))
        assertEquals("When it dies or is exiled, return it to the battlefield tapped.", StackRead.words(theirs))
        // About: the card the note named, with where it is. A card the table cannot find is not shown.
        assertEquals(listOf(grave.name to "In the CPU's graveyard"), StackRead.about(theirs, st).map { it.card.name to it.where })
        assertTrue(StackRead.about(theirs.copy(noted = listOf(dev.cardstashy.nativeplay.engine.Ref("card", 99999, "Forest"))), st).isEmpty())
        // Up and down walk the stack and stop at its ends; an item that left the stack is no longer open.
        StackRead.open = 901; StackRead.step(st, 1); assertEquals(900, StackRead.open); StackRead.step(st, 1); assertEquals(900, StackRead.open)
        StackRead.step(st, -1); assertEquals(901, StackRead.open)
        assertNull(StackRead.item(base)); StackRead.open = null
    }
}
