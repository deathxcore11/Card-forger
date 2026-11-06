package dev.cardstashy.nativeplay.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.pairs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()

private val IInk = Color(0xFFEEF0F4)
private val IMute = Color(0xFF9AA2B1)
private val ILine = Color(0xFF2A2F39)
/** --bad: .error's words. */
private val IBad = Color(0xFFF08A7E)
/** .note.warn: gold-ish at 10 % under #f6dba2 words. */
private val IWarnBg = Color(0x1AF2C66D)
private val IWarnInk = Color(0xFFF6DBA2)
/** --warn: .warn-text. */
private val IWarn = Color(0xFFF2C66D)

/** The open game's --gold as the site paints it (Magic's own gold is Site.Gold here). */
private val Accent: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current.takeIf { it != CardGame.MTG.gold } ?: Site.Gold

// ---------------------------------------------------------------- Magic Collection's ⋯

/**
 * app.js A.collMenu: "Collection" over a .menu-list (each button 13 / 4 in, a line under it, 15; its leading glyph drawn as icons.js
 * decorateGlyphs draws it: the .gl icon 1.2 em, 0.4 em before the words) and #collMenuMsg (13 muted) for what a button says as it
 * runs. Import a list or CSV opens the import sheet; Export CSV saves the file; Retry, Refresh all prices and Verify exact printings
 * run their handlers here (busy(t, …): the button's words while it runs).
 */
@Composable
internal fun CollMenuSheet(o: CollectionWrites.MenuOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val model by produceState<JsonObject?>(null, o.id) { value = CollectionWrites.collMenuModel(context) ?: run { onClose(); null } }
    val m = model ?: return
    var msg by remember { mutableStateOf("") }
    var running by remember { mutableStateOf<String?>(null) }
    SiteSheet(m.s("title"), backdrop, onClose) { _ ->
        // .menu-list: a grid, 8 above and below.
        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            m.objs("items").forEach { it ->
                val act = it.s("act")
                val busyWords = when (act) { "refreshPrices" -> "Refreshing…"; "verifyAll" -> "Checking…"; else -> null }
                val busy = running == act && busyWords != null
                Row(Modifier.fillMaxWidth().clickable(enabled = running == null) {
                    when (act) {
                        "importCollection" -> { onClose(); CollectionWrites.importing.value = CollectionWrites.ImportOpen("mtg", one = { CollectionWrites.openAdd(JsonObject()) }) }
                        "exportCSV" -> scope.launch { CollectionWrites.exportCSV(context) }
                        else -> scope.launch {
                            running = act
                            try {
                                val saved = CollectionWrites.actSaying(context, act, JsonObject(), { step -> msg = step })
                                if (act == "retryLookups" && saved) o.lookups()
                            } finally { running = null }
                        }
                    }
                }.semantics(mergeDescendants = true) { role = Role.Button }
                    .drawBehind { drawRect(ILine, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
                    .padding(horizontal = 4.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                    // busy(): the button's words replaced (its icon with them) while it runs.
                    val icon = CollectionCardsModel.svg(it.o("icon"))
                    if (!busy && icon != null) { SiteIcon(icon, 18.dp, IInk); Spacer(Modifier.width(6.dp)) }
                    Text(if (busy) busyWords!! else it.s("label"), style = cssType(15f, 400, 21.75f, IInk))
                }
            }
        }
        // p.muted.small#collMenuMsg: 6 above and below; empty, it takes no room.
        if (msg.isNotEmpty()) Text(msg, Modifier.padding(vertical = 6.dp).semantics { liveRegion = LiveRegionMode.Polite }, style = cssType(13f, 400, 18.85f, IMute))
    }
}

// ---------------------------------------------------------------- the import sheets

/** A <textarea> on the glass field ([weight]: in a label it takes the label's 600): [rows] lines of 13.5 / 19.575 (9 / 12 in), at least 120 tall; Chrome's grey placeholder. */
@Composable
internal fun FormArea(value: String, onValue: (String) -> Unit, placeholder: String, rows: Int, desc: String, modifier: Modifier = Modifier, weight: Int = 400) {
    var focused by remember { mutableStateOf(false) }
    val ring = Accent
    val style = cssType(13.5f, weight, 19.575f, IInk)
    val h = maxOf(120f, rows * 19.575f + 20f).dp
    BasicTextField(value, onValue, modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused }
        .drawBehind { if (focused) { val o = 3.dp.toPx(); drawRoundRect(ring, Offset(-o, -o), Size(size.width + o * 2, size.height + o * 2), CornerRadius(11.dp.toPx() + o), style = Stroke(2.dp.toPx())) } }
        .semantics { contentDescription = desc }, textStyle = style, cursorBrush = SolidColor(ring),
        decorationBox = { inner ->
            Box(Modifier.fillMaxWidth().heightIn(min = h).siteGlassField(11.dp).padding(horizontal = 13.dp, vertical = 10.dp)) {
                if (value.isEmpty() && placeholder.isNotEmpty()) Text(placeholder, style = style.copy(color = Color(0xFF757575)))
                inner()
            }
        })
}

/** .btn.ghost: the glass button (15 / 700, 16 in, 44 tall, 11 corners); [small]: .btn.small (13.5, 12 in, 34 tall in a 44 touch area). */
@Composable
internal fun GhostBtn(label: String, enabled: Boolean = true, small: Boolean = false, fs: Float = if (small) 13.5f else 15f, onClick: () -> Unit) {
    Box(Modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else .45f).clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button },
        contentAlignment = Alignment.Center) {
        Box(Modifier.heightIn(min = if (small) 34.dp else 44.dp).clip(RoundedCornerShape(11.dp)).siteGlassField(11.dp)
            .padding(horizontal = if (small) 13.dp else 17.dp), contentAlignment = Alignment.Center) {
            Text(label, style = cssType(fs, 700, fs * 1.45f, IInk), maxLines = 1)
        }
    }
}

