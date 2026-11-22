package dev.cardstashy.nativeplay.ui

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardFacts
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Quick Play lag on the Thor (22 Nov, adb on 0.4.104): opening Quick Play froze the screen six times in four seconds, 0.5 to 0.8 s
 * each. Each redraw, every deck tile scanned every known card once per card in its deck (factByName in coverOf and deckColors) and
 * deep-copied its deck (quickRaw), and each card-facts update redrew every tile. These tests hold the two fixes: a name lookup that
 * is an index, and a deck's look worked out once per deck and per card-facts update.
 */
class QuickPlayLagTest {
    private fun card(i: Int, name: String = "Card $i", type: String = "Creature — Test", colors: List<String> = listOf("G")) = JsonObject().apply {
        addProperty("id", "id-$i"); addProperty("oracle_id", "or-$i"); addProperty("name", name); addProperty("type_line", type)
        add("color_identity", JsonArray().apply { colors.forEach { add(it) } })
        add("image_uris", JsonObject().apply { addProperty("normal", "https://img/$i.jpg"); addProperty("art_crop", "https://art/$i.jpg") })
    }
    private fun deck(id: String, names: List<String>) = JsonObject().apply {
        addProperty("id", id); addProperty("name", id); addProperty("format", "Commander")
        add("cards", JsonArray().apply { names.forEach { n -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", 1) }) } })
    }

    /** The index finds what the old scan found: the first fact with the full name or the front face's name. */
    @Test fun byNameMatchesTheScan() {
        CardFacts.seed(listOf(card(1, "Fire // Ice", "Instant"), card(2, "Llanowar Elves"), card(3, "Forest", "Basic Land — Forest")))
        fun scan(n: String) = CardFacts.cards.value.values.firstOrNull { val cn = it.card.get("name")?.asString ?: ""; cn == n || cn.substringBefore(" // ") == n }
        for (n in listOf("Fire // Ice", "Fire", "Llanowar Elves", "Forest", "Ice", "Nope")) assertSame(n, scan(n), CardFacts.byName(n))
        assertEquals(null, CardFacts.byName(""))
        // A new fact is found after the update that brings it.
        CardFacts.seed(listOf(card(4, "Late Arrival")))
        assertEquals("or-4", CardFacts.byName("Late Arrival")?.o)
    }

    /**
     * 70 Commander decks (the Thor's pool) of 100 cards against 5,000 known cards, drawn 30 times: the old scan made about 1 billion
     * name compares here. The index answers in a few hash lookups each. The bound is loose so a slow machine still passes.
     */
    @Test fun seventyDecksDrawThirtyTimesQuickly() {
        CardFacts.seed((1000 until 6000).map { card(it) })
        val decks = (0 until 70).map { d -> deck("deck-$d", (0 until 100).map { "Card ${1000 + (d * 37 + it * 53) % 5000}" }) }
        val looks = DeckLooks()
        val t0 = System.nanoTime()
        repeat(30) { decks.forEach { d -> looks.of("d:" + d.get("id").asString, d, CardFacts.cards.value, "") { d.deepCopy() } } }
        val ms = (System.nanoTime() - t0) / 1_000_000
        assertTrue("30 draws of 70 decks took $ms ms", ms < 1500)
        // Worked out once per deck, not once per draw.
        assertEquals(70, looks.built)
    }

    /** A card-facts update works the look out again but keeps the seat copy, so the tile's Power key is not hashed again. */
    @Test fun factsUpdateKeepsTheSeatCopy() {
        CardFacts.seed(listOf(card(7001, "Seat Card A", colors = listOf("U"))))
        val d = deck("seat", listOf("Seat Card A", "Seat Card B"))
        val looks = DeckLooks()
        var copies = 0
        val first = looks.of("d:seat", d, CardFacts.cards.value, "") { copies++; d.deepCopy() }
        assertSame(first, looks.of("d:seat", d, CardFacts.cards.value, "") { copies++; d.deepCopy() })
        CardFacts.seed(listOf(card(7002, "Seat Card B", colors = listOf("R"))))
        val second = looks.of("d:seat", d, CardFacts.cards.value, "") { copies++; d.deepCopy() }
        assertEquals(2, looks.built); assertEquals(1, copies)
        assertSame(first.seat, second.seat)
        assertTrue("colours pick up the new card: ${second.colors}", "R" in second.colors && "U" in second.colors)
        // The same list rebuilt as a new object (TableDecks.list after an update) is still the same deck.
        assertSame(second, looks.of("d:seat", d.deepCopy(), CardFacts.cards.value, "") { copies++; d.deepCopy() })
        // A changed list is worked out again, with a new seat copy.
        val edited = deck("seat", listOf("Seat Card A"))
        val third = looks.of("d:seat", edited, CardFacts.cards.value, "") { copies++; edited.deepCopy() }
        assertEquals(2, copies); assertTrue(third.seat !== first.seat)
    }
}
