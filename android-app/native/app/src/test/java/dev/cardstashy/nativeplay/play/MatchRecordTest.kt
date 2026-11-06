package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** play-match-record.js on the device: a row per finished match, kept per account, and quickStreak's lean for the next Quick Play. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MatchRecordTest {
    private val context get() = RuntimeEnvironment.getApplication()
    private fun deck(id: String?, name: String) = JsonObject().apply { id?.let { addProperty("id", it) }; addProperty("name", name) }
    private fun play(user: String, outcome: String, format: String = "Modern", style: String = "quick", conceded: Boolean = false) =
        MatchRecord.record(context, user, outcome, deck("d1", "Burn"), deck(null, "Tron"), format, style, true, 7, 12, 0, 300_000, conceded)

    @Test fun streaks() {
        val u = "u1"
        assertEquals(0, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "win"); assertEquals("one win is not a run", 0, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "win"); assertEquals(5, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "win"); play(u, "win"); play(u, "win"); assertEquals("capped at 15", 15, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "win", format = "Pioneer"); play(u, "win", style = "practice"); assertEquals("other formats and Practice don't count", 15, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "loss", conceded = true); assertEquals("a concession doesn't count", 15, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "loss"); play(u, "loss"); play(u, "loss"); assertEquals(-10, MatchRecord.quickStreak(context, u, "Modern"))
        play(u, "draw"); assertEquals("a draw ends the run", 0, MatchRecord.quickStreak(context, u, "Modern"))
        assertEquals("another account has its own record", 0, MatchRecord.quickStreak(context, "u2", "Modern"))
    }

    @Test fun rows() {
        val r = play("u3", "win")!!
        assertEquals("id:d1", r.getAsJsonObject("deck")["key"].asString)
        assertEquals("name:tron", r.getAsJsonObject("opponent")["key"].asString)
        assertEquals("quick", r["playStyle"].asString)
        assertNull("a deck with no id or name is not recorded", MatchRecord.record(context, "u3", "win", JsonObject(), null, "Modern", "quick", null, null, null, null, null, false))
        assertNull(MatchRecord.record(context, "u3", "abandoned", deck("d1", "Burn"), null, "Modern", "quick", null, null, null, null, null, false))
        repeat(305) { play("u4", "win") }
        assertEquals("the last 300", 300, MatchRecord.history(context, "u4").size)
    }
}
