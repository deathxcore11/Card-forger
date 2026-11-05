package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

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

    private fun get(url: String): ByteArray = (URL(url).openConnection() as HttpURLConnection).run {
        setRequestProperty("User-Agent", "CardStashyNativeTests/1.0"); setRequestProperty("Accept", "application/json;q=0.9,*/*;q=0.8")
        connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = true
        inputStream.use { it.readBytes() }
    }
    private fun sha1(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    /**
     * ShotTest.collectionHome's page: a sample collection with real Scryfall printings (so the value and its change since
     * yesterday show), three decks with one last worked on, and today's live Card of the Day, Meta and News. Saves the
     * model and every picture Home would show (each picture's fallback too) into app/build/shot-art/home.
     */
    @Test fun shotFixture() = runBlocking {
        assumeTrue(bundle.isFile)
        val out = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home").apply { mkdirs() }
        CollectionEngine.initFrom(bundle)
        val owned = listOf("Krenko, Mob Boss" to 1, "Goblin Instigator" to 4, "Sol Ring" to 2, "Arcane Signet" to 2, "Talrand, Sky Summoner" to 1, "Counterspell" to 4,
            "Lightning Bolt" to 4, "Ragavan, Nimble Pilferer" to 1, "Mountain" to 24, "Island" to 20)
        val printings = JsonObject(); val lots = JsonArray()
        owned.forEachIndexed { i, (name, qty) ->
            // The cheapest paper printing that has a price, so every copy counts in the value.
            val q = URLEncoder.encode("!\"$name\" usd>0 -is:digital", "UTF-8")
            val card = JsonParser.parseString(get("https://api.scryfall.com/cards/search?q=$q&order=usd&dir=asc&unique=prints").decodeToString()).asJsonObject.getAsJsonArray("data")[0].asJsonObject
            val id = card["id"].asString
            printings.add(id, card)
            lots.add(JsonParser.parseString("""{"id":"l$i","name":${JsonPrimitive(card["name"].asString)},"qty":$qty,"printingId":"$id","set":"${card["set"].asString}","collectorNumber":"${card["collector_number"].asString}","finish":"nonfoil","condition":"Near Mint","language":"en","location":"Binder","reserved":0,"printingVerified":true,"raw":{}}"""))
            Thread.sleep(120) // Scryfall asks for a pause between calls
        }
        val decks = """[{"id":"d1","name":"Krenko Goblins","format":"commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Goblin Instigator","qty":1},{"name":"Sol Ring","qty":1},{"name":"Arcane Signet","qty":1},{"name":"Mountain","qty":30}]},
            {"id":"d2","name":"Talrand Spells","format":"commander","commander":"Talrand, Sky Summoner","cards":[{"name":"Talrand, Sky Summoner","qty":1},{"name":"Counterspell","qty":1},{"name":"Sol Ring","qty":1},{"name":"Arcane Signet","qty":1},{"name":"Island","qty":30}]},
            {"id":"d3","name":"Ragavan Burn","format":"modern","cards":[{"name":"Ragavan, Nimble Pilferer","qty":4},{"name":"Lightning Bolt","qty":4},{"name":"Mountain","qty":20}]}]"""
        fun workspace(history: String) = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":$lots,"printings":$printings,"decks":$decks,
            "homeDeckActivity":{"mtg":[{"id":"d2","at":"2026-11-04T18:20:00.000Z"}]},"valueHistory":$history}""").asJsonObject
        CollectionEngine.load(workspace("[]"), null)
        CollectionEngine.refresh("mtg", maxMs = 90_000)
        val total = CollectionEngine.home("mtg").getAsJsonObject("value")["amount"].asString.replace(Regex("[^0-9.]"), "").toDouble()
        val copies = owned.sumOf { it.second }
        // Yesterday's snapshot as value-history.js records it, 12.40 lower: Home shows the change.
        CollectionEngine.load(workspace("""[{"date":"2026-11-04","total":${"%.2f".format(java.util.Locale.US, total - 12.4)},"copies":$copies,"unpriced":0,"currency":"USD","basis":"exact-owned-v1"}]"""), CollectionEngine.catalog())
        val home = CollectionEngine.home("mtg")
        println("VALUE ${home["value"]}\nSHELF ${home["shelf"]}")
        File(out, "collection-home.json").writeText(home.toString())
        File(out, "collection-hints.json").writeText(CollectionEngine.hints("mtg").toString())
        val urls = mutableSetOf<String>()
        home.getAsJsonObject("hero")?.getAsJsonObject("card")?.get("art")?.asString?.let(urls::add)
        home.getAsJsonObject("shelf").let { sh -> sh.getAsJsonObject("lead")?.get("art")?.takeIf { it.isJsonPrimitive }?.asString?.let(urls::add); sh.getAsJsonArray("decks").forEach { d -> d.asJsonObject["art"]?.takeIf { it.isJsonPrimitive }?.asString?.let(urls::add) } }
        for (k in listOf("meta", "news")) home.getAsJsonObject(k).getAsJsonArray("slides").forEach { s -> s.asJsonObject.getAsJsonObject("art")?.let { a -> for (f in listOf("src", "fallback")) a[f]?.asString?.takeIf { it.isNotBlank() }?.let(urls::add) } }
        var saved = 0
        for (u in urls) { val f = File(out, sha1(u) + ".jpg"); if (f.exists() || runCatching { f.writeBytes(get(u)) }.isSuccess) saved++ else println("ART MISSING $u"); Thread.sleep(60) }
        println("ART $saved / ${urls.size}")
        assertTrue(home.getAsJsonObject("value")["movement"].asString.isNotEmpty())
    }
}
