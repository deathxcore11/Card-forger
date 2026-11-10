package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/*
 * The three waiting states (rulebook R6), one look everywhere: a line of the screen's own words in muted 15, and for an
 * error a way on. Rule: no empty frames. A box with nothing to show is not drawn; the words take its place.
 */

/** Something is on its way: the screen's own "Opening…" words. */
@Composable
fun StateLoading(text: String, modifier: Modifier = Modifier) =
    Text(text, modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = Rule.Type.sans(15, androidx.compose.ui.text.font.FontWeight.Normal, Rule.Color.Muted))

/** Nothing here yet: the screen's own words, and its one way to start when it has one. */
@Composable
fun StateEmpty(text: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}) =
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text, style = Rule.Type.sans(15, androidx.compose.ui.text.font.FontWeight.Normal, Rule.Color.Muted))
        if (action != null) GhostButton(action, onClick = onAction)
    }

/** It did not work: what happened in the screen's own words, and Try again when trying again can help. */
@Composable
fun StateError(text: String, modifier: Modifier = Modifier, retry: String = "Try again", onRetry: (() -> Unit)? = null) =
    Column(modifier.semantics { liveRegion = LiveRegionMode.Assertive }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text, style = Rule.Type.sans(15, androidx.compose.ui.text.font.FontWeight.Normal, Rule.Color.Text))
        if (onRetry != null) GhostButton(retry, onClick = onRetry)
    }

/** A whole screen waiting: [StateLoading] in the middle of the screen's ground. */
@Composable
fun StateScreen(text: String, modifier: Modifier = Modifier) =
    Box(modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) { StateLoading(text) }
