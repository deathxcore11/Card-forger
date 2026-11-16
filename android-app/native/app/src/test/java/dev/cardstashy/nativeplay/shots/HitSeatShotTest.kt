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
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Banner
import dev.cardstashy.nativeplay.match.Director
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
import dev.cardstashy.nativeplay.ui.WaitedBanner
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
 * Better table scene 7: a hit on you lands on your square, not the whole screen. The red "-3" pops on your picture, your
 * square's edge flares red (a ring and a glow out from it), the screen's edges stay as they were, and your life total stays
 * readable. A hit on the CPU rings its square only. The turn banner waits until the hit has played out.
 * Pictures in better-table/hit-*.png, on the Fold's inner screen and the phone.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class HitSeatShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private var st by mutableStateOf(base)
    private val fx = Battlefield()
    private val anchors = Anchors()

    @After fun back() { AppSettings.applyMatchEffects("full"); Motion.still = true; TableFeel.hitUntil = 0L }

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "better-table/hit-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    private fun at(items: List<FxItem>, ms: Long, name: String): Bitmap {
        rule.runOnUiThread { fx.skip(); val t = fx.now.longValue; items.forEach { it.t0 += t; it.dur = it.baseMs }; fx.items.addAll(items); fx.reindex(); fx.now.longValue = t + 1 }
        rule.waitForIdle()
        rule.runOnUiThread { fx.now.longValue += ms - 1 }; rule.waitForIdle()
        return draw(name)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }
    private fun hit(player: Int) = FxItem(Fx.LIFE, 3, 950, player = player, toKey = "orb$player", tone = Color(0xFFFF5A4A), power = .5f).also { it.label = "−3"; it.points = 3 }

    private fun hits(tag: String) {
        Motion.still = true
        TableEmotes.destroy()
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
        val plain = draw("$tag-plain")
        val dp = plain.width / rule.activity.resources.configuration.screenWidthDp.toFloat()
        val me = base.viewer; val cpu = base.cpu.id
        val sq = anchors.rects.getValue("square$me"); val orb = anchors.rects.getValue("orb$me"); val pill = anchors.rects.getValue("lifepill$me")
        // 150 ms in: the glow is at its height.
        val you = at(listOf(hit(me)), 150, "$tag-you")
        // No red wash: the screen's edges, away from your square, are as they were.
        val right = Rect(plain.width - 12 * dp, plain.height * .30f, plain.width.toFloat(), plain.height * .56f)
        val top = Rect(plain.width * .35f, 0f, plain.width * .65f, 12 * dp)
        assertEquals("no red at the screen's right edge", 0f, diff(plain, you, right), .002f)
        assertEquals("no red at the screen's top edge", 0f, diff(plain, you, top), .002f)
        // The square's edge glows: a band just above its top border, where the square is open to the table.
        // (Better table, life squares: the picture sits at the square's top left now, and its "−3" pops up past the square's top
        // edge for a while, so the band starts right of the picture.)
        val above = Rect(maxOf(sq.left + 16 * dp, orb.right + 4 * dp), sq.top - 12 * dp, sq.right - 16 * dp, sq.top - 2 * dp)
        assertTrue("your square's edge glows red: ${diff(plain, you, above)}", diff(plain, you, above) > .5f)
        val px = you.getPixel(sq.center.x.toInt(), (sq.top - 4 * dp).toInt())
        assertTrue("the glow is red: ${Integer.toHexString(px)}", android.graphics.Color.red(px) > android.graphics.Color.green(px) + 40)
        // Review: the burst is on your picture and the number floats beside the square (the preview's "−5" next to the seat), so
        // the name and the life total under it still read.
        val face = Rect(orb.center.x - orb.width * .3f, orb.top + orb.height * .15f, orb.center.x + orb.width * .3f, orb.center.y)
        assertTrue("the burst is on your picture: ${diff(plain, you, face)}", diff(plain, you, face) > .25f)
        val beside = Rect(sq.right + 10 * dp, sq.top, sq.right + 40 * dp, sq.top + sq.height * .5f)
        var red = 0; var all = 0
        for (y in beside.top.toInt() until beside.bottom.toInt() step 2) for (x in beside.left.toInt() until beside.right.toInt() step 2) { all++
            val c = you.getPixel(x, y); if (android.graphics.Color.red(c) > 200 && android.graphics.Color.green(c) < 140) red++ }
        assertTrue("the red number floats beside your square: $red of $all", red > all * .03f)
        val inner = Rect(pill.left + 3 * dp, pill.top + 3 * dp, pill.right - 3 * dp, pill.bottom - 3 * dp)
        assertTrue("your life total is clear: ${diff(plain, you, inner)}", diff(plain, you, inner) < .12f)
        // Gone by 800 ms: the square's edge is back to itself.
        val after = at(listOf(hit(me)), 800, "$tag-you-after")
        assertTrue("the glow has gone: ${diff(plain, after, above)}", diff(plain, after, above) < .05f)

        // The CPU's square rings, no glow out from it and no wash.
        val csq = anchors.rects.getValue("square$cpu")
        val theirs = at(listOf(hit(cpu)), 150, "$tag-cpu")
        val ring = Rect(csq.left + 16 * dp, csq.bottom - 1 * dp, csq.right - 16 * dp, csq.bottom + 1 * dp)
        assertTrue("the CPU's square rings: ${diff(plain, theirs, ring)}", diff(plain, theirs, ring) > .5f)
        // Its burst throws rings round the picture, but the square's own edge does not glow out: just above the CPU square's
        // bottom-right corner the red is far fainter than the same place on yours.
        fun redOut(b: Bitmap, r: Rect): Int { val x = (r.right - 30 * dp).toInt(); val y = (if (r.center.y > b.height / 2) r.top - 6 * dp else r.bottom + 6 * dp).toInt()
            val p = b.getPixel(x, y); return android.graphics.Color.red(p) - android.graphics.Color.green(p) }
        assertTrue("your glow is redder than the CPU's ring: ${redOut(you, sq)} vs ${redOut(theirs, csq)}", redOut(you, sq) > redOut(theirs, csq) + 20)
        assertEquals("no red at the screen's edges for the CPU's hit", 0f, diff(plain, theirs, right), .002f)
    }

    @Test fun hitFold() = hits("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xxhdpi") @Test fun hitPhone() = hits("phone")

    /** A state change from the test thread, sent on to the composition as the app's own main thread would. */
    private fun set(block: () -> Unit) { rule.runOnUiThread { block(); androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } }

    @Test fun theTurnBannerWaitsForTheHit() {
        Motion.still = false
        var banner by mutableStateOf<Banner?>(null)
        rule.mainClock.autoAdvance = false
        rule.setContent { WaitedBanner(banner) }
        rule.mainClock.advanceTimeByFrame()
        // A hit lands for the next 600 ms; the banner comes in now.
        TableFeel.hitUntil = android.os.SystemClock.uptimeMillis() + 600
        val text = "Turn 3 · Your turn"
        set { banner = Banner(text, true) }
        rule.mainClock.advanceTimeBy(300)
        assertEquals("no banner over the hit", 0, rule.onAllNodesWithText(text).fetchSemanticsNodes().size)
        rule.mainClock.advanceTimeBy(400)
        assertEquals("the banner once the hit is done", 1, rule.onAllNodesWithText(text).fetchSemanticsNodes().size)
        // The controller clears its banner: a late one still plays its own time.
        set { banner = null }
        rule.mainClock.advanceTimeBy(300)
        assertEquals("a late banner is not cut short", 1, rule.onAllNodesWithText(text).fetchSemanticsNodes().size)
        rule.mainClock.advanceTimeBy(Director.BANNER_MS)
        assertEquals("then it goes", 0, rule.onAllNodesWithText(text).fetchSemanticsNodes().size)
    }

    @Test fun withNoHitTheBannerComesAtOnce() {
        Motion.still = false
        TableFeel.hitUntil = 0L
        var banner by mutableStateOf<Banner?>(null)
        rule.mainClock.autoAdvance = false
        rule.setContent { WaitedBanner(banner) }
        rule.mainClock.advanceTimeByFrame()
        set { banner = Banner("Turn 4 · CPU's turn", false) }
        rule.mainClock.advanceTimeBy(50)
        assertEquals(1, rule.onAllNodesWithText("Turn 4 · CPU's turn").fetchSemanticsNodes().size)
    }
}
