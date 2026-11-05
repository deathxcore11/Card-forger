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

    /**
     * views.js collection() in QuickJS: the Cards tab of a workspace that carries its own printings (no lookups), every price
     * tier, two foils, a played copy, a binder and a wishlist card. Sorting, filtering and search are the site's. Writes the
     * model for CollectionCardsShotTest (app/build/shot-art/home/collection-cards.json).
     */
    @Test fun cardsModel() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val prints = JsonParser.parseString(javaClass.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
        val qty = mapOf("Swamp" to 12, "Lightning Bolt" to 4, "Counterspell" to 2)
        val lots = JsonArray(); val printings = JsonObject()
        prints.forEachIndexed { i, c ->
            val name = c["name"].asString
            printings.add(c["id"].asString, c)
            lots.add(JsonObject().apply {
                addProperty("id", "l${i + 1}"); addProperty("name", name); addProperty("qty", qty[name] ?: 1); addProperty("printingId", c["id"].asString)
                addProperty("set", c["set"].asString); addProperty("setName", c["set_name"].asString); addProperty("collectorNumber", c["collector_number"].asString)
                addProperty("finish", if (name.startsWith("Skithiryx") || name.startsWith("Ragavan")) "foil" else "nonfoil")
                addProperty("condition", if (name == "Lightning Bolt") "Lightly Played" else "Near Mint"); addProperty("language", "en")
                addProperty("location", if (name == "Gaea's Cradle") "Trade binder" else ""); addProperty("printingVerified", true)
                addProperty("addedAt", java.time.Instant.parse("2026-11-04T12:00:00Z").minusSeconds(3600L * (i + 1)).toString()); add("raw", JsonObject())
            })
        }
        val ws = JsonParser.parseString("""{"version":3,"wishlist":[{"id":"w1","name":"Sol Ring","qty":3,"finish":"nonfoil"}],"notes":[],"collection":$lots,"printings":$printings,
            "decks":[{"id":"d1","name":"Krenko Goblins","format":"commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Goblin Instigator","qty":1}]}]}""").asJsonObject
        val sol = prints.first { it["name"].asString == "Sol Ring" }
        CollectionEngine.load(ws, JsonObject().apply { add("sol ring", sol) }.toString())
        val m = CollectionEngine.cards("mtg")
        val rows = m.getAsJsonArray("rows").map { it.asJsonObject }
        println("CARDS ${m["title"]} views=${m["views"].asJsonArray.size()} tabs=${m["tabs"].asJsonArray.map { it.asJsonObject["label"] }} summary=${m["summary"]}")
        rows.forEach { r -> println("  ${r["tier"]} ${r["name"]} ${r["price"]} x${r["qty"]} ${r["sub"]} foil=${r["print"]?.isJsonObject} wanted=${r["wanted"]}") }
        assertEquals("Collection", m["title"].asString)
        assertEquals(14, rows.size)
        assertEquals("t5", rows.first { it["name"].asString == "Gaea's Cradle" }["tier"].asString)
        assertTrue(rows.first { it["name"].asString.startsWith("Ragavan") }["print"].isJsonObject)
        assertTrue(rows.last()["wanted"].asBoolean)
        assertTrue(m.getAsJsonArray("summary").joinToString("") { it.asJsonObject["t"].asString }.startsWith("28 copies"))
        // The site's own sort, filter and search.
        val byValue = CollectionEngine.cards("mtg", JsonObject().apply { addProperty("sort", "value"); addProperty("direction", "desc") }).getAsJsonArray("rows")
        assertEquals("Gaea's Cradle", byValue[0].asJsonObject["name"].asString)
        assertEquals(2, CollectionEngine.cards("mtg", JsonObject().apply { addProperty("filter", "foil") }).getAsJsonArray("rows").size())
        assertEquals(listOf("Sol Ring", "The One Ring", "Sol Ring"), CollectionEngine.cards("mtg", JsonObject().apply { addProperty("filter", "all"); addProperty("q", "ring"); addProperty("sort", "recent") })
            .getAsJsonArray("rows").map { it.asJsonObject["name"].asString })
        val out = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home").apply { mkdirs() }
        File(out, "collection-cards.json").writeText(CollectionEngine.cards("mtg", JsonObject().apply { addProperty("q", ""); addProperty("sort", "recent"); addProperty("filter", "all") }).toString())
    }

    /** views.js decks() → My decks through the engine: four decks over the sample printings; writes the shot fixture. */
    @Test fun decksModel() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        fourDecks()
        val m = CollectionEngine.decks("mtg")
        val tiles = m.getAsJsonArray("tiles").map { it.asJsonObject }
        println("DECKS ${m["title"]} actions=${m["actions"].asJsonArray.map { it.asJsonObject["label"] }} tabs=${m["tabs"].asJsonArray.map { it.asJsonObject["label"] }} tools=${m["tools"].asJsonArray.map { it.asJsonObject["label"] }}")
        tiles.forEach { t -> println("  ${t["tier"]} ${t["name"]} | ${t["line"]} | ${t["format"]} | ${t["power"]} | ${t["owned"]} ${t["find"]} ${t["bar"]}") }
        assertEquals("Decks", m["title"].asString)
        assertEquals(listOf("War Chest", "Import", "New"), m["actions"].asJsonArray.map { it.asJsonObject["label"].asString })
        assertEquals(4, tiles.size)
        assertEquals("Commander", tiles[0]["format"].asJsonObject["name"].asString)
        assertTrue(tiles.all { it["cover"].isJsonObject })
        // The site's own deck search (I.shelfSearch).
        assertEquals(listOf("Talrand Spells"), CollectionEngine.decks("mtg", JsonObject().apply { addProperty("q", "talrand") }).getAsJsonArray("tiles").map { it.asJsonObject["name"].asString })
        val out = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home").apply { mkdirs() }
        File(out, "collection-decks.json").writeText(CollectionEngine.decks("mtg", JsonObject().apply { addProperty("q", "") }).toString())
    }

    /** views.js deckPage() → a deck's Cards tab through the engine: its hero, controls and cards in each view; writes the shot fixtures. */
    @Test fun deckModel() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        fourDecks()
        val m = CollectionEngine.deck("mtg", "d2")
        println("DECK ${m["hero"].asJsonObject["title"]} view=${m["view"]} format=${m["format"]} actions=${m["actions"].asJsonArray.map { it.asJsonObject["label"] }} " +
            "chips=${m["chips"].asJsonArray.map { it.asJsonObject["label"].asString + " " + it.asJsonObject["count"].asString }} groups=${m["groups"].asJsonArray.map { it.asJsonObject["name"].asString + " " + it.asJsonObject["count"].asString }}")
        assertEquals("Izzet Tempo", m["hero"].asJsonObject["title"].asString)
        assertEquals("modern", m["format"].asString)
        assertEquals("gallery", m["view"].asString)
        assertEquals("Practice", m["actions"].asJsonArray[0].asJsonObject["label"].asString)
        assertEquals(listOf("Cards", "Rules", "Power", "Matchups", "Upgrade lab", "Versions", "War Chest"), m["tabs"].asJsonArray.map { it.asJsonObject["label"].asString })
        val names = { o: JsonObject -> o["groups"].asJsonArray.flatMap { g -> g.asJsonObject["rows"].asJsonArray.map { it.asJsonObject["name"].asString } } }
        assertEquals(setOf("Ragavan, Nimble Pilferer", "Talrand, Sky Summoner", "Lightning Bolt", "Counterspell"), names(m).toSet())
        assertEquals(2, m["side"].asJsonObject["rows"].asJsonArray.sumOf { it.asJsonObject["qty"].asInt })
        // The site's own controls: search (I.deckSearch), a type chip (A.deckChip) and the view (A.deckView).
        assertEquals(listOf("Lightning Bolt"), names(CollectionEngine.deck("mtg", "d2", JsonObject().apply { addProperty("search", "bolt") })))
        val creatures = CollectionEngine.deck("mtg", "d2", JsonObject().apply { addProperty("search", ""); addProperty("filter", "creatures") })
        assertEquals(setOf("Ragavan, Nimble Pilferer", "Talrand, Sky Summoner"), names(creatures).toSet())
        CollectionEngine.deck("mtg", "d2", JsonObject().apply { addProperty("search", ""); addProperty("filter", "all") })
        val out = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home").apply { mkdirs() }
        for (v in listOf("gallery", "stacks", "symbols", "compact")) {
            val page = CollectionEngine.deck("mtg", "d2", JsonObject().apply { addProperty("view", v) })
            assertEquals(v, page["view"].asString)
            File(out, "collection-deck-$v.json").writeText(page.toString())
        }
        // A commander deck opens with its commander first (deck-viewer.js).
        val goblins = CollectionEngine.deck("mtg", "d1", JsonObject().apply { addProperty("view", "gallery") })
        assertEquals("Commander", goblins["groups"].asJsonArray[0].asJsonObject["name"].asString)
        File(out, "collection-deck-commander.json").writeText(goblins.toString())
    }

    /** views.js cardSheet through the bundle in the app's own runtime: the page opens from what the catalog has, and its tabs and controls run. */
    @Test fun cardModel() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        fourDecks()
        val m = CollectionEngine.card("mtg", JsonObject().apply { addProperty("name", "Lightning Bolt"); addProperty("deck", "d2") })
        println("CARD ${m["head"]} tabs=${m["tabs"]}")
        assertEquals("Lightning Bolt", m["name"].asString)
        assertEquals("overview", m["tab"].asString)
        assertEquals("Lightning Bolt", m["head"].asJsonObject["title"].asString)
        assertTrue(m["tabs"].asJsonArray.map { it.asJsonObject["key"].asString }.containsAll(listOf("overview", "guide", "prices")))
        val ov = m["overview"].asJsonObject
        assertTrue(ov["card"].asJsonObject["image"].asString.startsWith("https://"))
        // The open deck's stepper (Izzet Tempo runs one Bolt in this fixture's list) and your copies.
        assertEquals("In Izzet Tempo", ov["deck"].asJsonObject["title"].asString)
        assertTrue(ov["owned"].asJsonObject["groups"].asJsonArray.size() > 0)
        // A tab and a finish, as app.js handles them.
        assertEquals("guide", CollectionEngine.cardDo("tab", "guide")["tab"].asString)
        assertEquals("overview", CollectionEngine.cardDo("tab", "overview")["tab"].asString)
        val foil = CollectionEngine.cardDo("finish", "foil")["overview"].asJsonObject["card"].asJsonObject
        println("FINISH ${foil["finish"]} chips=${foil["finishes"]}")
        assertEquals(m, CollectionEngine.card("mtg", JsonObject().apply { addProperty("name", "Lightning Bolt"); addProperty("deck", "d2") }).let { m })
        assertEquals("Lightning Bolt", CollectionEngine.cardModel()["name"].asString)
    }

    private suspend fun fourDecks() {
        val prints = JsonParser.parseString(javaClass.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
        val lots = JsonArray(); val printings = JsonObject(); val catalog = JsonObject()
        prints.forEachIndexed { i, c ->
            val name = c["name"].asString
            printings.add(c["id"].asString, c); catalog.add(name.lowercase(), c)
            lots.add(JsonObject().apply {
                addProperty("id", "l${i + 1}"); addProperty("name", name); addProperty("qty", if (name == "Swamp") 12 else if (name == "Lightning Bolt") 4 else 1); addProperty("printingId", c["id"].asString)
                addProperty("set", c["set"].asString); addProperty("collectorNumber", c["collector_number"].asString); addProperty("finish", "nonfoil")
                addProperty("condition", "Near Mint"); addProperty("language", "en"); addProperty("printingVerified", true); add("raw", JsonObject())
            })
        }
        fun rows(vararg r: Pair<Int, String>) = r.joinToString(",") { (q, n) -> """{"name":${com.google.gson.JsonPrimitive(n)},"qty":$q}""" }
        val decks = """[
            {"id":"d1","name":"Goblin Horde","format":"commander","commander":"Krenko, Mob Boss","cards":[${rows(1 to "Krenko, Mob Boss", 1 to "Goblin Instigator", 1 to "Sol Ring", 1 to "Arcane Signet", 1 to "Lightning Bolt")}]},
            {"id":"d2","name":"Izzet Tempo","format":"modern","cards":[${rows(4 to "Ragavan, Nimble Pilferer", 4 to "Lightning Bolt", 4 to "Counterspell", 2 to "Talrand, Sky Summoner")}],"side":[${rows(2 to "Counterspell")}]},
            {"id":"d3","name":"Mono Black","format":"standard","cards":[${rows(4 to "Sheoldred, the Apocalypse", 20 to "Swamp")}]},
            {"id":"d4","name":"Talrand Spells","format":"commander","commander":"Talrand, Sky Summoner","cards":[${rows(1 to "Talrand, Sky Summoner", 1 to "Counterspell", 1 to "The One Ring", 1 to "Sol Ring")}]}]"""
        val ws = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":$lots,"printings":$printings,"decks":$decks}""").asJsonObject
        CollectionEngine.load(ws, catalog.toString())
    }
}
