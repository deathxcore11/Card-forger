package dev.cardstashy.nativeplay.ui

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
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.RandomBuild
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Collection › Decks' Random Commander and Random deck: deck-experience.js's Build a deck, as the site runs it in its #sheet. The site's
 * own code runs in the phone's WebView (deck-flow-entry.mjs: its setup and result markup read back as data, its pipeline building the
 * deck at Chrome's speed), and this draws them: the card, Format (or Commander's lock), Theme, Budget, Preferences and Generate deck;
 * "Your deck is being built" with the pipeline's live line; then the result: deckShell's hero, the notes before Save, Save deck (to My
 * decks, synced like every Collection save), Rebuild with budget, the cards in the player's deck view, Edit choices, Export list and
 * "Deck plan, checks & pricing". Not here yet: the result's AI review (the site's coach panel), which goes with the AI tools.
 */
internal interface BuildFlowEngine {
    /** False when this phone can't run the builder (the website's Build a deck opens instead). */
    suspend fun ready(): Boolean
    suspend fun call(name: String, a: JsonObject): RandomBuild.Flow
    fun cancel()
    val status: StateFlow<String>
}

/** The real one: the WebView (RandomBuild). */
internal object WebBuildFlow : BuildFlowEngine {
    override suspend fun ready() = RandomBuild.flowReady()
    override suspend fun call(name: String, a: JsonObject) = RandomBuild.flow(name, a)
    override fun cancel() = RandomBuild.flowCancel()
    override val status: StateFlow<String> get() = RandomBuild.flowStatus
}

// style.css tokens (dark), as the sheet computes them.
private val BInk = Color(0xFFEEF0F4)
private val BMute = Color(0xFF9AA2B1)
private val BFoot = Color(0xFF8B93A3)
private val BLine = Color(0xFF2A2F39)
private val BSurface = Color(0xFF171A20)
private val BSurface2 = Color(0xFF1F232B)
private val BWarn = Color(0xFFF2C66D)
private val BGlass = Color(0x851F232B)
private val BGlassLine = Color(0x31EDC980)

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean == true
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonObject }?.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
private fun obj(vararg kv: Pair<String, Any?>) = JsonObject().apply {
    kv.forEach { (k, v) -> when (v) { null -> {}; is String -> addProperty(k, v); is Boolean -> addProperty(k, v); is Number -> addProperty(k, v); is com.google.gson.JsonElement -> add(k, v) } }
}

/** deck-experience.js savePreferences: what Generate deck keeps for next time (budgetBasis, budgetMode, preferOwned, ownedOnly, easy). */
private const val PREFS = "deckFlowPrefs"
private val PREF_KEYS = listOf("budgetBasis", "budgetMode", "preferOwned", "ownedOnly", "easy")

