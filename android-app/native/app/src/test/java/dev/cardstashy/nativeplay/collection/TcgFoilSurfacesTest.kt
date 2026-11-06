package dev.cardstashy.nativeplay.collection

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.foil.CardFinish
import dev.cardstashy.nativeplay.foil.PtcgFoil
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.TcgFinish
import dev.cardstashy.nativeplay.ui.tcgFinishOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Yu-Gi-Oh! and Pokémon foils on every Collection surface the site gives them (finish-preview.js finishAttrs): the Cards tab's lots
 * (tcg.js .lot-art), the card page (.cd-img), a deck's rows, Value's top lots (value-page.js) and a binder's pockets (binders.js).
 * Each surface's model must carry the site's finish, and the app's foil layer must be able to draw it (a recipe, and for Pokémon
 * its measured mask). Randall, 6 Nov: "check on foils on yugii and polemon I think they're gone".
 */
class TcgFoilSurfacesTest {
    private val root = File(System.getProperty("repoRoot"))
    private val bundle = File(root, "android-app/native/app/src/main/assets/collection-engine.js")
    private val masks by lazy { PtcgFoil.Masks.parse(File(root, "android-app/native/app/src/main/res/raw/ptcg_masks.json").readText()) }

    /** Every tcgFinish in [j] whose object (or the object holding it) names [name]. */
    private fun finishes(j: JsonElement, name: String, out: MutableList<JsonObject> = mutableListOf()): List<JsonObject> {
        when {
            j.isJsonObject -> { val o = j.asJsonObject
                o.get("tcgFinish")?.takeIf { it.isJsonObject && o.toString().contains(name) }?.let { out += it.asJsonObject }
                o.entrySet().forEach { (k, v) -> if (k != "tcgFinish") finishes(v, name, out) } }
            j.isJsonArray -> j.asJsonArray.forEach { finishes(it, name, out) }
        }
        return out
    }
    private fun worn(where: String, game: CardGame, j: JsonElement, name: String): CardFinish {
        val f = finishes(j, name)
        assertTrue("$where: no finish for $name", f.isNotEmpty())
        val cf = tcgFinishOf({ masks }, game, TcgFinish.of(f.first())!!, "https://example.test/card.jpg")
        assertTrue("$where: the app can't draw ${f.first()}", cf != null)
        // The same with the game read off the model, as the Cards tab, Value and binders do.
        assertEquals(where, cf!!::class, tcgFinishOf({ masks }, TcgFinish.of(f.first())!!.let { t -> game.takeIf { t.effect.startsWith("ygo") } ?: CardGame.PTCG }, TcgFinish.of(f.first())!!, "x")!!::class)
        return cf
    }

    @Test fun everySurfaceWearsTheSitesFoil() = runBlocking {
        assumeTrue(bundle.isFile)
        CollectionEngine.initFrom(bundle)
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        val ws = fx["workspace"].asJsonObject.deepCopy()
        // Dark Magician saved as its 2017 Mega-Tins Secret Rare (the Cards tab shows a printed rarity's foil only once it is known).
        ws["tcg"].asJsonObject["ygo"].asJsonObject["collection"].asJsonArray.map { it.asJsonObject }.first { it["name"].asString == "Dark Magician" }.apply {
            addProperty("printing", "CT14-EN001"); addProperty("rarity", "Secret Rare")
        }
        // Pikachu ex saved as its holofoil (Value and binders show a copy's finish only once its variant is saved, as the site does).
        ws["tcg"].asJsonObject["ptcg"].asJsonObject["collection"].asJsonArray.map { it.asJsonObject }.first { it["name"].asString == "Pikachu ex" }.addProperty("variant", "holofoil")
        // A binder for each game holding every card, so its pockets are drawn.
        ws["settings"].asJsonObject.add("binders", JsonParser.parseString("""[{"id":"bp","game":"ptcg","title":"Shiny","rule":"all"},{"id":"by","game":"ygo","title":"Mine","rule":"all"}]"""))
        CollectionEngine.load(ws, null)
        CollectionEngine.tcgCacheLoad(fx["cache"].toString())

        // Pokémon: Pikachu ex is a Double rare, holofoil across the whole card (ptcg-double-rare on the card mask).
        for ((where, model) in listOf(
            "Cards" to CollectionEngine.cards("ptcg"),
            "Value" to CollectionEngine.value("ptcg"),
            "deck" to CollectionEngine.deck("ptcg", "1c5ee49c-a4ba-4506-ae2b-1e0761e20324"),
            "card page" to CollectionEngine.tcard(JsonObject().apply { addProperty("game", "ptcg"); addProperty("id", "sv08-057") }),
        )) {
            val f = worn("Pokémon $where", CardGame.PTCG, model, if (where == "card page") "" else "Pikachu ex")
            assertTrue("Pokémon $where: $f", f is CardFinish.Ptcg && f.treatment == "ptcg-double-rare" && f.mask == "card")
        }
        // Yu-Gi-Oh!: the Secret Rare's diagonal rainbow on the art and the rainbow name; the card page shows the printing it opens on.
        val cards = CollectionEngine.cards("ygo")
        assertTrue((worn("Yu-Gi-Oh! Cards", CardGame.YGO, cards, "Dark Magician") as CardFinish.Ygo).effect == "ygo-secret")
        val page = CollectionEngine.tcard(JsonObject().apply { addProperty("game", "ygo"); addProperty("id", "46986414"); addProperty("entry", "f3fd777d-1a48-4a02-a26b-57ca05e9ee15") })
        assertEquals("ygo-secret", (worn("Yu-Gi-Oh! card page", CardGame.YGO, page, "") as CardFinish.Ygo).effect)
        assertEquals("ygo-secret", (worn("Yu-Gi-Oh! Value", CardGame.YGO, CollectionEngine.value("ygo"), "Dark Magician") as CardFinish.Ygo).effect)

        // Binders: the pockets of each game's binder.
        val bp = CollectionEngine.binder("ptcg", "bp", 0)
        assertTrue("Pokémon binder: ${bp.toString().take(300)}", (worn("Pokémon binder", CardGame.PTCG, bp, "Pikachu ex") as CardFinish.Ptcg).treatment == "ptcg-double-rare")
        val by = CollectionEngine.binder("ygo", "by", 0)
        assertEquals("ygo-secret", (worn("Yu-Gi-Oh! binder", CardGame.YGO, by, "Dark Magician") as CardFinish.Ygo).effect)
    }
}
