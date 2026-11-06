package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Site
import dev.cardstashy.nativeplay.ui.SiteGlass
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

/**
 * A card page's rule word tapped: the glass Collection.ruleGlass hands the app (rule-dex.js showRuleHint for Flying on Serra Angel,
 * written by CollectionEngineTest.ruleGlass), drawn by SiteGlass as the card hosts draw it.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class RuleGlassShotTest {
    @get:Rule val rule = createComposeRule()

    @Test fun flying() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val f = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home/rule-glass-flying.json")
        assumeTrue(f.exists())
        val m = SitePanelModel.parse(JsonParser.parseString(f.readText()).asJsonObject)
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Site.Bg)) { SiteGlass(m, SiteUi({}, { _, _ -> }, {}, 390.dp), null) {} }
        }
        rule.waitForIdle()
        for (t in listOf("Flying", "Serra Angel")) assertTrue(t, rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty())
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "rule-glass-flying.png").path)
    }
}
