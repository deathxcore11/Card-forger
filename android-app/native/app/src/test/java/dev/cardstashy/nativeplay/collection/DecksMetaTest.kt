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
 * Collection › Decks › Meta decks through the site's own code in the engine: the tab's body as a panel (Collection.decksPanel with
 * 'inspiration': views.js inspirationView for Magic, tcg.js metaView for Yu-Gi-Oh!) drawn from a kept tournament cache (cardforge-meta-v1,
 * so nothing is fetched for the tab), the format chips (A.mtgMetaFormat's chip on, tcg.js A.tMetaFormat's "no feed" state and back), the
 * finder's controls, and the tournament deck's sheet (app.js A.mtgProven / tcg.js A.tMetaDeck → provenSheetHtml) with its versions,
 * Home's way in (Collection.provenHome) and its save (A.provenSave: the deck the site opens next). The sheet's price lookups may reach
 * the network; nothing here depends on their answers. [keep] writes the models for the shot test (DecksMetaShotTest).
 */
class DecksMetaTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    companion object {
        /** A Modern snapshot in the Worker's shape (meta.js mtgMeta), its lists made of the fixture collection's cards. */
        fun mtgMeta(): JsonObject = JsonParser.parseString("""{"game":"mtg","format":"Modern","days":14,"source":"Magic Online (official decklists)",
          "sourceUrl":"https://www.mtgo.com/decklists","labelNote":"Deck names come from each list’s key cards (MTGO doesn’t label archetypes).",
          "events":[{"id":"1","name":"Modern Challenge 32","date":"2026-11-05","players":53}],
          "decks":[
            {"key":"mtgo:1:a","name":"Rakdos Midrange · Ragavan, Nimble Pilferer","archetype":"Rakdos Midrange · Ragavan, Nimble Pilferer","commander":"","event":"Modern Challenge 32","eventId":"1","date":"2026-11-05","players":53,"rank":1,"place":"1st","player":"makaaaa","record":"8-1",
             "main":[{"qty":4,"name":"Ragavan, Nimble Pilferer","land":false},{"qty":4,"name":"Lightning Bolt","land":false},{"qty":2,"name":"Sheoldred, the Apocalypse","land":false},{"qty":1,"name":"The One Ring","land":false},{"qty":4,"name":"Counterspell","land":false},{"qty":20,"name":"Swamp","land":true}],
             "side":[{"qty":2,"name":"Skithiryx, the Blight Dragon"}],"commanders":[],"cover":"Ragavan, Nimble Pilferer","url":"https://www.mtgo.com/decklist/modern-challenge-32","eventUrl":"https://www.mtgo.com/decklist/modern-challenge-32"},
            {"key":"mtgo:1:b","name":"Goblins · Goblin Instigator","archetype":"Goblins · Goblin Instigator","commander":"","event":"Modern Challenge 32","eventId":"1","date":"2026-11-05","players":53,"rank":2,"place":"2nd","player":"goblinfan","record":"7-2",
             "main":[{"qty":4,"name":"Goblin Instigator","land":false},{"qty":4,"name":"Krenko, Mob Boss","land":false},{"qty":4,"name":"Lightning Bolt","land":false},{"qty":20,"name":"Swamp","land":true}],
             "side":[],"commanders":[],"cover":"Goblin Instigator","url":"https://www.mtgo.com/decklist/modern-challenge-32","eventUrl":"https://www.mtgo.com/decklist/modern-challenge-32"},
            {"key":"mtgo:1:c","name":"Blue Tempo · Talrand, Sky Summoner","archetype":"Blue Tempo · Talrand, Sky Summoner","commander":"","event":"Modern Challenge 32","eventId":"1","date":"2026-11-05","players":53,"rank":3,"place":"3rd","player":"merfolk","record":"6-3",
             "main":[{"qty":4,"name":"Counterspell","land":false},{"qty":4,"name":"Talrand, Sky Summoner","land":false},{"qty":1,"name":"The One Ring","land":false},{"qty":20,"name":"Swamp","land":true}],
             "side":[],"commanders":[],"cover":"Talrand, Sky Summoner","url":"https://www.mtgo.com/decklist/modern-challenge-32","eventUrl":"https://www.mtgo.com/decklist/modern-challenge-32"}],
          "archetypes":[{"name":"Rakdos Midrange · Ragavan, Nimble Pilferer","lists":2,"best":"mtgo:1:a","cover":"Ragavan, Nimble Pilferer","share":0.4},
            {"name":"Goblins · Goblin Instigator","lists":1,"best":"mtgo:1:b","cover":"Goblin Instigator","share":0.2},
            {"name":"Blue Tempo · Talrand, Sky Summoner","lists":1,"best":"mtgo:1:c","cover":"Talrand, Sky Summoner","share":0.2}],
          "coverage":{"events":1,"players":53,"topSlots":32,"withList":32,"structured":32,"linkOnly":0,"missing":0,"challenges":1,"challengeLists":32,"leagues":0,"leagueLists":0},
          "fetchedAt":"2026-11-06T14:15:49.540Z"}""").asJsonObject
        /** The Yu-Gi-Oh! snapshot (meta.js ygoMeta's shape) over the tcg-collection fixture's cards. */
        fun ygoMeta(): JsonObject = JsonParser.parseString("""{"game":"ygo","source":"YGOPRODeck Tournament Meta Decks","decks":[
            {"key":"ygo:1","name":"Dark Magician","place":"Top 8","event":"YCS Test City","rank":8,"players":512,"player":"Yugi","date":"2026-11-01","cover":"46986414","main":["46986414","46986414","38033121","89631139"],"extra":[],"side":["89631139"],"url":"https://ygoprodeck.com/deck/1"},
            {"key":"ygo:2","name":"Blue-Eyes","place":"Winner","event":"WCQ Regional","rank":1,"players":120,"player":"Kaiba","date":"2026-10-28","cover":"89631139","main":["89631139","89631139","89631139"],"extra":[],"side":[],"url":"https://ygoprodeck.com/deck/2"}],
          "archetypes":[{"name":"Dark Magician","count":1,"best":"ygo:1","share":0.5},{"name":"Blue-Eyes","count":1,"best":"ygo:2","share":0.5}],
          "top":[{"id":"89631139","name":"Blue-Eyes White Dragon","pct":100,"avg":3,"type":"Monster"},{"id":"46986414","name":"Dark Magician","pct":50,"avg":2,"type":"Monster"}]}""").asJsonObject
        /** A Standard snapshot in meta.js ptcgMeta's shape over the tcg-collection fixture's cards: a printing the cache matches (owned),
         *  another (not owned), basic Energy by its printing, and a printing nothing matches (ZZZ 999). */
        fun ptcgMeta(): JsonObject = JsonParser.parseString("""{"game":"ptcg","format":"Standard","formatId":"standard","fetchedAt":"${java.time.Instant.now()}","artSchema":2,"results":null,
          "source":"Limitless — 1 recent Standard events, 64 players","events":[{"name":"Regional Test City","players":64,"date":"2026-11-01"}],
          "decks":[{"formatId":"standard","key":"ptcg:e1:1","name":"Pikachu ex","archetype":"pikachu-ex","icons":["pikachu"],"event":"Regional Test City","place":"Winner","rank":1,"players":64,"player":"Ash","date":"2026-11-01",
            "list":[{"qty":4,"name":"Pikachu ex","set":"sv08","number":"57","kind":"Pokemon"},{"qty":4,"name":"Ultra Ball","set":"sv01","number":"196","kind":"Trainer"},
              {"qty":2,"name":"Mystery Card","set":"ZZZ","number":"999","kind":"Trainer"},{"qty":8,"name":"Lightning Energy","set":"sve","number":"4","kind":"Energy"}],
            "url":"https://limitlesstcg.com/decks/list/1"}],
          "archetypes":[{"id":"pikachu-ex","name":"Pikachu ex","icons":["pikachu"],"count":1,"top8":1,"share":1,"best":"ptcg:e1:1","cover":null}],
          "top":[{"name":"Pikachu ex","kind":"Pokemon","pct":100,"avg":4},{"name":"Mystery Card","kind":"Trainer","pct":100,"avg":2}]}""").asJsonObject
        fun kept(key: String, data: JsonObject): String = JsonObject().apply { add(key, JsonObject().apply { addProperty("at", System.currentTimeMillis()); add("data", data) }) }.toString()
        val models = HashMap<String, JsonObject>()
        /** Where the shot test (DecksMetaShotTest) reads them: app/build/shot-art/decks-meta/<key>.json. */
        val fixtures: File get() = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/decks-meta")
    }
    private suspend fun keep(key: String, model: JsonObject, head: JsonObject? = null) {
        models[key] = model
        fixtures.mkdirs()
        fixtures.resolve("$key.json").writeText(JsonObject().apply { add("model", model); head?.let { add("head", it) }; add("glyphs", CollectionEngine.glyphs()) }.toString())
    }

    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private fun JsonObject.objs(k: String) = getAsJsonArray(k)?.map { it.asJsonObject }.orEmpty()
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

    @Test fun magicMeta() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart()
        val was = CollectionEngine.store
        CollectionEngine.store = CollectionEngine.MemoryStore().apply { save("cardforge-meta-v1", kept("mtg:Modern", mtgMeta())) }
        try {
            CollectionEngine.initFrom(bundle); DecksIdeasTest.magic()
            val head = CollectionEngine.decks("mtg", JsonObject().apply { addProperty("tab", "inspiration") })
            assertEquals("inspiration", head.s("tab"))
            CollectionEngine.decksPanel("mtg", "inspiration"); CollectionEngine.settle(5_000)
            var p = panel(); var body = p.getAsJsonObject("body")
            val w = words(body)
            for (s in listOf("Tournament results", "Modern · last 14 days · Magic Online · updated", "Top decks right now", "Recent top lists",
                    "Decklists from Magic Online (Wizards of the Coast).", "Decks you can almost build", "Saved decks", "Precons")) assertTrue("$s in $w", w.contains(s))
            val chips = all(body) { act(it) == "mtgMetaFormat" }
            assertEquals(9, chips.size)
            assertEquals("Modern", words(chips.single { "on" in cls(it) }))
            assertEquals(3, all(body) { "arch" in cls(it) && act(it) == "mtgProven" }.size)
            val rows = all(body) { "meta-row" in cls(it) }
            assertEquals(3, rows.size)
            assertTrue(words(rows.first()), words(rows.first()).contains("1st · Modern Challenge 32 · 53 players · 8-1"))
            assertTrue(words(rows.first()).contains("% owned"))
            keep("mtg-meta", p, head)
            // The finder's sort (C.finderSort): the select keeps the choice as the panel draws again.
            val sort = all(body) { attr(it, "data-change") == "finderSort" }.single()
            CollectionEngine.panelType(sort["i"].asInt, "owned")
            body = panel().getAsJsonObject("body")
            assertEquals("owned", all(all(body) { attr(it, "data-change") == "finderSort" }.single()) { it.getAsJsonObject("a")?.has("selected") == true }.single().let { attr(it, "value") })

            // The finder's search (I.finderSearch draws the panel again on each letter): a letter sent with the field's id from before
            // that draw still reaches the field, so nothing typed is lost.
            val search = all(body) { attr(it, "data-input") == "finderSearch" }.single()["i"].asInt
            CollectionEngine.panelType(search, "Rak")
            CollectionEngine.panelType(search, "Rakdos")
            body = panel().getAsJsonObject("body")
            val field = all(body) { attr(it, "data-input") == "finderSearch" }.single()
            assertTrue(field["i"].asInt != search)
            assertEquals("Rakdos", field.get("v")?.asString ?: attr(field, "value"))
            CollectionEngine.panelType(field["i"].asInt, "")
            body = panel().getAsJsonObject("body")

            // A list: the sheet (acted), then the sheet as provenSheetHtml draws it.
            val tapped = CollectionEngine.panelTap(all(body) { "meta-row" in cls(it) }.first()["i"].asInt)
            assertEquals("proven", tapped.getAsJsonObject("acted").s("act"))
            var sheet = CollectionEngine.provenModel()
            CollectionEngine.settle(20_000, CollectionEngine.PROVEN_MODEL) { j -> if (j.has("hero")) sheet = j }
            sheet = CollectionEngine.provenModel()
            assertEquals("Rakdos Midrange · Ragavan, Nimble Pilferer", sheet.getAsJsonObject("hero").s("title"))
            assertEquals(listOf("Meta", "Magic · Modern"), sheet.getAsJsonObject("hero").objs("eyebrow").map { it.s("label") })
            assertTrue(sheet.getAsJsonObject("hero").s("line").startsWith("1st · Modern Challenge 32 · 53 players · makaaaa · 8-1"))
            assertEquals(listOf("Original", "Budget", "My cards"), sheet.objs("versions").map { it.s("label") })
            val actions = sheet.objs("actions")
            assertEquals("Save deck", actions.first().s("label"))
            assertEquals("Magic Online event", actions.last().s("label"))
            assertEquals("https://www.mtgo.com/decklist/modern-challenge-32", actions.last().s("href"))
            val rowsBlock = sheet.objs("blocks").first { it.s("k") == "rows" }
            assertEquals(6, rowsBlock.objs("rows").size)
            assertEquals("card", rowsBlock.objs("rows").first().s("act"))
            assertTrue(sheet.objs("blocks").any { it.s("k") == "side" })
            assertTrue(sheet.objs("feet").last().s("text").startsWith("Decklist from Magic Online (Wizards of the Coast)."))
            assertEquals("https://www.mtgo.com/decklists", sheet.objs("feet").last().objs("links").single().s("href"))
            keep("mtg-sheet", sheet)
            // My cards: the note says what is owned.
            val draft = CollectionEngine.provenDo("mode", "draft")
            assertEquals("draft", draft.s("mode"))
            assertTrue(draft.objs("blocks").first().s("k") == "note")
            keep("mtg-sheet-draft", draft)
            CollectionEngine.provenDo("mode", "original")
            // Save deck: the original list as a new deck, opened on its Cards tab.
            val r = CollectionEngine.act("provenSave", JsonObject(), 20_000)
            val made = JsonParser.parseString(r.s("made")).asJsonObject
            assertEquals("deck", made.s("go")); assertEquals("cards", made.s("tab"))
            assertTrue(r.toString(), r.objs("toasts").any { it.s("text") == "Saved “Rakdos Midrange · Ragavan, Nimble Pilferer · original”." })
            val deck = saved().objs("decks").single { it.s("id") == made.s("id") }
            assertEquals("Modern", deck.s("format"))
            assertEquals(2, deck.objs("side").single().get("qty").asInt)
            // The sheet closed with the save; Home's Meta card opens another.
            assertTrue(CollectionEngine.provenModel().has("missing"))
            // A list Home no longer has (its snapshot changed): A.mtgProven's toast, and no sheet.
            val gone = CollectionEngine.provenHome("mtg", "mtgo:9:z")
            assertTrue(gone.has("missing"))
            assertEquals("This Home list has changed. Choose the current visible list.", gone.getAsJsonArray("toasts").single().asString)
            val home = CollectionEngine.provenHome("mtg", "mtgo:1:b")
            assertEquals("Goblins · Goblin Instigator", home.getAsJsonObject("hero").s("title"))
            CollectionEngine.provenClose()
            assertTrue(CollectionEngine.provenModel().has("missing"))
        } finally { CollectionEngine.store = was }
    }

    @Test fun pokemonMeta() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart()
        val was = CollectionEngine.store
        CollectionEngine.store = CollectionEngine.MemoryStore().apply { save("cardforge-meta-v1", kept("ptcg", ptcgMeta())) }
        try {
            CollectionEngine.initFrom(bundle); DecksIdeasTest.yugioh()
            val head = CollectionEngine.decks("ptcg", JsonObject().apply { addProperty("tab", "inspiration") })
            CollectionEngine.decksPanel("ptcg", "inspiration"); CollectionEngine.settle(5_000)
            val p = panel(); val body = p.getAsJsonObject("body")
            val w = words(body)
            for (s in listOf("Tournament results", "Top decks right now", "Most played cards", "Recent top lists")) assertTrue("$s in $w", w.contains(s))
            assertEquals(1, all(body) { "meta-row" in cls(it) }.size)
            keep("ptcg-meta", p, head)
            val tapped = CollectionEngine.panelTap(all(body) { "meta-row" in cls(it) }.first()["i"].asInt)
            assertEquals("proven", tapped.getAsJsonObject("acted").s("act"))
            var sheet = CollectionEngine.provenModel()
            CollectionEngine.settle(30_000, CollectionEngine.PROVEN_MODEL) { j -> if (j.has("hero")) sheet = j }
            sheet = CollectionEngine.provenModel()
            assertEquals("Pikachu ex", sheet.getAsJsonObject("hero").s("title"))
            val rows = sheet.objs("blocks").first { it.s("k") == "rows" }.objs("rows")
            assertEquals(4, rows.size)
            // tcg.js row(): the printing nothing matched says so (warn) and opens Other printings; an owned one is ✓ owned.
            val miss = rows.single { it.s("name") == "Mystery Card" }
            assertEquals("Printing not matched", miss.getAsJsonObject("right").s("text")); assertEquals("warn", miss.getAsJsonObject("right").s("tone"))
            assertEquals("tOtherPrintings", miss.s("act"))
            assertEquals("✓ owned", rows.single { it.s("name") == "Pikachu ex" }.getAsJsonObject("right").s("text"))
            assertEquals("tCard", rows.single { it.s("name") == "Pikachu ex" }.s("act"))
            assertEquals("Retry card matching", sheet.getAsJsonObject("retry")?.s("label"))
            keep("ptcg-sheet", sheet)
            CollectionEngine.provenClose()
        } finally { CollectionEngine.store = was }
    }

    @Test fun yugiohMeta() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart()
        val was = CollectionEngine.store
        CollectionEngine.store = CollectionEngine.MemoryStore().apply { save("cardforge-meta-v1", kept("ygo", ygoMeta())) }
        try {
            CollectionEngine.initFrom(bundle); DecksIdeasTest.yugioh()
            val head = CollectionEngine.decks("ygo", JsonObject().apply { addProperty("tab", "inspiration") })
            CollectionEngine.decksPanel("ygo", "inspiration"); CollectionEngine.settle(5_000)
            val p = panel(); var body = p.getAsJsonObject("body")
            val w = words(body)
            for (s in listOf("Tournament results", "Advanced (TCG) · YGOPRODeck Tournament Meta Decks · updated", "Top decks right now", "Most played cards",
                    "Blue-Eyes White Dragon 100%", "Recent top lists")) assertTrue("$s in $w", w.contains(s))
            assertEquals("Advanced (TCG)", words(all(body) { act(it) == "tMetaFormat" && "on" in cls(it) }.single()))
            assertEquals(2, all(body) { "meta-row" in cls(it) }.size)
            assertTrue(words(all(body) { "arch" in cls(it) }.first()).contains("1 top finish"))
            keep("ygo-meta", p, head)
            // OCG has no feed: the site says so, offers its deck (tNewDeck) and the way back.
            CollectionEngine.panelTap(all(body) { act(it) == "tMetaFormat" && words(it) == "OCG" }.single()["i"].asInt)
            body = panel().getAsJsonObject("body")
            val none = all(body) { "meta-format-empty" in cls(it) }.single()
            assertTrue(words(none).contains("Tournament results for this format aren’t available from the connected feed yet."))
            assertEquals("ocg", attr(all(none) { act(it) == "tNewDeck" }.single(), "data-format"))
            keep("ygo-meta-none", panel(), head)
            CollectionEngine.panelTap(all(none) { act(it) == "tMetaFormat" }.single()["i"].asInt)
            CollectionEngine.settle(3_000)
            body = panel().getAsJsonObject("body")
            assertFalse(all(body) { "meta-format-empty" in cls(it) }.isNotEmpty())
            // A list: the sheet.
            val tapped = CollectionEngine.panelTap(all(body) { "meta-row" in cls(it) }.first()["i"].asInt)
            assertEquals("proven", tapped.getAsJsonObject("acted").s("act"))
            var sheet = CollectionEngine.provenModel()
            CollectionEngine.settle(20_000, CollectionEngine.PROVEN_MODEL) { j -> if (j.has("hero")) sheet = j }
            sheet = CollectionEngine.provenModel()
            assertEquals("Dark Magician", sheet.getAsJsonObject("hero").s("title"))
            assertEquals(listOf("Meta", "Yu-Gi-Oh!"), sheet.getAsJsonObject("hero").objs("eyebrow").map { it.s("label") })
            assertEquals("YGOPRODeck", sheet.objs("actions").last().s("label"))
            assertEquals("tMetaBuild", sheet.objs("extra").single().s("act"))
            val rows = sheet.objs("blocks").first { it.s("k") == "rows" }.objs("rows")
            assertEquals(listOf("tCard"), rows.map { it.s("act") }.distinct())
            assertTrue(sheet.objs("feet").first().s("text").startsWith("Tournament-backed · Advanced (TCG) · Top 8 at YCS Test City (512 players)"))
            keep("ygo-sheet", sheet)
            val budget = CollectionEngine.provenDo("mode", "budget")
            assertEquals("budget", budget.s("mode"))
            keep("ygo-sheet-budget", budget)
            CollectionEngine.provenDo("mode", "original")
            val r = CollectionEngine.act("provenSave", JsonObject(), 20_000)
            val made = JsonParser.parseString(r.s("made")).asJsonObject
            assertEquals("tdeck", made.s("go")); assertEquals("ygo", made.s("game"))
            assertTrue(saved().getAsJsonObject("tcg").getAsJsonObject("ygo").objs("decks").any { it.s("id") == made.s("id") && it.s("name") == "Dark Magician · original" })
        } finally { CollectionEngine.store = was }
    }
}
