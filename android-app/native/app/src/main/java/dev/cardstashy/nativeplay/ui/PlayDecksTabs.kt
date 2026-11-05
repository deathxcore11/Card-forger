@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.MetaLists
import dev.cardstashy.nativeplay.play.Progress
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/*
 * Play › Decks as three tabs (Randall 5 Nov 16:58Z-17:16Z, preview https://claude.ai/artifact/NyH4aKW6fdNZWT9i5HGM7B):
 * My decks, Precons and Meta. Precons are grouped by product line and filtered by format and colors; each shows the
 * seals and coins it still needs (deckShortfall / preconPrice, coins and seals only, no prices). A precon opens as its
 * own page with craft one, craft what the seals cover, craft all, or buy, and the cards meta decks share come first.
 */

private val Ink get() = Site.Text
private val Warn = Color(0xFFFFB86B)
private val Ok = Color(0xFF8FD19E)
private val Cream = Color(0xFFF3E3BD)
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
private fun cinzel(size: Float, color: Color = Cream) = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, lineHeight = (size * 1.2f).sp, color = color)
private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
private val SEAL_KEYS = listOf("c", "u", "r", "m")
private val BASIC_COLOR = mapOf("Plains" to "W", "Island" to "U", "Swamp" to "B", "Mountain" to "R", "Forest" to "G")

/** What the Decks tabs keep while the editor, the Finder or a precon page is on top: the tab and each list's place. */
class DecksTabs {
    var tab by mutableIntStateOf(0)
    val mine = androidx.compose.foundation.ScrollState(0)
    var randomOpen by mutableStateOf(false)
}

// ---------------------------------------------------------------- precon summaries

/**
 * Each precon's deck file read once and kept on the device as what its tile needs: the face (preconFace), colors
 * (basics' colors and every card's color identity, as the deck emblem counts them), the formats it is playable in as
 * published (constructedPrecon) and its rows by name, count, rarity and board. Three files load at a time, on demand.
 */
object PreconStore {
    data class Summary(val face: Pair<String, String>?, val colors: List<String>, val formats: List<String>, val rows: List<Decks.Row>)
    val summaries = mutableStateMapOf<String, Summary>()
    private val failed = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
    private val queued = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
    private val queue = java.util.concurrent.ConcurrentLinkedDeque<String>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val workers = java.util.concurrent.atomic.AtomicInteger(0)
    private val read = java.util.concurrent.atomic.AtomicBoolean(false)
    /** Files still to read; the tabs say "Checking…" while it is above zero. */
    val pending = MutableStateFlow(0)
    val failedCount = MutableStateFlow(0)
    var dir: java.io.File? = null
    private fun file() = dir?.resolve("precon-summaries-v1.json")

    fun failed(f: String) = f in failed
    /** Ask for these deck files, newest ask first (a tile coming into view goes ahead of the queue). */
    fun want(files: List<String>) {
        readDisk()
        for (f in files.reversed()) if (f !in summaries && f !in failed && queued.add(f)) { queue.addFirst(f); pending.value = queued.size }
        pump()
    }
    /** An opened precon's own file counts too. */
    fun put(fileName: String, payload: JsonObject) { summaryOf(payload)?.let { summaries[fileName] = it; save() } }

    private fun pump() {
        while (true) { val n = workers.get(); if (n >= 3 || queue.isEmpty()) return; if (!workers.compareAndSet(n, n + 1)) continue
            scope.launch { try { while (true) { val f = queue.pollFirst() ?: break; load(f) } } finally { workers.decrementAndGet(); if (queue.isNotEmpty()) pump() else if (workers.get() == 0) save() } } }
    }
    private suspend fun load(f: String) {
        val j = runCatching { Http.call("GET", "https://mtgjson.com/api/v5/decks/" + f.removeSuffix(".json") + ".json", mapOf("Accept" to "application/json"), null, 30_000) as? JsonObject }.getOrNull()
        val s = j?.let(::summaryOf)
        withContext(Dispatchers.Main) {
            if (s != null) summaries[f] = s else { failed.add(f); failedCount.value = failed.size }
            queued.remove(f); pending.value = queued.size
        }
    }
    fun summaryOf(payload: JsonObject): Summary? {
        val d = payload.getAsJsonObject("data") ?: payload
        if (d.getAsJsonArray("mainBoard") == null) return null
        val colors = HashSet<String>()
        for (k in listOf("commander", "mainBoard")) d.getAsJsonArray(k)?.forEach { e -> val c = e as? JsonObject ?: return@forEach
            BASIC_COLOR[c.s("name")]?.let { colors.add(it) }; c.getAsJsonArray("colorIdentity")?.forEach { x -> if (x.isJsonPrimitive && x.asString != "C") colors.add(x.asString) } }
        return Summary(Decks.preconFace(d), "WUBRG".map { it.toString() }.filter { it in colors }, Decks.preconFormats(payload) ?: emptyList(),
            Decks.mtgjsonDeckRows(d).map { Decks.Row(it.name, it.qty, it.board, rarity = it.rarity) })
    }
    private fun readDisk() {
        if (!read.compareAndSet(false, true)) return
        scope.launch {
            val o = runCatching { file()?.takeIf { it.exists() }?.readText()?.let { com.google.gson.JsonParser.parseString(it).asJsonObject } }.getOrNull() ?: return@launch
            val got = HashMap<String, Summary>()
            for ((k, v) in o.entrySet()) { val x = v as? JsonObject ?: continue
                val face = x.getAsJsonArray("f")?.takeIf { it.size() == 2 }?.let { it[0].asString to it[1].asString }
                val rows = x.getAsJsonArray("r")?.mapNotNull { r -> (r as? JsonArray)?.takeIf { it.size() >= 3 }?.let { Decks.Row(it[0].asString, it[1].asInt, it.get(3)?.takeIf { b -> b.isJsonPrimitive }?.asString, rarity = it[2].asString) } } ?: continue
                got[k] = Summary(face, x.s("c").map { it.toString() }, x.getAsJsonArray("fm")?.map { it.asString } ?: emptyList(), rows) }
            withContext(Dispatchers.Main) { got.forEach { (k, v) -> summaries.putIfAbsent(k, v) } }
        }
    }
    private fun save() {
        val snap = summaries.toMap(); if (snap.isEmpty()) return
        scope.launch { runCatching { file()?.writeText(JsonObject().apply { snap.forEach { (k, v) -> add(k, JsonObject().apply {
            v.face?.let { add("f", JsonArray().apply { add(it.first); add(it.second) }) }; addProperty("c", v.colors.joinToString(""))
            add("fm", JsonArray().apply { v.formats.forEach { add(it) } })
            add("r", JsonArray().apply { v.rows.forEach { r -> add(JsonArray().apply { add(r.name); add(r.qty); add(r.rarity); r.board?.let { add(it) } }) } }) }) } }.toString()) } }
    }
    internal fun clearForTest() { summaries.clear(); failed.clear(); queued.clear(); queue.clear(); pending.value = 0 }
}