/** The busy overlay (build-overlay.js): its title, note and the line it starts on; what Cancel build leaves. */
private class BuildBusy(val title: String, val note: String, val first: String, val cancelled: () -> Unit, val inSheet: Boolean)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CollectionBuildDeckSheet(open: CollectionWrites.BuildOpen, backdrop: GraphicsLayer?, onClose: () -> Unit, engine: BuildFlowEngine = WebBuildFlow,
                                      workspace: suspend (android.content.Context) -> String? = { CollectionWrites.flowWorkspace(it) },
                                      save: suspend (android.content.Context, JsonObject) -> Boolean = { c, d -> CollectionWrites.act(c, "deckGenerated", d) }) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    var setup by remember { mutableStateOf<JsonObject?>(null) }
    var result by remember { mutableStateOf<JsonObject?>(null) }
    var busy by remember { mutableStateOf<BuildBusy?>(null) }
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    /** deck-experience.js sequence: a newer step makes an older one's answer stale. */
    val token = remember { intArrayOf(0) }
    // The words typed in the Card name and Budget fields (read() takes them when a step starts).
    var seedText by remember { mutableStateOf("") }
    var budgetText by remember { mutableStateOf("") }
    var seedOpen by remember { mutableStateOf(false) }
    var prefsOpen by remember { mutableStateOf(false) }
    // The result's Rebuild: open, the amount, its status line.
    var rebuildOpen by remember { mutableStateOf(false) }
    var rebuildText by remember { mutableStateOf("") }
    var rebuildStatus by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    val live by engine.status.collectAsState()

    fun savedPrefs() = runCatching { prefs.getString(PREFS, null)?.let { JsonParser.parseString(it).asJsonObject } }.getOrNull() ?: JsonObject()
    fun showSetup(m: JsonObject?) {
        m ?: return
        setup = m; result = null
        seedText = m.o("seed")?.s("value").orEmpty(); budgetText = m.o("budget")?.s("value").orEmpty()
    }
    /** read(): the request with what was typed; a name that is not the shown card's drops the card (the pipeline looks the name up). */
    fun read(): JsonObject {
        val r = setup?.o("request")?.deepCopy() ?: JsonObject()
        r.addProperty("budget", budgetText)
        if (seedText != r.o("seedCard")?.s("name").orEmpty()) {
            r.addProperty("seed", seedText); r.add("seedCard", com.google.gson.JsonNull.INSTANCE); r.add("seedCards", JsonArray())
            r.add("ygoPurchaseSelections", JsonObject()); r.add("ptcgPurchaseSelections", JsonObject())
        }
        return r
    }
    suspend fun setupOf(r: JsonObject, status: String = "", error: Boolean = false) = engine.call("flowSetup", obj("request" to r, "status" to status, "error" to error)).obj
    /** A field changed: the request again, its message cleared (deck-experience.js showStatus). */
    fun change(edit: JsonObject.() -> Unit) {
        val r = read().apply(edit)
        scope.launch { setupOf(r)?.let { m -> setup = m } }
    }
    fun opened(r: JsonObject) = scope.launch { engine.call("flowOpen", obj("request" to r, "prefs" to savedPrefs())).obj?.let { showSetup(it) } }

    // A.flowRandom: "Choosing your card", then the setup around the new card.
    fun random() {
        val me = ++token[0]; val r = read()
        busy = BuildBusy("Choosing your card", "Finding a card for your selected format.", "Choosing a build-around…", inSheet = true,
            cancelled = { scope.launch { setupOf(r, "Selection cancelled. Your choices are unchanged.")?.let { showSetup(it) } } })
        scope.launch {
            val a = engine.call("flowRandom", obj("request" to r))
            if (me != token[0]) return@launch
            busy = null
            val m = a.obj
            when {
                a.error != null -> setupOf(r, a.error, true)?.let { showSetup(it) }
                m != null && !m.b("cancelled") -> showSetup(m)
            }
        }
    }
    // A.flowGenerate: the preferences kept, "Your deck is being built", then the result (or the setup with the site's message).
    fun generate() {
        val r = read()
        prefs.edit().putString(PREFS, JsonObject().apply { PREF_KEYS.forEach { k -> r.get(k)?.let { add(k, it) } } }.toString()).apply()
        val me = ++token[0]
        busy = BuildBusy("Your deck is being built", "Finding cards for your plan and checking the list. Your deck will open here when it’s ready.", "Finding a coherent plan…", inSheet = true,
            cancelled = { scope.launch { setupOf(r, "Build cancelled. Your choices are unchanged.")?.let { showSetup(it) } } })
        scope.launch {
            val a = engine.call("flowGenerate", obj("request" to r))
            if (me != token[0]) return@launch
            busy = null
            val m = a.obj
            when {
                a.error != null -> setupOf(r, a.error, true)?.let { showSetup(it) }
                m == null || m.b("cancelled") -> {}
                m.b("ok") -> { result = m.o("model"); rebuildOpen = false; rebuildText = ""; rebuildStatus = "" }
                else -> showSetup(m.o("setup"))
            }
        }
    }
    // A.flowAdjust: the amount checked first (customBudget's message under the field), then the rebuild over the result.
    fun rebuild() {
        val id = result?.s("id") ?: return; val amount = rebuildText
        scope.launch {
            val check = engine.call("flowBudget", obj("budget" to amount))
            if (check.error != null) { rebuildStatus = check.error; return@launch }
            val me = ++token[0]
            busy = BuildBusy("Your deck is being built", "Your updated deck will open here when it’s ready.", "Finding cards for your updated budget…", inSheet = false,
                cancelled = { rebuildStatus = "Rebuild cancelled. Your deck is unchanged." })
            val a = engine.call("flowAdjust", obj("id" to id, "budget" to amount))
            if (me != token[0]) return@launch
            busy = null
            val m = a.obj
            when {
                a.error != null -> rebuildStatus = a.error
                m == null || m.b("cancelled") -> {}
                m.b("ok") -> { result = m.o("model"); rebuildOpen = false; rebuildText = ""; rebuildStatus = "" }
                else -> rebuildStatus = m.s("message")
            }
        }
    }
    fun cancel() { val b = busy ?: return; token[0]++; engine.cancel(); busy = null; b.cancelled() }
    // A.flowSave: the site's check, then app.js save() through the Collection engine (it toasts "Saved to My decks."), then the button says so.
    fun saveDeck() {
        val id = result?.s("id") ?: return
        if (saving) return
        saving = true
        scope.launch {
            try {
                val d = engine.call("flowSaveData", obj("id" to id))
                val data = d.obj
                if (d.error != null || data == null) { CollectionWrites.show(d.error ?: "Rebuild before saving."); return@launch }
                if (save(context, data)) engine.call("flowSaved", obj("id" to id)).obj?.let { if (result?.s("id") == id) result = it }
            } finally { saving = false }
        }
    }
    // A.flowExport: download('CardStashy-deck.txt', the list); the browser says where it went.
    fun export() {
        val id = result?.s("id") ?: return
        scope.launch {
            val t = engine.call("flowExport", obj("id" to id))
            val text = t.obj?.s("text")
            if (text == null) { CollectionWrites.show(t.error ?: "This deck is no longer available."); return@launch }
            runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { CollectionWrites.download(context.applicationContext, "CardStashy-deck.txt", text) } }
                .onSuccess { CollectionWrites.show("Saved CardStashy-deck.txt to Downloads.") }
                .onFailure { CollectionWrites.show("Couldn’t save CardStashy-deck.txt.") }
        }
    }

    // open(): the workspace handed over, the setup for the button's request, then A.flowRandom at once (app.js A.randomDeck).
    LaunchedEffect(open.id) {
        if (!engine.ready()) { onClose(); open.web("https://cardstashy.com/#decks", "[data-act=\"${open.act}\"]"); return@LaunchedEffect }
        val ws = workspace(context) ?: run { onClose(); return@LaunchedEffect }
        engine.call("flowWorkspace", runCatching { JsonParser.parseString(ws).asJsonObject }.getOrDefault(JsonObject()))
        val m = engine.call("flowOpen", obj("request" to open.request, "prefs" to savedPrefs())).obj
        if (m == null) { CollectionWrites.show("Build a deck couldn’t open here."); onClose(); return@LaunchedEffect }
        showSetup(m)
        random()
    }
    // Closing stops what is building (the site's sequence moves on with the sheet gone).
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { if (busy != null) engine.cancel() } }

    CompositionLocalProvider(LocalSheetPal provides sheetPal(CardGame.MTG), LocalGameGold provides CardGame.MTG.gold) {
        Box(Modifier.fillMaxSize()) {
            val res = result
            SiteSheet(if (res != null) "" else setup?.s("title").orEmpty().ifBlank { "Build a deck" }, backdrop, onClose) { vw ->
                val b = busy
                when {
                    b != null && b.inSheet -> BuildPop(b, live, Modifier.padding(vertical = 24.dp)) { cancel() }
                    res != null -> FlowResult(res, vw, saving, rebuildOpen, rebuildText, rebuildStatus,
                        onBack = onClose, onSave = { saveDeck() }, onRebuildToggle = { rebuildOpen = !rebuildOpen }, onRebuildText = { rebuildText = it; rebuildStatus = "" },
                        onRebuild = { rebuild() }, onEdit = { res.o("request")?.let { opened(it) } }, onExport = { export() },
                        onCard = { name -> cards = cards + CardOpen(name, page = "https://cardstashy.com/#decks", tile = "") })
                    setup != null -> FlowSetup(setup!!, vw, seedText, seedOpen, budgetText, prefsOpen,
                        onSeedOpen = { seedOpen = !seedOpen }, onSeed = { seedText = it }, onRandom = { random() },
                        onAnyFormat = { change { addProperty("commanderLock", false) } },
                        onField = { k, v -> change { addProperty(k, v) } }, onCheck = { k, v -> change { addProperty(k, v) } },
                        onBudget = { budgetText = it; change { } }, onPrefs = { prefsOpen = !prefsOpen }, onGenerate = { generate() })
                    else -> BuildPop(BuildBusy("Build a deck", "", "Getting started…", {}, true), "", Modifier.padding(vertical = 24.dp), null)
                }
            }
            // A rebuild's overlay covers the page (build-overlay: fixed, dimmed and blurred).
            busy?.takeIf { !it.inSheet }?.let { b ->
                Box(Modifier.fillMaxSize().background(Color(0x9E06080C)).clickable(enabled = true, onClick = {}).padding(24.dp), contentAlignment = Alignment.Center) {
                    BuildPop(b, live, Modifier) { cancel() }
                }
            }
            cards.lastOrNull()?.let { c -> key(c) { CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = open.web) } }
        }
    }
}

