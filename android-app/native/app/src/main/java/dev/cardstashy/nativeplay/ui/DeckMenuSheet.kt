package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.focusable
import androidx.compose.foundation.indication
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

// style.css tokens, and .context-menu's own: --context-fill (the text at 4.5 %) and --context-line (at 9 %).
private val MText = Color(0xFFEEF0F4)
private val MMute = Color(0xFF9AA2B1)
private val MFoot = Color(0xFF8B93A3)
private val MLine = Color(0xFF2A2F39)
private val MBad = Color(0xFFF08A7E)
private val MFill = MText.copy(alpha = .045f)
private val MRule = MText.copy(alpha = .09f)

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
private fun JsonObject.svg(k: String) = CollectionCardsModel.svg(o(k))
/** selectOf's options as [value, label], and the chosen one. */
private fun JsonObject?.options() = this?.objs("options")?.map { it.s("value") to it.s("label") }.orEmpty()
private fun JsonObject?.chosen() = this?.objs("options")?.let { o -> (o.firstOrNull { it.b("on") } ?: o.firstOrNull())?.s("value") }.orEmpty()

/**
 * app.js A.deckMenu: a deck's ⋯ menu (style.css .context-menu in its dialog.sheet), from the site's own markup
 * (CollectionEngine.deckMenu). The deck box, kind, name and meta with the close; the four section shortcuts; Edit deck (name,
 * format, budget, focus, the deck box's colour and cover, Save changes); Share and export; Save a version, Duplicate, Refresh;
 * More deck tools (Assembled, then the playtest printing, the bought cards and the re-import); Delete; the list's source. The
 * saves are the site's handlers (CollectionWrites); Share opens the share sheet (CollectionShare); Copy to Play sends the list to
 * Play (Progress.saveDeck); Print playtest proxies opens the proxy page (ProxySheet) and Add deck to collection the acquire sheet
 * (AcquireSheet), Re-import the import sheet (DeckImportSheet).
 */
