package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Site
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Randall 3 Nov 20:51Z: after Overview, a foil card stayed drawn under the Play guide tab. Overview → Play guide → Get it must show no card picture. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CardSheetGhostTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    @get:Rule val rule = createComposeRule()
    private fun settle() = repeat(20) { Thread.sleep(50); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }

    @Test fun tabsLeaveNoCard() {
        dev.cardstashy.nativeplay.ui.homeArt = { url -> (home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() })?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val cards = JsonParser.parseString(javaClass.classLoader!!.getResource("trunk-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject } +
            JsonParser.parseString(javaClass.classLoader!!.getResource("abiding-grace.json")!!.readText()).asJsonObject
        dev.cardstashy.nativeplay.play.CardFacts.seed(cards)
        dev.cardstashy.nativeplay.play.CardData.load(RuntimeEnvironment.getApplication())
        // The same card the website shots open (MH2 #1, nonfoil), so the two sides compare 1:1.
        val c = cards.first { it["name"].asString == "Abiding Grace" }
        val pick = dev.cardstashy.nativeplay.ui.CardPick(c["name"].asString, c["oracle_id"].asString, c["id"].asString, "nonfoil")
        val state = JsonParser.parseString("""{"wallet":{"coins":0},"packs":[],"cards":[],"config":{}}""").asJsonObject
        rule.setContent { Box(Modifier.background(Site.Bg)) { dev.cardstashy.nativeplay.ui.CardSheet(pick, state, dev.cardstashy.nativeplay.ui.CardSheetActions(), {}) } }
        settle()
        val dir = System.getProperty("shotsDir")
        rule.onRoot().captureRoboImage(File(dir, "ghost-1-overview.png").path)
        // Tap the card: it fills the screen; tap again puts it down.
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(width / 2f, height * .8f)) }; settle()
        rule.onRoot().captureRoboImage(File(dir, "zoom-1-effects.png").path)
        rule.onNodeWithText("Plain card").performClick(); settle(); rule.onRoot().captureRoboImage(File(dir, "zoom-2-plain.png").path)
        rule.onNodeWithText("Art").performClick(); settle(); rule.onRoot().captureRoboImage(File(dir, "zoom-3-art.png").path)
        rule.onNodeWithText("Effects").performClick(); settle()
        rule.onNodeWithText("+").performClick(); settle(); rule.onRoot().captureRoboImage(File(dir, "zoom-4-in.png").path)
        rule.onNodeWithText("Fit").performClick(); settle()
        rule.onAllNodesWithText("✕")[1].performClick(); settle()
        rule.onNodeWithText("Play guide").performClick(); settle()
        rule.onRoot().captureRoboImage(File(dir, "ghost-2-guide.png").path)
        rule.onNodeWithText("Get it").performClick(); settle()
        rule.onRoot().captureRoboImage(File(dir, "ghost-3-get.png").path)
    }
}
