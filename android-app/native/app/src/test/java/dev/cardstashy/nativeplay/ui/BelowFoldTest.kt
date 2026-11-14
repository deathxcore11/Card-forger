package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Lighter Collection home C5: Meta and News below the first screen are not built until the page is scrolled near them. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
class BelowFoldTest {
    @get:Rule val rule = createComposeRule()

    @Test fun nearIsHalfAScreenBelowTheBottomEdge() {
        assertTrue(nearTheFold(top = 0f, screen = 844f))
        assertTrue(nearTheFold(top = 1266f, screen = 844f))
        assertFalse(nearTheFold(top = 1267f, screen = 844f))
    }

    private val scroll = androidx.compose.foundation.ScrollState(0)
    /** Scrolls the page to [dp] from its top, exactly (a swipe's fling is not a fixed distance). */
    private fun scrollTo(dp: Int) { rule.runOnIdle { kotlinx.coroutines.runBlocking { scroll.scrollTo(dp * 2) } }; rule.waitForIdle() }

    private fun page(above: Int, built: MutableList<String>) = rule.setContent {
        Column(Modifier.verticalScroll(scroll)) {
            Box(Modifier.fillMaxWidth().height(above.dp))
            BelowFold(240.dp) { androidx.compose.runtime.SideEffect { if ("meta" !in built) built += "meta" }; Text("Community Meta decks", Modifier.height(300.dp)) }
            Box(Modifier.fillMaxWidth().height(1200.dp))
            BelowFold(360.dp) { androidx.compose.runtime.SideEffect { if ("news" !in built) built += "news" }; Text("News", Modifier.height(500.dp)) }
        }
    }

    @Test fun farBelowTheFirstScreenNothingIsBuiltUntilScrolledNear() {
        val built = mutableListOf<String>()
        page(above = 2000, built)
        rule.waitForIdle()
        assertEquals(emptyList<String>(), built)
        assertEquals(0, rule.onAllNodesWithText("Community Meta decks").fetchSemanticsNodes().size)
        scrollTo(700)
        assertEquals("Meta's top is 1300 down the screen: still more than half a screen below the edge", emptyList<String>(), built)
        scrollTo(740)
        assertEquals("Meta is near now, News is still far below", listOf("meta"), built)
        scrollTo(2000)
        assertEquals(listOf("meta"), built)
        scrollTo(2400)
        assertEquals(listOf("meta", "news"), built)
        scrollTo(0)
        assertEquals("once built it stays", 1, rule.onAllNodesWithText("Community Meta decks").fetchSemanticsNodes().size)
    }

    /** The whole-page pictures (a 2300 tall window) and a tablet: what is on or near the first screen is built at once. */
    @Test fun onOrNearTheFirstScreenItIsBuiltAtOnce() {
        val built = mutableListOf<String>()
        page(above = 900, built)
        rule.waitForIdle()
        assertEquals(listOf("meta"), built)
    }
}
