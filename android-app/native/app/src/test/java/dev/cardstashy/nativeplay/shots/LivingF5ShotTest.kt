package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Motion
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableFeel
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Living table F5 (specs/living-table-build-guide.md, "F5 The clock stops") at phone size on the Ashen Forge. A loyalty ability
 * that cost 6 loyalty stops the clock; one that cost 2 does not; Reduced and Off never do; a loss of loyalty with no ability of
 * that card new on the stack (damage) does not. While it is stopped the table is grey, the pieces off the shield circle the card
 * in colour, and afterwards the table is as it was. When Forge resolves the ability early the frame is cut short, never the engine.
 * Pictures in table-look/f5-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF5ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun back() { AppSettings.applyMatchEffects("full"); TableFeel.mat = null }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun walker(like: Card, loyalty: Int) = like.copy(id = 970, name = "Liliana of the Veil", type = "Legendary Planeswalker - Liliana", manaCost = "{1}{B}{B}", power = null, toughness = null, tapped = false,
        counters = mapOf("LOYALTY" to loyalty), attachments = emptyList(), attachedTo = null, text = "")
    private fun table(loyalty: Int, rev: Long, stack: List<StackItem> = emptyList()) = base.copy(revision = rev, stack = stack,
        players = base.players.map { p -> if (p.id == base.viewer) p.copy(battlefield = p.battlefield + walker(p.battlefield.first { !it.isLand && !it.isCreature }, loyalty)) else p })
    private fun ability(st: MatchState, id: Int = 50, trigger: Boolean = false) = StackItem(id, "Separate all permanents target player controls into two piles.", st.me.battlefield.first { it.id == 970 }, st.viewer, ability = true, trigger = trigger)

    @Test fun aLoyaltyCostOfFiveOrMoreStopsTheClock() {
        val was = Motion.still; Motion.still = false
        try {
            val before = table(7, 1)
            val six = table(1, 2).let { it.copy(stack = listOf(ability(it))) }
            assertEquals(TableFeel.ClockStop(970, 6, 1), TableFeel.clockStop(before, six))
            assertEquals(5, TableFeel.CLOCK_STOP_COST)
            assertEquals("a cost of exactly 5", TableFeel.ClockStop(970, 5, 2), TableFeel.clockStop(before, table(2, 2).let { it.copy(stack = listOf(ability(it))) }))
            assertNull("a cost of 2", TableFeel.clockStop(before, table(5, 2).let { it.copy(stack = listOf(ability(it))) }))
            assertNull("a plus ability", TableFeel.clockStop(before, table(8, 2).let { it.copy(stack = listOf(ability(it))) }))
            assertNull("Reduced never", TableFeel.clockStop(before, six, "reduced")); assertNull("Off never", TableFeel.clockStop(before, six, "off"))
            assertNull("six loyalty lost to damage: no ability of hers is new on the stack", TableFeel.clockStop(before, table(1, 2)))
            assertNull("a trigger of hers", TableFeel.clockStop(before, table(1, 2).let { it.copy(stack = listOf(ability(it, trigger = true))) }))
            assertNull("the ability was already on the stack", TableFeel.clockStop(table(7, 1).let { it.copy(stack = listOf(ability(it))) }, six))
            // The frame: 320 in, a piece every 120, 650 circling, 520 out.
            assertEquals(320L + 6 * 120L + 650L + 520L, TableFeel.clockMs(6))
            assertEquals(0, TableFeel.clockPieces(319f, 6, 2210L)); assertEquals(1, TableFeel.clockPieces(320f, 6, 2210L)); assertEquals(3, TableFeel.clockPieces(570f, 6, 2210L)); assertEquals(6, TableFeel.clockPieces(1000f, 6, 2210L))
            assertEquals(0f, TableFeel.clockIn(0f, 2210L), 0f); assertEquals(1f, TableFeel.clockIn(320f, 2210L), 0f); assertEquals(1f, TableFeel.clockIn(1690f, 2210L), 0f); assertEquals(0f, TableFeel.clockIn(2210f, 2210L), 0f)
            // On the table: one frame for her card, six pieces, her card lifted above the table; it does not hold the queue (level 1).
            val an = Anchors().apply { putRect("c970", Rect(700f, 190f, 760f, 274f)) }
            val fx = Battlefield(); fx.take(before, an); fx.take(six, an)
            val clock = fx.items.single { it.kind == Fx.CLOCK }
            assertEquals(970, clock.card); assertEquals(6, clock.points); assertEquals("1", clock.label); assertEquals(2210L, clock.dur); assertEquals(1, clock.level)
            assertTrue(970 in fx.landers.value)
            // Forge resolves it 500 ms in: the circling is cut, colour returns over 520 ms from there. The engine is never queued.
            fx.now.longValue = clock.t0 + 500L
            fx.take(table(1, 3), an)
            assertEquals(500L + 520L, clock.dur); assertEquals(2, TableFeel.clockPieces(500f, 6, clock.dur))
            // Resolved before the grey is in: the grey is let in, then goes.
            assertEquals(320L + 520L, TableFeel.clockCut(40L, 2210L)); assertEquals("never longer", 2210L, TableFeel.clockCut(2000L, 2210L))
            // A cost of 2 schedules nothing; nor does a 6 with Match effects reduced.
            val two = Battlefield(); two.take(before, an); two.take(table(5, 2).let { it.copy(stack = listOf(ability(it))) }, an)
            assertTrue(two.items.none { it.kind == Fx.CLOCK })
            AppSettings.applyMatchEffects("reduced")
            val calm = Battlefield(); calm.take(before, an); calm.take(six, an)
            assertTrue(calm.items.none { it.kind == Fx.CLOCK })
        } finally { AppSettings.applyMatchEffects("full"); Motion.still = was }
    }

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/f5-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    /** How much colour a patch holds: the mean spread between each pixel's strongest and weakest channel. */
    private fun colour(b: Bitmap, r: Rect): Float { var sum = 0L; var n = 0
        for (y in r.top.toInt() until r.bottom.toInt() step 3) for (x in r.left.toInt() until r.right.toInt() step 3) { val p = b.getPixel(x, y); val c = listOf((p shr 16) and 0xff, (p shr 8) and 0xff, p and 0xff); sum += c.max() - c.min(); n++ }
        return sum.toFloat() / n.coerceAtLeast(1) }

    @Test fun theTableGoesGreyAndThePiecesCircleInColour() {
        Motion.still = true
        TableEmotes.destroy()
        AppSettings.applyMatchEffects("full")
        val fx = Battlefield(); val anchors = Anchors()
        val st = table(1, 2).let { it.copy(stack = listOf(ability(it))) }
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene("ashen-forge", Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        rule.waitForIdle()
        val plain = draw("board")
        val item = FxItem(Fx.CLOCK, 1, TableFeel.clockMs(6), card = 970, label = "1").also { it.points = 6 }
        rule.runOnUiThread { item.t0 = fx.now.longValue; item.dur = item.baseMs; fx.items += item; fx.reindex(); fx.now.longValue = item.t0 + 620L }
        rule.waitForIdle()
        draw("count")
        rule.runOnUiThread { fx.now.longValue = item.t0 + 320L + 6 * 120L + 300L }
        rule.waitForIdle()
        val grey = draw("grey")
        // The lava at the table's lower left is strongly coloured on the plain table and nearly grey while the clock is stopped.
        val lava = Rect(plain.width * .01f, plain.height * .52f, plain.width * .06f, plain.height * .72f)
        val whole = Rect(0f, 0f, plain.width.toFloat(), plain.height.toFloat())
        assertTrue("the plain table has colour: ${colour(plain, whole)}", colour(plain, whole) > 20f)
        assertTrue("grey over everything: ${colour(grey, whole)} against ${colour(plain, whole)}", colour(grey, whole) < colour(plain, whole) * .45f)
        // Her lifted card keeps its colour (design review 12 Nov): its face is the same pixels as on the plain table, 16 dp higher and 1.14 times the size.
        run { val c0 = anchors.rects.getValue("c970"); val dpx = grey.width / 844f; var same = 0; var all = 0
            for (fy in listOf(.2f, .35f, .5f, .65f, .8f)) for (fx0 in listOf(.2f, .35f, .5f, .65f, .8f)) { val x = c0.left + c0.width * fx0; val y = c0.top + c0.height * fy
                val lx = c0.center.x + (x - c0.center.x) * 1.14f; val ly = c0.center.y + (y - c0.center.y) * 1.14f - 16f * dpx
                val a = plain.getPixel(x.toInt(), y.toInt()); val b = grey.getPixel(lx.toInt(), ly.toInt()); all++
                if (kotlin.math.abs(((a shr 16) and 0xff) - ((b shr 16) and 0xff)) <= 40 && kotlin.math.abs((a and 0xff) - (b and 0xff)) <= 40) same++ }
            assertTrue("the lifted card is not greyed: $same of $all points keep their colour", same >= all * 3 / 4) }
        // The pieces are in colour over the grey: six chips in the shield's ice blue, on a ring round her card.
        val card = anchors.rects.getValue("c970"); val orbit = card.height * TableFeel.CLOCK_ORBIT
        // (Her shield keeps its own ice blue too; it is counted apart from the pieces.)
        val dpx = grey.width / 844f; val sh0 = anchors.rects.getValue("loyalty970")
        fun up(o: androidx.compose.ui.geometry.Offset) = androidx.compose.ui.geometry.Offset(card.center.x + (o.x - card.center.x) * 1.14f, card.center.y + (o.y - card.center.y) * 1.14f - 16f * dpx)
        val shieldNow = Rect(up(sh0.topLeft), up(sh0.bottomRight)).inflate(4 * dpx)
        var ice = 0; var far = 0; var onShield = 0
        for (y in 0 until grey.height step 2) for (x in 0 until grey.width step 2) { val p = grey.getPixel(x, y); val r = (p shr 16) and 0xff; val b = p and 0xff
            if (b - r > 90 && b > 170 && shieldNow.contains(androidx.compose.ui.geometry.Offset(x.toFloat(), y.toFloat()))) { onShield++; continue }
            if (b - r > 90 && b > 170) { ice++; val d = kotlin.math.hypot(x - card.center.x, y - (card.center.y - 16f * grey.width / 844f)); if (kotlin.math.abs(d - orbit) > orbit * .25f) far++ } }
        assertTrue("the pieces are drawn in colour: $ice", ice >= 40)
        assertTrue("and they are on the ring: $far of $ice off it", far <= ice / 10)
        assertTrue("her shield keeps its ice blue under the grey: $onShield", onShield >= 10)
        // Colour is back when the frame ends.
        rule.runOnUiThread { fx.now.longValue = item.t0 + item.dur + 1L }
        rule.waitForIdle()
        val after = draw("after")
        assertEquals("the table has its colour again", colour(plain, lava), colour(after, lava), .5f)
    }
}
