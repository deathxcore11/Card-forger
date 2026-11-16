package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Director
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Better table scenes 8 and 9, the rules without a screen: the kill's slide to the pile, and which card wears "No legal target"
 * (read from the real boards of CauseProbe's match, table/cause-cpu.jsonl).
 */
class BetterPlatesTest {
    private val cpu = javaClass.classLoader!!.getResource("table/cause-cpu.jsonl")!!.readText().lines().filter { it.isNotBlank() }.map { MatchState.parse(it)!! }.associateBy { it.revision }

    /** Scene 8: the card holds still through its break, then travels the whole way to the pile, small and gone when it lands. */
    @Test fun aKillSlidesToItsPile() {
        val from = Offset(400f, 300f); val pile = Offset(60f, 700f); val dur = KILL_MS.toFloat()
        val rest = killSlide(100f, dur, from, pile)
        assertEquals(0f, rest.dx, 0f); assertEquals(0f, rest.dy, 0f); assertEquals(1f, rest.scale, 0f); assertEquals(1f, rest.alpha, 0f)
        // On the break it swells a little, still where it stood.
        val brk = killSlide(KILL_BREAK_MS + 40f, dur, from, pile)
        assertTrue(brk.scale > 1.05f); assertEquals(0f, brk.dx, .01f)
        // Half way in time it has not yet gone half way (it gathers speed), it rides above the straight line, turning toward the pile.
        val mid = killSlide((KILL_BREAK_MS + 40f + dur) / 2f, dur, from, pile)
        assertEquals(.5f * (pile.x - from.x), mid.dx, 1f)
        assertTrue("it arcs over the straight line", mid.dy < .5f * (pile.y - from.y))
        assertTrue(mid.turn < 0f && mid.scale < 1f && mid.alpha == 1f)
        val end = killSlide(dur, dur, from, pile)
        assertEquals(pile.x - from.x, end.dx, .01f); assertEquals(pile.y - from.y, end.dy, .01f)
        assertEquals(.35f, end.scale, .001f); assertEquals(0f, end.alpha, 0f); assertEquals(-10f, end.turn, 0f)
        // Every frame between: no jump.
        var last = killSlide(0f, dur, from, pile)
        for (ms in 10..KILL_MS.toInt() step 10) { val k = killSlide(ms.toFloat(), dur, from, pile)
            assertTrue("no jump at $ms", kotlin.math.abs(k.dx - last.dx) < 60f && kotlin.math.abs(k.dy - last.dy) < 60f); last = k }
    }

    /** Scene 9: a fizzled trigger's or ability's source still on the table wears the tag; a spell (gone to its pile) and anything else does not. */
    @Test fun noLegalTargetGoesOnTheSourceStillOnTheTable() {
        val st = cpu[285]!!
        val onTable = st.players.flatMap { it.battlefield }.first().id
        val inPile = st.players.flatMap { it.graveyard }.first().id
        fun res(src: Int, fizzled: Boolean) = Director.Resolution(1, 7, src, "Seam Rip", st.viewer, trigger = true, fizzled = fizzled, text = null, targets = emptyList())
        fun result(r: Director.Resolution) = Director.Step(Director.Kind.RESULT, Director.FIZZLE_MS, Director.FIZZLE_MS, "CARD-012", cardId = r.sourceId, result = r)
        assertEquals(onTable, Director.noTargetOn(result(res(onTable, true)), st))
        assertNull("it resolved", Director.noTargetOn(result(res(onTable, false)), st))
        assertNull("no tile to carry it", Director.noTargetOn(result(res(inPile, true)), st))
        // An ability (Forge's resolve with fizzled, no trigger result): the FIZZLE step on its source.
        assertEquals(onTable, Director.noTargetOn(Director.Step(Director.Kind.FIZZLE, 400, 250, "CARD-012", cardId = onTable), st))
        assertNull(Director.noTargetOn(Director.Step(Director.Kind.FIZZLE, 400, 250, "CARD-012", cardId = inPile), st))
        assertNull(Director.noTargetOn(Director.Step(Director.Kind.RESOLVE, 300, 200, cardId = onTable), st))
        assertEquals("No legal target", NO_LEGAL_TARGET)
    }

    private fun ev(seq: Long, type: String, src: dev.cardstashy.nativeplay.engine.Card, st: MatchState, fizzled: Boolean, stackId: Int?) =
        dev.cardstashy.nativeplay.engine.GameEvent(seq, type, st.turn, st.phase, st.viewer, null, dev.cardstashy.nativeplay.engine.Ref("card", src.id, src.name), null, emptyList(), emptyList(), emptyList(),
            null, null, null, null, null, null, fizzled = fizzled, stackId = stackId)

    /** Scene 9 through the real plan: Forge's fizzled resolve for a trigger on the table becomes the step that tags it. */
    @Test fun aFizzledTriggerInThePlanTagsItsSource() {
        val before = cpu[281]!!
        val src = before.players.flatMap { it.battlefield }.first { it.controller == before.viewer }
        val last = before.events.maxOf { it.seq }
        val trig = ev(last + 1, "trigger", src, before, fizzled = false, stackId = 900)
        val fizz = ev(last + 2, "resolve", src, before, fizzled = true, stackId = null)
        val steps = Director.plan(before, listOf(trig, fizz), before = before, triggerIds = setOf(900))
        val tagged = steps.mapNotNull { Director.noTargetOn(it, before) }
        assertEquals(listOf(src.id), tagged)
        assertEquals(Director.FIZZLE_MS, steps.single { Director.noTargetOn(it, before) != null }.ms)
    }
}
