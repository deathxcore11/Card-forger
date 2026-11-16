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
 * Gap audit H4 steps 2 to 4: the Rules page's Ask a Judge press hands the app the site's context (app.js A.askRules: game and format),
 * which opens the app's chat instead of the website; a judge's citation opens that exact rule on the app's Rules page; a page without
 * the rule's section says so (the app then shows the rule's words in its place).
 */
class JudgeEntryTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private fun nodes(e: com.google.gson.JsonElement?): List<JsonObject> = if (e == null || !e.isJsonObject) emptyList() else e.asJsonObject.let { o -> listOf(o) + (o.getAsJsonArray("k")?.flatMap { nodes(it) } ?: emptyList()) }
    private fun txt(o: JsonObject): String = (o.getAsJsonArray("k")?.joinToString("") { if (it.isJsonPrimitive) it.asString else txt(it.asJsonObject) }).orEmpty()

    @Test fun rulesPagePressAndCitation() { runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        CollectionEngine.load(JsonObject(), null)
        // Not on the Rules page: nothing to open the rule on.
        CollectionEngine.learnGame("mtg")
        val ref = JsonParser.parseString("""{"kind":"bundled-entry","game":"mtg","version":"c7f3846b799a29021d011421770f5383ffa9283421b4fdf1efb57609b10c11c6","doc":0,"entryId":"702.9b","label":"702.9b"}""").asJsonObject
        assertFalse(CollectionEngine.ruleOpen(ref)["opened"]?.asBoolean ?: true)

        val m = CollectionEngine.rulesPage("mtg")
        val ask = nodes(m["body"]).first { it.getAsJsonObject("a")?.get("data-act")?.asString == "askRules" }
        val tapped = CollectionEngine.panelTap(ask["i"].asInt)
        val acted = tapped["acted"].asJsonObject
        assertEquals("askRules", acted["act"].asString)
        val ctx = JsonParser.parseString(acted["data"].asJsonObject["judge"].asString).asJsonObject
        println("JUDGE CONTEXT $ctx")
        assertEquals("mtg", ctx["game"].asString)
        assertTrue(ctx.has("format") && ctx["cards"].asJsonArray.size() == 0)

        // The citation: the exact rule, opened on the Rules page (rule-learning.js openRuleReference, the rulebook loaded).
        var last = CollectionEngine.ruleOpen(ref)
        CollectionEngine.settle(60_000, CollectionEngine.PANEL_MODEL) { if (it.has("key")) last = it }
        val all = txt(last["body"].asJsonObject)
        println("RULE ${all.take(600)}")
        assertTrue(all.take(400), all.contains("702.9b") && all.contains("can’t be blocked except by creatures with flying"))
    } }
}
