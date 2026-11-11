package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import dev.cardstashy.nativeplay.engine.MatchState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Match sound pass 8d (specs/match-sound-brief.md). S3: the gold button sounds `ui_gold` as it is pressed (by finger or the
 * controller's X), dips 4 % and gleams for 140 ms; the small buttons sound `ui_soft`. S2: the first time a player's life shows
 * 5 or less the pill beats red twice with `low_life`, once a game for each player.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w844dp-h390dp-land-xxhdpi")
class SoundButtonsLifeTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }
    private val was = Motion.still
    @After fun back() { Motion.still = was }
    private val heard = mutableListOf<String>()

    @Test fun theGoldButtonAndTheSmallOnesSoundTheirPress() {
        Motion.still = true
        var gold = 0; var keep = 0; var quiet = 0
        rule.setContent {
            CompositionLocalProvider(LocalTableCue provides { id, _, _ -> heard += id }) {
                Column {
                    GoldPill("Next", true, Modifier, Du(1f)) { gold++ }
                    GoldPill("Keep", true, Modifier, Du(1f), press = null) { keep++ }
                    GlassPill("Cancel", true, Modifier, Du(1f)) { quiet++ }
                }
            }
        }
        rule.onNodeWithText("Next").performClick(); rule.waitForIdle()
        assertEquals(1, gold); assertEquals("once, though two gold buttons are on screen", listOf("ui_gold"), heard)
        // The controller's X: the same press on the button.
        rule.runOnUiThread { GoldPress.pulse.intValue++ }; rule.waitForIdle()
        assertEquals(listOf("ui_gold", "ui_gold"), heard)
        // Keep has its own sound: the button adds none.
        rule.onNodeWithText("Keep").performClick(); rule.waitForIdle()
        assertEquals(1, keep); assertEquals(3, heard.size)
        rule.onNodeWithText("Cancel").performClick(); rule.waitForIdle()
        assertEquals(1, quiet); assertEquals("ui_soft", heard.last())
        // The dip: 4 % down half way through its 140 ms, full size at both ends.
        assertEquals(140, GOLD_PRESS_MS); assertEquals(1f, goldDip(0f), 0f); assertEquals(1f, goldDip(1f), 0f); assertEquals(.96f, goldDip(.5f), .0001f)
        assertTrue(goldDip(.25f) in .96f..1f)
    }

    @Test fun lowLifeWarnsOnceForEachPlayer() {
        Motion.still = true
        fun at(life: Int) = MatchState.parse("""{"status":"running","viewer":1,"turn":3,"revision":1,"players":[{"id":1,"isViewer":true,"life":20,"zones":{}},{"id":2,"life":$life,"zones":{}}]}""")!!.cpu
        var p by mutableStateOf(at(6)); var again by mutableStateOf(false)
        val fx = Battlefield()
        rule.setContent {
            CompositionLocalProvider(LocalTableCue provides { id, _, _ -> heard += id }, LocalBattlefield provides fx) {
                if (!again) Medallion(p, mine = false, pickable = false, picked = false, modifier = Modifier, d = Du(1f)) {}
                else Medallion(p, mine = false, pickable = false, picked = false, modifier = Modifier, d = Du(1f)) {}
            }
        }
        rule.waitForIdle(); assertTrue("6 is not low", heard.isEmpty())
        p = at(5); rule.waitForIdle()
        assertEquals(listOf("CMB-019"), heard)
        p = at(3); rule.waitForIdle(); p = at(9); rule.waitForIdle(); p = at(4); rule.waitForIdle()
        assertEquals("once a game, even after climbing back", listOf("CMB-019"), heard)
        // The square drawn afresh (another layout) does not warn again.
        again = true; rule.waitForIdle()
        assertEquals(1, heard.size)
        assertEquals(5, LOW_LIFE); assertEquals(220, LOW_BEAT_MS)
    }
}
