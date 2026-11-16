package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.ui.Anchors
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

/**
 * Randall's Fold recording 15 Nov 2026 (Screen_Recording_20261115_203512): Disenchant cast while the CPU's Weakness and his own Holy
 * Strength sat on his Savannah Lions; Weakness could not be picked (the aura edges took no tap, the card page's Attached row opened
 * Weakness instead of picking it). The exact board, on the Fold (884 x 796), with Forge's question as AuraTargetProbe saw it on the
 * real engine: "Disenchant (1) - Destroy target artifact or enchantment.", both auras offered in selection.cards (not targets).
 * Pictures in table-aura-target/.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class AuraTargetShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()
    private val me = base.viewer
    private val cpuId = base.players.first { it.id != me }.id
    private val HOLY = AuraFixture.HOLY; private val WEAK = AuraFixture.WEAK

    private fun board(asking: Boolean) = AuraFixture.board(base, asking)

    private val picked = mutableListOf<Int>()
    private val inspected = mutableListOf<String>()

    private fun show(st: MatchState, name: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(card = { picked += it }), selectedHand = null, onSelectHand = {}, onInspect = { inspected += it.name }, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        val f = java.io.File(System.getProperty("shotsDir"), "table-aura-target/$name.png"); lastShot = f
        rule.onRoot().captureRoboImage(f.path)
    }

    private fun r(key: String) = anchors.rects[key] ?: error("no anchor $key")
    private fun dp(): Float = rule.density.density

    /** Pixels of the ice ring (#5cc8ff) in a band round the edge's box: the ring a pickable tile wears. */
    private var lastShot: java.io.File? = null
    private fun icePixels(key: String): Int {
        val img = android.graphics.BitmapFactory.decodeFile(lastShot!!.path); val e = r(key); val pad = 8f * dp()
        var n = 0
        for (x in (e.left - pad).toInt().coerceAtLeast(0) until (e.right + pad).toInt().coerceAtMost(img.width))
            for (y in (e.top - pad).toInt().coerceAtLeast(0) until (e.bottom + pad).toInt().coerceAtMost(img.height)) {
                val c = img.getPixel(x, y); val r = android.graphics.Color.red(c); val g = android.graphics.Color.green(c); val b = android.graphics.Color.blue(c)
                if (b > 215 && g in 158..230 && r < 128) n++
            }
        return n
    }
    private fun edge(name: String) = rule.onNodeWithContentDescription("$name on Savannah Lions")
    private fun state(name: String) = edge(name).fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription)

    @Test fun disenchantPicksWeaknessFromItsEdge() {
        val st = board(asking = true)
        show(st, "fold-disenchant-asks")
        val lions = st.me.battlefield.first { it.name == "Savannah Lions" }
        // Both offered edges say so and wear the ring a pickable tile wears.
        assertEquals("Choose", state("Weakness")); assertEquals("Choose", state("Holy Strength"))
        for (id in listOf(WEAK, HOLY)) assertTrue("edge $id wears the ice ring (${icePixels("aura$id")} px)", icePixels("aura$id") > 40)
        // Offered edges lift but keep their rest x (BetterTilesShotTest keeps the rest place), inside the pile's lead.
        val tile = r("c${lions.id}")
        assertTrue("the Weakness edge stands out past the Holy Strength edge", r("aura$WEAK").left < r("aura$HOLY").left)
        // Each hit area is at least a finger tall and lies left of the tile.
        for (n in listOf("Weakness", "Holy Strength")) { val b = edge(n).fetchSemanticsNode().boundsInRoot
            assertTrue("$n hit area ${b.height / dp()} dp tall", b.height / dp() >= 44f - .5f)
            assertTrue("$n hit area keeps off the tile: $b vs $tile", b.right <= tile.left + 1f) }
        hitAreasApart(tile)
        // One tap on the Weakness edge picks Weakness (Forge's card pick, as the real engine took it in AuraTargetProbe).
        edge("Weakness").performClick(); rule.waitForIdle()
        assertEquals(listOf(WEAK), picked)
        assertTrue(inspected.isEmpty())
        // The Lions themselves are not offered: a tap on the tile opens the Lions, it never picks an aura.
        picked.clear()
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(tile.center.x, tile.center.y)) }; rule.waitForIdle()
        assertEquals(listOf("Savannah Lions"), inspected); assertTrue(picked.isEmpty())
    }

    @Test fun edgeOpensItsCardWhenNothingAsks() {
        val st = board(asking = false)
        show(st, "fold-priority-edges")
        assertNull(state("Weakness")); assertNull(state("Holy Strength"))
        assertTrue("no ring on a resting edge", icePixels("aura$WEAK") < 10)
        assertTrue(edge("Weakness").fetchSemanticsNode().boundsInRoot.height / dp() >= 44f - .5f)
        edge("Weakness").performClick(); rule.waitForIdle()
        assertEquals(listOf("Weakness"), inspected); assertTrue(picked.isEmpty())
    }

    @Test fun notOfferedEdgeOpensItsCardWhileAsking() {
        // Disenchant offers only Holy Strength (say Weakness had shroud): Weakness's edge opens its page, Holy Strength's picks.
        val st0 = board(asking = true)
        val st = st0.copy(selection = st0.selection.copy(cards = setOf(HOLY)))
        show(st, "fold-one-offered")
        assertNull(state("Weakness")); assertEquals("Choose", state("Holy Strength"))
        val lions = st.me.battlefield.first { it.name == "Savannah Lions" }
        val tile = r("c${lions.id}")
        hitAreasApart(tile)
        // Review: the offered inner edge slid out past Weakness and left it a 1 dp hit box. A finger on the part of Weakness that
        // shows (left of Holy Strength's edge, half way down) opens Weakness and never picks Holy Strength.
        val weak = r("aura$WEAK"); val holy = r("aura$HOLY")
        assertTrue("Weakness shows left of Holy Strength: $weak vs $holy", holy.left - weak.left >= 4f * dp())
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset((weak.left + holy.left) / 2f, weak.center.y)) }; rule.waitForIdle()
        assertEquals(listOf("Weakness"), inspected); assertTrue("picked $picked", picked.isEmpty())
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset((holy.left + tile.left) / 2f, holy.center.y)) }; rule.waitForIdle()
        assertEquals(listOf(HOLY), picked)
    }

    /**
     * Each edge's hit area covers the part of its edge that shows and no other edge's: the outer one from its own left side to the
     * inner edge's left side, the inner one from there to the tile, none narrower than the strip that shows, none overlapping.
     */
    private fun hitAreasApart(tile: androidx.compose.ui.geometry.Rect) {
        val outer = edge("Weakness").fetchSemanticsNode().boundsInRoot; val inner = edge("Holy Strength").fetchSemanticsNode().boundsInRoot
        // What shows of each edge left of the next one in (TableGeometry: PEEK of the tile's width for the inner, PEEK_STEP more for the outer).
        val shownOuter = dev.cardstashy.nativeplay.ui.TableGeometry.PEEK_STEP * tile.width; val shownInner = dev.cardstashy.nativeplay.ui.TableGeometry.PEEK * tile.width
        assertTrue("Weakness hit area ${outer.width / dp()} dp wide, its edge shows ${shownOuter / dp()} dp", outer.width >= shownOuter - 1f * dp())
        assertTrue("Holy Strength hit area ${inner.width / dp()} dp wide, its edge shows ${shownInner / dp()} dp", inner.width >= shownInner - 1f * dp())
        assertTrue("hit areas overlap: $outer vs $inner", outer.right <= inner.left + 1f)
        // Neither reaches past the lead the row reserves left of the tile (TableGeometry.lead: no edge on a neighbour).
        val lead = dev.cardstashy.nativeplay.ui.TableGeometry.lead(2) * tile.width
        assertTrue("Weakness hit area ${(tile.left - outer.left) / dp()} dp left of the tile, lead ${lead / dp()} dp", outer.left >= tile.left - lead - 1f)
    }

    /** A second creature directly left of the Lions (review: a lifted edge reached onto the neighbour's tile and took its taps). */
    private fun withNeighbour(st: MatchState): MatchState {
        val lions = st.me.battlefield.first { it.name == "Savannah Lions" }
        val bears = lions.copy(id = 9404, name = "Grizzly Bears", power = 2, toughness = 2, attachments = emptyList())
        return st.copy(players = st.players.map { p -> if (p.id != me) p else p.copy(battlefield = p.battlefield.flatMap { if (it.id == lions.id) listOf(bears, it) else listOf(it) }) })
    }

    private fun neighbourKeepsItsTaps(name: String) {
        val st = withNeighbour(board(asking = true))
        show(st, name)
        val tile = r("c${st.me.battlefield.first { it.name == "Savannah Lions" }.id}"); val bears = r("c9404")
        assertTrue("Grizzly Bears lie left of the Lions: $bears vs $tile", bears.right < tile.left)
        for (n in listOf("Weakness", "Holy Strength")) { val b = edge(n).fetchSemanticsNode().boundsInRoot
            assertTrue("$n hit area reaches onto Grizzly Bears: $b vs $bears", b.left >= bears.right - 1f) }
        hitAreasApart(tile)
        // A tap on the Bears' right strip is the Bears' (they are not offered: their page opens), never an aura pick.
        rule.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(bears.right - 2f * dp(), bears.center.y)) }; rule.waitForIdle()
        assertEquals(listOf("Grizzly Bears"), inspected); assertTrue("picked $picked", picked.isEmpty())
    }

    @Test fun neighbourKeepsItsTapsOnTheFold() = neighbourKeepsItsTaps("fold-neighbour")

    @Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
    @Test fun neighbourKeepsItsTapsOnAPhone() = neighbourKeepsItsTaps("phone-neighbour")
}
