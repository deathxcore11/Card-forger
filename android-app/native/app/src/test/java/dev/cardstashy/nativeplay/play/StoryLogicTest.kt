package dev.cardstashy.nativeplay.play

import org.junit.Assert.*
import org.junit.Test

/** Golden cases from story-client.js. */
class StoryLogicTest {
    private val p = StoryLogic.fromRefs(listOf("story:a1b1:loaner", "story:a1b2:own", "story:a1b2:villain", "story:a1b3:clear", "story:act2:era"))
    @Test fun stars() { assertEquals(3, StoryLogic.stars(p, "a1b1")); assertEquals(2, StoryLogic.stars(p, "a1b2")); assertEquals(0, StoryLogic.stars(p, "a1b3")); assertEquals(5, StoryLogic.stars(StoryLogic.fromRefs(listOf("story:a1b1:loaner", "story:a1b1:own", "story:a1b1:villain")), "a1b1")) }
    @Test fun cleared() { assertTrue(StoryLogic.battleCleared(p, "a1b3")); assertFalse(StoryLogic.battleCleared(p, "a1b4")); assertTrue(StoryLogic.actCleared(p, 2)); assertFalse(StoryLogic.actCleared(p, 1)) }
    @Test fun current() { assertEquals(4, StoryLogic.currentBattle(p, 1)); assertEquals(1, StoryLogic.currentAct(p, 10)); assertEquals(3, StoryLogic.currentAct(StoryLogic.fromRefs(listOf("story:act1:era", "story:act2:era")), 10)) }
    @Test fun secret() {
        val all = StoryLogic.fromRefs((1..8).map { "story:a1b$it:loaner" })
        val keys = StoryLogic.keyFeats(1).associate { "sd:$it" to 1.0 }
        // story-client.js secretOpen: 8 Story-deck wins and the act's 3 key feats, or the secret already cleared.
        assertTrue(StoryLogic.secretOpen(all, 1, keys)); assertFalse(StoryLogic.secretOpen(all, 1, emptyMap())); assertFalse(StoryLogic.secretOpen(p, 1, keys))
        assertTrue(StoryLogic.secretOpen(StoryLogic.fromRefs(listOf("story:a1b9:clear")), 1, emptyMap()))
        assertEquals(24, StoryLogic.actStars(all, 1))
        val st = StoryLogic.secretStatus(all, 1, mapOf("sd:a1-colossus" to 1.0)); assertEquals(8, st.won); assertEquals(1, st.keys); assertEquals(3, st.keysNeeded)
        assertEquals("A secret battle waits in this act. Win all 8 battles with the Story decks (8 of 8) and earn its 3 key feats (1 of 3). Key feats are marked in Achievements.",
            StoryLogic.secretTease(true, all, 1, mapOf("sd:a1-colossus" to 1.0)))
        assertEquals(null, StoryLogic.secretTease(true, StoryLogic.fromRefs(listOf("story:a1b1:loaner")), 1, emptyMap()))
    }
    @Test fun fits() {
        val pool = setOf("lightning bolt", "sol ring")
        assertEquals("Checking the card pool…", StoryLogic.ownDeckFits(emptyList(), null).reason)
        assertEquals("40 cards. Story decks need 60.", StoryLogic.ownDeckFits(listOf("Mountain" to 40), pool).reason)
        assertEquals("More than 4 copies of a card.", StoryLogic.ownDeckFits(listOf("Mountain" to 50, "Lightning Bolt" to 5, "Sol Ring" to 5), pool).reason)
        assertEquals("1 card is from outside this act, like Black Lotus.", StoryLogic.ownDeckFits(listOf("Mountain" to 56, "Black Lotus" to 4), pool).reason)
        assertTrue(StoryLogic.ownDeckFits(listOf("Mountain" to 52, "Lightning Bolt" to 4, "Sol Ring" to 4), pool).ok)
    }
}
