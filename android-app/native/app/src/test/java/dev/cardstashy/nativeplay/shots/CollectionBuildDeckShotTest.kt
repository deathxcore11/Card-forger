package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.RandomBuild
import dev.cardstashy.nativeplay.ui.BuildFlowEngine
import dev.cardstashy.nativeplay.ui.CollectionBuildDeckSheet
import dev.cardstashy.nativeplay.ui.CollectionWrites
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
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
 * Collection › Decks › Random Commander (Randall 5 Nov 23:18Z, preview approved 23:34Z): the site's Build a deck in its sheet. The
 * models are what deck-flow-entry.mjs returned in Chromium for Elder Owyn Lyons (the build-deck fixtures, 6 Nov): the setup with
 * Commander locked, then a finished 100-card deck. The engine here hands those back in place of the WebView, holding the build
 * so the building overlay can be seen; Save goes to a recorder in place of the Collection engine.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionBuildDeckShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(50); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-build-$name.png").path)
    private fun res(path: String) = javaClass.classLoader!!.getResource(path)!!
    private fun json(path: String) = JsonParser.parseString(res(path).readText()).asJsonObject
    private fun seen(text: String) = rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty()

    private class Fake(val setup: JsonObject, val result: JsonObject) : BuildFlowEngine {
        val calls = mutableListOf<String>()
        val build = CompletableDeferred<Unit>()
        override val status = MutableStateFlow("")
        override suspend fun ready() = true
        override fun cancel() { calls += "cancel" }
        override suspend fun call(name: String, a: JsonObject): RandomBuild.Flow {
            calls += name
            fun setupFor(r: JsonObject?, st: String = "", err: Boolean = false) = setup.deepCopy().apply {
                r?.let { add("request", it) }; addProperty("status", st); addProperty("error", err)
                if (r?.get("commanderLock")?.asBoolean == false) add("format", JsonParser.parseString("""{"locked":false,"label":"Format","options":[{"value":"Commander","label":"Commander","on":true},{"value":"Standard","label":"Standard","on":false}]}"""))
            }
            return when (name) {
                "flowWorkspace" -> RandomBuild.Flow(com.google.gson.JsonPrimitive(true), null)
                "flowOpen", "flowRandom" -> RandomBuild.Flow(setupFor(a.getAsJsonObject("request")), null)
                "flowSetup" -> RandomBuild.Flow(setupFor(a.getAsJsonObject("request"), a.get("status")?.asString ?: "", a.get("error")?.asBoolean == true), null)
                "flowGenerate" -> {
                    status.value = "Testing engine upgrades · pass 1/2 · list 3/4"
                    build.await(); status.value = ""
                    RandomBuild.Flow(JsonObject().apply { addProperty("ok", true); add("model", result) }, null)
                }
                "flowSaveData" -> RandomBuild.Flow(JsonObject().apply { add("deck", JsonObject().apply { addProperty("buildAround", "Elder Owyn Lyons") }); add("request", result.getAsJsonObject("request")) }, null)
                "flowSaved" -> RandomBuild.Flow(result.deepCopy().apply { add("save", JsonParser.parseString("""{"label":"Saved to My decks","disabled":true}""")) }, null)
                "flowBudget" -> if (a.get("budget").asString.toDoubleOrNull() == null) RandomBuild.Flow(null, "Enter a dollar budget from \$0 to \$100,000.") else RandomBuild.Flow(com.google.gson.JsonPrimitive(true), null)
                "flowExport" -> RandomBuild.Flow(JsonObject().apply { addProperty("text", "1 Elder Owyn Lyons") }, null)
                else -> RandomBuild.Flow(null, "unknown $name")
            }
        }
    }

    @After fun still() { dev.cardstashy.nativeplay.ui.Motion.still = false }

    @Test fun randomCommander() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val card = json("play-build/owyn.json").getAsJsonObject("image_uris")
        val pics = mapOf(card["art_crop"].asString to "play-build/owyn-art.jpg", card["normal"].asString to "play-build/owyn-card.jpg")
        dev.cardstashy.nativeplay.ui.homeArt = { url -> pics[url]?.let { f -> res(f).openStream().use { BitmapFactory.decodeStream(it) }.asImageBitmap() } ?: url }
        val fake = Fake(json("build-deck/setup-commander.json"), json("build-deck/flow-result.json"))
        val saved = mutableListOf<JsonObject>()
        var closed = false
        val open = CollectionWrites.BuildOpen(JsonObject().apply { addProperty("game", "mtg"); addProperty("format", "Commander"); addProperty("commanderLock", true) }, "randomDeck", { _, _ -> })
        rule.setContent {
            CollectionBuildDeckSheet(open, null, onClose = { closed = true }, engine = fake, workspace = { "{}" }, save = { _, d -> saved += d; true })
        }
        settle(30)
        // open(), then A.flowRandom at once (app.js A.randomDeck).
        assertEquals(listOf("flowWorkspace", "flowOpen", "flowRandom"), fake.calls.take(3))
        assertTrue("the card", seen("Elder Owyn Lyons"))
        assertTrue("Commander's lock", seen("Use another format"))
        assertTrue("the budget", seen("Budget ($)"))
        shot("setup")
        rule.onNodeWithText("Preferences").performScrollTo().performClick(); settle(10)
        assertTrue("Preferences open", seen("Use owned cards first") && seen("Strict maximum"))
        rule.onNodeWithText("Generate deck").performScrollTo().performClick(); settle(10)
        assertTrue("building", seen("Your deck is being built") && seen("Testing engine upgrades"))
        shot("building")
        fake.build.complete(Unit); settle(30)
        assertTrue("the result", seen("Save deck") && seen("Random build") && seen("Main deck"))
        shot("result")
        rule.onNodeWithText("Save deck").performClick(); settle(20)
        assertEquals("saved once", 1, saved.size)
        assertTrue("the button says so", seen("Saved to My decks"))
        // Rebuild with a budget that isn't one: customBudget's message, nothing built.
        rule.onNodeWithText("Rebuild").performClick(); settle(5)
        rule.onNodeWithContentDescription("Budget ($)").performTextInput("abc"); settle(5)
        rule.onNodeWithText("Rebuild with budget").performClick(); settle(10)
        assertTrue("budget message", seen("Enter a dollar budget"))
        // Detailed list: the rows with their pills and prices.
        rule.onNodeWithContentDescription("Detailed list").performScrollTo().performClick(); settle(10)
        rule.onNodeWithText("1× Enduring Curiosity").performScrollTo(); settle(10)
        shot("list")
        // Art grid back for the deck page's default, then Edit choices: the setup again.
        rule.onNodeWithContentDescription("Art grid").performScrollTo().performClick(); settle(5)
        rule.onNodeWithText("Edit choices").performScrollTo().performClick(); settle(20)
        assertTrue("Edit choices", seen("Generate deck"))
        assertTrue(!closed)
    }
}
