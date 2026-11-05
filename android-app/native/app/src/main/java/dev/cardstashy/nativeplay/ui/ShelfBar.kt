package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * One filter bar for Play's lists (Randall 5 Nov 18:53Z, "it needs to look good"): every filter is a single line of
 * same-size chips that scrolls sideways, running out to the screen's edges where it fades, never wrapping into
 * uneven rows; Sort is one compact chip of the same height.
 */

private val light get() = AppSettings.theme == "light"
private val ChipCream = Color(0xFFF3E3BD)

/** A page's side padding ([x]) given back: the child runs edge to edge while the page around it keeps its gutter. */
fun Modifier.bleed(x: Dp): Modifier = layout { m, c ->
    val px = x.roundToPx()
    val p = m.measure(if (c.hasBoundedWidth) c.copy(minWidth = c.maxWidth + 2 * px, maxWidth = c.maxWidth + 2 * px) else c)
    val w = if (c.hasBoundedWidth) c.maxWidth else p.width
    layout(w, p.height) { p.place(if (c.hasBoundedWidth) -px else 0, 0) }
}

/** Soft fades at whichever ends still have chips past them. */
fun Modifier.edgeFades(state: LazyListState, width: Dp = 28.dp): Modifier = graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        val f = (width.toPx() / size.width).coerceIn(0f, .3f)
        val a = if (state.canScrollBackward) 0f else 1f; val b = if (state.canScrollForward) 0f else 1f
        drawRect(Brush.horizontalGradient(0f to Color.Black.copy(alpha = a), f to Color.Black, 1f - f to Color.Black, 1f to Color.Black.copy(alpha = b)), blendMode = BlendMode.DstIn)
    }

/** A single sideways row of chips reaching past the page's [gutter] to the screen's edges. */
@Composable
fun ShelfRow(modifier: Modifier = Modifier, gutter: Dp = 16.dp, state: LazyListState = rememberLazyListState(), content: LazyListScope.() -> Unit) =
    LazyRow(modifier.bleed(gutter).edgeFades(state), state = state, contentPadding = PaddingValues(horizontal = gutter),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = content)

/** One filter chip: 36 tall, gold when on, an optional mark before the label and a count after it. */
@Composable
fun ShelfChip(label: String, on: Boolean, count: Int? = null, modifier: Modifier = Modifier, leading: (@Composable () -> Unit)? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Row(modifier.height(36.dp).clip(shape)
        .background(if (on) Color(0x2EE8B95B) else if (light) Color(0x94FFFFFF) else Color(0x0DFFFFFF))
        .border(1.dp, if (on) Brush.verticalGradient(listOf(Color(0xD9E8B95B), Color(0x73E8B95B))) else if (light) Brush.verticalGradient(listOf(Site.GlassLine, Site.GlassLine)) else SoftRim, shape)
        .semantics { selected = on; role = Role.Tab }.clickable(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        leading?.invoke()
        Text(label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, color = if (on) (if (light) Site.Text else ChipCream) else Site.Muted), maxLines = 1)
        if (count != null) Text("%,d".format(count), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, color = if (on) Site.Gold else Site.Muted.copy(alpha = .75f)), maxLines = 1)
    }
}

/** Sort as a chip of the same height: "Sort Newest ▾"; each tap moves to the next order. */
@Composable
fun ShelfSort(value: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Row(modifier.height(36.dp).clip(shape).background(if (light) Color(0x94FFFFFF) else Color(0x0DFFFFFF))
        .border(1.dp, if (light) Brush.verticalGradient(listOf(Site.GlassLine, Site.GlassLine)) else SoftRim, shape)
        .semantics { role = Role.Button }.clickable(onClick = onClick).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Sort  ", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.5.sp, color = Site.Muted), maxLines = 1)
        Text("$value ▾", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 13.5.sp, color = if (light) Site.Text else Color.White), maxLines = 1)
    }
}
