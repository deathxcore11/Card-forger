package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mobile table M1 (specs/mobile-table-arena-parity-brief.md): every target question names the card that asks it. Forge writes
 * the question as "<card> (<id>) - <what it does>" and, on the last line, what to pick (InputSelectTargets.showMessage in the
 * engine this app ships). The old line kept only the last line, so a trigger asked a bare "Select target creature".
 */
class AskerTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
    private fun ask(message: String) = base.copy(message = message)

    @Test fun aTriggersQuestionNamesItsCard() {
        // The question Randall misread (11 Nov recording, 2:01): the Scavenger's counter, asked as "Select target creature".
        val st = ask("Optimistic Scavenger (143) - Whenever an enchantment you control enters, put a +1/+1 counter on target creature.\n\nSelect target creature")
        assertEquals(Asker("Optimistic Scavenger", 143, "Whenever an enchantment you control enters, put a +1/+1 counter on target creature.", "Select target creature"), asker(st))
        assertEquals("Optimistic Scavenger: put a +1/+1 counter on target creature.", askLine(st))
        // On the table the name is drawn once, in the aim colour, then the question.
        assertEquals(AskParts("Optimistic Scavenger", "Put a +1/+1 counter on target creature."), askParts(st))
    }

    @Test fun theRealEnginesWordsSayWhatTheTriggerDoes() {
        // Word for word from the engine this app ships (TriggerTargetProbe, 11 Nov): an ability word in front, Forge's note behind.
        val st = ask("Optimistic Scavenger (3) - Eerie — Whenever an enchantment you control enters and whenever you fully unlock a Room, put a +1/+1 counter on target creature. [Zone Changer: Sheltered by Ghosts (54)]\n\nSelect target creature")
        assertEquals("Optimistic Scavenger: put a +1/+1 counter on target creature.", askLine(st))
        val long = ask("Sheltered by Ghosts (54) - When Sheltered by Ghosts enters, exile target nonland permanent an opponent controls until Sheltered by Ghosts leaves the battlefield. [Zone Changer: Sheltered by Ghosts (54)]\n\nSelect target nonland permanent an opponent controls")
        assertEquals("Sheltered by Ghosts: choose target nonland permanent an opponent controls.", askLine(long))
        // The aura itself, cast: Forge repeats the card's name as its text; the line says what to pick.
        assertEquals("Sheltered by Ghosts: choose target creature you control.", askLine(ask("Sheltered by Ghosts (54) - Sheltered by Ghosts\n\nSelect target creature you control")))
    }

    @Test fun aSpellsQuestionNamesItAndDropsItsOwnNameFromTheSentence() {
        val st = ask("Lightning Bolt (131) - Lightning Bolt deals 3 damage to any target.\nSelect any target\nTargeted:\nGrizzly Bears (124), \n(1 more can be targeted)")
        assertEquals(131, asker(st)!!.cardId); assertEquals("Select any target", asker(st)!!.pick)
        assertEquals("Lightning Bolt: deals 3 damage to any target.", askLine(st))
    }

    @Test fun aLongAbilitySaysOnlyWhatToPick() {
        val long = "Sheltered by Ghosts (150) - When Sheltered by Ghosts enters, exile target nonland permanent an opponent controls with mana value 2 or less until Sheltered by Ghosts leaves the battlefield. Enchanted creature gets +1/+0 and has lifelink and ward {2}.\n\nSelect target nonland permanent an opponent controls"
        assertEquals("Sheltered by Ghosts: choose target nonland permanent an opponent controls.", askLine(ask(long)))
        // Forge's shorter form (its detailed-prompt setting off): the card, then what to pick.
        val short = ask("Seam Rip (160) - Select target nonland permanent an opponent controls with mana value 2 or less")
        assertEquals(Asker("Seam Rip", 160, "", "Select target nonland permanent an opponent controls with mana value 2 or less"), asker(short))
        assertEquals("Seam Rip: choose target nonland permanent an opponent controls with mana value 2 or less.", askLine(short))
        // The older two-line form the fixtures use.
        assertEquals("Sheltered by Ghosts: choose target nonland permanent an opponent controls.", askLine(ask("Select targets for Sheltered by Ghosts\nChoose target nonland permanent an opponent controls.")))
    }

    @Test fun neverABareQuestionAndNeverAnInventedName() {
        for (m in listOf("Optimistic Scavenger (143) - Put a +1/+1 counter on target creature.\n\nSelect target creature", "Giant Growth (9) - Target creature gets +3/+3 until end of turn.\nSelect target creature"))
            assertTrue(askLine(ask(m))!!.let { it.startsWith("Optimistic Scavenger: ") || it.startsWith("Giant Growth: ") })
        // Forge named no card: the line stays the table's own short ask; nothing is made up.
        assertNull(asker(ask("Select target creature")))
        assertEquals("Choose target creature", askLine(ask("Select target creature")))
        // Not a target question: no asker.
        assertNull(asker(ask("Optimistic Scavenger (143) - x\nSelect target creature").copy(inputType = "InputPassPriority")))
    }
}
