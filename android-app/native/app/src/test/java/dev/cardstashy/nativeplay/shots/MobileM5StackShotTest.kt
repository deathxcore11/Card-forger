package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
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
 * Mobile table M5, the stack card at phone size (the brief's "stack card and the right strip"): it stands 58 % of the height
 * tall against the right strip, over the right end of the board, and no tile moves when it opens (walk line 27). Step aside:
 * while a question is open and a legal target lies under it, it drops to the size that fits the strip, so the target can be
 * tapped. Pictures in table-look/m5-stack-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM5StackShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val me = base.viewer
    private val spear = base.me.hand.first { it.name == "Monastery Swiftspear" }
    private val cast = base.copy(stack = listOf(StackItem(7, spear.text, spear.copy(zone = "Stack"), me)),
        players = base.players.map { p -> if (p.id == me) p.copy(hand = p.hand.filter { it.id != spear.id }) else p })
    private val anchors = Anchors()
    private var st by mutableStateOf(base)
    private fun shot(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/m5-stack-$name.png").path) }
    private fun tiles(of: MatchState) = of.players.flatMap { it.battlefield }.associate { it.id to anchors.rects.getValue("c${it.id}") }

    @Test fun theStackCardIsBigMovesNoTileAndStepsAsideForATarget() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        shot("shut")
        val before = tiles(base)
        val z = ZoneLayout.of(844f, 390f)
        val dp = rule.onRoot().fetchSemanticsNode().size.width / 844f
        rule.runOnUiThread { st = cast }
        shot("open")
        val card = anchors.rects.getValue("stackcard")
        assertEquals("the stack card is 58 % of the height", .58f * 390f, card.height / dp, 1.5f)
        assertTrue("it stands against the right strip, over the board: $card", card.right / dp <= z.rightStrip.x && card.left / dp >= z.board.x && card.right / dp > z.rightStrip.x - 12f)
        assertTrue("clear of the top and of the buttons' row", card.top / dp >= 8f && card.bottom / dp <= 390f - 8f)
        // Walk line 27: the stack opening moves or shrinks no tile.
        assertEquals(before, tiles(cast))
        // A question whose legal targets are clear of the card: it stays full size.
        val mine = base.me.battlefield.filter { it.isCreature }
        rule.runOnUiThread { st = cast.copy(inputType = "InputSelectTargets", message = "Select target creature", selection = cast.selection.copy(targetCards = mine.map { it.id }.toSet(), cards = emptySet(), actionable = emptySet(), min = 1, max = 1)) }
        shot("question-clear")
        assertEquals("full size while no target is under it", .58f * 390f, anchors.rects.getValue("stackcard").height / dp, 1.5f)
        // Seven creatures: the row runs under the card. With them offered, the card steps aside into the strip.
        val more = (1..4).map { i -> mine.first().copy(id = 900 + i) }
        val wide = cast.copy(players = cast.players.map { p -> if (p.id == me) p.copy(battlefield = p.battlefield + more) else p })
        rule.runOnUiThread { st = wide }
        shot("wide")
        val big = anchors.rects.getValue("stackcard")
        val underIt = (mine + more).filter { anchors.rects.getValue("c${it.id}").overlaps(big) }
        assertTrue("the wide row runs under the full-size card", underIt.isNotEmpty())
        rule.runOnUiThread { st = wide.copy(inputType = "InputSelectTargets", message = "Select target creature", selection = wide.selection.copy(targetCards = (mine + more).map { it.id }.toSet(), cards = emptySet(), actionable = emptySet(), min = 1, max = 1)) }
        shot("question-under")
        val small = anchors.rects.getValue("stackcard")
        assertTrue("the card stepped aside into the strip: $small", small.left / dp >= z.rightStrip.x && small.height < big.height * .8f)
        for (c in mine + more) assertTrue("${c.name} ${c.id} is clear of the card", !anchors.rects.getValue("c${c.id}").overlaps(Rect(small.left, small.top, small.right, small.bottom)))
    }
}
