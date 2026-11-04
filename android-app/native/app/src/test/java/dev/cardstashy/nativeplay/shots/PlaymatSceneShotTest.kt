package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.performClick
import com.github.takahirom.roborazzi.captureScreenRoboImage
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.LobbyModel
import dev.cardstashy.nativeplay.ui.LobbyScreen
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.Playmats
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Every playmat's scene frozen at the same time as the web harness (web-mats.mjs pauses every CSS animation at T), wide
 * (the landscape table) and upright, plus the Practice head with the picker closed and open, Random and a chosen mat.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class PlaymatSceneShotTest {
    private val dir = File(System.getProperty("shotsDir"), "playmats").apply { mkdirs() }
    private val app get() = RuntimeEnvironment.getApplication()

    @Test fun scenes() {
        val t = (System.getenv("MAT_T") ?: "1.3").toFloat()
        Playmats.frozenAt = t
        for ((id, _) in Playmats.list(app)) for ((w, h) in listOf(844 to 390, 390 to 844)) {
            kotlinx.coroutines.runBlocking { Playmats.preload(app, id, h > w) }
            RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xhdpi")
            captureRoboImage(File(dir, "app-scene-$id-${w}x$h.png").path) { PlaymatScene(id, Modifier.fillMaxSize()) }
        }
        Playmats.frozenAt = null
    }

}
