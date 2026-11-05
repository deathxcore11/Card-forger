package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.b
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.o
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.objs
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.s
import dev.cardstashy.nativeplay.ui.CollectionSetsModel.Companion.strs

// ---------------------------------------------------------------- the model (CollectionEngine.set: views.js setPage())

/** One card of the set grid: its row parts (art, foil, tier), "#1 Name", the price, what you own, the emblem dock; [i] is its data-set-i. */
class SetTileM(val r: CollRow, val i: Int, val label: String, val price: String, val badge: String?, val badgeOther: Boolean, val badgeTitle: String, val own: Boolean,
               val missing: Boolean, val emb: List<Pair<String, String>>, val set: String?, val rarity: String, val setTitle: String, val imp: SiteSvg?)
class SetPack(val label: String, val sub: String, val disabled: Boolean, val act: String)

class CollectionSetModel(val code: String, val title: String, val line: String, val back: CardPress?, val atmosphere: List<String>, val icon: String, val progress: SetProgress?,
                         val pack: SetPack?, val error: String?, val retry: CardPress?, val searchValue: String, val searchPlaceholder: String, val filters: List<CollTab>,
                         val selects: List<CollSelect>, val views: List<CollView>, val mode: String, val results: String, val tiles: List<SetTileM>, val more: String,
                         val emptyTitle: String?, val emptyText: String, val busy: Boolean, val loaded: Boolean) {
    companion object {
        private fun tile(j: JsonObject): SetTileM {
            val pic = j.o("picture"); val fin = j.o("finish"); val c = j.o("chrome"); val set = c?.o("set"); val badge = j.o("badge")
            val r = CollRow("set:" + j.get("i")?.asInt, j.s("name"), false, j.s("tier").ifBlank { "tn" }, j.s("tierColor"), pic?.s("src")?.ifBlank { null }, pic?.strs("sources").orEmpty(),
                j.s("fallback"), fin?.s("key") ?: "", fin?.s("effect") ?: "", "", null, null, emptyList(), emptyList(), "", "", "", false, j.s("price"), "", "", "", 0, false, "", j.o("print"))
            return SetTileM(r, j.get("i")?.takeIf { it.isJsonPrimitive }?.asInt ?: -1, j.s("label"), j.s("price"), badge?.s("text"), badge?.b("other") ?: false, badge?.s("title") ?: "",
                j.b("own"), j.b("missing"), c?.objs("emb").orEmpty().map { it.s("src") to it.s("alt") },
                set?.s("src")?.let { Regex("/sets/([^/.?]+)\\.svg").find(it)?.groupValues?.get(1) }, set?.s("rarity") ?: "common", set?.s("title") ?: "",
                CollectionCardsModel.svg(c?.o("imp")))
        }

        fun parse(j: JsonObject): CollectionSetModel {
            val pack = j.o("pack"); val err = j.o("error"); val empty = j.o("empty")
            return CollectionSetModel(j.s("code"), j.s("title"), j.s("line"), CollectionCardModel.press(j.o("back")), j.strs("atmosphere"), j.s("icon"),
                CollectionSetsModel.progress(j.o("progress")), pack?.let { SetPack(it.s("label"), it.s("sub"), it.b("disabled"), it.s("act")) },
                err?.s("text")?.ifBlank { null }, CollectionCardModel.press(err?.o("retry")), j.o("search")?.s("value") ?: "", j.o("search")?.s("placeholder") ?: "",
                j.objs("filters").map { CollTab(it.s("id"), it.s("label"), it.b("on"), null) }, j.objs("selects").mapNotNull { CollectionSetsModel.select(it) },
                j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) }, j.s("mode").ifBlank { "gallery" },
                j.s("results"), j.objs("tiles").map(::tile), j.s("more"), empty?.s("title"), empty?.s("text") ?: "", j.b("busy"), j.b("loaded"))
        }
    }
}

