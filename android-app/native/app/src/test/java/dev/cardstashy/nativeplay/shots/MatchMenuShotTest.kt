package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.CONSOLE_ABOUT_MAX
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.MatchMenu
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.matchMenuActions
import dev.cardstashy.nativeplay.ui.matchMenuSettings
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The match menu in the Console look (Randall's pick of 14 Nov 2026): what you can do, and the six settings you reach for mid-game
 * (new: Settings could not be opened from a match). Drawn over a real table on a real map at a phone (844 x 390), the Fold
 * (884 x 796) and the Thor (top 960 x 540 with the menu on the bottom screen, 620 x 540).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class MatchMenuShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "console/match-menu-$name.png").path
    private val deck = listOf("Legion Warboss" to 2, "Goblin Guide" to 1, "Hill Giant" to 2, "Grizzly Bears" to 2, "Rancor" to 1, "Sol Ring" to 1, "Arcane Signet" to 1,
        "Loyal Apprentice" to 1, "Rampant Growth" to 1, "Mountain" to 14, "Forest" to 12)
    private val input = "{\"input\":{\"humanDeck\":{\"cards\":[" + deck.joinToString(",") { (n, q) -> "{\"name\":\"$n\",\"qty\":$q}" } + "]}}}"

    @After fun off() {
        DualScreen.pretend(null); dev.cardstashy.nativeplay.ui.Pad.forget(); dev.cardstashy.nativeplay.ui.Motion.still = false; CardImageTest.art = null
        AppSettings.applyMusicVolume(100); AppSettings.applyEffectsVolume(100); AppSettings.set("stopToRespond", false)
    }

    @Test fun overTheTable() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val mat = "ashen-forge"
        for (crop in listOf("", "-tall")) kotlinx.coroutines.runBlocking { dev.cardstashy.nativeplay.ui.Playmats.preload(RuntimeEnvironment.getApplication(), mat, crop) }
        AppSettings.applyMusicVolume(70)
        val st = state("crowded")
        val board: @androidx.compose.runtime.Composable (MatchMenu) -> Unit = { menu ->
            val anchors = remember { Anchors() }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(mat, Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {}, menu = menu)
                }
            }
        }
        for ((size, q) in listOf("phone-844x390" to "w844dp-h390dp-land-xxhdpi", "fold-884x796" to "w884dp-h796dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            val menu = MatchMenu(input, {}, {}).apply { open = true }
            captureRoboImage(shot(size)) { board(menu) }
        }
        // The Thor: the menu is the bottom screen, the table stays whole on top.
        DualScreen.pretend(DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f)); dev.cardstashy.nativeplay.ui.Pad.used()
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        val menu = MatchMenu(input, {}, {}).apply { open = true }
        RuntimeEnvironment.setQualifiers("w960dp-h540dp-land-xhdpi")
        captureRoboImage(shot("thor-top-960x540")) { board(menu) }
        RuntimeEnvironment.setQualifiers("w620dp-h540dp-xhdpi")
        // The table composes (measured at the top screen's size, not drawn) and the bottom screen shows what it put there.
        captureRoboImage(shot("thor-bottom-620x540")) {
            Box(Modifier.fillMaxSize()) {
                androidx.compose.ui.layout.Layout({ Box(Modifier.size(960.dp, 540.dp)) { board(menu) } }) { m, c -> m.forEach { it.measure(androidx.compose.ui.unit.Constraints()) }; layout(c.maxWidth, c.maxHeight) {} }
                Box(Modifier.fillMaxSize().background(Palette.Night)) { dev.cardstashy.nativeplay.ui.BottomRoot() }
            }
        }
    }

    /** The menu's lines: what each does when pressed, and that the settings are Settings' own lines. */
    @Test fun lines() {
        var conceded = 0; var left = 0
        val menu = MatchMenu(input, { conceded++ }, { left++ }).apply { open = true }
        fun act(id: String) = matchMenuActions(menu, 2).first { it.id == id }
        assertEquals(listOf("resume", "tracker", "history", "concede", "leave"), matchMenuActions(menu, 0).map { it.id })
        assertEquals("no deck list, no tracker line", listOf("resume", "history", "concede", "leave"), matchMenuActions(MatchMenu(null, {}, {}), 0).map { it.id })
        assertEquals("2 on the stack", act("history").valueText())
        act("resume").press(); assertFalse("Resume closes the menu", menu.open)
        // Showing the tracker or the history closes the menu so the table shows it; hiding leaves the menu open.
        menu.showTracker(null); menu.open = true; act("tracker").press(); assertEquals("deck", menu.tracker); assertFalse(menu.open)
        menu.open = true; assertEquals("On", act("tracker").valueText()); act("tracker").press(); assertEquals(null, menu.tracker); assertTrue(menu.open)
        act("history").press(); assertTrue(menu.history); assertFalse(menu.open)
        // Leaving a match always asks first: the line only raises the question.
        menu.open = true; act("concede").press(); assertEquals("concede", menu.ask); assertEquals(0, conceded); assertFalse(menu.open)
        menu.ask = null; act("leave").press(); assertEquals("leave", menu.ask); assertEquals(0, left)
        assertEquals(listOf("stop", "order", "tfx", "mfx", "music", "sfx"), matchMenuSettings().map { it.id })
        matchMenuSettings().first { it.id == "stop" }.press(); assertTrue("the menu's line is the setting itself", AppSettings.stopToRespond)
        matchMenuSettings().first { it.id == "music" }.step(-1); assertEquals(90, AppSettings.musicVolume)
        for (r in matchMenuActions(menu, 0) + matchMenuSettings()) assertTrue("${r.id}: ${r.about.length} characters", r.about.isNotBlank() && r.about.length <= CONSOLE_ABOUT_MAX)
    }
}
