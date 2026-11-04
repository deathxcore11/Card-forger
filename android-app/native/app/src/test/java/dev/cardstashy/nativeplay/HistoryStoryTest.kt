package dev.cardstashy.nativeplay

import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Story
import dev.cardstashy.nativeplay.ui.StoryEvent
import dev.cardstashy.nativeplay.ui.StoryLine
import dev.cardstashy.nativeplay.ui.StorySurface
import dev.cardstashy.nativeplay.ui.storyLines
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * History & stack lines against the site's own code. The expected lines come from running the site's
 * projectForge (forge-session.mjs) and storyLines (cpu-action-playback.mjs) in node on the same bridge
 * snapshots (test resources history/duel.json and history/pod.json).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class HistoryStoryTest {
    private fun res(n: String) = javaClass.classLoader!!.getResource(n)!!.readText()
    private fun state(n: String) = MatchState.parse(res("history/$n.json"))!!

    /** The events with the keys MatchState drops (number, fizzled, token) read back from the same JSON. */
    private fun full(n: String, st: MatchState): List<StoryEvent> {
        val raw = JsonParser.parseString(res("history/$n.json")).asJsonObject.getAsJsonObject("events").getAsJsonArray("items").map { it.asJsonObject }
        return st.events.zip(raw).map { (e, r) ->
            StoryEvent(e, number = r.get("number")?.takeIf { it.isJsonPrimitive }?.asInt,
                fizzled = r.get("fizzled")?.takeIf { it.isJsonPrimitive }?.asBoolean == true, token = r.get("token")?.takeIf { it.isJsonPrimitive }?.asBoolean == true)
        }
    }

    private fun l(seq: Long, turn: Int, text: String, card: Int? = null) = StoryLine(seq, turn, text, card)

    // node expect.mjs, "## duel / ## full"
    private val duelFull = listOf(
        l(1, 3, "Turn 3 · CPU’s turn"),
        l(2, 3, "CPU played Mountain.", 12),
        l(3, 3, "CPU cast Llanowar Elves targeting you.", 13),
        l(4, 3, "You activated Biotech Specialist’s ability targeting Burnished Hart, CPU and Shock.", 10),
        l(5, 3, "Burnished Hart triggered.", 11),
        l(6, 3, "Llanowar Elves didn’t resolve: no legal targets.", 13),
        l(8, 3, "You attacked CPU with Biotech Specialist."),
        l(9, 3, "Burnished Hart and Goblin Token blocked Biotech Specialist."),
        l(10, 3, "Biotech Specialist dealt 3 damage to Burnished Hart.", 10),
        l(12, 3, "You gained 3 life."),
        l(13, 3, "Burnished Hart died.", 11),
        l(14, 3, "Pacifism went to the graveyard.", 14),
        l(15, 3, "Elvish Mystic was exiled.", 17),
        l(16, 3, "CPU created a Goblin Token.", 15),
        l(17, 3, "You created an Elemental.", 18),
        l(18, 3, "Biotech Specialist returned to its owner’s hand.", 10),
        l(21, 4, "Turn 4 · your turn"),
        l(23, 4, "Ornithopter died.", 20),
        l(24, 4, "Biotech Specialist blocked Burnished Hart."),
        l(24, 4, "Elvish Mystic blocked Goblin Token."),
    )

    @Test fun duelLinesMatchTheSite() {
        val st = state("duel")
        assertEquals(duelFull, storyLines(full("duel", st), StorySurface.of(st)))
    }

    /** Through MatchState, which now carries fizzled, token and number: the full set, one line per event number. */
    @Test fun storyKeepsOneLinePerEventFromMatchState() {
        val st = state("duel")
        val story = Story(); story.take(st); story.take(st)
        // tellStory keeps the first line of an event number: the second block line of event 24 is not shown.
        assertEquals(duelFull.distinctBy { it.seq }, story.rows)
    }

    @Test fun podNamesEachCpuByItsCommander() {
        val st = state("pod")
        assertEquals(listOf(
            l(1, 5, "Turn 5 · Krenko’s turn"),
            l(2, 5, "Krenko attacked with Goblin Guide and Goblin Piker."),
            l(3, 5, "Krenko attacked Fire with Goblin Guide."),
            l(4, 5, "Goblin Piker dealt 2 damage to CPU 2.", 31),
            l(5, 5, "Turn 5 · CPU 2’s turn"),
            l(6, 5, "Fire gained 2 life."),
        ), storyLines(full("pod", st), StorySurface.of(st)))
    }

    /** tellStory: kept by event number (400 at most, oldest dropped), the last 40 shown, a repeat never added twice. */
    @Test fun keepsFourHundredShowsForty() {
        val surface = StorySurface(1, mapOf(1 to "You", 2 to "CPU"), emptyMap())
        fun turn(seq: Long) = StoryEvent(GameEvent(seq, "turn", seq.toInt(), null, 2, null, null, null, emptyList(), emptyList(), emptyList(), null, null, null, null, null, null))
        val story = Story()
        story.take((1L..30L).map(::turn), surface)
        assertEquals((1L..30L).toList(), story.rows.map { it.seq })
        story.take((20L..450L).map(::turn), surface)
        assertEquals((411L..450L).toList(), story.rows.map { it.seq })
        assertEquals("Turn 450 · CPU’s turn", story.rows.last().text)
        // As in the site's Map: a number already dropped from the 400 comes back at the end, and the oldest kept one goes.
        story.take(listOf(turn(5)), surface)
        assertEquals((412L..450L).toList() + 5L, story.rows.map { it.seq })
        story.take(listOf(turn(450)), surface)
        assertEquals((412L..450L).toList() + 5L, story.rows.map { it.seq })
    }
}
