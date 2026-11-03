package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.DeckEdit
import dev.cardstashy.nativeplay.play.Trunk
import org.junit.Assert.assertEquals
import org.junit.Test

/** The deck editor against the web's own answers (craftPlan, stepDeckCard, cardGroup) and the web's save body. */
class DeckEditTest {
    private val g = JsonParser.parseString(javaClass.classLoader!!.getResource("deck-golden.json")!!.readText()).asJsonObject
    private fun lines(a: com.google.gson.JsonArray) = a.map { val o = it.asJsonObject; DeckEdit.Line(o["name"].asString, o["qty"].asInt) }

    @Test fun craftPlan() {
        val owned = g["owned"].asJsonObject.entrySet().associate { it.key to it.value.asInt }
        val rarity = g["rarity"].asJsonObject.entrySet().associate { it.key to it.value.asString }
        for (c in g["craft"].asJsonArray.map { it.asJsonObject }) {
            val p = DeckEdit.craftPlan(lines(c["deck"].asJsonArray), owned, { rarity[it] ?: "" }, c["wallet"].asJsonObject)
            val o = c["out"].asJsonObject
            assertEquals(o["craftable"].asInt, p.craftable); assertEquals(o["missing"].asInt, p.missing)
            assertEquals(o["need"].asJsonObject.entrySet().associate { it.key to it.value.asInt }, p.need)
            assertEquals(o["have"].asJsonObject.entrySet().associate { it.key to it.value.asInt }, p.have)
            assertEquals(o["rows"].asJsonArray.map { val r = it.asJsonObject; DeckEdit.PlanRow(r["name"].asString, r["miss"].asInt, r["seal"].asString, r["now"]?.asInt ?: 0) }, p.rows)
        }
    }

    @Test fun step() {
        val base = listOf(DeckEdit.Line("Lightning Bolt", 3), DeckEdit.Line("Island", 4), DeckEdit.Line("Sol Ring", 1))
        for (c in g["step"].asJsonArray.map { it.asJsonObject }) {
            var rows = base; repeat(2) { rows = DeckEdit.step(rows, c["name"].asString, c["step"].asInt, c["format"].asString) }
            assertEquals("${c["format"]} ${c["name"]} ${c["step"]}", lines(c["out"].asJsonArray), rows)
        }
    }

    @Test fun groups() { for (e in g["groups"].asJsonArray) assertEquals(e.asJsonArray[1].asString, Trunk.group(e.asJsonArray[0].asString)) }

    /** Open a web-saved deck, change nothing, Save: the posted body is the web's (main rows as saved, sideboard untouched). */
    @Test fun roundTrip() {
        val deck = JsonParser.parseString("""{"id":"d1","name":"Izzet","format":"Modern","cards":[{"name":"Lightning Bolt","qty":4,"id":"abc","set":"m10"},{"name":"Island","qty":20},{"name":"Pyroblast","qty":2,"board":"side","id":"x"}]}""").asJsonObject
        val body = DeckEdit.saveBody(DeckEdit.open(deck))
        assertEquals("""{"id":"d1","name":"Izzet","format":"Modern","cards":[{"name":"Lightning Bolt","qty":4,"id":"abc","set":"m10"},{"name":"Island","qty":20},{"name":"Pyroblast","qty":2,"board":"side","id":"x"}]}""", body.toString())
        assertEquals("4 Lightning Bolt\n20 Island\n\nSideboard\n2 Pyroblast", DeckEdit.copyList(DeckEdit.open(deck)))
    }
}
