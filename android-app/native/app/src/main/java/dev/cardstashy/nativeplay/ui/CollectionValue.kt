package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
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
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardData
import androidx.compose.ui.text.drawText

/**
 * Collection › Value for one game: views.js collectionValueView (Magic) and tcg.js tcgValueView (Yu-Gi-Oh!, Pokémon), as the engine
 * reads the site's page (Collection.value): the overview with its chart, price sources and composition, trade advice, price alerts,
 * the most valuable lots and (Magic) the trade binder, in the site's order. Drawn to value-page.css under body.glass.
 */
class CollectionValueModel(val game: CardGame, val accent: Color, val empty: JsonObject?, val blocks: List<JsonObject>) {
    companion object {
        fun parse(j: JsonObject) = CollectionValueModel(CardGame.of(j.s("game")), cssColor(j.s("accent"), MagicGold) ?: MagicGold, j.o("empty"), j.objs("blocks"))
    }
}

/** What Value's taps do: Refresh prices (its data-act), a card (data-act card / tCard and the row's dataset), Copy list, a price alert. */
class CollectionValueActions(
    val refresh: (String) -> Unit = {},
    val open: (act: String, data: JsonObject, name: String) -> Unit = { _, _, _ -> },
    val copySpare: () -> Unit = {},
)

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
private fun JsonObject.f(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asFloat ?: 0f
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
private fun JsonObject.floats(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asFloat }.orEmpty()

// style.css tokens (dark) and body.glass, as the Cards tab draws them.
private val MagicGold = Color(0xFFE8B95B)
/** --gold: the open game's accent (body[data-game]). */
private val GoldV: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current
private val InkV = Color(0xFFEEF0F4)
private val MuteV = Color(0xFF9AA2B1)
private val FaintV = Color(0xFF8B93A3)
private val LineV = Color(0xFF2A2F39)
private val Surface2V = Color(0xFF1F232B)
private val SurfaceV = Color(0xFF171A20)
private val GlassLineV = Color(0x17FFFFFF)           // --glass-line rgba(255,255,255,.09)
private val GlassV = Color(0x75171A20)               // --glass: --surface at 46 %
private val Glass2V = Color(0x851F232B)              // --glass-2: --surface-2 at 52 %
private val GoodV = Color(0xFF6FD29A)
private val BadV = Color(0xFFF08A7E)
private val WarnV = Color(0xFFF2C66D)

private fun vsans(size: Float, weight: Int = 400, color: Color = InkV, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color,
        fontFeatureSettings = "tnum")

/** The page's blocks as lazy items under the Cards tab's head ([gutter] its side margins). */
fun LazyListScope.collectionValueItems(m: CollectionValueModel?, a: CollectionValueActions, gutter: Dp, narrow: Boolean, refreshing: Boolean = false) {
    if (m == null) {
        item(key = "v:wait") { Text("Adding up your collection…", Modifier.fillMaxWidth().padding(horizontal = gutter).padding(vertical = 24.dp), style = vsans(15f, color = MuteV), textAlign = TextAlign.Center) }
        return
    }
    m.empty?.let { e ->
        // ui.js empty(): the ◇ mark, its title and line, centred.
        item(key = "v:empty") {
            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (e.s("mark").isNotBlank()) Text(e.s("mark"), style = vsans(28f, 400, GoldV.copy(alpha = .8f)))
                Text(e.s("title"), style = vsans(17f, 800), textAlign = TextAlign.Center)
                Text(e.s("text"), style = vsans(14f, 400, MuteV), textAlign = TextAlign.Center)
            }
        }
    }
    m.blocks.forEachIndexed { i, b ->
        item(key = "v:$i:" + b.s("k")) {
            Box(Modifier.padding(horizontal = gutter)) {
                when (b.s("k")) {
                    "overview" -> Overview(b, m, a, narrow, refreshing)
                    "composition" -> Composition(b, narrow)
                    "advice" -> Advice(b, a, narrow)
                    "alerts" -> Alerts(b, a, narrow)
                    "top" -> TopLots(b, m, a, narrow)
                    "spare" -> Spare(b, a, narrow)
                    "foot" -> Text(b.s("text"), Modifier.padding(top = 10.dp), style = vsans(12f, 400, FaintV))
                }
            }
        }
    }
}

