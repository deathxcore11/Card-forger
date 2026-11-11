package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.60 G1 (specs/glance-marks-brief.md, "Keyword strip on the tile"): a creature's keyword marks are a strip along the tile's
 * bottom edge, left of the P/T plate, 22 % of the tile tall and never under 16 dp, in rank order while they fit, the rest one "+N".
 * A squeezed tile (narrower than tall) stacks them up its left edge, first keyword lowest, at most two. Drawn at 844 × 390,
 * 884 × 796, 1280 × 800 and the 1920 × 1080 top screen with Mordant Dragon (Flying, Haste, 1 damage) and Akroma, Angel of Wrath
 * (six keywords), roomy and squeezed; no mark lies under the P/T plate or the name. Shots in table-look/g1-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookG1ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private class Sz(val tag: String, val q: String, val dual: Boolean)
    private val sizes = listOf(
        Sz("844x390", "w844dp-h390dp-land-xxhdpi", false), Sz("884x796", "w884dp-h796dp-land-xhdpi", false),
        Sz("1280x800", "w1280dp-h800dp-land-mdpi", false), Sz("1920x1080", "w1920dp-h1080dp-land-mdpi", true))

    private val fill = listOf("Grizzly Bears", "Llanowar Elves", "Elvish Mystic", "Attercop", "Bloom Tender", "Savannah Lions", "Hill Giant", "Serra Angel")
    private val dragonText = "Flying, haste\nWhenever Mordant Dragon deals combat damage to a player, you may have it deal that much damage to target creature that player controls."
    private val akromaText = "Flying, first strike, vigilance, trample, haste, protection from black and from red"

    /** The crowded table with each side's creatures replaced by Mordant Dragon, Akroma and fillers, [n] in all. */
    private fun aSide(n: Int): MatchState {
        val st = state("crowded")
        val base = (st.cpu.battlefield + st.me.battlefield).first { it.isCreature && it.attachedTo == null }
        fun side(p: Int, from: Int) = (0 until n).map { i ->
            val plain = base.copy(id = from + i, owner = p, controller = p, tapped = false, attacking = false, blocking = false, damage = 0, counters = emptyMap(),
                attachments = emptyList(), attachedTo = null, summoningSick = false, commander = false)
            when (i) {
                0 -> plain.copy(name = "Mordant Dragon", type = "Creature — Dragon", manaCost = "{3}{R}{R}{R}", text = dragonText, power = 5, toughness = 5, damage = 1,
                    keywords = listOf("Flying", "Haste"), keywordsKnown = true)
                1 -> plain.copy(name = "Akroma, Angel of Wrath", type = "Legendary Creature — Angel", manaCost = "{5}{W}{W}{W}", text = akromaText, power = 6, toughness = 6,
                    keywords = listOf("Flying", "First Strike", "Vigilance", "Trample", "Haste", "Protection from black", "Protection from red"), keywordsKnown = true)
                else -> plain.copy(name = fill[(i - 2) % fill.size], text = "", power = 1 + i % 4, toughness = 1 + (i + 1) % 4, keywords = emptyList(), keywordsKnown = true)
            }
        }
        fun keep(p: dev.cardstashy.nativeplay.engine.Player) = p.battlefield.filter { it.isLand && it.attachedTo == null && it.attachments.isEmpty() }
        val cpu = st.cpu.copy(battlefield = keep(st.cpu) + side(st.cpu.id, 900))
        val me = st.me.copy(battlefield = keep(st.me) + side(st.me.id, 950))
        return st.copy(players = st.players.map { if (it.id == st.viewer) me else if (it.id == st.cpu.id) cpu else it })
    }

    /**
     * G1 review: the roomy table with both of them tapped (the state corner shows; summoning sick is hidden on the battlefield, as the
     * site's play-forge-table.css hides it, so it is set too but draws nothing), counters and damage on the rail, and Mind Stone
     * (snap-crowded's own) attached to each Dragon (the attached badge sits on top of the strip). A tapped tile turns 20 degrees and
     * shrinks to .94, so the test turns each rect back about the tile's centre before comparing ([unturn]).
     */
    private fun marked(): MatchState {
        val st = aSide(3)
        val stone = state("crowded").card(140)!!
        val stones = mutableListOf<dev.cardstashy.nativeplay.engine.Card>()
        fun dress(c: dev.cardstashy.nativeplay.engine.Card) = when {
            c.name == "Mordant Dragon" -> { val m = stone.copy(id = 990 + stones.size, owner = c.controller, controller = c.controller, attachedTo = c.id, tapped = false); stones += m
                c.copy(tapped = true, summoningSick = true, counters = mapOf("P1P1" to 2, "SHIELD" to 1), attachments = listOf(m.id)) }
            c.name.startsWith("Akroma") -> c.copy(tapped = true, summoningSick = true, damage = 2, counters = mapOf("STUN" to 1, "P1P1" to 1))
            else -> c
        }
        return st.copy(players = st.players.map { p -> val field = p.battlefield.map(::dress); p.copy(battlefield = field + stones.filter { it.controller == p.id }) })
    }

    private fun draw(name: String, st: MatchState, size: Sz): Anchors {
        RuntimeEnvironment.setQualifiers(size.q)
        DualScreen.pretend(if (size.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        var seen: Anchors? = null
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/g1-$name-${size.tag}${if (size.dual) "-dualtop" else ""}.png").path) {
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

    /**
     * A rect on screen of a tile turned [deg] degrees (clockwise) and scaled [s] about [pivot], turned back to the tile's own frame:
     * the screen rect is the turned rect's bounding box, so its own width and height solve from it.
     */
    private fun unturn(r: Rect, pivot: Offset, deg: Double = 20.0, s: Float = .94f): Rect {
        val t = Math.toRadians(deg); val c = kotlin.math.cos(t); val sn = kotlin.math.sin(t); val d = c * c - sn * sn
        val w = ((r.width * c - r.height * sn) / d).toFloat() / s; val h = ((r.height * c - r.width * sn) / d).toFloat() / s
        val dx = r.center.x - pivot.x; val dy = r.center.y - pivot.y
        val cx = pivot.x + ((dx * c + dy * sn) / s).toFloat(); val cy = pivot.y + ((-dx * sn + dy * c) / s).toFloat()
        return Rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    }

    /** Overlap of more than half a pixel each way. */
    private fun hits(a: Rect, b: Rect) = a.left < b.right - .5f && b.left < a.right - .5f && a.top < b.bottom - .5f && b.top < a.bottom - .5f

    @Test fun pureFit() {
        // Rank order, uncapped: Akroma's six, Flying first.
        val akroma = aSide(2).me.battlefield.first { it.name.startsWith("Akroma") }
        val m = TileBadges.of(akroma, false)!!
        assertEquals(listOf("flying", "trample", "first-strike", "vigilance", "protection", "haste"), m.iconic.map { it.key })
        assertEquals(6, TileBadges.stripShown(6, 6)); assertEquals(4, TileBadges.stripShown(6, 5)); assertEquals(0, TileBadges.stripShown(6, 1))
        assertEquals(1, TileBadges.stripShown(1, 1)); assertEquals(0, TileBadges.stripShown(3, 0)); assertEquals(1, TileBadges.stripShown(6, 2))
        assertEquals(3, TileBadges.stripSlots(52f, 16f, 2f)); assertEquals(2, TileBadges.stripSlots(51f, 16f, 2f)); assertEquals(0, TileBadges.stripSlots(15f, 16f, 2f))
    }

    @Test fun keywordStripKeepsOffThePlateAndTheName() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val controller = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}")
        val roomy = controller.paired(aSide(3)); val squeezed = controller.paired(aSide(10)); val marked = controller.paired(marked())
        for (size in sizes) for ((label, st) in listOf("roomy" to roomy, "squeezed" to squeezed, "marked" to marked)) {
            val tag = "${size.tag}${if (size.dual) " dual top" else ""} $label"
            val a = draw(label, st, size)
            val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
            for (c in (st.cpu.battlefield + st.me.battlefield).filter { it.name == "Mordant Dragon" || it.name.startsWith("Akroma") }) {
                val who = "$tag: ${c.name} (${if (c.controller == st.viewer) "yours" else "CPU's"})"
                val seenTile = a.rects["c${c.id}"] ?: error("$who: no tile")
                val fix: (Rect) -> Rect = if (c.tapped) { r -> unturn(r, seenTile.center) } else { r -> r }
                val tile = fix(seenTile)
                val h = tile.height / dp; val w = tile.width / dp
                val narrow = w < h
                if (label != "marked") assertTrue("$who: tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp ${if (narrow) "is" else "is not"} narrower than tall", narrow == (label == "squeezed"))
                val total = if (c.name == "Mordant Dragon") 2 else 6
                val shown = a.sizes["kwshown${c.id}"]?.toInt() ?: error("$who: no keyword strip")
                val more = a.sizes["kwmore${c.id}"]!!.toInt()
                val pt = fix(a.rects["pt${c.id}"] ?: error("$who: no P/T plate"))
                val name = fix(a.rects["name${c.id}"] ?: error("$who: no name"))
                val kh = maxOf(16f, .22f * h)
                // G1 review: the state corner (summoning sick), the counters rail and the attached badge, when the tile shows them.
                val state = a.rects["state${c.id}"]?.let(fix); val rail = a.rects["rail${c.id}"]?.let(fix); val low = a.rects["low${c.id}"]?.let(fix)
                if (label == "marked") {
                    assertTrue("$who: tapped", c.tapped)
                    assertNotNull("$who: the state corner shows", state)
                    assertNotNull("$who: the counters rail shows", rail)
                    if (c.name == "Mordant Dragon") assertNotNull("$who: the attached badge shows", low)
                }
                if (shown + more == 0) {
                    if (label == "marked") {
                        // Under the state corner and the attached badge, not even one mark fits above the plate.
                        val ceiling = maxOf(name.bottom, state?.bottom ?: name.bottom) / dp + (if (low != null) low.height / dp + 2f else 0f)
                        assertTrue("$who: no mark, though ${pt.top / dp - ceiling} dp is free under the state corner", pt.top / dp - ceiling < kh + 6f || narrow)
                        println("[g1] $who tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp: no room for a mark under the state corner")
                        continue
                    }
                    // A squeezed phone tile whose name takes three lines: the plate spans the bottom and the name the top, so not even
                    // one mark fits between them on the left edge. Only then may a tile show none.
                    assertTrue("$who: no mark, though ${(pt.top - name.bottom) / dp} dp is free between the name and the plate", narrow && (pt.top - name.bottom) / dp < kh + 6f)
                    println("[g1] $who tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp: no room for a mark (${"%.1f".format((pt.top - name.bottom) / dp)} dp between name and plate)")
                    continue
                }
                assertEquals("$who: marks plus +N account for every keyword", total, shown + more)
                if (narrow) assertTrue("$who: squeezed, ${shown + (if (more > 0) 1 else 0)} marks", shown + (if (more > 0) 1 else 0) <= 2)
                // Flying and Haste told apart on the tile at every size when the tile is full width.
                // (The marked table gives the strip less room: there the count is still exact, shown plus +N.)
                if (!narrow && c.name == "Mordant Dragon" && label != "marked") assertEquals("$who: Flying and Haste both shown", 2, shown)
                val marks = ((0 until shown).map { a.rects["kw${c.id}.$it"] ?: error("$who: mark $it not drawn") } + listOfNotNull(if (more > 0) a.rects["kwplus${c.id}"] ?: error("$who: +N not drawn") else null)).map(fix)
                for ((i, r) in marks.withIndex()) {
                    assertTrue("$who: mark $i ${r.height / dp} dp tall, not $kh", r.height / dp >= 16f - .05f && kotlin.math.abs(r.height / dp - kh) < 1f)
                    assertTrue("$who: mark $i under the P/T plate", !hits(r, pt))
                    assertTrue("$who: mark $i under the name", !hits(r, name))
                    state?.let { assertTrue("$who: mark $i $r over the state corner $it", !hits(r, it)) }
                    rail?.let { assertTrue("$who: mark $i $r over the counters rail $it", !hits(r, it)) }
                    low?.let { assertTrue("$who: mark $i $r under the attached badge $it", !hits(r, it)) }
                    assertTrue("$who: mark $i off the tile", r.left >= tile.left - .5f && r.right <= tile.right + .5f && r.top >= tile.top - .5f && r.bottom <= tile.bottom + .5f)
                }
                for (i in 1 until marks.size) {
                    val p = marks[i - 1]; val r = marks[i]
                    if (narrow) assertTrue("$who: mark $i not above mark ${i - 1} on the left edge", r.bottom <= p.top + .5f && kotlin.math.abs(r.left - p.left) < 1f)
                    else assertTrue("$who: mark $i not right of mark ${i - 1} in the strip", r.left >= p.right - .5f && kotlin.math.abs(r.top - p.top) < 1f)
                }
                // A strip along the bottom edge: its lowest mark sits in the tile's bottom quarter.
                assertTrue("$who: the strip is not on the bottom edge", marks.first().bottom >= tile.bottom - tile.height * .25f || narrow)
                // The badges above the strip stay off the name and the state corner too.
                low?.let { l -> assertTrue("$who: the attached badge $l over the name $name", !hits(l, name)); state?.let { assertTrue("$who: the attached badge $l over the state corner $it", !hits(l, it)) } }
                println("[g1] $who tile ${"%.1f".format(w)} × ${"%.1f".format(h)} dp, marks ${"%.1f".format(marks.first().height / dp)} dp: $shown shown, +$more")
            }
        }
    }
}
