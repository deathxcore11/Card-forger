package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Collection › Decks › Meta decks: the tab's body as the site's markup leaves it (CollectionEngine.decksPanel with "inspiration": views.js
 * inspirationView for Magic, tcg.js metaView for Yu-Gi-Oh! and Pokémon), drawn natively; every word, state and order is the markup's, and
 * a tap goes back to the site's listeners through [SiteUi] (the node's id).
 *
 * The Tournament results panel (its format chips, the source line that opens, loading and error lines, Top decks right now's art tiles,
 * Most played cards, Recent top lists' rows, a format with no feed, the credit) is drawn here with polish.css's rules for it; Magic's
 * finder, Saved decks and Precons panels go through the site's block flow ([SitePanel]), as other site panels do.
 */
@Composable
fun MetaTabBody(p: SitePanelModel?, ui: SiteUi, glyphs: Map<String, SiteSvg>, gutter: Dp, screen: Dp) {
    val page = p?.page
    androidx.compose.runtime.CompositionLocalProvider(LocalSiteGlyphs provides glyphs) { Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (page == null) { Text("Opening…", style = cssType(15f, 400, 21.75f, Site.Muted)); return@Column }
        // Runs of the other blocks share one flow (their margins meet as the site's do).
        val rest = ArrayList<SiteNode>()
        @Composable fun flush() { if (rest.isNotEmpty()) { SiteNodes(rest.toList(), ui); rest.clear() } }
        for (n in page.elements) {
            if (n.hidden) continue
            if (n.tag == "section" && n.find { it.has("fmt-chips") } != null) { flush(); TournamentPanel(n, ui, screen) } else rest += n
        }
        flush()
    } }
}

/** Site markup through the site's block flow ([SitePanel]): [nodes] as one page. */
@Composable
internal fun SiteNodes(nodes: List<SiteNode>, ui: SiteUi) {
    val page = SiteNode("div", 0, emptyMap(), nodes, null, null)
    SitePanel(SitePanelModel("", SiteNode("body", 0, emptyMap(), listOf(page), null, null), null, null), ui, padded = false)
}

/** An <img>'s picture as the site's onerror walks it (its fallbacks), or its one address. */
@Composable
internal fun nodePainter(img: SiteNode?): Painter? {
    val src = img?.pic.orEmpty()
    return if (src.size > 1) firstOf(src) else heroPainter(src.firstOrNull()?.takeIf { it.isNotBlank() }?.let(homeArt))
}

private val Warn = Color(0xFFF2C66D)

