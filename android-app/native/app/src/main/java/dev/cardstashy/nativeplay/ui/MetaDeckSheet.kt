package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()

/** One card row of the sheet (provenSheetHtml's row(): its card, its art, its words and how it opens). */
class MetaDeckRow(val j: JsonObject) {
    val name get() = j.s("name"); val qty get() = j.s("qty").toIntOrNull() ?: 1; val label get() = j.s("label"); val category get() = j.s("category").ifBlank { "Unresolved" }
    /** data-act: Magic's card (data-name), Yu-Gi-Oh! / Pokémon's tCard (data-id), Pokémon's tOtherPrintings (data-name) for a printing not matched. */
    val act get() = j.s("act"); val cardName get() = j.s("cardName"); val id get() = j.s("id")
    /** A shared deck's row (data-act="sharedCard"): its place in the friend's list. */
    val index get() = j.s("index")
}

/**
 * The tournament deck's sheet as tcg.js provenSheetHtml leaves it (CollectionEngine.provenModel): null while none is open ({missing}).
 * The JSON is kept as read; the parts are read where they draw.
 */
class MetaDeckSheetModel(val j: JsonObject) {
    val game get() = j.s("game"); val key get() = j.s("key"); val mode get() = j.s("mode"); val busy get() = j.b("busy")
    val hero get() = j.o("hero") ?: JsonObject()
    val toasts get() = j.strs("toasts")
    companion object { fun parse(j: JsonObject): MetaDeckSheetModel? = if (j.b("missing") || !j.has("hero")) null else MetaDeckSheetModel(j) }
}

/**
 * What the sheet does outside itself: closed (its ← / closeSheet), a card's page ([card], the row tapped; its ← comes back here), the
 * deck a save made ([deck]: {go: "deck", id, tab} or {go: "tdeck", id, game}), and the website for what isn't here ([web]: ⚒ Build
 * around it, a Pokémon printing not matched).
 */
class MetaDeckSheetActions(val close: () -> Unit, val card: (sheet: MetaDeckSheetModel, row: MetaDeckRow) -> Unit, val deck: (JsonObject) -> Unit,
                           val web: (sheet: MetaDeckSheetModel, what: String, row: MetaDeckRow?) -> Unit)

/**
 * tcg.js provenSheetHtml, drawn natively as the site draws it: a page over everything (deck-viewer.css dialog.sheet:has(.ds-page): the
 * whole screen, var(--bg), 10 under the status bar, the gutter at the sides). deckShell's hero (DsHero: the art, ←, Meta and the format,
 * the name, its line, the stats with Retry prices, the owned bar), the actions (Save deck / Save adaptation / Save draft, Cheapest way in,
 * the source's page), the fitting overlay or status line, a save's error, Original / Budget / My cards, then deck-viewer.js's Deck view
 * and its blocks (notes, budget chips, Changes, the lists, the sideboard), ⚒ Build around it and the evidence and credit.
 * Its controls are tcg.js's own handlers in the engine (CollectionEngine.provenDo); its save is A.provenSave through CollectionWrites.
 */
