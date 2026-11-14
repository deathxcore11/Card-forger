package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.collection.WorkspaceSync
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

/**
 * Settings (the Console look, Randall's pick of 14 Nov) and the art picker in each state, on the Fold's cover screen (390 dp).
 * ConsoleShotTest draws the same screen at a phone, the Fold and the Thor.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h860dp-xxhdpi")
class SettingsShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle() = repeat(40) { Thread.sleep(150); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    /** A section's name in the strip under the title. */
    private fun section(name: String) = rule.onNode(hasContentDescription(name) and isSelectable())
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "settings-$name.png").path)

    private val art = Account.Art("mtg", "x", "Ragavan, Nimble Pilferer", "https://cards.scryfall.io/art_crop/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg", 1.37, 1.4, .5, .4)

    private fun signedIn() = Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"),
        Account.Profile("ldwd11", null, "ldwd11", "Collector", art, art.copy(zoom = 1.0, y = .3)))

    @Test fun signedOut() {
        Account.setForTest(null, null)
        // Gap audit S3: Google sign-in is on at the account service, so Continue with Google shows.
        dev.cardstashy.nativeplay.account.Http.fake = { _, u, _ -> if (u.endsWith("/auth/v1/settings")) com.google.gson.JsonParser.parseString("{\"external\":{\"google\":true}}") else null }
        try { signedOutShots() } finally { dev.cardstashy.nativeplay.account.Http.fake = null }
    }
    private fun signedOutShots() {
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}) }
        rule.waitForIdle(); settle(); shot("signed-out-login")
        rule.onNodeWithText("Continue with Google").assertExists(); rule.onNodeWithText("Email me a sign-in link instead").assertExists()
        rule.onNodeWithText("Create account").performClick(); rule.waitForIdle(); shot("signed-out-signup")
    }

    @Test fun account() {
        signedIn()
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}) }
        rule.waitForIdle(); settle(); shot("account")
        rule.onNodeWithText("Edit profile").performClick(); rule.waitForIdle(); shot("account-edit")
    }

    // views.js syncDecideSheet's case, as decide.cjs renders it on the live site: this device has a third card and a wish; the
    // account (older, from Chrome) a second deck.
    private val local = """{"collection":[{"id":"l1","name":"Card 1","qty":4},{"id":"l2","name":"Card 2","qty":1},{"id":"l3","name":"Card 3","qty":2}],"decks":[{"id":"d1"}],"wishlist":[{"name":"Sol Ring"}],"lastSavedAt":"2026-11-05T13:20:00Z"}"""
    private val cloud = """{"collection":[{"id":"l1","name":"Card 1","qty":4},{"id":"l2","name":"Card 2","qty":1}],"decks":[{"id":"d1"},{"id":"d2"}],"wishlist":[],"lastSavedAt":"2026-11-04T21:05:00Z"}"""
    private fun deciding() {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("America/New_York"))
        signedIn()
        dev.cardstashy.nativeplay.account.Decks.deviceFile(org.robolectric.RuntimeEnvironment.getApplication(), "u").writeText(local)
        val row = WorkspaceSync.Row(3, cloud, "2026-11-04T21:05:00Z", "Chrome · 11/4/2026")
        WorkspaceSync.rows = object : WorkspaceSync.Rows {
            override suspend fun read(userId: String) = row
            override suspend fun write(userId: String, revision: Long, data: String): Long? = null
        }
        WorkspaceSync.setForTest(WorkspaceSync.Status(WorkspaceSync.State.ERROR, "Sync paused until you choose which copy to keep."), WorkspaceSync.Pending("u", row.copy(updatedAt = null, device = null)))
    }
    private fun undecide() { WorkspaceSync.reset(); WorkspaceSync.rows = WorkspaceSync.AccountRows; dev.cardstashy.nativeplay.ui.CollectionWrites.deciding.value = false }
    private val withHost = @androidx.compose.runtime.Composable {
        androidx.compose.foundation.layout.Box { SettingsScreen(onBack = {}, onWeb = {}); dev.cardstashy.nativeplay.ui.CollectionWritesHost() }
    }

    /** accountPanel's sync line (Synced · when), then the paused sync's words and "Choose which copy to keep", then its sheet. */
    @Test fun accountSync() {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("America/New_York"))
        signedIn()
        WorkspaceSync.setForTest(WorkspaceSync.Status(WorkspaceSync.State.SYNCED, at = java.time.Instant.parse("2026-11-05T13:41:00Z").toEpochMilli()), null)
        try {
            rule.setContent { withHost() }
            settle(); shot("account-synced")
            deciding(); rule.waitForIdle(); settle(); shot("account-decide")
            // The line, and the panel that explains it, both carry its name.
            rule.onAllNodesWithText("Choose which copy to keep").onFirst().performClick(); rule.waitForIdle(); settle(); shot("sync-decide-390")
        } finally { undecide() }
    }

    @Config(qualifiers = "w884dp-h1104dp-xxhdpi")
    @Test fun syncDecideUnfolded() {
        deciding()
        try {
            rule.setContent { withHost() }
            settle(); dev.cardstashy.nativeplay.ui.CollectionWrites.deciding.value = true; rule.waitForIdle(); settle(); shot("sync-decide-884")
        } finally { undecide() }
    }

    /** Each of the six sections opens from the strip, and every one of them draws. */
    @Test fun sections() {
        signedIn()
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}) }
        for (t in listOf("Gameplay", "Sound", "Display", "Account", "Data", "Help")) { section(t).performClick(); rule.waitForIdle(); shot("section-${t.lowercase()}") }
        rule.onNodeWithText("Guides", useUnmergedTree = true).assertDoesNotExist(); rule.onNodeWithText("GUIDES", useUnmergedTree = true).assertExists()
    }

    /** Butter pass B3 (Randall 14 Nov), kept through the Console look: on a 360 dp phone all six sections are on screen with no sideways
     *  scroll, Help is one short list, and What's new opens on the newest notes with the history closed behind "Older releases". */
    @Config(qualifiers = "w360dp-h800dp-xxhdpi")
    @Test fun tabsFitAndHelpIsShort() {
        signedIn()
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}, startTab = "info") }
        rule.waitForIdle()
        val screen = rule.onRoot().fetchSemanticsNode().boundsInRoot
        for (t in listOf("Gameplay", "Sound", "Display", "Account", "Data", "Help")) {
            val b = section(t).fetchSemanticsNode().boundsInRoot
            org.junit.Assert.assertTrue("$t at $b is off the screen $screen", b.left >= screen.left && b.right <= screen.right)
            org.junit.Assert.assertTrue("$t is ${b.height} px tall: too small for a finger", b.height >= 44 * 3 - 1)
        }
        // The whole of Help's first group is on the first screen.
        val news = rule.onAllNodesWithText("What\u2019s new", useUnmergedTree = true).fetchSemanticsNodes().first().boundsInRoot
        org.junit.Assert.assertTrue("What's new sits at ${news.top}", news.bottom < screen.bottom)
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "butter/settings-help-360.png").path)
        rule.onAllNodesWithText("What\u2019s new").onFirst().performClick(); rule.waitForIdle()
        val older = rule.onAllNodesWithText("Older releases", substring = true, useUnmergedTree = true).fetchSemanticsNodes()
        org.junit.Assert.assertEquals(1, older.size)
        org.junit.Assert.assertTrue("Older releases sits at ${older[0].boundsInRoot.top}", older[0].boundsInRoot.top < screen.bottom * 1.6f)
        org.junit.Assert.assertEquals(0, rule.onAllNodesWithText(dev.cardstashy.nativeplay.ui.WHATS_NEW.last().second, substring = true, useUnmergedTree = true).fetchSemanticsNodes().size)
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "butter/settings-whats-new-360.png").path)
    }

    /** Gap audit S1: Data, with an Earlier save on this device (tall enough for all of it). The save opens its own page. */
    @Config(qualifiers = "w390dp-h1900dp-xxhdpi")
    @Test fun backup() {
        signedIn()
        val c = org.robolectric.RuntimeEnvironment.getApplication()
        c.filesDir.listFiles()?.filter { it.name.startsWith("recovery") }?.forEach { it.delete() }
        dev.cardstashy.nativeplay.collection.RecoveryJournal.append(c, "u",
            """{"collection":[{"id":"l1","name":"Lightning Bolt","qty":4}],"decks":[{"id":"d1","name":"Burn","cards":[]}],"wishlist":[]}""",
            "Before workspace replacement", "restore", java.time.Instant.parse("2026-11-12T23:02:00Z"))
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}, startTab = "recovery") }
        rule.waitForIdle(); settle(); shot("backup")
        for (t in listOf("Restore backup", "Check a backup file", "EARLIER SAVES", "Saved on this device", "Before workspace replacement", "STORAGE", "Saved card art", "Remove downloaded pictures"))
            rule.onNodeWithText(t).assertExists()
        // Download backup is the line the panel is on, so its name shows twice.
        org.junit.Assert.assertEquals(2, rule.onAllNodesWithText("Download backup").fetchSemanticsNodes().size)
        rule.onNodeWithText("1 copy", substring = true).assertExists()
        rule.onNodeWithText("Before workspace replacement").performClick(); rule.waitForIdle(); shot("backup-save")
        for (t in listOf("4 cards · 1 deck · All games", "Download", "Restore…", "Back")) rule.onNodeWithText(t).assertExists()
    }

    /** settings-theme.js / grid-settings.js: Display in each colour mode. */
    @Test fun appearanceThemes() {
        signedIn()
        rule.setContent { SettingsScreen(onBack = {}, onWeb = {}, startTab = "app") }
        try { for (t in listOf("dark", "light", "aura")) { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme(t); rule.waitForIdle(); shot("appearance-$t") } }
        finally { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("dark") }
    }

    @Test fun holdMenus() {
        val img = "https://cards.scryfall.io/normal/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg"
        rule.setContent { dev.cardstashy.nativeplay.ui.PlayCardHold(dev.cardstashy.nativeplay.ui.CardHold(dev.cardstashy.nativeplay.ui.CardPick("Ragavan, Nimble Pilferer", "o", "p", "foil"), img, "mh2", true), {}, {}, {}, {}, {}) }
        settle(); shot("hold-play-card")
    }

    @Test fun picker() {
        signedIn()
        rule.setContent { ProfileArtPickerHost() }
        ArtPick.open("avatar"); rule.waitForIdle(); settle(); shot("picker-avatar")
        ArtPick.open("header"); rule.waitForIdle(); settle(); shot("picker-header")
        ArtPick.close()
    }
}
