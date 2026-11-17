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
        for (m in listOf("practice", "social", "planeswalk")) StageModes.play(m, deck, act)
        assertEquals(listOf("mode:practice", "mode:social", "mode:planeswalk"), log)
    }
    @Test fun shouldersStepAndStopAtTheEnds() {
        assertEquals("practice", StageModes.step("quick", 1)); assertEquals("quick", StageModes.step("quick", -1))
        assertEquals("planeswalk", StageModes.step("planeswalk", 1)); assertEquals("Friends", StageModes.name("social"))
    }
    @Test fun fiveModesQuickFirst() {
        assertEquals(listOf("quick", "practice", "social", "story", "planeswalk"), StageModes.ALL.map { it.first })
    }
}