/** What the set page's controls do: search, Owned / Missing, the selects, the view and Show more are the site's own handlers in the engine. */
class CollectionSetActions(
    val game: (CardGame) -> Unit = {},
    /** "‹ All sets" (data-act="go" data-to="#sets"). */
    val back: () -> Unit = {},
    val search: (String) -> Unit = {},
    /** data-act="setFilter" data-id: all / owned / missing. */
    val filter: (String) -> Unit = {},
    /** data-change setRarity / setFinish / setSort. */
    val select: (name: String, value: String) -> Unit = { _, _ -> },
    val view: (String) -> Unit = {},
    val more: () -> Unit = {},
    /** A card (data-act="card" data-name data-set-i data-set-finish). */
    val card: (SetTileM) -> Unit = {},
    /** Open Pack · Simulator (data-act="openSetPack"). */
    val pack: () -> Unit = {},
    /** Try again. */
    val press: (CardPress) -> Unit = {},
)

private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)
private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val LineC = Color(0xFF2A2F39)
private val Surface2 = Color(0xFF1F232B)
private val GoldC = Color(0xFFE8B95B)

// CSS line boxes: the whole line height on every line, the text centred in it (Compose trims the first and last by default).
private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color,
        lineHeightStyle = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None))
/** color-mix(in srgb, var(--tier) 70%, var(--text)): the price in its tier's colour. */
private fun tierInk(css: String): Color = cssColor(css, Color.Transparent)?.let { Color(it.red * .7f + Ink.red * .3f, it.green * .7f + Ink.green * .3f, it.blue * .7f + Ink.blue * .3f) } ?: Mute

// ---------------------------------------------------------------- the page

@Composable
fun CollectionSet(m: CollectionSetModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSetActions = CollectionSetActions(),
                  nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.searchValue) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val screen = maxWidth; val tall = maxHeight
        if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); SetPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, tall, query) }
        else Column(Modifier.fillMaxSize()) { SetPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, tall, query); nav(false) }
    }
}

