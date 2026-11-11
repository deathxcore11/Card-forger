package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.chromeU
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Live 0.4.56 Thor findings for 0.4.57 (sweep-fixlist BB8, BB10, BB11): each shot is also measured from the table's own boxes
 * (Anchors), so "nothing overlaps" is checked, not only looked at. Sizes: the Thor's top screen as a big board (960 × 540 dp,
 * one screen and two), the same 1920 × 1080 panel at 420 dpi (731 × 411 dp, the phone layout scaled), and an 844 × 390 phone.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class Bb0457ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "bb0457/$name.png").path
    @After fun off() { DualScreen.pretend(null); Pad.forget() }

    private class Size(val tag: String, val w: Int, val h: Int, val dual: Boolean) {
        val q get() = "w${w}dp-h${h}dp-land-xhdpi"
        val u get() = chromeU(w.dp, h.dp)
    }
    private val sizes = listOf(
        Size("960x540-dual", 960, 540, true), Size("960x540-single", 960, 540, false),
        Size("731x411-dual", 731, 411, true), Size("844x390-phone", 844, 390, false))
    // xhdpi: 2 px a dp.
    private val px = 2f

    /** Your window with 7.4 s left, held: the gold button wears the turn ring and its last-10 count is drawn. */
    private val warnClock = dev.cardstashy.nativeplay.match.MatchController.Clock(0, 30_000, frozenLeft = 7_400)

    private fun board(name: String, st: MatchState, size: Size, picked: Int? = null, clock: dev.cardstashy.nativeplay.match.MatchController.Clock? = warnClock): Anchors {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers(size.q)
        DualScreen.pretend(if (size.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        val anchors = Anchors()
        captureRoboImage(shot("$name-${size.tag}")) {
            CompositionLocalProvider(LocalAnchors provides anchors, dev.cardstashy.nativeplay.ui.LocalMatchClock provides clock) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = picked, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        return anchors
    }

    private fun Rect.str() = "[%.0f,%.0f – %.0f,%.0f]".format(left, top, right, bottom)
    private fun apart(what: String, a: Rect, b: Rect) = assertTrue("$what overlap: ${a.str()} and ${b.str()}", !a.overlaps(b))
    private fun inside(what: String, r: Rect, size: Size, marginDp: Float = 0f) =
        assertTrue("$what ${r.str()} leaves the ${size.w * px} px screen", r.left >= 0f && r.right <= (size.w - marginDp) * px + .5f && r.top >= 0f && r.bottom <= size.h * px + .5f)

    /** BB11: the Undo pill stays off both seats' piles and their counts, with and without the stack (the piles slide left for it). */
    @Test fun bb11Undo() {
        Pad.used()
        val main = state("main"); val crowded = state("crowded")
        val quiet = main.copy(buttons = main.buttons.copy(cancel = "Undo", cancelEnabled = true))
        val stack = crowded.copy(buttons = crowded.buttons.copy(cancel = "Undo", cancelEnabled = true))
        for (size in sizes) for ((tag, st) in listOf("main" to quiet, "stack" to stack)) {
            val a = board("bb11-undo-$tag", st, size)
            val undo = a.rects["undo"] ?: error("no Undo drawn at ${size.tag} ($tag)")
            inside("Undo", undo, size)
            for (p in st.players) a.rects["piles${p.id}"]?.let { apart("Undo / ${if (p.id == st.viewer) "your" else "CPU"} piles at ${size.tag} ($tag)", undo, it) }
            a.rects["gold"]?.let { apart("Undo / gold at ${size.tag} ($tag)", undo, it) }
            // The gold button's turn ring is drawn over Undo when they meet; its last-10 count is never on Undo, a pile or the hand.
            val ring = a.rects["turnring"] ?: error("no turn ring at ${size.tag} ($tag)")
            apart("Undo / gold's turn ring at ${size.tag} ($tag)", undo, ring)
            val count = a.rects["turncount"] ?: error("no turn count at ${size.tag} ($tag)")
            inside("Turn count", count, size)
            for (k in listOf("undo", "quiet", "gold", "hand", "askline", "stacklabel", "stackcard")) a.rects[k]?.let { apart("Turn count / $k at ${size.tag} ($tag)", count, it) }
            for (p in st.players) a.rects["piles${p.id}"]?.let { apart("Turn count / piles ${p.id} at ${size.tag} ($tag)", count, it) }
            a.rects["stacklabel"]?.let { apart("Undo / stack label at ${size.tag} ($tag)", undo, it) }
        }
    }

    /**
     * BB10 (W3): four items on the stack, a CPU ability on top. The words under the top card cover no title, every card's
     * first title line shows above the card in front of it on the big board, and nothing passes 16 dp from the right edge.
     */
    @Test fun bb10Stack() {
        Pad.used()
        val base = state("crowded")
        val cpu = base.cpu.id; val me = base.viewer
        val one = base.stack.first()
        val items = listOf(
            one.copy(id = 9101, controller = cpu, ability = true, text = "Soul Warden — Whenever another creature enters, you gain 1 life."),
            one.copy(id = 9102, controller = me, ability = true, text = "Boggart Cursecrafter — Whenever another Goblin you control dies, Boggart Cursecrafter deals 1 damage to each opponent."),
            one.copy(id = 9103, controller = cpu, ability = true, text = "Talrand, Sky Summoner — Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying."),
            one.copy(id = 9104, controller = me, ability = true, text = "Llanowar Elves — Add {G}."))
        val st = base.copy(stack = items)
        // The same stack while Forge asks for a target on it, an older item among the targets: the folded list opens by itself.
        val picking = st.copy(inputType = "InputSelectTargets", selection = st.selection.copy(stackTargets = setOf(9103)))
        for (size in sizes) for ((tag, board) in listOf("" to st, "-target" to picking)) {
            val a = board("bb10-stack$tag", board, size, clock = null)
            val du = size.u * px
            val label = a.rects["stacklabel"] ?: error("no stack label at ${size.tag}$tag")
            inside("Stack label", label, size, 16f)
            val more = a.rects["stackmore"]
            if (more == null) {
                // Fanned: every older title shows whole above the card in front of it.
                val cards = items.map { s -> a.rects["stack${s.id}"] ?: error("stack card ${s.id} not drawn at ${size.tag}$tag") }
                cards.forEachIndexed { i, r ->
                    inside("Stack card ${items[i].id}", r, size, 16f)
                    // A card's title: its first line, 4 du in plus about 14 du of 9.5 sp Cinzel.
                    val title = Rect(r.left, r.top, r.right, r.top + 18f * du)
                    apart("Stack label / title of ${items[i].id} at ${size.tag}$tag", label, title)
                    // Only the cards in front of this one can hide it: those are the ones before it in the stack.
                    for (j in 0 until i) apart("Title of ${items[i].id} under ${items[j].id} at ${size.tag}$tag", title, cards[j])
                }
            } else {
                // Folded (too little room under the CPU's seat for readable steps): no slivers of older cards, a "+3" chip by the label.
                for (s in items.drop(1)) assertTrue("older card ${s.id} still fanned at ${size.tag}$tag", a.rects["stack${s.id}"] == null)
                inside("Stack +N chip", more, size, 16f)
                val topCard = a.rects["stackcard"] ?: error("no top stack card at ${size.tag}$tag")
                if (tag == "-target") {
                    val list = a.rects["stacklist"] ?: error("the folded list did not open for a target at ${size.tag}$tag")
                    inside("Stack list", list, size)
                    apart("Stack list / top card at ${size.tag}$tag", list, topCard)
                    val rows = items.drop(1).map { s -> a.rects["stackrow${s.id}"] ?: error("no list row for ${s.id} at ${size.tag}$tag") }
                    rows.forEachIndexed { i, r ->
                        assertTrue("row ${items[i + 1].id} at ${size.tag}$tag is ${r.height / du} du tall", r.height >= 18f * du)
                        for (j in 0 until i) apart("Stack list rows ${items[i + 1].id} / ${items[j + 1].id} at ${size.tag}$tag", r, rows[j])
                    }
                    a.rects["orb$cpu"]?.let { apart("Stack list / CPU portrait at ${size.tag}", list, it) }
                } else assertTrue("the folded list is open with no target at ${size.tag}", a.rects["stacklist"] == null)
            }
            a.rects["orb$cpu"]?.let { apart("Stack label / CPU portrait at ${size.tag}", label, it) }
        }
    }

    /** BB8: a long discard name on the gold button stays inside the button, off the line in the middle and off the hand chip. */
    @Test fun bb8Discard() {
        Pad.used()
        val main = state("main")
        val hand = main.me.hand
        val long = hand[2].copy(name = "Ultimate Magic: Meteor")
        val st0 = main.copy(players = main.players.map { p -> if (p.id == main.viewer) p.copy(hand = hand.map { if (it.id == long.id) long else it }) else p })
        val st = st0.copy(inputType = "InputSelectCardsFromList", message = "Select 1 card to discard to bring your hand down to the maximum of 7 cards",
            buttons = st0.buttons.copy(ok = "OK", okEnabled = false, cancel = null, cancelEnabled = false),
            selection = st0.selection.copy(cards = hand.map { it.id }.toSet(), actionable = emptySet()))
        for (size in sizes) {
            val a = board("bb8-discard", st, size, picked = long.id)
            val gold = a.rects["gold"] ?: error("no gold button at ${size.tag}")
            inside("Gold", gold, size)
            // The turn ring is drawn 6 + 3 px (design units) outside the button.
            val ring = 9f * size.u * px
            val g = Rect(gold.left - ring, gold.top - ring, gold.right + ring, gold.bottom + ring)
            a.rects["askline"]?.let { apart("Gold (with its ring) / ask line at ${size.tag}", g, it) }
            a.rects["handchip"]?.let { apart("Gold (with its ring) / hand chip at ${size.tag}", g, it) }
            // The last-10 count (drawn here: 7.4 s left) is off the line in the middle, the hand chip and the hand itself.
            val count = a.rects["turncount"] ?: error("no turn count at ${size.tag}")
            inside("Turn count", count, size)
            for (k in listOf("askline", "handchip", "hand", "quiet", "gold")) a.rects[k]?.let { apart("Turn count / $k at ${size.tag}", count, it) }
        }
    }

    /**
     * Thor 0.4.56 (finding C): Sheltered by Ghosts' second prompt read "Choose target nonland permanent an opponent contr…". The
     * whole ask shows. Since b80f7350 (live 0.4.57, fault list 4, 12, 14; table-info I5.1) a target ask on two screens is asked
     * once, on the bottom screen, where it wraps and is never cut: the top (the Thor's top screen about 640 × 360 dp, and the
     * sizes above) draws no line, and the bottom says the whole ask. The Thor on one screen (960 × 540) keeps the line on the table,
     * whole, off the gold button and the hand chip (the phone was never part of this finding).
     */
    @Test fun cAskLineWhole() {
        Pad.used()
        val t = state("targets")
        val st = t.copy(message = "Select targets for Sheltered by Ghosts\nChoose target nonland permanent an opponent controls.")
        val ask = dev.cardstashy.nativeplay.ui.askLine(st) ?: error("no ask for the target prompt")
        assertTrue("the ask itself is cut: $ask", "Choose target nonland permanent an opponent controls" in ask && "…" !in ask)
        for (size in listOf(Size("640x360-dual", 640, 360, true)) + sizes.filter { it.dual }) {
            val a = board("c-askline", st, size, clock = null)
            assertTrue("the top still says the ask at ${size.tag}", a.rects["askline"] == null)
            val words = dev.cardstashy.nativeplay.ui.bottomWords(st, true, st.me.hand, null, null, ask)
            assertTrue("the bottom does not ask at ${size.tag}: $words", words is dev.cardstashy.nativeplay.ui.BottomWords.Ask && words.text == ask)
        }
        for (size in sizes.filter { !it.dual && it.tag.startsWith("960") }) {
            val a = board("c-askline", st, size, clock = null)
            val line = a.rects["askline"] ?: error("no ask line at ${size.tag}")
            assertTrue("ask line cut at ${size.tag}", a.rects["askline.cut"] == null)
            inside("Ask line", line, size)
            for (k in listOf("gold", "handchip", "phasetrack")) a.rects[k]?.let { apart("Ask line / $k at ${size.tag}", line, it) }
        }
    }

    /**
     * Live 0.4.57 on the Thor (fault list 5): the two-line ask came down over your seat's tool row (Smart, Full Control,
     * Auto-pay) and hid the hand. On two screens a target ask is now asked below (MatchBottom), so the line left on top is
     * "Respond to X?"; with all three tools up and a long name it stays right of the tray, whole, at the Thor's sizes.
     */
    @Test fun askLineClearsSeatTray() {
        Pad.used()
        val t = state("targets").copy(controlMode = "smart", autoPay = true)
        // The CPU's spell on the stack while you hold priority: the top's line reads "Respond to <name>?" (askLine).
        fun respond(name: String) = t.copy(inputType = "InputPassPriority", message = "", priorityPlayer = t.viewer,
            stack = t.stack.take(1).map { it.copy(text = "$name — Counter target spell.", source = it.source?.copy(name = name)) })
        val long = respond("Sorin, Grim Nemesis of the Ancient Vampire Court")
        val longer = respond("Sorin, Grim Nemesis of the Ancient Vampire Court and Its Heirs")
        for ((st, size) in listOf(long to Size("640x360-dual", 640, 360, true), long to Size("731x411-dual", 731, 411, true),
            longer to Size("960x540-dual", 960, 540, true))) {
            val a = board("askline-tray", st, size, clock = null)
            val line = a.rects["askline"] ?: error("no ask line at ${size.tag}")
            val tools = a.rects["tools"] ?: error("no seat tray at ${size.tag}")
            apart("Ask line / tools at ${size.tag}", line, tools)
            assertTrue("ask line cut at ${size.tag}", a.rects["askline.cut"] == null)
        }
    }
}
