package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TravelMoment
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.LocalTravel
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TravelClock
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Mobile table M6 at phone size (walk line 68): the CPU's cast, at the stack, grows to 82 % of the height to be read, is held,
 * and returns to stack size (58 %) before its lands pay. Pictures in table-look/m6-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM6PopShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun off() { TravelClock.fixed = null }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val cpu = base.players.first { it.id != base.viewer }.id
    private val spell = base.me.hand.first { it.name == "Monastery Swiftspear" }.copy(id = 990, controller = cpu, owner = cpu, zone = "Stack")
    private val st = base.copy(activePlayer = cpu, priorityPlayer = cpu, stack = listOf(StackItem(7, spell.text, spell, cpu)))
    private val anchors = Anchors()
    private val fx = Battlefield()
    private var travel by mutableStateOf<TravelMoment?>(null)

    private fun at(ms: Long, name: String): androidx.compose.ui.geometry.Rect {
        val t = Director.Travel(spell.id, spell.name, false, Director.Leg.POP, "stackcard", Director.POP_MS, 7)
        rule.runOnUiThread { TravelClock.fixed = ms.toFloat() / t.ms; travel = TravelMoment(t, 0, ms + 1); fx.now.longValue += 1L }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/m6-$name.png").path)
        return anchors.rects.getValue("travelcard")
    }

    @Test fun theCpusCastGrowsLargeToBeReadAndReturnsToStackSize() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx, LocalTravel provides travel) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
        val root = rule.onRoot().fetchSemanticsNode().size; val dp = root.width / 844f
        val stack = anchors.rects.getValue("stackcard")
        assertEquals("the stack card is 58 % of the height", .58f * 390f, stack.height / dp, 1.5f)
        // Held large (300 to 950 ms): 82 % of the height, whole on the screen, at the right.
        val large = at(600, "pop-held")
        assertEquals("the pop is 82 % of the height", .82f * 390f, large.height / dp, 1.5f)
        assertTrue("the popped card is whole on the screen: $large", large.left >= 0f && large.top >= 0f && large.right <= root.width && large.bottom <= root.height)
        assertTrue("it grows where the stack card is", large.overlaps(stack) && large.right > root.width * .8f)
        // Growing (150 ms in) it is between the two sizes; at the end it is the stack card's size and place again.
        val growing = at(150, "pop-growing")
        assertTrue(growing.height > stack.height * 1.05f && growing.height < large.height * .98f)
        val done = at(1150, "pop-done")
        assertEquals(stack.height, done.height, 2f); assertEquals(stack.center.x, done.center.x, 2f); assertEquals(stack.center.y, done.center.y, 2f)
    }
}
