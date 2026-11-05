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
        val rarityCfg = JsonParser.parseString("""{"precon":{"min":100,"perRarity":{"c":10,"r":300}}}""").asJsonObject
        for (p in g.getAsJsonArray("preconSeals")) { val a = p.asJsonArray; val seals = a[0].asJsonObject.entrySet().associate { it.key to it.value.asInt }
            assertEquals(a.toString(), a[1].asInt, Decks.preconPrice(seals, null)); assertEquals(a.toString(), a[2].asInt, Decks.preconPrice(seals, rarityCfg)) }
        for (r in g.getAsJsonArray("rules")) { val a = r.asJsonArray; val o = a[1].asJsonObject
            assertEquals(Decks.Rules(o["size"].asInt, o["copies"].asInt, o["exact"].asBoolean), Decks.deckRules(a[0].asString)) }
        for (b in g.getAsJsonArray("basics")) assertEquals(b.asJsonArray[1].asBoolean, Decks.isBasicLand(b.asJsonArray[0].asString))
    }

    /** The precon route's Commander deck (play-econ-route.js): commander row first with board "commander", singleton, saved as Commander. */
    @Test fun commanderPrecon() {
        val j = JsonParser.parseString("""{"data":{"name":"Limit Break","commander":[{"name":"Cloud, Ex-SOLDIER","count":1,"setCode":"FIC","number":"1","rarity":"mythic","identifiers":{"scryfallId":"x"}}],
            "mainBoard":[{"name":"Sol Ring","count":1,"setCode":"FIC","number":"2","rarity":"uncommon"},{"name":"Mountain","count":30,"setCode":"FIC","number":"3","rarity":"common"}]}}""").asJsonObject
        val rows = Decks.preconRows(j.getAsJsonObject("data"))
        assertEquals(listOf(Decks.Row("Cloud, Ex-SOLDIER", 1, "commander", "fic", "1", "x", "mythic"), Decks.Row("Sol Ring", 1, null, "fic", "2", "", "uncommon"), Decks.Row("Mountain", 30, null, "fic", "3", "", "common")), rows)
        assertEquals(listOf("Commander"), Decks.preconFormatsAny(j)); assertEquals(1, Decks.preconCopies(rows)); assertEquals(4, Decks.preconCopies(rows.drop(1)))
    }

    /** preconQuote against the site's own (play-econ-rules.js at PR #130 098ecbf, run in node on these rows). */
    /** preconQuote against the site's play-econ-rules.js (PR #131 dcb8043, the half-scale ladder; goldens from node at 2026-11-05T12:00Z). */
    @Test fun preconQuote() {
        fun r(n: String, q: Int, rar: String, b: String? = null) = Decks.Row(n, q, b, rarity = rar)
        val now = java.time.Instant.parse("2026-11-05T12:00:00Z").toEpochMilli()
        class Case(val rows: List<Decks.Row>, val owned: Map<String, Int>, val type: String, val released: String, val cap: Int, val config: String?, val price: Int, val missing: Int, val cls: String)
        val cases = mapOf(
            "cmdr" to Case(listOf(r("Cloud, Ex-SOLDIER", 1, "mythic", "commander"), r("Sol Ring", 1, "uncommon"), r("Mountain", 30, "common"), r("Lightning Bolt", 1, "common"), r("Rare Thing", 1, "rare")),
                mapOf("Sol Ring" to 1), "Commander Deck", "2025-06-13", 1, null, 4820, 3, "commander"),
            "chal" to Case(listOf(r("A", 4, "common"), r("B", 3, "uncommon"), r("C", 2, "rare"), r("D", 1, "mythic"), r("Island", 20, "common")), mapOf("A" to 2, "C" to 2), "Challenger Deck", "2025-02-01", 4, null, 1570, 6, "standard"),
            "start" to Case(listOf(r("A", 4, "common"), r("B", 3, "special")), emptyMap(), "Starter Kit", "2019-01-01", 4, null, 2500, 7, "standard"),
            "intro" to Case(listOf(r("A", 4, "common"), r("B", 3, "uncommon")), mapOf("A" to 4), "Intro Pack", "2010-01-01", 4, null, 1730, 3, "standard"),
            "pauper" to Case(listOf(r("A", 4, "common"), r("B", 3, "uncommon"), r("Forest", 10, "common")), mapOf("A" to 4), "Theme Deck", "2024-01-01", 4, null, 1040, 3, "pauper"),
            "modern" to Case(listOf(r("A", 4, "common"), r("B", 3, "mythic")), mapOf("B" to 2), "Theme Deck", "2015-06-01", 4, null, 1215, 5, "modern"),
            "legacy" to Case(listOf(r("A", 4, "common"), r("B", 2, "rare")), emptyMap(), "Theme Deck", "2005-01-01", 4, null, 7500, 6, "legacy"),
            "masters" to Case(listOf(r("A", 4, "common"), r("B", 2, "rare")), mapOf("A" to 1), "Masters Deck", "2025-01-01", 4, null, 7330, 5, "legacy"),
            "brawl" to Case(listOf(r("A", 1, "common"), r("B", 1, "rare"), r("C", 1, "mythic")), mapOf("C" to 1), "Brawl Deck", "2025-01-01", 1, null, 780, 2, "brawl"),
            "nodate" to Case(listOf(r("A", 4, "common"), r("B", 2, "rare")), emptyMap(), "Theme Deck", "", 4, null, 2500, 6, "standard"),
            "edge" to Case(listOf(r("A", 4, "common"), r("B", 2, "rare")), emptyMap(), "Theme Deck", "2023-11-04", 4, null, 2500, 6, "standard"),
            "edge2" to Case(listOf(r("A", 4, "common"), r("B", 2, "rare")), emptyMap(), "Theme Deck", "2023-11-02", 4, null, 3500, 6, "modern"),
            "owned" to Case(listOf(r("A", 4, "common"), r("B", 3, "uncommon")), mapOf("A" to 4, "B" to 3), "Theme Deck", "2024-01-01", 4, null, 0, 0, "pauper"),
            "cfg" to Case(listOf(r("A", 4, "common"), r("B", 3, "mythic")), mapOf("B" to 2), "Theme Deck", "2024-01-01", 4,
                """{"precon":{"min":100,"list":{"legacy":2000},"types":{"Theme Deck":"legacy"}}}""", 695, 5, "legacy"),
            "eras" to Case(listOf(r("A", 4, "common"), r("B", 3, "mythic")), mapOf("B" to 2), "Theme Deck", "2015-06-01", 4, """{"precon":{"eras":{"modern":"2016-01-01"}}}""", 2610, 5, "legacy"))
        for ((k, c) in cases) {
            val q = Decks.preconQuote(c.rows, c.owned, c.type, c.config?.let { JsonParser.parseString(it).asJsonObject }, c.cap, c.released, now)
            assertEquals(k, listOf(c.price.toString(), c.missing.toString(), c.cls), listOf(q.price.toString(), q.missing.toString(), q.cls))
        }
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

    /** preconFace against the site's play-econ-rules.js (goldens from node): commander first, then the weightiest nonland spell. */
    @Test fun preconFaceMatchesSite() {
        val deck = JsonParser.parseString("""{"mainBoard":[{"name":"Forest","count":16,"supertypes":["Basic"],"types":["Land"],"rarity":"common","manaValue":0,"identifiers":{"scryfallId":"a0000000-0000-0000-0000-000000000000"}},{"name":"Llanowar Elves","count":4,"types":["Creature"],"rarity":"common","manaValue":1,"identifiers":{"scryfallId":"b0000000-0000-0000-0000-000000000000"}},{"name":"Big Wurm","count":2,"types":["Creature"],"rarity":"rare","manaValue":7,"identifiers":{"scryfallId":"c0000000-0000-0000-0000-000000000000"}},{"name":"Mythic Wurm","count":4,"types":["Creature"],"rarity":"mythic","manaValue":6,"identifiers":{"scryfallId":"d0000000-0000-0000-0000-000000000000"}},{"name":"Giant Growth","count":1,"types":["Instant"],"rarity":"mythic","manaValue":1,"isFoil":true,"identifiers":{"scryfallId":"e0000000-0000-0000-0000-000000000000"}},{"name":"Garruk","count":1,"types":["Planeswalker"],"rarity":"uncommon","manaValue":4,"identifiers":{"scryfallId":"f0000000-0000-0000-0000-000000000000"}},{"name":"No Id","count":1,"types":["Planeswalker"],"rarity":"mythic","manaValue":9,"identifiers":{}},{"name":"Tie A","count":1,"types":["Creature"],"rarity":"mythic","manaValue":2}]}""").asJsonObject
        fun face(d: JsonObject) = Decks.preconFace(d)?.let { "${it.first}|${it.second}" }
        assertEquals("Mythic Wurm|d0000000-0000-0000-0000-000000000000", face(deck))
        val cmd = deck.deepCopy().apply { add("commander", JsonParser.parseString("""[{"name":"Cmd","identifiers":{"scryfallId":"90000000-0000-0000-0000-000000000000"}}]""")) }
        assertEquals("Cmd|90000000-0000-0000-0000-000000000000", face(cmd))
        val noId = deck.deepCopy().apply { add("commander", JsonParser.parseString("""[{"name":"Cmd","identifiers":{}}]""")) }
        assertEquals("Mythic Wurm|d0000000-0000-0000-0000-000000000000", face(noId))
        val walker = deck.deepCopy().apply { getAsJsonArray("mainBoard").map { it.asJsonObject }.first { it.get("name").asString == "Garruk" }.addProperty("rarity", "mythic") }
        assertEquals("Garruk|f0000000-0000-0000-0000-000000000000", face(walker))
        assertEquals(null, face(JsonObject().apply { add("mainBoard", com.google.gson.JsonArray().apply { add(deck.getAsJsonArray("mainBoard")[0]) }) }))
    }
}
