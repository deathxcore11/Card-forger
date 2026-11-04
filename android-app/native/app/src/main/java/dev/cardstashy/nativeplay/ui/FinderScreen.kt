package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.CraftRarity
import dev.cardstashy.nativeplay.play.DeckEdit
import dev.cardstashy.nativeplay.play.DeckEngine
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.Finder
import dev.cardstashy.nativeplay.play.MetaLists
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.Trunk
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * "Build a deck" (play-deck-finder.js finderMarkup, web finder branch): format tabs and Start empty,
 * All decks / In Trunk / Craftable now with counts, Closest to owned or Most played, deck or card search;
 * then archetypes, each led by the list closest to your Trunk with its cards, seal costs and status,
 * the other lists of the archetype folded under it. The first row is Deck Forge's build from the Trunk.
 */
class FinderUi {
    var format by mutableStateOf("Standard")
    var filter by mutableStateOf("all")
    var sort by mutableStateOf("owned")
    var query by mutableStateOf("")
    var limit by mutableStateOf(8)
    var busy by mutableStateOf(false)
    var error by mutableStateOf("")
    var lists by mutableStateOf<List<Finder.MetaList>?>(null)
    /** The format [lists] belong to: coming back from the editor keeps them instead of loading again. */
    var loadedFor = ""
    /** The list open in the deck view (See the cards). */
    var open by mutableStateOf<Finder.MetaList?>(null)
    var crafting by mutableStateOf(false)
    var armed by mutableStateOf(false)
    val seen = HashSet<String>()
}

private val Ink get() = Site.Text
private val Warn = Color(0xFFFFB86B)
private val Ok = Color(0xFF8FD19E)
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
private val BASIC_COLOR = mapOf("Plains" to "W", "Island" to "U", "Swamp" to "B", "Mountain" to "R", "Forest" to "G", "Wastes" to "C")

