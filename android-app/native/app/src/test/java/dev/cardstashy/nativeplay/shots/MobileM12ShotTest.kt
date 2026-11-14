package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.CpuFan
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Assert.assertEquals
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
 * Mobile table M12 (specs/mobile-table-arena-parity-brief.md, walk line 71): the CPU's hand is a fan of card backs at the top
 * edge, one back per card, the count the same as "Hand N" in its square; with a card fewer there is a back fewer, with none
 * there is no fan. The fan keeps off the CPU's creatures. Pictures in table-look/m12-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM12ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun hand(n: Int) = base.copy(players = base.players.map { p -> if (p.id == base.cpu.id) p.copy(handCount = n) else p })

    private fun board(st: MatchState, file: String): Anchors {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val anchors = Anchors()
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path) {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return anchors
    }
    private fun backs(a: Anchors) = a.rects.keys.count { it.startsWith("cpuback") }
    private fun check(size: String, h: Float) {
        val seven = board(hand(7), "m12-$size-7")
        assertEquals("$size: one back per card", 7, backs(seven))
        val fan = seven.rects.getValue("cpuhand")
        assertTrue("$size: the fan hangs from the top edge: $fan", fan.top < 0f && fan.bottom > 0f && fan.bottom < h * .2f)
        assertTrue("$size: Hand 7 is still said in the CPU's square", seven.rects.getValue("cpuhandwords").let { w -> seven.rects.getValue("square${base.cpu.id}").let { w.left >= it.left && w.right <= it.right } })
        for (c in base.cpu.battlefield.filter { it.isCreature }) seven.rects["c${c.id}"]?.let { assertTrue("$size: the fan keeps off ${c.name}", !it.overlaps(fan)) }
        // The CPU played one: a back fewer. A full hand closes up; it is never wider.
        assertEquals(6, backs(board(hand(6), "m12-$size-6")))
        val many = board(hand(14), "m12-$size-14")
        assertEquals(14, backs(many))
        assertTrue("$size: a big hand stays inside its span: ${many.rects.getValue("cpuhand").width} against ${fan.width}", many.rects.getValue("cpuhand").width <= fan.width * 2.2f)
        assertNull("$size: no cards, no fan", board(hand(0), "m12-$size-0").rects["cpuhand"])
    }

    @Test fun thePhoneShowsTheCpusHandAsBacks() = check("phone", 390f * 3f)
    @Config(sdk = [35], qualifiers = "w1280dp-h800dp-land-xhdpi")
    @Test fun theTabletToo() = check("tablet", 800f * 2f)
    @Test fun aFullHandClosesUp() {
        assertEquals(40f * CpuFan.STEP, CpuFan.step(7, 40f, 600f), .01f)
        assertTrue(CpuFan.step(14, 40f, 600f) * 13 + 40f <= 600f * CpuFan.SPAN + .01f)
    }
}
