package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Match punch P1 (specs/match-punch-brief.md, "Push-in and shake move the board box only"): the board drawn still and mid-jolt
 * (12 dp shake, 4 % push-in). The rows move; the player squares, the phase, End turn and the gold button are the same pixels.
 * Pictures in table-look/p1-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PunchShakeShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!

    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val fx = Battlefield()

    /** Capture until two captures in a row agree (the art comes in off the main thread), at most 12 tries. */
    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/p1-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }

    /** Share of pixels that differ inside [b] (dp), at the picture's density. */
    private fun diff(a: Bitmap, c: Bitmap, b: ZoneLayout.Box): Float {
        val k = a.width / 844f
        val x0 = (b.x * k).toInt().coerceAtLeast(0); val y0 = (b.y * k).toInt().coerceAtLeast(0)
        val x1 = (b.right * k).toInt().coerceAtMost(a.width); val y1 = (b.bottom * k).toInt().coerceAtMost(a.height)
        var n = 0; var all = 0
        for (y in y0 until y1 step 2) for (x in x0 until x1 step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theStripsStayStillWhileTheBoardShakes() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides remember { Anchors() }, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
        val still = draw("still")
        // Mid-jolt: 50 ms into a 12 dp shake with a 4 % push-in.
        rule.runOnUiThread { fx.jolt(12f, 1000L, .04f); fx.now.longValue += 50L }
        rule.waitForIdle()
        val shaken = draw("shaken")
        val z = ZoneLayout.of(844f, 390f, k = ZoneLayout.scale(844f, 390f))
        assertTrue("the board moves", diff(still, shaken, z.board) > .05f)
        for ((name, box) in listOf("CPU square" to z.cpuSquare, "your square" to z.mySquare, "phase" to z.phase, "buttons" to z.actions, "menu" to z.menu))
            assertTrue("$name did not move: ${diff(still, shaken, box)}", diff(still, shaken, box) < .002f)
    }
}
