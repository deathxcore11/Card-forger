package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Polish brief 1: what the upright home's gold Play does for each mode, with and without a deck. Plain JVM. */
class StagePlayTest {
    private val log = mutableListOf<String>()
    private val act = PlayHomeActions(mode = { log += "mode:$it" }, story = { log += "story" }, play = { log += "play:$it" })
    private val deck = HomeDeck("d1", "Mono-White Auras", "Standard", 60, null)

    @Test fun quickPlaysTheShownDeck() { StageModes.play("quick", deck, act); assertEquals(listOf("play:d1"), log) }
    @Test fun quickWithNoDeckOpensQuickPlay() { StageModes.play("quick", null, act); assertEquals(listOf("mode:quick"), log) }
    @Test fun storyOpensStory() { StageModes.play("story", deck, act); assertEquals(listOf("story"), log) }
    @Test fun otherModesOpenTheirScreens() {
        for (m in listOf("practice", "social", "adventures")) StageModes.play(m, deck, act)
        assertEquals(listOf("mode:practice", "mode:social", "mode:adventures"), log)
    }
    @Test fun shouldersStepAndStopAtTheEnds() {
        assertEquals("practice", StageModes.step("quick", 1)); assertEquals("quick", StageModes.step("quick", -1))
        assertEquals("adventures", StageModes.step("adventures", 1)); assertEquals("Friends", StageModes.name("social"))
    }
    @Test fun fiveModesQuickFirst() {
        assertEquals(listOf("quick", "practice", "social", "story", "adventures"), StageModes.ALL.map { it.first })
    }

    private fun row(id: String, need: Int, have: Int, claimed: Boolean = false, level: String = "easy") =
        dev.cardstashy.nativeplay.play.PlayMath.QuestRow(dev.cardstashy.nativeplay.play.PlayRules.Quest(id, id, id, need, level), have, have >= need, claimed, id)

    /** Hand brief 5: the card turns through the unclaimed dailies, then the unclaimed weeklies. */
    @Test fun questTurnOrder() {
        val q = dev.cardstashy.nativeplay.play.PlayMath.Quests("d", "w", listOf(row("a", 3, 3, claimed = true), row("b", 3, 3), row("c", 2, 0)),
            listOf(row("w0", 7, 7, claimed = true, level = "weekly"), row("w1", 7, 7, level = "weekly"), row("w2", 7, 3, level = "weekly")), false, false)
        val items = QuestTurn.items(q)
        assertEquals(listOf("b", "c", "w1", "w2"), items.map { it.row.quest.id })
        assertEquals(2, QuestTurn.first(items, true)); assertEquals(0, QuestTurn.first(items, false))
        assertEquals(listOf("w1", "w2"), QuestTurn.items(q, only = true).map { it.row.quest.id })
    }

    @Test fun liveLines() {
        assertEquals("Matched CPU", StageModes.line("quick", 0, 8, false))
        assertEquals("Battle 3 of 8", StageModes.line("story", 2, 8, false))
        assertEquals("All 8 battles won", StageModes.line("story", 8, 8, true))
    }
}