/** The precon product lines, as the tabs group them (CONSTRUCTED_PRECON_TYPES). */
val PRECON_LINES = listOf("Starter Kits" to setOf("Starter Kit", "Arena Starter Kit"), "Theme Decks" to setOf("Theme Deck"), "Challenger Decks" to setOf("Challenger Deck", "Pioneer Challenger Deck"),
    "Planeswalker Decks" to setOf("Planeswalker Deck"), "Game Night" to setOf("Game Night Deck"), "Event Decks" to setOf("Event Deck"), "Duel Decks" to setOf("Duel Deck"),
    "Clash Packs" to setOf("Clash Pack"), "Intro Packs" to setOf("Intro Pack"))
fun preconLine(type: String) = PRECON_LINES.firstOrNull { type in it.second }?.first ?: type
val PRECON_FORMATS = listOf("Standard", "Pioneer", "Modern", "Pauper", "Legacy", "Vintage")
/** constructedPreconCandidates' release windows: Standard rotates (about three years), Pioneer and Modern start on their dates. */
fun preconInWindow(e: Decks.PreconEntry, format: String, today: java.time.LocalDate = java.time.LocalDate.now()) = when (format) {
    "Standard" -> e.releaseDate >= today.minusDays(3 * 366L).toString(); "Pioneer" -> e.releaseDate >= "2012-10-05"; "Modern" -> e.releaseDate >= "2003-07-28"; else -> true }

/** A deck against the Trunk and the purse: what is missing, the seals by rarity, what the seals don't cover, the coin price. */
/** [inStore]: buyable whole with coins (one of this week's five store precons, or every card owned); the rest craft with seals. */
data class PreconNeed(val sh: Decks.Shortfall, val short: Map<String, Int>, val price: Int, val share: Double, val inStore: Boolean = false) {
    val total get() = sh.total
    val craftable get() = !sh.complete && short.values.all { it == 0 }
}
/** state.preconStore.files: this week's five store precons (play-precon-formats weeklyPrecons, from the server). */
fun weeklyPrecons(state: JsonObject?): Set<String> =
    (state?.get("preconStore") as? JsonObject)?.getAsJsonArray("files")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }?.toSet().orEmpty()
/**
 * This week's store precons by format: /state preconStore.formats (play-precon-formats.js weeklyPreconsByFormat, PR #130:
 * four each of Standard, Pioneer, Modern and Legacy), in the server's order. Empty from a server that only sends files.
 */
fun weeklyPreconFormats(state: JsonObject?): Map<String, List<String>> =
    ((state?.get("preconStore") as? JsonObject)?.get("formats") as? JsonObject)?.entrySet()
        ?.associate { (k, v) -> k to (v as? JsonArray)?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty() }
        ?.filterValues { it.isNotEmpty() }.orEmpty()
fun isWeeklyPrecon(state: JsonObject?, file: String) = file.removeSuffix(".json") in weeklyPrecons(state)
fun preconNeed(rows: List<Decks.Row>, owned: Map<String, Int>, state: JsonObject, file: String = ""): PreconNeed {
    val sh = Decks.shortfall(rows, owned, rows.associate { it.name to it.rarity })
    val wallet = state.getAsJsonObject("wallet")
    val short = SEAL_KEYS.associateWith { k -> maxOf(0, (sh.seals[k] ?: 0) - (wallet?.get("seal_$k")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0)) }
    val want = rows.filter { !Decks.isBasicLand(it.name) }.sumOf { maxOf(1, it.qty) }
    return PreconNeed(sh, short, Decks.preconPrice(sh.seals, state.getAsJsonObject("config")), if (want > 0) (want - sh.total).coerceAtLeast(0).toDouble() / want else 1.0,
        sh.complete || isWeeklyPrecon(state, file))
}

// ---------------------------------------------------------------- tab bar

/** The three tabs as one glass pill; the gold thumb rides the pager as you swipe. */
@Composable
fun DecksTabBar(labels: List<String>, position: Float, selected: Int, onPick: (Int) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(999.dp)).background(Color(0xB30C0E13)).border(1.dp, SoftRim, RoundedCornerShape(999.dp)).padding(4.dp)) {
        val w = maxWidth / labels.size
        Box(Modifier.offset(x = w * position).width(w).fillMaxHeight().clip(RoundedCornerShape(999.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFFF6D58F), Color(0xFFD9A94F)))))
        Row(Modifier.fillMaxSize()) { labels.forEachIndexed { i, l ->
            val on = i == selected
            Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(999.dp)).semantics { role = Role.Tab; this.selected = on }.clickable { onPick(i) }, contentAlignment = Alignment.Center) {
                Text(l, style = t(14.5f, FontWeight.ExtraBold, if (on) Color(0xFF1B1407) else Site.Muted)) } } }
    }
}

// ---------------------------------------------------------------- My decks

