package dev.cardstashy.nativeplay.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import coil3.disk.DiskCache
import okio.Path.Companion.toOkioPath
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Lighter Collection home C1: the first screen's pictures are the last the art cache would drop, and a check shows only a thin line. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class HomePinsTest {
    @get:Rule val rule = createComposeRule()

    private fun model(): CollectionHomeModel {
        val none = HomeValue("", "", "", "", "", "", "")
        val shelf = HomeShelf("Your decks", null,
            ShelfLead("d1", false, "", "Auras", "", null, "#deck/d1", "https://art.example/lead.jpg"),
            listOf(ShelfDeck("d2", "Elves", "", "https://art.example/elves.jpg", "#deck/d2"),
                ShelfDeck("d3", "No cover", "", null, "#deck/d3", sources = listOf("https://art.example/a.jpg", "https://art.example/lead.jpg")),
                ShelfDeck("d4", "Bundled", "", "file:///android_asset/cover.webp", "#deck/d4")))
        return CollectionHomeModel(CardGame.MTG, "", "", "", DailyCard("c", "Card", "", "https://art.example/daily.jpg", "", "", "", ""), none, "", shelf,
            HomeMeta("", null, emptyList(), true, 8000), HomeNews("", "", "", emptyList(), 3, emptyList(), true))
    }

    @Test fun theFirstScreensPicturesInTheOrderSeen() = assertEquals(
        listOf("https://art.example/daily.jpg", "https://art.example/lead.jpg", "https://art.example/elves.jpg", "https://art.example/a.jpg"), HomePins.pictures(model()))

    private fun DiskCache.put(key: String, bytes: Int) { val e = openEditor(key)!!; fileSystem.write(e.metadata) { writeUtf8("m") }; fileSystem.write(e.data) { write(ByteArray(bytes)) }; e.commit() }
    private fun DiskCache.has(key: String) = openSnapshot(key)?.also { it.close() } != null

    /** A cache with room for two pictures: the one Home marked is kept when a third arrives, the other is dropped. */
    @Test fun aPictureHomeMarkedOutlivesAnOlderOne() {
        val dir = java.nio.file.Files.createTempDirectory("pins").toFile()
        val cache = DiskCache.Builder().directory(dir.toOkioPath()).maxSizeBytes(2_500).build()
        try {
            cache.put("https://art.example/daily.jpg", 1_000)
            cache.put("https://art.example/other.jpg", 1_000)
            assertEquals("one of Home's four is on the device", 1, HomePins.touch(HomePins.pictures(model()), cache))
            cache.put("https://art.example/new.jpg", 1_000)
            val until = System.currentTimeMillis() + 5_000
            while (cache.size > 2_500 && System.currentTimeMillis() < until) Thread.sleep(20)
            assertEquals("Home's picture is kept", true, cache.has("https://art.example/daily.jpg"))
            assertEquals("the older one that Home does not show is the one dropped", false, cache.has("https://art.example/other.jpg"))
            assertEquals(0, HomePins.touch(listOf("https://art.example/daily.jpg"), null))
        } finally { cache.shutdown(); dir.deleteRecursively() }
    }

    @Test fun whileTheAccountIsCheckedOnlyTheThinLineShows() {
        Motion.still = true
        var on by mutableStateOf(true)
        rule.setContent { CheckLine(on) }
        rule.waitForIdle()
        assertEquals(1, rule.onAllNodesWithContentDescription("Checking your account").fetchSemanticsNodes().size)
        on = false
        rule.waitForIdle()
        assertEquals(0, rule.onAllNodesWithContentDescription("Checking your account").fetchSemanticsNodes().size)
    }
}
