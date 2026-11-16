package dev.cardstashy.nativeplay.match

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 0.4.59 T10: which board cards wear the light foil (from your deck's own rows, never guessed) and its timing. */
class BoardFoilTest {
    @After fun off() = BoardFoil.clear()
    private fun row(json: String): Pair<String, JsonObject> = JsonParser.parseString(json).asJsonObject.let { it.get("name").asString to it }

    @Test fun theFinishComesFromTheRowsOnly() {
        val names = BoardFoil.names(listOf(
            row("""{"name":"Hill Giant","qty":2,"finish":"foil"}"""),
            row("""{"name":"Sol Ring","qty":1,"finish":"etched"}"""),
            row("""{"name":"Shock","qty":4,"foil":true}"""),
            row("""{"name":"Murder","qty":4}"""),                                  // says nothing: not foil
            row("""{"name":"Grizzly Bears","qty":2,"finish":"foil"}"""),
            row("""{"name":"Grizzly Bears","qty":2,"finish":"nonfoil"}"""),       // copies differ: Forge can't tell them apart
            row("""{"name":"Unsummon","qty":4,"foil":false}""")))
        assertEquals(setOf("hill giant", "sol ring", "shock"), names)
    }

    @Test fun onlyYourOwnCardsWearIt() {
        BoardFoil.arm(listOf(row("""{"name":"Hill Giant","qty":2,"finish":"foil"}""")))
        assertTrue(BoardFoil.wears("Hill Giant", ownerIsYou = true))
        assertFalse("the CPU's Hill Giant", BoardFoil.wears("Hill Giant", ownerIsYou = false))
        assertFalse(BoardFoil.wears("Grizzly Bears", ownerIsYou = true))
    }

    @Test fun theTiming() {
        // The sheen drifts 0 to 1 over 9 s and back.
        assertEquals(0f, BoardFoil.sheen(0), 1e-4f); assertEquals(.5f, BoardFoil.sheen(4_500), 1e-4f)
        assertEquals(1f, BoardFoil.sheen(9_000), 1e-4f); assertEquals(.5f, BoardFoil.sheen(13_500), 1e-4f); assertEquals(0f, BoardFoil.sheen(18_000), 1e-4f)
        // The band crosses in 2.2 s once every 8 s: 2.2 s of every 8 s on each tile, from the tile's own start.
        for (id in listOf(1, 107, 4242)) {
            val on = (0 until 8_000 step 10).count { BoardFoil.band(it.toLong(), id, null) != null }
            assertEquals("tile $id", 220, on)
        }
        // Tiles do not all flash together.
        assertTrue((100..140).map { BoardFoil.bandOffset(it) }.toSet().size > 30)
        // A landing or the ring plays it once more, from its start.
        val id = 107; val rest = (0L until 8_000L).first { BoardFoil.band(it, id, null) == null }
        assertEquals(0f, BoardFoil.band(rest, id, kick = rest)!!, 1e-4f)
        assertEquals(.5f, BoardFoil.band(rest + 1_100, id, kick = rest)!!, 1e-3f)
    }
}
