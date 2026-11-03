@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.play.Decks
import dev.cardstashy.nativeplay.play.Progress
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Ink = Site.Text
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
internal const val DECKS_ART = "https://cards.scryfall.io/art_crop/front/f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg" // Tolarian Academy (TILE_ART.decks)
private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""

/** What the precon shelf holds (app.js preconUi): the index, the search, how many show, the open deck. */
class PreconUi { var index by mutableStateOf<List<Decks.PreconEntry>?>(null); var busy by mutableStateOf(false); var error by mutableStateOf("")
    var query by mutableStateOf(""); var limit by mutableStateOf(12); var open by mutableStateOf<OpenPrecon?>(null) }
data class OpenPrecon(val file: String, val name: String, val product: String, val released: String, val formats: List<String>, val rows: List<Decks.Row>)
/** Paste a list (app.js econUi.check). */
data class Check(val text: String = "", val name: String = "", val busy: Boolean = false, val error: String = "", val rows: List<Decks.Row>? = null,
                 val rarity: Map<String, String> = emptyMap(), val formats: List<String> = emptyList(), val format: String? = null)

/**
 * The Play Decks page, decksMarkup in play-econ-ui.js: the deck shelf (Build a deck, then your Play decks as the
 * app's deck tiles with share in your Trunk and cards to stamp, × to delete), Precons from MTGJSON with their exact
 * printings and the price for only the cards you lack, and Paste a list with its legal formats and seal costs.
 */
@Composable
fun DecksScreen(state: JsonObject, onBack: () -> Unit, onDeck: (String) -> Unit, onFinder: () -> Unit, toast: (String) -> Unit,
                nav: @Composable () -> Unit, precon: PreconUi = remember { PreconUi() }, initialCheck: Check = Check()) {
    val scope = rememberCoroutineScope()
    var check by remember { mutableStateOf(initialCheck) }
    var deleting by remember { mutableStateOf<JsonObject?>(null) }
    val owned = remember(state) { Decks.ownedByName(state) }
    val decks = state.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject } ?: emptyList()
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.statusBars).padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)) {
            PageHeader("Decks", "Play", onBack = onBack)
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val cols = when { maxWidth >= 1000.dp -> 3; maxWidth >= 640.dp -> 2; else -> 1 }
                val tiles: List<@Composable (Modifier) -> Unit> = listOf<@Composable (Modifier) -> Unit>({ m -> NewDeckTile(m, onFinder) }) +
                    decks.map { d -> @Composable { m: Modifier -> PlayDeckTile(d, owned, m, { onDeck(d.s("id")) }) { deleting = d } } }
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    tiles.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEach { it(Modifier.weight(1f)) }; repeat(cols - row.size) { Spacer(Modifier.weight(1f)) } } }
                }
            }
            Panel("Precons", "Published decks with their real printings. You only pay for the cards you don't have yet.") { PreconShelf(state, precon, owned, toast) }
            Panel("Paste a list", null) { ImportPanel(check, owned, { check = it }) { c -> scope.launch { check = checkList(c) } } ; SaveRow(check, { check = it }) { c ->
                scope.launch { runCatching { Progress.saveDeck(JsonObject().apply { addProperty("name", c.name.ifBlank { "Play deck" }); addProperty("format", c.format); add("cards", rowsJson(c.rows!!)) }) }
                    .onSuccess { check = Check(); toast("Saved to your Play decks.") }.onFailure { toast(it.message ?: "Could not save the deck.") } } } }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
    deleting?.let { d ->
        AlertDialog(onDismissRequest = { deleting = null }, containerColor = Site.Surface2,
            text = { Text("Delete this Play deck?", style = t(16f, FontWeight.SemiBold)) },
            confirmButton = { TextButton({ deleting = null; scope.launch { runCatching { Progress.saveDeck(JsonObject().apply { addProperty("id", d.s("id")); addProperty("delete", true) }) } } }) { Text("OK", style = t(15f, FontWeight.Bold, Site.Gold)) } },
            dismissButton = { TextButton({ deleting = null }) { Text("Cancel", style = t(15f, FontWeight.SemiBold, Site.Muted)) } })
    }
}

