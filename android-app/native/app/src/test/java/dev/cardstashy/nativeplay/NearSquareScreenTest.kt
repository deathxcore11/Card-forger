package dev.cardstashy.nativeplay

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Recordings 19 Nov: the open Fold (about 1080 x 1200 px) was letterboxed by the sideways lock. Only such screens are unlocked. */
class NearSquareScreenTest {
    @Test fun onlyTheNearlySquareBigScreenIsUnlocked() {
        assertTrue("open Fold, portrait", nearSquareScreen(673, 673, 748))
        assertTrue("open Fold, letterboxed sideways", nearSquareScreen(607, 673, 607))
        assertFalse("phone", nearSquareScreen(390, 844, 390))
        assertFalse("Thor top screen (16:9)", nearSquareScreen(640, 1138, 640))
        assertFalse("tablet 16:10", nearSquareScreen(800, 1280, 800))
    }
}
