package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.TextLayoutResult
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Piece
import dev.cardstashy.nativeplay.ui.SiteIcons
import dev.cardstashy.nativeplay.ui.merged
import dev.cardstashy.nativeplay.ui.tilesPerRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Butter pass B2 (Randall 14 Nov, "how shifty that pop up was"): the reward tiles fit, packs are one tile, no label wraps. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h800dp-xxhdpi")
class LoginRewardFitShotTest {
    @get:Rule val rule = createComposeRule()

    @Test fun packsAreOneTile() {
        val m = merged(listOf(Piece(SiteIcons.Coin, 300, "coins"), Piece(SiteIcons.Pack, 2, "packs"), Piece(SiteIcons.Pack, 1, "pack"), Piece(SiteIcons.Coin, 1, "coins")))
        assertEquals(listOf(301 to "coins", 3 to "packs"), m.map { it.count to it.label })
        assertEquals(3, tilesPerRow(268f, 4)); assertEquals(3, tilesPerRow(320f, 5)); assertEquals(4, tilesPerRow(350f, 5)); assertEquals(2, tilesPerRow(320f, 2))
    }

    private val five = """{"day":"2026-11-14","stamp":7,"month":14,"reward":{"coins":500,"seals":{"m":1,"r":1,"u":2},"packs":2},"monthReward":{"packs":3},"fresh":true}"""
    private val four = """{"day":"2026-11-14","stamp":7,"month":14,"reward":{"seals":{"m":1,"r":1},"packs":2},"monthReward":{"packs":3},"fresh":true}"""

    private fun shot(json: String, w: Int, name: String) {
        RuntimeEnvironment.setQualifiers("w${w}dp-h800dp-xxhdpi")
        val login = JsonParser.parseString(json).asJsonObject
        rule.setContent { androidx.compose.foundation.layout.Box(Modifier.background(androidx.compose.ui.graphics.Color(0xFF0C0E13))) { dev.cardstashy.nativeplay.ui.LoginRewardPopup(login) {} } }
        repeat(10) { rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "butter/login-reward-$name.png").path)
        for (label in listOf("packs", "mythic", "rare", "uncommon", "coins")) rule.onAllNodesWithText(label, useUnmergedTree = true).fetchSemanticsNodes().forEach { n ->
            val out = mutableListOf<TextLayoutResult>(); n.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(out)
            out.firstOrNull()?.let { assertTrue("$name: '$label' wraps or is cut: lines ${it.lineCount} needs ${it.multiParagraph.intrinsics.maxIntrinsicWidth} size ${it.size} text ${it.layoutInput.text}", it.lineCount == 1 && it.multiParagraph.intrinsics.maxIntrinsicWidth <= it.size.width + 1f) }
        }
        assertEquals("$name: the packs are one tile", 1, rule.onAllNodesWithText("packs", useUnmergedTree = true).fetchSemanticsNodes().size)
    }

    @Test fun fourPiecesAt360() = shot(four, 360, "4-360")
    @Test fun fivePiecesAt360() = shot(five, 360, "5-360")
    @Test fun fivePiecesAt412() = shot(five, 412, "5-412")
}
