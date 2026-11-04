package dev.cardstashy.nativeplay.play

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Test

class CommunityDecksTest {
    @Test fun copiesMainAndSide() {
        val item = JsonParser.parseString("""{"kind":"deck","game":"mtg","key":"k","title":"Elves","format":"Standard","deckSchema":1,"commander":"",
            "appearance":{"color":"#112233"},"cards":[{"id":"a","name":"Llanowar Elves","qty":4,"zone":"main"},{"id":"b","name":"Naturalize","qty":2.7,"zone":"side"},{"id":"c","name":"Forest","qty":20}]}""").asJsonObject
        val d = CommunityDecks.sharedDeckCopy(item, "x")
        assertEquals("Elves", d["name"].asString); assertEquals("Standard", d["format"].asString); assertEquals("#112233", d.getAsJsonObject("boxAppearance")["color"].asString)
        assertEquals(listOf("Llanowar Elves" to 4, "Forest" to 20), d.getAsJsonArray("cards").map { it.asJsonObject["name"].asString to it.asJsonObject["qty"].asInt })
        assertEquals(listOf("Naturalize" to 2), d.getAsJsonArray("side").map { it.asJsonObject["name"].asString to it.asJsonObject["qty"].asInt })
    }

    @Test(expected = IllegalStateException::class) fun refusesOldSchema() {
        CommunityDecks.sharedDeckCopy(JsonParser.parseString("""{"kind":"deck","game":"mtg","format":"Standard","cards":[{"id":"a","name":"x"}]}""").asJsonObject, "x")
    }

    @Test(expected = IllegalStateException::class) fun refusesUnmatched() {
        CommunityDecks.sharedDeckCopy(JsonParser.parseString("""{"kind":"deck","game":"mtg","format":"Standard","deckSchema":1,"cards":[{"name":"x"}]}""").asJsonObject, "x")
    }
}
