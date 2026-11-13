package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonObject
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * The search box answers questions with no AI (Randall 13 Nov): answer-search.js and answer-run.js in the Collection engine, against
 * the live card, set, tournament and wiki services. Any call to /api/ai fails the test.
 */
class AnswerEngineTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
    private fun JsonObject.list(k: String) = getAsJsonArray(k)?.map { it.asJsonObject }.orEmpty()

    @Test fun questionsAreAnsweredFromTheAppsOwnData() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(JsonObject(), null)
        var ai = 0
        CollectionEngine.answerForTest = { url -> if (url.contains("/api/ai/")) { ai++; 500 to "{}" } else null }
        try {
            // The answers as they came back are kept for the picture test (AnswerCardShotTest), with the tiles' art.
            val out = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home").apply { mkdirs() }
            fun sha1(u: String) = java.security.MessageDigest.getInstance("SHA-1").digest(u.toByteArray()).joinToString("") { "%02x".format(it) }
            fun keep(name: String, m: JsonObject?) { if (m == null) return
                File(out, "answer-$name.json").writeText(m.toString())
                val a = m.o("answer") ?: return
                for (t in a.list("items") + a.list("more")) t.s("art").takeIf { it.startsWith("https://") }?.let { u -> val f = File(out, sha1(u) + ".jpg")
                    if (!f.exists()) runCatching { f.writeBytes(java.net.URI(u).toURL().openStream().use { it.readBytes() }) }.onFailure { println("ART MISSING $u") } } }
            val names = mapOf("whats the best deck out right now in meta" to "meta", "most expensive card in bloomburrow" to "set", "who won magic's tournament in 1999" to "wiki",
                "what does ward do" to "keyword", "cheapest red dragon legal in standard" to "filter", "is blue better than red" to "miss", "can a creature attack the turn it enters" to "rule", "what is the most expensive card in this set" to "which")
            suspend fun ask(q: String, opts: JsonObject = JsonObject(), game: String = "mtg") = CollectionEngine.searchAnswer(game, q, opts, 60_000).also { println("ANSWER[$q] ${it.toString().take(1800)}")
                if (opts.size() == 0) names[q]?.let { n -> keep(n, it) } }
            // A hand-typed search line and a card name are not questions; a question is.
            assertEquals("none", CollectionEngine.searchAsks("mtg", "c:r t:dragon f:standard")); assertEquals("none", CollectionEngine.searchAsks("mtg", "lightning bolt"))
            assertEquals("answer", CollectionEngine.searchAsks("mtg", "best deck in the meta")); assertEquals("miss", CollectionEngine.searchAsks("mtg", "is blue better than red"))

            // Randall's first example: the tournament decks, the format read from the words, the chip offering the other formats.
            var m = ask("whats the best deck out right now in meta")!!
            var a = m.o("answer")!!
            assertTrue(a["ok"].asBoolean); assertTrue(a.s("strong").isNotBlank()); assertTrue(a.s("say"), a.s("say").contains("most played Standard deck"))
            assertEquals(listOf("game", "format"), m.list("read").take(2).map { it.s("kind") })
            assertTrue(m.list("read")[1].getAsJsonArray("choices").any { it.asString == "Modern" })
            val deck = a.list("items").single()
            assertEquals("meta", deck.o("show")!!.s("kind"))
            assertEquals("show", a.list("buttons")[0].o("dest")!!.s("to"))
            // The tile opens the tournament deck's own sheet.
            assertEquals("meta", CollectionEngine.askShow(deck.o("show")!!)!!.s("to"))
            // A tapped chip: the same words, another format.
            m = ask("whats the best deck out right now in meta", JsonObject().apply { add("fix", JsonObject().apply { addProperty("format", "Modern") }) })!!
            assertTrue(m.o("answer")!!.s("say").contains("most played Modern deck"))

            // His second: the set's prices, the set from the words; "this set" asks which when no set is open, and uses the open one.
            m = ask("most expensive card in bloomburrow")!!; a = m.o("answer")!!
            assertTrue(a.s("say"), Regex("""is the most expensive card in Bloomburrow at \$\d+\.\d\d\.""").matches(a.s("say")))
            val card = a.list("items").single()
            assertTrue(card.s("art").startsWith("https://")); assertTrue(card.s("price").startsWith("$"))
            assertEquals("card", CollectionEngine.askShow(card.o("show")!!)!!.s("to"))
            assertEquals(2, a.list("more").size)
            m = ask("what is the most expensive card in this set")!!
            assertEquals("Which set?", m.o("answer")!!.o("ask")!!.s("ask"))
            m = ask("what is the most expensive card in this set", JsonObject().apply { add("set", JsonObject().apply { addProperty("id", "blb"); addProperty("code", "blb"); addProperty("name", "Bloomburrow") }) })!!
            assertTrue(m.o("answer")!!.s("say").contains("Bloomburrow"))

            // The wiki's fact box.
            m = ask("who won magic's tournament in 1999")!!; a = m.o("answer")!!
            assertEquals("1999 World Championships", a.s("strong")); assertEquals("Winner", a.o("fact")!!.s("label")); assertTrue(a.o("fact")!!.s("value").contains("Kai Budde"))
            assertEquals("wiki", a.list("buttons")[0].o("dest")!!.s("to")); assertEquals("1999 World Championships", a.list("buttons")[0].o("dest")!!.s("topic"))

            // A keyword from the app's own rules book; prices; artists; filters; actions.
            a = ask("what does ward do")!!.o("answer")!!
            assertEquals("Ward", a.s("strong")); assertTrue(a.s("quote").contains("unless that player pays")); assertEquals("judge", a.list("buttons").last().o("dest")!!.s("to"))
            a = ask("how much is lightning bolt")!!.o("answer")!!
            assertEquals("Lightning Bolt", a.s("strong")); assertTrue(a.s("say"), a.s("say").startsWith("is $"))
            a = ask("cards by rebecca guay")!!.o("answer")!!
            assertTrue(a.list("items").isNotEmpty()); assertEquals("a:\"rebecca guay\"", a.list("buttons")[0].o("dest")!!.s("q"))
            a = ask("cheapest red dragon legal in standard")!!.o("answer")!!
            val go = a.list("buttons")[0].o("dest")!!
            assertEquals("search", go.s("to")); assertEquals("c:r t:dragon f:standard", go.s("q")); assertEquals("usdAsc", go.s("sort"))
            // "See them all in Search": the Search page takes the words and the sort.
            CollectionEngine.searchAnswerSearch(go.s("q"), go.s("sort")); CollectionEngine.settle(60_000)
            val page = CollectionEngine.searchModel()
            assertEquals("c:r t:dragon f:standard", page.s("term"))
            assertTrue(page.getAsJsonArray("blocks").map { it.asJsonObject }.first { it.s("kind") == "tiles" }.getAsJsonArray("tiles").size() >= 3)
            // A typed deck request sets up the app's Build a deck from its words; nothing is drafted by AI.
            a = ask("build me a mono red goblin deck for modern under $50")!!.o("answer")!!
            val build = a.list("buttons")[0].o("dest")!!
            assertEquals("build", build.s("to")); assertEquals("""{"game":"mtg","format":"Modern","colors":["R"],"theme":"Goblins","budget":"50"}""", build.o("request").toString())
            a = ask("scan a card")!!.o("answer")!!
            assertEquals("#scan", a.list("buttons")[0].o("dest")!!.s("hash"))
            a = ask("best pokemon deck")!!.o("answer")!!
            assertTrue(a.toString(), a["ok"].asBoolean)

            // What the app's data can't answer is said plainly; a card name gets no answer card.
            a = ask("is blue better than red")!!.o("answer")!!
            assertFalse(a["ok"].asBoolean); assertTrue(a.s("miss").isNotBlank())
            // A rules question typed in the search box: the rule that covers it, quoted from the rulebook, with the Judge one tap away.
            a = ask("can a creature attack the turn it enters")!!.o("answer")!!
            assertTrue(a.toString(), a["ok"].asBoolean); assertEquals("Rule 302.6", a.s("strong")); assertTrue(a.s("quote").contains("can’t attack unless"))
            assertEquals("judge", a.list("buttons")[0].o("dest")!!.s("to")); assertEquals("can a creature attack the turn it enters", a.list("buttons")[0].o("dest")!!.s("text"))
            assertEquals("answer", CollectionEngine.searchAsks("mtg", "can a creature attack the turn it enters"))
            assertNull(ask("lightning bolt")); assertNull(ask(""))
            assertEquals("no AI was asked", 0, ai)
        } finally { CollectionEngine.answerForTest = null }
    }
    /**
     * Seen on a phone in 0.4.72: "best red deck" answered with a blue deck, the word "red" dropped. Every word is now used or the
     * card says it can't use it. Live tournament data, so the deck's name is not fixed here: its colours are.
     */
    @Test fun noWordOfAQuestionIsDropped() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(JsonObject(), null)
        suspend fun ask(q: String) = CollectionEngine.searchAnswer("mtg", q, JsonObject(), 90_000).also { println("ANSWER[$q] ${it.toString().take(1500)}") }!!
        var m = ask("best red deck"); var a = m.o("answer")!!
        assertTrue(m.list("read").any { it.s("label") == "has red" })
        if (a["ok"].asBoolean) { assertTrue(a.s("say"), a.s("say").contains("most played Standard deck with red in it")); assertTrue(a.s("note"), Regex("""^Colours: [a-z, ]*red""").containsMatchIn(a.s("note"))) }
        else assertEquals("No Standard deck with red in it is among the tournament decks right now.", a.s("miss"))
        a = ask("best mono white deck").o("answer")!!
        if (a["ok"].asBoolean) { assertTrue(a.s("say").contains("most played mono-white Standard deck")); assertTrue(a.s("note"), a.s("note").startsWith("Colours: white ·") || a.s("note") == "Colours: white") }
        else assertEquals("No mono-white Standard deck is among the tournament decks right now.", a.s("miss"))
        a = ask("best izzet deck").o("answer")!!
        if (a["ok"].asBoolean) assertTrue(a.s("note"), a.s("note").startsWith("Colours: blue, red")) else assertTrue(a.s("miss").startsWith("No Izzet Standard deck"))
        a = ask("best zzyzx deck").o("answer")!!
        assertFalse(a["ok"].asBoolean); assertTrue(a.s("miss"), a.s("miss").contains("is named \"zzyzx\" or plays a card named \"zzyzx\""))
        a = ask("best deck last year").o("answer")!!
        assertFalse(a["ok"].asBoolean); assertTrue(a.s("miss").contains("recent events"))
        a = ask("is sol ring banned in commander").o("answer")!!
        assertEquals("Sol Ring", a.s("strong")); assertEquals("is legal in Commander.", a.s("say"))
        a = ask("how much is a foil lightning bolt").o("answer")!!
        assertEquals("Lightning Bolt", a.s("strong")); assertTrue(a.s("say"), a.s("say").endsWith("in foil."))
        a = ask("my most valuable red card").o("answer")!!
        assertFalse(a["ok"].asBoolean); assertTrue(a.s("miss").contains("can't narrow your collection by \"red\""))
        Unit
    }
    /** The same rule in Pokémon and Yu-Gi-Oh! (Randall 13 Nov: "is it full of bugs too?"). Live data: names are not fixed, the reading is. */
    @Test fun pokemonAndYugiohQuestionsKeepTheirWords() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(JsonObject(), null)
        suspend fun ask(g: String, q: String) = CollectionEngine.searchAnswer(g, q, JsonObject(), 90_000).also { println("ANSWER[$g: $q] ${it.toString().take(1500)}") }
        var a = ask("ygo", "is pot of greed banned")!!.o("answer")!!
        assertEquals("Pot of Greed", a.s("strong")); assertEquals("is Forbidden on the TCG list: no copies allowed.", a.s("say"))
        a = ask("ygo", "is dark magician limited")!!.o("answer")!!
        assertEquals("is not on the TCG Forbidden & Limited list: 3 copies allowed.", a.s("say"))
        a = ask("ptcg", "is pikachu legal in standard")!!.o("answer")!!
        assertTrue(a.toString(), if (a["ok"].asBoolean) Regex("""^is (not )?legal in Standard\.$""").matches(a.s("say")) else a.s("miss").contains("Standard legality"))
        var m = ask("ptcg", "best charizard deck")!!; a = m.o("answer")!!
        assertTrue(m.list("read").any { it.s("label") == "\"charizard\"" })
        if (a["ok"].asBoolean) assertTrue(a.s("strong") + " " + a.s("say"), (a.s("strong") + a.s("say")).contains("harizard")) else assertTrue(a.s("miss"), a.s("miss").contains("\"charizard\""))
        m = ask("ygo", "best blue eyes deck")!!; a = m.o("answer")!!
        if (a["ok"].asBoolean) assertTrue(a.s("strong"), a.s("strong").replace("-", " ").contains("Blue Eyes", true)) else assertTrue(a.s("miss"), a.s("miss").contains("\"blue eyes\""))
        a = ask("ptcg", "how much is a holo charizard")!!.o("answer")!!
        assertFalse(a["ok"].asBoolean); assertTrue(a.s("miss").contains("finish, edition or rarity"))
        a = ask("ygo", "my most valuable card")!!.o("answer")!!
        assertFalse("an empty collection is said, not guessed", a["ok"].asBoolean)
        for ((g, q) in listOf("ptcg" to "trainer cards", "ygo" to "spell cards")) { val r = ask(g, q); assertTrue("$q is not an artist", r == null || !r.toString().contains("artist")) }
        Unit
    }

    /** The hard round (Randall, 13 Nov 2026): several asks on one line, misspellings, and deck requests with a friend's deck in them. */
    @Test fun hardQuestionsAreAnsweredInTheApp() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(JsonObject(), null)
        suspend fun ask(g: String, q: String) = CollectionEngine.searchAnswer(g, q, JsonObject(), 90_000).also { println("HARD[$g: $q] ${it.toString().take(1800)}") }
        var m = ask("mtg", "what is the best red deck, how much does it cost and where did it place?")!!; var a = m.o("answer")!!
        assertTrue(m.list("read").any { it.s("label") == "+ 2 more asks" })
        if (a["ok"].asBoolean) {
            assertTrue(a.s("note"), a.s("note").contains("red"))
            assertTrue(a.s("note"), a.s("note").contains("\nhow much does it cost: ") && a.s("note").contains("\nwhere did it place: "))
        }
        m = ask("mtg", "bset modren deck")!!
        assertTrue(m.list("read").map { it.s("label") }.toString(), m.list("read").any { it.s("label") == "\"bset\" read as best" } && m.list("read").any { it.s("label") == "Modern" })
        m = ask("mtg", "what is the funnest deck I can play with mono red and my friend has a blue deck")!!; a = m.o("answer")!!
        assertTrue(m.list("read").any { it.s("label") == "against blue" })
        // The deck brief: each setting the builder gets is a row, and the friend's colour asks for cards that answer it.
        assertEquals("The deck builder is set up from your words.", a.s("say"))
        assertEquals(listOf("Colours: red", "Answers for: blue", "Goal: a fun deck"), a.list("rows").map { it.s("label") + ": " + it.s("value") })
        assertTrue(a.s("note"), a.s("note").contains("does not know how the matchup plays"))
        a = ask("mtg", "what is a ramp deck that I can purchase for under \$50")!!.o("answer")!!
        assertEquals(listOf("Play style: more ramp", "Budget: under \$50"), a.list("rows").map { it.s("label") + ": " + it.s("value") }); assertEquals("", a.s("note"))
        a = ask("mtg", "build me a bracket 3 izzet commander ramp deck")!!.o("answer")!!
        assertEquals(listOf("Format: Commander", "Colours: blue, red", "Play style: more ramp", "Power: bracket 3 (Upgraded)"), a.list("rows").map { it.s("label") + ": " + it.s("value") })
        // A whole pod in one breath, as dictated.
        m = ask("mtg", "I'm playing in a pod with three other people. They have a blue, white, a red, blue, and a black mono deck, and I have this commander, and I'm trying to make it within their power level or within their bracket, so we're all having fun. And I noticed last time we played, a lot of them didn't have reach, so I would like to have flying if that's possible.")!!; a = m.o("answer")!!
        assertEquals(listOf("Magic", "deck builder", "pod of 4", "against white-blue · blue-red · mono-black", "match the pod's power", "pod lacks reach"), m.list("read").map { it.s("label") })
        assertEquals(listOf("Format: Commander", "Theme: flying (the pod lacks reach)", "Answers for: white, blue, black, red", "Goal: a fun deck"), a.list("rows").map { it.s("label") + ": " + it.s("value") })
        assertTrue(a.s("note"), a.s("note").contains("pod's power is not known to the app"))
        a = ask("ygo", "what's a really cool Blue Eyes White Dragon deck that would surprise my friend")!!.o("answer")!!
        assertTrue(a.list("rows").toString(), a.list("rows").any { it.s("label") == "Built around" && it.s("value") == "blue eyes white dragon" } && a.list("rows").any { it.s("label") == "Not used" && it.s("value") == "\"would surprise my friend\"" })
        // The seven ideas, read in the app's engine as on the site: each question goes to its own answer, with what it read shown.
        for ((q, intent) in listOf("is my goblin deck legal in modern" to "your deck \"goblin\"", "how do i make my goblin deck better" to "closest tournament list",
            "what went up in my collection this week" to "saved prices", "what deck is getting more popular in standard" to "rising over 7 days", "what beats my goblin deck" to "simulated games")) {
            val x = ask("mtg", q)!!
            assertTrue(q + " -> " + x.list("read").map { it.s("label") }, x.list("read").any { it.s("label") == intent })
        }
        Unit
    }
}
