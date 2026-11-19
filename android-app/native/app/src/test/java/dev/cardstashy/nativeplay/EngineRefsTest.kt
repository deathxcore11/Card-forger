package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Regression, Randall's recordings of 19 Nov (0.4.99): trigger cards ended with Forge's own references. Veteran Survivor's read
 * "(Targeting: [[Stock Up (111)]])", Origin of Spider-Man's "(Targeting: [[Skyward Spider (…)]])", and a Ba Sing Se trigger
 * "…return it to the battlefield tapped. ([Forest (72)])".
 */
class EngineRefsTest {
    @Test fun aTargetReadsByName() {
        assertEquals("At the beginning of your second main phase, exile up to one target card from a graveyard. (Targeting: Stock Up)",
            MatchState.engineRefs("At the beginning of your second main phase, exile up to one target card from a graveyard. (Targeting: [[Stock Up (111)]])"))
        assertEquals("(Targeting: Skyward Spider, Veteran Survivor)", MatchState.engineRefs("(Targeting: [[Skyward Spider (64)]], [[Veteran Survivor (12)]])"))
    }

    @Test fun aNoteThatIsOnlyAReferenceGoes() {
        assertEquals("When it dies or is exiled, return it to the battlefield tapped.",
            MatchState.engineRefs("When it dies or is exiled, return it to the battlefield tapped. ([Forest (72)])"))
    }

    @Test fun plainWordsAndManaAreLeftAlone() {
        val t = "Add {G}. (This is [not] a reference.)"
        assertEquals(t, MatchState.engineRefs(t))
    }
}
