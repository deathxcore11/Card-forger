package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Polish brief 3, second part: which Collection selects show as chips on the phone's bar. Plain JVM. */
class CollBarTest {
    private fun sel(name: String, on: Int, vararg labels: String) = CollSelect(name, name, labels.mapIndexed { i, l -> CollOption(l.lowercase(), l, i == on) })

    @Test fun filtersAwayFromTheirFirstOptionAreChips() {
        val picks = listOf(sel("sort", 2, "Added", "Name", "Value"), sel("direction", 1, "Desc", "Asc"), sel("filter", 0, "All", "Foils"), sel("set", 1, "All sets", "MH3"))
        assertEquals(listOf("set"), CollBar.applied(picks).map { it.name })
    }

    @Test fun aFilterOnIsAChipAndOneOptionSelectsNever() {
        val picks = listOf(sel("filter", 1, "All", "Foils"), sel("owned", 0, "Owned"))
        assertEquals(listOf("Foils"), CollBar.applied(picks).map { it.current!!.label })
    }
}