@Composable
private fun SetPage(m: CollectionSetModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSetActions, modifier: Modifier, screen: Dp, tall: Dp, query: String) {
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    val inner = screen - gutter * 2
    val reduced = Playmats.reduced(LocalContext.current)
    // .card-grid: repeat(auto-fill, minmax(140px, 1fr)) 10 apart; 160 from 600; 150 and 12 apart on a tablet-shaped screen (style.css 1961).
    val h = LocalConfiguration.current.screenHeightDp.toFloat().coerceAtLeast(tall.value)
    val tablet = (screen.value >= 680 && h >= 560 && screen.value / h >= .75f) || (screen.value >= 800 && h >= 560)
    val (minCol, gap) = when { tablet -> 150f to 12.dp; wide -> 160f to 10.dp; else -> 140f to 10.dp }
    val cols = ((inner.value + gap.value) / (minCol + gap.value)).toInt().coerceAtLeast(1)
    LazyColumn(modifier, contentPadding = PaddingValues(bottom = 28.dp)) {
        item(key = "top") {
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                // As on Cards and Decks: the game tabs ride in the bar when there is room, and sit centred under it on a phone.
                top(if (wide) ({ GameTabs(CardGame.MTG, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
            }
        }
        item(key = "hero") {
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 4.dp else 10.dp, bottom = if (wide) 16.dp else 12.dp)) {
                if (!wide) GameTabs(CardGame.MTG, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                Hero(m, act, screen)
            }
        }
        item(key = "tools") {
            Column(Modifier.padding(horizontal = gutter)) {
                m.error?.let { WarnNote(it, m.retry, { m.retry?.let(act.press) }, Modifier.padding(bottom = 12.dp)) }
                Toolbar(m, act, wide, query)
                // .set-results: "579 cards", 7 above and 8 below.
                Text(m.results, Modifier.padding(top = 7.dp, bottom = 8.dp).heightIn(min = 15.dp), style = sans(11f, 400, Mute, lh = if (wide) 1.45f else 1.4f))
            }
        }
        when (m.mode) {
            "compact", "symbols" -> items(m.tiles, key = { "l:" + it.i }) { t ->
                Box(Modifier.padding(horizontal = gutter).padding(bottom = 8.dp)) { ListCard(t, m.mode == "compact", reduced, act) }
            }
            else -> {
                val lines = m.tiles.chunked(cols)
                items(lines, key = { line -> "g:" + line.joinToString("|") { it.i.toString() } }) { line ->
                    Row(Modifier.padding(horizontal = gutter).padding(bottom = if (line === lines.last()) 0.dp else gap).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                        for (t in line) GridCard(t, reduced, act, Modifier.weight(1f).fillMaxHeight())
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        m.emptyTitle?.let { t ->
            item(key = "empty") {
                Column(Modifier.fillMaxWidth().padding(horizontal = gutter, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(t, style = sans(17f, 700), textAlign = TextAlign.Center)
                    Text(m.emptyText, style = sans(14f, 400, Mute), textAlign = TextAlign.Center)
                }
            }
        }
        if (m.more.isNotBlank()) item(key = "more") { GhostBlock(m.more, Modifier.padding(horizontal = gutter).padding(top = 16.dp), act.more) }
    }
}

// ---------------------------------------------------------------- .set-hero.set-overview: identity, your progress, the pack simulator

@Composable
private fun Hero(m: CollectionSetModel, act: CollectionSetActions, screen: Dp) {
    val phone = screen < 600.dp
    val desk = screen >= 1000.dp
    val shape = RoundedCornerShape(if (phone) 18.dp else 22.dp)
    Box(Modifier.fillMaxWidth().clip(shape).background(Color(0xE0171A20)).border(1.dp, LineC, shape)) {
        SetAtmosphere(m.atmosphere, if (screen < 700.dp) .72f else .58f, if (screen < 700.dp) .2f else .3f, Modifier.matchParentSize())
        // CSS padding plus the 1 px border it sits inside.
        val pad = if (phone) PaddingValues(15.dp) else PaddingValues(horizontal = 21.dp, vertical = 19.dp)
        if (desk) Row(Modifier.padding(pad), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(22.dp)) {
            Identity(m, act, screen, Modifier.weight(1f))
            m.progress?.let { p ->
                Box(Modifier.widthIn(min = 210.dp, max = 280.dp).width(((screen.value - 40) * .3f).dp)
                    .drawBehind { drawLine(LineC, Offset(.5f, 0f), Offset(.5f, size.height), 1.dp.toPx()) }.padding(start = 22.dp)) { HeroProgress(p, phone) }
            }
            m.pack?.let { Pack(it, phone, Modifier.widthIn(max = 130.dp), act.pack) }
        } else Column(Modifier.padding(pad), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Identity(m, act, screen, Modifier.fillMaxWidth())
            if (m.progress != null || m.pack != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 18.dp)) {
                Box(Modifier.weight(1f)) { m.progress?.let { HeroProgress(it, phone) } }
                m.pack?.let { Pack(it, phone, Modifier, act.pack) }
            }
        }
    }
}

/** .set-identity: the set symbol (38, 52 from 600), "‹ All sets", the name in Cinzel and code · type · date. */
@Composable
private fun Identity(m: CollectionSetModel, act: CollectionSetActions, screen: Dp, modifier: Modifier) {
    val phone = screen < 600.dp
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 16.dp)) {
        if (m.icon.isNotBlank()) {
            val p = heroPainter(homeArt(m.icon))
            if (p != null) Image(p, null, Modifier.size(if (phone) 38.dp else 52.dp), colorFilter = ColorFilter.tint(Color(0xFFD9DCE2), BlendMode.SrcIn))
        }
        Column(Modifier.weight(1f)) {
            m.back?.let { b ->
                Row(Modifier.clickable(onClick = act.back).semantics { role = Role.Button }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    SiteIcon(b.icon, 14.dp, GoldC)
                    Text(b.label, style = sans(13f, 600, GoldC))
                }
            }
            val size = if (screen >= 1000.dp) (screen.value * .021f).coerceIn(20f, 28f) else 20f
            Text(m.title, Modifier.padding(vertical = 5.dp), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = (size * 1.2f).sp,
                letterSpacing = (size * .02f).sp, color = Ink))
            if (m.line.isNotBlank()) Text(m.line, style = sans(11f, 400, Mute, lh = 1.45f))
        }
    }
}

/** The set's .set-collection-progress inside the hero: "Your collection", "1 of 579 unique cards", the share in gold, the bar. */
@Composable
private fun HeroProgress(p: SetProgress, phone: Boolean) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                if (p.eyebrow.isNotBlank()) Text(p.eyebrow.uppercase(), Modifier.padding(bottom = if (phone) 4.dp else 6.dp), style = SetsEyebrow)
                Text(p.label, style = sans(if (phone) 11f else 12f, 400, Ink))
            }
            if (p.pct.isNotBlank()) {
                val s = if (phone) 23f else 26f
                Text(p.pct, style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(650), fontSize = s.sp, letterSpacing = (-.04f * s).sp, color = GoldC, fontFeatureSettings = "tnum"))
            }
        }
        p.fill?.let { SetProgressBar(it, Modifier.padding(top = 10.dp)) }
        if (p.caption.isNotBlank()) Text(p.caption, Modifier.padding(top = 7.dp), style = sans(10f, 400, Mute, lh = 1.4f))
    }
}

