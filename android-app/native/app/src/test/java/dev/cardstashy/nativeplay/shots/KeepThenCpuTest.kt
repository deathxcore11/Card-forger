package dev.cardstashy.nativeplay.shots

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.match.LocalSession
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.Stage
import dev.cardstashy.nativeplay.match.forgeInput
import dev.cardstashy.nativeplay.ui.TableScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertTrue
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
 * Randall's 19 Nov recording of 0.4.98 (Quick Play, the CPU first): he tapped Keep and the first table frame already had the
 * CPU's Mountain down, its hand at 6, before "Turn 1 · CPU goes first" and with no play shown. Here: a real match on the real
 * engine with the CPU first; after Keep, nothing of the CPU's may be on the drawn table until the opening has been told (the
 * table is PLAYING and the turn 1 banner has shown).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@LooperMode(LooperMode.Mode.PAUSED)
class KeepThenCpuTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }

    @Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi") @Test fun cpuFirstShowsNothingBeforeTheOpeningIsTold() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Mountain" to 24, "Goblin Guide" to 4, "Lightning Bolt" to 4, "Monastery Swiftspear" to 4, "Hill Giant" to 4, "Plains" to 10, "Savannah Lions" to 4, "Glory Seeker" to 4, "Pacifism" to 2)
        // The decks MatchStartSmokeTest plays (Forge admits them); 36 of the CPU's 60 are lands, and the deal is seeded.
        val cpu = deck("Island" to 24, "Swamp" to 12, "Memnite" to 4, "Opt" to 4, "Grizzly Bears" to 4, "Suntail Hawk" to 4, "Doom Blade" to 4, "Divination" to 4)
        val input = forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "second", quick = false, setup = null)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val c = MatchController(scope, input) { LocalSession(LocalEngine.start(input, 7L)) }
        rule.mainClock.autoAdvance = false
        rule.setContent { TableScreen(c, onHome = {}, onRematch = {}) }
        c.start()
        var kept = false; var bannerSeen = false; var early: String? = null; var cpuSeen = false; var mullTicks = 0
        val until = System.currentTimeMillis() + 120_000
        while (System.currentTimeMillis() < until && !cpuSeen) {
            rule.mainClock.advanceTimeBy(50); shadowOf(android.os.Looper.getMainLooper()).idleFor(50, TimeUnit.MILLISECONDS)
            Thread.sleep(10)
            val st = c.shown.value; val stage = c.stage.value
            if (c.banner.value != null) bannerSeen = true
            if (!kept && stage == Stage.MULLIGAN && c.live.value && ++mullTicks > 20) { c.ok(); kept = true }
            // After Keep the opening is the pacing loop's to draw: until the table is PLAYING the drawn board stays the keep's own.
            if (kept && early == null && st != null && stage != Stage.PLAYING && stage != Stage.FINISHED && !st.isMulligan)
                early = "a board past the keep (rev=${st.revision} turn=${st.turn} input=${st.inputType}) was drawn at stage=$stage, before the opening was told"
            val cpuSide = runCatching { st?.cpu?.battlefield?.size }.getOrNull() ?: 0
            if (kept && cpuSide > 0) {
                cpuSeen = true
                if (stage != Stage.PLAYING || !bannerSeen) early = "CPU has $cpuSide on the table at stage=$stage bannerSeen=$bannerSeen rev=${st?.revision} turn=${st?.turn} cpuHand=${runCatching { st?.cpu?.handCount }.getOrNull()}"
            }
        }
        println("KEEPTHENCPU kept=$kept cpuSeen=$cpuSeen bannerSeen=$bannerSeen early=$early stage=${c.stage.value} failure=${c.failure.value}")
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        assertTrue("Keep was never pressed (the keep screen never went live)", kept)
        assertTrue("The CPU's first land never reached the table in 120 s", cpuSeen)
        assertTrue(early ?: "", early == null)
    }
}
