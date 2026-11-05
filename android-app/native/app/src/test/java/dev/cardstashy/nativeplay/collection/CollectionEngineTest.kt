package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** The site's Collection Home in QuickJS against the live card service: a small workspace's value, decks and rails. */
class CollectionEngineTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    @Test fun homeFromAWorkspace() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val lot = { id: String, name: String, qty: Int -> """{"id":"$id","name":"$name","qty":$qty,"set":"","collectorNumber":"","finish":"nonfoil","condition":"Near Mint","language":"en","location":"Binder","reserved":0,"printingVerified":false,"raw":{}}""" }
        val ws = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":[${lot("a", "Sol Ring", 2)},${lot("b", "Counterspell", 1)},${lot("c", "Island", 12)},${lot("d", "Krenko, Mob Boss", 1)}],
            "decks":[{"id":"d1","name":"Goblins","format":"commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Sol Ring","qty":1},{"name":"Mountain","qty":30}]},
                     {"id":"d2","name":"Islands","format":"standard","cards":[{"name":"Counterspell","qty":4},{"name":"Island","qty":20}]}]}""").asJsonObject
        val loaded = CollectionEngine.load(ws, null)
        println("LOADED $loaded")
        assertEquals(16, loaded["copies"].asInt)
        val t0 = System.currentTimeMillis()
        val st = CollectionEngine.refresh("mtg", maxMs = 90_000) { println("  step $it") }
        println("REFRESH ${System.currentTimeMillis() - t0} ms $st")
        val home = CollectionEngine.home("mtg")
        for (k in listOf("hero", "value", "example", "shelf")) println("${k.uppercase()} ${home[k]}")
        val meta = home.getAsJsonObject("meta"); val news = home.getAsJsonObject("news")
        println("META ${meta["title"]} ${meta["all"]} ${meta.getAsJsonArray("slides").size()} ${meta.getAsJsonArray("slides").first()}")
        println("NEWS ${news["title"]} ${news["note"]} ${news["status"]} ${news["links"]} ${news.getAsJsonArray("slides").size()} ${news.getAsJsonArray("slides").take(2)}")
        println("HINTS " + CollectionEngine.hints("mtg"))
        assertTrue(home.getAsJsonObject("shelf").getAsJsonArray("decks").size() == 1)
    }
}
