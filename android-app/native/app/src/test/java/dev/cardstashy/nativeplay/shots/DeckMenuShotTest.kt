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
 * A deck's ⋯ menu as deckw/menu.cjs captures it on the live site (Goblin Horde, Commander, 40 cards, a User export): the menu as it
 * opens; Edit deck with its deck box settings open, scrolled to their middle; More deck tools open, then Assembled ticked; and
 * Save a version's question. On the Fold's cover screen (390 × 844) and unfolded (884 × 1104). The real path: this device's copy,
 * the engine, the host.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class DeckMenuShotTest {
    @get:Rule val rule = createComposeRule()
    private val app get() = RuntimeEnvironment.getApplication()
    private fun settle() = repeat(20) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "deckmenu-$name.png").path)
    private val goblins = """[{"id":"g1","name":"Goblin Horde","format":"Commander","commander":"Krenko, Mob Boss","budget":25,"strategy":"Auto",
        "source":{"kind":"User export","website":"Local export"},"cards":[{"name":"Krenko, Mob Boss","qty":1},{"name":"Sol Ring","qty":1},{"name":"Arcane Signet","qty":1},
        {"name":"Goblin Instigator","qty":1},{"name":"Lightning Bolt","qty":1},{"name":"Skirk Prospector","qty":1},{"name":"Goblin Matron","qty":1},
        {"name":"Impact Tremors","qty":1},{"name":"Purphoros, God of the Forge","qty":1},{"name":"Goblin Chieftain","qty":1},{"name":"Mountain","qty":30}]}]"""

    private fun open(openDeck: (String) -> Unit = {}, deleted: () -> Unit = {}) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false
        val ws = JsonParser.parseString(javaClass.getResource("/account-writes/lot-edit.json")!!.readText()).asJsonObject["before"].asJsonObject.apply {
            add("decks", JsonParser.parseString(goblins)); addProperty("activeDeck", "g1")
        }
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(ws.toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        rule.setContent { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
        CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen("g1", tab = {}, web = { _, _ -> }, openDeck = openDeck, deleted = deleted)
        rule.waitForIdle(); settle()
    }
    /** scrollIntoView({block: 'center'}) in the menu's own scroller. */
    private fun centre(n: SemanticsNodeInteraction) {
        val box = rule.onNode(hasScrollAction()).fetchSemanticsNode().boundsInRoot
        val r = n.fetchSemanticsNode().boundsInRoot
        rule.onNode(hasScrollAction()).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, r.center.y - box.center.y) }; settle()
    }
    private fun tap(text: String) { rule.onNode(hasText(text) and hasClickAction(), useUnmergedTree = false).performClick(); settle() }

    private fun run(w: Int) {
        open()
        try {
            shot("menu-$w")
            rule.onNode(hasText("Edit deck")).performClick(); settle()
            tap("Deck box appearance")
            centre(rule.onNode(hasTestTag("deck-box-settings"))); shot("edit-$w")
            rule.onNode(hasScrollAction()).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, -5000f) }; settle()
            rule.onNode(hasText("Edit deck")).performClick(); settle()
            rule.onNode(hasText("More deck tools")).performClick(); settle()
            centre(rule.onNode(hasTestTag("details-tools"))); shot("tools-$w")
            rule.onNode(hasText("Assembled")).performClick(); settle(); shot("tools-on-$w")
            rule.onNode(hasText("Save a version")).performClick(); settle(); shot("ask-$w")
        } finally { CollectionWrites.askingText.value?.reply?.complete(null); CollectionWrites.menu.value = null; settle() }
    }

    /** Duplicate opens the copy (A.deckDup's go), and Delete asks first, then goes back to the decks; both saved on this device. */
    @Test fun duplicateThenDelete() {
        var opened = ""; var gone = false
        open(openDeck = { opened = it }, deleted = { gone = true })
        try {
            fun decks() = JsonParser.parseString(Decks.deviceFile(app, "u").readText()).asJsonObject.getAsJsonArray("decks").map { it.asJsonObject["name"].asString }
            rule.onNode(hasText("Duplicate deck")).performClick(); settle()
            org.junit.Assert.assertTrue(opened.isNotEmpty()); org.junit.Assert.assertNull(CollectionWrites.menu.value)
            org.junit.Assert.assertEquals(listOf("Goblin Horde", "Goblin Horde (copy)"), decks())
            CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(opened, tab = {}, web = { _, _ -> }, openDeck = {}, deleted = { gone = true }); settle()
            rule.onNode(hasText("Delete deck")).performClick(); settle()
            rule.onNode(hasText("Delete Goblin Horde (copy)? Your collection is not affected.")).assertExists()
            tap("Delete")
            org.junit.Assert.assertTrue(gone); org.junit.Assert.assertEquals(listOf("Goblin Horde"), decks())
        } finally { CollectionWrites.menu.value = null; settle() }
    }

    @Test fun menuOnCover() = run(390)
    @Config(qualifiers = "w884dp-h1104dp-xxhdpi")
    @Test fun menuUnfolded() = run(884)
}
