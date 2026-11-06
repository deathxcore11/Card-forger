package dev.cardstashy.nativeplay.ui

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.layout.asPaddingValues
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.n(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
private fun JsonObject.pairs(k: String) = getAsJsonArray(k)?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()

// style.css :root (dark): --warn, --bad.
private val RWarn = Color(0xFFF2C66D)
private val RBad = Color(0xFFF08A7E)

// ---------------------------------------------------------------- Yu-Gi-Oh! / Pokémon: Import a deck, New deck (tcg.js)

/**
 * tcg.js tcgImportSheet("deck") (A.tImport): "Import a deck", the game's hint, the list (9 lines, the game's example), Upload a file
 * (.ydk / .txt under 2 MB: its words fill the list and its name the deck's, C.tImpFile), .grid2 Name and Format, #tImpStatus (what the
 * import says as it matches, or why it stopped) and Import (busy "Importing…": A.tImpDeck, the site's own, every field it reads handed
 * in). Saved, the sheet closes and the deck's page opens (go("#tdeck/<id>")).
 */
@Composable
internal fun TcgDeckImportSheet(o: CollectionWrites.TcgDeckOpen, backdrop: GraphicsLayer?, onClose: () -> Unit, initial: JsonObject? = null, status0: String = "") {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val model by produceState(initial, o.id) { if (initial == null) value = CollectionWrites.tDeckImportModel(context, o.game) ?: run { onClose(); null } }
    val m = model ?: return
    val nm = m.o("name") ?: JsonObject(); val fm = m.o("format") ?: JsonObject()
    var text by remember { mutableStateOf("") }
    var name by remember { mutableStateOf(nm.s("value")) }
    var format by remember { mutableStateOf(fm.s("selected")) }
    var status by remember { mutableStateOf(status0) }
    var busy by remember { mutableStateOf(false) }
    // C.tImpFile: over 2 MB is refused; the words go in the list, the file's name (without its extension) in Name.
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val got = withContext(Dispatchers.IO) { readSmallFile(context, uri, 2e6) }
            if (got == null) { CollectionWrites.show("Use a file under 2 MB."); return@launch }
            text = got.first; name = got.second.replace(Regex("\\.[^.]+$"), "")
        }
    }
    fun import() {
        if (busy) return
        busy = true
        val d = JsonObject().apply { addProperty("game", o.game); addProperty("text", text); addProperty("name", name); addProperty("format", format) }
        scope.launch {
            var go: JsonObject? = null
            try {
                CollectionWrites.actSaying(context, "tImpDeck", d, { step -> status = step }) { r ->
                    go = runCatching { JsonParser.parseString(r.s("made")).asJsonObject }.getOrNull()
                }
            } finally { busy = false }
            go?.takeIf { it.s("go") == "tdeck" }?.let { g -> onClose(); o.openDeck(g.s("id")) }
        }
    }
    // ✕ / back while Importing…: app.js closeSheet (S.ui.sheetCtx null), so A.tImpDeck's importGuard stops it before it saves.
    SiteSheet(m.s("title"), backdrop, { if (busy) CollectionWrites.tDeckSheetClosed(); onClose() }) { vw ->
        Text(m.s("hint"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, Site.Muted))
        FormArea(text, { text = it }, m.s("placeholder"), m.n("rows").takeIf { it > 0 } ?: 9, "Decklist")
        // label.btn.ghost.file (inline-flex, margin 8 0) on its own line under the inline-block textarea: the textarea's line box
        // (its baseline gap) and the 8 above; under it the 8, the line's descent and .grid2's 10 (site-ygo-import: 16 above, 21 under).
        Spacer(Modifier.height(15.2.dp))
        GhostBtn(m.s("upload")) { runCatching { pick.launch(arrayOf("text/*", "application/octet-stream")) } }
        Spacer(Modifier.height(17.dp))
        FormGrid(vw <= 480.dp, listOf(
            formCell(false) { md -> FormLabeled(nm.s("label"), md) { FormInput(name, { if (it.length <= (nm.n("max").takeIf { x -> x > 0 } ?: 100)) name = it }, SHEET_IN_LABEL, desc = nm.s("label")) } },
            formCell(false) { md -> FormLabeled(fm.s("label"), md) { FormSelect(fm.pairs("options"), format, SHEET_IN_LABEL, desc = fm.s("label")) { format = it } } },
        ))
        // p#tImpStatus.muted.small (role status), empty until the import says something; then .btn.block.
        Spacer(Modifier.height(10.dp))
        if (status.isNotEmpty()) Text(status, Modifier.padding(vertical = 6.dp).semantics { liveRegion = LiveRegionMode.Polite }, style = cssType(13f, 400, 18.85f, Site.Muted))
        FormGold(if (busy) "Importing…" else m.s("button"), enabled = !busy, modifier = Modifier.fillMaxWidth(), pal = LocalSheetPal.current) { import() }
        Spacer(Modifier.height(8.dp))
    }
}

