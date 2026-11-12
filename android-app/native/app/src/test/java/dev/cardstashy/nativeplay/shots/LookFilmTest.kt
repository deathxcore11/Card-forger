package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.FxItem
import dev.cardstashy.nativeplay.ui.FxLayer
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.LocalBattlefield
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.Strike
import dev.cardstashy.nativeplay.ui.TableEmotes
import dev.cardstashy.nativeplay.ui.TableFeel
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.lifeGap
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The design's film: an effect drawn frame by frame on the board's own clock (a frame every 16 ms, as the screen draws it, so the
 * sparks a frame throws are the ones the next frame shows), to lay beside the approved preview. It is for the eye and checks
 * nothing, so it runs only when asked: LOOK_FILM=charge-face (or charge-clash, or all). Frames go to shots/film/<name>/NNN-MMMMms.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xhdpi")
class LookFilmTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val want = System.getenv("LOOK_FILM").orEmpty()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
    private var st by mutableStateOf(base)
    private val fx = Battlefield()
    private val anchors = Anchors()

    @After fun back() { AppSettings.applyMatchEffects("full"); TableFeel.mat = null }

    private fun board(mat: String = "charcoal-table") {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        TableEmotes.destroy()
        TableFeel.mat = mat
        rule.setContent {
            CompositionLocalProvider(LocalAnchors provides anchors, LocalBattlefield provides fx) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(mat, Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    FxLayer(force = true)
                }
            }
        }
        rule.waitForIdle()
    }

    /** [items] started now and filmed to [endMs], the board changing as [state] says. */
    private fun film(name: String, items: List<FxItem>, endMs: Long, state: (Long) -> MatchState = { base }) {
        val dir = File(System.getProperty("shotsDir"), "film/$name").apply { deleteRecursively(); mkdirs() }
        var t0 = 0L
        rule.runOnUiThread { fx.skip(); t0 = fx.now.longValue; items.forEach { it.t0 += t0; it.dur = it.baseMs }; fx.items.addAll(items); fx.reindex() }
        var i = 0; var ms = 0L
        while (ms <= endMs) {
            rule.runOnUiThread { st = state(ms); fx.now.longValue = t0 + ms }
            rule.waitForIdle()
            rule.onRoot().captureRoboImage(File(dir, "%03d-%04dms.png".format(i++, ms)).path)
            ms += 16
        }
        rule.runOnUiThread { fx.skip(); st = base }
        rule.waitForIdle()
    }

    private fun lose(st: MatchState, player: Int, n: Int) = st.copy(players = st.players.map { p -> if (p.id == player) p.copy(life = p.life - n) else p })

    @Test fun chargeAtAPlayer() {
        assumeTrue(want == "all" || want == "charge-face")
        board()
        val mine = base.me.battlefield.first { it.isCreature }
        val after = Strike.after(true).toLong(); val gap = lifeGap(3)
        film("charge-face", listOf(
            FxItem(Fx.LUNGE, 2, Strike.FACE_MS, card = mine.id, mine = true, toKey = "orb${base.cpu.id}", tone = TableFeel.chargeTone(mine)),
            FxItem(Fx.LIFE, 3, 950, player = base.cpu.id, toKey = "orb${base.cpu.id}", tone = Color(0xFFFF5A4A), power = .5f).also { it.label = "−3"; it.points = 3; it.t0 = after },
        ), after + 950) { ms -> lose(base, base.cpu.id, if (ms < after) 0 else minOf(3, ((ms - after) / gap + 1).toInt())) }
    }

    @Test fun heavyLanding() {
        assumeTrue(want == "all" || want == "heavy")
        board("ashen-forge")
        val bears = base.me.battlefield.first { it.isCreature && it.id != base.me.battlefield.first { c -> c.isCreature }.id }
        val others = base.me.battlefield.map { it.id }.filter { it != bears.id }.toSet()
        film("heavy", listOf(FxItem(Fx.HEAVY, 1, (TableFeel.HEAVY_DROP_MS + TableFeel.HEAVY_AFTER_MS).toLong(), card = bears.id, mine = true,
            tone = dev.cardstashy.nativeplay.ui.frameTone(dev.cardstashy.nativeplay.ui.cardColors(bears)).first, ids = others, note = TableFeel.profile("ashen-forge").mark)), 900)
    }

    @Test fun winningHit() {
        assumeTrue(want == "all" || want == "win")
        board("ashen-forge")
        val look = TableFeel.profile("ashen-forge")
        film("win", listOf(FxItem(Fx.WIN, 2, TableFeel.WIN_HOLD_MS, player = base.cpu.id, mine = true, toKey = "orb${base.cpu.id}", tone = look.win, caster = look.winHi, ids = base.players.map { it.id }.toSet())), 1800)
    }

    /** A burn spell at a player: the streak off the stack (240 ms), then the life loss. [you]: at you, with the red edges. */
    private fun burn(name: String, you: Boolean) {
        board()
        val who = if (you) base.viewer else base.cpu.id
        val dp = anchors.rects.getValue("orb$who").let { rule.activity.resources.displayMetrics.density }
        val stack = androidx.compose.ui.geometry.Rect(760 * dp, 150 * dp, 830 * dp, 240 * dp)
        film(name, listOf(
            FxItem(Fx.FIRE, 2, dev.cardstashy.nativeplay.ui.FIRE_MS, mine = !you, from = stack, toKey = "orb$who", tone = Color(0xFFE8604A)),
            FxItem(Fx.LIFE, 3, 950, player = who, toKey = "orb$who", tone = Color(0xFFFF5A4A), power = .5f).also { it.label = "−3"; it.points = 3; it.t0 = dev.cardstashy.nativeplay.ui.FIRE_MS },
        ), dev.cardstashy.nativeplay.ui.FIRE_MS + 950) { ms -> lose(base, who, if (ms < 240) 0 else minOf(3, ((ms - 240) / lifeGap(3) + 1).toInt())) }
    }
    @Test fun burnAtTheCpu() { assumeTrue(want == "all" || want == "burn-cpu"); burn("burn-cpu", false) }
    @Test fun burnAtYou() { assumeTrue(want == "all" || want == "burn-you"); burn("burn-you", true) }

    @Test fun chargeAtABlocker() {
        assumeTrue(want == "all" || want == "charge-clash")
        board()
        val mine = base.me.battlefield.first { it.isCreature }; val theirs = base.cpu.battlefield.first { it.isCreature }
        val after = Strike.after(false).toLong()
        film("charge-clash", listOf(
            FxItem(Fx.LUNGE, 2, Strike.CLASH_MS, card = mine.id, mine = true, toKey = "c${theirs.id}", tone = TableFeel.chargeTone(mine), power = .8f),
            FxItem(Fx.DAMAGE, 2, 1100, card = theirs.id, tone = Color(0xFFFF5A4A), side = -1).also { it.label = "−3"; it.t0 = after },
            FxItem(Fx.DAMAGE, 2, 1100, card = mine.id, tone = Color(0xFFFF5A4A), side = 1).also { it.label = "−2"; it.t0 = after },
        ), Strike.CLASH_MS + 200)
    }
}
