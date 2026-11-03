package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.ui.ArtPick
import dev.cardstashy.nativeplay.ui.ProfileArtPickerHost
import dev.cardstashy.nativeplay.ui.SettingsScreen
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Settings and the art picker in each state, on the Fold's cover screen (390 dp). Compare with parity/web/settings-*.jpg. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h860dp-xxhdpi")
class SettingsShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle() = repeat(40) { Thread.sleep(150); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "settings-$name.png").path)

    private val art = Account.Art("mtg", "x", "Ragavan, Nimble Pilferer", "https://cards.scryfall.io/art_crop/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg", 1.37, 1.4, .5, .4)

    private fun signedIn() = Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"),
        Account.Profile("ldwd11", null, "ldwd11", "Collector", art, art.copy(zoom = 1.0, y = .3)))

    @Test fun signedOut() {
        Account.setForTest(null, null)
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}) }
        rule.waitForIdle(); shot("signed-out-login")
        rule.onNodeWithText("Create account").performClick(); rule.waitForIdle(); shot("signed-out-signup")
    }

    @Test fun account() {
        signedIn()
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}) }
        rule.waitForIdle(); settle(); shot("account")
        rule.onNodeWithText("Edit profile").performClick(); rule.waitForIdle(); shot("account-edit")
    }

    @Test fun appearanceAndHelp() {
        signedIn()
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}) }
        rule.onNodeWithText("Appearance").performClick(); rule.waitForIdle(); shot("appearance")
        rule.onNodeWithText("Help").performClick(); rule.waitForIdle(); shot("help")
    }

    @Test fun picker() {
        signedIn()
        rule.setContent { ProfileArtPickerHost() }
        ArtPick.open("avatar"); rule.waitForIdle(); settle(); shot("picker-avatar")
        ArtPick.open("header"); rule.waitForIdle(); settle(); shot("picker-header")
        ArtPick.close()
    }
}