@Composable
fun FinderScreen(state: JsonObject, ui: FinderUi, onBack: () -> Unit, onUse: (DeckEdit.Edit, Boolean) -> Unit, onCard: (String) -> Unit,
                 toast: (String) -> Unit = {}, onPack: (String) -> Unit = {}, nav: @Composable () -> Unit) {
    val scope = rememberCoroutineScope()
    val trunk = remember(state) { Trunk.cards(state) }
    val owned = remember(trunk) { Finder.ownedByName(trunk) }
    val facts by CardFacts.cards.collectAsState()
    val low by CraftRarity.low.collectAsState()
    val rarityBusy by CraftRarity.busy.collectAsState()
    val factByName = remember(facts) { facts.values.flatMap { f -> val n = f.card.get("name")?.asString ?: ""; listOf(n to f.card, n.split(" // ")[0] to f.card) }.toMap() }
    val ownedFact = remember(trunk, facts) { trunk.mapNotNull { c -> facts[c.o]?.card?.let { f -> (f.get("name")?.asString ?: "") to f } }.toMap() }
    fun cardOf(n: String): JsonObject? = factByName[n] ?: ownedFact[n] ?: ownedFact[n.split(" // ")[0]]
    val seals = state.getAsJsonObject("wallet").let { w -> listOf("c", "u", "r", "m").associateWith { k -> w?.get("seal_$k")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0 } }

    // loadFinder: card facts for the Trunk, the format's meta lists, the Trunk build, then cheapest rarities in the background.
    LaunchedEffect(ui.format, trunk) {
        if (ui.loadedFor != ui.format || ui.lists == null) {
            ui.busy = true; ui.error = ""; ui.lists = null
            CardFacts.want(trunk.map { it.o to it.pid })
            val meta = MetaLists.load(ui.format)
            val forged = DeckEngine.forgeTrunk(ui.format, trunk, CardFacts.cards.value)
            if (meta == null) ui.error = "Meta lists for this format could not load right now. Your Trunk build is still here."
            ui.lists = listOfNotNull(forged) + (meta ?: emptyList()); ui.loadedFor = ui.format
            ui.busy = false
        }
        val meta = ui.lists?.filter { !it.trunk }
        CraftRarity.want((meta ?: emptyList()).flatMap { l -> l.cards.map { it.name } }.filter { (owned[it] ?: 0) == 0 })
    }
    val lists = ui.lists ?: emptyList()
    val clusters = remember(lists) { Finder.clusterArchetypes(lists) }
    // rarityOf as finderRefresh: the cheapest rarity, pending while it loads, else the printing's (rare when Scryfall has none).
    val rarityOf = { n: String -> CraftRarity.rarity(n).ifEmpty { if (rarityBusy && !CraftRarity.missed(n)) "" else cardOf(n)?.get("rarity")?.asString ?: (if (CraftRarity.missed(n)) "rare" else "") } }
    val every = remember(lists, owned, ui.sort, ui.query, low, rarityBusy, seals) { Finder.rankFinderLists(lists, owned, ui.sort, ui.query, "all", rarityOf, seals, clusters) }
    val ranked = remember(every, ui.filter) { if (ui.filter == "all") every else Finder.rankFinderLists(lists, owned, ui.sort, ui.query, ui.filter, rarityOf, seals, clusters) }
    val counts = mapOf("all" to every.size, "trunk" to every.count { it.s.complete }, "craftable" to every.count { it.s.complete || it.s.status == "craftable" })
    val archs = remember(ranked) { Finder.finderArchetypes(ranked, clusters) }
    val top = archs.take(ui.limit)
    LaunchedEffect(top.map { it.lead.list.key }) { CardFacts.wantNames(top.flatMap { a -> a.lead.list.cards.map { it.name } }) }
    val rows = top.map { a -> a to Finder.finderRow(a.lead.list, owned, ::cardOf, seals) { CraftRarity.rarity(it) } }

    // playFinderUse: the list opens in the editor as a new deck (rows merged by name).
    fun use(l: Finder.MetaList, complete: Boolean) {
        val merged = LinkedHashMap<String, Int>(); for (r in l.cards) merged[r.name] = (merged[r.name] ?: 0) + maxOf(1, r.qty)
        onUse(DeckEdit.Edit(null, l.name.take(80), l.format, merged.map { DeckEdit.Line(it.key, it.value) }, dirty = true), complete)
    }

    ui.open?.let { l ->
        androidx.activity.compose.BackHandler { ui.open = null }
        val row = remember(l, owned, facts, low, seals) { Finder.finderRow(l, owned, ::cardOf, seals) { CraftRarity.rarity(it) } }
        LaunchedEffect(l.key) { CardFacts.wantNames(l.cards.map { it.name }) }
        val arch = remember(l, clusters) { clusters.of(l.key)?.name?.takeIf { it.isNotEmpty() } }
        val missing = row.shortfall.missing.sumOf { it.need }
        val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
        val sets by dev.cardstashy.nativeplay.play.SetFacts.sets.collectAsState()
        val goals = remember(row, sets) {
            val plan = DeckEdit.craftPlan(l.cards.groupBy { it.name }.map { (n, r) -> DeckEdit.Line(n, r.sumOf { maxOf(1, it.qty) }) }, owned, rarityOf, state.getAsJsonObject("wallet"))
            DeckEdit.packGoals(plan) { n -> cardOf(n)?.let { c -> val code = c.get("set")?.asString ?: ""; code to (sets[code]?.name ?: c.get("set_name")?.asString ?: code.uppercase()) } }
        }
        val actions = listOfNotNull(
            DeckAction(if (row.complete) "Use deck" else "Build it") { use(l, row.complete) },
            // Craft all from the deck page: one tap arms it (5 s), the second spends seals at each card's cheapest rarity.
            if (missing > 0 && row.status == "craftable") DeckAction(if (ui.crafting) "Crafting…" else if (ui.armed) "Craft $missing now" else "Craft all $missing", enabled = !ui.crafting) {
                if (!ui.armed) { ui.armed = true; scope.launch { delay(5000); ui.armed = false } }
                else { ui.armed = false; ui.crafting = true
                    scope.launch { var made = 0
                        try { for (m in row.shortfall.missing) { val id = CraftRarity.id(m.name).ifEmpty { cardOf(m.name)?.get("id")?.asString ?: "" }
                            if (id.isNotEmpty()) repeat(m.need) { if (runCatching { dev.cardstashy.nativeplay.play.Progress.craft(id) }.isSuccess) made++ } } }
                        finally { ui.crafting = false }
                        toast(if (made > 0) "$made card${if (made > 1) "s" else ""} crafted into your Trunk." else "Not enough seals for these cards yet.") } }
            } else null,
            DeckAction("Copy list") { val rows = LinkedHashMap<String, Int>(); for (r in l.cards) rows[r.name] = (rows[r.name] ?: 0) + maxOf(1, r.qty)
                clipboard.setText(androidx.compose.ui.text.AnnotatedString(rows.entries.joinToString("\n") { "${it.value} ${it.key}" })); toast("List copied.") })
        DeckView(row, arch ?: row.name, ::cardOf, onBack = { ui.open = null }, actions = actions, onCard = onCard,
            goals = { if (goals.isNotEmpty()) PackGoals(goals, onPack) }, nav = nav)
        return
    }
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                Column(Modifier.windowInsetsPadding(WindowInsets.statusBars), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    PageHeader("Build a deck", "Play", onBack = onBack)
                    PlayMath.purse(state)?.let { PurseRow(it, level = PlayMath.mastery(state, it.xp)) }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Finder.FORMATS.forEach { f -> Chip(f, f == ui.format) { if (f != ui.format) { ui.format = f; ui.limit = 8 } } }
                    }
                    GhostButton("Start empty") { onUse(DeckEdit.Edit(null, "", "Standard", emptyList()), false) }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Finder.FILTERS.forEach { (k, l) -> FilterChip(k, l, counts[k], k == ui.filter, k == "craftable" && rarityBusy) { ui.filter = k; ui.limit = 8 } }
                    }
                    Select("Sort", Finder.SORTS, ui.sort, Modifier.fillMaxWidth()) { ui.sort = it; ui.limit = 8 }
                    Text("${"%,d".format(ranked.size)} deck${if (ranked.size == 1) "" else "s"}", style = t(13f, color = Site.Muted))
                    var q by remember { mutableStateOf(ui.query) }
                    LaunchedEffect(q) { delay(250); ui.query = q; ui.limit = 8 }
                    Field(q, "Deck or card name") { q = it.take(60) }
                    if (ui.error.isNotEmpty()) Text(ui.error, style = t(14f, color = Warn))
                }
            }
            if (rows.isEmpty()) item {
                if (ui.busy) Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { repeat(2) { Box(Modifier.fillMaxWidth().height(180.dp).softTile(22.dp)) } }
                else Text(when (ui.filter) { "trunk" -> "Nothing your Trunk builds yet in this format."; "craftable" -> if (rarityBusy) "Counting seals…" else "Your seals don’t finish a list here yet."
                    else -> "No decks for this format yet." }, style = t(14f, color = Site.Muted))
            }
            itemsIndexed(rows, key = { _, x -> x.second.key }) { i, (a, row) ->
                val enter = remember { ui.seen.add(row.key) }
                FinderRow(row, a, i, enter, onOpen = { ui.open = row.list }, onUse = { use(row.list, row.complete) }) { v -> use(v.list, v.s.complete) }
            }
            if (archs.size > ui.limit) item { GhostButton("More decks", Modifier.fillMaxWidth()) { ui.limit += 8 } }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

