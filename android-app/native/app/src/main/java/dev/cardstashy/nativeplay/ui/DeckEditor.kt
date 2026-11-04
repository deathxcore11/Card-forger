package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.account.Decks as Workspace
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.DeckEdit
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.SetFacts
import dev.cardstashy.nativeplay.play.Trunk
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The Play deck editor, deckBuilderMarkup in play-econ-ui.js block for block: the deck hero (lead art,
 * "Play deck", format, count of size, to craft, creatures, lands, average mana value, Save deck), name and
 * format, Craft all, Fill empty slots, pack goals, Copy list, the grouped list with craft menus and steppers,
 * free basics, then the pool (Your cards / All cards). Sideboard rows ride along untouched and are saved as
 * they came. Copy to My decks is left out until the workspace save is ported (DECKS-PLAN 2.2).
 */
class EditorUi {
    var edit by mutableStateOf(DeckEdit.Edit(null, "", "Standard", emptyList()))
    var busy by mutableStateOf(false)
    var crafting by mutableStateOf(false)
    var armed by mutableStateOf(false)
    var filling by mutableStateOf(false)
    /** The card whose Play card actions (hold) are open. */
    var holdName by mutableStateOf<String?>(null)
    var mode by mutableStateOf("mine")
    var filter by mutableStateOf(Trunk.Filter())
    var sort by mutableStateOf("")
    var pool by mutableStateOf<List<JsonObject>>(emptyList())
    var poolBusy by mutableStateOf(false)
    var poolError by mutableStateOf("")
    var poolMore by mutableStateOf(false)
    var poolPage = 1
    var poolKey = ""
}

private val Ink get() = Site.Text
private val Warn = Color(0xFFFFB86B)
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
private val BASICS = listOf("Plains", "Island", "Swamp", "Mountain", "Forest")
private fun named(name: String, version: String) = "https://api.scryfall.com/cards/named?format=image&version=$version&exact=" + java.net.URLEncoder.encode(name, "UTF-8").replace("+", "%20")
private val POOL_COLORS = mapOf("W" to "w", "U" to "u", "B" to "b", "R" to "r", "G" to "g", "C" to "c")
private val POOL_TYPES = mapOf("Creatures" to "creature", "Planeswalkers" to "planeswalker", "Instants" to "instant", "Sorceries" to "sorcery", "Artifacts" to "artifact",
    "Enchantments" to "enchantment", "Battles" to "battle", "Lands" to "land")

