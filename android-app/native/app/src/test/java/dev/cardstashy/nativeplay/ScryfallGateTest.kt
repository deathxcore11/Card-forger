package dev.cardstashy.nativeplay

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.art.CardArt
import dev.cardstashy.nativeplay.art.ScryfallGate
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.nio.file.Files
import java.util.Collections
import java.util.concurrent.atomic.AtomicLong

/**
 * Randall 11 Nov: "Always always any time missing art when doing a new deck": Tranquil Thicket, Beast Whisperer, Yeva, Arasta and
 * Monstrous Onslaught sat on plain green frames in the hand and the zoom. A new deck is the only time the art lookup calls Scryfall,
 * and it sent its collection calls faster than Scryfall's two a second, gave up on a busy answer after one more try, and let one
 * odd row's identifier sink a whole 75-card call. Calls are now paced like the site's client and a busy answer waits and asks again.
 */
class ScryfallGateTest {
    private val clock = AtomicLong(1_000_000)
    private val starts = Collections.synchronizedList(mutableListOf<Long>())

    @Before fun setUp() { ScryfallGate.now = { clock.get() }; ScryfallGate.pause = { clock.addAndGet(it) } }
    @After fun tearDown() { ScryfallGate.reset(); CardArt.seedForTest(emptyList(), emptyMap()) }

    private fun card(name: String) = JsonObject().apply {
        addProperty("name", name); addProperty("id", java.util.UUID.nameUUIDFromBytes(name.toByteArray()).toString())
        add("image_uris", JsonObject().apply { addProperty("normal", "https://img/$name.jpg"); addProperty("art_crop", "https://crop/$name.jpg") })
    }
    /** Scryfall by name: every identifier with a name gets its card. */
    private fun answer(body: String): ScryfallGate.Reply {
        val ids = JsonParser.parseString(body).asJsonObject.getAsJsonArray("identifiers").map { it.asJsonObject }
        if (ids.any { !ScryfallGate.valid(it) }) return ScryfallGate.Reply(400, null)
        return ScryfallGate.Reply(200, JsonObject().apply { add("data", JsonArray().apply { ids.mapNotNull { it.get("name")?.asString }.forEach { add(card(it)) } }) })
    }

    @Test fun collectionCallsStartAtScryfallsPace() = runBlocking {
        // The real clock here: four calls fired together take about 1.5 s.
        ScryfallGate.reset()
        ScryfallGate.send = { b, _ -> starts += System.nanoTime() / 1_000_000; answer(b) }
        val body = """{"identifiers":[{"name":"Forest"}]}"""
        (0 until 4).map { async { ScryfallGate.collection(body) } }.awaitAll().forEach { assertNotNull(it) }
        assertEquals(4, starts.size)
        starts.sorted().zipWithNext().forEach { (a, b) -> assertTrue("calls ${b - a} ms apart", b - a >= ScryfallGate.GAP_MS - 5) }
    }

    @Test fun aBusyAnswerWaitsForRetryAfterAndAsksAgain() = runBlocking {
        var n = 0
        ScryfallGate.send = { b, _ -> starts += clock.get(); if (n++ < 2) ScryfallGate.Reply(429, null, 2000) else answer(b) }
        val data = ScryfallGate.collection("""{"identifiers":[{"name":"Beast Whisperer"}]}""")
        assertEquals("Beast Whisperer", data!![0].asJsonObject.get("name").asString)
        assertEquals(3, starts.size)
        starts.zipWithNext().forEach { (a, b) -> assertTrue("asked again ${b - a} ms later", b - a >= 2000) }
    }

    @Test fun aRefusedCallIsNotAskedAgain() = runBlocking {
        ScryfallGate.send = { _, _ -> starts += clock.get(); ScryfallGate.Reply(400, null) }
        assertNull(ScryfallGate.collection("""{"identifiers":[{"name":""}]}"""))
        assertEquals(1, starts.size)
    }

    @Test fun aNewDecksHandGetsItsArtThroughABusyScryfall() = runBlocking {
        CardArt.initIndexOnly(Files.createTempDirectory("art").toFile())
        CardArt.seedForTest(emptyList(), emptyMap())
        val hand = listOf("Tranquil Thicket", "Beast Whisperer", "Yeva, Nature's Herald", "Arasta of the Endless Web", "Monstrous Onslaught")
        // A 100-card deck (two calls), one row carrying a set code Scryfall refuses ("ab": it would sink its whole call).
        val rows = (hand + (1..95).map { "Card $it" }).map { it to JsonObject().apply { addProperty("name", it) } } +
            listOf("Odd Row" to JsonObject().apply { addProperty("name", "Odd Row"); addProperty("set", "ab"); addProperty("collectorNumber", "1") })
        // Scryfall busy for the first three calls, the way a burst right after building a deck meets it.
        var n = 0
        ScryfallGate.send = { b, _ -> synchronized(this) { n++ }.let { if (it <= 3) ScryfallGate.Reply(429, null, 1000) else answer(b) } }
        CardArt.resolveMatch(rows)
        val missing = rows.map { it.first }.filter { CardArt.url(it) == null }
        assertEquals("no picture for $missing", emptyList<String>(), missing)
        assertEquals("https://img/Beast Whisperer.jpg", CardArt.url("Beast Whisperer"))
        // The odd row asked by its name, not its refused set code.
        assertEquals("Odd Row", CardArt.identifier(rows.last().second, "Odd Row").get("name")?.asString)
    }

    @Test fun identifiersScryfallRefusesAreSpotted() {
        fun id(vararg kv: Pair<String, String>) = JsonObject().apply { kv.forEach { (k, v) -> addProperty(k, v) } }
        assertTrue(ScryfallGate.valid(id("name" to "Forest")))
        assertTrue(!ScryfallGate.valid(id("name" to " ")))
        assertTrue(ScryfallGate.valid(id("set" to "dsc", "collector_number" to "12")))
        assertTrue(!ScryfallGate.valid(id("set" to "ab", "collector_number" to "12")))
        assertTrue(!ScryfallGate.valid(id("set" to "dsc", "collector_number" to "")))
        assertTrue(!ScryfallGate.valid(id("set" to "dsc")))
    }
}
