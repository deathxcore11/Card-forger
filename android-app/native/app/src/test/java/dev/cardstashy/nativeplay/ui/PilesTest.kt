package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Test

class PilesTest {
    private var next = 1
    private fun c(name: String, type: String = "Basic Land", tapped: Boolean = false, token: Boolean = false, counters: Map<String, Int> = emptyMap()) =
        Card(id = next++, zone = "Battlefield", owner = 1, controller = 1, hidden = false, name = name, type = type, manaCost = "", text = "",
            power = null, toughness = null, tapped = tapped, attacking = false, blocking = false, damage = 0, summoningSick = false, token = token,
            counters = counters, keywords = emptyList(), attachedTo = null, blockingIds = emptyList())
    private fun piles(cs: List<Card>) = pilesOf(cs, cs.size, { Mark.NONE }, { null })

    @Test fun twelveLandsOfThreeNamesMakeThreePiles() {
        val cs = List(5) { c("Forest") } + List(4) { c("Island") } + List(3) { c("Swamp") }
        assertEquals(listOf(5, 4, 3), piles(cs).map { it.size })
    }

    @Test fun tappingOneLandSplitsItOut() {
        val cs = List(4) { c("Forest") } + c("Forest", tapped = true)
        assertEquals(listOf(4, 1), piles(cs).map { it.size })
    }

    @Test fun nonTokenPermanentsPileOnlyAtThree() {
        assertEquals(listOf(1, 1), piles(List(2) { c("Llanowar Elves", "Creature — Elf Druid") }).map { it.size })
        assertEquals(listOf(3), piles(List(3) { c("Llanowar Elves", "Creature — Elf Druid") }).map { it.size })
        assertEquals(listOf(2), piles(List(2) { c("Soldier", "Token Creature — Soldier", token = true) }).map { it.size })
    }

    @Test fun countersMakeACardStandAlone() {
        val cs = List(3) { c("Soldier", "Creature", token = true) } + c("Soldier", "Creature", token = true, counters = mapOf("P1P1" to 1))
        assertEquals(listOf(3, 1), piles(cs).map { it.size })
    }
}
