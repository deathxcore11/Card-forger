package dev.cardstashy.nativeplay.play

import org.junit.Assert.*
import org.junit.Test

/** Golden cases from story-client.js. */
class StoryLogicTest {
    private val p = StoryLogic.fromRefs(listOf("story:a1b1:loaner", "story:a1b2:own", "story:a1b2:villain", "story:a1b3:clear", "story:act2:era"))
    @Test fun stars() { assertEquals(3, StoryLogic.stars(p, "a1b1")); assertEquals(2, StoryLogic.stars(p, "a1b2")); assertEquals(0, StoryLogic.stars(p, "a1b3")); assertEquals(5, StoryLogic.stars(StoryLogic.fromRefs(listOf("story:a1b1:loaner", "story:a1b1:own", "story:a1b1:villain")), "a1b1")) }
    @Test fun cleared() { assertTrue(StoryLogic.battleCleared(p, "a1b3")); assertFalse(StoryLogic.battleCleared(p, "a1b4")); assertTrue(StoryLogic.actCleared(p, 2)); assertFalse(StoryLogic.actCleared(p, 1)) }
    @Test fun current() { assertEquals(4, StoryLogic.currentBattle(p, 1)); assertEquals(1, StoryLogic.currentAct(p, 10)); assertEquals(3, StoryLogic.currentAct(StoryLogic.fromRefs(listOf("story:act1:era", "story:act2:era")), 10)) }
    @Test fun secret() { val all = StoryLogic.fromRefs((1..8).map { "story:a1b$it:loaner" }); assertTrue(StoryLogic.secretOpen(all, 1)); assertFalse(StoryLogic.secretOpen(p, 1)); assertEquals(24, StoryLogic.actStars(all, 1)) }
    @Test fun fits() {
        val pool = setOf("lightning bolt", "sol ring")
        assertEquals("Checking the card pool…", StoryLogic.ownDeckFits(emptyList(), null).reason)
        assertEquals("40 cards. Story decks need 60.", StoryLogic.ownDeckFits(listOf("Mountain" to 40), pool).reason)
        assertEquals("More than 4 copies of a card.", StoryLogic.ownDeckFits(listOf("Mountain" to 50, "Lightning Bolt" to 5, "Sol Ring" to 5), pool).reason)
        assertEquals("1 card is from outside this act, like Black Lotus.", StoryLogic.ownDeckFits(listOf("Mountain" to 56, "Black Lotus" to 4), pool).reason)
        assertTrue(StoryLogic.ownDeckFits(listOf("Mountain" to 52, "Lightning Bolt" to 4, "Sol Ring" to 4), pool).ok)
    }
}