@Composable
fun DeckEditor(state: JsonObject, ui: EditorUi, onBack: () -> Unit, onCard: (CardPick) -> Unit, onPack: (String) -> Unit, toast: (String) -> Unit,
               onCardTab: (CardPick, String) -> Unit = { p, _ -> onCard(p) }, nav: @Composable () -> Unit) {
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val e = ui.edit
    val trunk = remember(state) { Trunk.cards(state) }
    val owned = remember(trunk) { Trunk.byName(trunk) }
    val byName = remember(trunk) { trunk.flatMap { listOf(it.n.split(" // ")[0] to it, it.n to it) }.toMap() }
    val facts by CardFacts.cards.collectAsState()
    val factByName = remember(facts) { facts.values.flatMap { f -> val n = f.card.get("name")?.asString ?: ""; listOf(n to f, n.split(" // ")[0] to f) }.toMap() }
    fun fact(name: String): CardFacts.Fact? = byName[name]?.o?.let { facts[it] } ?: factByName[name]
    LaunchedEffect(e.cards.map { it.name }) {
        CardFacts.want(e.cards.mapNotNull { c -> byName[c.name]?.let { it.o to it.pid } })
        CardFacts.wantNames(e.cards.map { it.name }.filter { byName[it] == null && !Decks.isBasicLand(it) })
    }
    val rarityOf = { n: String -> fact(n)?.card?.get("rarity")?.asString ?: byName[n]?.r ?: "" }
    val plan = DeckEdit.craftPlan(e.cards, owned, rarityOf, state.getAsJsonObject("wallet"))
    val planOf = plan.rows.associateBy { it.name }
    val nums = DeckEdit.numbers(e) { fact(it) }
    val sets by SetFacts.sets.collectAsState()
    val goals = DeckEdit.packGoals(plan) { n -> fact(n)?.card?.let { c -> val code = c.get("set")?.asString ?: ""; code to (sets[code]?.name ?: c.get("set_name")?.asString ?: code.uppercase()) } }
    fun setEdit(cards: List<DeckEdit.Line>) { ui.edit = e.copy(cards = cards, dirty = true) }
    fun stepCard(name: String, step: Int) = setEdit(DeckEdit.step(ui.edit.cards, name, step, ui.edit.format))
    fun idOf(name: String) = fact(name)?.card?.get("id")?.asString ?: ""
    suspend fun craftCopies(id: String, n: Int): Int { var made = 0; repeat(n) { if (runCatching { Progress.craft(id) }.isSuccess) made++ else return made }; return made }

    // ---- pool (app.js poolQuery / loadPool)
    fun poolQuery(f: Trunk.Filter = ui.filter): String {
        val q = mutableListOf("legal:${ui.edit.format.lowercase()}", "game:paper")
        f.query.trim().replace(Regex("[\"\\\\]"), "").takeIf { it.isNotEmpty() }?.let { q += "name:\"$it\"" }
        if (f.color.isNotEmpty()) q += if (f.color == "C") "c:c" else "c:${POOL_COLORS[f.color] ?: ""}"
        POOL_TYPES[f.type]?.let { q += "t:$it" }
        if (f.rarity.isNotEmpty()) q += "r:${f.rarity}"
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
    LaunchedEffect(ui.mode, ui.filter, ui.sort, ui.edit.format) { if (ui.mode == "all") { if (ui.poolKey.isNotEmpty()) delay(350); loadPool() } }

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
                        val p = DeckEdit.craftPlan(ui.edit.cards, owned, rarityOf, state.getAsJsonObject("wallet")); var made = 0
                        try { for (r in p.rows) { val id = idOf(r.name); if (id.isNotEmpty() && r.now > 0) made += craftCopies(id, r.now) } } finally { ui.crafting = false }
                        toast(if (made > 0) "$made card${if (made > 1) "s" else ""} crafted.${if (made < p.missing) " Open packs or forge seals for the rest." else ""}" else "Not enough seals for these cards yet.")
                    } }
            }
        },
        craftCopies = { name, n -> val id = idOf(name)
            if (id.isEmpty()) toast("That card is still loading. Try again in a moment.")
            else scope.launch { val made = craftCopies(id, n); if (made > 0) toast("$made $name crafted into your Play collection.") } },
        fill = {
            val size = Decks.deckRules(ui.edit.format).size; val need = size - ui.edit.cards.sumOf { it.qty }
            if (need >= 1 && !ui.filling) { ui.filling = true
                scope.launch {
                    val q = poolQuery(Trunk.Filter()) + " -t:land"; val inDeck = ui.edit.cards.map { it.name.lowercase() }.toHashSet(); var added = 0; var failed = false
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
        // app.js playHoldMenu: hold opens Play's card actions.
        hold = { name -> haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress); ui.holdName = name },
    )

    // Pool tiles (Your cards or All cards).
    data class PoolTile(val name: String, val image: String, val rarity: String, val have: Int)
    val tiles: List<PoolTile> = if (ui.mode == "all") ui.pool.map { c -> val n = c.get("name")?.asString ?: ""
        PoolTile(n, c.getAsJsonObject("image_uris")?.get("normal")?.asString ?: c.getAsJsonArray("card_faces")?.firstOrNull()?.asJsonObject?.getAsJsonObject("image_uris")?.get("normal")?.asString ?: named(n, "normal"),
            c.get("rarity")?.asString ?: "", owned[n] ?: owned[n.split(" // ")[0]] ?: 0) }
    else remember(trunk, facts, ui.filter) { Trunk.filter(trunk.sortedBy { it.n }, { facts[it] }, ui.filter) }.map { c ->
        PoolTile(c.n, c.pimage ?: facts[c.o]?.i ?: named(c.n, "normal"), c.r, c.c) }
    val playSets = remember(state, sets.size) { Trunk.setRows(state) }

    val deckBlock: LazyGridScope.() -> Unit = {
        item(span = { GridItemSpan(maxLineSpan) }) { Workspace.playDeckCovers.collectAsState().value; Hero(e, nums, plan.missing, Workspace.pickedCover(e.id) ?: fact(e.cards.firstOrNull { !Decks.isBasicLand(it.name) }?.name ?: "")?.a, ui.busy, onBack, actions.save) }
        item(span = { GridItemSpan(maxLineSpan) }) { Meta(ui) }
        if (plan.missing > 0) item(span = { GridItemSpan(maxLineSpan) }) { CraftAllBar(plan, ui, actions.craftAll) }
        if (nums.count < nums.size) item(span = { GridItemSpan(maxLineSpan) }) {
            GhostButton(if (ui.filling) "Finding cards…" else "Fill ${nums.size - nums.count} empty slot${if (nums.size - nums.count > 1) "s" else ""}", Modifier.fillMaxWidth(), enabled = !ui.filling, onClick = actions.fill) }
        if (goals.isNotEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { PackGoals(goals, actions.pack) }
        if (nums.count > 0) item(span = { GridItemSpan(maxLineSpan) }) { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { GhostButton("Copy list", onClick = actions.copy) } }
        if (e.cards.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { Text("Drag cards here, or tap one to see it.", style = t(14f, color = Site.Muted), modifier = Modifier.padding(vertical = 8.dp)) }
        for ((g, rows) in DeckEdit.groups(e.cards) { fact(it) }) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(g, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = if (AppSettings.theme == "light") Site.Text else Color(0xFFF3E3BD)))
                    Text("${rows.sumOf { it.qty }}", style = t(13f, FontWeight.Bold, Site.Muted))
                }
            }
            items(rows, key = { "row:" + it.name }, span = { GridItemSpan(maxLineSpan) }) { c ->
                DeckRow(c, planOf[c.name], fact(c.name), plan.have, DeckEdit.room(e.cards, c.name, e.format), ui.busy, actions)
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) { BasicsRow(actions.step) }
    }
    val poolBlock: LazyGridScope.() -> Unit = {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(Modifier.padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Segmented(listOf("mine" to "Your cards", "all" to "All cards"), ui.mode) { ui.mode = it; ui.filter = ui.filter.copy(set = "") }
                FilterBar(ui.filter, ui.sort, if (ui.mode == "mine") playSets else emptyList(), { ui.filter = it }, { ui.sort = it })
                Text(if (ui.mode == "all") (if (ui.poolBusy) "Looking through every card…" else "${"%,d".format(tiles.size)}${if (ui.poolMore) "+" else ""} ${e.format} cards")
                    else "${"%,d".format(tiles.size)} of ${"%,d".format(trunk.size)} cards", style = t(13f, color = Site.Muted))
            }
        }
        if (tiles.isEmpty() && !(ui.mode == "all" && ui.poolBusy)) item(span = { GridItemSpan(maxLineSpan) }) {
            val (h, p) = if (ui.mode == "all") (if (ui.poolError.isNotEmpty()) "Cards could not load" to ui.poolError else "No cards match" to "Try another name, colour or type.")
                else if (trunk.isNotEmpty()) "No cards match" to "Try another name, colour or type, or look through all cards."
                else "No cards yet" to "Open packs, or look through all cards and craft them with seals."
            Column(Modifier.padding(vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(h, style = t(17f, FontWeight.Bold)); Text(p, style = t(14f, color = Site.Muted)) }
        }
        items(tiles.take(300), key = { "pool:" + it.name }) { c ->
            PoolCard(c.name, c.image, c.rarity, c.have, DeckEdit.room(e.cards, c.name, e.format), { actions.open(c.name) }, { actions.hold(c.name) }) { actions.step(c.name, 1) }
        }
        if (ui.mode == "all" && ui.poolMore && !ui.poolBusy) item(span = { GridItemSpan(maxLineSpan) }) { GhostButton("More cards", Modifier.fillMaxWidth()) { loadPool(true) } }
    }

    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val wide = maxWidth >= 840.dp
            val pad = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp)
            if (wide) Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                LazyVerticalGrid(GridCells.Fixed(1), Modifier.weight(.95f).fillMaxHeight(), contentPadding = pad, verticalArrangement = Arrangement.spacedBy(8.dp)) { deckBlock() }
                LazyVerticalGrid(GridCells.Adaptive(118.dp), Modifier.weight(1.05f).fillMaxHeight(), contentPadding = pad, verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)) { poolBlock() }
            } else LazyVerticalGrid(GridCells.Adaptive(104.dp), Modifier.fillMaxSize(), contentPadding = pad, verticalArrangement = Arrangement.spacedBy(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)) { deckBlock(); poolBlock() }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
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

