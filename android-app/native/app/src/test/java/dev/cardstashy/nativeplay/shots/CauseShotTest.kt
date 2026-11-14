package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.GameEvent
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TriggerMoment
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.LocalHeld
import dev.cardstashy.nativeplay.ui.LocalLastMoves
import dev.cardstashy.nativeplay.ui.LocalTrigger
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * EVERY RESULT NAMES ITS CAUSE, frame by frame on the real boards of CauseProbe's match (table/cause-cpu.jsonl): the plate on
 * the exiled card, the card drawn, the trigger the ward countered, the ward the CPU paid, then the chain: destroyed with its
 * Auras falling off in the same beat, the held card returning. "Last moves" fills as the controller would fill it, and the exiled card sits
 * on its Aura while it is held. Drawn at a phone (844 x 390), a Fold (884 x 796) and the Thor's top screen (960 x 540).
 * The effects are queued through Battlefield.trigger, the call the board makes for the controller's beat. The table lies on a real map.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class CauseShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private val cpu = javaClass.classLoader!!.getResource("table/cause-cpu.jsonl")!!.readText().lines().filter { it.isNotBlank() }.map { MatchState.parse(it)!! }.associateBy { it.revision }
    private fun fresh(before: MatchState, after: MatchState): List<GameEvent> = before.events.maxOf { it.seq }.let { last -> after.events.filter { it.seq > last } }

    /** One beat: the board the last beat left ([from]), the board this beat shows ([to]) and its result. */
    private class Beat(val name: String, val from: MatchState, val to: MatchState, val r: Director.Resolution, val held: Map<Int, Int>)

    @Test fun frames() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        // A real map behind the table (Randall 14 Nov: "We have backgrounds no?"): loaded before the first picture, as a match has it.
        val mat = "ashen-forge"
        for (crop in listOf("", "-tall")) kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.ui.Playmats.preload(RuntimeEnvironment.getApplication(), mat, crop) }
        val me = cpu[71]!!.viewer
        val holds = mapOf(64 to 40)
        fun results(a: Long, b: Long, triggers: Set<Int>, held: Map<Int, Int> = emptyMap()) = Director.resolutions(cpu[a]!!, cpu[b]!!, fresh(cpu[a]!!, cpu[b]!!), triggers, held)
        val exile = results(71, 75, setOf(7)).single(); val draw = results(128, 132, setOf(11)).single()
        val counter = results(189, 195, setOf(21, 22)).single(); val ward = results(275, 281, setOf(28, 29)).single()
        val (kill, back) = results(281, 285, setOf(28), holds)
        val b281 = cpu[281]!!; val b285 = cpu[285]!!
        val beats = listOf(
            Beat("1-exiled", cpu[71]!!, cpu[75]!!, exile, holds),
            Beat("2-drew", cpu[128]!!, cpu[132]!!, draw, holds),
            Beat("3-countered", cpu[189]!!, cpu[195]!!, counter, holds),
            Beat("4-ward-paid", cpu[275]!!, b281, ward, holds),
            Beat("5-destroyed", Director.beforeResults(b285, b281, listOf(kill, back)), Director.beforeResults(b285, b281, listOf(back)), kill, holds),
            Beat("6-returned", Director.beforeResults(b285, b281, listOf(back)), b285, back, holds),
        )
        val sizes = listOf("phone-844x390" to "w844dp-h390dp-land-xxhdpi", "fold-884x796" to "w884dp-h796dp-xhdpi", "thor-top-960x540" to "w960dp-h540dp-land-xhdpi")
        var k = 0L
        for ((size, q) in sizes) {
            RuntimeEnvironment.setQualifiers(q)
            val told = ArrayList<Director.Line>()
            for (b in beats) {
                val fx = Battlefield(); val anchors = Anchors()
                dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
                told += b.r.lines(me)
                val m = TriggerMoment(TriggerMoment.Phase.RESULT, b.r.sourceId, b.r.sourceName, b.r.controller == me, b.r.stackId, b.r.count, b.r, b.r.line(me), key = ++k)
                fun content(st: MatchState, moves: List<Director.Line>, moment: TriggerMoment?): @androidx.compose.runtime.Composable () -> Unit = {
                    CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx, LocalTrigger provides moment, LocalLastMoves provides moves, LocalHeld provides b.held) {
                        Box(Modifier.fillMaxSize().background(Palette.Night)) {
                            PlaymatScene(mat, Modifier.fillMaxSize())
                            ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                            FxLayer(force = true)
                        }
                    }
                }
                // A first pass lays out the board the beat starts from (where the leaving card stands); then the beat is queued and drawn mid-plate.
                val scratch = File(System.getProperty("shotsDir"), "table/cause-layout.png")
                captureRoboImage(scratch.path, content = content(b.from, told.dropLast(b.r.lines(me).size), null))
                captureRoboImage(scratch.path, content = content(b.to, told.toList(), m))
                fx.trigger(m, b.to, anchors, force = true)
                fx.reindex(); fx.now.longValue = 900
                val plates = fx.items.filter { it.kind == Fx.PLATE }
                assertTrue("${b.name}: a plate for every card it names", plates.isNotEmpty())
                for (p in plates) assertTrue("${b.name}: the plate ${p.label} has a place on the table (${p.toKey}, ${p.fromKey})", anchors.rects[p.toKey] != null || anchors.rects[p.fromKey] != null)
                // A card that leaves in the beat breaks (or fades) under its plate and its embers fly to the pile; one that returns arrives.
                // The board changes with the beat and not with a new board from Forge, so the beat itself must queue these.
                if (b.name == "1-exiled") assertTrue("Memnite fades where it stood", fx.items.any { it.kind == Fx.DEATH && it.ghost?.id == 64 && it.toKey == null })
                if (b.name == "5-destroyed") {
                    assertTrue("the Lions break and go to your pile", fx.items.any { it.kind == Fx.DEATH && it.ghost?.id == 33 && it.toKey == "grave0" })
                    assertEquals("embers for the Lions and both Auras", setOf(33, 40, 3), fx.items.filter { it.kind == Fx.EMBERS }.mapNotNull { it.card }.toSet())
                    assertEquals("every plate of the beat ends with it", 1, plates.map { it.t0 + it.dur }.distinct().size)
                }
                if (b.name == "6-returned") assertTrue("Memnite arrives", fx.items.any { it.kind == Fx.ARRIVE && it.card == 64 })
                captureRoboImage(File(System.getProperty("shotsDir"), "table/cause-${b.name}-$size.png").path, content = content(b.to, told.toList(), m))
                // The exiled card sits on the Aura that holds it from its "Exiled" beat on, while the Aura is on the table.
                if (b.to.players.any { p -> p.exile.any { it.id == 64 } } && b.to.players.any { p -> p.battlefield.any { it.id == 40 } })
                    assertTrue("${b.name} $size: Memnite is drawn on Sheltered by Ghosts", anchors.rects["held64"] != null)
                else if (b.name == "1-exiled") error("beat 1 shows Memnite in exile")
                scratch.delete()
            }
            assertEquals(7, told.size)
        }
        CardImageTest.art = null
    }
}
