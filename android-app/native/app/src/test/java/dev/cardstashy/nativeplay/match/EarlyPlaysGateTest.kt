package dev.cardstashy.nativeplay.match

import dev.cardstashy.nativeplay.art.CardArt
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    /** Randall 13 Nov: after the early plays, the gate waits for the rest of both decks; 14 Nov: never past 10 s in all. */
    @Test fun wholeDecksWaitedFor() {
        assertEquals(10_000L, QuickPlay.GATE_CAP_MS); assertEquals(9_000L, QuickPlay.WHOLE_CAP_MS)
        assertTrue(QuickPlay.WHOLE_CAP_MS < QuickPlay.GATE_CAP_MS && QuickPlay.EARLY_CAP_MS < QuickPlay.GATE_CAP_MS)
        assertEquals(9_000L, QuickPlay.wholeWait(0)); assertEquals(1_000L, QuickPlay.wholeWait(8_000)); assertEquals(300L, QuickPlay.wholeWait(20_000))
    }

    /**
     * Randall 14 Nov ("Never": the table never opened): the match's card lookup waits in Scryfall's queue behind everything else the
     * app asks. A lookup that does not answer (here a call that blocks 20 s, which cancelling cannot cut short) holds the gate
     * LOOKUP_CAP_MS at most, and the screen's wait for the gate is bounded the same way.
     */
    @Test fun aStuckCardLookupNeverHoldsTheTable() { kotlinx.coroutines.runBlocking {
        assertTrue(QuickPlay.LOOKUP_CAP_MS < QuickPlay.GATE_CAP_MS)
        dev.cardstashy.nativeplay.art.ScryfallGate.reset()
        dev.cardstashy.nativeplay.art.ScryfallGate.send = { _, _ -> Thread.sleep(20_000); dev.cardstashy.nativeplay.art.ScryfallGate.Reply(200, null) }
        try {
            val row = com.google.gson.JsonObject().apply { addProperty("name", "Elim Garak, Simple Tailor") }
            val t0 = System.currentTimeMillis()
            val done = QuickPlay.lookupWithin(listOf("Elim Garak, Simple Tailor" to row), 600)
            val took = System.currentTimeMillis() - t0
            assertTrue("the lookup cannot have finished", !done)
            assertTrue("held $took ms", took < 2_000)
        } finally { dev.cardstashy.nativeplay.art.ScryfallGate.reset() }
    } }
}