/** Half-width action tiles: Build a deck (the Finder) and Random deck (Deck Forge). */
@Composable
fun DeckActionTile(title: String, sub: String, art: String?, modifier: Modifier, sparkle: Boolean = false, onClick: () -> Unit) {
    val p = art?.let { heroPainter(homeArt(it)) }
    Box(modifier.height(128.dp).softTile().clickable(onClick = onClick)) {
        if (p != null) Image(p, null, Modifier.fillMaxSize().alpha(.8f), contentScale = ContentScale.Crop)
        else Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0xFF5B3A8F), Color(0xFF2A1B46), Color(0xFF120D1C)), radius = 520f)))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), .4f to Color.Transparent, 1f to Color(0xE608090C))))
        if (sparkle) Text("✦", style = t(28f, color = Color(0xFFF0C66D)), modifier = Modifier.align(Alignment.TopEnd).padding(12.dp))
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(title, style = t(16f, FontWeight.ExtraBold, Color.White)); Text(sub, style = t(12f, color = Color(0xFFD5D9E0), line = 15f), maxLines = 2) }
    }
}

// ---------------------------------------------------------------- Precons tab

class PreconFilters {
    var product by mutableStateOf("")
    var format by mutableStateOf("")
    var colors by mutableStateOf(emptySet<String>())
    var sort by mutableStateOf("new")
    val list = LazyListState()
    val rails = HashMap<String, LazyListState>()
}

@Composable
fun PreconsTab(state: JsonObject, pc: PreconUi, owned: Map<String, Int>, onOpen: (Decks.PreconEntry) -> Unit, onLoad: () -> Unit) {
    val f = pc.filters
    LaunchedEffect(Unit) { onLoad() }
    val pending by PreconStore.pending.collectAsState()
    val failedCount by PreconStore.failedCount.collectAsState()
    val index = pc.index
    val q = pc.query.trim().lowercase()
    val searched = remember(index, q) { index.orEmpty().filter { q.isEmpty() || it.name.lowercase().contains(q) || it.code.lowercase() == q || it.type.lowercase().contains(q) } }
    val lines = remember(searched) { PRECON_LINES.map { it.first }.mapNotNull { l -> searched.filter { preconLine(it.type) == l }.takeIf { it.isNotEmpty() }?.let { l to it } }
        .sortedByDescending { it.second.maxOf { e -> e.releaseDate } } }
    val needSummary = f.format.isNotEmpty() || f.colors.isNotEmpty() || f.sort == "closest"
    val rails = f.product.isEmpty() && !needSummary && f.sort == "new" && q.isEmpty()
    val candidates = remember(searched, f.product, f.format) { searched.filter { (f.product.isEmpty() || preconLine(it.type) == f.product) && (f.format.isEmpty() || preconInWindow(it, f.format)) } }
    fun matches(s: PreconStore.Summary) = (f.format.isEmpty() || f.format in s.formats) && f.colors.all { it in s.colors }
    val needs = remember(state, owned) { HashMap<String, PreconNeed>() }
    fun needOf(file: String): PreconNeed? = PreconStore.summaries[file]?.let { s -> needs.getOrPut(file) { preconNeed(s.rows, owned, state, file) } }
    // The week's five store precons come first (preconShelf sorts isWeekly first).
    val weekly = remember(state) { weeklyPrecons(state) }
    fun isWeekly(e: Decks.PreconEntry) = e.fileName.removeSuffix(".json") in weekly
    val shown: List<Decks.PreconEntry> = when {
        rails -> emptyList()
        !needSummary -> (if (f.sort == "name") candidates.sortedBy { it.name } else candidates).sortedByDescending(::isWeekly).take(pc.limit)
        else -> candidates.filter { e -> PreconStore.summaries[e.fileName]?.let(::matches) == true }
            .let { l -> when (f.sort) { "closest" -> l.sortedBy { needOf(it.fileName)?.total ?: Int.MAX_VALUE }; "name" -> l.sortedBy { it.name }; else -> l } }.sortedByDescending(::isWeekly).take(pc.limit)
    }
    // A filter that needs the deck files reads them in order until a page of matches is in (Closest checks the first 60).
    LaunchedEffect(rails, needSummary, candidates, f.format, f.colors, f.sort, pc.limit, PreconStore.summaries.size, failedCount) {
        if (rails || !needSummary) return@LaunchedEffect
        var hits = 0; val want = ArrayList<String>()
        for ((i, e) in candidates.withIndex()) {
            if (f.sort == "closest" && i >= 60) break
            val s = PreconStore.summaries[e.fileName]
            if (s != null) { if (matches(s)) hits++ } else if (!PreconStore.failed(e.fileName)) want.add(e.fileName)
            if (want.size >= 6 || (f.sort != "closest" && hits >= pc.limit)) break
        }
        if (want.isNotEmpty()) PreconStore.want(want)
    }
    LazyColumn(Modifier.fillMaxSize(), state = f.list, contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(key = "find") { Field(pc.query, "Find a precon or set") { pc.query = it; pc.limit = 12 } }
        // One filter bar (Randall 5 Nov 18:53Z): each filter one sideways row to the screen's edges, the colors and Sort on the last.
        item(key = "lines") { ShelfRow { item(key = "all") { ShelfChip("All", f.product.isEmpty(), searched.size) { f.product = ""; pc.limit = 12 } }
            items(lines, key = { it.first }) { (l, es) -> ShelfChip(l, f.product == l, es.size) { f.product = if (f.product == l) "" else l; pc.limit = 12 } } } }
        item(key = "formats") { ShelfRow { item(key = "any") { ShelfChip("Any format", f.format.isEmpty()) { f.format = ""; pc.limit = 12 } }
            items(PRECON_FORMATS, key = { it }) { x -> ShelfChip(x, f.format == x) { f.format = if (f.format == x) "" else x; pc.limit = 12 } } } }
        item(key = "colors") { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            "WUBRG".forEach { c -> val k = c.toString(); val on = k in f.colors
                Box(Modifier.size(36.dp).clip(CircleShape).background(if (on) Color(0x26E8B95B) else Color(0x0AFFFFFF)).border(1.dp, if (on) SolidColor(Color(0xAAE2B866)) else SoftRim, CircleShape)
                    .semantics { contentDescription = mapOf("W" to "White", "U" to "Blue", "B" to "Black", "R" to "Red", "G" to "Green").getValue(k); selected = on }
                    .clickable { f.colors = if (on) f.colors - k else f.colors + k; pc.limit = 12 }, contentAlignment = Alignment.Center) {
                    Box(Modifier.alpha(if (on || f.colors.isEmpty()) 1f else .4f)) { Symbol(k, 22.dp) } } }
            Spacer(Modifier.weight(1f))
            val label = mapOf("new" to "Newest", "closest" to "Closest", "name" to "A–Z")
            ShelfSort(label[f.sort] ?: "Newest") { f.sort = when (f.sort) { "new" -> "closest"; "closest" -> "name"; else -> "new" }; pc.limit = 12 }
        } }
        when {
            pc.busy && index == null -> item(key = "loading") { Text("Loading the precon list…", style = t(13f, color = Site.Muted)) }
            pc.error.isNotEmpty() -> item(key = "error") { Text(pc.error, style = t(14f, color = Warn)) }
            index == null -> item(key = "show") { GhostButton("Show the precons") { onLoad() } }
            rails -> {
                val store = searched.filter(::isWeekly)
                if (store.isNotEmpty()) {
                    item(key = "h:store") { Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("In the store", style = cinzel(18f)); Text("  ${store.size}", style = t(13f, FontWeight.Bold, Site.Muted)); Spacer(Modifier.weight(1f))
                        Text("This week", style = t(13f, FontWeight.Bold, Site.Muted)) } }
                    item(key = "r:store") { LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        items(store, key = { it.fileName }) { e -> PreconTile(e, needOf(e.fileName), Modifier.width(262.dp), weekly = true) { onOpen(e) } } } }
                }
                lines.forEach { (l, es) ->
                item(key = "h:$l") { Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(l, style = cinzel(18f)); Text("  ${es.size}", style = t(13f, FontWeight.Bold, Site.Muted)); Spacer(Modifier.weight(1f))
                    if (es.size > 1) Text("See all ›", style = t(13.5f, FontWeight.Bold, Site.Gold), modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable { f.product = l; pc.limit = 12 }.padding(6.dp)) } }
                item(key = "r:$l") {
                    val rs = remember(l) { f.rails.getOrPut(l) { LazyListState() } }
                    LazyRow(state = rs, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        items(es.take(16), key = { it.fileName }) { e -> PreconTile(e, needOf(e.fileName), Modifier.width(262.dp), weekly = isWeekly(e)) { onOpen(e) } }
                    }
                }
            } }
            else -> {
                item(key = "count") { Text(when {
                    shown.isEmpty() && pending > 0 -> "Checking the precons…"
                    shown.isEmpty() -> "No precons match."
                    needSummary && pending > 0 -> "${shown.size} so far · checking more…"
                    else -> "${if (needSummary) shown.size else candidates.size} precon${if ((if (needSummary) shown.size else candidates.size) == 1) "" else "s"}" }, style = t(13f, color = Site.Muted)) }
                itemsIndexed(shown, key = { _, e -> "t:" + e.fileName }) { _, e -> PreconTile(e, needOf(e.fileName), Modifier.fillMaxWidth().animateItem(), weekly = isWeekly(e)) { onOpen(e) } }
                val more = if (needSummary) (shown.size >= pc.limit) else candidates.size > shown.size
                if (more) item(key = "more") { GhostButton("Show more", Modifier.fillMaxWidth()) { pc.limit += 12 } }
            }
        }
    }
}

