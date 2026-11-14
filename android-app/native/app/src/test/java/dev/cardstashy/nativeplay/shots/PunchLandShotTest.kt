package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.IMPACT_MS
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Match punch P3 (specs/match-punch-brief.md, "Landing"), the impact frame at phone size: your Grizzly Bears has just landed. Its
 * tile is squashed and flashed, a flat gold ring and dust lie under it, its neighbours are pushed away, the board is shaken, and
 * the squares and buttons are the same pixels (walk line 34). Pictures in table-look/p3-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PunchLandShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val fx = Battlefield()
    private val anchors = Anchors()

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/p3-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theLandingSquashesFlashesAndRocksItsNeighbours() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        rule.waitForIdle()
        val plain = draw("board")
        val dp = plain.width / 844f
        val z = ZoneLayout.of(844f, 390f, k = ZoneLayout.scale(844f, 390f))
        fun ZoneLayout.Box.px() = Rect(x * dp, y * dp, right * dp, bottom * dp)
        val bears = anchors.rects.getValue("c108"); val giant = anchors.rects.getValue("c107")
        // Your Grizzly Bears (108, between Hill Giant and Goblin Guide) lands: the frame the impact starts on, then 90 ms later.
        rule.runOnUiThread { fx.items += FxItem(Fx.IMPACT, 1, IMPACT_MS, card = 108, mine = true, power = 1f).also { it.t0 = fx.now.longValue; it.dur = IMPACT_MS }; fx.reindex(); fx.now.longValue += 1L }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/p3-impact.png").path)
        rule.runOnUiThread { fx.now.longValue += 90L }
        rule.waitForIdle()
        val hit = draw("impact")
        assertTrue("the tile flashed and squashed", diff(plain, hit, bears) > .5f)
        val under = Rect(bears.left - bears.width * .3f, bears.bottom - 6 * dp, bears.right + bears.width * .3f, bears.bottom + bears.width * .25f)
        assertTrue("a ring and dust under the tile: ${diff(plain, hit, under)}", diff(plain, hit, under) > .05f)
        assertTrue("its neighbour rocks", diff(plain, hit, giant) > .2f)
        // Walk line 34: the board shakes, the squares and the buttons do not move.
        for (box in listOf(z.cpuSquare, z.mySquare, z.actions, z.phase)) assertEquals(0f, diff(plain, hit, box.px()), .002f)
        // 700 ms on it has settled: the tile is as it was.
        rule.runOnUiThread { fx.now.longValue += 1700L }
        rule.waitForIdle()
        assertEquals("settled", 0f, diff(plain, draw("settled"), bears), .01f)
    }
}
