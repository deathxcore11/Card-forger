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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()

/** One block of views.js ideaSheet, in its order (CollectionEngine.ideaSheet / IDEA_MODEL). */
class IdeaBlock(val j: JsonObject) { val k get() = j.s("k") }
/** The deck idea sheet as the site's markup leaves it: the commander, its blocks, and whether a build is running. */
class IdeaSheetModel(val i: Int, val title: String, val close: String, val busy: Boolean, val error: String, val blocks: List<IdeaBlock>, val toasts: List<String>) {
    companion object {
        /** Null when the sheet isn't open in the engine ({missing}). */
        fun parse(j: JsonObject): IdeaSheetModel? = if (j.b("missing") || !j.has("blocks")) null else IdeaSheetModel(j.get("i")?.asInt ?: 0, j.s("title"), j.s("close").ifBlank { "Close" },
            j.b("busy"), j.s("error"), j.objs("blocks").map(::IdeaBlock), j.get("toasts")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty())
    }
}

/** What the idea sheet does outside itself: a card's page (A.card, with "Back to deck idea"), a saved deck's page, the sheet closed. */
class IdeaSheetActions(val close: () -> Unit, val card: (String) -> Unit, val deck: (String) -> Unit)

/**
 * views.js ideaSheet, drawn natively on the site's sheet (SiteSheet): the commander's art and plan, the four impact tiles, Save, the
 * budget chips and custom budget, the build overlay or status line, the selection bar, the deck viewer of tickable rows (deck-viewer.js's
 * four views), the deck picker and the sticky actions. Its controls are app.js's own handlers in the engine (CollectionEngine.ideaDo:
 * A.ideaBudget, A.ideaCustomBudget, C.ideaPick, A.ideaSelect, A.deckView); its saves go through CollectionWrites (A.ideaSaveAll,
 * A.ideaToDeck, A.ideaWish, A.ideaOwn after its question, A.ideaBuy: the list copied and TCGplayer opened). The build is read again
 * as it goes (settle).
 */
@Composable
fun IdeaSheet(i: Int, backdrop: GraphicsLayer?, act: IdeaSheetActions, initial: IdeaSheetModel? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var model by remember(i) { mutableStateOf(initial) }
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    var job by remember { mutableStateOf<Job?>(null) }
    fun take(j: JsonObject) { IdeaSheetModel.parse(j)?.let { m -> model = m; m.toasts.lastOrNull()?.let { CollectionWrites.show(it) } } }
    /** A control: the site's handler, then the sheet read again while the build it starts runs (up to a minute, views.js's own note). */
    fun run(call: suspend () -> JsonObject) { job?.cancel(); job = scope.launch {
        if (HomeCache.loaded == null) return@launch
        runCatching { take(call()); CollectionEngine.settle(120_000, CollectionEngine.IDEA_MODEL) { j -> take(j) } }
    } }
    // app.js openIdea: the sheet opens and builds at the remembered budget; the app keeps the deck view (the site keeps it in settings).
    LaunchedEffect(i) { if (initial == null) run { CollectionEngine.ideaSheet(i); CollectionEngine.ideaDo("view", prefs.getString("deckView", null).orEmpty()) } }
    // A save (here or elsewhere): the sheet again from the account as it is now (an unknown view changes nothing and reads it).
    val written by CollectionWrites.written.collectAsState()
    var seen by remember(i) { mutableStateOf(written) }
    LaunchedEffect(written) { if (written != seen) { seen = written; if (initial == null) run { CollectionEngine.ideaDo("view", "") } } }
    fun write(kind: String, data: JsonObject = JsonObject(), after: ((JsonObject) -> Unit)? = null) = scope.launch {
        CollectionWrites.act(context, kind, data, after)
    }
    val m = model
    val ui = IdeaUi(
            budget = { v -> run { CollectionEngine.ideaDo("budget", v) } },
            custom = { v -> run { CollectionEngine.ideaDo("custom", v) } },
            pick = { n, on -> run { CollectionEngine.ideaDo("pick", JsonObject().apply { addProperty("name", n); addProperty("on", on) }.toString()) } },
            select = { v -> run { CollectionEngine.ideaDo("select", v) } },
            view = { v -> prefs.edit().putString("deckView", v).apply(); run { CollectionEngine.ideaDo("view", v) } },
            card = act.card,
            press = { kind, deck ->
                when (kind) {
                    // A.ideaSaveAll: the new deck's page (made), the sheet closed.
                    "ideaSaveAll" -> write(kind) { r -> r["made"]?.takeIf { it.isJsonPrimitive }?.asString?.let { com.google.gson.JsonParser.parseString(it).asJsonObject }
                        ?.takeIf { it.s("go") == "deck" }?.let { d -> deckOpensOn("mtg", d.s("id"), d.s("tab")); act.deck(d.s("id")) } }
                    "ideaToDeck" -> write(kind, JsonObject().apply { addProperty("deck", deck) })
                    "ideaBuy", "ideaWish", "ideaOwn" -> write(kind)
                    else -> {}
                }
            })
    // .idea-actions is sticky at the sheet's bottom (style.css 542): the sheet's foot.
    val actions = m?.blocks?.firstOrNull { it.k == "actions" }
    SiteSheet(m?.title.orEmpty(), backdrop, onClose = { scope.launch { runCatching { CollectionEngine.ideaClose() } }; act.close() },
        foot = actions?.let { a -> { IdeaActions(a.j, ui) } }) { vw ->
        // A controller: X is the foot's gold button (Save as deck) while it is live.
        val padMain = actions?.j?.objs("buttons")?.firstOrNull()?.takeIf { !it.b("disabled") }
        PadScreen(remember(padMain) { PadActs(x = padMain?.let { b -> PadAct(b.s("label")) { ui.press(b.s("act"), "") } }) })
        if (m == null) { Text("Opening…", style = cssType(15f, 400, 21.75f, Site.Muted)); return@SiteSheet }
        IdeaBody(m, vw, ui)
    }
}