@Composable private fun ChipRow(content: @Composable () -> Unit) =
    Row(Modifier.fillMaxWidth().horizontalScroll(androidx.compose.foundation.rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) { content() }

@Composable
private fun ChipOn(label: String, on: Boolean, count: Int? = null, onClick: () -> Unit) = ShelfChip(label, on, count, onClick = onClick)

/**
 * A precon tile: its face, set emblem, pips, product and year (" · In the store" for this week's five), formats, how much
 * of it the Trunk holds, and what's left in seals, or coins for a store precon.
 */
@Composable
fun PreconTile(e: Decks.PreconEntry, need: PreconNeed?, modifier: Modifier, weekly: Boolean = false, shop: Boolean = false, onClick: () -> Unit) {
    val s = PreconStore.summaries[e.fileName]
    LaunchedEffect(e.fileName) { if (s == null) PreconStore.want(listOf(e.fileName)) }
    val code = e.code.lowercase()
    val p = heroPainter(s?.face?.second?.let { Decks.scryfallImage(it).replace("/normal/", "/art_crop/") }?.ifBlank { null }?.let(homeArt))
    Box(modifier.height(206.dp).softTile().clickable(onClick = onClick).semantics { contentDescription = "${e.name}, ${e.type}, ${e.releaseDate.take(4)}" }) {
        if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF1B1F29), Color(0xFF0F1117)))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x55000000), .3f to Color(0x10000000), .62f to Color(0xE608090C), 1f to Color(0xF508090C))))
        Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(34.dp).softPill(CircleShape), contentAlignment = Alignment.Center) { SetIcon(code, Modifier.size(20.dp), Cream) }
            when { need?.sh?.complete == true -> Ribbon("Ready", Ok); need?.craftable == true -> Ribbon("Craftable now", Color(0xFFF0C66D)) }
            Spacer(Modifier.weight(1f))
            if (s != null) Row(Modifier.softPill(RoundedCornerShape(999.dp)).padding(horizontal = 6.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                s.colors.ifEmpty { listOf("C") }.forEach { Symbol(it, 17.dp) } }
        }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = 13.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(e.name, style = t(17f, FontWeight.ExtraBold, Color.White, line = 20f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${e.type} · ${e.releaseDate.take(4)}" + if (weekly) " · In the store" else "", style = t(12.5f, color = Color(0xFFD5D9E0)), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (s != null) Text(s.formats.take(3).joinToString(" · ").ifEmpty { "Casual" }, style = t(11.5f, FontWeight.Bold, Site.Gold), maxLines = 1)
            if (need != null) {
                Box(Modifier.padding(top = 5.dp).fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)).background(Color(0x1FFFFFFF))) {
                    Box(Modifier.fillMaxWidth(need.share.toFloat().coerceIn(0f, 1f)).fillMaxHeight().clip(RoundedCornerShape(3.dp)).background(Brush.horizontalGradient(listOf(Color(0xFFD9A94F), Color(0xFFF6D58F))))) }
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (need.sh.complete) Text("✓ Every card is in your Trunk", style = t(12.5f, FontWeight.Bold, Ok))
                    // In the Shop it is coins only: what's left to add and the deck's price.
                    else if (shop) { Text("${need.total} card${if (need.total == 1) "" else "s"} to add", style = t(12.5f, color = Color(0xFFD5D9E0)), modifier = Modifier.weight(1f))
                        Row(Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x99000000)).border(1.dp, Color(0x66E8B95B), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            CoinDot(14.dp); Text("%,d".format(need.price), style = t(13.5f, FontWeight.ExtraBold, Color.White)) } }
                    else { SealCosts(need.sh.seals, need.short, 15.dp, Modifier.weight(1f))
                        if (need.inStore) Text(buildAnnotatedString { append("or "); pushStyle(SpanStyle(color = Color.White, fontWeight = FontWeight.ExtraBold)); append("%,d".format(need.price)); pop(); append(" coins") }, style = t(12.5f, color = Color(0xFFD5D9E0))) }
                }
            } else Text("Checking the list…", style = t(12f, color = Site.Muted), modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable private fun Ribbon(text: String, color: Color) = Text(text, style = t(11.5f, FontWeight.ExtraBold, color),
    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(color.copy(alpha = .18f)).border(1.dp, color.copy(alpha = .45f), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp))

/** Seal costs by rarity (statusMarkup's costs): the count in amber when your seals of that rarity fall short. */
@Composable
fun SealCosts(cost: Map<String, Int>, short: Map<String, Int>, size: Dp, modifier: Modifier = Modifier) =
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        SEAL_KEYS.filter { (cost[it] ?: 0) > 0 }.forEach { k -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            SealMini(k, size); Text("${cost[k]}", style = t(13f, FontWeight.ExtraBold, if ((short[k] ?: 0) > 0) Warn else Color.White)) } }
    }