/** .btn.ghost.set-open-pack: "Open Pack" over "Simulator" on a phone, side by side from 600 (wrapping at 130 on a desk). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Pack(p: SetPack, phone: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(11.dp)
    val base = modifier.clip(shape).background(GlassFill).border(1.dp, GlassLine, shape)
        .drawWithContent { drawContent(); drawRect(Color(0x12FFFFFF), size = Size(size.width, 1.dp.toPx())) }
        .clickable(enabled = !p.disabled, onClick = onClick).semantics { role = Role.Button }.alpha(if (p.disabled) .55f else 1f)
    // 8 / 10 of padding inside a 1 px border.
    if (phone) Column(base.padding(horizontal = 11.dp, vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(p.label, style = sans(12f, 700, Ink, lh = 1.45f))
        if (p.sub.isNotBlank()) Text(p.sub, style = sans(11f, 400, Mute, lh = 1.45f))
    } else FlowRow(base.heightIn(min = 44.dp).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.Center, itemVerticalAlignment = Alignment.CenterVertically) {
        Text(p.label, style = sans(15f, 700, Ink))
        if (p.sub.isNotBlank()) Text(p.sub, style = sans(11f, 400, Mute))
    }
}

// ---------------------------------------------------------------- .set-card-toolbar: search, All / Owned / Missing, rarity, finish, order, the view

@Composable
private fun Toolbar(m: CollectionSetModel, act: CollectionSetActions, wide: Boolean, query: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Search(query, m.searchPlaceholder, act.search, Modifier.fillMaxWidth())
        if (wide) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlideStrip(m.filters, 13.5f, 6.dp, grow = false, onPick = act.filter)
            for (s in m.selects) GlassSelect(s, { v -> act.select(s.name, v) }, Modifier.weight(1f))
            ViewSwitch(m.views, act.view)
        } else Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            // Under 600 a two-column grid: the segments on their own line, then the selects two by two and the view switch at the end.
            GlideStrip(m.filters, 13.5f, 6.dp, grow = false, onPick = act.filter)
            val cells: List<CollSelect?> = m.selects + listOf(null)
            for (line in cells.chunked(2)) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                for (c in line) if (c != null) GlassSelect(c, { v -> act.select(c.name, v) }, Modifier.weight(1f))
                    else Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) { ViewSwitch(m.views, act.view) }
                if (line.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

// ---------------------------------------------------------------- the cards

/**
 * A gallery card (.set-grid .grid-card): the card in its price band (7.5 wide, 12 corners; a still silver 5 when it has no price)
 * with its aura, the emblem dock clipped on its foot, what you own clipped on its top edge; "#1 Name" and the price under it.
 */