fun rowsJson(rows: List<Decks.Row>) = JsonArray().apply { rows.forEach { r -> add(JsonObject().apply { addProperty("name", r.name); addProperty("qty", r.qty); r.board?.let { addProperty("board", it) } }) } }

/** .pe-shelf / .pe-import: 22 dp glass with a gold-tinted line, Cinzel 20 title. */
@Composable
private fun Panel(title: String, sub: String?, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp)).background(Brush.verticalGradient(listOf(Color(0x08FFFFFF), Color(0x02FFFFFF)))).background(Color(0xCC0D0F14))
        .border(1.dp, Brush.verticalGradient(listOf(Color(0x40E9C27A), Color(0x0FE9C27A), Color(0x05FFFFFF))), RoundedCornerShape(26.dp)).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = .04.em, color = Color(0xFFF3E3BD)))
        if (sub != null) Text(sub, style = t(14f, color = Site.Muted))
        content()
    }
}

// ---------------------------------------------------------------- deck tiles (.deck-tile, 190 dp)

@Composable
private fun TileFrame(art: String?, modifier: Modifier, artAlpha: Float = 1f, onClick: () -> Unit, content: @Composable BoxScope.() -> Unit) {
    val p = heroPainter(art?.let(homeArt))
    Box(modifier.height(190.dp).softTile().clickable(onClick = onClick)) {
        if (p != null) Image(p, null, Modifier.fillMaxSize().alpha(artAlpha), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x40000000), .3f to Color.Transparent, .72f to Color(0xEB08090C), 1f to Color(0xEB08090C))))
        content()
    }
}

@Composable
private fun NewDeckTile(modifier: Modifier, onClick: () -> Unit) = TileFrame(DECKS_ART, modifier, .75f, onClick) {
    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.Bottom) {
        Text("Build a deck", style = t(18f, FontWeight.ExtraBold, Color.White)); Text("From the cards in your Trunk", style = t(12.5f, color = Color(0xFFD5D9E0)))
    }
}

@Composable
private fun PlayDeckTile(d: JsonObject, owned: Map<String, Int>, modifier: Modifier, onOpen: () -> Unit, onDelete: () -> Unit) {
    val n = Decks.tile(d, owned); val name = d.s("name").ifBlank { "Untitled deck" }
    TileFrame(Decks.cover(d), modifier, onClick = onOpen) {
        Text(d.s("format").ifBlank { "Casual" }, style = t(12f, FontWeight.Bold, Color(0xFFE6E8EC)), modifier = Modifier.padding(10.dp)
            .softPill(RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 4.dp))
        Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(44.dp).softPill(CircleShape)
            .clickable(onClick = onDelete), contentAlignment = Alignment.Center) { Text("✕", style = t(16f, FontWeight.Bold, Color(0xFFF6EEDB))) }
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(name, style = t(18f, FontWeight.ExtraBold, Color.White), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${n.main}/${n.size}" + if (n.side > 0) " · ${n.side} sideboard" else "", style = t(12.5f, color = Color(0xFFD5D9E0)))
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Stat("${Math.round(n.share * 100)}%", " in your Trunk"); if (n.missing > 0) Stat("${n.missing}", " to stamp") else Text("Ready", style = t(11.5f, color = Color(0xFFC4C9D2)))
            }
            ProgressBar(n.share.toFloat(), Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun Stat(em: String, rest: String) = Text(androidx.compose.ui.text.buildAnnotatedString {
    pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.ExtraBold, color = Color.White, fontSize = 13.sp)); append(em); pop(); append(rest) }, style = t(11.5f, color = Color(0xFFC4C9D2)))

// ---------------------------------------------------------------- precons

/** Soft glass (Randall 3 Nov): big radius, a lit rim that fades down instead of a hard line, a soft drop shadow. */
internal val SoftRim = Brush.verticalGradient(listOf(Color(0x38FFFFFF), Color(0x0FFFFFFF), Color(0x05FFFFFF)))
internal fun Modifier.softTile(radius: androidx.compose.ui.unit.Dp = 22.dp, fill: Color = Site.Surface2): Modifier { val shape = RoundedCornerShape(radius)
    return shadow(14.dp, shape, ambientColor = Color(0x99000000), spotColor = Color(0x99000000)).clip(shape).background(fill).border(1.dp, SoftRim, shape) }
