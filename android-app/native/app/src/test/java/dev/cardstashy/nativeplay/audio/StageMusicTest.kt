package dev.cardstashy.nativeplay.audio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Stage music (specs/stage-music-brief.md): outside Story a match plays the two songs of the map on its table, A first, B after
 * one full loop and back, and B while anyone is at 5 life or less. A Story battle keeps its act's songs. The table chooses the
 * map once and gives the same id to the scene and to the music, and every map in the game has both songs listed.
 */
class StageMusicTest {
    private fun up(name: String): File = generateSequence(File("").absoluteFile) { it.parentFile }.map { File(it, name) }.first { it.exists() }
    /** The loop points the app is built with (audio-loops.js at the repo's root). */
    private val loops: Map<String, Pair<Float, Float>> = Regex("\"(MUS-[A-Z0-9-]+)\": \\[([0-9.]+), ([0-9.]+)]").findAll(up("audio-loops.js").readText())
        .associate { it.groupValues[1] to (it.groupValues[2].toFloat() to it.groupValues[3].toFloat()) }

    @Test fun aMapPlaysItsOwnTwoSongs() {
        assertEquals(listOf("MUS-MAT-MOONLIT-COURTYARD-A", "MUS-MAT-MOONLIT-COURTYARD-B"), TableMusic.stageSongs("moonlit-courtyard", loops.keys))
        assertEquals(listOf("MUS-MAT-RAVNICA-GUILD-CITY-A", "MUS-MAT-RAVNICA-GUILD-CITY-B"), TableMusic.stageSongs("ravnica-guild-city", loops.keys))
        assertNull("a map with no songs listed", TableMusic.stageSongs("no-such-map", loops.keys)); assertNull(TableMusic.stageSongs(null, loops.keys))
        // Every map the game can lay down (play-playmats.js) has an A and a B.
        val maps = Regex("\\['([a-z-]+)','[^']+']").findAll(up("play-playmats.js").readText().lineSequence().first { it.startsWith("export const PLAYMATS") }).map { it.groupValues[1] }.toList()
        assertEquals(14, maps.size)
        for (m in maps) assertEquals("$m has both songs", 2, TableMusic.stageSongs(m, loops.keys)?.size)
    }

    @Test fun aThenBAfterOneFullLoopAndBack() {
        val songs = TableMusic.stageSongs("ashen-forge", loops.keys)!!
        val a = ((loops.getValue(songs[0]).second - loops.getValue(songs[0]).first) * 1000).toLong()
        val b = ((loops.getValue(songs[1]).second - loops.getValue(songs[1]).first) * 1000).toLong()
        var (at, since) = TableMusic.turnOver(songs, 0, 0L, 1_000L, false, loops)
        assertEquals("starts on A", songs[0], songs[at % 2]); assertEquals(1_000L, since)
        TableMusic.turnOver(songs, at, since, 1_000L + a - 1, false, loops).let { assertEquals("still A inside its loop", 0, it.first) }
        TableMusic.turnOver(songs, at, since, 1_000L + a, false, loops).let { at = it.first; since = it.second }
        assertEquals("B after one full loop of A", songs[1], songs[at % 2])
        TableMusic.turnOver(songs, at, since, since + b, false, loops).let { at = it.first; since = it.second }
        assertEquals("and back to A", songs[0], songs[at % 2])
    }

    @Test fun lowLifeBringsBInAndKeepsIt() {
        val songs = TableMusic.stageSongs("black-ossuary", loops.keys)!!
        val (at, since) = TableMusic.turnOver(songs, 0, 500L, 9_000L, true, loops)
        assertEquals(songs[1], songs[at % 2]); assertEquals("B starts now", 9_000L, since)
        // Hours later, still low: still B, and it has not started again.
        val later = TableMusic.turnOver(songs, at, since, 9_000_000L, true, loops)
        assertEquals(at, later.first); assertEquals(since, later.second)
        // The first board of a match already at low life starts on B.
        assertEquals(1, TableMusic.turnOver(songs, 0, 0L, 100L, true, loops).first)
    }

    @Test fun aStoryBattleKeepsItsActsSongs() {
        assertEquals(listOf("MUS-ST-03A", "MUS-ST-03B"), TableMusic.storySongs(TableMusic.StoryMusic(3, "march", null), loops.keys))
        assertEquals(listOf("MUS-ST-03B", "MUS-ST-03A"), TableMusic.storySongs(TableMusic.StoryMusic(3, "lesson", null), loops.keys))
        assertEquals("a boss: C then A", listOf("MUS-ST-03C", "MUS-ST-03A").filter { it in loops }, TableMusic.storySongs(TableMusic.StoryMusic(3, null, "Boss"), loops.keys))
        // Low life never pulls a Story battle off its songs (the table passes holdB only outside Story): the rotation is the old one.
        val songs = TableMusic.storySongs(TableMusic.StoryMusic(3, "march", null), loops.keys)!!
        assertEquals(0, TableMusic.turnOver(songs, 0, 500L, 9_000L, false, loops).first)
    }

    /** The table chooses the map once and hands that one id to the scene and to the music. */
    @Test fun theSceneAndTheMusicAreGivenTheSameMap() {
        val src = up("src/main/java/dev/cardstashy/nativeplay/ui/TableScreen.kt").let { if (it.exists()) it else up("app/src/main/java/dev/cardstashy/nativeplay/ui/TableScreen.kt") }.readText()
        assertEquals("the map is chosen once (choosing also records it as the last map)", 1, Regex("Playmats\\.next\\(").findAll(src).count())
        assertTrue(src.contains("val matId = mat ?: remember { Playmats.next(context) }"))
        assertTrue("the music is given it", src.contains("TableMusic(context, musicScope, storyMusic, matId)"))
        assertTrue("the scene draws it", src.contains("PlaymatScene(matId, Modifier.fillMaxSize())"))
        assertEquals("nothing on the table draws a map of its own choosing", 0, Regex("PlaymatScene\\(Modifier").findAll(src).count())
    }

    @Test fun theCreditLineIsInSettings() {
        assertTrue(dev.cardstashy.nativeplay.ui.STAGE_MUSIC_CREDIT.startsWith("Stage music rendered with Virtual Playing Orchestra 3, Sonatina Symphonic Orchestra, VSCO-2 CE, FreePats and DrumGizmo MuldjordKit (CC BY and CC0)."))
        assertTrue(dev.cardstashy.nativeplay.ui.STAGE_MUSIC_CREDIT.endsWith("Drum samples provided by DrumGizmo.org"))
    }
}
