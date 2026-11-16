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
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.Walkers
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
 * Better table scene 10 (design/better-table-preview.html, the saga scene): History of Benalia stands as a whole upright card at
 * the right end of your side, its chapter marks I, II, III off its left edge, the chapters reached lit; its chapter on the stack
 * is marked with the numeral, not the ABILITY label. Card text and stack text are Forge's own (SagaProbe). Pictures in
 * table-look/saga-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class SagaShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val benalia = "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n" +
        "I, II — Create a 2/2 white Knight creature token with vigilance.\nIII — Knights you control get +2/+1 until end of turn."
    private fun saga(like: Card, lore: Int) = like.copy(id = 990, name = "History of Benalia", type = "Enchantment - Saga", manaCost = "{1}{W}{W}", power = null, toughness = null,
        tapped = false, counters = mapOf("LORE" to lore), attachments = emptyList(), attachedTo = null, text = benalia, keywords = emptyList())
    private fun walker(like: Card) = like.copy(id = 971, name = "Jace Beleren", type = "Legendary Planeswalker - Jace", manaCost = "{1}{U}{U}", power = null, toughness = null,
        tapped = false, counters = mapOf("LOYALTY" to 5), attachments = emptyList(), attachedTo = null, text = "")
    private fun with(lore: Int, chapter: Boolean, jace: Boolean = false): MatchState {
        val st = base.copy(players = base.players.map { p -> if (p.id != base.viewer) p else {
            val like = p.battlefield.first { !it.isLand && !it.isCreature }
            p.copy(battlefield = p.battlefield + saga(like, lore) + listOfNotNull(if (jace) walker(like) else null)) } })
        if (!chapter) return st
        val line = if (lore >= 3) "III — Knights you control get +2/+1 until end of turn." else "I, II — Create a 2/2 white Knight creature token with vigilance."
        return st.copy(stack = listOf(StackItem(91, line, st.me.battlefield.first { it.id == 990 }, st.viewer, ability = true, trigger = true)))
    }

    private fun board(st: MatchState, file: String): Anchors {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val a = Anchors()
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path) {
            CompositionLocalProvider(LocalAnchors provides a) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return a
    }

    private fun check(size: String, w: Float, h: Float, dp: Float, share: Float) {
        val board = ZoneLayout.of(w, h, k = ZoneLayout.scale(w, h)).board
        val st = with(2, chapter = true); val a = board(st, "saga-$size")
        val card = a.rects.getValue("c990")
        assertEquals("$size: a whole upright card", Walkers.WIDE, card.width / card.height, .01f)
        assertEquals("$size: the card's height is the planeswalkers' ${share * 100} %", share * h * dp, card.height, 2f * dp)
        assertTrue("$size: it stands at the right end of the board: $card", card.right <= board.right * dp + 1f && card.right > board.right * dp - 24 * dp)
        assertTrue("$size: on your side", card.center.y > h * dp * .44f)
        // The chapter marks hang off its left edge, centred on its height, all three in view, II lit as the current one.
        val marks = a.rects.getValue("chapter990")
        assertTrue("$size: the marks are left of the card: $marks $card", marks.right <= card.left + 1f && marks.right > card.left - 12 * dp)
        assertEquals("$size: centred on the card", card.center.y, marks.center.y, 2f * dp)
        for (i in 1..3) assertNotNull("$size: mark $i", a.rects["chapter990:$i"])
        assertNull("$size: three chapters, no fourth", a.rects["chapter990:4"])
        // Nothing else on the table lies under the card or its marks.
        for (c in st.me.battlefield + st.cpu.battlefield) if (c.id != 990) a.rects["c${c.id}"]?.let { r ->
            assertFalse("$size: ${c.name} under the saga", r.overlaps(card)); assertFalse("$size: ${c.name} under its marks", r.overlaps(marks)) }
        // Its chapter on the stack wears the numeral at its foot.
        val stack = a.rects.getValue("stackcard"); val num = a.rects.getValue("stackchap91")
        assertTrue("$size: the numeral is at the stack card's foot: $num $stack", num.center.x in stack.left..stack.right && num.bottom <= stack.bottom && num.top > stack.center.y)
        // Without the stack card over it: I and II lit, II the current one (the picture for the eye).
        val lit = board(with(2, chapter = false), "saga-$size-lit")
        assertTrue("$size: the marks still hang off the left edge", lit.rects.getValue("chapter990").right <= lit.rects.getValue("c990").left + 1f)
        // With a planeswalker too: one column, the saga at the outer (lower) end, the walker above it, both clear of each other.
        val b = board(with(3, chapter = true, jace = true), "saga-$size-jace")
        val s2 = b.rects.getValue("c990"); val j = b.rects.getValue("c971")
        assertTrue("$size: the saga stands below the planeswalker: $s2 $j", s2.top >= j.bottom - 1f)
        assertFalse("$size: the marks keep off the planeswalker", b.rects.getValue("chapter990").overlaps(j))
        val m2 = b.rects.getValue("chapter990")
        assertTrue("$size: a smaller saga's marks stay within its height: $m2 $s2", m2.top >= s2.top - 1f && m2.bottom <= s2.bottom + 1f)
    }

    @Test fun onAPhone() = check("phone", 844f, 390f, 3f, Walkers.PHONE)
    @Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
    @Test fun onTheFold() = check("fold", 884f, 796f, 2f, Walkers.BIG)
    @Test fun withNoChapterYet() {
        val a = board(with(0, chapter = false), "saga-phone-lore0")
        assertNotNull(a.rects["chapter990"]); assertNull("no stack card", a.rects["stackchap91"])
    }
}
