package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
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

/** glow-rules.md: the payment light follows a carried hand card and goes off the moment it is cast or put back (HandFan's onCarry). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class GlowCarryTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    private fun hand() = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.me.hand.take(1)

    private fun run(distanceDp: Float): Pair<List<Int?>, List<Int>> {
        Motion.still = true
        val carried = mutableListOf<Int?>(); val played = mutableListOf<Int>()
        val cards = hand()
        rule.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
                HandFan(cards, 80.dp, Modifier, canPlay = { true }, onPlay = { played += it.id }, onCarry = { carried += it })
            }
        }
        rule.waitForIdle()
        val px = with(rule.density) { distanceDp.dp.toPx() }
        rule.onRoot().performTouchInput {
            val at = Offset(width / 2f, height - with(rule.density) { 50.dp.toPx() })
            down(at)
            repeat(10) { i -> moveTo(Offset(at.x, at.y - px * (i + 1) / 10f)) }
            up()
        }
        rule.mainClock.advanceTimeBy(2000); rule.waitForIdle()
        return carried to played
    }

    @Test fun aCastCardIsNoLongerCarried() {
        val (carried, played) = run(140f)
        val id = hand()[0].id
        assertEquals(listOf(id), played)
        assertTrue("carried while dragged: $carried", id in carried)
        assertEquals("carried after the cast: $carried", null, carried.last())
    }

    @Test fun aPutBackCardIsNoLongerCarried() {
        val (carried, played) = run(30f)
        val id = hand()[0].id
        assertEquals(emptyList<Int>(), played)
        assertTrue("carried while dragged: $carried", id in carried)
        assertEquals("carried after the put-back: $carried", null, carried.last())
    }
}
