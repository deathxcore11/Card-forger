package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Gap audit card head: a Yu-Gi-Oh! card page's Add to deck (tcg.js A.tAddToDeck), ⚒ Build decks (A.tBuild's build request) and its
 * archetype line (A.tArchetype's search) run the site's own handlers in the engine. Live lookups (YGOPRODeck).
 */
class CardHeadTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private val blueEyes = "89631139"

    @Test fun addToDeckBuildAndArchetype() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        val ws = JsonObject().apply { addProperty("version", 3); listOf("collection", "decks", "wishlist", "notes").forEach { add(it, JsonArray()) }; add("tcg", JsonObject().apply { add("ygo", JsonObject().apply {
            add("decks", JsonArray().apply { add(JsonObject().apply { addProperty("id", "y1"); addProperty("name", "Dragons"); addProperty("format", "advanced"); add("cards", JsonArray()) }) })
        }) }) }
        CollectionEngine.load(ws, null)
        // The card page, as the app opens it.
        CollectionEngine.tcard(JsonObject().apply { addProperty("game", "ygo"); addProperty("id", blueEyes) })
        CollectionEngine.tcardLoad(); CollectionEngine.settle(60_000)
        val m = CollectionEngine.tcardModel().toString()
        assertTrue(m.take(500), m.contains("Blue-Eyes White Dragon"))
        assertTrue(CollectionEngine.deckPick("ygo").toString(), CollectionEngine.deckPick("ygo")["decks"].asJsonArray.any { it.asJsonArray[0].asString == "y1" })

        // Add to deck: the deck picked gets one copy.
        var r = CollectionEngine.act("tAddToDeck", JsonObject().apply { addProperty("game", "ygo"); addProperty("deck", "y1"); addProperty("id", blueEyes) })
        println("ADD $r")
        assertEquals(r.toString(), 1, r["writes"].asInt)
        val deck = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonObject("tcg").getAsJsonObject("ygo").getAsJsonArray("decks")[0].asJsonObject
        assertTrue(deck.toString(), deck.toString().contains(blueEyes))

        // ⚒ Build decks: the request the app's Build a deck opens, seeded with this card.
        r = CollectionEngine.act("tBuildCard", JsonObject().apply { addProperty("game", "ygo"); addProperty("id", blueEyes) }, 60_000)
        println("BUILD $r")
        val req = JsonParser.parseString(r["made"].asString).asJsonObject
        assertEquals("ygo", req["game"].asString); assertEquals("Blue-Eyes White Dragon", req["seed"].asString)

        // The archetype line: the search page on that archetype, a list of its cards.
        CollectionEngine.discoverySearch("ygo", "tArchetype", "Blue-Eyes")
        CollectionEngine.settle(60_000)
        val s = CollectionEngine.searchModel().toString()
        println("ARCH ${s.take(800)}")
        assertTrue(s.contains("Archetype: Blue-Eyes")); assertTrue(s.contains("Blue-Eyes Alternative White Dragon") || s.contains("Blue-Eyes Jet Dragon") || s.contains("Blue-Eyes Chaos MAX Dragon"))
    }
}
