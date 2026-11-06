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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.withStyle

/**
 * The Build decks sheet (tcg.js tcgBuildSheet for Yu-Gi-Oh! and Pokémon, views.js buildSheet for Magic; each version tier-card.js
 * tierCardHtml) as the engine reads it from the sheet's markup (buildSheetModel). Every button carries its node's id, which the app
 * taps in the sheet (the site's handlers run there).
 */
internal class TierBuildModel(val j: JsonObject) {
    class Btn(val id: Int, val label: String, val disabled: Boolean, val icon: SiteSvg?)
    class Note(val text: String, val warn: Boolean, val evidence: Boolean, val path: Boolean, val explain: Boolean)
    class Stat(val value: String, val text: String, val warn: Boolean, val diff: String)
    class TileRow(val id: Int, val card: DeckCard?, val name: String, val art: String, val qty: String, val why: String, val own: String, val ok: Boolean, val data: Map<String, String>)
    class Group(val name: String, val count: String, val rows: List<TileRow>)
    class More(val id: Int, val label: String, val note: String, val icon: SiteSvg?)
    class Tier(val i: Int, val on: Boolean, val meta: Boolean, val title: String, val chips: List<Triple<String, Boolean, Boolean>>, val stats: List<Stat>, val owned: Float?,
               val notes: List<Note>, val nextSummary: String, val nextLines: List<String>, val nextReview: Btn?, val groups: List<Group>,
               val save: Btn?, val buy: Btn?, val toggle: Btn?, val more: List<More>)
    val title = j.s("title").ifBlank { "Build decks" }
    val close: Int? = j.get("close")?.takeIf { it.isJsonPrimitive }?.asInt
    val seed = j.o("seed")
    val intro = j.s("intro")
    val formats = j.objs("formats").map { Btn(it.i("id"), it.s("label"), it.b("disabled"), null) to it.b("on") }
    val formatsEmpty = j.s("formatsEmpty")
    val budget = j.o("budget")
    val busy = j.o("busy")
    val status = j.o("status")
    val evidence = j.s("evidence")
    val saveAll = btn(j.o("saveAll"))
    val foot = j.s("foot")
    val openTier: Int? = j.get("openTier")?.takeIf { it.isJsonPrimitive }?.asInt
    val tiers = j.objs("tiers").map { t ->
        val next = t.o("next")
        Tier(t.i("i"), t.b("on"), t.b("meta"), t.s("title"), t.objs("chips").map { Triple(it.s("text"), it.b("ok"), it.b("warn")) },
            t.objs("stats").map { Stat(it.s("value"), it.s("text"), it.b("warn"), it.s("diff")) },
            t.get("owned")?.takeIf { it.isJsonPrimitive }?.asFloat,
            t.objs("notes").map { Note(it.s("text"), it.b("warn"), it.b("evidence"), it.b("path"), it.b("explain")) },
            next?.s("summary").orEmpty(), next?.get("lines")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty(), btn(next?.o("review")),
            t.objs("groups").map { g -> Group(g.s("name"), g.s("count"), g.objs("rows").map { r ->
                TileRow(r.i("id"), r.o("card")?.let { CollectionDeckModel.card(it) }, r.s("name"), r.s("art"), r.s("qty"), r.s("why"), r.s("own"), r.b("ok"),
                    r.o("data")?.entrySet()?.associate { (k, v) -> k to (if (v.isJsonPrimitive) v.asString else "") }.orEmpty())
            }) },
            btn(t.o("save")), btn(t.o("buy")), btn(t.o("toggle")), t.objs("more").map { More(it.i("id"), it.s("label"), it.s("note"), CollectionCardsModel.svg(it.o("icon"))) })
    }
    companion object {
        private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
        private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
        private fun JsonObject.i(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
        private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
        private fun btn(o: JsonObject?) = o?.let { Btn(it.i("id"), it.s("label"), it.b("disabled"), CollectionCardsModel.svg(it.o("icon"))) }
        internal fun JsonObject.str(k: String) = s(k)
    }
}

/** What the sheet's buttons do: [tap] a node in the sheet (the site's handler), [type] the budget field (C.tBuildCustom on change), [card] a tile's card. */
internal class TierBuildActions(val tap: (Int) -> Unit, val type: (Int, String) -> Unit, val close: () -> Unit, val card: (TierBuildModel.TileRow) -> Unit)

private val Good = Color(0xFF6FD29A)
private val Warn = Color(0xFFF2C66D)
private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TierBuildSheet(m: TierBuildModel, game: CardGame, backdrop: GraphicsLayer?, act: TierBuildActions) {
    val accent = LocalSheetPal.current.gold; val ink = LocalSheetPal.current.ink
    Box(Modifier.fillMaxSize()) {
        SiteSheet(m.title, backdrop, onClose = act.close, brand = true) { vw ->
            val narrow = vw < 540.dp
            m.seed?.let { SeedHead(it, narrow, act) }
            if (m.intro.isNotBlank()) Text(m.intro, Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 19.5f, Site.Muted))
            // .fmt-chips: the formats the card can build in (the chosen one in the accent), or why there are none.
            if (m.formats.isNotEmpty()) FlowRow(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((b, on) in m.formats) Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).background(if (on) accent else Site.Surface2)
                    .border(1.dp, if (on) accent else Site.Line, RoundedCornerShape(999.dp)).clickable(enabled = !b.disabled && !on) { act.tap(b.id) }
                    .semantics { role = Role.Button; stateDescription = if (on) "Selected" else "" }.padding(horizontal = 12.dp, vertical = 7.dp), contentAlignment = Alignment.Center) {
                    Text(b.label, style = cssType(13f, 700, 18.85f, if (on) ink else Site.Text).let { if (b.disabled && !on) it.copy(color = Site.Muted) else it }, maxLines = 1, softWrap = false)
                }
            } else if (m.formatsEmpty.isNotBlank()) Text(m.formatsEmpty, Modifier.padding(vertical = 10.dp), style = cssType(12f, 400, 18f, Site.Muted))
            // .custom-budget: "Purchase budget $" over its field (max 220); a change rebuilds every version (C.tBuildCustom).
            m.budget?.let { b -> with(TierBuildModel) {
                var text by remember(b.str("value")) { mutableStateOf(b.str("value")) }
                Column(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(b.str("label"), style = cssType(12f, 400, 18f, Site.Muted))
                    FormInput(text, { v -> text = v.filter { it.isDigit() }.take(6) }, cssType(14f, 400, 20f), b.str("placeholder"), Modifier.widthIn(max = 220.dp).fillMaxWidth(),
                        desc = b.str("label").trim(), keyboard = KeyboardType.Number, onGo = { if (text != b.str("value")) act.type(b.get("id").asInt, text) })
                }
            } }
            m.status?.let { s -> with(TierBuildModel) {
                Text(s.str("text"), Modifier.padding(vertical = 6.dp).semantics { contentDescription = s.str("text") },
                    style = cssType(12f, 400, 18f, if (s.get("warn")?.asBoolean == true) Warn else Site.Muted))
            } }
            if (m.busy == null && m.evidence.isNotBlank()) Evidence(m.evidence, accent)
            if (m.tiers.isNotEmpty()) Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for (t in m.tiers) TierCard(t, game, narrow, vw, m.openTier == t.i, accent, ink, act)
            }
            m.saveAll?.let { b -> DeckGhost(b.label, Modifier.fillMaxWidth(), minHeight = 48.dp) { act.tap(b.id) } }
            if (m.foot.isNotBlank()) Text(m.foot, Modifier.padding(top = 14.dp, bottom = 8.dp), style = cssType(12f, 400, 18f, Site.Muted))
        }
        // build-overlay.js: fixed over the page while the versions build.
        m.busy?.let { b -> with(TierBuildModel) {
            Box(Modifier.fillMaxSize().background(Color(0x9E06080C)).clickable(enabled = true, onClick = {}).padding(24.dp), contentAlignment = Alignment.Center) {
                BuildOverlayPop(b.str("title"), b.str("msg"), b.str("note"))
            }
        } }
    }
}