// ---------------------------------------------------------------- build-overlay.js buildOverlay

/** build-overlay.js's pop-up for a build another page runs (the Ideas tab's Reading your collection, the idea sheet's Building this deck). */
@Composable
internal fun BuildOverlayPop(title: String, msg: String, note: String, modifier: Modifier = Modifier) = BuildPop(BuildBusy(title, note, msg, {}, true), msg, modifier, null)

/** .build-pop: the brand mark at work, the title, the live line in the accent, the note, Cancel build. */
@Composable
private fun BuildPop(b: BuildBusy, live: String, modifier: Modifier, onCancel: (() -> Unit)?) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 360.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(BSurface).border(1.dp, BLine, RoundedCornerShape(20.dp))
            .padding(start = 22.dp, end = 22.dp, top = 26.dp, bottom = 22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            BrandMark(88.dp, Modifier.padding(bottom = 6.dp))
            Text(b.title, style = cssType(17.25f, 700, 25f), textAlign = TextAlign.Center)
            // p[role=status]: the pipeline's own line as it builds (min-height 2.6em).
            Text(live.ifBlank { b.first }, Modifier.heightIn(min = 39.dp).semantics { contentDescription = live.ifBlank { b.first } },
                style = cssType(15f, 600, 19.5f, Site.Gold), textAlign = TextAlign.Center)
            if (b.note.isNotEmpty()) Text(b.note, style = cssType(13f, 400, 18.2f, BMute), textAlign = TextAlign.Center)
            if (onCancel != null) DeckGhost("Cancel build", minHeight = 44.dp, onClick = onCancel)
        }
    }
}