/** deckShell: the lead card's art bleeding behind the title, "Play deck" and the format, the numbers, Save deck. */
@Composable
private fun Hero(e: DeckEdit.Edit, n: DeckEdit.Numbers, toCraft: Int, art: String?, busy: Boolean, onBack: () -> Unit, onSave: () -> Unit) {
    val p = heroPainter((art?.ifBlank { null } ?: DECKS_ART).let(homeArt))
    Box(Modifier.fillMaxWidth().heightIn(min = 250.dp).softTile(26.dp)) {
        if (p != null) Image(p, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x59000000), .35f to Color(0x14000000), .7f to Color(0xE008090C), 1f to Color(0xF508090C))))
        Box(Modifier.padding(12.dp).size(44.dp).softPill(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
            Text("←", style = t(20f, FontWeight.Bold, Color(0xFFF6EEDB))) }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Play deck", style = t(12f, FontWeight.Bold, Site.GoldInk), modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(goldButtonBrush(true)).padding(horizontal = 10.dp, vertical = 4.dp))
                Text(e.format, style = t(12f, FontWeight.Bold, Color(0xFFE6E8EC)), modifier = Modifier.softPill(RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 4.dp))
            }
            Text(e.name.ifBlank { "New Play deck" }, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 30.sp, color = Color(0xFFF6EEDB)),
                maxLines = 2, overflow = TextOverflow.Ellipsis)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Stat("${n.count}/${n.size}", "cards", warn = !n.ok)
                if (toCraft > 0) Stat("$toCraft", "to craft", warn = true)
                Stat("${n.creatures}", "creatures"); Stat("${n.lands}", "lands"); Stat(n.avg, "average mana value")
            }
            GoldCta(if (busy) "Saving…" else "Save deck", Modifier.fillMaxWidth(), enabled = !busy && n.count > 0, onClick = onSave)
        }
    }
}

