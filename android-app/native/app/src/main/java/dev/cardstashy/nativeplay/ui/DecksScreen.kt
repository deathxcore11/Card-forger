@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.account.Decks as Workspace
import androidx.activity.compose.BackHandler

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.ui.graphics.graphicsLayer
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

private val Ink get() = Site.Text
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
internal const val DECKS_ART = "https://cards.scryfall.io/art_crop/front/f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg" // Tolarian Academy (TILE_ART.decks)
private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""

/** What the precon shelf holds (app.js preconUi): the index, the search, how many show, the open deck. */
class PreconUi { var index by mutableStateOf<List<Decks.PreconEntry>?>(null); var busy by mutableStateOf(false); var error by mutableStateOf("")
    /** MTGJSON's Commander decks, read with the index: only the weekly store's are offered (Shop, In the store). */
    var commander by mutableStateOf<List<Decks.PreconEntry>>(emptyList())
    var query by mutableStateOf(""); var limit by mutableStateOf(12); var open by mutableStateOf<OpenPrecon?>(null); var opening by mutableStateOf(false)
    /** loadPreconFaces: each tile's face card (name, Scryfall id) by deck file, kept on the device; files that gave none this visit. */
    val faces = androidx.compose.runtime.mutableStateMapOf<String, Pair<String, String>>()
    /** The Precons tab's product, format, colors and sort, and where its lists were scrolled to. */
    val filters = PreconFilters() }
data class OpenPrecon(val file: String, val name: String, val product: String, val released: String, val formats: List<String>, val rows: List<Decks.Row>)
/** Paste a list (app.js econUi.check). */
data class Check(val text: String = "", val name: String = "", val busy: Boolean = false, val error: String = "", val rows: List<Decks.Row>? = null,
                 val rarity: Map<String, String> = emptyMap(), val formats: List<String> = emptyList(), val format: String? = null)

/**
 * The Play Decks page (decksMarkup in play-econ-ui.js) as three tabs you swipe between (Randall 5 Nov 17:03Z): My decks
 * (Build a deck opens the Finder, Random deck runs Deck Forge, your Play decks as the app's deck tiles, Paste a list),
 * Precons (product lines, format and color filters, what each still needs) and Meta (the Finder's lists, embedded).
 */
