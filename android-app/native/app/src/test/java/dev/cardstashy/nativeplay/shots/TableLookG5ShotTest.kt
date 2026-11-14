package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.BottomRoot
import dev.cardstashy.nativeplay.ui.BottomScreen
import dev.cardstashy.nativeplay.ui.CardInspect
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TableZones
import dev.cardstashy.nativeplay.ui.TileBadges
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
import kotlin.math.abs

/**
 * 0.4.60 G5 (specs/glance-marks-brief.md, "Thor bottom screen"): on two screens the ring on a tile on the top screen makes the bottom's
 * reading panel read that card ("On the battlefield") with its G4 keyword boxes in the panel's spare room; A on the tile opens
 * CardInspect on the bottom screen (beside = true) with the same boxes. The top screen never dims and nothing is drawn over it.
 * The Thor drawn as its two panels, top 960 × 540 dp over bottom 620 × 540 dp at 2 px a dp; shots table-look/g5-*-1240x1080.png
 * (bottom) and g5-*-top-1920x1080.png (top), for Mordant Dragon (Flying, Haste) and Akroma, Angel of Wrath (six keywords).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h1080dp-xhdpi")
class TableLookG5ShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null); Pad.forget(); TableZones.at = 0 }

    private val dragonText = "Flying, haste\nWhenever Mordant Dragon deals combat damage to a player, you may have it deal that much damage to target creature that player controls."
    private val akromaText = "Flying, first strike, vigilance, trample, haste, protection from black and from red"

    /** The main board (plain priority, no stack) with your Hill Giant made Mordant Dragon (1 damage) and your Grizzly Bears Akroma; neither is a legal tap. */
    private fun table(): Triple<MatchState, Card, Card> {
        val st = state("main").let { it.copy(stack = emptyList()) }
        val giant = st.me.battlefield.first { it.id == 107 }; val bears = st.me.battlefield.first { it.id == 108 }
        val dragon = giant.copy(name = "Mordant Dragon", type = "Creature — Dragon", manaCost = "{3}{R}{R}{R}", text = dragonText, power = 5, toughness = 5,
            damage = 1, summoningSick = false, counters = emptyMap(), keywords = listOf("Flying", "Haste"), keywordsKnown = true)
        val akroma = bears.copy(name = "Akroma, Angel of Wrath", type = "Legendary Creature — Angel", manaCost = "{5}{W}{W}{W}", text = akromaText, power = 6, toughness = 6,
            damage = 0, summoningSick = false, counters = emptyMap(),
            keywords = listOf("Flying", "First Strike", "Vigilance", "Trample", "Haste", "Protection from black", "Protection from red"), keywordsKnown = true)
        val me = st.me.copy(battlefield = st.me.battlefield.map { when (it.id) { dragon.id -> dragon; akroma.id -> akroma; else -> it } })
        val out = st.copy(players = st.players.map { if (it.id == st.viewer) me else it })
        assertTrue("the test cards are no legal tap", out.selection.actionable.none { it == 107 || it == 108 })
        return Triple(out, dragon, akroma)
    }

    private val anchors = Anchors()
    private var inspected by mutableStateOf<Card?>(null)

    private fun step() { androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications(); rule.mainClock.advanceTimeBy(600); rule.waitForIdle() }

    private fun show(st: MatchState) {
        dev.cardstashy.nativeplay.ui.Motion.still = true; rule.mainClock.autoAdvance = false
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        Pad.used()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Column(Modifier.fillMaxSize().background(Color.Black)) {
                    // The Thor's top panel: the table, as TableScreen draws it; an inspect opens on the bottom screen (TableScreen's beside = true).
                    Box(Modifier.width(960.dp).height(540.dp).testTag("top").padRoot().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = { inspected = it }, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                        inspected?.let { c -> BottomScreen { CardInspect(c, st.viewer, beside = true) { inspected = null } } }
                    }
                    // The Thor's bottom panel: 1240 by 1080 px, 620 by 540 dp.
                    Box(Modifier.width(620.dp).height(540.dp).testTag("bottom")) { BottomRoot() }
                }
            }
        }
        step()
    }

    private fun shot(tag: String, file: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/$file.png")
        rule.onNodeWithTag(tag).captureRoboImage(f.path)
        return BitmapFactory.decodeFile(f.path)
    }

    /** The mean difference of two pictures of the same size, 0 to 255 per channel. */
    private fun diff(a: Bitmap, b: Bitmap): Double {
        assertEquals(a.width, b.width); assertEquals(a.height, b.height)
        var sum = 0L; var n = 0
        for (y in 0 until a.height step 3) for (x in 0 until a.width step 3) {
            val p = a.getPixel(x, y); val q = b.getPixel(x, y)
            sum += abs((p shr 16 and 255) - (q shr 16 and 255)) + abs((p shr 8 and 255) - (q shr 8 and 255)) + abs((p and 255) - (q and 255)); n += 3
        }
        return sum.toDouble() / n
    }

    private fun inside(inner: Rect, outer: Rect) = inner.left >= outer.left - 1f && inner.right <= outer.right + 1f && inner.top >= outer.top - 1f && inner.bottom <= outer.bottom + 1f

    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @Test fun ringOnTheCardThenOpened() {
        val (st, dragon, akroma) = table()
        show(st)
        val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
        val top = Rect(0f, 0f, 960 * dp, 540 * dp)
        val bottom = Rect(0f, 540 * dp, 620 * dp, 1080 * dp)
        for ((label, c) in listOf("dragon" to dragon, "akroma" to akroma)) {
            val who = "${c.name}"
            inspected = null
            // The ring on the tile (the d-pad's way there): the bottom reads it with its keyword boxes.
            rule.runOnUiThread { TableZones.mine[c.id]!!.requestFocus() }
            // The tile posts the ringed card outside composition (G5 review): it reaches the panel on the next frame.
            step(); step()
            // The ringed tile is the board's own now (G5 review), so the test sees it where it lands: the bottom's panel reads that card.
            assertNotNull("$who: the ring on the tile reaches the bottom's panel", anchors.rects["b.readKw${c.id}.0"])
            // Let the art and the playmat finish loading (off the main thread), so the two top pictures differ only by what this item does.
            var topRing = shot("top", "g5-ring-$label-top-1920x1080")
            for (i in 0 until 15) { Thread.sleep(400); step(); val again = shot("top", "g5-ring-$label-top-1920x1080"); val settled = diff(topRing, again) < .2; topRing = again; if (settled) break }
            shot("bottom", "g5-ring-$label-1240x1080")
            val r = anchors.rects
            val read = r["b.read"] ?: error("$who: no reading panel")
            val hand = r["b.hand"] ?: error("$who: no hand")
            assertTrue("$who: the panel $read on the bottom screen $bottom", inside(read, bottom))
            val keys = TileBadges.of(c, false)!!.strip.map { it.key }
            assertEquals("$who: keywords", if (label == "akroma") 6 else 2, keys.size)
            val boxes = keys.indices.map { i -> r["b.readKw${c.id}.$i"] ?: error("$who: no box $i in the panel") }
            assertTrue("$who: no box past the last keyword", r["b.readKw${c.id}.${keys.size}"] == null)
            keys.indices.forEach { i -> assertNotNull("$who: box $i with the tile's icon", r["b.readKwIcon${c.id}.$i"]) }
            // Every box is there in the tile's order; the Dragon's two show whole, Akroma's first two rows show whole and the rest of
            // her six scroll in the panel (the opened view, one press of A away, lists them too).
            val whole = if (label == "akroma") 4 else keys.size
            boxes.take(whole).forEachIndexed { i, b ->
                assertTrue("$who: box $i $b whole", b.height > 40 * dp)
                assertTrue("$who: box $i $b inside the panel $read", inside(b, read))
                assertTrue("$who: box $i $b off the hand $hand", !b.overlaps(hand))
                // Two to a row, in the tile's order.
                if (i % 2 == 1) assertTrue("$who: box $i beside box ${i - 1}", abs(b.top - boxes[i - 1].top) < 1f && b.left > boxes[i - 1].right)
                if (i >= 2) assertTrue("$who: box $i under box ${i - 2}", b.top >= boxes[i - 2].bottom - .5f)
            }
            // Walk line 32 and no dead space: the hand fills the top of the bottom screen and the panel runs down to the controller's bar,
            // the hand and the panel closing up on each other.
            assertTrue("$who: the panel $read reads under the hand $hand", read.top >= hand.bottom - 1f)
            assertTrue("$who: no gap between hand $hand and panel $read", read.top - hand.bottom <= 40 * dp)
            assertTrue("$who: the panel $read runs to the foot of the screen", bottom.bottom - read.bottom <= 64 * dp)
            assertTrue("$who: box ${whole - 1} whole in the panel ${boxes[whole - 1]} $read", boxes[whole - 1].bottom <= read.bottom - 4 * dp)
            // Pressing A on the tile: CardInspect on the bottom screen with the same boxes.
            rule.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionCenter) }
            step()
            assertEquals("$who: A opened the card", c.id, inspected?.id)
            val topOpen = shot("top", "g5-open-$label-top-1920x1080")
            // Never dimmed: no darker than with the ring alone.
            fun light(b: Bitmap): Double { var sum = 0L; var n = 0; for (y in 0 until b.height step 4) for (x in 0 until b.width step 4) { val p = b.getPixel(x, y); sum += (p shr 16 and 255) + (p shr 8 and 255) + (p and 255); n += 3 }; return sum.toDouble() / n }
            assertTrue("$who: the top screen dimmed (${light(topOpen)} after ${light(topRing)})", light(topOpen) >= light(topRing) - 1.0)
            shot("bottom", "g5-open-$label-1240x1080")
            val card = r["inspectCard${c.id}"] ?: error("$who: no inspect card")
            assertTrue("$who: the opened card $card on the bottom screen", inside(card, bottom))
            val open = keys.indices.map { i -> r["inspectKw${c.id}.$i"] ?: error("$who: no box $i in the opened view") }
            keys.indices.forEach { i -> assertNotNull("$who: opened box $i with the tile's icon", r["inspectKwIcon${c.id}.$i"]) }
            open.take(whole).forEachIndexed { i, b ->
                assertTrue("$who: opened box $i $b whole", b.height > 30 * dp)
                assertTrue("$who: opened box $i $b on the bottom screen", inside(b, bottom))
                assertTrue("$who: opened box $i $b off the card $card", b.right <= card.left + .5f || b.left >= card.right - .5f)
            }
            // The card fills the bottom screen's height: no dead space.
            assertTrue("$who: the opened card $card fills the height", card.height >= (bottom.height - 64 * dp) * .85f)
            // The top screen never dims and nothing is drawn over it: the same picture before and after A.
            val d = diff(topRing, topOpen)
            println("[g5] $who: panel $read, hand $hand, ${boxes.size} boxes, last ${boxes.last()}; opened card $card; top diff $d")
            assertTrue("$who: the top screen changed when the card opened (mean diff $d)", d < 2.0)
            assertTrue("$who: nothing of the inspect view on the top screen", !card.overlaps(top) && open.none { it.overlaps(top) })
            inspected = null; step()
        }
    }
}
