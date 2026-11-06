package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Collection › Decks › Ideas through the site's own code in the engine: the head and tabs as decks() draws them with Ideas open
 * (Collection.decks {tab}), the tab's body as a panel (Collection.decksPanel: views.js ideasView / tcg.js ideasView with app.js's
 * handlers, the once-only auto-build), Analyze on a collection whose names are all known (no lookups), the idea sheet
 * (Collection.ideaSheet / ideaDo: views.js ideaSheet, A.ideaBudget at "Only my cards", C.ideaPick, A.ideaSelect) and its writes
 * (A.ideaWish, A.ideaToDeck, A.ideaOwn asking first, A.ideaSaveAll), and Yu-Gi-Oh!'s Ideas from a kept tournament cache
 * (cardforge-meta-v1 handed back through the engine's store). [models] keeps the models for the shot test (DecksIdeasShotTest).
 */
class DecksIdeasTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    companion object {
        /** The fixture collection of [magic]: the sample printings, one deck. */
        suspend fun magic() {
            val prints = JsonParser.parseString(DecksIdeasTest::class.java.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
            val lots = JsonArray(); val printings = JsonObject(); val catalog = JsonObject()
            prints.forEachIndexed { i, c ->
                val name = c["name"].asString
                printings.add(c["id"].asString, c); catalog.add(name.lowercase(), c)
                lots.add(JsonObject().apply {
                    addProperty("id", "l${i + 1}"); addProperty("name", name); addProperty("qty", if (name == "Swamp") 12 else 1); addProperty("printingId", c["id"].asString)
                    addProperty("set", c["set"].asString); addProperty("collectorNumber", c["collector_number"].asString); addProperty("finish", "nonfoil")
                    addProperty("condition", "Near Mint"); addProperty("language", "en"); addProperty("printingVerified", true); add("raw", JsonObject())
                })
            }
            val decks = """[{"id":"d1","name":"Goblin Horde","format":"Commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Sol Ring","qty":1}]}]"""
            val ws = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":$lots,"printings":$printings,"decks":$decks}""").asJsonObject
            CollectionEngine.load(ws, catalog.toString())
        }
        /** The Yu-Gi-Oh! fixture (tcg-collection), with a second Dark Magician card so the archetype is one to build around. */
        suspend fun yugioh() {
            val fx = JsonParser.parseString(DecksIdeasTest::class.java.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
            val ws = fx["workspace"].asJsonObject.deepCopy(); val cache = fx["cache"].asJsonObject.deepCopy()
            val ygo = cache["ygo"].asJsonObject
            ygo.add("38033121", ygo["46986414"].asJsonObject.deepCopy().apply { addProperty("id", "38033121"); addProperty("name", "Dark Magician Girl") })
            val lots = ws["tcg"].asJsonObject["ygo"].asJsonObject["collection"].asJsonArray
            lots.add(lots.map { it.asJsonObject }.first { it["cardId"].asString == "46986414" }.deepCopy().apply { addProperty("id", "dmg"); addProperty("cardId", "38033121"); addProperty("name", "Dark Magician Girl") })
            CollectionEngine.load(ws, null)
            CollectionEngine.tcgCacheLoad(cache.toString())
        }
        /** meta.js's saved tournament decks (cardforge-meta-v1), fresh: what the app's store hands back when the bundle starts. */
        fun keptMeta(): String = JsonObject().apply {
            add("ygo", JsonObject().apply { addProperty("at", System.currentTimeMillis()); add("data", JsonParser.parseString("""{"decks":[
                {"key":"k1","name":"Dark Magician","place":"Top 8","event":"YCS Test City","players":512,"cover":"46986414","main":["46986414","46986414","38033121","89631139"],"extra":[]},
                {"key":"k2","name":"Blue-Eyes","place":"Winner","event":"WCQ Regional","players":120,"cover":"89631139","main":["89631139","89631139","89631139"],"extra":[]}]}"""))})
        }.toString()
        val models = HashMap<String, JsonObject>()
        /** Where the shot test (DecksIdeasShotTest) reads them: app/build/shot-art/decks-ideas/<key>.json. */
        val fixtures: File get() = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/decks-ideas")
    }
    /** A model kept for the shots, with the page's head as decks() draws it and icons.js's glyphs. */
    private suspend fun keep(key: String, model: JsonObject, head: JsonObject) {
        models[key] = model
        fixtures.mkdirs()
        fixtures.resolve("$key.json").writeText(JsonObject().apply { add("model", model); add("head", head); add("glyphs", CollectionEngine.glyphs()) }.toString())
    }

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private fun all(j: JsonObject?, ok: (JsonObject) -> Boolean): List<JsonObject> {
        val out = mutableListOf<JsonObject>()
        fun walk(n: JsonObject?) { n?.getAsJsonArray("k")?.forEach { k -> if (k.isJsonObject) { val o = k.asJsonObject; if (ok(o)) out += o; walk(o) } } }
        walk(j); return out
    }
    private fun cls(o: JsonObject) = o.getAsJsonObject("a")?.get("class")?.asString.orEmpty().split(' ')
    private fun words(o: JsonObject): String = (o.getAsJsonArray("k") ?: JsonArray()).joinToString("") { if (it.isJsonPrimitive) it.asString else words(it.asJsonObject) }.replace(Regex("\\s+"), " ").trim()
    private fun act(o: JsonObject) = o.getAsJsonObject("a")?.get("data-act")?.asString.orEmpty()
    private suspend fun saved() = JsonParser.parseString(CollectionEngine.saved()).asJsonObject

    @Test fun magicIdeas() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle); magic()
        // The head with Ideas open: War Chest, Import and New, the tab on, no deck tiles.
        val head = CollectionEngine.decks("mtg", JsonObject().apply { addProperty("tab", "ideas") })
        assertEquals("ideas", head.s("tab"))
        assertEquals(listOf("warChest", "importDeck", "newDeck"), head.getAsJsonArray("actions").map { it.asJsonObject.s("act") })
        assertEquals("ideas", head.getAsJsonArray("tabs").map { it.asJsonObject }.first { it["on"]?.asBoolean == true }.s("key"))
        assertEquals("1", head.getAsJsonArray("tools").map { it.asJsonObject }.first { it.s("act") == "randomDeckOptions" }.s("home"))
        assertEquals(0, head.getAsJsonArray("tiles").size())
        // My decks is what the page draws next (the tab went back).
        assertEquals("mine", CollectionEngine.decks("mtg").s("tab"))

        var p = CollectionEngine.decksPanel("mtg", "ideas")
        // The auto-build (app.js route: once a session, after 30 ms) fills the grid.
        CollectionEngine.settle(10_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) p = j }
        p = JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject
        val body = p.getAsJsonObject("body")
        assertTrue(words(body).contains("Build from my cards"))
        val ideas = all(body) { "idea" in cls(it) && it.s("t") == "article" }
        assertTrue("ideas: ${words(body).take(400)}", ideas.isNotEmpty())
        assertTrue(ideas.size <= 12)
        assertTrue(words(ideas.first()).contains("/100 from your cards"))
        val analyze = all(body) { act(it) == "analyze" }.single()
        assertEquals("↻ Re-analyze", words(analyze))
        keep("mtg-ideas", p, head)
        // Analyze: every name is known, so nothing is looked up; the line says how many have data.
        CollectionEngine.panelTap(analyze["i"].asInt)
        CollectionEngine.settle(10_000)
        val after = JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject.getAsJsonObject("body")
        assertTrue(words(after), words(after).contains("13 card names have data."))
        // Owned commanders only, unticked (C.ideasOwned through the checkbox).
        val box = all(after) { it.getAsJsonObject("a")?.get("data-change")?.asString == "ideasOwned" }.single()
        CollectionEngine.panelType(box["i"].asInt, "false")
        val unticked = JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject.getAsJsonObject("body")
        assertFalse(all(unticked) { it.getAsJsonObject("a")?.get("data-change")?.asString == "ideasOwned" }.single().getAsJsonObject("a").has("checked"))
        CollectionEngine.panelType(all(unticked) { it.getAsJsonObject("a")?.get("data-change")?.asString == "ideasOwned" }.single()["i"].asInt, "true")

        // View deck: the app opens the sheet (acted).
        val view = all(JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject.getAsJsonObject("body")) { act(it) == "openIdea" }.first()
        val tapped = CollectionEngine.panelTap(view["i"].asInt)
        val i = tapped.getAsJsonObject("acted").getAsJsonObject("data").s("i").toInt()
        assertEquals("openIdea", tapped.getAsJsonObject("acted").s("act"))

        // The idea sheet: Only my cards (no purchase; nothing looked up), then the list as views.js ideaSheet draws it.
        val opened = CollectionEngine.ideaSheet(i)
        assertTrue(opened.s("title").isNotBlank())
        var sheet = CollectionEngine.ideaDo("budget", "0")
        CollectionEngine.settle(10_000)
        sheet = CollectionEngine.ideaDo("select", "none")
        fun block(m: JsonObject, k: String) = m.getAsJsonArray("blocks").map { it.asJsonObject }.firstOrNull { it.s("k") == k }
        assertEquals(listOf("Cards", "You own"), block(sheet, "impact")!!.getAsJsonArray("tiles").map { it.asJsonObject.s("label") }.take(2))
        assertEquals("Only my cards", block(sheet, "chips")!!.getAsJsonArray("chips").map { it.asJsonObject }.first { it["on"]?.asBoolean == true }.s("label"))
        assertEquals("Tick cards to act on them", block(sheet, "selbar")!!.s("count"))
        // app.js A.ideaBudget(0) keeps the line the sheet opened with (views.js shows open.msg first).
        assertEquals("Loading a complete proposed deck, including lands…", block(sheet, "status")!!.s("text"))
        val groups = block(sheet, "cards")!!.getAsJsonArray("groups").map { it.asJsonObject }
        assertTrue(groups.isNotEmpty())
        val first = groups.first().getAsJsonArray("rows").first().asJsonObject
        assertEquals("Deck", block(sheet, "deckpick")!!.s("label"))
        assertEquals(listOf("ideaSaveAll", "ideaBuy", "ideaWish", "ideaOwn"), block(sheet, "actions")!!.getAsJsonArray("buttons").map { it.asJsonObject.s("act") })
        keep("mtg-sheet", sheet, head)
        // C.ideaPick: one card ticked.
        val picked = CollectionEngine.ideaDo("pick", JsonObject().apply { addProperty("name", first.s("name")); addProperty("on", true) }.toString())
        assertEquals("1 selected", block(picked, "selbar")!!.s("count"))
        // A.ideaWish and A.ideaToDeck with that card; A.ideaOwn asks first.
        val wish = CollectionEngine.act("ideaWish", JsonObject())
        assertEquals("1 cards added to your wishlist.", wish.getAsJsonArray("toasts").last().asJsonObject.s("text"))
        assertTrue(saved().getAsJsonArray("wishlist").any { it.asJsonObject.s("name") == first.s("name") })
        val toDeck = CollectionEngine.act("ideaToDeck", JsonObject().apply { addProperty("deck", "d1") })
        assertEquals("1 cards added to Goblin Horde.", toDeck.getAsJsonArray("toasts").last().asJsonObject.s("text"))
        val own = CollectionEngine.act("ideaOwn", JsonObject())
        assertTrue(own.s("ask").startsWith("Add 1 cards to your collection"))
        val before = saved().getAsJsonArray("collection").size()
        CollectionEngine.act("ideaOwn", JsonObject().apply { addProperty("confirmed", true) })
        assertEquals(before + 1, saved().getAsJsonArray("collection").size())
        // A.ideaSaveAll: a draft deck, opened on its Cards tab.
        val saveAll = CollectionEngine.act("ideaSaveAll", JsonObject())
        val made = JsonParser.parseString(saveAll.s("made")).asJsonObject
        assertEquals("deck", made.s("go")); assertEquals("cards", made.s("tab"))
        assertTrue(saveAll.getAsJsonArray("toasts").last().asJsonObject.s("text").startsWith("Saved incomplete draft ("))
        assertTrue(saved().getAsJsonArray("decks").any { it.asJsonObject.s("id") == made.s("id") })
        // The card page from the sheet offers the way back (views.js cardSheet's sheetBack).
        val card = CollectionEngine.card("mtg", JsonObject().apply { addProperty("name", first.s("name")); addProperty("back", "idea:$i") })
        assertTrue(card.getAsJsonObject("head")["back"]?.asBoolean == true)
        assertFalse(CollectionEngine.card("mtg", JsonObject().apply { addProperty("name", "Sol Ring") }).getAsJsonObject("head")["back"]?.asBoolean == true)
    }

    @Test fun magicIdeasEmpty() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle)
        CollectionEngine.load(JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":[],"decks":[]}""").asJsonObject, "{}")
        // No decks: My decks hides the head's buttons, Ideas keeps them (views.js decks emptyMine).
        assertEquals(0, CollectionEngine.decks("mtg").getAsJsonArray("actions").size())
        assertEquals(3, CollectionEngine.decks("mtg", JsonObject().apply { addProperty("tab", "ideas") }).getAsJsonArray("actions").size())
        val p = CollectionEngine.decksPanel("mtg", "ideas"); CollectionEngine.settle(5_000)
        val body = JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject.getAsJsonObject("body")
        assertTrue(p.has("key"))
        assertTrue(words(body).contains("Ideas come from your cards"))
        assertEquals(listOf("importCollection", "loadExample", "go"), all(all(body) { "empty" in cls(it) }.single()) { it.s("t") == "button" }.map(::act))
        keep("mtg-empty", JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject, CollectionEngine.decks("mtg", JsonObject().apply { addProperty("tab", "ideas") }))
        // Try example collection: nothing to replace, so it does not ask; Collection opens with the example's cards.
        val r = CollectionEngine.act("loadExample", JsonObject())
        assertEquals("", r.s("ask"))
        assertEquals("collection", JsonParser.parseString(r.s("made")).asJsonObject.s("go"))
        assertTrue(saved()["example"].asBoolean)
    }

    @Test fun yugiohIdeas() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart()
        // The tournament cache this device kept comes back with the bundle (meta.js reads it: no load is needed).
        val kept = CollectionEngine.MemoryStore().apply { save("cardforge-meta-v1", keptMeta()) }
        val was = CollectionEngine.store
        CollectionEngine.store = kept
        try {
            CollectionEngine.initFrom(bundle); yugioh()
            val head = CollectionEngine.decks("ygo", JsonObject().apply { addProperty("tab", "ideas") })
            assertEquals(listOf("warChest", "tImport", "tNewDeck"), head.getAsJsonArray("actions").map { it.asJsonObject.s("act") })
            CollectionEngine.decksPanel("ygo", "ideas"); CollectionEngine.settle(5_000)
            val p = JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject
            val body = p.getAsJsonObject("body")
            assertEquals(listOf("tBuildAuto", "tPickSeeds"), all(all(body) { "build-own" in cls(it) }.single()) { it.s("t") == "button" }.map(::act))
            assertTrue(words(body).contains("Archetypes you own"))
            val tiles = all(body) { "collection-idea" in cls(it) }
            assertEquals(listOf("Dark Magician"), tiles.map { words(all(it) { k -> "idea-card-name" in cls(k) }.single()) })
            assertTrue(words(tiles.single()).contains("2 cards · 2 copies"))
            assertTrue(words(tiles.single()).contains("In 1 of 2 recent top decks"))
            assertTrue(words(body).contains("Tournament decks you’re closest to"))
            val rows = all(body) { "meta-row" in cls(it) }
            assertEquals(2, rows.size)
            assertTrue(words(rows.first()).contains("Dark Magician"))
            assertTrue(words(rows.first()).contains("% owned"))
            keep("ygo-ideas", p, head)
            // The empty-state buttons of My decks carry the tab they open (data-id).
            CollectionEngine.load(JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":[],"decks":[]}""").asJsonObject, "{}")
            val mine = CollectionEngine.decks("ygo")
            assertEquals(listOf("ideas", "inspiration"), mine.getAsJsonObject("empty").getAsJsonArray("actions").map { it.asJsonObject.s("id") })
            // A meta snapshot the bundle writes goes to the store (each pump's "stored").
            CollectionEngine.eval("localStorage.setItem('cardforge-meta-v1', '{\"x\":1}')"); CollectionEngine.settle(1_000)
            assertEquals("{\"x\":1}", kept.kept["cardforge-meta-v1"])
        } finally { CollectionEngine.store = was }
    }
}
