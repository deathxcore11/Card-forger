package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.RuleConfirm
import dev.cardstashy.nativeplay.ui.RuleMenu
import dev.cardstashy.nativeplay.ui.RuleRow
import dev.cardstashy.nativeplay.ui.RuleSheetHost
import dev.cardstashy.nativeplay.ui.Site
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The one sheet (rulebook R4/R5) as a Confirm and as a Menu, at 390 × 844. The words are the app's own. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class RuleSheetShotTest {
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "$name.png").path

    @Test fun confirmAndMenu() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers("w390dp-h844dp-xxhdpi")
        captureRoboImage(shot("rulesheet-confirm-390")) { Box(Modifier.fillMaxSize().background(Site.Bg)) {
            RuleConfirm("Your account’s cards and profile will be hidden. They’ll be here when you sign back in.", "Sign out", title = "Sign out?", onAction = {}, onCancel = {}); RuleSheetHost() } }
        captureRoboImage(shot("rulesheet-danger-390")) { Box(Modifier.fillMaxSize().background(Site.Bg)) {
            RuleConfirm("", "Delete", title = "Delete this Play deck?", onAction = {}, onCancel = {}, danger = true); RuleSheetHost() } }
        captureRoboImage(shot("rulesheet-menu-390")) { Box(Modifier.fillMaxSize().background(Site.Bg)) {
            RuleMenu("Sort", dev.cardstashy.nativeplay.play.Trunk.SORTS.mapIndexed { i, (_, l) -> RuleRow(l, on = i == 0) {} }) {}; RuleSheetHost() } }
        captureRoboImage(shot("rulesheet-playmat-390")) { Box(Modifier.fillMaxSize().background(Site.Bg)) {
            dev.cardstashy.nativeplay.ui.PlaymatPicker(startOpen = true); RuleSheetHost() } }
    }
}
