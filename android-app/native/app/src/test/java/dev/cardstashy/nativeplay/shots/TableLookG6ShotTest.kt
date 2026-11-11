package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.AbilityRow
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.CardInspect
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Glow
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Mark
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.abilityRows
import dev.cardstashy.nativeplay.ui.abilityView
import dev.cardstashy.nativeplay.ui.attachedOf
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.60 G6 (specs/glance-marks-brief.md G6, glow-rules.md "The ability opens on the card"): a tap on your permanent wearing the
 * usable ring never fires its ability blind: it opens the inspect view, where each ability (cost and its own text, split from the
 * card's rules) has a dashed violet row with the gold Activate. Activate runs Forge's own activation path (intents.card, the tap
 * that used to fire at once). Not usable now: the row shows the reason in place of the button. Mana abilities get no row.
 * Fixture: snap-crowded's Mind Stone (Forge's own text). Shots in table-look/g6-*.png at 844 × 390 and 1280 × 800.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class TableLookG6ShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private val stoneId = 140

    /** snap-crowded with Mind Stone ("{1}, {T}, Sacrifice this artifact: Draw a card.") listed by Forge as usable now. */
    private fun usable(): MatchState {
        val st = state("crowded")
        return st.copy(selection = st.selection.copy(actionable = st.selection.actionable + stoneId, affordability = st.selection.affordability + (stoneId to "available")))
    }

    /** The same table with Mind Stone tapped and not listed: its ability can't be used now. */
    private fun tappedStone(): MatchState {
        val st = state("crowded")
        val me = st.me.copy(battlefield = st.me.battlefield.map { if (it.id == stoneId) it.copy(tapped = true) else it })
        return st.copy(players = st.players.map { if (it.id == st.viewer) me else it })
    }

    private class Seen { var inspected by mutableStateOf<Card?>(null); var acted = mutableListOf<Int>() }

    /** The board as TableScreen wires it: onAbility opens CardInspect with abilityView's rows, and Activate puts it down and acts. */
    private fun board(st: MatchState, live: Boolean): Pair<Anchors, Seen> {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        DualScreen.pretend(null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        val anchors = Anchors(); val seen = Seen()
        val intents = TableIntents(card = { seen.acted += it })
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = live, intents = intents, selectedHand = null, onSelectHand = {}, onInspect = { seen.inspected = it }, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {}, onAbility = { seen.inspected = it })
                    seen.inspected?.let { c ->
                        val view = abilityView(c, st, live)
                        val act: (() -> Unit)? = if (view?.usable == true) ({ seen.inspected = null; intents.card(c.id) }) else null
                        CardInspect(c, st.viewer, attached = attachedOf(st, st.card(c.id) ?: c), onAttached = { seen.inspected = it }, ability = view, onActivate = act) { seen.inspected = null }
                    }
                }
            }
        }
        rule.waitForIdle()
        return anchors to seen
    }

    private fun tap(a: Anchors, key: String, at: (androidx.compose.ui.geometry.Rect) -> Offset = { it.center }) {
        val r = a.rects[key] ?: error("no $key on screen")
        rule.onRoot().performTouchInput { click(at(r)) }
        rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
    }

    private fun shot(name: String): android.graphics.Bitmap {
        val f = File(System.getProperty("shotsDir"), "table-look/g6-$name.png")
        rule.onRoot().captureRoboImage(f.path)
        return BitmapFactory.decodeFile(f.path)
    }

    @Test fun theRowsComeFromTheRulesTextWithoutManaAbilities() {
        val st = state("crowded")
        val stone = st.card(stoneId)!!
        assertEquals("Mind Stone", stone.name)
        assertEquals(listOf(AbilityRow("{1}, {T}, Sacrifice this artifact", "Draw a card.")), abilityRows(stone))
        // Arcane Signet only makes mana: no row (glow-rules.md rule 3), and no view at all.
        val signet = st.me.battlefield.first { it.name == "Arcane Signet" }
        assertTrue(abilityRows(signet).isEmpty())
        assertNull(abilityView(signet, st, true))
        // A triggered line is not an ability you activate.
        assertTrue(abilityRows(stone.copy(text = "At the beginning of your upkeep, you gain 1 life.")).isEmpty())
        // The CPU's permanents get no rows.
        st.players.first { it.id != st.viewer }.battlefield.forEach { assertNull("${it.name}", abilityView(it, st, true)) }
    }

    @Test fun aUsableAbilityOpensItsRowAndActivateActsPhone() = opensAndActivates("844x390")

    @Config(qualifiers = "w1280dp-h800dp-land-mdpi")
    @Test fun aUsableAbilityOpensItsRowAndActivateActsTablet() = opensAndActivates("1280x800")

    private fun opensAndActivates(tag: String) {
        val st = usable()
        assertEquals("$tag: Mind Stone wears the usable ring", Mark.USABLE, Glow.boardMarks(st, true)[stoneId])
        val (a, seen) = board(st, live = true)
        tap(a, "c$stoneId")
        assertEquals("$tag: the first tap fires nothing", emptyList<Int>(), seen.acted)
        assertEquals("$tag: the first tap opens the card", stoneId, seen.inspected?.id)
        val row = a.rects["inspectAbility$stoneId.0"] ?: error("$tag: no ability row")
        val btn = a.rects["inspectActivate$stoneId.0"] ?: error("$tag: no Activate")
        assertNull("$tag: one row only (the mana ability has none)", a.rects["inspectAbility$stoneId.1"])
        assertTrue("$tag: the ability's text shows", rule.onAllNodesWithText("Draw a card.", substring = true).fetchSemanticsNodes().isNotEmpty())
        assertTrue("$tag: Activate shows", rule.onAllNodesWithText("Activate").fetchSemanticsNodes().isNotEmpty())
        val bmp = shot("open-$tag")
        assertTrue("$tag: the row $row on screen", row.left >= 0f && row.top >= 0f && row.right <= bmp.width + .5f && row.bottom <= bmp.height + .5f)
        assertTrue("$tag: Activate $btn inside its row $row", btn.left >= row.left - .5f && btn.right <= row.right + .5f && btn.top >= row.top - .5f && btn.bottom <= row.bottom + .5f)
        val card = a.rects["inspectCard$stoneId"] ?: error("$tag: no card")
        assertTrue("$tag: the row $row is off the card $card", row.right <= card.left + .5f || row.left >= card.right - .5f)
        tap(a, "inspectActivate$stoneId.0")
        assertEquals("$tag: Activate runs the activation", listOf(stoneId), seen.acted)
        assertNull("$tag: and puts the card down", seen.inspected)
        // Open it again and tap the row's words: the row activates as its button does.
        tap(a, "c$stoneId")
        assertEquals(stoneId, seen.inspected?.id)
        tap(a, "inspectAbility$stoneId.0") { Offset(it.left + 12f, it.center.y) }
        assertEquals("$tag: a tap on the row activates", listOf(stoneId, stoneId), seen.acted)
        // Open it again and tap away: it closes without acting.
        tap(a, "c$stoneId")
        assertEquals(stoneId, seen.inspected?.id)
        rule.onRoot().performTouchInput { click(Offset(4f, 4f)) }; rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        assertNull("$tag: a tap away puts it down", seen.inspected)
        assertEquals("$tag: and acts on nothing", listOf(stoneId, stoneId), seen.acted)
    }

    @Test fun notUsableShowsTheReasonInPlaceOfTheButton() {
        val st = tappedStone()
        assertFalse(stoneId in st.selection.actionable)
        val (a, seen) = board(st, live = true)
        tap(a, "c$stoneId")
        assertEquals("a tap with no legal action inspects", stoneId, seen.inspected?.id)
        assertNotNull("the ability row shows its text", a.rects["inspectAbility$stoneId.0"])
        assertNull("never a dead button", a.rects["inspectActivate$stoneId.0"])
        assertNotNull("the reason shows in its place", a.rects["inspectAbilityWhy$stoneId.0"])
        assertEquals("Tapped", abilityView(st.card(stoneId)!!, st, true)?.reason)
        shot("tapped-844x390")
        tap(a, "inspectAbility$stoneId.0")
        assertTrue("a tap on a row with no button acts on nothing", seen.acted.isEmpty())
    }
}
