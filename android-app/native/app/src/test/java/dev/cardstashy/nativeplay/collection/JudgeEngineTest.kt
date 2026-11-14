package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonObject
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Ask a Judge without AI: the Collection engine answers a rules question from the rulebook shipped inside the app (judge-search.js).
 * The network is refused for the whole test, so every answer here is an offline answer; no AI service is ever asked.
 */
class JudgeEngineTest {
    private val repo = File(System.getProperty("repoRoot"))
    private val bundle = File(repo, "android-app/native/app/src/main/assets/collection-engine.js")
    private fun lines(m: JsonObject) = m["lines"].asJsonArray.map { it.asJsonObject }
    private fun rules(l: JsonObject) = l["rules"].asJsonArray.map { it.asJsonObject }

    @Test fun answersFromTheShippedRulebookWithNoNetwork() { runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(JsonObject(), null)
        // What prepare-assets.sh ships under assets/rulebooks: the repo's rulebooks and the card-name list.
        CollectionEngine.shipped = { name -> name.removePrefix("rulebooks/").let { f -> listOf(File(repo, "rulebooks/$f"), File(repo, f)).firstOrNull { it.isFile }?.readBytes() } }
        val asked = mutableListOf<String>()
        CollectionEngine.answerForTest = { url -> asked += url; 503 to "" }
        try {
            var m = CollectionEngine.judgeOpen(JsonObject().apply { addProperty("game", "mtg") })
            assertEquals("Magic rulebook · offline", m["eyebrow"].asString)
            assertEquals("Ask a Judge", m["title"].asString)
            assertEquals("Can a creature attack the turn it enters?", m["examples"].asJsonArray[0].asString)
            assertFalse(m.has("formats"))

            suspend fun ask(q: String): JsonObject { m = CollectionEngine.judgeSend(q); assertTrue(m["busy"].asBoolean); m = CollectionEngine.judgeWait(); assertFalse(m["busy"].asBoolean); return lines(m).last() }

            var a = ask("can a creature attack the turn it enters")
            println("JUDGE 1 $a")
            assertEquals("judge", a["who"].asString); assertEquals("answered", a["status"].asString)
            assertEquals(listOf("summoning sickness"), a["read"].asJsonArray.map { it.asString })
            assertEquals("302.6", rules(a)[0]["number"].asString); assertEquals("Creatures", rules(a)[0]["heading"].asString); assertTrue(rules(a)[0]["lead"].asBoolean)
            assertTrue(rules(a)[0]["text"].asString.contains("can’t attack unless it has been under its controller’s control continuously"))
            assertEquals("bundled-entry", rules(a)[0]["reference"].asJsonObject["kind"].asString)
            assertTrue(rules(a).any { it["heading"].asString == "Haste" })
            assertTrue(a["foot"].asString.startsWith("Comprehensive Rules, Sept. 25, 2026."))

            a = ask("does deathtouch work with trample")
            assertEquals(listOf("Deathtouch", "Trample"), a["read"].asJsonArray.map { it.asString })
            assertEquals(listOf("702.2c", "702.19b"), rules(a).take(2).map { it["number"].asString })
            assertTrue(rules(a)[1]["whole"].asString.length > rules(a)[1]["text"].asString.length)

            a = ask("does lifelink stack")
            assertEquals("Multiple instances of lifelink on the same object are redundant.", rules(a)[0]["text"].asString)

            a = ask("is blue better than red")
            assertEquals("none", a["status"].asString); assertEquals("That isn’t in the rulebook", a["missTitle"].asString)

            // New: the questions are cleared, the Judge stays open.
            // The chat as the app draws it (JudgeShotTest reads it back).
            File(repo, "android-app/native/app/build/shot-art/home").apply { mkdirs() }.resolve("judge-chat.json").writeText(m.toString())
            m = CollectionEngine.judgeNew(); assertEquals(0, lines(m).size); assertTrue(m["open"].asBoolean)
            CollectionEngine.judgeClose()

            // Pokémon: the rulebook page cut to the sentences asked about, plus the app's own term note, marked as ours.
            m = CollectionEngine.judgeOpen(JsonObject().apply { addProperty("game", "ptcg"); addProperty("question", "what does poisoned do") })
            assertTrue(m["busy"].asBoolean); m = CollectionEngine.judgeWait()
            a = lines(m).last()
            println("JUDGE PTCG $a")
            assertEquals("Page 16", rules(a)[0]["number"].asString); assertEquals("Pokémon rulebook", rules(a)[0]["heading"].asString)
            assertTrue(rules(a)[0]["text"].asString.contains("During Pokémon Checkup, place a damage counter on your Poisoned Pokémon"))
            assertTrue(a["terms"].asJsonArray[0].asJsonObject["ours"].asBoolean)
            CollectionEngine.judgeClose()

            assertTrue("no AI service is asked: $asked", asked.none { it.contains("/api/ai") })
            assertTrue("the rulebook and names come from inside the app: $asked", asked.none { it.contains("/rulebooks/") || it.contains("forge-card-names") })
        } finally { CollectionEngine.answerForTest = null; CollectionEngine.shipped = null }
    } }
}
