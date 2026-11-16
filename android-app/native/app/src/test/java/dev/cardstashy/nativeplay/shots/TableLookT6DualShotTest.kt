package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.BottomRoot
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.After
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
 * 0.4.59 T6 on two screens (Thor): the question is the bottom screen's top strip over the faded hand; the top screen says nothing,
 * it only rings the targets. The table hands the bottom screen its view after it is laid out (as on the device, one frame later),
 * so the board is held on a test rule and looked at once it has settled.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h1080dp-land-xhdpi")
class TableLookT6DualShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); dev.cardstashy.nativeplay.art.CardImageTest.art = { _, _ -> null } }
    @After fun off() { DualScreen.pretend(null) }

    @Test fun onTwoScreensTheQuestionIsTheBottomsTopStrip() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
        val anchors = Anchors()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Column(Modifier.fillMaxSize().background(Palette.Night)) {
                    Box(Modifier.fillMaxWidth().weight(1f)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    }
                    Box(Modifier.fillMaxWidth().weight(1f)) { BottomRoot() }
                }
            }
        }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t6-targets-dual.png").path)
        val r = anchors.rects
        assertNull("the top screen asks nothing", r["askline"])
        val q = r["b.question"]; val hand = r["b.hand"]
        assertNotNull("the bottom asks", q); assertNotNull("the hand under it", hand)
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        assertTrue("the question is on the bottom screen, above the hand: $q $hand", q!!.top >= dm.heightPixels / 2f && q.bottom <= hand!!.top)
    }
}
