package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
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
 * 0.4.59 T1 (fault 18): the crowded board at the brief's five sizes, one screen and the dual top screen. Every permanent's tile
 * stays inside the screen, both creature rows have one tile size, and no tile of one row lies on a tile of another row.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookT1ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String): MatchState {
        if (s != "full") return MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
        // Review fix: both sides full. Twelve CPU creatures (its row reaches the CPU's piles' side) and your back row filled
        // with twelve different permanents (it reaches the buttons on the right).
        val st = state("crowded")
        val bear = st.cpu.battlefield.first { it.isCreature }
        val land = st.me.battlefield.first { it.isLand }
        val cpu = st.cpu.copy(battlefield = st.cpu.battlefield.filter { !it.isCreature } + List(12) { i -> bear.copy(id = 900 + i, name = "Grizzly Bears ${i + 1}") })
        val me = st.me.copy(battlefield = st.me.battlefield.filter { it.isCreature } + List(12) { i -> land.copy(id = 950 + i, name = "Mountain ${i + 1}", tapped = i % 3 == 0) })
        return st.copy(players = st.players.map { if (it.id == st.viewer) me else cpu })
    }

    @After fun off() { DualScreen.pretend(null) }

    @Test fun boardsAtEverySize() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val sizes = listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "904x386" to "w904dp-h386dp-land-xxhdpi", "884x796" to "w884dp-h796dp-land-xhdpi",
            "960x540" to "w960dp-h540dp-land-xhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi", "1920x1080" to "w1920dp-h1080dp-land-mdpi")
        for ((size, q) in sizes) for (dual in listOf(false, true)) for (board in listOf("main", "crowded", "full", "realblock")) {
            RuntimeEnvironment.setQualifiers(q)
            DualScreen.pretend(if (dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
            val st = state(board).let { if (board == "full") it else dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}").paired(it) }
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            var seen: Anchors? = null
            captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t1-$board-$size${if (dual) "-dualtop" else ""}.png").path) {
                val anchors = remember { Anchors() }.also { seen = it }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                    }
                }
            }
            val a = seen!!
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            val screen = Rect(0f, 0f, dm.widthPixels.toFloat(), dm.heightPixels.toFloat())
            fun rects(cards: List<dev.cardstashy.nativeplay.engine.Card>) = cards.mapNotNull { c -> a.rects["c${c.id}"]?.let { c to it } }
            val cpuF = rects(st.cpu.battlefield.filter { it.isCreature && it.attachedTo == null })
            val meF = rects(st.me.battlefield.filter { it.isCreature && it.attachedTo == null })
            val all = rects((st.cpu.battlefield + st.me.battlefield).filter { it.attachedTo == null })
            for ((c, r) in all) assertTrue("$size dual=$dual ${c.name} cut: $r", r.left >= screen.left - 1 && r.right <= screen.right + 1 && r.top >= -1 && r.bottom <= screen.bottom + 1)
            // No tile lies on a player's library or graveyard.
            for (pl in st.players) a.rects["piles${pl.id}"]?.let { pile -> for ((c, r) in all) assertTrue("$board $size dual=$dual ${c.name} on piles${pl.id}: $r $pile", !r.deflate(2f).overlaps(pile)) }
            // No tile of one row lies on a tile of another row: tapped ones turned, attackers stepped forward (review fix).
            fun rowOf(c: dev.cardstashy.nativeplay.engine.Card) = (if (c.controller == st.viewer) 2 else 0) + (if (c.isCreature) 1 else 0).let { if (c.controller == st.viewer) 1 - it else it }
            for ((c1, r1) in all) for ((c2, r2) in all) if (rowOf(c1) < rowOf(c2))
                assertTrue("$board $size dual=$dual ${c1.name} on ${c2.name}: $r1 $r2", !r1.deflate(1f).overlaps(r2.deflate(1f)))
            // Your back row ends before the button row on the right (review fix).
            a.rects["buttonRow"]?.takeIf { it.width > 0f }?.let { row -> for ((c, r) in rects(st.me.battlefield.filter { !it.isCreature && it.attachedTo == null }))
                assertTrue("$board $size dual=$dual ${c.name} under the buttons: $r $row", !r.deflate(1f).overlaps(row)) }
            // Same tile size both sides (untapped tiles; a tapped one is turned).
            val hs = (cpuF + meF).filter { !it.first.tapped }.map { it.second.height }
            if (hs.isNotEmpty()) assertTrue("$size creature heights $hs", hs.max() - hs.min() < 2f)
            println("[t1] $board $size dual=$dual creature tile ${hs.firstOrNull()?.div(dm.density)} dp of ${dm.heightPixels / dm.density} dp")
        }
    }
}
