package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.AutoPass
import dev.cardstashy.nativeplay.ui.TableActions.Press
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mobile table M3 (specs/mobile-table-arena-parity-brief.md): your own spell or trigger on top of the stack resolves by itself,
 * and the gold button does not turn into a Resolve press. It says "Resolving…" and takes no press; if the table has not passed
 * after 2.5 s the press comes back, so the player is never left without a way on.
 */
class ResolveItselfTest {
    private val base = MatchState.parse(javaClass.getResource("/table/snap-main.json")!!.readText())!!
    private fun own(trigger: Boolean) = base.copy(inputType = "InputPassPriority", priorityPlayer = base.viewer, prompt = null, buttons = Buttons("OK", null, true, false),
        stack = listOf(StackItem(9001, "Put a +1/+1 counter on target creature.", null, base.viewer, ability = trigger, trigger = trigger)))

    @Test fun yourOwnSpellOrTriggerOffersNoResolvePress() {
        for (st in listOf(own(trigger = false), own(trigger = true))) {
            assertTrue(AutoPass.resolvesItself(st, stopToRespond = false))
            val gold = TableActions.of(st, true, null, false, false).gold!!
            assertEquals(RESOLVING, gold.label); assertFalse("not a press", gold.enabled)
        }
    }

    @Test fun thePressComesBackWhenTheTableIsLateOrYouAskedToStop() {
        val st = own(trigger = true)
        val late = TableActions.of(st, true, null, false, false, resolveLate = true).gold!!
        assertEquals("Resolve", late.label); assertTrue(late.enabled); assertEquals(Press.OK, late.press)
        assertEquals(2500L, RESOLVE_LATE_MS)
        // "Stop to respond" on, Full Control, or a phase stop of yours here: the table may wait, so the press stays.
        assertFalse(AutoPass.resolvesItself(st, stopToRespond = true))
        assertFalse(AutoPass.resolvesItself(st.copy(controlMode = "full"), false))
        assertFalse(AutoPass.resolvesItself(st.copy(phaseStops = mapOf("${if (st.activePlayer == st.viewer) "you" else "opponent"}:${st.phase}" to true)), false))
        // The CPU's spell on top is a real question: "No response", a press.
        val cpu = st.copy(stack = st.stack.map { it.copy(controller = st.cpu.id) })
        assertFalse(AutoPass.resolvesItself(cpu, false))
        TableActions.of(cpu, true, null, false, false).gold!!.let { assertEquals("No response", it.label); assertTrue(it.enabled) }
        // A hand card lifted to cast in response keeps its Cast press.
        val card = st.me.hand.first()
        TableActions.of(st, true, card, false, false).gold!!.let { assertTrue(it.enabled); assertEquals(Press.PLAY, it.press) }
    }
}
