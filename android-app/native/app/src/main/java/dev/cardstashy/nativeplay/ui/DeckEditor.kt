package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.account.Decks as Workspace
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.focus.focusProperties
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.LandStyles
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.DeckEdit
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.SetFacts
import dev.cardstashy.nativeplay.play.Trunk
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.match.PowerTier
import dev.cardstashy.nativeplay.play.RandomBuild
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The Play deck editor: deckBuilderMarkup in play-econ-ui.js (craftPlan, packGoals, Craft all, Fill empty slots, copy list, the
 * grouped list with craft menus, free basics, the pool with Your cards / All cards), drawn as Deck Bench (specs/deck-editor-native.md):
 * the deck docked over the Trunk, built like Arena. Sideboard rows ride along untouched and are saved as they came.
 */
class EditorUi {
    var edit by mutableStateOf(DeckEdit.Edit(null, "", "Standard", emptyList()))
    var busy by mutableStateOf(false)
    /** Deck art dropped on an unsaved deck's header: kept (name, art) and saved with the deck. */
    var pendingCover by mutableStateOf<Pair<String, String>?>(null)
    var crafting by mutableStateOf(false)
    var armed by mutableStateOf(false)
    var filling by mutableStateOf(false)
    /** Commander: the commander picked from the slot (null: read off the list) and the picker's search, results and highlighted card. */
    var cmdr by mutableStateOf<String?>(null)
    var cmdrFind by mutableStateOf("")
    var cmdrHits by mutableStateOf<List<JsonObject>>(emptyList())
    var cmdrPick by mutableStateOf<String?>(null)
    /** Cards the player pinned "always include": Fill's engine must keep them (up to 8). */
    var pins by mutableStateOf<Set<String>>(emptySet())
    /** How many cards Fill may add that you would still craft (0: owned cards only). */
    var craftMax by mutableStateOf(0)
    val fillCraft get() = craftMax > 0
    /** The card whose Play card actions are open. */
    var holdName by mutableStateOf<String?>(null)
    /** Kept for the callers that open a saved deck as its list (the Bench always shows the Trunk under the deck). */
    var adding by mutableStateOf(true)
    var mode by mutableStateOf("mine")
    /** The Lands view (LandPicker.kt): the land shown, its order, the style tapped, how many show, a craft or pick on its way. */
    var landType by mutableStateOf("Forest")
    var landSort by mutableStateOf("recent")
    var landFocus by mutableStateOf("")
    var landLimit by mutableStateOf(60)
    var landBusy by mutableStateOf(false)
    /** Styles picked for this deck by land (they win over a precon row's own printing on save). */
    var lands by mutableStateOf<Map<String, String>>(emptyMap())
    /** The deck land row being restyled from the Lands tab (its land and printing, "" for none), if any. */
    var landHeld by mutableStateOf<Pair<String, String>?>(null)
    var sort by mutableStateOf("")
    var pool by mutableStateOf<List<JsonObject>>(emptyList())
    var poolBusy by mutableStateOf(false)
    var poolError by mutableStateOf("")
    var poolMore by mutableStateOf(false)
    var poolPage = 1
    var poolKey = ""
    val bench = BenchUi()
    /** The engine's read of the deck (random-build-entry.mjs benchContext) and the list it was read from. */
    var read by mutableStateOf<Pair<String, JsonObject>?>(null)
    /** Rename / Change format, from the ⋯ menu. */
    var sheet by mutableStateOf<String?>(null)
}

