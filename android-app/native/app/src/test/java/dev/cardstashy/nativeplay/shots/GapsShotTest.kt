package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Du
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.ScryOne
import dev.cardstashy.nativeplay.ui.ScryOneView
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.chromeU
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import dev.cardstashy.nativeplay.engine.Payment
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.NO_MANA_SKIPPED
import dev.cardstashy.nativeplay.ui.TileTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Gaps list 15 Nov on the Fold (884 x 796 dp): the one-card scry with its card (item 1), Main 2's one End turn (item 3) and a gold
 * label that fits whole (item 7, "Pay automa…"). Pictures in table-gaps, for the eye.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class GapsShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()

    private fun shot(st: MatchState, name: String, scry: Boolean = false) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    if (scry) ScryOne.of(st)?.let { n -> BoxWithConstraints(Modifier.fillMaxSize()) { ScryOneView(st, n, true, Du(chromeU(maxWidth, maxHeight)), {}, {}) } }
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-gaps/$name.png").path)
    }

    @Test fun scryOne() {
        val st = base.copy(inputType = "InputConfirm", buttons = Buttons("Top", "Bottom", true, true), stack = emptyList(),
            message = "Plains (12)\n\nPut Plains on the top or bottom of your library?", phase = "COMBAT_DECLARE_ATTACKERS", activePlayer = base.viewer)
        assertEquals("Plains", ScryOne.of(st))
        shot(st, "scry-one", scry = true)
    }

    @Test fun main2() = shot(base.copy(inputType = "InputPassPriority", phase = "MAIN2", activePlayer = base.viewer, priorityPlayer = base.viewer, stack = emptyList(),
        buttons = Buttons("OK", "End Turn", true, true)), "main2")

    @Test fun payAutomatically() {
        shot(base.copy(inputType = "InputPayManaOfCostPayment", activePlayer = base.viewer, priorityPlayer = base.viewer,
            buttons = Buttons("Auto", "Cancel", true, true), message = "Seam Rip (12) - \n\nPay Mana Cost: {1}"), "pay-auto")
        // Gaps list 7: "Pay automatically" was cut ("Pay automa…"); the press now names its amount and is whole.
        whole("Pay 1"); rule.onNodeWithText("Cancel").assertExists()
    }

    // ---- Better table: the gold button's words and where it goes (scenes 2, 3, 9; gaps list 7), on the Fold and the phone ----

    private val me get() = base.me.battlefield.filter { it.isCreature }
    /** Your trigger's "you may pay {1}" (Spellbook Vendor's shape) with mana open: Pay 1 and Not now. */
    private fun triggerPay(): MatchState { val src = me.first()
        return base.copy(inputType = "InputPayManaOfCostPayment", activePlayer = base.viewer, priorityPlayer = base.viewer, phase = "COMBAT_BEGIN",
            stack = listOf(StackItem(9100, "${src.name} — you may pay {1}.", src, base.viewer, ability = true, trigger = true)),
            payment = Payment("{1}", src.id, src.name, "{1}"), buttons = Buttons("Auto", "Cancel", true, true), message = "${src.name} - \n\nPay Mana Cost: {1}") }
    /** Declare attackers with two creatures Forge offers and none sent yet: All attack beside the gold No attacks. */
    private fun attackers() = base.copy(inputType = "InputAttack", phase = "COMBAT_DECLARE_ATTACKERS", activePlayer = base.viewer, priorityPlayer = base.viewer, stack = emptyList(),
        buttons = Buttons("OK", null, true, false), selection = base.selection.copy(cards = me.take(2).map { it.id }.toSet()),
        players = base.players.map { p -> if (p.id == base.viewer) p.copy(battlefield = p.battlefield.map { c -> if (c.isCreature) c.copy(tapped = false, attacking = false, summoningSick = false) else c }) else p })
    private fun main1() = base.copy(inputType = "InputPassPriority", phase = "MAIN1", activePlayer = base.viewer, priorityPlayer = base.viewer, stack = emptyList(),
        buttons = Buttons("OK", "End Turn", true, true),
        players = base.players.map { p -> if (p.id == base.viewer) p.copy(battlefield = p.battlefield.map { c -> if (c.isCreature) c.copy(tapped = false, summoningSick = false) else c }) else p })

    /** [word] is on screen and was never cut with … (GoldPill and the sub-line record it as drawn). */
    private fun whole(word: String) {
        rule.onNodeWithText(word).assertExists()
        assertEquals("$word is whole", 0f, anchors.sizes["goldcut:$word"])
    }
    private fun inside(key: String) {
        assertNotNull(key, anchors.rects[key]); val r = anchors.rects[key]!!
        val root = rule.onRoot().fetchSemanticsNode().boundsInRoot
        assertTrue("$key inside the screen: $r in $root", r.left >= root.left - 1 && r.right <= root.right + 1 && r.top >= root.top - 1 && r.bottom <= root.bottom + 1)
    }

    private fun payTrigger(tag: String) {
        shot(triggerPay(), "pay-trigger-$tag")
        whole("Pay 1"); rule.onNodeWithText("Not now").assertExists()
        assertEquals("no Cancel for a trigger's may-pay", 0, rule.onAllNodesWithText("Cancel").fetchSemanticsNodes().size)
        inside("gold")
    }
    @Test fun payTriggerFold() = payTrigger("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun payTriggerPhone() = payTrigger("phone")

    private fun noAttacks(tag: String) {
        shot(attackers(), "no-attacks-$tag")
        whole("No attacks"); whole("to second main")
        rule.onNodeWithText("All attack").assertExists()
        val gold = anchors.rects["gold"]!!; val all = anchors.rects["allattack"]!!
        assertTrue("All attack stands above the gold No attacks: $all / $gold", all.bottom <= gold.top + 1)
        inside("gold"); inside("allattack")
        // The way on sits under the words, inside the button.
        val sub = anchors.rects["goldsub"]!!
        assertTrue("sub-line inside the gold button", sub.top >= gold.top && sub.bottom <= gold.bottom + 1)
    }
    @Test fun noAttacksFold() = noAttacks("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun noAttacksPhone() = noAttacks("phone")

    private fun endTurn(tag: String) {
        main2Shot("main2-sub-$tag")
        whole("End turn"); whole("to ${base.cpu.name}\u2019s turn")
        inside("gold")
    }
    private fun main2Shot(name: String) = shot(base.copy(inputType = "InputPassPriority", phase = "MAIN2", activePlayer = base.viewer, priorityPlayer = base.viewer, stack = emptyList(),
        buttons = Buttons("OK", "End Turn", true, true)), name)
    @Test fun endTurnFold() = endTurn("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun endTurnPhone() = endTurn("phone")

    private fun toCombat(tag: String) {
        shot(main1(), "to-combat-$tag")
        whole("Attack"); whole("to combat")
        rule.onNodeWithText("End turn").assertExists()
        inside("gold")
    }
    @Test fun toCombatFold() = toCombat("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun toCombatPhone() = toCombat("phone")

    /** Scene 2: the declined trigger's source wears "No mana · skipped" under its tile while the table goes on to attackers. */
    private fun noManaSkipped(tag: String) {
        val src = me[1]
        TileTags.shown.clear(); TileTags.post(src.id, NO_MANA_SKIPPED)
        try {
            shot(attackers(), "no-mana-skipped-$tag")
            rule.onNodeWithText(NO_MANA_SKIPPED).assertExists()
            val t = anchors.rects["tiletag${src.id}"]!!; val c = anchors.rects["c${src.id}"]!!
            assertTrue("the tag hangs under its own tile: $t / $c", t.top >= c.bottom - 12 && t.center.x in c.left..c.right)
            inside("tiletag${src.id}")
        } finally { TileTags.shown.clear() }
    }
    @Test fun noManaSkippedFold() = noManaSkipped("fold")
    @Config(qualifiers = "w844dp-h390dp-land-xhdpi") @Test fun noManaSkippedPhone() = noManaSkipped("phone")

    /** The timed tag goes by itself (and runs nothing on once gone): after its time the tile wears nothing. */
    @Test fun tileTagGoes() {
        val src = me[1]
        TileTags.shown.clear(); TileTags.post(src.id, NO_MANA_SKIPPED)
        shot(attackers(), "no-mana-gone")
        rule.mainClock.advanceTimeBy(dev.cardstashy.nativeplay.ui.TAG_MS + 1000); rule.waitForIdle()
        assertEquals(0, rule.onAllNodesWithText(NO_MANA_SKIPPED).fetchSemanticsNodes().size)
        assertTrue(TileTags.shown.isEmpty())
    }
}
