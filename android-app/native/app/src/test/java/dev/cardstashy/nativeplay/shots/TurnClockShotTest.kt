package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import androidx.compose.ui.test.onRoot
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.ui.*
import org.junit.After
import org.junit.Assert.assertNotNull
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
 * The turn clock over the real table (table additions 5): the ring round the gold button at ~60 %, at 8 s (coral, the number
 * beside it), an expired CPU-match discard (held at 0: no warning, no number; the controller's own line says it), and the rival's
 * window (only the blue-grey line under the phase track). On a phone (844 × 390) and on the Thor's top screen (960 × 540, bottom
 * screen on). Each frame is also measured from the table's own boxes: the ring and the count stay inside the screen and off the
 * hand, the line in the middle, Undo and the quiet button; nothing of the clock is drawn on the bottom screen. The prompt dock's
 * confirm buttons wear the same ring (forge-table.mjs: [data-native-key=confirm-prompt]).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TurnClockShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private fun Rect.str() = "[%.0f,%.0f – %.0f,%.0f]".format(left, top, right, bottom)
    private fun apart(what: String, a: Rect, b: Rect) = assertTrue("$what overlap: ${a.str()} and ${b.str()}", !a.overlaps(b))
    private fun inside(what: String, r: Rect, wPx: Float, hPx: Float) =
        assertTrue("$what ${r.str()} leaves the ${wPx}×${hPx} px screen", r.left >= -.5f && r.top >= -.5f && r.right <= wPx + .5f && r.bottom <= hPx + .5f)

    private class Size(val tag: String, val q: String, val dual: Boolean, val w: Int, val h: Int, val px: Float)
    private val sizes = listOf(
        Size("844x390", "w844dp-h390dp-land-hdpi", false, 844, 390, 1.5f),
        Size("thor-960x540", "w960dp-h540dp-land-xhdpi", true, 960, 540, 2f),
        Size("731x411", "w731dp-h411dp-land-xhdpi", true, 731, 411, 2f))

    @Test fun ring() {
        Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val snap = state("main")
        val st = MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}").paired(snap)
        // The cleanup discard against the CPU whose time ran out: TurnClock holds it, the controller sends it held at 0.
        val discard = st.copy(inputType = "InputSelectCardsFromList", message = "Select 1 card to discard to bring your hand down to the maximum of 7 cards",
            buttons = st.buttons.copy(ok = "OK", okEnabled = false, cancel = null, cancelEnabled = false),
            selection = st.selection.copy(cards = st.me.hand.map { it.id }.toSet(), actionable = emptySet()))
        // Held clocks, so each frame is exactly the moment named (a running clock drains the same way).
        val clocks = listOf(
            Triple("ring-60", st, MatchController.Clock(0, 90_000, frozenLeft = 54_000)),
            Triple("ring-8s", st, MatchController.Clock(0, 30_000, frozenLeft = 7_400)),
            Triple("ring-8s-undo", st.copy(buttons = st.buttons.copy(cancel = "Undo", cancelEnabled = true)), MatchController.Clock(0, 30_000, frozenLeft = 7_400)),
            Triple("ring-8s-discard", discard, MatchController.Clock(0, 30_000, frozenLeft = 7_400)),
            Triple("ring-timesup", discard, MatchController.Clock(0, 30_000, frozenLeft = 0)),
            Triple("rival-line", st, MatchController.Clock(0, 30_000, frozenLeft = 12_000, own = false)),
        )
        for (size in sizes) {
            RuntimeEnvironment.setQualifiers(size.q)
            DualScreen.pretend(if (size.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
            val wPx = size.w * size.px; val hPx = size.h * size.px
            for ((name, board, c) in clocks) {
                TableEmotes.destroy()
                val anchors = Anchors()
                captureRoboImage(File(System.getProperty("shotsDir"), "clock/$name-${size.tag}.png").path) {
                    CompositionLocalProvider(LocalAnchors provides anchors, LocalMatchClock provides c) {
                        Box(Modifier.fillMaxSize().background(Palette.Night)) {
                            PlaymatScene(Modifier.fillMaxSize())
                            ForgeBoard(board, live = true, intents = TableIntents(), selectedHand = if (board === discard) board.me.hand[2].id else null, onSelectHand = {}, onInspect = {}, onMenu = {},
                                handOrder = emptyList(), onHandOrder = {})
                        }
                    }
                }
                val r = anchors.rects
                val ring = r["turnring"]; val count = r["turncount"]
                val at = "$name at ${size.tag}"
                if (!c.own) { assertNull("$at: a ring on the rival's window", ring); assertNull("$at: a count on the rival's window", count); continue }
                assertNotNull("$at: no ring", ring); inside("Ring ($at)", ring!!, wPx, hPx)
                val warn = c.frozenLeft != 0L && (c.frozenLeft ?: Long.MAX_VALUE) <= 10_000
                if (!warn) { assertNull("$at: a count outside the last 10 s (or on an expired, held window)", count); continue }
                assertNotNull("$at: no count in the last 10 s", count)
                inside("Count ($at)", count!!, wPx, hPx)
                for (k in listOf("hand", "askline", "undo", "quiet", "handchip", "gold")) r[k]?.let { apart("Count / $k ($at)", count, it) }
                for (k in listOf("undo", "askline", "handchip")) r[k]?.let { apart("Ring / $k ($at)", ring, it) }
                for (p in board.players) r["piles${p.id}"]?.let { apart("Count / piles ${p.id} ($at)", count, it); apart("Ring / piles ${p.id} ($at)", ring, it) }
            }
            if (size.dual) {
                // The bottom screen with the clock running: no ring, no count there (the clock lives on the top screen only).
                val anchors = Anchors()
                captureRoboImage(File(System.getProperty("shotsDir"), "clock/bottom-8s-${size.tag}.png").path) {
                    CompositionLocalProvider(LocalAnchors provides anchors, LocalMatchClock provides MatchController.Clock(0, 30_000, frozenLeft = 7_400)) { BottomRoot() }
                }
                assertNull("a ring on the bottom screen at ${size.tag}", anchors.rects["turnring"])
                assertNull("a count on the bottom screen at ${size.tag}", anchors.rects["turncount"])
            }
        }
    }
}

