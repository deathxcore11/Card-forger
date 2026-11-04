package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The match table on the site's own test boards (experiments/forge-proof/table-fixture.html, exported by scratchpad
 * site/table.mjs as table/snap-<state>.json): the same Forge snapshot the site draws, at phone landscape (844 × 390, the
 * site measurement), the Fold's inner screen and a tablet. Card pictures come from app/build/shot-art/table (names in
 * missing.txt are fetched by scratchpad tools/fetch_table_art.py).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private val missing = java.util.TreeSet<String>()
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @Test fun boards() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop ->
            val f = art.resolve(key(name, crop) + ".jpg")
            if (f.exists()) BitmapFactory.decodeFile(f.path)?.asImageBitmap() else { missing += "$name|$crop"; null }
        }
        val sizes = listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "960x840" to "w960dp-h840dp-land-xhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi")
        val boards = listOf("main", "triggers", "attack", "block", "early", "crowded", "targets")
        for ((size, q) in sizes) for (b in if (size == "844x390") boards else listOf("main", "crowded")) {
            RuntimeEnvironment.setQualifiers(q)
            val st = state(b).let { it.copy(phaseStops = mapOf("${if (it.activePlayer == it.viewer) "you" else "opponent"}:COMBAT_BEGIN" to true)) }
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            if (b == "main") dev.cardstashy.nativeplay.ui.TableEmotes.say("cpu", "Good luck, have fun.")
            captureRoboImage(File(System.getProperty("shotsDir"), "table/table-$b-$size.png").path) {
                val anchors = remember { Anchors() }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                    }
                }
            }
        }
        // The match menu open over the deck tracker (site-tracker-crowded), and the Opponent tab alone; the fixture's own tracker list.
        RuntimeEnvironment.setQualifiers("w844dp-h390dp-land-xxhdpi")
        val deck = listOf("Legion Warboss" to 2, "Goblin Guide" to 1, "Hill Giant" to 2, "Grizzly Bears" to 2, "Rancor" to 1, "Sol Ring" to 1, "Arcane Signet" to 1,
            "Loyal Apprentice" to 1, "Rampant Growth" to 1, "Mountain" to 14, "Forest" to 12)
        val input = "{\"input\":{\"humanDeck\":{\"cards\":[" + deck.joinToString(",") { (n, q) -> "{\"name\":\"$n\",\"qty\":$q}" } + "]}}}"
        for ((name, side, open) in listOf(Triple("menu", "deck", true), Triple("opponent", "opponent", false), Triple("history", null, false))) {
            val st = state("crowded")
            val menu = dev.cardstashy.nativeplay.ui.MatchMenu(input, {}, {}).apply { showTracker(side); this.open = open; history = name == "history" }
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            captureRoboImage(File(System.getProperty("shotsDir"), "table/table-$name-844x390.png").path) {
                val anchors = remember { Anchors() }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {}, menu = menu)
                    }
                }
            }
        }
        art.mkdirs(); art.resolve("missing.txt").writeText(missing.joinToString("\n"))
        CardImageTest.art = null
    }
}
