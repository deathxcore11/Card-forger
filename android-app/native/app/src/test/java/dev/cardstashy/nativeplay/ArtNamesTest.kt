package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.art.CardArt
import org.junit.Assert.assertEquals
import org.junit.Test

/** Randall 10 Nov on 0.4.56: Omenpaths flavor names and Forge's "X Token" names showed name plates (Scryfall knows neither). */
class ArtNamesTest {
    @Test fun aFlavorNameIsAskedByItsCardsName() {
        val row = JsonObject().apply { addProperty("name", "Wonderweave Aerialist"); addProperty("oracleName", "Skyward Spider") }
        assertEquals("Skyward Spider", CardArt.identifier(row, "Wonderweave Aerialist").get("name").asString)
    }

    @Test fun aTokenIsAskedWithoutForgesTokenSuffix() {
        assertEquals("Spider", CardArt.identifier(JsonObject(), "Spider Token").get("name").asString)
        assertEquals("Jace", CardArt.identifier(JsonObject(), "Jace Token").get("name").asString)
        assertEquals("Wear", CardArt.identifier(JsonObject(), "Wear // Tear").get("name").asString)
    }
}
