package dev.cardstashy.nativeplay.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T3 (faults 19 and 24): on the real board, a tap on a pile, a graveyard or a lone card opens the glass sheet over the lower
 * part of the table, the board above stays in view, the graveyard's tabs switch sides, Close and a tap outside close it, and a
 * question that asks for a graveyard card opens that graveyard with the card ringed and a tap picks it. Pictures at phone size
 * and on the dual layout (the sheet on the bottom screen, the top screen unchanged).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class TableSheetShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()); dev.cardstashy.nativeplay.art.CardImageTest.art = { _, _ -> null } }
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private val anchors = Anchors()
    private val picked = mutableListOf<Int>()
    private val inspected = mutableListOf<Card>()
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t3-$name.png").path)

    @After fun off() { DualScreen.pretend(null) }

    private fun show(st: MatchState, live: Boolean = false, dual: Boolean = false) {
        Motion.still = true
        if (dual) DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Column(Modifier.fillMaxSize().background(Palette.Night)) {
                    Box(Modifier.fillMaxWidth().weight(1f)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = live, intents = TableIntents(card = { picked += it }), selectedHand = null, onSelectHand = {}, onInspect = { inspected += it }, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                    }
                    // The dual layout's bottom screen, drawn under the top one so one picture shows both.
                    if (dual) Box(Modifier.fillMaxWidth().weight(1f)) { BottomRoot() }
                }
            }
        }
        rule.waitForIdle()
    }
    private fun tap(key: String, long: Boolean = false) {
        val r = anchors.rects.getValue(key)
        rule.onRoot().performTouchInput { if (long) longClick(Offset(r.center.x, r.center.y)) else click(Offset(r.center.x, r.center.y)) }
        rule.waitForIdle()
    }
    private fun has(text: String) = rule.onAllNodesWithText(text, substring = true, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    @Test fun graveyardsOpenOnATapAndSwitchSides() {
        val st = state("crowded")
        show(st)
        tap("grave${st.cpu.id}")
        assertTrue(has("CPU's graveyard")); assertTrue(has("Your graveyard")); assertTrue(has("4 cards, newest first"))
        val sheet = anchors.rects.getValue("tableSheet")
        val dm = org.robolectric.RuntimeEnvironment.getApplication().resources.displayMetrics
        // The lower 56 %: the board above stays in view.
        assertEquals(dm.heightPixels * .44f, sheet.top, dm.density * 2)
        shot("graveyard-cpu-844x390")
        rule.onNodeWithText("Your graveyard", useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertTrue(has("3 cards, newest first"))
        rule.onNodeWithText("Close", useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertTrue(!has("newest first"))
    }

    @Test fun aPileOpensWholeReadyFirstAndATapOutsideCloses() {
        val st = state("crowded")
        show(st)
        // Your Forests: a pile of 2 ready and a pile of 3 tapped; either opens all five.
        tap("c137")
        assertTrue(has("Your Forest ×5")); assertTrue(has("2 ready, 3 tapped"))
        assertEquals(2, rule.onAllNodesWithText("Ready", useUnmergedTree = true).fetchSemanticsNodes().size)
        assertEquals(3, rule.onAllNodesWithText("Tapped", useUnmergedTree = true).fetchSemanticsNodes().size)
        shot("pile-844x390")
        // A tap on the board above the sheet closes it.
        rule.onRoot().performTouchInput { click(Offset(width / 2f, height * .1f)) }; rule.waitForIdle()
        assertTrue(!has("2 ready, 3 tapped"))
        // A lone card opens by a long press too; a tap on a card in the sheet opens the big view.
        tap("c113", long = true)
        assertTrue(has("Hill Giant")); assertTrue(has("Now 3/3"))
        rule.onNodeWithText("Now 3/3", useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertTrue(inspected.any { it.id == 113 })
    }

    @Test fun aQuestionForAGraveyardCardOpensItAsTheChooser() {
        val st0 = state("crowded")
        val opt = st0.cpu.graveyard.first { it.name == "Opt" }
        val st = st0.copy(selection = st0.selection.copy(targetCards = setOf(opt.id)))
        show(st, live = true)
        assertTrue(has("CPU's graveyard"))
        shot("graveyard-chooser-844x390")
        rule.onNodeWithContentDescription("Opt, Opt").performClick(); rule.waitForIdle()
        assertEquals(listOf(opt.id), picked)
    }

    @Test fun onTwoScreensTheSheetIsOnTheBottomScreen() {
        val st = state("crowded")
        show(st, dual = true)
        val before = anchors.rects.getValue("c113")
        tap("grave${st.cpu.id}")
        assertTrue(has("CPU's graveyard"))
        rule.onNodeWithText("Your graveyard", useUnmergedTree = true).performClick(); rule.waitForIdle()
        assertTrue(has("Your graveyard"))
        val sheet = anchors.rects.getValue("tableSheet")
        val top = anchors.rects.getValue("c113")
        // The sheet lies on the bottom screen (the lower half of this picture) and the top screen's board did not move.
        val dm = org.robolectric.RuntimeEnvironment.getApplication().resources.displayMetrics
        assertTrue("sheet at $sheet", sheet.top >= dm.heightPixels / 2f)
        assertEquals(before, top)
        shot("graveyard-dual")
    }
}