// ---------------------------------------------------------------- a precon's own page

/**
 * The opened precon (preconShelf's open view, as its own page): the face, emblem and formats; To finish it with the
 * two ways (seals: what they cover now or all at once; coins: Buy deck); Craft these first (missing cards that meta
 * lists or your Play decks also use); then the list with each missing card's craft and its shared badge.
 */
@Composable
fun PreconPage(state: JsonObject, o: OpenPrecon, owned: Map<String, Int>, pc: PreconUi, onBack: () -> Unit, onCard: (String) -> Unit, toast: (String) -> Unit, nav: @Composable () -> Unit) {
    val scope = rememberCoroutineScope()
    val need = remember(o, owned, state) { preconNeed(o.rows, owned, state, o.file) }
    val sh = need.sh
    val coins = state.getAsJsonObject("wallet")?.get("coins")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
    val have = remember(state) { SEAL_KEYS.associateWith { k -> state.getAsJsonObject("wallet")?.get("seal_$k")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0 } }
    var busy by remember { mutableStateOf(false) }
    var armed by remember { mutableStateOf("") }
    LaunchedEffect(armed) { if (armed.isNotEmpty()) { delay(5000); armed = "" } }
    var missingOnly by remember(o.file) { mutableStateOf(false) }
    // Meta lists of the format you filtered by, else the precon's first format with a meta feed.
    val metaFormat = (pc.filters.format.takeIf { it in o.formats } ?: o.formats.firstOrNull { MetaLists.hasMeta(it) })?.takeIf { MetaLists.hasMeta(it) }
    var meta by remember(metaFormat) { mutableStateOf(metaFormat?.let { MetaLists.cached(it) }) }
    LaunchedEffect(metaFormat) { if (metaFormat != null && meta == null) meta = MetaLists.load(metaFormat) }
    val metaCount = remember(meta) { HashMap<String, Int>().also { m -> meta.orEmpty().forEach { l -> l.cards.map { it.name }.toSet().forEach { n -> m[n] = (m[n] ?: 0) + 1 } } } }
    val decks = state.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject } ?: emptyList()
    val deckUse = remember(decks) { HashMap<String, MutableList<String>>().also { m -> decks.forEach { d -> Decks.rows(d).map { it.name }.toSet().forEach { n -> m.getOrPut(n) { ArrayList() }.add(d.s("name").ifBlank { "Untitled deck" }) } } } }
    val shared = remember(sh, metaCount, deckUse) { sh.missing.filter { (metaCount[it.name] ?: 0) > 0 || deckUse[it.name] != null }
        .sortedByDescending { (metaCount[it.name] ?: 0) + 2 * (deckUse[it.name]?.size ?: 0) } }
    val idOf = remember(o) { HashMap<String, String>().also { m -> o.rows.forEach { r -> if (r.id.isNotEmpty()) m.putIfAbsent(r.name, r.id) } } }
    // What the seals cover now: shared cards first, then the list's order, each rarity up to the seals you hold.
    val plan = remember(sh, have, shared) { val left = HashMap(have); val order = shared + sh.missing.filter { m -> shared.none { it.name == m.name } }
        order.mapNotNull { m -> val n = minOf(m.need, left[m.seal] ?: 0); if (n <= 0) null else { left[m.seal] = (left[m.seal] ?: 0) - n; m.name to n } } }
    val canNow = plan.sumOf { it.second }
    fun craft(list: List<Pair<String, Int>>, label: String) {
        if (busy) return; busy = true; armed = ""
        scope.launch {
            var made = 0
            try { for ((name, n) in list) { val id = idOf[name] ?: continue; repeat(n) { if (runCatching { Progress.craft(id) }.isSuccess) made++ } } }
            finally { busy = false }
            toast(if (made > 0) "$made card${if (made > 1) "s" else ""} crafted into your Trunk." else "Not enough seals for $label yet.")
        }
    }
    fun arm(key: String, go: () -> Unit) { if (armed == key) go() else armed = key }

    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop()
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)) {
            // The way back stays in reach at the top while the page scrolls.
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(40.dp).softPill(CircleShape).clickable(onClick = onBack).semantics { contentDescription = "Back to the precons" }, contentAlignment = Alignment.Center) {
                    Text("‹", style = t(24f, FontWeight.Bold, Color.White, line = 26f)) }
                Column { Text("Precons", style = t(15f, FontWeight.ExtraBold))
                    val crumbs = listOf(pc.filters.product, pc.filters.format, pc.filters.colors.joinToString(", ") { mapOf("W" to "White", "U" to "Blue", "B" to "Black", "R" to "Red", "G" to "Green")[it] ?: it }).filter { it.isNotEmpty() }
                    Text(crumbs.joinToString(" · ").ifEmpty { preconLine(o.product) }, style = t(12f, color = Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
        LazyColumn(Modifier.fillMaxWidth().weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item(key = "hero") {
                val lead = o.rows.firstOrNull { it.board != "side" && !Decks.isBasicLand(it.name) } ?: o.rows.firstOrNull()
                val heroArt = (PreconStore.summaries[o.file]?.face?.second ?: pc.faces[o.file]?.second ?: lead?.id)?.let { Decks.scryfallImage(it).replace("/normal/", "/art_crop/") }?.ifBlank { null }
                val hp = heroPainter(heroArt?.let(homeArt))
                Box(Modifier.fillMaxWidth().height(212.dp).softTile()) {
                    if (hp != null) Image(hp, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), .38f to Color.Transparent, .78f to Color(0xE608090C), 1f to Color(0xF208090C))))
                    Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(o.name.uppercase(), style = cinzel(23f))
                        val e = emblemOf(o.rows, o.formats.firstOrNull() ?: "", rememberNameFacts())
                        EmblemPlate("Precon", e); if (e.meta.isNotEmpty()) MetaLine(e.meta)
                        Text("${o.product.ifBlank { "Precon" }} · ${o.released.take(4)}" + if (o.formats.isNotEmpty()) " · " + o.formats.joinToString(", ") else " · Casual", style = t(13f, color = Color(0xFFD5D9E0)))
                    }
                }
            }
            item(key = "finish") { GlassPanel {
                Row(verticalAlignment = Alignment.CenterVertically) { Text("To finish it", style = cinzel(16f), modifier = Modifier.weight(1f)); Text("Basics are free", style = t(12f, color = Site.Muted)) }
                val wantAll = o.rows.filter { !Decks.isBasicLand(it.name) }.sumOf { maxOf(1, it.qty) }
                if (sh.complete) Text("You own every card", style = t(16f, FontWeight.ExtraBold, Ok))
                else Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${sh.total}", style = t(28f, FontWeight.ExtraBold, Color.White, line = 30f))
                    Text("card${if (sh.total == 1) "" else "s"} to add · ${wantAll - sh.total} of $wantAll in your Trunk" + if (need.inStore) "" else " · craft them with seals", style = t(13.5f, color = Site.Muted), modifier = Modifier.padding(bottom = 3.dp)) }
                Box(Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)).background(Color(0x1FFFFFFF))) {
                    Box(Modifier.fillMaxWidth(need.share.toFloat().coerceIn(0f, 1f)).fillMaxHeight().background(Brush.horizontalGradient(listOf(Color(0xFFD9A94F), Color(0xFFF6D58F))))) }
                if (!sh.complete) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Way("Craft with seals", Modifier.weight(1f)) {
                        SEAL_KEYS.filter { (sh.seals[it] ?: 0) > 0 }.forEach { k -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            SealMini(k, 18.dp); Text("${sh.seals[k]}", style = t(13.5f, FontWeight.ExtraBold, if ((need.short[k] ?: 0) > 0) Warn else Color.White))
                            Text("· you have ${have[k] ?: 0}", style = t(11.5f, color = Site.Muted), maxLines = 1) } }
                        val shortBy = need.short.values.sum()
                        if (shortBy > 0) Text(buildAnnotatedString { append("You need "); pushStyle(SpanStyle(color = Warn, fontWeight = FontWeight.Bold)); append("$shortBy more seal${if (shortBy == 1) "" else "s"}"); pop(); append(" for all of it.") }, style = t(12f, color = Site.Muted, line = 16f))
                        if (need.craftable) GoldCta(if (busy) "Crafting…" else if (armed == "all") "Tap to craft ${sh.total}" else "Craft all ${sh.total}", Modifier.fillMaxWidth(), enabled = !busy) {
                            arm("all") { craft(sh.missing.map { it.name to it.need }, "these cards") } }
                        else {
                            // Short of seals: craft what they cover now; Craft all stays in view, greyed, until they cover it.
                            if (canNow > 0) GhostButton(if (busy) "Crafting…" else if (armed == "now") "Tap to craft $canNow" else "Craft $canNow now", Modifier.fillMaxWidth(), enabled = !busy, gold = true) {
                                arm("now") { craft(plan, "these cards") } }
                            GhostButton("Craft all ${sh.total}", Modifier.fillMaxWidth(), enabled = false) {}
                        }
                    }
                    // Whole-deck coin buys are only for this week's five store precons (the server answers not_in_store).
                    if (need.inStore) Way("Buy the deck", Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            CoinDot(18.dp); Text("%,d".format(need.price), style = t(22f, FontWeight.ExtraBold, Color.White, line = 26f)); Text("coins", style = t(13f, color = Site.Muted)) }
                        Text("You have ${"%,d".format(coins)}. The exact printings go to your Trunk and the deck to My decks.", style = t(12f, color = Site.Muted, line = 16f))
                        GoldCta(if (need.price > coins) "Not enough coins" else "Buy deck", Modifier.fillMaxWidth(), enabled = !busy && need.price <= coins) { buy(scope, o, pc, toast) { busy = it } }
                    }
                } else GoldCta("Add to my decks", Modifier.fillMaxWidth(), enabled = !busy) { buy(scope, o, pc, toast) { busy = it } }
            } }
            if (shared.isNotEmpty()) item(key = "first") { GlassPanel {
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Craft these first", style = cinzel(16f), modifier = Modifier.weight(1f))
                    Text(if (metaCount.isNotEmpty()) "Shared with meta decks" else "Shared with your decks", style = t(12f, color = Site.Muted)) }
                shared.take(4).forEach { m -> val metaN = metaCount[m.name] ?: 0; val mine = deckUse[m.name].orEmpty()
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x0AFFFFFF)).border(1.dp, Color(0x0FFFFFFF), RoundedCornerShape(14.dp)).clickable { onCard(m.name) }.padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        CardPicture(Decks.scryfallImage(idOf[m.name] ?: ""), null, null, Modifier.width(44.dp).aspectRatio(63f / 88f), RoundedCornerShape(4.dp))
                        Column(Modifier.weight(1f)) { Text(m.name, style = t(14f, FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val why = listOfNotNull(if (metaN > 0) "In $metaN $metaFormat meta list${if (metaN == 1) "" else "s"}" else null, if (mine.isNotEmpty()) "In ${if (mine.size == 1) mine[0] else "${mine.size} of your decks"}" else null)
                            Text((why + "${m.need} to add").joinToString(" · "), style = t(12f, color = Site.Gold), maxLines = 2) }
                        CraftChip(m.seal, m.need, armed == "c:" + m.name, enabled = !busy && (have[m.seal] ?: 0) >= m.need) { arm("c:" + m.name) { craft(listOf(m.name to m.need), m.name) } }
                    } }
            } }
            item(key = "listHead") { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("The list", style = cinzel(16f), modifier = Modifier.weight(1f))
                val all = o.rows.filter { it.board != "side" }.sumOf { it.qty }
                ChipOn("All", !missingOnly, all) { missingOnly = false }; if (!sh.complete) ChipOn("Missing", missingOnly, sh.total) { missingOnly = true } } }
            val main = o.rows.filter { it.board != "side" }; val side = o.rows.filter { it.board == "side" }
            preconCardRows(main, owned, missingOnly, "m", metaCount, deckUse, armed, busy, have, onCard, { k, go -> arm(k, go) }) { name, n -> craft(listOf(name to n), name) }
            if (side.isNotEmpty()) {
                item(key = "sideHead") { Text("Sideboard", style = t(15f, FontWeight.Bold)) }
                preconCardRows(side, owned, missingOnly, "s", metaCount, deckUse, armed, busy, have, onCard, { k, go -> arm(k, go) }) { name, n -> craft(listOf(name to n), name) }
            }
        }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
}

