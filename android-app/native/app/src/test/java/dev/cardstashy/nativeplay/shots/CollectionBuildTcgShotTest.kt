package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Density
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
 * Yu-Gi-Oh! and Pokémon's Build a deck (app.js A.randomDeckOptions on those games; tcg.js's build-around buttons through openDeckFlow),
 * built by the Collection engine. The models are what the engine's flowTcgCalls returned on live data (6 Nov, the flowprobe run):
 * a random card's setup, then the finished deck. Random deck rolls at once; openDeckFlow opens on its cards without rolling.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CollectionBuildTcgShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(50); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun json(path: String) = JsonParser.parseString(javaClass.classLoader!!.getResource(path)!!.readText()).asJsonObject
    private fun seen(text: String) = rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty()

    private class Fake(val setup: JsonObject, val result: JsonObject) : BuildFlowEngine {
        val calls = mutableListOf<String>()
        override val status = MutableStateFlow("")
        override suspend fun ready() = true
        override fun cancel() { calls += "cancel" }
        override suspend fun call(name: String, a: JsonObject): RandomBuild.Flow {
            calls += name
            return when (name) {
                "flowWorkspace" -> RandomBuild.Flow(com.google.gson.JsonPrimitive(true), null)
                "flowOpen", "flowRandom", "flowSetup" -> RandomBuild.Flow(setup, null)
                "flowGenerate" -> RandomBuild.Flow(JsonObject().apply { addProperty("ok", true); add("model", result) }, null)
                else -> RandomBuild.Flow(null, "unknown $name")
            }
        }
    }

    @After fun still() { dev.cardstashy.nativeplay.ui.Motion.still = false }

    private fun run(game: String, w: Int, h: Int, font: Float, act: String = "randomDeckOptions") {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val fake = Fake(json("build-deck/tcg-$game-setup.json"), json("build-deck/tcg-$game-result.json"))
        val open = CollectionWrites.BuildOpen(JsonObject().apply { addProperty("game", game) }, act, { _, _ -> })
        rule.setContent {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, font)) {
                CollectionBuildDeckSheet(open, null, onClose = {}, engine = fake, workspace = { "{}" }, save = { _, _ -> true })
            }
        }
        settle(30)
        val tag = "$game-${w}x$h-${(font * 100).toInt()}"
        // A.randomDeckOptions rolls a card at once; openDeckFlow (the build-around buttons) does not.
        if (act == "openDeckFlow") assertEquals(listOf("flowWorkspace", "flowOpen"), fake.calls.take(3))
        else assertEquals(listOf("flowWorkspace", "flowOpen", "flowRandom"), fake.calls.take(3))
        val seed = fake.setup.getAsJsonObject("seed")["name"].asString
        assertTrue("the card", seen(seed))
        assertTrue(if (game == "ygo") "Archetype" else "Theme", seen(if (game == "ygo") "Archetype" else "Theme"))
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-build-tcg-setup-$tag.png").path)
        rule.onNodeWithText("Generate deck").performScrollTo().performClick(); settle(30)
        assertTrue("the result", seen("Save deck") && seen("Main deck"))
        if (game == "ygo") assertTrue("Extra Deck", seen("Extra Deck"))
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-build-tcg-result-$tag.png").path)
    }

    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ygo390() = run("ygo", 390, 844, 1f)
    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ptcg390() = run("ptcg", 390, 844, 1f)
    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ygoSeeded390() = run("ygo", 390, 844, 1f, "openDeckFlow")
    @Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi") @Test fun ygo360big() = run("ygo", 360, 780, 1.3f)
    @Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi") @Test fun ptcg360big() = run("ptcg", 360, 780, 1.3f)
    @Config(sdk = [35], qualifiers = "w954dp-h860dp-xxhdpi") @Test fun ptcg954() = run("ptcg", 954, 860, 1f)
    @Config(sdk = [35], qualifiers = "w1024dp-h768dp-xhdpi") @Test fun ygo1024() = run("ygo", 1024, 768, 1f)
    @Config(sdk = [35], qualifiers = "w844dp-h390dp-xxhdpi") @Test fun ptcg844() = run("ptcg", 844, 390, 1f)
}
