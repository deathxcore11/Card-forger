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
import dev.cardstashy.nativeplay.ui.StoryDuelPage
import dev.cardstashy.nativeplay.ui.StoryDuelUi
import dev.cardstashy.nativeplay.ui.StoryOwnDeck
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
@Config(sdk = [35], qualifiers = "w390dp-h2300dp-xxhdpi")
class StoryTallShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/story")
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "story-$name.png").path)
    @Test fun duel() {
        StoryTest.art = { url -> art.resolve(java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) } + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val rules = PlayRules.load(org.robolectric.RuntimeEnvironment.getApplication())
        val data = JsonParser.parseString(javaClass.classLoader!!.getResource("story/act-1.json")!!.readText()).asJsonObject
        val battles = data.getAsJsonArray("battles").map { it.asJsonObject }
        val own = listOf(StoryOwnDeck("d1", "Mono Red Burn", "https://cards.scryfall.io/art_crop/front/f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg", 60, StoryLogic.Fit(true, "")),
            StoryOwnDeck("d2", "Modern Tron", null, 60, StoryLogic.Fit(false, "9 cards are from outside this act, like Karn Liberated.")))
        val pageState = androidx.compose.runtime.mutableStateOf<@androidx.compose.runtime.Composable () -> Unit>({})
        rule.setContent { pageState.value() }
        fun show(name: String, c: @androidx.compose.runtime.Composable () -> Unit) { pageState.value = c; rule.waitForIdle(); shot(name) }
        show("duel-tall") { StoryDuelPage(1, data, battles[1], StoryLogic.fromRefs(listOf("story:a1b2:loaner", "story:a1b2:own")), rules.setNames, null, own, StoryDuelUi("d1", "villain", listOpen = true, listSide = "theirs"), {}, {}, { _, _ -> }) }
        show("duel-tall-bad") { StoryDuelPage(1, data, battles[2], StoryLogic.fromRefs(emptyList()), rules.setNames, null, own, StoryDuelUi("loaner"), {}, {}, { _, _ -> }) }
    }
}
