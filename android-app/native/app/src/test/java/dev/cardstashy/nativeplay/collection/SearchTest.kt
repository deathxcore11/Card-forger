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
 * The Search tab through the site's own code in the engine, against the live card services: views.js search() with app.js's
 * dbSearch and its controls for Magic, tcg.js tcgSearch() with its own handlers for Yu-Gi-Oh! and Pokémon.
 */
class SearchTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    private suspend fun workspace() {
        val prints = JsonParser.parseString(javaClass.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
        val lots = JsonArray(); val printings = JsonObject(); val catalog = JsonObject()
        prints.forEachIndexed { i, c ->
            val name = c["name"].asString
            printings.add(c["id"].asString, c); catalog.add(name.lowercase(), c)
            lots.add(JsonObject().apply {
                addProperty("id", "l${i + 1}"); addProperty("name", name); addProperty("qty", if (name == "Lightning Bolt") 4 else 1); addProperty("printingId", c["id"].asString)
                addProperty("set", c["set"].asString); addProperty("collectorNumber", c["collector_number"].asString); addProperty("finish", "nonfoil")
                addProperty("condition", "Near Mint"); addProperty("language", "en"); addProperty("printingVerified", true); add("raw", JsonObject())
            })
        }
        val ws = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":$lots,"printings":$printings,"decks":[]}""").asJsonObject
        CollectionEngine.load(ws, catalog.toString())
    }
    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private fun blocks(m: JsonObject) = m.getAsJsonArray("blocks").map { it.asJsonObject }
    private fun block(m: JsonObject, kind: String) = blocks(m).firstOrNull { it.s("kind") == kind }
    private fun data(value: String = "", vararg ds: Pair<String, String>) = JsonObject().apply {
        addProperty("value", value); add("dataset", JsonObject().apply { ds.forEach { (k, v) -> addProperty(k, v) } })
    }
    private suspend fun run(act: String, d: JsonObject = JsonObject()): JsonObject { CollectionEngine.searchDo(act, d); CollectionEngine.settle(60_000); return CollectionEngine.searchModel() }

    @Test fun magicSearch() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle); CollectionEngine.restart(); workspace()
        val m = CollectionEngine.search("mtg")
        println("SEARCH0 ${m.s("title")} blocks=${blocks(m).map { it.s("kind") }} fan=${block(m, "fan")}".take(1200))
        assertEquals("Search cards", m.s("title"))
        assertEquals(listOf("gallery", "compact", "symbols"), m.getAsJsonArray("views").map { it.asJsonObject.s("mode") })
        val search = block(m, "search")!!
        assertEquals("Name, set + number, or text", search.s("placeholder"))
        assertEquals("askOpen", search["ask"].asJsonObject.s("act"))
        assertEquals(listOf("compareOpen", "go", "mtgWikiOpen", "dbRandom"), block(m, "tools")!!.getAsJsonArray("items").map { it.asJsonObject.s("act") })
        // store.js starts the search on Commander: the chip says so, and Clear all is there.
        assertEquals("Legal in Commander", block(m, "chips")!!.getAsJsonArray("items")[0].asJsonObject.s("label"))
        val f = block(m, "filters")!!
        assertEquals("Filters", f.s("label")); assertEquals("1", f.s("count")); assertEquals("Color", f.s("heading"))
        assertEquals(7, f.getAsJsonArray("pips").size())
        assertEquals(listOf("Sort", "Type", "Legal in", "Max price $", "Show"), f.getAsJsonArray("fields").map { it.asJsonObject.s("label") })
        assertEquals(listOf("Rarity", "Mana value", "Commander identity", "Set code"), f["advanced"].asJsonObject.getAsJsonArray("fields").map { it.asJsonObject.s("label") })
        assertTrue(f["advanced"].asJsonObject.s("foot").startsWith("The search box also takes Scryfall syntax"))
        assertEquals(listOf("Cheap card draw", "Angels", "Red legends", "Token makers"), block(m, "hints")!!.getAsJsonArray("items").map { it.asJsonObject.s("label") })
        // The fan of cards from the collection (search-fan.js: up to five a day, repeats folded together).
        val fan = block(m, "fan")!!
        assertEquals("From your collection today", fan.s("title")); assertTrue(fan.getAsJsonArray("cards").size() >= 1)
        assertTrue(fan.getAsJsonArray("cards").all { it.asJsonObject.s("act") == "card" && it.asJsonObject.s("name").isNotBlank() })

        // A typed search: app.js I.dbTerm, then dbSearch (data-enter) against Scryfall.
        CollectionEngine.searchDo("dbTerm", data("t:angel o:flying"))
        val r = run("dbSearch")
        val count = block(r, "count")!!
        val tiles = block(r, "tiles")!!.getAsJsonArray("tiles").map { it.asJsonObject }
        println("SEARCH1 ${count} tiles=${tiles.size} first=${tiles.first()}".take(1500))
        assertTrue(count.s("text").endsWith(" cards")); assertEquals("dbSave", count["save"].asJsonObject.s("act"))
        assertTrue(tiles.size >= 20)
        assertTrue(tiles.all { it.s("name").isNotBlank() && it["picture"].asJsonObject.s("src").startsWith("https://") })
        assertEquals("t:angel o:flying", r.s("term"))
        assertTrue(blocks(r).any { it.s("kind") == "more" && it.s("act") == "dbMore" })
        // Load more: the next page joins the first.
        val more = run("dbMore")
        assertTrue(block(more, "tiles")!!.getAsJsonArray("tiles").size() > tiles.size)
        // A filter: Sort (C.dbFilter), then its chip removed (A.dbChip).
        val sorted = run("dbFilter", data("usd", "field" to "sort"))
        assertTrue(block(sorted, "chips")!!.getAsJsonArray("items").any { it.asJsonObject.s("label") == "Sort: Price: high to low" })
        val unsorted = run("dbChip", data("", "field" to "sort"))
        assertTrue(block(unsorted, "chips")!!.getAsJsonArray("items").none { it.asJsonObject.s("label").startsWith("Sort:") })
        // A color pip (A.dbColorChip) toggles.
        val red = run("dbColorChip", data("", "value" to "R"))
        assertTrue(block(red, "filters")!!.getAsJsonArray("pips").any { it.asJsonObject.s("value") == "R" && it.asJsonObject["on"].asBoolean })
        // Save this search, then run it from the saved row; the saved list survives into the device store.
        CollectionEngine.searchToasts()
        CollectionEngine.searchDo("dbSave")
        assertEquals(listOf("Search saved."), CollectionEngine.searchToasts())
        val saved = block(CollectionEngine.searchModel(), "saved")!!
        assertTrue(saved.getAsJsonArray("items")[0].asJsonObject.s("label").contains("t:angel o:flying"))
        assertTrue(CollectionEngine.searchSaved().contains("t:angel o:flying"))
        // No match: the site's own words.
        CollectionEngine.searchDo("dbTerm", data("zzqqxx notacard"))
        val none = run("dbSearch")
        println("SEARCH NONE ${blocks(none)}".take(600))
        assertTrue(blocks(none).any { it.s("kind") == "note" && it["warn"]?.asBoolean == true && it.s("text").isNotBlank() })
        // Random (A.dbRandom): the card it picked, for the app's card page.
        CollectionEngine.searchDo("dbRandom"); CollectionEngine.settle(30_000)
        val went = CollectionEngine.searchWent()
        println("SEARCH RANDOM $went")
        assertEquals("card", went!!.s("act")); assertTrue(went.s("name").isNotBlank())
        // suggest.js: the matching cards as you type (app.js homeLookup), then the recent searches on an empty box.
        assertEquals(null, CollectionEngine.searchSuggest("mtg", "lightning bol"))
        CollectionEngine.settle(30_000)
        val sg = CollectionEngine.searchSuggestModel()!!
        println("SUGGEST $sg".take(800))
        assertTrue(sg["items"].asJsonArray.any { it.asJsonObject.s("name") == "Lightning Bolt" })
        assertTrue(sg["items"].asJsonArray.all { it.asJsonObject.s("art").startsWith("https://") || it.asJsonObject.s("art").isEmpty() })
        CollectionEngine.searchRemember("mtg", "Lightning Bolt")
        val recent = CollectionEngine.searchSuggest("mtg", "")!!
        assertTrue(recent["recent"].asBoolean); assertEquals("Lightning Bolt", recent["items"].asJsonArray[0].asJsonObject.s("name"))
        assertTrue(CollectionEngine.searchSaved().contains("Lightning Bolt"))
        // The view (workbench-ui.js viewSave, area search).
        assertEquals("compact", CollectionEngine.searchDo("viewSave", data("", "mode" to "compact", "area" to "search")).s("mode"))
    }

    private fun get(url: String): ByteArray = (java.net.URL(url).openConnection() as java.net.HttpURLConnection).run {
        setRequestProperty("User-Agent", "CardStashyNativeTests/1.0"); connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = true
        inputStream.use { it.readBytes() }
    }
    private fun sha1(s: String) = java.security.MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
    /** Every picture a model draws (tiles and the fan), saved under its address's hash for the shot tests. */
    private fun saveArt(m: JsonObject, out: File) {
        val urls = mutableSetOf<String>()
        for (b in blocks(m)) {
            b.getAsJsonArray("tiles")?.forEach { t -> t.asJsonObject.getAsJsonObject("picture")?.let { p -> p.s("src").takeIf { it.isNotBlank() }?.let(urls::add) } }
            b.getAsJsonArray("cards")?.forEach { c -> c.asJsonObject.getAsJsonObject("picture")?.let { p -> p.s("src").takeIf { it.isNotBlank() }?.let(urls::add) } }
        }
        for (u in urls.take(40)) { val f = File(out, sha1(u) + ".jpg"); if (!f.exists()) runCatching { f.writeBytes(get(u)) }.onFailure { println("ART MISSING $u") }; Thread.sleep(60) }
    }

    /** CollectionSearchShotTest's pages: Magic empty (with the fan), filters, results; Yu-Gi-Oh! and Pokémon results (app/build/shot-art/home). */
    @Test fun shotFixture() = runBlocking {
        assumeTrue(bundle.isFile)
        val out = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home").apply { mkdirs() }
        CollectionEngine.initFrom(bundle); CollectionEngine.restart(); workspace()
        val empty = CollectionEngine.search("mtg"); File(out, "collection-search-empty.json").writeText(empty.toString()); saveArt(empty, out)
        CollectionEngine.searchDo("dbTerm", data("t:angel o:flying"))
        val r = run("dbSearch"); File(out, "collection-search-results.json").writeText(r.toString()); saveArt(r, out)
        CollectionEngine.searchDo("dbSave"); CollectionEngine.searchToasts()
        File(out, "collection-search-saved.json").writeText(CollectionEngine.searchModel().toString())
        for ((g, q) in listOf("ygo" to "Dark Magician", "ptcg" to "Pikachu")) {
            CollectionEngine.search(g); CollectionEngine.searchDo("tQ", data(q))
            val t = run("tSearch"); File(out, "collection-search-$g.json").writeText(t.toString()); saveArt(t, out)
        }
        CollectionEngine.search("mtg")
        Unit
    }

    @Test fun tcgSearch() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle); CollectionEngine.restart(); workspace()
        for ((g, q) in listOf("ygo" to "Dark Magician", "ptcg" to "Pikachu")) {
            val m = CollectionEngine.search(g)
            println("TSEARCH0 $g blocks=${blocks(m).map { it.s("kind") }} filters=${block(m, "filters")}".take(1200))
            assertEquals("Search cards", m.s("title")); assertEquals(g, m.s("game"))
            assertEquals(listOf("tCompareOpen", "go", "mtgWikiOpen", "tRandomCard"), block(m, "tools")!!.getAsJsonArray("items").map { it.asJsonObject.s("act") })
            val f = block(m, "filters")!!
            assertTrue(f.getAsJsonArray("fields").map { it.asJsonObject.s("label") }.containsAll(listOf("Show", "Card type", "Sort", "Max price $")))
            CollectionEngine.searchDo("tQ", data(q))
            val r = run("tSearch")
            val tiles = block(r, "tiles")?.getAsJsonArray("tiles")?.map { it.asJsonObject }.orEmpty()
            println("TSEARCH1 $g count=${block(r, "count")} tiles=${tiles.size} first=${tiles.firstOrNull()}".take(1500))
            assertTrue("$g tiles", tiles.size >= 5)
            assertTrue(tiles.all { it.s("act") == "tCard" && it.s("id").isNotBlank() })
            assertTrue(block(r, "count")!!.s("text").contains("shown"))
            // Random (A.tRandomCard): the card it picked, for the app's card page.
            CollectionEngine.searchDo("tRandomCard"); CollectionEngine.settle(30_000)
            val went = CollectionEngine.searchWent()
            println("TSEARCH RANDOM $g $went")
            assertEquals("tCard", went!!.s("act")); assertTrue(went.s("id").isNotBlank())
        }
        // Back to Magic: the site's own game setting is handed back.
        assertEquals("mtg", CollectionEngine.search("mtg").s("game"))
    }
}
