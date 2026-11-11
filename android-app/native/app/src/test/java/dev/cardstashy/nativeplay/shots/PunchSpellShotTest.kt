package dev.cardstashy.nativeplay.shots

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.BOLT_MS
import dev.cardstashy.nativeplay.ui.FIRE_MS
import dev.cardstashy.nativeplay.ui.SPENT_MS
import dev.cardstashy.nativeplay.ui.frameTone
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
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
 * Match punch P6 (specs/match-punch-brief.md, "Targeted spell"), frame by frame at phone size. Your Lightning Bolt resolves at the
 * CPU's creature: the stack flashes and a thick streak is on its way across the board; then the impact (spikes, sparks, the tile
 * flashed white) and the spent spell leaving the stack for your square. The gold button and End turn are the same pixels at the
 * impact. Pictures in table-look/p6-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PunchSpellShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val mine = base.me.battlefield.first { it.isCreature }
    private val theirs = base.cpu.battlefield.first { it.isCreature }
    private var st by mutableStateOf(base)
    private val fx = Battlefield()
    private val anchors = Anchors()

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/p6-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    /** [items] started now, drawn [ms] in; when [burstAt] is given the frame the bursts are thrown on is drawn first. */
    private fun at(items: List<FxItem>, ms: Long, name: String, burstAt: Long? = null): Bitmap {
        rule.runOnUiThread { fx.skip(); val t = fx.now.longValue; items.forEach { it.t0 += t; it.dur = it.baseMs }; fx.items.addAll(items); fx.reindex(); fx.now.longValue = t + (burstAt ?: ms) }
        rule.waitForIdle()
        if (burstAt != null) { rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/p6-$name.png").path)
            rule.runOnUiThread { fx.now.longValue += ms - burstAt }; rule.waitForIdle() }
        return draw(name)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theBoltFiresLandsAndGoesToYourSquare() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        val bolt = base.me.hand.first { it.name == "Lightning Bolt" }
        val onStack = base.copy(prompt = null, stack = listOf(StackItem(7, bolt.text, bolt.copy(zone = "Stack"), base.viewer)),
            players = base.players.map { p -> if (p.id == base.viewer) p.copy(hand = p.hand.filter { it.id != bolt.id }) else p })
        val after = onStack.copy(revision = onStack.revision + 1, stack = emptyList())
        st = onStack
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        rule.waitForIdle()
        draw("stack")
        val stack = anchors.rects.getValue("stackcard"); val foe = anchors.rects.getValue("c${theirs.id}"); val grave = anchors.rects.getValue("grave${base.viewer}")
        rule.runOnUiThread { st = after }
        rule.waitForIdle()
        val plain = draw("board")
        val dp = plain.width / 844f
        val z = ZoneLayout.of(844f, 390f, k = ZoneLayout.scale(844f, 390f))
        fun ZoneLayout.Box.px() = Rect(x * dp, y * dp, right * dp, bottom * dp)
        val red = frameTone(listOf('R')).first
        fun shot() = listOf(FxItem(Fx.FIRE, 2, FIRE_MS, mine = true, from = stack, toKey = "c${theirs.id}", tone = red),
            FxItem(Fx.BOLT, 1, BOLT_MS, card = theirs.id, from = foe, fromKey = "stackcard", tone = red, delay = FIRE_MS).also { it.t0 = FIRE_MS },
            FxItem(Fx.SPENT, 1, SPENT_MS, mine = true, from = stack, toKey = "grave${base.viewer}", ghost = bolt, delay = FIRE_MS + 160).also { it.t0 = FIRE_MS + 160 })

        // Fire, 190 ms in: the stack has flashed and the streak is between the stack and the target.
        val fire = at(shot(), 190, "fire")
        val between = Rect(foe.right + 10 * dp, minOf(foe.top, stack.top), stack.left - 10 * dp, maxOf(foe.bottom, stack.bottom))
        assertTrue("a streak crosses the board to the target: ${diff(plain, fire, between)}", diff(plain, fire, between) > .003f)
        assertEquals("nothing has landed yet", 0f, diff(plain, fire, Rect(foe.left + 8 * dp, foe.top + 8 * dp, foe.left + 30 * dp, foe.bottom - 8 * dp)), .02f)
        // Impact, 60 ms after it lands: the tile is flashed and spikes and sparks stand round it. The buttons have not moved.
        val hit = at(shot(), FIRE_MS + 60, "impact", burstAt = FIRE_MS)
        assertTrue("the struck tile flashes: ${diff(plain, hit, foe)}", diff(plain, hit, foe) > .5f)
        val round = Rect(foe.left - 40 * dp, foe.top - 40 * dp, foe.right + 40 * dp, foe.top - 4 * dp)
        assertTrue("spikes and sparks round it: ${diff(plain, hit, round)}", diff(plain, hit, round) > .02f)
        assertEquals("the buttons are clear of the impact", 0f, diff(plain, hit, z.actions.px()), .002f)
        // After, 200 ms into the spent spell's 320: it is off the stack, on its way to your square.
        val gone = at(shot(), FIRE_MS + 160 + 200, "spent", burstAt = FIRE_MS)
        val way = Rect(grave.right + 20 * dp, minOf(stack.top, grave.top), stack.left - 20 * dp, maxOf(stack.bottom, grave.bottom))
        assertTrue("the spent spell is on its way to your square: ${diff(plain, gone, way)}", diff(plain, gone, way) > .002f)
    }
}