@Composable
internal fun DeckMenuSheet(o: CollectionWrites.DeckMenuOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val uri = LocalUriHandler.current
    val written by CollectionWrites.written.collectAsState()
    // The menu as the site draws it now (a save draws the sheet again: refreshSheet), the form keeping what was typed.
    val model by produceState<JsonObject?>(null, o.id, written) {
        val m = CollectionWrites.deckMenuModel(context, o.deck, o.game)
        if (m == null || m.b("missing")) { onClose(); return@produceState }
        value = m
    }
    val m = model ?: return
    // Controller: opened while a pad is here, the ring starts on the first shortcut, inside the sheet rather than on the page under it.
    val first = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (Pad.connected.value) runCatching { first.requestFocus() } }
    val edit = m.o("edit") ?: JsonObject()
    val box = edit.o("box") ?: JsonObject()
    val tools = m.o("tools")
    // A Yu-Gi-Oh! or Pokémon deck's menu (tcg.js A.tDeckMenu): its saves are tcg.js's handlers, told the game.
    val tcg = o.game != "mtg"
    var editOpen by remember(o.id) { mutableStateOf(false) }
    var boxOpen by remember(o.id) { mutableStateOf(false) }
    var toolsOpen by remember(o.id) { mutableStateOf(false) }
    var name by remember(o.id) { mutableStateOf(edit.s("name")) }
    var format by remember(o.id) { mutableStateOf(edit.s("format")) }
    var budget by remember(o.id) { mutableStateOf(edit.s("budget")) }
    var strategy by remember(o.id) { mutableStateOf(edit.o("strategy").chosen()) }
    var color by remember(o.id) { mutableStateOf(box.s("color")) }
    var image by remember(o.id) { mutableStateOf(box.o("image").chosen()) }
    var picking by remember(o.id) { mutableStateOf(false) }
    var refreshing by remember(o.id) { mutableStateOf(false) }
    var busy by remember(o.id) { mutableStateOf(false) }
    fun data(vararg p: Pair<String, Any>) = JsonObject().apply {
        addProperty("deck", o.deck); if (tcg) addProperty("game", o.game)
        p.forEach { (k, v) -> when (v) { is Boolean -> addProperty(k, v); is Number -> addProperty(k, v); else -> addProperty(k, v.toString()) } }
    }
    /** One save at a time from the menu (the site's buttons run once per tap). */
    fun save(kind: String, d: JsonObject, after: ((JsonObject) -> Unit)? = null) {
        if (busy) return
        busy = true
        scope.launch { try { CollectionWrites.act(context, kind, d, after) } finally { busy = false } }
    }
    fun press(a: JsonObject) {
        when (val act = a.s("act")) {
            // A.tileOpen: closeSheet, then the deck's section.
            "tileOpen" -> { onClose(); o.tab(a.s("tab")) }
            // A.deckCopy: copyText(exportDeckText(deck), "Decklist copied.").
            "deckCopy" -> scope.launch {
                val t = CollectionWrites.deckText(context, o.deck) ?: return@launch
                val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                cm.setPrimaryClip(android.content.ClipData.newPlainText("Decklist", t.s("text")))
                CollectionWrites.show("Decklist copied.")
            }
            // A.deckExport: download(`CardStashy_${fileSafe(name)}.txt`, exportDeckText(deck) + "\n"); the browser says where it went.
            "deckExport" -> scope.launch {
                val t = CollectionWrites.deckText(context, o.deck) ?: return@launch
                val file = t.s("file")
                runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { CollectionWrites.download(context.applicationContext, file, t.s("text") + "\n") } }
                    .onSuccess { CollectionWrites.show("Saved $file to Downloads.") }
                    .onFailure { CollectionWrites.show("Couldn’t save $file.") }
            }
            // A.snapshot: askText("Name this version", "Version N"), then the version (Cancel saves nothing).
            "snapshot" -> scope.launch {
                val label = CollectionWrites.askText("Name this version", m.s("version")) ?: return@launch
                save("snapshot", data("label" to label))
            }
            // A.deckDup: the copy, then closeSheet and its page.
            "deckDup" -> save("deckDup", data()) { r -> r.s("made").takeIf { it.isNotEmpty() }?.let { id -> onClose(); o.openDeck(id) } }
            // A.refreshDeck: busy(t, "Refreshing…") while the cards are looked up again.
            "refreshDeck" -> if (!refreshing) { refreshing = true; scope.launch { try { CollectionWrites.act(context, "refreshDeck", data()) } finally { refreshing = false } } }
            // A.deckDelete: ask first; then closeSheet and the decks.
            "deckDelete" -> save("deckDelete", data()) { onClose(); o.deleted() }
            // tcg.js A.tDeckCopy: copyText(listText(deck), "Decklist copied.").
            "tDeckCopy" -> scope.launch {
                val t = CollectionWrites.deckText(context, o.deck, o.game) ?: return@launch
                val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                cm.setPrimaryClip(android.content.ClipData.newPlainText("Decklist", t.s("text")))
                CollectionWrites.show("Decklist copied.")
            }
            // tcg.js A.tDeckExport: download(name.ydk or .txt, the game's exportText).
            "tDeckExport" -> scope.launch { exportTcgDeck(context, o.deck, o.game) }
            // tcg.js A.tDeckDup: the copy, then its page.
            "tDeckDup" -> save("tDeckDup", data()) { r -> r.s("made").takeIf { it.isNotEmpty() }?.let { id -> onClose(); o.openDeck(id) } }
            // tcg.js A.tDeckDelete: asked first; then the decks.
            "tDeckDelete" -> save("tDeckDelete", data()) { onClose(); o.deleted() }
            // A.deckShare / tcg.js A.tShare: the share sheet (CollectionShare).
            "deckShare", "tShare" -> { onClose(); o.share() }
            // A.proxies (data-scope "all"): the proxy sheet opens over the menu, as the site's new window does.
            "proxies" -> scope.launch { CollectionWrites.proxies(context, o.deck, a.s("scope").ifBlank { "all" }) }
            // A.importDeck (Re-import / replace list): deckImportSheet in the menu's place, offering to replace this deck.
            "importDeck" -> { onClose(); CollectionWrites.deckImport.value = CollectionWrites.DeckImportOpen(deck = o.deck,
                openDeck = { id, tab -> if (id == o.deck) o.tab(tab) else { deckOpensOn("mtg", id, tab); o.openDeck(id) } }, web = o.site) }
            // A.deckBought: acquireSheet("purchase") in the menu's place.
            "deckBought" -> { onClose(); CollectionWrites.acquiring.value = CollectionWrites.AcquireOpen(o.deck, "purchase") }
            // A.deckToPlay: signed in, the list goes to Play as a Play deck (playEcon.saveDeck); then closeSheet and its toast, or the error's words.
            "deckToPlay" -> {
                if (dev.cardstashy.nativeplay.account.Account.session.value?.userId == null) { CollectionWrites.show("Sign in to use Play."); return }
                if (busy) return
                busy = true
                scope.launch {
                    try {
                        val body = CollectionWrites.deckPlay(context, o.deck)?.takeIf { it.has("cards") } ?: return@launch
                        dev.cardstashy.nativeplay.play.Progress.saveDeck(body)
                        onClose(); CollectionWrites.show("Copied to your Play decks.")
                    } catch (e: kotlinx.coroutines.CancellationException) { throw e
                    } catch (e: Exception) { CollectionWrites.show(e.message?.takeIf { it.isNotBlank() } ?: "Could not copy to Play.")
                    } finally { busy = false }
                }
            }
            else -> { onClose(); o.web(act, a.s("scope")) }
        }
    }
    ContextMenuFrame(backdrop, onClose) { phone, vw ->
        Head(m.o("head") ?: JsonObject(), phone, onClose)
        // .context-shortcuts: four across, 8 apart; 16 under them.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            m.objs("shortcuts").forEachIndexed { i, a ->
                val shape = RoundedCornerShape(15.dp)
                Column(Modifier.weight(1f).heightIn(min = 74.dp).clip(shape).background(MFill).border(1.dp, MRule, shape).then(if (i == 0) Modifier.focusRequester(first) else Modifier).clickable { press(a) }
                    .semantics { role = Role.Button }.padding(horizontal = 3.dp, vertical = 11.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
                    SiteIcon(a.svg("icon"), 22.dp, Site.Gold)
                    Text(a.s("label"), style = cssType(11f, 500, 14.85f), textAlign = TextAlign.Center)
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        // details.context-edit: Edit deck.
        Panel(tag = "details-edit") {
            Summary(edit, editOpen, phone) { editOpen = !editOpen }
            if (editOpen) Column(Modifier.fillMaxWidth().padding(start = 15.dp, end = 15.dp, top = 1.dp, bottom = 15.dp)) {
                val labels = edit.strs("labels")
                val one = vw <= 480.dp
                // .grid2 (10 above and below; one column up to 480 wide): Name and Format across, Budget $ and Focus side by side.
                Column(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Labeled(labels.getOrElse(0) { "Name" }, Modifier.fillMaxWidth()) {
                        FormInput(name, { if (it.length <= edit.get("max").let { e -> e?.asInt ?: 100 }) name = it }, FIELD, desc = labels.getOrElse(0) { "Name" })
                    }
                    Labeled(labels.getOrElse(1) { "Format" }, Modifier.fillMaxWidth()) {
                        val groups = edit.objs("formats")
                        val opts = groups.flatMap { g -> g.get("options").asJsonArray.map { it.asJsonArray.let { p -> p[0].asString to p[1].asString } } }
                        val heads = groups.flatMap { g -> g.get("options").asJsonArray.mapIndexed { i, _ -> if (i == 0) g.s("group") else "" } }
                        FormSelect(opts, format, FIELD, desc = labels.getOrElse(1) { "Format" }, groups = heads) { format = it }
                    }
                    if (edit.o("strategy") != null) Pair2(one, { mod -> Labeled(labels.getOrElse(2) { "Budget $" }, mod) {
                        FormInput(budget, { v -> budget = v.filter { it.isDigit() || it == '.' } }, FIELD, desc = labels.getOrElse(2) { "Budget $" }, keyboard = KeyboardType.Number)
                    } }, { mod -> Labeled(labels.getOrElse(3) { "Focus" }, mod) {
                        FormSelect(edit.o("strategy").options(), strategy, FIELD, desc = labels.getOrElse(3) { "Focus" }) { strategy = it }
                    } })
                }
                Spacer(Modifier.height(12.dp))
                // details.deck-box-settings: 13 / 650 with its disclosure triangle.
                Column(Modifier.fillMaxWidth().testTag("deck-box-settings")) {
                Row(Modifier.fillMaxWidth().clickable { boxOpen = !boxOpen }.semantics { stateDescription = if (boxOpen) "Expanded" else "Collapsed" },
                    verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.width(14.dp).height(18.85.dp).drawBehind {
                        val u = 1.dp.toPx(); val cy = size.height / 2
                        val p = if (boxOpen) Path().apply { moveTo(0f, cy - 3.5f * u); lineTo(8.5f * u, cy - 3.5f * u); lineTo(4.25f * u, cy + 3.75f * u); close() }
                        else Path().apply { moveTo(.5f * u, cy - 4.25f * u); lineTo(7.75f * u, cy); lineTo(.5f * u, cy + 4.25f * u); close() }
                        drawPath(p, MText)
                    })
                    Text(box.s("summary"), style = cssType(13f, 650, 18.85f))
                }
                if (boxOpen) {
                    val bl = box.strs("labels")
                    Spacer(Modifier.height(12.dp))
                    Pair2(one, { mod -> Labeled(bl.getOrElse(0) { "Box color" }, mod) { ColorField(color, bl.getOrElse(0) { "Box color" }) { picking = true } } },
                        { mod -> Labeled(bl.getOrElse(1) { "Cover card" }, mod) {
                            FormSelect(box.o("image").options(), image, FIELD, desc = bl.getOrElse(1) { "Cover card" }) { image = it }
                        } })
                    Text(box.s("foot"), Modifier.padding(top = 10.dp, bottom = 6.dp), style = cssType(12f, 400, 17.4f, MFoot))
                }
                }
                Spacer(Modifier.height(12.dp))
                // .context-save: gold words on a 13 % gold wash, 44 tall, 11 corners.
                Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(11.dp)).background(Site.Gold.copy(alpha = .13f))
                    .clickable { if (tcg) save("tDeckSave", data("name" to name, "format" to format, "color" to color, "image" to image)) { onClose() }
                        else save("deckSaveInfo", data("name" to name, "format" to format, "budget" to budget, "strategy" to strategy, "color" to color, "image" to image)) { onClose() } }
                    .semantics { role = Role.Button }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                    Text(edit.s("save"), style = cssType(13f, 600, 18.85f, Site.Gold), maxLines = 1)
                }
            }
        }
        m.objs("groups").forEach { g ->
            Spacer(Modifier.height(12.dp))
            Panel(g.s("aria")) { g.objs("actions").forEachIndexed { i, a -> Action(a, phone, divider = i < g.objs("actions").size - 1, busyLabel = if (a.s("act") == "refreshDeck" && refreshing) "Refreshing…" else null) { press(a) } } }
        }
        // details.context-edit.context-tools: More deck tools (the Magic menu's alone).
        if (tools != null) { Spacer(Modifier.height(12.dp)); Panel(tag = "details-tools") {
            Summary(tools, toolsOpen, phone) { toolsOpen = !toolsOpen }
            if (toolsOpen) Column(Modifier.fillMaxWidth().padding(start = 15.dp, end = 15.dp, top = 1.dp, bottom = 15.dp)) {
                val lock = tools.o("lock") ?: JsonObject()
                var on by remember(o.id, lock.b("on")) { mutableStateOf(lock.b("on")) }
                // label.check.toggle: 12 above and below, a line under it, 4 more; the box, then the words (13 / 700 and 11 muted).
                Row(Modifier.fillMaxWidth().clickable { if (!busy) { on = !on; save("deckLock", data("checked" to on)) } }
                    .semantics(mergeDescendants = true) { role = Role.Checkbox; toggleableState = ToggleableState(on) }
                    .drawBehind { drawRect(MLine, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
                    .padding(top = 12.dp, bottom = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Check(on, Modifier.padding(start = 4.dp, end = 3.dp))
                    Column(Modifier.padding(start = 6.dp)) {
                        Text(lock.s("title"), style = cssType(13f, 700, 18.85f))
                        Text(lock.s("hint"), style = cssType(11f, 500, 15.95f, MMute))
                    }
                }
                Spacer(Modifier.height(4.dp))
                tools.objs("actions").forEach { a -> Action(a, phone, divider = false) { press(a) } }
            }
        } }
        // .context-danger: 16 above, the bad colour at 4 % and 12 %.
        Spacer(Modifier.height(16.dp))
        Panel(fill = MBad.copy(alpha = .04f), line = MBad.copy(alpha = .12f)) { m.objs("danger").forEach { a -> Action(a, phone, divider = false, color = MBad) { press(a) } } }
        val source = m.o("source")
        if (source != null) {
            // p.context-source.muted.small: 12 above (the group's margin), 6 below; the original list's link in gold.
            Spacer(Modifier.height(12.dp))
            val link = source.s("link")
            val words = buildAnnotatedString {
                append(source.s("text"))
                if (link.isNotEmpty()) { append(" · "); withStyle(SpanStyle(color = Site.Gold)) { append(source.s("linkText")) } }
            }
            Text(words, Modifier.fillMaxWidth().padding(horizontal = 4.dp).then(if (link.isNotEmpty()) Modifier.clickable { runCatching { uri.openUri(link) } } else Modifier),
                style = cssType(11f, 400, 15.95f, MMute))
            Spacer(Modifier.height(6.dp))
        } else Spacer(Modifier.height(12.dp))
    }
    if (picking) ColorPickerDialog(color, backdrop, onDone = { c -> picking = false; if (c != null) color = c })
}

/** The input inside a .context-edit-body label: 14 / 600 in the text colour. */
private val FIELD = cssType(14f, 600, 20.3f)

/** .context-edit-body label: its words (12 / 600, muted), 6, the field. */
@Composable
private fun Labeled(label: String, modifier: Modifier, field: @Composable () -> Unit) =
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(label, style = cssType(12f, 600, 17.4f, MMute)); field() }

