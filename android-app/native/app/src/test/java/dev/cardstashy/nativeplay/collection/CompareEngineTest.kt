package dev.cardstashy.nativeplay.collection

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Gap audit H1 step 1: Compare runs the site's own code in the Collection engine (app.js compareLookup / compareFrom / compareReset,
 * tcg.js tCompareLookup / tCompareClear, views.js compareSheet, tcgcompare.js tcgCompareSheet) and reads the sheet back as data.
 * Live card lookups (Scryfall, YGOPRODeck), as the site's own.
 */
class CompareEngineTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    @Test fun magicAndYugioh() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(com.google.gson.JsonObject(), null)
        var m = CollectionEngine.compareModel("mtg")
        assertEquals("Compare cards", m["title"].asString)
        assertTrue(m["sides"].asJsonArray.all { it.asJsonObject["empty"]?.asBoolean == true })
        assertNull(CollectionEngine.compareLookup("mtg", 0, "Lightning Bolt"))
        assertNull(CollectionEngine.compareFrom("mtg", "Lightning Strike"))
        m = CollectionEngine.compareModel("mtg")
        println("MTG $m")
        val sides = m["sides"].asJsonArray.map { it.asJsonObject }
        assertEquals(listOf("Lightning Bolt", "Lightning Strike"), sides.map { it["name"].asString })
        assertTrue(sides.all { it["picture"].asJsonObject["src"].asString.startsWith("https://") })
        assertTrue(m["verdict"].asString, m["verdict"].asString.startsWith("Lightning Strike costs 1 more mana."))
        assertTrue(CollectionEngine.compareClear("mtg", -1)["sides"].asJsonArray.all { it.asJsonObject["empty"]?.asBoolean == true })

        assertNull(CollectionEngine.compareLookup("ygo", 0, "Blue-Eyes White Dragon"))
        assertNull(CollectionEngine.compareLookup("ygo", 1, "Dark Magician"))
        m = CollectionEngine.compareModel("ygo")
        println("YGO $m")
        val y = m["sides"].asJsonArray.map { it.asJsonObject }
        assertTrue(y[0]["facts"].asJsonArray.any { it.asJsonArray[0].asString == "ATK" && it.asJsonArray[1].asString == "3000" })
        assertTrue(m["verdict"].asString, m["verdict"].asString.contains("Dark Magician has 500 less ATK."))
        assertEquals("No card with that name.", CollectionEngine.compareLookup("ygo", 1, "zzqqxx no such card"))
    }
}
