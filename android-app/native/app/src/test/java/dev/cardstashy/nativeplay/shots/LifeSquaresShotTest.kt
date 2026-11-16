package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.test.onAllNodesWithText
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Motion
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.heroLifeSp
import dev.cardstashy.nativeplay.ui.lifeLow
import dev.cardstashy.nativeplay.ui.turnTag
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
 * Better table, life squares (Randall: "make it cool as shit"; specs/better-table-build-plan/life-squares-hit-defeat.md part A):
 * each player's square leads with the life total, big and heavy, the small portrait with the name beside it, Hand and Deck as
 * glyph chips and the graveyard kept. On the player's turn a gold bar, a bright edge and "YOUR TURN" / "CPU'S TURN"; at 5 life or
 * less the number turns red. Pictures on the Fold's inner screen (884 × 796) and the phone (844 × 390) in better-table/squares-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class LifeSquaresShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "better-table/squares-$name.png").path

    @After fun off() { DualScreen.pretend(null); Pad.forget(); TableEmotes.menuOpen = false; Motion.still = true }

    private fun draw(name: String, st: MatchState): Pair<Anchors, String> {
        TableEmotes.destroy()
        var seen: Anchors? = null
        val path = shot(name)
        captureRoboImage(path) {
            val anchors = remember { Anchors() }.also { seen = it }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return seen!! to path
    }


    private fun squares(tag: String) {
        Motion.still = true
        val base = state("crowded")
        val cases = listOf("$tag-yours" to base.copy(activePlayer = base.viewer).lives(20, 13),
            "$tag-cpu-low" to base.copy(activePlayer = base.cpu.id).lives(17, 3),
            "$tag-you-low" to base.copy(activePlayer = base.viewer).lives(2, 20))
        for ((name, st) in cases) {
            val (a, path) = draw(name, st)
            val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
            fun Rect.inside(o: Rect) = left >= o.left - dp && top >= o.top - dp && right <= o.right + dp && bottom <= o.bottom + dp
            val bmp = BitmapFactory.decodeFile(path)
            for (p in st.players) {
                val sq = a.rects["square${p.id}"]; assertNotNull("$name: no square for ${p.name}", sq)
                // Every part of the square inside it, the number clear of the picture and the chips.
                val keys = listOf("orb${p.id}", "lifepill${p.id}", "lib${p.id}", "grave${p.id}", "piles${p.id}") + (if (p.isViewer) emptyList() else listOf("cpuhandwords"))
                for (k in keys) { val r = a.rects[k]; assertNotNull("$name: no $k", r); assertTrue("$name: $k $r outside ${p.name}'s square $sq", r!!.inside(sq!!)) }
                val life = a.rects.getValue("lifepill${p.id}")
                for (k in listOf("orb${p.id}", "lib${p.id}") + (if (p.isViewer) emptyList() else listOf("cpuhandwords")))
                    assertFalse("$name: the life $life meets $k ${a.rects[k]}", life.deflate(dp).overlaps(a.rects.getValue(k)))
                // The life is the hero: never under 28 sp, and it is the biggest thing in the square after the square itself.
                val sp = a.sizes["lifesp${p.id}"] ?: 0f
                assertTrue("$name: ${p.name}'s life at $sp sp", sp >= 28f)
                assertTrue("$name: ${p.name}'s life ${life.height / dp} dp tall, the picture ${a.rects.getValue("orb${p.id}").height / dp}", life.height >= a.rects.getValue("orb${p.id}").height * .8f)
                // The turn: the gold edge mark and the tag on the active player's square only.
                assertEquals("$name: ${p.name}'s gold edge", p.id == st.activePlayer, a.sizes["squareactive${p.id}"] == 1f)
                if (p.id == st.activePlayer) assertNotNull("$name: no turn tag", a.rects["turntag${p.id}"]) else assertNull("$name: a turn tag on ${p.name}", a.rects["turntag${p.id}"])
                // Low life: the number is red; otherwise it is cream (no red in it).
                var red = 0; var all = 0
                for (y in life.top.toInt() until life.bottom.toInt() step 2) for (x in life.left.toInt() until life.right.toInt() step 2) {
                    val px = bmp.getPixel(x.coerceIn(0, bmp.width - 1), y.coerceIn(0, bmp.height - 1)); all++
                    if (android.graphics.Color.red(px) > 200 && android.graphics.Color.green(px) < 140) red++ }
                if (lifeLow(p.life)) assertTrue("$name: ${p.name}'s low life is not red ($red of $all)", red > all * .04f)
                else assertTrue("$name: ${p.name}'s life is red at ${p.life} ($red of $all)", red < all * .01f)
            }
            // The active square's top edge is gold.
            val on = a.rects.getValue("square${st.activePlayer}")
            val px = bmp.getPixel(on.center.x.toInt(), (on.top + 2.6f * dp).toInt())
            assertTrue("$name: the gold bar ${Integer.toHexString(px)}", android.graphics.Color.red(px) >= 200 && android.graphics.Color.green(px) >= 150 && android.graphics.Color.blue(px) < 190)
            println("[squares] $name cpu ${a.rects["square${st.cpu.id}"]} me ${a.rects["square${st.viewer}"]} life ${a.rects["lifepill${st.viewer}"]} ${a.sizes["lifesp${st.viewer}"]} sp")
        }
        // A Commander game: the damage lines at the foot, clear of the number, the chips and the graveyard, and the number clear of
        // the portrait above it (review: with one line on the phone the '38' and '40' touched the portrait ring). One line, and two
        // (partners or a pod: CommanderMarks.damageShown shows at most two), on your turn (the turn tag under the name) and the CPU's.
        val one = state("commander")
        val two = one.copy(players = one.players.map { p -> p.copy(commanderDamage = p.commanderDamage + p.commanderDamage.map { it.copy(from = it.from + 100, commander = "Kraum, Ludevic's Opus", damage = 4) }) })
        val dp = RuntimeEnvironment.getApplication().resources.displayMetrics.density
        for ((name, cmd) in listOf("commander" to one, "commander-2lines" to two, "commander-2lines-yours" to two.copy(activePlayer = two.viewer))) {
            val (a, _) = draw("$tag-$name", cmd)
            for (p in listOf(cmd.me, cmd.cpu)) {
                val dmg = a.rects["cmdrdmg${p.id}"]; assertNotNull("$tag $name: no damage lines for ${p.name}", dmg)
                for (k in listOf("lifepill${p.id}", "piles${p.id}", "orb${p.id}", "lib${p.id}")) assertFalse("$tag $name: damage $dmg meets $k ${a.rects[k]}", dmg!!.deflate(dp / 2).overlaps(a.rects.getValue(k)))
                val life = a.rects.getValue("lifepill${p.id}"); val orb = a.rects.getValue("orb${p.id}")
                assertTrue("$tag $name: ${p.name}'s life $life reaches into the portrait $orb", life.top >= orb.bottom - dp / 2)
                a.rects["turntag${p.id}"]?.let { t -> assertFalse("$tag $name: ${p.name}'s life $life meets the turn tag $t", life.deflate(dp / 2).overlaps(t)) }
                assertTrue("$tag $name: ${p.name}'s life under the floor", (a.sizes["lifesp${p.id}"] ?: 0f) >= dev.cardstashy.nativeplay.ui.TextFloors.LIFE)
            }
        }
        // A four-player pod: every square's number clear of its portrait.
        val pod = state("pod")
        val (a, _) = draw("$tag-pod", pod)
        for (p in pod.players) {
            val life = a.rects["lifepill${p.id}"] ?: continue; val orb = a.rects["orb${p.id}"] ?: continue
            assertFalse("$tag pod: ${p.name}'s life $life meets the portrait $orb", life.deflate(dp / 2).overlaps(orb))
        }
    }

    @Test fun squaresFold() = squares("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xxhdpi") @Test fun squaresPhone() = squares("phone")

    @Test fun theRules() {
        assertTrue(lifeLow(5)); assertTrue(lifeLow(0)); assertTrue(lifeLow(-3)); assertFalse(lifeLow(6))
        assertEquals(34f, heroLifeSp(1f), .01f); assertEquals(48f, heroLifeSp(2f), .01f); assertEquals(28f, heroLifeSp(.6f), .01f)
        // The number fits the band under the portrait row: full size when there is room, smaller when not, never under the floor.
        assertEquals(34f, dev.cardstashy.nativeplay.ui.heroFitSp(1f, 60f), .01f)
        assertEquals(20f, dev.cardstashy.nativeplay.ui.heroFitSp(1f, 20f * dev.cardstashy.nativeplay.ui.HERO_CAP), .01f)
        assertEquals(dev.cardstashy.nativeplay.ui.TextFloors.LIFE, dev.cardstashy.nativeplay.ui.heroFitSp(1f, 2f), .01f)
        assertEquals("YOUR TURN", turnTag(true)); assertEquals("CPU'S TURN", turnTag(false))
    }
}