private fun buy(scope: CoroutineScope, o: OpenPrecon, pc: PreconUi, toast: (String) -> Unit, busy: (Boolean) -> Unit) {
    busy(true)
    scope.launch {
        runCatching { Progress.precon(o.file, o.formats.firstOrNull() ?: "Casual") }.onSuccess { out -> pc.open = null
            val g = out.get("granted")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
            toast(if (g > 0) "${o.name} is yours. $g new card${if (g == 1) "" else "s"} in your Trunk." else "${o.name} is in your decks.") }
            .onFailure { toast(it.message ?: "Could not buy the deck right now.") }
        busy(false); Progress.refresh()
    }
}

/** The list three across: each card dimmed while you lack copies, its count and "N new", the shared badge, and its craft. */
private fun androidx.compose.foundation.lazy.LazyListScope.preconCardRows(rows: List<Decks.Row>, owned: Map<String, Int>, missingOnly: Boolean, tag: String,
    metaCount: Map<String, Int>, deckUse: Map<String, List<String>>, armed: String, busy: Boolean, have: Map<String, Int>, onCard: (String) -> Unit,
    arm: (String, () -> Unit) -> Unit, craft: (String, Int) -> Unit) {
    val left = HashMap(owned)
    val cells = rows.map { r -> val got = if (Decks.isBasicLand(r.name)) r.qty else minOf(r.qty, left[r.name] ?: 0); left[r.name] = maxOf(0, (left[r.name] ?: 0) - got); r to got }
        .filter { (r, got) -> !missingOnly || got < r.qty }
    cells.chunked(3).forEachIndexed { i, row -> item(key = "$tag:$i:" + row.joinToString("|") { it.first.name }) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { (r, got) -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Box {
                    CardPicture(Decks.scryfallImage(r.id).ifBlank { "https://api.scryfall.com/cards/named?format=image&version=normal&exact=" + java.net.URLEncoder.encode(r.name, "UTF-8") }, null, null,
                        Modifier.fillMaxWidth().aspectRatio(63f / 88f).alpha(if (got < r.qty) .55f else 1f).clickable { onCard(r.name) }, RoundedCornerShape(6.dp))
                    val m = metaCount[r.name] ?: 0; val d = deckUse[r.name]?.size ?: 0
                    if (!Decks.isBasicLand(r.name) && (m > 0 || d > 0)) Text(if (m > 0) "$m meta" else "$d deck${if (d == 1) "" else "s"}", style = t(10.5f, FontWeight.ExtraBold, Color(0xFFF0C66D)),
                        modifier = Modifier.align(Alignment.TopEnd).padding(5.dp).clip(RoundedCornerShape(999.dp)).background(Color(0xD90C0E13)).border(1.dp, Color(0x99F0C66D), RoundedCornerShape(999.dp)).padding(horizontal = 6.dp, vertical = 1.dp))
                }
                Text(buildAnnotatedString { append("${r.qty}×"); if (got < r.qty) { append(" "); pushStyle(SpanStyle(color = Site.Gold, fontWeight = FontWeight.Bold)); append("${r.qty - got} new"); pop() } else if (!Decks.isBasicLand(r.name)) append(" owned") }, style = t(12f, color = Site.Muted))
                if (got < r.qty) { val seal = Decks.RARITY_SEAL[r.rarity] ?: "c"; val n = r.qty - got
                    CraftChip(seal, n, armed == "c:" + r.name, enabled = !busy && (have[seal] ?: 0) >= n) { arm("c:" + r.name) { craft(r.name, n) } } }
            } }
            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
        }
    } }
}