@Composable
fun DecksScreen(state: JsonObject, onBack: () -> Unit, onDeck: (String) -> Unit, onFinder: () -> Unit, toast: (String) -> Unit,
                nav: @Composable () -> Unit, precon: PreconUi = remember { PreconUi() }, initialCheck: Check = Check(), tabs: DecksTabs = remember { DecksTabs() },
                meta: FinderUi = remember { FinderUi() }, onOpenPrecon: (Decks.PreconEntry) -> Unit = {}, onUse: (dev.cardstashy.nativeplay.play.DeckEdit.Edit, Boolean) -> Unit = { _, _ -> },
                onCard: (String) -> Unit = {}, onPack: (String) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var check by remember { mutableStateOf(initialCheck) }
    var deleting by remember { mutableStateOf<JsonObject?>(null) }
    var holding by remember { mutableStateOf<JsonObject?>(null) }
    val clip = androidx.compose.ui.platform.LocalClipboardManager.current
    val owned = remember(state) { Decks.ownedByName(state) }
    val decks = state.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject } ?: emptyList()
    val nameFact = rememberNameFacts()
    // playDeckEmblemWants: every deck's names, so the emblems can read their cards.
    LaunchedEffect(decks) { dev.cardstashy.nativeplay.play.CardFacts.wantNames(decks.flatMap { Decks.rows(it).map { r -> r.name } }) }
    val pager = androidx.compose.foundation.pager.rememberPagerState(initialPage = tabs.tab) { 3 }
    LaunchedEffect(pager.currentPage) { tabs.tab = pager.currentPage }
    fun loadIndex() { if (precon.index != null || precon.busy) return; precon.busy = true; precon.error = ""
        scope.launch { val j = fetchJson("https://mtgjson.com/api/v5/DeckList.json", dayCache = true); if (j != null) { precon.commander = Decks.commanderPreconIndex(j); precon.index = Decks.preconIndex(j) } else precon.error = "Could not load the precon list right now."; precon.busy = false } }
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        // The page sits below the status bar, so tiles never slide under the clock (Randall 5 Nov 16:58Z).
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)) {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 10.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PageHeader("Decks", "Play", onBack = onBack)
                DecksTabBar(listOf("My decks", "Precons", "Meta"), pager.currentPage + pager.currentPageOffsetFraction, pager.currentPage) { scope.launch { pager.animateScrollToPage(it) } }
            }
            androidx.compose.foundation.pager.HorizontalPager(pager, Modifier.fillMaxWidth().weight(1f), key = { it }) { page -> when (page) {
                0 -> Column(Modifier.fillMaxSize().verticalScroll(tabs.mine).padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        DeckActionTile("Build a deck", "From your Trunk, with meta ideas", DECKS_ART, Modifier.weight(1f), onClick = onFinder)
                        DeckActionTile("Random deck", "Deck Forge builds one for you", null, Modifier.weight(1f), sparkle = true) { tabs.randomOpen = true }
                    }
                    BoxWithConstraints(Modifier.fillMaxWidth()) {
                        val cols = when { maxWidth >= 1000.dp -> 3; maxWidth >= 640.dp -> 2; else -> 1 }
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            decks.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                row.forEach { d -> PlayDeckTile(d, owned, Modifier.weight(1f), nameFact, { onDeck(d.s("id")) }, onHold = { holding = d }) { deleting = d } }
                                repeat(cols - row.size) { Spacer(Modifier.weight(1f)) } } }
                        }
                    }
                    if (decks.isEmpty()) Text("No Play decks yet. Build one, roll a random one, or pick a precon.", style = t(14f, color = Site.Muted))
                    Panel("Paste a list", null) { ImportPanel(check, owned, { check = it }) { c -> scope.launch { check = checkList(c) } } ; SaveRow(check, { check = it }) { c ->
                        scope.launch { runCatching { Progress.saveDeck(JsonObject().apply { addProperty("name", c.name.ifBlank { "Play deck" }); addProperty("format", c.format); add("cards", rowsJson(c.rows!!)) }) }
                            .onSuccess { check = Check(); toast("Saved to your Play decks.") }.onFailure { toast(it.message ?: "Could not save the deck.") } } } }
                }
                1 -> PreconsTab(state, precon, owned, onOpen = onOpenPrecon, onLoad = ::loadIndex)
                // The Finder ranks every meta list when it composes, so it waits for the swipe to land on Meta and the
                // swipe stays smooth; until then the page shows soft loading tiles.
                else -> if (pager.settledPage == 2) FinderScreen(state, meta, onBack = {}, onUse = onUse, onCard = onCard, toast = toast, onPack = onPack, nav = {}, embedded = true)
                    else Column(Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 4.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        repeat(3) { Box(Modifier.fillMaxWidth().height(180.dp).softTile(22.dp)) } }
            } }
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
    }
    // Hold a Play deck: its Play actions (deckMenu's layout; the Collection's share, prices and proxies stay there).
    holding?.let { d ->
        val n = Decks.tile(d, owned); val name = d.s("name").ifBlank { "Untitled deck" }
        val close = { holding = null }
        ContextSheet("Play deck", name, "${d.s("format").ifBlank { "Casual" }} · ${n.main}/${n.size} cards", Decks.cover(d)?.let(homeArt) as? String, listOf(
            listOf(ContextAction(SiteIcons.CardStack, "Open deck", "Cards, stamps and the editor") { close(); onDeck(d.s("id")) },
                ContextAction(SiteIcons.Trunk, if (n.missing > 0) "Stamp missing cards" else "All cards in your Trunk", if (n.missing > 0) "${n.missing} to stamp with seals" else null) { close(); onDeck(d.s("id")) }),
            listOf(ContextAction(SiteIcons.Copy, "Copy decklist") {
                close(); clip.setText(androidx.compose.ui.text.AnnotatedString((d.getAsJsonArray("cards") ?: JsonArray()).mapNotNull { it as? JsonObject }
                    .joinToString("\n") { r -> "${r.get("qty")?.takeIf { it.isJsonPrimitive }?.asInt ?: 1} ${r.s("name")}" })); toast("Decklist copied.") },
                ContextAction(SiteIcons.Decks, "Duplicate deck") {
                    close(); scope.launch { runCatching { Progress.saveDeck(JsonObject().apply { addProperty("name", "$name copy"); addProperty("format", d.s("format").ifBlank { "Standard" })
                        add("cards", d.getAsJsonArray("cards") ?: JsonArray()) }) }.onSuccess { toast("Duplicated.") }.onFailure { toast(it.message ?: "Could not save the deck.") } } }),
            listOf(ContextAction(SiteIcons.Close, "Delete deck", danger = true) { close(); deleting = d })), close)
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
    // Native fix (Randall 4 Nov 10:26Z): in Light the site leaves these panels dark with unreadable grey text; the app uses
    // the site's light glass instead (rgba(255,255,255,.58), --glass-line, --text), like the lobby's import panel.
    val light = AppSettings.theme == "light"
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp)).then(if (light) Modifier.background(Color(0x94FFFFFF)).border(1.dp, Site.GlassLine, RoundedCornerShape(26.dp))
        else Modifier.background(Brush.verticalGradient(listOf(Color(0x08FFFFFF), Color(0x02FFFFFF)))).background(Color(0xCC0D0F14))
        .border(1.dp, Brush.verticalGradient(listOf(Color(0x40E9C27A), Color(0x0FE9C27A), Color(0x05FFFFFF))), RoundedCornerShape(26.dp))).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(title, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = .04.em, color = if (light) Site.Text else Color(0xFFF3E3BD)))
        if (sub != null) Text(sub, style = t(14f, color = Site.Muted))
        content()
    }
}

