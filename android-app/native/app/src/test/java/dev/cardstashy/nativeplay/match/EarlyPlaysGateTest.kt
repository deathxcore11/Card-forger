package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.art.CardArt
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.nio.file.Files

/** Loading screens L4 (specs/loading-screens-brief.md): the versus screen waits for the CPU's lands and its cards of mana value 3 or less. */
class EarlyPlaysGateTest {
    @Before fun start() { CardArt.initIndexOnly(Files.createTempDirectory("art").toFile()); CardArt.clearForTest()
        CardArt.recordForTest("Ragavan, Nimble Pilferer", "u1", "Legendary Creature — Monkey Pirate", "mythic", 1)
        CardArt.recordForTest("Blood Moon", "u2", "Enchantment", "rare", 3)
        CardArt.recordForTest("Fury", "u3", "Creature — Elemental Incarnation", "mythic", 5)
        CardArt.recordForTest("Arid Mesa", "u4", "Land", "rare", 0)
        CardArt.recordForTest("Seasoned Pyromancer", "u5", "Creature — Human Shaman", "mythic", 3)
        CardArt.recordForTest("Chandra, Torch of Defiance", "u6", "Legendary Planeswalker — Chandra", "mythic", 4)
        CardArt.recordForTest("Never Looked Up", "u7", "Creature", "common", null) }
    @After fun end() { CardArt.clearForTest() }

    private val cpu = listOf("Fury", "Blood Moon", "Mountain", "Ragavan, Nimble Pilferer", "Arid Mesa", "Chandra, Torch of Defiance", "Seasoned Pyromancer", "Never Looked Up")

    @Test fun theCpusLandsAndCheapCardsAreWaitedFor() {
        assertEquals(listOf("Mountain", "Arid Mesa", "Ragavan, Nimble Pilferer", "Blood Moon", "Seasoned Pyromancer"), QuickPlay.earlyPlays(cpu))
        assertEquals(3, QuickPlay.EARLY_COST); assertEquals(8_000L, QuickPlay.EARLY_CAP_MS)
    }

    @Test fun theFirstScreenIsCoversLandsThenTheEarlyPlaysEachOnce() {
        val names = CardArt.cheapestFirst(listOf("Plains", "Sheltered by Ghosts") + cpu)
        val first = QuickPlay.firstScreen(listOf("Sheltered by Ghosts", "Fury"), names, QuickPlay.earlyPlays(cpu))
        assertEquals(listOf("Sheltered by Ghosts", "Fury", "Plains", "Mountain", "Arid Mesa", "Ragavan, Nimble Pilferer", "Blood Moon", "Seasoned Pyromancer"), first)
    }

    @Test fun aSetupWithNoCpuListWaitsForNothingMore() {
        assertEquals(emptyList<String>(), QuickPlay.earlyPlays(emptyList()))
        assertEquals(listOf("A", "Forest"), QuickPlay.firstScreen(listOf("A"), listOf("Forest", "B"), emptyList()))
    }
}
