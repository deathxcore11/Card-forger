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
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
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
        // Your creatures at 49 % of the height (within 2 %), your lands near 66 %, the line near 37 %. (Were 46 and 62 % until better
        // table scene 5 made the creature tiles a fifth taller on the Fold; the block keeps its gaps and its middle line.)
        assertEquals(.49f, at(creature.id).center.y / h, .02f)
        assertEquals(.66f, at(901).center.y / h, .02f)
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

    /**
     * Better table scene 4: "Choose blockers". Nothing blocked yet: every able blocker wears the ice ring, the gold says "No blocks"
     * and the chip says what gets through. One block made: the gold join line, "Blocked · 0 gets through", and dark "No blocks"
     * above gold "Block with 1". Pictures table-look/block-<screen>-pick.png and -blocked.png.
     */
    private fun blocks(screen: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val land = base.me.battlefield.first { it.isLand }; val creature = base.me.battlefield.first { it.isCreature }
        val foe = base.cpu.battlefield.first { it.isCreature }.copy(id = 970, attacking = true, tapped = true, power = 5, toughness = 5, keywordsKnown = true, keywords = emptyList(), attachments = emptyList())
        val vendor = creature.copy(id = 941, tapped = false, attacking = false, summoningSick = false, power = 3, toughness = 3, keywordsKnown = true, keywords = emptyList(), attachments = emptyList())
        val second = vendor.copy(id = 942)
        fun board(blocking: Boolean): MatchState {
            val mine = (1..4).map { land.copy(id = 900 + it, tapped = false) } + vendor.copy(blocking = blocking, blockingIds = if (blocking) listOf(foe.id) else emptyList()) + second
            return base.copy(inputType = "InputBlock", phase = "COMBAT_DECLARE_BLOCKERS", activePlayer = cpu, priorityPlayer = me, stack = emptyList(),
                buttons = dev.cardstashy.nativeplay.engine.Buttons("OK", "Cancel", true, false), selection = base.selection.copy(cards = emptySet(), actionable = emptySet()),
                message = "Select creatures to block ${foe.name} (${foe.id}) or select another attacker to declare blockers for.",
                players = base.players.map { p -> when (p.id) { me -> p.copy(battlefield = mine, life = 20); cpu -> p.copy(battlefield = p.battlefield.filter { !it.isCreature } + foe); else -> p } })
        }
        assertEquals("Choose blockers", dev.cardstashy.nativeplay.ui.askLine(board(false)))
        var st by mutableStateOf(board(false))
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-look/block-$screen-pick.png").path)
        rule.onNodeWithText("Choose blockers").assertExists()
        rule.onNodeWithContentDescription("5 gets through \u00B7 Life 20 \u2192 15").assertExists()
        rule.onNodeWithText("No blocks").assertExists()
        assertTrue("no dark button before a block", rule.onAllNodesWithText("No blocks").fetchSemanticsNodes().size == 1)
        st = board(true)
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-look/block-$screen-blocked.png").path)
        rule.onNodeWithContentDescription("Blocked \u00B7 0 gets through").assertExists()
        rule.onNodeWithText("Block with 1").assertExists(); rule.onNodeWithText("No blocks").assertExists()
        val gold = anchors.rects.getValue("gold"); val quiet = anchors.rects.getValue("quiet"); val chip = anchors.rects.getValue("throughchip")
        assertTrue("No blocks stands above Block with 1", quiet.bottom <= gold.top + 1f)
        assertTrue("the chip is clear of the buttons", !chip.overlaps(gold) && !chip.overlaps(quiet))
        assertTrue("the chip is inside the window: $chip", chip.left >= 0f && chip.right <= rule.onRoot().fetchSemanticsNode().size.width)
        assertTrue("the chip keeps off the cards", listOf(970, 941, 942).none { anchors.rects["c$it"]?.overlaps(chip) == true })
    }

    @Test fun blocksFold() = blocks("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun blocksPhone() = blocks("phone")
}