/** #sheetBody .grid2's pair: side by side, 10 apart; one over the other up to 480 wide. */
@Composable
private fun Pair2(one: Boolean, a: @Composable (Modifier) -> Unit, b: @Composable (Modifier) -> Unit) {
    if (one) Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.fillMaxWidth()); b(Modifier.fillMaxWidth()) }
    else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { a(Modifier.weight(1f)); b(Modifier.weight(1f)) }
}

/** .context-head: the deck box (52 across), the kicker, name and meta, and the round close at the top. */
@Composable
private fun Head(h: JsonObject, phone: Boolean, onClose: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
        h.o("box")?.let { b -> Box(Modifier.width(52.dp), contentAlignment = Alignment.Center) { SiteDeckBox(b.strs("cards"), b.s("color"), !phone, Modifier, DpSize(48.dp, 58.dp)) } }
        Column(Modifier.weight(1f)) {
            Text(h.s("kind").uppercase(), Modifier.padding(bottom = 5.dp), style = cssType(10f, 700, 14.5f, MMute, 1.1f))
            val fs = if (phone) 17f else 18f
            Text(h.s("name"), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = fs.sp, lineHeight = (fs * 1.3f).sp,
                letterSpacing = (-.025f * fs).sp, color = MText, lineHeightStyle = CSS_LINE))
            if (h.s("meta").isNotEmpty()) Text(h.s("meta"), Modifier.padding(top = 5.dp), style = cssType(12f, 400, 16.8f, MMute))
        }
        val d = if (phone) 44.dp else 36.dp
        Box(Modifier.align(Alignment.Top).size(d).clip(CircleShape).background(MFill).clickable(onClick = onClose).semantics { contentDescription = "Close"; role = Role.Button },
            contentAlignment = Alignment.Center) { SiteIcon(h.svg("close"), 18.dp, MMute) }
    }
}

