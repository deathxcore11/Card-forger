package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
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
import dev.cardstashy.nativeplay.ui.TextFloors
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
 * 0.4.60 Z3 (specs/table-zones-brief.md, "Text floors"): "Optimistic Scavenger" and "Spellbook Vendor" on the table at every size of
 * the brief (and the smallest phone, 640 × 360, roomy only), roomy (three creatures a side, full-width tiles) and squeezed (ten a side, tiles
 * cropped narrow). Their names are never cut (no overflow, no word broken), at 11 sp on at most two lines (9.5 sp on at most three
 * when squeezed), times the tile's scale on a bigger screen; P/T 15 sp; land names 10 sp; life 19 sp; phase dots 8 dp.
 * Shots in table-look/z3-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookZ3ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private class Sz(val tag: String, val q: String, val dual: Boolean)
    private val sizes = listOf(
        Sz("640x360", "w640dp-h360dp-land-xhdpi", false), Sz("844x390", "w844dp-h390dp-land-xxhdpi", false), Sz("904x386", "w904dp-h386dp-land-xxhdpi", false),
        Sz("884x796", "w884dp-h796dp-land-xhdpi", false), Sz("960x540", "w960dp-h540dp-land-xhdpi", false),
        Sz("1280x800", "w1280dp-h800dp-land-mdpi", false), Sz("1920x1080", "w1920dp-h1080dp-land-mdpi", true),
        Sz("960x540", "w960dp-h540dp-land-xhdpi", true))

    private val the2 = listOf("Optimistic Scavenger", "Spellbook Vendor")
    private val fill = listOf("Grizzly Bears", "Llanowar Elves", "Elvish Mystic", "Attercop", "Bloom Tender", "Savannah Lions", "Hill Giant", "Serra Angel")

    /** The crowded table (its stack open) with each side's creatures replaced by [n] different ones, the two long names among them. */
    private fun aSide(n: Int): MatchState {
        val st = state("crowded")
        val base = (st.cpu.battlefield + st.me.battlefield).first { it.isCreature && it.attachedTo == null }
        val names = (the2 + fill).take(n)
        fun side(p: Int, from: Int) = names.mapIndexed { i, nm ->
            base.copy(id = from + i, name = nm, owner = p, controller = p, tapped = false, attacking = false, blocking = false, damage = 0, counters = emptyMap(),
                attachments = emptyList(), attachedTo = null, summoningSick = false, power = 1 + i % 4, toughness = 1 + (i + 1) % 4) }
        fun keep(p: dev.cardstashy.nativeplay.engine.Player) = p.battlefield.filter { it.isLand && it.attachedTo == null && it.attachments.isEmpty() }
        val cpu = st.cpu.copy(battlefield = keep(st.cpu) + side(st.cpu.id, 900))
        val me = st.me.copy(battlefield = keep(st.me) + side(st.me.id, 950))
        return st.copy(players = st.players.map { if (it.id == st.viewer) me else if (it.id == st.cpu.id) cpu else it })
    }

    private fun draw(name: String, st: MatchState, size: Sz): Anchors {
        RuntimeEnvironment.setQualifiers(size.q)
        DualScreen.pretend(if (size.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        var seen: Anchors? = null
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/z3-$name-${size.tag}${if (size.dual) "-dualtop" else ""}.png").path) {
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

    @Test fun longNamesAreNeverCutAtTheirFloors() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val controller = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}")
        val roomy = controller.paired(aSide(3)); val squeezed = controller.paired(aSide(10))
        for (size in sizes) for ((label, st) in listOf("roomy" to roomy, "squeezed" to squeezed)) {
            // The smallest phone (not one of the brief's sizes) roomy only: with ten piles there the tiles overlap, and the part of a
            // tile that shows (about 44 dp) is narrower than "Optimistic" at 9.5 sp.
            if (size.tag == "640x360" && label == "squeezed") continue
            val tag = "${size.tag}${if (size.dual) " dual" else ""} $label"
            val a = draw(label, st, size)
            val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
            val creatures = (st.cpu.battlefield + st.me.battlefield).filter { it.isCreature }
            val front = creatures.mapNotNull { a.rects["c${it.id}"] }.also { assertTrue("$tag: no creature tiles", it.isNotEmpty()) }
            val h = front.first().height / dp; val w = front.first().width / dp
            // The two states are what they say: full-width tiles, or ones cropped narrow (TableGeometry: under .8 of full width).
            val narrow = w < .8f * 1.3f * h
            assertTrue("$tag: tile $w × $h dp ${if (narrow) "is" else "is not"} squeezed", narrow == (label == "squeezed"))
            val k = TextFloors.scale(h)
            for (c in creatures.filter { it.name in the2 }) {
                val who = "$tag: ${c.name} (${if (c.controller == st.viewer) "yours" else "CPU's"})"
                assertTrue("$who: name cut", a.rects["namecut${c.id}"] == null)
                val sp = a.sizes["namesp${c.id}"] ?: error("$who: no name drawn")
                val lines = a.sizes["namelines${c.id}"]!!.toInt()
                val floor = if (narrow) TextFloors.NAME_SQUEEZED else TextFloors.NAME
                assertTrue("$who: name $sp sp, under the floor $floor", sp >= floor - .01f)
                assertTrue("$who: name $sp sp, more than the tile's ${floor * k}", sp <= floor * k * 1.01f) // the tile height is read back in whole pixels
                assertTrue("$who: name on $lines lines", lines in 1..(if (narrow) 3 else 2))
                val pt = a.sizes["ptsp${c.id}"] ?: error("$who: no P/T")
                // 15 sp times the tile's scale; on an overlapped tile it may step down to fit what shows, never under 15.
                assertTrue("$who: P/T $pt sp, not 15 to 15 × $k", pt >= TextFloors.PT - .01f && pt <= TextFloors.PT * k * 1.01f)
                println("[z3] $who tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp, name ${"%.2f".format(sp)} sp on $lines lines, P/T ${"%.1f".format(pt)} sp")
            }
            for (c in (st.cpu.battlefield + st.me.battlefield).filter { it.isLand }) a.sizes["namesp${c.id}"]?.let { sp ->
                assertTrue("$tag: ${c.name} land name $sp sp", sp >= TextFloors.LAND_NAME - .01f)
                assertTrue("$tag: ${c.name} land name cut", a.rects["namecut${c.id}"] == null)
            }
            assertTrue("$tag: no land name drawn", (st.cpu.battlefield + st.me.battlefield).filter { it.isLand }.any { a.sizes["namesp${it.id}"] != null })
            for (p in st.players.filter { a.rects["orb${it.id}"] != null }) assertTrue("$tag: life under 19 sp", (a.sizes["lifesp${p.id}"] ?: 0f) >= TextFloors.LIFE)
            val dots = a.rects.filterKeys { it.startsWith("phasedot") }
            assertTrue("$tag: no phase dots", dots.isNotEmpty())
            for ((key, r) in dots) assertTrue("$tag: $key ${r.width / dp} dp", r.width / dp >= TextFloors.DOT - .05f && r.height / dp >= TextFloors.DOT - .05f)
        }
    }
}