internal fun Modifier.softPill(shape: androidx.compose.ui.graphics.Shape): Modifier = clip(shape).background(Color(0x990C0E13)).border(1.dp, SoftRim, shape)

/** The precon list is kept on disk for a day and opened precons for the visit (the web gets this from the browser cache). */
var preconCacheDir: java.io.File? = null
private val preconSession = java.util.concurrent.ConcurrentHashMap<String, JsonObject>()
private suspend fun fetchJson(url: String, dayCache: Boolean = false): JsonObject? = withContext(Dispatchers.IO) {
    preconSession[url]?.let { return@withContext it }
    val file = if (dayCache) preconCacheDir?.resolve("mtgjson-" + url.substringAfterLast('/')) else null
    if (file != null && file.exists() && System.currentTimeMillis() - file.lastModified() < 24 * 3600_000L)
        runCatching { com.google.gson.JsonParser.parseString(file.readText()).asJsonObject }.getOrNull()?.let { preconSession[url] = it; return@withContext it }
    val out = runCatching { Http.call("GET", url, mapOf("Accept" to "application/json"), null, 30_000) as? JsonObject }.getOrNull()
    if (out != null) { preconSession[url] = out; if (file != null) runCatching { file.writeText(out.toString()) } }
    out
}

@Composable
private fun PreconShelf(state: JsonObject, pc: PreconUi, owned: Map<String, Int>, toast: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    fun load() { if (pc.index != null || pc.busy) return; pc.busy = true; pc.error = ""
        scope.launch { val j = fetchJson("https://mtgjson.com/api/v5/DeckList.json", dayCache = true); if (j != null) pc.index = Decks.preconIndex(j) else pc.error = "Could not load the precon list right now."; pc.busy = false } }
    LaunchedEffect(Unit) { load() }
    val o = pc.open
    if (o != null) { OpenPreconView(state, o, owned, pc, toast); return }
    when {
        pc.busy && pc.index == null -> Text("Loading the precon list…", style = t(13f, color = Site.Muted))
        pc.error.isNotEmpty() -> Text(pc.error, style = t(14f, color = Color(0xFFFFB86B)))
        pc.index == null -> GhostButton("Show the precons") { load() }
        else -> {
            val q = pc.query.trim().lowercase()
            val list = pc.index!!.filter { q.isEmpty() || it.name.lowercase().contains(q) || it.code.lowercase() == q || it.type.lowercase().contains(q) }
            val shown = list.take(pc.limit)
            LaunchedEffect(shown.map { it.code }) { dev.cardstashy.nativeplay.play.SetFacts.ensure(shown.map { it.code.lowercase() }) }
            Field(pc.query, "Precon or set name") { pc.query = it; pc.limit = 12 }
            if (pc.busy) Text("Opening the deck box…", style = t(13f, color = Site.Muted))
            if (shown.isEmpty()) Text("No precons match.", style = t(13f, color = Site.Muted))
            BoxWithConstraints { val cols = maxOf(1, (maxWidth / 230.dp).toInt())
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { shown.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { d -> PreconButton(d, Modifier.weight(1f)) { openPrecon(scope, pc, d, toast) } }; repeat(cols - row.size) { Spacer(Modifier.weight(1f)) } } } } }
            if (list.size > shown.size) GhostButton("Show more (${list.size - shown.size})") { pc.limit += 24 }
        }
    }
}

private fun openPrecon(scope: kotlinx.coroutines.CoroutineScope, pc: PreconUi, e: Decks.PreconEntry, toast: (String) -> Unit) {
    if (pc.busy) return; pc.busy = true
    scope.launch {
        val j = fetchJson("https://mtgjson.com/api/v5/decks/" + e.fileName.removeSuffix(".json") + ".json")
        val d = j?.getAsJsonObject("data") ?: j
        if (d == null) toast("That precon could not be opened.")
        else pc.open = OpenPrecon(e.fileName, d.s("name").ifBlank { e.name }, e.type, e.releaseDate, Decks.preconFormats(j!!) ?: emptyList(), Decks.mtgjsonDeckRows(d))
        pc.busy = false
    }
}

