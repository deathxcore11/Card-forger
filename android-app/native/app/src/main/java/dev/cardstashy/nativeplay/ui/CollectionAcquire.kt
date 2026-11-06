package dev.cardstashy.nativeplay.ui

import android.annotation.SuppressLint
import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.launch

private val QInk = Color(0xFFEEF0F4)
private val QMute = Color(0xFF9AA2B1)
private val QLine = Color(0xFF2A2F39)
private val QBad = Color(0xFFF08A7E)

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.pairs(k: String) = getAsJsonArray(k)?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()

/**
 * app.js acquireSheet(mode): the deck page's "I got cards" (A.acquire: "Cards I got", the copies the deck is missing, none ticked)
 * and the ⋯ menu's Add deck to collection (A.deckBought: "Add the whole deck to my collection", every card ticked). The words
 * under the title; .grid2: where to store them (collection-locations.js locationPicker, a bought deck offering its own name),
 * Finish and Condition; Select all / Select none; the rows (label.mini-row: the tick, the name, the copies in input.narrow, at most
 * the row's count); #acqError; Add to collection (A.acqConfirm, the site's handler in the engine), which closes the sheet once saved.
 */
@Composable
internal fun AcquireSheet(o: CollectionWrites.AcquireOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val model by produceState<JsonObject?>(null, o.id) {
        val m = CollectionWrites.acquireModel(context, o.deck, o.mode)
        if (m == null || m.b("missing")) { onClose(); return@produceState }
        value = m
    }
    val m = model ?: return
    AcquireForm(m, o, backdrop, onClose)
}

@Composable
private fun AcquireForm(m: JsonObject, o: CollectionWrites.AcquireOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val loc = m.o("location") ?: JsonObject()
    val rows = remember { m.objs("rows") }
    val ticks = remember { mutableStateListOf(*rows.map { it.b("on") }.toTypedArray()) }
    val counts = remember { mutableStateListOf(*rows.map { it.s("qty") }.toTypedArray()) }
    var finish by remember { mutableStateOf(m.s("finish")) }
    var condition by remember { mutableStateOf(m.s("condition")) }
    var picker by remember { mutableStateOf(loc.s("selected")) }
    var location by remember { mutableStateOf(loc.s("input")) }
    var locShown by remember { mutableStateOf(false) }
    var locPlaceholder by remember { mutableStateOf(loc.s("placeholder")) }
    var locHint by remember { mutableStateOf(loc.s("hint")) }
    var locFocus by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }

    // collection-locations.js chooseLocation.
    fun chooseLocation(v: String) {
        picker = v
        val newName = v == "new" || v == "binder:new"
        locShown = newName
        location = if (newName) "" else if (v.startsWith("location:")) v.removePrefix("location:") else ""
        locPlaceholder = if (v == "binder:new") "Name your binder…" else "e.g. Deck box, Blue box…"
        locHint = if (v == "binder:new") "This creates a named binder and places the card in it when you save." else "Saved names can be selected again for your next card."
        if (newName) locFocus++
    }
    // A.acqConfirm: busy(t, "Saving…"); the ticked rows with their copies; the error under the list, or the sheet closed once saved.
    fun save() {
        if (saving) return
        saving = true; error = ""
        val picked = JsonArray().apply { rows.forEachIndexed { i, r -> if (ticks[i]) add(JsonObject().apply { addProperty("name", r.s("name")); addProperty("qty", counts[i]) }) } }
        val d = JsonObject().apply {
            addProperty("deck", o.deck); addProperty("mode", m.s("mode")); add("picked", picked)
            addProperty("location", location); addProperty("picker", picker); addProperty("finish", finish); addProperty("cond", condition)
        }
        scope.launch {
            try {
                CollectionWrites.actSaying(context, "acqConfirm", d, { t -> error = t }) { r -> if (r.s("made") == "closed") onClose() }
            } finally { saving = false }
        }
    }

    SiteSheet(m.s("title"), backdrop, onClose) { vw ->
        val one = vw <= 480.dp
        // p.muted.small: 13 muted, 6 above and under.
        Text(m.s("intro"), Modifier.padding(vertical = 6.dp), style = cssType(13f, 400, 18.85f, QMute))
        // .grid2 (10 above and under, 10 apart): the location picker across both columns, then Finish and Condition (one column up to 480).
        Spacer(Modifier.height(10.dp))
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(loc.s("label"), style = cssType(13f, 600, 18.85f, QMute))
            FormSelect(loc.pairs("options"), picker, SHEET_PLAIN, minH = 46.dp, desc = loc.s("label")) { chooseLocation(it) }
            if (locShown) {
                val focus = remember { FocusRequester() }
                FormInput(location, { location = it.take(100) }, SHEET_PLAIN, locPlaceholder, minH = 46.dp,
                    desc = if (picker == "binder:new") "New binder name" else "New location name", focus = focus)
                LaunchedEffect(locFocus) { runCatching { focus.requestFocus() } }
            }
            Text(locHint, style = cssType(11f, 400, 15.95f, QMute))
        }
        Spacer(Modifier.height(10.dp))
        val finishField: @Composable (Modifier) -> Unit = { md -> FormLabeled("Finish", md) { FormSelect(m.pairs("finishes"), finish, SHEET_IN_LABEL, desc = "Finish") { finish = it } } }
        val condField: @Composable (Modifier) -> Unit = { md -> FormLabeled("Condition", md) { FormSelect(m.pairs("conditions"), condition, SHEET_IN_LABEL, desc = "Condition") { condition = it } } }
        if (one) Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) { finishField(Modifier.fillMaxWidth()); condField(Modifier.fillMaxWidth()) }
        else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { finishField(Modifier.weight(1f)); condField(Modifier.weight(1f)) }
        Spacer(Modifier.height(10.dp))
        // .row.between: A.acqAll's two links (button.link.small: 13 / 600 gold, 4 above and under).
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            // Each link's tap fills a 44 tall strip around its words.
            Box(Modifier.heightIn(min = 44.dp).widthIn(min = 64.dp).clip(RoundedCornerShape(6.dp)).clickable { ticks.indices.forEach { ticks[it] = true } }
                .semantics { role = Role.Button }, contentAlignment = Alignment.CenterStart) { Text(m.s("all"), style = cssType(13f, 600, 18.85f, Site.Gold)) }
            Box(Modifier.heightIn(min = 44.dp).widthIn(min = 64.dp).clip(RoundedCornerShape(6.dp)).clickable { ticks.indices.forEach { ticks[it] = false } }
                .semantics { role = Role.Button }, contentAlignment = Alignment.CenterEnd) { Text(m.s("none"), style = cssType(13f, 600, 18.85f, Site.Gold)) }
        }
        // .list.compact: each label.mini-row 9 / 2 in, a hairline under all but the last, 14 / 500; the tick and the name, the copies at the end.
        Column(Modifier.fillMaxWidth()) {
            rows.forEachIndexed { i, r ->
                val on = ticks[i]
                Row(Modifier.fillMaxWidth().heightIn(min = 62.dp)
                    .drawBehind { if (i < rows.lastIndex) drawRect(QLine, topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - 1.dp.toPx()), size = Size(size.width, 1.dp.toPx())) }
                    .padding(horizontal = 2.dp, vertical = 9.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(6.dp)).clickable { ticks[i] = !on }
                        .semantics(mergeDescendants = true) { role = Role.Checkbox; selected = on; stateDescription = if (on) "Ticked" else "Not ticked" },
                        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        ChromeCheck(on, Modifier.padding(start = 4.dp, top = 3.dp, end = 3.dp, bottom = 3.dp))
                        Text(r.s("name"), Modifier.weight(1f), style = cssType(14f, 500, 20.3f, QInk), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    // input.narrow: 64 wide, centred (44 tall here, a touch target); min 1, max the row's count (the browser's stepper keeps it there).
                    FormInput(counts[i], { v -> counts[i] = v.filter(Char::isDigit).take(4) }, SHEET_PLAIN.copy(textAlign = TextAlign.Center), modifier = Modifier.width(64.dp),
                        minH = 44.dp, desc = "Copies of ${r.s("name")}", keyboard = KeyboardType.Number)
                }
            }
        }
        // #acqError (.error: bad, 13, 4 above and under; empty, it isn't there), then .btn.block.
        if (error.isNotEmpty()) Text(error, Modifier.padding(vertical = 4.dp), style = cssType(13f, 400, 18.85f, QBad))
        Spacer(Modifier.height(10.dp))
        FormGold(if (saving) m.s("saving") else m.s("save"), enabled = !saving, modifier = Modifier.fillMaxWidth()) { save() }
        Spacer(Modifier.height(8.dp))
    }
}

