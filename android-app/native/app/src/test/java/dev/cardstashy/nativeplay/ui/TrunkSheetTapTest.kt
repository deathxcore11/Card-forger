package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.play.Trunk
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The Trunk's Filters sheet takes a real tap on a pick: on its own, and over a grid of tappable tiles (TrunkBarTest's failure). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class TrunkSheetTapTest {
    @get:Rule val rule = createComposeRule()
    private val log = mutableListOf<String>()

    private fun tapRare() {
        val rare = hasText("Rare") and hasClickAction() and hasAnyAncestor(hasTestTag("trunkFilters"))
        rule.onNode(rare).performScrollTo().performClick(); rule.waitForIdle()
        println("[sheetTap] log $log")
        rule.onNode(rare).assertIsSelected()
        assertEquals(listOf<String>(), log)
    }

    @Test fun alone() {
        rule.setContent {
            var f by remember { mutableStateOf(Trunk.Filter()) }
            TrunkFilterSheet(f, "", emptyList(), 10, { log += "close" }, { f = it }) { }
        }
        rule.waitForIdle(); tapRare()
    }

    @Test fun overAGrid() {
        rule.setContent {
            var f by remember { mutableStateOf(Trunk.Filter()) }
            Box(Modifier.fillMaxSize()) {
                LazyVerticalGrid(GridCells.Fixed(3), Modifier.fillMaxSize()) {
                    items(60) { i -> Box(Modifier.height(180.dp).clickable { log += "tile $i" }) }
                }
                TrunkFilterSheet(f, "", emptyList(), 10, { log += "close" }, { f = it }) { }
            }
        }
        rule.waitForIdle(); tapRare()
    }
}
