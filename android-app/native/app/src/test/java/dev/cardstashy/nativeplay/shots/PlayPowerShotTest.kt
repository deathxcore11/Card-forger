package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Site
import dev.cardstashy.nativeplay.ui.SitePanel
import dev.cardstashy.nativeplay.ui.SitePanelModel
import dev.cardstashy.nativeplay.ui.SiteUi
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** A Play deck's Power tab (CollectionEngineTest.playPower): the Collection's Power view, Play-safe, without Upgrades or prices. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h2600dp-xxhdpi")
class PlayPowerShotTest {
    @get:Rule val rule = createComposeRule()

    @Test fun playDeck() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication())
        val m = SitePanelModel.parse(JsonParser.parseString(File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home/play-power.json").also { org.junit.Assume.assumeTrue(it.exists()) }.readText()).asJsonObject)
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Site.Bg).verticalScroll(rememberScrollState())) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 4.dp)) { SitePanel(m, SiteUi({}, { _, _ -> }, {}, 390.dp)) }
            }
        }
        rule.waitForIdle()
        for (t in listOf("Deck Power", "Matchups")) assertTrue(t, rule.onAllNodesWithText(t, substring = true, ignoreCase = true).fetchSemanticsNodes().isNotEmpty())
        assertTrue(rule.onAllNodesWithText("Upgrades").fetchSemanticsNodes().isEmpty())
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "play-power-tab.png").path)
    }
}