/** .panel under body.glass (.value-panel): 14 corners, the glass sheen at 160°, the glass line; 18 in (14 under 420 dp), 12 apart. */
@Composable
private fun ValuePanel(narrow: Boolean, top: Boolean = false, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(shape).background(GlassV).drawBehind {
        val dx = .342f; val dy = .940f; val half = (size.width * dx + size.height * dy) / 2
        drawRect(Brush.linearGradient(0f to Color(0x0BFFFFFF), .45f to Color.Transparent, start = center - Offset(dx * half, dy * half), end = center + Offset(dx * half, dy * half)))
        // --glass-hi: a 1 px light top edge inside.
        drawRect(Color(0x12FFFFFF), size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx()))
        // .value-overview: its top border is 2 px (the glass line's colour, which body.glass gives every side).
        if (top) drawRect(GlassLineV, size = androidx.compose.ui.geometry.Size(size.width, 2.dp.toPx()))
    }.border(1.dp, GlassLineV, shape).padding(if (narrow) 14.dp else 18.dp)) { content() }
}

/** .value-section-head: the h3 (14, 700) and its note (11, muted) on one baseline, 12 above what follows. */
@Composable
private fun SectionHead(title: String, tag: String) {
    @OptIn(ExperimentalLayoutApi::class)
    FlowRow(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = vsans(14f, 700))
        if (tag.isNotBlank()) Text(tag, Modifier.align(Alignment.CenterVertically), style = vsans(11f, 400, MuteV))
    }
}

@Composable
private fun Overview(b: JsonObject, m: CollectionValueModel, a: CollectionValueActions, narrow: Boolean, refreshing: Boolean) = ValuePanel(narrow, top = true) {
    @OptIn(ExperimentalLayoutApi::class)
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.Start), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f).widthIn(min = 180.dp)) {
            // .value-game-label: the game's mark (18, its colour) and "MAGIC · YOUR COLLECTION VALUE" (10, .075em; 9 under 420 dp).
            Row(Modifier.padding(bottom = 9.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                b.o("icon")?.let { SiteIcon(CollectionCardsModel.svg(it), 18.dp, m.accent) }
                Text(b.s("label").uppercase(), style = vsans(if (narrow) 9f else 10f, 700, MuteV, ls = (if (narrow) 9f else 10f) * .075f))
            }
            // .value-amount: 800 clamp(32, 6vw, 46) / 1.15, -.045em, tabular.
            Text(b.s("amount"), Modifier.padding(bottom = 4.dp), style = vsans(if (narrow) 32f else 40f, 800, InkV, lh = 1.15f, ls = (if (narrow) 32f else 40f) * -.045f).copy(fontFamily = Site.Manrope))
            Text(b.s("coverage"), style = vsans(12f, 400, MuteV))
            if (b.s("copies").isNotBlank()) Text(b.s("copies"), Modifier.padding(top = 6.dp), style = vsans(13f, 400, MuteV))
        }
        b.o("refresh")?.let { r ->
            // .btn.ghost.small.value-refresh: 44 tall (value-page.css keeps the touch target), the refresh mark and its word.
            Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(11.dp)).background(Glass2V).border(1.dp, GlassLineV, RoundedCornerShape(11.dp))
                .clickable(enabled = !refreshing) { a.refresh(r.s("act")) }.semantics { role = Role.Button }.padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                // ui.js busy(): the button reads "Refreshing…" until the refresh ends.
                if (!refreshing) Text("↻", style = vsans(14f, 700))
                Text(if (refreshing) "Refreshing…" else r.s("label"), maxLines = 1, style = vsans(13.5f, 700, if (refreshing) MuteV else InkV))
            }
        }
    }
    if (b.s("saved").isNotBlank()) Text(b.s("saved"), Modifier.padding(top = 12.dp), style = vsans(11f, 400, MuteV, lh = 1.6f))
    b.o("chart")?.let { Chart(it, m.accent, narrow) }
    b.o("sources")?.let { Sources(it) }
    if (b.s("sourceNote").isNotBlank()) Column(Modifier.padding(top = 12.dp).fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(LineV))
        Text(b.s("sourceNote"), Modifier.padding(top = 12.dp), style = vsans(11f, 400, MuteV, lh = 1.6f))
    }
}

