package dev.cardstashy.nativeplay.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val NInk = Color(0xFFEEF0F4)
private val NMute = Color(0xFF9AA2B1)
private val NLine = Color(0xFF2A2F39)
private val NSurface = Color(0xFF171A20)
private val NBad = Color(0xFFF08A7E)
private val NGood = Color(0xFF6FD29A)
private val NWarn = Color(0xFFF2C66D)
private val NWarnBg = Color(0x1AF2C66D)
private val NWarnInk = Color(0xFFF6DBA2)
private val NSurface2 = Color(0xFF1F232B)

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.n(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.pairs(k: String) = getAsJsonArray(k)?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()

/** formatSelect's optgroups as FormSelect takes them: the options, and each group's name over its first. */
private fun formatOptions(groups: List<JsonObject>): Pair<List<Pair<String, String>>, List<String>> =
    groups.flatMap { g -> g.pairs("options") } to groups.flatMap { g -> g.pairs("options").mapIndexed { i, _ -> if (i == 0) g.s("group") else "" } }

/** One cell of a [Grid]: [wide] spans both columns. */
private fun cell(wide: Boolean, c: @Composable (Modifier) -> Unit): Pair<Boolean, @Composable (Modifier) -> Unit> = wide to c

/** .grid2 in a sheet: two columns 10 apart, one column up to 480 wide; [wide] spans both (.span2). */
@Composable
private fun Grid(one: Boolean, cells: List<Pair<Boolean, @Composable (Modifier) -> Unit>>) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        var i = 0
        while (i < cells.size) {
            val (wide, cell) = cells[i]
            val next = cells.getOrNull(i + 1)
            if (one || wide || next == null || next.first) { if (one || wide) cell(Modifier.fillMaxWidth()) else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { cell(Modifier.weight(1f)); Spacer(Modifier.weight(1f)) }; i++ }
            else { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { cell(Modifier.weight(1f)); next.second(Modifier.weight(1f)) }; i += 2 }
        }
    }
}

/**
 * app.js A.newDeck: "New deck". Format (formatSelect; the line under it, formatInfo, follows it), the commander (shown for a format
 * with one, "Oathbreaker" for a planeswalker one), the deck's name (optional) and budget, #ndError, Create deck (A.newDeckSave, the
 * site's handler in the engine: "Checking…" while the commander is looked up), the words on commanders. Saved, the deck opens.
 */
