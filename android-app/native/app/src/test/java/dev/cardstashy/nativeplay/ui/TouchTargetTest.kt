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
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * 0.4.59 T6 (input): on the smallest phone board (640 × 360) a legal answer takes a tap anywhere in a 44 dp box around its middle,
 * even where the drawn tile or seat is smaller.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w640dp-h360dp-land-xhdpi")
class TouchTargetTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()); dev.cardstashy.nativeplay.art.CardImageTest.art = { _, _ -> null } }
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()

    @Test fun everyLegalAnswerTakesATapInA44dpBox() {
        Motion.still = true
        val st0 = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
        // Lands are the smallest tiles: make the CPU's lone lands targets too (a land-destruction spell asks this way).
        val lands = st0.cpu.battlefield.filter { it.isLand }.map { it.id }
        val st = st0.copy(selection = st0.selection.copy(cards = st0.selection.cards + lands, targetCards = st0.selection.targetCards + lands))
        val anchors = Anchors()
        val cards = mutableListOf<Int>(); val players = mutableListOf<Int>()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(card = { cards += it }, player = { players += it }), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
        val dp = org.robolectric.RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val half = 22f * dp - 1f
        val keys = st.selection.targetCards.map { "c$it" to it } + st.selection.players.filter { it in st.selection.targetPlayers }.map { "orb$it" to -it }
        for ((key, id) in keys) {
            val r = anchors.rects[key] ?: continue
            // Each way the drawn box is under 44 dp, the point just inside 22 dp from its middle (away from the board's centre);
            // each way it is bigger, its middle.
            val sx = if (r.center.x < rule.onRoot().fetchSemanticsNode().size.width / 2f) -1f else 1f
            val sy = if (r.center.y < rule.onRoot().fetchSemanticsNode().size.height / 2f) -1f else 1f
            val p = Offset(r.center.x + (if (r.width < 44f * dp) sx * half else 0f), r.center.y + (if (r.height < 44f * dp) sy * half else 0f))
            cards.clear(); players.clear()
            rule.onRoot().performTouchInput { click(Offset(p.x, p.y)) }
            rule.waitForIdle()
            val got = if (id < 0) players.lastOrNull()?.let { -it } else cards.lastOrNull()
            assertEquals("$key (${r.width / dp} × ${r.height / dp} dp) tapped at $p", id, got)
        }
    }
}
