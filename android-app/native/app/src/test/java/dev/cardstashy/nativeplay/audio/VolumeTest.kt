package dev.cardstashy.nativeplay.audio

import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.ConsoleCtl
import dev.cardstashy.nativeplay.ui.rows
import dev.cardstashy.nativeplay.ui.soundItems
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Music volume and Effects volume (Console Settings, 14 Nov 2026): 0 to 100 in tens, kept on the device, and 100 is exactly the
 * loudness the app had before the settings existed. Sound's two lines move them, and stand still while their sound is off.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class VolumeTest {
    private val context get() = RuntimeEnvironment.getApplication()
    @After fun back() { AppSettings.applyMusicVolume(100); AppSettings.applyEffectsVolume(100); AppSettings.set("packSound", true); AppSettings.set("appSounds", true) }

    @Test fun fullIsTheLoudnessItAlwaysHad() {
        AppSettings.init(context)
        assertEquals("a new install", 100, AppSettings.musicVolume); assertEquals(100, AppSettings.effectsVolume)
        assertEquals("the music's old fixed level", .5f, TableMusic.level(100), 0f)
        assertEquals("a cue at its own level", .8f, TableAudio.gained(.8f), 0f); assertEquals(1f, TableAudio.gained(1f), 0f)
    }

    @Test fun eachStepIsATenth() {
        AppSettings.init(context)
        assertEquals(.25f, TableMusic.level(50), 1e-6f); assertEquals(0f, TableMusic.level(0), 0f)
        AppSettings.applyEffectsVolume(50); assertEquals(.3f, TableAudio.gained(.6f), 1e-6f)
        AppSettings.applyEffectsVolume(0); assertEquals("silent at zero", 0f, TableAudio.gained(1f), 0f)
        AppSettings.applyMusicVolume(44); assertEquals("kept in tens", 40, AppSettings.musicVolume)
        AppSettings.applyMusicVolume(250); assertEquals(100, AppSettings.musicVolume); AppSettings.applyMusicVolume(-3); assertEquals(0, AppSettings.musicVolume)
    }

    @Test fun keptOnTheDevice() {
        AppSettings.init(context)
        AppSettings.applyMusicVolume(40); AppSettings.applyEffectsVolume(70)
        val prefs = context.getSharedPreferences("play", android.content.Context.MODE_PRIVATE)
        assertEquals(40, prefs.getInt("musicVolume", -1)); assertEquals(70, prefs.getInt("effectsVolume", -1))
        AppSettings.init(context)
        assertEquals("read again at the next start", 40, AppSettings.musicVolume); assertEquals(70, AppSettings.effectsVolume)
    }

    @Test fun soundsLinesMoveThem() {
        AppSettings.init(context)
        fun line(id: String) = soundItems {}.rows().first { it.id == id }
        line("music").step(-1); assertEquals(90, AppSettings.musicVolume); assertEquals("90%", line("music").valueText())
        line("sfx").step(-1); line("sfx").step(-1); assertEquals(80, AppSettings.effectsVolume)
        // With Sound and music off the music line stands still; the effects line still moves while the app's soft sounds are on.
        AppSettings.set("packSound", false)
        assertFalse((line("music").ctl as ConsoleCtl.Level).enabled); line("music").step(-1); assertEquals(90, AppSettings.musicVolume)
        assertTrue((line("sfx").ctl as ConsoleCtl.Level).enabled)
        AppSettings.set("appSounds", false); assertFalse((line("sfx").ctl as ConsoleCtl.Level).enabled)
    }
}
