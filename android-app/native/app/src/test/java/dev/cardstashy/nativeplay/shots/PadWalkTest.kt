package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.nativeKeyCode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.PadFocus
import dev.cardstashy.nativeplay.ui.PadPromptBar
import dev.cardstashy.nativeplay.ui.PadPrompts
import dev.cardstashy.nativeplay.ui.padRoot
import dev.cardstashy.nativeplay.account.Account
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * A handheld's walk through each screen (Randall 7 Nov: "full test on app one screen at a time"): the d-pad must move the gold
 * ring through the screen without sticking, and the prompt bar must say something for each stop. Landscape handheld size.
 */
@OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w853dp-h480dp-xhdpi")
class PadWalkTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }

    private fun label(): String = rule.onAllNodes(isFocused()).fetchSemanticsNodes().firstOrNull()?.let { n ->
        n.config.getOrNull(SemanticsProperties.ContentDescription)?.firstOrNull() ?: n.config.getOrNull(SemanticsProperties.Text)?.firstOrNull()?.text
            ?: n.children.firstNotNullOfOrNull { c -> c.config.getOrNull(SemanticsProperties.Text)?.firstOrNull()?.text } ?: "#${n.id}"
    } ?: "-"

    private fun walk(name: String, keys: List<Key> = List(14) { Key.DirectionDown } + List(6) { Key.DirectionRight }, min: Int = 5, content: @Composable () -> Unit) {
        Pad.used()
        rule.setContent {
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.foundation.LocalIndication provides PadFocus) {
                Box(Modifier.fillMaxSize().padRoot()) { content(); PadPromptBar() }
            }
        }
        settle()
        val seen = LinkedHashSet<String>(); val log = StringBuilder()
        keys.forEachIndexed { i, k ->
            // As MainActivity does: with nothing focused the press enters the screen, else it goes to Compose.
            var entered = false
            rule.runOnUiThread { entered = PadPrompts.navigate(k.nativeKeyCode) }
            if (!entered) rule.onRoot().performKeyInput { pressKey(k) }
            settle(3)
            val l = label(); seen += l
            log.append("  $i:${k.keyCode.toString(16)} ${l.take(40)} | ${PadPrompts.prompts().joinToString(" ") { "${it.first}=${it.second}" }}\n")
            if (i == 6) rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "padwalk-$name.png").path)
        }
        println("PADWALK $name stops=${seen.size}\n$log")
        assertTrue("$name: the ring reached only ${seen.size} stops: $seen", (seen - "-").size >= min)
    }

    @Test fun settings() {
        Account.setForTest(null, null)
        walk("settings") { dev.cardstashy.nativeplay.ui.SettingsScreen(onBack = {}, onWeb = {}) }
    }

    @Test fun playHome() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val f = File("/mnt/project-files/design/native/parity/fixtures/progress-state.json")
        assumeTrue(f.exists())
        val state = com.google.gson.JsonParser.parseString(f.readText()).asJsonObject
        val rules = dev.cardstashy.nativeplay.play.PlayRules(com.google.gson.JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        walk("play-home") {
            dev.cardstashy.nativeplay.ui.PlayHome(dev.cardstashy.nativeplay.ui.PlayHomeData(state, rules, dev.cardstashy.nativeplay.play.PlayMath.StoryHome(1, 0, false), "2026-11-03"),
                top = {}, nav = { dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.HOME, {}) })
        }
    }

    @Test fun collectionHome() {
        assumeTrue(File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js").isFile)
        dev.cardstashy.nativeplay.ui.Motion.still = true
        walk("collection-home") { dev.cardstashy.nativeplay.ui.CollectionHomeRoute(onPlay = {}, onProfile = {}, web = { _, _ -> }, open = {}) }
    }
}
