package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.Decks
import org.junit.Assert.assertEquals
import org.junit.Test

/** Play deck rules against the web's own answers (scripts/export-deck-golden.mjs). */
class DecksTest {
    private val g = JsonParser.parseString(javaClass.classLoader!!.getResource("deck-golden.json")!!.readText()).asJsonObject
    private fun rows(a: com.google.gson.JsonArray) = a.map { val o = it.asJsonObject; Decks.Row(o["name"].asString, o["qty"].asInt, o["board"]?.asString) }
    private fun map(o: JsonObject) = o.entrySet().associate { it.key to it.value.asString }

    @Test fun shortfall() {
        val owned = g.getAsJsonObject("owned").entrySet().associate { it.key to it.value.asInt }; val rarity = map(g.getAsJsonObject("rarity"))
        for (c in g.getAsJsonArray("shortfall")) { val o = c.asJsonObject; val want = o.getAsJsonObject("out")
            val got = Decks.shortfall(rows(o.getAsJsonArray("deck")), owned, rarity)
            assertEquals(want["missing"].asJsonArray.map { val m = it.asJsonObject; Decks.Missing(m["name"].asString, m["need"].asInt, m["rarity"].asString, m["seal"].asString) }, got.missing)
            assertEquals(map(want.getAsJsonObject("seals")).mapValues { it.value.toInt() }, got.seals)
            assertEquals(want["complete"].asBoolean, got.complete) }
    }

    @Test fun legalFormats() {
        val legal = g.getAsJsonObject("legal").entrySet().associate { it.key to map(it.value.asJsonObject) }
        for (c in g.getAsJsonArray("legalFormats")) { val o = c.asJsonObject
            assertEquals(o.toString(), o["out"].asJsonArray.map { it.asString }, Decks.legalFormats(rows(o.getAsJsonArray("rows")), legal)) }
    }

    @Test fun preconPriceRulesBasics() {
        val cfg = JsonParser.parseString("""{"precon":{"min":100,"max":900,"perCard":10}}""").asJsonObject
        for (p in g.getAsJsonArray("precon")) { val a = p.asJsonArray
            assertEquals(a[1].asInt, Decks.preconPrice(a[0].asInt, null)); assertEquals(a[2].asInt, Decks.preconPrice(a[0].asInt, cfg)) }
        for (r in g.getAsJsonArray("rules")) { val a = r.asJsonArray; val o = a[1].asJsonObject
            assertEquals(Decks.Rules(o["size"].asInt, o["copies"].asInt, o["exact"].asBoolean), Decks.deckRules(a[0].asString)) }
        for (b in g.getAsJsonArray("basics")) assertEquals(b.asJsonArray[1].asBoolean, Decks.isBasicLand(b.asJsonArray[0].asString))
    }

    @Test fun paste() {
        val rows = Decks.parsePaste("Deck\n4 Lightning Bolt\n2x Counterspell (MH2) 267\n\nSideboard\n3 Pyroblast\nnot a card\n300 Island")
        assertEquals(listOf(Decks.Row("Lightning Bolt", 4), Decks.Row("Counterspell", 2), Decks.Row("Pyroblast", 3, "side"), Decks.Row("Island", 250, "side")), rows)
    }

    /** Save deck from a paste posts the web's body: {name, qty} rows, board:"side" only on sideboard rows. */
    @Test fun pasteSaveBody() {
        val body = dev.cardstashy.nativeplay.ui.rowsJson(Decks.parsePaste("4 Lightning Bolt\nSideboard\n2 Pyroblast"))
        assertEquals("""[{"name":"Lightning Bolt","qty":4},{"name":"Pyroblast","qty":2,"board":"side"}]""", body.toString())
    }
}
