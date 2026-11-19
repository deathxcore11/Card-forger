package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
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
 * Randall's 19 Nov recording of 0.4.98 (0:37): he flicked a land at the table as his turn began. It stopped mid-table as a whole
 * card with the blue ring, was never played, and his hand stayed dipped for the rest of the match (so he discarded blind).
 * The hand changed size under his finger (the turn's draw arrived), which restarted the hand's touch handling mid-drag: the
 * lift was never let go. Here: a card is lifted, the hand grows by one, the finger goes on up and comes off.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class FlickDuringDrawTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val all = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.me.hand
    private val anchors = Anchors()
    private val played = mutableListOf<Int>()
    private var carried: Int? = null

    @Test fun aDrawUnderTheFingerDoesNotStrandTheCard() {
        assertTrue("the fixture hand has 4 cards", all.size >= 4)
        Motion.still = true
        var hand by mutableStateOf(all.take(3))
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) { HandFan(hand, 80.dp, Modifier, canPlay = { true }, onPlay = { played += it.id }, onCarry = { carried = it }) }
            }
        }
        rule.waitForIdle()
        val lifted = all[1].id
        var at = Offset.Zero
        val px = with(rule.density) { 60.dp.toPx() }
        rule.onRoot().performTouchInput {
            at = Offset(width / 2f, height - with(rule.density) { 50.dp.toPx() })
            down(at)
            repeat(5) { i -> moveTo(Offset(at.x, at.y - px * (i + 1) / 5f)) }
        }
        rule.waitForIdle()
        assertEquals("the card is lifted and carried", lifted, carried)
        // The turn's draw arrives while the card is in the air.
        hand = all.take(4)
        rule.waitForIdle()
        rule.onRoot().performTouchInput {
            repeat(5) { i -> moveTo(Offset(at.x, at.y - px - px * (i + 1) / 5f)) }
            up()
        }
        rule.waitForIdle()
        assertEquals("let go over the table, the lifted card is played", listOf(lifted), played)
        rule.mainClock.advanceTimeBy(3000L); rule.waitForIdle()
        assertEquals("no card is left carried over the table (the hand comes back up)", null, carried)
    }
}
