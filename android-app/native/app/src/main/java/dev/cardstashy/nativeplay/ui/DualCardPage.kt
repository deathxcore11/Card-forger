package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * "Card on the wall" (specs/thor-card-popup-dual.md, Revision 2): the card page on the Thor's two screens, shared by Play's card sheet
 * and the Collection card page. The top is three columns over a dark bleed of the card's own art (left: its facts, middle: the whole
 * card, right: rules text and guide); the bottom is a glass bleed of the same art under sections of frosted tiles and one row of case
 * buttons. Both screens take their parallax from the one tilt value the card's foil uses (Motion.still turns the parallax off).
 */
internal object DualPage {
    /** The one grid: the gap between columns, tiles and sections, and the margin round each screen. */
    val Gutter: Dp = 14.dp
    /** Text steps for the top right column, largest first; the smallest is the rulebook's smallest body size. */
    val BodySizes = listOf(18, 16, 15, 14, 13)
    /** The top right column's variants, largest first: a size and whether the guide is in its short form (names only); the last one scrolls. */
    val Fits: List<Pair<Int, Boolean>> = BodySizes.map { it to false } + (13 to true)
    /** Screenshots: official rulings to show when the network has none. */
    @androidx.annotation.VisibleForTesting var testRulings: List<Pair<String, String>>? = null
}

/** A section heading: gold small caps with a hairline to the edge, the same on both screens. */
@Composable
internal fun DualHeading(title: String, modifier: Modifier = Modifier) = Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Text(title.uppercase(), style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Gold).copy(letterSpacing = 1.6.sp), maxLines = 1)
    Box(Modifier.weight(1f).height(1.dp).background(Rule.Color.Edge))
}

/** A section: heading over its content. */
@Composable
internal fun DualSectionBox(title: String, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) { DualHeading(title); content() }

/**
 * Draws the first of [count] variants (largest first) whose height fits, so text steps down instead of being cut. The last variant is
 * the fallback: it gets `last = true` (a column then scrolls inside the box). [centre] centres the pick in the box.
 */
@Composable
internal fun FitFirst(count: Int, modifier: Modifier = Modifier, centre: Boolean = false, content: @Composable (index: Int, last: Boolean) -> Unit) {
    SubcomposeLayout(modifier) { c ->
        val loose = Constraints(minWidth = c.minWidth, maxWidth = c.maxWidth)
        var pick = count - 1
        var placed: List<Placeable>? = null
        for (i in 0 until count - 1) {
            val ps = subcompose(i) { content(i, false) }.map { it.measure(loose) }
            if ((ps.maxOfOrNull { it.height } ?: 0) <= c.maxHeight) { pick = i; placed = ps; break }
        }
        val ps = placed ?: subcompose(pick) { content(pick, true) }.map { it.measure(Constraints(c.minWidth, c.maxWidth, 0, c.maxHeight)) }
        val w = maxOf(ps.maxOfOrNull { it.width } ?: 0, c.minWidth)
        val h = maxOf(ps.maxOfOrNull { it.height } ?: 0, c.minHeight).coerceAtMost(c.maxHeight)
        layout(w, h) { ps.forEach { it.place(0, if (centre) (h - it.height) / 2 else 0) } }
    }
}

/** Parallax: the layer shifts opposite to the tilt by [frac] of its size, grown a little so its edge never shows; off with reduce-motion. */
internal fun Modifier.parallax(tilt: State<Offset>?, frac: Float): Modifier = graphicsLayer {
    if (tilt == null || Motion.still || frac == 0f) return@graphicsLayer
    val t = tilt.value
    translationX = -t.x * frac * size.width; translationY = -t.y * frac * size.height
    val s = 1f + frac * 2.4f; scaleX = s; scaleY = s
}

/** Tiles counter-shift by a hair, with the tilt, so the glass floats over the art. */
internal fun Modifier.counterShift(tilt: State<Offset>?, frac: Float): Modifier = graphicsLayer {
    if (tilt == null || Motion.still) return@graphicsLayer
    val t = tilt.value; translationX = t.x * frac * size.width; translationY = t.y * frac * size.height
}

