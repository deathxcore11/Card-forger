package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** W11/Y5 on two screens: the ring on the hand chip, A lifts a card, A again plays or casts it (seen failing on the Thor, test4). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class PadCastTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @After fun off() { DualScreen.pretend(null); Pad.forget() }

    private fun state() = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!

    private fun step() { rule.mainClock.advanceTimeBy(600) }
    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    private fun center() {
        rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }
        step()
    }

    @Test fun aLiftsThenPlays() {
        Motion.still = true; rule.mainClock.autoAdvance = false
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        Pad.used()
        val st = state()
        val played = mutableListOf<Int>()
        var sel: Int? = null
        rule.setContent {
            var s by remember { mutableStateOf<Int?>(null) }
            sel = s
            CompositionLocalProvider(LocalAnchors provides remember { Anchors() }) {
                Box(Modifier.fillMaxSize().padRoot()) {
                    ForgeBoard(st, live = true, intents = TableIntents(card = { played += it }), selectedHand = s, onSelectHand = { s = it }, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        step()
        println("PADCAST hand=${st.me.hand.map { it.name + ":" + (it.id in st.selection.actionable) }} anyFocus=${PadPrompts.anyFocus} a=${PadPrompts.current().a} sel=$sel")
        rule.runOnUiThread { println("PADCAST hand req=${TableZones.hand}"); TableZones.hand?.requestFocus() }
        step()
        println("PADCAST after focus anyFocus=${PadPrompts.anyFocus} a=${PadPrompts.current().a} sel=$sel")
        center()
        println("PADCAST after A1 a=${PadPrompts.current().a} sel=$sel played=$played")
        center()
        println("PADCAST after A2 a=${PadPrompts.current().a} sel=$sel played=$played")
        assertEquals(1, played.size)
    }

    /**
     * Live 0.4.56 on the Thor: the ring start found the chip unfocusable (touch mode) and Android's own default focus, a Down
     * search from the top, put the ring on the menu button, so every A opened the menu. Now the ring start leaves touch mode,
     * and the board sends a Down entry to the hand chip.
     */
    @Test fun androidsDefaultFocusLandsOnTheHandNotTheMenu() {
        Motion.still = true; rule.mainClock.autoAdvance = false
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        Pad.used()
        val st = state()
        val played = mutableListOf<Int>()
        val menu = MatchMenu(null, {}, {})
        var view: android.view.View? = null
        var fm: androidx.compose.ui.focus.FocusManager? = null
        rule.setContent {
            var s by remember { mutableStateOf<Int?>(null) }
            view = androidx.compose.ui.platform.LocalView.current
            fm = androidx.compose.ui.platform.LocalFocusManager.current
            CompositionLocalProvider(LocalAnchors provides remember { Anchors() }) {
                Box(Modifier.fillMaxSize().padRoot()) {
                    ForgeBoard(st, live = true, intents = TableIntents(card = { played += it }), selectedHand = s, onSelectHand = { s = it }, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}, menu = menu)
                }
            }
        }
        step()
        // The ring start alone (no test help) puts the ring on the chip.
        assert(PadPrompts.current().a != "Select" && PadPrompts.current().a != "Menu") { "ring start missed the chip: ${PadPrompts.current().a}" }
        // The ring is lost, and Android hands focus back with a Down search from the top (View.clearFocus / leaving touch mode).
        rule.runOnUiThread { fm!!.clearFocus(force = true); view!!.requestFocus(android.view.View.FOCUS_DOWN) }
        step()
        println("PADCAST after refocus a=${PadPrompts.current().a} anyFocus=${PadPrompts.anyFocus}")
        assert(PadPrompts.current().a != "Menu") { "the ring went to the menu button" }
        center(); center()
        assertEquals(false, menu.open)
        assertEquals(1, played.size)
    }
}
