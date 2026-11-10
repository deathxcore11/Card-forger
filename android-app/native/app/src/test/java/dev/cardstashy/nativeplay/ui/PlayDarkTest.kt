package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/** Play is always dark (Randall 10 Nov): under a Light setting the Play palette is the dark one, Collection's the light one. */
class PlayDarkTest {
    @Test fun playPaletteIsDarkUnderALightSetting() {
        try {
            AppSettings.applyTheme("dark"); AppSettings.playSide = { true }
            val darkBg = Site.Bg; val darkText = Site.Text; val darkBar = Rule.Color.Bar
            AppSettings.applyTheme("light")
            assertEquals("dark", AppSettings.theme); assertEquals("light", AppSettings.chosenTheme)
            assertEquals(darkBg, Site.Bg); assertEquals(darkText, Site.Text)
            // What sheets, toasts and the bottom screen draw on reads the same palette.
            assertEquals(darkBar, Rule.Color.Bar); assertEquals(darkBg, Rule.Color.Bg)
            AppSettings.playSide = { false }
            assertEquals("light", AppSettings.theme); assertNotEquals(darkBg, Site.Bg)
            // Aura is a dark look of its own and stays.
            AppSettings.applyTheme("aura"); AppSettings.playSide = { true }
            assertEquals("aura", AppSettings.theme)
        } finally { AppSettings.applyTheme("dark"); AppSettings.playSide = { false } }
    }
}