@Composable
fun MetaDeckSheet(act: MetaDeckSheetActions, initial: MetaDeckSheetModel? = null, glyphs0: Map<String, SiteSvg>? = null, standalone: Boolean = false) {
    val context = LocalContext.current
    // icons.js decorateGlyphs: ⚒ Build around it wears its icon.
    var glyphs by remember { mutableStateOf(glyphs0 ?: emptyMap()) }
    LaunchedEffect(Unit) { if (glyphs0 == null) runCatching { glyphMap(CollectionEngine.glyphs()) }.getOrNull()?.let { glyphs = it } }
    val scope = rememberCoroutineScope()
    var model by remember { mutableStateOf(initial) }
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    var job by remember { mutableStateOf<Job?>(null) }
    /** A save running (A.provenSave): the sheet is read while it runs (Saving…), and its closing is the save's to follow. */
    val saving = remember { java.util.concurrent.atomic.AtomicBoolean(false) }
    fun take(j: JsonObject) { val m = MetaDeckSheetModel.parse(j); if (m == null) { if (initial == null && j.has("missing") && !saving.get()) act.close(); return }; model = m; m.toasts.lastOrNull()?.let { CollectionWrites.show(it) } }
    /** A control: the site's handler, then the sheet read again while what it starts (the prices, the matching) runs. */
    fun run(call: suspend () -> JsonObject) { job?.cancel(); job = scope.launch {
        // [standalone]: opened outside Collection (a friend's shared deck from the community pop-up), the engine already loaded for it.
        if (HomeCache.loaded == null && !standalone) return@launch
        runCatching { take(call()); CollectionEngine.settle(120_000, CollectionEngine.PROVEN_MODEL) { j -> take(j) } }
    } }
    // The sheet as it opened (the app keeps the deck view, as the idea sheet does), then its loads.
    LaunchedEffect(Unit) { if (initial == null) run {
        // provenBack: the sheet's context again when it comes back from a card's page it opened.
        val g = CollectionEngine.provenBack().let { MetaDeckSheetModel.parse(it)?.game }.orEmpty()
        prefs.getString("deckView", null)?.takeIf { it.isNotBlank() && g.isNotBlank() }?.let { CollectionEngine.provenDo("view", it) } ?: CollectionEngine.provenModel()
    } }
    val written by CollectionWrites.written.collectAsState()
    var seen by remember { mutableStateOf(written) }
    LaunchedEffect(written) { if (written != seen) { seen = written; if (initial == null) run { CollectionEngine.provenModel() } } }
    val close = { scope.launch { runCatching { CollectionEngine.provenClose() } }; act.close() }
    BackHandler { close() }
    val ui = MetaUi(
        mode = { v -> run { CollectionEngine.provenDo("mode", v) } },
        budget = { v -> run { CollectionEngine.provenDo("budget", v) } },
        retry = { run { CollectionEngine.provenDo("retry") } },
        view = { v -> prefs.edit().putString("deckView", v).apply(); run { CollectionEngine.provenDo("view", v) } },
        // tcg.js A.provenSave: Save… disabled while it runs, then the deck it made opens; a save that wrote nothing leaves the sheet
        // drawn again (refreshProven) with its error (p.note.warn role=alert).
        save = { if (saving.compareAndSet(false, true)) scope.launch {
            if (initial == null) run { CollectionEngine.provenModel() }
            val ok = try { CollectionWrites.act(context, "provenSave", JsonObject()) { r ->
                r["made"]?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("{") }?.let { JsonParser.parseString(it).asJsonObject }?.let(act.deck) } }
                finally { saving.set(false) }
            if (!ok && initial == null || standalone) run { CollectionEngine.provenModel() }
        } },
        open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
        card = { r -> model?.let { m -> if (r.act == "card" || r.act == "sharedCard" || (r.act == "tCard" && r.id.isNotBlank())) act.card(m, r) else act.web(m, "row", r) } },
        extra = { a -> model?.let { m -> act.web(m, a, null) } })
    GameAccent(model?.game ?: "mtg") { androidx.compose.runtime.CompositionLocalProvider(LocalSiteGlyphs provides glyphs) {
        BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg).clickable(remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, null) {}) {
            val vw = maxWidth
            // #sheetBody: max(--gutter, (100% − 1196) / 2) at the sides; 10 under the status bar; 28 at the foot.
            val gutter = maxOf(if (vw >= 600.dp) 22.dp else 16.dp, (vw - 1196.dp) / 2)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.statusBars).windowInsetsPadding(WindowInsets.navigationBars)
                .padding(start = gutter, end = gutter, top = 10.dp, bottom = 28.dp)) {
                val m = model
                if (m == null) { Text("Opening…", Modifier.padding(top = 24.dp), style = cssType(15f, 400, 21.75f, Site.Muted)); return@Column }
                MetaSheetBody(m, vw - gutter * 2, vw, ui, close = { close() })
            }
        }
    } }
}