@Composable
private fun GridCard(t: SetTileM, reduced: Boolean, act: CollectionSetActions, modifier: Modifier) {
    val tn = t.r.tier == "tn"
    Column(modifier.then(if (t.own) Modifier.drawWithContent {
        drawContent()
        val w = 2.dp.toPx(); drawRect(Color(0x8C6FD29A), topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), style = Stroke(w))
    } else Modifier)) {
        Box {
            TierFrame(t.r.tier, reduced, Modifier.fillMaxWidth().clickable { act.card(t) }.semantics { contentDescription = "Open ${t.r.name}" },
                fw = if (tn) 5.dp else 7.5.dp, corner = if (tn) null else 12.dp, blur = 18f, plain = tn) { framed ->
                val fw = if (!framed) 0.dp else if (tn) 5.dp else 7.5.dp
                Box(Modifier.fillMaxSize().padding(fw)) {
                    RowPicture(t.r, Modifier.fillMaxSize(), if (tn) RoundedCornerShape(percent = 4) else RoundedCornerShape((12.dp - fw).coerceAtLeast(2.dp)))
                }
                TileDock(t.emb, t.set, t.rarity, t.setTitle, t.imp, Modifier.align(Alignment.BottomStart).offset(y = 6.dp).padding(start = 10.75.dp, end = 6.dp), h = 18.dp)
            }
            t.badge?.let { Badge(it, t.badgeOther, t.badgeTitle, Modifier.align(Alignment.TopEnd).offset(y = (-9).dp).padding(end = 8.dp)) }
        }
        // .grid-meta: 7 under the card (and the grid's 4), the label cut short, the price in its tier's colour.
        Row(Modifier.padding(top = 11.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(t.label, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(12f, 400, Mute))
            Text(t.price, style = sans(12f, 400, if (tn) Mute else tierInk(t.r.tierColor)).copy(fontFeatureSettings = "tnum"))
        }
    }
}

/** .owned-badge: "×2" in green on a small dark glass chip ("other ed." in grey for a different printing you own). */
@Composable
private fun Badge(text: String, other: Boolean, title: String, modifier: Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Box(modifier.heightIn(min = 18.dp).clip(shape).background(Color(0xCC0A0C12))
        .drawWithContent {
            drawRect(Brush.verticalGradient(0f to Color(0x1CFFFFFF), .55f to Color(0x03FFFFFF)))
            drawContent()
            drawRoundRect(if (other) Color(0x26FFFFFF) else Color(0x555FD39A), cornerRadius = androidx.compose.ui.geometry.CornerRadius(10.dp.toPx()),
                topLeft = Offset(.5.dp.toPx(), .5.dp.toPx()), size = Size(size.width - 1.dp.toPx(), size.height - 1.dp.toPx()), style = Stroke(1.dp.toPx()))
        }.semantics { if (title.isNotBlank()) contentDescription = title }.padding(horizontal = 7.dp), contentAlignment = Alignment.Center) {
        Text(text, style = sans(if (other) 10.5f else 11f, 800, if (other) Color(0xFFCFD5DE) else Color(0xFF8FF0B8), lh = 1.45f))
    }
}

/** The Compact and List views: a row in the collection's ring, the art (Compact only), name and price, then the emblem chips; the count at its foot. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ListCard(t: SetTileM, compact: Boolean, reduced: Boolean, act: CollectionSetActions) {
    Box(Modifier.fillMaxWidth().lotFrame(t.r, reduced).clickable { act.card(t) }.semantics { contentDescription = "Open ${t.r.name}" }) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (compact) Box(Modifier.size(48.dp, 67.dp).clip(RoundedCornerShape(5.dp)).background(Surface2)) { RowPicture(t.r, Modifier.fillMaxSize(), RoundedCornerShape(5.dp)) }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(t.label, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(15f, 650, Mute, lh = 1.5f))
                    Text(t.price, style = sans(13f, 700, tierInk(t.r.tierColor), lh = 1.5f).copy(fontFeatureSettings = "tnum"))
                }
                if (t.emb.isNotEmpty() || t.set != null || t.imp != null) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp),
                    itemVerticalAlignment = Alignment.CenterVertically) {
                    val chip = Modifier.height(24.dp).clip(RoundedCornerShape(10.dp)).background(Ink.copy(alpha = .07f)).padding(horizontal = 8.dp)
                    if (t.emb.isNotEmpty()) Row(chip, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                        t.emb.forEach { (src, alt) -> Mana(src, alt) }
                    }
                    t.set?.let { code -> Box(chip.semantics { contentDescription = t.setTitle }, contentAlignment = Alignment.Center) { RaritySetIcon(code, t.rarity, 15.dp) } }
                    t.imp?.let { Box(chip, contentAlignment = Alignment.Center) { SiteIcon(it, 16.dp, Ink) } }
                }
            }
        }
        t.badge?.let { Badge(it, t.badgeOther, t.badgeTitle, Modifier.align(Alignment.BottomEnd).padding(end = 10.dp, bottom = 8.dp)) }
    }
}