@Composable
private fun PreconButton(d: Decks.PreconEntry, modifier: Modifier, onClick: () -> Unit) {
    // Signature art tile: the set's lead art behind a glass shade, set emblem, name, product and year.
    val sets by dev.cardstashy.nativeplay.play.SetFacts.sets.collectAsState()
    val code = d.code.lowercase(); val p = heroPainter((sets[code]?.art?.ifBlank { null } ?: DECKS_ART).let(homeArt))
    Box(modifier.height(140.dp).softTile().clickable(onClick = onClick)) {
        if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF1B1F29), Color(0xFF0F1117)))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), .35f to Color(0x10000000), .75f to Color(0xE608090C), 1f to Color(0xF208090C))))
        Box(Modifier.padding(10.dp).size(34.dp).softPill(CircleShape), contentAlignment = Alignment.Center) {
            SetIcon(code, Modifier.size(20.dp), Color(0xFFF3E3BD)) }
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(d.name, style = t(16f, FontWeight.ExtraBold, Color.White, line = 20f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("${d.type} · ${d.releaseDate.take(4)}", style = t(12.5f, color = Color(0xFFD5D9E0)))
        }
    }
}

@Composable
private fun OpenPreconView(state: JsonObject, o: OpenPrecon, owned: Map<String, Int>, pc: PreconUi, toast: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val sh = Decks.shortfall(o.rows, owned, o.rows.associate { it.name to it.rarity })
    val missing = sh.total; val price = Decks.preconPrice(missing, state.getAsJsonObject("config")); val coins = state.getAsJsonObject("wallet")?.get("coins")?.asInt ?: 0
    var busy by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // The deck's face: its lead card's exact art, the same art-bleed hero as a Play deck.
        val lead = o.rows.firstOrNull { it.board != "side" && !Decks.isBasicLand(it.name) } ?: o.rows.firstOrNull()
        val heroArt = lead?.id?.let { Decks.scryfallImage(it).replace("/normal/", "/art_crop/") }?.ifBlank { null }
        val hp = heroPainter(heroArt?.let(homeArt))
        Box(Modifier.fillMaxWidth().height(180.dp).softTile()) {
            if (hp != null) Image(hp, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), .4f to Color.Transparent, .8f to Color(0xE608090C), 1f to Color(0xF208090C))))
            Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 14.dp, vertical = 12.dp)) {
                Text(o.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 21.sp, lineHeight = 25.sp, color = Color(0xFFF3E3BD)))
                Text("${o.product.ifBlank { "Precon" }} · ${o.released.take(4)}" + if (o.formats.isNotEmpty()) " · " + o.formats.joinToString(", ") else " · Casual", style = t(13.5f, color = Color(0xFFD5D9E0)))
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            GhostButton("All precons") { pc.open = null }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (missing > 0) "$missing card${if (missing == 1) "" else "s"} to add · ${"%,d".format(price)} coins" else "You own every card", style = t(14f))
                GoldCta(if (price > coins) "Not enough coins" else if (missing > 0) "Buy deck" else "Add to my decks", enabled = !busy && price <= coins) {
                    busy = true
                    scope.launch {
                        runCatching { Progress.precon(o.file, o.formats.firstOrNull() ?: "Casual") }.onSuccess { out -> pc.open = null
                            val g = out.get("granted")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
                            toast(if (g > 0) "${o.name} is yours. $g new card${if (g == 1) "" else "s"} in your Trunk." else "${o.name} is in your decks.") }
                        busy = false; Progress.refresh()
                    }
                }
            }
        }
        PreconCards(o.rows.filter { it.board != "side" }, owned)
        val side = o.rows.filter { it.board == "side" }
        if (side.isNotEmpty()) { Text("Sideboard", style = t(15f, FontWeight.Bold)); PreconCards(side, owned) }
    }
}

private fun Modifier.widthInMin(w: androidx.compose.ui.unit.Dp) = this.then(Modifier.width(w))

