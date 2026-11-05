package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlin.math.roundToInt

// ---------------------------------------------------------------- the models (CollectionEngine.sets / set: views.js setsPage(), setPage())

/** set-list-ui.js setProgressMarkup: "1 of 579 unique cards", the share, the bar (null when the total is unverified), the coverage line. */
class SetProgress(val label: String, val eyebrow: String, val pct: String, val fill: Float?, val caption: String)
/** One release in the browser (setRowContent): its art, symbol, name, code, family · date, card count and your progress. */
class SetRowM(val code: String, val atmosphere: List<String>, val image: String, val fallback: String, val name: String, val mark: String, val detail: String,
              val count: String, val units: List<String>, val unknown: Boolean, val progress: SetProgress?)
class SetsSection(val year: String, val count: String, val rows: List<SetRowM>)
class SetsFacet(val sel: CollSelect, val title: String)
/** The Filters pill (set-browser.js): its count of filters on, the four selects, "80 shown · …", Reset / Refresh, and when the list was checked. */
class SetsFilters(val label: String, val icon: SiteSvg?, val count: String, val open: Boolean, val facets: List<SetsFacet>, val status: String, val buttons: List<CardPress>, val freshness: String)

class CollectionSetsModel(val eyebrow: String, val title: String, val searchValue: String, val searchPlaceholder: String, val quick: List<CollTab>, val filters: SetsFilters?,
                          val error: String?, val retry: CardPress?, val loading: String, val sections: List<SetsSection>, val emptyTitle: String?, val emptyText: String,
                          val more: String, val busy: Boolean) {
    companion object {
        internal fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        internal fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
        internal fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
        internal fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
        internal fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { e -> e.takeIf { it.isJsonPrimitive }?.asString }.orEmpty()
        internal fun select(o: JsonObject?) = o?.let { CollSelect(it.s("name"), it.s("label"), it.objs("options").map { x -> CollOption(x.s("value"), x.s("label"), x.b("on")) }) }
        internal fun progress(o: JsonObject?) = o?.let { SetProgress(it.s("label"), it.s("eyebrow"), it.s("pct"), it.get("fill")?.takeIf { f -> f.isJsonPrimitive }?.asFloat, it.s("caption")) }
        private fun row(r: JsonObject) = SetRowM(r.s("code"), r.strs("atmosphere"), r.s("image"), r.s("fallback"), r.s("name"), r.s("mark"), r.s("detail"),
            r.s("count"), r.strs("units"), r.b("unknown"), progress(r.o("progress")))

        fun parse(j: JsonObject): CollectionSetsModel {
            val f = j.o("filters"); val err = j.o("error"); val empty = j.o("empty")
            return CollectionSetsModel(j.s("eyebrow"), j.s("title"), j.o("search")?.s("value") ?: "", j.o("search")?.s("placeholder") ?: "",
                j.objs("quick").map { CollTab(it.s("value"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) },
                f?.let { SetsFilters(it.s("label"), CollectionCardsModel.svg(it.o("icon")), it.s("count"), it.b("open"),
                    it.objs("selects").mapNotNull { s -> select(s)?.let { sel -> SetsFacet(sel, s.s("title")) } }, it.s("status"),
                    it.objs("buttons").mapNotNull(CollectionCardModel::press), it.s("freshness")) },
                err?.s("text")?.ifBlank { null }, CollectionCardModel.press(err?.o("retry")), j.s("loading"),
                j.objs("sections").map { s -> SetsSection(s.s("year"), s.s("count"), s.objs("rows").map(::row)) },
                empty?.s("title"), empty?.s("text") ?: "", j.s("more"), j.b("busy"))
        }
    }
}

/** What the set browser's controls do: all of them are the site's own handlers in the engine; a set opens its page. */
class CollectionSetsActions(
    val game: (CardGame) -> Unit = {},
    val search: (String) -> Unit = {},
    /** data-act="setsFamily" data-value. */
    val family: (String) -> Unit = {},
    /** data-change setsType / setsRelease / setsYear / setsSort. */
    val facet: (name: String, value: String) -> Unit = { _, _ -> },
    /** Reset filters, Refresh, Try again. */
    val press: (CardPress) -> Unit = {},
    val more: () -> Unit = {},
    val set: (String) -> Unit = {},
)

// ---------------------------------------------------------------- site colours

private val GlassLine = Color(0x31EDC980)
private val GlassFill = Color(0x851F232B)
private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val LineC = Color(0xFF2A2F39)
private val Surface = Color(0xFF171A20)
private val GoldC = Color(0xFFE8B95B)
private val Warn = Color(0xFFF2C66D)

// CSS line boxes: the whole line height on every line, the text centred in it (Compose trims the first and last by default).
private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color,
        lineHeightStyle = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None))
