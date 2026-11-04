package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** The site's own test-play-deck-emblem.mjs cases, one for one. */
class DeckEmblemTest {
    private fun c(type: String, cmc: Int, text: String = "", ci: List<String> = listOf("R")) = JsonObject().apply {
        addProperty("type_line", type); addProperty("cmc", cmc); addProperty("oracle_text", text); add("color_identity", JsonArray().apply { ci.forEach { add(it) } }) }
    private val facts = mapOf(
        "Bolt" to c("Instant", 1, "Lightning Bolt deals 3 damage to any target."), "Guy" to c("Creature — Goblin", 1, "Haste"),
        "Bird" to c("Creature — Bird", 2, "Flying", listOf("U")), "Nope" to c("Instant", 2, "Counter target spell.", listOf("U")),
        "Leech" to c("Creature — Vampire", 2, "Whenever this creature attacks, each opponent loses 1 life and you gain 1 life.", listOf("B")),
        "Wrath" to c("Sorcery", 4, "Destroy all creatures.", listOf("W")), "Kill" to c("Instant", 2, "Destroy target creature.", listOf("W")), "Think" to c("Instant", 2, "Draw two cards.", listOf("U")),
        "Bear" to c("Creature — Bear", 2, "", listOf("G")), "Elf" to c("Creature — Elf", 1, "{T}: Add {G}.", listOf("G")), "Big" to c("Creature — Dinosaur", 6, "Trample", listOf("G")),
        "Grow" to c("Sorcery", 2, "Search your library for a basic land card, put it onto the battlefield tapped.", listOf("G")))
    private val of: (String) -> JsonObject? = { facts[it] }
    private fun deck(vararg rows: Pair<String, Int>) = rows.map { Decks.Row(it.first, it.second) }

    @Test fun matchesSite() {
        assertEquals("Burn", DeckEmblem.of(deck("Mountain" to 20, "Bolt" to 16, "Guy" to 24), of).style)
        assertEquals("Tempo", DeckEmblem.of(deck("Island" to 24, "Bird" to 24, "Nope" to 12), of).style)
        assertEquals("Drain", DeckEmblem.of(deck("Swamp" to 24, "Leech" to 20, "Guy" to 16), of).style)
        assertEquals("Control", DeckEmblem.of(deck("Plains" to 13, "Island" to 13, "Wrath" to 8, "Kill" to 12, "Think" to 10, "Nope" to 4), of).style)
        assertEquals("Ramp", DeckEmblem.of(deck("Forest" to 22, "Elf" to 8, "Grow" to 8, "Big" to 22), of).style)
        assertEquals("Aggro", DeckEmblem.of(deck("Mountain" to 20, "Guy" to 40), of).style)
        assertEquals(listOf("W", "U"), DeckEmblem.of(deck("Plains" to 12, "Island" to 12, "Kill" to 4), of).colors)
        assertEquals("", DeckEmblem.of(deck("Forest" to 24, "Unknown" to 36), of).style)
        val mine = deck("Mountain" to 20, "Bolt" to 16, "Guy" to 24)
        assertEquals("Mono-Red Aggro", DeckEmblem.of(mine, of, listOf(DeckEmblem.Meta("Mono-Red Aggro", deck("Bolt" to 16, "Guy" to 20)), DeckEmblem.Meta("Other", deck("Bird" to 30)))).meta)
        assertEquals("", DeckEmblem.of(mine, of, listOf(DeckEmblem.Meta("Other", deck("Bird" to 30)))).meta)
        assertEquals(true, DeckEmblem.of(mine.map { it.copy(set = "fdn", number = "1") }, of).precon)
        assertEquals(false, DeckEmblem.of(mine, of).precon)
    }
}
