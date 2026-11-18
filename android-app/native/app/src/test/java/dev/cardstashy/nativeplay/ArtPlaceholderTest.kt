package dev.cardstashy.nativeplay

import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.art.CardArt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Fault 16 (0.4.57 Thor run): a Spider token drew as a dark grey silhouette, Scryfall's placeholder picture. */
class ArtPlaceholderTest {
    private fun card(status: String) = JsonParser.parseString(
        """{"name":"Spider","image_status":"$status","image_uris":{"normal":"https://x/n.jpg","art_crop":"https://x/a.jpg"}}""").asJsonObject

    @Test fun placeholderIsNotArt() = assertNull(CardArt.images(card("placeholder")))
    @Test fun realPictureStillCounts() = assertEquals("https://x/n.jpg" to "https://x/a.jpg", CardArt.images(card("highres_scan")))
    @Test fun noStatusStillCounts() = assertEquals("https://x/n.jpg" to "https://x/a.jpg", CardArt.images(JsonParser.parseString("""{"image_uris":{"normal":"https://x/n.jpg","art_crop":"https://x/a.jpg"}}""").asJsonObject))
}