/** One card's craft: the seal it costs and how many; the first tap arms it (5 s), the second crafts. */
@Composable
private fun CraftChip(seal: String, n: Int, armed: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Row(Modifier.alpha(if (enabled) 1f else .45f).heightIn(min = 30.dp).clip(RoundedCornerShape(999.dp))
        .then(if (armed) Modifier.background(Brush.verticalGradient(listOf(Color(0xFFF6D58F), Color(0xFFD9A94F)))) else Modifier.background(Color(0x14E2B866)).border(1.dp, Color(0x77E2B866), RoundedCornerShape(999.dp)))
        .clickable(enabled = enabled, onClick = onClick).semantics { contentDescription = if (armed) "Tap again to craft" else "Craft $n" }.padding(horizontal = 9.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        if (armed) Text("Tap to craft", style = t(11.5f, FontWeight.ExtraBold, Color(0xFF1B1407)))
        else { SealMini(seal, 15.dp); Text(if (n > 1) "Craft ×$n" else "Craft", style = t(11.5f, FontWeight.ExtraBold, Cream)) }
    }
}

@Composable private fun GlassPanel(content: @Composable () -> Unit) = Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
    .background(Brush.verticalGradient(listOf(Color(0x08FFFFFF), Color(0x02FFFFFF)))).background(Color(0xCC0D0F14))
    .border(1.dp, Brush.verticalGradient(listOf(Color(0x40E9C27A), Color(0x0FE9C27A), Color(0x05FFFFFF))), RoundedCornerShape(22.dp)).padding(14.dp).animateContentSize(),
    verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }

