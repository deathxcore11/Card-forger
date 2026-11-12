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

/**
 * The Fold open (884 x 796 dp), Randall 12 Nov on the live build: "This kinda don't look like how you showed me". The approved
 * Fold preview has the four rows as one block about the middle line (line 37 %, your creatures 46 %, your lands 62 %, hand 80 %);
 * the build had each side hugging its own edge with an empty band between. Brief: "Fold and tablet do not match the approved
 * preview". Two creatures, five lands, a planeswalker and a CPU spell on the stack. Picture table-look/fold-block.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class FoldBlockShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val me = base.viewer; private val cpu = base.cpu.id
    private val anchors = Anchors()

    @Test fun theRowsAreOneBlockAboutTheMiddleLine() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val land = base.me.battlefield.first { it.isLand }; val creature = base.me.battlefield.first { it.isCreature }
        val walker = creature.copy(id = 950, name = "Jace, the Mind Sculptor", type = "Legendary Planeswalker — Jace", power = null, toughness = null)
        val mine = (1..5).map { land.copy(id = 900 + it, tapped = false) } + listOf(creature, creature.copy(id = 940)) + walker
        val spell = base.cpu.battlefield.first { it.isCreature }.copy(id = 960, zone = "Stack")
        val st = base.copy(stack = listOf(StackItem(7, spell.text, spell, cpu)), inputType = "InputPassPriority", priorityPlayer = me,
            players = base.players.map { p -> if (p.id == me) p.copy(battlefield = mine) else p })
        assertEquals("Respond to ${spell.name}?", dev.cardstashy.nativeplay.ui.askLine(st))
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-look/fold-block.png").path)
        val h = rule.onRoot().fetchSemanticsNode().size.height.toFloat(); val dp = h / 796f
        val z = ZoneLayout.of(884f, 796f); val rows = ZoneLayout.rows(z, false)
        fun at(id: Int) = anchors.rects.getValue("c$id")
        // Your creatures at 46 % of the height (within 2 %), your lands near 62 %, the line near 37 %.
        assertEquals(.46f, at(creature.id).center.y / h, .02f)
        assertEquals(.62f, at(901).center.y / h, .02f)
        assertEquals(.37f, rows.divider / 796f, .01f)
        // No empty band: 6.6 % of the height between the two creature rows, 5 % between a creature row and its lands.
        assertEquals(.066f * 796f, rows.myFront.top - rows.cpuFront.bottom, .5f)
        assertEquals(.05f * 796f, rows.myBack.top - rows.myFront.bottom, .5f); assertEquals(.05f * 796f, rows.cpuFront.top - rows.cpuBack.bottom, .5f)
        val hand = z.handTray!!
        assertTrue("your lands end above the hand", at(901).bottom / dp < hand.y)
        // The question: a plain line on the middle line, clear of the hand cards.
        val ask = anchors.rects.getValue("askline")
        assertEquals("the question is on the middle line", rows.divider, ask.center.y / dp, 2f)
        assertTrue(ask.bottom / dp < hand.y)
        // The stack card: by the middle line, card and words above the hand, and not on the planeswalker.
        val card = anchors.rects.getValue("stackcard")
        assertTrue("the stack card and its words are clear of the hand: $card", card.bottom / dp + 30f < hand.y)
        assertTrue("the middle line runs through the stack card", card.top / dp < rows.divider && card.bottom / dp > rows.divider)
        anchors.rects["stacklabel"]?.let { assertTrue("its label is above the hand: $it", it.bottom / dp < hand.y) }
        assertTrue("the stack card does not cover the planeswalker", !at(walker.id).overlaps(card))
    }
}
