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
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.foundation.indication
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
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
 * buttons. Tilt moves only the card and its foil (Randall 10 Nov 17:22Z); the art bleeds and the tiles stay perfectly still.
 */
internal object DualPage {
    /** The one grid: the gap between columns, tiles and sections, and the margin round each screen. */
    val Gutter: Dp = 14.dp
    /** Text steps for the top right column, largest first (a short card gets the big sizes, a long one steps down); the smallest is the rulebook's smallest body size. */
    val BodySizes = listOf(34, 28, 24, 22, 20, 18, 16, 15, 14, 13)
    /** The top right column's variants, largest first: a size and whether the guide is in its short form (names only); the last one scrolls. */
    val Fits: List<Pair<Int, Boolean>> = BodySizes.map { it to false } + (13 to true)
    /** Screenshots: official rulings to show when the network has none. */
    @androidx.annotation.VisibleForTesting var testRulings: List<Pair<String, String>>? = null
}

/** A section heading: gold small caps with a hairline to the edge, the same on both screens. */
@Composable
internal fun DualHeading(title: String, modifier: Modifier = Modifier, trailing: String? = null) = Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Text(title.uppercase(), style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Gold).copy(letterSpacing = 1.6.sp), maxLines = 1)
    Box(Modifier.weight(1f).height(1.dp).background(Rule.Color.Edge))
    // Right-aligned at the end of the line (the rules text heading carries the card's P/T or loyalty here).
    if (!trailing.isNullOrBlank()) Text(trailing, style = Rule.Type.sans(16, FontWeight.Bold, Rule.Color.Gold), maxLines = 1)
}

/** A section: heading over its content. */
@Composable
internal fun DualSectionBox(title: String, modifier: Modifier = Modifier, trailing: String? = null, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) { DualHeading(title, trailing = trailing); content() }

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

/**
 * A card's name in Cinzel on the wall: it wraps at spaces only and steps the size down (24, 22, 20, 18, 16) until no line breaks inside a word
 * ("Boggart Cursecrafter" stays whole on its own line, never "Cursecrafte / r"). A single word wider than the column at the smallest step still wraps.
 */