// ---------------------------------------------------------------- deck tiles (.deck-tile, 190 dp)

@Composable
private fun TileFrame(art: String?, modifier: Modifier, artAlpha: Float = 1f, onHold: (() -> Unit)? = null, onClick: () -> Unit, content: @Composable BoxScope.() -> Unit) {
    val p = heroPainter(art?.let(homeArt))
    Box(modifier.height(190.dp).softTile().combinedClickable(onLongClick = onHold, onClick = onClick)) {
        if (p != null) Image(p, null, Modifier.fillMaxSize().alpha(artAlpha), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x40000000), .3f to Color.Transparent, .72f to Color(0xEB08090C), 1f to Color(0xEB08090C))))
        content()
    }
}

/** Card facts by name for the deck emblems (the site's finderFacts.get): the full name, then the front face. */
@Composable
internal fun rememberNameFacts(): (String) -> JsonObject? {
    val facts by dev.cardstashy.nativeplay.play.CardFacts.cards.collectAsState()
    val byName = remember(facts) { HashMap<String, JsonObject>().also { m -> facts.values.forEach { f -> val n = f.card.get("name")?.asString ?: return@forEach; m.putIfAbsent(n, f.card); m.putIfAbsent(n.split(" // ")[0], f.card) } } }
    return { n -> byName[n] ?: byName[n.split(" // ")[0]] }
}
/** playDeckEmblemOf: meta lists only once the finder's tournament data has loaded, as on the site. */
internal fun emblemOf(rows: List<Decks.Row>, format: String, nameFact: (String) -> JsonObject?) = dev.cardstashy.nativeplay.play.DeckEmblem.of(rows, nameFact,
    (if (dev.cardstashy.nativeplay.play.MetaLists.hasMeta(format)) dev.cardstashy.nativeplay.play.MetaLists.cached(format) else null).orEmpty()
        .map { dev.cardstashy.nativeplay.play.DeckEmblem.Meta(it.archetype.ifBlank { it.name }, it.cards) })

