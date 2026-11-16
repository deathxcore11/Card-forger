package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableGeometry
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Better table scene 5 ("Bigger cards, auras you can count"), on the Fold (884 x 796) and a phone (844 x 390):
 *  - 5A: creature tiles a fifth taller on the Fold (TableGeometry.FRONT_BIG_GROW); a phone keeps its size.
 *  - 5B: each aura is a card edge peeking out left of its creature, behind it, on no other tile; "+N" past two.
 *  - 5C: +1/+1 counters are a number in a circle on the tile's top-right corner, and the counters rail leaves them out.
 *  - 5E: on the Fold the full stack card stands at the right edge, so two creatures keep it at its full size.
 * Pictures in table-better/.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class BetterTilesShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()
    private val me = base.viewer

    private fun aura(id: Int, name: String, on: Card) = on.copy(id = id, name = name, type = "Enchantment — Aura", power = null, toughness = null, tapped = false,
        attacking = false, attachedTo = on.id, attachments = emptyList(), counters = emptyMap(), keywords = emptyList())

    /** Scene 5: your Hill Giant wears two auras and a +1/+1 counter (4 / 4) and flies, your Goblin Guide stands beside it. */
    private fun scene(auras: Int = 2): MatchState {
        val giant0 = base.me.battlefield.first { it.name == "Hill Giant" }
        val worn = listOf(aura(801, "Shardmage's Rescue", giant0), aura(802, "Ethereal Armor", giant0), aura(803, "Feather of Flight", giant0)).take(auras)
        val giant = giant0.copy(power = 4, toughness = 4, counters = mapOf("P1P1" to 1), keywordsKnown = true, keywords = listOf("Flying"), attachments = worn.map { it.id })
        val guide = base.me.battlefield.first { it.name == "Goblin Guide" }
        val lands = base.me.battlefield.filter { it.isLand }.take(3)
        return base.copy(inputType = "InputPassPriority", phase = "MAIN1", activePlayer = me, priorityPlayer = me, stack = emptyList(),
            players = base.players.map { p -> if (p.id == me) p.copy(battlefield = lands + giant + guide + worn) else p })
    }

    private fun show(st: MatchState, name: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-better/$name.png").path)
    }

    private fun r(key: String) = anchors.rects[key] ?: error("no anchor $key")

    private fun tiles(tag: String, w: Float, h: Float, auras: Int) {
        val st = scene(auras)
        show(st, "tiles-$tag" + (if (auras > 2) "-more" else ""))
        val dp = rule.onRoot().fetchSemanticsNode().size.height.toFloat() / h
        val z = ZoneLayout.of(w, h); val rows = ZoneLayout.rows(z, false)
        val giant = st.me.battlefield.first { it.name == "Hill Giant" }
        val tile = r("c${giant.id}")
        // 5A: the creature tile has its row's height: a fifth over Z2's on the Fold (126.8 dp), the phone's 18.5 % as before.
        val expect = if (z.phone) TableGeometry.FRONT_PHONE * z.hb else minOf(TableGeometry.FRONT_ONE * z.hb * TableGeometry.FRONT_BIG_GROW, TableGeometry.FRONT_ONE * h)
        assertEquals("$tag creature tile height", expect, tile.height / dp, 1.5f)
        if (!z.phone) assertEquals("$tag a fifth larger on the Fold", 126.8f, tile.height / dp, 1f)
        assertEquals(rows.myFront.height, expect, .5f)
        // 5B: each aura (two at most) is a card edge left of the tile, behind it: more than a quarter of the tile's width shows.
        val shown = minOf(auras, TableGeometry.STRIPS_MAX)
        val edges = (801 until 801 + shown).map { r("aura$it") }
        edges.forEachIndexed { i, e ->
            assertTrue("$tag edge $i peeks out left of the tile: $e vs $tile", e.left < tile.left - .25f * tile.width)
            assertTrue("$tag edge $i runs under the tile", e.right > tile.left)
            assertTrue("$tag edge $i lies in the tile's band", e.center.y > tile.top && e.center.y < tile.bottom)
        }
        if (shown == 2) assertTrue("$tag the second edge peeks out further", edges[1].left < edges[0].left)
        // On no other card of the table (its own row's neighbours included).
        for (e in edges) for (o in st.players.flatMap { it.battlefield }.filter { it.id != giant.id && it.attachedTo == null }) anchors.rects["c${o.id}"]?.let { or ->
            assertTrue("$tag an edge lies on ${o.name}: $e $or", !e.deflate(2f).overlaps(or.deflate(1f))) }
        // The aura's name still reads for a screen reader on the edge.
        rule.onNodeWithContentDescription("Shardmage's Rescue on Hill Giant").assertExists()
        if (auras > 2) anchors.rects["auramore${giant.id}"] ?: error("$tag no +N on the outer edge")
        // 5C: the counter circle on the top-right corner, mostly outside the tile; the counters rail does not show it again.
        val ctr = r("ctr${giant.id}")
        assertTrue("$tag circle outside the top right: $ctr vs $tile", ctr.right > tile.right && ctr.top < tile.top && ctr.center.x > tile.right - ctr.width)
        assertTrue("$tag circle size", ctr.width / dp >= 21.5f)
        rule.onNodeWithContentDescription("+1/+1 counters").assertExists()
        assertNull("$tag the rail left the +1/+1 out", anchors.rects["rail${giant.id}"])
        // Keyword marks bottom left as before (G1).
        assertTrue("$tag flying mark shows", (anchors.sizes["kwshown${giant.id}"] ?: 0f) >= 1f)
        // The name keeps clear of the circle.
        anchors.rects["name${giant.id}"]?.let { n -> assertTrue("$tag name clear of the circle: $n $ctr", n.right <= ctr.left + 2f) }
    }

    @Test fun tilesFold() = tiles("fold", 884f, 796f, 2)
    @Test fun tilesFoldThreeAuras() = tiles("fold", 884f, 796f, 3)
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun tilesPhone() = tiles("phone", 844f, 390f, 2)

    /**
     * 5E: a CPU spell on the stack with two creatures in each creature row: on the Fold the card stays full size at the right edge
     * (it stood over the board's right end and dropped to a strip over the creatures). A row reaching under it still steps it aside.
     */
    @Test fun stackAtTheRightEdgeFold() {
        val st0 = scene(0)
        val spell = base.cpu.battlefield.first { it.isCreature }.copy(id = 960, zone = "Stack", name = "Lightning Bolt", type = "Instant", power = null, toughness = null)
        val st = st0.copy(stack = listOf(StackItem(7, spell.text, spell, base.cpu.id)), activePlayer = base.cpu.id)
        show(st, "stack-fold")
        val dp = rule.onRoot().fetchSemanticsNode().size.height.toFloat() / 796f
        val card = r("stackcard")
        assertEquals("the stack card is 43 % of the height", .43f * 796f, card.height / dp, 1.5f)
        assertTrue("it ends inside the right edge: $card", card.right / dp <= 884f - ZoneLayout.STACK_EDGE + 1f)
        for (c in st.players.flatMap { it.battlefield }) anchors.rects["c${c.id}"]?.let { t -> assertTrue("the card lies on ${c.name}: $card $t", !card.overlaps(t)) }
        anchors.rects["stacklabel"]?.let { assertTrue("its words are inside the screen: $it", it.right / dp <= 884f) }
    }
}