internal val SetsEyebrow = sans(11f, 700, Mute, lh = 1.45f, ls = 1.32f)

/** linear-gradient(<deg>, …) across this box, as CSS lays the line: through the centre, long enough to reach the far corners. */
internal fun DrawScope.cssGradient(deg: Float, vararg stops: Pair<Float, Color>): Brush {
    val a = Math.toRadians(deg.toDouble()); val dx = kotlin.math.sin(a).toFloat(); val dy = -kotlin.math.cos(a).toFloat()
    val half = (kotlin.math.abs(size.width * dx) + kotlin.math.abs(size.height * dy)) / 2
    return Brush.linearGradient(colorStops = stops, start = center - Offset(dx * half, dy * half), end = center + Offset(dx * half, dy * half))
}

/** The first of [sources] that loads (the site's onerror walks the list), or null while none has. */
@Composable
internal fun firstArt(sources: List<String>): Painter? {
    var i by remember(sources) { mutableIntStateOf(0) }
    val p = heroPainter(sources.getOrNull(i)?.let(homeArt))
    val st = (p as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
    LaunchedEffect(st, i) { if (st is coil3.compose.AsyncImagePainter.State.Error && i < sources.size - 1) i++ }
    return p
}

/**
 * set-experience.js setAtmosphere: the set's art tilted -7°, blurred a little and desaturated, [width] of the box from its right edge
 * (138 % tall from 18 % above), at [alpha]; it dissolves to the left (transparent to 12 %, a fifth at 48 %, full at the edge).
 */
@Composable
internal fun SetAtmosphere(sources: List<String>, width: Float, alpha: Float, modifier: Modifier) {
    if (sources.isEmpty()) return
    val p = firstArt(sources) ?: return
    Box(modifier.graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }.drawWithContent {
        drawContent()
        drawRect(Brush.horizontalGradient(0f to Color.Transparent, .12f to Color.Transparent, .48f to Color.Black.copy(alpha = .2f), 1f to Color.Black), blendMode = BlendMode.DstIn)
    }) {
        Image(p, null, Modifier.layout { m, c ->
                // The tile row asks its height from the text (IntrinsicSize.Min): the art adds none.
                if (!c.hasBoundedWidth || !c.hasBoundedHeight) { m.measure(Constraints.fixed(0, 0)); return@layout layout(0, 0) {} }
                val w = (c.maxWidth * width).roundToInt(); val h = (c.maxHeight * 1.38f).roundToInt()
                val pl = m.measure(Constraints.fixed(w.coerceAtLeast(1), h.coerceAtLeast(1)))
                layout(c.maxWidth, c.maxHeight) { pl.place((c.maxWidth * 1.02f).roundToInt() - w, (-c.maxHeight * .18f).roundToInt()) }
            }.graphicsLayer {
                rotationZ = -7f; scaleX = 1.03f; scaleY = 1.03f; this.alpha = alpha
                renderEffect = BlurEffect(1.5.dp.toPx(), 1.5.dp.toPx(), TileMode.Decal)
            },
            contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.3f), colorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(.7f) }))
    }
}

/**
 * The .seg / .set-browser-quick strip: buttons on a glass hairline, the open one marked by the gold glide (a glow from the
 * bottom edge and a 2 px line fading at both ends). [grow]: flex 1 0 auto, the line's spare width shared out; the strip
 * scrolls sideways when the buttons don't fit.
 */
