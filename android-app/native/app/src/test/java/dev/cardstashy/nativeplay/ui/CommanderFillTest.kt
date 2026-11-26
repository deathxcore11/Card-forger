package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Randall's 26 Nov photo: a Commander deck at 99/100 whose only open slot was the commander. Fill said "Fill 1 empty slot" and the
 * commander was a typed text box. These pin the new rules with the same shape of deck: Korvold, Fae-Cursed King's colours (b, r, g).
 */
class CommanderFillTest {
    @Test fun commanderDeckWithNoCommanderAsksForOneFirst() {
        assertEquals("Pick a commander first", CommanderFill.fillLabel("Commander", null, 1, busy = false))
        assertEquals("Fill 1 empty slot", CommanderFill.fillLabel("Commander", "Korvold, Fae-Cursed King", 1, busy = false))
        assertEquals("Fill 12 empty slots", CommanderFill.fillLabel("Standard", null, 12, busy = false))
        assertEquals("Finding cards…", CommanderFill.fillLabel("Commander", null, 1, busy = true))
    }

    @Test fun whoCanLead() {
        assertTrue(CommanderFill.canLead("Legendary Creature — Dragon Noble"))
        assertTrue(CommanderFill.canLead("Legendary Planeswalker — Teferi", ""))
        assertTrue(CommanderFill.canLead("Legendary Planeswalker — Grist", "Grist, the Hunger Tide can be your commander."))
        assertTrue(CommanderFill.canLead("Planeswalker — Ob Nixilis", "Ob Nixilis can be your commander."))
        assertFalse(CommanderFill.canLead("Legendary Artifact — Equipment"))
        assertFalse(CommanderFill.canLead("Creature — Human Soldier"))
    }

    @Test fun colourClauseFollowsTheCommander() {
        assertEquals(" id<=brg", CommanderFill.identityClause("BRG"))
        assertEquals(" id<=c", CommanderFill.identityClause(""))
        assertEquals("", CommanderFill.identityClause(null))
    }

    @Test fun planFillsEveryOpenSlotAndAsksForLands() {
        val p = CommanderFill.plan(need = 85, landsHave = 0)
        assertEquals(85, p.total)
        assertEquals(35, p.nonbasic + p.basics)
        assertTrue(p.ramp > 0 && p.draw > 0 && p.removal > 0 && p.sweepers in 1..3 && p.theme > 0)
    }

    @Test fun planWithOneOpenSlotIsOneCardAndNoLands() {
        val p = CommanderFill.plan(need = 1, landsHave = 36)
        assertEquals(1, p.total)
        assertEquals(0, p.nonbasic + p.basics)
    }

    @Test fun planCountsLandsAlreadyInTheDeck() {
        val p = CommanderFill.plan(need = 40, landsHave = 30)
        assertEquals(6, p.nonbasic + p.basics)
        assertEquals(40, p.total)
    }

    @Test fun ownedCardsComeFirstAndCraftOnlyWhenAllowed() {
        val have = setOf("sol ring")
        val c = listOf("Sol Ring", "Cultivate", "Beast Within", "Rampant Growth")
        val own = { n: String -> n == "Beast Within" || n == "Sol Ring" }
        assertEquals(listOf("Beast Within"), CommanderFill.select(c, own, craftOk = false, have = have, n = 3))
        assertEquals(listOf("Beast Within", "Cultivate", "Rampant Growth"), CommanderFill.select(c, own, craftOk = true, have = have, n = 3))
    }

    @Test fun basicsSpreadOverTheColours() {
        assertEquals(listOf("Swamp" to 4, "Mountain" to 3, "Forest" to 3), CommanderFill.basicsFor("brg", 10))
        assertEquals(listOf("Wastes" to 5), CommanderFill.basicsFor("", 5))
        assertTrue(CommanderFill.basicsFor("g", 0).isEmpty())
    }
}
