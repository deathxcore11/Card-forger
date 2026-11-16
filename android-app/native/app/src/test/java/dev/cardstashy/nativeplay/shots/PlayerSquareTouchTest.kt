package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import dev.cardstashy.nativeplay.ui.padRoot
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.60 Z4 (specs/table-zones-brief.md, "Player squares in the corners", Done): in the squares the graveyard opens the T3 sheet by
 * touch and by the pad's A; chat and the bolt keep their function at 44 dp above your square; a portrait target in a square still
 * takes a tap in a 44 dp box. Phone size (844 × 390). Pictures of the open sheet in table-look/z4-grave-*.png. (The pictures of the
 * squares are TableLookZ4ShotTest's: a capture without a rule.)
 */
@OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PlayerSquareTouchTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "table-look/z4-$name.png").path

    @After fun off() { DualScreen.pretend(null); Pad.forget(); TableEmotes.menuOpen = false }

    private val inspected = mutableListOf<Int>()
    private val modes = mutableListOf<String>()
    private val players = mutableListOf<Int>()

    private fun show(st: MatchState) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val anchors = Anchors()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night).padRoot()) {
                    ForgeBoard(st, live = true, intents = TableIntents(mode = { modes += it }, player = { players += it }), selectedHand = null, onSelectHand = {}, onInspect = { inspected += it.id }, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
        this.anchors = anchors
    }
    private var anchors = Anchors()
    private fun has(text: String) = rule.onAllNodesWithText(text, substring = true, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
    private fun close() { rule.onNodeWithText("Close", useUnmergedTree = true).performClick(); rule.waitForIdle(); assertTrue("the sheet stayed open", !has("newest first")) }

    @Test fun theGraveyardOpensFromTheSquareByTouchAndPad() {
        val st = state("crowded")
        show(st)
        // Touch: a tap on the CPU's graveyard card in its square opens the sheet on the CPU's graveyard.
        val g = anchors.rects.getValue("grave${st.cpu.id}")
        assertTrue("CPU graveyard ${g} not in its square", anchors.rects.getValue("square${st.cpu.id}").contains(g.center))
        rule.onRoot().performTouchInput { click(g.center) }; rule.waitForIdle()
        assertTrue("a tap did not open the CPU's graveyard", has("CPU's graveyard") && has("${st.cpu.graveyard.size} cards, newest first"))
        rule.onRoot().captureRoboImage(shot("grave-touch-844x390"))
        close()
        // Pad: the ring on your graveyard (its words for A are "Open"), and A opens your graveyard.
        Pad.used()
        rule.onNode(hasContentDescription("Your graveyard", substring = true)).requestFocus(); rule.waitForIdle()
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }; rule.waitForIdle()
        assertTrue("A did not open your graveyard", has("${st.me.graveyard.size} cards, newest first"))
        rule.onRoot().captureRoboImage(shot("grave-pad-844x390"))
        close()
    }

    @Test fun chatAndTheBoltKeepTheirFunctionAt44dp() {
        val st = state("crowded")
        show(st)
        val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val mine = anchors.rects.getValue("square${st.viewer}")
        for (label in listOf("Emotes", "Smart")) {
            val r = rule.onNode(hasContentDescription(label, substring = true)).getBoundsInRoot()
            val w = (r.right - r.left).value; val h = (r.bottom - r.top).value
            assertTrue("$label is $w × $h dp, not 44", w >= 43.5f && h >= 43.5f)
            assertTrue("$label ${r.bottom.value * dp} not above your square ${mine.top}", r.bottom.value * dp <= mine.top + 1f)
        }
        // Chat opens the emote menu; the bolt sets Smart.
        rule.onNodeWithContentDescription("Emotes").performClick(); rule.waitForIdle()
        assertTrue("chat did not open the emotes", TableEmotes.menuOpen)
        TableEmotes.menuOpen = false; rule.waitForIdle()
        rule.onNode(hasContentDescription("Smart", substring = true)).performClick(); rule.waitForIdle()
        assertEquals(listOf("smart"), modes)
    }

    /** The portrait in the square is smaller than the live seat's: a target still takes a tap in a 44 dp box round its middle. */
    @Test fun aPortraitTargetTakesATapIn44dp() {
        val st0 = state("targets")
        val cpu = st0.players.first { it.id != st0.viewer }.id
        val st = st0.copy(selection = st0.selection.copy(players = st0.selection.players + cpu, targetPlayers = st0.selection.targetPlayers + cpu))
        show(st)
        val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val r = anchors.rects.getValue("orb$cpu")
        // Just inside 22 dp above and left of its middle (away from the board's centre, as TouchTargetTest taps).
        rule.onRoot().performTouchInput { click(Offset(r.center.x - 21f * dp, r.center.y - 21f * dp)) }; rule.waitForIdle()
        assertEquals(listOf(cpu), players)
    }
}