/** section.panel (.tournament-panel): the glass panel (14 corners, 14 in), its h3, then each part in the markup's order. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TournamentPanel(n: SiteNode, ui: SiteUi, screen: Dp) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Color(0x851F232B)).border(1.dp, Color(0x31EDC980), shape).padding(14.dp)) {
        for (k in n.elements) {
            if (k.hidden) continue
            when {
                k.tag == "h3" -> Text(k.text(), style = cssType(16f, 700, 22f, Site.Text))
                k.has("fmt-chips") -> FmtChips(k, ui)
                k.tag == "details" && k.has("meta-source") -> MetaSource(k)
                k.has("note") -> NoteLink(k, ui, Modifier.padding(vertical = 8.dp))
                k.has("section-head") -> SectionHead(k, ui)
                k.has("arch-grid") -> ArchGrid(k, ui, screen)
                k.has("chips") -> FlowRow(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    k.elements.filter { it.tag == "button" }.forEach { PlayedChip(it, ui) }
                }
                k.has("list") -> Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { k.elements.filter { it.has("meta-row") }.forEach { MetaRowCard(it, ui) } }
                k.has("meta-format-empty") -> FormatEmpty(k, ui)
                k.tag == "p" && k.has("foot") -> Box(Modifier.padding(top = 12.dp)) { SiteNodes(listOf(k), ui) }
                k.tag == "p" -> Text(k.text(), Modifier.fillMaxWidth().padding(vertical = if (k.has("pad")) 18.dp else 4.dp).semantics { if (k["role"] == "status") stateDescription = k.text() },
                    style = cssType(13f, 400, 18.85f, if (k.has("warn-text")) Warn else Site.Muted), textAlign = if (k.has("center")) TextAlign.Center else TextAlign.Start)
                else -> SiteNodes(listOf(k), ui)
            }
        }
    }
}

/** .fmt-chips (14 above and below, 8 apart, wrapping) of .chip.pick (13 / 700, 7 × 12, 44 tall on a phone), the chosen one gold. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FmtChips(k: SiteNode, ui: SiteUi) {
    val gold = LocalGameGold.current; val ink = LocalSheetPal.current.ink
    FlowRow(Modifier.fillMaxWidth().padding(vertical = 14.dp).semantics { k["aria-label"]?.let { contentDescription = it } },
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (b in k.elements.filter { it.tag == "button" }) {
            val on = b.has("on")
            Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).background(if (on) gold else Site.Surface2).border(1.dp, if (on) gold else Site.Line, RoundedCornerShape(999.dp))
                .clickable { ui.tap(b.id) }.semantics { role = Role.Button; stateDescription = if (on) "Selected" else "" }.padding(horizontal = 12.dp, vertical = 7.dp),
                contentAlignment = Alignment.Center) { Text(b.text(), style = cssType(13f, 700, 18.85f, if (on) ink else Site.Text), maxLines = 1, softWrap = false) }
        }
    }
}

/** details.meta-source: the one-line summary (12, muted at .8, its chevron turning as it opens) and, open, the paragraph under it. */
@Composable
private fun MetaSource(d: SiteNode) {
    var open by remember(d.id) { mutableStateOf("open" in d.attrs) }
    val sum = d.elements.firstOrNull { it.tag == "summary" }
    Column(Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 14.dp)) {
        Row(Modifier.heightIn(min = 44.dp).alpha(if (open) 1f else .8f).clickable { open = !open }
            .semantics { role = Role.Button; stateDescription = if (open) "Expanded" else "Collapsed" }, verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(buildAnnotatedString {
                for (k in sum?.kids.orEmpty()) when (k) {
                    is String -> append(k)
                    is SiteNode -> if (k.has("warn-text")) withStyle(SpanStyle(color = Warn)) { append(k.text()) } else append(k.text())
                }
            }, Modifier.weight(1f, fill = false), style = cssType(12f, 400, 17.4f, Site.Muted))
            Box(Modifier.size(6.dp).rotate(if (open) -135f else 45f).drawBehind {
                val w = 1.5.dp.toPx()
                drawLine(Site.Muted, Offset(size.width, 0f), Offset(size.width, size.height), w)
                drawLine(Site.Muted, Offset(0f, size.height), Offset(size.width, size.height), w)
            })
        }
        if (open) d.elements.firstOrNull { it.tag == "p" }?.let { Text(it.text(), Modifier.padding(top = 4.dp).widthIn(max = 560.dp), style = cssType(12f, 400, 18f, Site.Muted)) }
    }
}

/** .note.warn with its link button (Try again). */
@Composable
private fun NoteLink(n: SiteNode, ui: SiteUi, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1AF2C66D)).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(n.kids.filterIsInstance<String>().joinToString("").trim(), Modifier.weight(1f), style = cssType(13.5f, 400, 19.6f, Color(0xFFF6DBA2)))
        n.find { it.tag == "button" }?.let { b -> MetaLink(b, ui) }
    }
}

@Composable
private fun MetaLink(b: SiteNode, ui: SiteUi) {
    // icons.js decorateGlyphs: a leading glyph (⟳) wears its icon.
    val (icon, label) = leadGlyph(b.text(), LocalSiteGlyphs.current)
    val gold = LocalGameGold.current; val size = if (b.has("small")) 13f else 14f
    Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(6.dp)).clickable { ui.tap(b.id) }.semantics { role = Role.Button }.padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) SiteIcon(icon, (size + 2f).dp, gold, stroke = 2f)
        Text(label, style = cssType(size, 600, 20f, gold))
    }
}