/** Chrome's checkbox at 18 (accent-color: the game's gold): #3b3b3b in a #858585 edge, or the gold with its tick in #3b3b3b. */
@Composable
internal fun ChromeCheck(on: Boolean, modifier: Modifier = Modifier) {
    val gold = Accent
    Box(modifier.size(18.dp).drawBehind {
        val u = 1.dp.toPx(); val r = CornerRadius(2.dp.toPx())
        if (on) {
            drawRoundRect(gold, cornerRadius = r)
            val tick = Path().apply { moveTo(size.width * .2f, size.height * .53f); lineTo(size.width * .41f, size.height * .74f); lineTo(size.width * .8f, size.height * .3f) }
            drawPath(tick, Color(0xFF3B3B3B), style = Stroke(2.2f * u, cap = StrokeCap.Butt, join = StrokeJoin.Miter))
        } else {
            drawRoundRect(Color(0xFF3B3B3B), cornerRadius = r)
            drawRoundRect(Color(0xFF858585), Offset(u / 2, u / 2), Size(size.width - u, size.height - u), r, style = Stroke(u))
        }
    })
}

/** The file chosen with Choose .txt / .csv: its words (under 30 MB) and its name; null, with the site's toast, when it's too big. */
private suspend fun readPicked(context: android.content.Context, uri: Uri): Pair<String, String>? = withContext(Dispatchers.IO) {
    val cr = context.contentResolver
    var name = "import"; var size = -1L
    runCatching { cr.query(uri, null, null, null, null)?.use { c -> if (c.moveToFirst()) {
        c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = c.getString(it) ?: name }
        c.getColumnIndex(android.provider.OpenableColumns.SIZE).takeIf { it >= 0 }?.let { size = c.getLong(it) } } } }
    if (size > 30e6) return@withContext null
    val text = cr.openInputStream(uri)?.use { String(it.readBytes()) } ?: return@withContext null
    if (text.length > 30e6) null else text to name
}