/** .context-group / .context-edit: the 17-cornered panel, the text at 4.5 % with a 9 % line. */
@Composable
private fun Panel(label: String = "", fill: Color = MFill, line: Color = MRule, tag: String = "", content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(17.dp)
    Column(Modifier.fillMaxWidth().then(if (tag.isNotEmpty()) Modifier.testTag(tag) else Modifier).clip(shape).background(fill).border(1.dp, line, shape).padding(1.dp)
        .then(if (label.isNotEmpty()) Modifier.semantics { contentDescription = label } else Modifier), content = content)
}

/** A details' summary: the icon, the title over its hint, and the chevron (turned over when open); 14 / 15 in, at least 54. */
@Composable
private fun Summary(s: JsonObject, open: Boolean, phone: Boolean, onToggle: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 54.dp).clickable(onClick = onToggle).semantics { stateDescription = if (open) "Expanded" else "Collapsed" }
        .padding(horizontal = 15.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        SiteIcon(s.svg("icon"), 20.dp, MMute)
        Column(Modifier.weight(1f)) {
            Text(s.s("title"), style = cssType(14f, 500, 20.3f))
            if (s.s("hint").isNotEmpty()) Text(s.s("hint"), style = cssType(11f, 400, 15.4f, MMute))
        }
        SiteIcon(s.svg("chev"), 15.dp, MMute, Modifier.rotate(if (open) 180f else 0f))
    }
}

