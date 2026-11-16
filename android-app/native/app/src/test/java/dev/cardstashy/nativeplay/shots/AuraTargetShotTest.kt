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
    private fun dp(): Float = rule.onRoot().fetchSemanticsNode().size.height.toFloat() / 796f

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
        // Offered edges slide further out of the tile than at rest (BetterTilesShotTest keeps the rest place).
        val tile = r("c${lions.id}")
        assertTrue("the Weakness edge stands out past the Holy Strength edge", r("aura$WEAK").left < r("aura$HOLY").left)
        // Each hit area is at least a finger tall and lies left of the tile.
        for (n in listOf("Weakness", "Holy Strength")) { val b = edge(n).fetchSemanticsNode().boundsInRoot
            assertTrue("$n hit area ${b.height / dp()} dp tall", b.height / dp() >= 44f - .5f)
            assertTrue("$n hit area keeps off the tile: $b vs $tile", b.right <= tile.left + 1f) }
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
        edge("Weakness").performClick(); rule.waitForIdle()
        assertEquals(listOf("Weakness"), inspected); assertTrue(picked.isEmpty())
        edge("Holy Strength").performClick(); rule.waitForIdle()
        assertEquals(listOf(HOLY), picked)
    }
}
