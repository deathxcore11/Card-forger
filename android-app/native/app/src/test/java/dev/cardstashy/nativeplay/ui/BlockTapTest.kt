package dev.cardstashy.nativeplay.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import androidx.compose.ui.test.performTouchInput
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Randall 6 Nov: "I can't block or back out". The block step on a real board (table/snap-block.json: Grizzly Bears and
 * Hill Giant attack, three of yours untapped): your taps on the table reach the cards, in either order.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class BlockTapTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()); dev.cardstashy.nativeplay.art.CardImageTest.art = { _, _ -> null } }
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    private val blocks = mutableListOf<Pair<Int, Int>>()
    private val unblocks = mutableListOf<Pair<Int, Int>>()
    private val notes = mutableListOf<String>()
    private var oks = 0
    private val anchors = Anchors()

    private fun show(st: MatchState) {
        Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(block = { b, a -> blocks += b to a }, unblock = { b, a -> unblocks += b to a }, note = { notes += it }, ok = { oks++ }), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
    }
    private fun tap(key: String) { val r = anchors.rects.getValue(key); rule.onRoot().performTouchInput { click(Offset(r.center.x, r.center.y)) }; rule.waitForIdle() }

    @Test fun blockerThenAttacker() {
        show(state("block"))
        tap("c108"); tap("c123")
        assertEquals(listOf(108 to 123), blocks)
    }

    @Test fun attackerThenBlocker() {
        show(state("block"))
        tap("c124"); tap("c107")
        assertEquals(listOf(107 to 124), blocks)
    }

    @Test fun noBlocks() {
        show(state("block"))
        rule.onNodeWithText("No blocks", substring = true, useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertEquals(1, oks)
    }

    /** realblock: Glory Seeker blocks Savannah Lions; the x on its line takes the block back, and three Suntail Hawks fly. */
    @Test fun takeBackAndFlyers() {
        val st = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}").paired(state("realblock"))
        show(st)
        // The x buttons sit where the block lines are drawn: draw a frame first.
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table/block-takeback.png").path); rule.waitForIdle()
        rule.onNodeWithContentDescription("Take back this block").performClick(); rule.waitForIdle()
        assertEquals(listOf(57 to 117), unblocks)
        val why = blockRefusal(st.card(116)!!, st.card(57)!!)
        assertTrue(why, why!!.contains("flying"))
        assertEquals(null, blockRefusal(st.card(117)!!, st.card(57)!!.copy(blocking = false)))
        assertEquals("Glory Seeker is tapped, so it can’t block.", blockRefusal(null, st.card(57)!!.copy(tapped = true)))
        assertEquals("Starscape Cleric can’t block.", blockRefusal(null, st.card(57)!!.copy(name = "Starscape Cleric", text = "Flying\nThis creature can’t block.")))
    }
}
