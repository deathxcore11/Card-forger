package dev.cardstashy.nativeplay.collection

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Gap audit L1: a Yu-Gi-Oh! / Pokémon card page's chip (app.js A.ruleCards, card-discovery.js cardDiscoverySpec) runs the game's
 * own search in the engine, as the site's Search tab does. Live lookups (YGOPRODeck, TCGdex).
 */
class DiscoverySearchTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    @Test fun archetypeAndArtistChips() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(com.google.gson.JsonObject(), null)
        CollectionEngine.discoverySearch("ygo", "archetype", "Blue-Eyes")
        CollectionEngine.settle(60_000)
        var m = CollectionEngine.searchModel()
        println("YGO ${m.toString().take(1500)}")
        assertTrue(m.toString(), m.toString().contains("Blue-Eyes White Dragon"))
        CollectionEngine.discoverySearch("ptcg", "artist", "Mitsuhiro Arita")
        CollectionEngine.settle(60_000)
        m = CollectionEngine.searchModel()
        println("PTCG ${m.toString().take(1500)}")
        assertTrue(m.toString(), m.toString().contains("Charizard") || m.toString().contains("Pikachu") || m.toString().contains("Arita"))
        assertEquals("Reopen this card in its game before searching.", CollectionEngine.discoverySearch("ygo", "nothing", "x")["error"].asString)
    }
}
