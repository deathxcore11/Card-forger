package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Mulligan
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import org.junit.Assert.assertEquals
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
 * Better table scene 11, the opening hand, on the Fold's inner screen (884 x 796) and a phone (844 x 390): who goes first is the
 * gold title at the top centre, "CPU kept 7" under it only when Forge's events say the CPU kept, the seven cards fan across most of
 * the width, Mulligan ("to 6") and Keep 7 stand side by side near the foot clear of every card, and the held View table sits top
 * right clear of the CPU's seat. Held, the view hides and the pill stays.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class OpeningShotTest {
    @get:Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private val opening = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-opening.json")!!.readText())!!
    private val anchors = Anchors()

    private fun mull(seq: Long, player: Int) = GameEvent(seq, "mulligan", 0, null, player, null, null, null, emptyList(), emptyList(), emptyList(), null, null, null, null, null, null)
    /** The CPU goes first and has kept 7 (Forge's real message; no "mulligan" event from it this round). */
    private fun cpuFirst() = opening.copy(message = "CPU is going first.\nYou, you are going 2nd.\n\nDo you want to keep your hand?", activePlayer = null)
    /** You go first: the CPU has not decided yet, so no line. */
    private fun youFirst() = opening.copy(message = "You, you are going first!\n\nDo you want to keep your hand?", activePlayer = null)

    private fun show(st: MatchState) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalMatchClock provides dev.cardstashy.nativeplay.match.MatchController.Clock(android.os.SystemClock.elapsedRealtime() + 21_000, 30_000)) {
                        Mulligan(st, live = true, onOk = {}, onCancel = {}, onCard = {}, onDeal = {}, onHold = {})
                    }
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
    }
    private fun cap(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-gaps/$name.png").path) }
    private fun r(k: String) = anchors.rects[k] ?: error("no anchor $k")
    private fun apart(a: Rect, b: Rect) = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top

    private fun opening(tag: String) {
        show(cpuFirst())
        val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
        val w = dm.widthPixels.toFloat(); val h = dm.heightPixels.toFloat()
        cap("opening-better-cpu-first-$tag")
        for (t in listOf("CPU goes first", "Mulligan", "to 6", "Keep 7", "View table")) rule.onNodeWithText(t).assertExists()
        rule.onNodeWithText("kept 7", substring = true).assertExists()
        // The title: top centre.
        val title = r("mull.title")
        assertTrue("$tag: the title is centred ${title}", kotlin.math.abs(title.center.x - w / 2) < w * .02f)
        assertTrue("$tag: the title is near the top ${title}", title.top < h * .14f)
        // The seven cards span most of the width (the fan's box: the cards' own rects are laid out before the deal-in springs move
        // them, so they are not read here), and the fan is clear of the title block, the pair, its line and the pill.
        val fan = r("mull.fan")
        assertEquals(7, opening.me.hand.size)
        assertTrue("$tag: the fan spans ${fan.width / w} of the width", fan.width >= w * .9f && kotlin.math.abs(fan.center.x - w / 2) < 2f)
        // The arc drops the end cards and the 3.2 degree turn lifts a corner: 6 % of the fan's height either way.
        val slack = fan.height * .06f
        val reach = Rect(fan.left, fan.top - slack, fan.right, fan.bottom + slack)
        for (k in listOf("mull.title", "mull.kept", "mull.pips", "mull", "gold", "mull.line", "peektable")) assertTrue("$tag: the fan $reach meets $k ${r(k)}", apart(reach, r(k)))
        // Mulligan and Keep: side by side either side of the middle, at about 84 % of the height on the Fold, on screen on a phone.
        val m = r("mull"); val g = r("gold")
        assertTrue("$tag: side by side", kotlin.math.abs(m.center.y - g.center.y) < 4f && m.right <= w / 2 && g.left >= w / 2)
        assertTrue("$tag: about equal either side ${m} ${g}", kotlin.math.abs((w / 2 - m.right) - (g.left - w / 2)) < 4f)
        if (tag == "fold") assertTrue("fold: the pair at 84 % ${m.top / h}", kotlin.math.abs(m.top / h - .84f) < .02f)
        assertTrue("$tag: the line on screen ${r("mull.line")}", r("mull.line").bottom <= h + 1f && r("mull.line").top >= m.bottom)
        assertTrue("$tag: buttons wide enough", m.width >= w * .17f - 2f && g.width >= w * .17f - 2f)
        // View table: top right, clear of both seats.
        val pill = r("peektable")
        assertTrue("$tag: View table top right $pill", pill.right > w * .9f && pill.top < h * .1f)
        for (orb in opening.players.map { "orb${it.id}" }) assertTrue("$tag: View table meets $orb ${r(orb)}", apart(pill, r(orb)))
        assertTrue("$tag: title clear of View table", apart(title, pill))
        // Held: the view hides (the pill stays); let go, it comes back.
        rule.onNode(hasContentDescription("View table")).performTouchInput { down(center) }
        cap("opening-better-peek-$tag")
        rule.onNode(hasContentDescription("View table")).performTouchInput { up() }
    }

    @Test fun openingFold() = opening("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun openingPhone() = opening("phone")

    /** You go first: the title says so and no "CPU kept" line is made up (the CPU decides after you). */
    @Test fun youGoFirstHasNoKeptLine() {
        show(youFirst())
        cap("opening-better-you-first-fold")
        rule.onNodeWithText("You go first").assertExists()
        assertNull("no kept line before the CPU decides", anchors.rects["mull.kept"])
        rule.onNodeWithText("Keep 7").assertExists()
    }

    /** The CPU went first and took a mulligan this round (Forge's event): it has not kept yet, so no line. */
    @Test fun cpuStillDecidingHasNoKeptLine() {
        show(cpuFirst().copy(events = listOf(mull(33, opening.cpu.id)), players = opening.players.map { if (it.id == opening.cpu.id) it.copy(handCount = 6) else it }))
        rule.onNodeWithText("CPU goes first").assertExists()
        assertNull(anchors.rects["mull.kept"])
    }
}
