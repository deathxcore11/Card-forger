package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.click
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TileTags
import dev.cardstashy.nativeplay.ui.WhyNot
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Explains itself E1 (specs/explains-itself-briefs.md, approved 19 Nov): a card you can't use says why on itself. Pictures in
 * explains-itself, for the eye; they are desktop renders, never device proof.
 */
abstract class WhyNotShots(private val tag: String) {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()
    private fun cap(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "explains-itself/$name-$tag.png").path) }
    private fun show(st: MatchState, live: Boolean, lifted: Int?) {
        dev.cardstashy.nativeplay.ui.Motion.still = true; TileTags.clearAll()
        rule.setContent { CompositionLocalProvider(LocalAnchors provides anchors) { Box(Modifier.fillMaxSize().background(Palette.Night)) {
            ForgeBoard(st, live = live, intents = TableIntents(), selectedHand = lifted, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}) } } }
        rule.waitForIdle(); rule.waitForIdle()
    }

    /** A 5-cost card with three lands: pips (three lit, two dashed) and "2 mana short" on the lifted card. */
    @Test fun manaShort() {
        val me = base.me
        val serra = me.hand.first { it.name == "Monastery Swiftspear" }.copy(id = 990, name = "Serra Angel", type = "Creature — Angel", manaCost = "{3}{W}{W}",
            text = "Flying, vigilance", keywords = listOf("Flying", "Vigilance"), power = 4, toughness = 4)
        val field = me.battlefield.filter { it.name == "Mountain" || it.isCreature }.map { it.copy(tapped = false) }
        val st = base.copy(players = base.players.map { if (it.id == base.viewer) it.copy(hand = it.hand.take(3) + serra, battlefield = field, mana = it.mana.mapValues { 0 }) else it },
            selection = base.selection.copy(actionable = base.selection.actionable + 990))
        show(st, true, 990)
        cap("why-mana-short")
        rule.onNodeWithText("2 mana short").assertExists()
    }

    /** The CPU's turn: a lifted sorcery says "Only on your turn". */
    @Test fun onlyOnYourTurn() {
        val cpu = base.players.first { it.id != base.viewer }.id
        val st = base.copy(activePlayer = cpu, priorityPlayer = cpu, inputType = null, buttons = Buttons(null, null, false, false), selection = base.selection.copy(actionable = emptySet()))
        show(st, false, base.me.hand.first { it.name == "Skewer the Critics" }.id)
        cap("why-your-turn")
        rule.onNodeWithText(WhyNot.YOUR_TURN).assertExists()
    }

    /** Attackers are asked for: a tap on the creature that arrived this turn puts the reason on its tile. */
    @Test fun arrivedThisTurn() {
        val bears = base.me.battlefield.first { it.name == "Grizzly Bears" }
        val st = base.copy(inputType = "InputAttack", phase = "COMBAT_DECLARE_ATTACKERS", buttons = Buttons("OK", null, true, false),
            players = base.players.map { p -> if (p.id == base.viewer) p.copy(battlefield = p.battlefield.map { if (it.id == bears.id) it.copy(summoningSick = true) else it }) else p },
            selection = base.selection.copy(actionable = base.me.battlefield.filter { it.isCreature && it.id != bears.id }.map { it.id }.toSet()))
        show(st, true, null)
        val tile = anchors.rects["c${bears.id}"] ?: error("no tile")
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(tile.center.x, tile.center.y)) }; rule.waitForIdle()
        assertEquals(WhyNot.ARRIVED, TileTags.tagFor(bears.id)?.text)
        cap("why-arrived")
    }
}

@RunWith(RobolectricTestRunner::class) @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class WhyNotFoldShotTest : WhyNotShots("fold")

@RunWith(RobolectricTestRunner::class) @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(sdk = [35], qualifiers = "w844dp-h390dp-xhdpi")
class WhyNotPhoneShotTest : WhyNotShots("phone")