/** .value-chart: 16 under a line; the head, the change, the period and range lines, the plot (value-page.js valueHistoryChart), its dates, legend and note. */
@Composable
private fun Chart(c: JsonObject, accent: Color, narrow: Boolean) {
    Column(Modifier.fillMaxWidth().padding(top = 18.dp)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(LineV))
        Spacer(Modifier.height(16.dp))
        if (c.b("empty")) {
            Text(c.s("title"), style = vsans(14f, 700))
            Text(c.s("text"), Modifier.padding(top = 6.dp), style = vsans(13f, 400, MuteV))
            return@Column
        }
        SectionHead(c.s("title"), c.s("count"))
        c.o("change")?.let { ch ->
            val tone = when (ch.s("dir")) { "up" -> GoodV; "down" -> BadV; else -> InkV }
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(Modifier.padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(ch.s("amount"), style = vsans(14f, 700, tone))
                Text(ch.s("label"), Modifier.align(Alignment.Bottom).padding(bottom = 1.dp), style = vsans(11f, 400, MuteV))
            }
        }
        for (p in c.strs("periods")) Text(p, Modifier.padding(bottom = 8.dp), style = vsans(11f, 400, MuteV, lh = 1.5f))
        val range = c.objs("range")
        if (range.isNotEmpty()) Text(buildAnnotatedString {
            for (r in range) if (r.b("b")) withStyle(SpanStyle(color = InkV, fontWeight = FontWeight.SemiBold)) { append(r.s("t")) } else append(r.s("t"))
        }, Modifier.padding(bottom = 8.dp), style = vsans(12f, 400, MuteV, lh = 1.5f))
        Plot(c, accent, narrow)
        val dates = c.strs("dates")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = if (dates.size > 1) Arrangement.SpaceBetween else Arrangement.Start) {
            for (d in dates) Text(d, style = vsans(11f, 400, MuteV))
        }
        val legend = c.objs("legend")
        if (legend.isNotEmpty()) @OptIn(ExperimentalLayoutApi::class) FlowRow(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (l in legend) Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                val kind = l.s("kind")
                when {
                    kind.contains("partial-line") -> Canvas(Modifier.size(18.dp, 2.dp)) { drawLine(accent, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), size.height, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))) }
                    kind.contains("unavailable") -> Text(l.s("mark").ifBlank { "×" }, style = vsans(10f, 400, MuteV))
                    else -> Box(Modifier.size(8.dp).border(1.5.dp, if (kind.contains("partial")) WarnV else MuteV, CircleShape))
                }
                Text(l.s("label"), style = vsans(10f, 400, MuteV))
            }
        }
        if (c.s("note").isNotBlank()) Text(c.s("note"), Modifier.padding(top = 12.dp), style = vsans(11f, 400, MuteV, lh = 1.6f))
        c.o("history")?.let { h -> History(h) }
    }
}

/** The plot itself: the svg's view box scaled to the panel's width (height auto), its dashed grid, lines, points and gaps.
 *  The axis labels are hidden under 600 dp (value-page.css), as the range line above says the same. */
@Composable
private fun Plot(c: JsonObject, accent: Color, narrow: Boolean) {
    val vb = c.floats("vb").takeIf { it.size == 4 } ?: listOf(0f, 0f, 640f, 190f)
    val grid = c.objs("grid"); val lines = c.objs("lines"); val points = c.objs("points"); val gaps = c.objs("gaps")
    BoxWithConstraints(Modifier.fillMaxWidth().aspectRatio(vb[2] / vb[3]).semantics { contentDescription = c.s("desc").ifBlank { "Collection value over time" } }) {
        val axis = maxWidth >= 600.dp
        val measurer = androidx.compose.ui.text.rememberTextMeasurer()
        Canvas(Modifier.fillMaxSize()) {
            val k = size.width / vb[2]
            fun x(v: Float) = (v - vb[0]) * k
            fun y(v: Float) = (v - vb[1]) * k
            for (g in grid) {
                drawLine(LineV, Offset(x(g.f("x1")), y(g.f("y"))), Offset(x(g.f("x2")), y(g.f("y"))), 1f * k, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f * k, 5f * k)))
                if (axis && g.s("label").isNotBlank()) {
                    val t = measurer.measure(g.s("label"), vsans(11f * k / density, 400, MuteV))
                    drawText(t, topLeft = Offset(x(g.f("x1") - 10f) - t.size.width, y(g.f("y") + 4f) - t.size.height * .78f))
                }
            }
            for (l in lines) drawLine(accent, Offset(x(l.f("x1")), y(l.f("y1"))), Offset(x(l.f("x2")), y(l.f("y2"))), 2.5f * k, StrokeCap.Round,
                pathEffect = if (l.b("partial")) PathEffect.dashPathEffect(floatArrayOf(6f * k, 5f * k)) else null)
            for (p in points) {
                val o = Offset(x(p.f("x")), y(p.f("y"))); val r = p.f("r").takeIf { it > 0f } ?: 4f
                when (p.s("status")) {
                    "partial" -> { drawCircle(SurfaceV, r * k, o); drawCircle(WarnV, r * k, o, style = Stroke(2f * k)) }
                    "legacy" -> { drawCircle(SurfaceV, r * k, o); drawCircle(MuteV, r * k, o, style = Stroke(2f * k)) }
                    else -> { drawCircle(accent, r * k, o); drawCircle(accent, r * k, o, style = Stroke(2f * k)) }
                }
            }
            for (g in gaps) {
                val cx = x(g.f("x")); val cy = y(g.f("y")); val d = 3f * k
                drawLine(MuteV, Offset(cx - d, cy - d), Offset(cx + d, cy + d), 1.5f * k)
                drawLine(MuteV, Offset(cx - d, cy + d), Offset(cx + d, cy - d), 1.5f * k)
            }
        }
    }
}

