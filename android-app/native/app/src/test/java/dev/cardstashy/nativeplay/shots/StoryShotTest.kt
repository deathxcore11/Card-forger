package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.StoryLogic
import dev.cardstashy.nativeplay.ui.StoryActPage
import dev.cardstashy.nativeplay.ui.StoryRoad
import dev.cardstashy.nativeplay.ui.StoryTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Story road and act page on act-1's real data (site /data/story/act-1.json), at the Fold's cover width. Compare with parity/web/story-*. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h860dp-xxhdpi")
class StoryShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/story")
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "story-$name.png").path)
    private fun refs(vararg r: String) = StoryLogic.fromRefs(r.toList())

    @Test fun pages() {
        StoryTest.art = { url -> art.resolve(java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val rules = PlayRules.load(org.robolectric.RuntimeEnvironment.getApplication())
        val data = JsonParser.parseString(javaClass.classLoader!!.getResource("story/act-1.json")!!.readText()).asJsonObject
        val mid = refs("story:a1b1:loaner", "story:a1b1:own", "story:a1b2:loaner", "story:a1b3:own")
        val pageState = androidx.compose.runtime.mutableStateOf<@androidx.compose.runtime.Composable () -> Unit>({})
        rule.setContent { pageState.value() }
        fun show(name: String, c: @androidx.compose.runtime.Composable () -> Unit) { pageState.value = c; rule.waitForIdle(); shot(name) }
        show("road-new") { StoryRoad(rules.acts, rules.ages[1] ?: "", StoryLogic.fromRefs(emptyList()), {}, {}) }
        show("road-mid") { StoryRoad(rules.acts, rules.ages[1] ?: "", mid, {}, {}) }
        val done = StoryLogic.fromRefs((1..8).map { "story:a1b$it:loaner" } + "story:act1:era")
        show("road-act1-done") { StoryRoad(rules.acts, rules.ages[1] ?: "", done, {}, {}) }
        val deep = StoryLogic.fromRefs((1..22).map { "story:act$it:era" })
        show("road-act23") { StoryRoad(rules.acts, rules.ages[1] ?: "", deep, {}, {}) }
        show("act-mid") { StoryActPage(rules.acts[0], data, mid, {}, {}) }
        val late = StoryLogic.fromRefs((1..7).map { "story:a1b$it:loaner" })
        show("act-boss") { StoryActPage(rules.acts[0], data, late, {}, {}) }
    }
}
