package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.PackOpening
import dev.cardstashy.nativeplay.ui.PackResult
import dev.cardstashy.nativeplay.ui.PackShop
import dev.cardstashy.nativeplay.ui.PackStage
import dev.cardstashy.nativeplay.ui.packResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Pack finish brief B (Randall 18 Nov, "this is a finish line... or what next"): once every card is up, the bar says how many went
 * into the Trunk and what else the pack gave; the simulator's pack, which adds nothing, shows no bar.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PackFinishTest {
    @get:Rule val rule = createComposeRule()

    private fun pack(bonus: Boolean): PackResult {
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        if (bonus) { out.add("sealBonus", JsonParser.parseString("""{"r":1}""")); out.addProperty("duplicateCoins", 40) }
        return packResult(out, "Reality Fracture")
    }

    private fun open(p: PackResult) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        kotlinx.coroutines.runBlocking { AssetImages.load(RuntimeEnvironment.getApplication(), "play/mtg-back.webp", maxWidth = 400) }
        rule.setContent { PackOpening(p, onNext = { null }, onClose = {}, initial = PackStage.DEALT, revealedAtStart = p.pulls.indices.toSet()) }
        rule.waitForIdle()
    }

    private fun count(text: String) = rule.onAllNodes(androidx.compose.ui.test.hasText(text, substring = true), useUnmergedTree = true).fetchSemanticsNodes().size

    @Test fun barWithBonuses() {
        val p = pack(true)
        assertEquals("+1 rare seal · +40 coins from extra copies", p.bits)
        open(p)
        assertEquals(1, count("${p.pulls.size} cards added to your Trunk"))
        assertEquals(1, count("+1 rare seal · +40 coins from extra copies"))
        assertEquals(1, count("Open the next pack"))
    }

    @Test fun barWithoutBonuses() {
        val p = pack(false)
        assertEquals("", p.bits)
        open(p)
        assertEquals(1, count("${p.pulls.size} cards added to your Trunk"))
        assertEquals(0, count("coins from extra copies"))
    }

    @Test fun simulatorPackHasNoBar() {
        val real = pack(false)
        open(PackResult(real.set, real.name, real.pulls, "", "", PackShop(emptyList(), "", "", "", "", "", "", "")))
        assertEquals(0, count("added to your Trunk"))
        assertEquals(1, count("Open a new pack"))
    }
}

/** Picture-only (a compose rule in the same class blanks standalone captures). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PackFinishShotTest {
    private fun pack(): PackResult {
        val out = JsonParser.parseString(javaClass.classLoader!!.getResource("pack-open-fra.json")!!.readText()).asJsonObject
        out.add("sealBonus", JsonParser.parseString("""{"r":1}""")); out.addProperty("duplicateCoins", 40)
        return packResult(out, "Reality Fracture")
    }

    /** The finished pack at true screen sizes: a phone, Randall's Fold open, and the Thor's top screen. */
    @Test fun finishedPackPictures() {
        val p = pack()
        val dir = System.getProperty("shotsDir")
        for (q in listOf("w390dp-h844dp-xxhdpi" to "390x844", "w750dp-h833dp-420dpi" to "750x833", "w960dp-h540dp-land-xhdpi" to "thor-top-960x540")) {
            RuntimeEnvironment.setQualifiers(q.first)
            dev.cardstashy.nativeplay.ui.Motion.still = true
            dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
            captureRoboImage(File(dir, "pack-finish-${q.second}.png").path) {
                PackOpening(p, onNext = { null }, onClose = {}, initial = PackStage.DEALT, revealedAtStart = p.pulls.indices.toSet())
            }
        }
    }

}