/**
 * .context-action: the icon (20, muted), the label (14 / 500) over its hint (11, muted), 12 / 15 in, at least 48 tall (49 from 600);
 * in a group a line under each but the last, from 49 in to 15 from the end. [busyLabel]: busy()'s words in place of all of it.
 */
@Composable
private fun Action(a: JsonObject, phone: Boolean, divider: Boolean, color: Color = MText, busyLabel: String? = null, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = if (phone) 48.dp else 49.dp)
        .then(if (busyLabel != null) Modifier.alpha(.45f) else Modifier.clickable(onClick = onClick))
        .semantics { role = Role.Button }
        .drawBehind { if (divider) drawRect(MRule, Offset(49.dp.toPx(), size.height - 1.dp.toPx()), Size(size.width - 64.dp.toPx(), 1.dp.toPx())) }
        .padding(horizontal = 15.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        if (busyLabel != null) { Text(busyLabel, style = cssType(14f, 500, 18.9f, color)); return@Row }
        SiteIcon(a.svg("icon"), 20.dp, if (color == MText) MMute else color)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(a.s("label"), style = cssType(14f, 500, 18.9f, color))
            if (a.s("hint").isNotEmpty()) Text(a.s("hint"), style = cssType(11f, 400, 15.4f, MMute))
        }
    }
}

/** Chrome's checkbox in the dark scheme with accent-color gold: 18, 2 corners; grey when off, gold with a dark tick when on. */
@Composable
private fun Check(on: Boolean, modifier: Modifier) {
    Canvas(modifier.size(18.dp)) {
        val u = size.width / 18f
        if (on) {
            drawRoundRect(Site.Gold, cornerRadius = CornerRadius(2.5f * u))
            drawPath(Path().apply { moveTo(3.6f * u, 9.4f * u); lineTo(7.1f * u, 12.9f * u); lineTo(14.4f * u, 4.9f * u) }, Color(0xFF3B3B3B),
                style = Stroke(2.6f * u, cap = StrokeCap.Butt, join = StrokeJoin.Miter))
        } else {
            drawRoundRect(Color(0xFF3B3B3B), cornerRadius = CornerRadius(2.5f * u))
            drawRoundRect(Color(0xFF858585), topLeft = Offset(.5f * u, .5f * u), size = Size(size.width - u, size.height - u), cornerRadius = CornerRadius(2f * u), style = Stroke(u))
        }
    }
}