@Composable
private fun FilterChip(key: String, label: String, count: Int?, on: Boolean, busy: Boolean, onClick: () -> Unit) {
    Row(Modifier.height(40.dp).clip(RoundedCornerShape(20.dp)).background(if (on) Color(0x26E8B95B) else Color(0x0AFFFFFF))
        .border(1.dp, if (on) Brush.verticalGradient(listOf(Color(0xCCE8B95B), Color(0x66E8B95B))) else SoftRim, RoundedCornerShape(20.dp)).clickable(onClick = onClick)
        .padding(horizontal = 14.dp).alpha(if (busy) .7f else 1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (key == "trunk") Text("✓", style = t(14f, FontWeight.Bold))
        if (key == "craftable") SealMini("r", 18.dp)
        Text(label, style = t(14f, FontWeight.SemiBold))
        if (count != null) Text("%,d".format(count), style = t(12.5f, FontWeight.ExtraBold, if (on) Site.Gold else Site.Muted),
            modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(Color(0x14FFFFFF)).padding(horizontal = 7.dp, vertical = 1.dp))
    }
}

/** statusMarkup: Buildable ✓, Craftable with its seal costs, N slots to fill, the costs short in amber, or counting. */
@Composable
internal fun Status(status: String, cost: Map<String, Int>, short: Map<String, Int>, slots: Int, mini: Boolean = false) {
    val shape = RoundedCornerShape(16.dp)
    when (status) {
        "buildable" -> Row(Modifier.clip(shape).background(Color(0x1F8FD19E)).border(1.dp, Color(0x598FD19E), shape).padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Text("✓", style = t(14f, FontWeight.Bold, Ok)); Text("Buildable", style = t(14f, FontWeight.Bold, Ok)) }
        "open" -> Text("$slots slot${if (slots == 1) "" else "s"} to fill", style = t(13.5f, FontWeight.Bold), modifier = Modifier.softPill(shape).padding(horizontal = 12.dp, vertical = 6.dp))
        "pending" -> Text("•••", style = t(14f, FontWeight.Bold, Site.Muted))
        else -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            for (k in listOf("c", "u", "r", "m")) { val n = cost[k] ?: 0; if (n == 0) continue
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) { SealMini(k, if (mini) 16.dp else 18.dp)
                    Text("$n", style = t(if (mini) 12.5f else 14f, FontWeight.ExtraBold, if ((short[k] ?: 0) > 0) Warn else Ink)) } }
            if (status == "craftable") Text("Craftable", style = t(if (mini) 12.5f else 14f, FontWeight.Bold, Site.Gold))
        }
    }
}