private class MetaUi(val mode: (String) -> Unit, val budget: (String) -> Unit, val retry: () -> Unit, val view: (String) -> Unit, val save: () -> Unit,
                     val open: (String) -> Unit, val card: (MetaDeckRow) -> Unit, val extra: (String) -> Unit)

private val Warn = Color(0xFFF2C66D)
private val Ok = Color(0xFF6FD29A)
private val Bad = Color(0xFFF08A7E)
private fun tone(t: String) = when (t) { "ok" -> Ok; "warn" -> Warn; "bad" -> Bad; else -> null }

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MetaSheetBody(m: MetaDeckSheetModel, inner: Dp, vw: Dp, ui: MetaUi, close: () -> Unit) {
    val j = m.j; val h = m.hero
    val wide = vw >= 700.dp
    val stats = h.objs("stats").map { DeckStat(it.s("value"), it.s("label"), it.b("warn"), it.b("button"), it.s("act"), it.s("id")) }
    val retry = j.o("retry")
    val gold = LocalGameGold.current
    DsHero(h.o("art")?.s("src")?.ifBlank { null }, h.o("art")?.strs("sources").orEmpty(), h.o("art")?.s("crop").orEmpty(),
        h.objs("eyebrow").map { DeckEyebrow(it.s("kind"), it.s("label"), it.s("title"), it.b("badge"), it.s("level"), null, emptyList(), "") },
        h.s("title"), h.s("line"), stats, h.get("owned")?.takeIf { it.isJsonPrimitive }?.asFloat, wide, vw, Motion.still,
        back = DsHeroButton(j.o("back")?.let { CollectionCardsModel.svg(it) }, "Back", text = if (j.o("back") == null) "←" else "", onClick = close), more = null, onStat = {}, review = {},
        statMore = { i -> if (retry != null && i == stats.lastIndex) Box(Modifier.heightIn(min = 44.dp).clickable { ui.retry() }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
            Text(retry.s("label"), style = cssType(12f, 600, 14.4f, gold).copy(textDecoration = TextDecoration.Underline))
        } })
    // .ds-head: 14 above and below, 12 apart.
    Column(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val actions = j.objs("actions")
        if (actions.isNotEmpty()) {
            val tap = { a: JsonObject -> when {
                a.s("href").isNotBlank() -> ui.open(a.s("href"))
                a.s("act") == "provenSave" -> ui.save()
                a.s("act") == "provenMode" -> ui.mode(a.s("id"))
                else -> {}
            } }
            val primary = actions.filter { it.b("primary") }; val ghosts = actions.filter { !it.b("primary") }
            // Under 700 the primary takes the row and the rest share the next (flex 1 1 0); wider they sit in one wrapping row.
            if (!wide) {
                primary.forEach { a -> SheetBtn(a.s("label"), ghost = false, disabled = a.b("disabled"), Modifier.fillMaxWidth()) { tap(a) } }
                if (ghosts.isNotEmpty()) Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ghosts.forEach { a -> SheetBtn(a.s("label"), ghost = true, disabled = a.b("disabled"), Modifier.weight(1f).fillMaxHeight()) { tap(a) } }
                }
            } else FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                actions.forEach { a -> SheetBtn(a.s("label"), ghost = !a.b("primary"), disabled = a.b("disabled"), if (a.b("primary")) Modifier.widthIn(min = 180.dp) else Modifier) { tap(a) } }
            }
        }
        j.o("overlay")?.let { o -> BuildOverlayPop(o.s("title"), o.s("msg"), o.s("note")) }
        if (j.s("status").isNotBlank()) Text(j.s("status"), Modifier.semantics { stateDescription = j.s("status") }, style = cssType(13f, 400, 18.85f, Warn))
        if (j.s("alert").isNotBlank()) NoteWarn(j.s("alert"), emptyList())
        val versions = j.objs("versions")
        if (versions.isNotEmpty()) PillSeg(versions.map { Triple(it.s("id"), it.s("label"), it.b("on")) }, ui.mode)
    }
    // deck-viewer.js deckViewer: Deck view and its switch, then the blocks.
    val view = j.s("view").ifBlank { "gallery" }
    Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text(j.s("viewLabel"), style = cssType(13f, 400, 18.85f, Site.Muted))
        ViewSwitch(j.objs("views").map { CollView(it.s("mode"), it.s("label"), it.b("on"), CollectionCardsModel.svg(it.o("icon"))) }) { ui.view(it) }
    }
    val shut = remember { mutableStateMapOf<String, Boolean>() }
    for ((bi, bl) in j.objs("blocks").withIndex()) when (bl.s("k")) {
        "rows" -> DeckRows(bl.objs("rows").map(::MetaDeckRow), view, inner, vw, ui)
        "note" -> MetaNote(bl)
        "chips" -> FlowRow(Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val ink = LocalSheetPal.current.ink
            for (c in bl.objs("chips")) { val on = c.b("on")
                Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).background(if (on) gold else Site.Surface2).border(1.dp, if (on) gold else Site.Line, RoundedCornerShape(999.dp))
                    .clickable { ui.budget(c.s("b")) }.semantics { role = Role.Button; stateDescription = if (on) "Selected" else "" }.padding(horizontal = 12.dp, vertical = 7.dp),
                    contentAlignment = Alignment.Center) { Text(c.s("label"), style = cssType(13f, 700, 18.85f, if (on) ink else Site.Text), maxLines = 1, softWrap = false) }
            }
        }
        // p.list-head: 13 / 700 upper case, tracked, its count muted.
        "head" -> Text(buildAnnotatedString { append(bl.s("text")); if (bl.s("count").isNotBlank()) { append(" "); withStyle(SpanStyle(color = Site.Muted)) { append(bl.s("count")) } } },
            Modifier.padding(top = 14.dp, bottom = 8.dp), style = cssType(13f, 700, 18.85f, Site.Text))
        "swaps" -> Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            for (s in bl.objs("items")) Text(buildAnnotatedString {
                withStyle(SpanStyle(color = Bad)) { append(s.s("out")) }; append(" → ")
                if (s.b("open")) withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("open slot") } else withStyle(SpanStyle(color = Ok)) { append(s.s("into")) }
                if (s.s("note").isNotBlank()) { append(" "); withStyle(SpanStyle(color = Site.Muted, fontSize = androidx.compose.ui.unit.TextUnit(12f, androidx.compose.ui.unit.TextUnitType.Sp))) { append(s.s("note")) } }
            }, style = cssType(14f, 400, 20f, Site.Text))
        }
        "side" -> {
            val k = "side$bi"; val open = shut[k] ?: bl.b("open")
            Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
                Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { shut[k] = !open }.semantics { role = Role.Button; stateDescription = if (open) "Expanded" else "Collapsed" },
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(buildAnnotatedString { append(bl.s("title")); append(" ")
                        withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = Site.Muted)) { append(bl.s("count")) } }, Modifier.weight(1f), style = cssType(15f, 700, 20f, Site.Text))
                    Text(bl.s("price"), style = cssType(13f, 400, 18.85f, Site.Muted))
                }
                if (open) {
                    if (bl.s("text").isNotBlank()) Text(bl.s("text"), Modifier.padding(bottom = 10.dp), style = cssType(13f, 400, 18.85f, Site.Muted))
                    DeckRows(bl.objs("rows").map(::MetaDeckRow), view, inner, vw, ui)
                }
            }
        }
        "text" -> Text(bl.s("text"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, tone(bl.s("tone")) ?: Site.Muted))
    }
    val extra = j.objs("extra")
    if (extra.isNotEmpty()) FlowRow(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        extra.forEach { a -> SheetBtn(a.s("label"), ghost = true, disabled = false) { ui.extra(a.s("act")) } }
    }
    for (f in j.objs("feet")) FootLinks(f, ui)
}

