package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** Polish brief 3: the Trunk's Filters-sheet picks as chips, and every filter still filtering as before. Plain JVM. */
class TrunkChipsTest {
    private fun card(o: String, n: String, r: String, s: List<String>) = Trunk.Card(o, n, r, 1, 0, s, null, null, null, null, "2026-11-0$o")
    private val facts = mapOf(
        "1" to CardFacts.Fact("1", "Creature — Angel", 4.0, "W", "", "", "", JsonObject()),
        "2" to CardFacts.Fact("2", "Instant", 1.0, "R", "", "", "", JsonObject()),
        "3" to CardFacts.Fact("3", "Artifact", 2.0, "", "", "", "", JsonObject()))
    private val cards = listOf(card("1", "Serra Angel", "uncommon", listOf("dsk")), card("2", "Shock", "common", listOf("fdn")), card("3", "Sol Ring", "rare", listOf("fdn", "dsk")))
    private fun names(f: Trunk.Filter) = Trunk.filter(cards, { facts[it] }, f).map { it.n }

    @Test fun noPicksNoChips() = assertEquals(emptyList<Trunk.Chip>(), Trunk.chips(Trunk.Filter(query = "a", color = "W"), "") { it })

    @Test fun eachPickIsAChipAndItsXTakesOnlyThatOff() {
        val f = Trunk.Filter(query = "s", color = "R", type = "Instants", rarity = "common", set = "fdn")
        val chips = Trunk.chips(f, "name") { if (it == "fdn") "Foundations" else it }
        assertEquals(listOf("Instants", "Common", "Foundations", "Name"), chips.map { it.label })
        assertEquals(f.copy(type = ""), chips[0].filter); assertEquals("name", chips[0].sort)
        assertEquals(f.copy(rarity = ""), chips[1].filter)
        assertEquals(f.copy(set = ""), chips[2].filter)
        assertEquals(f, chips[3].filter); assertEquals("", chips[3].sort)
    }

    @Test fun everyFilterStillFilters() {
        assertEquals(listOf("Shock"), names(Trunk.Filter(query = "sh")))
        assertEquals(listOf("Serra Angel"), names(Trunk.Filter(color = "W")))
        assertEquals(listOf("Sol Ring"), names(Trunk.Filter(color = "C")))
        assertEquals(listOf("Shock"), names(Trunk.Filter(type = "Instants")))
        assertEquals(listOf("Sol Ring"), names(Trunk.Filter(rarity = "rare")))
        assertEquals(listOf("Shock", "Sol Ring"), names(Trunk.Filter(set = "fdn")))
    }
}
