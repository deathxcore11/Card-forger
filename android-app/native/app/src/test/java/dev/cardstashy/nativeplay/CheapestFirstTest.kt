package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.art.CardArt
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.nio.file.Files

/** Loading screens L3 (specs/loading-screens-brief.md): a deck's pictures are fetched in the order the match plays them. */
class CheapestFirstTest {
    @Before fun start() { CardArt.initIndexOnly(Files.createTempDirectory("art").toFile()); CardArt.clearForTest() }
    @After fun end() { CardArt.clearForTest() }

    @Test fun landsThenCheapThenTheRestAndUnknownLast() {
        CardArt.recordForTest("Shivan Dragon", "u1", "Creature — Dragon", "rare", 6)
        CardArt.recordForTest("Steam Vents", "u2", "Land — Island Mountain", "rare", 0)
        CardArt.recordForTest("Lightning Bolt", "u3", "Instant", "common", 1)
        CardArt.recordForTest("Memnite", "u4", "Artifact Creature — Construct", "uncommon", 0)
        CardArt.recordForTest("Counterspell", "u5", "Instant", "common", 2)
        CardArt.recordForTest("Old Card", "u6", "Creature — Bear", "common", null)
        val got = CardArt.cheapestFirst(listOf("Shivan Dragon", "Old Card", "Counterspell", "Mountain", "Lightning Bolt", "Steam Vents", "Memnite", "Lightning Bolt"))
        assertEquals(listOf("Mountain", "Steam Vents", "Memnite", "Lightning Bolt", "Counterspell", "Shivan Dragon", "Old Card"), got)
    }

    /** L7: the gate's log says whether two decks of faces fit the memory cache. */
    @Test fun theCacheNoteSaysFitsOrShortBy() {
        assertEquals(1_327_360L, CardArt.FACE_BYTES)
        assertEquals("art memory: 10.0 of 128.0 MB used, 80 faces need 101.3 MB, fits", CardArt.cacheNote(80, 10L shl 20, 128L shl 20))
        assertEquals("art memory: 60.0 of 64.0 MB used, 80 faces need 101.3 MB, short by 37.3 MB", CardArt.cacheNote(80, 60L shl 20, 64L shl 20))
    }

    @Test fun theManaValueIsKeptInTheIndexFileBesideAnOlderRow() {
        CardArt.recordForTest("Lightning Bolt", "u3", null, null, 1)
        CardArt.recordForTest("Old Card", "u6", "Creature — Bear", null, null)
        CardArt.recordForTest("Plain Picture", "u7", null, null, null)
        val dir = CardArt.indexDirForTest()
        CardArt.clearForTest(); CardArt.initIndexOnly(dir); CardArt.loadIndex()
        assertEquals(1, CardArt.manaValue("Lightning Bolt")); assertNull(CardArt.typeLine("Lightning Bolt")); assertNull(CardArt.rarity("Lightning Bolt"))
        assertNull(CardArt.manaValue("Old Card")); assertEquals("Creature — Bear", CardArt.typeLine("Old Card"))
        assertEquals("u7", CardArt.url("Plain Picture")); assertNull(CardArt.manaValue("Plain Picture"))
    }
}
