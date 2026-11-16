package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.Beat
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TravelMoment
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.BeatCaption
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Better table scene 6, "The CPU's spell names its target": the CPU's Lightning Bolt at your Goblin Guide, held large in its pop. The
 * popped card stays at the right edge and never covers the creature it targets, the red arc leaves the card the player is reading,
 * and the line reads "CPU · Lightning Bolt · 3 damage to Goblin Guide" (Forge's own stack words). Fold inner screen and phone.
 * Pictures in table-better/cpu-spell-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class CpuSpellShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun off() { TravelClock.fixed = null }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val cpu = base.players.first { it.id != base.viewer }.id
    private val bolt = base.me.hand.first { it.name == "Lightning Bolt" }.copy(id = 990, controller = cpu, owner = cpu, zone = "Stack")

    /** The CPU's Bolt at [target], on the stack with Forge's own text, in its pop at 600 ms (held large); returns the rects and the line. */
    private fun shot(target: Int, name: String): Triple<androidx.compose.ui.geometry.Rect, androidx.compose.ui.geometry.Rect, Beat> {
        val aim = Ref("card", target, null)
        val targetName = base.card(target)!!.name
        val st = base.copy(activePlayer = cpu, priorityPlayer = base.viewer, inputType = "InputPassPriority",
            stack = listOf(StackItem(7, "Lightning Bolt (990) - Lightning Bolt deals 3 damage to $targetName ($target).", bolt, cpu, targets = listOf(aim))))
        val cast = GameEvent(1, "cast", st.turn, null, cpu, null, Ref("card", 990, "Lightning Bolt"), null, listOf(aim), emptyList(), emptyList(), null, null, null, null, null, null, stackId = 7)
        val pop = Director.plan(st, listOf(cast)).first { it.travel?.leg == Director.Leg.POP }
        val beat = pop.beat!!.copy(durationMs = 2400)
        val anchors = Anchors(); val fx = Battlefield()
        var travel by mutableStateOf<TravelMoment?>(null)
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx, LocalTravel provides travel) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    // TableScreen.TableSide's caption spot.
                    BeatCaption(beat, Modifier.align(Alignment.TopCenter).padding(top = 58.dp)) {}
                }
            }
        }
        rule.waitForIdle()
        val ms = 600L
        rule.runOnUiThread { TravelClock.fixed = ms.toFloat() / pop.travel!!.ms; travel = TravelMoment(pop.travel!!, 0, ms + 1); fx.now.longValue += 1L }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-better/cpu-spell-$name.png").path)
        val card = anchors.rects.getValue("travelcard"); val tile = anchors.rects.getValue("c$target")
        assertNotNull("the line is drawn", anchors.rects["castline"])
        // The band's ends fade out over its 40 dp side padding; its words cover neither the card nor its target.
        val pad = 40f * RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val line = anchors.rects.getValue("castline").let { androidx.compose.ui.geometry.Rect(it.left + pad, it.top, it.right - pad, it.bottom) }
        assertTrue("the line's words $line cover neither the card $card nor its target $tile", !line.overlaps(card) && !line.overlaps(tile) && line.left >= 0f)
        return Triple(card, tile, beat)
    }

    private fun checks(card: androidx.compose.ui.geometry.Rect, tile: androidx.compose.ui.geometry.Rect, beat: Beat, target: String) {
        val root = rule.onRoot().fetchSemanticsNode().size
        assertTrue("the popped card $card does not cover its target $tile", !card.overlaps(tile))
        assertTrue("the popped card is whole on the screen: $card", card.left >= 0f && card.top >= 0f && card.right <= root.width && card.bottom <= root.height)
        assertTrue("it stays at the right: $card", card.center.x > root.width * .6f || card.right <= tile.left)
        assertEquals("3 damage to $target", beat.detail)
        rule.onNodeWithContentDescription("CPU · Lightning Bolt · 3 damage to $target").assertExists()
    }

    @Test fun foldTheCpuSpellNamesItsTargetAndKeepsOffIt() {
        val (card, tile, beat) = shot(109, "fold-goblin-guide")
        checks(card, tile, beat, "Goblin Guide")
    }

    @Test fun foldTheLeftmostTarget() {
        val (card, tile, beat) = shot(107, "fold-hill-giant")
        checks(card, tile, beat, "Hill Giant")
    }

    @Test @Config(qualifiers = "w844dp-h390dp-land-xxhdpi")
    fun phoneTheCpuSpellNamesItsTargetAndKeepsOffIt() {
        val (card, tile, beat) = shot(109, "phone-goblin-guide")
        checks(card, tile, beat, "Goblin Guide")
    }
}
