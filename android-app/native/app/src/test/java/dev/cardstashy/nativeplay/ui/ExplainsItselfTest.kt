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
}
