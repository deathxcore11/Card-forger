package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** Randall, 19 Nov (recording 3:41 PM): three of the first five Quick Play tiles were grey "Missing cards". Playable decks come first. */
class QuickPlayableFirstTest {
    @Test fun playableFirstGreyAfterOrderKept() {
        val decks = listOf("Foot Ninjas" to true, "Keep Out" to true, "Blue-Black" to false, "Get Lost" to false, "Youthful Valkyrie" to true, "Forged" to false)
        assertEquals(listOf("Blue-Black", "Get Lost", "Forged", "Foot Ninjas", "Keep Out", "Youthful Valkyrie"),
            quickPlayableFirst(decks) { it.second }.map { it.first })
    }
}
