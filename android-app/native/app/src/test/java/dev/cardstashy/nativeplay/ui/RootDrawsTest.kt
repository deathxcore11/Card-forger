package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/** Collection home, lighter C6: the count of whole-app redraws that goes to the log. */
class RootDrawsTest {
    @Before fun start() = RootDraws.resetForTest()

    @Test fun oneLineForEachWindowWithItsCount() {
        var line: String? = null
        // 120 frames a second for a little over five seconds.
        for (i in 0..600) { val l = RootDraws.tick(1000L + i * 25L / 3L, "Collection home"); if (l != null) { line = l; break } }
        assertEquals("app layer recorded 601 times in 5.0 s on Collection home", line)
        assertNull("a new window starts empty", RootDraws.tick(9_000L, "Collection home"))
    }

    @Test fun aQuietPageWritesWhenItsNextDrawComes() {
        assertNull(RootDraws.tick(0L, "Play home"))
        assertEquals("app layer recorded 2 times in 60.0 s on Play home", RootDraws.tick(60_000L, "Play home"))
    }
}
