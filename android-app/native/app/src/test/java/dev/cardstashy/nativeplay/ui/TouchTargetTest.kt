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
import org.junit.Assert.assertTrue
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
    /**
     * Z1 review: on a phone the stack fan is drawn smaller to fit the right strip (here about 0.88), and its "+N" chip with it. It
     * still takes a tap just inside 22 dp below its middle (a 44 dp box on the screen), not only on its drawn pill. 0.4.60 Z6: Yield
     * moved from the label row into the three-dot menu beside End turn (two taps, 44 dp targets).
     */
    @Test @Config(qualifiers = "w844dp-h390dp-land-xxhdpi")
    fun theStackChipsTakeATapInA44dpBox() {
        Motion.still = true
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-crowded.json")!!.readText())!!
        val one = base.stack.first()
        // A CPU ability on top (it has Yield) and three older items (folded into "+3" on a phone); no buttons below the fan.
        val items = listOf(one.copy(id = 9101, controller = base.cpu.id, ability = true, text = "Soul Warden — Whenever another creature enters, you gain 1 life."),
            one.copy(id = 9102, controller = base.viewer, ability = true, text = "Llanowar Elves — Add {G}."),
            one.copy(id = 9103, controller = base.cpu.id, ability = true, text = "Talrand, Sky Summoner — Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake."),
            one.copy(id = 9104, controller = base.viewer, ability = true, text = "Elvish Mystic — Add {G}."))
        val st = base.copy(stack = items, prompt = null, inputType = null)
        val anchors = Anchors()
        val yields = mutableListOf<Int>()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(yieldSource = { id, _ -> yields += id }), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
        val dp = org.robolectric.RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val card = anchors.rects["stackcard"] ?: error("no stack card")
        val label = anchors.rects["stacklabel"] ?: error("no stack label")
        assertTrue("the fan is drawn smaller here (${card.width / dp} dp wide)", card.width < 104f * dp - 1f)
        // 0.4.60 Z6 (brief: "Yield moves into a three-dot menu beside End turn"): Yield is no longer a pill in the label row. It is the
        // three-dot menu's line, two taps away, each target 44 dp tall at the least.
        val more = anchors.rects["stackmore"] ?: error("the older items did not fold into +N")
        val half = 22f * dp - 1f
        assertTrue("the label row is clear of the dots", anchors.rects["dots"]?.let { !it.overlaps(label) } ?: false)
        val dots = anchors.rects["dots"]!!
        assertTrue("the dots are 44 dp tall (${dots.height / dp})", dots.height >= 44f * dp - 1f)
        rule.onRoot().performTouchInput { click(dots.center) }
        rule.waitForIdle()
        val line = anchors.rects[TableActions.YIELD] ?: error("the three-dot menu did not open with Yield")
        assertTrue("the Yield line is 44 dp tall (${line.height / dp})", line.height >= 44f * dp - 1f)
        rule.onRoot().performTouchInput { click(line.center) }
        rule.waitForIdle()
        assertEquals("Yield in two taps", listOf(9101), yields)
        // Z6: the three-dot button (a real 44 dp target) now stands just under the label row in the strip; where the point 22 dp
        // below "+N" is on it, the dots rightly take it, so "+N" is tried 22 dp left of its middle instead (the same 44 dp box).
        val belowMore = Offset(more.center.x, more.center.y + half)
        val tapMore = if (dots.contains(belowMore)) Offset(more.center.x - half, more.center.y) else belowMore
        rule.onRoot().performTouchInput { click(tapMore) }
        rule.waitForIdle()
        assertTrue("+N tapped 22 dp from its middle opens the list", anchors.rects["stacklist"] != null)
    }
}
