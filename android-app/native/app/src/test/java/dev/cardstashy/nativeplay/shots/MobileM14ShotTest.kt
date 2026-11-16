package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.Walkers
import dev.cardstashy.nativeplay.ui.ZoneLayout
import dev.cardstashy.nativeplay.ui.isWalker
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Mobile table M14 (specs/mobile-table-arena-parity-brief.md, walk line 74): a planeswalker is a whole upright card at the right
 * end of its owner's side (24 % of the height on a phone, 17 % on a big screen), its loyalty in a shield on its bottom edge;
 * two stand in a column, each smaller, neither on a creature nor on the other. Yours with two, the CPU's with one. Pictures in
 * table-look/m14-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM14ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private fun walker(like: Card, id: Int, name: String, loyalty: Int) = like.copy(id = id, name = name, type = "Legendary Planeswalker - ${name.substringBefore(' ').trimEnd(',')}", manaCost = "{1}{B}{B}",
        power = null, toughness = null, tapped = false, counters = mapOf("LOYALTY" to loyalty), attachments = emptyList(), attachedTo = null, text = "+1: Each player discards a card.")
    private fun with(mine: Int): MatchState = base.copy(players = base.players.map { p ->
        val like = p.battlefield.first { !it.isLand && !it.isCreature }
        val add = if (p.id == base.viewer) listOf(walker(like, 970, "Liliana of the Veil", 3), walker(like, 971, "Jace Beleren", 5)).take(mine) else listOf(walker(like, 980, "Chandra, Torch of Defiance", 4))
        p.copy(battlefield = p.battlefield + add) })

    private fun board(st: MatchState, file: String): Anchors {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val a = Anchors()
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path) {
            CompositionLocalProvider(LocalAnchors provides a) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return a
    }
    private fun check(size: String, w: Float, h: Float, dp: Float, share: Float) {
        val board = ZoneLayout.of(w, h, k = ZoneLayout.scale(w, h)).board
        val one = with(1); val a = board(one, "m14-$size-one")
        val lili = a.rects.getValue("c970"); val chandra = a.rects.getValue("c980")
        assertEquals("$size: the card's height is ${share * 100} % of the screen's", share * h * dp, lili.height, 2f * dp)
        assertEquals("$size: a whole upright card", Walkers.WIDE, lili.width / lili.height, .01f)
        for ((name, r) in listOf("yours" to lili, "the CPU's" to chandra)) assertTrue("$size: $name stands at the right end of the board: $r", r.right <= board.right * dp + 1f && r.right > board.right * dp - 24 * dp)
        assertTrue("$size: yours is on your side, the CPU's on its side", lili.top > chandra.bottom && lili.center.y > h * dp * .44f && chandra.center.y < h * dp * .44f)
        // The loyalty is in view on the card's bottom edge.
        for (id in listOf(970, 980)) { val s = a.rects.getValue("loyalty$id"); val c = a.rects.getValue("c$id")
            assertTrue("$size: the shield sits on the bottom edge of $id: $s $c", s.top < c.bottom && s.bottom > c.bottom && s.center.x in c.left..c.right) }
        val tiles = (one.me.battlefield + one.cpu.battlefield).filter { !isWalker(it) }.mapNotNull { c -> a.rects["c${c.id}"]?.let { c.name to it } }
        for ((n, r) in tiles) { assertFalse("$size: $n under your planeswalker", r.overlaps(lili)); assertFalse("$size: $n under the CPU's planeswalker", r.overlaps(chandra)) }
        // Two of yours: a column, the second above the first, each smaller, apart, still clear of the creatures.
        val b = board(with(2), "m14-$size-two")
        val first = b.rects.getValue("c970"); val second = b.rects.getValue("c971")
        assertTrue("$size: the second stands above the first: $second $first", second.bottom <= first.top && kotlin.math.abs(second.left - first.left) < 1f)
        assertTrue("$size: both are on your side", second.top > b.rects.getValue("c980").bottom)
        for ((n, r) in tiles.filter { (n, _) -> one.me.battlefield.any { it.name == n && it.isCreature } }) b.rects["c" + one.me.battlefield.first { it.name == n && it.isCreature }.id]?.let {
            assertFalse("$size: $n under a planeswalker", it.overlaps(first) || it.overlaps(second)) }
    }

    @Test fun onAPhone() = check("phone", 844f, 390f, 3f, Walkers.PHONE)
    @Config(sdk = [35], qualifiers = "w1280dp-h800dp-land-xhdpi")
    @Test fun onATablet() = check("tablet", 1280f, 800f, 2f, Walkers.BIG)
    @Test fun aCreaturePlaneswalkerFightsInTheCreatureRow() {
        val c = base.me.battlefield.first { it.isCreature }
        assertFalse(isWalker(c.copy(type = "Legendary Creature Planeswalker - Gideon")))
        assertTrue(isWalker(c.copy(type = "Legendary Planeswalker - Gideon")))
        val (h, top) = Walkers.column(3, 94f, 176f, 270f, 222f, 6f)
        assertTrue(h * 3 + 12f <= 94f + .01f); assertEquals(176f, top, .01f)
    }
}
