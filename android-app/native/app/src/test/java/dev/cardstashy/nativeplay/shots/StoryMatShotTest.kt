package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.Playmats
import dev.cardstashy.nativeplay.ui.StoryMats
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Story playmats (MOTION-SPEC.md) at the spec's check sizes: phone landscape, phone upright, open Fold and tablet, frozen at
 * one time per Effects level; and with STORY_FRAMES set, a frame sequence per mat for the motion preview.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class StoryMatShotTest {
    private val dir = File(System.getProperty("shotsDir"), "story-mats").apply { mkdirs() }
    private val app get() = RuntimeEnvironment.getApplication()

    private fun crop(w: Int, h: Int) = if (w.toFloat() / h in .68f..1f) "-fold" else if (h >= w) "-tall" else ""

    @Test fun sizes() {
        AppSettings.init(app)
        for (level in listOf("balanced", "cinematic", "minimal")) {
            AppSettings.applyEffects(level)
            Playmats.frozenAt = 3.1f
            for (id in StoryMats.all(app).keys) for ((w, h) in listOf(844 to 390, 390 to 844, 884 to 1104, 1024 to 768)) {
                if (level != "balanced" && w != 844) continue
                kotlinx.coroutines.runBlocking { Playmats.preload(app, id, crop(w, h)) }
                RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-mdpi")
                captureRoboImage(File(dir, "$id-$level-${w}x$h.png").path) { PlaymatScene(id, Modifier.fillMaxSize()) }
            }
        }
        Playmats.frozenAt = null; AppSettings.applyEffects("balanced")
    }

    @Test fun frames() {
        val n = System.getenv("STORY_FRAMES")?.toIntOrNull() ?: return
        AppSettings.init(app); AppSettings.applyEffects(System.getenv("STORY_LEVEL") ?: "cinematic")
        val (w, h) = 844 to 390
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-mdpi")
        for (id in StoryMats.all(app).keys) {
            kotlinx.coroutines.runBlocking { Playmats.preload(app, id, "") }
            for (f in 0 until n) {
                Playmats.frozenAt = 2f + f * ((System.getenv("STORY_STEP") ?: ".1").toFloat())
                captureRoboImage(File(dir, "frames/$id-%03d.png".format(f)).path) { PlaymatScene(id, Modifier.fillMaxSize()) }
            }
        }
        Playmats.frozenAt = null; AppSettings.applyEffects("balanced")
    }
}
