package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Test

class EntranceTest {
    private fun cmdr(name: String, token: Boolean = false) =
        Card(id = 7, zone = "Battlefield", owner = 1, controller = 1, hidden = false, name = name, type = "Legendary Creature", manaCost = "{2}{G}", text = "",
            power = 3, toughness = 3, tapped = false, attacking = false, blocking = false, damage = 0, summoningSick = true, token = token,
            counters = emptyMap(), keywords = emptyList(), attachedTo = null, blockingIds = emptyList(), commander = true)

    @Test fun commanderFromCommandZoneIsLevelTwoOnceThenOne() {
        val fx = Battlefield()
        assertEquals(2, fx.entranceLevel(cmdr("Kazandu Mammoth"), fromZone = true, waiting = false))
        assertEquals(1, fx.entranceLevel(cmdr("Kazandu Mammoth"), fromZone = true, waiting = false))
    }

    @Test fun aWaitingPromptDropsItToTheSlam() {
        val fx = Battlefield()
        assertEquals(1, fx.entranceLevel(cmdr("Atraxa"), fromZone = true, waiting = true))
        // Its level 2 is still owed: the next calm entrance gets it.
        assertEquals(2, fx.entranceLevel(cmdr("Atraxa"), fromZone = true, waiting = false))
    }

    @Test fun tokensAndMinimalEffectsAreLevelZero() {
        val fx = Battlefield()
        assertEquals(0, fx.entranceLevel(cmdr("Copy", token = true), fromZone = true, waiting = false))
        fx.low = true
        assertEquals(0, fx.entranceLevel(cmdr("Atraxa"), fromZone = true, waiting = false))
    }
}