@Composable
private fun Meter(share: Double, modifier: Modifier = Modifier, animate: Boolean = false) {
    val a = remember { Animatable(if (animate && !Motion.still) 0f else share.toFloat()) }
    LaunchedEffect(share) { a.animateTo(share.toFloat(), Site.spring()) }
    Box(modifier.height(4.dp).clip(CircleShape).background(Color(0x1FFFFFFF))) { Box(Modifier.fillMaxHeight().fillMaxWidth(a.value.coerceIn(0f, 1f)).background(goldButtonBrush(true))) }
}

/** finderRowMarkup: the archetype led by its best list, art behind, cards by group, the other lists folded below. */
@Composable
private fun FinderRow(row: Finder.Row, arch: Finder.Archetype, index: Int, enter: Boolean, onOpen: () -> Unit, onUse: () -> Unit, onVariant: (Finder.Ranked) -> Unit) {
    val title = arch.name.ifEmpty { row.name }
    val sub = listOf(if (title != row.name) row.name else "", if (row.source == "Meta") "" else row.source, row.detail).filter { it.isNotEmpty() }.joinToString(" · ")
    val rise = remember { Animatable(if (enter && !Motion.still) 1f else 0f) }
    LaunchedEffect(Unit) { if (rise.value > 0f) { delay(40L * index); rise.animateTo(0f, Site.spring()) } }
    val p = heroPainter(row.cover.ifEmpty { null }?.let(homeArt))
    Box(Modifier.fillMaxWidth().graphicsLayer { translationY = rise.value * 40.dp.toPx(); alpha = 1f - rise.value }.softTile(24.dp).animateContentSize(Site.spring())) {
        if (p != null) Image(p, null, Modifier.matchParentSize().alpha(.62f), contentScale = ContentScale.Crop)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x330D0F14), .35f to Color(0x990D0F14), 1f to Color(0xF20D0F14))))
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                        (row.colors.ifEmpty { listOf("C") }).forEach { Symbol(it, 22.dp) }
                        if (arch.size > 1) Text("${arch.size}", style = t(12f, FontWeight.ExtraBold, Site.Gold), modifier = Modifier.padding(start = 6.dp).softPill(RoundedCornerShape(10.dp)).padding(horizontal = 7.dp, vertical = 1.dp))
                    }
                    Text(title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 19.sp, lineHeight = 23.sp, color = Color(0xFFF6EEDB)))
                    if (sub.isNotEmpty()) Text(sub, style = t(13f, color = Color(0xFFC4C9D2)))
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("${row.cardsHave}/${row.size}", style = t(18f, FontWeight.ExtraBold, Color.White)); Text("owned", style = t(12f, color = Site.Muted))
                    Meter(row.share, Modifier.width(72.dp), animate = enter)
                }
            }
            Status(row.status, row.shortfall.seals, row.short, row.open)
            GoldCta(if (row.complete) "Use deck" else "Build it", Modifier.fillMaxWidth(), onClick = onUse)
            GhostButton("See the cards", Modifier.fillMaxWidth(), onClick = onOpen)
            if (arch.variants.isNotEmpty()) {
                var more by remember { mutableStateOf(false) }
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { more = !more }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${arch.variants.size} more list${if (arch.variants.size > 1) "s" else ""}", style = t(14f, FontWeight.Bold, Site.Gold)); Text(if (more) "▴" else "▾", style = t(14f, FontWeight.Bold, Site.Gold))
                }
                if (more) arch.variants.take(12).forEach { v -> VariantRow(v) { onVariant(v) } }
            }
        }
    }
}

