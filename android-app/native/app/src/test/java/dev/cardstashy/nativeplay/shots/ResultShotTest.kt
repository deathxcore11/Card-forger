package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.audio.TableAudio
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Motion
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.Result
import dev.cardstashy.nativeplay.ui.ResultMotion
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.endReason
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
 * Better table scene 12, an ending with weight: over the dimmed final board a full-width band with Defeat (Victory in gold, Draw
 * plain), the match in three numbers (Turns, You, CPU, Forge's values as they are: a life under 0 shows under 0) and Home with
 * Rematch. Pictures on the Fold's inner screen (884 × 796) and the phone (844 × 390) in better-table/result-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class ResultShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:Rule val rule = createComposeRule()
    @After fun off() { Pad.forget(); Motion.still = true }

    private fun base(): MatchState = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun lost() = base().lives(-7, 11).let { it.copy(status = "finished", winnerPlayerId = it.cpu.id, draw = false, turn = 15) }
    private fun won() = base().lives(9, 0).let { it.copy(status = "finished", winnerPlayerId = it.viewer, draw = false, turn = 12) }
    private fun drawn() = base().lives(0, 0).copy(status = "finished", winnerPlayerId = null, draw = true, turn = 9)

    private fun draw(name: String, st: MatchState, note: String? = null): Anchors {
        Motion.still = true
        TableEmotes.destroy()
        val anchors = Anchors()
        val audio = TableAudio(RuntimeEnvironment.getApplication())
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    Result(st, audio, onHome = {}, onRematch = {}, note = note, reason = endReason(st, false))
                }
            }
        }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "better-table/result-$name.png").path)
        return anchors
    }

    private fun checkLayout(a: Anchors, phone: Boolean) {
        val sw = rule.onRoot().fetchSemanticsNode().size.width.toFloat(); val sh = rule.onRoot().fetchSemanticsNode().size.height.toFloat()
        val band = a.rects["result.band"]!!
        val word = a.rects["result.word"]!!
        // The band runs the full width; the word is big in it.
        assertTrue("band ${band.width} of $sw", band.width >= sw * .98f)
        assertTrue("word ${word.width} of $sw", word.width >= sw * .2f)
        assertTrue("word inside band", band.contains(word.center))
        if (!phone) assertEquals("band at 30 % of the height", .30f, band.top / sh, .02f)
        val stats = a.rects["result.stats"]!!; val home = a.rects["result.home"]!!; val again = a.rects["result.rematch"]!!
        for (l in listOf("Turns", "You", "CPU")) assertNotNull("stat $l", a.rects["result.stat:$l"])
        // Band, then numbers, then buttons, top to bottom, none over another, all on screen.
        assertTrue("numbers under the band", stats.top >= band.bottom)
        assertTrue("buttons under the numbers", minOf(home.top, again.top) >= stats.bottom)
        for ((k, r) in listOf("home" to home, "rematch" to again, "stats" to stats, "band" to band))
            assertTrue("$k on screen: $r in $sw x $sh", r.left >= 0f && r.top >= 0f && r.right <= sw + 1f && r.bottom <= sh + 1f)
        assertTrue("Home left of Rematch", home.right <= again.left)
    }

    @Test fun defeatFold() {
        val a = draw("defeat-fold", lost())
        checkLayout(a, phone = false)
        rule.onAllNodesWithText("Defeat").fetchSemanticsNodes().let { assertEquals(1, it.size) }
        rule.onAllNodesWithText("-7").fetchSemanticsNodes().let { assertTrue("You −7 shown as Forge has it", it.isNotEmpty()) }
        rule.onAllNodesWithText("15").fetchSemanticsNodes().let { assertTrue("Turns 15", it.isNotEmpty()) }
        assertNotNull("the reason line has room on the Fold", a.rects["result.reason"])
        // Review: the cause by name, no number that contradicts the −7 above it.
        assertEquals(1, rule.onAllNodesWithText("Out of life").fetchSemanticsNodes().size)
        assertEquals(0, rule.onAllNodesWithText("reached 0", substring = true).fetchSemanticsNodes().size)
    }

    @Config(qualifiers = "w844dp-h390dp-land-xxhdpi") @Test fun defeatPhone() {
        val a = draw("defeat-phone", lost())
        checkLayout(a, phone = true)
    }

    @Test fun victoryFold() {
        val a = draw("victory-fold", won(), note = "+40 coins")
        checkLayout(a, phone = false)
        rule.onAllNodesWithText("Victory").fetchSemanticsNodes().let { assertEquals(1, it.size) }
    }

    @Config(qualifiers = "w844dp-h390dp-land-xxhdpi") @Test fun victoryPhoneWithNote() {
        val a = draw("victory-phone", won(), note = "+40 coins")
        checkLayout(a, phone = true)
    }

    @Test fun drawFold() {
        val a = draw("draw-fold", drawn())
        checkLayout(a, phone = false)
        rule.onAllNodesWithText("Draw").fetchSemanticsNodes().let { assertEquals(1, it.size) }
        assertNull("a draw names no reason", a.rects["result.reason"])
    }

    /** The parts' timing all ends inside the rise, so X never goes live before everything has landed. */
    @Test fun theTiming() {
        val end = ResultMotion.IN_MS.toFloat()
        for (f in listOf(ResultMotion::dim, ResultMotion::streak, ResultMotion::word, ResultMotion::sweep, ResultMotion::buttons)) {
            assertEquals(0f, f(0f), .001f); assertEquals(1f, f(end), .001f)
        }
        for (i in 0..2) { assertEquals(0f, ResultMotion.stat(0f, i), .001f); assertEquals(1f, ResultMotion.stat(end, i), .001f) }
        // A short screen drops the reason line first, then the note, and the buttons stay on screen.
        val t = ResultMotion.tops(390, 90, 60, 16, 46, 18, 14, 10)
        assertTrue(t.buttons + 46 <= 380)
        assertTrue(t.stats >= t.band + 90 && t.buttons >= t.stats + 60)
        val roomy = ResultMotion.tops(796, 90, 60, 16, 46, 18, 14, 10)
        assertEquals((796 * .30f).toInt(), roomy.band); assertNotNull(roomy.reason); assertNotNull(roomy.note)
    }
}