/**
 * The prompt dock: the confirm button of each kind the site rings ([data-native-key=confirm-prompt]) wears the turn ring, and its
 * last-10 count stays on the screen. The ring is placed from the button's laid-out box, a frame after it, so this runs under a
 * compose rule that waits for the table to settle before measuring and taking the shot.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PromptRingShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun Rect.str() = "[%.0f,%.0f – %.0f,%.0f]".format(left, top, right, bottom)

    @Test fun promptRing() {
        Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val boards = listOf("search", "triggers", "dock-assign", "dock-choice", "dock-costs")
        var board by androidx.compose.runtime.mutableStateOf(boards.first())
        var anchors by androidx.compose.runtime.mutableStateOf(Anchors())
        TableEmotes.destroy()
        rule.setContent {
            val st = androidx.compose.runtime.remember(board) { state(board) }
            androidx.compose.runtime.key(board) {
                CompositionLocalProvider(LocalAnchors provides anchors, LocalMatchClock provides MatchController.Clock(0, 30_000, frozenLeft = 7_400)) {
                    BoxWithConstraints(Modifier.fillMaxSize().background(Palette.Night)) {
                        val u = minOf(maxWidth.value / 844f, maxHeight.value / 390f)
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                        DecisionDock(st, live = true, intents = TableIntents(), onInspect = {}, u = u, replies = DockReplies(skipAmounts = {}))
                    }
                }
            }
        }
        for (b in boards) {
            anchors = Anchors(); board = b
            rule.waitForIdle(); rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
            val root = rule.onRoot()
            root.captureRoboImage(File(System.getProperty("shotsDir"), "clock/prompt-8s-$b-844x390.png").path)
            val size = root.fetchSemanticsNode().size
            val ring = anchors.rects["turnring"]; val count = anchors.rects["turncount"]
            assertNotNull("$b: no ring on the prompt's confirm button", ring)
            assertNotNull("$b: no count in the prompt's last 10 s", count)
            for ((what, r) in listOf("ring" to ring!!, "count" to count!!))
                assertTrue("$b: prompt $what ${r.str()} leaves the ${size.width}×${size.height} px screen", r.left >= -.5f && r.top >= -.5f && r.right <= size.width + .5f && r.bottom <= size.height + .5f)
            assertTrue("$b: count ${count.str()} on the ring ${ring.str()}", !count.overlaps(ring))
            // Beside the table (not in a centred dialog that dims it): never on the hand or a pile (the dock's own buttons are checked by eye).
            val st = state(b)
            if (b == "dock-costs" || b == "dock-choice") for (k in listOf("hand") + st.players.map { "piles${it.id}" }) anchors.rects[k]?.let { assertTrue("$b: count ${count.str()} on $k ${it.str()}", !count.overlaps(it)) }
        }
        CardImageTest.art = null
    }
}
