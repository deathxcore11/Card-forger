package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.engine.Card
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 0.4.59 T2 (fans you can read, faults 18 and 19): a pile shows what is in it, and tapped cards are a pile of their own. */
class FanTest {
    private var next = 1
    private fun c(name: String, type: String, tapped: Boolean = false) =
        Card(id = next++, zone = "Battlefield", owner = 1, controller = 1, hidden = false, name = name, type = type, manaCost = "", text = "",
            power = if (type.contains("Creature")) 1 else null, toughness = if (type.contains("Creature")) 1 else null, tapped = tapped, attacking = false, blocking = false,
            damage = 0, summoningSick = false, token = false, counters = emptyMap(), keywords = emptyList(), attachedTo = null, blockingIds = emptyList())

    @Test fun sevenElvesThreeTappedMakeAFourAndATappedThree() {
        val cs = List(4) { c("Llanowar Elves", "Creature — Elf Druid") } + List(3) { c("Llanowar Elves", "Creature — Elf Druid", tapped = true) }
        val piles = pilesOf(cs, 0, { Mark.NONE }, { null })
        assertEquals(listOf(4, 3), piles.map { it.size })
        assertTrue(piles[1].all { it.tapped }); assertTrue(piles[0].none { it.tapped })
    }

    @Test fun fiveLandsThreeTappedMakeATwoAndATappedThree() {
        val cs = List(2) { c("Forest", "Basic Land — Forest") } + List(3) { c("Forest", "Basic Land — Forest", tapped = true) }
        val piles = pilesOf(cs, cs.size, { Mark.NONE }, { null })
        assertEquals(listOf(2, 3), piles.map { it.size })
        assertTrue(piles[1].all { it.tapped })
    }

    @Test fun withRoomAPileFansWideAndWhenTightItClosesUpButNeverBelowFifteenPercent() {
        val h = 60f
        // Two piles on a wide board: creatures fan to 66 % of a tile, back rows to 30 %.
        assertEquals(TableGeometry.FAN_MAX, TableGeometry.fanStep(h, 2000f, listOf(4, 3), back = false), .001f)
        assertEquals(TableGeometry.FAN_MAX_BACK, TableGeometry.fanStep(h, 2000f, listOf(2, 3), back = true), .001f)
        // Tight: the step is what fits, never under 15 %.
        val room = TableGeometry.rowWidth(h, listOf(4, 3), step = .3f)
        assertEquals(.3f, TableGeometry.fanStep(h, room, listOf(4, 3), back = false), .001f)
        assertEquals(TableGeometry.FAN_MIN, TableGeometry.fanStep(h, 10f, listOf(4, 3), back = false), .001f)
        // Lone cards have nothing to fan.
        assertEquals(TableGeometry.FAN_MAX, TableGeometry.fanStep(h, 10f, listOf(1, 1), back = false), .001f)
    }

    @Test fun theFanStillFitsTheRowTheTileSizeWasWorkedOutFor() {
        // The tile height is set at the sizing step (18 %), so the fan never needs less room than that.
        val rows = TableGeometry.rows(false, 80f, 310f)
        val piles = listOf(4, 3, 1, 1, 2)
        val t = TableGeometry.tiles(rows, 600f, 560f, piles, piles, listOf(1), listOf(1))
        val step = TableGeometry.fanStep(t.front, 600f, piles, back = false)
        assertTrue(step >= TableGeometry.STEP - .001f)
        assertTrue(TableGeometry.rowWidth(t.front, piles, step = step) <= 600.5f)
    }
}
