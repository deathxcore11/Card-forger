package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.RandomBuild
import dev.cardstashy.nativeplay.ui.BuildFlowEngine
import dev.cardstashy.nativeplay.ui.CollectionBuildDeckSheet
import dev.cardstashy.nativeplay.ui.CollectionWrites
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
 * Build a deck's new controls (the sheet the site already had): Bracket (Commander) or Plan and Power (Standard), the Sideboard switch,
 * "This build"; on the result Lower budget, Group, Tap (Open, Lock, Swap), Rebuild unlocked and the Swap panel. The models are what the
 * site's own markup gives deck-flow-models.mjs (made in Node on the shared deck-flow fixture), handed back here in place of the WebView.
 * Desktop render: it proves the sheet draws them and sends the right calls, not how a phone looks.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionBuildDeckControlsShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(50); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-build-controls-$name.png").path)
    private fun json(path: String) = JsonParser.parseString(javaClass.classLoader!!.getResource(path)!!.readText()).asJsonObject
    private fun seen(text: String) = rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty()
    @After fun still() { dev.cardstashy.nativeplay.ui.Motion.still = false }

    private class Fake(val setup: JsonObject, val result: JsonObject, val extra: JsonObject) : BuildFlowEngine {
        val calls = mutableListOf<String>(); val args = mutableListOf<JsonObject>()
        override val status = MutableStateFlow("")
        override suspend fun ready() = true
        override fun cancel() {}
        override suspend fun call(name: String, a: JsonObject): RandomBuild.Flow {
            calls += name; args += a
            fun withExtra(swap: Boolean, tap: String) = result.deepCopy().apply {
                add("quick", extra.get("quick")); add("unlocked", extra.get("unlocked")); add("retune", extra.get("retune"))
                val sw = extra.getAsJsonArray("switches").deepCopy()
                sw.forEach { s -> if (s.asJsonObject.get("act").asString == "flowTap") s.asJsonObject.getAsJsonArray("items").forEach { i -> i.asJsonObject.addProperty("on", i.asJsonObject.get("value").asString == tap) } }
                add("switches", sw); if (swap) add("swap", extra.get("swap"))
            }
            return when (name) {
                "flowWorkspace" -> RandomBuild.Flow(com.google.gson.JsonPrimitive(true), null)
                "flowOpen", "flowRandom", "flowSetup" -> RandomBuild.Flow(setup.deepCopy().apply { a.getAsJsonObject("request")?.let { add("request", it) } }, null)
                "flowPick" -> RandomBuild.Flow(setup.deepCopy().apply {
                    add("request", a.getAsJsonObject("request"))
                    getAsJsonObject("choices").getAsJsonArray("picks").forEach { p -> if (p.asJsonObject.get("field").asString == a.get("field").asString)
                        p.asJsonObject.getAsJsonArray("items").forEach { i -> i.asJsonObject.addProperty("on", i.asJsonObject.get("value").asString == a.get("value").asString) } }
                }, null)
                "flowGenerate" -> RandomBuild.Flow(JsonObject().apply { addProperty("ok", true); add("model", withExtra(false, "open")) }, null)
                "flowTap" -> RandomBuild.Flow(withExtra(a.get("tap").asString == "swap", a.get("tap").asString), null)
                "flowCardTap" -> RandomBuild.Flow(JsonObject().apply { addProperty("open", false); add("model", withExtra(true, "swap")) }, null)
                "flowSwapKeep" -> RandomBuild.Flow(withExtra(false, "swap"), null)
                "flowBudget" -> RandomBuild.Flow(com.google.gson.JsonPrimitive(true), null)
                "flowRetune" -> RandomBuild.Flow(JsonObject().apply { addProperty("ok", true); add("model", withExtra(false, "open")) }, null)
                "flowAdjust" -> RandomBuild.Flow(JsonObject().apply { addProperty("ok", true); add("model", withExtra(false, "open")) }, null)
                else -> RandomBuild.Flow(null, "unknown $name")
            }
        }
    }

    @Test fun controls() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val setup = json("build-deck/setup-commander.json").apply { add("choices", json("build-deck/choices-commander.json")) }
        val fake = Fake(setup, json("build-deck/flow-result.json"), json("build-deck/result-extra.json"))
        val open = CollectionWrites.BuildOpen(JsonObject().apply { addProperty("game", "mtg"); addProperty("format", "Commander"); addProperty("commanderLock", true) }, "randomDeck", { _, _ -> })
        rule.setContent { CollectionBuildDeckSheet(open, null, onClose = {}, engine = fake, workspace = { "{}" }, save = { _, _ -> true }) }
        settle(30)
        // Commander: the Bracket row with its chosen name, the five brackets.
        assertTrue("Bracket", seen("Bracket") && seen("4 · Optimized"))
        shot("setup-commander")
        rule.onNodeWithContentDescription("Bracket 2, Core").performScrollTo().performClick(); settle(10)
        val pick = fake.args[fake.calls.lastIndexOf("flowPick")]
        assertEquals("bracket", pick.get("field").asString); assertEquals("2", pick.get("value").asString)
        rule.onNodeWithText("Generate deck").performScrollTo().performClick(); settle(30)
        // The result: Lower budget, Group, Tap.
        assertTrue("Lower budget", seen("Lower budget") && seen("\$16"))
        assertTrue("Group and Tap", seen("Group") && seen("Tap"))
        shot("result")
        rule.onNodeWithText("\$11").performScrollTo().performClick(); settle(20)
        val adj = fake.args[fake.calls.lastIndexOf("flowAdjust")]
        assertEquals("11", adj.get("budget").asString); assertTrue("a chip rebuilds as a cap", adj.get("quick").asBoolean)
        // Plan and Power on the built deck: the used one lit; Control rebuilds with plan control.
        assertTrue("Plan and Power chips", seen("Midrange") && seen("Strong"))
        rule.onNodeWithText("Control").performScrollTo().performClick(); settle(20)
        val tune = fake.args[fake.calls.lastIndexOf("flowRetune")]
        assertEquals("plan", tune.get("field").asString); assertEquals("control", tune.get("value").asString)
        // Swap mode: the panel with its options.
        rule.onNodeWithContentDescription("Swap").performScrollTo().performClick(); settle(20)
        assertEquals("flowTap", fake.calls.last()); assertEquals("swap", fake.args.last().get("tap").asString)
        assertTrue("the Swap panel", seen("Artifact fixture 21") && seen("Keep"))
        assertTrue("Rebuild unlocked", seen("Rebuild unlocked"))
        rule.onNodeWithText("Artifact fixture 21").performScrollTo(); settle(5)
        shot("swap")
    }
}
