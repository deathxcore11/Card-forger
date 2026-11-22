package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.StackItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Thor desk showstopper (Randall's Thor photos of 0.4.104, 21 Nov 2026): a spell on the stack was a text box reading
 * "Requiting Hex (82) - Destroy Undercity Dire Rat (59). CPU gains 2 life." with a "Respond" button while he could only wait.
 */
class DeskStageTest {
    private fun c(id: Int, name: String) = Card(id = id, zone = "Hand", owner = 1, controller = 1, hidden = false, name = name, type = "Instant", manaCost = "{B}", text = "",
        power = null, toughness = null, tapped = false, attacking = false, blocking = false, damage = 0, summoningSick = false, token = false,
        counters = emptyMap(), keywords = emptyList(), attachedTo = null, blockingIds = emptyList())

    @Test fun theEnginesNumbersAndTheLeadingNameAreTakenOutOfTheWords() {
        // The exact words in his photo.
        assertEquals(listOf("Destroy Undercity Dire Rat.", "CPU gains 2 life."),
            deskEffects("Requiting Hex (82) - Destroy Undercity Dire Rat (59). CPU gains 2 life.", "Requiting Hex"))
    }

    @Test fun aTriggersReminderInBracketsIsLeftToTheCard() {
        // His second photo: Undercity Dire Rat's Rat Tail.
        assertEquals(listOf("Rat Tail — When this creature dies, create a Treasure token."),
            deskEffects("Rat Tail — When this creature dies, create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", "Undercity Dire Rat"))
    }

    @Test fun theDeskSaysYouCanAnswerOnlyWhenACardInHandCan() {
        val hand = listOf(c(1, "Murder"), c(2, "Swamp"))
        assertTrue(deskCanAnswer(true, hand) { it.name == "Murder" })
        assertFalse(deskCanAnswer(true, hand) { false })
        // "Waiting" in his photo: it is not his priority, so nothing is offered.
        assertFalse(deskCanAnswer(false, hand) { true })
        assertEquals("Resolving…", deskStatus(false, false).first)
        assertEquals("No answer in hand", deskStatus(true, false).first)
        assertEquals(Reading.Tone.OK, deskStatus(true, true).second)
    }

    @Test fun theTagNamesWhoDidItAndWhatItIs() {
        val spell = StackItem(id = 1, text = "", source = null, controller = 2)
        assertEquals("CPU CASTS", deskTag(spell, viewer = 1, them = "CPU"))
        assertEquals("YOUR SPELL", deskTag(spell.copy(controller = 1), viewer = 1, them = "CPU"))
        assertEquals("YOUR TRIGGER", deskTag(spell.copy(controller = 1, ability = true, trigger = true), viewer = 1, them = "CPU"))
        assertEquals("CPU ABILITY", deskTag(spell.copy(ability = true), viewer = 1, them = "CPU"))
    }
}