/** The emblem plate (.deck-format-emblem with .pe-deck-pips / .pe-deck-style): pips, the label, then " · plan" and " · Precon". */
@Composable
internal fun EmblemPlate(label: String, e: dev.cardstashy.nativeplay.play.DeckEmblem.Emblem?, modifier: Modifier = Modifier) =
    Row(modifier.softPill(RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (e != null) { Row(Modifier.padding(end = 4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            (e.colors.ifEmpty { listOf("C") }).forEach { k -> Symbol(k, 16.dp, Modifier.shadow(2.dp, CircleShape)) } } }
        Text(androidx.compose.ui.text.buildAnnotatedString {
            append(label)
            val plan = androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.SemiBold, color = Color(0xEBE6E8EC))
            if (!e?.style.isNullOrEmpty()) { pushStyle(plan); append(" · " + e!!.style); pop() }
            if (e?.precon == true && label != "Precon") { pushStyle(plan); append(" · Precon"); pop() }
        }, style = t(12f, FontWeight.Bold, Color(0xFFE6E8EC)), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }

/** .pe-deck-meta: the gold "META · archetype" line above the deck's name. */
@Composable
internal fun MetaLine(meta: String) = Text("Meta · $meta".uppercase(), maxLines = 1, overflow = TextOverflow.Ellipsis,
    style = t(12.5f, FontWeight.Bold, Color(0xFFE3B85A)).copy(letterSpacing = 0.5.sp, shadow = androidx.compose.ui.graphics.Shadow(Color(0xB3000000), androidx.compose.ui.geometry.Offset(0f, 1f), 3f)))

@Composable
private fun PlayDeckTile(d: JsonObject, owned: Map<String, Int>, modifier: Modifier, nameFact: (String) -> JsonObject?, onOpen: () -> Unit, onHold: () -> Unit = {}, onDelete: () -> Unit) {
    val n = Decks.tile(d, owned); val name = d.s("name").ifBlank { "Untitled deck" }
    val e = emblemOf(Decks.rows(d), d.s("format"), nameFact)
    Workspace.playDeckCovers.collectAsState().value
    TileFrame(Workspace.pickedCover(d.s("id").ifBlank { null }) ?: Decks.cover(d), modifier, onHold = onHold, onClick = onOpen) {
        EmblemPlate(d.s("format").ifBlank { "Casual" }, e, Modifier.padding(start = 10.dp, top = 10.dp, end = 62.dp))
        Box(Modifier.align(Alignment.TopEnd).padding(10.dp).size(44.dp).softPill(CircleShape)
            .clickable(onClick = onDelete), contentAlignment = Alignment.Center) { Text("✕", style = t(16f, FontWeight.Bold, Color(0xFFF6EEDB))) }
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            if (e.meta.isNotEmpty()) MetaLine(e.meta)
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

/** The precon list (MTGJSON's DeckList, kept a day), into [pc] once. */
internal suspend fun loadPreconIndex(pc: PreconUi) {
    if (pc.index != null || pc.busy) return
    pc.busy = true; pc.error = ""
    val j = fetchJson("https://mtgjson.com/api/v5/DeckList.json", dayCache = true)
    if (j != null) { pc.commander = Decks.commanderPreconIndex(j); pc.index = Decks.preconIndex(j) } else pc.error = "Could not load the precon list right now."
    pc.busy = false
}

internal fun openPrecon(scope: kotlinx.coroutines.CoroutineScope, pc: PreconUi, e: Decks.PreconEntry, toast: (String) -> Unit) {
    if (pc.opening) return; pc.opening = true
    scope.launch {
        val j = fetchJson("https://mtgjson.com/api/v5/decks/" + e.fileName.removeSuffix(".json") + ".json")
        val d = j?.getAsJsonObject("data") ?: j
        if (d == null) toast("That precon could not be opened.")
        else { pc.open = OpenPrecon(e.fileName, d.s("name").ifBlank { e.name }, e.type, e.releaseDate, Decks.preconFormatsAny(j!!) ?: emptyList(), Decks.preconRows(d))
            if (e.fileName !in PreconStore.summaries) PreconStore.put(e.fileName, j) }
        pc.opening = false
    }
}

// ---------------------------------------------------------------- Paste a list

@Composable
internal fun Field(value: String, hint: String, lines: Int = 1, onChange: (String) -> Unit) {
    Box(Modifier.fillMaxWidth().heightIn(min = if (lines > 1) (lines * 22 + 24).dp else 44.dp).clip(RoundedCornerShape(16.dp))
        .then(if (AppSettings.theme == "light") Modifier.background(Color(0xADF1F5FB)).border(1.dp, Site.GlassLine, RoundedCornerShape(16.dp)) else Modifier.background(Color(0xB30D0F14)).border(1.dp, SoftRim, RoundedCornerShape(16.dp)))
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

/** The Decks page with live Play state: the tabs, and on top of them the Finder, the editor or a precon's page. */
@Composable
fun DecksRoute(onBack: () -> Unit, onWeb: (String) -> Unit, onNav: (PlayTab) -> Unit, onTrunkSet: (String) -> Unit = {}) {
    val state by dev.cardstashy.nativeplay.play.Progress.state.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current
    preconCacheDir = context.cacheDir; PreconStore.dir = context.cacheDir
    LaunchedEffect(Unit) { dev.cardstashy.nativeplay.play.Progress.loadCached(); dev.cardstashy.nativeplay.play.Progress.refresh() }
    val s = state ?: run { Box(Modifier.fillMaxSize().background(Site.Bg), contentAlignment = Alignment.Center) { Text("Opening your decks…", style = Site.Body) }; return }
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    val scope = rememberCoroutineScope()
    var editor by remember { mutableStateOf<EditorUi?>(null) }
    var finder by remember { mutableStateOf<FinderUi?>(null) }
    var card by remember { mutableStateOf<CardPick?>(null) }
    var cardTab by remember { mutableStateOf("overview") }
    val tabs = remember { DecksTabs() }
    val precon = remember { PreconUi() }
    val meta = remember { FinderUi() }
    val owned = remember(s) { Decks.ownedByName(s) }
    val ed = editor
    LaunchedEffect(Unit) { if (dev.cardstashy.nativeplay.account.Account.session.value != null && Workspace.decks.value == null) runCatching { Workspace.load(context) } }
    // playFinderUse: a list opens in the editor as a new deck, its list first when it is complete.
    val use = { e: dev.cardstashy.nativeplay.play.DeckEdit.Edit, complete: Boolean -> editor = EditorUi().apply { edit = e; mode = if (complete || e.cards.isEmpty()) "mine" else "all" } }
    val onCard = { name: String -> card = CardPick(name, "", null, "nonfoil") }
    Box(Modifier.fillMaxSize()) {
        val fu = finder
        if (ed == null && fu != null) {
            BackHandler { finder = null }
            FinderScreen(s, fu, onBack = { finder = null }, onUse = use, onCard = onCard, toast = toast, onPack = { finder = null; onTrunkSet(it) }, nav = { PlayNav(PlayTab.DECKS, onNav) })
        } else if (ed != null) {
            BackHandler { editor = null }
            DeckEditor(s, ed, onBack = { editor = null }, onCard = { cardTab = "overview"; card = it }, onPack = { editor = null; onTrunkSet(it) }, toast = toast,
                onCardTab = { p, tab -> cardTab = tab; card = p }, nav = { PlayNav(PlayTab.DECKS, onNav) })
        } else {
            DecksScreen(s, onBack,
                // A saved deck (a precon too) opens as its list; the Trunk's cards come up with Add cards (Randall 5 Nov 16:53Z).
                onDeck = { id -> editor = EditorUi().apply { adding = false; edit = dev.cardstashy.nativeplay.play.DeckEdit.open(s.getAsJsonArray("decks")?.mapNotNull { it as? JsonObject }?.firstOrNull { it.get("id")?.asString == id }) } },
                // Build a deck opens the finder, as on the live site (decksMarkup's data-econ-view="finder").
                onFinder = { finder = finder ?: FinderUi() },
                toast = toast, nav = { PlayNav(PlayTab.DECKS, onNav) }, precon = precon, tabs = tabs, meta = meta,
                onOpenPrecon = { e -> openPrecon(scope, precon, e, toast) }, onUse = use, onCard = onCard, onPack = { onTrunkSet(it) })
            // A meta list's cards (See the cards) and a precon open as their own pages over the tabs; back returns to the same spot.
            if (meta.open != null) FinderScreen(s, meta, onBack = { meta.open = null }, onUse = use, onCard = onCard, toast = toast, onPack = { meta.open = null; onTrunkSet(it) }, nav = { PlayNav(PlayTab.DECKS, onNav) })
            PreconLayer(precon) { o, back -> PreconPage(s, o, owned, precon, onBack = back, onCard = onCard, toast = toast, nav = { PlayNav(PlayTab.DECKS, onNav) }) }
            if (precon.opening) Box(Modifier.fillMaxSize().background(Color(0x66000000)), contentAlignment = Alignment.Center) { BrandMark(52.dp) }
            if (tabs.randomOpen) RandomDeckSheet(onClose = { tabs.randomOpen = false }) { d, format ->
                tabs.randomOpen = false
                d.addProperty("format", format)
                editor = EditorUi().apply { adding = false; mode = "all"; edit = dev.cardstashy.nativeplay.play.DeckEdit.open(d).copy(id = null, dirty = true) } }
        }
        card?.let { pick ->
            CardSheet(pick, s, CardSheetActions(
                merchant = { code, _ -> card = null; toast("Merchant comes with the next build"); onTrunkSet(code) },
                set = { code -> card = null; onTrunkSet(code) },
                precon = { _, _ -> card = null },
                newDeck = { name -> card = null; editor = EditorUi().apply { edit = dev.cardstashy.nativeplay.play.DeckEdit.Edit(null, "", "Standard", listOf(dev.cardstashy.nativeplay.play.DeckEdit.Line(name, 1))) } },
                toast = toast, edit = ed?.let { u -> DeckEditCtx(u.edit.name.ifBlank { "this deck" },
                    qty = { n -> u.edit.cards.filter { it.name == n }.sumOf { it.qty } }, copies = if (u.edit.format == "Commander") 1 else 4,
                    step = { n, k -> u.edit = u.edit.copy(cards = dev.cardstashy.nativeplay.play.DeckEdit.step(u.edit.cards, n, k, u.edit.format), dirty = true) }) }),
                onClose = { card = null; cardTab = "overview" }, startTab = cardTab)
        }
    }
}

/**
 * A precon's page slides in over the tabs. Back (the arrow, the system back or an edge swipe) peeks the list under it as
 * you drag, then slides the page away; the list is still where you left it.
 */
@Composable
internal fun PreconLayer(pc: PreconUi, page: @Composable (OpenPrecon, () -> Unit) -> Unit) {
    val o = pc.open
    // The page last shown, so it can slide away after back (a plain holder: composition never writes state).
    val last = remember { arrayOfNulls<OpenPrecon>(1) }
    if (o != null) last[0] = o
    var peek by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    androidx.activity.compose.PredictiveBackHandler(enabled = o != null) { progress ->
        try { progress.collect { peek = it.progress }; pc.open = null } catch (_: kotlinx.coroutines.CancellationException) { } finally { peek = 0f }
    }
    androidx.compose.animation.AnimatedVisibility(o != null,
        enter = androidx.compose.animation.slideInHorizontally(Site.spring()) { it / 3 } + androidx.compose.animation.fadeIn(),
        exit = androidx.compose.animation.slideOutHorizontally { it / 2 } + androidx.compose.animation.fadeOut()) {
        val shown = o ?: last[0] ?: return@AnimatedVisibility
        Box(Modifier.fillMaxSize().graphicsLayer { val k = peek; translationX = k * size.width * .18f; scaleX = 1f - k * .08f; scaleY = 1f - k * .08f
            shape = RoundedCornerShape((28 * k).dp); clip = k > 0f }) { page(shown) { pc.open = null } }
    }
}
