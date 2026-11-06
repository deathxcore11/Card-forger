package dev.cardstashy.nativeplay.shots

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.CardGame
import dev.cardstashy.nativeplay.ui.LocalGameGold
import dev.cardstashy.nativeplay.ui.LocalSheetPal
import dev.cardstashy.nativeplay.ui.TierBuildActions
import dev.cardstashy.nativeplay.ui.TierBuildModel
import dev.cardstashy.nativeplay.ui.TierBuildSheet
import dev.cardstashy.nativeplay.ui.sheetPal
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Upgrade lab's Compare budget builds for Yu-Gi-Oh! and Pokémon (tcg.js A.tOptimizeDeck → tcgBuildSheet): the Build decks sheet the app
 * draws from the engine's model of it. The models are what the engine's sheet gave on live data (6 Nov, the tb probe on the test deck):
 * building, the versions, and one version's list open.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CollectionTierBuildShotTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(50); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun seen(text: String) = rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty()
    @After fun still() { dev.cardstashy.nativeplay.ui.Motion.still = false }

    private fun run(game: String, state: String, w: Int, h: Int, font: Float) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val j = JsonParser.parseString(javaClass.classLoader!!.getResource("build-deck/tiers-$game${if (state.isEmpty()) "" else "-$state"}.json")!!.readText()).asJsonObject
        val m = TierBuildModel(j.getAsJsonObject("sheet"))
        val g = if (game == "ygo") CardGame.YGO else CardGame.PTCG
        val taps = mutableListOf<Int>()
        rule.setContent {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, font), LocalSheetPal provides sheetPal(g), LocalGameGold provides g.gold) {
                TierBuildSheet(m, g, null, TierBuildActions(tap = { taps += it }, type = { _, _ -> }, close = {}, card = {}))
            }
        }
        settle(30)
        assertTrue("title", seen("Build decks"))
        when (state) {
            "busy" -> assertTrue("overlay", seen("Building your decks") && seen("Loading"))
            else -> {
                assertTrue("seed", seen(m.seed!!.get("name").asString))
                assertTrue("versions", m.tiers.all { t -> seen(t.title.take(20)) } || m.tiers.isNotEmpty() && seen(m.tiers[0].title.take(20)))
                if (state == "open") assertTrue("open list", seen(if (game == "ygo") "MONSTERS" else "POKÉMON") && seen("Hide list"))
            }
        }
        val tag = "$game${if (state.isEmpty()) "" else "-$state"}-${w}x$h-${(font * 100).toInt()}"
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-tier-build-$tag.png").path)
        // The open version's list: its first group and tiles, then its actions and the ⋯ menu.
        if (state == "open") {
            rule.onAllNodesWithText(if (game == "ygo") "MONSTERS" else "POKÉMON")[0].performScrollTo(); settle(10)
            rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-tier-build-$tag-list.png").path)
            rule.onAllNodesWithText("Hide list")[0].performScrollTo(); settle(6)
            rule.onAllNodesWithContentDescription("More for this version")[m.tiers.indexOfFirst { it.groups.isNotEmpty() }].performClick(); settle(10)
            assertTrue("menu", seen("Copy deck list"))
            rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-tier-build-$tag-more.png").path)
        }
    }

    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ygo390() = run("ygo", "", 390, 844, 1f)
    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ygoBusy390() = run("ygo", "busy", 390, 844, 1f)
    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ygoOpen390() = run("ygo", "open", 390, 844, 1f)
    @Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi") @Test fun ptcgOpen390() = run("ptcg", "open", 390, 844, 1f)
    @Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi") @Test fun ygo360big() = run("ygo", "", 360, 780, 1.3f)
    @Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi") @Test fun ptcgOpen360big() = run("ptcg", "open", 360, 780, 1.3f)
    @Config(sdk = [35], qualifiers = "w954dp-h860dp-xxhdpi") @Test fun ygoOpen954() = run("ygo", "open", 954, 860, 1f)
    @Config(sdk = [35], qualifiers = "w1024dp-h768dp-xhdpi") @Test fun ptcg1024() = run("ptcg", "", 1024, 768, 1f)
    @Config(sdk = [35], qualifiers = "w844dp-h390dp-xxhdpi") @Test fun ygo844() = run("ygo", "", 844, 390, 1f)
}