/** .idea-actions: Save as deck at the left, 🛒 Buy, ♡ and ＋ Own at the right (wrapping; space-between). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeaActions(j: JsonObject, ui: IdeaUi) {
    val bs = j.objs("buttons")
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.Start),
        verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        bs.firstOrNull()?.let { b -> IdeaBtn(b.s("label"), b.b("disabled"), ghost = false, small = true) { ui.press(b.s("act"), "") } }
        Spacer(Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            bs.drop(1).forEach { b -> IdeaBtn(b.s("label"), b.b("disabled"), ghost = true, small = true,
                desc = b.s("title"), icon = CollectionCardsModel.svg(b.o("icon"))) { ui.press(b.s("act"), "") } }
        }
    }
}

/** .sel-bar: the count, and Missing, All, None as small links; var(--bg) with a line under it. */
@Composable
private fun SelBar(j: JsonObject, ui: IdeaUi, live: Boolean, modifier: Modifier = Modifier) {
    val gold = LocalGameGold.current
    Row(modifier.fillMaxWidth().background(Site.Bg)
        .drawBehind { drawRect(Site.Line, topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - 1.dp.toPx()), size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx())) }
        .padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(j.s("count"), Modifier.weight(1f), style = cssType(13f, 400, 18.85f, Site.Text))
        for (b in j.objs("buttons")) Box(Modifier.heightIn(min = 44.dp).clickable(enabled = live) { ui.select(b.s("mode")) }.semantics { role = Role.Button }.padding(horizontal = 6.dp),
            contentAlignment = Alignment.Center) { Text(b.s("label"), style = cssType(13f, 600, 18.85f, gold)) }
    }
}

/** The sheet's controls (IdeaSheet hands them to the engine). */
private class IdeaUi(val budget: (String) -> Unit, val custom: (String) -> Unit, val pick: (String, Boolean) -> Unit, val select: (String) -> Unit,
                     val view: (String) -> Unit, val card: (String) -> Unit, val press: (kind: String, deck: String) -> Unit)

