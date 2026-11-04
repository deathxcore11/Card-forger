package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DecisionDock
import dev.cardstashy.nativeplay.ui.DockReplies
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
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
 * The decision dock over the table, on the site's own prompt boards (table-fixture.html ?state=triggers / search / kicker,
 * exported by scratchpad site/dockshots.mjs) and on the main board with a synthetic prompt for each other kind
 * (scratchpad dock/prompts, the same prompts site/dockprobe.mjs injects into the fixture): at phone landscape, 844 × 390.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class DecisionDockShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private val missing = java.util.TreeSet<String>()
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @Test fun prompts() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop ->
            val f = art.resolve(key(name, crop) + ".jpg")
            if (f.exists()) BitmapFactory.decodeFile(f.path)?.asImageBitmap() else { missing += "$name|$crop"; null }
        }
        val boards = listOf("triggers", "search", "kicker") +
            listOf("assign", "choice", "confirm", "costs", "input", "inputopts", "reveal", "search2", "unsupported").map { "dock-$it" }
        RuntimeEnvironment.setQualifiers("w844dp-h390dp-land-xxhdpi")
        for (b in boards) {
            val st = state(b)
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            if (b == "kicker") dev.cardstashy.nativeplay.ui.TableEmotes.say("cpu", "Good luck, have fun.")
            captureRoboImage(File(System.getProperty("shotsDir"), "table/dock-$b-844x390.png").path) {
                val anchors = remember { Anchors() }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    BoxWithConstraints(Modifier.fillMaxSize().background(Palette.Night)) {
                        val u = minOf(maxWidth.value / 844f, maxHeight.value / 390f)
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                        DecisionDock(st, live = true, intents = TableIntents(), onInspect = {}, u = u, replies = DockReplies(skipAmounts = {}))
                    }
                }
            }
        }
        art.mkdirs(); art.resolve("missing-dock.txt").writeText(missing.joinToString("\n"))
        CardImageTest.art = null
    }
}
