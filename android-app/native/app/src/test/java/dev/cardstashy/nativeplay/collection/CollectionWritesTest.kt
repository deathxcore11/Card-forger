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
}