private val Warn = Color(0xFFF2C66D)
private val Ok = Color(0xFF6FD29A)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeaBody(m: IdeaSheetModel, vw: Dp, ui: IdeaUi) {
    val gold = LocalGameGold.current
    for (bl in m.blocks) {
        val j = bl.j
        when (bl.k) {
            // .idea-hero: 150 tall, 14 corners, the art cropped, the plan chip (dark) 10 in.
            "hero" -> Box(Modifier.fillMaxWidth().padding(bottom = 10.dp).height(150.dp).clip(RoundedCornerShape(14.dp)).background(Site.Surface2)) {
                ideaPainter(j.o("art"))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                if (j.s("plan").isNotBlank()) Text(j.s("plan"), Modifier.padding(10.dp).clip(RoundedCornerShape(999.dp)).background(Color(0x8C000000))
                    .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp), style = cssType(12f, 700, 17.4f, Color.White))
            }
            // .impact: four tiles (two under 380), 6 apart; small 11 muted over Manrope 16 / 800.
            "impact" -> {
                val tiles = j.objs("tiles"); val cols = if (vw <= 380.dp) 2 else 4
                Column(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    tiles.chunked(cols).forEach { line -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        line.forEach { t -> Column(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(Site.Surface2).padding(horizontal = 8.dp, vertical = 7.dp)) {
                            Text(t.s("label"), style = cssType(11f, 400, 15.95f, Site.Muted))
                            Text(t.s("value"), style = cssType(16f, 800, 21f, Site.Text).copy(fontFamily = Site.Manrope))
                        } }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    } }
                }
            }
            "eyebrow" -> Text(j.s("text").uppercase(), Modifier.padding(top = 4.dp, bottom = 4.dp), style = cssType(11f, 700, 15.95f, Site.Muted, 1.32f))
            "warn" -> Text(j.s("text"), Modifier.padding(vertical = 4.dp), style = cssType(13f, 400, 18.85f, Warn))
            "foot" -> Text(j.s("text"), Modifier.padding(top = 10.dp), style = cssType(12f, 400, 17.4f, Site.Faint))
            "status" -> if (j.s("text").isNotBlank()) Text(j.s("text"), Modifier.fillMaxWidth().padding(vertical = 6.dp).semantics { stateDescription = j.s("text") },
                style = cssType(13f, 400, 18.85f, Site.Muted))
            // .btn.block: the full-width gold Save, 10 above.
            "save" -> IdeaBtn(j.s("label"), j.b("disabled"), ghost = false, small = false, Modifier.fillMaxWidth().padding(top = 10.dp)) { ui.press(j.s("act"), "") }
            "note" -> Text(j.s("text"), Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x1AF2C66D)).padding(horizontal = 12.dp, vertical = 10.dp),
                style = cssType(13.5f, 400, 19.6f, Color(0xFFF6DBA2)))
            // .chips of .chip.pick: 13 bold pills, the chosen one gold; disabled while it builds.
            "chips" -> FlowRow(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for (c in j.objs("chips")) {
                    val on = c.b("on"); val off = c.b("disabled")
                    Box(Modifier.heightIn(min = 44.dp).clickable(enabled = !off) { ui.budget(c.s("v")) }.semantics { role = Role.Button; stateDescription = if (on) "Selected" else "" },
                        contentAlignment = Alignment.Center) {
                        // "+ $25 of new cards": its lead glyph wears its icon (icons.js decorateGlyphs), as the page's buttons do.
                        val ink = if (on) Site.GoldInk else Site.Text
                        Row(Modifier.alpha(if (off && !on) .55f else 1f).clip(RoundedCornerShape(999.dp)).background(if (on) gold else Site.Surface2)
                            .border(1.dp, if (on) gold else Site.Line, RoundedCornerShape(999.dp)).padding(horizontal = 12.dp, vertical = 7.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                            CollectionCardsModel.svg(c.o("icon"))?.let { SiteIcon(it, 13.dp, ink, stroke = 2f) }
                            Text(c.s("label"), style = cssType(13f, 700, 18.85f, ink), maxLines = 1)
                        }
                    }
                }
            }
            // .custom-budget-row: the label (12 muted) over the number field, and Build with this budget beside it (wrapping).
            "custom" -> {
                var v by remember(j.s("value")) { mutableStateOf(j.s("value")) }
                val btn = j.o("button")
                FlowRow(Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp),
                    itemVerticalAlignment = Alignment.Bottom) {
                    Column(Modifier.widthIn(min = 150.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(j.s("label"), style = cssType(12f, 400, 17.4f, Site.Muted))
                        Box(Modifier.alpha(if (j.b("disabled")) .55f else 1f)) {
                            FormInput(v, { if (!j.b("disabled")) v = it }, cssType(15f, 400, 21.75f, Site.Text), j.s("placeholder"), desc = j.s("label"), keyboard = KeyboardType.Decimal,
                                onGo = { if (!j.b("disabled")) ui.custom(v) })
                        }
                    }
                    if (btn != null) IdeaBtn(btn.s("label"), btn.b("disabled"), ghost = true, small = false) { ui.custom(v) }
                }
            }
            "overlay" -> BuildOverlayPop(j.s("title"), j.s("msg"), j.s("note"), Modifier.padding(vertical = 8.dp))
            // .sel-bar (position: sticky; top): in its place until it is scrolled under the sheet's head, then pinned there (SiteSheet's pin).
            "selbar" -> {
                val pin = LocalSheetPin.current
                var top by remember { androidx.compose.runtime.mutableFloatStateOf(Float.MAX_VALUE) }
                val pinned = pin != null && pin.headBottom > 0f && top < pin.headBottom
                val latest = androidx.compose.runtime.rememberUpdatedState(j)
                androidx.compose.runtime.DisposableEffect(pin, pinned) {
                    pin?.content = if (pinned) ({ SelBar(latest.value, ui, live = true) }) else null
                    onDispose { if (pinned) pin?.content = null }
                }
                SelBar(j, ui, live = !pinned, Modifier.onGloballyPositioned { top = it.positionInRoot().y }.alpha(if (pinned) 0f else 1f))
            }
            "cards" -> IdeaCards(j, vw, ui)
            // .inline-pick: the deck select (flex 1) and Add ticked to deck, 6 apart.
            "deckpick" -> {
                val opts = j.objs("options").map { it.s("value") to it.s("label") }
                var picked by remember(opts) { mutableStateOf(j.objs("options").firstOrNull { it.b("on") }?.s("value") ?: opts.firstOrNull()?.first.orEmpty()) }
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { FormSelect(opts, picked, cssType(15f, 400, 21.75f, Site.Text), desc = j.s("label")) { picked = it } }
                    j.o("button")?.let { b -> IdeaBtn(b.s("label"), b.b("disabled"), ghost = true, small = false) { ui.press(b.s("act"), picked) } }
                }
            }
            // .idea-actions: the sheet's sticky foot (IdeaActions).
            "actions" -> {}
        }
    }
}

