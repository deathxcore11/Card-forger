package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 0.4.60 G2 (specs/glance-marks-brief.md, "Keywords without an icon show as a word"): keywords Forge lists that have no icon
 * become word marks after the iconic ones, worded as Forge words them; a keyword inside a sentence gives none.
 */
class KeywordWordsTest {
    private val miteText = "Toxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nThis creature can't block."
    private fun card(name: String, text: String, keywords: List<String>, known: Boolean, type: String = "Creature") =
        Card(id = 1, zone = "Battlefield", owner = 0, controller = 0, hidden = false, name = name, type = type, manaCost = "", text = text,
            power = 1, toughness = 1, tapped = false, attacking = false, blocking = false, damage = 0, summoningSick = false, token = false,
            counters = emptyMap(), keywords = keywords, attachedTo = null, blockingIds = emptyList(), keywordsKnown = known)

    @Test fun phyrexianMiteGivesOneWordMark() {
        // Forge's own keyword list.
        val forge = TileBadges.of(card("Phyrexian Mite", miteText, listOf("Toxic 1"), true, "Artifact Creature — Phyrexian Mite").copy(token = true), false)!!
        assertEquals(emptyList<TileBadges.Keyword>(), forge.iconic)
        assertEquals(listOf("Toxic 1"), forge.words.map { it.label })
        assertEquals(listOf(null), forge.words.map { it.key })
        assertEquals(listOf("Toxic 1"), forge.strip.map { it.label })
        // No list from Forge yet: the keyword-only rules line counts, "This creature can't block." does not.
        val text = TileBadges.of(card("Phyrexian Mite", miteText, emptyList(), false, "Artifact Creature — Phyrexian Mite"), false)!!
        assertEquals(listOf("Toxic 1"), text.words.map { it.label })
    }

    @Test fun keywordInsideASentenceGivesNone() {
        val m = TileBadges.of(card("Some creature", "Other creatures you control have toxic 1.\nWhenever this creature attacks, it gains prowess until end of turn.", emptyList(), false), false)!!
        assertEquals(emptyList<TileBadges.Keyword>(), m.words)
        assertEquals(emptyList<TileBadges.Keyword>(), m.strip)
    }

    @Test fun wordsFollowTheIconsInForgeOrder() {
        // Forge's list wins: whatever it sends, iconic first in rank order, then the words as Forge words and orders them.
        val m = TileBadges.of(card("Some creature", "", listOf("Prowess", "Haste", "Toxic 2", "Flying"), true), false)!!
        assertEquals(listOf("flying", "haste", null, null), m.strip.map { it.key })
        assertEquals(listOf("Flying", "Haste", "Prowess", "Toxic 2"), m.strip.map { it.label })
        // A land keeps its old rail; the words are not added to it.
        val land = TileBadges.of(card("Some land", "", listOf("Prowess"), true, "Land"), false)!!
        assertTrue(land.compact); assertEquals(emptyList<TileBadges.Keyword>(), land.keywords)
    }

    @Test fun sameFitRuleForMixedWidths() {
        // Equal widths: the same answer as the icon-only rule.
        for (room in listOf(15f, 16f, 34f, 51f, 52f, 70f, 106f, 200f)) for (n in 1..6)
            assertEquals("room $room, $n marks", TileBadges.stripShown(n, TileBadges.stripSlots(room, 16f, 2f)), TileBadges.stripFit(List(n) { 16f }, room, 2f, 16f))
        // Two icons and a 40 dp word: all three need 16+16+40+4 = 76.
        assertEquals(3, TileBadges.stripFit(listOf(16f, 16f, 40f), 76f, 2f, 16f))
        // One short: the word goes into "+1" beside the two icons (16+16+16+4 = 52).
        assertEquals(2, TileBadges.stripFit(listOf(16f, 16f, 40f), 75f, 2f, 16f))
        // A lone word wider than the room: only "+1".
        assertEquals(0, TileBadges.stripFit(listOf(40f), 30f, 2f, 16f))
    }
}