/** .section-head: h2 (19 / 800) and its link at the right (⟳ Refresh). */
@Composable
private fun SectionHead(n: SiteNode, ui: SiteUi) {
    Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(n.find { it.tag == "h2" }?.text().orEmpty(), Modifier.weight(1f), style = cssType(19f, 800, 21.85f, Site.Text, -.38f))
        n.find { it.tag == "button" }?.let { b -> MetaLink(b, ui) }
    }
}

/** .arch-grid: one column under 420, two to 760, three to 1100, then four; 12 apart (8 under 760). */
@Composable
private fun ArchGrid(n: SiteNode, ui: SiteUi, screen: Dp) {
    val cols = when { screen < 420.dp -> 1; screen < 760.dp -> 2; screen < 1100.dp -> 3; else -> 4 }
    val gap = if (screen < 760.dp) 8.dp else 12.dp
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        n.elements.filter { it.has("arch") }.chunked(cols).forEach { line ->
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                line.forEach { ArchTile(it, ui, screen, Modifier.weight(1f).fillMaxHeight()) }
                repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** The gold hairline polish.css draws round a tile or row (::after: 155° gold, glass, gold). */
private fun Modifier.hairline(radius: Dp, strong: Boolean) = drawWithContent {
    drawContent()
    val px = 1.dp.toPx(); val d = Offset(size.width * .42f, size.height * .91f)
    val stops = if (strong) arrayOf(0f to Color(0xB3F1D08A), .26f to Color(0x38FFFFFF), .52f to Color(0x12FFFFFF), .7f to Color(0x0AFFFFFF), 1f to Color(0x66F1D08A))
        else arrayOf(0f to Color(0x80F1D08A), .3f to Color(0x24FFFFFF), .6f to Color(0x0DFFFFFF), 1f to Color(0x40F1D08A))
    drawRoundRect(Brush.linearGradient(*stops, start = center - d, end = center + d), topLeft = Offset(px / 2, px / 2), size = Size(size.width - px, size.height - px),
        cornerRadius = CornerRadius(radius.toPx()), style = Stroke(px))
}

private val Shade = Shadow(Color(0xBB000000), Offset(0f, 1f), 4f)

/**
 * .arch (polish.css 538-556): the archetype's art full bleed (cover, 50 % 30 %) under a shade rising from the foot, then its body: the
 * Cinzel 16 name (two lines at most), the small line, the gold 3 bar; Pokémon's icons at the top right, "Art unavailable" at the top
 * left when there is no art. 212 tall (176 under 420), 18 corners; a tile with no list is dimmed by nothing and taps nothing.
 */
@Composable
private fun ArchTile(n: SiteNode, ui: SiteUi, screen: Dp, modifier: Modifier) {
    val disabled = "disabled" in n.attrs
    val shape = RoundedCornerShape(18.dp)
    val artNode = n.elements.firstOrNull { it.has("arch-art") }
    val img = if (artNode?.tag == "img") artNode else artNode?.find { it.tag == "img" }
    val pk = artNode?.has("pk-crop") == true
    val body = n.elements.firstOrNull { it.has("arch-body") }
    Box(modifier.heightIn(min = if (screen < 420.dp) 176.dp else 212.dp).clip(shape).background(Color(0xFF0D0F15))
        .clickable(enabled = !disabled) { ui.tap(n.id) }.semantics { role = Role.Button }.hairline(18.dp, strong = true)) {
        val raw = if (img != null && img["hidden"] == null) nodePainter(img) else null
        val pnt = if (pk && raw != null) remember(raw) { PkArtCrop(raw) } else raw
        if (pnt != null) Image(pnt, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop, alignment = androidx.compose.ui.BiasAlignment(0f, -.4f))
        else Box(Modifier.matchParentSize().background(Brush.radialGradient(listOf(LocalGameGold.current.copy(alpha = .14f), Color.Transparent), Offset(90f, 50f), 400f)))
        // ::before: #0b0e15 .96 at the foot, .72 at 38 %, .25 at 64 %, clear by 82 %.
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, .18f to Color.Transparent, .36f to Color(0x400B0E15), .62f to Color(0xB80B0E15), 1f to Color(0xF50B0E15))))
        if (pnt == null) n.elements.firstOrNull { it.has("arch-art-state") }?.let {
            Text(it.text(), Modifier.padding(start = 12.dp, top = 14.dp).widthIn(max = 160.dp), style = cssType(11f, 400, 14.3f, Site.Muted))
        }
        n.elements.firstOrNull { it.has("arch-icons") }?.takeIf { it.elements.isNotEmpty() }?.let { icons ->
            Row(Modifier.align(Alignment.TopEnd).padding(10.dp).clip(RoundedCornerShape(99.dp)).background(Color(0xB80D1017)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(99.dp))
                .padding(horizontal = 5.dp, vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                icons.elements.filter { it.tag == "img" }.forEach { i -> nodePainter(i)?.let { Image(it, null, Modifier.size(24.dp)) } }
            }
        }
        if (body != null) Column(Modifier.align(Alignment.BottomStart).fillMaxWidth()
            .background(Brush.verticalGradient(0f to Color.Transparent, .4f to Color(0x660B0E15), 1f to Color(0xA60B0E15))).padding(start = 14.dp, end = 14.dp, top = 30.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)) {
            body.find { it.tag == "b" }?.let { Text(it.text(), maxLines = 2, overflow = TextOverflow.Ellipsis,
                style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 19.2.sp, letterSpacing = .32.sp, color = Color(0xFFF8F1E1), shadow = Shade)) }
            body.elements.filter { it.tag == "small" }.forEach { s ->
                Text(s.text(), style = if (s.has("arch-list-state")) cssType(11f, 400, 14.85f, Site.Muted) else cssType(11f, 400, 15.95f, Color(0xFFDFE3EA)).copy(shadow = Shade))
            }
            body.find { it.has("bar") }?.let { bar -> GoldBar(widthPct(bar.find { it.tag == "span" }), Modifier.padding(top = 4.dp).fillMaxWidth()) }
        }
    }
}