/** details.value-history-details: "View recorded values" (32 tall, ▸ / ▾), each snapshot's date and total over its label, 7 apart with a line between. */
@Composable
private fun History(h: JsonObject) {
    var open by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.padding(top = 10.dp).fillMaxWidth()) {
        Row(Modifier.heightIn(min = 44.dp).clickable { open = !open }.semantics { role = Role.Button }, verticalAlignment = Alignment.CenterVertically) {
            Text(if (open) "▾" else "▸", Modifier.padding(end = 7.dp), style = vsans(11f, 400, MuteV))
            Text(h.s("summary"), style = vsans(11f, 400, MuteV))
        }
        if (open) for (r in h.objs("rows")) Column(Modifier.fillMaxWidth().drawBehind { drawLine(LineV, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }.padding(vertical = 7.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(r.s("date"), style = vsans(11f, 400, MuteV))
                Text(r.s("total"), style = vsans(11f, 700, InkV))
            }
            Text(r.s("label"), Modifier.padding(top = 3.dp), style = vsans(11f, 400, MuteV))
        }
    }
}

/** price-origin.js priceSourcesHtml (details.value-price-sources): a line above, "Price sources" (650, muted), each group's label,
 *  copies (11, muted) and total, then its note. */
@Composable
private fun Sources(s: JsonObject) {
    var open by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.padding(top = 14.dp).fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(LineV))
        Row(Modifier.padding(top = 4.dp).heightIn(min = 44.dp).clickable { open = !open }.semantics { role = Role.Button }, verticalAlignment = Alignment.CenterVertically) {
            Text(if (open) "▾" else "▸", Modifier.padding(end = 7.dp), style = vsans(13f, 650, MuteV))
            Text(s.s("summary"), style = vsans(13f, 650, MuteV))
        }
        if (open) {
            Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for (r in s.objs("rows")) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(r.s("label"), style = vsans(13f))
                        Text(r.s("copies"), style = vsans(11f, 400, MuteV))
                    }
                    Text(r.s("value"), style = vsans(13f, 650))
                }
            }
            Text(s.s("foot"), style = vsans(12f, 400, FaintV))
        }
    }
}

/** .value-composition: "By color" and its meters (name with its colour dot, the total, a 5 dp track filled to share, copies). */
@Composable
private fun Composition(b: JsonObject, narrow: Boolean) = ValuePanel(narrow) {
    SectionHead(b.s("title"), b.s("tag"))
    val meters = b.objs("meters")
    if (meters.isEmpty() && b.s("empty").isNotBlank()) Text(b.s("empty"), style = vsans(13f, 400, MuteV))
    for (mt in meters) {
        val colors = mt.strs("colors").mapNotNull { cssColor(it, InkV) }.ifEmpty { listOf(MuteV) }
        Column(Modifier.fillMaxWidth().padding(vertical = 9.dp).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (colors.size > 1) Brush.linearGradient(colors) else androidx.compose.ui.graphics.SolidColor(colors[0])))
                    Text(mt.s("name"), style = vsans(12f))
                }
                Text(mt.s("total"), style = vsans(12f, 700))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(8.dp)).background(Color(0x1F97A5BC))) {
                    Box(Modifier.fillMaxWidth(mt.f("width").coerceIn(0f, 1f)).height(5.dp).clip(RoundedCornerShape(8.dp))
                        .background(if (colors.size > 1) Brush.horizontalGradient(colors) else androidx.compose.ui.graphics.SolidColor(colors[0])))
                }
                Text(mt.s("copies"), style = vsans(11f, 400, MuteV))
            }
        }
    }
    if (b.s("note").isNotBlank()) Text(b.s("note"), Modifier.padding(top = 12.dp), style = vsans(11f, 400, MuteV, lh = 1.6f))
}