/**
 * app.js A.proxies' page (extras.js proxySheetHTML), opened as the site opens it with window.open: the page in its own window over
 * the app, with the browser's ✕ and title along the top. Its Print button (print()) opens Android's print dialog for the page
 * (save as PDF, or a printer), as the browser's does.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
internal fun ProxySheet(o: CollectionWrites.ProxyOpen, onClose: () -> Unit) {
    val context = LocalContext.current
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler(onBack = onClose)
        Column(Modifier.fillMaxSize().background(Color.White)) {
            // The new window's own bar: ✕ and the page's title.
            Row(Modifier.fillMaxWidth().background(Color(0xFF111111)).statusBarsPadding().heightIn(min = 52.dp).padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(24.dp)).clickable(onClick = onClose).semantics { role = Role.Button; contentDescription = "Close" },
                    contentAlignment = Alignment.Center) { Text("✕", style = cssType(18f, 600, 22f, Color.White)) }
                Text(o.title, Modifier.weight(1f).padding(end = 12.dp), style = cssType(15f, 600, 20f, Color.White), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            AndroidView({ c ->
                WebView(c).apply {
                    settings.javaScriptEnabled = true
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true
                    settings.builtInZoomControls = true
                    settings.displayZoomControls = false
                    val view = this
                    addJavascriptInterface(object {
                        @JavascriptInterface fun print() { view.post { printPage(context, view, o.title) } }
                    }, "CardStashyPrint")
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(v: WebView, url: String?) {
                            v.evaluateJavascript("window.print = () => CardStashyPrint.print();", null)
                        }
                    }
                    loadDataWithBaseURL("https://cardstashy.com/", o.html, "text/html", "utf-8", null)
                }
            }, Modifier.fillMaxWidth().weight(1f), onRelease = { it.destroy() })
        }
    }
}

/** window.print(): Android's print dialog for the page. */
private fun printPage(context: Context, view: WebView, title: String) {
    // PrintManager prints only from an activity: the one this window sits on.
    var c: Context? = context
    while (c is android.content.ContextWrapper && c !is android.app.Activity) c = c.baseContext
    val pm = (c ?: context).getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
    val job = title.ifBlank { "CardStashy proxies" }
    runCatching { pm.print(job, view.createPrintDocumentAdapter(job), PrintAttributes.Builder().build()) }
}
