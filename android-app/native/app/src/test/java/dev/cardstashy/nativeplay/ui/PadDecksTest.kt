package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The deck screens' LB/RB: step through the tabs drawn here, skip the ones that open the website, stop at either end. */
class PadDecksTest {
    private val tabs = listOf("cards", "rules", "engine", "versions", "playtest")

    @Test fun stepsToTheNextAndPrevious() {
        assertEquals("rules", padTab(tabs, "cards", 1) { true })
        assertEquals("engine", padTab(tabs, "versions", -1) { true })
    }

    @Test fun skipsTabsThatOpenElsewhere() {
        assertEquals("playtest", padTab(tabs, "engine", 1) { it != "versions" })
        assertEquals("engine", padTab(tabs, "playtest", -1) { it != "versions" })
    }

    @Test fun stopsAtTheEnds() {
        assertNull(padTab(tabs, "cards", -1) { true })
        assertNull(padTab(tabs, "playtest", 1) { true })
        assertNull(padTab(tabs, "engine", 1) { it == "cards" || it == "engine" })
    }

    @Test fun anUnknownTabStartsFromTheFirst() {
        assertEquals("rules", padTab(tabs, "gone", 1) { true })
    }
}
