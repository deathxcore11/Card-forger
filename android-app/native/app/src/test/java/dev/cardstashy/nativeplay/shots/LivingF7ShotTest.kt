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
 * Living table F7 (specs/living-table-build-guide.md, "F7 The winning hit") at phone size, on the Ashen Forge: the finished board
 * has you as winner. 700 ms on, the CPU's orb is gone from its square, a crack has run from it across the table toward the far
 * corner, and the table is flooded in the forge's win colour. Pictures in table-look/f7-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF7ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val fx = Battlefield()
    private val anchors = Anchors()
    @After fun back() { AppSettings.applyMatchEffects("full"); TableFeel.mat = null }

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/f7-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theLosersOrbBreaksAndACrackRunsAcrossTheTable() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        AppSettings.applyMatchEffects("full")
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene("ashen-forge", Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        rule.waitForIdle()
        val plain = draw("board")
        val orb = anchors.rects.getValue("orb${st.cpu.id}")
        val look = TableFeel.profile("ashen-forge")
        val item = FxItem(Fx.WIN, 2, TableFeel.WIN_HOLD_MS, player = st.cpu.id, mine = true, toKey = "orb${st.cpu.id}", tone = look.win, caster = look.winHi, ids = st.players.map { it.id }.toSet())
        rule.runOnUiThread { item.t0 = fx.now.longValue; item.dur = item.baseMs; fx.items += item; fx.reindex(); fx.now.longValue += 1L }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/f7-hit.png").path)
        rule.runOnUiThread { fx.now.longValue = item.t0 + 700L }
        rule.waitForIdle()
        val hit = draw("crack")
        assertEquals("the CPU's orb is off the table", 0f, fx.orbs.value.getValue(st.cpu.id), 0f)
        assertTrue("yours is whole", st.viewer !in fx.orbs.value)
        assertTrue("the orb's place has changed: ${diff(plain, hit, orb)}", diff(plain, hit, orb) > .5f)
        // The crack runs from the orb toward the far corner (bottom right): its line crosses the middle of the table.
        val c = TableFeel.crack(orb.center, androidx.compose.ui.geometry.Offset(plain.width.toFloat(), plain.height.toFloat()), st.cpu.id)
        var onLine = 0
        for (p in c.main.subList(4, 18)) { val x = p.x.toInt().coerceIn(0, hit.width - 1); val y = p.y.toInt().coerceIn(0, hit.height - 1)
            val px = hit.getPixel(x, y); val r = (px shr 16) and 0xff; val g = (px shr 8) and 0xff
            if (r > 200 && g > 170) onLine++ }
        assertTrue("the bright line is on the crack's path: $onLine of 14", onLine >= 10)
        // The flood: the far side of the table is lit too.
        val farSide = Rect(plain.width * .7f, plain.height * .3f, plain.width * .8f, plain.height * .4f)
        assertTrue("the table is flooded: ${diff(plain, hit, farSide)}", diff(plain, hit, farSide) > .5f)
    }
}