/** .btn (gold) or .btn.ghost (glass, its line), .small 13.5; at least 44 tall here; dimmed and dead when disabled. */
@Composable
private fun IdeaBtn(label: String, disabled: Boolean, ghost: Boolean, small: Boolean, modifier: Modifier = Modifier, desc: String = "", icon: SiteSvg? = null, onClick: () -> Unit) {
    val gold = LocalGameGold.current
    val shape = RoundedCornerShape(11.dp)
    val ink = if (ghost) Site.Text else Site.GoldInk
    Row(modifier.heightIn(min = 44.dp).alpha(if (disabled) .5f else 1f).clip(shape).background(if (ghost) Color(0x851F232B) else gold)
        .then(if (ghost) Modifier.border(1.dp, Color(0x31EDC980), shape) else Modifier).clickable(enabled = !disabled, onClick = onClick)
        .semantics { role = Role.Button; if (desc.isNotBlank()) contentDescription = desc }.padding(horizontal = if (small) 12.dp else 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) SiteIcon(icon, if (small) 15.dp else 17.dp, ink, stroke = 2f)
        if (label.isNotBlank()) Text(label, style = cssType(if (small) 13.5f else 15f, 700, if (small) 19.6f else 21.75f, ink), textAlign = TextAlign.Center)
    }
}