private val Ink get() = Site.Text
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
private val BASICS = listOf("Plains", "Island", "Swamp", "Mountain", "Forest")
private fun named(name: String, version: String) = "https://api.scryfall.com/cards/named?format=image&version=$version&exact=" + java.net.URLEncoder.encode(name, "UTF-8").replace("+", "%20")
private val POOL_TYPES = mapOf("Creatures" to "t:creature", "Spells" to "-t:creature -t:land", "Lands" to "t:land")
private fun JsonObject?.str(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
/** A card's colours (the front face's for double-faced cards), for the strip's wash and the colour filters. */
private fun colorsOf(card: JsonObject?): List<String> = (card?.get("colors") as? JsonArray ?: ((card?.get("card_faces") as? JsonArray)?.firstOrNull() as? JsonObject)?.get("colors") as? JsonArray)
    ?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()
/** Every colour of every face, for the colour filter: a double-faced card shows under its back face's colour too. */
private fun allColorsOf(card: JsonObject?): List<String> = ((card?.get("colors") as? JsonArray).orEmptyList() +
    ((card?.get("card_faces") as? JsonArray)?.flatMap { ((it as? JsonObject)?.get("colors") as? JsonArray).orEmptyList() } ?: emptyList())).distinct()
private fun JsonArray?.orEmptyList(): List<String> = this?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()

@Composable
fun DeckEditor(state: JsonObject, ui: EditorUi, onBack: () -> Unit, onCard: (CardPick) -> Unit, onPack: (String) -> Unit, toast: (String) -> Unit,
               onCardTab: (CardPick, String) -> Unit = { p, _ -> onCard(p) }, @Suppress("UNUSED_PARAMETER") nav: @Composable () -> Unit = {}) {
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val context = androidx.compose.ui.platform.LocalContext.current
    val e = ui.edit
    val b = ui.bench
    val trunk = remember(state) { Trunk.cards(state) }
    val owned = remember(trunk) { Trunk.byName(trunk) }
    val byName = remember(trunk) { trunk.flatMap { listOf(it.n.split(" // ")[0] to it, it.n to it) }.toMap() }
    val facts by CardFacts.cards.collectAsState()
    val factByName = remember(facts) { facts.values.flatMap { f -> val n = f.card.get("name")?.asString ?: ""; listOf(n to f, n.split(" // ")[0] to f) }.toMap() }
    fun fact(name: String): CardFacts.Fact? = byName[name]?.o?.let { facts[it] } ?: factByName[name]
    LaunchedEffect(trunk) { CardFacts.want(trunk.map { it.o to it.pid }) }
    LaunchedEffect(e.cards.map { it.name }) {
        CardFacts.want(e.cards.mapNotNull { c -> byName[c.name]?.let { it.o to it.pid } })
        CardFacts.wantNames(e.cards.map { it.name }.filter { byName[it] == null && !Decks.isBasicLand(it) })
    }
    val rarityOf = { n: String -> fact(n)?.card?.get("rarity")?.asString ?: byName[n]?.r ?: "" }
    val plan = DeckEdit.craftPlan(e.cards, owned, rarityOf, state.get("wallet") as? JsonObject)
    val planOf = plan.rows.associateBy { it.name }
    val nums = DeckEdit.numbers(e) { fact(it) }
    val sets by SetFacts.sets.collectAsState()
    val goals = DeckEdit.packGoals(plan) { n -> fact(n)?.card?.let { c -> val code = c.get("set")?.asString ?: ""; code to (sets[code]?.name ?: c.get("set_name")?.asString ?: code.uppercase()) } }
    fun setEdit(cards: List<DeckEdit.Line>) { ui.edit = e.copy(cards = cards, dirty = true) }
    /** The commander slot: the card goes first on the list as the one copy, and the deck takes its colours. */
    fun setCommander(name: String) {
        val rest = ui.edit.cards.filter { it.name != name }
        ui.cmdr = name; ui.edit = ui.edit.copy(cards = listOf(DeckEdit.Line(name, 1)) + rest, dirty = true)
    }
    fun stepCard(name: String, step: Int) = setEdit(DeckEdit.step(ui.edit.cards, name, step, ui.edit.format))
    fun idOf(name: String) = fact(name)?.card?.get("id")?.asString ?: ""
    suspend fun craftCopies(id: String, n: Int): Int { var made = 0; repeat(n) { if (runCatching { Progress.craft(id) }.isSuccess) made++ else return made }; return made }

    // Commander: the commander the slot holds, else the first legendary creature on the list (as before); null: none yet.
    val leader: String? = if (e.format != "Commander") null
        else ui.cmdr?.takeIf { n -> e.cards.any { it.name == n } }
            ?: e.cards.firstOrNull { c -> fact(c.name)?.let { f -> Regex("Legendary").containsMatchIn(f.t) && Regex("Creature").containsMatchIn(f.t) } == true }?.name
    // ---- pool (app.js poolQuery / loadPool), on the Bench's find, colour and type filters
    fun poolQuery(find: String = b.find, colors: Set<String> = b.colors, type: String = b.type, filter: BenchFilter = b.filter): String {
        val q = mutableListOf("legal:${ui.edit.format.lowercase()}", "game:paper")
        find.trim().replace(Regex("[\"\\\\]"), "").takeIf { it.isNotEmpty() }?.let { q += "name:\"$it\"" }
        if (colors.isNotEmpty()) q += colors.joinToString(" or ", "(", ")") { "c:" + it.lowercase() }
        POOL_TYPES[type]?.let { q += it }
        // The Filters panel's picks Scryfall can search itself (mana value, type, rarity, set); Does and copies are the Bench's own.
        q += BenchFilter.query(filter)
        leader?.let { fact(it) }?.let { q += CommanderFill.identityClause(it.k).trim() }
        return q.joinToString(" ")
    }
    fun loadPool(more: Boolean = false) {
        if (ui.mode != "all") return
        val key = poolQuery() + "|" + ui.sort
        if (ui.poolBusy && ui.poolKey == key && !more) return
        if (!more) { ui.poolKey = key; ui.pool = emptyList(); ui.poolPage = 1 }
        ui.poolBusy = true; ui.poolError = ""
        val order = when (ui.sort) { "name" -> "name"; "cmc" -> "cmc"; else -> "edhrec" }
        scope.launch {
            val r = CardFacts.search(poolQuery(), order, ui.poolPage)
            if (key != ui.poolKey) return@launch
            if (r == null) ui.poolError = "Check your connection and try again." else { ui.pool = ui.pool + r.first; ui.poolMore = r.second; ui.poolPage += 1 }
            ui.poolBusy = false
        }
    }
    // All cards with nothing typed is shelves (below); a search looks through every card, a page at a time.
    // Only the picks Scryfall searches ask again (BenchFilter.query); Does, copies and Not in this deck are read here.
    LaunchedEffect(ui.mode, b.find, b.colors, b.type, BenchFilter.query(b.filter), ui.edit.format) { if (ui.mode == "all" && b.find.isNotBlank()) { if (ui.poolKey.isNotEmpty()) delay(350); loadPool() } }
    // ---- All cards, shelf by shelf (AllShelves.kt): "For this deck" is Fill empty slots' own search (A.playFillSlots: the format's
    // most played cards, no lands) in the deck's colours, then a shelf per set with the pool's search, each loaded when it shows.
    val shelves = remember(ui) { MagicShelves(scope) }
    val shelfBase = poolQuery("", b.colors, b.type)
    // The deck's colours, worked out off the main thread (the facts map grows with every shelf that lands).
    val identity by androidx.compose.runtime.produceState<String?>(null, facts, e.cards) { value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { deckIdentity(e.cards.map { it.name }.filterNot(Decks::isBasicLand)) } }
    val shelfFit = poolQuery("", emptySet(), "All", BenchFilter()) + " -t:land" + (identity?.let { " id<=$it" } ?: "")
    LaunchedEffect(ui.mode, shelfBase, shelfFit) { if (ui.mode == "all") { shelves.use(shelfBase, shelfFit); shelves.start() } }
    // All cards: the next page comes in as the grid nears its end.
    // The pool's own size and busy flag are in the watch too: when the Bench's filters hide a whole page, the grid does not grow, and the next page still comes.
    LaunchedEffect(ui.mode) { if (ui.mode == "all") snapshotFlow { b.tileGrid.layoutInfo.let { listOf(it.visibleItemsInfo.lastOrNull()?.index, it.totalItemsCount, ui.pool.size, ui.poolBusy, ui.poolMore) } }
        .collect { (last, total) -> last as Int?; total as Int; if (last != null && total > 0 && last >= total - 6 && ui.poolMore && !ui.poolBusy) loadPool(true) } }

    // ---- the engine's read: Power, tier (Commander: bracket) and roles, a moment after the list stops changing
    val sig = e.format + "|" + e.cards.joinToString(";") { "${it.qty} ${it.name}" }
    LaunchedEffect(sig) {
        if (e.cards.isEmpty()) return@LaunchedEffect
        delay(900)
        val deck = JsonObject().apply { addProperty("name", e.name); addProperty("format", e.format)
            add("cards", com.google.gson.JsonArray().apply { DeckEdit.groups(e.cards) { fact(it) }.forEach { (_, rows) -> rows.forEach { r -> add(JsonObject().apply { addProperty("name", r.name); addProperty("qty", r.qty) }) } } }) }
        RandomBuild.benchEngine(e.format, deck)?.let { ui.read = sig to it }
    }
    val read = ui.read?.second
    val power = read?.get("power")?.takeIf { it.isJsonPrimitive }?.asDouble
    val bracket = read?.get("bracket")?.takeIf { it.isJsonPrimitive }?.asInt
    val cardRoles = read?.get("cards") as? JsonObject

    // ---- land styles (LandStyles.kt): owned looks per land, the one each land uses in this deck, New until looked at
    LaunchedEffect(Unit) { LandStyles.init(context); LandStyles.load() }
    val landData by LandStyles.data.collectAsState()
    val landError by LandStyles.error.collectAsState()
    val landSeen by LandStyles.seen.collectAsState()
    val styleRows = remember(state) { (state.get("styles") as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList() }
    LaunchedEffect(styleRows, landData) { if (landData != null) LandStyles.initSeen(styleRows) }
    val landOwned = remember(landData, styleRows, state) { landData?.let { d -> LandStyles.owned(d, styleRows, (state.get("cards") as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()) } ?: emptyMap() }
    val landChosen = remember(styleRows) { LandStyles.chosen(styleRows) }
    val landGot = remember(styleRows) { LandStyles.got(styleRows) }
    fun landNew(id: String) = landSeen?.let { seen -> id in landGot && id !in seen } ?: false
    fun landInUse(type: String): String = landData?.let { d -> LandStyles.inDeck(type, ui.lands[type] ?: e.cards.firstOrNull { it.name == type }?.extra?.str("id"), landOwned, landChosen, d.starter) } ?: ""
    fun openLands(type: String) { if (LandStyles.isType(type)) ui.landType = type; ui.landFocus = ""; ui.landLimit = 60; ui.mode = "lands"; ui.landHeld = null; b.peek = null }
    // A land row's own style (mixed land styles, Randall 17 Nov, preview https://claude.ai/artifact/EzrgZVY4D9Qb8Y1rPkDyQ5): its printing when
    // unlocked, else the deck's main style; a precon row (its set and number) keeps its own until that row is restyled (Set as main never touches it).
    fun landOf(l: DeckEdit.Line): String { val id = LandStyles.rowId(l)
        return if (id.isNotEmpty() && id in landOwned) id else if (id.isEmpty() && LandStyles.precon(l)) "" else landInUse(l.name) }
    // On save every basic row carries its own style's printing (a match shows each copy's art); rows of one style join.
    fun landRows(ed: DeckEdit.Edit): DeckEdit.Edit = if (landData == null) ed else ed.copy(cards = LandStyles.join(ed.cards.map { l ->
        if (!LandStyles.isType(l.name)) return@map l
        val id = landOf(l); if (id.isEmpty()) l else l.copy(extra = (l.extra?.deepCopy() ?: JsonObject()).apply { addProperty("id", id) }) }))
    // Rows of a land with no printing take the main style first, so a tap on the land bar and a drop of that style meet in one row.
    fun ownLandRows(cards: List<DeckEdit.Line>, type: String): List<DeckEdit.Line> { val main = landInUse(type); if (main.isEmpty()) return cards
        return LandStyles.join(cards.map { l -> if (l.name == type && LandStyles.rowId(l).isEmpty() && !LandStyles.precon(l)) l.copy(extra = (l.extra?.deepCopy() ?: JsonObject()).apply { addProperty("id", main) }) else l }) }
    fun addLand(id: String, quiet: Boolean = false) { val st = landData?.byId?.get(id) ?: return
        ui.edit = ui.edit.copy(cards = LandStyles.addRow(ownLandRows(ui.edit.cards, st.type), st.type, id).let { if (ui.lands[st.type] == id) LandStyles.mainFirst(it, st.type, id) else it }, dirty = true)
        b.pop = LandStyles.key(st.type, id); b.popAt = System.nanoTime()
        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.SegmentTick)
        if (!quiet) toast("+1 ${st.type}, ${st.set.uppercase()} ${st.num}") }
    // A step by name or by a land row's key: a land row steps alone; a basic by name (the land bar, the hold menu) adds its main style.
    fun stepAny(key: String, step: Int) {
        val lk = LandStyles.parseKey(key)
        when {
            lk != null -> { ui.edit = ui.edit.copy(cards = LandStyles.stepRow(ui.edit.cards, lk.first, lk.second, step), dirty = true)
                if (ui.landHeld == lk && ui.edit.cards.none { it.name == lk.first && LandStyles.rowId(it) == lk.second }) ui.landHeld = null }
            step > 0 && LandStyles.isType(key) && landInUse(key).isNotEmpty() -> addLand(landInUse(key), quiet = true)
            else -> stepCard(key, step)
        }
    }
    fun nameOf(key: String) = LandStyles.parseKey(key)?.first ?: key
    val landActs = LandActs(
        type = { t -> if (t != ui.landType) { ui.landType = t; ui.landFocus = ""; ui.landLimit = 60; ui.landHeld = null } },
        sort = { ui.landSort = it },
        focus = { id -> ui.landFocus = id; LandStyles.see(id) },
        // Set as main: only the land bar's style (and its row first, so the saved deck opens with it). Nothing else switches.
        use = { id -> val st = landData?.byId?.get(id)
            if (st != null) { val pinned = ownLandRows(ui.edit.cards, st.type); ui.lands = ui.lands + (st.type to id)
                ui.edit = ui.edit.copy(cards = LandStyles.mainFirst(pinned, st.type, id), dirty = true)
                haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.SegmentTick)
                toast("Main ${st.type}: ${st.set.uppercase()} ${st.num}") } },
        add = { id -> addLand(id) },
        restyle = { id -> val h = ui.landHeld; val st = landData?.byId?.get(id)
            if (h != null && st != null) { val n = ui.edit.cards.firstOrNull { it.name == h.first && LandStyles.rowId(it) == h.second }?.qty ?: 0
                ui.edit = ui.edit.copy(cards = LandStyles.restyle(ui.edit.cards, h.first, h.second, id), dirty = true); ui.landHeld = null; ui.landFocus = id
                haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.Confirm); toast("$n ${st.type} now ${st.set.uppercase()} ${st.num}") } },
        done = { ui.landHeld = null },
        craft = { id -> if (!ui.landBusy) { ui.landBusy = true
            scope.launch { val st = landData?.byId?.get(id)
                runCatching { Progress.landCraft(id) }.onSuccess { LandStyles.see(id); haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.Confirm)
                    toast(if (st != null) "${st.setName} ${st.type} unlocked." else "Land style unlocked.") }
                    .onFailure { f -> toast(when ((f as? Progress.Failure)?.code) { "no_seal" -> "Not enough seals."; "have_style" -> "Already yours."; else -> "That didn't go through. Try again." }) }
                ui.landBusy = false } } },
        all = { val type = ui.landType; val id = landInUse(type)
            if (id.isNotEmpty() && !ui.landBusy) { ui.landBusy = true
                scope.launch { val st = landData?.byId?.get(id)
                    runCatching { Progress.landStyle(id, true) }.onSuccess {
                        // Main in all my decks (Randall 17 Nov: nothing switches automatically): only the main changes, no row's style.
                        val pinned = ownLandRows(ui.edit.cards, type); ui.lands = ui.lands + (type to id)
                        ui.edit = ui.edit.copy(cards = LandStyles.mainFirst(pinned, type, id), dirty = true)
                        toast("Main $type in all your decks${if (st != null) ": ${st.set.uppercase()} ${st.num}" else ""}") }
                        .onFailure { toast("That didn't go through. Try again.") }
                    ui.landBusy = false } } },
        more = { ui.landLimit += 60 },
        // Duals: back to Your cards with only lands showing, so two-colour lands are added from the same place.
        duals = { b.filter = b.filter.copy(types = setOf("Land")); ui.mode = "mine" },
    )

    val actions = Actions(
        save = {
            if (ui.edit.cards.isNotEmpty() && !ui.busy) { ui.busy = true
                scope.launch { runCatching { Progress.saveDeck(DeckEdit.saveBody(landRows(ui.edit.copy(cards = ui.lands.entries.fold(ui.edit.cards) { c, (t, id) -> LandStyles.mainFirst(c, t, id) })))) }.onSuccess { d -> (d as? JsonObject)?.get("id")?.asString?.let { ui.edit = ui.edit.copy(id = it) }
                    ui.edit = ui.edit.copy(dirty = false)
                    val pend = ui.pendingCover; val sid = ui.edit.id
                    if (pend != null && sid != null) { val err = Workspace.setPlayDeckCover(context, sid, JsonObject().apply { addProperty("name", pend.first.take(200)); addProperty("image", pend.second.take(500)) })
                        if (err == null) ui.pendingCover = null }
                    toast("Saved to your Play decks.") }; ui.busy = false } }
        },
        craftAll = {
            if (!ui.crafting) {
                if (!ui.armed) { ui.armed = true; scope.launch { delay(5000); ui.armed = false } }
                else { ui.armed = false; ui.crafting = true
                    scope.launch {
                        val p = DeckEdit.craftPlan(ui.edit.cards, owned, rarityOf, state.get("wallet") as? JsonObject); var made = 0
                        try { for (r in p.rows) { val id = idOf(r.name); if (id.isNotEmpty() && r.now > 0) made += craftCopies(id, r.now) } } finally { ui.crafting = false }
                        toast(if (made > 0) "$made card${if (made > 1) "s" else ""} crafted.${if (made < p.missing) " Open packs or forge seals for the rest." else ""}" else "Not enough seals for these cards yet.")
                    } }
            }
        },
        craftCopies = { name, n -> val id = idOf(name)
            if (id.isEmpty()) toast("That card is still loading. Try again in a moment.")
            else scope.launch { val made = craftCopies(id, n); if (made > 0) toast("$made $name crafted into your Play collection.") else toast("Not enough seals for $name yet.") } },
        fill = {
            val size = Decks.deckRules(ui.edit.format).size; val need = size - ui.edit.cards.sumOf { it.qty }
            if (ui.edit.format == "Commander" && leader == null) { ui.cmdrPick = null; ui.sheet = "commander"; toast("Pick a commander first.") }
            else if (need >= 1 && !ui.filling) { ui.filling = true
                scope.launch {
                    val inDeck = ui.edit.cards.map { it.name.lowercase() }.toHashSet(); var failed = false
                    val adds = ArrayList<DeckEdit.Line>(); var owned0 = 0; var craft0 = 0; var craftLeft = ui.craftMax
                    fun have(n: String) = (owned[n] ?: owned[n.split(" // ")[0]] ?: 0) > 0
                    // One job at a time: its Scryfall search in the commander's colours, owned cards first, a card you would craft only when allowed.
                    suspend fun job(query: String, n: Int, plain: Boolean = false): Int {
                        if (n <= 0) return 0
                        val names = ArrayList<String>()
                        for (page in 1..2) { val r = CardFacts.search(query, "edhrec", page); if (r == null) { failed = failed || (page == 1 && adds.isEmpty()); break }
                            names += r.first.mapNotNull { it.get("name")?.asString }; if (!r.second) break }
                        val pick = CommanderFill.select(names, ::have, if (ui.edit.format != "Commander") Int.MAX_VALUE else craftLeft, inDeck, n)
                        pick.forEach { inDeck.add(it.lowercase()); adds += DeckEdit.Line(it, 1); if (have(it) || Decks.isBasicLand(it)) owned0++ else { craft0++; craftLeft-- } }
                        return pick.size
                    }
                    // Commander: the Build a deck engine first (around the commander and the pins, your own cards preferred); the job-by-job search is the fallback.
                    val viaEngine: Boolean = if (ui.edit.format != "Commander") false else run {
                        val lead = leader!!
                        val args = JsonObject().apply {
                            addProperty("format", "Commander"); addProperty("commander", lead); bracket?.let { addProperty("bracket", it) }
                            add("pins", com.google.gson.JsonArray().apply { ui.pins.filter { n -> ui.edit.cards.any { it.name == n } && n != lead }.take(8).forEach { add(it) } })
                            add("keep", com.google.gson.JsonArray().apply { ui.edit.cards.filter { it.name != lead && it.name !in ui.pins }.take(40).forEach { c -> add(JsonObject().apply { addProperty("name", c.name); addProperty("qty", c.qty) }) } })
                            add("collection", com.google.gson.JsonArray().apply { owned.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } })
                        }
                        val fl = RandomBuild.flow("flowFill", args)
                        val rows = (fl.obj?.get("rows") as? JsonArray)?.mapNotNull { it as? JsonObject }
                        if (rows == null) false else {
                            val fresh = rows.filter { r -> r.str("name").lowercase() !in inDeck && r.str("name") != lead }
                            val named = fresh.filter { !Decks.isBasicLand(it.str("name")) }
                            val picks = CommanderFill.select(named.map { it.str("name") }, ::have, craftLeft, inDeck, need)
                            picks.forEach { inDeck.add(it.lowercase()); adds += DeckEdit.Line(it, 1); if (have(it)) owned0++ else { craft0++; craftLeft-- } }
                            var room = need - picks.size
                            fresh.filter { Decks.isBasicLand(it.str("name")) }.forEach { r -> val q = minOf(room, r.get("qty")?.asInt ?: 1); if (q > 0) { adds += DeckEdit.Line(r.str("name"), q); room -= q; owned0 += q } }
                            true
                        }
                    }
                    if (viaEngine) { /* added above */ }
                    else if (ui.edit.format == "Commander") {
                        val idc = fact(leader!!)?.k
                        val base = poolQuery("", emptySet(), "All", BenchFilter()) + " -t:land"
                        val landsHave = ui.edit.cards.filter { Decks.isBasicLand(it.name) || fact(it.name)?.t?.contains("Land") == true }.sumOf { it.qty }
                        val p = CommanderFill.plan(need, landsHave)
                        var got = 0
                        got += job("$base otag:ramp", p.ramp); got += job("$base otag:draw", p.draw)
                        got += job("$base otag:removal", p.removal); got += job("$base otag:sweeper", p.sweepers)
                        val nonbasic = job(poolQuery("", emptySet(), "All", BenchFilter()) + " t:land -t:basic", p.nonbasic); got += nonbasic
                        got += job(base, need - got - (p.basics + (p.nonbasic - nonbasic)))
                        val basics = CommanderFill.basicsFor(idc, need - got)
                        basics.forEach { (nm, q) -> adds += DeckEdit.Line(nm, q); got += q }
                    } else {
                        job(poolQuery("", emptySet(), "All") + " -t:land", need)
                    }
                    if (adds.isNotEmpty()) ui.edit = ui.edit.copy(cards = ui.edit.cards + adds, dirty = true)
                    val added = adds.sumOf { it.qty }; val left = need - added
                    toast(if (failed) "Suggestions could not load. Check your connection."
                        else if (added == 0) "No suggestions found right now."
                        else "$added card${if (added > 1) "s" else ""} added: $owned0 you own${if (craft0 > 0) ", $craft0 to craft" else ""}." +
                            if (left > 0) " $left still open${if (!ui.fillCraft) ". Turn on Craft to fill them" else ""}." else "")
                    ui.filling = false
                } }
        },
        copy = { clipboard.setText(AnnotatedString(DeckEdit.copyList(ui.edit))); toast("Decklist copied.") },
        step = ::stepAny,
        open = { key -> val name = nameOf(key); onCard(CardPick(name, byName[name]?.o ?: fact(name)?.o ?: "", byName[name]?.pid ?: idOf(name).ifBlank { null }, "nonfoil")) },
        pack = onPack,
        // app.js playHoldMenu: Play's card actions (open it, its pack, its set, deck cover, artwork).
        hold = { key -> haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress); ui.holdName = nameOf(key) },
    )
    // app.js A.playEconToApp: the list as a new deck in My decks (Commander: its legendary single as commander).
    val toApp: () -> Unit = {
        val ed = ui.edit
        if (ed.cards.isNotEmpty()) scope.launch {
            val lead = if (ed.format == "Commander") ed.cards.firstOrNull { it.qty == 1 && it.name == leader } ?: ed.cards.firstOrNull { it.qty == 1 && Regex("Legendary").containsMatchIn(fact(it.name)?.t ?: "") } else null
            val d = JsonObject().apply {
                addProperty("id", java.util.UUID.randomUUID().toString()); addProperty("name", ed.name.ifBlank { "Play deck" }.take(100)); addProperty("format", ed.format.ifBlank { "Standard" })
                addProperty("commander", lead?.name ?: ""); addProperty("strategy", "Auto"); addProperty("budget", 0); addProperty("locked", false)
                add("cards", com.google.gson.JsonArray().apply {
                    ed.cards.filter { it !== lead }.forEach { c -> add(JsonObject().apply { addProperty("name", c.name); addProperty("qty", c.qty) }) }
                    ed.side.forEach { s -> val o = s.asJsonObject; add(JsonObject().apply { addProperty("name", o.str("name")); addProperty("qty", (o.get("qty")?.asDouble?.toInt() ?: 0).let { if (it == 0) 1 else it }); addProperty("zone", "side") }) }
                })
                add("versions", com.google.gson.JsonArray())
            }
            val err = Workspace.update(context) { decks -> decks.apply { add(d) } }
            toast(err ?: "Copied “${d.str("name")}” to My decks.")
        }
    }

    // ---- what the Bench shows
    val inDeck = remember(e.cards) { HashMap<String, Int>().apply { e.cards.forEach { c -> merge(c.name, c.qty, Int::plus); val front = c.name.split(" // ")[0]; if (front != c.name) merge(front, c.qty, Int::plus) } } }
    fun countIn(n: String) = inDeck[n] ?: inDeck[n.split(" // ")[0]] ?: 0
    val groups = DeckEdit.groups(e.cards) { fact(it) }.map { (g, rows) -> BenchGroup(g, rows.map { l -> val fx = fact(l.name); val pr = planOf[l.name]; val card = fx?.card
        // A basic is a row per style (mixed land styles): keyed by its land and printing, drawn in its own style's art.
        if (landData != null && LandStyles.isType(l.name)) { val id = landOf(l); val st = landData?.byId?.get(id)
            return@map BenchRow(l.name, l.qty, 0, "", if (id.isEmpty()) named(l.name, "art_crop") else LandStyles.image(id, "art_crop"), if (id.isEmpty()) named(l.name, "normal") else LandStyles.image(id),
                "", emptyList(), st?.set ?: "", st?.num ?: "", "", key = LandStyles.key(l.name, LandStyles.rowId(l)), ref = l.name) }
        BenchRow(l.name, l.qty, pr?.miss ?: 0, pr?.seal ?: "", fx?.a?.ifBlank { null } ?: named(l.name, "art_crop"), byName[l.name]?.pimage ?: fx?.i?.ifBlank { null } ?: named(l.name, "normal"),
            fx?.mc ?: "", colorsOf(card), card.str("set"), card.str("collector_number"), card.str("rarity"),
            (cardRoles?.get(l.name) as? JsonArray)?.mapNotNull { it.takeIf { r -> r.isJsonPrimitive }?.asString } ?: emptyList(), cmc = fx?.m ?: -1.0, pinned = l.name in ui.pins) }) }
    // Find, the colours and the Filters panel are the Bench's own now (BenchFilter.kt), read from each tile's facts below.
    fun keep(@Suppress("UNUSED_PARAMETER") name: String, @Suppress("UNUSED_PARAMETER") colors: List<String>, group: String): Boolean {
        return when (b.type) { "Creatures" -> group == "Creatures"; "Lands" -> group == "Lands"; "Spells" -> group != "Creatures" && group != "Lands"; else -> true }
    }
    fun poolTile(c: JsonObject): BenchTile { val n = c.str("name"); val have = owned[n] ?: owned[n.split(" // ")[0]] ?: 0
        val face = (c.get("card_faces") as? JsonArray)?.firstOrNull() as? JsonObject
        return BenchTile(n, (c.get("image_uris") as? JsonObject)?.str("normal")?.ifBlank { null } ?: (face?.get("image_uris") as? JsonObject)?.str("normal")?.ifBlank { null } ?: named(n, "normal"),
            c.get("cmc")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0, Trunk.group(c.str("type_line").ifBlank { face.str("type_line") }) == "Lands",
            Decks.isBasicLand(n), countIn(n), have, DeckEdit.room(e.cards, n, e.format), have == 0,
            colors = allColorsOf(c), typeLine = c.str("type_line").ifBlank { face.str("type_line") }, rarity = c.str("rarity"), set = c.str("set"), setName = c.str("set_name"),
            released = c.str("released_at"), card = c) }
    val tiles: List<BenchTile> = if (ui.mode == "all") ui.pool.map(::poolTile)
    else trunk.mapNotNull { c -> val fx = facts[c.o]; val g = Trunk.group(fx?.t ?: ""); val basic = Decks.isBasicLand(c.n); val q = countIn(c.n)
        if (basic && q == 0) return@mapNotNull null
        if (!keep(c.n, colorsOf(fx?.card), g)) return@mapNotNull null
        BenchTile(c.n, c.pimage ?: fx?.i?.ifBlank { null } ?: named(c.n, "normal"), fx?.m ?: 0.0, g == "Lands", basic, q, c.c, DeckEdit.room(e.cards, c.n, e.format), false,
            colors = allColorsOf(fx?.card), typeLine = fx?.t ?: "", rarity = c.r.ifBlank { fx?.card.str("rarity") }, set = Trunk.setOf(c).ifBlank { fx?.card.str("set") }, sets = c.s,
            setName = fx?.card?.takeIf { it.str("set") == Trunk.setOf(c) }.str("set_name"), released = fx?.card.str("released_at"), card = fx?.card) }
    val wallet = plan.have
    val model = BenchModel(
        play = true, modeChip = "Play deck", formatChip = "Magic · ${e.format}", title = e.name.ifBlank { "New Play deck" },
        heroArt = ui.pendingCover?.second?.takeIf { e.id == null } ?: Workspace.playDeckCovers.collectAsState().value.let { Workspace.pickedCover(e.id) } ?: fact(e.cards.firstOrNull { !Decks.isBasicLand(it.name) }?.name ?: "")?.a,
        stats = listOf(BenchStat("${nums.count}/${nums.size}", "cards", warn = !nums.ok), BenchStat("${nums.count - plan.missing}/${nums.count}", "unlocked")),
        power = power?.let { "${it.roundToInt()}" }, tier = if (e.format == "Commander" && bracket != null) PowerTier.bracketLabel(bracket) else PowerTier.powerTier(power),
        roles = (read?.get("roles") as? JsonArray)?.mapNotNull { (it as? JsonArray)?.takeIf { r -> r.size() >= 2 && r[0].isJsonPrimitive && r[1].isJsonPrimitive }?.let { r -> r[0].asString to r[1].asInt } } ?: emptyList(),
        groups = groups, basics = BASICS.map { t -> t to (landInUse(t).ifEmpty { null }?.let { LandStyles.image(it, "art_crop") } ?: named(t, "art_crop")) }, browserTitle = "Trunk", tiles = tiles,
        browserNote = if (ui.mode == "all") (if (ui.poolBusy) "Looking through every card…" else if (ui.poolError.isNotEmpty()) ui.poolError else null)
            else if (trunk.isEmpty()) "No cards yet. Open packs, or look through All cards and craft them with seals." else null,
        footLead = buildAnnotatedString { if (plan.missing > 0) { withStyle(SpanStyle(color = Site.Text, fontWeight = FontWeight.Bold)) { append("${plan.missing}") }; append(" to craft") }
            else withStyle(SpanStyle(color = Site.Text, fontWeight = FontWeight.Bold)) { append(if (nums.count > 0) "Ready to play" else "Empty deck") } },
        wallet = wallet, footRight = null, busy = ui.busy, canSave = nums.count > 0, need = plan.need.takeIf { plan.missing > 0 },
        // Play's tabs: Cards, Power and Rules. Power is Play-safe (Randall's card 6 Nov 18:53Z): no Upgrades, no prices. War Chest reads
        // the Collection, and Play never does.
        tabs = listOf("cards" to "Cards", "engine" to "Power", "rules" to "Rules"), powerTab = "engine",
        shelves = if (ui.mode != "all") null else if (shelves.ready) shelves.shelves(::poolTile, { n -> countIn(n) > 0 }, "For this deck", "Most played in your colours", stamp = e.cards) else emptyList(),
        shelvesGen = shelves.gen,
        landPicker = if (ui.mode != "lands") null else ({ tileMod ->
            val counts = HashMap<String, Int>().apply { for (l in e.cards) if (l.name == ui.landType) landOf(l).takeIf { it.isNotEmpty() }?.let { merge(it, l.qty, Int::plus) } }
            val held = ui.landHeld?.takeIf { it.first == ui.landType }?.let { h -> e.cards.firstOrNull { it.name == h.first && LandStyles.rowId(it) == h.second } }?.let { LandHeld(landOf(it), it.qty) }
            LandPicker(LandPick(ui.landType, ui.landSort, ui.landFocus, ui.landLimit, ui.landBusy, landData?.list, landError, landOwned,
            landInUse(ui.landType), listOf("c", "u").associateWith { k -> (state.get("wallet") as? JsonObject)?.get("seal_$k")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0 },
            state.get("config") as? JsonObject, ::landNew, counts, held), landActs, tileMod) }),
        landHeld = if (ui.mode == "lands") ui.landHeld?.let { LandStyles.key(it.first, it.second) } else null,
        landNew = landGot.filter { (id, _) -> landNew(id) }.values.toSet(),
    )
    val benchActions = BenchActions(back = onBack, save = actions.save, step = actions.step, craft = actions.craftCopies, open = actions.open, more = actions.hold,
        craftAll = if (plan.missing > 0) BenchCraft(craftWord(plan, ui), plan.craftable > 0 && !ui.crafting, actions.craftAll) else null,
        // Drop a card on the hero: its art is this deck's art (saved decks; app.js playDropArt).
        cover = { key -> val id = ui.edit.id; val name = nameOf(key); val land = LandStyles.parseKey(key)?.second?.takeIf { it.isNotEmpty() }
            val image = land?.let { LandStyles.image(it, "art_crop") } ?: fact(name)?.a?.ifBlank { null } ?: named(name, "art_crop")
            if (id == null) { ui.pendingCover = name to image; toast("$name is the deck art. It is saved with the deck.") } else {
                scope.launch { val err = Workspace.setPlayDeckCover(context, id, JsonObject().apply { addProperty("name", name.take(200)); addProperty("image", image.take(500)) })
                    toast(err ?: "$name is the deck art.") } } },
        landHold = { t -> openLands(t) },
        // Hold a land row in the deck and let go: the Lands tab opens on it, lit gold; a style picked there changes only that row.
        landRow = { key -> LandStyles.parseKey(key)?.let { (t, id) -> openLands(t); ui.landHeld = t to id
            val row = ui.edit.cards.firstOrNull { it.name == t && LandStyles.rowId(it) == id }; ui.landFocus = row?.let { landOf(it) } ?: ""
            haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress) } },
        menu = listOf(BenchMenuItem("Rename deck") { ui.sheet = "rename" }, BenchMenuItem("Change format") { ui.sheet = "format" },
            BenchMenuItem("Copy list", actions.copy), BenchMenuItem("Copy to My decks", toApp)), shelf = { k -> shelves.load(k) }, shelfMore = { k -> shelves.more(k) })

    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        DeckBench(model, b, benchActions,
            actionRow = if (nums.count < nums.size || goals.isNotEmpty() || e.format == "Commander") ({
                // Commander: the commander slot first (a gold pill until one is set), then Fill, which waits for it.
                if (e.format == "Commander") BenchPill(if (leader == null) "Choose commander" else "Commander: ${leader.substringBefore(",")}", gold = leader == null) { ui.cmdrPick = null; ui.sheet = "commander" }
                if (nums.count < nums.size) BenchPill(CommanderFill.fillLabel(e.format, leader, nums.size - nums.count, ui.filling), enabled = !ui.filling, onClick = actions.fill)
                if (e.format == "Commander" && ui.pins.isNotEmpty()) BenchPill("Pinned", count = ui.pins.size, desc = "${ui.pins.size} pinned cards: ${ui.pins.joinToString()}. Tap to clear") { ui.pins = emptySet() }
                if (e.format == "Commander" && nums.count < nums.size && leader != null) BenchPill("Fill: " + CommanderFill.craftWord(ui.craftMax)) { ui.craftMax = CommanderFill.nextCraft(ui.craftMax) }
                for (g in goals) BenchPill("${g.code.uppercase()} packs", count = g.miss, desc = "${g.name}: ${g.miss} missing") { actions.pack(g.code) }
            }) else null,
            browserSwitch = { BenchSwitch(listOf("mine" to "Your cards", "all" to "All cards", "lands" to "Lands"), ui.mode) { if (it == "lands") openLands(ui.landType) else ui.mode = it } },
            tabBody = { tab -> PlayDeckTab(tab, ui.edit) })
        when (ui.sheet) {
            "rename" -> EditSheet("Rename deck", { ui.sheet = null }) {
                Field(ui.edit.name, "Deck name") { ui.edit = ui.edit.copy(name = it.take(80), dirty = true) }
                GoldCta("Done", Modifier.fillMaxWidth()) { ui.sheet = null }
            }
            "commander" -> CommanderSheet(ui, trunk.map { it.n }.filter { n -> fact(n)?.let { f -> CommanderFill.canLead(f.t, f.card.get("oracle_text")?.takeIf { x -> x.isJsonPrimitive }?.asString ?: "") } == true }.distinct(),
                owned = { n -> (owned[n] ?: owned[n.split(" // ")[0]] ?: 0) > 0 }, factOf = { n -> fact(n) },
                onSet = { name -> setCommander(name); ui.sheet = null; toast("$name is your commander.") }, onClose = { ui.sheet = null })
            "format" -> EditSheet("Change format", { ui.sheet = null }) {
                for (fm in Decks.PLAY_FORMATS) Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp)).clickable { ui.edit = ui.edit.copy(format = fm, dirty = true); ui.sheet = null }
                    .padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(fm, style = t(14f, FontWeight.Bold, if (fm == ui.edit.format) Site.Gold else Ink), modifier = Modifier.weight(1f))
                    if (fm == ui.edit.format) Text("✓", style = t(14f, FontWeight.Bold, Site.Gold))
                }
            }
        }
        ui.holdName?.let { name -> val f = fact(name); val art = f?.a?.ifBlank { null } ?: named(name, "art_crop")
            val set = f?.card?.get("set")?.takeIf { it.isJsonPrimitive }?.asString ?: ""
            PlayDeckHold(ui, name, art, set, owned[name] ?: owned[name.split(" // ")[0]] ?: 0, toast,
                onOpen = { tab -> ui.holdName = null; onCardTab(CardPick(name, byName[name]?.o ?: f?.o ?: "", byName[name]?.pid ?: idOf(name).ifBlank { null }, "nonfoil"), tab) },
                onStep = { k -> stepAny(name, k); toast(if (k > 0) "Added to ${ui.edit.name.ifBlank { "your deck" }}." else "Taken out of ${ui.edit.name.ifBlank { "your deck" }}.") },
                onPack = { code -> ui.holdName = null; onPack(code) },
                onArt = { ui.holdName = null; ArtPick.open("avatar", ArtPick.Card("mtg", f?.card?.get("id")?.asString ?: name, name, set.uppercase(), art, art)) },
                onClose = { ui.holdName = null },
                onPin = if (e.format == "Commander") ({ ui.pins = if (name in ui.pins) ui.pins - name else if (ui.pins.size < 8) ui.pins + name else ui.pins; ui.holdName = null
                    toast(if (name in ui.pins) "$name is pinned. Fill will keep it." else "Pins: up to 8 cards.") }) else null) }
    }
}