// ---------------------------------------------------------------- deckSetupMarkup

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowSetup(m: JsonObject, vw: Dp, seedText: String, seedOpen: Boolean, budgetText: String, prefsOpen: Boolean,
                      onSeedOpen: () -> Unit, onSeed: (String) -> Unit, onRandom: () -> Unit, onAnyFormat: () -> Unit,
                      onField: (String, String) -> Unit, onCheck: (String, Boolean) -> Unit, onBudget: (String) -> Unit, onPrefs: () -> Unit, onGenerate: () -> Unit) {
    val seed = m.o("seed") ?: JsonObject()
    val small = vw <= 600.dp
    Column(Modifier.fillMaxWidth()) {
        // details.deck-seed-picker: the card (or "Which card should your deck use?") and Change card; open, the Card name field.
        Column(Modifier.fillMaxWidth().padding(vertical = if (small) 6.dp else 12.dp)) {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onSeedOpen).semantics { contentDescription = "Choose the card for your deck"; stateDescription = if (seedOpen) "Expanded" else "Collapsed" },
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(if (small) 4.dp else 8.dp)) {
                val art = seed.s("art")
                if (art.isNotEmpty()) {
                    val p = heroPainter(homeArt(art))
                    val w = if (small) minOf(vw.value * .42f, 168f) else minOf(vw.value * .64f, 200f)
                    Box(Modifier.width(w.dp).aspectRatio(63f / 88f).clip(RoundedCornerShape(12.dp)).background(BSurface2)) {
                        if (p != null) Image(p, seed.s("name"), Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                    }
                    Text(seed.s("name"), style = cssType(17.25f, 700, 25f), textAlign = TextAlign.Center)
                } else Text(seed.s("empty"), Modifier.padding(horizontal = 12.dp, vertical = 32.dp), style = cssType(15f, 400, 21.75f, BMute), textAlign = TextAlign.Center)
                Text(seed.s("change"), style = cssType(13f, 400, 18.85f, BMute))
            }
            if (seedOpen) FormLabeled(seed.s("label"), Modifier.fillMaxWidth().padding(top = 10.dp)) {
                FormInput(seedText, onSeed, SHEET_IN_LABEL, seed.s("placeholder"), desc = seed.s("label"))
            }
        }
        m.s("required").takeIf { it.isNotEmpty() }?.let { Text(it, Modifier.padding(bottom = 8.dp), style = cssType(13f, 400, 18.85f, BMute)) }
        DeckGhost(m.s("random"), minHeight = 44.dp, pad = 14.dp, onClick = onRandom)
        // .deck-setup-fields: Format (or the lock), Theme, Budget; two columns from 421, the budget across.
        val one = vw <= 420.dp
        val fmt = m.o("format") ?: JsonObject()
        val formatField: @Composable (Modifier) -> Unit = { mod ->
            if (fmt.b("locked")) FlowRow(mod.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                Text(fmt.s("label"), style = cssType(15f, 400, 21.75f, BMute))
                Text(fmt.s("value"), style = cssType(15f, 700, 21.75f))
                DeckGhost(fmt.s("other"), minHeight = 44.dp, pad = 14.dp, onClick = onAnyFormat)
            } else SelectField(fmt, mod) { onField("format", it) }
        }
        val theme = m.o("theme") ?: JsonObject()
        val themeField: @Composable (Modifier) -> Unit = { mod ->
            val t = theme.s("title").removeSuffix("optional").trim()
            Column(mod.padding(vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.Bottom) { Text(t, style = SHEET_LABEL); Text("optional", Modifier.padding(start = 4.dp), style = cssType(12.5f, 400, 18.125f, BMute)) }
                FormSelect(theme.objs("options").map { it.s("value") to it.s("label") }, theme.objs("options").firstOrNull { it.b("on") }?.s("value").orEmpty(), SHEET_IN_LABEL, desc = t) { onField("theme", it) }
            }
        }
        Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
            if (one) { formatField(Modifier.fillMaxWidth()); themeField(Modifier.fillMaxWidth()) }
            else Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) { formatField(Modifier.weight(1f)); themeField(Modifier.weight(1f)) }
            val bud = m.o("budget") ?: JsonObject()
            FormLabeled(bud.s("label"), Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                FormInput(budgetText, onBudget, SHEET_IN_LABEL, bud.s("placeholder"), desc = bud.s("label"), keyboard = KeyboardType.Decimal)
                bud.s("note").takeIf { it.isNotEmpty() }?.let { Text(it, style = cssType(12f, 400, 18f, BMute)) }
            }
        }
        // details.settings-disclosure: Preferences.
        val p = m.o("prefs") ?: JsonObject()
        FormMore(p.s("title"), prefsOpen, onPrefs) {
            Column(Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
                listOf("matchMode" to "matchLabel", "budgetMode" to "ruleLabel", "budgetBasis" to "coversLabel").forEach { (k, label) ->
                    p.o(k)?.let { sel -> SelectField(sel, Modifier.fillMaxWidth(), p.s(label)) { onField(k, it) } }
                }
                p.objs("checks").forEach { c ->
                    CheckRow(c.s("label"), c.b("on")) { onCheck(c.s("field"), it) }
                }
                Text(p.s("foot"), Modifier.padding(top = 6.dp), style = cssType(12.5f, 400, 18.125f, BFoot))
            }
        }
        Spacer(Modifier.height(12.dp))
        FormGold(m.s("generate"), modifier = Modifier.fillMaxWidth(), onClick = onGenerate)
        val status = m.s("status")
        if (status.isNotEmpty()) Text(status, Modifier.padding(top = 8.dp).semantics { contentDescription = status },
            style = cssType(13f, 400, 18.85f, if (m.b("error")) BWarn else BMute))
    }
}

