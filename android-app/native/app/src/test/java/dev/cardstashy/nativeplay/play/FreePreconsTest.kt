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
}
