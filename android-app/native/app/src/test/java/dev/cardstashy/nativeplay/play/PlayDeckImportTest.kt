package dev.cardstashy.nativeplay.play

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Test

/** Golden outputs from the site's own play-deck-import.js (node, web 4.3.87) for the same inputs. */
class PlayDeckImportTest {
    private fun cards(a: JsonArray) = a.map { val o = it.asJsonObject; o["name"].asString to o["qty"].asInt }
    private fun probs(a: JsonArray) = a.map { val r = it.asJsonArray; Triple(r[0].asInt, r[1].asString, r[2].asString) }

    @Test fun matchesSite() {
        val gold = JsonParser.parseString(javaClass.classLoader!!.getResource("play-deck-import-golden.json")!!.readText()).asJsonArray
        for ((i, g) in gold.withIndex()) {
            val o = g as JsonObject; val r = PlayDeckImport.parse(o["input"].asString); val at = "case $i"
            assertEquals(at, cards(o["cards"].asJsonArray), r.cards.map { it.name to it.qty })
            assertEquals(at, cards(o["side"].asJsonArray), r.side.map { it.name to it.qty })
            assertEquals(at, cards(o["commanders"].asJsonArray), r.commanders.map { it.name to it.qty })
            assertEquals(at, o["commander"].asString, r.commander)
            assertEquals(at, cards(o["excludedCards"].asJsonArray), r.excludedCards.map { it.name to it.qty })
            assertEquals(at, o["total"].asInt, r.total); assertEquals(at, o["sideTotal"].asInt, r.sideTotal)
            assertEquals(at, o["normalizedText"].asString, r.normalizedText)
            assertEquals(at, o["source"].asString, r.source)
            assertEquals(at, probs(o["errors"].asJsonArray), r.errors.map { Triple(it.line, it.code, it.reason) })
            assertEquals(at, probs(o["warnings"].asJsonArray), r.warnings.map { Triple(it.line, it.code, it.reason) })
        }
    }
}
