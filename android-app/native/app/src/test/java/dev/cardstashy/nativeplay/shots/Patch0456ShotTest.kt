package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.HandFan
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.MatchBottom
import dev.cardstashy.nativeplay.ui.Pad
import dev.cardstashy.nativeplay.ui.PadAct
import dev.cardstashy.nativeplay.ui.PadPromptBar
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Patch 0456 (Thor device findings W3 stack card on the top screen, W4 the gold button's X, W5 symbols on the lifted card). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class Patch0456ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "patch0456/$name.png").path
    @After fun off() { DualScreen.pretend(null); Pad.forget() }

    private fun top(name: String, st: MatchState, dual: Boolean, q: String = "w960dp-h540dp-land-xhdpi") {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers(q)
        DualScreen.pretend(if (dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        captureRoboImage(shot(name)) {
            val anchors = remember { Anchors() }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    if (!dual) Box(Modifier.fillMaxSize()) { PadPromptBar() }
                }
            }
        }
    }

    @Test fun w3Stack() {
        val base = state("crowded")
        val cpuId = base.cpu.id
        val cpu = base.copy(stack = base.stack.map { it.copy(controller = cpuId) })
        val spell = base.copy(stack = listOf(base.stack.first().copy(controller = cpuId, ability = false, source = base.me.hand.first().copy(zone = "Stack"), text = "Lightning Bolt \u2014 deals 3 damage to any target.")))
        top("w3-stack-cpu-ability-960x540-dual", cpu, true)
        top("w3-stack-cpu-ability-960x540-single", cpu, false)
        top("w3-stack-cpu-spell-960x540-dual", spell, true)
        top("w3-stack-cpu-ability-844x390-phone", cpu, false, "w844dp-h390dp-land-xhdpi")
    }

    @Test fun w4GoldKey() {
        val st = state("main")
        Pad.used()
        top("w4-gold-x-top-960x540-dual", st, true)
        top("w4-gold-x-top-960x540-single", st, false)
    }

    @Test fun w5Lifted() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers("w620dp-h540dp-xhdpi")
        // Scryfall's symbol SVGs come over the network; a round stand-in per symbol shows where the renderer puts them.
        val old = dev.cardstashy.nativeplay.ui.homeArt
        dev.cardstashy.nativeplay.ui.homeArt = { url: String ->
            val sym = url.substringAfterLast('/').substringBefore('.')
            val bmp = android.graphics.Bitmap.createBitmap(64, 64, android.graphics.Bitmap.Config.ARGB_8888)
            val c = android.graphics.Canvas(bmp)
            val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
            p.color = when (sym) { "G" -> 0xFF3F8F4F.toInt(); "T" -> 0xFF222222.toInt(); else -> 0xFFCAC5C0.toInt() }
            c.drawCircle(32f, 32f, 31f, p)
            p.color = if (sym == "T") 0xFFFFFFFF.toInt() else 0xFF111111.toInt(); p.textSize = 36f; p.textAlign = android.graphics.Paint.Align.CENTER; p.isFakeBoldText = true
            c.drawText(sym, 32f, 45f, p)
            bmp.asImageBitmap()
        }
        val main = state("main")
        val hand = main.me.hand.ifEmpty { main.me.battlefield.filter { !it.isLand }.take(5) }
        val lifted = hand.first().copy(type = "Creature — Elf Druid", manaCost = "{1}{G}", text = "{T}: Add {G}.\n{2}{G}, {T}: Draw a card.")
        captureRoboImage(shot("w5-lifted-bottom-620x540")) {
            Box(Modifier.fillMaxSize().background(Color(0xFF0B0C10))) {
                MatchBottom(main, hand, lifted, PadAct("Pass") {}, { w -> HandFan(hand, w, Modifier.fillMaxWidth(), raised = lifted.id) }, {})
            }
        }
        dev.cardstashy.nativeplay.ui.homeArt = old
    }
}