@Composable
internal fun GlideStrip(items: List<CollTab>, fontSize: Float, padH: Dp, grow: Boolean, modifier: Modifier = Modifier, onPick: (String) -> Unit) {
    BoxWithConstraints(modifier) {
        val avail = maxWidth
        Box(Modifier.then(if (grow) Modifier.fillMaxWidth() else Modifier).drawBehind {
            drawLine(GlassLine, Offset(0f, size.height - .5f), Offset(size.width, size.height - .5f), 1.dp.toPx())
        }.horizontalScroll(rememberScrollState()).padding(horizontal = 2.dp)) {
            Layout({
                for (t in items) {
                    val on = t.on
                    Row(Modifier.heightIn(min = 44.dp).widthIn(min = 44.dp).drawBehind {
                        if (on) {
                            drawRect(Brush.radialGradient(listOf(GoldC.copy(alpha = .24f), Color.Transparent), Offset(size.width / 2, size.height), size.width * .6f * .7f), size = size)
                            drawRect(Brush.horizontalGradient(.18f to Color.Transparent, .5f to GoldC, .82f to Color.Transparent), Offset(0f, size.height - 2.dp.toPx()), Size(size.width, 2.dp.toPx()))
                        }
                    }.clickable { if (!on) onPick(t.key) }.semantics { role = Role.Tab }.padding(horizontal = padH, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                        SiteIcon(t.icon, 16.dp, if (on) Ink else Mute.copy(alpha = .75f))
                        Text(t.label, maxLines = 1, softWrap = false, style = sans(fontSize, 750, if (on) Ink else Mute, ls = -fontSize / 100f))
                    }
                }
            }) { ms, c ->
                val g = 2.dp.roundToPx()
                val natural = ms.map { it.maxIntrinsicWidth(c.maxHeight) }
                val used = natural.sum() + g * (ms.size - 1).coerceAtLeast(0)
                val free = if (grow) (avail.roundToPx() - 4.dp.roundToPx() - used).coerceAtLeast(0) else 0
                val placed = ms.mapIndexed { i, m -> val w = natural[i] + free / ms.size + (if (i < free % ms.size) 1 else 0); m.measure(Constraints(minWidth = w, maxWidth = w)) }
                val h = placed.maxOfOrNull { it.height } ?: 0
                layout(placed.sumOf { it.width } + g * (placed.size - 1).coerceAtLeast(0), h) {
                    var x = 0
                    for (p in placed) { p.place(x, 0); x += p.width + g }
                }
            }
        }
    }
}

/** A site <select> in the glass of .set-controls / .set-browser-facets: 44 tall, 11 corners, the choice in 14 and Chrome's ▾ at the right. */
@Composable
internal fun GlassSelect(sel: CollSelect, onPick: (String) -> Unit, modifier: Modifier) {
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(11.dp)
    Box(modifier) {
        Row(Modifier.fillMaxWidth().height(44.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape)
            .drawWithContent { drawContent(); drawRect(Color(0x12FFFFFF), size = Size(size.width, 1.dp.toPx())) }
            .clickable { open = true }.semantics { contentDescription = sel.label }.padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(sel.current?.label ?: "", Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = sans(14f, 400, Ink))
            Box(Modifier.size(10.dp, 8.dp).drawBehind {
                drawPath(Path().apply { moveTo(0f, 0f); lineTo(size.width, 0f); lineTo(size.width / 2, size.height); close() }, Color(0xFFDADDE3))
            })
        }
        DropdownMenu(open, { open = false }, containerColor = Color(0xFF1A1E26)) {
            for (o in sel.options) DropdownMenuItem(text = { Text(o.label, style = sans(14f, if (o.on) 700 else 400, if (o.on) GoldC else Ink)) }, onClick = { open = false; if (!o.on) onPick(o.value) })
        }
    }
}

/** .btn.ghost.block: Show more, 44 tall in the glass. */
@Composable
internal fun GhostBlock(label: String, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(11.dp)
    Box(modifier.fillMaxWidth().heightIn(min = 44.dp).clip(shape).background(GlassFill).border(1.dp, GlassLine, shape).clickable(onClick = onClick)
        .semantics { role = Role.Button }.padding(horizontal = 14.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
        Text(label, style = sans(15f, 700))
    }
}

/** .note.warn with its "Try again". */
@Composable
internal fun WarnNote(text: String, retry: CardPress?, onRetry: () -> Unit, modifier: Modifier) {
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1AF2C66D)).border(1.dp, Color(0x40F2C66D), RoundedCornerShape(12.dp))
        .padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text, Modifier.weight(1f), style = sans(13f, 400, Warn, lh = 1.5f))
        if (retry != null) Text(retry.label, Modifier.clickable(onClick = onRetry).padding(vertical = 4.dp), style = sans(13f, 600, GoldC))
    }
}

// ---------------------------------------------------------------- the browser (views.js setsPage)

@Composable
fun CollectionSets(m: CollectionSetsModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSetsActions = CollectionSetsActions(),
                   nav: @Composable (vertical: Boolean) -> Unit = {}, query: String = m.searchValue) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
        val screen = maxWidth
        if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); SetsPage(m, top, act, Modifier.weight(1f).fillMaxHeight(), screen, query) }
        else Column(Modifier.fillMaxSize()) { SetsPage(m, top, act, Modifier.weight(1f).fillMaxWidth(), screen, query); nav(false) }
    }
}

