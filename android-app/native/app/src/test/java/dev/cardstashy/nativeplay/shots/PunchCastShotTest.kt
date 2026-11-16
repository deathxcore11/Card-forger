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
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TravelMoment
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.LocalTravel
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TravelClock
import dev.cardstashy.nativeplay.ui.ZoneLayout
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
 * Match punch P2 (specs/match-punch-brief.md, "Cast: lift, pay, charge, burst"), frame by frame at phone size. Your Monastery
 * Swiftspear is on the stack. Pay: each land flashes and a streak crosses the board to the spell, the spell's ring stepping up.
 * Burst: spikes and sparks fan toward the board; the gold button and End turn are the same pixels as before (walk line 35).
 * Pictures in table-look/p2-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PunchCastShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    @After fun off() { TravelClock.fixed = null }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val me = base.viewer
    private val spear = base.me.hand.first { it.name == "Monastery Swiftspear" }
    private val st = base.copy(prompt = null, stack = listOf(StackItem(7, spear.text, spear.copy(zone = "Stack"), me)),
        players = base.players.map { p -> if (p.id == me) p.copy(hand = p.hand.filter { it.id != spear.id }) else p })
    private val fx = Battlefield()
    private val anchors = Anchors()
    private var travel by mutableStateOf<TravelMoment?>(null)

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/p2-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    /** The leg [t] at [ms] into it, the effect clock moved on by the same amount so its particles have flown. */
    private fun at(t: Director.Travel, key: Long, ms: Long, name: String): Bitmap {
        // First the frame the bursts are thrown on, then the frame [ms] later.
        rule.runOnUiThread { TravelClock.fixed = (ms - 120L).coerceAtLeast(0L).toFloat() / t.ms; travel = TravelMoment(t, 0, key); fx.now.longValue += 1L }
        rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/p2-$name.png").path)
        rule.runOnUiThread { TravelClock.fixed = ms.toFloat() / t.ms; fx.now.longValue += 120L }
        rule.waitForIdle()
        return draw(name)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theLandsPayIntoTheSpellAndItBurstsTowardTheBoard() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx, LocalTravel provides travel) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        rule.waitForIdle()
        val plain = draw("board")
        val dp = plain.width / 844f
        val z = ZoneLayout.of(844f, 390f, k = ZoneLayout.scale(844f, 390f))
        fun ZoneLayout.Box.px() = Rect(x * dp, y * dp, right * dp, bottom * dp)
        val stack = anchors.rects.getValue("stackcard")
        val mountain = anchors.rects.getValue("c110"); val forest = anchors.rects.getValue("c113")

        // Pay, 260 ms in: the Mountain's streak is on its way (it left at 60), the Forest's (80 later) has just left; both flashed.
        val pay = Director.Travel(spear.id, spear.name, true, Director.Leg.TAPS, "stackcard", Director.payMs(2), 7, listOf(110, 113))
        val mid = at(pay, 1, 260, "pay")
        assertTrue("the land flashed", diff(plain, mid, mountain) > .3f)
        val between = Rect(forest.right + 20 * dp, minOf(stack.top, forest.top), stack.left - 10 * dp, maxOf(stack.bottom, forest.bottom))
        assertTrue("a streak crosses the board toward the spell: ${diff(plain, mid, between)}", diff(plain, mid, between) > .002f)
        // Charge: with both streaks in (420), the spell's ring is up around the stack card.
        val charged = at(pay, 1, 440, "charged")
        val rim = Rect(stack.left - 8 * dp, stack.top - 8 * dp, stack.right + 8 * dp, stack.top + 2 * dp)
        assertTrue("the spell's ring is up: ${diff(plain, charged, rim)}", diff(plain, charged, rim) > .2f)

        // Burst, 150 ms in (80 after its freeze): spikes and sparks left of the stack card, over the board.
        val rest = Director.Travel(spear.id, spear.name, true, Director.Leg.REST, "stackcard", Director.BURST_MS + Director.CAST_READ_MS, 7)
        val burst = at(rest, 2, 190, "burst")
        val left = Rect(stack.left - stack.height * .8f, stack.top, stack.left - 4 * dp, stack.bottom)
        assertTrue("the burst fans toward the board: ${diff(plain, burst, left)}", diff(plain, burst, left) > .01f)
        // Walk line 35: the gold button and End turn are untouched by it.
        assertEquals("the buttons are clear of the burst", 0f, diff(plain, burst, z.actions.px()), .002f)
        // And the player squares never move with its push-in and shake.
        assertEquals(0f, diff(plain, burst, z.mySquare.px()), .002f)
        assertEquals(0f, diff(plain, burst, z.cpuSquare.px()), .002f)
    }
}