@Composable
internal fun NewDeckSheet(o: CollectionWrites.NewDeckOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val model by produceState<JsonObject?>(null, o.id) {
        val m = CollectionWrites.newDeckModel(context, o.commander)
        if (m == null) { onClose(); return@produceState }
        value = m
    }
    val m = model ?: return
    val scope = rememberCoroutineScope()
    val rows = m.o("rows") ?: JsonObject()
    val cm = m.o("commander") ?: JsonObject(); val nm = m.o("name") ?: JsonObject(); val bm = m.o("budget") ?: JsonObject()
    var format by remember { mutableStateOf(m.s("format")) }
    var commander by remember { mutableStateOf(cm.s("value")) }
    var name by remember { mutableStateOf(nm.s("value")) }
    var budget by remember { mutableStateOf(bm.s("value")) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val row = rows.o(format)
    fun save() {
        if (busy) return
        busy = true; error = ""
        val d = JsonObject().apply { addProperty("format", format); addProperty("commander", commander); addProperty("name", name); addProperty("budget", budget) }
        scope.launch {
            try {
                CollectionWrites.actSaying(context, "newDeckSave", d, { t -> error = t }) { r ->
                    val go = runCatching { JsonParser.parseString(r.s("made")).asJsonObject }.getOrNull() ?: return@actSaying
                    onClose(); o.openDeck(go.s("id"), go.s("tab"))
                }
            } finally { busy = false }
        }
    }
    SiteSheet(m.s("title"), backdrop, onClose) { vw ->
        val one = vw <= 480.dp
        val (opts, heads) = formatOptions(m.objs("formats"))
        Spacer(Modifier.height(10.dp))
        Grid(one, listOfNotNull(
            cell(true) { md -> FormLabeled(m.s("formatLabel"), md) { FormSelect(opts, format, SHEET_IN_LABEL, desc = m.s("formatLabel"), groups = heads) { format = it } } },
            // p.span2.muted.small#ndFormatInfo.
            cell(true) { md -> Text(row?.s("info").orEmpty(), md, style = cssType(13f, 400, 18.85f, NMute)) },
            cell(true) { md -> FormLabeled(row?.s("label") ?: cm.s("label"), md) {
                FormInput(commander, { commander = it }, SHEET_IN_LABEL, cm.s("placeholder"), desc = row?.s("label") ?: cm.s("label"))
            } }.takeIf { row?.b("commander") != false },
            cell(true) { md -> FormLabeled(nm.s("label"), md) { FormInput(name, { if (it.length <= (nm.n("max").takeIf { x -> x > 0 } ?: 100)) name = it }, SHEET_IN_LABEL, nm.s("placeholder"), desc = nm.s("label")) } },
            cell(false) { md -> FormLabeled(bm.s("label"), md) { FormInput(budget, { v -> budget = v.filter { it.isDigit() || it == '.' } }, SHEET_IN_LABEL, desc = bm.s("label"), keyboard = KeyboardType.Number) } },
        ))
        Spacer(Modifier.height(10.dp))
        // #ndError (.error: 13 bad, 4 above and under; empty, not there), .btn.block, then the muted words.
        if (error.isNotEmpty()) Text(error, Modifier.padding(vertical = 4.dp).semantics { liveRegion = LiveRegionMode.Polite }, style = cssType(13f, 400, 18.85f, NBad))
        FormGold(if (busy) m.s("busy") else m.s("save"), enabled = !busy, modifier = Modifier.fillMaxWidth()) { save() }
        Text(m.s("foot"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, NMute))
        Spacer(Modifier.height(8.dp))
    }
}

/**
 * app.js deckImportSheet: "Import a deck" (or "Save a deck idea"). The words; the list (textarea; typing clears the preview,
 * I.dImpText); Upload a file (.txt / .csv / .json / .dek under 5 MB: its words and name, then Preview & match, C.dImpFile); .grid2:
 * Deck name, Format, Commander (for a format with one), Save as (New deck, Replace the deck it opened for, Idea); Credit the creator
 * (details.more: link, author, kind, notes); #dImpStatus; Preview & match (A.dImpPreview: the names looked up, the form filled as the
 * site fills it) and Save deck (A.dImpSave, enabled once previewed; Replace asks first); #dImpResults (drawDeckImport). Saved, the deck
 * opens on the tab the site goes to (an Idea opens the website's Ideas).
 */
@Composable
internal fun DeckImportSheet(o: CollectionWrites.DeckImportOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val model by produceState<JsonObject?>(null, o.id) {
        val m = CollectionWrites.deckImportModel(context, o.preset, o.deck)
        if (m == null) { onClose(); return@produceState }
        value = m
    }
    val m = model ?: return
    DeckImportForm(m, o, backdrop, onClose)
}

@Composable
private fun DeckImportForm(m: JsonObject, o: CollectionWrites.DeckImportOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val rows = m.o("rowsOf") ?: JsonObject()
    val nm = m.o("name") ?: JsonObject(); val cm = m.o("commander") ?: JsonObject(); val dm = m.o("dest") ?: JsonObject()
    val credit = m.o("credit") ?: JsonObject()
    var text by remember { mutableStateOf(m.s("text")) }
    var name by remember { mutableStateOf(nm.s("value")) }
    var format by remember { mutableStateOf(m.s("format")) }
    var commander by remember { mutableStateOf(cm.s("value")) }
    var dest by remember { mutableStateOf(dm.s("selected")) }
    var creditOpen by remember { mutableStateOf(credit.b("open")) }
    var url by remember { mutableStateOf(credit.o("url")?.s("value").orEmpty()) }
    var author by remember { mutableStateOf(credit.o("author")?.s("value").orEmpty()) }
    var kind by remember { mutableStateOf(credit.o("kind")?.s("selected").orEmpty()) }
    var notes by remember { mutableStateOf(credit.o("notes")?.s("value").orEmpty()) }
    var status by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<JsonObject?>(null) }
    var ready by remember { mutableStateOf(false) }
    var previewing by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    val row = rows.o(format)
    fun form() = JsonObject().apply {
        addProperty("text", text); addProperty("name", name); addProperty("format", format); addProperty("commander", commander); addProperty("dest", dest)
        addProperty("url", url); addProperty("author", author); addProperty("kind", kind); addProperty("desc", notes)
    }
    // I.dImpText: a new list waits for Preview & match again.
    fun typed(v: String) {
        text = v
        if (ready || results != null) { ready = false; results = null; scope.launch { runCatching { CollectionWrites.importDo(context) { CollectionEngine.deckImportText(); JsonObject() } } } }
    }
    // The change listener (6104): drawDeckImport with the form as it is now.
    fun redraw() {
        if (!ready) return
        val f = form()
        scope.launch {
            val r = CollectionWrites.importDo(context) { CollectionEngine.deckImportDraw(f) } ?: return@launch
            r.s("status").takeIf { r.has("status") }?.let { status = it }
            r.o("results")?.let { results = it }
        }
    }
    // A.dImpPreview: busy "Loading…"; the names looked up (the status line says how far), the form filled, the results drawn.
    fun preview() {
        if (previewing) return
        previewing = true
        val f = form()
        scope.launch {
            try {
                val r = CollectionWrites.importDo(context) { CollectionEngine.act("dImpPreview", f, 120_000) { step -> status = step } } ?: return@launch
                val made = runCatching { JsonParser.parseString(r.s("made")).asJsonObject }.getOrNull() ?: return@launch
                made.o("form")?.let { g -> name = g.s("name"); commander = g.s("commander"); format = g.s("format") }
                status = made.s("status"); results = made.o("results"); ready = made.b("ready")
            } finally { previewing = false }
        }
    }
    // A.dImpSave: busy "Saving…"; then the page the site goes to, or the error in the status line.
    fun save() {
        if (saving || !ready) return
        saving = true
        scope.launch {
            try {
                CollectionWrites.actSaying(context, "dImpSave", form(), { t -> status = t }) { r ->
                    val go = runCatching { JsonParser.parseString(r.s("made")).asJsonObject }.getOrNull() ?: return@actSaying
                    onClose()
                    if (go.s("go") == "inspiration") o.web(CollectionWrites.SITE + "#decks/inspiration") else o.openDeck(go.s("id"), go.s("tab"))
                }
            } finally { saving = false }
        }
    }
    // C.dImpFile: a file over 5 MB is refused; its words fill the list, its name the deck's, then Preview & match.
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val got = withContext(Dispatchers.IO) { readDeckFile(context, uri) }
            if (got == null) { CollectionWrites.show("Use a file under 5 MB."); return@launch }
            typed(got.first); name = got.second.replace(Regex("\\.[^.]+$"), "")
            ready = false; results = null
            runCatching { CollectionWrites.importDo(context) { CollectionEngine.deckImportText(); JsonObject() } }
            preview()
        }
    }
    LaunchedEffect(commander) { if (ready) { delay(300); redraw() } }

    SiteSheet(m.s("title"), backdrop, onClose) { vw ->
        val one = vw <= 480.dp
        // p.muted.small, the list, then Upload a file (label.btn.ghost.file).
        Text(m.s("intro"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, NMute))
        Spacer(Modifier.height(4.dp))
        FormArea(text, ::typed, m.s("placeholder"), m.n("rows"), "Decklist")
        Spacer(Modifier.height(8.dp))
        GhostBtn(m.s("upload")) { runCatching { pick.launch(arrayOf("text/*", "application/json", "text/csv", "text/comma-separated-values", "application/octet-stream")) } }
        Spacer(Modifier.height(10.dp))
        val (opts, heads) = formatOptions(m.objs("formats"))
        Grid(one, listOfNotNull(
            cell(false) { md -> FormLabeled(nm.s("label"), md) { FormInput(name, { if (it.length <= (nm.n("max").takeIf { x -> x > 0 } ?: 100)) name = it }, SHEET_IN_LABEL, desc = nm.s("label")) } },
            cell(false) { md -> FormLabeled(m.s("formatLabel"), md) { FormSelect(opts, format, SHEET_IN_LABEL, desc = m.s("formatLabel"), groups = heads) { format = it; redraw() } } },
            cell(false) { md -> FormLabeled(row?.s("label") ?: cm.s("label"), md) {
                FormInput(commander, { commander = it }, SHEET_IN_LABEL, cm.s("placeholder"), desc = row?.s("label") ?: cm.s("label"))
            } }.takeIf { row?.b("commander") != false },
            cell(false) { md -> FormLabeled(dm.s("label"), md) { FormSelect(dm.pairs("options"), dest, SHEET_IN_LABEL, desc = dm.s("label")) { dest = it; redraw() } } },
        ))
        Spacer(Modifier.height(10.dp))
        FormMore(credit.s("summary"), creditOpen, { creditOpen = !creditOpen }) {
            Spacer(Modifier.height(10.dp))
            val u = credit.o("url") ?: JsonObject(); val a = credit.o("author") ?: JsonObject(); val k = credit.o("kind") ?: JsonObject(); val n = credit.o("notes") ?: JsonObject()
            Grid(one, listOf(
                cell(true) { md -> FormLabeled(u.s("label"), md) { FormInput(url, { url = it }, SHEET_IN_LABEL, u.s("placeholder"), desc = u.s("label"), keyboard = KeyboardType.Uri) } },
                cell(false) { md -> FormLabeled(a.s("label"), md) { FormInput(author, { if (it.length <= 100) author = it }, SHEET_IN_LABEL, desc = a.s("label")) } },
                cell(false) { md -> FormLabeled(k.s("label"), md) {
                    FormSelect(k.pairs("options"), kind, SHEET_IN_LABEL, desc = k.s("label")) { kind = it }
                } },
                cell(true) { md -> FormLabeled(n.s("label"), md) { FormArea(notes, { if (it.length <= 3000) notes = it }, "", n.n("rows").coerceAtLeast(2), n.s("label"), weight = 600) } },
            ))
        }
        // #dImpStatus (p.muted.small, a live line), then .actions: Preview & match (ghost) and Save deck (gold, off until previewed).
        if (status.isNotEmpty()) Text(status, Modifier.padding(vertical = 6.dp).semantics { liveRegion = LiveRegionMode.Polite }, style = cssType(13f, 400, 18.85f, NMute))
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            GhostBtn(if (previewing) m.s("previewBusy") else m.s("preview"), enabled = !previewing) { preview() }
            FormGold(if (saving) m.s("saving") else m.s("save"), enabled = ready && !previewing && !saving) { save() }
        }
        results?.let { ImportResults(it) }
        Spacer(Modifier.height(8.dp))
    }
}

