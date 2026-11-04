package dev.cardstashy.nativeplay.ui

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * test-play-live-toasts.mjs against the native port: toasts-golden.json holds the server's achievements answers
 * (achievementsPayload) for the site test's states and what play-achievement-toasts.js makes of them.
 */
class AchievementToastsTest {
    private val g = JsonParser.parseString(javaClass.classLoader!!.getResource("toasts-golden.json")!!.readText()).asJsonObject
    private fun payload(k: String) = g.getAsJsonObject("payloads").getAsJsonObject(k)
    private fun site(k: String) = g.getAsJsonObject("toasts").getAsJsonArray(k).map { it.asJsonObject }
        .map { listOf(it["id"].asString, it["step"].asInt, it["tier"].asString, it["line"].asString, it["rewards"].asJsonArray.map { r -> r.asString }) }
    private fun native(l: List<AchievementToasts.Toast>) = l.map { listOf(it.id, it.step, it.tier, it.line, AchievementToasts.rewardLines(it.reward)) }

    @Test fun newlyEarnedMatchesTheSite() {
        val fresh = AchievementToasts.newlyEarned(AchievementToasts.doneSteps(payload("before")), payload("after"))
        assertEquals(site("after").sortedBy { it.toString() }, native(fresh).sortedBy { it.toString() })
        val f = fresh.first { it.id == "forgemaster" }
        assertEquals("bronze", f.tier); assertEquals("Tier 1 of 3 · 3", f.line)
        assertEquals("One breath stands between you and the grave.", fresh.first { it.id == "by-a-thread" }.line)
        assertTrue(AchievementToasts.doneSteps(payload("before")).contains("first-spark:0"))
        assertTrue(fresh.none { it.id == "first-spark" })
        assertTrue(AchievementToasts.newlyEarned(AchievementToasts.doneSteps(payload("after")), payload("after")).isEmpty())
    }

    @Test fun honourToastsPayNothing() {
        val fresh = AchievementToasts.newlyEarned(AchievementToasts.doneSteps(payload("empty")), payload("honour"))
        assertEquals(site("honour").sortedBy { it.toString() }, native(fresh).sortedBy { it.toString() })
        val honour = fresh.filter { it.tier == "honour" }
        assertTrue(honour.isNotEmpty() && honour.all { AchievementToasts.rewardLines(it.reward).isEmpty() })
    }

    @Test fun rewardLinesMatchTheSite() {
        for (r in g.getAsJsonArray("rewards").map { it.asJsonObject })
            assertEquals(r["out"].asJsonArray.map { it.asString }, AchievementToasts.rewardLines(r.getAsJsonObject("in")))
    }

    @Test fun firstAnswerOnlySetsTheBaselineAndNothingReplays() {
        AchievementToasts.reset()
        AchievementToasts.seen(payload("before")); assertTrue(AchievementToasts.queue.value.isEmpty())
        AchievementToasts.seen(payload("after")); val n = AchievementToasts.queue.value.size; assertEquals(site("after").size, n)
        AchievementToasts.seen(payload("before")); AchievementToasts.seen(payload("after"))
        assertEquals("a late older answer never makes a deed toast twice", n, AchievementToasts.queue.value.size)
        AchievementToasts.reset(); assertTrue(AchievementToasts.queue.value.isEmpty())
    }

    @Test fun everyFeelExists() {
        val kinds = setOf("reward-claim", "reward-big", "pack-tier-4", "pack-tier-5")
        assertTrue(AchievementToasts.FEEL.values.all { it.first in kinds && it.second in setOf("RWD-001", "RWD-006") })
    }
}
