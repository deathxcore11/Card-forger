package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TextFloors
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Phone review of the M batch (specs/mobile-table-arena-parity-brief.md, "Builder's phone build against the 23:20Z calls", 5 and
 * 6), on the crowded table at 844 x 390 where your row holds thirteen piles: every P/T plate is whole inside the part of its
 * tile that shows (the spaces go, then the numbers step down, never under 12 sp), and no name is wrapped inside a word (a word
 * too long ends in an ellipsis). Picture in table-look/phone-crowded-row.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class PhoneCrowdedRowShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-crowded.json")!!.readText())!!

    @Test fun platesAreWholeAndNoNameBreaksInsideAWord() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        val a = Anchors()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides a) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle(); rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/phone-crowded-row.png").path)
        var overlapped = 0
        for (p in st.players) {
            val row = p.battlefield.filter { !it.isLand && it.attachedTo == null }.mapNotNull { c -> a.rects["c${c.id}"]?.let { c to it } }
                .filter { (_, r) -> kotlin.math.abs(r.center.y - a.rects.getValue("c${p.battlefield.first { it.isCreature }.id}").center.y) < r.height / 2 }.sortedBy { it.second.left }
            row.forEachIndexed { i, (c, r) ->
                assertTrue("${c.name}: its name breaks inside a word", a.rects["namebroken${c.id}"] == null)
                val pt = a.rects["pt${c.id}"] ?: return@forEachIndexed
                // The next tile to the right that lies over this one hides everything from its left edge on.
                val shows = row.drop(i + 1).filter { it.second.left < r.right - 1f && it.first.name != c.name }.minOfOrNull { it.second.left } ?: r.right
                if (shows < r.right - 1f) overlapped++
                assertTrue("${c.name}: the plate $pt is covered from $shows", pt.right <= shows + 1f && pt.left >= r.left - 1f)
                assertTrue("${c.name}: P/T ${a.sizes["ptsp${c.id}"]} sp", (a.sizes["ptsp${c.id}"] ?: 0f) >= TextFloors.PT_OVERLAPPED - .01f)
            }
        }
        assertTrue("the crowded row overlaps (else this proves nothing)", overlapped > 3)
    }
}
