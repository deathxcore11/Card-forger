package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toArgb
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.SideCpu
import dev.cardstashy.nativeplay.ui.SideYours
import dev.cardstashy.nativeplay.ui.TableIntents
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
 * Mobile table M2 at phone size: a target question that offers both sides draws YOURS (blue) on your offered creatures and
 * CPU'S (red) on the CPU's; the same question with only the CPU's creatures offered draws no tag. Pictures in table-look/m2-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM2ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!.let { it.copy(selection = it.selection.copy(chosenCards = emptySet())) }

    private fun draw(anchors: Anchors, st: MatchState, file: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/$file.png")
        captureRoboImage(f.path) {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return BitmapFactory.decodeFile(f.path)
    }
    /** Pixels of exactly [argb] in the band over the top edge of [r], where the tag sits. */
    private fun tagPixels(b: Bitmap, r: Rect, argb: Int): Int {
        val k = b.width / 844f; var n = 0
        for (y in (r.top - 16 * k).toInt().coerceAtLeast(0) until (r.top + 4 * k).toInt()) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(b.width)) if (b.getPixel(x, y) == argb) n++
        return n
    }

    @Test fun eachOfferedCreatureSaysWhoseItIs() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val mine = base.me.battlefield.first { it.id in base.selection.targetCards && it.isCreature }
        val theirs = base.cpu.battlefield.first { it.id in base.selection.targetCards && it.isCreature }
        val anchors = Anchors()
        val both = draw(anchors, base, "m2-both-sides")
        val my = anchors.rects.getValue("c${mine.id}"); val cpu = anchors.rects.getValue("c${theirs.id}")
        assertTrue("YOURS over ${mine.name}: ${tagPixels(both, my, SideYours.toArgb())}", tagPixels(both, my, SideYours.toArgb()) > 300)
        assertTrue("CPU'S over ${theirs.name}: ${tagPixels(both, cpu, SideCpu.toArgb())}", tagPixels(both, cpu, SideCpu.toArgb()) > 300)
        assertEquals("no red on yours", 0, tagPixels(both, my, SideCpu.toArgb()))
        // One side only: the ring, no tag (and no red: the CPU's creature keeps the target ring it had).
        val cpuOnly = base.copy(selection = base.selection.copy(targetCards = base.selection.targetCards.filter { id -> base.cpu.battlefield.any { it.id == id } }.toSet()))
        val one = draw(Anchors(), cpuOnly, "m2-one-side")
        assertEquals("no tag with one side offered", 0, tagPixels(one, cpu, SideCpu.toArgb()))
    }
}
