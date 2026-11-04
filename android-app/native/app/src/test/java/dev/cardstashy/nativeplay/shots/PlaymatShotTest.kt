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
class PlaymatShotTest {
    @get:Rule val compose = createComposeRule()
    private val dir = File(System.getProperty("shotsDir"), "playmats").apply { mkdirs() }
    private val app get() = RuntimeEnvironment.getApplication()

    private fun lobby(choice: String, open: Boolean) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers("w390dp-h844dp-xhdpi")
        Playmats.setChoice(app, choice)
        kotlinx.coroutines.runBlocking { Playmats.list(app).forEach { dev.cardstashy.nativeplay.ui.AssetImages.load(app, "play/playmat-${it.first}-thumb.webp") } }
        compose.setContent { LobbyScreen(LobbyModel("practice").apply { format = "Standard" }, {}, {}, {}, {}, {}, online = false) }
        if (open) compose.onNode(androidx.compose.ui.test.SemanticsMatcher("click label") { (if (androidx.compose.ui.semantics.SemanticsActions.OnClick in it.config) it.config[androidx.compose.ui.semantics.SemanticsActions.OnClick].label else null) == "Change playmat" }).performClick()
        compose.waitForIdle()
        captureScreenRoboImage(File(dir, "app-lobby-$choice-${if (open) "open" else "closed"}-390.png").path)
    }
    @Test fun lobbyRandom() = lobby("rotate", false)
    @Test fun lobbyRandomOpen() = lobby("rotate", true)
    @Test fun lobbyChosen() = lobby("ashen-forge", false)
    @Test fun lobbyChosenOpen() = lobby("ashen-forge", true)
}