/**
 * tcg.js tcgNewDeckSheet (A.tNewDeck): "New <game> deck", Name (placeholder My deck) and Format (Meta decks' Create a … deck chooses
 * its format), Create deck (A.tNewDeckSave, the site's own). Saved, the sheet closes and the deck's page opens.
 */
@Composable
internal fun TcgNewDeckSheet(o: CollectionWrites.TcgDeckOpen, backdrop: GraphicsLayer?, onClose: () -> Unit, initial: JsonObject? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val model by produceState(initial, o.id) { if (initial == null) value = CollectionWrites.tNewDeckModel(context, o.game, o.format) ?: run { onClose(); null } }
    val m = model ?: return
    val nm = m.o("name") ?: JsonObject(); val fm = m.o("format") ?: JsonObject()
    var name by remember { mutableStateOf("") }
    var format by remember { mutableStateOf(fm.s("selected")) }
    var busy by remember { mutableStateOf(false) }
    fun save() {
        if (busy) return
        busy = true
        val d = JsonObject().apply { addProperty("game", o.game); addProperty("name", name); addProperty("format", format) }
        scope.launch {
            var go: JsonObject? = null
            try { CollectionWrites.act(context, "tNewDeckSave", d) { r -> go = runCatching { JsonParser.parseString(r.s("made")).asJsonObject }.getOrNull() } }
            finally { busy = false }
            go?.takeIf { it.s("go") == "tdeck" }?.let { g -> onClose(); o.openDeck(g.s("id")) }
        }
    }
    SiteSheet(m.s("title"), backdrop, onClose) { _ ->
        // .grid2 (margin 10 0) with both labels .span2: one column.
        Spacer(Modifier.height(10.dp))
        FormGrid(true, listOf(
            formCell(true) { md -> FormLabeled(nm.s("label"), md) { FormInput(name, { if (it.length <= (nm.n("max").takeIf { x -> x > 0 } ?: 100)) name = it }, SHEET_IN_LABEL, nm.s("placeholder"), desc = nm.s("label")) } },
            formCell(true) { md -> FormLabeled(fm.s("label"), md) { FormSelect(fm.pairs("options"), format, SHEET_IN_LABEL, desc = fm.s("label")) { format = it } } },
        ))
        Spacer(Modifier.height(10.dp))
        FormGold(m.s("button"), enabled = !busy, modifier = Modifier.fillMaxWidth(), pal = LocalSheetPal.current) { save() }
        Spacer(Modifier.height(8.dp))
    }
}

/** A chosen file's words and name, or null when it is [max] bytes or more. */
internal fun readSmallFile(context: android.content.Context, uri: Uri, max: Double): Pair<String, String>? {
    val cr = context.contentResolver
    var name = "deck"; var size = -1L
    runCatching { cr.query(uri, null, null, null, null)?.use { c -> if (c.moveToFirst()) {
        c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = c.getString(it) ?: name }
        c.getColumnIndex(android.provider.OpenableColumns.SIZE).takeIf { it >= 0 }?.let { size = c.getLong(it) } } } }
    if (size > max) return null
    val bytes = runCatching { cr.openInputStream(uri)?.use { it.readBytes() } }.getOrNull() ?: return null
    if (bytes.size > max) return null
    return String(bytes) to name
}

// ---------------------------------------------------------------- Magic: Deck review (views.js deckReviewSheet)

/** The review sheet's model (Collection.deckReview), as the site's markup says it. */
class DeckReviewModel(val title: String, val close: String, val intro: List<Pair<String, String>>, val items: List<Item>, val empty: Pair<String, String>?, val foot: String) {
    class Item(val level: String, val title: String, val chip: String, val detail: String, val cards: List<String>, val more: String, val action: Action?)
    class Action(val act: String, val id: String, val role: String, val label: String)
    companion object {
        fun parse(j: JsonObject): DeckReviewModel? {
            if (j.has("missing") || !j.has("title")) return null
            return DeckReviewModel(j.s("title"), j.s("close"), j.objs("intro").map { it.s("text") to it.s("tone") },
                j.objs("items").map { i -> Item(i.s("level"), i.s("title"), i.s("chip"), i.s("detail"), i.strs("cards"), i.s("more"),
                    i.o("action")?.let { a -> Action(a.s("act"), a.s("id"), a.s("role"), a.s("label")) }) },
                j.o("empty")?.let { it.s("title") to it.s("text") }, j.s("foot"))
        }
    }
}

/** What the review's buttons do on the deck page that opened it. */
class DeckReviewActions(val close: () -> Unit, val card: (String) -> Unit, val act: (DeckReviewModel.Action) -> Unit)

