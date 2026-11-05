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

/**
 * A Yu-Gi-Oh! deck's Power tab after Load tournament decks and Simulate matchups (tcg.js A.tMetaRefresh and A.tMuRun, run in the
 * collection engine against the live tournament feed, 5 Nov 2026), kept as the panel the engine handed the app: Against the meta,
 * and the Matchups card's Strong against / Weak against rows with their win rates.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h1800dp-xxhdpi")
class TcgPowerMatchupsShotTest {
    @get:Rule val rule = createComposeRule()

    @Test fun yugiohSimulated() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val m = SitePanelModel.parse(JsonParser.parseString(javaClass.getResource("/tcg-power/ygo-simulated.json")!!.readText()).asJsonObject)
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Site.Bg).verticalScroll(rememberScrollState())) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 4.dp)) { SitePanel(m, SiteUi({}, { _, _ -> }, {}, 390.dp)) }
            }
        }
        rule.waitForIdle()
        for (t in listOf("Weak against", "Radiant Typhoon", "19%", "Simulated against 8 tournament decks"))
            assertTrue(t, rule.onAllNodesWithText(t, substring = true, ignoreCase = true).fetchSemanticsNodes().isNotEmpty())
        rule.onAllNodesWithText("Against the meta", ignoreCase = true).fetchSemanticsNodes()
        rule.onNode(hasText("Matchups", substring = false, ignoreCase = true)).performScrollTo(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tcg-power-ygo-matchups.png").path)
    }
}
