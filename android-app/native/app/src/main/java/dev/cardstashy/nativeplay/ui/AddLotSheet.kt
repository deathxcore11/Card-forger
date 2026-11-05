package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.launch

// style.css tokens as the live sheet computes them.
private val AInk = Color(0xFFEEF0F4)
private val AMute = Color(0xFF9AA2B1)
private val AFoot = Color(0xFF8B93A3)
private val ALine = Color(0xFF2A2F39)
private val ASurface = Color(0xFF171A20)
private val ASurface2 = Color(0xFF1F232B)
private val ABad = Color(0xFFF08A7E)
/** Chrome's own ::placeholder grey; the site leaves it as it is. */
private val APlaceholder = Color(0xFF757575)
/** A CSS line box: [line] tall, its leading split evenly above and below (not trimmed away as Compose does by default). */
internal fun cssType(size: Float, weight: Int, line: Float, color: Color = AInk, track: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp, color = color, letterSpacing = track.sp, lineHeightStyle = CSS_LINE)
internal val CSS_LINE = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None)
/** A <label>'s words (12.5 / 600, muted); the input inside one takes the same font in the text colour. */
internal val SHEET_LABEL = cssType(12.5f, 600, 18.125f, AMute)
internal val SHEET_IN_LABEL = cssType(12.5f, 600, 18.125f)
internal val SHEET_PLAIN = cssType(15f, 400, 21.75f)

