package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Player
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Living Battlefield Phase 0: the one-turn preview. The site's own test board (snap-main) played forward through the ten
 * moments as Forge snapshots, rendered frame by frame on the real ForgeBoard at a fixed clock. Frames go to
 * shots/battlefield/f-NNNN.png; the scratchpad encodes them into the preview video.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-hdpi")
class BattlefieldVideoTest {
    @get:Rule val rule = createComposeRule()
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    private var rev = 100L
    private fun MatchState.me(f: (Player) -> Player) = copy(players = players.map { if (it.id == viewer) f(it) else it })
    private fun MatchState.cpu(f: (Player) -> Player) = copy(players = players.map { if (it.id != viewer) f(it) else it })
    private fun MatchState.next() = copy(revision = ++rev)
    private fun MatchState.mine(input: String = "InputPassPriority") = copy(busy = false, priorityPlayer = viewer, inputType = input).next()
    private fun MatchState.theirs() = copy(busy = true, priorityPlayer = players.first { it.id != viewer }.id, inputType = null).next()
    private fun Player.bf(f: (Card) -> Card) = copy(battlefield = battlefield.map(f))

    /** The turn, as Forge would send it: (state, how long it stays on screen in ms). */
    private fun script(): List<Pair<MatchState, Long>> {
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
            .copy(selection = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.selection.copy(actionable = emptySet()))
        val elves = base.me.hand.first { it.name == "Llanowar Elves" }
        val forest = base.me.hand.first { it.name == "Forest" }
        val bolt = base.me.hand.first { it.name == "Lightning Bolt" }.copy(id = 300, owner = 2, controller = 2, zone = "Stack")
        val out = mutableListOf<Pair<MatchState, Long>>()
        // The CPU's end step: their half warm, their edge lit cool.
        var s = base.copy(turn = 4, activePlayer = 2, phase = "END_OF_TURN").me { it.copy(hand = it.hand - elves, handCount = 6, libraryCount = 82) }.theirs()
        out += s to 1000L
        // 1. You draw and get priority: the light moves to your side, the gold line starts round your edge.
        s = s.copy(turn = 5, activePlayer = 1, phase = "MAIN1").me { it.copy(hand = it.hand + elves, handCount = 7, libraryCount = 81) }.mine()
        out += s to 1500L
        // 2. Play a land: arrival and mana glow.
        s = s.me { it.copy(hand = it.hand - forest, handCount = 6, battlefield = it.battlefield + forest.copy(id = 105, zone = "Battlefield")) }.mine()
        out += s to 1200L
        // 3. Cast a creature: it lifts out of the hand onto the stack.
        val elvesOnStack = StackItem(900, "Llanowar Elves", elves.copy(zone = "Stack"), 1)
        s = s.me { p -> p.copy(hand = p.hand - elves, handCount = 5).bf { if (it.id == 105) it.copy(tapped = true) else it } }.copy(stack = listOf(elvesOnStack)).theirs()
        out += s to 1000L
        // 4. The CPU responds with an instant aimed at your Grizzly Bears.
        val boltItem = StackItem(901, "Lightning Bolt deals 3 damage to Grizzly Bears.", bolt, 2, targets = listOf(Ref("card", 108, "Grizzly Bears")))
        s = s.cpu { p -> p.copy(handCount = 6).bf { if (it.id == 120) it.copy(tapped = true) else it } }.copy(stack = listOf(boltItem, elvesOnStack)).mine()
        out += s to 1700L
        // 5. The stack resolves top-down: the Bolt's light runs to the Bears, which break and drift to your graveyard.
        val bears = s.me.battlefield.first { it.id == 108 }
        s = s.me { it.copy(battlefield = it.battlefield.filter { c -> c.id != 108 }, graveyard = it.graveyard + bears.copy(zone = "Graveyard")) }
            .cpu { it.copy(graveyard = it.graveyard + bolt.copy(zone = "Graveyard")) }.copy(stack = listOf(elvesOnStack)).theirs()
        out += s to 1500L
        // ...then the Elves land in their slot.
        s = s.me { it.copy(battlefield = it.battlefield + elves.copy(zone = "Battlefield", summoningSick = true)) }.copy(stack = emptyList()).mine()
        out += s to 1400L
        // A token forms from light; a +1/+1 counter pours into the Hill Giant.
        val goblin = base.me.battlefield.first { it.id == 109 }.copy(id = 140, name = "Goblin", token = true, power = 1, toughness = 1, text = "", manaCost = "{R}", summoningSick = true)
        s = s.me { p -> p.copy(battlefield = p.battlefield + goblin).bf { if (it.id == 107) it.copy(counters = mapOf("P1P1" to 1), power = 4, toughness = 4) else it } }.mine()
        out += s to 1300L
        // 6. Combat begins: a faint grain across the centre.
        s = s.copy(phase = "COMBAT_DECLARE_ATTACKERS").mine("InputAttack")
        out += s to 1000L
        // 7. You attack with the Giant and the Guide.
        val defender = Ref("player", 2, "CPU")
        s = s.me { p -> p.bf { if (it.id == 107 || it.id == 109) it.copy(attacking = true, tapped = true, attackTarget = defender) else it } }.theirs()
        out += s to 1200L
        // 8. The CPU blocks the Guide with its Hill Giant.
        s = s.copy(phase = "COMBAT_DECLARE_BLOCKERS").cpu { p -> p.bf { if (it.id == 124) it.copy(blocking = true, blockingIds = listOf(109)) else it } }.mine()
        out += s to 1500L
        // 9. Damage: hit-stop, the Guide dies and drifts to your graveyard, the CPU loses 4.
        val guide = s.me.battlefield.first { it.id == 109 }
        s = s.copy(phase = "COMBAT_DAMAGE").me { it.copy(battlefield = it.battlefield.filter { c -> c.id != 109 }, graveyard = it.graveyard + guide.copy(zone = "Graveyard", attacking = false, tapped = false)) }
            .cpu { p -> p.copy(life = 34).bf { if (it.id == 124) it.copy(damage = 2) else it } }.mine()
        out += s to 3000L
        s = s.copy(phase = "MAIN2").me { p -> p.bf { it.copy(attacking = false, attackTarget = null) } }.cpu { p -> p.bf { it.copy(blocking = false, blockingIds = emptyList(), damage = 0) } }.mine()
        out += s to 700L
        // 10. The turn passes: the light moves to their side.
        s = s.copy(turn = 6, activePlayer = 2, phase = "UPKEEP").cpu { p -> p.bf { it.copy(tapped = false) } }.theirs()
        out += s to 1800L
        return out
    }

    @Test fun oneTurn() {
        dev.cardstashy.nativeplay.ui.Motion.still = false
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        val dir = File(System.getProperty("shotsDir"), "battlefield").apply { deleteRecursively(); mkdirs() }
        val steps = script()
        var st by mutableStateOf(steps.first().first)
        rule.mainClock.autoAdvance = false
        rule.setContent {
            val anchors = remember { Anchors() }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
        val fps = (System.getProperty("fxFps") ?: "24").toInt(); val frame = 1000L / fps
        repeat(4) { rule.mainClock.advanceTimeBy(frame); Thread.sleep(100) }
        var n = 0
        for ((state, hold) in steps) {
            st = state
            var t = 0L
            while (t < hold) {
                rule.mainClock.advanceTimeBy(frame); t += frame
                rule.onRoot().captureRoboImage(File(dir, "f-%04d.png".format(n++)).path)
            }
        }
        println("battlefield frames: $n at $fps fps")
    }
}
