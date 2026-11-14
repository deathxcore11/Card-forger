package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Live 0.4.57 on the Thor (fault list 6, 11): the CASTING panel read "Shardmage' / s Rescue" and "Wonderwe / ave Aeriali…".
 * At the Thor's sizes (640 × 360 and 731 × 411 dp, the phone layout scaled, and the 960 × 540 big board) the name, laid out in
 * the panel OwnCast gives it, only ever breaks a line at a space.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-xhdpi")
class OwnCastNameTest {
    @get:Rule val rule = createComposeRule()

    @Test fun namesBreakAtSpaces() {
        val names = listOf("Shardmage's Rescue", "Wonderweave Aerialist", "A Most Helpful Weaver", "Sheltered by Ghosts")
        val sizes = listOf(640 to 360, 731 to 411, 960 to 540)
        val splits = mutableListOf<String>()
        var checked = 0
        rule.setContent {
            val measurer = rememberTextMeasurer()
            val density = LocalDensity.current
            splits.clear(); checked = 0
            for ((w, h) in sizes) with(Du(chromeU(w.dp, h.dp))) {
                // The same style, width and padding as OwnCast (ForgeTable.kt).
                val style = sans(sp(12f))
                for (name in names) {
                    val colW = castPanelWidth(name, 76.du, 8.du + 2.dp, 175.du) { word -> with(density) { measurer.measure(word, style, softWrap = false, maxLines = 1).size.width.toDp() } }
                    val r = measurer.measure(name, style, overflow = TextOverflow.Ellipsis, maxLines = 2,
                        constraints = Constraints(maxWidth = with(density) { (colW - 8.du).roundToPx() }))
                    for (l in 0 until r.lineCount - 1) {
                        val end = r.getLineEnd(l, visibleEnd = false)
                        if (end in 1 until name.length && !name[end - 1].isWhitespace() && !name[end].isWhitespace())
                            splits += "\"$name\" at ${w}x$h: \"${name.substring(r.getLineStart(l), end)}\" / \"${name.substring(end)}\""
                    }
                    checked++
                }
            }
        }
        rule.waitForIdle()
        assertTrue("nothing measured", checked == names.size * sizes.size)
        assertTrue("names split inside a word: $splits", splits.isEmpty())
    }
}
