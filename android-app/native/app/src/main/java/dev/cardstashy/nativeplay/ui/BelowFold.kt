package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.Dp

/**
 * Lighter Collection home C5 (specs/collection-home-lighter-brief.md): a part of the page below the first screen is near once
 * its top is within half a screen of the bottom edge. [top] and [screen] are in the same units, measured from the top of the screen.
 */
internal fun nearTheFold(top: Float, screen: Float) = top <= screen * 1.5f

/**
 * C5, below the fold waits: [content] is not built (and so asks for no pictures and starts no timers) until the page is scrolled
 * near it. Until then an empty box of [hold] keeps its place. Once built it stays built, so scrolling back up changes nothing.
 */
@Composable
internal fun BelowFold(hold: Dp, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    var near by remember { mutableStateOf(false) }
    if (near) content()
    else Box(modifier.fillMaxWidth().height(hold).onGloballyPositioned { c ->
        if (c.isAttached && nearTheFold(c.positionInRoot().y, c.findRootCoordinates().size.height.toFloat())) near = true
    })
}
