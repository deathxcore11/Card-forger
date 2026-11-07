package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.account.Decks as Workspace
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
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
    var crafting by mutableStateOf(false)
    var armed by mutableStateOf(false)
    var filling by mutableStateOf(false)
    /** The card whose Play card actions are open. */
    var holdName by mutableStateOf<String?>(null)
    /** Kept for the callers that open a saved deck as its list (the Bench always shows the Trunk under the deck). */
    var adding by mutableStateOf(true)
    var mode by mutableStateOf("mine")
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
    fun stepCard(name: String, step: Int) = setEdit(DeckEdit.step(ui.edit.cards, name, step, ui.edit.format))
    fun idOf(name: String) = fact(name)?.card?.get("id")?.asString ?: ""
    suspend fun craftCopies(id: String, n: Int): Int { var made = 0; repeat(n) { if (runCatching { Progress.craft(id) }.isSuccess) made++ else return made }; return made }

    // ---- pool (app.js poolQuery / loadPool), on the Bench's find, colour and type filters
    fun poolQuery(find: String = b.find, colors: Set<String> = b.colors, type: String = b.type): String {
        val q = mutableListOf("legal:${ui.edit.format.lowercase()}", "game:paper")
        find.trim().replace(Regex("[\"\\\\]"), "").takeIf { it.isNotEmpty() }?.let { q += "name:\"$it\"" }
        if (colors.isNotEmpty()) q += colors.joinToString(" or ", "(", ")") { "c:" + it.lowercase() }
        POOL_TYPES[type]?.let { q += it }
        if (ui.edit.format == "Commander") ui.edit.cards.mapNotNull { fact(it.name) }.firstOrNull { Regex("Legendary").containsMatchIn(it.t) && Regex("Creature").containsMatchIn(it.t) }
            ?.let { q += "id<=" + it.k.lowercase().ifEmpty { "c" } }
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
    LaunchedEffect(ui.mode, b.find, b.colors, b.type, ui.edit.format) { if (ui.mode == "all" && b.find.isNotBlank()) { if (ui.poolKey.isNotEmpty()) delay(350); loadPool() } }
    // ---- All cards, shelf by shelf (AllShelves.kt): "For this deck" is Fill empty slots' own search (A.playFillSlots: the format's
    // most played cards, no lands) in the deck's colours, then a shelf per set with the pool's search, each loaded when it shows.
    val shelves = remember(ui) { MagicShelves(scope) }
    val shelfBase = poolQuery("", b.colors, b.type)
    // The deck's colours, worked out off the main thread (the facts map grows with every shelf that lands).
    val identity by androidx.compose.runtime.produceState<String?>(null, facts, e.cards) { value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { deckIdentity(e.cards.map { it.name }.filterNot(Decks::isBasicLand)) } }
    val shelfFit = poolQuery("", emptySet(), "All") + " -t:land" + (identity?.let { " id<=$it" } ?: "")
    LaunchedEffect(ui.mode, shelfBase, shelfFit) { if (ui.mode == "all") { shelves.use(shelfBase, shelfFit); shelves.start() } }
    // All cards: the next page comes in as the grid nears its end.
    LaunchedEffect(ui.mode) { if (ui.mode == "all") snapshotFlow { b.tileGrid.layoutInfo.let { it.visibleItemsInfo.lastOrNull()?.index to it.totalItemsCount } }
        .collect { (last, total) -> if (last != null && total > 0 && last >= total - 6 && ui.poolMore && !ui.poolBusy) loadPool(true) } }

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

    val actions = Actions(
        save = {
            if (ui.edit.cards.isNotEmpty() && !ui.busy) { ui.busy = true
                scope.launch { runCatching { Progress.saveDeck(DeckEdit.saveBody(ui.edit)) }.onSuccess { d -> (d as? JsonObject)?.get("id")?.asString?.let { ui.edit = ui.edit.copy(id = it) }
                    ui.edit = ui.edit.copy(dirty = false); toast("Saved to your Play decks.") }; ui.busy = false } }
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
            if (need >= 1 && !ui.filling) { ui.filling = true
                scope.launch {
                    val q = poolQuery("", emptySet(), "All") + " -t:land"; val inDeck = ui.edit.cards.map { it.name.lowercase() }.toHashSet(); var added = 0; var failed = false
                    val adds = ArrayList<DeckEdit.Line>()
                    for (page in 1..3) { if (added >= need) break
                        val r = CardFacts.search(q, "edhrec", page); if (r == null) { failed = page == 1; break }
                        for (c in r.first) { if (added >= need) break; val n = c.get("name")?.asString ?: continue; if (!inDeck.add(n.lowercase())) continue; adds += DeckEdit.Line(n, 1); added++ }
                        if (!r.second) break }
                    if (adds.isNotEmpty()) ui.edit = ui.edit.copy(cards = ui.edit.cards + adds, dirty = true)
                    toast(if (failed) "Suggestions could not load. Check your connection." else if (added > 0) "$added suggested card${if (added > 1) "s" else ""} added. Greyed ones are still to craft." else "No suggestions found right now.")
                    ui.filling = false
                } }
        },
        copy = { clipboard.setText(AnnotatedString(DeckEdit.copyList(ui.edit))); toast("Decklist copied.") },
        step = ::stepCard,
        open = { name -> onCard(CardPick(name, byName[name]?.o ?: fact(name)?.o ?: "", byName[name]?.pid ?: idOf(name).ifBlank { null }, "nonfoil")) },
        pack = onPack,
        // app.js playHoldMenu: Play's card actions (open it, its pack, its set, deck cover, artwork).
        hold = { name -> haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress); ui.holdName = name },
    )
    // app.js A.playEconToApp: the list as a new deck in My decks (Commander: its legendary single as commander).
    val toApp: () -> Unit = {
        val ed = ui.edit
        if (ed.cards.isNotEmpty()) scope.launch {
            val lead = if (ed.format == "Commander") ed.cards.firstOrNull { it.qty == 1 && Regex("Legendary").containsMatchIn(fact(it.name)?.t ?: "") } else null
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
        BenchRow(l.name, l.qty, pr?.miss ?: 0, pr?.seal ?: "", fx?.a?.ifBlank { null } ?: named(l.name, "art_crop"), byName[l.name]?.pimage ?: fx?.i?.ifBlank { null } ?: named(l.name, "normal"),
            fx?.mc ?: "", colorsOf(card), card.str("set"), card.str("collector_number"), card.str("rarity"),
            (cardRoles?.get(l.name) as? JsonArray)?.mapNotNull { it.takeIf { r -> r.isJsonPrimitive }?.asString } ?: emptyList()) }) }
    fun keep(name: String, colors: List<String>, group: String): Boolean {
        if (b.find.isNotBlank() && !name.contains(b.find.trim(), ignoreCase = true)) return false
        if (b.colors.isNotEmpty() && colors.none { it in b.colors }) return false
        return when (b.type) { "Creatures" -> group == "Creatures"; "Lands" -> group == "Lands"; "Spells" -> group != "Creatures" && group != "Lands"; else -> true }
    }
    fun poolTile(c: JsonObject): BenchTile { val n = c.str("name"); val have = owned[n] ?: owned[n.split(" // ")[0]] ?: 0
        val face = (c.get("card_faces") as? JsonArray)?.firstOrNull() as? JsonObject
        return BenchTile(n, (c.get("image_uris") as? JsonObject)?.str("normal")?.ifBlank { null } ?: (face?.get("image_uris") as? JsonObject)?.str("normal")?.ifBlank { null } ?: named(n, "normal"),
            c.get("cmc")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0, Trunk.group(c.str("type_line").ifBlank { face.str("type_line") }) == "Lands",
            Decks.isBasicLand(n), countIn(n), have, DeckEdit.room(e.cards, n, e.format), have == 0) }
    val tiles: List<BenchTile> = if (ui.mode == "all") ui.pool.map(::poolTile)
    else trunk.mapNotNull { c -> val fx = facts[c.o]; val g = Trunk.group(fx?.t ?: ""); val basic = Decks.isBasicLand(c.n); val q = countIn(c.n)
        if (basic && q == 0) return@mapNotNull null
        if (!keep(c.n, colorsOf(fx?.card), g)) return@mapNotNull null
        BenchTile(c.n, c.pimage ?: fx?.i?.ifBlank { null } ?: named(c.n, "normal"), fx?.m ?: 0.0, g == "Lands", basic, q, c.c, DeckEdit.room(e.cards, c.n, e.format), false) }
    val wallet = plan.have
    val model = BenchModel(
        play = true, modeChip = "Play deck", formatChip = "Magic · ${e.format}", title = e.name.ifBlank { "New Play deck" },
        heroArt = Workspace.playDeckCovers.collectAsState().value.let { Workspace.pickedCover(e.id) } ?: fact(e.cards.firstOrNull { !Decks.isBasicLand(it.name) }?.name ?: "")?.a,
        stats = listOf(BenchStat("${nums.count}/${nums.size}", "cards", warn = !nums.ok), BenchStat("${nums.count - plan.missing}/${nums.count}", "unlocked")),
        power = power?.let { "${it.roundToInt()}" }, tier = if (e.format == "Commander" && bracket != null) PowerTier.bracketLabel(bracket) else PowerTier.powerTier(power),
        roles = (read?.get("roles") as? JsonArray)?.mapNotNull { (it as? JsonArray)?.takeIf { r -> r.size() >= 2 && r[0].isJsonPrimitive && r[1].isJsonPrimitive }?.let { r -> r[0].asString to r[1].asInt } } ?: emptyList(),
        groups = groups, basics = BASICS.map { it to named(it, "art_crop") }, browserTitle = "Trunk", tiles = tiles,
        browserNote = if (ui.mode == "all") (if (ui.poolBusy) "Looking through every card…" else if (ui.poolError.isNotEmpty()) ui.poolError else null)
            else if (trunk.isEmpty()) "No cards yet. Open packs, or look through All cards and craft them with seals." else null,
        footLead = buildAnnotatedString { if (plan.missing > 0) { withStyle(SpanStyle(color = Site.Text, fontWeight = FontWeight.Bold)) { append("${plan.missing}") }; append(" to craft") }
            else withStyle(SpanStyle(color = Site.Text, fontWeight = FontWeight.Bold)) { append(if (nums.count > 0) "Ready to play" else "Empty deck") } },
        wallet = wallet, footRight = null, busy = ui.busy, canSave = nums.count > 0,
        // Play's tabs: Cards, Power and Rules. Power is Play-safe (Randall's card 6 Nov 18:53Z): no Upgrades, no prices. War Chest reads
        // the Collection, and Play never does.
        tabs = listOf("cards" to "Cards", "engine" to "Power", "rules" to "Rules"), powerTab = "engine",
        shelves = if (ui.mode != "all") null else if (shelves.ready) shelves.shelves(::poolTile, { n -> countIn(n) > 0 }, "For this deck", "Most played in your colours", stamp = e.cards) else emptyList(),
        shelvesGen = shelves.gen,
    )
    val benchActions = BenchActions(back = onBack, save = actions.save, step = actions.step, craft = actions.craftCopies, open = actions.open, more = actions.hold,
        menu = listOf(BenchMenuItem("Rename deck") { ui.sheet = "rename" }, BenchMenuItem("Change format") { ui.sheet = "format" },
            BenchMenuItem("Copy list", actions.copy), BenchMenuItem("Copy to My decks", toApp)), shelf = { k -> shelves.load(k) })

    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        DeckBench(model, b, benchActions,
            actionRow = if (plan.missing > 0 || nums.count < nums.size || goals.isNotEmpty()) ({
                if (plan.missing > 0) CraftBar(plan, ui, actions.craftAll)
                if (nums.count < nums.size) BenchPill(if (ui.filling) "Finding cards…" else "Fill ${nums.size - nums.count} empty slot${if (nums.size - nums.count > 1) "s" else ""}", enabled = !ui.filling, onClick = actions.fill)
                for (g in goals) BenchPill("${g.code.uppercase()} packs", count = g.miss, desc = "${g.name}: ${g.miss} missing") { actions.pack(g.code) }
            }) else null,
            browserSwitch = { BenchSwitch(listOf("mine" to "Your cards", "all" to "All cards"), ui.mode) { ui.mode = it } },
            tabBody = { tab -> PlayDeckTab(tab, ui.edit) })
        when (ui.sheet) {
            "rename" -> EditSheet("Rename deck", { ui.sheet = null }) {
                Field(ui.edit.name, "Deck name") { ui.edit = ui.edit.copy(name = it.take(80), dirty = true) }
                GoldCta("Done", Modifier.fillMaxWidth()) { ui.sheet = null }
            }
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
                onStep = { k -> stepCard(name, k); toast(if (k > 0) "Added to ${ui.edit.name.ifBlank { "your deck" }}." else "Taken out of ${ui.edit.name.ifBlank { "your deck" }}.") },
                onPack = { code -> ui.holdName = null; onPack(code) },
                onArt = { ui.holdName = null; ArtPick.open("avatar", ArtPick.Card("mtg", f?.card?.get("id")?.asString ?: name, name, set.uppercase(), art, art)) },
                onClose = { ui.holdName = null }) }
    }
}