private fun JsonObject.str(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.obj(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.flag(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.pairs(k: String) = getAsJsonArray(k)?.mapNotNull { e -> e.takeIf { it.isJsonArray }?.asJsonArray?.let { it[0].asString to it[1].asString } }.orEmpty()

/**
 * app.js addSheet: "Add to collection" (the Cards tab's empty state, Got it on a wanted card, the card page's Add to collection)
 * and "Edit card" (a lot's Edit), in the site's #sheet. The engine holds the sheet's context and runs the site's own lookup
 * (A.addLookup), condition price (refreshConditionPrice) and save (saveLot, A.addDelete); this draws the form as the live page
 * computes it. "Paste or upload a list" is the website's import (not native yet).
 */
@Composable
internal fun AddLotSheet(open: CollectionWrites.AddOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val model by produceState<JsonObject?>(null, open.id) {
        val r = CollectionWrites.addModel(context, open.req)
        val err = r?.str("error").orEmpty()
        when { r == null -> onClose(); err.isNotEmpty() -> { CollectionWrites.show(err); onClose() }; else -> value = r }
    }
    val m = model ?: return
    // app.js closeSheet: the engine lets go of this sheet's context (a save or lookup still running for it then stops).
    DisposableEffect(m) { val id = m.get("ctx")?.asInt ?: 0; onDispose { CollectionWrites.addClosed(id) } }
    AddLotForm(m, open, backdrop, onClose)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AddLotForm(m: JsonObject, open: CollectionWrites.AddOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uri = LocalUriHandler.current
    val editing = m.flag("editing")
    val loc = m.obj("location") ?: JsonObject()
    var name by remember { mutableStateOf(m.str("name")) }
    var qty by remember { mutableStateOf(m.str("qty")) }
    var finish by remember { mutableStateOf(m.str("finish")) }
    var condition by remember { mutableStateOf(m.str("condition")) }
    var language by remember { mutableStateOf(m.str("language")) }
    var picker by remember { mutableStateOf(loc.str("selected")) }
    var location by remember { mutableStateOf(loc.str("input")) }
    var locShown by remember { mutableStateOf(false) }
    var locPlaceholder by remember { mutableStateOf(loc.str("placeholder")) }
    var locHint by remember { mutableStateOf(loc.str("hint")) }
    var locFocus by remember { mutableIntStateOf(0) }
    var set by remember { mutableStateOf(m.str("set")) }
    var number by remember { mutableStateOf(m.str("number")) }
    var printOpen by remember { mutableStateOf(m.flag("printOpen")) }
    var customOpen by remember { mutableStateOf(true) }
    var value by remember { mutableStateOf(m.str("value")) }
    var valueHint by remember { mutableStateOf("Enter custom value (optional)") }
    var preview by remember { mutableStateOf(m.obj("preview")) }
    var previewText by remember { mutableStateOf(if (m.obj("preview") == null) m.str("empty") else "") }
    var canSave by remember { mutableStateOf(m.flag("canSave")) }
    var error by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var blocks by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    val gen = remember { intArrayOf(0) }

    fun form() = JsonObject().apply {
        addProperty("name", name); addProperty("qty", qty); addProperty("value", value); addProperty("set", set); addProperty("number", number)
        addProperty("finish", finish); addProperty("language", language); addProperty("condition", condition); addProperty("location", location); addProperty("picker", picker)
    }
    // refreshConditionPrice: painted at once, then again when the feed answers; only the newest ask paints.
    fun price(retry: Boolean = false) {
        val g = ++gen[0]; val f = form()
        scope.launch {
            CollectionEngine.addPrice(f, retry) { r ->
                val b = r.getAsJsonArray("blocks")?.mapNotNull { it.takeIf { e -> e.isJsonObject }?.asJsonObject }.orEmpty()
                if (g == gen[0] && b.isNotEmpty()) { blocks = b; valueHint = r.str("placeholder") }
            }
        }
    }
    LaunchedEffect(Unit) { price() }
    // A.addLookup: the name looked up; a different card clears the printing; the price follows either way.
    fun lookup() {
        val n = name.trim(); if (n.isEmpty()) return
        error = ""; preview = null; previewText = "Looking up…"; value = ""
        scope.launch {
            val r = CollectionEngine.addLookup(n)
            val e = r.str("error")
            if (e.isNotEmpty()) { preview = null; previewText = ""; error = e; canSave = false }
            else { if (r.flag("clearPrint")) { set = ""; number = "" }; name = r.str("name"); preview = r.obj("preview"); previewText = ""; canSave = true }
            price()
        }
    }
    // saveLot (A.addSave, A.addSaveRaw): busy on the gold button; the site's words under the form when it can't save.
    fun save(unverified: Boolean) {
        if (saving) return
        saving = true
        scope.launch {
            val e = CollectionWrites.addSave(context, form().apply { addProperty("unverified", unverified) })
            saving = false
            if (e != null) error = e
        }
    }
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
    // The selects' change: the custom value is cleared and the price asked again.
    fun changed() { value = ""; price() }

    SiteSheet(m.str("title"), backdrop, onClose) { vw ->
        val one = vw <= 480.dp
        if (!editing) {
            Spacer(Modifier.height(12.dp))
            Seg { open.onList?.invoke(); onClose() }
            Spacer(Modifier.height(12.dp))
        } else Spacer(Modifier.height(10.dp))
        // .searchbar: the name and Look up, 8 apart.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FormInput(name, { name = it }, SHEET_PLAIN, "Card name, e.g. Sol Ring", Modifier.weight(1f), desc = "Card name", ime = ImeAction.Search, onGo = ::lookup)
            SiteGhost("Look up", h = 44.dp, fs = 15f, pad = 16.dp) { lookup() }
        }
        // #addPreview: the card, a line of words, or nothing (its 10 margins collapse with the search bar's and the grid's).
        Spacer(Modifier.height(10.dp))
        preview?.let { Preview(it); Spacer(Modifier.height(10.dp)) }
        if (preview == null && previewText.isNotEmpty()) { Text(previewText, style = cssType(13f, 400, 18.85f, AMute)); Spacer(Modifier.height(10.dp)) }
        // .grid2: Copies and Finish, Condition and Language (one column up to 480 wide), then where it lives across both.
        Pair2(one, { md -> FormLabeled("Copies", md) { FormInput(qty, { qty = it }, SHEET_IN_LABEL, desc = "Copies", keyboard = KeyboardType.Number) } },
            { md -> FormLabeled("Finish", md) { FormSelect(m.pairs("finishes"), finish, SHEET_IN_LABEL, desc = "Finish") { finish = it; changed() } } })
        Spacer(Modifier.height(10.dp))
        Pair2(one, { md -> FormLabeled("Condition", md) { FormSelect(m.pairs("conditions"), condition, SHEET_IN_LABEL, desc = "Condition") { condition = it; changed() } } },
            { md -> FormLabeled("Language", md) { FormSelect(m.pairs("languages"), language, SHEET_IN_LABEL, desc = "Language") { language = it; changed() } } })
        Spacer(Modifier.height(10.dp))
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(loc.str("label"), style = cssType(13f, 600, 18.85f, AMute))
            FormSelect(loc.pairs("options"), picker, SHEET_PLAIN, minH = 46.dp, desc = loc.str("label")) { chooseLocation(it) }
            if (locShown) {
                val focus = remember { FocusRequester() }
                FormInput(location, { location = it.take(100) }, SHEET_PLAIN, locPlaceholder, Modifier.focusRequester(focus), minH = 46.dp,
                    desc = if (picker == "binder:new") "New binder name" else "New location name")
                LaunchedEffect(locFocus) { runCatching { focus.requestFocus() } }
            }
            Text(locHint, style = cssType(11f, 400, 15.95f, AMute))
        }
        Spacer(Modifier.height(12.dp))
        FormMore("Exact printing (optional)", printOpen, { printOpen = !printOpen }) {
            Spacer(Modifier.height(10.dp))
            Pair2(one, { md -> FormLabeled("Set code", md) { FormInput(set, { set = it; changed() }, SHEET_IN_LABEL, "e.g. CMM", desc = "Set code") } },
                { md -> FormLabeled("Collector #", md) { FormInput(number, { number = it; changed() }, SHEET_IN_LABEL, desc = "Collector #") } })
            Spacer(Modifier.height(10.dp))
            Text("Leave blank if unsure — CardStashy never guesses an edition.", style = cssType(13f, 400, 18.85f, AMute))
        }
        Spacer(Modifier.height(12.dp))
        ConditionPrice(blocks, vw, onRetry = { price(true) }, onBuy = { u -> runCatching { uri.openUri(u) } })
        Spacer(Modifier.height(12.dp))
        FormMore("Custom value (optional)", customOpen, { customOpen = !customOpen }) {
            FormLabeled("Your value per copy (USD, optional)", Modifier.fillMaxWidth()) {
                FormInput(value, { value = it; price() }, SHEET_IN_LABEL, valueHint, desc = "Your value per copy (USD, optional)", keyboard = KeyboardType.Decimal)
            }
            Spacer(Modifier.height(10.dp))
            Text("Your custom value is used for your collection total. Clear it to use the source value. Played or damaged copies without a quote or custom value are excluded from totals.",
                style = cssType(12f, 400, 17.4f, AFoot))
        }
        Spacer(Modifier.height(12.dp))
        // #addError, then .actions: the gold save (busy while it saves), Save without lookup, and Delete when editing.
        if (error.isNotEmpty()) { Text(error, style = cssType(13f, 400, 18.85f, ABad)); Spacer(Modifier.height(10.dp)) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            val enabled = canSave && !saving
            FormGold(if (saving) "Saving…" else m.str("save"), enabled) { save(false) }
            FormLink("Save without lookup", Site.Gold) { save(true) }
            if (editing) FormLink("Delete", ABad) { scope.launch { CollectionWrites.act(context, "addDelete", JsonObject()) } }
        }
    }
}

/** ui.js segmented("addMode"): One card (the gold glide) and Paste or upload a list. */
@Composable
private fun Seg(onList: () -> Unit) {
    val pal = LocalSheetPal.current
    Row(Modifier.fillMaxWidth().siteGlassField(999.dp).padding(5.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        listOf("one" to "One card", "list" to "Paste or upload a list").forEach { (k, label) ->
            val on = k == "one"
            Box(Modifier.weight(1f).heightIn(min = 44.dp).then(if (on) Modifier.siteGoldGlide(pal) else Modifier).clip(RoundedCornerShape(999.dp))
                .clickable { if (!on) onList() }.semantics { role = Role.Tab; selected = on }.padding(horizontal = 6.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                Text(label, style = cssType(13.5f, 650, 19.575f, if (on) pal.ink else AMute, -.135f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** addPreview: the small picture (70 across, 6 corners) and the name, type line and reference price on --surface. */
@Composable
private fun Preview(p: JsonObject) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(ASurface).padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        // img[data-tier]: a 2 ring inside the picture in --tier (t0's own grey), t3-t5 glowing 0 0 12 -3 in it.
        val key = p.str("tierKey"); val ring = if (key == "t0") Color(0xFF8B939C) else cssColor(p.str("tier"), AInk).takeIf { key.isNotEmpty() }
        Box(Modifier.width(70.dp).aspectRatio(488f / 680f).then(if (ring != null && key in setOf("t3", "t4", "t5")) Modifier.drawBehind {
            drawRoundRect(androidx.compose.ui.graphics.Brush.radialGradient(listOf(ring.copy(alpha = .55f), Color.Transparent), center, size.maxDimension * .62f),
                androidx.compose.ui.geometry.Offset(-6.dp.toPx(), -6.dp.toPx()), Size(size.width + 12.dp.toPx(), size.height + 12.dp.toPx()), CornerRadius(8.dp.toPx()))
        } else Modifier)) {
            CardPicture(p.str("img").ifEmpty { null }, null, null, Modifier.matchParentSize(), RoundedCornerShape(6.dp))
            if (ring != null) Box(Modifier.matchParentSize().border(2.dp, ring, RoundedCornerShape(6.dp)))
        }
        Column(Modifier.weight(1f)) {
            Text(p.str("name"), style = cssType(15f, 700, 21.75f))
            Spacer(Modifier.height(6.dp)); Text(p.str("type"), style = cssType(13f, 400, 18.85f, AMute))
            Spacer(Modifier.height(6.dp)); Text(p.str("line"), style = cssType(13f, 400, 18.85f))
            Spacer(Modifier.height(6.dp))
        }
    }
}

/** #sheetBody .grid2's pair: side by side, 10 apart; one over the other up to 480 wide. */
@Composable
private fun Pair2(one: Boolean, a: @Composable (Modifier) -> Unit, b: @Composable (Modifier) -> Unit) {
    if (one) Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.fillMaxWidth()); b(Modifier.fillMaxWidth()) }
    else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.weight(1f)); b(Modifier.weight(1f)) }
}

/** A <label> around its field: the words, 4, the field. */
@Composable
internal fun FormLabeled(label: String, modifier: Modifier, field: @Composable () -> Unit) =
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(label, style = SHEET_LABEL); field() }

/** An <input> on the glass field: 9 / 12 in, 11 corners, at least [minH] tall; Chrome's grey placeholder. */
@Composable
internal fun FormInput(value: String, onValue: (String) -> Unit, style: TextStyle, placeholder: String = "", modifier: Modifier = Modifier, minH: Dp = 44.dp,
                  desc: String = "", keyboard: KeyboardType = KeyboardType.Text, ime: ImeAction = ImeAction.Done, focus: FocusRequester? = null, onGo: () -> Unit = {}) {
    // style.css :focus-visible: a 2 gold ring, 2 outside the field, while it has the caret.
    var focused by remember { mutableStateOf(false) }
    BasicTextField(value, onValue, modifier.fillMaxWidth().then(if (focus != null) Modifier.focusRequester(focus) else Modifier).onFocusChanged { focused = it.isFocused }
        .drawBehind { if (focused) { val o = 3.dp.toPx(); drawRoundRect(Site.Gold, Offset(-o, -o), Size(size.width + o * 2, size.height + o * 2), CornerRadius(11.dp.toPx() + o), style = Stroke(2.dp.toPx())) } }
        .semantics { if (desc.isNotEmpty()) contentDescription = desc }, singleLine = true, textStyle = style,
        cursorBrush = SolidColor(Site.Gold), keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ime),
        keyboardActions = KeyboardActions(onSearch = { onGo() }, onDone = { onGo() }, onGo = { onGo() }),
        decorationBox = { inner ->
            Box(Modifier.fillMaxWidth().heightIn(min = minH).siteGlassField(11.dp).padding(horizontal = 13.dp, vertical = 10.dp), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty() && placeholder.isNotEmpty()) Text(placeholder, style = style.copy(color = APlaceholder), maxLines = 1, overflow = TextOverflow.Ellipsis)
                inner()
            }
        })
}

/** A <select> as glass-select.js draws it: the chosen option on the glass field and the arrow; a tap opens the list. */
@Composable
internal fun FormSelect(options: List<Pair<String, String>>, selected: String, style: TextStyle, minH: Dp = 44.dp, desc: String = "", onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(Modifier.fillMaxWidth().heightIn(min = minH).siteGlassField(11.dp).clip(RoundedCornerShape(11.dp)).clickable { open = true }
            .semantics { if (desc.isNotEmpty()) contentDescription = desc; stateDescription = options.firstOrNull { it.first == selected }?.second.orEmpty() }
            .padding(horizontal = 13.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(options.firstOrNull { it.first == selected }?.second.orEmpty(), Modifier.weight(1f), style = style, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Box(Modifier.size((style.fontSize.value * .6f).dp, (style.fontSize.value * .52f).dp).drawBehind {
                drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(0f, 0f); lineTo(size.width, 0f); lineTo(size.width / 2, size.height); close() }, Color(0xFFB4BAC6))
            })
        }
        DropdownMenu(open, { open = false }, containerColor = Color(0xFF1A1E26)) {
            options.forEach { (v, l) ->
                DropdownMenuItem(text = { Text(l, style = cssType(14f, if (v == selected) 700 else 400, 20f, if (v == selected) Site.Gold else AInk)) },
                    onClick = { open = false; if (v != selected) onPick(v) })
            }
        }
    }
}