/** .btn (gold; min 46 tall in .ds-actions) or .btn.ghost (glass, its line); 15 / 700; dimmed and dead when disabled. */
@Composable
private fun SheetBtn(label: String, ghost: Boolean, disabled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val gold = LocalGameGold.current; val ink = LocalSheetPal.current.ink
    val shape = RoundedCornerShape(11.dp)
    Box(modifier.heightIn(min = 46.dp).alpha(if (disabled) .5f else 1f).clip(shape).background(if (ghost) Color(0x851F232B) else gold)
        .then(if (ghost) Modifier.border(1.dp, Color(0x31EDC980), shape) else Modifier).clickable(enabled = !disabled, onClick = onClick)
        .semantics { role = Role.Button }.padding(horizontal = 10.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        val (icon, words) = leadGlyph(label, LocalSiteGlyphs.current)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) SiteIcon(icon, 17.dp, if (ghost) Site.Text else ink, stroke = 2f)
            Text(words, style = cssType(15f, 700, 21.75f, if (ghost) Site.Text else ink), textAlign = TextAlign.Center)
        }
    }
}

/** ui.js segmented in polish.css's track: the pill (the game's colour, its glow) under the open one; 44 tall, 999 corners. */
@Composable
private fun PillSeg(items: List<Triple<String, String, Boolean>>, onPick: (String) -> Unit) {
    val gold = LocalGameGold.current; val ink = LocalSheetPal.current.ink
    val light = lerpC(gold, Color.White, .22f); val dark = lerpC(gold, Color.Black, .14f)
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(999.dp)).background(Color(0xE6121418)).border(1.dp, Site.Line.copy(alpha = .8f), RoundedCornerShape(999.dp)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for ((id, label, on) in items) Box(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp))
            .then(if (on) Modifier.background(Brush.verticalGradient(0f to light, .58f to gold, 1f to dark)) else Modifier)
            .clickable { if (!on) onPick(id) }.semantics { role = Role.Tab; stateDescription = if (on) "Selected" else "" }.padding(horizontal = 6.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center) {
            Text(label, style = cssType(13.5f, 650, 18f, if (on) ink else Site.Muted), textAlign = TextAlign.Center, maxLines = 2)
        }
    }
}
private fun lerpC(a: Color, b: Color, t: Float) = Color(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t)

