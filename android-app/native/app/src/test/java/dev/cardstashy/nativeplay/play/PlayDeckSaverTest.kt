package dev.cardstashy.nativeplay.play

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PlayDeckSaverTest {
    private val deck = JsonParser.parseString("""{"id":"play-import-1","name":"Pasted burn","format":"Standard","commander":"","cards":[{"name":"Shock","qty":4}],"side":[]}""").asJsonObject

    @Test fun prepareGivesFreshUnlockedCopy() {
        val c = PlayDeckSaver.prepare(deck, "new-id")
        assertEquals("new-id", c["id"].asString); assertEquals(false, c["locked"].asBoolean); assertEquals(0, c.getAsJsonArray("versions").size())
        assertEquals("play-import-1", deck["id"].asString)
    }

    @Test(expected = IllegalStateException::class) fun refusesBadRows() {
        PlayDeckSaver.prepare(JsonParser.parseString("""{"name":"x","format":"Standard","cards":[{"name":"Shock","qty":0}]}""").asJsonObject, "i")
    }

    @Test(expected = IllegalStateException::class) fun refusesUnknownFormat() {
        PlayDeckSaver.prepare(deck.deepCopy().apply { addProperty("format", "Oathbreaker") }, "i")
    }

    @Test fun keyIgnoresIdButNotCards() {
        assertEquals(PlayDeckSaver.key(deck), PlayDeckSaver.key(deck.deepCopy().apply { addProperty("id", "other") }))
        assertNotEquals(PlayDeckSaver.key(deck), PlayDeckSaver.key(deck.deepCopy().apply { getAsJsonArray("cards")[0].asJsonObject.addProperty("qty", 3) }))
    }
}
