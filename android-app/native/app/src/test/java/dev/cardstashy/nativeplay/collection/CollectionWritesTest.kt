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
}
