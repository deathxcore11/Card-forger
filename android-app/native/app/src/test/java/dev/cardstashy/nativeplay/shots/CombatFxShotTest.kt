package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Table-feel spec 3, frame by frame: the overlay of a block, a clash and a face hit drawn over a still board. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class CombatFxShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    @Test fun frames() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val mine = st.me.battlefield.first { it.isCreature }; val theirs = st.cpu.battlefield.first { it.isCreature }
        fun item(kind: Fx, ms: Long, card: Int? = null, from: String? = null, to: String? = null, label: String = "", level: Int = 2, player: Int? = null, tone: Color = Color(0xFFFF5A4A), power: Float = 1f) =
            FxItem(kind, level, ms, card = card, fromKey = from, toKey = to, tone = tone, player = player, power = power).also { it.label = label; it.t0 = 0; it.dur = ms }
        val frames = listOf(
            Triple("block", listOf(item(Fx.BLOCK, 700, mine.id, "c${mine.id}", "c${theirs.id}")), 300L),
            Triple("clash", listOf(item(Fx.LUNGE, 800, theirs.id, to = "c${mine.id}", tone = Color(0xFFFF6A4A), power = .8f),
                FxItem(Fx.DAMAGE, 2, 1100, card = mine.id, tone = Color(0xFFFF5A4A), side = 1).also { it.label = "−3"; it.dur = 1100 },
                FxItem(Fx.DAMAGE, 2, 1100, card = theirs.id, tone = Color(0xFFFF5A4A), side = -1).also { it.label = "−2"; it.dur = 1100 }), 0L),
            // Staged combat (5 Nov): this pair lit, the rest of the board at half light, a gold line and the pair's tag.
            Triple("stage", listOf(FxItem(Fx.STAGE, 2, 1400, fromKey = "c${theirs.id}", toKey = "c${mine.id}", ids = setOf(theirs.id, mine.id))
                .also { it.label = "${theirs.name} ${theirs.power}/${theirs.toughness} blocked by ${mine.name} ${mine.power}/${mine.toughness}"; it.t0 = 0; it.dur = 1400 },
                item(Fx.LUNGE, 800, theirs.id, to = "c${mine.id}", tone = Color(0xFFFF6A4A), power = .8f)), 420L),
            Triple("face", listOf(item(Fx.LUNGE, 1100, theirs.id, to = "orb${st.viewer}", tone = Color(0xFFFF6A4A)),
                item(Fx.LIFE, 950, to = "orb${st.viewer}", label = "−4", level = 3, player = st.viewer, power = .8f)), 0L),
        )
        for ((name, items, at) in frames) {
            val fx = Battlefield()
            // Clash and face (P5 timings): 140 ms after the freeze ends; the damage and life items start as it ends.
            val face = items.any { it.kind == Fx.LIFE }; val lands = dev.cardstashy.nativeplay.ui.Strike.after(face).toLong()
            val now = if (at > 0) at else lands + 140
            items.forEach { if (it.kind == Fx.DAMAGE || it.kind == Fx.LIFE) it.t0 = lands }
            fx.items.addAll(items); fx.reindex(); fx.now.longValue = now
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            captureRoboImage(File(System.getProperty("shotsDir"), "table/fx-$name-844x390.png").path) {
                val anchors = remember { Anchors() }
                CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                        FxLayer(force = true)
                    }
                }
            }
        }
        CardImageTest.art = null
    }
}
