package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Native Play numbers against the web's own functions: play-golden.json is written by
 * scripts/play-golden.mjs from play-achievements.js, play-econ-rules.js and story-client.js.
 */
class PlayMathTest {
    private fun res(n: String) = JsonParser.parseString(javaClass.classLoader!!.getResource(n)!!.readText()).asJsonObject
    private val g = res("play-golden.json")
    private val rules = PlayRules(res("play-rules.json"))
    private val state = g.getAsJsonObject("state")

    @Test fun weeksAndDailies() {
        g.getAsJsonObject("weeks").entrySet().forEach { (d, w) -> assertEquals(d, w.asString, PlayMath.playWeek(d)) }
        g.getAsJsonObject("daily").entrySet().forEach { (d, ids) -> assertEquals(d, ids.asJsonArray.map { it.asString }, PlayMath.dailyQuests(rules, d).map { it.id }) }
        val days = g.getAsJsonArray("playDay").map { it.asString }
        assertEquals(days[0], PlayMath.playDay(-300, java.time.Instant.parse("2026-11-03T02:00:00Z").toEpochMilli()))
        assertEquals(days[1], PlayMath.playDay(900, java.time.Instant.parse("2026-11-03T20:00:00Z").toEpochMilli()))
    }

    @Test fun questsMatchTheWeb() {
        val q = PlayMath.quests(rules, state, "2026-11-03")
        val web = g.getAsJsonObject("quests")
        fun same(native: List<PlayMath.QuestRow>, key: String) = web.getAsJsonArray(key).map { it.asJsonObject }.zip(native).forEach { (w, n) ->
            assertEquals(w["id"].asString, n.quest.id); assertEquals(w["have"].asInt, n.have); assertEquals(w["done"].asBoolean, n.done)
            assertEquals(w["claimed"].asBoolean, n.claimed); assertEquals(w["ref"].asString, n.ref)
        }
        same(q.daily, "daily"); same(q.weekly, "weekly")
        assertEquals(web["week"].asString, q.week)
    }

    @Test fun achievementsMatchTheWeb() {
        val rows = PlayMath.achievements(rules, state)
        g.getAsJsonObject("values").entrySet().forEach { (id, v) -> assertEquals(id, v.asInt, rows.first { it.a.id == id }.value) }
        val t = g.getAsJsonObject("totals"); val n = PlayMath.totals(rows)
        assertEquals(t["total"].asInt, n.total); assertEquals(t["earned"].asInt, n.earned); assertEquals(t["ready"].asInt, n.ready)
        assertEquals(g.getAsJsonArray("near").map { it.asString }, PlayMath.almostThere(rows, 2).map { it.a.id })
        val m = g.getAsJsonObject("mastery"); val lv = PlayMath.mastery(state, 2750)
        assertEquals(m["level"].asInt, lv.level); assertEquals(m["into"].asInt, lv.into); assertEquals(m["need"].asInt, lv.need)
        val p = PlayMath.purse(state)!!; assertEquals(1234, p.coins); assertEquals(1, p.packs); assertEquals(3, p.seals["r"])
    }

    @Test fun storyMatchesTheWeb() {
        val s = g.getAsJsonObject("story") ?: return
        val home = PlayMath.storyHome(s.getAsJsonArray("refs").map { it.asString }, rules.acts.size)
        assertEquals(s["act"].asInt, home.act); assertEquals(s["won"].asInt, home.won)
    }
}
