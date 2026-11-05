package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import dev.cardstashy.nativeplay.ui.Foil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** test-story-lessons.mjs on the app's coach, fed the site's own lesson data (assets/story-lessons.json, scripts/export-story-lessons.mjs). */
class LessonCoachTest {
    private val asset = File("src/main/assets/story-lessons.json")
    private fun data(): StoryLessons { assumeTrue("run scripts/prepare-assets.sh first", asset.isFile); return StoryLessons(JsonParser.parseString(asset.readText()).asJsonObject) }

    private fun card(id: Int, zone: String, type: String, controller: Int = 1, keywords: String = "", extra: String = "") =
        """{"id":$id,"zone":"$zone","owner":$controller,"controller":$controller,"hidden":false,"name":"c$id","type":"$type","manaCost":"","text":"","keywords":[$keywords]$extra}"""
    private fun state(hand: List<String> = emptyList(), mine: List<String> = emptyList(), theirs: List<String> = emptyList(), phase: String = "MAIN1", active: Int = 1, turn: Int = 1) =
        MatchState.parse("""{"status":"running","viewer":1,"turn":$turn,"phase":"$phase","activePlayer":$active,"priorityPlayer":1,
        "players":[{"id":1,"isViewer":true,"zones":{"Hand":{"count":${hand.size},"cards":[${hand.joinToString(",")}]},"Battlefield":{"cards":[${mine.joinToString(",")}]}}},
                   {"id":2,"zones":{"Battlefield":{"cards":[${theirs.joinToString(",")}]}}}],"inputType":"InputPassPriority"}""")!!

    @Test fun aLessonIdeaIsWhisperedOnceWithItsCards() {
        val d = data(); assertTrue(d.isLessonBattle("a1b1")); assertFalse(d.isLessonBattle("a1b5"))
        val seen = HashSet<String>(); var t = 0L
        val c = LessonCoach(d, "a1b1", "hero", seen) { t += 30_000; t }
        val land = card(1, "Hand", "Basic Land — Plains")
        val w = c.update(state(hand = listOf(land)), idle = true)
        assertEquals("land", w?.concept); assertEquals(listOf(1), w?.ids); assertEquals(d.say["land"], w?.text)
        c.shown(w!!)
        // Not repeated.
        assertNull(c.update(state(hand = listOf(land)), idle = true))
        // Nothing new is picked while a whisper is still up.
        assertNull(LessonCoach(d, "a1b1", "hero", HashSet()) { 0L }.update(state(hand = listOf(land)), idle = false))
        // Every lesson idea has a line.
        d.battles.values.flatten().forEach { assertNotNull(it, d.say[it]) }
    }

    @Test fun otherBattlesOnlyNameNewMechanics() {
        val d = data(); val seen = HashSet<String>(); var t = 0L
        val c = LessonCoach(d, null, "hero", seen) { t += 30_000; t }
        assertNull(c.update(state(hand = listOf(card(1, "Hand", "Basic Land — Plains"))), idle = true))
        val w = c.update(state(theirs = listOf(card(9, "Battlefield", "Creature — Human Knight", controller = 2, keywords = "\"Flanking\""))), idle = true)
        assertEquals("w:Flanking", w?.concept); assertEquals(listOf(9), w?.ids)
        // The villain side never hears lessons.
        assertNull(LessonCoach(d, "a1b1", "villain", HashSet()) { 0L }.update(state(hand = listOf(card(1, "Hand", "Land"))), idle = true))
    }

    @Test fun blockersAreShownWhenTheyAttack() {
        val d = data(); var t = 0L
        val c = LessonCoach(d, "a1b1", "hero", hashSetOf("land", "cast", "sick", "attack")) { t += 30_000; t }
        val attacker = card(20, "Battlefield", "Creature — Bear", controller = 2, extra = ""","attacking":true""")
        val w = c.update(state(mine = listOf(card(5, "Battlefield", "Creature — Knight")), theirs = listOf(attacker), phase = "COMBAT_DECLARE_BLOCKERS", active = 2), idle = true)
        assertEquals("block", w?.concept); assertEquals(listOf(5), w?.ids)
    }

    @Test fun lessonBattlesStackTheirDrawsAndGoFirst() {
        val d = data()
        val setup = d.setup("a1b1")!!
        assertTrue(setup["noMulligan"].asBoolean)
        assertEquals(listOf("Plains", "Savannah Lions"), setup.getAsJsonObject("stack").getAsJsonArray("hero").take(2).map { it.asString })
        assertNull(d.setup("a1b5"))
        fun deck() = JsonObject().apply { addProperty("name", "d"); add("cards", JsonParser.parseString("""[{"name":"Plains","qty":60}]""")) }
        val input = JsonParser.parseString(forgeInput("Vintage", deck(), deck(), "Easy", startingPlayer = "first", quick = false, setup = setup)).asJsonObject.getAsJsonObject("input")
        assertEquals("first", input["startingPlayer"].asString); assertEquals("practice", input["playStyle"].asString)
        assertEquals(setup, input.getAsJsonObject("setup"))
        val plain = JsonParser.parseString(forgeInput("Vintage", deck(), deck(), "Easy", quick = false)).asJsonObject.getAsJsonObject("input")
        assertEquals("random", plain["startingPlayer"].asString); assertFalse(plain.has("setup"))
    }

    @Test fun manaValueCountsLikeTheSite() {
        assertEquals(2, LessonCoach.manaValue("{1}{W}")); assertEquals(1, LessonCoach.manaValue("{X}{R}")); assertEquals(0, LessonCoach.manaValue(""))
    }

    @Test fun aFoilOnlyPrintingShowsItsFoil() {
        fun card(vararg f: String) = JsonObject().apply { add("finishes", com.google.gson.JsonArray().apply { f.forEach { add(it) } }) }
        assertEquals("foil", Foil.finishFor(card("foil"), "nonfoil"))
        assertEquals("nonfoil", Foil.finishFor(card("nonfoil", "foil"), "nonfoil"))
        assertEquals("foil", Foil.finishFor(card("nonfoil", "foil"), "foil"))
        assertEquals("etched", Foil.finishFor(card("etched"), "foil"))
        assertEquals("nonfoil", Foil.finishFor(null, "nonfoil"))
    }

    @Test fun keyFeatsMatchTheSite() {
        val f = File("src/main/assets/story-deeds.json"); assumeTrue(f.isFile)
        val site = JsonParser.parseString(f.readText()).asJsonObject.getAsJsonObject("keyFeats") ?: return
        for ((act, ids) in site.entrySet()) assertEquals("act $act", ids.asJsonArray.map { it.asString }, StoryLogic.keyFeats(act.toInt()))
        assertEquals(site.size(), StoryLogic.KEY_FEATS.size)
    }
}