/** A format the card plays in: a glass pill. */
@Composable
internal fun FormatPill(label: String) = Text(label, style = Rule.Type.sans(12, FontWeight.Bold, Rule.Color.Text), maxLines = 1,
    modifier = Modifier.clip(Rule.Radius.Pill).background(Rule.Color.Glass).border(1.dp, Rule.Color.Edge, Rule.Radius.Pill).padding(horizontal = 10.dp, vertical = 4.dp))

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FormatPills(labels: List<String>, modifier: Modifier = Modifier) =
    FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { labels.forEach { FormatPill(it) } }

/**
 * The top screen. Left: [left] (sections, centred down the screen). Middle: the whole card, as tall as the screen allows ([card] gets the
 * fitted size). Right: [right], drawn at the largest of [DualPage.BodySizes] that fits, else the smallest scrolling on its own.
 * [onA] is A while the right column has the ring; up and down scroll it.
 */
@Composable
internal fun DualTop(art: String?, tilt: State<Offset>?, scroll: ScrollState, card: @Composable (Modifier) -> Unit,
                     left: @Composable ColumnScope.() -> Unit, right: @Composable ColumnScope.(size: Int, compact: Boolean) -> Unit, onKey: (android.view.KeyEvent) -> Boolean) {
    val g = DualPage.Gutter
    Box(Modifier.fillMaxSize().background(Rule.Color.Bg)) {
        val p = heroPainter(art?.let(homeArt))
        if (p != null) Box(Modifier.fillMaxSize().parallax(tilt, .02f)) {
            Image(p, null, Modifier.fillMaxSize().blur(36.dp), contentScale = ContentScale.Crop, colorFilter = tone(1.3f, .5f))
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = .35f), Color.Black.copy(alpha = .6f)))))
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = g, vertical = 14.dp)) {
            val cardW = fitCard(androidx.compose.ui.unit.DpSize(maxWidth, maxHeight), 0.dp).width
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(g)) {
                Column(Modifier.weight(.9f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(g * 1.25f, Alignment.CenterVertically), content = left)
                Box(Modifier.width(cardW).fillMaxHeight(), contentAlignment = Alignment.Center) { card(Modifier.fillMaxSize()) }
                Column(Modifier.weight(1.1f).fillMaxHeight()) {
                    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
                    androidx.compose.runtime.LaunchedEffect(Unit) { androidx.compose.runtime.withFrameNanos { }; runCatching { focus.requestFocus() } }
                    FitFirst(DualPage.Fits.size, Modifier.fillMaxSize().focusRing(focus, onKey)) { i, last ->
                        Column(if (last) Modifier.verticalScroll(scroll) else Modifier, verticalArrangement = Arrangement.spacedBy(g * 1.25f)) { right(DualPage.Fits[i].first, DualPage.Fits[i].second) }
                    }
                }
            }
        }
    }
}

private fun Modifier.focusRing(focus: androidx.compose.ui.focus.FocusRequester, onKey: (android.view.KeyEvent) -> Boolean): Modifier = this
    .focusRequester(focus).onPreviewKeyEvent { onKey(it.nativeKeyEvent) }.focusable()

/** One tile of the bottom board: [weight] is its share of its row's width. */
internal class DualTile(val weight: Float = 1f, val content: @Composable () -> Unit)
/** A section of tiles under a heading; [weight] is its share of the board's height. */
internal class DualSection(val title: String, val weight: Float, val tiles: List<DualTile>)

/** A frosted glass tile (over the glass bleed), its small label in muted caps; [body] fills it. */
@Composable
internal fun GlassTile(modifier: Modifier = Modifier, label: String? = null, onClick: (() -> Unit)? = null, body: @Composable () -> Unit) {
    val shape = Rule.Radius.shape(Rule.Radius.Panel)
    Column(modifier.glass(shape).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (label != null) Text(label.uppercase(), style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Muted).copy(letterSpacing = 1.2.sp), maxLines = 1)
        Box(Modifier.weight(1f).fillMaxWidth()) { body() }
    }
}

