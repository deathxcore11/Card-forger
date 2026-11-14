package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.BottomRoot
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.MullDeck
import dev.cardstashy.nativeplay.ui.Mulligan
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import org.junit.After
import org.junit.Assert.assertNotNull
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
 * 0.4.59 T9 on two screens (Thor 1240x1080): the opening hand's bottom screen has no logo; the card under the ring is read on the
 * left, three tiles (who plays first, this hand, your deck) and Keep and Mulligan with its line on the right, nothing overlapping and
 * no dead space (the panel and the tiles fill the screen's height).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w620dp-h1080dp-xhdpi")
class TableLookT9ShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    @After fun off() { DualScreen.pretend(null) }

    @Test fun theOpeningHandsBottomScreenIsInUse() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-opening.json")!!.readText())!!
        val anchors = Anchors()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Column(Modifier.fillMaxSize().background(Palette.Night)) {
                    Box(Modifier.fillMaxWidth().weight(1f)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalMatchClock provides dev.cardstashy.nativeplay.match.MatchController.Clock(android.os.SystemClock.elapsedRealtime() + 21_000, 30_000)) {
                            Mulligan(st, live = true, onOk = {}, onCancel = {}, onCard = {}, onDeal = {}, onHold = {}, deck = MullDeck("Mono-White Auras", "Modern", 60))
                        }
                    }
                    Box(Modifier.fillMaxWidth().weight(1f)) { BottomRoot() }
                }
            }
        }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t9-mulligan-dual-1240x1080.png").path)
        val r = anchors.rects
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        val half = dm.heightPixels / 2f
        val keys = listOf("m.read", "m.first", "m.hand", "m.deck", "m.keep", "m.mull", "m.line")
        for (k in keys) { val x = r[k]; assertNotNull("bottom: $k", x); assertTrue("$k on the bottom screen: $x", x!!.top >= half - 1f && x.bottom <= dm.heightPixels + 1f) }
        fun apart(a: Rect, b: Rect) = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
        for (i in keys.indices) for (j in i + 1 until keys.size) assertTrue("${keys[i]} ${r[keys[i]]} meets ${keys[j]} ${r[keys[j]]}", apart(r.getValue(keys[i]), r.getValue(keys[j])))
        // No dead space: the panel stands most of the bottom's height, and Keep and Mulligan sit at its foot.
        assertTrue("the panel fills the bottom ${r["m.read"]}", r.getValue("m.read").height >= half * .8f)
        assertTrue("Mulligan's line near the foot ${r["m.line"]}", r.getValue("m.line").bottom >= dm.heightPixels - half * .15f)
        // The top screen has no Keep or Mulligan of its own (one place for each thing).
        assertTrue("no gold button on top", r["gold"] == null || r.getValue("gold").top >= half)
    }

    /** One screen: the line sits under Keep and Mulligan in one line, clear of both buttons and of the caption, on screen. */
    @Test @Config(qualifiers = "w844dp-h390dp-land-xxhdpi") fun phone() = oneScreen("844x390")
    @Test @Config(qualifiers = "w960dp-h840dp-land-xhdpi") fun tall() = oneScreen("960x840")

    private fun oneScreen(size: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-opening.json")!!.readText())!!
        val anchors = Anchors()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalMatchClock provides dev.cardstashy.nativeplay.match.MatchController.Clock(android.os.SystemClock.elapsedRealtime() + 21_000, 30_000)) {
                        Mulligan(st, live = true, onOk = {}, onCancel = {}, onCard = {}, onDeal = {}, onHold = {})
                    }
                }
            }
        }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t9-mulligan-$size.png").path)
        val r = anchors.rects
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        fun apart(a: Rect, b: Rect) = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
        val line = r["mull.line"]; assertNotNull("$size: the line", line)
        for (k in listOf("gold", "mull", "mull.caption")) assertTrue("$size: line $line meets $k ${r[k]}", apart(line!!, r.getValue(k)))
        assertTrue("$size: under Mulligan", line!!.top >= r.getValue("mull").bottom)
        assertTrue("$size: on screen $line", line.bottom <= dm.heightPixels + 1f && line.right <= dm.widthPixels + 1f && line.left >= 0f)
        assertTrue("$size: Mulligan and Keep side by side", kotlin.math.abs(r.getValue("mull").center.y - r.getValue("gold").center.y) < 4f)
    }
}
