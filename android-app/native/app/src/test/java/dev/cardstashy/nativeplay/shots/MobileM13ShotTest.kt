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
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Mobile table M13 (specs/mobile-table-arena-parity-brief.md, walk line 72): lands behind the creatures on the left, the
 * permanents that are neither land nor creature (the CPU's Sol Ring, your Arcane Signet) behind them on the right, creatures in
 * the middle. On a phone your own back row is the shelf left of the hand, so yours stay beside your lands there. Pictures in
 * table-look/m13-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM13ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!

    private fun check(size: String, w: Float, h: Float, dp: Float, phone: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val a = Anchors()
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/m13-$size.png").path) {
            CompositionLocalProvider(LocalAnchors provides a) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        val board = ZoneLayout.of(w, h, k = ZoneLayout.scale(w, h)).board
        val mid = (board.x + board.w / 2) * dp; val right = board.right * dp
        fun rect(name: String, mine: Boolean) = a.rects.getValue("c" + (if (mine) st.me else st.cpu).battlefield.first { it.name == name }.id)
        val ring = rect("Sol Ring", false)
        assertTrue("$size: the CPU's Sol Ring stands at the right end of its back row: $ring, board ends $right", ring.right > right - 40 * dp && ring.right <= right + 1f)
        assertTrue("$size: the CPU's lands are on the left", rect("Island", false).right < mid)
        assertTrue("$size: your lands are on the left", rect("Mountain", true).right < mid && rect("Forest", true).right < mid)
        val signet = rect("Arcane Signet", true)
        // The brief's "Phone conflicts from the full picture run", 2: on a phone the shelf holds lands only; your loose permanents
        // stand in your creature row, right of your creatures.
        if (phone) { val mineC = st.me.battlefield.filter { it.isCreature }.mapNotNull { a.rects["c${it.id}"] }
            assertTrue("$size: on a phone your Signet stands in your creature row, right of your creatures: $signet", mineC.isNotEmpty() && mineC.all { signet.left >= it.right - 1f && kotlin.math.abs(signet.center.y - it.center.y) < it.height / 2 }) }
        else assertTrue("$size: your Arcane Signet stands at the right end of your back row: $signet", signet.right > right - 40 * dp && signet.right <= right + 1f)
        for (c in (st.me.battlefield + st.cpu.battlefield).filter { it.isCreature }) a.rects["c${c.id}"]?.let { r ->
            assertTrue("$size: ${c.name} is in the middle, clear of the loose permanents", !r.overlaps(ring) && !r.overlaps(signet)) }
    }

    @Test fun onAPhone() = check("phone", 844f, 390f, 3f, true)
    @Config(sdk = [35], qualifiers = "w1280dp-h800dp-land-xhdpi")
    @Test fun onATablet() = check("tablet", 1280f, 800f, 2f, false)
}
