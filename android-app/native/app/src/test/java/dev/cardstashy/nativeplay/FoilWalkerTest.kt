package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.CardData
import dev.cardstashy.nativeplay.ui.Foil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Which foil cards get a planeswalker's 3D window (take 5, DepthLayer.kt): a planeswalker in the modern frame, judged on the face the
 * card shows. Real Scryfall records: Jace, the Mind Sculptor (2XM 56), the card Randall judged the 3D on, and Ajani, Nacatl Pariah
 * (MH3 237), a transform card whose front is a creature and whose top-level type line also says Planeswalker (review, 14 Nov).
 */
class FoilWalkerTest {
    private fun json(name: String): JsonObject = JsonParser.parseString(javaClass.getResource(name)!!.readText()).asJsonObject
    private val data = CardData(json("/card-data.json"))

    @Test fun aModernPlaneswalkerGetsTheWindow() {
        val jace = json("/foil/jace-the-mind-sculptor-2xm-56.json")
        assertTrue(Foil.look(data, jace, "foil").walker)
    }

    @Test fun aTransformCardWithACreatureFrontDoesNot() {
        val ajani = json("/foil/ajani-nacatl-pariah-mh3-237.json")
        assertTrue("the joined type line names the back face", "Planeswalker" in ajani.get("type_line").asString)
        val look = Foil.look(data, ajani, "foil")
        assertFalse(look.walker)
        // The picture is the front face's, the creature.
        assertEquals(ajani.getAsJsonArray("card_faces")[0].asJsonObject.getAsJsonObject("image_uris").get("normal").asString, look.image)
    }

    /** Flipped to the back (the card view's flip passes the picture on screen), the planeswalker face gets the window, measured on
     *  that face's picture. */
    @Test fun theFlippedBackFaceIsThePlaneswalker() {
        val ajani = json("/foil/ajani-nacatl-pariah-mh3-237.json")
        val back = ajani.getAsJsonArray("card_faces")[1].asJsonObject.getAsJsonObject("image_uris").get("normal").asString
        val look = Foil.look(data, ajani, "foil", back)
        assertTrue(look.walker)
        assertEquals(back, look.image)
        assertFalse("an unknown picture means the front", Foil.look(data, ajani, "foil", "https://example.invalid/x.jpg").walker)
    }
}
