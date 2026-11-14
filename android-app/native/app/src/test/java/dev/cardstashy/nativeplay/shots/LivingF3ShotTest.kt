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
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableFeel
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.After
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
 * Living table F3 (specs/living-table-build-guide.md, "F3 Weight") at phone size: your Grizzly Bears' tile (108) plays a heavy
 * landing. Mid-drop it is bigger and above its place; 60 ms after it lands a ring in its colour is out, your other tiles and your
 * hand have hopped, and the mat has one mark, which is still there when everything has settled. The squares and buttons are the
 * same pixels throughout. Pictures in table-look/f3-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF3ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val fx = Battlefield()
    private val anchors = Anchors()
    @After fun back() { AppSettings.applyMatchEffects("full"); TableFeel.mat = null }

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/f3-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun aHeavyLandingDropsRingsHopsAndLeavesOneMark() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        AppSettings.applyMatchEffects("full")
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
        val others = st.me.battlefield.map { it.id }.filter { it != 108 }.toSet()
        val green = dev.cardstashy.nativeplay.ui.frameTone(dev.cardstashy.nativeplay.ui.cardColors(st.card(108)!!)).first
        val drop = TableFeel.HEAVY_DROP_MS.toLong()
        val item = FxItem(Fx.HEAVY, 1, (TableFeel.HEAVY_DROP_MS + TableFeel.HEAVY_AFTER_MS).toLong(), card = 108, mine = true, tone = green, ids = others, note = "lava")
        rule.runOnUiThread { item.t0 = fx.now.longValue; item.dur = item.baseMs; fx.items += item; fx.reindex(); fx.now.longValue += 40L }
        rule.waitForIdle()
        // 40 ms into the drop: the tile is well over its own size, so the table above it is covered; nothing has landed yet.
        val falling = draw("drop")
        val above = Rect(bears.left, bears.top - bears.height * .8f, bears.right, bears.top - bears.height * .1f)
        assertTrue("the tile comes in big from above: ${diff(plain, falling, above)}", diff(plain, falling, above) > .3f)
        assertTrue("no mark before it lands", fx.landMarks.isEmpty())
        assertEquals("your other tiles have not hopped yet", 0f, diff(plain, falling, Rect(giant.left, giant.top, giant.left + giant.width * .4f, giant.bottom)), .02f)
        // The landing frame (the burst is thrown on it), then 60 ms on.
        rule.runOnUiThread { fx.now.longValue = item.t0 + drop + 1L }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/f3-land.png").path)
        rule.runOnUiThread { fx.now.longValue = item.t0 + drop + 60L }
        rule.waitForIdle()
        val hit = draw("land")
        assertEquals("one mark", 1, fx.landMarks.size); assertEquals("lava", fx.landMarks[0].kind)
        assertTrue("your other tiles hop: ${diff(plain, hit, giant)}", diff(plain, hit, giant) > .2f)
        val hand = anchors.rects.getValue("hand")
val face = Rect(bears.left + bears.width * .15f, bears.top + bears.height * .15f, bears.right - bears.width * .15f, bears.bottom - bears.height * .15f)
                assertTrue("your hand hops: ${diff(plain, hit, hand)}", diff(plain, hit, hand) > .05f)
        val round = Rect(bears.center.x - bears.height * 1.2f, bears.center.y - bears.height * 1.2f, bears.center.x + bears.height * 1.2f, bears.center.y + bears.height * 1.2f)
        assertTrue("a ring and the mat's dust round it: ${diff(plain, hit, round)}", diff(plain, hit, round) > .1f)
        // Only the board moves: the squares and the buttons are the same pixels.
        for (box in listOf(z.cpuSquare, z.mySquare, z.actions, z.phase)) assertEquals(0f, diff(plain, hit, box.px()), .002f)
        // Settled (3 s on): the tiles are home and the mark is still on the mat beside the tile.
        rule.runOnUiThread { fx.now.longValue += 3000L; fx.items.clear(); fx.reindex() }
        rule.waitForIdle()
        val settled = draw("settled")
        assertEquals("one mark stays for the turn", 1, fx.landMarks.size)
        // The crown: the mark runs from the tile's rim into the gap toward the middle line, clear of every tile.
        val gap = Rect(bears.left, bears.top - bears.height * .22f, bears.right, bears.top - 3 * dp)
        assertTrue("the mark shows above the tile on a full row: ${diff(plain, settled, gap)}", diff(plain, settled, gap) > .01f)
        assertEquals("2.2 tile heights across", bears.height * 2.2f, fx.landMarks[0].size, 1f)
        assertEquals("the squares are untouched", 0f, diff(plain, settled, z.mySquare.px()), .002f)
        assertEquals("the tile is home at its own size", 0f, diff(plain, settled, face), .01f)
    }
}