/** Craft all's word in the web's four states (.craftbar); the seals it needs show in the Bench's footer beside what you have. */
private fun craftWord(plan: DeckEdit.Plan, ui: EditorUi) = if (ui.crafting) "Crafting…" else if (ui.armed) "Craft ${plan.craftable} now"
    else if (plan.craftable < plan.missing) "Craft ${plan.craftable} of ${plan.missing}" else "Craft all"

/** .fill / .goal: a glass pill in the action row (a gold count when it has one). */
@Composable
internal fun BenchPill(label: String, enabled: Boolean = true, count: Int? = null, desc: String? = null, gold: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else .6f).clip(RoundedCornerShape(12.dp)).background(if (gold) Color(0x33E5C47E) else Color(0x59000000)).border(1.dp, if (gold) Color(0xFFE5C47E) else Color(0x17FFFFFF), RoundedCornerShape(12.dp))
        .clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button; if (desc != null) contentDescription = desc }.padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = t(12.5f, FontWeight.Bold), maxLines = 1, softWrap = false)
        count?.let { Text("$it", style = t(12.5f, FontWeight.ExtraBold, Site.Gold), maxLines = 1, softWrap = false) }
    }
}

/** .yc: Your cards / All cards (playEconPool). */
@Composable
internal fun BenchSwitch(options: List<Pair<String, String>>, on: String, pick: (String) -> Unit) {
    Row(Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0x4D000000)).border(1.dp, Color(0x17FFFFFF), RoundedCornerShape(12.dp)).padding(2.dp)) {
        for ((k, label) in options) { val sel = k == on
            Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(9.dp)).then(if (sel) Modifier.background(Color(0x29E5C47E)) else Modifier).clickable { pick(k) }
                .semantics { role = Role.RadioButton; selected = sel }.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                Text(label, style = t(12f, FontWeight.Bold, if (sel) Color(0xFFE5C47E) else Color(0xFF9B9CA8)), maxLines = 1, softWrap = false)
            }
        }
    }
}

