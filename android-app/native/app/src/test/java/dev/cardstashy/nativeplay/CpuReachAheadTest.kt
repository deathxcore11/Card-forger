package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.art.CardArt
import dev.cardstashy.nativeplay.art.TableFacts
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.nio.file.Files

/** Loading screens L5 (specs/loading-screens-brief.md): as a CPU turn starts, the cards it can pay for are decoded ahead. */
class CpuReachAheadTest {
    @Before fun start() { CardArt.initIndexOnly(Files.createTempDirectory("art").toFile()); CardArt.clearForTest(); TableFacts.clear()
        CardArt.recordForTest("Memnite", "u0", "Artifact Creature — Construct", "uncommon", 0)
        CardArt.recordForTest("Ragavan, Nimble Pilferer", "u1", "Legendary Creature — Monkey Pirate", "mythic", 1)
        CardArt.recordForTest("Blood Moon", "u2", "Enchantment", "rare", 3)
        CardArt.recordForTest("Fury", "u3", "Creature — Elemental Incarnation", "mythic", 5)
        CardArt.recordForTest("Arid Mesa", "u4", "Land", "rare", 0)
        CardArt.recordForTest("Never Looked Up", "u7", "Creature", "common", null)
        CardArt.cpuDeck(listOf("Fury", "Blood Moon", "Mountain", "Ragavan, Nimble Pilferer", "Arid Mesa", "Memnite", "Never Looked Up", "Fury")) }
    @After fun end() { CardArt.cpuDeck(emptyList()); CardArt.clearForTest(); TableFacts.clear() }

    @Test fun reachIsItsLandsPlusOneAndNeverALand() {
        assertEquals(listOf("Ragavan, Nimble Pilferer", "Memnite"), CardArt.cpuReach(0))
        assertEquals(listOf("Blood Moon", "Ragavan, Nimble Pilferer", "Memnite"), CardArt.cpuReach(2))
        assertEquals(listOf("Fury", "Blood Moon", "Ragavan, Nimble Pilferer", "Memnite"), CardArt.cpuReach(4))
    }

    @Test fun onceForEachTurnThatIsNotYours() {
        assertFalse("your own turn", TableFacts.cpuTurnStarts(1, active = 0, viewer = 0))
        assertTrue(TableFacts.cpuTurnStarts(2, active = 1, viewer = 0))
        assertFalse("the same turn's later boards", TableFacts.cpuTurnStarts(2, active = 1, viewer = 0))
        assertFalse(TableFacts.cpuTurnStarts(3, active = 0, viewer = 0))
        assertTrue(TableFacts.cpuTurnStarts(4, active = 1, viewer = 0))
        TableFacts.clear()
        assertTrue("a new match starts again", TableFacts.cpuTurnStarts(4, active = 1, viewer = 0))
        assertFalse("no active player yet", TableFacts.cpuTurnStarts(5, active = null, viewer = 0))
    }
}
