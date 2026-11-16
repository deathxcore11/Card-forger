package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.CardInspect
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.attachedPicks
import dev.cardstashy.nativeplay.ui.cardRect
import dev.cardstashy.nativeplay.ui.relations
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Randall's Fold recording 15 Nov 2026, the card page and the arrow: while Disenchant asks, the Lions' page lists Weakness in its
 * Attached row as pickable ("Choose", the ice ring) and a tap on it goes to the table's pick (TableScreen closes the page); an arrow
 * to a chosen aura ends on its card edge. Board: AuraFixture. Pictures in table-aura-target/.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class AuraPickPageShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()
    private val me = base.viewer
    private val HOLY = AuraFixture.HOLY; private val WEAK = AuraFixture.WEAK
    private fun board(asking: Boolean) = AuraFixture.board(base, asking)

    @Test fun arrowToChosenAuraEndsOnItsEdge() {
        val st = board(asking = true)
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent { CompositionLocalProvider(LocalAnchors provides anchors) { Box(Modifier.fillMaxSize().background(Palette.Night)) {
            ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}) } } }
        rule.waitForIdle(); rule.waitForIdle()
        val chosen = st.copy(selection = st.selection.copy(chosenCards = setOf(WEAK)))
        val rel = relations(chosen).first { it.kind == "target" && it.to == "c$WEAK" }
        assertEquals(anchors.rects["aura$WEAK"]!!, cardRect(anchors.rects, rel.to))
    }

    @Test fun cardPageAttachedRowPicks() {
        val st = board(asking = true)
        val lions = st.me.battlefield.first { it.name == "Savannah Lions" }
        val att = listOf(st.card(HOLY)!!, st.card(WEAK)!!)
        // What the table passes the page: both offered while Disenchant asks; nothing at plain priority or while the table is not live.
        assertEquals(setOf(HOLY, WEAK), attachedPicks(st, true, att))
        assertEquals(emptySet<Int>(), attachedPicks(st, false, att))
        assertEquals(emptySet<Int>(), attachedPicks(board(asking = false), true, att))
        assertEquals(setOf(HOLY), attachedPicks(st.copy(selection = st.selection.copy(chosenCards = setOf(WEAK))), true, att))
        val tapped = mutableListOf<String>()
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    CardInspect(lions, me, attached = att, onAttached = { tapped += it.name }, picks = setOf(WEAK)) {}
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-aura-target/fold-page-attached.png").path)
        rule.onNodeWithText("Choose").assertExists()
        assertEquals("Choose", rule.onNodeWithContentDescription("Weakness, attached to Savannah Lions").fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription))
        assertNull(rule.onNodeWithContentDescription("Holy Strength, attached to Savannah Lions").fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription))
        rule.onNodeWithContentDescription("Weakness, attached to Savannah Lions").performClick(); rule.waitForIdle()
        assertEquals(listOf("Weakness"), tapped)
    }
}