/** drawDeckImport's #dImpResults: .kpis.small (three across, 8 apart), its notes (p.muted.small, .note.warn), then the list (.mini-row: the card and need N / owned). */
@Composable
private fun ColumnScope.ImportResults(r: JsonObject) {
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        r.getAsJsonArray("kpis")?.forEach { k -> val p = k.asJsonArray
            // .kpi: 12 in, the radius (14), surface on a hairline; b 17 / 800 Manrope, span 12 muted, 2 apart.
            Column(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(NSurface).border(1.dp, NLine, RoundedCornerShape(14.dp)).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(p[0].asString, style = cssType(17f, 800, 23f, NInk, -.02f).copy(fontFamily = Site.Manrope), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(p[1].asString, style = cssType(12f, 400, 17.4f, NMute))
            }
        }
    }
    r.objs("notes").forEach { n ->
        if (n.b("warn")) Text(n.s("text"), Modifier.padding(vertical = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(NWarnBg).padding(horizontal = 12.dp, vertical = 10.dp),
            style = cssType(13.5f, 400, 19.575f, NWarnInk))
        else Text(n.s("text"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, NMute))
    }
    val list = r.objs("rows")
    Column(Modifier.fillMaxWidth()) {
        list.forEachIndexed { i, x ->
            Row(Modifier.fillMaxWidth().drawBehind { if (i < list.lastIndex) drawRect(NLine, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
                .padding(horizontal = 2.dp, vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(x.s("text"), Modifier.weight(1f), style = cssType(14f, 400, 20.3f, NInk), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(x.s("need"), style = cssType(13f, 400, 18.85f, if (x.b("missing")) NWarn else NGood), maxLines = 1)
            }
        }
    }
}

/** A chosen deck file: its words and name, or null when it is 5 MB or more (C.dImpFile's f.size > 5e6). */
private fun readDeckFile(context: android.content.Context, uri: Uri): Pair<String, String>? {
    val cr = context.contentResolver
    var name = "deck"; var size = -1L
    runCatching { cr.query(uri, null, null, null, null)?.use { c -> if (c.moveToFirst()) {
        c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = c.getString(it) ?: name }
        c.getColumnIndex(android.provider.OpenableColumns.SIZE).takeIf { it >= 0 }?.let { size = c.getLong(it) } } } }
    if (size > 5e6) return null
    val bytes = runCatching { cr.openInputStream(uri)?.use { it.readBytes() } }.getOrNull() ?: return null
    if (bytes.size > 5e6) return null
    return String(bytes) to name
}
