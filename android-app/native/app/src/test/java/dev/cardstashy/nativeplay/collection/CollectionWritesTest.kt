package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * The site's saving taps (app.js commit and its handlers) in QuickJS, against the account-write fixtures the site's own modules
 * produced (test resources account-writes/, written in Node from store.js, quick-quantity.js and sync-merge.js).
 */
class CollectionWritesTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private fun fx(name: String) = JsonParser.parseString(javaClass.getResource("/account-writes/$name")!!.readText()).asJsonObject

    /** What the fixtures leave out: the save time (the real clock), the value history (the fixtures ran before an account reconcile). */
    private fun clean(o: JsonElement): JsonObject = o.deepCopy().asJsonObject.apply {
        remove("lastSavedAt"); remove("valueHistory")
        getAsJsonObject("tcg")?.entrySet()?.forEach { (_, side) -> (side as? JsonObject)?.remove("valueHistory") }
    }
    /** The ids and times the site makes with uid() and the clock, pinned in the fixture. */
    private fun pin(o: JsonObject, id: String, at: String) = o.apply {
        getAsJsonArray("wishlist")?.forEach { w -> val x = w.asJsonObject; if (x["addedAt"]?.asString?.startsWith("20") == true && x["id"].asString.let { it != "w1" && !it.startsWith("fx-") }) { x.addProperty("id", id); x.addProperty("addedAt", at) } }
    }

    @Test fun siteFixtures() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        for (file in listOf("wishlist-toggle-add.json", "wishlist-toggle-remove.json", "qty-plus.json", "qty-minus.json", "qty-minus-to-zero-removes-lot.json")) {
            val f = fx(file)
            CollectionEngine.load(f["before"].asJsonObject, null)
            val kind = f["handler"].asString.removePrefix("A.").substringBefore(" ")
            val r = CollectionEngine.act(kind, f["dataset"].asJsonObject)
            println("$file $kind -> $r")
            assertTrue(r.toString(), r["error"] == null)
            assertEquals(file, 1, r["writes"].asInt)
            val said = f["toast"]?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            val after = pin(clean(JsonParser.parseString(CollectionEngine.saved())), "fx-w-new", f["clock"].asString)
            assertEquals(file, clean(f["after"]), after)
            if (said.isEmpty()) { assertEquals(file, 0, r.getAsJsonArray("toasts").size()); continue }
            val t = r.getAsJsonArray("toasts")[0].asJsonObject
            assertEquals(file, said, t["text"].asString)
            assertEquals(file, f["toastHasUndo"].asBoolean, t["undo"].asBoolean)
            // app.js A.undo: the state before comes back.
            val u = CollectionEngine.undo()
            assertEquals(1, u["writes"].asInt)
            assertEquals("Undone: ${f["toast"].asString.removeSuffix(".")}.", u.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
            assertEquals(file, clean(f["before"]), clean(JsonParser.parseString(CollectionEngine.saved())))
            assertEquals("Nothing to undo.", CollectionEngine.undo().getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        }
    }

    /** app.js A.qty: the Cards tab's − on the last copy asks first, and only a yes removes the lot. */
    @Test fun removeAsksFirst() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val f = fx("qty-minus-to-zero-removes-lot.json")
        CollectionEngine.load(f["before"].asJsonObject, null)
        val d = JsonObject().apply { addProperty("id", "l1"); addProperty("delta", "-1") }
        val first = CollectionEngine.act("qty", d)
        assertEquals("Remove Lightning Bolt from your collection?", first["ask"].asString)
        assertEquals(0, first["writes"].asInt)
        assertEquals(clean(f["before"]), clean(JsonParser.parseString(CollectionEngine.saved())))
        val yes = CollectionEngine.act("qty", d.deepCopy().apply { addProperty("confirmed", true) })
        assertEquals(1, yes["writes"].asInt)
        assertEquals("−1 Lightning Bolt", yes.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertEquals(clean(f["after"]), clean(JsonParser.parseString(CollectionEngine.saved())))
        // A + never asks.
        CollectionEngine.load(f["before"].asJsonObject, null)
        val plus = CollectionEngine.act("qty", JsonObject().apply { addProperty("id", "l1"); addProperty("delta", "1") })
        assertEquals("", plus["ask"].asString); assertEquals(1, plus["writes"].asInt); assertEquals(0, plus.getAsJsonArray("toasts").size())
        // The wanted card's ×.
        val w = JsonParser.parseString(f["before"].toString()).asJsonObject.apply { add("wishlist", JsonParser.parseString("""[{"id":"w9","name":"Sol Ring","finish":"nonfoil","qty":1}]""")) }
        CollectionEngine.load(w, null)
        assertEquals(1, CollectionEngine.act("wishRemove", JsonObject().apply { addProperty("id", "w9") })["writes"].asInt)
        assertEquals(0, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("wishlist").size())
    }

    /** A Yu-Gi-Oh! card's wishlist and owned copies, by card id, into tcg.ygo; the player's own settings.game is what is saved. */
    @Test fun tcgWrites() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val before = fx("qty-plus.json")["before"].asJsonObject.deepCopy().apply {
            getAsJsonObject("settings").addProperty("game", "mtg")
            getAsJsonObject("tcg").getAsJsonObject("ygo").add("collection", JsonParser.parseString("""[{"id":"y1","cardId":"89631139","name":"Blue-Eyes White Dragon","qty":2,"printing":"LOB-001","condition":"Near Mint","language":"en","location":""}]"""))
        }
        CollectionEngine.load(before, null)
        val add = CollectionEngine.act("cardWishlist", JsonObject().apply { addProperty("game", "ygo"); addProperty("id", "46986414"); addProperty("name", "Dark Magician") })
        assertEquals(1, add["writes"].asInt)
        var ws = JsonParser.parseString(CollectionEngine.saved()).asJsonObject
        val wish = ws.getAsJsonObject("tcg").getAsJsonObject("ygo").getAsJsonArray("wishlist")
        assertEquals(1, wish.size()); assertEquals("46986414", wish[0].asJsonObject["cardId"].asString); assertEquals("Dark Magician", wish[0].asJsonObject["name"].asString)
        assertEquals(0, ws.getAsJsonArray("wishlist").size())
        // tcg.js A.tEntryQty, the site's own handler: one fewer copy, with its undo toast.
        val minus = CollectionEngine.act("tEntryQty", JsonObject().apply { addProperty("game", "ygo"); addProperty("id", "y1"); addProperty("delta", "-1") })
        println("tEntryQty -> $minus")
        assertEquals(1, minus["writes"].asInt)
        assertEquals("−1 Blue-Eyes White Dragon", minus.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        ws = JsonParser.parseString(CollectionEngine.saved()).asJsonObject
        assertEquals(1, ws.getAsJsonObject("tcg").getAsJsonObject("ygo").getAsJsonArray("collection")[0].asJsonObject["qty"].asInt)
        // The page borrowed settings.game for Yu-Gi-Oh!; the account keeps the player's Magic.
        assertEquals("mtg", ws.getAsJsonObject("settings")["game"].asString)
        // The card page's owned − on the last copy (app.js cardOwnedQty: no question) removes the lot.
        val last = CollectionEngine.act("cardOwnedQty", JsonObject().apply { addProperty("game", "ygo"); addProperty("lot", "y1"); addProperty("delta", "-1") })
        assertEquals(1, last["writes"].asInt)
        assertEquals(0, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonObject("tcg").getAsJsonObject("ygo").getAsJsonArray("collection").size())
    }

    /** app.js's deck edits against the site's fixtures (A.deckQty, A.addToDeck, A.deckAdd), then the commander guard, Remove and a swap. */
    @Test fun deckEdits() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        suspend fun site(file: String, kind: String, data: JsonObject, catalog: String? = null) {
            val f = fx(file)
            CollectionEngine.load(f["before"].asJsonObject, catalog)
            val r = CollectionEngine.act(kind, data)
            println("$file $kind -> $r")
            assertTrue(r.toString(), r["error"] == null)
            assertEquals(file, 1, r["writes"].asInt)
            // app.js commit's recordHomeDeckWork marks the deck as worked on (Home's deck shelf); the fixtures were written without it.
            val after = clean(JsonParser.parseString(CollectionEngine.saved()))
            assertEquals(file, "d1", after.getAsJsonObject("homeDeckActivity").getAsJsonArray("mtg")[0].asJsonObject["id"].asString)
            after.remove("homeDeckActivity")
            assertEquals(file, clean(f["after"]), after)
            val t = r.getAsJsonArray("toasts")[0].asJsonObject
            assertEquals(file, f["toast"].asString, t["text"].asString)
            assertEquals(file, f["toastHasUndo"]?.asBoolean ?: false, t["undo"].asBoolean)
        }
        site("deck-qty-minus.json", "deckQty", fx("deck-qty-minus.json")["dataset"].asJsonObject.deepCopy().apply { addProperty("deck", "d1") })
        site("deck-add-card.json", "addToDeck", fx("deck-add-card.json")["dataset"].asJsonObject)
        // The typed name is looked up (app.js resolve): a card already in the catalog is used as it is.
        site("deck-add-existing-card-increments.json", "deckAdd", JsonObject().apply { addProperty("deck", "d1"); addProperty("name", "lightning bolt") },
            """{"lightning bolt":{"id":"bolt","name":"Lightning Bolt","type_line":"Instant"}}""")

        val before = fx("deck-qty-minus.json")["before"].asJsonObject.deepCopy().apply {
            add("decks", JsonParser.parseString("""[{"id":"c1","name":"Goblins","format":"Commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Goblin Matron","qty":1},{"name":"Mountain","qty":30}]}]"""))
        }
        CollectionEngine.load(before, null)
        suspend fun cards() = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("decks")[0].asJsonObject.getAsJsonArray("cards").toString()
        // The commander's last copy stays, with the site's word.
        val cmd = CollectionEngine.act("deckQty", JsonObject().apply { addProperty("deck", "c1"); addProperty("name", "Krenko, Mob Boss"); addProperty("delta", "-1") })
        assertEquals(0, cmd["writes"].asInt); assertEquals("That’s your commander.", cmd.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        // A + has no toast; the last copy of any other card goes.
        val plus = CollectionEngine.act("deckQty", JsonObject().apply { addProperty("deck", "c1"); addProperty("name", "Mountain"); addProperty("delta", "1") })
        assertEquals(1, plus["writes"].asInt); assertEquals(0, plus.getAsJsonArray("toasts").size())
        val rm = CollectionEngine.act("deckRemove", JsonObject().apply { addProperty("deck", "c1"); addProperty("name", "Goblin Matron") })
        assertEquals("Removed Goblin Matron.", rm.getAsJsonArray("toasts")[0].asJsonObject["text"].asString); assertTrue(rm.getAsJsonArray("toasts")[0].asJsonObject["undo"].asBoolean)
        assertEquals("""[{"name":"Krenko, Mob Boss","qty":1},{"name":"Mountain","qty":31}]""", cards())
        val swap = CollectionEngine.act("deckEmbSwap", JsonObject().apply { addProperty("deck", "c1"); addProperty("out", "Mountain"); addProperty("in", "Sol Ring") })
        assertEquals("Swapped Mountain for Sol Ring.", swap.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertEquals("""[{"name":"Krenko, Mob Boss","qty":1},{"name":"Mountain","qty":30},{"name":"Sol Ring","qty":1}]""", cards())
        // Undo puts the swap back.
        CollectionEngine.undo()
        assertEquals("""[{"name":"Krenko, Mob Boss","qty":1},{"name":"Mountain","qty":31}]""", cards())
        // A deck that went away: the site's words.
        val gone = CollectionEngine.act("deckRemove", JsonObject().apply { addProperty("deck", "nope"); addProperty("name", "Mountain") })
        assertEquals("This deck is no longer available.", gone["error"].asString); assertEquals(0, gone["writes"].asInt)
    }

    /** app.js A.deckMenu's sheet and its saving actions: Edit deck, Assembled, Save a version, Duplicate, Delete (asked first). */
    @Test fun deckMenu() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val before = fx("deck-qty-minus.json")["before"].asJsonObject.deepCopy().apply {
            add("decks", JsonParser.parseString("""[{"id":"c1","name":"Goblins","format":"Commander","commander":"Krenko, Mob Boss","budget":25,"cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Mountain","qty":30}],"source":{"kind":"User export","website":"Local export"}}]"""))
        }
        CollectionEngine.load(before, """{"mountain":{"id":"m","name":"Mountain","image_uris":{"normal":"https://cards.scryfall.io/normal/front/m.jpg"}}}""")
        val m = CollectionEngine.deckMenu("c1")
        println("MENU $m")
        assertEquals("Magic deck", m["head"].asJsonObject["kind"].asString)
        assertEquals("Commander · 31 cards", m["head"].asJsonObject["meta"].asString)
        assertEquals(listOf("Cards", "Power", "Matchups", "Playtest"), m["shortcuts"].asJsonArray.map { it.asJsonObject["label"].asString })
        assertEquals(listOf("cards", "engine", "matchups", "playtest"), m["shortcuts"].asJsonArray.map { it.asJsonObject["tab"].asString })
        val e = m["edit"].asJsonObject
        assertEquals("Edit deck", e["title"].asString); assertEquals("Name, format, budget & appearance", e["hint"].asString)
        assertEquals(listOf("Name", "Format", "Budget $", "Focus"), e["labels"].asJsonArray.map { it.asString })
        assertEquals("Commander", e["format"].asString); assertEquals("25", e["budget"].asString)
        assertEquals(listOf("Constructed", "Commander", "Arena", "Casual"), e["formats"].asJsonArray.map { it.asJsonObject["group"].asString })
        assertEquals("#7664a0", e["box"].asJsonObject["color"].asString)
        assertEquals(listOf("Share deck", "Copy decklist", "Export decklist", "Copy to Play"), m["groups"].asJsonArray[0].asJsonObject["actions"].asJsonArray.map { it.asJsonObject["label"].asString })
        assertEquals(listOf("Save a version", "Duplicate deck", "Refresh cards & prices"), m["groups"].asJsonArray[1].asJsonObject["actions"].asJsonArray.map { it.asJsonObject["label"].asString })
        assertEquals("Assembled", m["tools"].asJsonObject["lock"].asJsonObject["title"].asString)
        assertEquals("Delete deck", m["danger"].asJsonArray[0].asJsonObject["label"].asString)
        assertEquals("Source: User export · Local export", m["source"].asJsonObject["text"].asString)
        assertEquals("Version 1", m["version"].asString)
        assertEquals("1 Krenko, Mob Boss\n30 Mountain", CollectionEngine.deckText("c1")["text"].asString)
        assertEquals("CardStashy_Goblins.txt", CollectionEngine.deckText("c1")["file"].asString)

        suspend fun deck() = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("decks").map { it.asJsonObject }
        val save = CollectionEngine.act("deckSaveInfo", JsonObject().apply { addProperty("deck", "c1"); addProperty("name", "Goblin Horde"); addProperty("format", "Modern"); addProperty("budget", "40"); addProperty("strategy", "Tokens"); addProperty("color", "#aa3300"); addProperty("image", "") })
        assertEquals("Saved.", save.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        deck()[0].let { assertEquals("Goblin Horde", it["name"].asString); assertEquals("Modern", it["format"].asString); assertEquals(40, it["budget"].asInt); assertEquals("", it["commander"].asString)
            assertEquals("#aa3300", it["boxAppearance"].asJsonObject["color"].asString) }
        assertEquals("Copies reserved for this deck.", CollectionEngine.act("deckLock", JsonObject().apply { addProperty("deck", "c1"); addProperty("checked", true) }).getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertTrue(deck()[0]["locked"].asBoolean)
        assertEquals("Version saved.", CollectionEngine.act("snapshot", JsonObject().apply { addProperty("deck", "c1"); addProperty("label", "Before the swap") }).getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertEquals("No changes since the last version.", CollectionEngine.act("snapshot", JsonObject().apply { addProperty("deck", "c1"); addProperty("label", "Again") }).getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertEquals("Before the swap", deck()[0].getAsJsonArray("versions")[0].asJsonObject["label"].asString)
        val dup = CollectionEngine.act("deckDup", JsonObject().apply { addProperty("deck", "c1") })
        assertEquals("Duplicated.", dup.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        val copy = dup["made"].asString
        deck().let { assertEquals(2, it.size); assertEquals("Goblin Horde (copy)", it[1]["name"].asString); assertEquals(copy, it[1]["id"].asString); assertEquals(false, it[1]["locked"].asBoolean) }
        assertEquals(copy, JsonParser.parseString(CollectionEngine.saved()).asJsonObject["activeDeck"].asString)
        val del = CollectionEngine.act("deckDelete", JsonObject().apply { addProperty("deck", copy) })
        assertEquals("Delete Goblin Horde (copy)? Your collection is not affected.", del["ask"].asString); assertEquals(0, del["writes"].asInt)
        val yes = CollectionEngine.act("deckDelete", JsonObject().apply { addProperty("deck", copy); addProperty("confirmed", true) })
        assertEquals("Deleted Goblin Horde (copy).", yes.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        deck().let { assertEquals(1, it.size); assertEquals("c1", JsonParser.parseString(CollectionEngine.saved()).asJsonObject["activeDeck"].asString) }
    }

    /**
     * Build a deck's Save deck (app.js deckExperience save): the result named after its card and format, its first version
     * "Generated", the budget it was built for, added to My decks with "Saved to My decks."; the workspace the WebView reads.
     */
    @Test fun generatedDeckSaves() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val before = fx("deck-qty-minus.json")["before"].asJsonObject
        CollectionEngine.load(before, null)
        val ws = JsonParser.parseString(CollectionEngine.flowWorkspace()).asJsonObject
        assertEquals(setOf("collection", "decks", "myPrices", "priceChoices", "settings"), ws.keySet())
        assertEquals(before.getAsJsonArray("decks").size(), ws.getAsJsonArray("decks").size())
        val n = ws.getAsJsonArray("decks").size()
        val data = JsonParser.parseString("""{"deck":{"name":"Elder Owyn Lyons","format":"Commander","commander":"Elder Owyn Lyons","buildAround":"Elder Owyn Lyons",
            "cards":[{"name":"Elder Owyn Lyons","qty":1,"zone":"main"},{"name":"Island","qty":99,"zone":"main"}]},
            "request":{"game":"mtg","format":"Commander","formatName":"Commander","budget":150,"seedCard":{"name":"Elder Owyn Lyons"}}}""").asJsonObject
        val r = CollectionEngine.act("deckGenerated", data)
        assertEquals("Saved to My decks.", r.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertEquals(1, r["writes"].asInt)
        val decks = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("decks").map { it.asJsonObject }
        assertEquals(n + 1, decks.size)
        decks.last().let { d ->
            assertEquals("Elder Owyn Lyons · Commander", d["name"].asString)
            assertEquals(r["made"].asString, d["id"].asString)
            assertEquals(150, d["budget"].asInt)
            assertEquals("Generated", d.getAsJsonArray("versions")[0].asJsonObject["label"].asString)
            assertEquals(100, d.getAsJsonArray("cards").sumOf { it.asJsonObject["qty"].asInt })
        }
    }

    /** cloud.js's automatic account-first merge (sync-merge.js), as the site's fixtures resolve it. */
    @Test fun mergeFixtures() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        for (file in listOf("sync-conflict-merge.json", "sync-merge-no-conflict.json")) {
            val f = fx(file)
            CollectionEngine.load(f["local"].asJsonObject, null)
            val r = CollectionEngine.mergeIn(f["baseline"].toString(), f["remote"].toString())
            println("$file -> $r")
            assertEquals(file, f["conflicts"].asJsonArray, r.getAsJsonArray("conflicts"))
            assertEquals(file, f["toast"].asString, r["notice"].asString)
            assertEquals(file, clean(f["mergedState"]), clean(JsonParser.parseString(CollectionEngine.saved())))
        }
    }

    /** cloud.js's push check: the fingerprint ignores the save time and the open game, and a cleared workspace says so. */
    @Test fun syncInfo() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val f = fx("qty-plus.json")
        CollectionEngine.load(f["before"].asJsonObject, null)
        val a = CollectionEngine.syncInfo()
        assertEquals(false, a["empty"].asBoolean)
        assertEquals(a["sig"].asString, CollectionEngine.sigOf(f["before"].asJsonObject.deepCopy().apply { addProperty("lastSavedAt", "2030-01-01T00:00:00.000Z") }.toString()))
        CollectionEngine.act("cardOwnedQty", f["dataset"].asJsonObject)
        assertTrue(CollectionEngine.syncInfo()["sig"].asString != a["sig"].asString)
        CollectionEngine.load(JsonObject(), null)
        assertEquals(true, CollectionEngine.syncInfo()["empty"].asBoolean)
    }

    /** After the account's copy is read, a change to the owned cards records today's value (app.js trackValue), once every card's data is here. */
    @Test fun valueObservation() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val f = fx("qty-plus.json")
        // No card data yet: no observation (a partial total would be a false dip).
        CollectionEngine.load(f["before"].asJsonObject, null)
        CollectionEngine.act("cardOwnedQty", f["dataset"].asJsonObject)
        assertEquals(0, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("valueHistory").size())
        val catalog = """{"lightning bolt":{"name":"Lightning Bolt","prices":{"usd":"1.50"}},"island":{"name":"Island","prices":{"usd":"0.10"}}}"""
        CollectionEngine.load(f["before"].asJsonObject, catalog)
        CollectionEngine.act("cardOwnedQty", f["dataset"].asJsonObject)
        val vh = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("valueHistory")
        println("VALUE $vh")
        assertEquals(1, vh.size())
        assertEquals(java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString(), vh[0].asJsonObject["date"].asString)
        assertEquals(13, vh[0].asJsonObject["copies"].asInt)
        // A wishlist change is not a price event.
        CollectionEngine.load(f["before"].asJsonObject, catalog)
        CollectionEngine.act("cardWishlist", JsonObject().apply { addProperty("game", "mtg"); addProperty("name", "Sol Ring"); addProperty("id", "") })
        assertEquals(0, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("valueHistory").size())
    }

    /** app.js addSheet and saveLot: Save without lookup adds the lot, the edit sheet's save changes it (the site's fixtures). */
    @Test fun addSheetSaves() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        // The empty sheet (A.addCard): nothing looked up, so only Save without lookup can save.
        val add = fx("add-card-mtg.json")
        CollectionEngine.load(add["before"].asJsonObject, null)
        val m = CollectionEngine.addOpen(JsonObject())
        println("ADD $m")
        assertEquals("Add to collection", m["title"].asString); assertEquals("Add to collection", m["save"].asString)
        assertEquals(false, m["canSave"].asBoolean); assertEquals(false, m["editing"].asBoolean)
        assertEquals("Look up the card, check the picture, then save.", m["empty"].asString)
        assertEquals("1", m["qty"].asString); assertEquals("nonfoil", m["finish"].asString); assertEquals("Near Mint", m["condition"].asString); assertEquals("en", m["language"].asString)
        val loc = m.getAsJsonObject("location")
        assertEquals("Where it lives", loc["label"].asString)
        assertEquals("""[["","Unsorted / no location"],["binder:new","＋ Create a binder…"],["new","＋ Add a new location…"]]""", loc["options"].toString())
        assertEquals("Choose a binder, a saved location, or create one when you save this card.", loc["hint"].asString)
        val form = add["form"].asJsonObject
        val r = CollectionEngine.act("addSave", JsonObject().apply {
            addProperty("name", form["name"].asString); addProperty("qty", form["qty"].asInt.toString()); addProperty("value", "")
            addProperty("set", ""); addProperty("number", ""); addProperty("finish", form["finish"].asString); addProperty("language", form["language"].asString)
            addProperty("condition", form["condition"].asString); addProperty("location", ""); addProperty("picker", ""); addProperty("unverified", true)
        })
        println("ADD SAVE $r")
        assertTrue(r.toString(), r["error"] == null)
        assertEquals(1, r["writes"].asInt)
        assertEquals(add["toast"].asString, r.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        val after = clean(JsonParser.parseString(CollectionEngine.saved()))
        after.getAsJsonArray("collection").forEach { e -> val o = e.asJsonObject; if (o["id"].asString != "l1") o.addProperty("id", "fx-lot-new") }
        assertEquals(clean(add["after"]), after)

        // The edit sheet (A.editLot): the lot's own values, then its save (A.addSave) with what the fixture's form changed.
        val edit = fx("lot-edit.json")
        val catalog = """{"lightning bolt":{"name":"Lightning Bolt","type_line":"Instant","set":"lea","prices":{"usd":"1.50"}}}"""
        CollectionEngine.load(edit["before"].asJsonObject, catalog)
        val e = CollectionEngine.addOpen(JsonObject().apply { addProperty("entry", "l1") })
        println("EDIT $e")
        assertEquals("Edit card", e["title"].asString); assertEquals("Save changes", e["save"].asString); assertEquals(true, e["editing"].asBoolean)
        assertEquals("Lightning Bolt", e["name"].asString); assertEquals("2", e["qty"].asString); assertEquals(true, e["canSave"].asBoolean)
        assertEquals("Reference $1.50 · LEA", e.getAsJsonObject("preview")["line"].asString)
        val ef = edit["form"].asJsonObject
        val s = CollectionEngine.act("addSave", JsonObject().apply {
            addProperty("name", "Lightning Bolt"); addProperty("qty", ef["qty"].asInt.toString()); addProperty("value", ef["manualValue"].asDouble.toString())
            addProperty("set", ""); addProperty("number", ""); addProperty("finish", ef["finish"].asString); addProperty("language", "en")
            addProperty("condition", ef["condition"].asString); addProperty("location", ef["location"].asString); addProperty("picker", "new")
        })
        println("EDIT SAVE $s")
        assertTrue(s.toString(), s["error"] == null)
        assertEquals(edit["toast"].asString, s.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        val lot = clean(JsonParser.parseString(CollectionEngine.saved())).getAsJsonArray("collection")[0].asJsonObject
        // A save after a lookup marks the name as checked (saveLot: e.nameVerified); the fixture's form was saved past it.
        assertEquals(true, lot.remove("nameVerified")?.asBoolean)
        assertEquals(clean(edit["after"]).getAsJsonArray("collection")[0], lot)
        assertEquals(clean(edit["after"])["settings"], clean(JsonParser.parseString(CollectionEngine.saved()))["settings"])
    }

    /** saveLot's own checks, word for word; A.addDelete asks first; A.own fills the sheet with the card. */
    @Test fun addSheetChecksAndDelete() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val edit = fx("lot-edit.json")
        val catalog = """{"lightning bolt":{"name":"Lightning Bolt","type_line":"Instant","set":"lea","prices":{"usd":"1.50"}}}"""
        CollectionEngine.load(edit["before"].asJsonObject, catalog)
        CollectionEngine.addOpen(JsonObject())
        suspend fun save(vararg kv: Pair<String, String>) = CollectionEngine.act("addSave", JsonObject().apply { addProperty("unverified", true); kv.forEach { (k, v) -> addProperty(k, v) } })
        assertEquals("Look up or type a card name first.", save("name" to " ", "qty" to "1")["error"].asString)
        assertEquals("Copies must be a whole number from 1 to 100000.", save("name" to "Sol Ring", "qty" to "0")["error"].asString)
        assertEquals("Copies must be a whole number from 1 to 100000.", save("name" to "Sol Ring", "qty" to "1.5")["error"].asString)
        assertEquals("Enter a non-negative value or leave it blank.", save("name" to "Sol Ring", "qty" to "1", "value" to "-1")["error"].asString)
        assertEquals(clean(edit["before"]), clean(JsonParser.parseString(CollectionEngine.saved())))
        // Got it (A.own): the card, looked up already, one copy.
        val own = CollectionEngine.addOpen(JsonObject().apply { addProperty("own", "Lightning Bolt") })
        assertEquals("Lightning Bolt", own["name"].asString); assertEquals(true, own["canSave"].asBoolean); assertEquals("1", own["qty"].asString)
        assertEquals("Instant", own.getAsJsonObject("preview")["type"].asString)
        // Delete: asked, then removed on a yes.
        CollectionEngine.addOpen(JsonObject().apply { addProperty("entry", "l1") })
        val q = CollectionEngine.act("addDelete", JsonObject())
        assertEquals("Delete 2× Lightning Bolt from your collection?", q["ask"].asString); assertEquals(0, q["writes"].asInt)
        val yes = CollectionEngine.act("addDelete", JsonObject().apply { addProperty("confirmed", true) })
        assertEquals(1, yes["writes"].asInt)
        assertEquals("Removed from collection.", yes.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        assertEquals(0, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("collection").size())
        // A lot that is gone can't be edited.
        assertEquals("This card is no longer in your collection.", CollectionEngine.addOpen(JsonObject().apply { addProperty("entry", "l1") })["error"].asString)
    }

    /** refreshConditionPrice on the add sheet: the card's reference painted at once, read back block by block. */
    @Test fun addSheetConditionPreview() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val edit = fx("lot-edit.json")
        CollectionEngine.load(edit["before"].asJsonObject, null)
        CollectionEngine.addOpen(JsonObject())
        var painted: JsonObject? = null
        CollectionEngine.addPrice(JsonObject().apply { addProperty("condition", "Near Mint"); addProperty("finish", "nonfoil"); addProperty("language", "en"); addProperty("value", "") }, false) { painted = it }
        println("PRICE $painted")
        val b = painted!!.getAsJsonArray("blocks").map { it.asJsonObject }
        assertEquals("label", b[0]["k"].asString); assertEquals("Near Mint · USD per copy", b[0]["text"].asString)
        assertEquals("state", b[1]["k"].asString); assertEquals("Condition price unavailable", b[1]["text"].asString)
        assertEquals("desc", b[2]["k"].asString)
        assertEquals("No matching quote is available for this condition and version. You can record a per-copy value. This copy is excluded from your total until it has a value.", b[2]["text"].asString)
        // A value of your own: its amount and the dashed Custom pill.
        CollectionEngine.addPrice(JsonObject().apply { addProperty("condition", "Near Mint"); addProperty("finish", "nonfoil"); addProperty("language", "en"); addProperty("value", "2.5") }, false) { painted = it }
        val h = painted!!.getAsJsonArray("blocks").map { it.asJsonObject }.first { it["k"].asString == "hero" }
        assertEquals("$2.50", h["amount"].asString); assertEquals("Custom", h["kind"].asString); assertEquals(true, h["custom"].asBoolean)
    }

    /** app.js importCollectionSheet / drawImport / A.impApply, against what the site showed for the same paste (a Playwright probe). */
    @Test fun importListPreviewAndApply() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val add = fx("add-card-mtg.json")
        CollectionEngine.load(add["before"].asJsonObject.deepCopy().apply { add("collection", JsonArray()) }, null)
        val menu = CollectionEngine.collMenu()
        println("MENU $menu")
        assertEquals("Collection", menu["title"].asString)
        assertEquals(listOf("importCollection", "exportCSV", "retryLookups", "refreshPrices", "verifyAll"), menu.getAsJsonArray("items").map { it.asJsonObject["act"].asString })
        assertEquals(listOf("Import a list or CSV", "Export CSV (ManaBox-style)", "Retry cards that weren’t found", "$ Refresh all prices", "Verify exact printings"),
            menu.getAsJsonArray("items").map { it.asJsonObject["label"].asString })
        val sheet = CollectionEngine.importSheet()
        println("SHEET $sheet")
        assertEquals("Import cards you own", sheet["title"].asString)
        assertEquals("Paste “4 Lightning Bolt” lines, or upload a ManaBox / Moxfield / Deckbox CSV. You’ll review everything before it’s saved.", sheet["hint"].asString)
        assertEquals("My collection import", sheet.getAsJsonObject("source")["value"].asString)
        assertEquals("append", sheet.getAsJsonObject("mode")["selected"].asString)
        assertEquals(listOf("Add to my collection", "Replace earlier import with this name", "Replace entire collection"),
            sheet.getAsJsonObject("mode").getAsJsonArray("options").map { it.asJsonArray[1].asString })
        val raw = "4 Lightning Bolt\n1 Sol Ring (CMM) 400\n2 Counterspell\nbad line ,,,\n"
        val p = CollectionEngine.importPreview(raw, "h1")
        println("PREVIEW $p")
        assertEquals("Import 7 cards", p["applyLabel"].asString)
        val d = p.getAsJsonObject("draft")
        assertEquals(7, d["total"].asInt); assertEquals(3, d["rows"].asInt); assertEquals("1 lines skipped", d["skipped"].asString); assertEquals("text", d["source"].asString)
        val lots = d.getAsJsonArray("lots").map { it.asJsonObject }
        assertEquals(listOf("4× Lightning Bolt", "1× Sol Ring", "2× Counterspell"), lots.map { it["line"].asString })
        assertEquals(listOf("Printing unspecified", "Printing needs verification", "Printing unspecified"), lots.map { it["review"].asString })
        assertEquals("Import 6 cards", CollectionEngine.importUse(1, false)["applyLabel"].asString)
        CollectionEngine.importUse(1, true)
        val r = CollectionEngine.act("impApply", JsonObject().apply { addProperty("mode", "append"); addProperty("source", "My collection import") })
        println("APPLY $r")
        assertEquals("imported", r["made"].asString)
        assertEquals("7 cards imported.", r.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        val coll = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("collection").map { it.asJsonObject }
        assertEquals(mapOf("Lightning Bolt" to 4, "Sol Ring" to 1, "Counterspell" to 2), coll.associate { it["name"].asString to it["qty"].asInt })
        val sol = coll.first { it["name"].asString == "Sol Ring" }
        assertEquals("cmm", sol["set"].asString.lowercase()); assertEquals("400", sol["collectorNumber"].asString)
        // The same attempt again is not added twice (applied: its attemptId is in importHistory).
        CollectionEngine.act("impApply", JsonObject().apply { addProperty("mode", "append"); addProperty("source", "My collection import") })
        assertEquals(3, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("collection").size())
        // Replace entire collection asks first.
        CollectionEngine.importPreview("1 Island\n", "h2")
        val q = CollectionEngine.act("impApply", JsonObject().apply { addProperty("mode", "replace-all"); addProperty("source", "Other") })
        assertEquals("Replace your whole collection? A recovery copy is kept, but export a backup first.", q["ask"].asString); assertEquals(0, q["writes"].asInt)
        CollectionEngine.importClose()
    }

    /** tcg.js A.tImpColl, A.tExportColl and A.tWishCopy (the Yu-Gi-Oh! / Pokémon Cards page's buttons), the site's own handlers. */
    @Test fun tcgListButtons() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val before = fx("qty-plus.json")["before"].asJsonObject.deepCopy().apply {
            getAsJsonObject("settings").addProperty("game", "mtg")
            getAsJsonObject("tcg").getAsJsonObject("ygo").add("collection", JsonParser.parseString("""[{"id":"y1","cardId":"89631139","name":"Blue-Eyes White Dragon","qty":2,"printing":"LOB-001","condition":"Near Mint","language":"en","location":""}]"""))
            getAsJsonObject("tcg").getAsJsonObject("ygo").add("wishlist", JsonParser.parseString("""[{"id":"w9","cardId":"46986414","name":"Dark Magician","qty":3}]"""))
        }
        CollectionEngine.load(before, null)
        val sheet = CollectionEngine.tImportSheet("ygo")
        println("TSHEET $sheet")
        assertEquals(9, sheet["rows"].asInt); assertTrue(sheet["button"].asString.isNotBlank())
        val empty = CollectionEngine.act("tImpColl", JsonObject().apply { addProperty("game", "ygo"); addProperty("text", "") })
        println("TIMP $empty")
        assertEquals("Paste a list first.", empty.getAsJsonObject("texts")["#tImpStatus"].asString)
        assertEquals(0, empty["writes"].asInt); assertTrue(empty["made"]?.asString != "closed")
        val csv = CollectionEngine.act("tExportColl", JsonObject().apply { addProperty("game", "ygo") })
        println("TCSV $csv")
        val file = csv.getAsJsonObject("downloaded")
        assertTrue(file["name"].asString, file["name"].asString.matches(Regex("CardStashy_\\w+_collection\\.csv")))
        val lines = file["text"].asString.trimEnd().lines()
        assertEquals("\"Quantity\",\"Name\",\"Set\",\"Printing\",\"Rarity/Version\",\"Edition\",\"Condition\",\"Price USD\"", lines[0])
        assertTrue(lines[1], lines[1].startsWith("\"2\",\"Blue-Eyes White Dragon\","))
        val copy = CollectionEngine.act("tWishCopy", JsonObject().apply { addProperty("game", "ygo") })
        println("TCOPY $copy")
        assertEquals("3 Dark Magician", copy["copied"].asString)
        assertEquals("Wishlist copied.", copy.getAsJsonArray("toasts")[0].asJsonObject["text"].asString)
        // Nothing the buttons ran changed the account.
        assertEquals(2, JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonObject("tcg").getAsJsonObject("ygo").getAsJsonArray("collection")[0].asJsonObject["qty"].asInt)
    }
}
