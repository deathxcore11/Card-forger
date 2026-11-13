package dev.cardstashy.nativeplay.collection

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
 * Gap audit H4 step 1: Ask a Judge runs the site's own ai-rules.js in the Collection engine. The rules server (/api/ai/ask) is stood
 * in for here with one answer of each kind; the site's check of every answer (validateRulesResponse) and the rulebook are real.
 */
class JudgeEngineTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private val mtg = "c7f3846b799a29021d011421770f5383ffa9283421b4fdf1efb57609b10c11c6"

    private fun section(text: String, vararg ids: String) = """{"text":${com.google.gson.JsonPrimitive(text)},"citationIds":[${ids.joinToString(",") { "\"$it\"" }}]}"""
    private fun reply(format: String, status: String, short: String, cited: Boolean, questions: String = "[]") = """{"context":{"mode":"rules","game":"mtg","format":"$format","version":"$mtg"},
        "answer":{"status":"$status","shortAnswer":${section(short, *(if (cited) arrayOf("mtg:0:702.9b") else arrayOf()))},
        "explanation":[${if (cited) section("Only a creature with flying or reach can block it.", "mtg:0:702.9b") else section("")}],"example":${section("")},"details":[],
        "questions":$questions,"limitations":["Comprehensive Rules only."],"disclaimer":"AI interpretation, not an official judge or guaranteed ruling.",
        "citations":[${if (cited) """{"id":"mtg:0:702.9b","quote":"A creature with flying can’t be blocked except by creatures with flying and/or reach.","reference":{"kind":"bundled-entry","game":"mtg","version":"$mtg","doc":0,"entryId":"702.9b","label":"702.9b"}}""" else ""}]}}"""

    private fun lines(m: JsonObject) = m["lines"].asJsonArray.map { it.asJsonObject }

    @Test fun formatFirstThenEachKindOfAnswer() { runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(JsonObject(), null)
        CollectionEngine.auth("test-token")
        val replies = ArrayDeque(listOf(
            reply("Standard", "answered", "No. Only a creature with flying or reach can block it.", true),
            reply("Standard", "needs_context", "Which blocker do you mean?", false, """["Does the blocker have reach?"]"""),
            reply("Standard", "insufficient_evidence", "The indexed rules don't settle this.", false),
            reply("Modern", "answered", "No.", true)))
        val sent = mutableListOf<String>()
        CollectionEngine.answerForTest = { url -> if (url.startsWith("https://cardstashy.com/api/ai/ask")) { sent += url; 200 to replies.removeFirst() } else null }
        try {
            var m = CollectionEngine.judgeOpen(JsonObject().apply { addProperty("game", "mtg") })
            println("OPEN $m")
            assertEquals("AI rules guide · Magic", m["eyebrow"].asString)
            assertEquals("Ask a Judge", m["title"].asString)
            assertEquals("Choose your format first", m["hello"].asString)
            assertEquals("Choose a format before asking. Rules can differ between formats.", m["formatHint"].asString)
            assertTrue(m["sendLocked"].asBoolean)
            assertEquals(listOf("Can a creature attack the turn it enters?", "How does priority work?", "How do flying and reach interact?"), m["examples"].asJsonArray.map { it.asString })
            assertTrue(m["formats"].asJsonArray.any { it.asJsonObject["value"].asString == "Standard" })

            // No format: nothing is sent, the site's line says why.
            m = CollectionEngine.judgeSend("Can my bear block a flier?")
            assertEquals("Choose a format before asking. Your question is still here.", m["status"].asString)
            assertEquals(0, sent.size)

            m = CollectionEngine.judgeFormat("Standard")
            assertEquals("Standard", m["format"].asString); assertFalse(m["sendLocked"].asBoolean); assertEquals("", m["formatHint"].asString)
            assertEquals("What happened at the table?", m["hello"].asString)

            CollectionEngine.judgeSend("Can my bear block a flier?")
            m = CollectionEngine.judgeWait(60_000)
            println("ANSWERED $m")
            var a = lines(m).last()
            assertEquals("answered", a["status"].asString)
            assertEquals("From the indexed rules · AI interpretation", a["source"].asString)
            assertEquals("No. Only a creature with flying or reach can block it.", a["short"].asString)
            val cite = a["citations"].asJsonArray.single().asJsonObject
            assertTrue(cite["title"].asString.startsWith("702.9b"))
            assertEquals("702.9b", cite["reference"].asJsonObject["entryId"].asString)
            assertEquals("Rules explanation ready.", m["status"].asString)

            CollectionEngine.judgeSend("What if it has reach?")
            a = lines(CollectionEngine.judgeWait(60_000)).last()
            assertEquals("needs_context", a["status"].asString); assertEquals("One detail first", a["source"].asString)
            assertEquals(listOf("Does the blocker have reach?"), a["questions"].asJsonArray.map { it.asString })

            CollectionEngine.judgeSend("And with a hexproof flier?")
            m = CollectionEngine.judgeWait(60_000)
            a = lines(m).last()
            assertEquals("insufficient_evidence", a["status"].asString); assertEquals("Evidence is limited", a["source"].asString)

            // An answer for another format is refused: no ruling is shown.
            CollectionEngine.judgeSend("One more?")
            m = CollectionEngine.judgeWait(60_000)
            val e = lines(m).last()
            assertEquals("error", e["who"].asString)
            assertEquals("This answer did not match the selected game, format and source edition.", e["text"].asString)
            assertEquals(8, lines(m).size)

            // New chat starts over, format kept.
            m = CollectionEngine.judgeNew()
            assertEquals(0, lines(m).size); assertEquals("Standard", m["format"].asString)
            CollectionEngine.judgeClose()
            assertFalse(CollectionEngine.judgeModel()["open"].asBoolean)
        } finally { CollectionEngine.answerForTest = null }
    } }
}