/** .note (.warn): its bold title, then its words, facts and small print. */
@Composable
private fun MetaNote(n: JsonObject) {
    val warn = n.b("warn")
    val ink = if (warn) Color(0xFFF6DBA2) else Site.Text
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp).clip(RoundedCornerShape(12.dp)).background(if (warn) Color(0x1AF2C66D) else Site.Surface2).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(n.s("title")) }; if (n.s("rest").isNotBlank()) append(" " + n.s("rest")) },
            style = cssType(13.5f, 400, 19.6f, ink))
        n.strs("paras").forEach { Text(it, style = cssType(13.5f, 400, 19.6f, ink)) }
        n.strs("items").forEach { Text("• $it", style = cssType(13.5f, 400, 19.6f, ink)) }
        n.objs("smalls").forEach { s -> Text(buildAnnotatedString {
            val b = s.s("bold"); val t = s.s("text")
            if (b.isNotBlank() && t.startsWith(b)) { withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(b) }; append(t.removePrefix(b)) } else append(t)
        }, style = cssType(12f, 400, 17.4f, ink)) }
    }
}

/** p.foot: 12 faint, its links (the source's credit) opening in the browser. */
@Composable
private fun FootLinks(f: JsonObject, ui: MetaUi) {
    val text = f.s("text"); val links = f.objs("links")
    val gold = LocalGameGold.current
    Text(buildAnnotatedString {
        var at = 0
        for (l in links) {
            val i = text.indexOf(l.s("text"), at); if (i < 0) continue
            append(text.substring(at, i))
            withLink(LinkAnnotation.Clickable(l.s("href"), TextLinkStyles(SpanStyle(color = gold, textDecoration = TextDecoration.Underline))) { ui.open(l.s("href")) }) { append(l.s("text")) }
            at = i + l.s("text").length
        }
        append(text.substring(at))
    }, Modifier.fillMaxWidth().padding(top = 12.dp), style = cssType(12f, 400, 17.4f, Site.Faint))
}