/** A tap row inside a tile ("Its pack at the Merchant ›"). */
@Composable
internal fun TileLink(label: String, onClick: () -> Unit) = Row(Modifier.fillMaxWidth().heightIn(min = 32.dp).clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(label, style = Rule.Type.sans(14, FontWeight.SemiBold, Rule.Color.Text), modifier = Modifier.weight(1f, fill = false))
    Text("›", style = Rule.Type.sans(14, FontWeight.Bold, Rule.Color.Gold))
}

/** A big number over its words: "2 of 4" / "Traditional foil"; steps down to one line when the tile is short. */
@Composable
internal fun BigFact(big: String, small: String?, extra: String? = null) = FitFirst(3, Modifier.fillMaxSize(), centre = true) { i, _ ->
    when (i) {
        0, 1 -> Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(big, style = Rule.Type.sans(if (i == 0) 34 else 28, FontWeight.ExtraBold, Rule.Color.Text), maxLines = 1, softWrap = false)
            if (!small.isNullOrBlank()) Text(small, style = Rule.Type.sans(14, FontWeight.SemiBold, Rule.Color.Text))
            if (i == 0 && !extra.isNullOrBlank()) Text(extra, style = Rule.Type.sans(13, FontWeight.Normal, Rule.Color.Muted))
        }
        else -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
            Text(big, style = Rule.Type.sans(24, FontWeight.ExtraBold, Rule.Color.Text), maxLines = 1, softWrap = false)
            if (!small.isNullOrBlank()) Text(small, style = Rule.Type.sans(14, FontWeight.SemiBold, Rule.Color.Text), modifier = Modifier.padding(bottom = 3.dp))
        }
    }
}

/**
 * The bottom screen: the card's art as a glass bleed under everything (the sheet header's recipe, frostier and darker toward the foot),
 * [sections] of tiles filling the screen with no dead space, then the case buttons.
 */
@Composable
internal fun DualBottom(art: String?, tilt: State<Offset>?, sections: List<DualSection>, buttons: List<CaseButton>) {
    val g = DualPage.Gutter
    val frostLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val frost = remember(frostLayer) { Frost(frostLayer) }
    Box(Modifier.fillMaxSize().background(Rule.Color.Bg)) {
        Box(Modifier.fillMaxSize().parallax(tilt, .04f)) { GlassBackdrop(art, frost) }
        androidx.compose.runtime.CompositionLocalProvider(LocalFrost provides frost) {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = g, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(g)) {
                Column(Modifier.weight(1f).fillMaxWidth().counterShift(tilt, .004f), verticalArrangement = Arrangement.spacedBy(g)) {
                    sections.filter { it.tiles.isNotEmpty() }.forEach { s ->
                        Column(Modifier.weight(s.weight).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            DualHeading(s.title)
                            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(g)) {
                                s.tiles.forEach { t -> Box(Modifier.weight(t.weight).fillMaxHeight()) { t.content() } }
                            }
                        }
                    }
                }
                CaseButtonRow(buttons, Modifier.fillMaxWidth().height(Rule.CaseButtonHeight))
            }
        }
    }
}

private val FORMAT_NAMES = listOf("standard" to "Standard", "pioneer" to "Pioneer", "modern" to "Modern", "legacy" to "Legacy", "vintage" to "Vintage", "pauper" to "Pauper", "commander" to "Commander")

/** The formats a card is legal in (restricted says so), from its Scryfall legalities; none for a card without them. */
internal fun legalFormats(card: com.google.gson.JsonObject?): List<String> {
    val legal = card?.get("legalities")?.takeIf { it.isJsonObject }?.asJsonObject ?: return emptyList()
    return FORMAT_NAMES.mapNotNull { (k, l) -> when (legal.get(k)?.takeIf { it.isJsonPrimitive }?.asString) { "legal" -> l; "restricted" -> "$l · restricted"; else -> null } }
}