/** A picture {src, sources}: the first that loads. */
@Composable
private fun ideaPainter(p: JsonObject?): androidx.compose.ui.graphics.painter.Painter? {
    val src = p?.s("src").orEmpty()
    val all = remember(p) { (listOf(src) + p?.get("sources")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asString }.orEmpty()).filter { it.isNotBlank() }.distinct() }
    return if (all.size > 1) firstOf(all) else heroPainter(all.firstOrNull()?.let(homeArt))
}

private class IdeaRow(val j: JsonObject) {
    val name get() = j.s("name"); val label get() = j.s("label"); val picked get() = j.b("picked"); val short get() = j.b("short")
    /** The quantity deck-viewer.js badges on the art (data-deck-qty), read from the label's "n× ". */
    val qty: Int get() = Regex("^(\\d+)× ").find(label)?.groupValues?.get(1)?.toIntOrNull() ?: 1
}

/**
 * deck-viewer.js deckViewer around the idea's groups: "Deck view" and the switch, then each details.group (its summary: the category,
 * its count and price; no price in Stacks) and its pick rows in the chosen view (deck-viewer.css): Art grid (170 tiles; two columns
 * up to 480), Stacks (piles, 38 of each card showing; 32 up to 480), Names only, Detailed list (60 × 84 art; 48 × 67 up to 420).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeaCards(j: JsonObject, vw: Dp, ui: IdeaUi) {
    val view = j.s("view").ifBlank { "gallery" }
    val views = j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) }
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(j.s("viewLabel"), style = cssType(13f, 400, 18.85f, Site.Muted))
            ViewSwitch(views) { ui.view(it) }
        }
        val groups = j.objs("groups")
        // details.group open: each group's summary opens and closes it (all open as drawn).
        val shut = remember { androidx.compose.runtime.mutableStateMapOf<String, Boolean>() }
        // The sheet's body: the sheet (640, or 720 from 700 less 32) less its sides (16, or 22 from 700).
        val inner = (if (vw >= 700.dp) minOf(720.dp, vw - 32.dp) - 44.dp else minOf(640.dp, vw) - 32.dp)
        if (view == "stacks") {
            val small = vw <= 480.dp
            val basis = if (small) 148.dp else 190.dp; val gap = if (small) 10.dp else 18.dp
            val cols = maxOf(1, ((inner + gap) / (basis + gap)).toInt())
            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                groups.chunked(cols).forEach { line -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Top) {
                    line.forEach { g -> Column(Modifier.weight(1f)) {
                        val open = shut[g.s("name")] != true
                        GroupSummary(g, price = false, open) { shut[g.s("name")] = open }
                        if (open) IdeaPile(g.objs("rows").map(::IdeaRow), if (small) 32.dp else 38.dp, ui)
                    } }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                } }
            }
            return@Column
        }
        for (g in groups) {
            val open = shut[g.s("name")] != true
            GroupSummary(g, price = true, open) { shut[g.s("name")] = open }
            if (!open) continue
            val rows = g.objs("rows").map(::IdeaRow)
            when (view) {
                "gallery" -> {
                    val small = vw <= 480.dp
                    val gapX = if (small) 10.dp else 14.dp
                    val cols = if (small) 2 else maxOf(1, ((inner + gapX) / (170.dp + gapX)).toInt())
                    Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(if (small) 16.dp else 20.dp)) {
                        rows.chunked(cols).forEach { line -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gapX), verticalAlignment = Alignment.Top) {
                            line.forEach { r -> IdeaTile(r, ui, Modifier.weight(1f)) }
                            repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                        } }
                    }
                }
                "symbols" -> Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { rows.forEach { r -> IdeaNameRow(r, ui) } }
                else -> Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { rows.forEach { r -> IdeaCompactRow(r, vw, ui) } }
            }
        }
    }
}

/** details.group summary: the category and its count (em), its price muted at the right. */
@Composable
private fun GroupSummary(g: JsonObject, price: Boolean, open: Boolean, toggle: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClick = toggle).semantics { role = Role.Button; stateDescription = if (open) "Expanded" else "Collapsed" }
        .padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(androidx.compose.ui.text.buildAnnotatedString {
            append(g.s("name")); append(" ")
            pushStyle(androidx.compose.ui.text.SpanStyle(fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, color = Site.Muted)); append(g.s("count")); pop()
        }, Modifier.weight(1f), style = cssType(15f, 700, 20f, Site.Text))
        if (price && g.s("price").isNotBlank()) Text(g.s("price"), style = cssType(13f, 400, 18.85f, Site.Muted))
    }
}

