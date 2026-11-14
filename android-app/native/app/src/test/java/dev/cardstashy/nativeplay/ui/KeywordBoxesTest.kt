package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.60 G4 (specs/glance-marks-brief.md, "Keyword boxes in the inspect view"): CardInspect's keyword boxes are the tile strip's
 * keywords in the strip's order, each with the tile's icon, Forge's words and the existing KEYWORD_HINTS sentence (none: no text).
 */
class KeywordBoxesTest {
    private fun card(name: String, text: String, keywords: List<String>, known: Boolean = true, zone: String = "Battlefield") =
        Card(id = 1, zone = zone, owner = 0, controller = 0, hidden = false, name = name, type = "Creature", manaCost = "", text = text,
            power = 1, toughness = 1, tapped = false, attacking = false, blocking = false, damage = 0, summoningSick = false, token = false,
            counters = emptyMap(), keywords = keywords, attachedTo = null, blockingIds = emptyList(), keywordsKnown = known)

    private val akroma = card("Akroma, Angel of Wrath", "Flying, first strike, vigilance, trample, haste, protection from black and from red",
        listOf("Flying", "First Strike", "Vigilance", "Trample", "Haste", "Protection from black", "Protection from red"))

    @Test fun akromaListsAllSixWithTheTilesIcons() {
        val boxes = keywordBoxes(akroma)
        assertEquals(6, boxes.size)
        // The same icons in the same order as the tile's strip.
        assertEquals(TileBadges.of(akroma, false)!!.strip.map { it.key }, boxes.map { it.key })
        assertEquals(listOf("Flying", "Trample", "First strike", "Vigilance", "Protection from black, Protection from red", "Haste"), boxes.map { it.name })
        assertEquals("Can only be blocked by creatures with flying or reach.", boxes[0].hint)
        assertEquals("Can’t be blocked, targeted, dealt damage, enchanted or equipped by anything with that quality.", boxes[4].hint)
        // The {T} stays a symbol for the app's symbol set to draw.
        assertEquals("Can attack and use {T} abilities the turn it arrives.", boxes[5].hint)
    }

    @Test fun mordantDragonFlyingThenHaste() {
        val dragon = card("Mordant Dragon", "Flying, haste\nWhenever Mordant Dragon deals combat damage to a player, you may have it deal that much damage to target creature that player controls.",
            listOf("Flying", "Haste"))
        assertEquals(listOf("flying", "haste"), keywordBoxes(dragon).map { it.key })
        // Read from the rules text when Forge sent no list: the same two, never the sentence.
        assertEquals(listOf("flying", "haste"), keywordBoxes(dragon.copy(keywords = emptyList(), keywordsKnown = false)).map { it.key })
    }

    @Test fun aWordKeywordHasNoIconAndItsOwnSentenceOrNone() {
        val mite = card("Phyrexian Mite", "Toxic 1\nThis creature can't block.", listOf("Toxic 1"))
        val b = keywordBoxes(mite).single()
        assertNull(b.key); assertEquals("Toxic 1", b.name)
        assertEquals("Combat damage to a player also gives them that many poison counters.", b.hint)
        // No sentence in KEYWORD_HINTS: a box with the name only, never words of ours.
        val c = keywordBoxes(card("X", "", listOf("Cascade"))).single()
        assertEquals("Cascade", c.name); assertNull(c.hint)
    }

    @Test fun aHiddenCardHasNone() {
        assertTrue(keywordBoxes(akroma.copy(hidden = true)).isEmpty())
        // In hand too: the view opens on any card.
        assertEquals(6, keywordBoxes(akroma.copy(zone = "Hand")).size)
    }
}