/** A small glass sheet over the Bench (Rename, Change format). */
@Composable
private fun EditSheet(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    androidx.activity.compose.BackHandler(onBack = onClose)
    // Controller: B closes the sheet; the Bench under it lends no buttons. The scrim and the sheet's tap-catcher are no d-pad stops.
    PadScreen(PadActs(b = "Close", opaque = true))
    Box(Modifier.fillMaxSize().background(Color(0xB8050609)).focusProperties { canFocus = false }.clickable(remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, null, onClick = onClose), contentAlignment = Alignment.Center) {
        Column(Modifier.padding(24.dp).widthIn(max = 420.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xF714161D)).border(1.dp, Color(0xFFB8924A), RoundedCornerShape(18.dp))
            .focusProperties { canFocus = false }.clickable(remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, null) {}.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFFE5C47E)))
            content()
        }
    }
}

/**
 * Hold a card in the builder (app.js playHoldMenu, widened by Randall 4 Nov 00:35Z): Play's card actions in Collection's look,
 * every one a diegetic Play move: open it, put a copy in or take one out of this deck, get it with seals, its pack, its set,
 * and its art as this deck's cover (saved decks) or as your avatar or header.
 */
@Composable
private fun PlayDeckHold(ui: EditorUi, name: String, image: String, set: String, have: Int, toast: (String) -> Unit,
                         onOpen: (tab: String) -> Unit, onStep: (Int) -> Unit, onPack: (String) -> Unit, onArt: () -> Unit, onClose: () -> Unit, onPin: (() -> Unit)? = null) {
    val context = androidx.compose.ui.platform.LocalContext.current; val scope = rememberCoroutineScope()
    val e = ui.edit; val id = e.id; val deck = e.name.ifBlank { "this deck" }
    val q = e.cards.filter { it.name == name }.sumOf { it.qty }; val room = DeckEdit.room(e.cards, name, e.format)
    val pick = id?.let { Workspace.playDeckCovers.collectAsState().value[it] }?.get("name")?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    val isCover = pick.isNotEmpty() && pick.split(" // ")[0] in listOf(name, name.split(" // ")[0])
    androidx.activity.compose.BackHandler(onBack = onClose)
    val meta = listOfNotNull(e.name.ifBlank { null }, "$q in deck", if (have > 0) "${minOf(have, 4)} in your Trunk" else "Not in your Trunk yet").joinToString(" · ")
    ContextSheet("Card actions", name, meta, image, listOf(
        listOfNotNull(
            ContextAction(SiteIcons.CardStack, "Open card", "Copies, crafting and Secret Lair art") { onOpen("overview") },
            if (room > 0) ContextAction(SiteIcons.Decks, "Add a copy to $deck", if (have > q) "${q + 1} in deck" else "${q + 1} in deck · greyed until it is in your Trunk") { onStep(1) } else null,
            if (q > 0) ContextAction(SiteIcons.Close, "Take one out", if (q == 1) "Out of the deck" else "${q - 1} left in deck") { onStep(-1) } else null,
            if (onPin != null && q > 0) ContextAction(SiteIcons.CardStack, if (name in ui.pins) "Unpin" else "Always include (pin)", if (name in ui.pins) "Fill may use it again" else "Fill keeps it and builds around it") { onPin() } else null),
        listOfNotNull(
            if (have < 4) ContextAction(SiteIcons.Trunk, if (have > 0) "Get more copies" else "Get it", "Stamp a copy or make it holo with seals") { onOpen("get") } else null,
            if (set.isNotBlank()) ContextAction(SiteIcons.PackIcon, "Its pack at the Merchant") { onPack(set) } else null,
            if (set.isNotBlank()) ContextAction(SiteIcons.ViewGallery, "See the whole set") { onPack(set) } else null),
        listOfNotNull(
            if (id == null) null else if (isCover) ContextAction(SiteIcons.Paint, "Use the automatic deck cover", "This card is the cover now") {
                scope.launch { val err = Workspace.setPlayDeckCover(context, id, null); onClose(); toast(err ?: "$deck uses its automatic cover again.") } }
            else ContextAction(SiteIcons.Paint, "Deck cover", "Show this art on $deck") {
                if (!image.startsWith("https://")) { toast("This card has no artwork to use."); return@ContextAction }
                scope.launch { val err = Workspace.setPlayDeckCover(context, id, JsonObject().apply { addProperty("name", name.take(200)); addProperty("image", image.take(500)) })
                    onClose(); toast(err ?: "$name is the deck art.") } },
            ContextAction(SiteIcons.Paint, "Use artwork as…", "Avatar or profile header") { onArt() })).filter { it.isNotEmpty() }, onClose)
}