/** The row's words: "n× name", its printing pills, swap / engine tags, then its right-hand status in its tone. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RowCopy(r: MetaDeckRow, size: Float, lines: Int, statusEnd: Boolean = false) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(r.label, style = cssType(size, 700, size * 1.3f, Site.Text), maxLines = lines, overflow = TextOverflow.Ellipsis)
        val tags = r.j.objs("tags")
        if (r.j.s("set").isNotBlank() || r.j.s("rarity").isNotBlank() || tags.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (r.j.s("set").isNotBlank()) Text(r.j.s("set"), Modifier.clip(RoundedCornerShape(5.dp)).background(Color(0xFF252B25)).border(1.dp, Color(0xFF394034), RoundedCornerShape(5.dp))
                .padding(horizontal = 5.dp, vertical = 1.dp), style = cssType(11f, 600, 14f, setInk(r.j.s("setRarity")), .35f))
            // .deck-printing .tag: text-transform: capitalize.
            if (r.j.s("rarity").isNotBlank()) Pill(r.j.s("rarity").split(' ').joinToString(" ") { w -> w.replaceFirstChar { it.uppercaseChar() } }, Site.Text)
            tags.forEach { t -> Pill(t.s("text"), if (t.b("ok")) Ok else Site.Text) }
        }
        // In the Art grid the status sits at the tile's right end (the live site: its own width, margin-left auto).
        r.j.o("right")?.let { rt -> Text(rt.s("text"), if (statusEnd) Modifier.align(Alignment.End) else Modifier, style = cssType(12f, 600, 17.4f, tone(rt.s("tone")) ?: Site.Muted)) }
    }
}
/** .set-badge's colour in its rarity (style.css 549: r-uncommon, r-rare, r-mythic; any other the badge's #d9d3bc). */
private fun setInk(r: String) = when (r) { "uncommon" -> Color(0xFFBBCED1); "rare" -> Color(0xFFD2B271); "mythic" -> Color(0xFFEF9674); else -> Color(0xFFD9D3BC) }
@Composable
private fun Pill(t: String, ink: Color) = Text(t, Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(999.dp))
    .padding(horizontal = 8.dp, vertical = 1.dp), style = cssType(11f, 700, 15f, ink))

@Composable
private fun RowArt(r: MetaDeckRow, modifier: Modifier, radius: Dp) {
    Box(modifier.clip(RoundedCornerShape(radius)).background(Site.Surface2)) {
        val a = r.j.o("art")
        val src = (listOf(a?.s("src").orEmpty()) + a?.strs("sources").orEmpty()).filter { it.isNotBlank() }.distinct()
        val p = if (src.size > 1) firstOf(src) else heroPainter(src.firstOrNull()?.let(homeArt))
        if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
    }
}

@Composable
private fun QtyMark(n: Int, modifier: Modifier) {
    if (n > 1) Text("$n×", modifier.clip(RoundedCornerShape(7.dp)).background(Color(0xE8141820)).border(1.dp, Color(0x60FFFFFF), RoundedCornerShape(7.dp)).padding(horizontal = 7.dp, vertical = 1.dp),
        style = cssType(12f, 800, 16.8f, Color.White))
}

