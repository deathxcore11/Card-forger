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
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.askingAbility
import dev.cardstashy.nativeplay.ui.laneStack
import dev.cardstashy.nativeplay.ui.relations
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
 * Mobile table M1 (specs/mobile-table-arena-parity-brief.md): while a trigger asks for its target, the asking card stands in the
 * stack's place, labelled ABILITY, with Forge's words for what it does; the question is one plain line on the middle of the
 * table, between the rows and left of that card, not a pill in the hand's strip. The words are the real engine's
 * (TriggerTargetProbe). Pictures in table-look/m1-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MobileM1ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
        .let { it.copy(selection = it.selection.copy(chosenCards = emptySet()), stack = emptyList(), events = emptyList()) }
    private val src = base.me.battlefield.first { it.isCreature }
    private val st = base.copy(message = "${src.name} (${src.id}) - Eerie — Whenever an enchantment you control enters and whenever you fully unlock a Room, put a +1/+1 counter on target creature. [Zone Changer: Sheltered by Ghosts (54)]\n\nSelect target creature")

    @Test fun theAskingAbilityIsTheCardOnTopOfTheLane() {
        val a = askingAbility(st)!!
        assertEquals(src.id, a.source!!.id); assertTrue(a.ability); assertTrue("a trigger", a.trigger)
        assertEquals("Eerie — Whenever an enchantment you control enters and whenever you fully unlock a Room, put a +1/+1 counter on target creature.", a.text)
        assertEquals(a, laneStack(st).first())
        // The aim starts at that card.
        val chosen = st.copy(selection = st.selection.copy(chosenCards = setOf(src.id)))
        assertTrue(relations(chosen).any { it.kind == "target" && it.from == "stackcard" && it.to == "c${src.id}" })
        // An activated ability is not called a trigger.
        assertFalse(askingAbility(st.copy(message = "${src.name} (${src.id}) - {T}: Tap target creature.\n\nSelect target creature"))!!.trigger)
        // Nothing is made up: no card of that id and name on the table, no words, or no question.
        assertNull(askingAbility(st.copy(message = "Lightning Bolt (99999) - Lightning Bolt deals 3 damage to any target.\nSelect any target")))
        assertNull(askingAbility(st.copy(message = "${src.name} (${src.id}) - Select target creature")))
        assertNull(askingAbility(st.copy(inputType = "InputPassPriority")))
    }

    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    /** Drawn under a compose rule and settled before the picture: the step-aside is decided a frame after the tiles are laid out. */
    private fun board(file: String): Anchors {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val anchors = Anchors()
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        rule.waitForIdle(); rule.mainClock.advanceTimeBy(500); rule.waitForIdle()
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path)
        return anchors
    }
    private fun check(size: String, a: Anchors) {
        val r = a.rects
        val line = r["askline"] ?: error("$size: no question line")
        val card = r["stackcard"] ?: error("$size: no asking card")
        assertFalse("$size: the question is whole", r.containsKey("askline.cut"))
        val mine = st.me.battlefield.filter { it.isCreature }.mapNotNull { r["c${it.id}"] }; val theirs = st.cpu.battlefield.filter { it.isCreature }.mapNotNull { r["c${it.id}"] }
        assertTrue("$size: creatures on both sides", mine.isNotEmpty() && theirs.isNotEmpty())
        val mid = (theirs.maxOf { it.bottom } + mine.minOf { it.top }) / 2
        assertTrue("$size: the line is on the middle of the table, between the rows: $line, middle $mid", mid > line.top && mid < line.bottom)
        assertTrue("$size: the line ends left of the asking card: $line $card", line.right < card.left)
        r["hand"]?.let { assertTrue("$size: the line is not in the hand's strip", line.bottom < it.top) }
        for (t in mine + theirs) assertTrue("$size: the asking card covers no creature: $card $t", !card.overlaps(t))
    }

    @Test fun onAPhoneTheQuestionIsOnTheTableBesideTheAskingCard() = check("844x390", board("m1-phone"))
    @Config(sdk = [35], qualifiers = "w1280dp-h800dp-land-xhdpi")
    @Test fun onATabletToo() = check("1280x800", board("m1-tablet"))
}
