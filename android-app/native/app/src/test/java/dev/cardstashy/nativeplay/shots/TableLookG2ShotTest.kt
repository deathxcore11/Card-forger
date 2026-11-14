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
import dev.cardstashy.nativeplay.ui.TileBadges
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
 * 0.4.60 G2 (specs/glance-marks-brief.md, "Keywords without an icon show as a word"): the Phyrexian Mite token's Toxic 1 shows on
 * its tile as a word mark, the same height as the icon marks, on the strip, off the P/T plate and the name; Mordant Dragon keeps its
 * two icons. Drawn at 844 × 390 and 1280 × 800. Shots in table-look/g2-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookG2ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private val sizes = listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi")
    private val dragonText = "Flying, haste\nWhenever Mordant Dragon deals combat damage to a player, you may have it deal that much damage to target creature that player controls."
    private val miteText = "Toxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nThis creature can't block."

    /** The crowded table with each side's creatures replaced by Mordant Dragon and a Phyrexian Mite token. */
    private fun board(): MatchState {
        val st = state("crowded")
        val base = (st.cpu.battlefield + st.me.battlefield).first { it.isCreature && it.attachedTo == null }
        fun side(p: Int, from: Int) = (0 until 2).map { i ->
            val plain = base.copy(id = from + i, owner = p, controller = p, tapped = false, attacking = false, blocking = false, damage = 0, counters = emptyMap(),
                attachments = emptyList(), attachedTo = null, summoningSick = false, commander = false)
            if (i == 0) plain.copy(name = "Mordant Dragon", type = "Creature — Dragon", manaCost = "{3}{R}{R}{R}", text = dragonText, power = 5, toughness = 5, damage = 1,
                keywords = listOf("Flying", "Haste"), keywordsKnown = true)
            else plain.copy(name = "Phyrexian Mite", type = "Artifact Creature — Phyrexian Mite", manaCost = "", text = miteText, power = 1, toughness = 1, token = true,
                keywords = listOf("Toxic 1"), keywordsKnown = true)
        }
        fun keep(p: dev.cardstashy.nativeplay.engine.Player) = p.battlefield.filter { it.isLand && it.attachedTo == null && it.attachments.isEmpty() }
        val cpu = st.cpu.copy(battlefield = keep(st.cpu) + side(st.cpu.id, 900))
        val me = st.me.copy(battlefield = keep(st.me) + side(st.me.id, 950))
        return st.copy(players = st.players.map { if (it.id == st.viewer) me else if (it.id == st.cpu.id) cpu else it })
    }

    private fun draw(st: MatchState, tag: String, q: String): Anchors {
        RuntimeEnvironment.setQualifiers(q)
        DualScreen.pretend(null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        var seen: Anchors? = null
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/g2-mite-$tag.png").path) {
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

    private fun hits(a: Rect, b: Rect) = a.left < b.right - .5f && b.left < a.right - .5f && a.top < b.bottom - .5f && b.top < a.bottom - .5f

    @Test fun toxicShowsAsAWordMark() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val controller = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}")
        val st = controller.paired(board())
        for ((tag, q) in sizes) {
            val a = draw(st, tag, q)
            val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
            for (c in (st.cpu.battlefield + st.me.battlefield).filter { it.name == "Mordant Dragon" || it.name == "Phyrexian Mite" }) {
                val who = "$tag: ${c.name} (${if (c.controller == st.viewer) "yours" else "CPU's"})"
                val tile = a.rects["c${c.id}"] ?: error("$who: no tile")
                val h = tile.height / dp; val w = tile.width / dp
                assertTrue("$who: tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp is squeezed", w >= h)
                val shown = a.sizes["kwshown${c.id}"]?.toInt() ?: error("$who: no keyword strip")
                val more = a.sizes["kwmore${c.id}"]!!.toInt()
                assertEquals("$who: every keyword shown", if (c.name == "Mordant Dragon") 2 else 1, shown)
                assertEquals("$who: no +N", 0, more)
                val pt = a.rects["pt${c.id}"] ?: error("$who: no P/T plate")
                val name = a.rects["name${c.id}"] ?: error("$who: no name")
                val kh = maxOf(16f, .22f * h)
                for (i in 0 until shown) {
                    val r = a.rects["kw${c.id}.$i"] ?: error("$who: mark $i not drawn")
                    assertTrue("$who: mark $i ${r.height / dp} dp tall, not $kh", kotlin.math.abs(r.height / dp - kh) < 1f)
                    assertTrue("$who: mark $i under the P/T plate", !hits(r, pt))
                    assertTrue("$who: mark $i under the name", !hits(r, name))
                    assertTrue("$who: mark $i off the tile", r.left >= tile.left - .5f && r.right <= tile.right + .5f && r.bottom <= tile.bottom + .5f)
                    // The icon marks are round; the word mark is a pill wider than it is tall.
                    if (c.name == "Mordant Dragon") assertTrue("$who: icon mark $i not square", kotlin.math.abs(r.width - r.height) < 1f)
                    else assertTrue("$who: word mark ${r.width / dp} dp wide, ${r.height / dp} tall", r.width > r.height * 1.3f)
                }
                println("[g2] $who tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp: $shown shown, +$more")
            }
        }
    }
}
