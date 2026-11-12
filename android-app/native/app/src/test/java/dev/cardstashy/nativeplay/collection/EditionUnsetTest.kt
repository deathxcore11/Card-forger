package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Randall's pick (12 Nov): a Yu-Gi-Oh! lot saved with its release but not its printing shows the printing the release names, and the
 * Cards list marks it "Edition not set" (tcg.js .edition-unset in .lot-sub). The app's list row draws .lot-sub as pieces, so the
 * mark must reach the row model as its own words; a lot with its own saved printing carries no mark.
 */
class EditionUnsetTest {
    private val root = File(System.getProperty("repoRoot"))
    private val bundle = File(root, "android-app/native/app/src/main/assets/collection-engine.js")

    private fun words(cards: JsonObject, name: String): List<String> {
        val row = cards["rows"].asJsonArray.map { it.asJsonObject }.first { it["name"].asString == name }
        return row["pieces"].asJsonArray.map { it.asJsonObject }.filter { it["k"].asString == "t" }.map { it["t"].asString.trim() }
    }

    @Test fun releaseOnlyLotIsMarked() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        val ws = fx["workspace"].asJsonObject.deepCopy()
        // Dark Magician saved with its release (2017 Mega-Tins holds one printing of it, CT14-EN001 Secret Rare) and no printing.
        ws["tcg"].asJsonObject["ygo"].asJsonObject["collection"].asJsonArray.map { it.asJsonObject }.first { it["name"].asString == "Dark Magician" }.apply {
            addProperty("printing", ""); addProperty("rarity", ""); addProperty("setReleaseId", "ygo:CT14:2017-08-31:2017%20Mega-Tins")
        }
        // The release list as the site keeps it (tcg.js readYgoSetCache), so no network is needed.
        CollectionEngine.eval("""(localStorage.setItem("cardforge-ygo-sets-v3", JSON.stringify({schema: 3, at: Date.now(), list: [{set_code: "CT14", set_name: "2017 Mega-Tins", tcg_date: "2017-08-31"}]})), "ok")""")
        CollectionEngine.load(ws, null)
        CollectionEngine.tcgCacheLoad(fx["cache"].toString())
        val cards = CollectionEngine.cards("ygo")
        val dm = words(cards, "Dark Magician")
        assertTrue("Dark Magician's row: $dm", "Edition not set" in dm)
        val row = cards["rows"].asJsonArray.map { it.asJsonObject }.first { it["name"].asString == "Dark Magician" }
        assertEquals("the release's printing shines", "ygo-secret", row["tcgFinish"].asJsonObject["effect"].asString)
        // A lot with no release and no printing borrows nothing and is not marked.
        assertFalse("Ash Blossom: ${words(cards, "Ash Blossom & Joyous Spring")}", "Edition not set" in words(cards, "Ash Blossom & Joyous Spring"))
    }
}