/** A.impPreview's digest: the SHA-256 of the text's UTF-8, in hex. */
private fun sha256(text: String) = java.security.MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }

/** The open import sheet: Magic's (app.js importCollectionSheet) or Yu-Gi-Oh! / Pokémon's Paste a list (tcg.js tcgImportSheet). */
@Composable
internal fun ImportSheet(o: CollectionWrites.ImportOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    if (o.game == "mtg") MagicImportSheet(o, backdrop, onClose) else TcgImportSheet(o, backdrop, onClose)
}

/**
 * app.js importCollectionSheet: One card / Paste or upload a list, the hint, the list box, Choose .txt / .csv, Source name and How
 * to apply (side by side from 481 wide), #impError, Preview and Import, then the preview (drawImport): the summary with the skipped
 * lines' download, the warnings, Check names & printings and the rows (a tick, "qty× name" with set, number and finish, what the
 * check found, Pick printing when several match). Import saves (A.impApply); then the sheet closes and Cards opens.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MagicImportSheet(o: CollectionWrites.ImportOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val first by produceState<JsonObject?>(null, o.id) { value = CollectionWrites.importSheet(context, "mtg") ?: run { onClose(); null } }
    val f = first ?: return
    var text by remember { mutableStateOf("") }
    var source by remember { mutableStateOf(f.o("source")?.s("value").orEmpty()) }
    var mode by remember { mutableStateOf(f.o("mode")?.s("selected").orEmpty()) }
    var state by remember { mutableStateOf(f) }
    var busy by remember { mutableStateOf(false) }
    fun close() { onClose(); scope.launch { runCatching { CollectionEngine.importClose() } } }
    fun update(run: suspend () -> JsonObject) { scope.launch { CollectionWrites.importDo(context, run)?.let { state = it } } }
    fun preview() { val raw = text; val hash = sha256(raw); update { CollectionEngine.importPreview(raw, hash) } }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        // C.impFile: the file's words in the box, its name (less its extension) the source, then Preview.
        if (uri != null) scope.launch {
            val got = readPicked(context, uri) ?: return@launch CollectionWrites.show("Use a file under 30 MB.")
            text = got.first; source = got.second.replace(Regex("\\.[^.]+$"), "")
            CollectionWrites.importDo(context) { CollectionEngine.importText() }
            preview()
        }
    }
    SiteSheet(f.s("title"), backdrop, ::close) { vw ->
        Spacer(Modifier.height(12.dp))
        AddModeSeg("list", f.objs("seg").map { it.s("id") to it.s("label") }) { id -> if (id == "one") { close(); o.one?.invoke() } else { close(); CollectionWrites.importing.value = o.copy(id = System.nanoTime()) } }
        Spacer(Modifier.height(12.dp))
        Text(f.s("hint"), style = cssType(13f, 400, 18.85f, IMute))
        Spacer(Modifier.height(6.dp))
        FormArea(text, { v -> text = v; if (!busy) update { CollectionEngine.importText() } }, f.s("placeholder"), 6, "Cards to import")
        // label.btn.ghost.file: 8 around it, under the box's line (its 6.8 below the baseline).
        Spacer(Modifier.height(14.8.dp))
        GhostBtn(f.s("file"), fs = 12.5f) { runCatching { pick.launch("text/*") } }
        Spacer(Modifier.height(18.dp))
        // .grid2: Source name and How to apply, 10 apart (one over the other up to 480 wide).
        val src = f.o("source") ?: JsonObject(); val md = f.o("mode") ?: JsonObject()
        val a = @Composable { mod: Modifier -> FormLabeled(src.s("label"), mod) { FormInput(source, { source = it.take(100) }, SHEET_IN_LABEL, desc = src.s("label")) } }
        val b = @Composable { mod: Modifier -> FormLabeled(md.s("label"), mod) { FormSelect(md.pairs("options"), mode, SHEET_IN_LABEL, desc = md.s("label")) { mode = it } } }
        if (vw <= 480.dp) Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.fillMaxWidth()); b(Modifier.fillMaxWidth()) }
        else Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.weight(1f)); b(Modifier.weight(1f)) }
        Spacer(Modifier.height(10.dp))
        // #impError (13, --bad, 4 around; hidden while empty).
        if (state.s("error").isNotEmpty()) { Text(state.s("error"), Modifier.semantics { liveRegion = LiveRegionMode.Assertive }, style = cssType(13f, 400, 18.85f, IBad)); Spacer(Modifier.height(10.dp)) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            GhostBtn(f.s("preview"), enabled = !busy) { preview() }
            FormGold(state.s("applyLabel").ifBlank { f.s("apply") }, enabled = !state.b("applyDisabled") && !busy) {
                if (busy) return@FormGold
                busy = true
                scope.launch {
                    var made = ""
                    CollectionWrites.act(context, "impApply", JsonObject().apply { addProperty("mode", mode); addProperty("source", source) }) { r -> made = r.get("made")?.asString.orEmpty() }
                    busy = false
                    CollectionWrites.importDo(context) { CollectionEngine.importModel() }?.let { state = it }
                    if (made == "imported") { close(); o.imported() }
                }
            }
        }
        state.o("draft")?.let { d -> Draft(d, busy, onErrors = {
            scope.launch { CollectionWrites.importDo(context) { CollectionEngine.importErrors() }?.let { CollectionWrites.saveFile(context, it) } }
        }, onVerify = {
            if (busy) return@Draft
            busy = true
            scope.launch {
                // A.impVerify: its progress in #impError while it checks.
                CollectionWrites.actSaying(context, "impVerify", JsonObject(), { step -> state = state.deepCopy().apply { addProperty("error", step) } })
                busy = false
                CollectionWrites.importDo(context) { CollectionEngine.importModel() }?.let { state = it }
            }
        }, onUse = { i, on -> update { CollectionEngine.importUse(i, on) } }, onPrinting = { i, j ->
            scope.launch { CollectionWrites.importDo(context) { CollectionEngine.importPrinting(i, j) }?.let { r -> state = r; r.s("toast").takeIf { it.isNotBlank() }?.let(CollectionWrites::show) } }
        }) }
    }
}

/** drawImport's #impPreview. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Draft(d: JsonObject, busy: Boolean, onErrors: () -> Unit, onVerify: () -> Unit, onUse: (Int, Boolean) -> Unit, onPrinting: (Int, String) -> Unit) {
    val gold = Accent
    // p.small: <b>copies</b> · rows · <span.warn-text>N lines skipped</span> download · source (13 / 18.85, 6 around).
    Spacer(Modifier.height(6.dp))
    FlowRow(verticalArrangement = Arrangement.Center, itemVerticalAlignment = Alignment.CenterVertically) {
        Text(buildAnnotatedString {
            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(d.s("total")) }; append(" copies · ${d.s("rows")} rows")
            if (d.s("skipped").isNotEmpty()) { append(" · "); withStyle(SpanStyle(color = IWarn)) { append(d.s("skipped")) }; append(" ") }
        }, style = cssType(13f, 400, 18.85f, IInk))
        if (d.s("skipped").isNotEmpty()) Text("download", Modifier.clip(RoundedCornerShape(4.dp)).clickable(onClick = onErrors).padding(vertical = 4.dp), style = cssType(13f, 600, 18.85f, gold))
        Text(" · ${d.s("source")}", style = cssType(13f, 400, 18.85f, IInk))
    }
    Spacer(Modifier.height(6.dp))
    // .note.warn: 12 corners, 10 / 12 in, 10 around, 13.5.
    for (w in listOf(d.s("repeated"), d.s("overlapping")).filter { it.isNotEmpty() }) {
        Spacer(Modifier.height(4.dp))
        Text(w, Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(IWarnBg).padding(horizontal = 12.dp, vertical = 10.dp), style = cssType(13.5f, 400, 19.575f, IWarnInk))
        Spacer(Modifier.height(4.dp))
    }
    // .actions: 10 above; Check names & printings (.btn.ghost.small).
    Spacer(Modifier.height(4.dp))
    Box(Modifier.padding(top = 0.dp)) { GhostBtn(d.s("verify"), enabled = !d.b("verifyDisabled") && !busy, small = true, onClick = onVerify) }
    // .list.compact: the rows (label.mini-row: 9 / 2 in, a line under all but the last, 14 / 500; the review 13 muted at the end).
    val lots = d.objs("lots")
    lots.forEachIndexed { n, r ->
        val i = r.get("i")?.asInt ?: n
        val on = r.b("include")
        FlowRow(Modifier.fillMaxWidth().clickable { onUse(i, !on) }.semantics(mergeDescendants = true) { role = Role.Checkbox; selected = on; stateDescription = if (on) "Included" else "Left out" }
            .drawBehind { if (n < lots.lastIndex) drawRect(ILine, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
            .padding(horizontal = 2.dp, vertical = 9.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.spacedBy(10.dp),
            itemVerticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f, fill = false), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                ChromeCheck(on, Modifier.padding(start = 4.dp, top = 3.dp, end = 3.dp, bottom = 3.dp))
                Text(buildAnnotatedString {
                    append(r.s("line"))
                    if (r.s("meta").isNotBlank()) { append(" "); withStyle(SpanStyle(color = IMute, fontSize = androidx.compose.ui.unit.TextUnit(13f, androidx.compose.ui.unit.TextUnitType.Sp))) { append(r.s("meta")) } }
                }, style = cssType(14f, 500, 20.3f, IInk), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(10.dp))
            if (r.s("review").isNotEmpty()) Text(r.s("review"), style = cssType(13f, 400, 18.85f, IMute))
            val cands = r.pairs("candidates")
            if (cands.isNotEmpty()) Box(Modifier.fillMaxWidth()) { FormSelect(cands, "", SHEET_IN_LABEL, desc = "Pick printing") { j -> if (j.isNotEmpty()) onPrinting(i, j) } }
        }
    }
    if (d.s("more").isNotEmpty()) Text(d.s("more"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, IMute))
}

/**
 * tcg.js tcgImportSheet("coll"): "Paste cards you own", the game's hint, the list box (9 lines), #tImpStatus (what the import says
 * as it matches, or why it stopped) and Import (busy: "Importing…"), which adds the matched cards (A.tImpColl) and closes.
 */
