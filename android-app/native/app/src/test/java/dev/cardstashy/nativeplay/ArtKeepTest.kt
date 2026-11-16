package dev.cardstashy.nativeplay

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.art.ArtKeep
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

/**
 * Randall 13 Nov, "Put this saved pop in on art": the pictures the player's decks, collection and wishlist draw (every game, the site's
 * own choice of picture) are listed by the engine, saved once on the phone, and drawn from there after that.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ArtKeepTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js")
    private fun png(): ByteArray = java.io.ByteArrayOutputStream().also { s ->
        android.graphics.Bitmap.createBitmap(4, 6, android.graphics.Bitmap.Config.ARGB_8888).compress(android.graphics.Bitmap.CompressFormat.PNG, 100, s)
    }.toByteArray()

    @Test fun savedOnceThenFromThePhone() { runBlocking {
        val dir = kotlin.io.path.createTempDirectory("keep").toFile()
        ArtKeep.initDir(dir)
        val urls = listOf("https://images.ygoprodeck.com/images/cards_small/89631139.jpg", "https://images.pokemontcg.io/sv1/1_hires.png", "https://cardstashy.com/img/ptcg/s/x-1.jpg?v=2")
        var asked = 0
        // A picture the site answers wrongly (not a picture) is not kept, and is asked for again next time.
        ArtKeep.fetch = { u -> asked++; if (u == urls[1]) "<html>busy</html>".toByteArray() else png() }
        assertEquals(1, ArtKeep.save(urls)); assertEquals(3, asked)
        assertTrue(ArtKeep.local(urls[0])!!.readBytes().contentEquals(png()))
        assertNull(ArtKeep.local(urls[1]))
        assertEquals(2 to 3, ArtKeep.progress.value)
        asked = 0
        ArtKeep.fetch = { asked++; png() }
        assertEquals(0, ArtKeep.save(urls)); assertEquals(1, asked)
        // Offline, the next visit asks for nothing.
        asked = 0; ArtKeep.fetch = { asked++; null }
        assertEquals(0, ArtKeep.save(urls)); assertEquals(0, asked)
        assertNull(ArtKeep.file("img/ptcg/s/x-1.jpg"))
        ArtKeep.fetch = null; ArtKeep.clear(); assertNull(ArtKeep.local(urls[0])); dir.deleteRecursively()
    } }

    @Test fun engineListsEveryGamesPictures() { runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val bolt = "https://cards.scryfall.io/normal/front/7/7/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg?1706239968"
        val ws = JsonObject().apply {
            addProperty("version", 3)
            add("collection", JsonArray().apply { add(JsonObject().apply { addProperty("id", "l1"); addProperty("name", "Lightning Bolt"); addProperty("qty", 2); addProperty("finish", "nonfoil"); addProperty("condition", "Near Mint"); addProperty("language", "en") }) })
            // A deck row draws its card's picture (store.js meta); a collection copy with no printing set draws none, as on the site.
            add("decks", JsonArray().apply { add(JsonObject().apply { addProperty("id", "d1"); addProperty("name", "Burn"); addProperty("format", "Modern")
                add("cards", JsonArray().apply { add(JsonObject().apply { addProperty("name", "Lightning Bolt"); addProperty("qty", 4) }) }) }) })
            add("wishlist", JsonArray()); add("notes", JsonArray())
            add("tcg", JsonObject().apply { add("ygo", JsonObject().apply {
                add("collection", JsonArray().apply { add(JsonObject().apply { addProperty("id", "y1"); addProperty("cardId", "89631139"); addProperty("name", "Blue-Eyes White Dragon"); addProperty("qty", 1) }) })
            }) })
        }
        val catalog = JsonObject().apply { add("lightning bolt", JsonObject().apply { addProperty("name", "Lightning Bolt"); add("image_uris", JsonObject().apply { addProperty("normal", bolt) }) }) }
        CollectionEngine.tcgCacheLoad(JsonObject().apply { add("ygo", JsonObject().apply { add("89631139", JsonObject().apply {
            addProperty("game", "ygo"); addProperty("id", "89631139"); addProperty("name", "Blue-Eyes White Dragon"); addProperty("image", "https://images.ygoprodeck.com/images/cards_small/89631139.jpg")
        }) }); add("ptcg", JsonObject()) }.toString())
        CollectionEngine.load(ws.toString(), catalog.toString())
        val list = CollectionEngine.artKeep()
        println("ART $list")
        assertEquals(list.toString(), 1, list.count { it == bolt })
        assertTrue(list.toString(), "https://images.ygoprodeck.com/images/cards_small/89631139.jpg" in list)
    } }
}
