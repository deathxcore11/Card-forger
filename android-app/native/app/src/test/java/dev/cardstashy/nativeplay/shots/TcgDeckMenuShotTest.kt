package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
import dev.cardstashy.nativeplay.ui.Site
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * A Yu-Gi-Oh! and a Pokémon deck's ⋯ menu (tcg.js A.tDeckMenu) and the price panel's Buy on TCGplayer (A.tDeckCopyMissing), over
 * the collection TcgDeckShotTest uses: the menu as it opens and with Edit deck open; Save changes, Duplicate and Delete saved on
 * this device through tcg.js's own handlers; buy.js's "Shopping list copied" question with its own buttons.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class TcgDeckMenuShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private fun settle() = repeat(20) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tdeckmenu-$name.png").path)
    private val pikachu = "1c5ee49c-a4ba-4506-ae2b-1e0761e20324"
    private val magician = "094ab313-b1e1-4778-aefc-52ceb9c90ae5"

    private fun open(game: String, deck: String, openDeck: (String) -> Unit = {}, deleted: () -> Unit = {}, web: (String, String) -> Unit = { _, _ -> }) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fx = JsonParser.parseString(javaClass.getResource("/tcg-collection/fixture.json")!!.readText()).asJsonObject
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false; dev.cardstashy.nativeplay.ui.HomeCache.model = null
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(fx["workspace"].toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        dev.cardstashy.nativeplay.ui.tcgCacheFile(app).writeText(fx["cache"].toString())
        rule.setContent { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
        CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(deck, tab = {}, web = web, openDeck = openDeck, deleted = deleted, game = game)
        rule.waitForIdle(); rule.waitUntil(60_000) { rule.onAllNodes(hasText("Edit deck")).fetchSemanticsNodes().isNotEmpty() }; settle()
    }
    private fun decks(game: String) = JsonParser.parseString(Decks.deviceFile(app, "u").readText()).asJsonObject.getAsJsonObject("tcg").getAsJsonObject(game)
        .getAsJsonArray("decks").map { it.asJsonObject }

    @Test fun yugiohMenu() {
        open("ygo", magician)
        try {
            rule.onNode(hasText("YU-GI-OH! DECK")).assertExists(); rule.onNode(hasText("Export decklist")).assertExists()
            shot("ygo-menu")
            rule.onNode(hasText("Edit deck")).performClick(); settle(); shot("ygo-edit")
        } finally { CollectionWrites.menu.value = null; settle() }
    }
    @Test fun pokemonMenu() {
        open("ptcg", pikachu)
        try { rule.onNode(hasText("POKÉMON DECK")).assertExists(); shot("ptcg-menu") } finally { CollectionWrites.menu.value = null; settle() }
    }

    /** Duplicate opens the copy (tcg.js go), Delete asks first (dialog.js ask, its own Delete button), then the decks. */
    @Test fun duplicateThenDelete() {
        var opened = ""; var gone = false
        open("ygo", magician, openDeck = { opened = it }, deleted = { gone = true })
        try {
            rule.onNode(hasText("Duplicate deck")).performScrollTo().performClick(); settle()
            rule.waitUntil(20_000) { opened.isNotEmpty() }
            org.junit.Assert.assertTrue(opened.isNotEmpty())
            org.junit.Assert.assertEquals(listOf("Dark Magician", "Dark Magician (copy)"), decks("ygo").map { it["name"].asString })
            CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(opened, tab = {}, web = { _, _ -> }, openDeck = {}, deleted = { gone = true }, game = "ygo"); settle()
            rule.onNode(hasText("Delete deck")).performScrollTo().performClick(); settle()
            rule.onNode(hasText("Delete this deck? Your collection isn’t affected.")).assertExists()
            shot("ygo-delete-ask")
            rule.onNode(hasText("Delete") and hasClickAction()).performClick(); settle()
            rule.waitUntil(20_000) { gone }; org.junit.Assert.assertEquals(listOf("Dark Magician"), decks("ygo").map { it["name"].asString })
        } finally { CollectionWrites.menu.value = null; settle() }
    }

    /** buy.js: the list goes on the clipboard and the site's own question asks before TCGplayer's Mass Entry opens. */
    @Test fun buyOnTcgplayer() {
        open("ptcg", pikachu)
        CollectionWrites.menu.value = null; settle()
        kotlinx.coroutines.runBlocking { CollectionWrites.act(app, "tDeckCopyMissing", com.google.gson.JsonObject().apply { addProperty("game", "ptcg"); addProperty("deck", pikachu) }) }
        settle()
        rule.onNode(hasText("Shopping list copied")).assertExists(); rule.onNode(hasText("Open TCGplayer")).assertExists(); rule.onNode(hasText("Done")).assertExists()
        val clip = (app.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).primaryClip?.getItemAt(0)?.text?.toString().orEmpty()
        org.junit.Assert.assertTrue(clip, clip.contains("Ultra Ball"))
        shot("ptcg-buy-ask")
        // Done closes the question and opens nothing.
        rule.onNode(hasText("Done")).performClick(); settle()
        org.junit.Assert.assertNull(CollectionWrites.ask.value)
    }
}
