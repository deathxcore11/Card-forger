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
import dev.cardstashy.nativeplay.ui.scanLive
import dev.cardstashy.nativeplay.ui.scanGrid
import dev.cardstashy.nativeplay.ui.sheetBody
import dev.cardstashy.nativeplay.ui.SiteSheetBody
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The Scan page (scancam.js scanView, written by CollectionEngineTest.scanPage) drawn by SitePanel, as CollectionScanRoute draws it. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class ScanPageShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    private fun shot(json: String, name: String, expect: List<String>) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val f = File(System.getProperty("repoRoot"), "android-app/native/app/build/shot-art/home/$json")
        assumeTrue(f.exists())
        val m = SitePanelModel.parse(JsonParser.parseString(f.readText()).asJsonObject)
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Site.Bg)) {
                val ui = SiteUi({}, { _, _ -> }, {}, 390.dp)
                // As CollectionScanRoute: camera on, the page fills the screen over the nav; off, it scrolls with the page's own 16 edges.
                val sheet = m.sheetBody
                if (sheet != null) Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).background(Site.Surface).padding(16.dp)) { SiteSheetBody(sheet, ui) }
                else if (m.scanLive() || m.scanGrid()) Box(Modifier.fillMaxSize().padding(horizontal = if (m.scanGrid()) 16.dp else 0.dp)) { SitePanel(m, ui, Modifier.fillMaxSize(), padded = false) }
                else Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 10.dp)) { SitePanel(m, ui, padded = false) }
            }
        }
        rule.waitForIdle()
        for (t in expect) assertTrue(t, rule.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty())
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "$name.png").path)
    }

    @Test fun start() = shot("scan-start.json", "scan-start", listOf("Ready for your next find."))
    @Test fun camera() = shot("scan-camera.json", "scan-camera", listOf("Show one whole card"))
    @Test fun photo() = shot("scan-photo.json", "scan-photo", listOf("Take photo"))
    @Test fun review() = shot("scan-review.json", "scan-review", listOf("Lightning Bolt", "Add to collection"))
    @Test fun settings() = shot("scan-settings.json", "scan-settings", listOf("Scanner settings", "Capture automatically"))
    @Test fun grid() = shot("scan-grid.json", "scan-grid", listOf("Your scans"))
    // The site's scanner itself in a real browser (scratchpad e2e: camera frames of Murktide Regent read by its text reader), each step's page.
    @Test fun webLive() = shot("scanweb-live.json", "scanweb-live", listOf("Saved. Hold steady"))
    @Test fun webGrid() = shot("scanweb-grid.json", "scanweb-grid", listOf("Your scans", "Murktide Regent", "Fix 1"))
    @Test fun webFix() = shot("scanweb-review.json", "scanweb-fix", listOf("Fix card", "7 matching printings", "1 / 7", "Remove"))
    @Test fun webFixPicked() = shot("scanweb-review2.json", "scanweb-fix2", listOf("Fix card", "Save"))
    @Test fun webReady() = shot("scanweb-grid2.json", "scanweb-ready", listOf("Add 1 to Collection"))
}
