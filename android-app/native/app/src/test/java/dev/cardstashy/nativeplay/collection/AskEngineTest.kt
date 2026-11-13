package dev.cardstashy.nativeplay.collection

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Gap audit H3 step 1: Ask CardStashy runs the site's own ai-ask.js, ai-tools.js and ai-ask-loop.js in the Collection engine and the
 * chat is read back from the page the site writes. The assistant's server (/api/ai/ask) is stood in for here; the tools are real.
 */
class AskEngineTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")

    private fun start() = runBlocking {
        CollectionEngine.store = CollectionEngine.MemoryStore()
        CollectionEngine.initFrom(bundle); CollectionEngine.restart()
        CollectionEngine.load(com.google.gson.JsonObject(), null)
    }

    @Test fun greetingQuestionAnswerAndTile() = runBlocking {
        assumeTrue(bundle.isFile)
        start()
        var asked = 0
        CollectionEngine.answerForTest = { url ->
            if (!url.startsWith("https://cardstashy.com/api/ai/ask")) null
            else if (asked++ == 0) 200 to """{"calls":[{"type":"function_call","name":"my_collection","call_id":"c1","arguments":"{\"game\":\"mtg\"}"}]}"""
            else 200 to """{"answer":{"text":"Your collection is empty, so there is no most valuable card yet.","source":"app","show":[{"kind":"card","game":"mtg","ref":"Lightning Bolt","label":"Lightning Bolt"}],"suggestions":["How do I add cards?"]}}"""
        }
        try {
            var m = CollectionEngine.askOpen("mtg")
            println("OPEN $m")
            assertEquals("Ask CardStashy", m["title"].asString)
            assertEquals("What do you want to know about your Magic cards?", m["hello"].asString)
            assertEquals(4, m["examples"].asJsonArray.size())
            assertTrue(m["examples"].asJsonArray.any { it.asString == "What's my most valuable card?" })

            CollectionEngine.auth("test-token")
            m = CollectionEngine.askSend("mtg", "What's my most valuable card?")
            assertTrue(m["busy"].asBoolean)
            assertEquals(listOf("me", "thinking"), m["lines"].asJsonArray.map { it.asJsonObject["who"].asString })
            m = CollectionEngine.askWait(60_000)
            println("ANSWER $m")
            assertFalse(m["busy"].asBoolean)
            assertEquals(2, asked)
            val lines = m["lines"].asJsonArray.map { it.asJsonObject }
            assertEquals(listOf("me", "ai"), lines.map { it["who"].asString })
            assertEquals("What's my most valuable card?", lines[0]["text"].asString)
            val a = lines[1]
            assertEquals("From your app data", a["source"].asString)
            assertEquals("app", a["sourceKind"].asString)
            assertEquals("Your collection is empty, so there is no most valuable card yet.", a["text"].asString)
            assertEquals(listOf("How do I add cards?"), a["follow"].asJsonArray.map { it.asString })
            val tile = a["items"].asJsonArray.single().asJsonObject
            assertTrue(tile.toString(), tile["title"].asString.contains("Lightning Bolt") || tile["label"].asString.contains("Lightning Bolt"))

            val dest = CollectionEngine.askShow(tile["show"].asJsonObject)
            println("DEST $dest")
            assertEquals("card", dest!!["to"].asString)
            assertEquals("mtg", dest["game"].asString)
            assertEquals("Lightning Bolt", dest["name"].asString)

            // The chat is kept; New chat starts over with the greeting.
            assertEquals(2, CollectionEngine.askOpen("mtg")["lines"].asJsonArray.size())
            m = CollectionEngine.askNew("mtg")
            assertEquals(0, m["lines"].asJsonArray.size())
            assertEquals(4, m["examples"].asJsonArray.size())
        } finally { CollectionEngine.answerForTest = null }
    }

    @Test fun signedOutGetsTheSitesSignInLine() = runBlocking {
        assumeTrue(bundle.isFile)
        start()
        CollectionEngine.answerForTest = { url -> if (url.startsWith("https://cardstashy.com/api/ai/ask")) 401 to """{"error":"unauthorized"}""" else null }
        try {
            CollectionEngine.auth("")
            CollectionEngine.askOpen("ygo")
            CollectionEngine.askSend("ygo", "What does Ash Blossom do?")
            val m = CollectionEngine.askWait(30_000)
            println("SIGNED OUT $m")
            val last = m["lines"].asJsonArray.last().asJsonObject
            assertEquals("error", last["who"].asString)
            assertEquals("Sign in to your CardStashy profile to use AI, then try again. Your cards and drafts are still here.", last["text"].asString)
            assertEquals("What do you want to know about your Yu-Gi-Oh! cards?", CollectionEngine.askNew("ygo")["hello"].asString)
        } finally { CollectionEngine.answerForTest = null }
    }
}
