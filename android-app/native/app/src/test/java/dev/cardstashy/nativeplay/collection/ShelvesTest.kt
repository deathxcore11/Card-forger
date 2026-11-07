package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** All cards, shelf by shelf, for Yu-Gi-Oh! and Pokémon decks (Collection.shelvesStart / shelfStart), through the bundle with the live sources. */
class ShelvesTest {
    private val bundle = File("src/main/assets/collection-engine.js")

    @Test fun tcgShelves() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        CollectionEngine.load(fx["workspace"].asJsonObject.deepCopy(), null)
        CollectionEngine.tcgCacheLoad(fx["cache"].asJsonObject.deepCopy().toString())
        for (g in listOf("ygo", "ptcg")) {
            val deck = fx["workspace"].asJsonObject["tcg"].asJsonObject[g].asJsonObject["decks"].asJsonArray[0].asJsonObject["id"].asString
            val t0 = System.currentTimeMillis()
            CollectionEngine.shelvesStart(g, deck)
            CollectionEngine.settle(90_000)
            val m = CollectionEngine.shelvesModel(g, deck)
            val sets = m["sets"].asJsonArray
            println("SHELVES $g ${System.currentTimeMillis() - t0} ms sets=${sets.size()} first=${sets.take(3)} error=${m["error"]}")
            val fit = m["fit"]?.takeIf { it.isJsonObject }?.asJsonObject
            println("FIT $g busy=${fit?.get("busy")} error=${fit?.get("error")} tiles=${fit?.getAsJsonArray("tiles")?.map { it.asJsonObject.let { t -> t["name"].asString + " · " + t["why"].asString + " · img=" + t["image"].asString.take(60) } }}")
            assertTrue("$g has sets", sets.size() > 20)
            assertTrue("$g newest first", sets[0].asJsonObject["date"].asString >= sets[5].asJsonObject["date"].asString)
            val first = sets[0].asJsonObject["id"].asString
            val t1 = System.currentTimeMillis()
            CollectionEngine.shelfStart(g, deck, first)
            CollectionEngine.settle(90_000)
            val s = CollectionEngine.shelfModel(g, deck, first)
            val tiles = s["tiles"]?.takeIf { it.isJsonArray }?.asJsonArray
            println("SHELF $g $first ${System.currentTimeMillis() - t1} ms error=${s["error"]} tiles=${tiles?.size()} sample=${tiles?.take(3)?.map { it.asJsonObject.let { t -> listOf(t["name"], t["category"], t["tag"], t["legal"], t["image"].asString.take(70)) } }}")
            assertTrue("$g shelf has cards", (tiles?.size() ?: 0) > 0)
            assertTrue("$g tiles have pictures", tiles!!.all { it.asJsonObject["image"].asString.startsWith("http") })
        }
    }
}
