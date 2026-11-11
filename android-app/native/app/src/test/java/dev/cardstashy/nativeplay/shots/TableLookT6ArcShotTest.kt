package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableAim
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T6 (the arc), pictures: Lightning Bolt asking for a target with the ring on a creature (the gold arc to it, the picked one
 * kept), the CPU's Counterspell keeping its coral thread and rim through the question, and the board once the question is gone.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookT6ArcShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-targets.json")!!.readText())!!
    private val countered = base.copy(stack = base.stack.map { it.copy(targets = listOf(Ref("card", 123, null))) })

    @After fun off() { TableAim.key = null }

    private fun draw(anchors: Anchors, st: MatchState, file: String) =
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path) {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                }
            }
        }

    @Test fun theArcFollowsTheRing() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        for ((size, q) in listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            val anchors = Anchors()
            // Laid out once, so every end of every thread has its place (a capture is one composition).
            draw(anchors, countered, "t6-arc-board-$size")
            for (aim in listOf("c107", "c123", "orb${base.players.first { it.id != base.viewer }.id}")) {
                TableAim.key = aim
                draw(anchors, countered, "t6-arc-$aim-$size")
                assertNotNull("$size: the arc's ends ($aim)", anchors.rects[aim])
            }
            assertNotNull("$size: the cast card", anchors.rects["owncast"])
            assertNotNull("$size: the stack card", anchors.rects["stackcard"])
            TableAim.key = null
            draw(anchors, countered.copy(inputType = null, message = "", selection = countered.selection.copy(chosenCards = emptySet())), "t6-arc-after-$size")
        }
    }
}
