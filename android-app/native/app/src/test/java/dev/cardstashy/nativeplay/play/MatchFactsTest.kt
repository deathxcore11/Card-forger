package dev.cardstashy.nativeplay.play

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Test

/** Golden from the site's own match-facts.js (web 4.3.91) over the same table surfaces. */
class MatchFactsTest {
    private fun JsonObject.i(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt
    private fun card(c: JsonObject) = MatchFacts.SCard(c.i("id")!!, c.i("owner"), c.i("controller"), c["zone"].asString, c["known"].asBoolean, c.get("name")?.asString,
        c.get("type")?.asString ?: "", c.getAsJsonArray("types")?.map { it.asString } ?: emptyList(), c.i("power"), c.get("attacking")?.asBoolean == true, c.get("isToken")?.asBoolean == true,
        c.getAsJsonObject("counters")?.entrySet()?.associate { (k, v) -> k to v.asInt } ?: emptyMap(), c.getAsJsonArray("keywords")?.map { it.asString } ?: emptyList(),
        c.getAsJsonArray("attachments")?.map { it.asInt } ?: emptyList())

    @Test fun matchesSite() {
        val gold = JsonParser.parseString(javaClass.classLoader!!.getResource("match-facts-golden.json")!!.readText()).asJsonObject
        val f = MatchFacts()
        for (e in gold.getAsJsonArray("surfaces")) { val s = e.asJsonObject
            f.update(MatchFacts.Surface(s.i("seat")!!, s.i("turn")!!, s.i("activeSeat"), s.getAsJsonArray("players").map { p -> p.asJsonObject.let {
                MatchFacts.SPlayer(it.i("seat")!!, it.i("life"), it.i("handCount"), it.i("libraryCount"), it.getAsJsonObject("counters").entrySet().associate { (k, v) -> k to v.asInt }) } },
                s.getAsJsonArray("cards").map { card(it.asJsonObject) }))
        }
        assertEquals(gold.getAsJsonObject("snapshot"), f.snapshot(true))
        assertEquals(true, f.ownFirst)
    }

    @Test fun surfaceFromBridge() {
        val raw = JsonParser.parseString("""{"viewer":7,"turn":3,"activePlayer":9,"players":[
            {"id":7,"isViewer":true,"life":18,"counters":{"POISON":1},"zones":{"Hand":{"count":2,"cards":[{"id":1,"zone":"Hand","owner":7,"controller":7,"hidden":false,"name":"Shock","type":"Instant"}]},"Library":{"count":40},
              "Battlefield":{"cards":[{"id":2,"zone":"Battlefield","owner":7,"controller":7,"hidden":false,"name":"Serra Angel","type":"Creature — Angel","power":4,"keywords":["Flying",{"keyword":"Vigilance","text":"Vigilance"}],"counters":{"P1P1":1},"attachments":[3]},
                {"id":4,"zone":"Battlefield","owner":7,"controller":7,"hidden":true}]}}},
            {"id":9,"life":20,"zones":{"Hand":{"count":5,"cards":[{"id":5,"zone":"Hand","owner":9,"controller":9,"hidden":true}]},"Library":{"count":41},"Graveyard":{"cards":[{"id":6,"zone":"Graveyard","owner":9,"controller":9,"hidden":false,"name":"Grizzly Bears","type":"Creature — Bear"}]}}}]}""").asJsonObject
        val s = MatchFacts.surface(raw)!!
        assertEquals(0, s.seat); assertEquals(1, s.activeSeat); assertEquals(3, s.turn)
        assertEquals(mapOf("POISON" to 1), s.players[0].counters); assertEquals(41, s.players[1].libraryCount)
        assertEquals(listOf(1, 2, 4, 6), s.cards.map { it.id })
        val angel = s.cards.first { it.id == 2 }
        assertEquals(listOf("Creature"), angel.types); assertEquals(listOf("Flying", "Vigilance"), angel.keywords); assertEquals(listOf(3), angel.attachments)
        assertEquals(false, s.cards.first { it.id == 4 }.known); assertEquals(1, s.cards.first { it.id == 6 }.owner)
    }
}
