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
import org.junit.Assert.assertNull
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
 * 0.4.60 Z7 (specs/table-zones-brief.md, "Commander marks"): a Commander match from a bridge-shaped snapshot (table/snap-commander.json):
 * your Klothys in the command zone (Forge's tax +2), the CPU's Talrand on the battlefield (tax +4, "In play", a crown on its tile),
 * "Cmdr damage 7/21" by your life and "0/21" by the CPU's. Pictures in table-look/z7-commander-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class TableLookZ7ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "table-look/z7-$name.png").path

    @After fun off() { DualScreen.pretend(null); Pad.forget(); TableEmotes.menuOpen = false }

    private class Sz(val tag: String, val q: String)
    private val sizes = listOf(Sz("844x390", "w844dp-h390dp-land-xxhdpi"), Sz("960x540", "w960dp-h540dp-land-xhdpi"), Sz("1280x800", "w1280dp-h800dp-land-mdpi"))

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

    @Test fun commanderMarksInACommanderMatch() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val st = state("commander")
        val me = st.me; val cpu = st.cpu
        val talrand = cpu.battlefield.single { it.commander }
        for (size in sizes) {
            val (a, path) = draw("commander", st, size)
            val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
            fun Rect.inside(o: Rect) = left >= o.left - dp && top >= o.top - dp && right <= o.right + dp && bottom <= o.bottom + dp
            val tag = size.tag
            // Both shields stay: yours in the command zone, the CPU's while its commander is on the battlefield.
            val myCrest = a.rects["crest${me.id}"]; val cpuCrest = a.rects["crest${cpu.id}"]
            assertNotNull("$tag: no shield for you", myCrest); assertNotNull("$tag: no shield for the CPU while Talrand is in play", cpuCrest)
            // The tax badges carry Forge's numbers and sit on their shields.
            assertEquals("$tag: your tax", 2f, a.sizes["cmdtaxn${me.id}"])
            assertEquals("$tag: the CPU's tax", 4f, a.sizes["cmdtaxn${cpu.id}"])
            for (id in listOf(me.id, cpu.id)) {
                val b = a.rects["cmdtax$id"]; assertNotNull("$tag: no tax badge for $id", b)
                assertTrue("$tag: tax badge $b off its shield ${a.rects["crest$id"]}", b!!.overlaps(a.rects.getValue("crest$id")))
            }
            // "In play" on the CPU's shield only.
            val inPlay = a.rects["cmdinplay${cpu.id}"]; assertNotNull("$tag: no In play tag", inPlay)
            assertTrue("$tag: In play $inPlay off the shield $cpuCrest", inPlay!!.overlaps(cpuCrest!!))
            assertNull("$tag: In play on a shield in the command zone", a.rects["cmdinplay${me.id}"])
            // The crown on Talrand's tile, and on no other.
            assertEquals("$tag: no crown on Talrand", 1f, a.sizes["crown${talrand.id}"])
            assertEquals("$tag: crowns on other tiles", listOf("crown${talrand.id}"), a.sizes.keys.filter { it.startsWith("crown") })
            // Commander damage by each life total, inside its square, clear of the life pill and the graveyard.
            for (p in listOf(me, cpu)) {
                val sq = a.rects.getValue("square${p.id}")
                val dmg = a.rects["cmdrdmg${p.id}"]; assertNotNull("$tag: no commander damage for ${p.name}", dmg)
                assertTrue("$tag: ${p.name}'s commander damage $dmg outside the square $sq", dmg!!.inside(sq))
                for (k in listOf("lifepill${p.id}", "piles${p.id}", "orb${p.id}")) {
                    val r = a.rects[k]; assertNotNull("$tag: no $k", r)
                    assertTrue("$tag: ${p.name}'s commander damage $dmg meets $k $r", !dmg.overlaps(r!!))
                    assertTrue("$tag: $k $r outside ${p.name}'s square $sq", r.inside(sq))
                }
            }
            val tools = a.rects.getValue("tools")
            assertTrue("$tag: CPU shield $cpuCrest meets your tools $tools", !cpuCrest.overlaps(tools))
            // The picture: the crown is gold, standing above Talrand's tile.
            val bmp = BitmapFactory.decodeFile(path)
            val tile = a.rects.getValue("c${talrand.id}")
            val gold = (2..12).count { i ->
                val y = (tile.top - i * dp).toInt().coerceIn(0, bmp.height - 1); val px = bmp.getPixel(tile.center.x.toInt().coerceIn(0, bmp.width - 1), y)
                android.graphics.Color.red(px) > 190 && android.graphics.Color.green(px) > 140 && android.graphics.Color.blue(px) < 150
            }
            assertTrue("$tag: no gold crown above Talrand's tile ($gold gold pixels)", gold >= 3)
            println("[z7] $tag crest me $myCrest cpu $cpuCrest dmg ${a.rects["cmdrdmg${me.id}"]} ${a.rects["cmdrdmg${cpu.id}"]} crown gold $gold")
        }
    }
}
