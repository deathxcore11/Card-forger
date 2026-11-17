package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.LandStyles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The land styles port against the site's land-styles.js answers on real data (scripts/export-land-styles-golden.mjs). */
class LandStylesTest {
    private val g = JsonParser.parseString(javaClass.classLoader!!.getResource("land-styles-golden.json")!!.readText()).asJsonObject
    private val d = LandStyles.parse(g["data"].asJsonObject)
    private val styles = g["styles"].asJsonArray.map { it.asJsonObject }
    private val cards = g["cards"].asJsonArray.map { it.asJsonObject }
    private val owned = LandStyles.owned(d, styles, cards)
    private fun ids(k: String) = g["sorted"].asJsonObject[k].asJsonArray.map { it.asString }

    @Test fun parse() {
        assertEquals(g["data"].asJsonObject["styles"].asJsonArray.size(), d.list.size)
        assertTrue(d.list.all { it.type == "Forest" || it.type == "Island" })
        assertTrue(d.list.all { it.setName.isNotEmpty() && it.kind in LandStyles.KINDS })
    }

    @Test fun ownedMatchesSite() {
        val want = g["owned"].asJsonObject.entrySet().map { it.key to LandStyles.Owned(it.value.asJsonObject["at"].asInt, it.value.asJsonObject["src"].asString) }
        assertEquals(want.toMap(), owned)
        assertEquals(want.map { it.first }, owned.keys.toList())
    }

    @Test fun sortsMatchSite() {
        val forests = d.list.filter { it.type == "Forest" }
        val inUse = g["chosen"].asJsonObject["Forest"].asString
        for (s in listOf("recent", "newest", "oldest")) assertEquals(s, ids(s), LandStyles.sorted(forests, owned, s, inUse).map { it.id })
    }

    @Test fun deckPrinting() {
        val chosen = LandStyles.chosen(styles)
        assertEquals(g["chosen"].asJsonObject.entrySet().associate { it.key to it.value.asString }, chosen)
        // The export's third case has no account default.
        g["inDeck"].asJsonArray.forEachIndexed { i, c ->
            val a = c.asJsonArray
            assertEquals("case $i", a[1].asString, LandStyles.inDeck("Forest", a[0].asString, owned, if (i < 2) chosen else emptyMap(), d.starter))
        }
    }

    @Test fun craftSeals() {
        val c = g["craft"].asJsonObject
        for (k in listOf("r", "f", "s")) assertEquals(k, c[k]?.takeIf { !it.isJsonNull }?.asString, LandStyles.craftSeal(k))
        val cfg = JsonParser.parseString("""{"landStyles":{"craft":{"r":"u"}}}""").asJsonObject as JsonObject
        assertEquals("u", LandStyles.craftSeal("r", cfg))
    }

    @Test fun gotShowsNewOnlyForPacksAndCrafts() {
        assertEquals(styles.filter { it["src"].asString.startsWith("land") }.map { it["id"].asString }.toSet(), LandStyles.got(styles).keys)
    }
}