@Composable
private fun TcgImportSheet(o: CollectionWrites.ImportOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val model by produceState<JsonObject?>(null, o.id) { value = CollectionWrites.importSheet(context, o.game) ?: run { onClose(); null } }
    val m = model ?: return
    var text by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    SiteSheet(m.s("title"), backdrop, onClose) { _ ->
        Text(m.s("hint"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, IMute))
        FormArea(text, { text = it }, m.s("placeholder"), m.get("rows")?.asInt ?: 9, "Cards to import")
        // The box's line keeps 6.8 under it; #tImpStatus (6 around) collapses away while empty.
        Spacer(Modifier.height(6.8.dp))
        if (status.isNotEmpty()) {
            Text(status, Modifier.padding(vertical = 6.dp).semantics { liveRegion = LiveRegionMode.Polite }, style = cssType(13f, 400, 18.85f, IMute))
            Spacer(Modifier.height(10.dp))
        } else Spacer(Modifier.height(16.dp))
        FormGold(if (busy) "Importing…" else m.s("button"), enabled = !busy, modifier = Modifier.fillMaxWidth(), pal = LocalSheetPal.current) {
            if (busy) return@FormGold
            busy = true; status = ""
            scope.launch {
                var made = ""
                CollectionWrites.actSaying(context, "tImpColl", JsonObject().apply { addProperty("game", o.game); addProperty("text", text) }, { step -> status = step }) { r ->
                    made = r.get("made")?.asString.orEmpty()
                }
                busy = false
                if (made == "closed") { onClose(); o.imported() }
            }
        }
    }
}