/** .mini-row: name (ellipsis) and its note or price, 9 / 2 in, a line under each, 44 tall at least. */
@Composable
private fun MiniRow(name: String, note: String, end: String, emblem: JsonObject? = null, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClick = onClick).semantics { role = Role.Button }
        .drawBehind { drawLine(LineV, Offset(0f, size.height - .5f), Offset(size.width, size.height - .5f), 1.dp.toPx()) }.padding(horizontal = 2.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(name, Modifier.weight(1f, fill = false), maxLines = 1, overflow = TextOverflow.Ellipsis, style = vsans(14f, if (emblem != null || note.isNotBlank()) 700 else 400))
                emblem?.let { e -> SiteIcon(CollectionCardsModel.svg(e.o("icon")), 16.dp, InkV, Modifier.padding(start = 4.dp).semantics { contentDescription = e.s("title") }) }
            }
            if (note.isNotBlank()) Text(note, maxLines = 2, overflow = TextOverflow.Ellipsis, style = vsans(12f, 400, MuteV))
        }
        if (end.isNotBlank()) Text(end, style = vsans(if (note.isNotBlank()) 13f else 14f, 700))
    }
}

/** importance.js tradeAdviceHtml: details.panel.advice, "Trade & play advice" and its count; each group's head and rows; its note. */
@Composable
private fun Advice(b: JsonObject, a: CollectionValueActions, narrow: Boolean) = ValuePanel(narrow) {
    var open by rememberSaveable { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { open = !open }.semantics { role = Role.Button }, horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text(if (open) "▾" else "▸", style = vsans(13f, 700, MuteV))
        Text(b.s("title"), style = vsans(15f, 700))
        Text(b.s("tag"), style = vsans(13f, 400, MuteV))
    }
    if (open) {
        for (g in b.objs("groups")) {
            Text(g.s("head").uppercase(), Modifier.padding(top = 12.dp, bottom = 4.dp), style = vsans(13f, 700, InkV, ls = 13f * .06f))
            for (r in g.objs("rows")) MiniRow(r.s("name"), r.s("note"), r.s("price"), r.o("emblem")) { a.open(r.s("act"), r.o("data") ?: JsonObject(), r.s("name")) }
        }
        Text(b.s("foot"), Modifier.padding(top = 10.dp), style = vsans(12f, 400, FaintV))
    }
}

/** pricehist.js alertsPanel: "Price alerts", its line when there are none, or each alert's card and its thresholds. */
@Composable
private fun Alerts(b: JsonObject, a: CollectionValueActions, narrow: Boolean) = ValuePanel(narrow) {
    Text(b.s("title"), Modifier.padding(bottom = 8.dp), style = vsans(15f, 700))
    val rows = b.objs("rows")
    if (rows.isEmpty()) Text(b.s("empty"), style = vsans(13f, 400, MuteV))
    for (r in rows) MiniRow(r.s("name"), r.s("note"), "") { a.open(r.s("act"), r.o("data") ?: JsonObject(), r.s("name")) }
}

/** value-page.js valueTopLots: "Most valuable", up to 12 owned lots, each its art (44 × 62, 38 × 54 under 420 dp) in its finish, name, details,
 *  copies and each, the origin badge, and the lot's total at the end. */
