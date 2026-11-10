package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The one rule for a row of tabs (fix list C7, H1): one line, never a wrapped label. While the [count] tabs fit they share
 * the width evenly; when a label needs more (a narrow phone, large text) the tabs keep their words and the row scrolls
 * sideways. Give each tab the [content]'s modifier and draw its label with `maxLines = 1, softWrap = false`.
 */
@Composable
fun TabsRow(count: Int, modifier: Modifier = Modifier, gap: Dp = 0.dp, content: @Composable RowScope.(tab: Modifier) -> Unit) =
    BoxWithConstraints(modifier) {
        val each = (maxWidth - gap * (count - 1).coerceAtLeast(0)) / count.coerceAtLeast(1)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.CenterVertically) {
            content(Modifier.widthIn(min = each))
        }
    }
