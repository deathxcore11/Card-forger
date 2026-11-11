package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.TableActions.Kind
import dev.cardstashy.nativeplay.ui.TableActions.Press
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.60 Z6 (specs/table-zones-brief.md, "One gold action button"): every action word the table had before still reaches the gold
 * button (okLabel's every branch, Cast, Play land, Discard X, "Choose a card to discard", End turn on W10's turn, No target, a short
 * payment's Cancel); End turn is otherwise the quiet button above it, Undo keeps its own slot, and Yield is in the three-dot menu.
 */
class TableActionsTest {
    private val base = MatchState.parse(javaClass.getResource("/table/snap-main.json")!!.readText())!!
    private val cpu = base.cpu.id

    private fun st(input: String? = "InputPassPriority", phase: String = "MAIN1", active: Int = base.viewer, ok: String? = "OK", okOn: Boolean = true,
                   cancel: String? = null, cancelOn: Boolean = cancel != null, f: (MatchState) -> MatchState = { it }) =
        f(base.copy(inputType = input, phase = phase, activePlayer = active, buttons = Buttons(ok, cancel, okOn, cancelOn), stack = emptyList()))

    private fun gold(s: MatchState, selected: dev.cardstashy.nativeplay.engine.Card? = null, discarding: Boolean = false) =
        TableActions.of(s, true, selected, false, discarding)

    private fun mine(s: MatchState, f: (dev.cardstashy.nativeplay.engine.Card) -> dev.cardstashy.nativeplay.engine.Card) =
        s.copy(players = s.players.map { p -> if (p.id == s.viewer) p.copy(battlefield = p.battlefield.map(f)) else p })

    private val spell = dev.cardstashy.nativeplay.engine.StackItem(9001, "Lightning Bolt — deals 3 damage.", null, base.viewer)

    @Test fun everyOkLabelReachesTheGoldButton() {
        val states = buildList {
            // Priority: Resolving… and Resolve, No response, To main 2, Pass, every short step, Pass priority.
            // Mobile table M3: your own spell resolves by itself ("Resolving…", ResolveItselfTest); the Resolve press is Full Control's.
            add(RESOLVING to st { it.copy(stack = listOf(spell)) })
            add("Resolve" to st { it.copy(stack = listOf(spell), controlMode = "full") })
            add("No response" to st { it.copy(stack = listOf(spell.copy(controller = cpu))) })
            add("To main 2" to st(phase = "COMBAT_DECLARE_ATTACKERS"))
            add("Pass" to st(phase = "COMBAT_DECLARE_BLOCKERS", active = cpu))
            for ((phase, word) in listOf("UPKEEP" to "To draw", "DRAW" to "To main", "MAIN1" to "To combat")) add(word to st(phase = phase))
            add("Pass priority" to st(phase = "SOMETHING_NEW"))
            add("Pass" to st(phase = "MAIN1", active = cpu))
            // Attack and block.
            add("No attacks" to st("InputAttack", "COMBAT_DECLARE_ATTACKERS"))
            add("Attack with 1" to st("InputAttack", "COMBAT_DECLARE_ATTACKERS") { s -> mine(s) { if (it.id == 107) it.copy(attacking = true) else it } })
            add("1 must attack" to st("InputAttack", "COMBAT_DECLARE_ATTACKERS") { s -> mine(s) { if (it.id == 107) it.copy(mustAttack = true) else it } })
            add("No blocks" to st("InputBlock", "COMBAT_DECLARE_BLOCKERS", active = cpu))
            add("Block with 1" to st("InputBlock", "COMBAT_DECLARE_BLOCKERS", active = cpu) { s -> mine(s) { if (it.id == 108) it.copy(blocking = true) else it } })
            // Payment, targets (more than one, so not the one-tap pick) and Forge's own words.
            add("Pay automatically" to st("InputPayManaOfCostPayment", ok = "Auto"))
            add("Confirm targets" to st("InputSelectTargets") { it.copy(selection = it.selection.copy(min = 1, max = 2)) })
            add("Done" to st("InputConfirm", ok = "Done"))
        }
        for ((word, s) in states) {
            assertEquals("okLabel for $word", word, okLabel(s))
            val c = gold(s)
            assertEquals("$word reaches the gold button", word, c.gold?.label)
            assertTrue("$word: the gold button presses Forge's ok", c.gold?.press == Press.OK)
        }
    }

    @Test fun aLiftedCardAndTheDiscardReachTheGoldButton() {
        val hand = base.me.hand
        val bolt = hand.first { it.name == "Lightning Bolt" }; val forest = hand.first { it.isLand }
        assertEquals("Cast", gold(st(), bolt).gold?.label)
        assertEquals(Press.PLAY, gold(st(), bolt).gold?.press)
        assertEquals("Play land", gold(st(), forest).gold?.label)
        val discard = st("InputSelectCardsFromList", okOn = false) { it.copy(selection = it.selection.copy(min = 0, max = 1)) }
        assertEquals("Discard Lightning Bolt", gold(discard, bolt, discarding = true).gold?.label)
        val choose = gold(discard, null, discarding = true).gold!!
        assertEquals("Choose a card to discard", choose.label)
        assertFalse("with no card picked it only asks", choose.enabled)
    }

    @Test fun endTurnIsTheQuietButtonAboveTheGoldOne() {
        // A creature that can attack: the gold one goes on to combat, End turn is the quiet one (Forge's cancel).
        val c = gold(st(cancel = "End turn"))
        assertEquals(Kind.PLAIN, c.kind)
        assertEquals("To combat", c.gold?.label)
        assertEquals("End turn", c.quiet?.label); assertEquals(Press.CANCEL, c.quiet?.press)
        assertNull(c.undo)
        // W10: no creature can attack, so End turn is the step that follows; it takes the gold spot and To combat the quiet one.
        val w10 = gold(st(cancel = "End turn") { s -> mine(s) { if (it.isCreature) it.copy(tapped = true) else it } })
        assertEquals(Kind.END_TURN, w10.kind)
        assertEquals("End turn", w10.gold?.label); assertEquals(Press.CANCEL, w10.gold?.press)
        assertEquals("To combat", w10.quiet?.label)
        // Undo keeps its own slot (U6), never End turn's place.
        val undo = gold(st(cancel = "Undo"))
        assertEquals("Undo", undo.undo?.label); assertNull(undo.quiet)
    }

    @Test fun theOtherCornersKeepTheirWords() {
        // A one-target pick with "No target" allowed.
        val pick = gold(st("InputSelectTargets", cancel = "Cancel") { it.copy(selection = it.selection.copy(min = 0, max = 1, chosenCards = emptySet(), chosenPlayers = emptySet())) })
        assertEquals(Kind.PICK_ONE, pick.kind); assertEquals("No target", pick.gold?.label); assertEquals("Cancel", pick.quiet?.label)
        // A payment your mana can't finish: Cancel is gold.
        val short = gold(st("InputPayManaOfCostPayment", ok = "Auto", okOn = false, cancel = "Cancel") { s ->
            s.copy(message = "Pay Mana Cost: {5}{R}", players = s.players.map { p -> if (p.id == s.viewer) p.copy(mana = p.mana.mapValues { 0 }) else p },
                selection = s.selection.copy(actionable = emptySet())) })
        assertEquals(Kind.SHORT, short.kind); assertEquals("Cancel", short.gold?.label); assertEquals(Press.CANCEL, short.gold?.press)
        // Attack all: two creatures offered.
        val all = gold(st("InputAttack", "COMBAT_DECLARE_ATTACKERS") { it.copy(selection = it.selection.copy(cards = setOf(107, 108))) })
        assertEquals(Kind.ATTACK_ALL, all.kind); assertEquals("No attacks", all.gold?.label); assertEquals("Attack all", all.extra?.label)
        // The tucked question: no gold button.
        assertNull(TableActions.of(st("InputSelectTargets", cancel = "Cancel"), true, null, tucked = true, discarding = false).gold)
    }

    @Test fun yieldIsInTheThreeDotMenuOnlyForAnAbility() {
        assertTrue("no menu with an empty stack", TableActions.menu(st(), true).isEmpty())
        assertTrue("no Yield on a spell", TableActions.menu(st { it.copy(stack = listOf(spell)) }, true).isEmpty())
        val ability = spell.copy(controller = cpu, ability = true)
        val m = TableActions.menu(st { it.copy(stack = listOf(ability)) }, true).single()
        assertEquals(TableActions.YIELD, m.key); assertEquals("Yield", m.label); assertTrue(m.enabled); assertFalse(m.on)
        val on = TableActions.menu(st { it.copy(stack = listOf(ability.copy(yielded = true))) }, true).single()
        assertEquals("Yielding", on.label); assertTrue(on.on)
        // Locked while Forge works, as the old pill was; and the menu rides with the corner whatever its kind.
        assertFalse(TableActions.menu(st("InputLockUI") { it.copy(stack = listOf(ability)) }, true).single().enabled)
        assertEquals(1, gold(st { it.copy(stack = listOf(ability)) }).menu.size)
    }
}
