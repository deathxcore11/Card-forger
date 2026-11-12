package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onAllNodesWithText
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.PromptOption
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Randall, 12 Nov, on the live build with Fountainport: "I like the first way to select abilities why is it making me do it twice?"
 * The open card's row is the choice. When Forge then asks "Choose an ability" for that card, the row's option is sent and the box
 * does not open. A press that names no single option of Forge's (or no press at all) leaves Forge's question as it was.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class AbilityPickTest {
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun clear() { AbilityPick.clear(); AbilityPick.answered = -1 }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-dock-choice.json")!!.readText())!!
    private val port = 34
    /** Forge's own labels for Fountainport, as his recording shows them. */
    private val labels = listOf("{T}: Add {C}.", "{2}, {T}, Sacrifice a token: Draw a card.", "{3}, {T}, Pay 1 life: Create a 1/1 blue Fish creature token.", "{4}, {T}: Create a Treasure token.")
    private fun ask(id: Int, method: String = "getAbilityToPlay", card: Int = port) = base.prompt!!.copy(id = id, method = method, message = "Choose an ability", min = 1, max = 1,
        options = labels.mapIndexed { i, l -> PromptOption(i, l, card, kind = "ability") })
    private val text = labels.joinToString("\n")
    private val rows = abilityRows(base.me.battlefield.first().copy(id = port, name = "Fountainport", type = "Land", text = text, hidden = false))

    @Test fun theRowIsTheOptionWithTheSameWords() {
        // The inspect view leaves the mana ability out, so its rows are Forge's options 1, 2 and 3.
        assertEquals(3, rows.size)
        assertEquals(listOf(1, 2, 3), rows.map { abilityOption(it, ask(1).options) })
        assertNull("words Forge does not offer", abilityOption(AbilityRow("{9}", "Win the game."), ask(1).options))
        assertNull("two options with the same words: Forge asks", abilityOption(rows[0], ask(1).options + PromptOption(4, labels[1], port)))
        // Forge's id after a card's name is not part of the words.
        assertEquals(0, abilityOption(AbilityRow("{T}", "Fountainport deals 1 damage."), listOf(PromptOption(0, "{T}: Fountainport (34) deals 1 damage.", port))))
    }

    @Test fun aPressAnswersForgesQuestionOnceAndOnlyForThatCard() {
        AbilityPick.want(port, rows[0], now = 1000)
        assertNull("not while the table is not live", AbilityPick.decide(ask(7), live = false, now = 1100))
        assertEquals(1, AbilityPick.decide(ask(7), live = true, now = 1200))
        assertEquals("the same question again: the same answer", 1, AbilityPick.decide(ask(7), live = true, now = 1300))
        assertNull("the next question is Forge's to ask", AbilityPick.decide(ask(8), live = true, now = 1400))
        AbilityPick.want(port, rows[0], now = 1000)
        assertNull("too late", AbilityPick.decide(ask(9), live = true, now = 1000 + AbilityPick.HOLD_MS + 1))
        AbilityPick.want(port, rows[0], now = 1000)
        assertNull("another card's abilities", AbilityPick.decide(ask(10, card = 99), live = true, now = 1100))
        AbilityPick.want(port, rows[0], now = 1000)
        assertNull("another kind of question uses the press up", AbilityPick.decide(ask(11, method = "getChoices"), live = true, now = 1100))
        assertNull(AbilityPick.decide(ask(12), live = true, now = 1200))
    }

    @Test fun theBoxStaysShutForAPickedRowAndOpensWithoutOne() {
        Motion.still = true
        val sent = ArrayList<Pair<Int, List<Int>?>>()
        var st by mutableStateOf(base.copy(prompt = null))
        rule.setContent { Box(Modifier.fillMaxSize()) { DecisionDock(st, live = true, intents = TableIntents(reply = { id, _, i, _ -> sent += id to i }), onInspect = {}, u = 1f) } }
        rule.waitForIdle()
        // He presses "Activate" on the second ability's row; Forge asks which ability.
        rule.runOnUiThread { AbilityPick.want(port, rows[0]); st = base.copy(revision = base.revision + 1, prompt = ask(21)) }
        rule.waitForIdle()
        assertEquals("the row's option is sent, once", listOf(21 to listOf(1)), sent)
        assertEquals("Forge's box is not shown", 0, rule.onAllNodesWithText("Draw a card", substring = true).fetchSemanticsNodes().size)
        // The same card by a plain tap (no row): Forge's question as before, nothing sent for him.
        rule.runOnUiThread { st = base.copy(revision = base.revision + 2, prompt = ask(22)) }
        rule.waitForIdle()
        assertEquals(1, sent.size)
        assertTrue("Forge's box is shown", rule.onAllNodesWithText("Draw a card", substring = true).fetchSemanticsNodes().isNotEmpty())
    }
}