/** input[type=color] on the glass field: Chrome's swatch (2 / 4 in from the field's padding, a 1 grey edge) in the colour. */
@Composable
internal fun ColorField(color: String, desc: String, onPick: () -> Unit) {
    val c = cssColor(color, Color(0xFF7664A0)) ?: Color(0xFF7664A0)
    Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).siteGlassField(11.dp).clip(RoundedCornerShape(11.dp)).clickable(onClick = onPick)
        .semantics { contentDescription = desc; stateDescription = color; role = Role.Button }.padding(horizontal = 15.dp, vertical = 14.dp)) {
        Box(Modifier.fillMaxWidth().height(16.dp).background(c).border(1.dp, Color(0xFF777777)))
    }
}

/**
 * The frame of dialog.sheet:has(.context-menu): a floating glass card 8 from the bottom on a phone (the screen less 16, 480 at
 * most, 25 corners) and centred from 600 (520 at most, 26 corners), never past 92 % of the screen, the text at 15 % for its
 * edge, the page's own colour at 94 % over the app blurred 32 and saturated 1.25, and 0 28 90 #0005 under it. It springs in
 * like every #sheet. On a phone .context-menu::before is the 32 × 4 handle; a pull down on it closes the menu.
 */
@Composable
private fun ContextMenuFrame(backdrop: GraphicsLayer?, onClose: () -> Unit, content: @Composable ColumnScope.(phone: Boolean, vw: Dp) -> Unit) {
    val still = Motion.still
    val fade = remember { Animatable(if (still) 1f else 0f) }
    val y = remember { Animatable(if (still) 0f else 46f) }; val k = remember { Animatable(if (still) 1f else .985f) }; val a = remember { Animatable(if (still) 1f else .2f) }
    LaunchedEffect(Unit) {
        val e = CubicBezierEasing(.2f, .9f, .25f, 1.1f)
        launch { fade.animateTo(1f, tween(300, easing = CubicBezierEasing(0f, 0f, .58f, 1f))) }
        launch { y.animateTo(0f, keyframes { durationMillis = 420; 46f at 0 using e; -4f at 252 using e }) }
        launch { k.animateTo(1f, keyframes { durationMillis = 420; .985f at 0 using e; 1.002f at 252 using e }) }
        a.animateTo(1f, keyframes { durationMillis = 420; .2f at 0 using e; 1f at 252 using e })
    }
    BackHandler(onBack = onClose)
    // Controller: B closes the menu; the page under it lends no buttons while it is up.
    PadScreen(PadActs(b = "Close", opaque = true))
    val dim = rememberGraphicsLayer(); val frost = rememberGraphicsLayer()
    val sheetBox = remember { arrayOf(Rect.Zero) }
    val glass = backdrop != null && android.os.Build.VERSION.SDK_INT >= 31
    val scroll = rememberScrollState()
    val dens = androidx.compose.ui.platform.LocalDensity.current
    // Taller than the screen allows, #sheetBody (92dvh) overflows the sheet (92dvh with its border) by 2, and the dialog opens
    // scrolled to that end: the menu's first 2 px sit under the sheet's top edge.
    LaunchedEffect(Unit) {
        val max = androidx.compose.runtime.snapshotFlow { scroll.maxValue }.first { it != Int.MAX_VALUE }
        if (max > 0) scroll.scrollTo(minOf(max, with(dens) { 2.dp.roundToPx() }))
    }
    BoxWithConstraints(Modifier.fillMaxSize()
        .drawBehind {
            // body.glass dialog.sheet::backdrop { background: rgba(4, 5, 8, .45); backdrop-filter: blur(3px) }, fading in.
            if (backdrop != null && backdrop.size.width > 0) {
                dim.renderEffect = androidx.compose.ui.graphics.BlurEffect(3.dp.toPx(), 3.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                dim.alpha = fade.value
                dim.record(backdrop.size) { drawLayer(backdrop) }
                drawLayer(dim)
            }
            drawRect(Color(0x73040508), alpha = fade.value)
        }
        .pointerInput(Unit) { detectTapGestures { onClose() } }
        .imePadding()) {
        val phone = maxWidth < 600.dp
        val vw = maxWidth
        val shape = RoundedCornerShape(if (phone) 25.dp else 26.dp)
        val navBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
        Box(Modifier.align(if (phone) Alignment.BottomCenter else Alignment.Center)
            .padding(bottom = if (phone) maxOf(8.dp, navBottom) else 0.dp)
            .width(if (phone) minOf(480.dp, maxWidth - 16.dp) else minOf(520.dp, maxWidth - 32.dp))
            .heightIn(max = maxHeight * .92f)
            .graphicsLayer { translationY = y.value * density; scaleX = k.value; scaleY = k.value; alpha = a.value }
            .onGloballyPositioned { sheetBox[0] = it.boundsInRoot() }
            .cssShadow(Color(0x55000000), 90.dp, 28.dp, 0.dp, if (phone) 25.dp else 26.dp)
            .clip(shape)
            .drawBehind {
                if (glass) {
                    frost.renderEffect = frostEffect(32.dp.toPx(), 1.25f)
                    frost.record(backdrop!!.size) { drawLayer(backdrop) }
                    val r = sheetBox[0]
                    translate(-r.left, -r.top) { drawLayer(frost) }
                    drawRect(Site.Bg.copy(alpha = .94f))
                } else drawRect(Site.Bg)
                // inset 0 1px 0 #ffffff0d
                drawRect(Color(0x0DFFFFFF), topLeft = Offset(0f, 1.dp.toPx()), size = Size(size.width, 1.dp.toPx()))
            }
            .border(1.dp, MText.copy(alpha = .15f), shape)
            .pointerInput(Unit) { detectTapGestures { } }) {
            Column(Modifier.fillMaxWidth().verticalScroll(scroll).padding(1.dp)
                .padding(start = if (phone) 16.dp else 22.dp, end = if (phone) 16.dp else 22.dp, top = if (phone) 11.dp else 22.dp, bottom = if (phone) 16.dp else 22.dp)) {
                if (phone) Box(Modifier.fillMaxWidth().padding(bottom = 17.dp).pointerInput(Unit) {
                    var pulled = 0f
                    detectDragGestures(onDragStart = { pulled = 0f }, onDragEnd = { if (pulled > 60.dp.toPx()) onClose() }) { _, d -> pulled += d.y }
                }, contentAlignment = Alignment.Center) {
                    Box(Modifier.size(32.dp, 4.dp).clip(RoundedCornerShape(4.dp)).background(MText.copy(alpha = .2f)))
                }
                content(phone, vw)
            }
        }
    }
}

/**
 * input[type=color]'s picker, which the browser draws (Chrome on Android: "Select color", its eight suggestions, the hue, saturation
 * and value bars, Cancel and Set), here in the app's dialog card. [onDone]: the colour as #rrggbb, or null.
 */
@Composable
internal fun ColorPickerDialog(color: String, backdrop: GraphicsLayer?, onDone: (String?) -> Unit) {
    val start = cssColor(color, Color(0xFF7664A0)) ?: Color(0xFF7664A0)
    val hsv = remember { FloatArray(3).also { android.graphics.Color.colorToHSV(android.graphics.Color.rgb((start.red * 255).toInt(), (start.green * 255).toInt(), (start.blue * 255).toInt()), it) } }
    var h by remember { mutableStateOf(hsv[0]) }; var s by remember { mutableStateOf(hsv[1]) }; var v by remember { mutableStateOf(hsv[2]) }
    fun hex(hh: Float, ss: Float, vv: Float) = "#%06x".format(android.graphics.Color.HSVToColor(floatArrayOf(hh, ss, vv)) and 0xFFFFFF)
    val now = Color(android.graphics.Color.HSVToColor(floatArrayOf(h, s, v)))
    BackHandler { onDone(null) }
    // Controller: B cancels (the BackHandler); the ring starts on the first suggestion. The scrim and the card's tap-catcher are no d-pad stops.
    PadScreen(PadActs(b = "Cancel", opaque = true))
    val first = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (Pad.connected.value) runCatching { first.requestFocus() } }
    val blur = rememberGraphicsLayer()
    BoxWithConstraints(Modifier.fillMaxSize()
        .drawBehind {
            if (backdrop != null && backdrop.size.width > 0) {
                blur.renderEffect = androidx.compose.ui.graphics.BlurEffect(6.dp.toPx(), 6.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                blur.record(backdrop.size) { drawLayer(backdrop) }
                drawLayer(blur)
            }
            drawRect(Color(0x8C06080C))
        }
        .focusProperties { canFocus = false }.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onDone(null) }) {
        val phone = maxWidth <= 520.dp
        val bottom = if (phone) 16.dp + WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() else 0.dp
        val shape = RoundedCornerShape(20.dp)
        Column(Modifier.align(if (phone) Alignment.BottomCenter else Alignment.Center).padding(bottom = bottom).width(minOf(420.dp, maxWidth - 32.dp))
            .clip(shape).background(Site.Surface2.copy(alpha = .92f)).border(1.dp, Site.Line, shape)
            .focusProperties { canFocus = false }.clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
            .padding(start = 20.dp, end = 20.dp, top = 22.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Select color", style = cssType(16f, 600, 23.2f))
            // Chrome's suggestions: red, cyan, blue, green, magenta, yellow, black, white.
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf(0xFFFF0000, 0xFF00FFFF, 0xFF0000FF, 0xFF00FF00, 0xFFFF00FF, 0xFFFFFF00, 0xFF000000, 0xFFFFFFFF).forEachIndexed { i, c ->
                    Box(Modifier.size(32.dp).clip(CircleShape).background(Color(c)).border(1.dp, Color(0x55FFFFFF), CircleShape).then(if (i == 0) Modifier.focusRequester(first) else Modifier).clickable {
                        val f = FloatArray(3); android.graphics.Color.colorToHSV(c.toInt(), f); h = f[0]; s = f[1]; v = f[2]
                    })
                }
            }
            Box(Modifier.fillMaxWidth().height(36.dp).clip(RoundedCornerShape(10.dp)).background(now).border(1.dp, Color(0xFF777777), RoundedCornerShape(10.dp))
                .semantics { contentDescription = hex(h, s, v) })
            Bar("Hue", h / 360f, Brush.horizontalGradient((0..6).map { Color(android.graphics.Color.HSVToColor(floatArrayOf(minOf(it * 60f, 359.9f), 1f, 1f))) })) { h = minOf(it * 360f, 359.9f) }
            Bar("Saturation", s, Brush.horizontalGradient(listOf(Color(android.graphics.Color.HSVToColor(floatArrayOf(h, 0f, v))), Color(android.graphics.Color.HSVToColor(floatArrayOf(h, 1f, v)))))) { s = it }
            Bar("Value", v, Brush.horizontalGradient(listOf(Color.Black, Color(android.graphics.Color.HSVToColor(floatArrayOf(h, s, 1f)))))) { v = it }
            Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                val btn = if (phone) Modifier.weight(1f) else Modifier.width(96.dp)
                val r = RoundedCornerShape(11.dp)
                Box(btn.defaultMinSize(minWidth = 96.dp, minHeight = 44.dp).clip(r).background(Color(0x851F232B)).border(1.dp, Color(0x31EDC980), r)
                    .clickable { onDone(null) }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) { Text("Cancel", style = cssType(15f, 700, 21.75f), textAlign = TextAlign.Center) }
                Box(btn.defaultMinSize(minWidth = 96.dp, minHeight = 44.dp).clip(r).background(Site.Gold)
                    .clickable { onDone(hex(h, s, v)) }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) { Text("Set", style = cssType(15f, 700, 21.75f, Site.GoldInk), textAlign = TextAlign.Center) }
            }
        }
    }
}