/** deck-viewer.js's four views of a list: Art grid (170 tiles; two up to 480), Stacks (by type, 38 of each card showing; 32 up to 480), Names only, Detailed list. */
@Composable
private fun DeckRows(rows: List<MetaDeckRow>, view: String, inner: Dp, vw: Dp, ui: MetaUi) {
    val small = vw <= 480.dp
    when (view) {
        "stacks" -> {
            val order = listOf("Commander", "Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Battles", "Lands", "Pokémon", "Trainers", "Energy", "Monsters", "Spells", "Traps", "Unresolved")
            val groups = rows.groupBy { it.category }.toList().sortedBy { (c, _) -> order.indexOf(c).let { if (it < 0) 99 else it } }
            val basis = if (small) 148.dp else 190.dp; val gap = if (small) 10.dp else 18.dp
            val cols = maxOf(1, ((inner + gap) / (basis + gap)).toInt())
            Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                groups.flatMap { (c, rs) -> rs.chunked(6).mapIndexed { i, p -> Triple(c, if (i == 0 && groups.size > 1) rs.sumOf { it.qty } else null, p) } }.chunked(cols).forEach { line ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Top) {
                        line.forEach { (c, count, pile) -> Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(if (count != null) "$c $count" else " ", style = cssType(13f, 700, 18.85f, Site.Muted))
                            Pile(pile, if (small) 32.dp else 38.dp, ui)
                        } }
                        repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        "symbols" -> Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            rows.forEach { r -> Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(14.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(14.dp))
                .clickable { ui.card(r) }.semantics { role = Role.Button }.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(r.label, Modifier.weight(1f), style = cssType(14f, 700, 18.2f, Site.Text))
                r.j.o("right")?.let { rt -> Text(rt.s("text"), style = cssType(12f, 600, 17.4f, tone(rt.s("tone")) ?: Site.Muted)) }
            } }
        }
        "compact" -> Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val tight = vw <= 420.dp
            rows.forEach { r -> Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(14.dp))
                .clickable { ui.card(r) }.semantics { role = Role.Button }.padding(if (tight) 8.dp else 10.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(if (tight) 7.dp else 10.dp)) {
                RowArt(r, Modifier.width(if (tight) 48.dp else 60.dp).height(if (tight) 67.dp else 84.dp), 6.dp)
                Box(Modifier.weight(1f)) { RowCopy(r, 14f, 3) }
            } }
        }
        else -> {
            val gapX = if (small) 10.dp else 14.dp
            val cols = if (small) 2 else maxOf(1, ((inner + gapX) / (170.dp + gapX)).toInt())
            Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(if (small) 16.dp else 20.dp)) {
                rows.chunked(cols).forEach { line -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gapX), verticalAlignment = Alignment.Top) {
                    // .deck-compact-row (style.css 4684: 14 corners, its line, var(--surface)) with the gallery's padding 0 (deck-viewer.css 29),
                    // the art full width at its top, the words 6 in and the status 8 off the foot.
                    line.forEach { r -> Column(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(14.dp))
                        .clickable { ui.card(r) }.semantics { role = Role.Button; contentDescription = r.label }.padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.fillMaxWidth()) {
                            RowArt(r, Modifier.fillMaxWidth().aspectRatio(63f / 88f), 8.dp)
                            QtyMark(r.qty, Modifier.align(Alignment.TopEnd).padding(7.dp))
                        }
                        Box(Modifier.padding(horizontal = 6.dp)) { RowCopy(r, 13f, 4, statusEnd = true) }
                    } }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                } }
            }
        }
    }
}

/** A Stacks pile: each card covering the one before but for its top [step]. */
@Composable
private fun Pile(rows: List<MetaDeckRow>, step: Dp, ui: MetaUi) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val h = maxWidth * (88f / 63f)
        Box(Modifier.fillMaxWidth().height(h + step * (rows.size - 1).coerceAtLeast(0))) {
            rows.forEachIndexed { k, r ->
                Box(Modifier.fillMaxWidth().height(h).offset(y = step * k)) {
                    RowArt(r, Modifier.fillMaxSize().clickable { ui.card(r) }.semantics { role = Role.Button; contentDescription = r.label }, 8.dp)
                    QtyMark(r.qty, Modifier.align(Alignment.TopEnd).padding(5.dp))
                }
            }
        }
    }
}

