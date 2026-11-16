package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TravelMoment
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalTravel
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TravelClock
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T5 (fault 20, the cast travels), frame by frame: your Llanowar Elves from its place in your hand to the stack and from
 * the stack into its slot, your Forest from the hand to its group, an Ethereal Armor from the stack to Hill Giant, and the CPU's
 * Goblin Guide out of its seat face down to the stack. At the start of each leg the card is where it leaves from, at the end it is
 * exactly where it lands. Pictures at the start, middle and end of each leg, phone and large.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookT5ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    @After fun off() { TravelClock.fixed = null }

    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private val me = base.viewer
    private val armor = base.me.battlefield.first { it.name == "Hill Giant" }.let { g ->
        g.copy(id = 990, name = "Ethereal Armor", type = "Enchantment — Aura", power = null, toughness = null, zone = "Hand", attachedTo = null) }
    private val cpuGuide = base.me.hand.first { it.name == "Monastery Swiftspear" }.copy(id = 130, name = "Goblin Guide", owner = base.cpu.id, controller = base.cpu.id, type = "Creature — Goblin Scout")

    private fun with(hand: List<Card> = base.me.hand + armor, mine: List<Card> = base.me.battlefield, theirs: List<Card> = base.cpu.battlefield, stack: List<StackItem> = emptyList()) =
        base.copy(stack = stack, players = base.players.map { p -> if (p.id == me) p.copy(hand = hand, battlefield = mine) else p.copy(battlefield = theirs) })
    private fun item(c: Card, controller: Int = me) = StackItem(c.id + 1000, c.text, c.copy(zone = "Stack"), controller)

    private fun draw(anchors: Anchors, st: MatchState, travel: TravelMoment?, file: String) {
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path) {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalTravel provides travel) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }
    }

    private var k = 0L
    /** One leg at its start, middle and end: the travelling card starts on [from] and ends on [to]. */
    private fun leg(anchors: Anchors, st: MatchState, t: Director.Travel, name: String, size: String, from: () -> Rect, to: () -> Rect) {
        // The board once as it stands, so every place the card goes between is laid out before the leg is drawn (in a real match
        // the board has stood for many frames; a capture is one composition, which in a long test run can be a frame short).
        draw(anchors, st, null, "t5-$name-board-$size")
        for (p in listOf(0f, .5f, 1f)) {
            TravelClock.fixed = p
            draw(anchors, st, TravelMoment(t, 0, ++k), "t5-$name-${(p * 100).toInt()}-$size")
            val r = anchors.rects["travelcard"]
            assertNotNull("$size $name at $p: the card is drawn", r)
            val want = if (p == 0f) from() else if (p == 1f) to() else null
            if (want != null) assertTrue("$size $name at $p: $r on $want", (r!!.center - want.center).getDistance() < 3f && kotlin.math.abs(r.width - want.width) < 3f)
            anchors.rects.remove("travelcard")
        }
    }

    @Test fun eachLegStartsWhereTheCardIsAndEndsWhereItLands() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        for ((size, q) in listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            val anchors = Anchors()
            val elves = base.me.hand.first { it.name == "Llanowar Elves" }
            val forest = base.me.hand.first { it.name == "Forest" }
            // The board you cast from: each card in your hand has its own place.
            draw(anchors, with(), null, "t5-hand-$size")
            val handElves = anchors.rects["hand${elves.id}"]; val handForest = anchors.rects["hand${forest.id}"]; val handArmor = anchors.rects["hand${armor.id}"]
            assertNotNull("$size: hand places", handElves); assertNotNull(handForest); assertNotNull(handArmor)
            val rest = base.me.hand.filter { it.id != elves.id && it.id != forest.id } + armor

            // The creature: hand to the stack (the stack card stays clear while it flies), then the stack into its slot.
            val up = with(hand = rest, stack = listOf(item(elves)))
            leg(anchors, up, Director.Travel(elves.id, elves.name, true, Director.Leg.TO_STACK, "stackcard", 440, 1106), "creature-to-stack", size,
                { handElves!! }, { anchors.rects.getValue("stackcard") })
            val stackAt = anchors.rects.getValue("stackcard")
            val down = with(hand = rest, mine = base.me.battlefield + elves.copy(zone = "Battlefield"))
            leg(anchors, down, Director.Travel(elves.id, elves.name, true, Director.Leg.TO_SLOT, "c${elves.id}", 380), "creature-to-slot", size,
                { stackAt }, { anchors.rects.getValue("c${elves.id}") })

            // The land: hand to its group, no stack.
            val land = with(hand = rest, mine = base.me.battlefield + forest.copy(zone = "Battlefield"))
            leg(anchors, land, Director.Travel(forest.id, forest.name, true, Director.Leg.TO_GROUP, "c${forest.id}", 380), "land-to-group", size,
                { handForest!! }, { anchors.rects.getValue("c${forest.id}") })

            // The aura: stack to its host.
            val giant = base.me.battlefield.first { it.name == "Hill Giant" }
            val on = with(hand = rest - armor, mine = base.me.battlefield.map { if (it.id == giant.id) it.copy(attachments = listOf(armor.id)) else it } + armor.copy(zone = "Battlefield", attachedTo = giant.id))
            leg(anchors, on, Director.Travel(armor.id, armor.name, true, Director.Leg.TO_HOST, "c${giant.id}", 380), "aura-to-host", size,
                { stackAt }, { anchors.rects.getValue("c${giant.id}") })

            // 0.4.59 T6, Cancel: from the stack back to its own place in your hand.
            leg(anchors, with(), Director.Travel(elves.id, elves.name, true, Director.Leg.BACK, "hand${elves.id}", Director.BACK_MS), "cancel-to-hand", size,
                { stackAt }, { anchors.rects.getValue("hand${elves.id}") })

            // The CPU's spell: out of its seat to the stack.
            val cpuUp = with(hand = rest, stack = listOf(item(cpuGuide, base.cpu.id)))
            leg(anchors, cpuUp, Director.Travel(cpuGuide.id, cpuGuide.name, false, Director.Leg.TO_STACK, "stackcard", 440), "cpu-to-stack", size,
                { anchors.rects.getValue("cpuhand") }, { anchors.rects.getValue("stackcard") })
        }
    }
}