@Composable
private fun SetsPage(m: CollectionSetsModel, top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, act: CollectionSetsActions, modifier: Modifier, screen: Dp, query: String) {
    val wide = screen >= 600.dp
    val gutter = if (wide) 22.dp else 16.dp
    // .set-year-grid: one column under 700, two from there; 10 / 12 / 16 apart; the year sections 26 / 32 / 40 apart.
    val cols = if (screen >= 700.dp) 2 else 1
    val gap = when { screen >= 1000.dp -> 16.dp; screen >= 700.dp -> 12.dp; else -> 10.dp }
    val sectionGap = when { screen >= 1000.dp -> 40.dp; screen >= 700.dp -> 32.dp; else -> 26.dp }
    LazyColumn(modifier, contentPadding = PaddingValues(bottom = 28.dp)) {
        item(key = "top") {
            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                // As on Cards and Decks: the game tabs ride in the bar when there is room, and sit centred under it on a phone.
                top(if (wide) ({ GameTabs(CardGame.MTG, act.game, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
            }
        }
        item(key = "head") {
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 4.dp else 10.dp)) {
                if (!wide) GameTabs(CardGame.MTG, act.game, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                // .page-head: the eyebrow, then the title in Cinzel; 4 above, 2 below.
                Text(m.eyebrow.uppercase(), Modifier.padding(bottom = 4.dp), style = SetsEyebrow)
                Text(m.title, Modifier.padding(bottom = 2.dp), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 29.9.sp, letterSpacing = .52.sp, color = Ink))
                Controls(m, act, screen, query)
                m.error?.let { WarnNote(it, m.retry, { m.retry?.let(act.press) }, Modifier.padding(top = 12.dp)) }
                if (m.loading.isNotBlank()) Text(m.loading, Modifier.fillMaxWidth().padding(vertical = 24.dp), style = sans(15f, 400, Mute), textAlign = TextAlign.Center)
            }
        }
        for ((si, s) in m.sections.withIndex()) {
            if (s.year.isNotBlank()) item(key = "y:" + s.year) {
                YearHead(s, Modifier.padding(horizontal = gutter).padding(top = if (si == 0) (if (screen >= 1000.dp) 30.dp else 24.dp) else sectionGap,
                    bottom = if (screen >= 1000.dp) 17.dp else 14.dp))
            } else if (si == 0) item(key = "flat") { Spacer(Modifier.height(24.dp)) }
            val lines = s.rows.chunked(cols)
            for ((li, line) in lines.withIndex()) item(key = "r:" + s.year + ":" + line.joinToString("|") { it.code }) {
                Row(Modifier.padding(horizontal = gutter).padding(bottom = if (li == lines.lastIndex) 0.dp else gap).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
                    for (r in line) SetTile(r, screen, Modifier.weight(1f).fillMaxHeight()) { act.set(r.code) }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
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
        if (m.more.isNotBlank()) item(key = "more") { GhostBlock(m.more, Modifier.padding(horizontal = gutter).padding(top = 28.dp), act.more) }
    }
}

/** .set-browser-controls: the search, the quick families, and the Filters pill with what it folds away. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Controls(m: CollectionSetsModel, act: CollectionSetsActions, screen: Dp, query: String) {
    val phone = screen < 700.dp
    val shape = RoundedCornerShape(if (phone) 16.dp else 20.dp)
    val pad = when { screen <= 380.dp -> 11.dp; phone -> 14.dp; else -> 18.dp }
    val f = m.filters
    var open by remember(f?.open) { mutableStateOf(SetsTest.open ?: (f?.open == true)) }
    // A CSS border sits outside the padding: 1 more inside the edge.
    Column(Modifier.fillMaxWidth().clip(shape).background(Color(0xF0171A20)).border(1.dp, LineC, shape).padding(pad + 1.dp), verticalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 14.dp)) {
        Search(query, m.searchPlaceholder, act.search, Modifier.fillMaxWidth())
        GlideStrip(m.quick, if (phone) 11f else 12f, if (screen <= 380.dp) 10.dp else 12.dp, grow = true, Modifier.fillMaxWidth(), act.family)
        // details.filters (4 above, 10 below): the summary, then 12 to its content, which stays as an empty row when closed.
        if (f != null) Column(Modifier.padding(top = 4.dp, bottom = 10.dp)) {
            // details.filters summary: a 44 pill with the filter icon, "Filters" and how many are on (10 under it when open).
            val pill = RoundedCornerShape(999.dp)
            Row(Modifier.fillMaxWidth().padding(bottom = if (open) 10.dp else 0.dp).height(44.dp).clip(pill).background(Color(0xDB171A20)).border(1.dp, Color(0xE62A2F39), pill)
                .clickable { open = !open }.semantics { role = Role.Button; contentDescription = f.label + if (open) ", open" else "" }.padding(start = 12.dp, end = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SiteIcon(f.icon, 16.dp, GoldC)
                Text(f.label.ifBlank { "Filters" }, style = sans(13f, 650))
                if (f.count.isNotBlank()) Box(Modifier.clip(RoundedCornerShape(99.dp)).background(GoldC).padding(horizontal = 7.dp)) { Text(f.count, style = sans(11f, 800, Color(0xFF1B1406))) }
            }
            Spacer(Modifier.height(12.dp))
            if (open) {
                // .set-browser-facets: four in a row, two on a phone (10 between rows); each select under its small label.
                val per = if (phone) 2 else 4
                val lines = f.facets.chunked(per)
                for ((li, line) in lines.withIndex()) Row(Modifier.padding(bottom = if (li < lines.lastIndex) 10.dp else 0.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (x in line) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(x.title, style = sans(11f, 400, Mute))
                        GlassSelect(x.sel, { v -> act.facet(x.sel.name, v) }, Modifier.fillMaxWidth())
                    }
                    repeat(per - line.size) { Spacer(Modifier.weight(1f)) }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(if (phone) 16.dp else 14.dp), verticalArrangement = Arrangement.spacedBy(2.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                    Text(f.status, if (phone) Modifier.fillMaxWidth() else Modifier, style = sans(12f, 400, Mute, lh = 1.5f))
                    for (b in f.buttons) Text(b.label, Modifier.heightIn(min = 38.dp).clickable(enabled = !b.disabled) { act.press(b) }.padding(vertical = 10.dp),
                        style = sans(13f, 600, if (b.disabled) Mute else GoldC))
                }
                if (f.freshness.isNotBlank()) Text(f.freshness, style = sans(11f, 400, Mute, lh = 1.6f))
            }
        }
    }
}

/** .set-year-heading: the year, "6 releases", and a hairline fading out to the right. */
@Composable
private fun YearHead(s: SetsSection, modifier: Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(s.year, Modifier.alignByBaseline(), style = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 22.sp, letterSpacing = (-.99).sp, color = Ink,
            fontFeatureSettings = "tnum"))
        Text(s.count, Modifier.alignByBaseline(), style = sans(11f, 400, Mute, ls = .385f))
        Box(Modifier.weight(1f).align(Alignment.CenterVertically).height(1.dp).background(Brush.horizontalGradient(listOf(LineC, Color.Transparent))))
    }
}

/** One release (.set-row.set-browser-tile): the quiet set art behind, the symbol in its box, name, code and family · date, the count; your progress under a hairline. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SetTile(r: SetRowM, screen: Dp, modifier: Modifier, onClick: () -> Unit) {
    val phone = screen < 700.dp
    val tiny = screen <= 380.dp
    val mid = !phone && screen < 1000.dp
    val shape = RoundedCornerShape(if (phone) 15.dp else 18.dp)
    val pad = when { tiny -> 10.dp; phone -> 12.dp; screen >= 1000.dp -> 18.dp; else -> 16.dp }
    val bodyGap = when { tiny -> 9.dp; phone -> 12.dp; mid -> 10.dp; screen >= 1100.dp -> 18.dp; else -> 14.dp }
    val (mw, mh) = when { tiny -> 60.dp to 62.dp; phone -> 76.dp to 76.dp; mid -> 60.dp to 66.dp; screen >= 1100.dp -> 96.dp to 82.dp; else -> 76.dp to 76.dp }
    Box(modifier.heightIn(min = when { phone -> 100.dp; screen >= 1000.dp -> 128.dp; else -> 118.dp }).clip(shape)
        .drawBehind { drawRect(cssGradient(135f, 0f to Color(0xFF282325), 1f to Surface)) }
        .border(1.dp, LineC, shape).clickable(onClick = onClick).semantics { role = Role.Button; contentDescription = r.name }) {
        SetAtmosphere(r.atmosphere, if (phone) .72f else .65f, if (phone) .2f else .24f, Modifier.matchParentSize())
        Column(Modifier.fillMaxWidth().padding(pad + 1.dp), verticalArrangement = Arrangement.spacedBy(if (phone) 12.dp else 15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(bodyGap)) {
                SetMedia(r, mw, mh)
                Column(Modifier.weight(1f)) {
                    Text(r.name, style = sans(when { mid -> 13f; phone -> 14f; else -> 15f }, 700, Ink, lh = 1.4f))
                    FlowRow(Modifier.padding(top = 7.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(2.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                        if (r.mark.isNotBlank()) Box(Modifier.clip(RoundedCornerShape(5.dp)).border(1.dp, LineC, RoundedCornerShape(5.dp)).padding(horizontal = 7.dp, vertical = 3.dp)) {
                            Text(r.mark, style = sans(11f, 400, GoldC, lh = 1.5f))
                        }
                        Text(r.detail, style = sans(11f, 400, Mute, lh = 1.5f))
                    }
                }
                // .set-row-count: the total right-aligned over its unit ("Card total" over "Unknown" when the total isn't known).
                Column(Modifier.widthIn(max = if (tiny || mid) 62.dp else 78.dp), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val big = sans(when { tiny -> 17f; phone -> 19f; mid -> 18f; else -> 22f }, 650, Ink, lh = 1.45f).let { it.copy(letterSpacing = (-.04f * it.fontSize.value).sp) }
                    if (r.unknown) { r.units.forEach { Text(it, style = sans(11f, 400, Mute, lh = 1.35f), textAlign = TextAlign.End) }; Text(r.count, style = sans(12f, 650, Mute)) }
                    else { if (r.count.isNotBlank()) Text(r.count, style = big); r.units.forEach { Text(it, style = sans(11f, 400, Mute, lh = 1.35f), textAlign = TextAlign.End) } }
                }
            }
            r.progress?.let { TileProgress(it, tiny) }
        }
    }
}

/** .set-media: the set's symbol (Scryfall's black SVG, inverted to .9 white) 8 in from its 12-cornered box; its code when there is no art. */
@Composable
private fun SetMedia(r: SetRowM, w: Dp, h: Dp) {
    Box(Modifier.size(w, h).clip(RoundedCornerShape(12.dp)).background(Color(0x09FFFFFF)), contentAlignment = Alignment.Center) {
        val p = firstArt(listOfNotNull(r.image.ifBlank { null }))
        val st = (p as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
        if (p != null && st !is coil3.compose.AsyncImagePainter.State.Error) {
            val svg = r.image.contains("svgs.scryfall.io") || r.image.endsWith(".svg")
            Image(p, r.name + " set artwork", Modifier.fillMaxSize().padding(8.dp), contentScale = ContentScale.Fit,
                colorFilter = if (svg) ColorFilter.tint(Color(0xFFE6E6E6), BlendMode.SrcIn) else null)
        } else Text(r.fallback, style = sans(13f, 650, Mute, ls = .52f))
    }
}

/** .set-tile-progress: "0 / 462 unique cards owned" and its share over a 5 tall bar, under a hairline. */
@Composable
private fun TileProgress(p: SetProgress, tiny: Boolean) {
    Column(Modifier.fillMaxWidth().drawBehind { drawLine(LineC, Offset(0f, .5f), Offset(size.width, .5f), 1.dp.toPx()) }.padding(top = 13.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(p.label, Modifier.weight(1f), style = sans(if (tiny) 10f else 11f, 400, Mute, lh = 1.5f))
            if (p.pct.isNotBlank()) Text(p.pct, style = sans(11f, 600, Ink, lh = 1.5f))
        }
        p.fill?.let { SetProgressBar(it, Modifier.padding(top = 7.dp, bottom = 5.dp)) }
        if (p.caption.isNotBlank()) Text(p.caption, style = sans(10f, 400, Mute, lh = 1.5f))
    }
}

/** .set-progress-track: 5 tall on the text's 8 %, the fill from bronze to sage. */
@Composable
internal fun SetProgressBar(fill: Float, modifier: Modifier) {
    Box(modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(99.dp)).background(Ink.copy(alpha = .08f))) {
        if (fill > 0f) Box(Modifier.fillMaxHeight().fillMaxWidth(fill.coerceIn(0f, 1f)).clip(RoundedCornerShape(99.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFFC69F78), Color(0xFFA3D7AD)))))
    }
}

/** For tests: the browser drawn with its Filters open (the summary is a tap away on a phone). */
object SetsTest { var open: Boolean? = null }
