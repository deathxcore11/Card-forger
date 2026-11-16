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
import dev.cardstashy.nativeplay.engine.Card
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
 * 0.4.60 Z2 (specs/table-zones-brief.md, "Tile height is fixed, crowding squeezes sideways"): ten different creatures a side with the
 * stack open, at the brief's sizes. The creature tiles are as tall as with one creature a side; both rows share one size; a phone
 * tile is at least 59 × 80 dp and the Portal's (960 × 540) 82 × 111 (half a dp allowed for the mockup's rounding); no name is cut;
 * and where piles overlap, every P/T plate is clear of the tiles over it (walk line 26). Shots in table-look/z2-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookZ2ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private class Sz(val tag: String, val q: String, val dual: Boolean, val least: Pair<Float, Float>? = null)
    private val sizes = listOf(
        // Mobile table M5 replaces the phone's floor (the brief's "Phone conflicts from the full picture run"): 18.5 % of the height.
        Sz("844x390", "w844dp-h390dp-land-xxhdpi", false, 59f to 72f), Sz("904x386", "w904dp-h386dp-land-xxhdpi", false),
        Sz("884x796", "w884dp-h796dp-land-xhdpi", false), Sz("960x540", "w960dp-h540dp-land-xhdpi", false, 82f to 111f),
        Sz("1280x800", "w1280dp-h800dp-land-mdpi", false), Sz("1920x1080", "w1920dp-h1080dp-land-mdpi", true),
        Sz("960x540", "w960dp-h540dp-land-xhdpi", true))

    private val cpuNames = listOf("Grizzly Bears", "Llanowar Elves", "Elvish Mystic", "Attercop", "Bloom Tender", "Savannah Lions", "Hill Giant",
        "Serra Angel", "Goblin Guide", "Sun-Crested Pterodon")
    private val myNames = listOf("Optimistic Scavenger", "Spellbook Vendor", "Ajani's Pridemate", "Healer's Hawk", "Raging Goblin", "Wind Drake",
        "Shivan Dragon", "Wood Elves", "Benalish Marshal", "Thraben Inspector")

    /** The crowded table (its stack open) with each side's creatures replaced by ten different ones, untapped, nothing on them. */
    private fun tenASide(): MatchState {
        val st = state("crowded")
        val base = (st.cpu.battlefield + st.me.battlefield).first { it.isCreature && it.attachedTo == null }
        fun ten(p: Int, names: List<String>, from: Int) = names.mapIndexed { i, n ->
            base.copy(id = from + i, name = n, owner = p, controller = p, tapped = false, attacking = false, blocking = false, damage = 0, counters = emptyMap(),
                attachments = emptyList(), attachedTo = null, summoningSick = false, power = 1 + i % 4, toughness = 1 + (i + 1) % 4) }
        fun keep(p: dev.cardstashy.nativeplay.engine.Player) = p.battlefield.filter { it.isLand && it.attachedTo == null && it.attachments.isEmpty() }
        val cpu = st.cpu.copy(battlefield = keep(st.cpu) + ten(st.cpu.id, cpuNames, 900))
        val me = st.me.copy(battlefield = keep(st.me) + ten(st.me.id, myNames, 950))
        return st.copy(players = st.players.map { if (it.id == st.viewer) me else if (it.id == st.cpu.id) cpu else it })
    }

    private fun draw(name: String, st: MatchState, size: Sz): Anchors {
        RuntimeEnvironment.setQualifiers(size.q)
        DualScreen.pretend(if (size.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        var seen: Anchors? = null
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/z2-$name-${size.tag}${if (size.dual) "-dualtop" else ""}.png").path) {
            val anchors = remember { Anchors() }.also { seen = it }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return seen!!
    }

    @Test fun tenPilesASideWithTheStackOpen() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val controller = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}")
        val crowded = controller.paired(tenASide())
        assertTrue("the stack is open", crowded.stack.isNotEmpty())
        val sparse = controller.paired(crowded.copy(players = crowded.players.map { p -> p.copy(battlefield = p.battlefield.filter { it.isLand } + p.battlefield.filter { !it.isLand }.take(1)) }))
        for (size in sizes) {
            val tag = "${size.tag}${if (size.dual) " dual" else ""}"
            val one = draw("one-a-side", sparse, size)
            val a = draw("ten-a-side", crowded, size)
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            val dp = dm.density
            val z = ZoneLayout.of(dm.widthPixels / dp, dm.heightPixels / dp, dual = size.dual)
            val board = Rect(z.board.x * dp, z.board.y * dp, z.board.right * dp, z.board.bottom * dp)
            fun row(cs: List<Card>) = cs.filter { it.isCreature }.map { c -> c to (a.rects["c${c.id}"] ?: error("$tag: no tile for ${c.name}")) }.sortedBy { it.second.left }
            val cpuRow = row(crowded.cpu.battlefield); val myRow = row(crowded.me.battlefield)
            assertTrue("$tag: ten a side", cpuRow.size == 10 && myRow.size == 10)
            // The height never changes: as tall as one creature a side; both rows one size.
            val oneH = (sparse.cpu.battlefield + sparse.me.battlefield).filter { it.isCreature }.mapNotNull { one.rects["c${it.id}"]?.height }
            assertTrue("$tag: no lone tile", oneH.isNotEmpty())
            val all = cpuRow + myRow
            for ((c, r) in all) {
                assertTrue("$tag: ${c.name} ${r.height / dp} dp tall, one a side ${oneH.first() / dp}", kotlin.math.abs(r.height - oneH.first()) < 1.5f)
                assertTrue("$tag: ${c.name} ${r.width / dp} dp wide, not ${all.first().second.width / dp}", kotlin.math.abs(r.width - all.first().second.width) < 1.5f)
                assertTrue("$tag: ${c.name} $r off the board $board", r.left >= board.left - dp && r.right <= board.right + dp && r.top >= board.top - dp && r.bottom <= board.bottom + dp)
            }
            val w = all.first().second.width / dp; val h = all.first().second.height / dp
            size.least?.let { (lw, lh) -> assertTrue("$tag: a tile is $w × $h dp, the brief wants at least $lw × $lh", w >= lw - .5f && h >= lh - .5f) }
            // No name cut.
            for ((c, _) in all) assertTrue("$tag: ${c.name}'s name is cut", a.rects["namecut${c.id}"] == null)
            // Overlap from the right: each later tile lies over the one before, never over its P/T plate.
            for (rowNow in listOf(cpuRow, myRow)) rowNow.forEachIndexed { i, (c, _) ->
                val pt = a.rects["pt${c.id}"] ?: error("$tag: no P/T for ${c.name}")
                for ((o, r) in rowNow.drop(i + 1)) assertTrue("$tag: ${o.name} $r covers ${c.name}'s P/T $pt", !pt.deflate(1f).overlaps(r))
            }
            val overlap = cpuRow.zipWithNext().any { (p, q) -> q.second.left < p.second.right - dp }
            println("[z2] $tag tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp, overlapping=$overlap")
        }
    }
}
