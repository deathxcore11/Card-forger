package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Site
import dev.cardstashy.nativeplay.ui.SitePanel
import dev.cardstashy.nativeplay.ui.SitePanelModel
import dev.cardstashy.nativeplay.ui.SiteUi
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The Rules page (rules.js rulesPage, written by CollectionEngineTest.rulesPage) drawn by SitePanel, as CollectionRulesRoute draws it. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h3200dp-xxhdpi")
class RulesPageShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    private fun shot(json: String, name: String, expect: List<String>) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val f = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home/$json")
        assumeTrue(f.exists())
        val m = SitePanelModel.parse(JsonParser.parseString(f.readText()).asJsonObject)
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Site.Bg)) {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp)) { SitePanel(m, SiteUi({}, { _, _ -> }, {}, 390.dp), padded = false) }
            }
        }
        rule.waitForIdle()
        for (t in expect) assertTrue(t, rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty())
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "$name.png").path)
    }

    @Test fun magic() = shot("rules-page-mtg.json", "rules-page-mtg", listOf("Magic rules", "Official documents"))
    @Test fun magicList() = shot("rules-page-mtg-list.json", "rules-page-mtg-list", listOf("Banned"))
    @Test fun yugioh() = shot("rules-page-ygo.json", "rules-page-ygo", listOf("Yu-Gi-Oh! rules"))
    @Test fun pokemon() = shot("rules-page-ptcg.json", "rules-page-ptcg", listOf("Pokémon rules"))
}