private class Actions(val save: () -> Unit, val craftAll: () -> Unit, val craftCopies: (String, Int) -> Unit, val fill: () -> Unit, val copy: () -> Unit,
                      val step: (String, Int) -> Unit, val open: (String) -> Unit, val pack: (String) -> Unit, val hold: (String) -> Unit = open)


@Composable
internal fun PackGoals(goals: List<DeckEdit.Goal>, onPack: (String) -> Unit) = Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    for (g in goals) Row(Modifier.height(44.dp).softPill(RoundedCornerShape(22.dp)).clickable { onPack(g.code) }.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SetIcon(g.code, Modifier.size(20.dp)); Text(g.name, style = t(13.5f, FontWeight.SemiBold), softWrap = false)
        Text("${g.miss}", style = t(13.5f, FontWeight.ExtraBold, Site.Gold))
    }
}

/**
 * A Bench tab other than Cards for a Play deck. Rules: the site's interactive rules for the deck's format (rule-dex.js
 * interactiveRules through the Collection engine, as Collection's Rules tab draws them); nothing in it reads your Collection.
 */
@Composable
private fun PlayDeckTab(tab: String, e: DeckEdit.Edit) {
    if (tab != "rules" && tab != "engine") return
    val context = androidx.compose.ui.platform.LocalContext.current
    val session by dev.cardstashy.nativeplay.account.Account.session.collectAsState()
    val revision by Workspace.fullRevision.collectAsState()
    var panel by remember { mutableStateOf<SitePanelModel?>(null) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val want = if (tab == "engine") "playpower|" else "rules|"
    fun take(m: SitePanelModel) { if (m.key.startsWith(want)) panel = m }
    fun panelDo(call: suspend () -> JsonObject) = scope.launch {
        runCatching { take(SitePanelModel.parse(call())); CollectionEngine.settle(if (tab == "engine") 120_000 else 15_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) } }
    }
    val listSig = if (tab == "engine") e.cards.joinToString(";") { "${it.qty} ${it.name}" } else ""
    LaunchedEffect(tab, e.format, listSig, session?.userId, revision) {
        failed = false; if (tab == "engine") delay(400)
        val ok = runCatching { ensureCollection(context, session?.userId, session != null, revision) }.getOrDefault(false)
        if (!ok) { failed = true; return@LaunchedEffect }
        panelDo { if (tab == "engine") CollectionEngine.playPower(DeckEdit.saveBody(e)) else CollectionEngine.rules("mtg", e.format) }
    }
    val screenW = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
    val siteUi = remember(screenW) {
        SiteUi(tap = { id -> panelDo { CollectionEngine.panelTap(id) } }, type = { id, v -> panelDo { CollectionEngine.panelType(id, v) } },
            open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
            screen = screenW)
    }
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    Box(Modifier.fillMaxSize()) {
        val p = panel
        if (p == null) Text(if (failed) (if (tab == "engine") "Power couldn’t open. Check your connection and try again." else "The rules couldn’t open. Check your connection and try again.") else if (tab == "engine") "Reading the deck’s Power…" else "Opening the rules…", style = t(14f, color = Site.Muted),
            modifier = Modifier.align(Alignment.Center).padding(24.dp))
        else Box(Modifier.fillMaxSize().drawWithContent { pageLayer.record { this@drawWithContent.drawContent() }; drawLayer(pageLayer) }) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 14.dp, vertical = 10.dp)) { SitePanel(p, siteUi) }
        }
        p?.let { SiteGlass(it, siteUi, pageLayer) { it.glass?.find { n -> n.has("rule-dismiss") }?.let { n -> siteUi.tap(n.id) } } }
    }
}

