package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.ui.AchievementsRoute
import dev.cardstashy.nativeplay.ui.PlayNav
import dev.cardstashy.nativeplay.ui.PlayTab
import org.junit.Rule
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.onNodeWithTag
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import androidx.compose.ui.Modifier
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp

/** The Achievements page with the quest books, on the Fold's cover screen; the page is drawn tall so the whole scroll shows. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h2600dp-xxhdpi")
class AchievementsShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle() = repeat(40) { Thread.sleep(150); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }

    private fun deeds(): JsonObject {
        val d = JsonParser.parseString(javaClass.classLoader!!.getResource("deeds-payload.json")!!.readText()).asJsonObject
        val q = d.getAsJsonObject("quests")
        // One daily finished and waiting, one weekly part way, so every state of a quest line shows.
        q.getAsJsonArray("daily")[2].asJsonObject.apply { addProperty("have", 1); addProperty("done", true) }
        q.getAsJsonArray("weekly")[1].asJsonObject.apply { addProperty("have", 2) }
        q.getAsJsonArray("weekly")[0].asJsonObject.apply { addProperty("canSwap", true) }
        return d
    }
    private val state = JsonParser.parseString("""{"wallet":{"coins":12450,"xp":2300,"seal_c":3,"seal_u":15,"seal_r":7,"seal_m":2},"packs":[{"id":"a","set":"fdn"},{"id":"b","set":"fdn"}],"config":{},"counters":{}}""").asJsonObject

    @Test fun page() {
        Progress.setForTest(state, deeds())
        rule.setContent { AchievementsRoute(onBack = {}, nav = { PlayNav(PlayTab.TROPHIES, {}) }) }
        settle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "achievements-390.png").path)
    }

    @Test fun pageLight() {
        Progress.setForTest(state, deeds()); dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("light")
        try {
            rule.setContent { AchievementsRoute(onBack = {}, nav = { PlayNav(PlayTab.TROPHIES, {}) }) }
            settle()
            rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "theme-light-achievements.png").path)
        } finally { dev.cardstashy.nativeplay.ui.AppSettings.applyTheme("dark") }
    }
}

/** The purse pill on the narrowest phones, at normal and large text, with big numbers: one line, nothing squeezed. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w320dp-h400dp-xxhdpi")
class PurseShotTest {
    @Test fun purse() {
        val big = dev.cardstashy.nativeplay.play.PlayMath.purse(JsonParser.parseString("""{"wallet":{"coins":124500,"xp":0,"seal_c":13,"seal_u":157,"seal_r":27,"seal_m":12},"packs":[],"config":{}}""").asJsonObject)!!
        val small = dev.cardstashy.nativeplay.play.PlayMath.purse(JsonParser.parseString("""{"wallet":{"coins":170,"xp":0,"seal_c":0,"seal_u":17,"seal_r":7,"seal_m":2},"packs":[],"config":{}}""").asJsonObject)!!
        for (w in listOf(320, 344, 390)) for (scale in listOf(1f, 1.3f)) {
            org.robolectric.RuntimeEnvironment.setQualifiers("w${w}dp-h400dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "purse-$w-${(scale * 100).toInt()}.png").path) {
                val d = androidx.compose.ui.platform.LocalDensity.current
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(d.density, scale)) {
                    androidx.compose.foundation.layout.Column(Modifier.background(androidx.compose.ui.graphics.Color(0xFF0C0E13)).padding(16.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp)) {
                        dev.cardstashy.nativeplay.ui.PurseRow(small, {}, {}, {}); dev.cardstashy.nativeplay.ui.PurseRow(big, {}, {}, {})
                    }
                }
            }
        }
    }
}

/** The day's log-in reward pop-up (day 4: coins and a pack). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class LoginRewardShotTest {
    @get:Rule val rule = createComposeRule()
    @Test fun popup() {
        val login = JsonParser.parseString("""{"day":"2026-11-03","stamp":4,"month":4,"reward":{"coins":300,"packs":1},"monthReward":null,"fresh":true}""").asJsonObject
        rule.setContent { androidx.compose.foundation.layout.Box(Modifier.background(androidx.compose.ui.graphics.Color(0xFF0C0E13))) { dev.cardstashy.nativeplay.ui.LoginRewardPopup(login) {} } }
        repeat(10) { rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "login-reward-390.png").path)
    }

    /** W3: on the Thor the reward stays on top and the week's streak is on the bottom. */
    @Test fun popupDual() {
        dev.cardstashy.nativeplay.ui.DualScreen.pretend(dev.cardstashy.nativeplay.ui.DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        try {
            org.robolectric.RuntimeEnvironment.setQualifiers("w960dp-h1080dp-xhdpi")
            val login = JsonParser.parseString("""{"day":"2026-11-03","stamp":4,"month":4,"reward":{"coins":300,"packs":1},"monthReward":null,"fresh":true}""").asJsonObject
            val week = dev.cardstashy.nativeplay.play.PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject).loginWeek
            rule.setContent { androidx.compose.foundation.layout.Column(Modifier.background(androidx.compose.ui.graphics.Color(0xFF0C0E13))) {
                androidx.compose.foundation.layout.Box(Modifier.width(960.dp).height(540.dp).testTag("top")) { dev.cardstashy.nativeplay.ui.LoginRewardPopup(login, week) {} }
                androidx.compose.foundation.layout.Box(Modifier.width(620.dp).height(540.dp).testTag("bottom")) { dev.cardstashy.nativeplay.ui.BottomRoot() } } }
            repeat(10) { rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
            rule.onNodeWithTag("top").captureRoboImage(File(System.getProperty("shotsDir"), "w3/login-reward-top-1920x1080.png").path)
            rule.onNodeWithTag("bottom").captureRoboImage(File(System.getProperty("shotsDir"), "w3/login-reward-bottom-1240x1080.png").path)
        } finally { dev.cardstashy.nativeplay.ui.DualScreen.pretend(null) }
    }
}
