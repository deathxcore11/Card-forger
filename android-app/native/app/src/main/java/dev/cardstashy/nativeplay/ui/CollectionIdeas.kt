package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject

/**
 * Collection › Decks › Ideas: the tab's body as the site's own markup leaves it (CollectionEngine.decksPanel: views.js ideasView for Magic,
 * tcg.js ideasView for Yu-Gi-Oh! and Pokémon), drawn natively with the site's rules for each part; every word, state and order is the
 * markup's. A tap or a change goes back to the site's listeners through [SiteUi] (the node's id), as SitePanel's do.
 *
 * Magic: .panel.build-own (Build from my cards, Analyze / ↻ Re-analyze, Owned commanders only, the strategy select), the Reading your
 * collection overlay or the status line, the idea cards (.deck-grid › article.idea), Show more, and the empty states.
 * Yu-Gi-Oh! / Pokémon: .panel.build-own (⚒ Use my whole collection, ☑ Pick cards to build around), Archetypes you own / Pokémon you can
 * build around (.collection-ideas-grid), Tournament decks you're closest to (.meta-row) and its loading or error line.
 */
@Composable
fun DecksTabBody(p: SitePanelModel?, ui: SiteUi, glyphs: Map<String, SiteSvg>, gutter: Dp, screen: Dp) {
    val page = p?.page
    Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (page == null) { Text("Opening…", style = cssType(15f, 400, 21.75f, Site.Muted)); return@Column }
        for (n in page.elements) if (!n.hidden) IdeasBlock(n, ui, glyphs, screen)
    }
}

/** icons.js decorateGlyphs: a label that starts with one of its glyphs and a space wears that icon in its place. */
private fun lead(label: String, glyphs: Map<String, SiteSvg>): Pair<SiteSvg?, String> = leadGlyph(label, glyphs)
internal fun leadGlyph(label: String, glyphs: Map<String, SiteSvg>): Pair<SiteSvg?, String> {
    val m = Regex("^\\s*(\\S)\\uFE0F?[ \\u00a0](?=\\S)").find(label) ?: return null to label
    val icon = glyphs[m.groupValues[1]] ?: return null to label
    return icon to label.substring(m.value.length)
}
private fun SiteNode.cls(c: String) = has(c)
private fun SiteNode.all(ok: (SiteNode) -> Boolean): List<SiteNode> { val out = mutableListOf<SiteNode>(); fun walk(n: SiteNode) { for (k in n.elements) { if (ok(k)) out += k; walk(k) } }; walk(this); return out }
private fun SiteNode.one(ok: (SiteNode) -> Boolean): SiteNode? = find(ok)
private fun widthPct(n: SiteNode?): Float = Regex("width:\\s*([\\d.]+)%").find(n?.get("style").orEmpty())?.groupValues?.get(1)?.toFloatOrNull()?.div(100f) ?: 0f

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeasBlock(n: SiteNode, ui: SiteUi, glyphs: Map<String, SiteSvg>, screen: Dp) {
    when {
        n.cls("build-own") -> BuildOwn(n, ui, glyphs)
        n.cls("build-overlay") -> BuildOverlayPop(n.one { it.tag == "b" }?.text().orEmpty(), n.one { it["role"] == "status" }?.text().orEmpty(), n.one { it.tag == "small" }?.text().orEmpty())
        n.cls("empty") -> IdeasEmpty(n, ui, glyphs)
        n.cls("deck-grid") -> {
            // .deck-grid: one column, two from 640, three from 1000; 12 apart.
            val cols = if (screen >= 1000.dp) 3 else if (screen >= 640.dp) 2 else 1
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                n.elements.filter { it.tag == "article" }.chunked(cols).forEach { line ->
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        line.forEach { IdeaCard(it, ui, glyphs, Modifier.weight(1f).fillMaxHeight()) }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        n.cls("collection-ideas-grid") -> {
            // .collection-ideas-grid (style.css 3872, 3890-3891): one column, two from 680, three from 1100; 14 apart.
            val cols = if (screen >= 1100.dp) 3 else if (screen >= 680.dp) 2 else 1
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                n.elements.filter { it.tag == "article" }.chunked(cols).forEach { line ->
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        line.forEach { CollectionIdea(it, ui, glyphs, Modifier.weight(1f).fillMaxHeight()) }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        n.cls("section-head") -> Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(n.one { it.tag == "h2" }?.text().orEmpty(), Modifier.weight(1f), style = cssType(19f, 800, 21.85f, Site.Text, -.38f))
            n.one { it.tag == "button" }?.let { b -> IdeaLink(b, ui) }
        }
        n.cls("list") -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { n.elements.filter { it.cls("meta-row") }.forEach { MetaRowCard(it, ui) } }
        n.cls("note") -> Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1AF2C66D)).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(n.kids.filterIsInstance<String>().joinToString("").trim(), Modifier.weight(1f), style = cssType(13.5f, 400, 19.6f, Color(0xFFF6DBA2)))
            n.one { it.tag == "button" }?.let { b -> IdeaLink(b, ui) }
        }
        n.tag == "button" -> IdeaButton(n, ui, glyphs, Modifier.fillMaxWidth())
        n.tag == "p" -> {
            // p.muted.small (status, loading), p.muted (No ideas match this filter.), .center.
            val small = n.cls("small")
            Text(n.text(), Modifier.fillMaxWidth().semantics { if (n["role"] == "status") stateDescription = n.text() },
                style = cssType(if (small) 13f else 15f, 400, if (small) 18.85f else 21.75f, Site.Muted), textAlign = if (n.cls("center")) TextAlign.Center else TextAlign.Start)
        }
        else -> n.text().takeIf { it.isNotBlank() }?.let { Text(it, style = cssType(15f, 400, 21.75f, Site.Text)) }
    }
}

