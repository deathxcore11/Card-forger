package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
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

/**
 * Table-feel spec 3 as filmstrips for the Table thread (no device recording here): a frame every 60 ms from trigger to
 * settle for a block, a clash whose blocker dies, and a face hit, at the timings the board uses (the clash's numbers and
 * the face's life start at contact; the death follows the hits group; life ticks 620 + 260 ms after the snapshot, 110 ms apart).
 * Frames go to shots/table/film/<effect>/NNNN.png; scripts stitch the contact sheets.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class CombatFilmstripTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private val step = (System.getProperty("filmStep") ?: "60").toLong()
    private val mat by lazy { dev.cardstashy.nativeplay.ui.Playmats.next(RuntimeEnvironment.getApplication()) }

    @Test fun filmstrips() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        val mine = st.me.battlefield.first { it.isCreature }; val theirs = st.cpu.battlefield.first { it.isCreature }
        val anchors = Anchors()
        val out = File(System.getProperty("shotsDir"), "table/film").apply { deleteRecursively(); mkdirs() }
        fun frame(file: File, state: MatchState, fx: Battlefield) = captureRoboImage(file.path) {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(mat, Modifier.fillMaxSize()) // one mat for every frame
                    ForgeBoard(state, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        // One still frame first, so every card's box is anchored (the dying blocker's last picture needs its box).
        frame(File(out, "warm.png"), st, Battlefield())
        val hit = (1700 * .36f).toLong()
        fun run(name: String, state: (Long) -> MatchState, items: () -> List<FxItem>) {
            val dir = File(out, name).apply { mkdirs() }
            val list = items(); val end = list.maxOf { it.t0 + it.dur } + 120
            var t = 0L; var i = 0
            while (t <= end) {
                val fx = Battlefield(); fx.items.addAll(list); fx.now.longValue = t
                dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
                frame(File(dir, "%04d-%05dms.png".format(i++, t)), state(t), fx)
                t += step
            }
        }
        run("block", { st }) {
            listOf(FxItem(Fx.BLOCK, 2, 1640, card = mine.id, fromKey = "c${mine.id}", toKey = "c${theirs.id}", tone = Color(0xFFFF5A4A)).also { it.t0 = 0 })
        }
        // The blocker dies: the new board no longer has it; its last picture (the ghost) holds until the shatter.
        val gone = st.copy(players = st.players.map { p -> if (p.id == st.viewer) p.copy(battlefield = p.battlefield.filter { it.id != mine.id }) else p })
        val box = anchors.rects["c${mine.id}"]!!
        run("clash-dies", { gone }) {
            listOf(
                FxItem(Fx.LUNGE, 2, 1700, card = theirs.id, toKey = "c${mine.id}", tone = Color(0xFFFF6A4A), power = .8f).also { it.t0 = 0 },
                FxItem(Fx.DAMAGE, 2, 1100, card = mine.id, tone = Color(0xFFFF5A4A), side = 1).also { it.label = "−3"; it.t0 = hit },
                FxItem(Fx.DAMAGE, 2, 1100, card = theirs.id, tone = Color(0xFFFF5A4A), side = -1).also { it.label = "−2"; it.t0 = hit },
                FxItem(Fx.DEATH, 2, 600, mine = true, from = box, toKey = "grave${mine.owner}", ghost = mine).also { it.t0 = hit + 1100 },
            )
        }
        val life = st.me.life
        // Medallion: 620 ms to the portrait, 260 ms more, then one point every 110 ms.
        fun lifeAt(t: Long) = life - (if (t < 880) 0 else minOf(4, ((t - 880) / 110 + 1).toInt()))
        run("face", { t -> st.copy(players = st.players.map { p -> if (p.id == st.viewer) p.copy(life = lifeAt(t)) else p }) }) {
            listOf(
                FxItem(Fx.LUNGE, 2, 1700, card = theirs.id, toKey = "orb${st.viewer}", tone = Color(0xFFFF6A4A)).also { it.t0 = 0 },
                FxItem(Fx.LIFE, 3, 950, toKey = "orb${st.viewer}", tone = Color(0xFFFF5A4A), player = st.viewer, power = .8f).also { it.label = "−4"; it.t0 = hit },
            )
        }
        CardImageTest.art = null
    }
}