/** The row's tick: a 22 box in the game's gold (accent-color), on a 44 target; C.ideaPick with its new state. */
@Composable
private fun IdeaTick(r: IdeaRow, ui: IdeaUi, modifier: Modifier = Modifier) {
    val gold = LocalGameGold.current
    Box(modifier.size(44.dp).clickable { ui.pick(r.name, !r.picked) }.semantics { role = Role.Checkbox; contentDescription = r.j.s("aria"); stateDescription = if (r.picked) "Checked" else "Not checked" },
        contentAlignment = Alignment.Center) {
        Box(Modifier.size(22.dp).clip(RoundedCornerShape(5.dp)).background(if (r.picked) gold else Color(0xE6141820)).border(1.5.dp, if (r.picked) gold else Color(0xFFB8BFCC), RoundedCornerShape(5.dp)),
            contentAlignment = Alignment.Center) { if (r.picked) Text("✓", style = cssType(14f, 800, 15f, Site.GoldInk)) }
    }
}

/** .set-badge (at least 11 here) and the row's rarity tag, then its "Need n" (warn) or "Owned" (ok). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IdeaCopy(r: IdeaRow, nameSize: Float, wrap: Boolean, hideMeta: Boolean = false) {
    Column(verticalArrangement = Arrangement.spacedBy(if (hideMeta) 0.dp else 6.dp)) {
        Text(r.label, style = cssType(nameSize, 700, nameSize * 1.3f, Site.Text), maxLines = if (wrap) 4 else 1, overflow = TextOverflow.Ellipsis)
        if (hideMeta) return@Column
        if (r.j.s("set").isNotBlank() || r.j.s("rarity").isNotBlank()) FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (r.j.s("set").isNotBlank()) Text(r.j.s("set"), Modifier.clip(RoundedCornerShape(5.dp)).background(Color(0xFF252B25)).border(1.dp, Color(0xFF394034), RoundedCornerShape(5.dp))
                .padding(horizontal = 5.dp, vertical = 1.dp), style = cssType(11f, 600, 14f, Color(0xFFD9D3BC), .35f))
            if (r.j.s("rarity").isNotBlank()) Text(r.j.s("rarity"), Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(999.dp))
                .padding(horizontal = 9.dp, vertical = 2.dp), style = cssType(12f, 700, 16f, Site.Text))
        }
        Text(r.j.s("status"), style = cssType(12f, 600, 17.4f, if (r.short) Warn else Ok))
    }
}

/** .pick-side: the mana cost, then the price in bold. */
@Composable
private fun IdeaSide(r: IdeaRow, modifier: Modifier = Modifier, row: Boolean = false) {
    val mana = r.j.objs("mana")
    val parts: @Composable () -> Unit = {
        if (mana.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) { mana.forEach { Mana(it.s("src"), it.s("alt")) } }
        if (r.j.s("price").isNotBlank()) Text(r.j.s("price"), style = cssType(13f, 700, 18.85f, Site.Text))
    }
    if (row) Row(modifier, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { parts() }
    else Column(modifier, horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) { parts() }
}

/** The card's own art (63 : 88), the dashed warn outline when it is still short. */
@Composable
private fun IdeaArt(r: IdeaRow, modifier: Modifier, radius: Dp) {
    val shape = RoundedCornerShape(radius)
    Box(modifier.clip(shape).background(Site.Surface2).then(if (r.short) Modifier.border(1.dp, Warn.copy(alpha = .7f), shape) else Modifier)) {
        ideaPainter(r.j.o("art"))?.let { Image(it, null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit) }
    }
}

/** Art grid: the art (its tick at 8, 8; its n× at the top right), the name, set and status, then mana and price spread. */
@Composable
private fun IdeaTile(r: IdeaRow, ui: IdeaUi, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().clickable { ui.card(r.name) }.semantics { role = Role.Button }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                IdeaArt(r, Modifier.fillMaxWidth().aspectRatio(63f / 88f), 8.dp)
                Box(Modifier.padding(horizontal = 6.dp)) { IdeaCopy(r, 13f, wrap = true) }
            }
            IdeaTick(r, ui, Modifier.offset((-3).dp, (-3).dp))
            if (r.qty > 1) QtyBadge(r.qty, Modifier.align(Alignment.TopEnd).padding(7.dp))
        }
        IdeaSide(r, Modifier.fillMaxWidth().padding(start = 6.dp, end = 6.dp, bottom = 8.dp), row = true)
    }
}