/**
 * The sheet over a page (Decks, Home) with the card pages it opens: a card's page sits on top of it (app.js sheetTrail) and its
 * ← (wireSheetBack, "Back to previous card or deck") brings the sheet back as it was; ✕ closes them all (closeSheet). [page] is the
 * website page the sheet was opened from and [site] opens it there (the game chosen first), pressing the opener, then [press] inside.
 */
@Composable
fun MetaDeckHost(page: String, close: () -> Unit, deck: (JsonObject) -> Unit, site: (url: String, press: String) -> Unit, web: (url: String, press: String?) -> Unit,
                 initial: MetaDeckSheetModel? = null, standalone: Boolean = false) {
    val scope = rememberCoroutineScope()
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    fun q(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    fun opener(m: MetaDeckSheetModel) = "[data-act=\"${if (m.game == "mtg") "mtgProven" else "tMetaDeck"}\"][data-key=\"${q(m.key)}\"]"
    val shut = { cards = emptyList(); scope.launch { runCatching { CollectionEngine.provenClose() } }; close() }
    if (cards.isEmpty()) MetaDeckSheet(MetaDeckSheetActions(close = close,
        card = { m, r ->
            // app.js A.sharedCard: the friend's printing found first (Magic), then the card's page.
            if (r.act == "sharedCard") { scope.launch {
                val a = runCatching { CollectionEngine.act("sharedCard", JsonObject().apply { addProperty("index", r.index) }, 30_000) }.getOrNull() ?: return@launch
                a.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.let { CollectionWrites.show(it); return@launch }
                val c = a.get("made")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("{") }?.let { com.google.gson.JsonParser.parseString(it).asJsonObject } ?: return@launch
                fun s(k: String) = c.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                cards = cards + (if (m.game == "mtg") CardOpen(s("name"), page = page, tile = "", back = "proven", shared = true)
                    else CardOpen("", page = page, tile = "", game = m.game, id = s("id"), back = "proven"))
            }; return@MetaDeckSheetActions }
            val tile = opener(m) + "\n#sheet[open] [data-act=\"${q(r.act)}\"]" + (if (r.act == "card") "[data-name=\"${q(r.cardName)}\"]" else "[data-id=\"${q(r.id)}\"]")
            cards = cards + (if (r.act == "card") CardOpen(r.cardName, page = page, tile = tile, back = "proven")
                else CardOpen("", page = page, tile = tile, game = m.game, id = r.id, back = "proven"))
        },
        deck = deck,
        web = { m, what, r ->
            // tcg.js A.tMetaBuild (⚒ Build around it): the deck's signature cards, then Build a deck here on them (app.js openDeckFlow);
            // the site closes the sheet first.
            if (what == "tMetaBuild" && m.game != "mtg") { scope.launch {
                val a = runCatching { CollectionEngine.act("tMetaBuild", JsonObject(), 60_000) }.getOrNull() ?: return@launch
                a.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.let { CollectionWrites.show(it); return@launch }
                a.getAsJsonArray("toasts")?.lastOrNull()?.asJsonObject?.get("text")?.asString?.let { CollectionWrites.show(it) }
                val req = a.get("made")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("{") }?.let { com.google.gson.JsonParser.parseString(it).asJsonObject } ?: return@launch
                close(); CollectionWrites.building.value = CollectionWrites.BuildOpen(req, "openDeckFlow", web)
            }; return@MetaDeckSheetActions }
            // A Pokémon printing not matched (tOtherPrintings): the sheet on the website, the same press.
            val inner = if (what == "row" && r != null) "[data-act=\"${q(r.act)}\"][data-name=\"${q(r.cardName.ifBlank { r.name })}\"]" else "[data-act=\"${q(what)}\"]"
            site(page, opener(m) + "\n#sheet[open] " + inner)
        }), initial, standalone = standalone)
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
        CollectionCardHost(c, onClose = shut, onOpen = { cards = cards + it.copy(back = "proven") }, web = web, onBack = { cards = cards.dropLast(1) })
    } }
}
