package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.ui.BottomRoot
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.LoginRewardPopup
import dev.cardstashy.nativeplay.ui.Piece
import dev.cardstashy.nativeplay.ui.Rule
import dev.cardstashy.nativeplay.ui.SiteIcons
import dev.cardstashy.nativeplay.ui.bonusLine
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The daily log-in pop-up in the Console look (Randall's pick of 14 Nov 2026): the whole screen celebrates the day, each reward on
 * its own medal, the week as a track, the monthly bonus named. Day 7 with the month's bonus, as in Randall's recording of 14 Nov,
 * and a five-reward day; at a phone (390 x 844, and on its side 844 x 390), the Fold (884 x 796) and the Thor (960 x 540 over 620 x 540).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class DailyShotTest {
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "console/daily-$name.png").path
    private val day7 = """{"day":"2026-11-14","stamp":7,"month":14,"reward":{"seals":{"m":1,"r":1},"packs":2},"monthReward":{"packs":3},"fresh":true}"""
    private val five = """{"day":"2026-11-11","stamp":4,"month":11,"reward":{"coins":500,"seals":{"m":1,"r":1,"u":2},"packs":2},"fresh":true}"""
    /** play-achievements.js LOGIN_WEEK, as the rules give it to the app. */
    private val week = listOf(PlayRules.Reward(coins = 250), PlayRules.Reward(packs = 1), PlayRules.Reward(seals = mapOf("u" to 2)), PlayRules.Reward(coins = 300, packs = 1),
        PlayRules.Reward(seals = mapOf("r" to 1)), PlayRules.Reward(packs = 2), PlayRules.Reward(packs = 2, seals = mapOf("m" to 1, "r" to 1)))

    @After fun off() { DualScreen.pretend(null); dev.cardstashy.nativeplay.ui.Motion.still = false }

    @Test fun atEachSize() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val sizes = listOf("phone-390x844" to "w390dp-h844dp-xxhdpi", "phone-side-844x390" to "w844dp-h390dp-land-xxhdpi", "fold-884x796" to "w884dp-h796dp-xhdpi")
        for ((name, json) in listOf("day7" to day7, "five" to five)) {
            val login = JsonParser.parseString(json).asJsonObject
            for ((size, q) in sizes) {
                RuntimeEnvironment.setQualifiers(q)
                captureRoboImage(shot("$name-$size")) { Box(Modifier.fillMaxSize().background(Rule.Color.Bar)) { LoginRewardPopup(login, week) {} } }
            }
        }
        // The Thor: the day and its rewards on top, the week and what each day pays on the bottom.
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        val login = JsonParser.parseString(day7).asJsonObject
        RuntimeEnvironment.setQualifiers("w960dp-h540dp-land-xhdpi")
        captureRoboImage(shot("day7-thor-top-960x540")) { Box(Modifier.fillMaxSize().background(Rule.Color.Bar)) { LoginRewardPopup(login, week) {} } }
        RuntimeEnvironment.setQualifiers("w620dp-h540dp-xhdpi")
    }

    /** The monthly bonus is named in words, as part of the tile it belongs to. */
    @Test fun theBonusIsNamed() {
        val packs = Piece(SiteIcons.Pack, 5, "packs")
        assertEquals("Monthly bonus included: 3 of the 5 packs.", bonusLine(listOf(Piece(SiteIcons.Pack, 3, "packs")), listOf(Piece(SiteIcons.Coin, 300, "coins"), packs)))
        assertEquals("Monthly bonus included: 1 of the 5 packs.", bonusLine(listOf(Piece(SiteIcons.Pack, 1, "pack")), listOf(packs)))
        assertEquals("the bonus is the whole tile", "Monthly bonus included: 3 packs.", bonusLine(listOf(Piece(SiteIcons.Pack, 3, "packs")), listOf(Piece(SiteIcons.Pack, 3, "packs"))))
        assertNull("no bonus, no line", bonusLine(emptyList(), listOf(packs)))
    }
}

/** The daily pop-up's Thor bottom screen, drawn with a compose rule so the screen settles first. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w620dp-h540dp-xhdpi")
class DailyThorBottomShotTest {
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "console/daily-$name.png").path
    private val day7 = """{"day":"2026-11-14","stamp":7,"month":14,"reward":{"seals":{"m":1,"r":1},"packs":2},"monthReward":{"packs":3},"fresh":true}"""
    private val week = listOf(PlayRules.Reward(coins = 250), PlayRules.Reward(packs = 1), PlayRules.Reward(seals = mapOf("u" to 2)), PlayRules.Reward(coins = 300, packs = 1),
        PlayRules.Reward(seals = mapOf("r" to 1)), PlayRules.Reward(packs = 2), PlayRules.Reward(packs = 2, seals = mapOf("m" to 1, "r" to 1)))
    @After fun off() { DualScreen.pretend(null); dev.cardstashy.nativeplay.ui.Motion.still = false }

    /** The Thor's bottom screen: the week and what each day pays. Drawn after the screen has settled (the pop-up puts its view there in its first frame's effects). */
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createComposeRule()

    @Test fun thorBottom() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        val login = JsonParser.parseString(day7).asJsonObject
        rule.setContent {
            Box(Modifier.fillMaxSize()) {
                androidx.compose.ui.layout.Layout({ LoginRewardPopup(login, week) {} }) { m, c -> m.forEach { it.measure(c) }; layout(c.maxWidth, c.maxHeight) {} }
                BottomRoot()
            }
        }
        rule.waitForIdle()
        rule.onNodeWithText("Day 7 of 7").assertExists()
        rule.onRoot().captureRoboImage(shot("day7-thor-bottom-620x540"))
    }

}
