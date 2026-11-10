package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.platform.testTag
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.StoryScene
import dev.cardstashy.nativeplay.ui.StoryTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The intro scene (talking heads) on act 1's first battle, landscape like the table. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-hdpi")
class StorySceneShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/story")

    @Test fun scene() {
        StoryTest.art = { url -> art.resolve(java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val data = JsonParser.parseString(javaClass.classLoader!!.getResource("story/act-1.json")!!.readText()).asJsonObject
        val b = data.getAsJsonArray("battles")[0].asJsonObject
        val lines = data.getAsJsonArray("intro").map { it.asJsonObject } + b.getAsJsonArray("scene").map { it.asJsonObject }
        rule.setContent { StoryScene(lines, data.getAsJsonObject("cast"), b.getAsJsonObject("hero")["who"].asString, b.getAsJsonObject("villain")["who"].asString, null, b["title"].asString) {} }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "story-scene-narrator.png").path)
    
        // Two taps on: the first spoken line, by the archers (the typewriter is instant in minimal motion).
        repeat(2) { rule.onRoot().performClick(); rule.waitForIdle() }
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "story-scene-villain.png").path)
    }

    /** W3: the scene on the Thor's two screens. The top keeps the portraits and the line; the bottom keeps the lines spoken so far. */
    @Test fun sceneDual() {
        StoryTest.art = { url -> art.resolve(java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.DualScreen.pretend(dev.cardstashy.nativeplay.ui.DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        try {
            org.robolectric.RuntimeEnvironment.setQualifiers("w960dp-h1080dp-xhdpi")
            val data = JsonParser.parseString(javaClass.classLoader!!.getResource("story/act-1.json")!!.readText()).asJsonObject
            val b = data.getAsJsonArray("battles")[0].asJsonObject
            val lines = data.getAsJsonArray("intro").map { it.asJsonObject } + b.getAsJsonArray("scene").map { it.asJsonObject }
            rule.setContent {
                androidx.compose.foundation.layout.Column(androidx.compose.ui.Modifier.fillMaxSize()) {
                    androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.fillMaxWidth().height(540.dp).testTag("top")) {
                        StoryScene(lines, data.getAsJsonObject("cast"), b.getAsJsonObject("hero")["who"].asString, b.getAsJsonObject("villain")["who"].asString, null, b["title"].asString) {} }
                    androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.width(620.dp).height(540.dp).testTag("bottom")) { dev.cardstashy.nativeplay.ui.BottomRoot() }
                }
            }
            rule.waitForIdle()
            repeat(3) { rule.onNodeWithTag("top").performClick(); rule.waitForIdle() }
            rule.onNodeWithTag("top").captureRoboImage(File(System.getProperty("shotsDir"), "w3/story-scene-top-1920x1080.png").path)
            rule.onNodeWithTag("bottom").captureRoboImage(File(System.getProperty("shotsDir"), "w3/story-scene-bottom-1240x1080.png").path)
        } finally { dev.cardstashy.nativeplay.ui.DualScreen.pretend(null) }
    }

    /** A cue bubble over the real table: the archers speak from the top, as the web docks them. */
    @Test fun bubble() {
        val data = JsonParser.parseString(javaClass.classLoader!!.getResource("story/act-1.json")!!.readText()).asJsonObject
        val b = data.getAsJsonArray("battles")[0].asJsonObject
        val st = dev.cardstashy.nativeplay.engine.MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val q = androidx.compose.runtime.mutableStateListOf(dev.cardstashy.nativeplay.play.StoryBubbles.Line(false, "archers", b.getAsJsonObject("cues").getAsJsonObject("villain")["start"].asString))
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            val anchors = androidx.compose.runtime.remember { dev.cardstashy.nativeplay.ui.Anchors() }
            androidx.compose.runtime.CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalAnchors provides anchors) {
                androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.fillMaxSize().background(dev.cardstashy.nativeplay.ui.Palette.Night)) {
                    dev.cardstashy.nativeplay.ui.PlaymatScene(androidx.compose.ui.Modifier.fillMaxSize())
                    dev.cardstashy.nativeplay.ui.ForgeBoard(st, live = true, intents = dev.cardstashy.nativeplay.ui.TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    dev.cardstashy.nativeplay.ui.StoryBubbleLayer(q, data.getAsJsonObject("cast"), null)
                }
            }
        }
        rule.mainClock.advanceTimeBy(600)
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "story-bubble.png").path)
    }
}
