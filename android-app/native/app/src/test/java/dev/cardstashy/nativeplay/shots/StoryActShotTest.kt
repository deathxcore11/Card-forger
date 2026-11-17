package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.onFirst
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.StoryLogic
import dev.cardstashy.nativeplay.ui.StoryActPage
import dev.cardstashy.nativeplay.ui.StoryDuelPage
import dev.cardstashy.nativeplay.ui.StoryDuelUi
import dev.cardstashy.nativeplay.ui.StoryTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Story act page, second take (specs/story-act-and-collection-brief.md): each battle shows what it offers now. Pictures at true
 * screen size per device, and "Play as" lands on the battle page with their side chosen.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class StoryActShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/story")
    private val rules get() = PlayRules.load(RuntimeEnvironment.getApplication())
    private val data get() = JsonParser.parseString(javaClass.classLoader!!.getResource("story/act-1.json")!!.readText()).asJsonObject
    private fun refs(vararg r: String) = StoryLogic.fromRefs(r.toList())
    /** Three won: the first with both sides, the next two with their side still open. */
    private val three get() = refs("story:a1b1:loaner", "story:a1b1:villain", "story:a1b2:loaner", "story:a1b3:loaner")

    private fun pics() { StoryTest.art = { url -> art.resolve(java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } } }

    /** A won battle whose other side is open has "Play as"; one press hands its id to the route, which opens the villain seat. */
    @Test fun playAsOpensTheirSide() {
        pics()
        var played: String? = null; var opened: String? = null
        val d = data; val r = rules
        rule.setContent { StoryActPage(r.acts[0], d, three, {}, { opened = it }, setNames = r.setNames) { played = it } }
        rule.onNodeWithContentDescription("Play as Goblin King").performScrollTo().performClick()
        assertEquals("a1b2", played); assertEquals(null, opened)
        // Both sides won: no "Play as", a Replay instead.
        assertEquals(0, rule.onAllNodes(androidx.compose.ui.test.hasContentDescription("Play as Elvish Archer")).fetchSemanticsNodes().size)
        rule.onNodeWithText("Both sides won").assertIsDisplayed()
    }

    /** The battle page opened with seat = "villain" (what StoryRoute does for "Play as") plays their side. */
    @Test fun villainSeatPlaysTheirSide() {
        pics()
        val d = data; val r = rules; val b = d.getAsJsonArray("battles")[1].asJsonObject
        var seat: String? = null
        rule.setContent { StoryDuelPage(1, d, b, three, r.setNames, null, emptyList(), StoryDuelUi(seat = "villain"), {}, {}, { s, _ -> seat = s }) }
        rule.onAllNodes(androidx.compose.ui.test.hasText("Goblin King")).onFirst().assertExists()
        rule.onAllNodes(androidx.compose.ui.test.hasText("Replay")).onFirst().performScrollTo().performClick()
        assertEquals("villain", seat)
    }

    private fun shot(name: String, q: String, c: @androidx.compose.runtime.Composable () -> Unit) {
        RuntimeEnvironment.setQualifiers(q)
        captureRoboImage(File(System.getProperty("shotsDir"), "story-act-$name.png").path) { Box(Modifier.fillMaxSize()) { c() } }
    }

    @Test fun actPages() {
        pics()
        val d = data; val r = rules
        val fresh = StoryLogic.fromRefs(emptyList())
        val late = StoryLogic.fromRefs((1..6).map { "story:a1b$it:loaner" } + "story:a1b2:villain")
        shot("phone-390x844", "w390dp-h844dp-xxhdpi") { StoryActPage(r.acts[0], d, three, {}, {}, setNames = r.setNames) }
        shot("phone-390x844-130", "w390dp-h844dp-xxhdpi") {
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(androidx.compose.ui.platform.LocalDensity.current.density, 1.3f)) {
                StoryActPage(r.acts[0], d, three, {}, {}, setNames = r.setNames) } }
        shot("foldshut-374x832-new", "w374dp-h832dp-xxhdpi") { StoryActPage(r.acts[0], d, fresh, {}, {}, setNames = r.setNames) }
        shot("foldopen-841x701", "w841dp-h701dp-xhdpi") { StoryActPage(r.acts[0], d, three, {}, {}, setNames = r.setNames) }
        shot("tablet-1280x800-late", "w1280dp-h800dp-mdpi") { StoryActPage(r.acts[0], d, late, {}, {}, setNames = r.setNames) }
        shot("thor-top-960x540", "w960dp-h540dp-land-xhdpi") { StoryActPage(r.acts[0], d, three, {}, {}, setNames = r.setNames) }
    }
}