/**
 * views.js deckReviewSheet (app.js A.deckReview), in the site's sheet: "Deck review", the intro ("n things worth a look in …", ● breaks
 * a rule · ▲ worth reviewing, icons.js's stop and warn in their colours), .review-list (8 apart): each .review-item (surface, the line,
 * corners 14, 12 in, the level's 3 wide left edge) with its icon in a 22 column, the bold title beside its chip (Rule / Guideline /
 * Check), the muted detail, the cards (gold links, ", " between, "+k more"), the ghost small action; or the empty state; the foot.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DeckReviewSheet(m: DeckReviewModel, glyphs: Map<String, SiteSvg>, backdrop: GraphicsLayer?, act: DeckReviewActions) {
    SiteSheet(m.title, backdrop, act.close) { _ ->
        if (m.intro.isNotEmpty()) {
            val inline = m.intro.mapIndexedNotNull { i, (t, tone) -> if (tone.isNotEmpty()) "g$i" to InlineTextContent(Placeholder(1.4.em, 1.4.em, PlaceholderVerticalAlign.Center)) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { SiteIcon(glyphs[t], 18.dp, if (tone == "bad") RBad else RWarn) } } else null }.toMap()
            Text(buildAnnotatedString { m.intro.forEachIndexed { i, (t, tone) -> if (tone.isNotEmpty() && glyphs[t] != null) appendInlineContent("g$i", t)
                else if (tone.isNotEmpty()) withStyle(SpanStyle(color = if (tone == "bad") RBad else RWarn)) { append(t) } else append(t) } },
                Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, Site.Muted), inlineContent = inline)
        }
        // .review-list { margin: 10px 0 }: collapsed with the intro p's 6 above and p.foot's 10 under, 10 each side.
        if (m.items.isNotEmpty()) Column(Modifier.fillMaxWidth().padding(top = if (m.intro.isNotEmpty()) 4.dp else 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            m.items.forEach { ReviewItem(it, glyphs, act) }
        }
        m.empty?.let { (h, p) ->
            // .empty: centred, 28 / 12 in; the ✓ mark is hidden (.empty-mark { display: none }).
            Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(h, style = cssType(17f, 700, 22f, Site.Text).copy(fontFamily = Site.Manrope), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Spacer(Modifier.height(6.dp))
                Text(p, style = cssType(15f, 400, 21.75f, Site.Text), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
        // p.foot: 12, faint, 10 above.
        Text(m.foot, Modifier.padding(top = 10.dp, bottom = 6.dp), style = cssType(12f, 400, 17.4f, Site.Faint))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReviewItem(x: DeckReviewModel.Item, glyphs: Map<String, SiteSvg>, act: DeckReviewActions) {
    val tone = if (x.level == "bad") RBad else RWarn
    val shape = RoundedCornerShape(14.dp)
    val line = Site.Line
    Row(Modifier.fillMaxWidth().clip(shape).background(Site.Surface).border(1.dp, line, shape)
        // border-left: 3px solid the level's colour (over the 1 px line), curving round the 14 corners as the site's does.
        .drawBehind {
            // The border box's rounded outline less the padding box's (3 in at the left, 1 elsewhere; its corners 11 across, 13 down),
            // kept left of where the left and top/bottom borders meet (the line from the outer corner through the inner one).
            val r = 14.dp.toPx(); val l = 3.dp.toPx(); val t = 1.dp.toPx()
            val outer = androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, size.width, size.height, androidx.compose.ui.geometry.CornerRadius(r))) }
            val innerL = androidx.compose.ui.geometry.CornerRadius(r - l, r - t); val innerR = androidx.compose.ui.geometry.CornerRadius(r - t)
            val inner = androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(l, t, size.width - t, size.height - t, innerL, innerR, innerR, innerL)) }
            val side = androidx.compose.ui.graphics.Path().apply { moveTo(0f, 0f); lineTo(r, r * t / l); lineTo(r, size.height - r * t / l); lineTo(0f, size.height); close() }
            val ring = androidx.compose.ui.graphics.Path().apply { op(outer, inner, androidx.compose.ui.graphics.PathOperation.Difference) }
            drawPath(androidx.compose.ui.graphics.Path().apply { op(ring, side, androidx.compose.ui.graphics.PathOperation.Intersect) }, tone)
        }
        .padding(start = 14.dp, top = 12.dp, end = 12.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        // .review-icon: the lone glyph (icons.js: stop / warn, 20), 2 down.
        Box(Modifier.width(22.dp).padding(top = 2.dp)) { glyphs[if (x.level == "bad") "●" else "▲"]?.let { SiteIcon(it, 20.dp, tone) } ?: Text(if (x.level == "bad") "●" else "▲", style = cssType(13f, 400, 18f, tone)) }
        Column(Modifier.weight(1f)) {
            // .row.between: the bold title, the chip.
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(x.title, Modifier.weight(1f), style = cssType(15f, 700, 21.75f, Site.Text))
                if (x.chip.isNotEmpty()) Text(x.chip, Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, line, RoundedCornerShape(999.dp))
                    .padding(horizontal = 9.dp, vertical = 3.dp), style = cssType(12f, 700, 17.4f, Site.Text), maxLines = 1)
            }
            Text(x.detail, Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, Site.Muted))
            if (x.cards.isNotEmpty()) FlowRow(Modifier.padding(vertical = 2.dp), verticalArrangement = Arrangement.Center) {
                x.cards.forEachIndexed { i, n ->
                    // button.link: gold 600, 4 above and under; a 44 tall touch area.
                    Box(Modifier.heightIn(min = 44.dp).clickable { act.card(n) }.semantics { role = Role.Button }, contentAlignment = Alignment.CenterStart) {
                        Text(n, Modifier.padding(vertical = 4.dp), style = cssType(13f, 600, 18.85f, Site.Gold)) }
                    if (i < x.cards.lastIndex) Box(Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.CenterStart) { Text(", ", style = cssType(13f, 400, 18.85f, Site.Text)) }
                }
                if (x.more.isNotEmpty()) Box(Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.CenterStart) { Text(" " + x.more, style = cssType(13f, 400, 18.85f, Site.Text)) }
            }
            x.action?.let { a -> Spacer(Modifier.height(6.dp)); Box(Modifier.offset(y = 0.dp)) { GhostBtn(a.label, small = true) { act.act(a) } } }
        }
    }
}

/**
 * The review sheet over deck [deck]'s page: the site's model, read again after any save (app.js refreshSheet keeps it current);
 * gone when the deck is (the sheet closes).
 */