@Composable private fun Way(title: String, modifier: Modifier, content: @Composable () -> Unit) = Column(modifier.clip(RoundedCornerShape(16.dp)).background(Color(0x08FFFFFF))
    .border(1.dp, SoftRim, RoundedCornerShape(16.dp)).padding(11.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Text(title.uppercase(), style = t(11f, FontWeight.ExtraBold, Site.Muted).copy(letterSpacing = 1.4.sp)); content() }

@Composable private fun CoinDot(size: Dp) = Box(Modifier.size(size).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFFFFF3C9), Color(0xFFF0C66D), Color(0xFFA8761F)))))

// ---------------------------------------------------------------- Random deck

/** Random deck (Deck Forge, the site's random builder as Quick Play runs it): a format, a bracket for Commander, a style. */
@Composable
fun RandomDeckSheet(onClose: () -> Unit, onDeck: (JsonObject, String) -> Unit) {
    val build by dev.cardstashy.nativeplay.play.RandomBuild.state.collectAsState()
    var format by remember { mutableStateOf("Standard") }; var bracket by remember { mutableStateOf<Int?>(null) }; var style by remember { mutableStateOf("classic") }
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(build.deck, build.busy, started) { val d = build.deck; if (started && !build.busy && d != null) { started = false; onDeck(d.deepCopy(), format) } }
    androidx.activity.compose.BackHandler { if (build.busy) dev.cardstashy.nativeplay.play.RandomBuild.cancel(); onClose() }
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(interactionSource = null, indication = null) { if (!build.busy) onClose() }) {
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).background(Site.Surface2)
            .border(1.dp, SoftRim, RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp)).clickable(interactionSource = null, indication = null) {}.padding(20.dp).padding(bottom = 90.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("✦", style = t(28f, color = Color(0xFFF0C66D)))
            Text("A new game plan", style = t(17f, FontWeight.ExtraBold))
            Text("Deck Forge builds a $format deck. Look over the full list before you save it; cards you don't have yet show what they cost in seals.", style = t(13.5f, color = Site.Muted), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) { RANDOM_DECK_FORMATS.forEach { f -> ChipOn(f, format == f) { format = f } } }
            if (format == "Commander") FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                Text("Aim for bracket", style = t(12.5f, color = Site.Muted)); (listOf<Int?>(null) + (1..5)).forEach { b -> ChipOn(b?.toString() ?: "Any", bracket == b) { bracket = b } } }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("classic" to "Classic strategy", "infinite-mana" to "Infinite mana engine").forEach { (k, l) -> ChipOn(l, style == k) { style = k } } }
            GoldCta(if (build.busy) "Building deck…" else "Build random deck", Modifier.fillMaxWidth(), enabled = !build.busy) {
                started = true; dev.cardstashy.nativeplay.play.RandomBuild.start(format, if (format == "Commander") bracket else null, style) }
            if (build.busy) { BrandMark(40.dp); Text(build.status.ifBlank { "Preparing your cards…" }, style = t(13f, color = Site.Muted))
                GhostButton("Cancel build") { dev.cardstashy.nativeplay.play.RandomBuild.cancel(); started = false } }
            build.error?.takeIf { started || !build.busy }?.let { Text(it, style = t(12.5f, color = Warn)) }
        }
    }
}
/** The formats Deck Forge builds for (play-menu.js RANDOM_DECK_FORMATS, as the Quick Play picker). */
val RANDOM_DECK_FORMATS = listOf("Standard", "Commander")
