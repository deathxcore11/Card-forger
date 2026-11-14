package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.askParts
import dev.cardstashy.nativeplay.ui.handTucked
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T6 (fault 21): while you pick a target the hand dips and fades, the question (the asking card's name in the aim colour,
 * then what to do) is one glass line in the strip it freed, and the gold button gives way to a quiet Cancel. At every one-screen
 * size the line never meets your tool row, your mana row, your seat or any button, and stays on screen; at 844 × 390 it is whole.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookT6ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); dev.cardstashy.nativeplay.art.CardImageTest.art = { _, _ -> null } }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!
    private fun apart(a: Rect, b: Rect) = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top

    @Test fun theQuestionSplitsIntoTheAskingCardAndWhatToDo() {
        val t = state("targets")
        assertEquals(dev.cardstashy.nativeplay.ui.AskParts("Lightning Bolt", "Choose any target."), askParts(t))
        assertTrue(handTucked(t, live = true))
        assertFalse("not while it is not yours to answer", handTucked(t, live = false))
        // Blocks keep their own buttons; a board with no question, the opening hand and a crowded stack do not tuck.
        for (s in listOf("block", "realblock", "main", "opening", "crowded")) assertFalse(s, handTucked(state(s), live = true))
        // A long "for <card>" ask moves the name out of the question.
        val long = t.copy(message = "Select targets for Sheltered by Ghosts\nSheltered by Ghosts - Choose target nonland permanent an opponent controls")
        assertEquals("Sheltered by Ghosts", askParts(long)!!.name)
    }

    @Test fun theLineNeverMeetsAButtonAtAnySize() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        val t = state("targets")
        val long = t.copy(message = "Select targets for Sheltered by Ghosts\nChoose target nonland permanent an opponent controls with mana value 2 or less")
        val sizes = listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "904x386" to "w904dp-h386dp-land-xxhdpi", "884x796" to "w884dp-h796dp-land-xhdpi",
            "1280x800" to "w1280dp-h800dp-land-mdpi", "1920x1080" to "w1920dp-h1080dp-land-mdpi", "960x540" to "w960dp-h540dp-land-xhdpi", "640x360" to "w640dp-h360dp-land-xhdpi")
        for ((size, q) in sizes) for ((name, st) in listOf("targets" to t, "long" to long)) {
            RuntimeEnvironment.setQualifiers(q)
            val anchors = Anchors()
            captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t6-$name-$size.png").path) {
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    }
                }
            }
            val r = anchors.rects
            val line = r["askline"]; assertNotNull("$size $name: the line", line); line!!
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            assertTrue("$size $name on screen: $line", line.left >= 0f && line.top >= 0f && line.right <= dm.widthPixels && line.bottom <= dm.heightPixels)
            // The gold button gave way; Cancel is there.
            assertNull("$size $name: no gold button", r["gold"]); assertNotNull("$size $name: Cancel", r["cancel"])
            for (k in listOf("tools", "tray2", "cancel", "confirm", "undo", "buttonRow", "orb${st.viewer}")) r[k]?.let { b ->
                assertTrue("$size $name: the line $line meets $k $b", apart(line, b)) }
            // One line: about one line of 14 sp text plus its padding (never two).
            assertTrue("$size $name: one line, ${line.height / dm.density} dp", line.height / dm.density < 40f)
            if (size == "844x390" && name == "targets") assertFalse("844x390: whole", r.containsKey("askline.cut"))
        }
    }
}
