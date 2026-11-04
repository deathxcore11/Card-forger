package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.art.CardArt
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.nio.file.Files

/**
 * The real art path against Scryfall (needs network; skipped offline): a deck's rows resolve to
 * image URLs, and the app's image client downloads them. 0.2.0 failed here: Scryfall answers a
 * library's default User-Agent with 400, so every card face stayed empty.
 */
class ArtLiveTest {
    private fun online() = try { java.net.InetAddress.getByName("api.scryfall.com"); true } catch (_: Exception) { false }

    @Test fun deckArtResolvesAndDownloads() = runBlocking {
        assumeTrue("no network", online())
        CardArt.initIndexOnly(Files.createTempDirectory("art").toFile())
        val rows = listOf(
            "Lightning Bolt" to JsonObject().apply { addProperty("name", "Lightning Bolt"); addProperty("set", "M11"); addProperty("collectorNumber", "149") },
            "Karn, the Great Creator" to JsonObject().apply { addProperty("name", "Karn, the Great Creator") },
            "Devourer of Destiny" to JsonObject().apply { addProperty("name", "Devourer of Destiny") },
            "Wear // Tear" to JsonObject().apply { addProperty("name", "Wear // Tear") },
            "Delver of Secrets" to JsonObject().apply { addProperty("name", "Delver of Secrets") },
        )
        CardArt.resolve(rows)
        for ((name, _) in rows) {
            val face = CardArt.url(name); val crop = CardArt.url(name, crop = true)
            assertNotNull("no picture for $name", face)
            CardArt.client.newCall(Request.Builder().url(face!!).build()).execute().use { r ->
                assertEquals("face of $name", 200, r.code); assertTrue(r.header("Content-Type")!!.startsWith("image/")); assertTrue(r.body!!.bytes().size > 10_000)
            }
            CardArt.client.newCall(Request.Builder().url(crop!!).build()).execute().use { r -> assertEquals("crop of $name", 200, r.code) }
        }
        assertTrue(CardArt.url("Lightning Bolt")!!.contains("/front/"))
        // The cause of the blank cards in 0.2.0: the default client is refused.
        OkHttpClient().newCall(Request.Builder().url(CardArt.url("Lightning Bolt")!!).build()).execute().use { assertEquals(400, it.code) }
    }

    /** Story pins its era printings: a name seen before in modern art still plays Alpha in an Act 1 match, and only there. */
    @Test fun storyPinsBeatTheNameIndex() = runBlocking {
        assumeTrue("no network", online())
        CardArt.initIndexOnly(Files.createTempDirectory("art").toFile())
        CardArt.resolve(listOf("Plains" to JsonObject().apply { addProperty("name", "Plains") }))
        val shared = CardArt.url("Plains")!!
        val alpha = "b1623d57-4729-4796-b3f7-f1837a05c6ed"
        val story = listOf("Plains" to JsonObject().apply { addProperty("name", "Plains"); addProperty("qty", 24); addProperty("printingId", alpha) })
        assertTrue(!CardArt.knowsRows(story))
        CardArt.resolveMatch(story)
        assertTrue("pinned art: ${CardArt.url("Plains")}", CardArt.url("Plains")!!.contains(alpha))
        assertTrue(CardArt.knowsRows(story))
        CardArt.resolveMatch(listOf("Plains" to JsonObject().apply { addProperty("name", "Plains") }))
        assertEquals(shared, CardArt.url("Plains"))
    }
}
