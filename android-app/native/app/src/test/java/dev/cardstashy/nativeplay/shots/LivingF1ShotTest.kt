package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Palette
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
 * The living table F1 at phone size, on a plain dark table so the light alone is measured: on your turn the bottom of the table
 * is lit in the mat's "yours" colour (Forest Temple: green-gold) and the top is not; on the CPU's turn the top is lit in its
 * colour; with Match effects Off the table is pixel for pixel the table without F1. Pictures in table-look/f1-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF1ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun off() { AppSettings.applyMatchEffects("full"); TableFeel.mat = null }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private var st by mutableStateOf(base)

    private fun shot(name: String): Bitmap {
        rule.waitForIdle()
        val f = File(System.getProperty("shotsDir"), "table-look/f1-$name.png")
        rule.onRoot().captureRoboImage(f.path)
        return BitmapFactory.decodeFile(f.path)
    }
    /** Mean red, green, blue of the empty table strip between the creature rows' ends and the right strip, at [share] of the height. */
    private fun tone(b: Bitmap, share: Float, x0: Float = .78f, x1: Float = .84f): Triple<Float, Float, Float> {
        var r = 0f; var g = 0f; var bl = 0f; var n = 0
        val y = (b.height * share).toInt()
        for (x in (b.width * x0).toInt() until (b.width * x1).toInt() step 3) for (dy in -4..4 step 2) { val p = b.getPixel(x, y + dy)
            r += (p shr 16 and 0xff); g += (p shr 8 and 0xff); bl += (p and 0xff); n++ }
        return Triple(r / n, g / n, bl / n)
    }

    @Test fun theTurnLightsItsSideInTheMatsColourAndOffChangesNothing() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        TableFeel.mat = "forest-temple"
        AppSettings.applyMatchEffects("off")
        st = base.copy(activePlayer = base.viewer)
        rule.setContent {
            Box(Modifier.fillMaxSize().background(Palette.Night)) {
                ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
            }
        }
        val off = shot("off")
        rule.runOnUiThread { AppSettings.applyMatchEffects("full") }
        val mine = shot("yours")
        // Your turn: the foot of the table is brighter, most in green (the mat's #d8f08a), and the top is as it was.
        val lowOff = tone(off, .64f); val low = tone(mine, .64f)
        assertTrue("the bottom is lit: $lowOff -> $low", low.second > lowOff.second + 8f && low.first > lowOff.first + 6f)
        assertTrue("in the mat's green-gold: $low", low.second - lowOff.second > low.third - lowOff.third)
        assertEquals("the top is not lit on your turn", tone(off, .08f), tone(mine, .08f))
        // The CPU's turn: the top is lit in its colour (#6fd0a0), the bottom no longer.
        rule.runOnUiThread { st = base.copy(activePlayer = base.cpu.id) }
        val cpuOff = run { rule.runOnUiThread { AppSettings.applyMatchEffects("off") }; shot("cpu-off") }
        rule.runOnUiThread { AppSettings.applyMatchEffects("full") }
        val theirs = shot("cpu")
        val top = tone(theirs, .08f); val topOff = tone(cpuOff, .08f)
        assertTrue("the top is lit on the CPU's turn: $topOff -> $top", top.second > topOff.second + 8f)
        // (Its light is gone 70 % down: read below that, in the gap between the hand and the gold button.)
        assertEquals("the bottom is not", tone(cpuOff, .75f, .805f, .82f), tone(theirs, .75f, .805f, .82f))
    }

    /** F2 at phone size: two of your lands tapped to pay leave a glow in their colour at the table's foot under them; Off draws none. */
    @Test fun tappedLandsGlowAtTheTablesFoot() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        TableFeel.mat = "charcoal-table"
        val me = base.viewer
        fun set(tapped: Set<Int>) = base.copy(activePlayer = base.cpu.id, players = base.players.map { p -> if (p.id == me) p.copy(battlefield = p.battlefield.map { if (it.isLand) it.copy(tapped = it.id in tapped) else it }) else p })
        val lands = base.me.battlefield.filter { it.isLand }.take(2)
        st = set(emptySet())
        val anchors = dev.cardstashy.nativeplay.ui.Anchors()
        rule.setContent {
            androidx.compose.runtime.CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        val plain = shot("mana-before")
        rule.runOnUiThread { st = set(lands.map { it.id }.toSet()) }
        val paid = shot("mana")
        // Read on the bare table just under the left strip's edge of the shelf row: the foot of the table left of the first land.
        val x = anchors.rects.getValue("c${lands[0].id}").center.x / paid.width
        fun foot(b: Bitmap) = tone(b, .985f, (x - .1f).coerceAtLeast(.14f), (x - .06f).coerceAtLeast(.16f))
        val a = foot(plain); val c = foot(paid)
        assertTrue("the foot of the table glows under the tapped lands: $a -> $c", c.first + c.second + c.third > a.first + a.second + a.third + 12f)
        rule.runOnUiThread { AppSettings.applyMatchEffects("off"); st = set(emptySet()) }
        rule.waitForIdle()
        rule.runOnUiThread { st = set(lands.map { it.id }.toSet()) }
        assertEquals("Off: no glow", foot(plain), foot(shot("mana-off")))
    }
}
