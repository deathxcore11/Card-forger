package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.60 Z1 (specs/table-zones-brief.md): the table drawn in its measured zones at the brief's sizes. Every permanent lies on the
 * board; the players' seats, hands and piles stand in the left strip, the menu, phase box and stack card in the right one; no tile
 * lies under any of them; and the stack opening does not move or shrink a single tile (walk line 27). The shots carry the zone boxes
 * drawn over the table (table-look/z1-*.png).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookZ1ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private class Sz(val tag: String, val q: String, val dual: Boolean)
    private val sizes = listOf(
        Sz("844x390", "w844dp-h390dp-land-xxhdpi", false), Sz("904x386", "w904dp-h386dp-land-xxhdpi", false),
        Sz("884x796", "w884dp-h796dp-land-xhdpi", false), Sz("960x540", "w960dp-h540dp-land-xhdpi", false),
        Sz("1280x800", "w1280dp-h800dp-land-mdpi", false), Sz("1920x1080", "w1920dp-h1080dp-land-mdpi", true))

    private fun draw(name: String, st: MatchState, size: Sz, overlay: Boolean): Anchors {
        RuntimeEnvironment.setQualifiers(size.q)
        DualScreen.pretend(if (size.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        var seen: Anchors? = null
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/z1-$name-${size.tag}${if (size.dual) "-dualtop" else ""}.png").path) {
            val anchors = remember { Anchors() }.also { seen = it }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                BoxWithConstraints(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                    if (overlay) {
                        val z = ZoneLayout.of(maxWidth.value, maxHeight.value, dual = DualScreen.active)
                        Canvas(Modifier.fillMaxSize()) {
                            for ((k, b) in z.all) drawRect(if (k == "board") Color(0xAA6FE3FF) else Color(0xCCFF5FA2), Offset(b.x * density, b.y * density),
                                Size(b.w * density, b.h * density), style = Stroke(1.5f * density))
                        }
                    }
                }
            }
        }
        return seen!!
    }

    @Test fun zonesAtEverySize() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val controller = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}")
        for (size in sizes) for (board in listOf("main", "crowded")) {
            val st = controller.paired(state(board))
            val a = draw(board, st, size, overlay = true)
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            val dp = dm.density
            val z = ZoneLayout.of(dm.widthPixels / dp, dm.heightPixels / dp, dual = size.dual)
            fun ZoneLayout.Box.px() = Rect(x * dp, y * dp, right * dp, bottom * dp)
            fun Rect.inside(o: Rect) = left >= o.left - dp && top >= o.top - dp && right <= o.right + dp && bottom <= o.bottom + dp
            val tag = "$board ${size.tag}${if (size.dual) " dual" else ""}"
            val tiles = (st.cpu.battlefield + st.me.battlefield).filter { it.attachedTo == null }.mapNotNull { c -> a.rects["c${c.id}"]?.let { c to it } }
            assertTrue("$tag: no tiles drawn", tiles.isNotEmpty())
            // Every permanent lies on the board.
            for ((c, r) in tiles) assertTrue("$tag: ${c.name} $r off the board ${z.board.px()}", r.inside(z.board.px()))
            // The strips hold the seats, the CPU's hand, the piles, the menu's phase box and the stack card; none of it is on the board.
            val left = listOfNotNull(a.rects["cpuseat"], a.rects["cpuhand"]) + st.players.mapNotNull { a.rects["orb${it.id}"] } + st.players.mapNotNull { a.rects["piles${it.id}"] }
            for (r in left) assertTrue("$tag: $r outside the left strip ${z.leftStrip.px()}", r.inside(z.leftStrip.px()))
            val right = listOfNotNull(a.rects["phasetrack"], a.rects["stackcard"], a.rects["stacklabel"])
            assertTrue("$tag: no phase box", a.rects["phasetrack"] != null)
            for (r in right) assertTrue("$tag: $r outside the right strip ${z.rightStrip.px()}", r.inside(z.rightStrip.px()))
            a.rects["stackcard"]?.let { assertTrue("$tag: the stack card $it takes board width ${z.board.px()}", it.left > z.board.px().right) }
            // No tile under any of the chrome.
            val chrome = listOf("cpuseat", "cpuhand", "phasetrack", "stackcard", "stacklabel", "gold", "quiet", "undo", "tools") + st.players.flatMap { listOf("orb${it.id}", "piles${it.id}") }
            for (k in chrome) a.rects[k]?.let { box -> for ((c, r) in tiles) assertTrue("$tag: ${c.name} $r under $k $box", !r.deflate(1f).overlaps(box)) }
            println("[z1] $tag board ${z.board} stack ${a.rects["stackcard"]?.let { "${it.width / dp}x${it.height / dp}" }}")
        }
    }

    /** Walk line 27: the same table with and without a stack; no tile moves or changes size. */
    @Test fun theStackOpeningMovesNoTile() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { _, _ -> null }
        val withStack = state("crowded")
        assertTrue("the crowded table has a stack", withStack.stack.isNotEmpty())
        val without = withStack.copy(stack = emptyList())
        for (size in sizes) {
            val open = draw("stack-open", withStack, size, overlay = false)
            val shut = draw("stack-shut", without, size, overlay = false)
            for (c in (withStack.cpu.battlefield + withStack.me.battlefield).filter { it.attachedTo == null }) {
                val r1 = open.rects["c${c.id}"] ?: continue; val r2 = shut.rects["c${c.id}"] ?: continue
                assertTrue("${size.tag}: ${c.name} moved with the stack: $r2 to $r1",
                    kotlin.math.abs(r1.left - r2.left) < 1f && kotlin.math.abs(r1.top - r2.top) < 1f && kotlin.math.abs(r1.width - r2.width) < 1f && kotlin.math.abs(r1.height - r2.height) < 1f)
            }
        }
    }
}
