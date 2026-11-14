package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.BottomRoot
import dev.cardstashy.nativeplay.ui.CONSOLE_ABOUT_MAX
import dev.cardstashy.nativeplay.ui.CommunityLayerState
import dev.cardstashy.nativeplay.ui.ConsoleCtl
import dev.cardstashy.nativeplay.ui.ConsoleItem
import dev.cardstashy.nativeplay.ui.ConsoleRow
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.SettingsScreen
import dev.cardstashy.nativeplay.ui.accountSection
import dev.cardstashy.nativeplay.ui.dataSection
import dev.cardstashy.nativeplay.ui.displayItems
import dev.cardstashy.nativeplay.ui.gameplayItems
import dev.cardstashy.nativeplay.ui.helpSection
import dev.cardstashy.nativeplay.ui.rows
import dev.cardstashy.nativeplay.ui.soundItems
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Console Settings (Randall's pick of 14 Nov 2026) at the three shapes he plays on: a phone (390 x 844), the Fold open (884 x 796) and
 * the Thor (top 960 x 540, bottom 620 x 540). On a phone the panel is the strip under the list, on the Fold it stands at the right,
 * on the Thor it is the bottom screen. And the rules of a line: each has its own id, a name, and words short enough for the strip.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class ConsoleShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "console/$name.png").path
    private val art = Account.Art("mtg", "x", "Ragavan, Nimble Pilferer", "https://cards.scryfall.io/art_crop/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg", 1.37, 1.4, .5, .4)
    private fun signedIn() = Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"),
        Account.Profile("ldwd11", null, "ldwd11", "Collector", art, art.copy(zoom = 1.0, y = .3)))

    @After fun off() { DualScreen.pretend(null); dev.cardstashy.nativeplay.ui.Motion.still = false; Account.setForTest(null, null) }

    /** The line each section's picture stands on. */
    private val pages = listOf("gameplay" to "tfx", "sound" to "music", "display" to "theme", "account" to "presence", "data" to "export", "help" to "version")

    @Test fun settingsAtEachSize() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        signedIn()
        for ((size, q) in listOf("phone-390x844" to "w390dp-h844dp-xxhdpi", "fold-884x796" to "w884dp-h796dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            for ((tab, line) in pages) captureRoboImage(shot("settings-$tab-$size")) { SettingsScreen(onBack = {}, onWeb = {}, startTab = tab, startLine = line) }
        }
        // The Thor: the top screen is all list, the bottom screen is the panel.
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        for ((tab, line) in pages) {
            RuntimeEnvironment.setQualifiers("w960dp-h540dp-land-xhdpi")
            val both: @androidx.compose.runtime.Composable (Boolean) -> Unit = { top ->
                // One composition holds the screen and its bottom view; the picture is of the one asked for.
                Box(Modifier.fillMaxSize()) { if (top) SettingsScreen(onBack = {}, onWeb = {}, startTab = tab, startLine = line) else { Box(Modifier.fillMaxSize()) { SettingsBoth(tab, line) } } }
            }
            captureRoboImage(shot("settings-$tab-thor-top-960x540")) { both(true) }
            RuntimeEnvironment.setQualifiers("w620dp-h540dp-xhdpi")
            captureRoboImage(shot("settings-$tab-thor-bottom-620x540")) { both(false) }
        }
    }

    /** The bottom screen as the Thor draws it while Settings is up: Settings composes (unseen) and BottomRoot shows its view. */
    @androidx.compose.runtime.Composable
    private fun SettingsBoth(tab: String, line: String) {
        Box(Modifier.fillMaxSize()) {
            androidx.compose.ui.layout.Layout({ SettingsScreen(onBack = {}, onWeb = {}, startTab = tab, startLine = line) }) { m, c -> m.forEach { it.measure(c) }; layout(c.maxWidth, c.maxHeight) {} }
            BottomRoot()
        }
    }

    private fun check(section: String, rows: List<ConsoleRow>) {
        assertTrue("$section has lines", rows.isNotEmpty())
        assertEquals("$section: every line has its own id", rows.size, rows.map { it.id }.toSet().size)
        for (r in rows) {
            assertTrue("$section/${r.id} has a name", r.title.isNotBlank())
            assertTrue("$section/${r.id}: ${r.about.length} characters is more than the phone's strip shows ($CONSOLE_ABOUT_MAX): ${r.about}", r.about.length <= CONSOLE_ABOUT_MAX)
            r.status?.let { (words, _) -> assertTrue("$section/${r.id} news", words.isNotBlank()) }
        }
    }

    /** Every line of every section: its own id, a name, and words the strip on a phone can show whole. In each value of a choice too. */
    @Test fun everyLineExplainsItself() {
        val before = Triple(AppSettings.effects, AppSettings.matchEffects, AppSettings.chosenTheme)
        try {
            for (e in AppSettings.EFFECTS) for (m in dev.cardstashy.nativeplay.ui.TableFeel.MODES) {
                AppSettings.applyEffects(e); AppSettings.applyMatchEffects(m)
                check("gameplay $e $m", gameplayItems().rows())
            }
        } finally { AppSettings.applyEffects(before.first); AppSettings.applyMatchEffects(before.second) }
        check("sound", soundItems {}.rows())
        check("display", displayItems(touch = true, pad = false).rows()); check("display with a controller", displayItems(touch = true, pad = true).rows())
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f)); check("display on two screens", displayItems(touch = true, pad = true).rows()); DualScreen.pretend(null)
        // The sections that read the account, this device's saves and the app's version.
        val c = RuntimeEnvironment.getApplication()
        c.filesDir.listFiles()?.filter { it.name.startsWith("recovery") }?.forEach { it.delete() }
        dev.cardstashy.nativeplay.collection.RecoveryJournal.append(c, "u",
            """{"collection":[{"id":"l1","name":"Lightning Bolt","qty":4}],"decks":[{"id":"d1","name":"Burn","cards":[]}],"wishlist":[]}""",
            "Before loading the account version from another device", "restore", java.time.Instant.parse("2026-11-12T23:02:00Z"))
        for (signed in listOf(false, true)) {
            if (signed) signedIn() else Account.setForTest(null, null)
            val seen = mutableStateOf<Map<String, List<ConsoleItem>>>(emptyMap())
            captureRoboImage(shot("lines-${if (signed) "signed-in" else "signed-out"}")) {
                val layer = androidx.compose.runtime.remember { CommunityLayerState() }
                val account = accountSection(null, {}, {}, layer).items; val data = dataSection(null) {}.items; val help = helpSection(null, {}, {}).items
                androidx.compose.runtime.SideEffect { seen.value = mapOf("account" to account, "data" to data, "help" to help) }
                Box(Modifier.fillMaxSize())
            }
            Thread.sleep(400)
            assertEquals(setOf("account", "data", "help"), seen.value.keys)
            for ((name, items) in seen.value) if (name != "account" || signed) check("$name signed ${if (signed) "in" else "out"}", items.rows())
        }
    }

    /** A line's press and its left and right, as the controller and the finger give them. */
    @Test fun aLineSteps() {
        var on = false; var word = "balanced"; var level = 100
        fun row(c: ConsoleCtl) = ConsoleRow("x", "X", "x", c)
        row(ConsoleCtl.Switch(on) { on = it }).press(); assertTrue(on)
        row(ConsoleCtl.Switch(on) { on = it }).step(-1); assertTrue(!on)
        val words = listOf("cinematic", "balanced", "minimal")
        row(ConsoleCtl.Choice(words, word) { word = it }).press(); assertEquals("minimal", word)
        row(ConsoleCtl.Choice(words, word) { word = it }).press(); assertEquals("a choice goes round", "cinematic", word)
        row(ConsoleCtl.Choice(words, word) { word = it }).step(-1); assertEquals("minimal", word)
        assertFalse("no tick at a level's top", row(ConsoleCtl.Level(level) { level = it }).step(1)); assertEquals("a level stops at its top", 100, level)
        assertTrue(row(ConsoleCtl.Level(level) { level = it }).step(-1)); assertEquals(90, level)
        assertFalse(row(ConsoleCtl.Level(level) { level = it }).press()); assertEquals("a press never jumps a volume", 90, level)
        level = 0
        assertFalse(row(ConsoleCtl.Level(level) { level = it }).step(-1)); assertEquals("a level stops at zero", 0, level)
        row(ConsoleCtl.Level(40, enabled = false) { level = it }).step(1); assertEquals("a level that is off does not move", 0, level)
        assertEquals("Balanced", row(ConsoleCtl.Choice(words, "balanced") {}).valueText()); assertEquals("40%", row(ConsoleCtl.Level(40) {}).valueText())
    }
}
