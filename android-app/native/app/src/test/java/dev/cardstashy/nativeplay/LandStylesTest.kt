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

    // Mixed styles in one deck (Randall 17 Nov): the same cases as test-land-styles.mjs.
    private fun line(n: String, q: Int, id: String = "") = dev.cardstashy.nativeplay.play.DeckEdit.Line(n, q, if (id.isEmpty()) null else JsonObject().apply { addProperty("id", id) })
    private fun shape(c: List<dev.cardstashy.nativeplay.play.DeckEdit.Line>) = c.map { Triple(it.name, LandStyles.rowId(it), it.qty) }

    @Test fun mixedRows() {
        var rows = LandStyles.addRow(listOf(line("Forest", 16, "a"), line("Plains", 8)), "Forest", "b")
        assertEquals(listOf(Triple("Forest", "a", 16), Triple("Plains", "", 8), Triple("Forest", "b", 1)), shape(rows))
        rows = LandStyles.stepRow(rows, "Forest", "b", 1); assertEquals(2, rows.first { LandStyles.rowId(it) == "b" }.qty)
        assertEquals(16, rows.first { LandStyles.rowId(it) == "a" }.qty)
        rows = LandStyles.stepRow(LandStyles.stepRow(rows, "Forest", "b", -1), "Forest", "b", -1); assertTrue(rows.none { LandStyles.rowId(it) == "b" })
        rows = LandStyles.addRow(rows, "Forest", "c", 3)
        assertEquals(listOf(3, 16, 8), LandStyles.mainFirst(rows, "Forest", "c").map { it.qty })
        assertEquals(listOf(Triple("Forest", "d", 16), Triple("Plains", "", 8), Triple("Forest", "c", 3)), shape(LandStyles.restyle(rows, "Forest", "a", "d")))
        assertEquals(listOf(Triple("Plains", "", 8), Triple("Forest", "c", 19)), shape(LandStyles.restyle(rows, "Forest", "a", "c")))
        val pre = dev.cardstashy.nativeplay.play.DeckEdit.Line("Plains", 7, JsonObject().apply { addProperty("set", "fdn"); addProperty("number", "273") })
        assertTrue(LandStyles.precon(pre))
        val re = LandStyles.restyle(listOf(pre), "Plains", "", "e").single()
        assertEquals("e", LandStyles.rowId(re)); assertTrue(re.extra!!.get("set") == null)
        assertEquals(listOf(5, 1, 1), LandStyles.join(listOf(line("Forest", 2, "a"), line("Elf", 1, "x"), line("Elf", 1, "x"), line("Forest", 3, "a"))).map { it.qty })
        assertEquals("Forest" to "", LandStyles.parseKey(LandStyles.key("Forest", "")))
        assertEquals(null, LandStyles.parseKey("Llanowar Elves"))
    }
}
