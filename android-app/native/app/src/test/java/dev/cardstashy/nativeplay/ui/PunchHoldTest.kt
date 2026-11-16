package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Match punch P7 (specs/match-punch-brief.md, "Holding a card"): the carried card wears its ring while it is held; let go over the
 * table it casts from where it is (its place under the finger is the cast's starting point); let go early it is back in its place
 * and nothing is played. The lean follows the card's sideways speed, to 18 degrees at most, and settles.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PunchHoldTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val cards = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.me.hand.take(3)
    private val anchors = Anchors()
    private val played = mutableListOf<Int>()

    /** Lifts the middle card [dp] up; with [letGo] the finger comes off. Returns where the finger went down (the middle card). */
    private fun carry(dp: Float, letGo: Boolean): Offset {
        Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) { HandFan(cards, 80.dp, Modifier, canPlay = { true }, onPlay = { played += it.id }) }
            }
        }
        rule.waitForIdle()
        var rest = Offset.Zero
        val px = with(rule.density) { dp.dp.toPx() }
        rule.onRoot().performTouchInput {
            val at = Offset(width / 2f, height - with(rule.density) { 50.dp.toPx() }); rest = at
            down(at)
            repeat(10) { i -> moveTo(Offset(at.x, at.y - px * (i + 1) / 10f)) }
            if (letGo) up()
        }
        rule.waitForIdle()
        return rest
    }

    @Test fun theCarriedCardWearsItsRing() {
        carry(120f, letGo = false)
        assertTrue("the ring is on the card under the finger", anchors.rects.containsKey("holdring"))
        assertTrue("nothing is played while it is held", played.isEmpty())
    }

    @Test fun letGoOverTheTableItCastsFromWhereItIs() {
        val rest = carry(120f, letGo = true)
        assertEquals(listOf(cards[1].id), played)
        val from = anchors.rects.getValue("hand${cards[1].id}")
        val up = with(rule.density) { 80.dp.toPx() }
        assertTrue("the cast starts where the card was let go, not back in the hand: $rest to $from", rest.y - from.center.y > up && kotlin.math.abs(from.center.x - rest.x) < up)
    }

    @Test fun letGoEarlyItSpringsBackAndNothingIsPlayed() {
        val before = run { carry(40f, letGo = true); anchors.rects["hand${cards[1].id}"] }
        rule.mainClock.advanceTimeBy(HOLD_BACK_MS + 200L); rule.waitForIdle()
        assertTrue(played.isEmpty())
        assertEquals("its place is not moved for a cast that did not happen", before, anchors.rects["hand${cards[1].id}"])
    }

    @Test fun theLeanFollowsTheTravelAndSettles() {
        var lean = 0f
        repeat(12) { lean = holdLean(lean, 2f) }
        assertEquals("fast to the right: 18 degrees, never more", HOLD_LEAN_MAX, lean, .1f)
        repeat(12) { lean = holdLean(lean, -2f) }
        assertEquals(-HOLD_LEAN_MAX, lean, .1f)
        repeat(20) { lean = holdLean(lean, 0f) }
        assertEquals("still: upright again", 0f, lean, .01f)
        assertTrue("a slow drift barely leans it", kotlin.math.abs(holdLean(0f, .1f)) < 1f)
        assertEquals(140, HOLD_GROW_MS); assertEquals(180, HOLD_DROP_MS); assertEquals(280, HOLD_BACK_MS); assertEquals(40, PAY_LIGHT_GAP_MS)
    }
}
