package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.RandomBuild
import dev.cardstashy.nativeplay.ui.PlayBuildDeckSheet
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Play › Decks › Random deck as the website's Build a deck (Randall 5 Nov 23:18Z-23:34Z, preview approved): the build-around card
 * on top, New card / Change card, the eight formats, Theme (deck-experience.js themes, read from the bundle), Commander's bracket and
 * Power, More choices, then the forging screen with Deck Forge's status. The card is Scryfall's Elder Owyn Lyons, saved with its
 * art; Forge this deck runs the real call into RandomBuild and the shot is taken while it builds, then the build is cancelled.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PlayBuildDeckShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "play-build-$name.png").path)
    private fun res(name: String) = javaClass.classLoader!!.getResource("play-build/$name")!!
    private val card: JsonObject = JsonParser.parseString(res("owyn.json").readText()).asJsonObject
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/random-build.js")

    @After fun stop() { RandomBuild.cancel(); dev.cardstashy.nativeplay.ui.Motion.still = false }

    @Test fun sheet() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val art = card.getAsJsonObject("image_uris")
        val pics = mapOf(art["art_crop"].asString to "owyn-art.jpg", art["normal"].asString to "owyn-card.jpg")
        dev.cardstashy.nativeplay.ui.homeArt = { url -> pics[url]?.let { f -> res(f).openStream().use { BitmapFactory.decodeStream(it) }.asImageBitmap() } ?: url }
        // The site's Theme list, from the bundle as the app reads it.
        val themes = if (bundle.isFile) { RandomBuild.initFrom(bundle); runBlocking { RandomBuild.themes() } } else emptyList()
        var picks = 0; var opened: Pair<JsonObject, String>? = null
        rule.setContent {
            PlayBuildDeckSheet(onClose = {}, onDeck = { d, f -> opened = d to f }, pick = { _, _ -> picks++; card }, queued = { emptyList() }, themes = { themes })
        }
        settle(20)
        assertTrue("the card fills the top", rule.onAllNodesWithText("Elder Owyn Lyons").fetchSemanticsNodes().isNotEmpty())
        RandomBuild.FORMATS.forEach { f -> assertTrue("format $f", rule.onAllNodesWithText(f).fetchSemanticsNodes().isNotEmpty()) }
        shot("setup")
        rule.onAllNodesWithText("Commander").onLast().performClick(); settle(10)
        assertEquals("a new format draws its own build-around", 2, picks)
        assertTrue("Commander adds its bracket row", rule.onAllNodesWithText("AIM FOR BRACKET").fetchSemanticsNodes().isNotEmpty())
        if (themes.isNotEmpty()) { assertTrue("the site's themes", "Artifacts" in themes); rule.onNodeWithText("White").performClick(); settle(5); rule.onNodeWithText("No preference").performClick(); settle(5) }
        rule.onNodeWithText("3").performClick(); settle(5)
        assertTrue("brackets 3 and up build Strong", rule.onAllNodesWithText("POWER · BRACKETS 3 AND UP BUILD STRONG").fetchSemanticsNodes().isNotEmpty())
        rule.onNodeWithText("More choices").performClick(); settle(10)
        rule.onNodeWithText("Best of one").performClick(); settle(5)
        shot("commander")
        rule.onNodeWithText("New card", substring = true).performClick(); settle(10)
        assertEquals(3, picks)
        rule.onNodeWithText("Change card").performClick(); settle(10)
        assertTrue("Change card asks for a name", rule.onAllNodesWithText("Card name").fetchSemanticsNodes().isNotEmpty())
        rule.onNodeWithText("Close").performClick(); settle(5)
        if (bundle.isFile) {
            rule.onNodeWithText("Forge this deck").performClick(); settle(10);
            assertTrue("the forging screen", rule.onAllNodesWithText("Forging your deck").fetchSemanticsNodes().isNotEmpty())
            shot("forging")
            rule.onNodeWithText("Cancel build").performClick(); settle(10)
            assertTrue("cancel returns to the choices", rule.onAllNodesWithText("Forge this deck").fetchSemanticsNodes().isNotEmpty())
        }
        assertEquals(null, opened)
    }
}