/** deck-viewer.css [data-deck-card]::after: "n×" on a dark chip, white 12 / 800; none at 1 (deck-viewer.css 281). */
@Composable
private fun QtyBadge(n: Int, modifier: Modifier) {
    Text("$n×", modifier.clip(RoundedCornerShape(7.dp)).background(Color(0xE8141820)).border(1.dp, Color(0x60FFFFFF), RoundedCornerShape(7.dp)).padding(horizontal = 7.dp, vertical = 1.dp),
        style = cssType(12f, 800, 16.8f, Color.White))
}

/** Stacks: the group's cards in one pile, each covering the one before but for its top [step]; every card keeps its tick. */
@Composable
private fun IdeaPile(rows: List<IdeaRow>, step: Dp, ui: IdeaUi) {
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth()) {
        val h = maxWidth * (88f / 63f)
        Box(Modifier.fillMaxWidth().height(h + step * (rows.size - 1).coerceAtLeast(0))) {
            rows.forEachIndexed { k, r ->
                Box(Modifier.fillMaxWidth().height(h).offset(y = step * k)) {
                    IdeaArt(r, Modifier.fillMaxSize().clickable { ui.card(r.name) }.semantics { role = Role.Button; contentDescription = r.label }, 8.dp)
                    IdeaTick(r, ui, Modifier.offset((-3).dp, (-3).dp))
                    if (r.qty > 1) QtyBadge(r.qty, Modifier.align(Alignment.TopEnd).padding(5.dp))
                }
            }
        }
    }
}

/** Names only: the tick and the name (14 bold, wrapping), 44 tall, 10 in. */
@Composable
private fun IdeaNameRow(r: IdeaRow, ui: IdeaUi) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(14.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).padding(end = 10.dp),
        verticalAlignment = Alignment.CenterVertically) {
        IdeaTick(r, ui)
        Box(Modifier.weight(1f).heightIn(min = 44.dp).clickable { ui.card(r.name) }.semantics { role = Role.Button }, contentAlignment = Alignment.CenterStart) {
            Text(r.label, style = cssType(14f, 700, 18.2f, Site.Text))
        }
    }
}

/** Detailed list (.deck-compact-row): the tick, the art (60 × 84; 48 × 67 up to 420), name, set and status, then mana and price (80 wide; 58). */
@Composable
private fun IdeaCompactRow(r: IdeaRow, vw: Dp, ui: IdeaUi) {
    val small = vw <= 420.dp
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(14.dp)).padding(if (small) 8.dp else 10.dp)
        .padding(start = 0.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (small) 7.dp else 10.dp)) {
        IdeaTick(r, ui, Modifier.offset(x = (-6).dp))
        Row(Modifier.weight(1f).clickable { ui.card(r.name) }.semantics { role = Role.Button }, horizontalArrangement = Arrangement.spacedBy(if (small) 7.dp else 10.dp),
            verticalAlignment = Alignment.CenterVertically) {
            IdeaArt(r, Modifier.width(if (small) 48.dp else 60.dp).height(if (small) 67.dp else 84.dp), 6.dp)
            Box(Modifier.weight(1f)) { IdeaCopy(r, 14f, wrap = true) }
        }
        IdeaSide(r, Modifier.widthIn(max = if (small) 58.dp else 80.dp))
    }
}