/** .panel.build-own: the glass panel (14 corners), h3 15 / 700, the muted words, then its toolbar or actions. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BuildOwn(n: SiteNode, ui: SiteUi, glyphs: Map<String, SiteSvg>) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Color(0x851F232B)).border(1.dp, Color(0x31EDC980), shape).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        n.one { it.tag == "h3" }?.let { Text(it.text(), style = cssType(16f, 700, 22f, Site.Text)) }
        n.one { it.tag == "p" }?.let { Text(it.text(), style = cssType(13f, 400, 18.85f, Site.Muted)) }
        val bar = n.one { it.cls("toolbar") || it.cls("actions") }
        // .toolbar / .actions: flex, wrapping, 8 apart (style.css 148).
        if (bar != null) FlowRow(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            for (k in bar.elements) when {
                k.tag == "button" -> IdeaButton(k, ui, glyphs)
                k.tag == "label" && k.cls("check") -> IdeaCheck(k, ui)
                // A select is as wide as its widest option (no width set, views.js 948), so it shares the toolbar's line where it fits.
                k.tag == "select" -> Box(Modifier.width(IntrinsicSize.Max)) {
                    val opts = k.elements.filter { it.tag == "option" }.map { (it["value"] ?: it.text()) to it.text() }
                    // The widest option, unseen, sizes the field (13 + 13 sides, 10 gap, the 9 arrow).
                    Column(Modifier.height(0.dp).alpha(0f).padding(start = 13.dp, end = 45.dp)) { opts.forEach { Text(it.second, style = cssType(15f, 400, 21.75f, Site.Text), maxLines = 1, softWrap = false) } }
                    val picked = k.value ?: k.elements.firstOrNull { it.tag == "option" && "selected" in it.attrs }?.let { it["value"] ?: it.text() } ?: opts.firstOrNull()?.first.orEmpty()
                    FormSelect(opts, picked, cssType(15f, 400, 21.75f, Site.Text), desc = k["aria-label"].orEmpty()) { v -> ui.type(k.id, v) }
                }
            }
        }
    }
}

/** label.check (style.css 135, 5609): 13.5 / 500, the gold-ticked box 12 from its words, 44 tall; a tap sends the change (app.js C.ideasOwned reads checked). */
@Composable
private fun IdeaCheck(l: SiteNode, ui: SiteUi) {
    val box = l.one { it.tag == "input" } ?: return
    val on = "checked" in box.attrs
    val gold = LocalGameGold.current
    Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(8.dp)).clickable { ui.type(box.id, (!on).toString()) }
        .semantics { role = Role.Checkbox; stateDescription = if (on) "Checked" else "Not checked" }.padding(end = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(20.dp).clip(RoundedCornerShape(5.dp)).background(if (on) gold else Color.Transparent).border(1.5.dp, if (on) gold else Site.Muted, RoundedCornerShape(5.dp)),
            contentAlignment = Alignment.Center) { if (on) Text("✓", style = cssType(13f, 800, 14f, Site.GoldInk)) }
        Text(l.text(), style = cssType(13.5f, 500, 19.6f, Site.Text))
    }
}

