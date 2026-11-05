package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
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
 * app.js addSheet as addsheet.cjs captures it on the live site: Add to collection empty, with Sol Ring (the live site's own card
 * and its condition quotes, account-writes/add-sheet-sol-ring.json), Lightly Played, a bad copies count, and Edit card; on the
 * Fold's cover screen (390 × 844) and unfolded (884 × 1104). The real path: this device's copy and catalog, the engine, the host.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class AddLotSheetShotTest {
    @get:Rule val rule = createComposeRule()
    private val app get() = RuntimeEnvironment.getApplication()
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? = (home.resolve(key(url) + ".jpg").takeIf { it.exists() } ?: home.resolve(key(url) + ".png").takeIf { it.exists() })
        ?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() }
    private fun settle() = repeat(30) { Thread.sleep(120); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "add-$name.png").path)

    private fun setUp(lots: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false
        val card = JsonParser.parseString(javaClass.getResource("/account-writes/add-sheet-sol-ring.json")!!.readText()).asJsonObject["card"]
        // The site's own workspace shape (store.js blank, as the account-write fixtures hold it), with these lots.
        val ws = JsonParser.parseString(javaClass.getResource("/account-writes/lot-edit.json")!!.readText()).asJsonObject["before"].asJsonObject
            .apply { add("collection", JsonParser.parseString(lots)) }
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(ws.toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText(JsonObject().apply { add("sol ring", card) }.toString())
        rule.setContent { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
    }
    private fun open(req: JsonObject) { CollectionWrites.openAdd(req) { }; rule.waitForIdle(); settle() }
    /** #sheetBody scrolled to its end (addsheet.cjs: scrollTop = 9999). */
    private fun bottom() {
        rule.onNode(androidx.compose.ui.test.hasScrollAction()).performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.ScrollBy) { it(0f, 9999f) }; settle()
    }

    @Test fun addOnCover() {
        setUp("[]")
        try {
            open(JsonObject()); shot("empty-390")
            CollectionWrites.adding.value = null; rule.waitForIdle()
            // Got it on a wanted Sol Ring: the card looked up, its Near Mint quote.
            open(JsonObject().apply { addProperty("own", "Sol Ring") }); shot("lookup-390")
            bottom(); shot("lookup-bottom-390")
            rule.onNode(hasContentDescription("Condition") and hasClickAction()).performScrollTo().performClick(); rule.waitForIdle()
            rule.onNodeWithText("Lightly Played").performClick(); settle()
            bottom(); shot("lp-390")
            rule.onNode(hasContentDescription("Copies")).performScrollTo().performTextReplacement("0")
            rule.onNode(hasText("Add to collection") and hasClickAction()).performScrollTo().performClick(); settle()
            rule.onNodeWithText("Copies must be a whole number from 1 to 100000.").assertExists(); bottom(); shot("error-390")
        } finally { CollectionWrites.adding.value = null }
    }

    @Test fun editOnCover() {
        // The live site's own Sol Ring lot after its save (2× Near Mint, with the quotes the save kept on it).
        setUp("[" + JsonParser.parseString(javaClass.getResource("/account-writes/add-sheet-sol-ring.json")!!.readText()).asJsonObject["lot"] + "]")
        try { open(JsonObject().apply { addProperty("entry", "l9") }); shot("edit-390"); bottom(); shot("edit-bottom-390") }
        finally { CollectionWrites.adding.value = null }
    }

    @Config(qualifiers = "w884dp-h1104dp-xxhdpi")
    @Test fun addUnfolded() {
        setUp("[]")
        try {
            open(JsonObject()); shot("empty-884")
            CollectionWrites.adding.value = null; rule.waitForIdle()
            open(JsonObject().apply { addProperty("own", "Sol Ring") }); shot("lookup-884")
        } finally { CollectionWrites.adding.value = null }
    }
}