/** A <label class="field"> with its <select> (the site's words above, glass-select's list). */
@Composable
private fun SelectField(sel: JsonObject, modifier: Modifier, label: String = sel.s("label"), onPick: (String) -> Unit) {
    val opts = sel.objs("options")
    FormLabeled(label, modifier.padding(vertical = 6.dp)) {
        FormSelect(opts.map { it.s("value") to it.s("label") }, opts.firstOrNull { it.b("on") }?.s("value").orEmpty(), SHEET_IN_LABEL, desc = label, onPick = onPick)
    }
}

/** label.check: the box and its words, 44 tall (.deck-flow .check). */
@Composable
private fun CheckRow(label: String, on: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { onChange(!on) }.semantics { role = Role.Checkbox; stateDescription = if (on) "Checked" else "Not checked" }
        .padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(18.dp).clip(RoundedCornerShape(4.dp)).background(if (on) Site.Gold else BSurface2).border(1.dp, if (on) Site.Gold else Color(0xFF6B7280), RoundedCornerShape(4.dp)),
            contentAlignment = Alignment.Center) {
            if (on) Box(Modifier.size(10.dp).drawBehind {
                val w = size.width; val h = size.height
                drawLine(Color(0xFF1B1406), Offset(w * .08f, h * .52f), Offset(w * .38f, h * .82f), 2.dp.toPx())
                drawLine(Color(0xFF1B1406), Offset(w * .38f, h * .82f), Offset(w * .94f, h * .18f), 2.dp.toPx())
            })
        }
        Text(label, style = cssType(13.5f, 500, 19.6f))
    }
}

