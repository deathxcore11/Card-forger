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
 * Living table F8 (specs/living-table-build-guide.md, "F8 Always alive") at phone size on the Ashen Forge: with Match effects on,
 * embers stand in the air over the mat and under the cards; with them off the table is as it was. The gold button and
 * a tile's face are the same pixels either way (the air is under the cards). Pictures in table-look/f8-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF8ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val anchors = Anchors()
    @After fun back() { AppSettings.applyMatchEffects("full"); TableFeel.mat = null }

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/f8-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height)) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width)) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theAirIsOverTheMatAndUnderTheCards() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        AppSettings.applyMatchEffects("off")
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides Battlefield()) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene("ashen-forge", Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle()
        val off = draw("off")
        rule.runOnUiThread { AppSettings.applyMatchEffects("full") }
        rule.waitForIdle()
        val full = draw("full")
        val dp = off.width / 844f
        // The same table with only the turn light, the mana light and the air added: count the embers where no card or panel lies.
        val specks = TableFeel.specks("ember")
        var seen = 0; var free = 0
        val covered = anchors.rects.filterKeys { it.startsWith("c") || it.startsWith("square") || it.startsWith("hand") || it in setOf("gold", "quiet", "menu", "phasetrack", "turn", "cpuhand", "stackcard") }.values
        for (s in specks) { val at = TableFeel.speckAt(s, "ember", 0f, 844f, 390f); val x = at.x * dp; val y = at.y * dp
            if (x < 4 || y < 4 || x > off.width - 4 || y > off.height - 4 || covered.any { it.inflate(8 * dp).contains(androidx.compose.ui.geometry.Offset(x, y)) }) continue
            if (TableFeel.speckAlpha(s, "ember", 0f, at.y / 390f, 1f) < .25f) continue
            free++
            val a = off.getPixel(x.toInt(), y.toInt()); val b = full.getPixel(x.toInt(), y.toInt())
            // An ember adds orange light: its place is redder than the plain table's.
            if (((b shr 16) and 0xff) - ((a shr 16) and 0xff) >= 12) seen++ }
        assertTrue("some embers lie over open mat: $free", free >= 6)
        assertTrue("the embers over open mat are drawn: $seen of $free", seen >= free * 3 / 4)
        // Under the cards: a creature tile's face and the seat panels are the same pixels with and without the air.
        val tile = anchors.rects.getValue("c108")
        assertEquals("a tile's face", 0f, diff(off, full, Rect(tile.left + 8 * dp, tile.top + 8 * dp, tile.right - 8 * dp, tile.bottom - 8 * dp)), .002f)
        // The seat panels are dark glass and the turn light (F1) shows through them, so they are not compared; the gold button is solid.
        val gold = anchors.rects.getValue("gold")
        assertEquals("the gold button", 0f, diff(off, full, Rect(gold.left + 10 * dp, gold.top + 10 * dp, gold.right - 10 * dp, gold.bottom - 10 * dp)), .002f)
    }
}