/**
 * Commander's slot, opened: the legends you own first, then every card that can lead a deck (Scryfall's is:commander), typed over
 * as you go. Tap one to highlight it (its colours show), then Set. Nothing here makes up a card: names and colours are Scryfall's.
 */
@Composable
private fun CommanderSheet(ui: EditorUi, yours: List<String>, owned: (String) -> Boolean, factOf: (String) -> CardFacts.Fact?,
                           onSet: (String) -> Unit, onClose: () -> Unit) {
    LaunchedEffect(ui.cmdrFind) {
        if (ui.cmdrFind.isNotBlank()) delay(350)
        val name = ui.cmdrFind.trim().replace(Regex("[\"\\\\]"), "").takeIf { it.isNotEmpty() }?.let { " name:\"$it\"" } ?: ""
        ui.cmdrHits = CardFacts.search("is:commander legal:commander$name", "edhrec", 1)?.first ?: emptyList()
    }
    val find = ui.cmdrFind.trim().lowercase()
    val mine = yours.filter { find.isEmpty() || it.lowercase().contains(find) }
    val hitCards = ui.cmdrHits.mapNotNull { c -> c.get("name")?.asString?.let { it to c } }.filter { it.first !in mine }
    fun colours(name: String, card: JsonObject?): String {
        val k = factOf(name)?.k ?: card?.get("color_identity")?.let { (it as? JsonArray).orEmptyList().joinToString("") }
        return (k ?: "").uppercase().toCharArray().sortedBy { "WUBRG".indexOf(it) }.joinToString(" ").ifEmpty { "Colourless" }
    }
    @Composable fun LegendRow(name: String, card: JsonObject?) {
        val sel = ui.cmdrPick == name
        val p = heroPainter(homeArt(named(name, "art_crop")))
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(10.dp)).background(if (sel) Color(0x33E5C47E) else Color(0x0DFFFFFF))
            .then(if (sel) Modifier.border(1.5.dp, Site.Gold, RoundedCornerShape(10.dp)) else Modifier).clickable { ui.cmdrPick = name }
            .semantics { role = Role.RadioButton; selected = sel; contentDescription = name }.padding(6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(width = 64.dp, height = 44.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFF1B1F2B))) { if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
            Column(Modifier.weight(1f)) {
                Text(name, style = t(13.5f, FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(colours(name, card), style = t(11.5f, FontWeight.Medium, Color(0xFF9B9CA8)))
            }
            Text(if (owned(name)) "owned" else "craft", style = t(11.5f, FontWeight.Bold, if (owned(name)) Color(0xFF4EC27A) else Color(0xFFE69A3A)))
        }
    }
    EditSheet("Choose your commander", onClose) {
        Field(ui.cmdrFind, "Search legends") { ui.cmdrFind = it }
        androidx.compose.foundation.lazy.LazyColumn(Modifier.heightIn(max = 300.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (mine.isNotEmpty()) item { Text("YOURS", style = t(11f, FontWeight.ExtraBold, Site.Gold)) }
            items(mine.size) { LegendRow(mine[it], null) }
            if (hitCards.isNotEmpty()) item { Text("ALL LEGENDS", style = t(11f, FontWeight.ExtraBold, Site.Gold)) }
            items(hitCards.size) { LegendRow(hitCards[it].first, hitCards[it].second) }
            if (mine.isEmpty() && hitCards.isEmpty()) item { Text(if (find.isEmpty()) "Loading legends…" else "No legend matches “${ui.cmdrFind}”.", style = t(13f, FontWeight.Medium, Color(0xFF9B9CA8))) }
        }
        GoldCta(ui.cmdrPick?.let { "Set ${it.substringBefore(",")} as commander" } ?: "Pick a card above", Modifier.fillMaxWidth(), enabled = ui.cmdrPick != null) { ui.cmdrPick?.let(onSet) }
    }
}