/** .btn (the game's gold; .ghost glass with its line; .small 34 tall at 13.5), with its leading glyph's icon; dimmed when disabled. */
@Composable
internal fun IdeaButton(n: SiteNode, ui: SiteUi, glyphs: Map<String, SiteSvg>, modifier: Modifier = Modifier) {
    val disabled = "disabled" in n.attrs
    val ghost = n.cls("ghost"); val small = n.cls("small")
    val (icon, label) = lead(n.text(), glyphs)
    val gold = LocalGameGold.current
    val shape = RoundedCornerShape(11.dp)
    val ink = if (ghost) Site.Text else Site.GoldInk
    Row(modifier.heightIn(min = 44.dp).alpha(if (disabled) .55f else 1f).clip(shape).background(if (ghost) Color(0x851F232B) else gold)
        .then(if (ghost) Modifier.border(1.dp, Color(0x31EDC980), shape) else Modifier).clickable(enabled = !disabled) { ui.tap(n.id) }
        .semantics { role = Role.Button; n["aria-label"]?.let { contentDescription = it } }.padding(horizontal = if (small) 12.dp else 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) SiteIcon(icon, if (small) 15.dp else 17.dp, ink, stroke = 2f)
        Text(label, style = cssType(if (small) 13.5f else 15f, 700, if (small) 19.6f else 21.75f, ink), textAlign = TextAlign.Center)
    }
}

@Composable
private fun IdeaLink(b: SiteNode, ui: SiteUi) {
    Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(6.dp)).clickable { ui.tap(b.id) }.semantics { role = Role.Button }.padding(horizontal = 4.dp), contentAlignment = Alignment.Center) {
        Text(b.text(), style = cssType(14f, 600, 20.3f, LocalGameGold.current))
    }
}

/** ui.js empty(): the game's mark, h3 18 / 700, the muted words, its buttons centred and wrapping. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeasEmpty(n: SiteNode, ui: SiteUi, glyphs: Map<String, SiteSvg>) {
    Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(n.one { it.tag == "h3" }?.text().orEmpty(), style = cssType(18f, 700, 25f, Site.Text), textAlign = TextAlign.Center)
        Text(n.one { it.tag == "p" }?.text().orEmpty(), style = cssType(15f, 400, 22f, Site.Muted), textAlign = TextAlign.Center)
        val buttons = n.all { it.tag == "button" }
        if (buttons.isNotEmpty()) FlowRow(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(8.dp)) { buttons.forEach { IdeaButton(it, ui, glyphs) } }
    }
}

/**
 * article.idea (16 corners): the commander's art (120 tall, its plan chip on top) as a button, then the body (12 in): the name (.idea-title 15 / 800, a 44 target),
 * the reason, "<b>n</b>/100 from your cards" and "n on-plan", the thin owned bar, View deck and Save as deck.
 */
