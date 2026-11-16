package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.test.onRoot
import cardstashy.forge.LocalEngine
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.match.LocalSession
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.forgeInput
import dev.cardstashy.nativeplay.ui.TableScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.annotation.LooperMode
import java.io.File
import java.nio.file.Files
import java.util.concurrent.TimeUnit

/**
 * Randall 16 Nov on 0.4.86: "The game won't even load a match anymore, it just crashes" (after the coin toss, "CPU plays first").
 * The whole match screen (TableScreen with a real MatchController on the real engine) from the coin toss through the opening hand
 * and the first turns, on the phone and the Fold. Any throw while composing, measuring or drawing fails the test.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@LooperMode(LooperMode.Mode.PAUSED)
class MatchStartSmokeTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }

    private fun run(name: String) {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Mountain" to 24, "Goblin Guide" to 4, "Lightning Bolt" to 4, "Monastery Swiftspear" to 4, "Hill Giant" to 4, "Plains" to 10, "Savannah Lions" to 4, "Glory Seeker" to 4, "Pacifism" to 2)
        val cpu = deck("Island" to 24, "Swamp" to 12, "Memnite" to 4, "Opt" to 4, "Grizzly Bears" to 4, "Suntail Hawk" to 4, "Doom Blade" to 4, "Divination" to 4)
        val input = forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "second", quick = false, setup = null)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val c = MatchController(scope, input) { LocalSession(LocalEngine.start(input, 7L)) }
        rule.mainClock.autoAdvance = false
        rule.setContent { TableScreen(c, onHome = {}, onRematch = {}) }
        c.start()
        val shots = File(System.getProperty("shotsDir"), "match-start").apply { mkdirs() }
        var n = 0
        val until = System.currentTimeMillis() + 90_000
        while (System.currentTimeMillis() < until && (c.shown.value?.turn ?: 0) < 3) {
            rule.mainClock.advanceTimeBy(100); shadowOf(android.os.Looper.getMainLooper()).idleFor(100, TimeUnit.MILLISECONDS)
            Thread.sleep(20)
            if (++n % 100 == 0) println("SMOKE $name tick $n stage=${c.stage.value} turn=${c.shown.value?.turn} input=${c.shown.value?.inputType}")
        }
        println("SMOKE $name reached turn ${c.shown.value?.turn} stage=${c.stage.value} failure=${c.failure.value}")
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
    }

    @Config(sdk = [35], qualifiers = "w411dp-h891dp-land-xxhdpi") @Test fun phone() = run("phone")
    @Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi") @Test fun fold() = run("fold")
}
