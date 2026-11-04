package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StoryDeedsTest {
    private val d = StoryDeeds(JsonParser.parseString(javaClass.classLoader!!.getResource("story-deeds.json")!!.readText()).asJsonObject)
    private fun facts(s: String) = JsonParser.parseString(s).asJsonObject

    @Test fun loadsEveryDeed() { assertEquals(444, d.deeds.size); assertEquals(46, d.acts.size) }

    @Test fun flawlessWinEarnsNotAScratch() {
        val won = d.earned("a1b1", "hero", false, facts("""{"losses":0,"myTurns":5,"myCards":[],"theirCards":[]}"""), emptyList())
        assertTrue("a1-not-a-scratch" in won)
        assertFalse("a1-not-a-scratch" in d.earned("a1b1", "hero", false, facts("""{"losses":2}"""), emptyList()))
    }

    @Test fun ownDeckEarnsNoBattleDeeds() { assertEquals(emptyList<String>(), d.earned("a1b1", "hero", true, facts("""{"losses":0}"""), emptyList())) }

    @Test fun missingFactFails() { assertFalse(StoryDeeds.meets(facts("""{"losses":null}"""), facts("""{"losses":["<=",0]}"""))) }

    @Test fun namedCardRules() {
        val f = facts("""{"myCards":["Mirri"],"theirCards":["X"],"killed":["K"],"myDead":[]}""")
        assertTrue(StoryDeeds.meets(f, facts("""{"mine":"Mirri","notTheirs":"Y","killed":["K"],"survived":"Mirri"}""")))
        assertFalse(StoryDeeds.meets(f, facts("""{"notTheirs":"X"}""")))
    }

    @Test fun tribeAndOnPlay() {
        assertTrue(StoryDeeds.meets(facts("""{"tribes":{"Elf":5},"onPlay":false}"""), facts("""{"tribe":["Elf",">=",5],"onPlay":false}""")))
        assertFalse(StoryDeeds.meets(facts("""{"tribes":{"Elf":4},"onPlay":null}"""), facts("""{"tribe":["Elf",">=",5]}""")))
        assertFalse(StoryDeeds.meets(facts("""{"onPlay":null}"""), facts("""{"onPlay":false}""")))
    }

    @Test fun actDeedsNeedAllEightBattles() {
        val refs = (1..8).map { "story:a1b$it:loaner" }
        assertTrue("a1-chronicler" in d.earned("a1b8", "hero", false, facts("{}"), refs))
        assertFalse("a1-two-faced" in d.earned("a1b8", "hero", false, facts("{}"), refs))
        val both = (1..8).flatMap { listOf("story:a1b$it:clear", "story:a1b$it:villain") }
        assertTrue("a1-two-faced" in d.earned("a1b8", "villain", false, facts("{}"), both))
    }
}