@Composable
private fun Stat(value: String, label: String, warn: Boolean = false) = Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(value, style = t(16f, FontWeight.ExtraBold, if (warn) Warn else Color.White)); Text(label, style = t(12f, color = Color(0xFFC4C9D2)))
}

@Composable
private fun Meta(ui: EditorUi) = Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.weight(1f)) { Field(ui.edit.name, "Deck name") { ui.edit = ui.edit.copy(name = it.take(80), dirty = true) } }
    Select("Format", Decks.PLAY_FORMATS.map { it to it }, ui.edit.format) { ui.edit = ui.edit.copy(format = it, dirty = true) }
}

/** Craft all: the seals the missing cards need (short ones in amber), then the web's four button states. */
@Composable
private fun CraftAllBar(plan: DeckEdit.Plan, ui: EditorUi, onCraft: () -> Unit) {
    // Two lines on a phone: the seals the deck needs, then the button full width, so no count is ever cut by it (Randall 3 Nov 20:51Z).
    Column(Modifier.fillMaxWidth().softTile(18.dp, if (AppSettings.theme == "light") Color(0xF2FFFFFF) else Color(0xCC0D0F14)).padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Seals needed", style = t(13f, FontWeight.SemiBold, Site.Muted), modifier = Modifier.weight(1f), maxLines = 1)
            for (k in listOf("c", "u", "r", "m")) { val need = plan.need[k] ?: 0; if (need == 0) continue
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { SealMini(k, 20.dp)
                    Text("$need", style = t(14f, FontWeight.Bold, if (need > (plan.have[k] ?: 0)) Warn else Ink), maxLines = 1, softWrap = false) } }
        }
        GoldCta(if (ui.crafting) "Crafting…" else if (ui.armed) "Craft ${plan.craftable} now" else if (plan.craftable < plan.missing) "Craft ${plan.craftable} of ${plan.missing}" else "Craft all",
            Modifier.fillMaxWidth(), enabled = plan.craftable > 0 && !ui.crafting, onClick = onCraft)
    }
}

@Composable
internal fun PackGoals(goals: List<DeckEdit.Goal>, onPack: (String) -> Unit) = Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    for (g in goals) Row(Modifier.height(44.dp).softPill(RoundedCornerShape(22.dp)).clickable { onPack(g.code) }.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SetIcon(g.code, Modifier.size(20.dp)); Text(g.name, style = t(13.5f, FontWeight.SemiBold), softWrap = false)
        Text("${g.miss}", style = t(13.5f, FontWeight.ExtraBold, Site.Gold))
    }
}

