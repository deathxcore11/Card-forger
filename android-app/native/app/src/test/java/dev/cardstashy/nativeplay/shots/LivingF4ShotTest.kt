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
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.PromptOption
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.DecisionDock
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.WalkerPlates
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Living table F4 (specs/living-table-build-guide.md, "F4 Planeswalker plates") at phone size: Forge asks which of Liliana's three
 * abilities to play. Three plates stand beside her card in Forge's order, each with its loyalty cost; the list box is not shown;
 * choosing one sends exactly the answer the list sent, and a tap on the table leaves the question. With Match effects off the list
 * is shown as before. Pictures in table-look/f4-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF4ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun back() { AppSettings.applyMatchEffects("full") }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val ask0 = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-dock-choice.json")!!.readText())!!.prompt!!
    private val labels = listOf("+1: Each player discards a card.", "−2: Target player sacrifices a creature.", "−6: Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.")
    private fun walker(like: Card) = like.copy(id = 970, name = "Liliana of the Veil", type = "Legendary Planeswalker - Liliana", manaCost = "{1}{B}{B}", power = null, toughness = null, tapped = false,
        counters = mapOf("LOYALTY" to 6), attachments = emptyList(), attachedTo = null, text = labels.joinToString("\n"))
    private val table = base.copy(players = base.players.map { p -> if (p.id == base.viewer) p.copy(battlefield = p.battlefield + walker(p.battlefield.first { !it.isLand && !it.isCreature })) else p })
    private fun ask(id: Int, min: Int = 0, card: Int = 970) = ask0.copy(id = id, method = "getAbilityToPlay", message = "Choose an ability", min = min, max = 1, options = labels.mapIndexed { i, l -> PromptOption(i, l, card, kind = "ability") })

    @Test fun threeAbilitiesAreThreePlatesInForgesOrder() {
        val a = WalkerPlates.of(ask(5), table)!!
        assertEquals(970, a.card.id); assertEquals(listOf(0, 1, 2), a.plates.map { it.index }); assertEquals(listOf("+1", "−2", "−6"), a.plates.map { it.cost })
        assertEquals("Each player discards a card.", a.plates[0].text); assertTrue(a.cancel)
        assertEquals("the answer the list's Confirm sent", listOf(1), WalkerPlates.answer(a.plates[1]))
        // Not for another card's abilities, a choice of several, or another kind of question.
        assertNull(WalkerPlates.of(ask(5, card = table.me.battlefield.first { it.isCreature }.id), table))
        assertNull(WalkerPlates.of(ask(5).copy(max = 2), table)); assertNull(WalkerPlates.of(ask(5).copy(method = "getChoices"), table)); assertNull(WalkerPlates.of(null, table))
        // A column beside the card, in order from the top, on the screen, clear of the card; the middle one 14 further out.
        val card = Rect(700f, 190f, 760f, 274f)
        val r = WalkerPlates.place(3, card, 844f, 390f, big = false)
        assertTrue(r[0].top < r[1].top && r[1].top < r[2].top)
        for (p in r) { assertTrue(p.right <= card.left && p.left >= 8f && p.top >= 8f && p.bottom <= 382f); assertEquals(236f, p.width, .01f); assertEquals(46f, p.height, .01f) }
        assertEquals(14f, r[0].left - r[1].left, .01f); assertEquals(r[0].left, r[2].left, .01f); assertEquals(8f, r[1].top - r[0].bottom, .01f)
        // No room on the left: they stand on the right. A tablet's plates are 290 by 58.
        assertTrue(WalkerPlates.place(3, Rect(60f, 190f, 120f, 274f), 844f, 390f, false).all { it.left >= 120f })
        assertEquals(290f, WalkerPlates.place(3, Rect(900f, 400f, 1000f, 540f), 1280f, 800f, true)[0].width, .01f)
    }

    @Test fun thePlatesStandBesideTheCardAndAnswerLikeTheList() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val anchors = Anchors()
        val sent = ArrayList<Pair<Int, List<Int>?>>()
        var st by mutableStateOf(table.copy(prompt = ask(31)))
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    DecisionDock(st, live = true, intents = TableIntents(reply = { id, _, i, _ -> sent += id to i }), onInspect = {}, u = 1f)
                }
            }
        }
        rule.waitForIdle(); Thread.sleep(300); rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/f4-plates.png").path)
        val plates = rule.onAllNodesWithContentDescription("Ability", substring = true).fetchSemanticsNodes()
        assertEquals("three plates", 3, plates.size)
        val card = anchors.rects.getValue("c970")
        val boxes = plates.map { it.boundsInRoot }
        assertTrue("in Forge's order from the top", boxes[0].top < boxes[1].top && boxes[1].top < boxes[2].top)
        for (b in boxes) assertTrue("beside the card, not over it: $b $card", b.right <= card.left || b.left >= card.right)
        assertEquals("the list box is not shown", 0, rule.onAllNodesWithText("Confirm").fetchSemanticsNodes().size)
        // Choosing the second sends option 1, once.
        rule.onNodeWithContentDescription("Ability −2", substring = true).performClick()
        rule.waitForIdle()
        assertEquals(listOf(31 to listOf(1)), sent)
        // A new question; a tap on the table leaves it, as the list's "Cancel" did (an empty answer).
        rule.runOnUiThread { sent.clear(); st = table.copy(revision = table.revision + 1, prompt = ask(32)) }
        rule.waitForIdle()
        rule.onNodeWithContentDescription("Leave the abilities").performClick()
        rule.waitForIdle()
        assertEquals(listOf(32 to emptyList<Int>()), sent)
        // Match effects off: the list as it was.
        rule.runOnUiThread { AppSettings.applyMatchEffects("off"); sent.clear(); st = table.copy(revision = table.revision + 2, prompt = ask(33)) }
        rule.waitForIdle()
        assertEquals(0, rule.onAllNodesWithContentDescription("Ability", substring = true).fetchSemanticsNodes().size)
        assertTrue("the list is shown", rule.onAllNodesWithText("Clear selection").fetchSemanticsNodes().isNotEmpty())
    }
}