@Composable
private fun TopLots(b: JsonObject, m: CollectionValueModel, a: CollectionValueActions, narrow: Boolean) = ValuePanel(narrow) {
    SectionHead(b.s("title"), b.s("tag"))
    val lots = b.objs("lots")
    if (lots.isEmpty()) Text(b.s("empty"), style = vsans(13f, 400, MuteV))
    lots.forEachIndexed { i, l ->
        Row(Modifier.fillMaxWidth().heightIn(min = 54.dp).then(if (i > 0) Modifier.drawBehind { drawLine(LineV, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) } else Modifier)
            .clickable { a.open(l.s("act"), l.o("data") ?: JsonObject(), l.s("name")) }.semantics(mergeDescendants = true) { contentDescription = l.s("aria"); role = Role.Button }
            .padding(top = if (i == 0) 0.dp else 12.dp, bottom = if (i == lots.lastIndex) 0.dp else 12.dp),
            horizontalArrangement = Arrangement.spacedBy(if (narrow) 9.dp else 12.dp), verticalAlignment = Alignment.CenterVertically) {
            LotThumb(l, m.game, if (narrow) 38.dp else 44.dp, if (narrow) 54.dp else 62.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(l.s("name"), style = vsans(13f, 700, InkV, lh = 1.35f))
                if (l.s("details").isNotBlank()) Text(l.s("details"), style = vsans(10f, 400, MuteV, lh = 1.5f))
                Text(l.s("copies"), style = vsans(10f, 400, MuteV))
                if (l.s("origin").isNotBlank()) Text(l.s("origin"), Modifier.clip(RoundedCornerShape(6.dp)).background(GoldV.copy(alpha = .12f)).padding(horizontal = 6.dp, vertical = 1.dp),
                    style = vsans(10f, 700, GoldV))
            }
            Text(l.s("total"), Modifier.then(if (narrow) Modifier.widthIn(max = 90.dp) else Modifier), style = vsans(if (narrow) 12f else 14f, 700), textAlign = TextAlign.End)
        }
    }
}

/** .value-lot-art: the lot's picture (contain, 4 corners) wearing its finish as finish-preview.js gives it (Magic from the saved printing). */
@Composable
private fun LotThumb(l: JsonObject, game: CardGame, w: Dp, h: Dp) {
    val pic = l.o("picture")
    val url = pic?.s("src")?.ifBlank { null }
    Box(Modifier.size(w, h).clip(RoundedCornerShape(4.dp)).background(Surface2V), contentAlignment = Alignment.Center) {
        val tf = TcgFinish.of(l.o("tcgFinish"))
        if (url != null && tf != null) TcgLotPicture(url, tf, l.s("name"), Modifier.fillMaxSize(), RoundedCornerShape(4.dp))
        else if (url != null) {
            val print = l.o("print"); val fin = l.o("finish")
            val context = LocalContext.current
            val data = if (print != null) CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) } else null
            val look = data?.let { Foil.look(it, print, Foil.finishFor(print, fin?.s("key")?.ifBlank { "nonfoil" } ?: "nonfoil")) }?.takeIf { it.shines }
            val tilt = if (look != null) rememberFoilTilt(live = true, phase = (l.s("name").hashCode() and 0xff) / 255f, tile = true) else null
            CardPicture(url, look, tilt, Modifier.fillMaxSize(), RoundedCornerShape(4.dp))
        } else Text(l.s("fallback").ifBlank { "◇" }, style = vsans(9f, 400, MuteV), textAlign = TextAlign.Center)
    }
}

/** views.js's Trade binder: its title and line, Copy list (btn ghost small), and up to 30 spare cards with their value. */
@Composable
private fun Spare(b: JsonObject, a: CollectionValueActions, narrow: Boolean) = ValuePanel(narrow) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(b.s("title"), Modifier.padding(bottom = 4.dp), style = vsans(15f, 700))
            Text(b.s("line"), style = vsans(13f, 400, MuteV))
        }
        b.o("copy")?.let { c ->
            Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(11.dp)).background(Glass2V).border(1.dp, GlassLineV, RoundedCornerShape(11.dp))
                .clickable(onClick = a.copySpare).semantics { role = Role.Button }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                Text(c.s("label"), style = vsans(13.5f, 700))
            }
        }
    }
    Spacer(Modifier.height(6.dp))
    val rows = b.objs("rows")
    if (rows.isEmpty()) Text(b.s("empty"), style = vsans(13f, 400, MuteV))
    for (r in rows) MiniRow(r.s("name"), "", r.s("price")) { a.open(r.s("act"), r.o("data") ?: JsonObject(), r.s("name")) }
}
