package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Picture for the eye (Randall's 19 Nov recording, Fold): the CPU's crowded creature row from the recording, most of it tapped.
 * Sideways tiles get room so they never cover a neighbour's name or P/T. Pictures in table-tapped-row.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
@org.junit.FixMethodOrder(org.junit.runners.MethodSorters.NAME_ASCENDING)
class TappedRowShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    // The recording's row, left to right, and which were sideways.
    private val row = listOf(Triple("Llanowar Elves", 1 to 1, true), Triple("Pawpatch Recruit", 2 to 1, false), Triple("Bejeweled Warg", 4 to 3, true),
        Triple("Llanowar Elves", 1 to 1, false), Triple("Pawpatch Recruit", 1 to 1, true), Triple("Elvish Mystic", 1 to 1, true),
        Triple("Bejeweled Warg", 4 to 3, false), Triple("Pawpatch Recruit", 2 to 1, true))
    private val n = (System.getenv("TAPPED_ROW") ?: "8").toInt()
    private fun state(): MatchState {
        val cpu = base.players.first { !it.isViewer }
        val cards = row.take(n).mapIndexed { i, (name, pt, tapped) -> Card(9000 + i, "Battlefield", cpu.id, cpu.id, false, name, "Creature", "{G}", "",
            pt.first, pt.second, tapped, false, false, 0, false, false, mapOf("P1P1" to i % 3).filterValues { it > 0 }, emptyList(), null, emptyList()) }
        val lands = cpu.battlefield.filter { it.isLand }
        return base.copy(players = base.players.map { if (it.id == cpu.id) it.copy(battlefield = lands + cards) else it })
    }
    private fun shot(name: String) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val st = state()
        rule.setContent { Box(Modifier.fillMaxSize().background(Palette.Night)) {
            ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}) } }
        rule.waitForIdle(); rule.mainClock.advanceTimeBy(3000); rule.waitForIdle()
        rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "table-tapped-row/$name.png").path)
    }
    @Config(qualifiers = "w720dp-h648dp-xhdpi") @Test fun a0warm() = shot("warm")
    @Config(qualifiers = "w720dp-h648dp-xhdpi") @Test fun b1fold() = shot(System.getenv("TAPPED_SHOT") ?: "fold")
}
