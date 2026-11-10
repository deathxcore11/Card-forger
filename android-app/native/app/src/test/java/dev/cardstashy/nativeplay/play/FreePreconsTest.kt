package dev.cardstashy.nativeplay.play

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Test

/** loadFreePrecons: only the Commander decks, as free:<key>, commander from the flagged row, always unlocked, listed after Play decks. */
class FreePreconsTest {
    @Test fun commanderOnly() {
        val body = JsonParser.parseString("""{"decks":[{"key":"fin-ub","name":"Blue-Black","format":"Standard","rows":[{"name":"Island","qty":20}]},
            {"key":"fic-cloud","name":"Limit Break","format":"Commander","rows":[{"name":"Sol Ring","qty":1,"set":"fic","number":"1"},{"name":"Cloud, Ex-SOLDIER","qty":1,"commander":true}]}]}""").asJsonObject
        val free = TableDecks.freeFrom(body)
        assertEquals(listOf("free:fic-cloud"), free.map { it.id })
        assertEquals("Cloud, Ex-SOLDIER", free[0].commander)
        assertEquals(true, free[0].unlocked); assertEquals(2, free[0].count)
        val all = TableDecks.list(null, emptyList(), { "" }, free)
        assertEquals(listOf("free:fic-cloud"), all.map { it.id })
        assertEquals(emptySet<String>(), TableDecks.locked(all))
    }

    /** The bake's stand-ins go back to the real cards the engine knows; a stand-in with its own print, or one not known, stays. */
    @Test fun realCardsBack() {
        val body = JsonParser.parseString("""{"swaps":{"Hate Mirage":"Lightning Bolt","Voice of Many":"Serra Angel"},"decks":[{"key":"scd-chaos","name":"Chaos Incarnate","format":"Commander",
            "rows":[{"name":"Lightning Bolt","qty":1},{"name":"Lightning Bolt","qty":1,"set":"m10","number":"146"},{"name":"Serra Angel","qty":1},{"name":"Kardur, Doomscourge","qty":1,"commander":true}]}]}""").asJsonObject
        val names = { k: Set<String> -> TableDecks.freeFrom(body, k)[0].raw.getAsJsonArray("cards").map { it.asJsonObject.get("name").asString } }
        assertEquals(listOf("Lightning Bolt", "Lightning Bolt", "Serra Angel", "Kardur, Doomscourge"), names(emptySet()))
        assertEquals(listOf("Hate Mirage", "Lightning Bolt", "Serra Angel", "Kardur, Doomscourge"), names(setOf("Hate Mirage")))
    }
}
