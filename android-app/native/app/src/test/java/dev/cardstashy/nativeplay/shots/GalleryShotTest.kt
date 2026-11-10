package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.ui.Gallery
import dev.cardstashy.nativeplay.ui.GalleryLabel
import dev.cardstashy.nativeplay.ui.GalleryPiece
import dev.cardstashy.nativeplay.ui.GalleryWall
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** The Gallery (specs/thor-gallery-native.md) at the AYN Thor's sizes: the wall at 1920 × 1080 and the label at 1240 × 1080. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class GalleryShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun shot(name: String) = File(System.getProperty("shotsDir"), "dual/$name.png").path

    @Test fun wallAndLabel() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        // Three art crops already on disk for the table shots (626 × 457), stood in for the pieces' art.
        val crops = art.listFiles { f -> f.extension == "jpg" }!!.sortedBy { it.name }.filter { f ->
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(f.path, o); o.outWidth > o.outHeight }.take(3)
        dev.cardstashy.nativeplay.ui.homeArt = { u -> crops.firstOrNull { it.name == u }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } ?: u }
        // The labels are test words, not these pictures' real records: the shot shows the layout only.
        val pieces = listOf(
            GalleryPiece(crops[0].name, "Test piece one", "Test artist A", "Test set", "2026", "1", "A line of flavour text for the first piece."),
            GalleryPiece(crops[1].name, "Test piece two", "Test artist B", "Test set", "2026", "2", "This is *my* domain, and the marked word stands upright."),
            GalleryPiece(crops[2].name, "Test piece three", "Test artist A", "Test set", "2026", "3", null))
        val g = Gallery(pieces, 1)
        RuntimeEnvironment.setQualifiers("w960dp-h540dp-xhdpi")
        captureRoboImage(shot("gallery-wall-thor-1920x1080")) { GalleryWall(g, 1) }
        RuntimeEnvironment.setQualifiers("w620dp-h540dp-xhdpi")
        captureRoboImage(shot("gallery-label-thor-1240x1080")) { GalleryLabel(g, 1) {} }
        captureRoboImage(shot("gallery-label-one-piece-thor-1240x1080")) { GalleryLabel(Gallery(listOf(pieces[0])), 0) {} }
    }
}