// ---------------------------------------------------------------- deckResultMarkup

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowResult(m: JsonObject, vw: Dp, saving: Boolean, rebuildOpen: Boolean, rebuildText: String, rebuildStatus: String,
                       onBack: () -> Unit, onSave: () -> Unit, onRebuildToggle: () -> Unit, onRebuildText: (String) -> Unit, onRebuild: () -> Unit,
                       onEdit: () -> Unit, onExport: () -> Unit, onCard: (String) -> Unit) {
    val h = m.o("hero") ?: JsonObject()
    val reduced = Motion.still
    val eyebrow = buildList {
        h.s("badge").takeIf { it.isNotEmpty() }?.let { add(DeckEyebrow("chip", it, "", true, "", null, emptyList())) }
        h.s("format").takeIf { it.isNotEmpty() }?.let { add(DeckEyebrow("chip", it, "", false, "", null, emptyList())) }
        h.o("legality")?.let { add(DeckEyebrow("review", it.s("text"), "", false, it.s("level"), null, emptyList())) }
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(0.dp)) {
        DsHero(h.s("art").ifBlank { null }, emptyList(), "", eyebrow, h.s("title"), h.strs("line").joinToString("\n"),
            h.objs("stats").map { DeckStat(it.s("value"), it.s("label"), false, false, "", "") }, h.get("owned")?.takeIf { it.isJsonPrimitive }?.asFloat,
            wide = vw >= 700.dp, screen = vw, reduced = reduced, back = DsHeroButton(null, "Back", "←", onBack), more = null, onStat = {}, review = {})
        // .ds-lead: the caveats a player reads before saving.
        val lead = m.objs("lead")
        if (lead.isNotEmpty()) Column(Modifier.fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            lead.forEach { l ->
                val head = l.s("head"); val text = l.s("text")
                if (l.b("warn")) NoteWarn(if (head.isNotEmpty()) head else text, if (head.isNotEmpty()) text.split('\n') else emptyList())
                else Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (head.isNotEmpty()) Text(head, style = cssType(14f, 700, 20.3f))
                    text.split('\n').filter { it.isNotBlank() }.forEach { Text(it, style = cssType(13f, 400, 18.85f, if (head.isEmpty()) BMute else BInk)) }
                }
            }
        }
        // .ds-actions: Save deck (gold), Rebuild (ghost; open, the budget form on its own line below).
        val save = m.o("save") ?: JsonObject()
        val rb = m.o("rebuild") ?: JsonObject()
        Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val off = save.b("disabled") || saving
            Box(Modifier.weight(1f).alpha(if (off) .55f else 1f)) {
                DeckGold(if (saving) "Saving…" else save.s("label"), Modifier.fillMaxWidth(), minHeight = 46.dp, pad = 10.dp, onClick = { if (!off) onSave() })
            }
            DeckGhost(rb.s("summary"), Modifier.weight(1f), minHeight = 46.dp, pad = 10.dp, onClick = onRebuildToggle)
        }
        if (rebuildOpen) Column(Modifier.fillMaxWidth().padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            FormLabeled(rb.s("label"), Modifier.fillMaxWidth()) { FormInput(rebuildText, onRebuildText, SHEET_IN_LABEL, rb.s("placeholder"), desc = rb.s("label"), keyboard = KeyboardType.Decimal, onGo = onRebuild) }
            DeckGhost(rb.s("button"), Modifier.fillMaxWidth(), minHeight = 44.dp, onClick = onRebuild)
            if (rebuildStatus.isNotEmpty()) Text(rebuildStatus, Modifier.semantics { contentDescription = rebuildStatus }, style = cssType(13f, 400, 18.85f, BMute))
        }
        // p.foot: how the list was made.
        m.s("construction").takeIf { it.isNotEmpty() }?.let { Text(it, Modifier.padding(top = 14.dp), style = cssType(12.5f, 400, 18.125f, BFoot)) }
        // The loop and mechanic details.
        m.objs("extras").forEach { d -> Disclosure(d) }
        // deckViewer: the cards in the player's deck view (the same setting as a deck's page).
        FlowCards(m.objs("zones"), vw, onCard)
        // .sheet-actions: Edit choices, Export list.
        Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            DeckGhost(m.s("edit"), minHeight = 44.dp, pad = 14.dp, onClick = onEdit)
            DeckGhost(m.s("export"), minHeight = 44.dp, pad = 14.dp, onClick = onExport)
        }
        m.o("checks")?.let { Disclosure(it) }
    }
}

