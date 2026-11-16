package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
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
 * Mobile table M5 at phone size (specs/mobile-table-arena-parity-brief.md; Randall 11 Nov: "i dont want to see the glass in real
 * game"): the hand is 31 % of the height with its foot below the edge and nothing drawn behind it; on the CPU's turn it sinks
 * until 14 % of the height shows. Pictures in table-look/m5-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM5HandShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)

    private fun draw(st: MatchState, live: Boolean, file: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/$file.png")
        captureRoboImage(f.path) {
            CompositionLocalProvider(LocalAnchors provides Anchors()) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = live, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return BitmapFactory.decodeFile(f.path)
    }
    /** Share of pixels that differ in the dp box [x0, x1) x [y0, y1). */
    private fun diff(a: Bitmap, c: Bitmap, x0: Float, y0: Float, x1: Float, y1: Float): Float {
        val k = a.width / 844f; var n = 0; var all = 0
        for (y in (y0 * k).toInt().coerceAtLeast(0) until (y1 * k).toInt().coerceAtMost(a.height) step 2) for (x in (x0 * k).toInt().coerceAtLeast(0) until (x1 * k).toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theHandIsBigHasNothingBehindItAndSinksOnTheCpusTurn() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val z = ZoneLayout.of(844f, 390f); val h = ZoneLayout.hand(z, base.me.hand.size)!!; val band = z.handTray!!
        val none = base.copy(players = base.players.map { if (it.id == base.viewer) it.copy(hand = emptyList()) else it })
        val mine = draw(base, true, "m5-your-turn")
        val bare = draw(none, true, "m5-no-hand")
        // The hand shows from 31 % x 94 % of the height up from the bottom edge, across the cards' reach.
        assertTrue("the hand fills its room: ${diff(mine, bare, h.tray.x + 10f, band.y + 12f, h.tray.right - 10f, 390f)}", diff(mine, bare, h.tray.x + 10f, band.y + 12f, h.tray.right - 10f, 390f) > .6f)
        // Nothing behind it: no tray, glass or shade above the cards or beside them.
        // (Drawn with no card lit, so no card's own glow reaches past it.)
        val quiet = draw(base, false, "m5-quiet"); val bareQuiet = draw(none, false, "m5-quiet-no-hand")
        assertEquals("nothing above the hand", 0f, diff(quiet, bareQuiet, band.x, band.y - 20f, band.right, band.y - 12f), .001f)
        assertEquals("nothing left of the hand", 0f, diff(quiet, bareQuiet, h.tray.x - 60f, band.y + 20f, h.tray.x - 44f, 390f), .001f)
        // The CPU's turn: the hand sinks; only the bottom 14 % of the height still shows cards.
        val cpu = base.players.first { it.id != base.viewer }.id
        val theirs = draw(base.copy(activePlayer = cpu, priorityPlayer = cpu), false, "m5-cpu-turn")
        val bareTheirs = draw(none.copy(activePlayer = cpu, priorityPlayer = cpu), false, "m5-cpu-turn-no-hand")
        val sunkTop = 390f * (1f - .14f)
        assertEquals("above the sunk hand the table is clear", 0f, diff(theirs, bareTheirs, band.x, band.y - 16f, band.right, sunkTop - 10f), .002f)
        assertTrue("the sunk hand still shows: ${diff(theirs, bareTheirs, h.tray.x + 10f, sunkTop + 10f, h.tray.right - 10f, 390f)}", diff(theirs, bareTheirs, h.tray.x + 10f, sunkTop + 10f, h.tray.right - 10f, 390f) > .5f)
    }
}
