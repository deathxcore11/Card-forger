package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.AdventureGame
import dev.cardstashy.nativeplay.ui.AdventureHost
import dev.cardstashy.nativeplay.ui.AdventureProgress
import dev.cardstashy.nativeplay.ui.Adventures
import dev.cardstashy.nativeplay.ui.AdventuresHub
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.BottomRoot
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The Adventures hub on each shape: phone sideways, Fold inner, Thor top and bottom, upright phone; and with every game ready (the mock's three). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class AdventuresShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "adventures/$name.png").path
    @After fun off() { DualScreen.pretend(null); listOf("planeswalk", "lost-memories", "duel-summoner").forEach { Adventures.defaults().firstOrNull { d -> d.id == it }?.let(Adventures::register) } }

    private class Ready(override val id: String, override val name: String, override val style: String, override val blurb: String, override val accent: Long, private val p: AdventureProgress, private val line: String) : AdventureGame {
        override val art: String? = null; override val ready = true
        override fun state() = line; override fun progress() = p; override fun launch(host: AdventureHost) {}
    }
    /** The mock's three games, all ready, so the layouts show what they hold when the other two ship. Layout only: these numbers are the mock's samples. */
    private fun mockGames() {
        Adventures.register(Ready("planeswalk", "Planeswalk", "Map-climbing deck builder", "Climb the map and build a deck from Magic cards.", 0xFFD9482BL, AdventureProgress(6, 20), "Act 2, floor 6"))
        Adventures.register(Ready("lost-memories", "Lost Memories", "Card duelling roguelite", "Meld cards and descend the pyramid, one duel at a time.", 0xFFD9A441L, AdventureProgress(5, 20), "Run 2, floor 2"))
        Adventures.register(Ready("duel-summoner", "Duel Summoner", "Summoner survival run", "Run, jump and survive the swarm with summoned monsters.", 0xFF3FA89AL, AdventureProgress(7, 20), "Best 6:42"))
    }
    private val host = AdventureHost(web = {})

    private fun hub(name: String, q: String, dual: Boolean = false, all: Boolean = false) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers(q)
        if (all) mockGames()
        DualScreen.pretend(if (dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
        captureRoboImage(shot(name)) { AdventuresHub(Adventures.all(), host) {} }
        if (dual) captureRoboImage(shot("$name-bottom")) { Box(Modifier.fillMaxSize()) { AdventuresHub(Adventures.all(), host) {}; BottomRoot() } }
    }

    @Test fun phoneSideways() { hub("phone-844x390", "w844dp-h390dp-land-xxhdpi"); hub("phone-844x390-three", "w844dp-h390dp-land-xxhdpi", all = true) }
    @Test fun foldInner() { hub("fold-884x796", "w884dp-h796dp-xxhdpi"); hub("fold-884x796-three", "w884dp-h796dp-xxhdpi", all = true) }
    @Test fun thor() { hub("thor-960x540", "w960dp-h540dp-land-xhdpi", dual = true, all = true) }
    @Test fun upright() { hub("phone-390x844", "w390dp-h844dp-xxhdpi"); hub("phone-390x844-three", "w390dp-h844dp-xxhdpi", all = true) }
}