/** details.more: a hairline, 10, the 44 summary (14 / 700, muted, no marker), then what it opens. */
@Composable
internal fun FormMore(title: String, open: Boolean, onToggle: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().drawBehind { drawRect(ALine, size = Size(size.width, 1.dp.toPx())) }.padding(top = 11.dp)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClick = onToggle).semantics { stateDescription = if (open) "Expanded" else "Collapsed" },
            verticalAlignment = Alignment.CenterVertically) { Text(title, style = cssType(14f, 700, 20.3f, AMute)) }
        if (open) content()
    }
}

/** .btn: the gold button, 44 tall, 11 corners, 15 / 700 on gold; [pad] in from its sides (17 with its 1 border); dimmed while it can't be used. */
@Composable
internal fun FormGold(label: String, enabled: Boolean = true, modifier: Modifier = Modifier, pad: Dp = 17.dp, onClick: () -> Unit) =
    Box(modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else .45f).clip(RoundedCornerShape(11.dp)).background(Site.Gold)
        .clickable(enabled = enabled, onClick = onClick).semantics { role = androidx.compose.ui.semantics.Role.Button }.padding(horizontal = pad, vertical = 4.dp), contentAlignment = Alignment.Center) {
        Text(label, style = cssType(15f, 700, 21.75f, Color(0xFF1B1406)), maxLines = 1)
    }

