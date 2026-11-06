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
 * A Magic deck's tools that now run in the app, through the site's own code in the engine: Copy to Play's list (app.js
 * A.deckToPlay), Print playtest proxies (A.proxies → extras.js proxySheetHTML), the acquire sheet (acquireSheet: "Cards I got" and
 * Add deck to collection, A.acqConfirm), New deck (A.newDeck, A.newDeckSave) and Import a deck / Re-import (deckImportSheet,
 * A.dImpPreview, A.dImpSave). The cards are the sample printings the catalog already has, so nothing is looked up online.
 */
class DeckToolsTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

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
            {"id":"d1","name":"Goblin Horde","format":"Commander","commander":"Krenko, Mob Boss","cards":[${rows(1 to "Krenko, Mob Boss", 1 to "Goblin Instigator", 1 to "Sol Ring", 1 to "Arcane Signet", 1 to "Lightning Bolt")}]},
            {"id":"d2","name":"Izzet Tempo","format":"Modern","cards":[${rows(4 to "Ragavan, Nimble Pilferer", 4 to "Lightning Bolt", 4 to "Counterspell", 2 to "Talrand, Sky Summoner")}],"side":[${rows(2 to "Counterspell")}]},
            {"id":"d3","name":"Mono Black","format":"Pauper Commander","cards":[${rows(4 to "Sheoldred, the Apocalypse", 20 to "Swamp")}]}]"""
        val ws = JsonParser.parseString("""{"version":3,"wishlist":[],"notes":[],"collection":$lots,"printings":$printings,"decks":$decks}""").asJsonObject
        CollectionEngine.load(ws, catalog.toString())
    }
    private fun data(vararg p: Pair<String, Any>) = JsonObject().apply { p.forEach { (k, v) -> when (v) { is JsonArray -> add(k, v); is Boolean -> addProperty(k, v); else -> addProperty(k, v.toString()) } } }
    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private fun made(r: JsonObject) = JsonParser.parseString(r.s("made")).asJsonObject
    private fun toast(r: JsonObject) = r.getAsJsonArray("toasts").lastOrNull()?.asJsonObject?.s("text").orEmpty()
    private fun text(r: JsonObject, id: String) = r.getAsJsonObject("texts")?.get(id)?.asString.orEmpty()
    private suspend fun decks() = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("decks").map { it.asJsonObject }
    private suspend fun lots() = JsonParser.parseString(CollectionEngine.saved()).asJsonObject.getAsJsonArray("collection").map { it.asJsonObject }

    @Test fun copyToPlayAndProxies() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle); fourDecks()
        // A.deckToPlay: Play's own format name, the main list only; a Commander deck's commander first, once.
        val izzet = CollectionEngine.deckPlay("d2")
        assertEquals("Izzet Tempo", izzet.s("name")); assertEquals("Modern", izzet.s("format"))
        assertEquals(listOf("Ragavan, Nimble Pilferer" to 4, "Lightning Bolt" to 4, "Counterspell" to 4, "Talrand, Sky Summoner" to 2),
            izzet.getAsJsonArray("cards").map { it.asJsonObject.s("name") to it.asJsonObject["qty"].asInt })
        val goblins = CollectionEngine.deckPlay("d1")
        assertEquals("Commander", goblins.s("format"))
        assertEquals("Krenko, Mob Boss", goblins.getAsJsonArray("cards")[0].asJsonObject.s("name"))
        assertEquals(1, goblins.getAsJsonArray("cards").count { it.asJsonObject.s("name") == "Krenko, Mob Boss" })
        // A format Play doesn't play: a Commander-like one plays as Commander.
        assertEquals("Commander", CollectionEngine.deckPlay("d3").s("format"))
        assertEquals("{}", CollectionEngine.deckPlay("gone").toString())

        // A.proxies (data-scope "all"): every copy but the basics, nine to a page, the deck's name in the title.
        val all = CollectionEngine.proxies("d3", "all")
        assertEquals("Mono Black — deck proxies", all.s("title")); assertEquals("Mono_Black_proxies.html", all.s("file"))
        assertEquals(4, Regex("""class="pc"""").findAll(all.s("html")).count())
        assertTrue(all.s("html").contains("4 cards · 1 page · playtest proxies, not for sale"))
        assertEquals(14, Regex("""class="pc"""").findAll(CollectionEngine.proxies("d2", "all").s("html")).count())
        // The missing cards only (views.js rowsFor, the side counted): one Ragavan, one Counterspell and one Talrand are owned.
        val missing = CollectionEngine.proxies("d2", "missing")
        assertEquals("Izzet Tempo — missing cards proxies", missing.s("title"))
        assertEquals(3 + 5 + 1, Regex("""class="pc"""").findAll(missing.s("html")).count())
    }

    @Test fun acquireSheet() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle); fourDecks()
        // A.deckBought: every card of the deck and its side, all ticked, stored under the deck's name.
        val bought = CollectionEngine.acquire("d2", "purchase")
        assertEquals("Add the whole deck to my collection", bought.s("title"))
        assertEquals("Store them in", bought.getAsJsonObject("location").s("label"))
        assertEquals("location:Deck: Izzet Tempo", bought.getAsJsonObject("location").s("selected"))
        val rows = bought.getAsJsonArray("rows").map { it.asJsonObject }
        assertEquals(mapOf("Ragavan, Nimble Pilferer" to 4, "Lightning Bolt" to 4, "Counterspell" to 6, "Talrand, Sky Summoner" to 2), rows.associate { it.s("name") to it["qty"].asInt })
        assertTrue(rows.all { it["on"].asBoolean })
        // Nothing ticked: the site's words under the list, nothing saved.
        val none = CollectionEngine.act("acqConfirm", data("deck" to "d2", "mode" to "purchase", "picked" to JsonArray(), "location" to "Deck: Izzet Tempo"))
        assertEquals("Tick the cards you have.", text(none, "#acqError")); assertEquals(0, none["writes"].asInt)
        // Two rows ticked: new copies on top of what is owned, in the deck's place, foil and Lightly Played as chosen.
        val before = lots().size
        val picked = JsonArray().apply { add(data("name" to "Counterspell", "qty" to "6")); add(data("name" to "Lightning Bolt", "qty" to "4")) }
        val saved = CollectionEngine.act("acqConfirm", data("deck" to "d2", "mode" to "purchase", "picked" to picked, "location" to "Deck: Izzet Tempo",
            "picker" to "location:Deck: Izzet Tempo", "finish" to "foil", "cond" to "Lightly Played"))
        assertEquals(1, saved["writes"].asInt); assertEquals("closed", saved.s("made")); assertEquals("10 cards added to your collection.", toast(saved))
        val added = lots().drop(before)
        assertEquals(listOf("Counterspell" to 6, "Lightning Bolt" to 4), added.map { it.s("name") to it["qty"].asInt })
        assertTrue(added.all { it.s("location") == "Deck: Izzet Tempo" && it.s("finish") == "foil" && it.s("condition") == "Lightly Played" && it.getAsJsonObject("raw").s("acquisition") == "Bought as a deck" })

        // A.acquire ("I got cards"): only what the deck is missing, none ticked; more than missing is refused (deck-flow.js acquireMissing).
        val got = CollectionEngine.acquire("d1", "missing")
        assertEquals("Cards I got", got.s("title"))
        assertTrue(got.getAsJsonArray("rows").none { it.asJsonObject["on"].asBoolean })
        val krenko = got.getAsJsonArray("rows").map { it.asJsonObject }
        println("MISSING d1 ${krenko.map { it.s("name") + " " + it["qty"] }}")
        val over = CollectionEngine.act("acqConfirm", data("deck" to "d3", "mode" to "missing", "picked" to JsonArray().apply { add(data("name" to "Sheoldred, the Apocalypse", "qty" to "9")) }, "location" to ""))
        assertTrue(text(over, "#acqError"), text(over, "#acqError").startsWith("Acquired quantity must be between 1 and the current missing count"))
        val ok = CollectionEngine.act("acqConfirm", data("deck" to "d3", "mode" to "missing", "picked" to JsonArray().apply { add(data("name" to "Sheoldred, the Apocalypse", "qty" to "3")) }, "location" to "Binder", "picker" to "new"))
        assertEquals("3 cards added to your collection.", toast(ok))
        assertEquals("Binder", lots().last().s("location"))
    }

    @Test fun newDeckAndImport() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle); fourDecks()
        // A.newDeck's sheet: Commander first, its line, the commander row, the name (optional) and budget.
        val nd = CollectionEngine.newDeck("")
        assertEquals("New deck", nd.s("title")); assertEquals("Commander", nd.s("format")); assertEquals("Create deck", nd.s("save"))
        assertEquals("100 cards, singleton · led by a legendary creature · 40 life · banned list checked", nd.s("info"))
        assertEquals("Commander", nd.getAsJsonObject("commander").s("label")); assertEquals("Optional", nd.getAsJsonObject("name").s("placeholder"))
        assertTrue(nd.getAsJsonArray("formats").size() > 2)
        val oath = nd.getAsJsonObject("rows").getAsJsonObject("Oathbreaker")
        assertEquals("Oathbreaker", oath.s("label")); assertTrue(oath["commander"].asBoolean)
        assertTrue(!nd.getAsJsonObject("rows").getAsJsonObject("Modern")["commander"].asBoolean)
        // No commander for a Commander deck: the site's words, nothing saved.
        val empty = CollectionEngine.act("newDeckSave", data("format" to "Commander", "commander" to "", "name" to "", "budget" to "25"))
        assertEquals("Enter a commander.", text(empty, "#ndError"))
        val modern = CollectionEngine.act("newDeckSave", data("format" to "Modern", "commander" to "", "name" to "", "budget" to "40"))
        assertEquals("Modern deck created.", toast(modern)); assertEquals("cards", made(modern).s("tab"))
        assertEquals("New deck" to 40, decks().last().let { it.s("name") to it["budget"].asInt })
        // A commander the catalog knows: the deck named after it, opening on Fill (Power).
        val talrand = CollectionEngine.act("newDeckSave", data("format" to "Commander", "commander" to "Talrand, Sky Summoner", "name" to "", "budget" to "25"), 60_000)
        assertEquals("Deck created. Fill the open slots from your collection here.", toast(talrand)); assertEquals("upgrade", made(talrand).s("tab"))
        assertEquals("Talrand deck", decks().last().s("name"))

        // deckImportSheet from the Decks page (no deck: the site's current deck is offered to replace) and from Izzet Tempo's menu.
        val sheet = CollectionEngine.deckImport(JsonObject(), "d2")
        assertEquals("Import a deck", sheet.s("title")); assertEquals("Imported deck", sheet.getAsJsonObject("name").s("value"))
        assertEquals(listOf("new", "replace", "library"), sheet.getAsJsonObject("dest").getAsJsonArray("options").map { it.asJsonArray[0].asString })
        assertEquals("Replace Izzet Tempo", sheet.getAsJsonObject("dest").getAsJsonArray("options")[1].asJsonArray[1].asString)
        assertEquals("Credit the creator (optional)", sheet.getAsJsonObject("credit").s("summary"))
        assertEquals(listOf("User export", "Community deck", "Purchased precon", "MTGJSON precon"),
            sheet.getAsJsonObject("credit").getAsJsonObject("kind").getAsJsonArray("options").map { it.asJsonArray[1].asString })
        assertEquals("User export", sheet.getAsJsonObject("credit").getAsJsonObject("kind").s("selected"))
        assertEquals("Commander", sheet.s("format")); assertEquals("Read from the list", sheet.getAsJsonObject("commander").s("placeholder"))
        assertTrue(sheet.s("placeholder").startsWith("Commander\n1 Giada, Font of Hope"))
        assertEquals("Preview & match", sheet.s("preview")); assertEquals("Save deck", sheet.s("save"))
        // Preview & match: an 8-card list with no commander set to Limited, matched against the collection.
        fun form(vararg p: Pair<String, String>) = data("text" to "4 Lightning Bolt\n4 Counterspell", "name" to "Imported deck", "format" to "Commander", "commander" to "",
            "dest" to "new", "url" to "", "author" to "", "kind" to "User export", "desc" to "").apply { p.forEach { (k, v) -> addProperty(k, v) } }
        val prev = made(CollectionEngine.act("dImpPreview", form(), 60_000))
        assertEquals("Limited (40-card)", prev.getAsJsonObject("form").s("format"))
        assertEquals("Matched against your collection.", prev.s("status"))
        val res = prev.getAsJsonObject("results")
        assertEquals(listOf("8" to "cards", "5" to "you own"), res.getAsJsonArray("kpis").take(2).map { it.asJsonArray[0].asString to it.asJsonArray[1].asString })
        assertEquals(listOf("4× Counterspell" to "need 3", "4× Lightning Bolt" to "owned"), res.getAsJsonArray("rows").map { it.asJsonObject.s("text") to it.asJsonObject.s("need") })
        // Saved as a new deck: its page's Cards.
        val saved = CollectionEngine.act("dImpSave", form("format" to "Limited (40-card)"))
        assertEquals("Deck imported. Your collection is unchanged.", toast(saved))
        assertEquals("deck", made(saved).s("go")); assertEquals("cards", made(saved).s("tab"))
        assertEquals("Imported deck", decks().last().s("name"))
        // Re-import over Izzet Tempo: asked first; yes keeps the old list in Versions and opens them.
        CollectionEngine.act("dImpPreview", form("format" to "Modern"), 60_000)
        val ask = CollectionEngine.act("dImpSave", form("format" to "Modern", "dest" to "replace", "name" to "Izzet Tempo"))
        assertEquals("Replace the cards in Izzet Tempo? The old list is kept in Versions.", ask.s("ask")); assertEquals(0, ask["writes"].asInt)
        val replaced = CollectionEngine.act("dImpSave", form("format" to "Modern", "dest" to "replace", "name" to "Izzet Tempo").apply { addProperty("confirmed", true) })
        assertEquals("versions", made(replaced).s("tab")); assertEquals("d2", made(replaced).s("id"))
        val izzet = decks().first { it.s("id") == "d2" }
        assertEquals(listOf("Lightning Bolt", "Counterspell"), izzet.getAsJsonArray("cards").map { it.asJsonObject.s("name") })
        assertTrue(izzet.getAsJsonArray("versions").map { it.asJsonObject.s("label") }.containsAll(listOf("Before re-import", "Re-imported")))
        // Typing in the list clears the preview: Save deck does nothing until Preview & match again.
        CollectionEngine.deckImportText()
        assertEquals(0, CollectionEngine.act("dImpSave", form())["writes"].asInt)
    }
}
