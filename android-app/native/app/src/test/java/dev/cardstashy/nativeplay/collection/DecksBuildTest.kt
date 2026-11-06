package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Yu-Gi-Oh! and Pokémon's Build a deck in the engine (flowTcgCalls, deck-experience.js over the site's pipeline with tcg.js), offline:
 * Pick cards to build around (tcg.js tcgPickSheet as data), A.tSeedGo handing its openDeckFlow request back, the setup drawn on that
 * request (its card and the "Required cards" line), and a finished deck saved into that game's decks (app.js deckExperience save).
 * A whole build needs the live card search; the flowprobe harness checked those (the shot fixtures build-deck/tcg-*.json).
 */
class DecksBuildTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    private suspend fun flow(name: String, a: JsonObject) = CollectionEngine.flow(name, a, 20_000)

    @Test fun yugiohBuildAround() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.restart(); CollectionEngine.initFrom(bundle); DecksIdeasTest.yugioh()
        // ☑ Pick cards to build around: the player's cards, sorted by name, each once.
        val pick = CollectionEngine.seedPick("ygo")
        assertEquals("Pick cards to build around", pick.s("title"))
        assertTrue(pick.s("intro").contains("archetypes (up to 3)"))
        assertEquals("Filter your cards", pick.s("placeholder"))
        val rows = pick.getAsJsonArray("rows").map { it.asJsonObject }
        assertTrue(rows.any { it.s("name") == "Dark Magician" } && rows.any { it.s("name") == "Dark Magician Girl" })
        assertEquals(rows.map { it.s("name") }.sorted(), rows.map { it.s("name") })
        assertEquals("Pick cards to build around", pick.s("go"))
        // ⚒ Build with 2 cards (A.tSeedGo → A.tBuildMulti → openDeckFlow): the request comes back with both cards.
        val ids = rows.filter { it.s("name").startsWith("Dark Magician") }.joinToString(",") { it.s("id") }
        val r = CollectionEngine.act("tSeedGo", JsonObject().apply { addProperty("game", "ygo"); addProperty("ids", ids) })
        assertEquals("", r.s("error"))
        val req = JsonParser.parseString(r.s("made")).asJsonObject
        assertEquals("ygo", req.s("game"))
        assertEquals(2, req.getAsJsonArray("seedCards").size())
        // The setup on that request: the featured card and "Required cards: …".
        val setup = flow("flowSetup", JsonObject().apply { add("request", req) }).obj!!
        assertEquals(req.s("seed"), setup.getAsJsonObject("seed").s("name"))
        assertTrue(setup.s("required").startsWith("Required cards: "))
        assertEquals("Generate deck", setup.s("generate"))
        assertTrue(setup.getAsJsonObject("format").getAsJsonArray("options").any { it.asJsonObject.s("value") == "tcg" })
        // A finished deck saved: into Yu-Gi-Oh!'s decks, named after its card and format, with its format and time.
        val deck = JsonParser.parseString("""{"zones":{"main":[{"cardId":"46986414","name":"Dark Magician","qty":3}],"extra":[],"side":[]},"format":"tcg"}""").asJsonObject
        val save = CollectionEngine.act("deckGenerated", JsonObject().apply { add("deck", deck); add("request", req.deepCopy().apply { addProperty("formatName", "Advanced (TCG)"); addProperty("format", "tcg") }) })
        assertEquals("", save.s("error"))
        val saved = JsonParser.parseString(CollectionEngine.saved()).asJsonObject["tcg"].asJsonObject["ygo"].asJsonObject["decks"].asJsonArray.map { it.asJsonObject }
        val made = saved.single { it.s("id") == save.s("made") }
        assertEquals(req.s("seed") + " · Advanced (TCG)", made.s("name"))
        assertEquals("tcg", made.s("format"))
        assertTrue(made.s("createdAt").isNotBlank())
    }
}