internal fun MatchState.lives(me: Int, cpu: Int) = copy(players = players.map { if (it.id == viewer) it.copy(life = me) else it.copy(life = cpu) })

/** Better table, life squares: the count's motion, on the frame clock (not still). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class LifeSquaresCountTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:Rule val rule = androidx.compose.ui.test.junit4.createComposeRule()
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    @After fun off() { Motion.still = true }

    /** A gain counts up a point at a time (90 ms each), and lands on Forge's number. */
    @Test fun aGainCountsUp() {
        Motion.still = false
        val base = state("crowded").let { it.copy(activePlayer = it.viewer).lives(20, 13) }
        var st by mutableStateOf(base)
        rule.mainClock.autoAdvance = false
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides remember { Anchors() }) {
                ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
            }
        }
        rule.mainClock.advanceTimeBy(200)
        fun shows(n: Int) = rule.onAllNodesWithText("$n").fetchSemanticsNodes().isNotEmpty()
        assertTrue("20 at the start", shows(20))
        rule.runOnIdle { st = base.lives(23, 13); Snapshot.sendApplyNotifications() }
        rule.mainClock.advanceTimeBy(48)
        assertTrue("the first point up: 21", shows(21)); assertFalse("not at 23 yet", shows(23))
        rule.mainClock.advanceTimeBy(90)
        assertTrue("the next: 22", shows(22))
        rule.mainClock.advanceTimeBy(400)
        assertTrue("lands on 23", shows(23)); assertFalse("21 gone", shows(21))
    }

}
