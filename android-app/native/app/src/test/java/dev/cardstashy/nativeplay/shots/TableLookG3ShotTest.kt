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
    private fun board(st: MatchState, live: Boolean): Pair<Anchors, Seen> {
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
                    seen.inspected?.let { c -> CardInspect(c, st.viewer, attached = attachedOf(st, st.card(c.id) ?: c), onAttached = { seen.inspected = it }) { seen.inspected = null } }
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

    @Test fun aLegalTapStillActsFirst() {
        val main = state("crowded")
        val giant = main.me.battlefield.first { it.name == "Hill Giant" }
        val st = main.copy(selection = main.selection.copy(actionable = main.selection.actionable + giant.id))
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
}