/** .craftbar: the seals the missing cards need (short ones in coral), then Craft all with the web's four states. */
@Composable
private fun CraftBar(plan: DeckEdit.Plan, ui: EditorUi, onCraft: () -> Unit) {
    Row(Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0x14E5C47E)).border(1.dp, Color(0x4DE5C47E), RoundedCornerShape(12.dp)).padding(start = 10.dp, end = 5.dp, top = 5.dp, bottom = 5.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            for (k in listOf("c", "u", "r", "m")) { val need = plan.need[k] ?: 0; if (need == 0) continue
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.semantics { contentDescription = "$need needed, ${plan.have[k] ?: 0} owned" }) {
                    SealMini(k, 18.dp); Text("$need", style = t(13f, FontWeight.ExtraBold, if (need > (plan.have[k] ?: 0)) Color(0xFFFF7A6A) else Ink), maxLines = 1, softWrap = false) } }
        }
        val on = plan.craftable > 0 && !ui.crafting
        Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp)).background(if (on) Brush.verticalGradient(listOf(Color(0xFFF0D9A0), Color(0xFFB8924A))) else SolidColor(Color(0x26E5C47E)))
            .clickable(enabled = on, onClick = onCraft).semantics { role = Role.Button }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
            Text(if (ui.crafting) "Crafting…" else if (ui.armed) "Craft ${plan.craftable} now" else if (plan.craftable < plan.missing) "Craft ${plan.craftable} of ${plan.missing}" else "Craft all",
                style = t(13f, FontWeight.ExtraBold, if (on) Color(0xFF1A1405) else Site.Muted), maxLines = 1, softWrap = false)
        }
    }
}

/** .fill / .goal: a glass pill in the action row (a gold count when it has one). */
@Composable
internal fun BenchPill(label: String, enabled: Boolean = true, count: Int? = null, desc: String? = null, onClick: () -> Unit) {
    Row(Modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else .6f).clip(RoundedCornerShape(12.dp)).background(Color(0x59000000)).border(1.dp, Color(0x17FFFFFF), RoundedCornerShape(12.dp))
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
                         onOpen: (tab: String) -> Unit, onStep: (Int) -> Unit, onPack: (String) -> Unit, onArt: () -> Unit, onClose: () -> Unit) {
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
            if (q > 0) ContextAction(SiteIcons.Close, "Take one out", if (q == 1) "Out of the deck" else "${q - 1} left in deck") { onStep(-1) } else null),
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
                    onClose(); toast(err ?: "$name is the cover of $deck.") } },
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
        runCatching { take(SitePanelModel.parse(call())); CollectionEngine.settle(15_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) } }
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
