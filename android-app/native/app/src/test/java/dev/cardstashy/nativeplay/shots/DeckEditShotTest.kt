package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.ui.CollectionDeck
import dev.cardstashy.nativeplay.ui.CollectionDeckModel
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.Site
import dev.cardstashy.nativeplay.ui.TopBarItems
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Deck edits as the live site's deckedit capture shows them: the deck page's "+ Add" row open with a name typed (Izzet Tempo, the
 * site's own deckPage model from CollectionEngineTest.deckModel), and a card page's Add to deck picker over the Collection (the real
 * path: this device's copy, the engine, the host). On the Fold's cover screen (390 × 844) and unfolded (884 × 1104).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class DeckEditShotTest {
    @get:Rule val rule = createComposeRule()
    private val app get() = RuntimeEnvironment.getApplication()
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? = (home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() })
        ?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() }
    private fun settle() = repeat(20) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "deckedit-$name.png").path)

    private fun addRow(w: Int) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        val fx = home.resolve("collection-deck-gallery.json")
        assumeTrue("write the fixtures first (CollectionEngineTest.deckModel)", fx.exists())
        val m = CollectionDeckModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        rule.setContent {
            CollectionDeck(m, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) },
                nav = { v -> CollectionNav(CollectionTab.DECKS, vertical = v, scan = !v) {} })
        }
        settle()
        // As the capture: the toolbar under the top bar (its search field 80 down), "+ Add" open, "Shock" typed.
        val top = rule.onNode(hasContentDescription("Search deck")).fetchSemanticsNode().boundsInRoot.top
        val d = app.resources.displayMetrics.density
        rule.onNode(androidx.compose.ui.test.hasScrollToIndexAction()).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, top - 80f * d) }; settle()
        rule.onNode(hasContentDescription("Add a card")).performClick(); settle()
        shot("addrow-$w")
        rule.onNode(hasContentDescription("Card name to add")).performTextReplacement("Shock"); settle()
        shot("addrow-typed-$w")
    }

    @Test fun addRowOnCover() = addRow(390)
    @Config(qualifiers = "w884dp-h1104dp-xxhdpi")
    @Test fun addRowUnfolded() = addRow(884)

    /** A card page's Add to deck: the site's sheet over what opened it, on the account's active deck; with no decks, the site's words. */
    @Test fun pickerOnCover() = picker("""[{"id":"g1","name":"Goblin Horde","format":"Commander","commander":"Krenko, Mob Boss","cards":[{"name":"Krenko, Mob Boss","qty":1}]},{"id":"i1","name":"Izzet Tempo","format":"Modern","cards":[{"name":"Lightning Bolt","qty":4}]}]""", "Skithiryx, the Blight Dragon", "picker-390")
    @Test fun pickerNoDecks() = picker("[]", "Sol Ring", "picker-none-390")

    private fun picker(decks: String, name: String, tag: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false
        val ws = JsonParser.parseString(javaClass.getResource("/account-writes/lot-edit.json")!!.readText()).asJsonObject["before"].asJsonObject.apply {
            add("decks", JsonParser.parseString(decks))
            if (decks != "[]") addProperty("activeDeck", "g1")
        }
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(ws.toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        rule.setContent { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
        try {
            CollectionWrites.picking.value = CollectionWrites.DeckPick("mtg", name, closeAll = {}, go = {})
            rule.waitForIdle(); settle()
            shot(tag)
        } finally { CollectionWrites.picking.value = null }
    }
}