@Composable
private fun IdeaCard(n: SiteNode, ui: SiteUi, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    val shape = RoundedCornerShape(16.dp)
    val artBtn = n.one { it.cls("idea-art") }; val body = n.one { it.cls("idea-body") }
    Column(modifier.clip(shape).background(Color(0xFF171A20)).border(1.dp, Color(0xFF2A2F39), shape)) {
        if (artBtn != null) Box(Modifier.fillMaxWidth().height(120.dp).clickable { ui.tap(artBtn.id) }.semantics { role = Role.Button; contentDescription = artBtn["aria-label"].orEmpty() }) {
            val src = artBtn.one { it.tag == "img" }?.pic.orEmpty()
            val pnt = if (src.size > 1) firstOf(src) else heroPainter(src.firstOrNull()?.let(homeArt))
            if (pnt != null) Image(pnt, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = androidx.compose.ui.BiasAlignment(0f, -.4f))
            artBtn.one { it.cls("chip") }?.let { c ->
                Text(c.text(), Modifier.padding(8.dp).clip(RoundedCornerShape(999.dp)).background(Color(0x8C000000)).border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(999.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp), style = cssType(12f, 700, 17.4f, Color.White))
            }
        }
        if (body != null) Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            body.one { it.cls("idea-title") }?.let { t ->
                Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { ui.tap(t.id) }.semantics { role = Role.Button }, contentAlignment = Alignment.CenterStart) {
                    Text(t.text(), style = cssType(15f, 800, 21.75f, Site.Text))
                }
            }
            body.one { it.tag == "small" }?.let { Text(it.text(), style = cssType(13f, 400, 18.85f, Site.Muted)) }
            body.one { it.cls("row") }?.let { r ->
                val spans = r.elements.filter { it.tag == "span" }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    spans.getOrNull(0)?.let { s ->
                        val b = s.one { it.tag == "b" }?.text().orEmpty()
                        Text(androidx.compose.ui.text.buildAnnotatedString {
                            pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.ExtraBold)); append(b); pop(); append(s.text().removePrefix(b))
                        }, style = cssType(13f, 400, 18.85f, Site.Text))
                    }
                    spans.getOrNull(1)?.let { Text(it.text(), style = cssType(13f, 400, 18.85f, Site.Text)) }
                }
            }
            body.one { it.cls("bar") }?.let { bar ->
                Box(Modifier.padding(top = 4.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(99.dp)).background(Color(0xFF1F232B))) {
                    Box(Modifier.fillMaxWidth(widthPct(bar.one { it.tag == "span" }).coerceIn(0f, 1f)).fillMaxHeight().clip(RoundedCornerShape(99.dp))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFC08A3A), Color(0xFFE8B95B)))))
                }
            }
            body.one { it.cls("actions") }?.let { a ->
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { a.elements.filter { it.tag == "button" }.forEach { IdeaButton(it, ui, glyphs) } }
            }
        }
    }
}

/**
 * article.collection-idea (tcg.js; style.css 3873-3888, 16 corners): the group's cover card art (168 tall; Yu-Gi-Oh!'s cropped art,
 * Pokémon's art window) opening its card, then the body (12 in, 8 apart): the group's name (15, 1.35, wrapping), "n cards · n copies"
 * and its meta line in the ok colour (12 / 1.45, 3 apart), and ⚒ Build (at least 82 wide), 12 beside them.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CollectionIdea(n: SiteNode, ui: SiteUi, glyphs: Map<String, SiteSvg>, modifier: Modifier) {
    val shape = RoundedCornerShape(16.dp)
    val open = n.one { it.cls("idea-card-open") }
    Column(modifier.clip(shape).background(Color(0xFF171A20)).border(1.dp, Color(0xFF2A2F39), shape)) {
        if (open != null) Box(Modifier.fillMaxWidth().height(168.dp).background(Color(0xFF1F232B)).clickable { ui.tap(open.id) }
            .semantics { role = Role.Button; contentDescription = open["aria-label"].orEmpty() }) {
            val src = open.one { it.tag == "img" }?.pic.orEmpty()
            val raw = if (src.size > 1) firstOf(src) else heroPainter(src.firstOrNull()?.let(homeArt))
            val pk = open.one { it.cls("pk-crop") } != null
            val pnt = if (pk && raw != null) remember(raw) { PkArtCrop(raw) } else raw
            if (pnt != null) Image(pnt, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = if (pk) Alignment.Center else androidx.compose.ui.BiasAlignment(0f, -.3f))
        }
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // b.idea-card-name: bold, 15, line-height 1.35, overflow-wrap anywhere (no clamp).
            n.one { it.cls("idea-card-name") }?.let { Text(it.text(), style = cssType(15f, 700, 20.25f, Site.Text)) }
            val foot = n.one { it.cls("idea-card-foot") }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    foot?.one { it.cls("idea-card-facts") }?.elements?.forEach { s ->
                        Text(s.text(), style = cssType(12f, 400, 17.4f, if (s.cls("ok-text")) Color(0xFF6FD29A) else Site.Muted))
                    }
                }
                foot?.one { it.tag == "button" }?.let { IdeaButton(it, ui, glyphs, Modifier.align(Alignment.Bottom).widthIn(min = 82.dp)) }
            }
        }
    }
}

// tcg.js metaDeckRow's rows are MetaRowCard (CollectionMetaDecks.kt, polish.css's .meta-row), as Meta decks draws them.

/** Parsed once: icons.js's leading glyphs (CollectionEngine.glyphs). */
internal fun glyphMap(j: JsonObject): Map<String, SiteSvg> = j.entrySet().mapNotNull { (k, v) -> v.takeIf { it.isJsonObject }?.let { CollectionCardsModel.svg(it.asJsonObject) }?.let { k to it } }.toMap()
