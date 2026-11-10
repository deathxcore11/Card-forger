package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.match.storyTitle
import dev.cardstashy.nativeplay.match.storyWho
import dev.cardstashy.nativeplay.play.PlayRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** E9: broken data shows an Error state, never a crash. */
class EmptyRulesTest {
    private fun res(n: String) = JsonParser.parseString(javaClass.classLoader!!.getResource(n)!!.readText()).asJsonObject

    @Test fun rulesWithNoActsReadAsEmpty() {
        val rules = PlayRules(res("play-rules.json"), JsonParser.parseString("""{"acts":[],"setNames":{}}""").asJsonObject)
        assertTrue(rules.acts.isEmpty())
        assertEquals(0, rules.lastAct)
    }

    @Test fun realRulesKeepTheirLastAct() {
        val rules = PlayRules(res("play-rules.json"))
        assertEquals(rules.acts.maxOf { it.act }, rules.lastAct)
    }

    @Test fun battleWithNobodyNamedReadsBlank() {
        val bare = JsonObject()
        assertEquals("", storyWho(bare, "hero")); assertEquals("", storyWho(bare, "villain")); assertEquals("", storyTitle(bare))
        val b = JsonParser.parseString("""{"title":"T","hero":{"who":"urza"},"villain":{}}""").asJsonObject
        assertEquals("urza", storyWho(b, "hero")); assertEquals("", storyWho(b, "villain")); assertEquals("T", storyTitle(b))
    }
}
