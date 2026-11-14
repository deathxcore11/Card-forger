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
import dev.cardstashy.nativeplay.ui.DEATH_MS
import dev.cardstashy.nativeplay.ui.EMBERS_MS
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.Strike
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
 * Match punch P5 (specs/match-punch-brief.md, "Attack, block, clash, kill, face hit"), frame by frame at phone size. Your creature
 * strikes the CPU's: at contact it is off its own tile and on the other; when the freeze ends sparks fly on past the hit. The kill:
 * the card is gone from its place and its embers are on their way to the CPU's square. The face hit: the attacker is at the CPU's
 * picture and coral spikes stand off the square. The gold button and End turn are the same pixels through the clash and the kill.
 * Pictures in table-look/p5-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PunchCombatShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val mine = base.me.battlefield.first { it.isCreature }
    private val theirs = base.cpu.battlefield.first { it.isCreature }
    private var st by mutableStateOf(base)
    private val fx = Battlefield()
    private val anchors = Anchors()

    private fun draw(name: String): Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/p5-$name.png")
        var last: ByteArray? = null
        for (i in 0 until 12) { rule.onRoot().captureRoboImage(f.path); val now = f.readBytes(); if (last != null && now.contentEquals(last)) break; last = now; Thread.sleep(300); rule.waitForIdle() }
        return BitmapFactory.decodeFile(f.path)
    }
    /** [items] started now, drawn [ms] in; when [burstAt] is given the frame the bursts are thrown on is drawn first. */
    private fun at(items: List<FxItem>, ms: Long, name: String, burstAt: Long? = null): Bitmap {
        rule.runOnUiThread { fx.skip(); val t = fx.now.longValue; items.forEach { it.t0 += t; it.dur = it.baseMs }; fx.items.addAll(items); fx.reindex(); fx.now.longValue = t + (burstAt ?: ms) }
        rule.waitForIdle()
        if (burstAt != null) { rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/p5-$name.png").path)
            rule.runOnUiThread { fx.now.longValue += ms - burstAt }; rule.waitForIdle() }
        return draw(name)
    }
    private fun diff(a: Bitmap, c: Bitmap, r: Rect): Float {
        var n = 0; var all = 0
        for (y in r.top.toInt().coerceAtLeast(0) until r.bottom.toInt().coerceAtMost(a.height) step 2) for (x in r.left.toInt().coerceAtLeast(0) until r.right.toInt().coerceAtMost(a.width) step 2) { all++; if (a.getPixel(x, y) != c.getPixel(x, y)) n++ }
        return n.toFloat() / all.coerceAtLeast(1)
    }

    @Test fun theClashTheKillAndTheFaceHit() {
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
        val plain = draw("board")
        val dp = plain.width / 844f
        val z = ZoneLayout.of(844f, 390f, k = ZoneLayout.scale(844f, 390f))
        fun ZoneLayout.Box.px() = Rect(x * dp, y * dp, right * dp, bottom * dp)
        val home = anchors.rects.getValue("c${mine.id}"); val foe = anchors.rects.getValue("c${theirs.id}")
        val orb = anchors.rects.getValue("orb${base.cpu.id}"); val grave = anchors.rects.getValue("grave${base.cpu.id}")
        fun clash() = listOf(FxItem(Fx.LUNGE, 2, Strike.CLASH_MS, card = mine.id, mine = true, toKey = "c${theirs.id}", tone = Color(0xFFFF6A4A), power = .8f))

        // Contact (235 ms): the attacker has left its tile and is on the struck one. Nothing has burst yet (the freeze).
        val contact = at(clash(), 240, "clash-contact")
        assertTrue("the attacker is off its tile: ${diff(plain, contact, home)}", diff(plain, contact, home) > .3f)
        // 60 ms after the freeze: sparks have flown on past the hit, away from the attacker, and the struck tile is knocked.
        val after = Strike.after(false).toLong()
        val burst = at(clash(), after + 60, "clash-burst", burstAt = after)
        // F6 (the look pass, 12 Nov): the hit is one burst where the cards meet. Its sparks are thrown on through the struck tile
        // (eighteen of them, alive 60 ms on), and the tile itself flashes.
        assertTrue("the hit throws its sparks: ${fx.bits.kinds()}", fx.bits.kinds().count { it == dev.cardstashy.nativeplay.ui.Bit.SPARK } >= 18)
        assertTrue("the struck tile flashes: ${diff(contact, burst, foe)}", diff(contact, burst, foe) > .3f)
        assertEquals("the buttons are clear of the clash", 0f, diff(plain, burst, z.actions.px()), .002f)

        // The kill: the CPU's creature is gone from the board; its last picture shudders, breaks, and its embers fly to the CPU's square.
        rule.runOnUiThread { st = base.copy(revision = base.revision + 1, players = base.players.map { p -> if (p.id == base.cpu.id) p.copy(battlefield = p.battlefield.filter { it.id != theirs.id }) else p }) }
        rule.waitForIdle()
        fun kill() = listOf(FxItem(Fx.DEATH, 2, DEATH_MS, from = foe, toKey = "grave${base.cpu.id}", ghost = theirs),
            FxItem(Fx.EMBERS, 1, EMBERS_MS, card = theirs.id, from = foe, toKey = "grave${base.cpu.id}", delay = 240).also { it.t0 = 240 })
        val grey = at(kill(), 200, "kill-shudder")
        val gone = at(kill(), 240 + 260, "kill-embers", burstAt = 240)
        assertTrue("its last picture stands, greyed, while it shudders: ${diff(grey, gone, foe)}", diff(grey, gone, foe) > .3f)
        val way = Rect(minOf(grave.left, foe.left), minOf(grave.top, foe.top), maxOf(grave.right, foe.left), maxOf(grave.bottom, foe.bottom))
        val empty = at(emptyList(), 0, "kill-after")
        assertTrue("embers are on their way to the square: ${diff(empty, gone, way)}", diff(empty, gone, way) > .002f)
        assertEquals("the buttons are clear of the kill", 0f, diff(empty, gone, z.actions.px()), .002f)

        // The face hit: at 365 the attacker is at the CPU's picture; 60 ms after the 125 ms freeze coral spikes stand off the square.
        rule.runOnUiThread { st = base }
        rule.waitForIdle()
        fun face() = listOf(FxItem(Fx.LUNGE, 2, Strike.FACE_MS, card = mine.id, mine = true, toKey = "orb${base.cpu.id}", tone = Color(0xFFFF6A4A)),
            FxItem(Fx.LIFE, 3, 950, player = base.cpu.id, toKey = "orb${base.cpu.id}", tone = Color(0xFFFF5A4A), power = .5f).also { it.label = "−3"; it.points = 3; it.t0 = Strike.after(true).toLong() })
        val reach = at(face(), 365, "face-contact")
        assertTrue("the attacker is off its tile: ${diff(plain, reach, home)}", diff(plain, reach, home) > .3f)
        // F6 (the look pass, 12 Nov): it lands beside the CPU's picture, on the square's open side, small and drawn over the square.
        val beside = Rect(orb.right + 2 * dp, orb.top, orb.right + home.width * dev.cardstashy.nativeplay.ui.TableFeel.CHARGE_FIST * .8f, orb.bottom)
        assertTrue("and seen beside the CPU's picture: ${diff(plain, reach, beside)}", diff(plain, reach, beside) > .3f)
        val lands = Strike.after(true).toLong()
        val hit = at(face(), lands + 60, "face-burst", burstAt = lands)
        val off = Rect(orb.right + 4 * dp, orb.top - 10 * dp, orb.right + 60 * dp, orb.bottom + 10 * dp)
        assertTrue("spikes stand off the square: ${diff(reach, hit, off)}", diff(reach, hit, off) > .05f)
        // Mobile table M10: the CPU's hit leaves the screen's edges alone; the same hit to you washes them red.
        val rim = Rect(plain.width - 12 * dp, plain.height * .44f, plain.width.toFloat(), plain.height * .56f)
        assertEquals("no red wash when the CPU is hit", 0f, diff(reach, hit, rim), .002f)
        val me = at(listOf(FxItem(Fx.LIFE, 3, 950, player = base.viewer, toKey = "orb${base.viewer}", tone = Color(0xFFFF5A4A), power = .5f).also { it.label = "−3"; it.points = 3 }), 90, "face-you")
        assertTrue("the red wash when you are hit: ${diff(plain, me, rim)}", diff(plain, me, rim) > .5f)
    }
}