/** .build-seed: the card (56, 10 corners) and Built around / its name / its archetype or type, 🎲 Random card; several cards: their strip. */
@Composable
private fun SeedHead(s: JsonObject, narrow: Boolean, act: TierBuildActions) = with(TierBuildModel) {
    val random = s.getAsJsonObject("random")?.takeIf { !s.get("multi").asBoolean }
    val strip = s.getAsJsonArray("strip")?.map { it.asString }.orEmpty()
    val info: @Composable (Modifier) -> Unit = { mod ->
        Row(mod, horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (strip.isNotEmpty()) Row { strip.take(8).forEachIndexed { i, a ->
                Box(Modifier.offset(x = (-12 * i).dp).size(34.dp, 48.dp).border(2.dp, Site.Bg, RoundedCornerShape(4.dp)).clip(RoundedCornerShape(4.dp)).background(Site.Surface2)) {
                    heroPainter(homeArt(a))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                } } }
            else Box(Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)).background(Site.Surface2)) {
                heroPainter(homeArt(s.str("art")))?.let { Image(it, s.str("name"), Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
            }
            Column(Modifier.weight(1f, fill = false)) {
                Text(s.str("label"), style = cssType(12f, 400, 17f, Site.Muted))
                Text(s.str("name"), style = cssType(15f, 700, 21f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (s.str("sub").isNotBlank()) Text(s.str("sub"), style = cssType(12f, 400, 17f, Site.Muted), maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
    val rand: @Composable (Modifier) -> Unit = { mod -> random?.let { r ->
        Box(mod.alpha(if (r.get("disabled")?.asBoolean == true) .5f else 1f)) { DeckGhost(r.str("label"), minHeight = 44.dp, pad = 14.dp) { if (r.get("disabled")?.asBoolean != true) act.tap(r.get("id").asInt) } }
    } }
    if (narrow) Column(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        info(Modifier.fillMaxWidth()); if (random != null) rand(Modifier.align(Alignment.End))
    } else Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        info(Modifier.weight(1f)); rand(Modifier)
    }
}

/** .evidence: muted words behind a 3 accent rule on its 6 % wash, 6 corners on the right. */
@Composable
private fun Evidence(text: String, accent: Color) {
    Text(text, Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(topEnd = 6.dp, bottomEnd = 6.dp)).background(accent.copy(alpha = .06f))
        .drawBehind { drawRect(accent, size = Size(3.dp.toPx(), size.height)) }.padding(start = 11.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
        style = cssType(12f, 400, 18f, Site.Muted))
}

/**
 * tier-card.js article.tier: 1 line, 14 corners, 12 in on the surface (the open one ringed in the accent; a tournament list on its
 * accent wash); its title and chips, the stats (two columns under 540), the owned bar, the notes, the next improvement, the open list's
 * groups, and Save / Buy / See all / ⋯.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TierCard(t: TierBuildModel.Tier, game: CardGame, narrow: Boolean, vw: Dp, reveal: Boolean, accent: Color, ink: Color, act: TierBuildActions) {
    val shape = RoundedCornerShape(14.dp)
    val bring = remember { BringIntoViewRequester() }
    // A.tTier: the opened list brought into view.
    LaunchedEffect(reveal, t.on) { if (reveal && t.on) runCatching { bring.bringIntoView() } }
    Column(Modifier.fillMaxWidth().bringIntoViewRequester(bring).clip(shape).background(if (t.meta) lerpColor(Site.Surface, accent, .07f) else Site.Surface)
        .border(1.dp, if (t.on || t.meta) accent else Site.Line, shape).padding(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(t.title, Modifier.weight(1f), style = cssType(15f, 700, 21.75f))
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((text, ok, warn) in t.chips) Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp)) {
                    Text(text, style = cssType(12f, 700, 16f, if (ok) Good else if (warn) Warn else Site.Text), maxLines = 1, softWrap = false)
                }
            }
        }
        // .tier-stats: 13 muted with the value in the text colour; two columns on a phone, wrapping rows (4 × 14 apart) wider.
        val stat: @Composable (TierBuildModel.Stat, Modifier) -> Unit = { s, mod ->
            Row(mod, verticalAlignment = Alignment.CenterVertically) {
                if (s.diff.isNotBlank()) {
                    val (fg, bg) = when { s.diff.contains("easy") -> Color(0xFF4FD18B) to Color(0x1F4FD18B); s.diff.contains("hard") -> Color(0xFFFF7A6A) to Color(0x1FFF7A6A); else -> Color(0xFFFFC93C) to Color(0x1FFFC93C) }
                    Text(s.value, Modifier.clip(RoundedCornerShape(99.dp)).background(bg).padding(horizontal = 9.dp, vertical = 2.dp), style = cssType(12.5f, 700, 18f, fg))
                } else Text(androidx.compose.ui.text.buildAnnotatedString {
                    withStyle(androidx.compose.ui.text.SpanStyle(color = if (s.warn) Warn else Site.Text, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)) { append(s.value) }
                    if (s.text.isNotBlank()) { append(" "); append(s.text) }
                }, style = cssType(13f, 400, 19.5f, if (s.warn) Warn else Site.Muted))
            }
        }
        if (narrow) Column(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 2.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            t.stats.chunked(2).forEach { pair -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                pair.forEach { stat(it, Modifier.weight(1f)) }; if (pair.size == 1) Spacer(Modifier.weight(1f))
            } }
        } else FlowRow(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            t.stats.forEach { stat(it, Modifier) }
        }
        // .bar.thin: 4 tall on surface-2, the owned share in gold.
        t.owned?.let { o -> Box(Modifier.padding(top = 6.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(99.dp)).background(Site.Surface2)) {
            Box(Modifier.fillMaxWidth(o.coerceIn(0f, 1f)).height(4.dp).clip(RoundedCornerShape(99.dp)).background(Site.Gold))
        } }
        for (n in t.notes) when {
            n.evidence -> Evidence(n.text, accent)
            else -> Text(n.text, Modifier.padding(vertical = 4.dp), style = cssType(13f, 400, 19.5f, if (n.warn || n.path) Warn else Site.Muted))
        }
        // details.budget-next: the next assessed improvement outside the budget, and Review this version (A.tTierAlternative).
        if (t.nextSummary.isNotBlank()) {
            var open by remember(t.i) { mutableStateOf(false) }
            Column(Modifier.fillMaxWidth().padding(vertical = 12.dp).clip(shape).border(1.dp, Site.Line, shape).padding(12.dp)) {
                Text(t.nextSummary, Modifier.fillMaxWidth().heightIn(min = 32.dp).clickable { open = !open }.semantics { role = Role.Button; stateDescription = if (open) "Expanded" else "Collapsed" },
                    style = cssType(14f, 650, 20f))
                if (open) {
                    t.nextLines.forEach { Text(it, Modifier.padding(top = 6.dp), style = cssType(12f, 400, 18f)) }
                    t.nextReview?.let { b -> Spacer(Modifier.height(8.dp)); DeckGhost(b.label, minHeight = 44.dp, pad = 12.dp) { act.tap(b.id) } }
                }
            }
        }
        // The open version's list: each group (its name over the count, upper case muted 12 / 800) and its tiles, one column on a phone.
        for (g in t.groups) if (g.rows.isNotEmpty()) {
            var open by remember(t.i, g.name) { mutableStateOf(true) }
            Row(Modifier.fillMaxWidth().padding(top = 12.dp).heightIn(min = 44.dp).clickable { open = !open }.semantics { role = Role.Button; stateDescription = if (open) "Expanded" else "Collapsed" }
                .padding(horizontal = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(g.name.uppercase(), style = cssType(12f, 800, 17f, Site.Muted, track = .96f))
                Text(g.count, style = cssType(12f, 800, 17f))
                Spacer(Modifier.weight(1f))
                Text(if (open) "⌄" else "›", style = cssType(14f, 700, 17f, Site.Muted))
            }
            if (open) {
                val cols = if (narrow) 1 else ((vw.value - 48f + 8f) / (300f + 8f)).toInt().coerceIn(1, 3)
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    g.rows.chunked(cols).forEach { line -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        line.forEach { r -> Box(Modifier.weight(1f)) { TierTile(r, game, act) } }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    } }
                }
            }
        }
        // .tier-actions: Save (the accent, filling the line), Buy N on TCGplayer, See all N / Hide list, ⋯ (its menu over the button).
        FlowRow(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            t.save?.let { b -> Row(Modifier.weight(1f).widthIn(min = 160.dp).heightIn(min = 44.dp).clip(RoundedCornerShape(11.dp)).background(accent).clickable { act.tap(b.id) }
                .semantics { role = Role.Button }.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                b.icon?.let { SiteIcon(it, 16.dp, ink) }
                Text(b.label, style = cssType(13.5f, 700, 19f, ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
            } }
            t.buy?.let { b -> GhostIcon(b) { act.tap(b.id) } }
            t.toggle?.let { b -> GhostIcon(b) { act.tap(b.id) } }
            if (t.more.isNotEmpty()) {
                var open by remember(t.i) { mutableStateOf(false) }
                Box {
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(11.dp)).background(GlassFill).border(1.dp, GlassLine, RoundedCornerShape(11.dp)).clickable { open = !open }
                        .semantics { role = Role.Button; contentDescription = "More for this version"; stateDescription = if (open) "Expanded" else "Collapsed" }, contentAlignment = Alignment.Center) {
                        Text("···", style = cssType(15f, 800, 18f))
                    }
                    if (open) Popup(alignment = Alignment.BottomEnd, offset = androidx.compose.ui.unit.IntOffset(0, -56), onDismissRequest = { open = false }, properties = PopupProperties(focusable = true)) {
                        Column(Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(16.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(16.dp)).padding(6.dp)) {
                            for (x in t.more) Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).clickable { open = false; act.tap(x.id) }
                                .semantics { role = Role.Button }.padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                x.icon?.let { SiteIcon(it, 20.dp, accent) }
                                Column { Text(x.label, style = cssType(14f, 700, 20f)); if (x.note.isNotBlank()) Text(x.note, style = cssType(12f, 400, 17f, Site.Muted)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** .btn.ghost.small with its icon: 44 tall on a phone, 11 corners, 13.5 bold. */
@Composable
private fun GhostIcon(b: TierBuildModel.Btn, onClick: () -> Unit) {
    Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(11.dp)).background(GlassFill).border(1.dp, GlassLine, RoundedCornerShape(11.dp)).clickable(onClick = onClick)
        .semantics { role = Role.Button }.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        b.icon?.let { SiteIcon(it, 16.dp, Site.Text) }
        Text(b.label, style = cssType(13.5f, 700, 19f), maxLines = 1)
    }
}

/** A version's card: the deck page's tile (Yu-Gi-Oh!, Pokémon), or views.js's mini-row (Magic: art, "2× Name", why, and what is still to get). */
@Composable
private fun TierTile(r: TierBuildModel.TileRow, game: CardGame, act: TierBuildActions) {
    val c = r.card
    if (c != null) { TierTileCard(c, game, r.qty, r.why) { act.card(r) }; return }
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp)).clickable { act.card(r) }.padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(52.dp, 38.dp).clip(RoundedCornerShape(6.dp)).background(Site.Surface2)) {
            heroPainter(homeArt(r.art))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
        }
        Text(androidx.compose.ui.text.buildAnnotatedString {
            append(r.name)
            if (r.why.isNotBlank()) withStyle(androidx.compose.ui.text.SpanStyle(color = Site.Muted, fontSize = androidx.compose.ui.unit.TextUnit(12f, androidx.compose.ui.unit.TextUnitType.Sp))) { append("  " + r.why) }
        }, Modifier.weight(1f), style = cssType(14f, 400, 20f), maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(r.own, style = cssType(12f, 400, 17f, if (r.ok) Good else Warn), maxLines = 1, softWrap = false)
    }
}

private fun lerpColor(a: Color, b: Color, t: Float) = androidx.compose.ui.graphics.lerp(a, b, t)
