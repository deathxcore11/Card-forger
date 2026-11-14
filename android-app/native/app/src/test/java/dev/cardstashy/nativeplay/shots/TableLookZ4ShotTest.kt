package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import dev.cardstashy.nativeplay.ui.padRoot
import org.junit.After
import org.junit.Assert.assertEquals
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
 * 0.4.60 Z4 (specs/table-zones-brief.md, "Player squares in the corners"): a glass square per player, the CPU's top left and yours
 * bottom left, each with its name, the round portrait with the life on its gold pill, "Hand N" and "Deck N" in words and the
 * graveyard's top card with its count; the active player's square wears the gold edge. Chat and the bolt keep their function at
 * 44 dp above your square. Pictures at phone (844 × 390) and Portal (960 × 540) size, on your turn and the CPU's, in
 * table-look/z4-*.png. The graveyard by touch and pad, and chat and the bolt at work: PlayerSquareTouchTest.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class TableLookZ4ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "table-look/z4-$name.png").path

    @After fun off() { DualScreen.pretend(null); Pad.forget(); TableEmotes.menuOpen = false }

    private class Sz(val tag: String, val q: String)
    private val sizes = listOf(Sz("844x390", "w844dp-h390dp-land-xxhdpi"), Sz("960x540", "w960dp-h540dp-land-xhdpi"))

    /** The board alone (no rule), drawn and saved as a picture; returns its anchors and the picture's file. */
    private fun draw(name: String, st: MatchState, size: Sz): Pair<Anchors, String> {
        RuntimeEnvironment.setQualifiers(size.q)
        TableEmotes.destroy()
        var seen: Anchors? = null
        val path = shot("$name-${size.tag}")
        captureRoboImage(path) {
            val anchors = remember { Anchors() }.also { seen = it }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return seen!! to path
    }

    @Test fun squaresStandInTheCornersAtPhoneAndPortal() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val base = state("crowded")
        for (size in sizes) for ((turn, active) in listOf("yours" to base.viewer, "cpu" to base.cpu.id)) {
            val st = base.copy(activePlayer = active)
            val (a, path) = draw(turn, st, size)
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            val dp = dm.density
            val z = ZoneLayout.of(dm.widthPixels / dp, dm.heightPixels / dp)
            fun ZoneLayout.Box.px() = Rect(x * dp, y * dp, right * dp, bottom * dp)
            fun Rect.inside(o: Rect) = left >= o.left - dp && top >= o.top - dp && right <= o.right + dp && bottom <= o.bottom + dp
            val tag = "${size.tag} ($turn turn)"
            // Each square fills its corner: the CPU's top left, yours bottom left.
            for ((p, corner) in listOf(st.cpu to z.cpuSquare, st.me to z.mySquare)) {
                val sq = a.rects["square${p.id}"]; assertNotNull("$tag: no square for ${p.name}", sq)
                assertEquals("$tag: ${p.name}'s square left", corner.px().left, sq!!.left, dp)
                assertEquals("$tag: ${p.name}'s square top", corner.px().top, sq.top, dp)
                assertEquals("$tag: ${p.name}'s square width", corner.px().width, sq.width, dp)
                assertEquals("$tag: ${p.name}'s square height", corner.px().height, sq.height, dp)
                assertTrue("$tag: ${p.name}'s square $sq outside the left strip", sq.inside(z.leftStrip.px()))
                // Its portrait, its graveyard (card and count) and its deck's words lie inside it.
                for (k in listOf("orb${p.id}", "grave${p.id}", "piles${p.id}", "lib${p.id}")) {
                    val r = a.rects[k]; assertNotNull("$tag: no $k", r)
                    assertTrue("$tag: $k $r outside ${p.name}'s square $sq", r!!.inside(sq))
                }
                // The life on its gold pill, never under 19 sp.
                assertTrue("$tag: ${p.name}'s life ${a.sizes["lifesp${p.id}"]} sp", (a.sizes["lifesp${p.id}"] ?: 0f) >= 19f)
                // The gold edge on the active player's square only.
                assertEquals("$tag: ${p.name}'s gold edge", p.id == active, a.sizes["squareactive${p.id}"] == 1f)
            }
            // The CPU's hand is its words in its square. Mobile table M12 (the newer brief): the fan of backs at the top edge is
            // "cpuhand" now (MobileM12ShotTest), so the words carry their own key.
            val cpuHand = a.rects["cpuhandwords"]; assertNotNull("$tag: no CPU hand words", cpuHand)
            assertTrue("$tag: CPU hand $cpuHand outside its square", cpuHand!!.inside(a.rects.getValue("square${st.cpu.id}")))
            // The picture: the active square's top edge is gold, the other's a faint hairline.
            val bmp = BitmapFactory.decodeFile(path)
            fun edgeRed(r: Rect): Int = (0..4).maxOf { i -> val y = (r.top + i).toInt().coerceIn(0, bmp.height - 1); android.graphics.Color.red(bmp.getPixel(r.center.x.toInt(), y)) }
            val on = a.rects.getValue("square$active"); val off = a.rects.getValue("square${st.players.first { it.id != active }.id}")
            assertTrue("$tag: the active square's edge is not gold (red ${edgeRed(on)})", edgeRed(on) >= 170)
            assertTrue("$tag: the other square's edge is gold too (red ${edgeRed(off)})", edgeRed(off) < 170)
            // Chat and the bolt above your square, in the left strip, off the board.
            val tools = a.rects["tools"]; assertNotNull("$tag: no chat and bolt", tools)
            assertTrue("$tag: tools $tools outside the left strip", tools!!.inside(z.leftStrip.px()))
            assertTrue("$tag: tools $tools not above your square", tools.bottom <= a.rects.getValue("square${st.viewer}").top + 1f)
            assertTrue("$tag: tools $tools under 44 dp", tools.height >= 44f * dp - 1f)
            a.rects["cpucrest"]?.let { c -> assertTrue("$tag: CPU crest $c meets your tools $tools", !c.overlaps(tools)) }
            println("[z4] $tag cpu ${a.rects["square${st.cpu.id}"]} me ${a.rects["square${st.viewer}"]} tools $tools")
        }
    }
}