private fun widthPct(n: SiteNode?): Float = Regex("width:\\s*([\\d.]+)%").find(n?.get("style").orEmpty())?.groupValues?.get(1)?.toFloatOrNull()?.div(100f) ?: 0f

/** .bar in a tile or row (polish.css): 3 tall on white .1, the fill gold (#c9a45c to #f1d08a). */
@Composable
private fun GoldBar(f: Float, modifier: Modifier) {
    Box(modifier.height(3.dp).clip(RoundedCornerShape(99.dp)).background(Color(0x1AFFFFFF))) {
        Box(Modifier.fillMaxWidth(f.coerceIn(0f, 1f)).fillMaxHeight().clip(RoundedCornerShape(99.dp)).background(Brush.horizontalGradient(listOf(Color(0xFFC9A45C), Color(0xFFF1D08A)))))
    }
}

/** Most played cards: .chip (12 / 700, 3 × 9; 44 tall here), the name and its share muted. */
@Composable
private fun PlayedChip(b: SiteNode, ui: SiteUi) {
    val pct = b.find { it.has("muted") }?.text().orEmpty()
    Box(Modifier.heightIn(min = 44.dp).clickable { ui.tap(b.id) }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        Text(buildAnnotatedString {
            append(b.text().removeSuffix(pct).trim()); append(" ")
            withStyle(SpanStyle(color = Site.Muted)) { append(pct) }
        }, Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp),
            style = cssType(12f, 700, 17.4f, Site.Text), maxLines = 1)
    }
}