/** One of the picker's bars: its name, the track in its colours, and the thumb; a tap or a drag sets it (0 to 1). */
@Composable
private fun Bar(label: String, at: Float, track: Brush, onAt: (Float) -> Unit) {
    // Controller: the bar is a d-pad stop with the gold ring; left and right move it a twentieth, as a tap there would set it.
    val src = remember { MutableInteractionSource() }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = cssType(12f, 600, 17.4f, MMute))
        Box(Modifier.fillMaxWidth().height(28.dp).semantics { contentDescription = label; stateDescription = "${(at * 100).toInt()} %" }
            .onKeyEvent { e -> val d = when (e.nativeKeyEvent.keyCode) { android.view.KeyEvent.KEYCODE_DPAD_LEFT -> -.05f; android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> .05f; else -> 0f }
                if (d == 0f) false else { if (e.type == KeyEventType.KeyDown) onAt((at + d).coerceIn(0f, 1f)); true } }
            .indication(src, PadFocus.Ring).focusable(interactionSource = src)
            .pointerInput(Unit) { detectTapGestures { p -> onAt((p.x / size.width).coerceIn(0f, 1f)) } }
            .pointerInput(Unit) { detectDragGestures { c, _ -> onAt((c.position.x / size.width).coerceIn(0f, 1f)) } }
            .drawBehind {
                val th = 12.dp.toPx(); val top = (size.height - th) / 2
                drawRoundRect(track, Offset(0f, top), Size(size.width, th), CornerRadius(th / 2))
                val x = at.coerceIn(0f, 1f) * size.width
                drawCircle(Color.White, 11.dp.toPx(), Offset(x.coerceIn(11.dp.toPx(), size.width - 11.dp.toPx()), size.height / 2))
                drawCircle(Color(0x66000000), 11.dp.toPx(), Offset(x.coerceIn(11.dp.toPx(), size.width - 11.dp.toPx()), size.height / 2), style = Stroke(1.dp.toPx()))
            })
    }
}

/** tcg.js A.tDeckExport: the game's own export (Yu-Gi-Oh! .ydk, Pokémon .txt) saved to Downloads, as the site's download does. */
internal suspend fun exportTcgDeck(context: android.content.Context, deck: String, game: String) {
    val t = CollectionWrites.deckText(context, deck, game) ?: return
    val file = t.s("file")
    runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { CollectionWrites.download(context.applicationContext, file, t.s("export")) } }
        .onSuccess { CollectionWrites.show("Saved $file to Downloads.") }
        .onFailure { CollectionWrites.show("Couldn’t save $file.") }
}
