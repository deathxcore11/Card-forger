package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.BoardFoil
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T10, the board's light foil: your foil Hill Giant wears it, your tapped foil Grizzly Bears at a third, the CPU's own Hill
 * Giant and Grizzly Bears (same names) never, and a foil tile wearing a target ring shows none. Measured as each tile's change in
 * pixels between the board with and without your foil rows (motion still: the sheen at rest, no band).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class TableLookT10ShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); dev.cardstashy.nativeplay.art.CardImageTest.art = { _, _ -> null } }
    @After fun off() = BoardFoil.clear()
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun foilRows() = listOf("Hill Giant", "Grizzly Bears").map { n -> n to JsonObject().apply { addProperty("name", n); addProperty("qty", 2); addProperty("finish", "foil") } }

    /** Each named tile's mean change per pixel channel (0 to 255) when your foil rows are armed. */
    private fun change(st: MatchState, shot: String, ids: List<Int>): Map<Int, Double> {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        BoardFoil.clear()
        val anchors = Anchors()
        var gen by androidx.compose.runtime.mutableStateOf(0)
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    key(gen) { ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}) }
                }
            }
        }
        rule.waitForIdle()
        val plainFile = File(System.getProperty("shotsDir"), "table-look/t10-$shot-plain.png")
        // The art comes in off the main thread: settle until two plain captures agree, so only the foil differs.
        settle(plainFile)
        // The rebuilt board loads its art again: settle the foil board the same way before comparing.
        BoardFoil.arm(foilRows()); gen = 1; rule.waitForIdle()
        val foilFile = File(System.getProperty("shotsDir"), "table-look/t10-$shot.png")
        settle(foilFile)
        val plain = android.graphics.BitmapFactory.decodeFile(plainFile.path); val foil = android.graphics.BitmapFactory.decodeFile(foilFile.path)
        plainFile.delete()
        return ids.associateWith { id ->
            val r: Rect = anchors.rects["c$id"] ?: error("tile c$id not drawn")
            var sum = 0.0; var n = 0
            for (x in r.left.toInt() + 4 until r.right.toInt() - 4 step 2) for (y in r.top.toInt() + 4 until r.bottom.toInt() - 4 step 2) {
                if (x !in 0 until plain.width || y !in 0 until plain.height) continue
                val a = plain.getPixel(x, y); val b = foil.getPixel(x, y)
                sum += (kotlin.math.abs(android.graphics.Color.red(a) - android.graphics.Color.red(b)) + kotlin.math.abs(android.graphics.Color.green(a) - android.graphics.Color.green(b)) +
                    kotlin.math.abs(android.graphics.Color.blue(a) - android.graphics.Color.blue(b))) / 3.0; n++
            }
            if (n == 0) 0.0 else sum / n
        }
    }

    /** Capture until two captures in a row agree (at most 12 tries). */
    private fun settle(f: File) {
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) return; last = now; Thread.sleep(300); rule.waitForIdle() }
    }

    @Test fun foilTappedFoilAndTheCpusSameNames() {
        val main = state("main")
        // Your Grizzly Bears tapped (a third as strong).
        val st = main.copy(players = main.players.map { p -> p.copy(battlefield = p.battlefield.map { if (it.id == 108) it.copy(tapped = true) else it }) })
        val d = change(st, "board", listOf(107, 108, 123, 124))
        assertTrue("your foil Hill Giant wears it: $d", d.getValue(107) > 3.0)
        assertTrue("your tapped foil Grizzly Bears, fainter: $d", d.getValue(108) > .6 && d.getValue(108) < d.getValue(107) * .7)
        assertTrue("the CPU's Grizzly Bears and Hill Giant never: $d", d.getValue(123) < .05 && d.getValue(124) < .05)
    }

    @Test fun aTargetRingTurnsItOff() {
        // Every one of your creatures is a legal target here: no foil on any of them.
        val d = change(state("targets"), "target", listOf(107, 108))
        assertTrue("foil tiles wearing the target ring show none: $d", d.values.all { it < .05 })
    }
}