/** .link (small): 13 / 600 words, 4 above and below. */
@Composable
internal fun FormLink(label: String, color: Color, onClick: () -> Unit) =
    Text(label, Modifier.clip(RoundedCornerShape(6.dp)).clickable(onClick = onClick).padding(vertical = 4.dp), style = cssType(13f, 600, 18.85f, color))

/**
 * condition-value.js conditionPriceHtml in .condition-price-preview: the condition, the amount and its kind (or why there is
 * none), what it is, its dates, your value against the market, the last known quote or the reference, Refresh, TCGplayer.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ConditionPrice(blocks: List<JsonObject>, vw: Dp, onRetry: () -> Unit, onBuy: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().border(1.dp, ALine, RoundedCornerShape(14.dp)).padding(horizontal = 15.dp, vertical = 13.dp)
        .semantics { contentDescription = "Selected condition value" }) {
        blocks.forEachIndexed { i, b ->
            if (i > 0) Spacer(Modifier.height(4.dp))
            when (b.str("k")) {
                "label" -> Text(b.str("text"), style = cssType(12.5f, 400, 18.125f))
                "hero" -> {
                    // .condition-price-amount: clamp(1.75rem, 5vw, 2.2rem), 1.15, -.025em, tabular; the kind's pill (dashed when it's yours).
                    val fs = (vw.value * .05f).coerceIn(28f, 35.2f)
                    FlowRow(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        // A line box shorter than the font (1.15): CSS keeps it at 1.15 and lets the glyphs overflow it.
                        Box(Modifier.align(Alignment.CenterVertically).height((fs * 1.15f).dp), contentAlignment = Alignment.CenterStart) {
                            Text(b.str("amount"), Modifier.wrapContentHeight(unbounded = true), style = cssType(fs, 700, fs * 1.15f, AInk, -.025f * fs).copy(fontFeatureSettings = "tnum"))
                        }
                        Box(Modifier.align(Alignment.CenterVertically).clip(RoundedCornerShape(999.dp)).background(ASurface2)
                            .then(if (b.flag("custom")) Modifier.drawBehind {
                                val w = 1.dp.toPx()
                                drawRoundRect(ALine, topLeft = androidx.compose.ui.geometry.Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w),
                                    cornerRadius = CornerRadius(size.height / 2), style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3 * w, 3 * w))))
                            } else Modifier.border(1.dp, ALine, RoundedCornerShape(999.dp)))
                            .padding(horizontal = 9.dp, vertical = 5.dp)) {
                            Text(b.str("kind"), style = cssType(12f, 700, 17.4f))
                        }
                    }
                }
                "state" -> Text(b.str("text"), style = cssType(17.6f, 700, 25.5f))
                "desc" -> Text(b.str("text"), style = cssType(13f, 400, 18.85f, AMute))
                "meta" -> Text(b.str("text"), style = cssType(12.48f, 400, 18.1f, AMute))
                "compare" -> Column(Modifier.fillMaxWidth().padding(top = 8.dp).drawBehind { drawRect(ALine, size = Size(size.width, 1.dp.toPx())) }.padding(top = 11.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(b.str("b"), style = cssType(13.6f, 700, 19.7f, AMute))
                    Text(b.str("text"), style = cssType(12.48f, 400, 18.1f, AMute))
                }
                "ref" -> Column(Modifier.fillMaxWidth().padding(top = 12.dp).drawBehind { drawRect(ALine, size = Size(size.width, 1.dp.toPx())) }.padding(top = 11.dp)) {
                    Text(b.str("b"), style = cssType(12.5f, 700, 18.75f))
                    Text(b.str("text"), style = cssType(12.5f, 400, 18.75f))
                }
                "retry" -> { Spacer(Modifier.height(8.dp)); SiteGhost(b.str("text"), Modifier.fillMaxWidth(), h = 34.dp, fs = 13.5f, pad = 12.dp, onClick = onRetry) }
                "buy" -> SiteGhost(b.str("text"), Modifier.fillMaxWidth(), h = 34.dp, fs = 13.5f, pad = 12.dp) { onBuy(b.str("url")) }
            }
        }
    }
}
