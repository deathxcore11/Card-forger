package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.CardInspect
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.attachedOf
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
 * 0.4.60 G3 (specs/glance-marks-brief.md, "One inspect view"): on the table, a tap on a lone permanent with no game action opens
 * CardInspect (the described view), never the old one-card sheet; a tap on a pile (xN) still opens the group sheet; a legal tap still
 * acts first. A creature with an aura lists the aura in CardInspect under the rules as a small card, and a tap on it inspects the aura.
 * Shots in table-look/g3-*.png, drawn at 844 × 390 and 1280 × 800.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class TableLookG3ShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private val armorText = "Enchant creature\nEnchanted creature gets +1/+1 for each enchantment you control and has first strike."

    /** The crowded table with Ethereal Armor on your Hill Giant. */
    private fun withAura(): Pair<MatchState, Card> {
        val st = state("crowded")
        val giant = st.me.battlefield.first { it.name == "Hill Giant" }
        val aura = giant.copy(id = 990, name = "Ethereal Armor", type = "Enchantment — Aura", manaCost = "{W}", text = armorText, power = null, toughness = null,
            attachedTo = giant.id, attachments = emptyList(), keywords = emptyList(), counters = emptyMap(), tapped = false, attacking = false, blocking = false, damage = 0)
        val me = st.me.copy(battlefield = st.me.battlefield.map { if (it.id == giant.id) it.copy(attachments = listOf(990)) else it } + aura)
        val s2 = st.copy(players = st.players.map { if (it.id == st.viewer) me else it })
        return s2 to s2.card(giant.id)!!
    }

    private class Seen { var inspected by mutableStateOf<Card?>(null); var acted = mutableListOf<Int>() }

    /** The board as TableScreen wires it: onInspect opens CardInspect with what is attached, and a tap on one of those inspects it. */
    private fun board(st: MatchState, live: Boolean, near: Boolean = false): Pair<Anchors, Seen> {
        Motion()
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        DualScreen.pretend(null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        val anchors = Anchors(); val seen = Seen()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = live, intents = TableIntents(card = { seen.acted += it }), selectedHand = null, onSelectHand = {}, onInspect = { seen.inspected = it }, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                    seen.inspected?.let { c ->
                        // As TableScreen wires it (better table scene 13): a battlefield card opens beside its tile anchor.
                        val at = if (near && c.zone == "Battlefield") anchors.rects["c${c.id}"] ?: anchors.rects["aura${c.id}"] else null
                        CardInspect(c, st.viewer, attached = attachedOf(st, st.card(c.id) ?: c), onAttached = { seen.inspected = it }, near = at) { seen.inspected = null } }
                }
            }
        }
        rule.waitForIdle()
        return anchors to seen
    }

    private fun Motion() { dev.cardstashy.nativeplay.ui.Motion.still = true }

    private fun tap(a: Anchors, key: String) {
        val r = a.rects[key] ?: error("no $key on screen")
        rule.onRoot().performTouchInput { click(r.center) }
        rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
    }

    private fun shot(name: String): android.graphics.Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/g3-$name.png")
        rule.onRoot().captureRoboImage(f.path)
        return BitmapFactory.decodeFile(f.path)
    }

    @Test fun aLonePermanentInspectsAPileOpensTheGroupSheet() {
        val st = state("crowded")
        val giant = st.me.battlefield.first { it.name == "Hill Giant" }
        val (a, seen) = board(st, live = false)
        tap(a, "c${giant.id}")
        assertEquals("a tap on a lone permanent opens CardInspect", giant.id, seen.inspected?.id)
        // Not the old one-card sheet ("Now 3/3", Close).
        assertNull("no sheet opened for one card", a.rects["tableSheet"])
        shot("lone-844x390")
        // Close it (a tap anywhere), then a tap on the Forest pile opens the group sheet.
        rule.onRoot().performTouchInput { click(center) }; rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        assertNull(seen.inspected)
        val forest = st.me.battlefield.filter { it.name == "Forest" }.mapNotNull { f -> a.rects["c${f.id}"]?.let { f to it } }.maxBy { it.second.left }
        rule.onRoot().performTouchInput { click(forest.second.center) }
        rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        assertNull("a pile does not inspect", seen.inspected)
        assertNotNull("a pile opens the group sheet", a.rects["tableSheet"])
        assertTrue(rule.onAllNodesWithText("Your Forest ×", substring = true).fetchSemanticsNodes().isNotEmpty())
    }

    // 0.4.60 G6 changed what a usable ring's tap does (it opens the card with its ability rows, never firing blind; see
    // TableLookG6ShotTest), so the legal tap here is a target pick, which still acts at once.
    @Test fun aLegalTapStillActsFirst() {
        val main = state("crowded")
        val giant = main.me.battlefield.first { it.name == "Hill Giant" }
        val st = main.copy(selection = main.selection.copy(targetCards = main.selection.targetCards + giant.id))
        val (a, seen) = board(st, live = true)
        tap(a, "c${giant.id}")
        assertEquals(listOf(giant.id), seen.acted)
        assertNull("a legal tap does not inspect", seen.inspected)
    }

    @Test fun anAuraIsListedInTheInspectViewAndOpensOnATapPhone() = aura("844x390")

    @Config(qualifiers = "w1280dp-h800dp-land-mdpi")
    @Test fun anAuraIsListedInTheInspectViewAndOpensOnATapTablet() = aura("1280x800")

    private fun aura(tag: String) {
        val (st, giant) = withAura()
        val (a, seen) = board(st, live = false)
        tap(a, "c${giant.id}")
        assertEquals("$tag: the giant opened", giant.id, seen.inspected?.id)
        val row = a.rects["inspectAttached${giant.id}"] ?: error("$tag: no attached row in the inspect view")
        val small = a.rects["inspectAtt990"] ?: error("$tag: Ethereal Armor not listed")
        val bmp = shot("aura-$tag")
        assertTrue("$tag: the aura's small card is off the screen", small.left >= 0f && small.top >= 0f && small.right <= bmp.width + .5f && small.bottom <= bmp.height + .5f)
        assertTrue("$tag: the small card is in the attached row", small.top >= row.top - .5f && small.bottom <= row.bottom + .5f)
        assertTrue("$tag: the aura's name is shown", rule.onAllNodesWithText("Ethereal Armor").fetchSemanticsNodes().isNotEmpty())
        // A tap on the aura inspects it in the same view.
        tap(a, "inspectAtt990")
        assertEquals("$tag: the aura opened", 990, seen.inspected?.id)
        assertTrue("$tag: the aura's rules show", rule.onAllNodesWithText("Enchant creature", substring = true).fetchSemanticsNodes().isNotEmpty())
        shot("aura-opened-$tag")
    }

    // ---- Better table scene 13: read a card beside its tile ----

    /** The scene's Hill Giant: Ethereal Armor on it, the first strike it grants, a +1/+1 counter. */
    private fun scene13(): Pair<MatchState, Card> {
        val (st, giant) = withAura()
        // Review: Forge's live rules text (here an ability a Role grants) is read in words beside the printed card.
        val g = giant.copy(keywords = listOf("First Strike"), keywordsKnown = true, power = 5, toughness = 5, counters = mapOf("P1P1" to 1),
            text = listOf(giant.text, "Whenever this creature attacks, scry 1.").filter { it.isNotBlank() }.joinToString("\n"))
        val me = st.me.copy(battlefield = st.me.battlefield.map { if (it.id == g.id) g else it })
        val s2 = st.copy(players = st.players.map { if (it.id == st.viewer) me else it })
        return s2 to s2.card(g.id)!!
    }

    @Test fun scene13ReadsBesideTheTilePhone() = beside("844x390")

    @Config(qualifiers = "w884dp-h796dp-xhdpi")
    @Test fun scene13ReadsBesideTheTileFold() = beside("884x796")

    @Config(qualifiers = "w1280dp-h800dp-land-mdpi")
    @Test fun scene13ReadsBesideTheTileTablet() = beside("1280x800")

    private fun beside(tag: String) {
        val (st, giant) = scene13()
        val (a, seen) = board(st, live = false, near = true)
        val tile = a.rects["c${giant.id}"] ?: error("$tag: no tile")
        val before = shot("read-before-$tag")
        tap(a, "c${giant.id}")
        rule.waitForIdle(); rule.mainClock.advanceTimeBy(100); rule.waitForIdle()
        assertEquals("$tag: the giant opened", giant.id, seen.inspected?.id)
        val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val card = a.rects["inspectCard${giant.id}"] ?: error("$tag: no card")
        val panels = a.rects["inspectPanels${giant.id}"] ?: error("$tag: the card was not read beside its tile (no panels)")
        val bmp = shot("read-$tag")
        val W = bmp.width.toFloat(); val H = bmp.height.toFloat()
        fun inside(r: androidx.compose.ui.geometry.Rect) = r.left >= -.5f && r.top >= -.5f && r.right <= W + .5f && r.bottom <= H + .5f
        assertTrue("$tag: the card covers its tile $card / $tile", !card.deflate(1f).overlaps(tile))
        assertTrue("$tag: the panels cover the tile", !panels.deflate(1f).overlaps(tile))
        val gap = if (card.left >= tile.right) card.left - tile.right else tile.left - card.right
        assertTrue("$tag: the card stands ${gap / dp} dp from its tile", gap in 0f..24f * dp)
        assertTrue("$tag: the card is off screen", inside(card))
        assertTrue("$tag: the card is the whole card, not a sliver (${card.height / H})", card.height >= H * .3f)
        assertTrue("$tag: the panels sit on the card's far side from the tile", if (card.left >= tile.right) panels.left >= card.right - .5f else panels.right <= card.left + .5f)
        val kw = a.rects["inspectKw${giant.id}.0"] ?: error("$tag: no keyword box")
        val att = a.rects["inspectAttached${giant.id}"] ?: error("$tag: no Attached row")
        assertTrue("$tag: keyword box off screen", inside(kw)); assertTrue("$tag: Attached row off screen", inside(att))
        assertTrue("$tag: First strike named", rule.onAllNodesWithText("First strike", substring = true).fetchSemanticsNodes().isNotEmpty())
        assertTrue("$tag: Forge's granted ability is read in words", rule.onAllNodesWithText("scry 1", substring = true).fetchSemanticsNodes().isNotEmpty())
        // The card stands level with its tile (centred on it, unless the screen's edge stops it).
        assertTrue("$tag: the card is not level with its tile", card.top <= tile.center.y && card.bottom >= tile.center.y)
        // The read tile stays lit (no scrim over it) while the rest of the table is only dimmed.
        fun lum(b: android.graphics.Bitmap, r: androidx.compose.ui.geometry.Rect): Double {
            var t = 0.0; var n = 0
            for (x in (r.left + r.width * .25f).toInt() until (r.right - r.width * .25f).toInt() step 3) for (y in (r.top + r.height * .3f).toInt() until (r.bottom - r.height * .3f).toInt() step 3) {
                val c = b.getPixel(x, y); t += (c shr 16 and 255) * .3 + (c shr 8 and 255) * .59 + (c and 255) * .11; n++ }
            return t / maxOf(1, n)
        }
        val lit = lum(bmp, tile) / lum(before, tile)
        assertTrue("$tag: the read tile is dimmed (${"%.2f".format(lit)})", lit > .85)
        // The aura in the Attached row opens beside its own card edge.
        tap(a, "inspectAtt990")
        assertEquals("$tag: the aura opened", 990, seen.inspected?.id)
        shot("read-aura-$tag")
        // A tap outside (the table's empty top-left corner under the scrim) closes it.
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(W * .5f, 6f * dp)) }
        rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        assertNull("$tag: a tap outside closes the read", seen.inspected)
    }

    @Test fun scene13NoTileKeepsTheCentredPage() {
        // A card with no tile anchor (a graveyard card, the stack) keeps today's centred page and its dark scrim.
        val (st, giant) = scene13()
        val (a, seen) = board(st, live = false, near = false)
        tap(a, "c${giant.id}")
        assertNull("no panels beside a tile", a.rects["inspectPanels${giant.id}"])
        val card = a.rects["inspectCard${giant.id}"] ?: error("no card")
        val bmp = shot("read-centred-844x390")
        assertTrue("centred", kotlin.math.abs(card.center.y - bmp.height / 2f) < bmp.height * .08f)
        assertNotNull(seen.inspected)
    }
}
