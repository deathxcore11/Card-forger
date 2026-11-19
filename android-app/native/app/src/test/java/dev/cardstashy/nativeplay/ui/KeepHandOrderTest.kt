package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Test

/** Recording 19 Nov (item 8): the Keep screen and the table show the opening hand in the same order. Names and costs from the recording. */
class KeepHandOrderTest {
    private fun c(id: Int, name: String, type: String, cost: String) = Card(id, "Hand", 1, 1, false, name, type, cost, "",
        null, null, false, false, false, 0, false, false, emptyMap(), emptyList(), null, emptyList())

    @Test fun keepScreenHoldsTheTablesOrder() {
        // Forge's order, as the Keep screen drew it.
        val forge = listOf(c(1, "Meticulous Archive", "Land - Plains Island", ""), c(2, "Get Lost", "Instant", "{1}{W}{W}"),
            c(3, "Day of Judgment", "Sorcery", "{2}{W}{W}"), c(4, "Floodfarm Verge", "Land", ""), c(5, "No More Lies", "Instant", "{W}{U}"))
        val table = orderedHand(forge, emptyList()).map { it.name }
        assertEquals(listOf("Meticulous Archive", "Floodfarm Verge", "No More Lies", "Get Lost", "Day of Judgment"), table)
        assertEquals(table, keepHand(forge).map { it.name })
    }
}