/** details.settings-disclosure: its summary, and its lines when open (a warning in amber). */
@Composable
private fun Disclosure(d: JsonObject) {
    var open by remember(d) { mutableStateOf(false) }
    FormMore(d.s("summary"), open, { open = !open }) {
        Column(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            d.objs("lines").forEach { l -> Text(l.s("text"), style = cssType(12.5f, 400, 18.125f, if (l.b("warn")) BWarn else BFoot)) }
        }
    }
}

/** One card row (.deck-compact-row) as the model has it. */
private class DeckLine(val index: Int, val qty: Int, val name: String, val category: String, val thumb: String, val image: String, val pills: List<String>, val price: String)

/**
 * deckViewer over the result's sections ("Main deck 100", "Sideboard 15"): Stacks (type piles of six), Art grid (the cards with
 * their names, pills and price under them), Names only, Detailed list (the thumbnail beside them), as deck-viewer.css draws each.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowCards(zones: List<JsonObject>, vw: Dp, onCard: (String) -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    var mode by remember { mutableStateOf(prefs.getString("deckView", null)?.takeIf { it in listOf("stacks", "gallery", "symbols", "compact") } ?: "gallery") }
    // .deck-view-toolbar: "Deck view" and the switch.
    Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("Deck view", style = cssType(13f, 400, 18.85f, BMute))
        FlowViewSwitch(mode) { mode = it; prefs.edit().putString("deckView", it).apply() }
    }
    val inner = vw - 32.dp
    for (z in zones) {
        val rows = z.objs("rows").map { r -> DeckLine(r.get("index")?.asInt ?: 0, r.get("qty")?.asInt ?: 1, r.s("name"), r.s("category"), r.s("thumb"), r.s("image"), r.strs("pills"), r.s("price")) }
        // .deck-flow-cards h3: the section and its count (muted), 16 / 700, 18 above.
        Row(Modifier.padding(top = 18.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(z.s("title"), style = cssType(16f, 700, 22f)); Text(z.s("count"), style = cssType(16f, 700, 22f, BMute))
        }
        when (mode) {
            "stacks" -> FlowStacks(rows, inner, onCard)
            "gallery" -> {
                // grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap 20 / 14.
                val cols = maxOf(1, ((inner.value + 14f) / (170f + 14f)).toInt())
                Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    rows.chunked(cols).forEach { line -> Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        line.forEach { r -> GalleryTile(r, Modifier.weight(1f)) { onCard(r.name) } }; repeat(cols - line.size) { Spacer(Modifier.weight(1f)) } } }
                }
            }
            "symbols" -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { rows.forEach { r -> NamesRow(r) { onCard(r.name) } } }
            else -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { rows.forEach { r -> DetailRow(r) { onCard(r.name) } } }
        }
    }
}

private val VIEWS = listOf("stacks" to "Stacks", "gallery" to "Art grid", "symbols" to "Names only", "compact" to "Detailed list")

/** .deck-view-switch: 44 square buttons in a glass tray, the chosen one gold. */
@Composable
private fun FlowViewSwitch(mode: String, onView: (String) -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    val gold = Site.Gold
    val on = androidx.compose.ui.graphics.lerp(BSurface2, gold, .18f)
    Row(Modifier.clip(shape).background(BGlass).border(1.dp, BGlassLine, shape).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for ((k, label) in VIEWS) {
            val sel = k == mode
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(9.dp)).then(if (sel) Modifier.background(on).border(1.dp, gold.copy(alpha = .35f), RoundedCornerShape(9.dp)) else Modifier)
                .clickable { if (!sel) onView(k) }.semantics { contentDescription = label; role = Role.RadioButton; stateDescription = if (sel) "Selected" else "" }, contentAlignment = Alignment.Center) {
                Icon(when (k) { "stacks" -> SiteIcons.ViewStacks; "gallery" -> SiteIcons.ViewGallery; "symbols" -> SiteIcons.ViewSymbols; else -> SiteIcons.ViewCompact }, 20.dp, if (sel) gold else BMute)
            }
        }
    }
}

