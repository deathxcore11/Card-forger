package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.shots.AuraFixture
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Review of the Disenchant fix (Randall's Fold recording 15 Nov 2026): the real engine offers Holy Strength and Weakness in
 * selection.cards with selection.targets empty (AuraTargetProbe), and the controller's target walk read selection.targets only,
 * so RT's ask jump, the shoulders and the stick never reached an aura's edge. AuraFixture's board on the Fold, with a pad.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class AuraPadTargetTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @After fun off() { Pad.forget(); TableZones.ask = null; TableZones.at = 0; TableZones.jumped = false; TablePad.handAt = -1; PadPrompts.keyRepeat = 0 }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val picked = mutableListOf<Int>()

    private fun step() { androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications(); rule.mainClock.advanceTimeBy(600) }

    private fun onEdge(name: String) = runCatching { rule.onNode(isFocused()).assert(hasContentDescription("$name on Savannah Lions")) }.isSuccess

    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @Test fun ringStepsOntoWeaknessAndAPicksIt() {
        Motion.still = true; rule.mainClock.autoAdvance = false
        Pad.used()
        val st = AuraFixture.board(base, asking = true)
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides remember { Anchors() }) {
                Box(Modifier.fillMaxSize().padRoot()) {
                    ForgeBoard(st, live = true, intents = TableIntents(card = { picked += it }), selectedHand = null, onSelectHand = {},
                        onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        step(); step()
        // RT's ask jump (the cast asks for its target): the ring lands on an offered aura's edge, where A says Choose.
        assertTrue("the ask jump left the ring off the auras", onEdge("Holy Strength") || onEdge("Weakness"))
        assertEquals("Choose", PadPrompts.current().a)
        // The shoulder walks the offered cards: step until the ring is on Weakness.
        var n = 0
        while (!onEdge("Weakness") && n < 4) { rule.runOnUiThread { PadPrompts.current().tabs!!(1) }; step(); n++ }
        assertTrue("the walk never reached Weakness", onEdge("Weakness"))
        // A picks Weakness: Forge's card pick, as the real engine took it.
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }
        step()
        assertEquals(listOf(AuraFixture.WEAK), picked)
    }
}
