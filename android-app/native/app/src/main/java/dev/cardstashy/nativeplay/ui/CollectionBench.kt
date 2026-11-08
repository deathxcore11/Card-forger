package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.focus.focusProperties
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.google.gson.JsonArray
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withPermit
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.match.PowerTier
import dev.cardstashy.nativeplay.play.Trunk

private val BASIC_NAMES = listOf("Plains", "Island", "Swamp", "Mountain", "Forest")
private fun namedArt(name: String) = "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(name, "UTF-8").replace("+", "%20")
/** A Scryfall picture's art crop (the strip's background), else the picture itself. */
private fun artCrop(src: String?) = src?.takeIf { "cards.scryfall.io/" in it }?.replace(Regex("cards\\.scryfall\\.io/(normal|large|small|png)/"), "cards.scryfall.io/art_crop/")
    ?.replace(Regex("\\.png(\\?|$)"), ".jpg$1") ?: src
/** The site's mana symbol pictures (svgs.scryfall.io/card-symbols/R.svg) as a cost string ManaCost draws ({R}). */
private fun costOf(mana: List<Pair<String, String>>) = mana.joinToString("") { (src, _) -> "{" + src.substringAfterLast('/').substringBefore('.').substringBefore('?') + "}" }
private val COLOURS = setOf("W", "U", "B", "R", "G")
/** The copies a row still needs, from the page's own words ("1/4 owned · need 3", "Need 1"); all of them when it says no number. */
private fun needOf(owned: Boolean, own: String?, qty: Int) = if (owned) 0 else Regex("(?i)need (\\d+)").find(own.orEmpty())?.groupValues?.get(1)?.toIntOrNull() ?: qty

/**
 * Deck Bench's strip tints for Yu-Gi-Oh! and Pokémon (spec: "Tints follow attribute (YGO) or type (PTCG)"), on the Bench's five
 * washes: Attributes and energy types to the nearest of them; Earth, Metal and Colorless stay grey; Divine and Dragon go gold.
 */
private val TCG_TINT = mapOf(
    "LIGHT" to "W", "DARK" to "B", "WATER" to "U", "FIRE" to "R", "WIND" to "G", "EARTH" to "", "DIVINE" to "*", "Spell" to "G", "Trap" to "B",
    "Grass" to "G", "Fire" to "R", "Water" to "U", "Lightning" to "W", "Psychic" to "B", "Fighting" to "R", "Darkness" to "B", "Metal" to "",
    "Fairy" to "W", "Dragon" to "*", "Colorless" to "")
private fun tcgTint(t: List<String>): List<String> {
    val k = t.mapNotNull { TCG_TINT[it] }
    return if ("*" in k) listOf("W", "R") else k.filter { it.isNotEmpty() }.distinct()
}

