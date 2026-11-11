package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mobile table M2 (specs/mobile-table-arena-parity-brief.md): Randall gave the CPU's creature his +1/+1 counter because nothing
 * said whose each offered creature was. While a target question offers permanents on both sides, each says whose it is (its owner's seat name);
 * whose it is comes from the card's controller in the table state.
 */
class SideTagsTest {
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
    private val mine = base.me.battlefield.map { it.id }.toSet()
    private val theirs = base.cpu.battlefield.map { it.id }.toSet()

    @Test fun bothSidesOfferedEachSaysWhoseItIs() {
        val offered = base.selection.targetCards
        assertTrue("the question offers both sides", offered.any { it in mine } && offered.any { it in theirs })
        val tags = Glow.sideTags(base, live = true)
        assertEquals(offered + base.selection.chosenCards, tags.keys)
        for ((id, yours) in tags) assertEquals("card $id", id in mine, yours)
    }

    @Test fun oneSideOnlyOrNoQuestionNoTag() {
        fun only(ids: Set<Int>) = base.copy(selection = base.selection.copy(targetCards = base.selection.targetCards.filter { it in ids }.toSet(), chosenCards = emptySet()))
        assertEquals(emptyMap<Int, Boolean>(), Glow.sideTags(only(theirs), live = true))
        assertEquals(emptyMap<Int, Boolean>(), Glow.sideTags(only(mine), live = true))
        // Not your question to answer now, or not a target question: nothing is tagged.
        assertEquals(emptyMap<Int, Boolean>(), Glow.sideTags(base, live = false))
        assertEquals(emptyMap<Int, Boolean>(), Glow.sideTags(base.copy(inputType = "InputPassPriority"), live = true))
    }
}
