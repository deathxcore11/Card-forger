package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Decks, stage C1, through the site's own code in the engine:
 * - Yu-Gi-Oh! / Pokémon's Import a deck and New deck (tcg.js tcgImportSheet "deck", tcgNewDeckSheet with Meta decks' data-format) read
 *   from the site's sheets, and their buttons (A.tImpDeck: a .ydk and a list matched from the card cache, "Paste a list first.";
 *   A.tNewDeckSave) saving the deck the site opens next;
 * - Magic's Deck review sheet (views.js deckReviewSheet) for a Commander deck and a Modern one, its Search actions (A.findRole,
 *   A.formatSearch: the search they leave), Load card data (A.refreshDeck);
 * - Meta decks' Saved decks (A.exportRef's file, A.deleteRef asked first) and Precons' search (I.preconSearch);
 * - the War Chest window from the Decks head (Dice & coin in the window, other tools to the app, the tab's panel back after).
 * [keep] writes the models for the shot test (DecksC1ShotTest).
 */
class DecksC1Test {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    companion object {
        /** Where the shot test reads them: app/build/shot-art/decks-c1/<key>.json. */
        val fixtures: File get() = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/decks-c1")
        /** DecksIdeasTest's Magic fixture, with a Modern deck (a banned and a not-legal card, 24 of 60) and a saved idea. */
        suspend fun magic() {
            val prints = JsonParser.parseString(DecksC1Test::class.java.classLoader!!.getResource("collection/printings.json")!!.readText()).asJsonArray.map { it.asJsonObject }
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
            val decks = """[{"id":"d1","name":"Goblin Horde","format":"Commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Sol Ring","qty":1},{"name":"Counterspell","qty":1}]},
              {"id":"d2","name":"Rakdos Test","format":"Modern","commander":"","cards":[{"name":"Lightning Bolt","qty":4},{"name":"The One Ring","qty":1},{"name":"Sol Ring","qty":1},{"name":"Swamp","qty":18}]}]"""
            val refs = """[{"id":"r1","name":"Krenko Tokens","format":"Commander","commander":"Krenko, Mob Boss","strategy":"Auto","locked":false,
              "source":{"kind":"Community deck","author":"Jane","website":"example.com","url":"https://example.com/krenko"},"cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Goblin Instigator","qty":1},{"name":"Swamp","qty":30}]}]"""
            val ws = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":$lots,"printings":$printings,"decks":$decks,"references":$refs}""").asJsonObject
            CollectionEngine.load(ws, catalog.toString())
        }
    }
    private suspend fun keep(key: String, model: JsonObject, extra: JsonObject? = null) {
        fixtures.mkdirs()
        fixtures.resolve("$key.json").writeText(JsonObject().apply { add("model", model); extra?.entrySet()?.forEach { (k, v) -> add(k, v) }; add("glyphs", CollectionEngine.glyphs()) }.toString())
    }

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private fun JsonObject.objs(k: String) = getAsJsonArray(k)?.map { it.asJsonObject }.orEmpty()
    private fun JsonObject.pairs(k: String) = getAsJsonArray(k)?.map { it.asJsonArray.let { a -> a[0].asString to a[1].asString } }.orEmpty()
    private fun all(j: JsonObject?, ok: (JsonObject) -> Boolean): List<JsonObject> {
        val out = mutableListOf<JsonObject>()
        fun walk(n: JsonObject?) { n?.getAsJsonArray("k")?.forEach { k -> if (k.isJsonObject) { val o = k.asJsonObject; if (ok(o)) out += o; walk(o) } } }
        walk(j); return out
    }
    private fun cls(o: JsonObject) = o.getAsJsonObject("a")?.get("class")?.asString.orEmpty().split(' ')
    private fun words(o: JsonObject): String = (o.getAsJsonArray("k") ?: JsonArray()).joinToString("") { if (it.isJsonPrimitive) it.asString else words(it.asJsonObject) }.replace(Regex("\\s+"), " ").trim()
    private fun act(o: JsonObject) = o.getAsJsonObject("a")?.get("data-act")?.asString.orEmpty()
    private fun attr(o: JsonObject, k: String) = o.getAsJsonObject("a")?.get(k)?.asString.orEmpty()
    private suspend fun panel() = JsonParser.parseString(CollectionEngine.eval("Collection.panelModel()")).asJsonObject
    private suspend fun saved() = JsonParser.parseString(CollectionEngine.saved()).asJsonObject
    private fun made(r: JsonObject) = JsonParser.parseString(r.s("made")).asJsonObject

    @Test fun yugiohImportAndNew() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle); DecksIdeasTest.yugioh()
        val imp = CollectionEngine.tDeckImportSheet("ygo")
        assertEquals("Import a deck", imp.s("title"))
        assertEquals("Upload or paste a .ydk file (YGOPRODeck, EDOPro, Master Duel tools), or a list like “3 Ash Blossom & Joyous Spring”.", imp.s("hint"))
        assertEquals("#main\n89631139\n…", imp.s("placeholder"))
        assertEquals(9, imp["rows"].asInt)
        assertEquals("Upload a file", imp.s("upload")); assertEquals(".ydk,.txt", imp.s("accept"))
        assertEquals("Name", imp.getAsJsonObject("name").s("label")); assertEquals("Imported deck", imp.getAsJsonObject("name").s("value"))
        assertEquals(100, imp.getAsJsonObject("name")["max"].asInt)
        val f = imp.getAsJsonObject("format")
        assertEquals("Format", f.s("label"))
        assertEquals(listOf("Advanced (TCG)", "Traditional (TCG)", "OCG", "GOAT", "Edison", "Master Duel", "Speed Duel", "Duel Links", "Casual"), f.pairs("options").map { it.second })
        assertEquals("tcg", f.s("selected"))
        assertEquals("Import", imp.s("button"))
        keep("ygo-import", imp)

        // Nothing pasted: the site's words in #tImpStatus, nothing saved.
        val decks0 = saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks").size
        var r = CollectionEngine.act("tImpDeck", JsonObject().apply { addProperty("game", "ygo"); addProperty("text", ""); addProperty("name", "Imported deck"); addProperty("format", "tcg") }, 30_000)
        assertEquals("Paste a list first.", r.getAsJsonObject("texts").s("#tImpStatus"))
        assertEquals(0, r["writes"].asInt)
        keep("ygo-import-error", imp, JsonObject().apply { addProperty("status", "Paste a list first.") })

        // A .ydk (its zones kept as written) from cards the cache holds: saved, the deck the site opens next.
        r = CollectionEngine.act("tImpDeck", JsonObject().apply { addProperty("game", "ygo"); addProperty("text", "#created by test\n#main\n46986414\n46986414\n089631139\n#extra\n!side\n14558127\n")
            addProperty("name", "  Spellcasters  "); addProperty("format", "goat") }, 30_000)
        assertTrue(r.toString(), r.objs("toasts").any { it.s("text") == "Deck imported. Your collection is unchanged." })
        var m = made(r); assertEquals("tdeck", m.s("go")); assertEquals("ygo", m.s("game"))
        var deck = saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks").single { it.s("id") == m.s("id") }
        assertEquals("Spellcasters", deck.s("name")); assertEquals("goat", deck.s("format"))
        val zones = deck.getAsJsonObject("zones")
        assertEquals(listOf("46986414" to 2, "89631139" to 1), zones.objs("main").map { it.s("cardId") to it["qty"].asInt })
        assertEquals(listOf("14558127"), zones.objs("side").map { it.s("cardId") })
        assertEquals(decks0 + 1, saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks").size)

        // Closed while it runs (app.js closeSheet: S.ui.sheetCtx null): importGuard's active() fails once the card lookup lands, and
        // nothing is saved. The same import left open saves the deck.
        val ygoCard = """{"data":[{"id":12345678,"name":"Test Lookup Warrior","type":"Normal Monster","frameType":"normal","desc":"A test.","atk":1000,"def":1000,"level":4,"race":"Warrior","attribute":"LIGHT","card_images":[{"id":12345678,"image_url":"https://images.ygoprodeck.com/images/cards/12345678.jpg","image_url_small":"https://images.ygoprodeck.com/images/cards_small/12345678.jpg"}],"card_sets":[]}]}"""
        fun ydkRun(name: String) = "Collection.act('tImpDeck', " + com.google.gson.JsonPrimitive(JsonObject().apply { addProperty("game", "ygo"); addProperty("text", "#main\n12345678\n"); addProperty("name", name); addProperty("format", "tcg") }.toString()) + ")"
        suspend fun ygoDecks() = saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks")
        try {
            // The lookup held while the sheet closes (the import waiting on YGOPRODeck), then answered.
            var hold = true
            CollectionEngine.answerForTest = { u -> if (u.contains("ygoprodeck.com")) (if (hold) 0 else 200) to ygoCard else null }
            val before = ygoDecks().size
            CollectionEngine.eval(ydkRun("Closed"))
            CollectionEngine.settle(2_000)
            assertFalse("still waiting on the lookup", JsonParser.parseString(CollectionEngine.eval("Collection.actPoll()")).asJsonObject["done"].asBoolean)
            CollectionEngine.tDeckSheetClose()
            hold = false; CollectionEngine.releaseForTest()
            CollectionEngine.settle(5_000)
            var polled = JsonParser.parseString(CollectionEngine.eval("Collection.actPoll()")).asJsonObject
            assertTrue(polled.toString(), polled["done"]?.asBoolean == true)
            assertEquals(polled.toString(), 0, polled["writes"]?.asInt ?: 0)
            assertEquals(before, ygoDecks().size)
            CollectionEngine.eval(ydkRun("Left open"))
            CollectionEngine.settle(5_000)
            polled = JsonParser.parseString(CollectionEngine.eval("Collection.actPoll()")).asJsonObject
            assertTrue(polled.toString(), ygoDecks().any { it.s("name") == "Left open" })
            assertFalse(ygoDecks().any { it.s("name") == "Closed" })
        } finally { CollectionEngine.answerForTest = null }

        // A list by name (the cache's cards), into Main.
        r = CollectionEngine.act("tImpDeck", JsonObject().apply { addProperty("game", "ygo"); addProperty("text", "3 Dark Magician\n2x Blue-Eyes White Dragon"); addProperty("name", ""); addProperty("format", "tcg") }, 30_000)
        m = made(r)
        deck = saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks").single { it.s("id") == m.s("id") }
        assertEquals("Imported deck", deck.s("name"))
        assertEquals(listOf("Dark Magician" to 3, "Blue-Eyes White Dragon" to 2), deck.getAsJsonObject("zones").objs("main").map { it.s("name") to it["qty"].asInt })

        // New deck, from the head (first format) and from Meta decks' Create a OCG deck (data-format).
        val nd = CollectionEngine.tNewDeckSheet("ygo")
        assertEquals("New Yu-Gi-Oh! deck", nd.s("title"))
        assertEquals("Name", nd.getAsJsonObject("name").s("label")); assertEquals("My deck", nd.getAsJsonObject("name").s("placeholder"))
        assertEquals("tcg", nd.getAsJsonObject("format").s("selected"))
        assertEquals("Create deck", nd.s("button"))
        keep("ygo-new", nd)
        assertEquals("ocg", CollectionEngine.tNewDeckSheet("ygo", "ocg").getAsJsonObject("format").s("selected"))
        // A format the game doesn't have: the first.
        assertEquals("tcg", CollectionEngine.tNewDeckSheet("ygo", "standard").getAsJsonObject("format").s("selected"))
        r = CollectionEngine.act("tNewDeckSave", JsonObject().apply { addProperty("game", "ygo"); addProperty("name", " Blue-Eyes "); addProperty("format", "ocg") })
        assertTrue(r.objs("toasts").any { it.s("text") == "Deck created. Add cards with the search box." })
        m = made(r); assertEquals("tdeck", m.s("go"))
        deck = saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks").single { it.s("id") == m.s("id") }
        assertEquals("Blue-Eyes", deck.s("name")); assertEquals("ocg", deck.s("format"))
        assertEquals(0, deck.getAsJsonObject("zones").objs("main").size)
    }

    @Test fun pokemonImportAndNew() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle); DecksIdeasTest.yugioh()
        val imp = CollectionEngine.tDeckImportSheet("ptcg")
        assertTrue(imp.s("hint").startsWith("Paste a Pokémon TCG Live list (“4 Pikachu ex SVI 63”)"))
        assertEquals("Pokémon: 12\n4 Pikachu ex SVI 63\n…", imp.s("placeholder"))
        assertEquals(listOf("Standard", "Expanded", "Unlimited", "Gym Leader Challenge"), imp.getAsJsonObject("format").pairs("options").map { it.second })
        keep("ptcg-import", imp)
        // Nothing pasted: the site's words in #tImpStatus, nothing saved.
        val rE = CollectionEngine.act("tImpDeck", JsonObject().apply { addProperty("game", "ptcg"); addProperty("text", ""); addProperty("name", "Imported deck"); addProperty("format", "standard") }, 30_000)
        assertEquals("Paste a list first.", rE.getAsJsonObject("texts").s("#tImpStatus"))
        assertEquals(0, rE["writes"].asInt)
        keep("ptcg-import-error", imp, JsonObject().apply { addProperty("status", "Paste a list first.") })
        // A TCGdex id from the cache.
        val r0 = CollectionEngine.act("tImpDeck", JsonObject().apply { addProperty("game", "ptcg"); addProperty("text", "Pokémon: 4\n4 sv08-057"); addProperty("name", "Sparks"); addProperty("format", "standard") }, 30_000)
        val m0 = made(r0)
        val d0 = saved().getAsJsonObject("tcg").getAsJsonObject("ptcg").objs("decks").single { it.s("id") == m0.s("id") }
        assertEquals(listOf("sv08-057" to 4), d0.getAsJsonObject("zones").objs("main").map { it.s("cardId") to it["qty"].asInt })

        // From the head (the first format) and from Meta decks' Create a Gym Leader Challenge deck.
        val head = CollectionEngine.tNewDeckSheet("ptcg")
        assertEquals("standard", head.getAsJsonObject("format").s("selected"))
        keep("ptcg-new", head)
        val nd = CollectionEngine.tNewDeckSheet("ptcg", "glc")
        assertEquals("New Pokémon deck", nd.s("title"))
        assertEquals("glc", nd.getAsJsonObject("format").s("selected"))
        keep("ptcg-create-glc", nd)
        val r = CollectionEngine.act("tNewDeckSave", JsonObject().apply { addProperty("game", "ptcg"); addProperty("name", ""); addProperty("format", "expanded") })
        val m = made(r); assertEquals("ptcg", m.s("game"))
        val deck = saved().getAsJsonObject("tcg").getAsJsonObject("ptcg").objs("decks").single { it.s("id") == m.s("id") }
        assertEquals("New deck", deck.s("name")); assertEquals("expanded", deck.s("format"))
    }

    @Test fun magicReview() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle); magic()
        // The Commander deck: Counterspell outside Krenko's colours, Sol Ring and the rest of the count.
        val c = CollectionEngine.deckReview("d1")
        assertEquals("Deck review", c.s("title")); assertEquals("Close", c.s("close"))
        val intro = c.objs("intro")
        assertTrue(intro.first().s("text").matches(Regex("\\d+ things? worth a look in Goblin Horde\\. ")))
        assertEquals(listOf("bad", "warn"), intro.filter { it.s("tone").isNotEmpty() }.map { it.s("tone") })
        val items = c.objs("items")
        assertEquals("bad", items.first().s("level"))
        val color = items.single { it.s("title") == "1 card is outside your commander’s colors" }
        assertEquals("Rule", color.s("chip")); assertEquals("Every card must fit the commander’s color identity.", color.s("detail"))
        assertEquals(listOf("Counterspell"), color.getAsJsonArray("cards").map { it.asString })
        assertEquals("Review cards →", color.getAsJsonObject("action").s("label")); assertEquals("deckTab", color.getAsJsonObject("action").s("act"))
        val count = items.single { it.s("title") == "3/100 cards" }
        assertEquals("warn", count.s("level")); assertEquals("Check", count.s("chip"))
        assertEquals("Fill 97 slots →", count.getAsJsonObject("action").s("label")); assertEquals("upgrade", count.getAsJsonObject("action").s("id"))
        assertEquals("Refresh before an event. Guidelines are rules of thumb, not requirements.", c.s("foot"))
        assertNull(c.get("empty")?.takeIf { it.isJsonObject })
        keep("mtg-review", c)

        // The Modern deck: The One Ring and Sol Ring aren't legal; 24 of 60, so Find Modern cards (A.formatSearch).
        val mo = CollectionEngine.deckReview("d2")
        val legal = mo.objs("items").single { it.s("title") == "2 cards aren’t legal in Modern" }
        assertEquals(setOf("The One Ring", "Sol Ring"), legal.getAsJsonArray("cards").map { it.asString }.toSet())
        val short = mo.objs("items").single { it.s("title") == "24 cards — Modern needs 60+" }
        assertEquals("formatSearch", short.getAsJsonObject("action").s("act")); assertEquals("Find Modern cards →", short.getAsJsonObject("action").s("label"))
        keep("mtg-review-modern", mo)
        val fs = CollectionEngine.reviewSearch("formatSearch", "d2")
        assertEquals("modern", fs.getAsJsonObject("filters").s("format"))
        // A.findRole: Krenko's colours, the format filter Commander.
        val fr = CollectionEngine.reviewSearch("findRole", "d1", "Draw")
        assertEquals("(o:\"draw a card\" or o:\"draw two\" or o:\"draws a card\") -t:land id<=r", fr.s("term"))
        assertEquals("commander", fr.getAsJsonObject("filters").s("format"))
        // The Search tab opens on that search.
        val page = CollectionEngine.search("mtg")
        assertTrue(page.toString().contains("id<=r"))

        // Nothing to review: the empty state.
        CollectionEngine.load(JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":[],"decks":[{"id":"e1","name":"Bolts","format":"Limited (40-card)","commander":"","cards":[{"name":"Swamp","qty":17},{"name":"Lightning Bolt","qty":23}]}]}""").asJsonObject, null)
        val e = CollectionEngine.deckReview("e1")
        if (e.objs("items").isEmpty()) {
            assertEquals("Nothing to review", e.getAsJsonObject("empty").s("title"))
            keep("mtg-review-empty", e)
        }
        assertTrue(CollectionEngine.deckReview("gone").has("missing"))
    }

    @Test fun savedDecksAndWarChest() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle); magic()
        CollectionEngine.decksPanel("mtg", "inspiration"); CollectionEngine.settle(3_000)
        var body = panel().getAsJsonObject("body")
        val card = all(body) { act(it) == "exportRef" }.single()
        assertEquals("r1", attr(card, "data-id"))
        // Export: the app is handed it (acted), and the site's file.
        val tapped = CollectionEngine.panelTap(card["i"].asInt)
        assertEquals("exportRef", tapped.getAsJsonObject("acted").s("act"))
        val ex = CollectionEngine.act("exportRef", JsonObject().apply { addProperty("id", "r1") })
        val file = ex.getAsJsonObject("downloaded")
        assertEquals("CardStashy_Krenko_Tokens.txt", file.s("name"))
        assertTrue(file.s("text").contains("1 Goblin Instigator"))
        // Remove: asked first; yes removes it.
        var r = CollectionEngine.act("deleteRef", JsonObject().apply { addProperty("id", "r1") })
        assertEquals("Remove this saved idea?", r.s("ask")); assertEquals(0, r["writes"].asInt)
        keep("mtg-delete-ask", r)
        r = CollectionEngine.act("deleteRef", JsonObject().apply { addProperty("id", "r1"); addProperty("confirmed", true) })
        assertEquals(1, r["writes"].asInt)
        assertTrue(saved().objs("references").isEmpty())
        // Save a deck idea: to the app (its import sheet with the library destination).
        CollectionEngine.panelRedraw()
        body = panel().getAsJsonObject("body")
        assertEquals("importReference", CollectionEngine.panelTap(all(body) { act(it) == "importReference" }.first()["i"].asInt).getAsJsonObject("acted").s("act"))
        val lib = CollectionEngine.deckImport(JsonObject().apply { addProperty("destination", "library"); addProperty("kind", "Community deck") })
        assertEquals("Save a deck idea", lib.s("title"))
        assertEquals("library", lib.getAsJsonObject("dest").s("selected"))
        keep("mtg-save-idea", lib)
        // Precons: the list as loaded, searched (I.preconSearch fills #preconList).
        body = panel().getAsJsonObject("body")
        assertTrue(words(body).contains("Load precon list"))
        val head = CollectionEngine.decks("mtg", JsonObject().apply { addProperty("tab", "inspiration") })
        try {
            // MTGJSON unreachable: the site's message.
            CollectionEngine.answerForTest = { u -> if (u.contains("mtgjson.com")) 503 to "" else null }
            CollectionEngine.panelTap(all(body) { act(it) == "loadPrecons" }.single()["i"].asInt); CollectionEngine.settle(5_000)
            var pm = panel(); body = pm.getAsJsonObject("body")
            assertTrue(words(body), words(body).contains("Couldn’t reach MTGJSON ("))
            assertTrue(words(body).contains("You can still upload a precon’s .json or text list with “Save a deck idea”."))
            keep("mtg-precons-error", pm, JsonObject().apply { add("head", head) })
            // The list (two Commander decks and a set's starter), then searched, then a Preview.
            val index = """{"data":[{"fileName":"KrenkoMob_C99","name":"Krenko's Mob","code":"C99","type":"Commander Deck","releaseDate":"2099-01-01"},
              {"fileName":"GoblinRally_C98","name":"Goblin Rally","code":"C98","type":"Commander Deck","releaseDate":"2098-01-01"},
              {"fileName":"Starter_S97","name":"Starter Kit","code":"S97","type":"Starter Kit","releaseDate":"2097-01-01"}]}"""
            val deck = """{"data":{"name":"Krenko's Mob","commander":[{"name":"Krenko, Mob Boss","count":1}],"mainBoard":[{"name":"Goblin Instigator","count":1},{"name":"Sol Ring","count":1},{"name":"Swamp","count":30}]}}"""
            CollectionEngine.answerForTest = { u -> when { u.endsWith("/DeckList.json") -> 200 to index; u.contains("mtgjson.com/api/v5/decks/") -> 200 to deck; else -> null } }
            CollectionEngine.panelTap(all(body) { act(it) == "loadPrecons" }.single()["i"].asInt); CollectionEngine.settle(5_000)
            pm = panel(); body = pm.getAsJsonObject("body")
            assertTrue(words(body), words(body).contains("3 products. Search by the name on the box."))
            assertEquals(listOf("KrenkoMob_C99", "GoblinRally_C98"), all(body) { act(it) == "previewPrecon" }.map { attr(it, "data-file") })
            keep("mtg-precons", pm, JsonObject().apply { add("head", head) })
            val box = all(body) { attr(it, "data-input") == "preconSearch" }.single()
            CollectionEngine.panelType(box["i"].asInt, "krenko")
            pm = panel(); body = pm.getAsJsonObject("body")
            assertEquals(listOf("KrenkoMob_C99"), all(body) { act(it) == "previewPrecon" }.map { attr(it, "data-file") })
            keep("mtg-precons-search", pm, JsonObject().apply { add("head", head) })
            // Preview: "Loading decklist…", then the import sheet's preset (the library destination, credited to MTGJSON).
            val tap = CollectionEngine.panelTap(all(body) { act(it) == "previewPrecon" }.single()["i"].asInt)
            assertTrue(tap.toString(), tap.getAsJsonArray("toasts").any { it.asString == "Loading decklist…" })
            CollectionEngine.settle(5_000)
            val acted = panel().getAsJsonObject("acted")
            assertEquals("previewPrecon", acted.s("act"))
            val preset = JsonParser.parseString(acted.getAsJsonObject("data").s("preset")).asJsonObject
            assertEquals("Krenko's Mob", preset.s("name")); assertEquals("Krenko, Mob Boss", preset.s("commander")); assertEquals("MTGJSON precon", preset.s("kind"))
            assertEquals("library", preset.s("destination"))
            val pre = CollectionEngine.deckImport(preset)
            keep("mtg-precon-preview", pre)
        } finally { CollectionEngine.answerForTest = null }

        // The War Chest window over the tab: Dice & coin rolls in it, Game Night goes to the app, and the tab comes back.
        var chest = CollectionEngine.warChest("mtg")
        var cb = chest.getAsJsonObject("body")
        assertTrue(words(cb).contains("The War Chest"))
        val tools = all(cb) { act(it) == "chestTool" }.map { attr(it, "data-tool") }
        assertEquals(listOf("gameNight", "share", "dice", "judge", "spirit", "lookup"), tools)
        keep("war-chest", chest)
        chest = CollectionEngine.panelTap(all(cb) { attr(it, "data-tool") == "dice" }.single()["i"].asInt)
        cb = chest.getAsJsonObject("body")
        assertTrue(words(all(cb) { cls(it).contains("wc-result") }.single()).matches(Regex("d6 rolled \\d · d20 rolled \\d+ · coin: (heads|tails)")))
        keep("war-chest-dice", chest)
        val night = CollectionEngine.panelTap(all(cb) { attr(it, "data-tool") == "gameNight" }.single()["i"].asInt)
        assertEquals("gameNight", night.getAsJsonObject("acted").getAsJsonObject("data").s("tool"))
        val back = CollectionEngine.warChestClose()
        assertTrue(back.s("key").startsWith("decks|mtg|inspiration"))
        assertFalse(words(back.getAsJsonObject("body")).contains("The War Chest"))
    }
}