/** The engine's text and flags, null-safe (it sends null for what isn't there yet). */
private fun JsonObject?.jstr(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonObject?.jflag(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean

private val ALL_TYPES = mapOf("Creatures" to "t:creature", "Spells" to "-t:creature -t:land", "Lands" to "t:land")
/** Scryfall's format names (legal:...); a deck in any other format searches every paper card. */
private val SCRYFALL_FORMATS = setOf("standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander", "brawl", "standardbrawl", "historic",
    "timeless", "alchemy", "explorer", "oathbreaker", "penny", "duel", "premodern", "oldschool", "predh", "gladiator", "paupercommander", "future")

/** The page's tools that the Bench has no other place for, as the action row's pills (views.js deckPage's table, tcg.js's price panel). */
private class Tool(val label: String, val act: String, val id: String)

/**
 * A deck of the Collection in Deck Bench (specs/deck-editor-native.md): the deck page's own model (views.js deckPage, tcg.js tcgDeck
 * through CollectionEngine.deck) drawn as the Bench, with the collection as its browser (CollectionEngine.benchPool). Every number is
 * the page's: the hero's cards, owned, open slots or $ to finish and Power; the roles; each row's "1/4 owned · need 3". The − / + and
 * drops save at once through the site's handlers (app.js deckQty / deckAdd; tcg.js tDeckQty / tDeckAdd / tDeckMove), as the page's
 * steppers do, so the gold button is the page's own first action (Practice; War Chest for Yu-Gi-Oh! and Pokémon) instead of Save.
 */
@Composable
fun CollectionBench(m: CollectionDeckModel, pool: JsonArray?, ui: BenchUi, act: CollectionDeckActions, tab: (String) -> Boolean,
                    /** A tab the Bench draws here (the controller's LB/RB step only through these; the rest open the website). */
                    drawn: (String) -> Boolean = { true }, tabBody: @Composable (String) -> Unit) {
    if (m.game != CardGame.MTG) { TcgBench(m, pool, ui, act, tab, drawn, tabBody); return }
    val inDeck = remember(m) { HashMap<String, Int>().apply { m.groups.forEach { g -> g.cards.forEach { c -> merge(c.r.name, c.qty, Int::plus); merge(c.r.name.split(" // ")[0], c.qty, Int::plus) } } } }
    val names = remember(m) { m.groups.flatMap { g -> g.cards.map { it.r.name } }.toSet() }
    fun countIn(n: String) = inDeck[n] ?: inDeck[n.split(" // ")[0]] ?: 0
    fun inList(n: String) = n in names || n.split(" // ")[0] in names
    val groups = m.groups.filter { it.cards.isNotEmpty() }.map { g -> BenchGroup(g.name, g.cards.map { c ->
        BenchRow(c.r.name, c.qty, needOf(c.owned, c.own, c.qty), "", artCrop(c.r.art) ?: namedArt(c.r.name), c.r.art ?: "", costOf(c.r.mana),
            c.chromeEmb.map { (src, _) -> src.substringAfterLast('/').substringBefore('.') }.filter { it in COLOURS },
            c.r.set?.code.orEmpty(), "", c.chromeRarity, c.roles, note = if (c.owned) "" else c.own.orEmpty())
    }) } + listOfNotNull(m.side?.takeIf { it.rows.isNotEmpty() }?.let { sd -> BenchGroup("Sideboard", sd.rows.map { r ->
        // mtgSideboard's .mini-row: "2× Name" and what is still to get ("Need 2"); a tap opens the card, as on the page.
        BenchRow(r.name, r.qty, needOf(r.ok, r.own, r.qty), "", artCrop(r.art) ?: namedArt(r.name), r.art ?: "", "", emptyList(), "", "", "", r.roles,
            note = if (r.ok) "" else r.own.orEmpty(), fixed = true)
    }) })
    val b = ui
    val tiles = pool?.mapNotNull { e -> val o = e as? JsonObject ?: return@mapNotNull null
        val n = o.get("name")?.asString ?: return@mapNotNull null
        val type = o.get("type")?.asString.orEmpty(); val g = Trunk.group(type); val basic = Decks.isBasicLand(n); val q = countIn(n)
        if (basic && q == 0) return@mapNotNull null
        val colors = (o.get("colors") as? JsonArray)?.mapNotNull { it.takeIf { c -> c.isJsonPrimitive }?.asString }.orEmpty()
        if (b.find.isNotBlank() && !n.contains(b.find.trim(), ignoreCase = true)) return@mapNotNull null
        if (b.colors.isNotEmpty() && colors.none { it in b.colors }) return@mapNotNull null
        if (!when (b.type) { "Creatures" -> g == "Creatures"; "Lands" -> g == "Lands"; "Spells" -> g != "Creatures" && g != "Lands"; else -> true }) return@mapNotNull null
        // The site's deck editing has no copy cap (core.js mergeDeckCard), so + stays on.
        BenchTile(n, o.get("image")?.asString.orEmpty().ifBlank { namedArt(n).replace("art_crop", "normal") }, o.get("cmc")?.asDouble ?: 0.0, g == "Lands", basic, q,
            o.get("own")?.asInt ?: 0, Int.MAX_VALUE, false) }.orEmpty()
    // All cards (Randall 6 Nov 21:43Z, as Play's .yc Your cards / All cards): every card legal in the format from Scryfall, the same
    // search as Play's pool (DeckEditor poolQuery), so a deck can take cards not owned yet; those show grey, "To buy". The site's
    // deck page adds any card by name too (A.deckAdd, Find <format> cards).
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var mode by remember(m.id) { mutableStateOf("mine") }
    var all by remember(m.id) { mutableStateOf(listOf<JsonObject>()) }
    var allBusy by remember { mutableStateOf(false) }; var allError by remember { mutableStateOf("") }
    var allMore by remember { mutableStateOf(false) }; var allPage by remember { mutableStateOf(1) }; var allKey by remember { mutableStateOf("") }
    val ownBy = remember(pool) { HashMap<String, Int>().apply { pool?.forEach { e -> (e as? JsonObject)?.let { o -> val n = o.get("name")?.asString ?: return@let
        val k = o.get("own")?.asInt ?: 0; merge(n, k, Int::plus); if (" // " in n) merge(n.split(" // ")[0], k, Int::plus) } } } }
    fun allQuery(find: String = b.find, colors: Set<String> = b.colors, type: String = b.type): String {
        val q = mutableListOf("game:paper")
        m.format.lowercase().takeIf { it in SCRYFALL_FORMATS }?.let { q += "legal:$it" }
        find.trim().replace(Regex("[\"\\\\]"), "").takeIf { it.isNotEmpty() }?.let { q += "name:\"$it\"" }
        if (colors.isNotEmpty()) q += colors.joinToString(" or ", "(", ")") { "c:" + it.lowercase() }
        ALL_TYPES[type]?.let { q += it }
        return q.joinToString(" ")
    }
    fun loadAll(more: Boolean = false) {
        if (mode != "all") return
        val key = allQuery()
        if (allBusy && allKey == key && !more) return
        if (!more) { allKey = key; all = emptyList(); allPage = 1 }
        allBusy = true; allError = ""
        scope.launch {
            val r = dev.cardstashy.nativeplay.play.CardFacts.search(key, "edhrec", allPage)
            if (key != allKey) return@launch
            if (r == null) allError = "Check your connection and try again." else { all = all + r.first; allMore = r.second; allPage += 1 }
            allBusy = false
        }
    }
    // All cards with nothing typed is shelves (AllShelves.kt, as Play's); a search looks through every card, a page at a time.
    LaunchedEffect(mode, b.find, b.colors, b.type, m.format) { if (mode == "all" && b.find.isNotBlank()) { if (allKey.isNotEmpty()) kotlinx.coroutines.delay(350); loadAll() } }
    val shelves = remember(m.id) { MagicShelves(scope) }
    val facts by dev.cardstashy.nativeplay.play.CardFacts.cards.collectAsState()
    val shelfBase = allQuery("")
    // The deck's colours, worked out off the main thread (the facts map grows with every shelf that lands).
    val identity by androidx.compose.runtime.produceState<String?>(null, facts, names) { value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { deckIdentity(names.filterNot(Decks::isBasicLand)) } }
    val shelfFit = allQuery("", emptySet(), "All") + " -t:land" + (identity?.let { " id<=$it" } ?: "")
    LaunchedEffect(mode, shelfBase, shelfFit) { if (mode == "all") { shelves.use(shelfBase, shelfFit); shelves.start() } }
    LaunchedEffect(mode) { if (mode == "all") androidx.compose.runtime.snapshotFlow { ui.tileGrid.layoutInfo.let { it.visibleItemsInfo.lastOrNull()?.index to it.totalItemsCount } }
        .collect { (last, total) -> if (last != null && total > 0 && last >= total - 6 && allMore && !allBusy) loadAll(true) } }
    fun str(o: JsonObject?, k: String) = o?.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
    fun allTile(c: JsonObject): BenchTile { val n = str(c, "name"); val have = ownBy[n] ?: ownBy[n.split(" // ")[0]] ?: 0
        val face = (c.get("card_faces") as? JsonArray)?.firstOrNull() as? JsonObject
        val img = str(c.get("image_uris") as? JsonObject, "normal").ifBlank { str(face?.get("image_uris") as? JsonObject, "normal") }.ifBlank { namedArt(n).replace("art_crop", "normal") }
        return BenchTile(n, img, c.get("cmc")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0, Trunk.group(str(c, "type_line").ifBlank { str(face, "type_line") }) == "Lands",
            Decks.isBasicLand(n), countIn(n), have, Int.MAX_VALUE, have == 0, lockWord = "To buy") }
    val allTiles = if (mode != "all") emptyList() else all.map(::allTile)
    // The hero's "owned" (covered/copies) gives the copies still to get; its Power stat is the badge.
    val owned = m.stats.firstOrNull { it.label == "owned" }?.value?.split('/')?.mapNotNull { it.trim().toIntOrNull() }
    val missing = if (owned?.size == 2) (owned[1] - owned[0]).coerceAtLeast(0) else 0
    val powerStat = m.stats.firstOrNull { it.act == "deckTab" }
    // The deck page's table (Take it to the table) and the hero's other buttons; Copy list and Export are in the ⋯ menu, War Chest is a tab.
    // Share and War Chest are the hero's buttons (as views.js deckShell has them); Game Night is in the War Chest, Share in the ⋯ menu too,
    // and "I got cards" goes (Randall 6 Nov 21:42Z: no double-ups). What stays is the page's fill (Find <format> cards) and its swaps.
    val tools = (m.actions.filter { it.shown && !it.primary && it.label.isNotBlank() && it.act != "deckTab" }.map { Tool(it.label, it.act, it.id) } +
        m.table?.actions.orEmpty().filter { (_, a, _) -> a != "deckTab" }.map { (l, a, _) -> Tool(l, a, "") })
        .filter { it.act !in setOf("deckCopy", "deckExport", "deckPlayCpu", "deckShare", "gameNight", "acquire") }.distinctBy { it.act }
    val heroButtons = m.actions.filter { it.shown && !it.primary && it.label.isNotBlank() && (it.act == "deckTab" || it.act == "deckShare") }.map { b ->
        BenchMenuItem(b.label) { if (b.act == "deckTab") { if (tab(b.id)) ui.tab = b.id } else act.act(b.act, b.id) } }
    val model = heroModel(m, powerStat).let { h -> BenchModel(
        play = false, modeChip = h.modeChip, formatChip = h.formatChip.ifBlank { "Magic · ${m.format}" }, title = m.title, heroArt = m.art,
        stats = h.stats, power = h.power, tier = PowerTier.powerTier(h.power?.toDoubleOrNull()), roles = m.roles,
        groups = groups, basics = BASIC_NAMES.map { it to namedArt(it) }, browserTitle = if (mode == "all") "All cards" else "Collection", tiles = if (mode == "all") allTiles else tiles,
        browserNote = if (mode == "all") (if (allBusy && all.isEmpty()) "Looking through every card…" else allError.ifEmpty { null })
            else if (pool == null) "Opening your collection…" else if (pool.size() == 0) "No cards in your collection yet." else null,
        footLead = missingLine(missing), wallet = null, footRight = "${names.size} unique", busy = false, canSave = true,
        tabs = m.tabs.map { it.key to it.label }, powerLabel = h.powerLabel, powerTab = h.powerTab,
        chips = m.eyebrow.filter { it.kind == "review" && it.label.isNotBlank() }.map { BenchChip(it.label, it.level == "bad" || it.level == "warn", it.act.ifBlank { "deckReview" }) },
        findMore = m.addLabel.ifBlank { null }, listNote = m.commanderNote?.ifBlank { null },
        shelves = if (mode != "all") null else if (shelves.ready) shelves.shelves(::allTile, { n -> countIn(n) > 0 }, "For this deck", "Most played in your colours", stamp = m.groups to ownBy) else emptyList(),
        shelvesGen = shelves.gen,
    ) }
    // The page's Practice (A.deckPlayCpu) where Play has Save: each change here already saves.
    val practice = m.actions.firstOrNull { it.act == "deckPlayCpu" }
    val actions = BenchActions(back = act.back, save = practice?.let { p -> { act.act(p.act, p.id) } }, saveLabel = practice?.label?.ifBlank { null } ?: "Practice",
        step = { n, d -> if (d > 0 && !inList(n)) act.addCard(n) {} else if (inList(n)) act.qty(n, d) },
        craft = { _, _ -> }, open = act.card, more = null, menu = emptyList(), menuOpen = { act.act("deckMenu", "") }, tab = tab, drawn = drawn, chip = { k -> act.act(k, m.id) },
        findMore = { q -> act.addCard(q) {} }, heroActions = heroButtons, shelf = { k -> shelves.load(k) }, shelfMore = { k -> shelves.more(k) })
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        DeckBench(model, ui, actions, actionRow = toolRow(tools, m.emblems?.swaps.orEmpty(), { t -> act.act(t.act, t.id) }) { s -> act.swap(s.out, s.into) },
            browserSwitch = { BenchSwitch(listOf("mine" to "Owned", "all" to "All cards"), mode) { mode = it } }, tabBody = tabBody)
    }
}

/** The hero's parts as the page has them: its chips, its stats but Power, and Power as the badge (the stat's button opens its tab). */
private class Hero(val modeChip: String, val formatChip: String, val stats: List<BenchStat>, val power: String?, val powerLabel: String, val powerTab: String?)
private fun heroModel(m: CollectionDeckModel, powerStat: DeckStat?) = Hero(
    m.eyebrow.firstOrNull { it.kind == "chip" && it.badge }?.label ?: "My deck",
    m.eyebrow.firstOrNull { it.kind == "chip" && !it.badge }?.label.orEmpty(),
    m.stats.filter { it !== powerStat }.map { BenchStat(it.value, it.label, it.warn) },
    powerStat?.value?.takeIf { it.toDoubleOrNull() != null },
    powerStat?.label?.ifBlank { null } ?: "power",
    powerStat?.takeIf { it.button }?.id?.ifBlank { null })

private fun missingLine(n: Int) = buildAnnotatedString {
    withStyle(SpanStyle(color = Site.Text, fontWeight = FontWeight.Bold)) { append("$n") }; append(if (n == 1) " card missing" else " cards missing") }

/** The action row: the page's tools, then its staple swaps ("Out → In", the site's Swap). Null when there are none. */
private fun toolRow(tools: List<Tool>, swaps: List<DeckSwap>, tap: (Tool) -> Unit, swap: (DeckSwap) -> Unit): (@Composable RowScope.() -> Unit)? =
    if (tools.isEmpty() && swaps.isEmpty()) null else ({
        for (t in tools) BenchPill(t.label) { tap(t) }
        for (s in swaps) BenchPill("${s.out} → ${s.into}", desc = "${s.button}: ${s.out} for ${s.into}. ${s.why}") { swap(s) }
    })

/**
 * A Yu-Gi-Oh! or Pokémon deck in the Bench (tcg.js tcgDeck's Cards tab). Its zones as the page lists them (Main / Extra / Side;
 * Pokémon's one Deck), the main zone in the page's type groups (deck-viewer.js stackList: Monsters / Spells / Traps; Pokémon /
 * Trainers / Energy); each row's emblems where Magic has its cost; the browser is the game's collection by type, with the format's
 * copy limit as the diamonds (SOURCES[G].limit, which tcg.js addToDeck checks). The row's ± and → side are tcg.js tDeckQty and
 * tDeckMove on that row; a card from the browser is tDeckAdd, which puts it in its zone. A search the collection doesn't answer is
 * the page's Find (A.tDeckFind), its results shown first in the browser; "n to fix" opens the page's Rules review.
 */
@Composable
private fun TcgBench(m: CollectionDeckModel, pool: JsonArray?, ui: BenchUi, act: CollectionDeckActions, tab: (String) -> Boolean, drawn: (String) -> Boolean, tabBody: @Composable (String) -> Unit) {
    val ygo = m.game == CardGame.YGO
    val order = if (ygo) listOf("Monsters", "Spells", "Traps") else listOf("Pokémon", "Trainers", "Energy")
    val cards = remember(m) { m.groups.flatMap { it.cards } }
    val inDeck = remember(m) { HashMap<String, Int>().apply { cards.forEach { merge(it.cardId, it.qty, Int::plus) } } }
    fun keyOf(c: DeckCard) = if (c.zone == "side") "side:" + c.cardId else c.cardId
    fun rowOf(c: DeckCard) = BenchRow(c.r.name, c.qty, needOf(c.owned, c.own, c.qty), "", c.r.art ?: "", c.r.art ?: "", "", tcgTint(c.tint),
        c.tcgSet?.code.orEmpty(), "", c.tcgSet?.rarity.orEmpty(), c.roles, note = if (c.owned) "" else c.own.orEmpty(),
        key = keyOf(c), ref = c.cardId, emb = c.tcgEmb, move = c.move, flags = c.legal)
    // The main zone by type, in the page's order; the Extra and Side Decks as the page names them.
    val groups = m.groups.filter { it.cards.isNotEmpty() }.flatMap { g ->
        if (g.cards.first().zone == "main") g.cards.groupBy { it.category }.toList().sortedBy { (k, _) -> order.indexOf(k).let { if (it < 0) order.size else it } }
            .map { (k, v) -> BenchGroup(k, v.map(::rowOf)) }
        else listOf(BenchGroup(g.name, g.cards.map(::rowOf)))
    }
    val owned = remember(pool) { HashMap<String, Int>().apply { pool?.forEach { e -> (e as? JsonObject)?.let { o -> put(o.get("id")?.asString.orEmpty(), o.get("own")?.asInt ?: 0) } } } }
    val defaultCap = if (ygo) 3 else 4
    val find = ui.find.trim()
    // The page's Find results (.add-results): first in the browser, headed by what was searched.
    val foundLabel = "“" + (m.find?.value?.ifBlank { null } ?: find) + "”"
    val found = m.found.orEmpty().map { f -> val q = inDeck[f.id] ?: 0
        BenchTile(f.name, f.art.firstOrNull().orEmpty(), 0.0, false, false, q, owned[f.id] ?: 0, (defaultCap - q).coerceAtLeast(0), false, key = f.id, section = foundLabel, cap = defaultCap) }
    // One browser tile from the engine's (tcgBenchPool / tcgTileOf); [buy]: All cards, where a card not owned is grey, "To buy".
    fun tileOf(o: JsonObject, buy: Boolean = false, shelf: Boolean = false): BenchTile? {
        val id = o.get("id")?.asString ?: return null; val n = o.get("name")?.asString.orEmpty()
        val sect = o.get("category")?.asString.orEmpty()
        // A set shelf's Pokémon cards come brief (no type yet: "Unresolved"), so the type chips leave them in.
        if (ui.type != "All" && sect != ui.type && !(shelf && sect == "Unresolved")) return null
        val lim = o.get("limit")?.asInt ?: defaultCap; val q = inDeck[id] ?: 0; val legal = o.get("legal")?.asBoolean != false; val have = owned[id] ?: o.get("own")?.asInt ?: 0
        // tcg.js addToDeck: not legal in the format, or past its limit, and the + is off; the tag says why, as the deck rows do.
        return BenchTile(n, ((o.get("sources") as? JsonArray)?.firstOrNull()?.takeIf { it.isJsonPrimitive }?.asString)?.ifBlank { null } ?: o.get("image")?.asString.orEmpty(), 0.0, false, lim < 0, q,
            have, if (!legal) 0 else if (lim < 0) Int.MAX_VALUE else (lim - q).coerceAtLeast(0), buy && have == 0 && lim >= 0, key = id, section = sect,
            cap = if (lim < 0) 4 else lim.coerceIn(0, 4), tag = o.get("tag")?.asString.orEmpty(), tagBad = o.get("tagBad")?.asBoolean == true, lockWord = "To buy")
    }
    val tiles = pool?.mapNotNull { e -> val o = e as? JsonObject ?: return@mapNotNull null
        if (find.isNotEmpty() && !o.get("name")?.asString.orEmpty().contains(find, ignoreCase = true)) return@mapNotNull null
        tileOf(o) }.orEmpty()
    // Clearing the search closes the page's results (A.tDeckAddClose).
    LaunchedEffect(find.isEmpty()) { if (find.isEmpty() && m.found != null) act.findClose() }
    // All cards (Randall 6 Nov 21:43Z): the page's own card search (tcg.js's deck Find, every card of the game) as you type, in place
    // of the collection; cards not owned yet show grey, "To buy".
    var mode by remember(m.id) { mutableStateOf("mine") }
    LaunchedEffect(mode, find) { if (mode == "all" && find.length >= 2 && find != m.find?.value) { kotlinx.coroutines.delay(450); act.find(find) } }
    val allTiles = if (mode != "all") emptyList() else m.found.orEmpty().map { f -> val q = inDeck[f.id] ?: 0; val have = owned[f.id] ?: 0
        BenchTile(f.name, f.art.firstOrNull().orEmpty(), 0.0, false, false, q, have, (defaultCap - q).coerceAtLeast(0), have == 0, key = f.id, cap = defaultCap, lockWord = "To buy") }
    // All cards with nothing typed: shelves (the engine's shelvesStart), "For this deck" first, then each set newest first, a set's
    // cards loaded only when its shelf comes on screen.
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val game = m.game.id
    // The shelves follow the deck's format (its staples and what is legal): a format change starts them over.
    var shelfList by remember(m.id, m.format) { mutableStateOf<JsonObject?>(null) }
    val shelfCards = remember(m.id, m.format) { androidx.compose.runtime.mutableStateMapOf<String, JsonObject>() }
    var shelvesGen by remember(m.id) { mutableStateOf(0) }
    LaunchedEffect(m.format) { shelvesGen++ }
    suspend fun loadList() {
        shelfList = CollectionEngine.shelvesStart(game, m.id)
        CollectionEngine.settle(60_000, CollectionEngine.shelvesJs(game, m.id)) { shelfList = it }
        shelfList = CollectionEngine.shelvesModel(game, m.id)
    }
    LaunchedEffect(mode, m.id, m.format) { if (mode == "all" && shelfList == null) runCatching { loadList() } }
    // Two set shelves at a time (YGOPRODeck and the Pokémon TCG API each ask for a gentle pace).
    val shelfGate = remember { kotlinx.coroutines.sync.Semaphore(2) }
    fun done(j: JsonObject?) = j != null && j.jflag("busy") == false && j.jstr("error").isNullOrEmpty()
    /** A shelf on screen: its cards (suspends; cancelled when it scrolls away, and asked again when it comes back). */
    suspend fun loadShelf(key: String) {
        if (key == FIT_SHELF) { if ((shelfList?.get("fit") as? JsonObject).jstr("error").isNullOrEmpty()) return; runCatching { loadList() }; return }
        if (done(shelfCards[key])) return
        shelfCards.remove(key)
        try {
            shelfGate.withPermit {
                if (done(shelfCards[key])) return
                shelfCards[key] = CollectionEngine.shelfStart(game, m.id, key)
                // Drawn again only when more of its cards are in, not on every turn of the engine.
                CollectionEngine.settle(45_000, CollectionEngine.shelfJs(game, m.id, key)) { j ->
                    if ((j.get("tiles") as? JsonArray)?.size() != (shelfCards[key]?.get("tiles") as? JsonArray)?.size()) shelfCards[key] = j }
                shelfCards[key] = CollectionEngine.shelfModel(game, m.id, key)
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            // A shelf the engine is still filling keeps what it has; it shows as waiting, so it asks again when back on screen.
            val g = shelfCards[key]; if (!done(g) && !(g.jflag("busy") == true && g?.get("tiles") is JsonArray)) shelfCards.remove(key); throw e
        } catch (e: Exception) { shelfCards[key] = JsonObject().apply { addProperty("busy", false); addProperty("error", "This shelf couldn't load. Check your connection, then scroll back to try again.") } }
    }
    /** Each shelf's tiles, made again only when its cards or the deck change (a shelf landing doesn't rebuild the others). */
    val shelfTiles = remember(m.id) { HashMap<String, Triple<JsonObject, Any, List<BenchTile>>>() }
    fun tilesOf(key: String, g: JsonObject, list: List<JsonObject>): List<BenchTile> {
        val stamp = Triple(inDeck, owned, ui.type)
        shelfTiles[key]?.takeIf { it.first === g && it.second == stamp }?.let { return it.third }
        return list.mapNotNull { tileOf(it, true, shelf = true) }.also { shelfTiles[key] = Triple(g, stamp, it) }
    }
    fun objs(o: JsonObject?, k: String) = o?.get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it as? JsonObject }
    // Each set's heading (id, name, code, date), made once per list rather than on every recomposition.
    val setHeads = remember(shelfList) { objs(shelfList, "sets").orEmpty().mapNotNull { s -> val id = s.jstr("id") ?: return@mapNotNull null
        listOf(id, s.jstr("name").orEmpty(), s.jstr("code").orEmpty(), shelfDate(s.jstr("date").orEmpty())) } }
    val shelves: List<BenchShelf>? = if (mode != "all") null else shelfList?.let { l ->
        val fit = l.get("fit") as? JsonObject
        val fitTiles = objs(fit, "tiles")?.filter { (inDeck[it.jstr("id")] ?: 0) == 0 }
        listOfNotNull(fit?.let { f -> BenchShelf(FIT_SHELF, "For this deck", meta = "Tournament staples you don't play", gold = true,
            tiles = if (f.jflag("busy") == true) null else if (!f.jstr("error").isNullOrEmpty()) emptyList() else tilesOf(FIT_SHELF, f, fitTiles.orEmpty()), note = f.jstr("error").orEmpty(),
            why = fitTiles.orEmpty().associate { it.jstr("id").orEmpty() to it.jstr("why").orEmpty() }) }) +
            setHeads.map { (id, name, code, date) -> val got = shelfCards[id]
                // A busy shelf shows the tiles it has and is marked loading, so its ask isn't cancelled and made again while the engine fills it.
                val busy = got?.jflag("busy") == true; val have = got?.let { objs(it, "tiles") }
                BenchShelf(id, name, code, date,
                    tiles = got?.let { g -> if (!g.jstr("error").isNullOrEmpty()) emptyList() else if (have == null) (if (g.jflag("busy") == false) emptyList() else null) else if (busy && have.isEmpty()) null else tilesOf(id, g, have) },
                    note = got.jstr("error").orEmpty(), loading = busy && !have.isNullOrEmpty()) }
    }
    val powerStat = m.stats.firstOrNull { it.act == "tDeckTab" }
    val h = heroModel(m, powerStat)
    val missing = cards.sumOf { needOf(it.owned, it.own, it.qty) }
    var issues by remember(m.id) { mutableStateOf(false) }
    // The hero's other buttons (Export, Game Night) and the price panel's tools (Cheapest printings, Buy on TCGplayer, Refresh prices).
    // Game Night is in the War Chest (the gold button), so it isn't repeated here (Randall 6 Nov 21:42Z).
    val tools = (m.actions.filter { it.shown && !it.primary && it.label.isNotBlank() && it.act != "tDeckTab" }.map { Tool(it.label, it.act, it.id) } +
        m.panel?.actions.orEmpty().map { (bt, id) -> Tool(bt.label, bt.act, id) }).filter { it.act.isNotBlank() && it.act != "gameNight" }.distinctBy { it.act }
    val model = BenchModel(
        play = false, modeChip = h.modeChip, formatChip = h.formatChip, title = m.title, heroArt = m.art,
        stats = h.stats, power = h.power, tier = PowerTier.powerTier(h.power?.toDoubleOrNull()), roles = m.roles,
        groups = groups, basics = emptyList(), browserTitle = if (mode == "all") "All cards" else "Collection", tiles = if (mode == "all") allTiles else found + tiles,
        browserNote = if (mode == "all") (if (m.find?.busy == true) "Looking through every card…" else if (find.length < 2) (shelfList.jstr("error")?.ifBlank { null } ?: "Looking through every set…") else if (allTiles.isEmpty() && m.found != null) "No cards found." else null)
            else if (pool == null) "Opening your collection…" else if (pool.size() == 0 && found.isEmpty()) "No cards in your collection yet." else null,
        footLead = missingLine(missing), wallet = null, footRight = "${cards.map { it.cardId }.distinct().size} unique", busy = m.find?.busy == true, canSave = true,
        tabs = m.tabs.map { it.key to it.label }, powerLabel = h.powerLabel, powerTab = h.powerTab,
        chips = m.eyebrow.filter { it.kind == "review" && it.label.isNotBlank() }.map { BenchChip(it.label, it.level == "bad" || it.level == "warn", it.act.ifBlank { "tIssues" }) },
        colorFilter = false, types = listOf("All") + order, sectionOrder = listOf(foundLabel) + order,
        findMore = m.find?.button?.ifBlank { null }?.takeIf { m.find?.busy != true }, listNote = m.formatNote.ifBlank { null }, basicWord = "Basic Energy",
        shelves = shelves?.let { if (find.isEmpty()) it else null } ?: if (mode == "all" && find.isEmpty()) emptyList() else null, cardBack = game, shelvesGen = shelvesGen,
    )
    val primary = m.actions.firstOrNull { it.shown && it.primary }
    fun rows(key: String) = cards.filter { keyOf(it) == key }
    val actions = BenchActions(back = act.back, save = primary?.let { p -> { act.act(p.act, p.id) } }, saveLabel = primary?.label?.ifBlank { null } ?: "War Chest",
        step = { k, d ->
            val r = rows(k).lastOrNull()
            if (r != null) act.tcgQty(r, d) else if (d > 0 && !k.startsWith("side:")) act.foundAdd(k)
        },
        craft = { _, _ -> }, open = { k -> rows(k).firstOrNull()?.let(act.tcgRow) ?: act.tcgCard(k.removePrefix("side:")) }, more = null, menu = emptyList(),
        menuOpen = { act.act(m.menuAct, "") }, tab = tab, drawn = drawn,
        chip = { k -> if (k == "tIssues") { if (m.issues != null) issues = true } else act.act(k, m.id) },
        move = { k -> rows(k).lastOrNull()?.let(act.tcgMove) }, findMore = { q -> act.find(q) }, shelf = { k -> loadShelf(k) })
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        DeckBench(model, ui, actions, actionRow = toolRow(tools, m.emblems?.swaps.orEmpty(), { t -> act.act(t.act, t.id) }) { s -> act.tcgSwap(s.outKey, s.inKey) },
            browserSwitch = { BenchSwitch(listOf("mine" to "Owned", "all" to "All cards"), mode) { mode = it } }, tabBody = tabBody)
        // tcg.js A.tIssues: the page's Rules review, open, over the Bench; a tap outside or on its summary closes it.
        if (issues) m.issues?.let { (sum, items) ->
            // The scrim is no stop for the d-pad (a tap outside still closes it); the panel's summary is its focusable close.
            Box(Modifier.fillMaxSize().background(Color(0xB8050609)).focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) { issues = false }, contentAlignment = Alignment.Center) {
                IssuesPanel(sum, items, true, { issues = false }, Modifier.padding(20.dp).widthIn(max = 520.dp).fillMaxWidth()
                    .background(Color(0xFA14161D), RoundedCornerShape(14.dp)).border(1.dp, Color(0x33E5C47E), RoundedCornerShape(14.dp)))
            }
        }
    }
}
