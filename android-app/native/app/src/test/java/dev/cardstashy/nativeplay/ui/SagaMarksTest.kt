package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.StackItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Better table scene 10: the Saga's chapter count, lore and the chapter of its trigger on the stack. The texts are Forge's own,
 * as SagaProbe printed them from a real match (History of Benalia, 16 Nov): the card's text and "I, II — Create a 2/2…".
 */
class SagaMarksTest {
    private val benalia = "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n" +
        "I, II — Create a 2/2 white Knight creature token with vigilance.\nIII — Knights you control get +2/+1 until end of turn."
    private fun card(type: String = "Enchantment - Saga", lore: Int? = 1, text: String = benalia) = Card(990, "Battlefield", 1, 1, false, "History of Benalia", type, "{1}{W}{W}", text,
        null, null, false, false, false, 0, false, false, lore?.let { mapOf("LORE" to it) } ?: emptyMap(), emptyList(), null, emptyList())

    @Test fun chaptersAreReadFromTheText() {
        assertEquals(3, SagaMarks.chapters(benalia))
        assertEquals(2, SagaMarks.chapters("I — Draw a card.\nII — Draw two cards."))
        assertEquals(4, SagaMarks.chapters("I, II, III — Scry 1.\nIV — Draw a card."))
        assertEquals("no lines: its Sacrifice after", 4, SagaMarks.chapters("Sacrifice after IV."))
        assertEquals("nothing to read: three", 3, SagaMarks.chapters(""))
        assertEquals(listOf("I", "II", "III", "IV", "V"), (1..5).map(SagaMarks::numeral))
        assertEquals(4, SagaMarks.roman("IV")); assertNull(SagaMarks.roman("Knight"))
    }

    @Test fun onlyANonCreatureSagaStandsUp() {
        assertTrue(SagaMarks.isSaga(card()))
        assertFalse("a creature Saga fights in the creature row", SagaMarks.isSaga(card(type = "Enchantment Creature - Saga Spider")))
        assertFalse(SagaMarks.isSaga(card(type = "Enchantment - Aura")))
        assertEquals(2, SagaMarks.lore(card(lore = 2))); assertEquals(0, SagaMarks.lore(card(lore = null)))
        val ps = listOf(card().copy(id = 1, type = "Legendary Planeswalker - Jace"), card().copy(id = 2))
        assertEquals("the Saga first (the outer end of the column), then the planeswalker", listOf(2, 1), standUp(ps).map { it.id })
    }

    @Test fun theStackChapterIsForgesLineThenTheLore() {
        // Forge's real text names "I, II" for both of the first two chapters: the lore just added says which.
        val line = "I, II — Create a 2/2 white Knight creature token with vigilance."
        assertEquals(1, SagaMarks.stackChapter(StackItem(5, line, card(lore = 1), 1, ability = true)))
        assertEquals(2, SagaMarks.stackChapter(StackItem(6, line, card(lore = 2), 1, ability = true)))
        assertEquals(3, SagaMarks.stackChapter(StackItem(7, "III — Knights you control get +2/+1 until end of turn.", card(lore = 3), 1, ability = true)))
        assertEquals("one numeral named wins over the lore", 3, SagaMarks.stackChapter(StackItem(7, "History of Benalia — III — Knights…", card(lore = 0), 1, ability = true)))
        assertNull("not a Saga's", SagaMarks.stackChapter(StackItem(8, "Draw a card.", card(type = "Creature - Elf"), 1, ability = true)))
        assertEquals("Create a 2/2 white Knight creature token with vigilance.", SagaMarks.chapterWords(line))
        assertEquals("Knights you control get +2/+1.", SagaMarks.chapterWords("History of Benalia — III — Knights you control get +2/+1."))
    }
}
