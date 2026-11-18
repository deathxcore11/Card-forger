package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Pack finish brief C, scan saves (review of b47850f7). Traced: the scanner's save is scanAddMany in the Collection engine, whose
 * commit carries undo "Added <n> · <location>" (collection-engine.js mtgScanAddMany), pushed as a toast with Undo; CollectionWrites
 * shows it and calls Fly.added. With no bottom bar (the scanner), the tile flies to the save bar's Trunk mark with its count.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class ScanFlyTest {
    @get:Rule val rule = createComposeRule()

    @Test fun aScanSaveStartsOneFlight() {
        Motion.still = false; Fly.off = false; Fly.reduced = false; Fly.flights.clear()
        rule.mainClock.autoAdvance = false
        rule.setContent { Box { Column { Box(Modifier.size(100.dp, 140.dp).flySource { Box(it) }); Box(Modifier.size(24.dp).flyTarget(Fly.SAVE_MARK)) }; FlyLayer() } }
        rule.mainClock.advanceTimeByFrame()
        Fly.added("Added 3 · Collection")
        shadowOf(android.os.Looper.getMainLooper()).idle()
        assertEquals(1, Fly.flights.size)
        assertEquals(3, Fly.flights.single().count)
        assertEquals(Fly.SAVE_MARK, Fly.flights.single().to)
        // The copy lands: one landing on the save bar's mark, and the flight is gone.
        val before = Fly.landed(Fly.SAVE_MARK)
        rule.mainClock.advanceTimeBy(1200); rule.waitForIdle()
        assertEquals(0, Fly.flights.size)
        assertEquals(before + 1, Fly.landed(Fly.SAVE_MARK))
    }
}
