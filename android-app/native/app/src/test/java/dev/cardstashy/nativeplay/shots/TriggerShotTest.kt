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
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.match.Director
import dev.cardstashy.nativeplay.match.TriggerMoment
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
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
 * A TRIGGER SHOWS ITSELF at 844 × 390, frame by frame (sTrig, approved 10 Nov): the source lifting with its ring, the trigger on the
 * stack as the source's art card with "Trigger" and its text, and the result landing on the changed card (streak, flash, "+1/+1"
 * rising, counter chip, P/T plate green), for your trigger and for the CPU's (coral, a −1/−1 counter, plate coral), plus the
 * reduce-motion landing. Effects are queued through Battlefield.trigger, the same call the board makes for the controller's beat.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class TriggerShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    @Test fun frames() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(stack = emptyList())
        val me = base.viewer; val cpu = base.cpu.id
        val giant = base.me.battlefield.first { it.id == 107 }; val bears = base.me.battlefield.first { it.id == 108 }
        val cpuGiant = base.cpu.battlefield.first { it.id == 124 }
        fun bump(st: MatchState, id: Int, p: Int, t: Int, counters: Map<String, Int>) = st.copy(players = st.players.map { pl ->
            pl.copy(battlefield = pl.battlefield.map { if (it.id == id) it.copy(power = p, toughness = t, counters = counters) else it }) })
        val yourText = "Whenever you cast a spell, put a +1/+1 counter on target creature."
        val cpuText = "Whenever this attacks, put a -1/-1 counter on target creature an opponent controls."
        val yourItem = StackItem(31, yourText, giant, me, ability = true, targets = listOf(Ref("card", 108, bears.name)), trigger = true)
        val cpuItem = StackItem(32, cpuText, cpuGiant, cpu, ability = true, targets = listOf(Ref("card", 108, bears.name)), trigger = true)

        // The results as the director builds them from Forge's events and the boards around the resolve.
        fun result(src: Int, ctl: Int, item: StackItem, after: MatchState, counter: String, delta: Int): Director.Resolution {
            val events = listOf(dev.cardstashy.nativeplay.engine.GameEvent(1, "counters", 5, "MAIN1", null, Ref("card", 108, bears.name), Ref("card", src, null), null, emptyList(),
                emptyList(), emptyList(), "0", "1", null, null, null, null, counter = counter),
                dev.cardstashy.nativeplay.engine.GameEvent(2, "resolve", 5, "MAIN1", null, null, Ref("card", src, null), null, emptyList(), emptyList(), emptyList(), null, null, null, null, null, null))
            return Director.resolutions(base.copy(stack = listOf(item)), after, events, setOf(item.id)).single().also { assertTrue(it.trigger); assertEquals(ctl, it.controller); assertEquals(delta, it.counters.single().delta) }
        }
        val youAfter = bump(base, 108, 3, 3, mapOf("P1P1" to 1))
        val youRes = result(107, me, yourItem, youAfter, "P1P1", 1)
        val cpuAfter = bump(base, 108, 1, 1, mapOf("M1M1" to 1))
        val cpuRes = result(124, cpu, cpuItem, cpuAfter, "M1M1", 1)
        assertEquals(listOf(Director.PtChange(108, bears.name, 2, 2, 3, 3)), youRes.pt)
        assertEquals(false, cpuRes.pt.single().up)

        class Frame(val name: String, val st: MatchState, val m: TriggerMoment?, val at: Long, val reduced: Boolean = false)
        val frames = listOf(
            Frame("you-source", base, TriggerMoment(TriggerMoment.Phase.SOURCE, 107, giant.name, true, 31, key = 1), 300),
            Frame("you-stack", base.copy(stack = listOf(yourItem)), TriggerMoment(TriggerMoment.Phase.STACK, 107, giant.name, true, 31, key = 2), 0),
            Frame("you-result", youAfter, TriggerMoment(TriggerMoment.Phase.RESULT, 107, giant.name, true, 31, 1, youRes, youRes.line(me), key = 3), 560),
            Frame("you-result-still", youAfter, TriggerMoment(TriggerMoment.Phase.RESULT, 107, giant.name, true, 31, 1, youRes, youRes.line(me), key = 4), 560, reduced = true),
            Frame("cpu-source", base, TriggerMoment(TriggerMoment.Phase.SOURCE, 124, cpuGiant.name, false, 32, key = 5), 300),
            Frame("cpu-stack", base.copy(stack = listOf(cpuItem)), TriggerMoment(TriggerMoment.Phase.STACK, 124, cpuGiant.name, false, 32, key = 6), 0),
            Frame("cpu-result", cpuAfter, TriggerMoment(TriggerMoment.Phase.RESULT, 124, cpuGiant.name, false, 32, 1, cpuRes, cpuRes.line(me), key = 7), 560),
        )
        assertEquals("Hill Giant: +1/+1 counter on ${bears.name}", youRes.line(me))
        for (f in frames) {
            val fx = Battlefield(); val anchors = Anchors()
            // Reduce motion is the system's animator scale at 0 (Playmats.reduced, which the board's driver reads).
            android.provider.Settings.Global.putFloat(RuntimeEnvironment.getApplication().contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, if (f.reduced) 0f else 1f)
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            val content: @androidx.compose.runtime.Composable () -> Unit = {
                CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx, LocalTrigger provides f.m) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(f.st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                        FxLayer(force = true)
                    }
                }
            }
            // A first pass lays the board out (the anchors the effects aim at); then the beat is queued and drawn at its frame.
            captureRoboImage(File(System.getProperty("shotsDir"), "table/trig-layout.png").path, content = content)
            fx.trigger(f.m, f.st, anchors, force = true)
            fx.reindex(); fx.now.longValue = f.at
            when (f.m?.phase) {
                TriggerMoment.Phase.SOURCE -> assertEquals(listOf(Fx.TRIG_SOURCE), fx.items.map { it.kind })
                TriggerMoment.Phase.RESULT -> assertTrue(fx.items.any { it.kind == Fx.TRIG_LAND && it.card == 108 && it.note == f.m.line })
                else -> assertTrue(fx.items.isEmpty())
            }
            captureRoboImage(File(System.getProperty("shotsDir"), "table/trig-${f.name}-844x390.png").path, content = content)
        }
        File(System.getProperty("shotsDir"), "table/trig-layout.png").delete()
        android.provider.Settings.Global.putFloat(RuntimeEnvironment.getApplication().contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
        CardImageTest.art = null
    }
}