/** .meta-format-empty: the format's name (h3), the muted line, Create a <format> deck (ghost, small) and View … results (link), wrapping 14 apart. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FormatEmpty(n: SiteNode, ui: SiteUi) {
    Column(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        n.find { it.tag == "h3" }?.let { Text(it.text(), style = cssType(16f, 700, 22f, Site.Text)) }
        n.find { it.tag == "p" }?.let { Text(it.text(), style = cssType(15f, 400, 21.75f, Site.Muted)) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            for (b in n.elements.filter { it.tag == "button" }) if (b.has("link")) MetaLink(b, ui) else IdeaButton(b, ui, LocalSiteGlyphs.current)
        }
    }
}

/**
 * .meta-row (polish.css 564-579): the deck's art a strip at the left (46 % of the row, 150 to 300) fading out to the right, the words
 * from 30 % in (96 to 190), 14 corners on #0f1219 with the gold hairline: the name (15 / 700), "place · event · players" muted, and
 * the owned bar with "n% owned · $x to finish". With no art the words start 14 in.
 */
@Composable
internal fun MetaRowCard(n: SiteNode, ui: SiteUi) {
    val shape = RoundedCornerShape(14.dp)
    val art = n.elements.firstOrNull { it.has("meta-art") }
    val img = art?.find { it.tag == "img" && !it.has("pk-icon") }
    val icons = art?.elements.orEmpty().filter { it.has("pk-icon") }
    val pk = art?.find { it.has("pk-crop") && !it.has("img-missing") } != null
    val hasArt = img != null || icons.isNotEmpty() || pk
    BoxWithConstraints(Modifier.fillMaxWidth().heightIn(min = 76.dp).clip(shape).background(Color(0xFF0F1219)).clickable { ui.tap(n.id) }.semantics { role = Role.Button }
        .hairline(14.dp, strong = false)) {
        val w = maxWidth
        if (hasArt) Box(Modifier.matchParentSize()) { Box(Modifier.width((w * .46f).coerceIn(150.dp, 300.dp)).fillMaxHeight()
            .drawWithContent {
                drawContent()
                // mask-image: linear-gradient(90deg, #000 35 %, transparent): the strip fades into the row.
                drawRect(Brush.horizontalGradient(.35f to Color.Transparent, 1f to Color(0xFF0F1219)))
            }, contentAlignment = Alignment.Center) {
            if (img != null) {
                val raw = nodePainter(img)
                val pnt = if (pk && raw != null) remember(raw) { PkArtCrop(raw) } else raw
                if (pnt != null) Image(pnt, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = androidx.compose.ui.BiasAlignment(0f, -.4f))
            } else if (icons.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { icons.forEach { i -> nodePainter(i)?.let { Image(it, null, Modifier.size(32.dp)) } } }
        } }
        val main = n.elements.firstOrNull { it.has("meta-main") }
        Column(Modifier.fillMaxWidth().padding(start = if (hasArt) (w * .3f).coerceIn(96.dp, 190.dp) else 14.dp, end = 14.dp, top = 12.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)) {
            // style.css 3478: the name wraps (overflow-wrap:anywhere); polish.css 757: the event line clamps at two lines.
            main?.elements?.firstOrNull { it.tag == "b" }?.let { Text(it.text(), style = cssType(15f, 700, 20f, Color(0xFFF5F6FA)).copy(shadow = Shade)) }
            main?.elements?.firstOrNull { it.tag == "small" }?.let { Text(it.text(), style = cssType(12.5f, 400, 17.5f, Color(0xFFC4CAD4)).copy(shadow = Shade), maxLines = 2, overflow = TextOverflow.Ellipsis) }
            main?.find { it.has("meta-own") }?.let { own ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GoldBar(widthPct(own.find { it.has("bar") }?.find { it.tag == "span" }), Modifier.weight(1f).padding(vertical = 4.dp))
                    own.find { it.tag == "small" }?.let { Text(it.text(), style = cssType(11f, 400, 15.95f, Color(0xFFC4CAD4)), maxLines = 1, softWrap = false) }
                }
            }
        }
    }
}
