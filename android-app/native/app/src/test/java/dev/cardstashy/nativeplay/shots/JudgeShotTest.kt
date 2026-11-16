package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.JudgeLine
import dev.cardstashy.nativeplay.ui.Site
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Ask a Judge's answers as the app draws them, from the answers the engine gave with the network refused (JudgeEngineTest writes judge-chat.json). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class JudgeShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")

    @Test fun answers() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val chat = home.resolve("judge-chat.json").takeIf { it.exists() }?.let { JsonParser.parseString(it.readText()).asJsonObject }
        assumeTrue("write the judge fixture first (JudgeEngineTest)", chat != null)
        val lines = chat!!.getAsJsonArray("lines").map { it.asJsonObject }
        // Question and answer pairs: 0 summoning sickness, 1 deathtouch and trample, 2 lifelink, 3 the miss.
        for ((name, from, to) in listOf(Triple("sickness", 0, 2), Triple("two-keywords", 2, 4), Triple("stack-and-miss", 4, 8))) {
            RuntimeEnvironment.setQualifiers("w390dp-h1100dp-xxhdpi")
            captureRoboImage(File(System.getProperty("shotsDir"), "judge-$name-390x1100.png").path) {
                Column(Modifier.fillMaxSize().background(Site.Bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    lines.subList(from, minOf(to, lines.size)).forEach { JudgeLine(it, false, {}, {}) }
                }
            }
        }
    }
}