@Composable
private fun PreconCards(rows: List<Decks.Row>, owned: Map<String, Int>) {
    val have = HashMap(owned)
    val cells = rows.map { r -> val got = if (Decks.isBasicLand(r.name)) r.qty else minOf(r.qty, have[r.name] ?: 0); have[r.name] = maxOf(0, (have[r.name] ?: 0) - got); r to got }
    BoxWithConstraints { val cols = maxOf(3, (maxWidth / 110.dp).toInt())
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { cells.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { (r, got) -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                CardPicture(Decks.scryfallImage(r.id).ifBlank { "https://api.scryfall.com/cards/named?format=image&version=normal&exact=" + java.net.URLEncoder.encode(r.name, "UTF-8") }, null, null,
                    Modifier.fillMaxWidth().aspectRatio(63f / 88f).alpha(if (got < r.qty) .55f else 1f), RoundedCornerShape(6.dp))
                Text(androidx.compose.ui.text.buildAnnotatedString { append("${r.qty}×"); if (got < r.qty) { append(" "); pushStyle(androidx.compose.ui.text.SpanStyle(color = Site.Gold, fontWeight = FontWeight.Bold)); append("${r.qty - got} new"); pop() } }, style = t(12f, color = Site.Muted))
            } }
            repeat(cols - row.size) { Spacer(Modifier.weight(1f)) } } } } }
}

// ---------------------------------------------------------------- Paste a list

@Composable
internal fun Field(value: String, hint: String, lines: Int = 1, onChange: (String) -> Unit) {
    Box(Modifier.fillMaxWidth().heightIn(min = if (lines > 1) (lines * 22 + 24).dp else 44.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xB30D0F14)).border(1.dp, SoftRim, RoundedCornerShape(16.dp))
        .padding(horizontal = 14.dp, vertical = 12.dp)) {
        if (value.isEmpty()) Text(hint, style = t(15f, color = Site.Muted))
        BasicTextField(value, onChange, singleLine = lines == 1, minLines = lines, textStyle = t(15f), cursorBrush = SolidColor(Site.Gold), modifier = Modifier.fillMaxWidth())
    }
}

/** playEconCheckDeck: read the list, ask Scryfall for each card's rarity and legality, then the formats it fits. */
private suspend fun checkList(c: Check): Check {
    val rows = Decks.parsePaste(c.text).toMutableList()
    if (rows.isEmpty()) return c.copy(busy = false, error = "Paste a list like \"4 Lightning Bolt\", one card per line.")
    return withContext(Dispatchers.IO) {
        try {
            val names = rows.map { it.name }.distinct(); val rarity = HashMap<String, String>(); val legal = HashMap<String, Map<String, String>>()
            for (chunk in names.chunked(75)) {
                val body = JsonObject().apply { add("identifiers", JsonArray().apply { chunk.forEach { n -> add(JsonObject().apply { addProperty("name", n) }) } }) }
                val b = Http.call("POST", "https://api.scryfall.com/cards/collection", mapOf("Content-Type" to "application/json"), body.toString(), 20_000) as? JsonObject
                b?.getAsJsonArray("data")?.forEach { e -> val card = e.asJsonObject; val nm = card.s("name")
                    for (n in setOf(nm, nm.split(" // ")[0])) { rarity[n] = card.s("rarity"); legal[n] = card.getAsJsonObject("legalities")?.entrySet()?.associate { it.key to it.value.asString } ?: emptyMap() } }
            }
            for (i in rows.indices) { val hit = legal.keys.firstOrNull { it.equals(rows[i].name, ignoreCase = true) }; if (hit != null && hit != rows[i].name) rows[i] = rows[i].copy(name = hit) }
            val formats = Decks.legalFormats(rows, legal)
            c.copy(busy = false, error = "", rows = rows, rarity = rarity, formats = formats, format = if (formats.size == 1) formats[0] else if (formats.isNotEmpty()) null else "Casual")
        } catch (_: Exception) { c.copy(busy = false, error = "Could not check the cards right now.") }
    }
}