/** cardChip: the card with have/qty and the seal it costs; basics as a slim mana chip. */
@Composable
private fun CardChipView(c: Finder.CardChip, onClick: () -> Unit) {
    val missing = !c.basic && c.have < c.qty
    if (c.basic || c.image.isEmpty()) {
        Row(Modifier.height(44.dp).softPill(RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(horizontal = 12.dp).alpha(if (missing) .6f else 1f),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BASIC_COLOR[c.name]?.let { Symbol(it, 20.dp) }; Text(c.name, style = t(13.5f, FontWeight.SemiBold))
            Text(if (c.basic) "${c.qty}" else "${c.have}/${c.qty}", style = t(13.5f, FontWeight.ExtraBold, Site.Gold))
        }
        return
    }
    val p = heroPainter(c.image.let(homeArt))
    Column(Modifier.width(64.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(63f / 88f).clip(RoundedCornerShape(6.dp)).background(Site.Surface2)) {
            if (p != null) Image(p, c.name, Modifier.fillMaxSize().alpha(if (missing) .45f else 1f), contentScale = ContentScale.Crop)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("${c.have}/${c.qty}", style = t(12f, FontWeight.ExtraBold, if (missing) Site.Muted else Color.White)); if (missing) SealMini(c.seal, 14.dp)
        }
    }
}

@Composable
private fun VariantRow(v: Finder.Ranked, onBuild: () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0x0AFFFFFF)).border(1.dp, SoftRim, RoundedCornerShape(16.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) { Text(v.list.name.ifEmpty { "Deck" }, style = t(15f, FontWeight.Bold)); if (v.list.detail.isNotEmpty()) Text(v.list.detail, style = t(12.5f, color = Site.Muted)) }
            Column(horizontalAlignment = Alignment.End) { Text("${v.s.have}/${v.s.size}", style = t(15f, FontWeight.ExtraBold)); Meter(v.s.share, Modifier.width(56.dp)) }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { Status(v.s.status ?: "pending", v.s.cost ?: emptyMap(), v.s.short ?: emptyMap(), 0, mini = true) }
            GhostButton("Build", onClick = onBuild)
        }
    }
}