@Composable
internal fun WallName(name: String, modifier: Modifier = Modifier) {
    val steps = remember { listOf(24, 22, 20, 18, 16) }
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    BoxWithConstraints(modifier) {
        val maxPx = constraints.maxWidth
        // Measured, not guessed: the biggest step at which no line ends inside a word (the smallest when none does).
        val size = remember(name, maxPx) {
            steps.firstOrNull { st ->
                val r = measurer.measure(name, Rule.Type.cinzel(st), constraints = Constraints(maxWidth = maxPx))
                (0 until r.lineCount - 1).none { l ->
                    val end = r.getLineEnd(l, visibleEnd = false)
                    end in 1 until name.length && !name[end - 1].isWhitespace() && !name[end].isWhitespace()
                }
            } ?: steps.last()
        }
        Text(name, style = Rule.Type.cinzel(size))
    }
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
        if (p != null) Box(Modifier.fillMaxSize()) {
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
                    FitFirst(DualPage.Fits.size, Modifier.fillMaxSize().focusRing(focus, onKey), centre = true) { i, last ->
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
internal class DualTile(@Suppress("unused") val weight: Float = 1f, val content: @Composable () -> Unit)
/** A section of tiles under a heading. Every section gets the same share of the board's height and every two-tile row the same two equal columns ([weight]s are not used). */
internal class DualSection(val title: String, val weight: Float, val tiles: List<DualTile>)

/**
 * A frosted glass tile (over the glass bleed), its small label in muted caps; [body] fills it. With a controller the tile is a d-pad stop (the gold ring)
 * and A runs [onClick]; [padKey] draws that button's glyph in the label row, so the tile needs no hint words.
 */
@Composable
internal fun GlassTile(modifier: Modifier = Modifier, label: String? = null, onClick: (() -> Unit)? = null, padKey: String? = null, body: @Composable () -> Unit) {
    val shape = Rule.Radius.shape(Rule.Radius.Panel)
    val pad by Pad.connected.collectAsState()
    val src = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val press = when {
        onClick == null -> Modifier
        pad -> Modifier.indication(src, PadFocus.Ring).padActs(PadActs()).onKeyEvent { e ->
            val kc = e.nativeKeyEvent.keyCode   // MainActivity turns BUTTON_A into DPAD_CENTER before dispatch; take both
            if (kc == android.view.KeyEvent.KEYCODE_BUTTON_A || kc == android.view.KeyEvent.KEYCODE_DPAD_CENTER) { if (e.type == androidx.compose.ui.input.key.KeyEventType.KeyUp) onClick(); true } else false
        }.clickable(interactionSource = src, indication = null, onClick = onClick)
        else -> Modifier.clickable(onClick = onClick)
    }
    Column(modifier.glass(shape).then(press).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (label != null) Row(Modifier.fillMaxWidth().height(22.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label.uppercase(), style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Muted).copy(letterSpacing = 1.2.sp), maxLines = 1, modifier = Modifier.weight(1f))
            if (pad && onClick != null && padKey != null) Box(Modifier.wrapContentHeight(unbounded = true)) { PadKey(padKey, "") }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) { body() }
    }
}

/** The rulings tile's body: as many whole rulings as fit, then fewer, then the count. No touch words with a controller (the tile shows its A glyph); touch gets a neutral "read all ›". */
@Composable
internal fun DualRulingsBody(texts: List<String>) {
    val pad by Pad.connected.collectAsState()
    val n = texts.size
    val shows = (minOf(n, 3) downTo 1).toList()
    FitFirst(shows.size + 1, Modifier.fillMaxSize()) { i, _ ->
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (i < shows.size) {
                texts.take(shows[i]).forEach { SymText(it, Rule.Type.S13) }
                val more = n - shows[i]
                val note = if (more > 0) (if (pad) "$more more rulings" else "$more more rulings · read all ›") else if (pad) null else "Read in full ›"
                if (note != null) Text(note, style = Rule.Type.sans(12, FontWeight.SemiBold, Rule.Color.Gold))
            } else {
                Row(Modifier.heightIn(min = 40.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                    // Count and words on one baseline (the big count must not hang below "official rulings").
                    Text("$n", style = Rule.Type.sans(28, FontWeight.ExtraBold, Rule.Color.Text), maxLines = 1, modifier = Modifier.alignByBaseline())
                    Text(if (pad) "official rulings" else "official rulings ›", style = Rule.Type.S13, modifier = Modifier.alignByBaseline())
                }
            }
        }
    }
}

/** Text whose {T} / {G} symbols draw with Play's own renderer ([symbols]), never as raw braces. */
@Composable
internal fun SymText(s: String, style: androidx.compose.ui.text.TextStyle, modifier: Modifier = Modifier) {
    val built = remember(s) { val inline = HashMap<String, androidx.compose.foundation.text.InlineTextContent>(); androidx.compose.ui.text.buildAnnotatedString { symbols(s, inline) } to inline }
    Text(built.first, style = style, inlineContent = built.second, modifier = modifier)
}

/** The set tile, one layout for Play and Collection: symbol, name and line on top; "x of N", the percent and the bar at the foot. */
@Composable
internal fun DualSetBody(icon: (@Composable () -> Unit)?, title: String, line: String?, count: String, pct: String?, fill: Float?, caption: String? = null, lineContent: (@Composable () -> Unit)? = null) =
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val compact = maxHeight < 84.dp; val tall = maxHeight >= 120.dp
        // Y2: a coverage caption needs room, so the gaps close up and the caption ends in "…" rather than being cut off by the tile.
        val gap = if (caption.isNullOrBlank()) 10.dp else 6.dp
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(gap, Alignment.CenterVertically)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (icon != null && !compact) icon()
                Column(Modifier.weight(1f)) {
                    Text(title, style = Rule.Type.S14.copy(fontWeight = FontWeight.Bold), maxLines = 1)
                    if (lineContent != null) lineContent() else if (!line.isNullOrBlank()) Text(line, style = Rule.Type.S12.copy(color = Rule.Color.Muted), maxLines = 1)
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(count, style = Rule.Type.S13.copy(fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f), maxLines = 1)
                    if (!pct.isNullOrBlank()) Text(pct, style = Rule.Type.sans(if (compact) 13 else 16, FontWeight.Bold, Rule.Color.Text), maxLines = 1)
                }
                if (fill != null) ProgressBar(fill.coerceIn(0f, 1f))
                if (!caption.isNullOrBlank() && !compact) Text(caption, style = Rule.Type.S12.copy(color = Rule.Color.Muted), maxLines = if (tall) 2 else 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
        }
    }

/** A tap row inside a tile ("Its pack at the Merchant ›"). */
@Composable
internal fun TileLink(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, size: Int = 14) = Row(modifier.fillMaxWidth().heightIn(min = 40.dp).clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(label, style = Rule.Type.sans(size, FontWeight.SemiBold, Rule.Color.Text), modifier = Modifier.weight(1f, fill = false))
    Text("›", style = Rule.Type.sans(size, FontWeight.Bold, Rule.Color.Gold))
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
        Box(Modifier.fillMaxSize()) { GlassBackdrop(art, frost) }
        androidx.compose.runtime.CompositionLocalProvider(LocalFrost provides frost) {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = g, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(g)) {
                Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(g)) {
                    sections.filter { it.tiles.isNotEmpty() }.forEach { s ->
                        // One grid: every section shares the height evenly, every tile in a row takes one of the same equal columns (a lone tile spans both).
                        Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            DualHeading(s.title)
                            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(g)) {
                                s.tiles.forEach { t -> Box(Modifier.weight(1f).fillMaxHeight()) { t.content() } }
                            }
                        }
                    }
                }
                CaseButtonRow(buttons, Modifier.fillMaxWidth().height(Rule.CaseButtonHeight), gap = g)
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
