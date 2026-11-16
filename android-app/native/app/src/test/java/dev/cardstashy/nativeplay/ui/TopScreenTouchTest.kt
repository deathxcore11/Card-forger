package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Randall 10 Nov, live 0.4.57 on the Thor: with a card view open on the top screen, taps on its text opened the grid card behind it
 * and a tap low right opened the Trophies tab. A [TopScreen] view now covers the app for touch; its own buttons still work.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class TopScreenTouchTest {
    @get:Rule val rule = createComposeRule()

    private var tile = 0; private var tab = 0; private var own = 0
    private var open by mutableStateOf(true)

    private fun show() {
        rule.setContent {
            Box(Modifier.fillMaxSize()) {
                // The app behind: a grid tile top left, a tab bottom right.
                Box(Modifier.fillMaxSize()) {
                    Box(Modifier.offset(20.dp, 20.dp).size(200.dp, 200.dp).clickable { tile++ })
                    Box(Modifier.align(Alignment.BottomEnd).size(160.dp, 60.dp).clickable { tab++ })
                }
                // A card view the way DualTop draws one: a background and text with no touch handler, and one button of its own.
                if (open) TopScreen {
                    Box(Modifier.fillMaxSize().background(Color.Black)) {
                        Text("The card", Modifier.offset(40.dp, 60.dp))
                        Box(Modifier.align(Alignment.Center).size(120.dp, 60.dp).clickable { own++ })
                    }
                }
                TopScreenHost()
            }
        }
        rule.waitForIdle()
    }

    private fun tapAt(xDp: Float, yDp: Float) {
        rule.onRoot().performTouchInput { click(Offset(xDp * density, yDp * density)) }
        rule.waitForIdle()
    }

    @Test fun tapsOnTheCardViewNeverReachTheAppBehind() {
        show()
        tapAt(100f, 100f)            // over the grid tile, on the card view's text and background
        tapAt(940f, 520f)            // over the Trophies tab
        assertEquals(0, tile); assertEquals(0, tab)
    }

    @Test fun theCardViewsOwnButtonStillWorksWithARealFinger() {
        show()
        // A real finger moves a little between down and up: the button must still take the tap.
        rule.onRoot().performTouchInput { val c = Offset(480f * density, 270f * density); down(c); moveBy(Offset(1f, 1f)); up() }
        rule.waitForIdle()
        assertEquals(1, own); assertEquals(0, tile)
    }

    @Test fun withTheViewClosedTheAppTakesTapsAgain() {
        show()
        open = false; rule.waitForIdle()
        tapAt(100f, 100f); tapAt(940f, 520f)
        assertEquals(1, tile); assertEquals(1, tab)
    }
}