@Composable
private fun ImportPanel(c: Check, owned: Map<String, Int>, onChange: (Check) -> Unit, onCheck: (Check) -> Unit) {
    Field(c.text, "Paste a list: 4 Lightning Bolt, one card per line. A Sideboard line starts the sideboard.", lines = 6) { onChange(c.copy(text = it.take(20000))) }
    GoldCta(if (c.busy) "Checking…" else "Check the list", Modifier.fillMaxWidth(), enabled = !c.busy) { val next = c.copy(busy = true); onChange(next); onCheck(next) }
    if (c.error.isNotEmpty()) Text(c.error, style = t(14f, color = Color(0xFFFFB86B)))
    val rows = c.rows ?: return
    val short = Decks.shortfall(rows, owned, c.rarity)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(when { c.formats.size == 1 -> "Legal in ${c.formats[0]}."; c.formats.isNotEmpty() -> "Legal in more than one format. Which is it for?"; else -> "Not legal in any format as listed, so it is saved as Casual." }, style = t(14f))
        if (c.formats.size > 1) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { c.formats.forEach { f -> Chip(f, c.format == f) { onChange(c.copy(format = f)) } } }
        if (short.complete) Text("Every card is in your Trunk.", style = t(14f, FontWeight.Bold, Color(0xFF7FD6A2)))
        else {
            Text("To finish it, stamp ${short.total} cards:", style = t(14f))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { listOf("c", "u", "r", "m").filter { (short.seals[it] ?: 0) > 0 }.forEach { k ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { SealMini(k); Text("${short.seals[k]}", style = t(14f, FontWeight.Bold)) } } }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { short.missing.take(60).forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { SealMini(m.seal, 16.dp); Text("${m.need} × ${m.name}", style = t(13f)) } } }
        }
    }
}

@Composable
private fun SaveRow(c: Check, onChange: (Check) -> Unit, onSave: (Check) -> Unit) {
    if (c.rows == null) return
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) { Field(c.name, "Deck name") { onChange(c.copy(name = it.take(80))) } }
        GoldCta("Save deck", enabled = !(c.formats.size > 1 && c.format == null)) { if (c.format != null) onSave(c) }
    }
}

/** The Decks page with live Play state; the editor and finder open on the web until 0.4.1 and 0.4.2. */
@Composable
fun DecksRoute(onBack: () -> Unit, onWeb: (String) -> Unit, onNav: (PlayTab) -> Unit, onTrunkSet: (String) -> Unit = {}) {
    val state by dev.cardstashy.nativeplay.play.Progress.state.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current
    preconCacheDir = context.cacheDir
    LaunchedEffect(Unit) { dev.cardstashy.nativeplay.play.Progress.loadCached(); dev.cardstashy.nativeplay.play.Progress.refresh() }
    val s = state ?: run { Box(Modifier.fillMaxSize().background(Site.Bg), contentAlignment = Alignment.Center) { Text("Opening your decks…", style = Site.Body) }; return }
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    var editor by remember { mutableStateOf<EditorUi?>(null) }
    var card by remember { mutableStateOf<CardPick?>(null) }
    val ed = editor
    Box(Modifier.fillMaxSize()) {
        if (ed != null) {
            BackHandler { editor = null }
            DeckEditor(s, ed, onBack = { editor = null }, onCard = { card = it }, onPack = { editor = null; onTrunkSet(it) }, toast = toast,
                nav = { PlayNav(PlayTab.DECKS, onNav) })
        } else DecksScreen(s, onBack,
            onDeck = { id -> editor = EditorUi().apply { edit = dev.cardstashy.nativeplay.play.DeckEdit.open(s.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject }?.firstOrNull { it.get("id")?.asString == id }) } },
            // Until the finder (0.4.2): the finder's Start empty, straight into the editor.
            onFinder = { editor = EditorUi() }, toast = toast, nav = { PlayNav(PlayTab.DECKS, onNav) })
        card?.let { pick ->
            CardSheet(pick, s, CardSheetActions(
                merchant = { code, _ -> card = null; toast("Merchant comes with the next build"); onTrunkSet(code) },
                set = { code -> card = null; onTrunkSet(code) },
                precon = { _, _ -> card = null },
                newDeck = { name -> card = null; editor = EditorUi().apply { edit = dev.cardstashy.nativeplay.play.DeckEdit.Edit(null, "", "Standard", listOf(dev.cardstashy.nativeplay.play.DeckEdit.Line(name, 1))) } },
                toast = toast), onClose = { card = null })
        }
    }
}