/** The card's picture (63:88, contained, 5 % / 3.5 % corners) on --surface-2, or its name while it has none. */
@Composable
private fun CardPic(r: DeckLine, modifier: Modifier) {
    val p = heroPainter(homeArt(r.image.ifBlank { r.thumb }))
    Box(modifier.aspectRatio(63f / 88f).clip(RoundedCornerShape(8.dp)).background(BSurface2)) {
        if (p != null) Image(p, r.name, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
    }
}

/** The quantity on the art's corner ([data-deck-card]::after: "1×", 12 / 800 on dark glass). */
@Composable
private fun QtyBadge(qty: Int, modifier: Modifier) =
    Text("$qty×", modifier.clip(RoundedCornerShape(7.dp)).background(Color(0xE8141820)).border(1.dp, Color(0x60FFFFFF), RoundedCornerShape(7.dp)).padding(horizontal = 7.dp, vertical = 1.dp),
        style = cssType(12f, 800, 16.8f, Color.White))

/** .deck-compact-copy's pills (set · number, rarity, Commander): small muted tags. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Pills(pills: List<String>) {
    if (pills.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        pills.forEach { Text(it, Modifier.clip(RoundedCornerShape(6.dp)).background(BSurface2).padding(horizontal = 5.dp), style = cssType(11f, 600, 16f, BMute)) }
    }
}

@Composable
private fun GalleryTile(r: DeckLine, modifier: Modifier, onClick: () -> Unit) {
    Column(modifier.clickable(onClick = onClick).semantics { contentDescription = "${r.qty}× ${r.name}" }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth()) { CardPic(r, Modifier.fillMaxWidth()); QtyBadge(r.qty, Modifier.align(Alignment.TopEnd).padding(7.dp)) }
        Column(Modifier.padding(horizontal = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("${r.qty}× ${r.name}", style = cssType(13f, 700, 18f))
            Pills(r.pills)
            if (r.price.isNotEmpty()) Text(r.price, Modifier.padding(bottom = 8.dp), style = cssType(13f, 400, 18.85f, BMute))
        }
    }
}

@Composable
private fun NamesRow(r: DeckLine, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClick = onClick).drawBehind { drawRect(BLine, Offset(0f, size.height - 1f), Size(size.width, 1f)) }.padding(10.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text("${r.qty}× ${r.name}", Modifier.weight(1f), style = cssType(14f, 700, 20f))
    }
}

@Composable
private fun DetailRow(r: DeckLine, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).drawBehind { drawRect(BLine, Offset(0f, size.height - 1f), Size(size.width, 1f)) }.padding(vertical = 9.dp, horizontal = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        CardPic(r, Modifier.width(60.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("${r.qty}× ${r.name}", style = cssType(14f, 700, 20f))
            Pills(r.pills)
        }
        if (r.price.isNotEmpty()) Text(r.price, style = cssType(13f, 400, 18.85f, BMute))
    }
}

/** stackList: the rows by type in piles of six, each card showing a 38 strip (32 at 480 and under) above the next. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowStacks(rows: List<DeckLine>, inner: Dp, onCard: (String) -> Unit) {
    val order = listOf("Commander", "Creatures", "Planeswalkers", "Battles", "Instants", "Sorceries", "Artifacts", "Enchantments", "Lands")
    val groups = rows.groupBy { it.category.ifBlank { "Other" } }.toList().sortedBy { order.indexOf(it.first).let { i -> if (i < 0) 99 else i } }
    val small = inner <= 448.dp
    val gapIn = if (small) 10.dp else 16.dp
    val minCol = if (small) 128.dp else 168.dp
    val step = if (small) 32.dp else 38.dp
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        for ((cat, list) in groups) {
            val piles = list.chunked(6)
            val basis = if (small) piles.size * 158 - 10 else piles.size * 206 - 16
            val w = basis.toFloat().coerceAtMost(inner.value).coerceAtLeast(minOf(if (small) 128f else 174f, inner.value)).dp - 0.5.dp
            val cols = maxOf(1, ((w + gapIn) / (minCol + gapIn)).toInt())
            val pileW = (w - gapIn * (cols - 1)) / cols
            Column(Modifier.width(w), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(cat, style = cssType(15f, 750, 21f))
                    Text("${list.sumOf { it.qty }}", Modifier.clip(RoundedCornerShape(8.dp)).background(BSurface2).padding(horizontal = 7.dp, vertical = 2.dp), style = cssType(12f, 400, 16f, BMute))
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(gapIn), verticalArrangement = Arrangement.spacedBy(if (small) 18.dp else 20.dp), maxItemsInEachRow = cols) {
                    piles.forEach { pile ->
                        val cardH = pileW * (88f / 63f)
                        Box(Modifier.width(pileW).height(cardH + step * (pile.size - 1))) {
                            pile.forEachIndexed { i, r ->
                                Box(Modifier.offset(y = step * i).width(pileW).clickable { onCard(r.name) }.semantics { contentDescription = "${r.qty}× ${r.name}" }) {
                                    CardPic(r, Modifier.fillMaxWidth()); QtyBadge(r.qty, Modifier.align(Alignment.TopEnd).padding(7.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
