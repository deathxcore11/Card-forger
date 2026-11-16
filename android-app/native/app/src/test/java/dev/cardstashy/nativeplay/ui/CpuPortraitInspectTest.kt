package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** BB12: a tap on the CPU's portrait opens the CPU's commander, named as the CPU's ("CPU · In the command zone"), never "Forge AI". */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class CpuPortraitInspectTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    /** How many "CPU" words the table itself shows (0.4.60 Z4: the CPU's corner square carries its name). */
    private var cpuWordsBefore = 0

    private fun tapPortrait(st: MatchState, seat: Int): Card? {
        Motion.still = true
        val anchors = Anchors()
        var opened by mutableStateOf<Card?>(null)
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize()) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = { opened = it }, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    opened?.let { CardInspect(it, st.viewer) { opened = null } }
                }
            }
        }
        rule.waitForIdle()
        cpuWordsBefore = rule.onAllNodesWithText("CPU").fetchSemanticsNodes().size
        val orb = anchors.rects["orb$seat"] ?: error("no portrait for seat $seat")
        rule.onRoot().performTouchInput { click(orb.center) }
        rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        return opened
    }

    @Test fun cpuPortraitOpensTheCpuCommander() {
        val main = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        // Not a target now: a tap is an inspect, not a pick.
        val st = main.copy(selection = main.selection.copy(players = emptySet()))
        val card = tapPortrait(st, st.cpu.id)
        assertNotNull("the CPU portrait opened nothing", card)
        assertEquals(st.cpu.command.first().name, card!!.name)
        assertEquals(st.cpu.id, card.controller)
        // The opened view names it the CPU's: one more "CPU" than the table showed before the tap (the Z4 square has its own).
        assertEquals(cpuWordsBefore + 1, rule.onAllNodesWithText("CPU").fetchSemanticsNodes().size)
        rule.onNodeWithText("IN THE COMMAND ZONE").assertExists()
        assertEquals(0, rule.onAllNodesWithText("Forge AI", substring = true, ignoreCase = true).fetchSemanticsNodes().size)
    }

    @Test fun aCpuPortraitThatIsATargetIsPickedNotOpened() {
        val main = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val st = main.copy(selection = main.selection.copy(players = setOf(main.cpu.id)))
        assertEquals(null, tapPortrait(st, st.cpu.id))
    }
}
