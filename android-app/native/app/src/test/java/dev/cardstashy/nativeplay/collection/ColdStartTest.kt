package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.LastSeen
import dev.cardstashy.nativeplay.ui.keepHeroDetails
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** Collection's cold start: what a launch keeps (the engine's storage, the pages last drawn) and what it no longer waits for. */
class ColdStartTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private val lot = { id: String, name: String, qty: Int -> """{"id":"$id","name":"$name","qty":$qty,"set":"","collectorNumber":"","finish":"nonfoil","condition":"Near Mint","language":"en","location":"Binder","reserved":0,"printingVerified":false,"raw":{}}""" }
    private val ws get() = """{"version":3,"wishlist":[],"notes":[],"collection":[${lot("a", "Sol Ring", 2)},${lot("b", "Counterspell", 1)},${lot("c", "Island", 12)}],
        "decks":[{"id":"d2","name":"Islands","format":"standard","cards":[{"name":"Counterspell","qty":4},{"name":"Island","qty":20}]}]}"""

    @Test fun fileStoreKeepsKeysAndDropsOldDays() {
        val dir = Files.createTempDirectory("store").toFile()
        val s = CollectionEngine.FileStore(dir)
        val today = java.time.LocalDate.now(java.time.ZoneId.of("America/New_York"))
        s.save("cardforge-hero-v2", "{\"a\":1}")
        s.save("cardstashy-today-pack:mtg:$today:abc", "1")
        s.save("cardstashy-today-pack:mtg:${today.minusDays(5)}:old", "1")
        s.save("gone", "x"); s.save("gone", null)
        Thread.sleep(300)
        val back = CollectionEngine.FileStore(dir).load()
        assertEquals("{\"a\":1}", back["cardforge-hero-v2"])
        assertEquals("1", back["cardstashy-today-pack:mtg:$today:abc"])
        assertTrue(back.keys.none { it.endsWith(":old") || it == "gone" })
        assertTrue(dir.listFiles()!!.none { it.name.contains("old") })
    }

    @Test fun lastSeenIsPerAccountInstallAndDay() {
        val dir = Files.createTempDirectory("last").toFile()
        LastSeen.initForTest(dir, "install-1")
        val raw = """{"game":"mtg","hero":{"title":"Your cards.","card":{"id":"x","name":"Sol Ring","date":"2020-01-01"}},"shelf":{"decks":[]}}"""
        LastSeen.write("u1", LastSeen.homeName("mtg"), raw)
        val m = LastSeen.read("u1", LastSeen.homeName("mtg"))
        assertNotNull(m); assertEquals("mtg", m!!["game"].asString)
        // Kept today: the Card of the Day stays.
        assertNotNull(m.getAsJsonObject("hero").get("card"))
        assertNull(LastSeen.read("u2", LastSeen.homeName("mtg")))
        LastSeen.initForTest(dir, "install-2")
        assertNull(LastSeen.read("u1", LastSeen.homeName("mtg")))
        // Kept yesterday: the card is dropped, the rest of the page kept.
        LastSeen.initForTest(dir, "install-1")
        val f = File(dir, "u1/home-mtg.json"); f.writeText(f.readText().replace("\"day\":\"${LastSeen.day()}\"", "\"day\":\"2001-01-01\""))
        val old = LastSeen.read("u1", LastSeen.homeName("mtg"))!!
        assertNull(old.getAsJsonObject("hero").get("card")); assertEquals("Your cards.", old.getAsJsonObject("hero")["title"].asString)
        LastSeen.clear(); assertNull(LastSeen.read("u1", LastSeen.homeName("mtg")))
    }

    @Test fun freshPageKeepsTodaysPackWhileItLoads() {
        val shown = JsonParser.parseString("""{"hero":{"card":{"id":"x","date":"d","set":"Foundations","setCode":"fdn","pack":{"label":"p","sources":[]}}}}""").asJsonObject
        val fresh = JsonParser.parseString("""{"hero":{"card":{"id":"x","date":"d","set":"","setCode":"","pack":null}}}""").asJsonObject
        keepHeroDetails(fresh, shown)
        assertEquals("fdn", fresh.getAsJsonObject("hero").getAsJsonObject("card")["setCode"].asString)
        val other = JsonParser.parseString("""{"hero":{"card":{"id":"y","date":"d","set":"","pack":null}}}""").asJsonObject
        keepHeroDetails(other, shown)
        // No Card of the Day yet on either side (null in the engine's model): nothing to keep, nothing thrown.
        keepHeroDetails(JsonParser.parseString("""{"hero":{"card":null}}""").asJsonObject, shown)
        keepHeroDetails(fresh, JsonParser.parseString("""{"hero":{"card":null}}""").asJsonObject)
        assertEquals("", other.getAsJsonObject("hero").getAsJsonObject("card")["set"].asString)
    }

    /** A launch paints Home's Card of the Day, news and community from the kept storage, with the network held. */
    @Test fun keptHeroPaintsWithoutTheNetwork() = runBlocking {
        assumeTrue(bundle.isFile)
        val store = CollectionEngine.MemoryStore(); CollectionEngine.store = store
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        val t0 = System.currentTimeMillis(); CollectionEngine.eval("1"); println("BOOT ${System.currentTimeMillis() - t0} ms")
        CollectionEngine.load(ws, null)
        CollectionEngine.refresh("mtg", maxMs = 90_000)
        val home = CollectionEngine.home("mtg")
        val card = home.getAsJsonObject("hero").get("card")
        assumeTrue("Card of the Day reachable", card != null && card.isJsonObject)
        println("KEPT ${store.kept.keys}")
        assertTrue(store.kept.containsKey("cardforge-hero-v2"))
        // A new launch: every fetch held.
        CollectionEngine.restart(); CollectionEngine.answerForTest = { _ -> 0 to "" }
        try {
            CollectionEngine.load(ws, null)
            val again = CollectionEngine.home("mtg").getAsJsonObject("hero").get("card")
            assertTrue(again != null && again.isJsonObject)
            assertEquals(card.asJsonObject["id"].asString, again.asJsonObject["id"].asString)
            println("NEWS kept ${CollectionEngine.home("mtg").getAsJsonObject("news").getAsJsonArray("slides").size()} slides")
        } finally { CollectionEngine.answerForTest = null; CollectionEngine.restart() }
    }

    /** Today's pack waits only for its own lookups: a held tournament fetch doesn't hold it, and a cold Card of the Day is loaded first. */
    @Test fun todayPackOnItsOwn() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.answerForTest = { u -> if (u.contains("/api/meta") || u.contains("api/meta")) 0 to "" else null }
        try {
            CollectionEngine.load(ws, null)
            val feeds = launch { CollectionEngine.refresh("mtg", maxMs = 40_000) }
            delay(500)
            val t0 = System.currentTimeMillis()
            val went = CollectionEngine.todayPack("mtg", 40_000)
            val ms = System.currentTimeMillis() - t0
            println("TODAY $went in $ms ms")
            assumeTrue("today's set reachable", went.has("set"))
            feeds.cancel()
            assertTrue("took $ms ms", ms < 25_000)
        } finally { CollectionEngine.answerForTest = null; CollectionEngine.releaseForTest(); CollectionEngine.restart() }
    }

    /** My decks' Power is worked out once: after the keep is saved and the engine restarted, the page is drawn from it. */
    @Test fun decksFromThePowerKeep() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(ws, null); CollectionEngine.refresh("mtg", maxMs = 90_000)
        val cat = CollectionEngine.catalog()
        var t = System.currentTimeMillis(); val first = CollectionEngine.decksRaw("mtg", JsonObject().apply { addProperty("tab", "mine") }); val cold = System.currentTimeMillis() - t
        val keep = CollectionEngine.powerSave()
        CollectionEngine.restart(); CollectionEngine.answerForTest = { _ -> 0 to "" }
        try {
            CollectionEngine.powerLoad(keep); CollectionEngine.load(ws, cat)
            t = System.currentTimeMillis(); val again = CollectionEngine.decksRaw("mtg", JsonObject().apply { addProperty("tab", "mine") }); val warm = System.currentTimeMillis() - t
            println("DECKS cold $cold ms, from keep $warm ms")
            assertEquals(first.length, again.length)
        } finally { CollectionEngine.answerForTest = null; CollectionEngine.restart() }
    }
}
