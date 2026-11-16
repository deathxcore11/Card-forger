package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.Trunk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Live 0.4.59 on the Thor (Randall 11 Nov): "the sets tab ... in trunk is super slow". The tab drew every set at once inside one
 * grid item and rebuilt the list on each frame. Now each set is its own lazy row: with 600 sets only the rows on screen are drawn,
 * and the rows themselves (years, order, search, format) are the same as before.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class TrunkSetsLazyTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(org.robolectric.RuntimeEnvironment.getApplication()) }

    private fun row(i: Int, owned: Int = 0, format: String = "eternal") =
        Trunk.SetRow("s%03d".format(i), "Set number $i", "", "${2026 - i / 20}-01-01", 250, owned, format)

    @Test fun theRowsAreTheSameYearsAndSetsAsBefore() {
        val all = (0 until 60).map { row(it, owned = if (it % 7 == 0) 3 else 0, format = if (it < 10) "standard" else "eternal") } + Trunk.SetRow("zzz", "No date", "", "", null, 0)
        val rows = Trunk.setTabRows(all, "", "")
        assertEquals(listOf("2026", "2025", "2024", "Other"), rows.filter { it.set == null }.map { it.year })
        assertEquals(all.map { it.code }, rows.mapNotNull { it.set?.code })
        assertEquals("a year line, then its sets", "y:2026", rows.first().key)
        assertEquals(rows.size, rows.map { it.key }.toSet().size)
        assertEquals(10, Trunk.setTabRows(all, "", "standard").count { it.set != null })
        assertEquals(listOf("s000", "s007", "s014", "s021", "s028", "s035", "s042", "s049", "s056"), Trunk.setTabRows(all, "", "started").mapNotNull { it.set?.code })
        assertEquals(listOf("s042"), Trunk.setTabRows(all, " Number 42 ", "").mapNotNull { it.set?.code })
        assertEquals(listOf("s007"), Trunk.setTabRows(all, "s007", "").mapNotNull { it.set?.code })
        assertEquals(9, Trunk.keepCollecting(all, "", "").size)
        assertTrue(Trunk.keepCollecting(all, "x", "").isEmpty() && Trunk.keepCollecting(all, "", "standard").isEmpty())
    }

    @Test fun withSixHundredSetsOnlyTheRowsOnScreenAreDrawn() {
        Motion.still = true
        val state = JsonObject().apply {
            add("cards", JsonArray())
            add("shop", JsonArray().apply { for (i in 0 until 600) add(JsonObject().apply {
                addProperty("code", "s%03d".format(i)); addProperty("name", "Set number $i"); addProperty("released", "${2026 - i / 20}-01-01"); addProperty("count", 250); addProperty("format", "eternal") }) })
        }
        try {
            rule.setContent { TrunkScreen(state, {}, {}, {}, startSet = "") {} }
            rule.waitForIdle()
            assertTrue("the count line names all 600", rule.onAllNodesWithText("600 of 600 sets · 0 started").fetchSemanticsNodes().isNotEmpty())
            val drawn = rule.onAllNodes(SemanticsMatcher("set tile") { it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("settile:") == true }).fetchSemanticsNodes().size
            assertTrue("a few set tiles are drawn, not all 600: $drawn", drawn in 1..20)
            assertTrue(rule.onAllNodesWithTag("settile:s000").fetchSemanticsNodes().isNotEmpty())
            assertTrue(rule.onAllNodesWithTag("settile:s599").fetchSemanticsNodes().isEmpty())
        } finally { }
    }
}
