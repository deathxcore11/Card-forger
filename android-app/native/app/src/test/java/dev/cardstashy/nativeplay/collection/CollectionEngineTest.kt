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
        // Prices: the hero, the history's range buttons and Market details' source chips, as workbench-ui.js and app.js set them.
        val pr = CollectionEngine.cardDo("tab", "prices")
        assertEquals("prices", pr["tab"].asString)
        println("PRICES ${pr["prices"]}".take(1500))
        assertTrue(pr["prices"].asJsonObject["hero"].asJsonObject["value"].asString.isNotBlank())
        fun onRange(j: JsonObject) = j["prices"].asJsonObject["history"].asJsonObject["blocks"].asJsonArray.map { it.asJsonObject }.first { it["kind"].asString == "ranges" }["items"]
            .asJsonArray.map { it.asJsonObject }.first { it["on"].asBoolean }["range"].asString
        assertEquals("365", onRange(pr))
        assertEquals("90", onRange(CollectionEngine.cardDo("range", "90")))
        val src = CollectionEngine.cardDo("source", "cardmarket")["prices"].asJsonObject["details"].asJsonObject["sources"].asJsonArray.map { it.asJsonObject }.first { it.has("on") }
        assertEquals("cardmarket", src["data"].asJsonObject["src"].asString)
        assertEquals(m, CollectionEngine.card("mtg", JsonObject().apply { addProperty("name", "Lightning Bolt"); addProperty("deck", "d2") }).let { m })
        assertEquals("Lightning Bolt", CollectionEngine.cardModel()["name"].asString)
    }

    /**
     * views.js setsPage and setPage through the bundle against the live card service: every set by year with its art and
     * progress, a family and a search, then Double Masters 2022's own page, its controls, and a card opened on its printing.
     */
    @Test fun setsModel() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        fourDecks()
        CollectionEngine.sets("mtg")
        CollectionEngine.setsLoad()
        CollectionEngine.settle(60_000)
        val l = CollectionEngine.setsModel()
        val rows = l["sections"].asJsonArray.flatMap { it.asJsonObject["rows"].asJsonArray.map { r -> r.asJsonObject } }
        println("SETS ${l["title"]} sections=${l["sections"].asJsonArray.size()} rows=${rows.size} first=${rows.firstOrNull()} filters=${l["filters"]}".take(1500))
        assertEquals("Magic sets", l["title"].asString)
        assertEquals("Filters", l["filters"].asJsonObject["label"].asString)
        assertTrue(rows.size >= 20)
        assertTrue(rows.first()["atmosphere"].asJsonArray.first().asString.startsWith("https://cardstashy.com/img/mtg-set/"))
        assertTrue(rows.first()["progress"].asJsonObject["label"].asString.contains("unique cards"))
        // A family and a search, as app.js's setsFamily / setsSearch set them.
        val promos = CollectionEngine.setsDo("family", "promos")
        assertEquals("promos", promos["quick"].asJsonArray.map { it.asJsonObject }.first { it["on"].asBoolean }["value"].asString)
        CollectionEngine.setsDo("family", "all")
        val found = CollectionEngine.setsDo("search", "double masters 2022")["sections"].asJsonArray.flatMap { it.asJsonObject["rows"].asJsonArray.map { r -> r.asJsonObject["code"].asString } }
        assertTrue("2x2 in $found", "2x2" in found)
        // The set page: its cards (every page of them), the hero, the toolbar and the grid.
        CollectionEngine.set("mtg", "2x2")
        CollectionEngine.setLoad()
        CollectionEngine.settle(90_000)
        val s = CollectionEngine.setModel()
        println("SET ${s["title"]} ${s["line"]} ${s["results"]} tiles=${s["tiles"].asJsonArray.size()} progress=${s["progress"]} pack=${s["pack"]} first=${s["tiles"].asJsonArray.firstOrNull()}".take(1500))
        assertEquals("Double Masters 2022", s["title"].asString)
        assertEquals("579 cards", s["results"].asString)
        assertEquals(120, s["tiles"].asJsonArray.size())
        assertTrue(s["atmosphere"].asJsonArray.size() >= 1)
        assertEquals("All sets", s["back"].asJsonObject["label"].asString)
        val mythic = CollectionEngine.setDo("rarity", "mythic")
        assertTrue(mythic["results"].asString.endsWith(" cards") && mythic["results"].asString != "579 cards")
        assertEquals("compact", CollectionEngine.setDo("view", "compact")["mode"].asString)
        CollectionEngine.setDo("rarity", "all"); CollectionEngine.setDo("view", "gallery")
        assertEquals(360, CollectionEngine.setDo("more")["tiles"].asJsonArray.size())
        // A tile opens the card page on that printing (A.card with data-set-i).
        val t = CollectionEngine.setModel()["tiles"].asJsonArray[1].asJsonObject
        // Number order as the site sorts it (localeCompare numeric): #2 comes second, not #10.
        assertEquals("Kozilek, Butcher of Truth", t["name"].asString)
        val c = CollectionEngine.card("mtg", JsonObject().apply { addProperty("name", t["name"].asString); addProperty("setI", t["i"].asInt); addProperty("setFinish", "") })
        println("SET CARD ${c["name"]} ${c["overviewHead"]?.asJsonObject?.get("set")}".take(600))
        assertEquals(t["name"].asString, c["name"].asString)
        assertEquals("2x2", c["overviewHead"].asJsonObject["set"].asJsonObject["code"].asString.lowercase())
    }

    /** tcg.js tcgSets / tcgSet → Yu-Gi-Oh! and Pokémon sets through the engine (the site's own loaders), then Magic's again. */
    @Test fun tcgSetsModel() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        fourDecks()
        for ((g, title, kind) in listOf(Triple("ygo", "Yu-Gi-Oh! sets", "ygo"), Triple("ptcg", "Pokémon sets", "pokemon"))) {
            CollectionEngine.sets(g)
            CollectionEngine.setsLoad()
            CollectionEngine.settle(60_000)
            val l = CollectionEngine.setsModel()
            val rows = l["sections"].asJsonArray.flatMap { it.asJsonObject["rows"].asJsonArray.map { r -> r.asJsonObject } }
            println("TSETS $g ${l["title"]} rows=${rows.size} first=${rows.firstOrNull()} foot=${l["foot"]}".take(1200))
            assertEquals(title, l["title"].asString)
            assertEquals(g, l["game"].asString)
            assertTrue(rows.size >= 20)
            assertEquals(kind, rows.first()["kind"].asString)
            assertTrue(rows.first()["images"].asJsonArray.all { it.asString.startsWith("https://") })
            assertTrue(l["more"].asString.startsWith("Show more"))
            // The set page: its cards, hero, toolbar, tile chrome and prices.
            val id = rows.first()["code"].asString
            CollectionEngine.set(g, id)
            CollectionEngine.setLoad()
            CollectionEngine.settle(120_000)
            val s = CollectionEngine.setModel()
            val tiles = s["tiles"].asJsonArray.map { it.asJsonObject }
            println("TSET $g ${s["title"]} ${s["line"]} ${s["results"]} tiles=${tiles.size} logo=${s["logo"]} first=${tiles.firstOrNull()}".take(1500))
            assertEquals(g, s["game"].asString)
            assertEquals(rows.first()["name"].asString, s["title"].asString)
            assertTrue(tiles.size >= 20)
            assertTrue(tiles.all { it["act"].asString == "tCard" && it["picture"].asJsonObject["src"].asString.startsWith("https://") })
            assertTrue(tiles.any { it["chrome"]?.isJsonObject == true && it["chrome"].asJsonObject["emb"].asJsonArray.size() > 0 })
            assertEquals("All sets", s["back"].asJsonObject["label"].asString)
            val owned = CollectionEngine.setDo("filter", "owned")
            assertEquals("owned", owned["filters"].asJsonArray.map { it.asJsonObject }.first { it["on"].asBoolean }["id"].asString)
            CollectionEngine.setDo("filter", "all")
        }
        // Back to Magic: the site's own game setting is handed back.
        CollectionEngine.sets("mtg")
        assertEquals("Magic sets", CollectionEngine.setsModel()["title"].asString)
    }

    /** app.js A.openSetPack → pack-preview.js's draw from Duskmourn's real booster sheets, a new pack, and a pulled card's page. */
    @Test fun openPack() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        fourDecks()
        CollectionEngine.set("mtg", "dsk")
        CollectionEngine.setLoad()
        CollectionEngine.settle(120_000)
        CollectionEngine.packOpen("mtg")
        CollectionEngine.settle(120_000)
        val p = CollectionEngine.packModel()
        val picks = p["picks"].asJsonArray.map { it.asJsonObject }
        println("PACK ${p["name"]} ${p["note"]} ${picks.map { it["rarity"].asString.take(1) + it["tier"].asString + it["level"].asInt + (if (it["finish"].asString.isNotEmpty()) "*" else "") }}".take(900))
        assertEquals("", p["error"].asString)
        assertEquals("dsk", p["code"].asString)
        assertTrue(p["note"].asString.contains("real booster sheets"))
        assertEquals(14, picks.size)
        assertTrue(picks.all { it["image"].asString.startsWith("https://") && it["level"].asInt in 0..5 && it["tier"].asString.matches(Regex("t[0-5]|tn")) })
        assertTrue(picks.last()["rank"].asInt >= 2)
        assertTrue(picks.any { it["finish"].asString == "foil" && it["finishLabel"].asString == "Foil" })
        assertEquals(14, p["shop"].asJsonObject["lines"].asJsonArray.size())
        assertTrue(p["shop"].asJsonObject["url"].asString.startsWith("https://www.tcgplayer.com/massentry"))
        // A new sealed pack from the same set, drawn afresh.
        val q = CollectionEngine.packAgain()
        assertEquals(14, q["picks"].asJsonArray.size())
        // A pulled card opens its card page in its own printing.
        val last = q["picks"].asJsonArray.last().asJsonObject
        val o = JsonObject().apply { addProperty("name", last["name"].asString); addProperty("pack", 13); addProperty("setFinish", last["finish"].asString) }
        val c = CollectionEngine.card("mtg", o)
        println("PACK CARD ${c.toString().take(300)}")
        assertEquals(last["name"].asString, c["name"].asString)
        assertTrue(c["notice"]?.isJsonNull != false || c["notice"].asString.isEmpty())
        CollectionEngine.packClose()
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