@Composable
fun DeckReviewHost(deck: String, backdrop: GraphicsLayer?, act: DeckReviewActions) {
    val context = LocalContext.current
    val written by CollectionWrites.written.collectAsState()
    var glyphs by remember { mutableStateOf<Map<String, SiteSvg>>(emptyMap()) }
    val model by produceState<DeckReviewModel?>(null, deck, written) {
        if (glyphs.isEmpty()) runCatching { glyphs = glyphMap(CollectionEngine.glyphs()) }
        val j = CollectionWrites.reviewModel(context, deck)
        val m = j?.let(DeckReviewModel::parse)
        if (m == null) act.close() else value = m
    }
    model?.let { DeckReviewSheet(it, glyphs, backdrop, act) }
}

// ---------------------------------------------------------------- the War Chest window (war-chest.js openWarChest)

/**
 * war-chest.js openWarChest from the Decks head: dialog.war-chest-dialog (min(560, 94% of the screen) wide, at most the screen less
 * 40 above and under, corners 26, scrolling inside) over the page dimmed #06070acc and blurred 10; warChestMarkup drawn by the panel
 * (its lid 64 in at the top), and the ✕ (.wc-close: 44 round, 10 from the corner, night glass in a gold line, cream ×) closing it.
 */
@Composable
fun WarChestWindow(panel: SitePanelModel, ui: SiteUi, backdrop: GraphicsLayer?, scroll: androidx.compose.foundation.ScrollState = rememberScrollState(), onClose: () -> Unit) {
    BackHandler { onClose() }
    val dim = androidx.compose.ui.graphics.rememberGraphicsLayer()
    BoxWithConstraints(Modifier.fillMaxSize()
        .drawBehind {
            if (backdrop != null && backdrop.size.width > 0) {
                dim.renderEffect = androidx.compose.ui.graphics.BlurEffect(10.dp.toPx(), 10.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                dim.record(backdrop.size) { drawLayer(backdrop) }
                drawLayer(dim)
            }
            drawRect(Color(0xCC06070A))
        }
        .pointerInput(Unit) { detectTapGestures { } }, contentAlignment = Alignment.Center) {
        val insets = maxOf(40.dp, WindowInsets.statusBars.asPaddingValues().calculateTopPadding(), WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding())
        Box(Modifier.width(minOf(560.dp, maxWidth * .94f)).heightIn(max = (maxHeight - insets * 2).coerceAtLeast(120.dp)).clip(RoundedCornerShape(26.dp))
            .semantics { contentDescription = "The War Chest" }) {
            Column(Modifier.fillMaxWidth().verticalScroll(scroll)) { SitePanel(panel, ui, padded = false) }
            Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(44.dp).clip(CircleShape).background(Color(0xB30E131E)).border(1.dp, Color(0x57E8CE87), CircleShape)
                .clickable(onClick = onClose).semantics { contentDescription = "Close the War Chest"; role = Role.Button }, contentAlignment = Alignment.Center) {
                Text("×", style = cssType(22f, 400, 26f, Color(0xFFF5F1E6)))
            }
        }
    }
}
