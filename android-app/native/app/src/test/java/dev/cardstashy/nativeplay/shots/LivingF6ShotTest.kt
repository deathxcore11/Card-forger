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
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.Strike
import dev.cardstashy.nativeplay.ui.TableFeel
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
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
 * The living table F6, the charge, at phone size: P5's strike at a player with the wind-up and the trail added. Mid-dash the
 * attacker has left sparks in its own colour on the line behind it; where it lands there are white spikes and a ring in its
 * colour. With Match effects Off neither is drawn (the strike as it was). Pictures in table-look/f6-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LivingF6ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val mine = base.me.battlefield.first { it.isCreature }
    private val theirs = base.cpu.battlefield.first { it.isCreature }
    private var st by mutableStateOf(base)
    private val fx = Battlefield()
    private val anchors = Anchors()

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/f6-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    /** [items] started now, drawn [ms] in; when [burstAt] is given the frame the bursts are thrown on is drawn first. */
    private fun at(items: List<FxItem>, ms: Long, name: String, burstAt: Long? = null): Bitmap {
        rule.runOnUiThread { fx.skip(); val t = fx.now.longValue; items.forEach { it.t0 += t; it.dur = it.baseMs }; fx.items.addAll(items); fx.reindex(); fx.now.longValue = t + (burstAt ?: ms) }
        rule.waitForIdle()
        if (burstAt != null) { rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/f6-$name.png").path)
            rule.runOnUiThread { fx.now.longValue += ms - burstAt }; rule.waitForIdle() }
        return draw(name)
    }
    @After fun back() { AppSettings.applyMatchEffects("full") }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theChargeLeavesATrailInTheCardsColourAndARingWhereItLands() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
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
        val plain = draw("board"); val dp = plain.width / 844f
        val home = anchors.rects.getValue("c${mine.id}"); val orb = anchors.rects.getValue("orb${base.cpu.id}")
        fun face() = listOf(FxItem(Fx.LUNGE, 2, Strike.FACE_MS, card = mine.id, mine = true, toKey = "orb${base.cpu.id}", tone = TableFeel.chargeTone(mine)))
        val w = Strike.wind(true).toLong(); val h = Strike.hit(true).toLong(); val after = Strike.after(true).toLong()
        // The line the attacker flies: from its tile to the CPU's picture.
        val way = Rect(minOf(home.left, orb.left), minOf(home.top, orb.bottom), maxOf(home.right, orb.right), home.top)
        val round = Rect(orb.center.x - orb.width * 1.6f, orb.center.y - orb.height * 1.6f, orb.center.x + orb.width * 1.6f, orb.center.y + orb.height * 1.6f)
        fun run(tag: String): Pair<Bitmap, Bitmap> {
            // Sparks are thrown on the frame half way through the dash and seen 60 ms on, when the card has gone ahead of them.
            val dash = at(face(), (w + h) / 2 + 60, "$tag-dash", burstAt = (w + h) / 2)
            val hit = at(face(), after + 60, "$tag-hit", burstAt = after)
            return dash to hit
        }
        AppSettings.applyMatchEffects("off"); rule.waitForIdle()
        val (offDash, offHit) = run("off")
        AppSettings.applyMatchEffects("full"); rule.waitForIdle()
        val (dash, hit) = run("full")
        assertTrue("a trail lies on the line behind the attacker: ${diff(offDash, dash, way)}", diff(offDash, dash, way) > .0005f)
        assertTrue("spikes and a ring where it lands: ${diff(offHit, hit, round)}", diff(offHit, hit, round) > .01f)
        // Design review, 12 Nov: the life number is the pay-off, so the flash is not drawn over the life pill; and the attacker is
        // drawn over the CPU's seat panel at the hit (it was under it), so the panel's pixels beside the picture have changed.
        val pill = anchors.rects.getValue("lifepill${base.cpu.id}")
        val inner = Rect(pill.left + 3 * dp, pill.top + 3 * dp, pill.right - 3 * dp, pill.bottom - 3 * dp)
        assertTrue("the life pill is clear of the flash: ${diff(plain, hit, inner)}", diff(plain, hit, inner) < .12f)
        assertTrue("with effects off the flash covers it as before: ${diff(plain, offHit, inner)}", diff(plain, offHit, inner) > .5f)
        // The same hit with its life loss, for the eye: the number and the pill ticking down.
        at(face() + FxItem(Fx.LIFE, 3, 950, player = base.cpu.id, toKey = "orb${base.cpu.id}", tone = Color(0xFFFF5A4A), power = .5f).also { it.label = "−3"; it.points = 3; it.t0 = after }, after + 60, "full-hit-life", burstAt = after)
    }
}
