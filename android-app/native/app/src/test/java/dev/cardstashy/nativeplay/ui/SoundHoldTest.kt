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
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Match sound pass 8d (specs/match-sound-brief.md), the hand: `card_lift` as a card is picked up, `card_hold` once as it crosses
 * onto the table, and S1, a drop that is refused: `card_refuse` with one shake (two swings, 160 ms) before the card slides home.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class SoundHoldTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val was = Motion.still
    @After fun back() { Motion.still = was }
    private val cards = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.me.hand.take(3)
    private val played = mutableListOf<Int>()
    private val heard = mutableListOf<String>()

    /** Lifts the middle card [dp] up and lets go. */
    private fun carry(dp: Float, canPlay: Boolean) {
        Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides Anchors(), LocalTableCue provides { id, _, _ -> heard += id }) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) { HandFan(cards, 80.dp, Modifier, canPlay = { canPlay }, onPlay = { played += it.id }) }
            }
        }
        rule.waitForIdle()
        val px = with(rule.density) { dp.dp.toPx() }
        rule.onRoot().performTouchInput {
            val at = Offset(width / 2f, height - with(rule.density) { 50.dp.toPx() })
            down(at)
            repeat(10) { i -> moveTo(Offset(at.x, at.y - px * (i + 1) / 10f)) }
            up()
        }
        rule.waitForIdle()
    }

    @Test fun pickedUpAndCarriedOntoTheTable() {
        carry(120f, canPlay = true)
        assertEquals(listOf("card_lift", "card_hold"), heard)
        assertEquals(listOf(cards[1].id), played)
    }

    @Test fun letGoEarlyIsQuietAfterTheLift() {
        carry(40f, canPlay = true)
        assertEquals("a card put back is not refused", listOf("card_lift"), heard)
        assertTrue(played.isEmpty())
    }

    @Test fun aCardThatCannotBePlayedIsRefused() {
        carry(120f, canPlay = false)
        assertEquals(listOf("card_lift", "card_refuse"), heard)
        assertTrue("nothing is played", played.isEmpty())
        // The shake: two swings in 160 ms, 7 dp at first, at rest when it ends.
        assertEquals(160, REFUSE_MS); assertEquals(7f, REFUSE_DP, 0f)
        assertEquals(0f, refuseShake(0f), 0f); assertEquals(0f, refuseShake(1f), 0f); assertEquals(0f, refuseShake(.5f), .0001f)
        assertTrue("right, left, right, left", refuseShake(.125f) > 0f && refuseShake(.375f) < 0f && refuseShake(.625f) > 0f && refuseShake(.875f) < 0f)
        assertTrue("dying away", refuseShake(.125f) > refuseShake(.625f) && kotlin.math.abs(refuseShake(.125f)) <= 1f)
    }
}