/** .pe-build-row: art thumb, name, cost, the craft menu when copies are missing, − qty +. Missing copies sit greyed. */
@Composable
private fun DeckRow(c: DeckEdit.Line, p: DeckEdit.PlanRow?, f: CardFacts.Fact?, have: Map<String, Int>, room: Int, busy: Boolean, a: Actions) {
    val miss = p?.miss ?: 0
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x0AFFFFFF)).border(1.dp, SoftRim, RoundedCornerShape(14.dp)),
        verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.weight(1f).heightIn(min = 56.dp).combinedClickable(onLongClick = { a.hold(c.name) }) { a.open(c.name) }.padding(start = 6.dp, end = 4.dp).alpha(if (miss > 0) .6f else 1f),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val pt = heroPainter((f?.a?.ifBlank { null } ?: named(c.name, "art_crop")).let(homeArt))
            Box(Modifier.size(width = 52.dp, height = 40.dp).clip(RoundedCornerShape(10.dp)).background(Site.Surface2)) {
                if (pt != null) Image(pt, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
            // Nothing truncates: the name wraps to two lines, its cost on the first line's right.
            Row(Modifier.weight(1f), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(c.name, style = t(14f, FontWeight.SemiBold, line = 17f), maxLines = 2, modifier = Modifier.weight(1f))
                if (!f?.mc.isNullOrBlank()) ManaCost(f!!.mc, 15.dp, Modifier.padding(top = 1.dp))
            }
        }
        if (miss > 0 && p != null) CraftMenu(c.name, miss, p.seal, have[p.seal] ?: 0, f?.card?.get("set")?.asString, busy, a)
        Row(Modifier.width(110.dp), verticalAlignment = Alignment.CenterVertically) {
            StepButton("−", true) { a.step(c.name, -1) }
            Text("${c.qty}", style = t(15f, FontWeight.ExtraBold), modifier = Modifier.width(22.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            StepButton("+", room >= 1) { a.step(c.name, 1) }
        }
    }
}

@Composable
private fun StepButton(label: String, enabled: Boolean, onClick: () -> Unit) = Box(Modifier.size(44.dp).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
    Text(label, style = t(20f, FontWeight.Bold, if (enabled) Color(0xFFF6EEDB) else Color(0x4DF6EEDB)))
}

/** .pe-craft: the seal and how many are missing; open it to craft 1 to N copies, or jump to the set's packs. */
@Composable
private fun CraftMenu(name: String, miss: Int, seal: String, have: Int, set: String?, busy: Boolean, a: Actions) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(Modifier.height(32.dp).clip(RoundedCornerShape(16.dp)).background(Color(0x26E8B95B)).border(1.dp, Color(0x40E8B95B), RoundedCornerShape(16.dp)).clickable { open = true }
            .padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            SealMini(seal.ifEmpty { "c" }, 16.dp); Text("$miss", style = t(13f, FontWeight.ExtraBold))
        }
        DropdownMenu(open, { open = false }, containerColor = Site.Surface2) {
            if (!set.isNullOrBlank()) DropdownMenuItem({ Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SetIcon(set, Modifier.size(18.dp)); Text("Get packs", style = t(14f)) } }, { open = false; a.pack(set) })
            for (k in 1..miss) DropdownMenuItem({ Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SealMini(seal.ifEmpty { "c" }, 18.dp); Text("Craft $k", style = t(14f, FontWeight.SemiBold)) } },
                { open = false; a.craftCopies(name, k) }, enabled = seal.isNotEmpty() && k <= have && !busy)
        }
    }
}

/** .pe-basics: the five basics, free and unlimited; tap adds one. */
@Composable
private fun BasicsRow(step: (String, Int) -> Unit) = Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    for (b in BASICS) {
        val p = heroPainter(named(b, "art_crop").let(homeArt))
        Box(Modifier.weight(1f).height(64.dp).softTile(14.dp).clickable { step(b, 1) }) {
            if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.3f to Color.Transparent, 1f to Color(0xE008090C))))
            Text(b, style = t(11.5f, FontWeight.Bold, Color.White), modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 6.dp), maxLines = 1)
        }
    }
}

/** .pe-pool-card: the card; owned count (up to 4) or the seal it costs; + adds one (off at the copy cap). */
@Composable
private fun PoolCard(name: String, image: String, rarity: String, have: Int, room: Int, onOpen: () -> Unit, onHold: () -> Unit, onAdd: () -> Unit) {
    val missing = have == 0
    val p = heroPainter(image.let(homeArt))
    Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f)) {
        Box(Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)).background(Site.Surface2).combinedClickable(onLongClick = onHold, onClick = onOpen).alpha(if (missing) .5f else 1f)) {
            if (p != null) Image(p, name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Box(Modifier.align(Alignment.BottomStart).padding(6.dp).height(28.dp).widthIn(min = 28.dp).softPill(RoundedCornerShape(14.dp)).padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
            if (missing) SealMini(Decks.RARITY_SEAL[rarity] ?: "c", 16.dp) else Text("${minOf(have, 4)}", style = t(13f, FontWeight.ExtraBold))
        }
        Box(Modifier.align(Alignment.BottomEnd).padding(4.dp).size(40.dp).clip(CircleShape).background(if (room >= 1) goldButtonBrush(true) else goldButtonBrush(false))
            .clickable(enabled = room >= 1, onClick = onAdd), contentAlignment = Alignment.Center) {
            Text("+", style = t(20f, FontWeight.ExtraBold, if (room >= 1) Site.GoldInk else Color(0x80FFFFFF)))
        }
    }
}
