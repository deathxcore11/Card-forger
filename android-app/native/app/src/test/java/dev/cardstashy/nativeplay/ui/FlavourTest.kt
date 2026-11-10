package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.text.font.FontStyle
import org.junit.Assert.assertEquals
import org.junit.Test

class FlavourTest {
    @Test fun markedWordsStandUprightAndTheAsterisksGo() {
        val t = flavourText("This is *my* domain, and *I* am its Queen.")
        assertEquals("This is my domain, and I am its Queen.", t.text)
        assertEquals(listOf("my", "I"), t.spanStyles.map { t.text.substring(it.start, it.end) })
        assertEquals(listOf(FontStyle.Normal, FontStyle.Normal), t.spanStyles.map { it.item.fontStyle })
    }

    @Test fun plainLinesAndALoneAsteriskAreLeftAlone() {
        assertEquals("No emphasis here.", flavourText("No emphasis here.").text)
        assertEquals("Five * stars", flavourText("Five * stars").text)
        assertEquals(0, flavourText("Five * stars").spanStyles.size)
    }
}
