package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.60 Z5 (specs/table-zones-brief.md, "Hand tray"): the hand lies in a glass tray, whole cards, fully inside the window inside its
 * insets, clear of the bottom edge and the navigation bar; a lifted card opens upward and stays inside the screen (live: the lifted
 * card was cut by the bottom edge). Seven cards at every one-screen size of the brief, with no insets and with a 32 dp cutout on the
 * left and a 24 dp navigation bar along the bottom (as TableScreen pads the board by the safe-drawing insets); the first, middle and
 * last card lifted. Pictures in table-look/z5-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookZ5ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private val sizes = listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "904x386" to "w904dp-h386dp-land-xxhdpi", "884x796" to "w884dp-h796dp-land-xhdpi",
        "960x540" to "w960dp-h540dp-land-xhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi", "1920x1080" to "w1920dp-h1080dp-land-mdpi", "640x360" to "w640dp-h360dp-land-xhdpi")
    /** No insets; a cutout on the left and the navigation bar along the bottom. */
    private val insets = listOf("bare" to ZoneLayout.Insets(), "bars" to ZoneLayout.Insets(left = 32f, bottom = 24f))

    /** The main table with exactly seven cards in your hand (copies of its own cards under new ids where it has fewer). */
    private fun seven(): MatchState {
        val st = state("main").let { it.copy(stack = emptyList()) }
        val own = st.me.hand
        assertTrue("the main table has a hand", own.isNotEmpty())
        val hand = (0 until 7).map { i -> own.getOrNull(i) ?: own[i % own.size].copy(id = 90_000 + i) }
        return st.copy(players = st.players.map { if (it.id == st.viewer) it.copy(hand = hand, handCount = 7) else it })
    }

    @Test fun theHandTrayIsInsideTheWindowAndALiftedCardOnTheScreen() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val st = seven()
        val hand = st.me.hand
        for ((size, q) in sizes) for ((inTag, ins) in insets) for (lift in listOf(null, 0, 3, 6)) {
            RuntimeEnvironment.setQualifiers(q)
            val lifted = lift?.let { hand[it] }
            var seen: Anchors? = null
            val name = "z5-$size-$inTag-${lift?.let { "lift$it" } ?: "rest"}"
            captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$name.png").path) {
                val anchors = remember { Anchors() }.also { seen = it }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        Box(Modifier.fillMaxSize().padding(start = ins.left.dp, top = ins.top.dp, end = ins.right.dp, bottom = ins.bottom.dp)) {
                            ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = lifted?.id, onSelectHand = {}, onInspect = {}, onMenu = {},
                                handOrder = emptyList(), onHandOrder = {})
                        }
                    }
                }
            }
            val r = seen!!.rects
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            val dp = dm.density
            val screen = Rect(0f, 0f, dm.widthPixels.toFloat(), dm.heightPixels.toFloat())
            val window = Rect(ins.left * dp, ins.top * dp, dm.widthPixels - ins.right * dp, dm.heightPixels - ins.bottom * dp)
            fun Rect.inside(o: Rect) = left >= o.left - dp && top >= o.top - dp && right <= o.right + dp && bottom <= o.bottom + dp
            val tag = "$size $inTag ${lift?.let { "lift $it" } ?: "at rest"}"
            // The tray: inside the window inside the insets, 4 du clear of its bottom, and where ZoneLayout.hand puts it.
            val tray = r["handTray"]; assertNotNull("$tag: no hand tray", tray); tray!!
            assertTrue("$tag: tray $tray leaves the window $window", tray.inside(window))
            assertTrue("$tag: tray $tray on the bottom edge $window", tray.bottom < window.bottom - dp)
            val z = ZoneLayout.of(window.width / dp, window.height / dp)
            val want = ZoneLayout.hand(z, 7)!!.tray
            assertEquals("$tag: tray left", ins.left + want.x, tray.left / dp, 1f); assertEquals("$tag: tray top", ins.top + want.y, tray.top / dp, 1f)
            assertEquals("$tag: tray width", want.w, tray.width / dp, 1f); assertEquals("$tag: tray height", want.h, tray.height / dp, 1f)
            // Whole cards: all seven drawn, each inside the window; at rest each inside the tray's width too (while one is lifted its
            // neighbours ease aside, as they always have, and may reach past the glass, never past the window).
            for ((i, c) in hand.withIndex()) {
                val b = r["hand${c.id}"]; assertNotNull("$tag: card $i not drawn", b); b!!
                assertTrue("$tag: card $i $b leaves the window $window", b.inside(window))
                if (lift == null) assertTrue("$tag: card $i $b outside the tray $tray", b.left >= tray.left - dp && b.right <= tray.right + dp && b.bottom <= tray.bottom + dp)
            }
            // The lifted card: it grew upward and stays inside the screen (and the window).
            if (lift != null) {
                val up = r.getValue("hand${hand[lift].id}"); val other = r.getValue("hand${hand[if (lift == 0) 1 else 0].id}")
                assertTrue("$tag: lifted card $up leaves the screen $screen", up.inside(screen))
                assertTrue("$tag: lifted card $up leaves the window $window", up.inside(window))
                assertTrue("$tag: the lift did not grow ($up vs $other)", up.height > other.height * 1.2f)
                assertTrue("$tag: the lift did not open upward ($up vs $other)", up.top < other.top && up.bottom <= tray.bottom + dp)
            }
            println("[z5] $tag tray ${tray.width / dp}x${tray.height / dp} at ${tray.top / dp}")
        }
    }
}
