package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.SetFacts
import dev.cardstashy.nativeplay.play.Trunk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/*
 * The Shop (Randall 3 Nov 20:00Z, approved preview 20:26Z): one hub for everything you spend coins and seals on.
 * Sets & packs = this week's Secret Lair (play-econ-ui secretLairShelf) + every set (the Trunk's old Sets tab,
 * playSetRows) with its pack and Buy; Your packs = packsMarkup; Forge = forgeMarkup + the Seal press. A set opens
 * the Play set lens (views.js setPage, lens = play). Same routes as the site: /buy, /open, /forge, /craft,
 * /secretlair. Trunk keeps only your cards. Every JSON read is null-safe.
 */

private fun JsonElement?.s(): String? = this?.takeIf { it.isJsonPrimitive }?.asString
private fun JsonElement?.i(): Int = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt ?: 0
private fun JsonElement?.b(): Boolean = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean == true
private fun JsonObject.objs(k: String) = (get(k) as? com.google.gson.JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()

private val Ink get() = Site.Text
private val small get() = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Site.Muted)
private val bold = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Ink)
// Light: headings on the page follow --text (native fix, Randall 4 Nov 10:26Z: light panels must be readable).
private val h2: TextStyle get() = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = if (AppSettings.theme == "light") Site.Text else Color(0xFFF3E3BD))
/** isCollectorPack (play-econ-rules.js): the source ends in "collector". */
private fun collector(p: JsonObject) = Regex("(?:^|:)collector$").containsMatchIn(p.get("source").s() ?: "")
private fun price(s: JsonObject) = s.getAsJsonObject("config")?.get("packPrice").i().takeIf { it > 0 } ?: 500
private fun coins(s: JsonObject) = s.getAsJsonObject("wallet")?.get("coins").i()
private fun scryfallImage(id: String, size: String = "normal") =
    if (Regex("^[0-9a-f-]{36}$").matches(id)) "https://cards.scryfall.io/$size/front/${id[0]}/${id[1]}/$id.jpg" else ""

@Composable
fun ShopRoute(onBack: () -> Unit, nav: @Composable () -> Unit, startTab: String = "sets", startSet: String? = null) {
    val state by Progress.state.collectAsState()
    val busy by Progress.busy.collectAsState()
    val context = LocalContext.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableStateOf(startTab) }
    var set by rememberSaveable { mutableStateOf(startSet) }
    var open by remember { mutableStateOf<CardPick?>(null) }
    var opener by remember { mutableStateOf<PackResult?>(null) }
    LaunchedEffect(Unit) { Progress.loadCached(); Progress.refresh() }
    val s = state ?: run { Box(Modifier.fillMaxSize().background(Site.Bg), contentAlignment = Alignment.Center) { Text("Opening the Shop…", style = Site.Body) }; return }
    LaunchedEffect(s) { SetFacts.ensure(Trunk.allSets(s).map { it.code }) }
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    fun setName(code: String) = Trunk.allSets(s).firstOrNull { it.code == code }?.name ?: SetFacts.set(code)?.name ?: code.uppercase()
    suspend fun openOne(id: String): PackResult? = runCatching { Progress.open(id) }.getOrNull()?.let { out ->
        packResult(out, setName(out.getAsJsonObject("pack")?.get("set").s() ?: "")) }
    fun act(label: String, done: String? = null, block: suspend () -> Unit) {
        if (busy.isNotEmpty()) return
        scope.launch { runCatching { block() }.onSuccess { done?.let(toast); Feel.perform(view, "success") }.onFailure { toast(it.message ?: "Try again in a moment.") }; Progress.refreshDeeds() }
    }
    val buy = { code: String -> act("buy", "Pack bought. It is waiting in Packs.") { Progress.buy(code) } }
    val openPack = { id: String -> if (busy.isEmpty()) scope.launch { opener = openOne(id) }; Unit }
    val actions = PlayHomeActions(forge = { to, times -> act("forge", "Forged $times ${mapOf("u" to "uncommon", "r" to "rare", "m" to "mythic")[to]} seal${if (times > 1) "s" else ""}.") { Progress.forge(to, times) } })

    BackHandler(enabled = set != null && open == null && opener == null) { set = null }
    BackHandler(enabled = set == null && open == null && opener == null, onBack = onBack)
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        val code = set
        // .pack-dialog::backdrop: #05060be6 over a 16 px blur of the page.
        Box(Modifier.fillMaxSize().then(if (opener != null) Modifier.blur(16.dp) else Modifier)) {
        if (code != null) SetLens(s, code, busy.isNotEmpty(), onBack = { set = null }, onBuy = { buy(code) }, onOpen = openPack, onCard = { open = it })
        else ShopHub(s, tab, busy.isNotEmpty(), onTab = { tab = it }, onBack = onBack, onSet = { set = it }, onBuy = buy, onOpen = openPack, actions = actions,
            onSecretLair = { week, title -> act("secretlair", "$title is yours. Every card is in your Trunk, in its Secret Lair art.") { Progress.secretLair(week) } },
            onStamp = { id, name -> act("craft", "$name added to your Play collection.") { Progress.craft(id) } }, onCard = { open = it })
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
        }
        open?.let { pick ->
            CardSheet(pick, s, act = CardSheetActions(merchant = { c, _ -> open = null; set = c }, set = { c -> open = null; set = c }, toast = toast), onClose = { open = null })
        }
        opener?.let { first ->
            val close = { opener = null; scope.launch { Progress.refresh(); Progress.refreshDeeds() }; Unit }
            BackHandler(onBack = close)
            PackOpening(first, onNext = {
                val left = Progress.state.value?.getAsJsonArray("packs")?.mapNotNull { it as? JsonObject }.orEmpty()
                val nx = left.firstOrNull { it["set"].s() == first.set } ?: left.firstOrNull()
                nx?.get("id").s()?.let { openOne(it) }
            }, onClose = close)
        }
    }
}

@Composable
private fun ShopHub(s: JsonObject, tab: String, busy: Boolean, onTab: (String) -> Unit, onBack: () -> Unit, onSet: (String) -> Unit, onBuy: (String) -> Unit,
                    onOpen: (String) -> Unit, actions: PlayHomeActions, onSecretLair: (String, String) -> Unit, onStamp: (String, String) -> Unit, onCard: (CardPick) -> Unit) {
    val packs = s.objs("packs")
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("") }
    LazyVerticalGrid(GridCells.Adaptive(150.dp), Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PlayHead("Shop", "Play", onBack) { dev.cardstashy.nativeplay.play.PlayMath.purse(s)?.let { PurseRow(it, { onTab("sets") }, { onTab("forge") }, { onTab("packs") }, level = dev.cardstashy.nativeplay.play.PlayMath.mastery(s, it.xp)) } }
                Segmented(listOf("sets" to "Sets & packs", "packs" to if (packs.isEmpty()) "Your packs" else "Your packs · ${packs.size}", "forge" to "Forge"), tab, pick = onTab)
            }
        }
        when (tab) {
            "packs" -> {
                // packsMarkup: one tile per set, Collector packs on their own tile in front of the set's ordinary packs.
                val groups = packs.sortedByDescending { collector(it) }
                    .groupBy { (if (collector(it)) "*" else "") + (it.get("set").s() ?: "") }.toList()
                if (groups.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 36.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Every pack is open", style = h2)
                        Text("Packs come from Story battles, Planeswalk bosses, weekly quests and the Shop.", style = small.copy(fontSize = 15.sp, lineHeight = 21.sp))
                        GoldCta("Browse sets") { onTab("sets") }
                    }
                }
                items(groups, key = { it.first }) { (key, list) ->
                    val code = list.first().get("set").s() ?: ""
                    Box(Modifier.clickable(enabled = !busy) { onOpen(list.first().get("id").s() ?: "") }) {
                        // Collector packs (every card holo): the band says Collector booster and a rainbow sheen runs across (boosterMarkup collector).
                        Booster(code, null, collector = key.startsWith("*"))
                        Box(Modifier.align(Alignment.TopEnd).offset(6.dp, (-6).dp).size(30.dp).clip(CircleShape).background(Site.Gold), contentAlignment = Alignment.Center) {
                            Text("${list.size}", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Color(0xFF2A1C06))) }
                    }
                }
            }
            "forge" -> {
                item(span = { GridItemSpan(maxLineSpan) }) { Forge(s, actions) }
                item(span = { GridItemSpan(maxLineSpan) }) { SealPress(s, busy, onStamp, onCard) }
            }
            else -> {
                (s.get("secretLair") as? JsonObject)?.takeIf { it.objs("cards").isNotEmpty() }?.let { sl ->
                    item(span = { GridItemSpan(maxLineSpan) }) { SecretLairShelf(s, sl, busy, onSecretLair, onCard) }
                }
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Sets", style = h2, modifier = Modifier.padding(top = 6.dp))
                        SearchField(query, "Search any set, any year") { query = it }
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("" to "All", "started" to "Collecting", "waiting" to "Packs waiting", "standard" to "Standard", "modern" to "Modern", "eternal" to "Vintage & Legacy")
                                .forEach { (k, l) -> Chip(l, filter == k) { filter = k } }
                        }
                    }
                }
                val waiting = packs.groupingBy { it.get("set").s() ?: "" }.eachCount()
                val q = query.trim().lowercase()
                val rows = Trunk.allSets(s).filter { r ->
                    (q.isEmpty() || r.name.lowercase().contains(q) || r.code == q) && when (filter) {
                        "" -> true; "started" -> r.owned > 0; "waiting" -> (waiting[r.code] ?: 0) > 0; else -> r.format == filter } }
                if (rows.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) { Text("No set by that name.", style = small.copy(fontSize = 15.sp), modifier = Modifier.padding(vertical = 24.dp)) }
                rows.groupBy { it.released.take(4).ifBlank { "Other" } }.forEach { (year, list) ->
                    item(span = { GridItemSpan(maxLineSpan) }, key = "y$year") { Text(year, style = Site.Eyebrow, modifier = Modifier.padding(top = 8.dp)) }
                    items(list, key = { it.code }, span = { GridItemSpan(maxLineSpan) }) { r ->
                        ShopSetRow(r, waiting[r.code] ?: 0, price(s), coins(s) >= price(s) && !busy, sold = s.objs("shop").any { it.get("code").s() == r.code } || (s.get("rewardSet") as? JsonObject)?.get("code").s() == r.code,
                            onClick = { onSet(r.code) }, onBuy = { onBuy(r.code) })
                    }
                }
            }
        }
    }
}

/** One set: its pack, name, progress (distinct cards owned of the set's total) and the 500-coin Buy. */
@Composable
private fun ShopSetRow(r: Trunk.SetRow, waiting: Int, price: Int, canBuy: Boolean, sold: Boolean, onClick: () -> Unit, onBuy: () -> Unit) {
    val pct = r.total?.takeIf { it > 0 }?.let { r.owned.toFloat() / it } ?: 0f
    val shape = RoundedCornerShape(18.dp)
    Row(Modifier.fillMaxWidth().clip(shape).background(if (AppSettings.theme == "light") Color(0x94FFFFFF) else Color(0x0DFFFFFF)).border(1.dp, if (r.owned > 0 || waiting > 0) Color(0x40D6AD64) else if (AppSettings.theme == "light") Site.GlassLine else Color(0x14FFFFFF), shape)
        .clickable(onClick = onClick).padding(start = 10.dp, end = 12.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Booster(r.code, r.name, Modifier.width(62.dp), mini = true)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(r.name, style = bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(listOfNotNull(r.code.uppercase(), r.released.take(4).ifBlank { null }, waiting.takeIf { it > 0 }?.let { "$it pack${if (it == 1) "" else "s"} waiting" }).joinToString(" · "),
                style = small.copy(fontSize = 12.sp, color = if (waiting > 0) Site.Gold else Site.Muted))
            ProgressBar(pct)
            Text(if (r.total == null) (if (r.owned > 0) "${"%,d".format(r.owned)} cards owned" else "Not started") else "${"%,d".format(r.owned)} of ${"%,d".format(r.total)} cards · ${(pct * 100).toInt()}%", style = small.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (AppSettings.theme == "light") Site.Muted else Color(0xFFC9CED6)))
        }
        if (sold) GoldCta("%,d".format(price), enabled = canBuy, muted = true, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 16.dp) }, onClick = onBuy)
    }
}

/** secretLairShelf: the week's drop, its five cards, Leaves in N days, and Buy (or In your Trunk). */
@Composable
private fun SecretLairShelf(s: JsonObject, sl: JsonObject, busy: Boolean, onBuy: (String, String) -> Unit, onCard: (CardPick) -> Unit) {
    val owned = remember(s) { s.objs("cards").mapNotNull { it.get("o").s() }.toSet() }
    val days = runCatching { maxOf(1L, kotlin.math.ceil((java.time.Instant.parse(sl.get("ends").s()).toEpochMilli() - System.currentTimeMillis()) / 864e5).toLong()) }.getOrDefault(7L)
    val price = sl.get("price").i(); val title = sl.get("title").s() ?: "Secret Lair"
    val shape = RoundedCornerShape(22.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Brush.linearGradient(listOf(Color(0xFF2A1B3A), Color(0xFF14161D)))).border(1.dp, Color(0x55B79CFF), shape).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("This week's Secret Lair", style = h2.copy(fontSize = 18.sp, color = Color(0xFFF3E3BD)), modifier = Modifier.weight(1f).padding(end = 8.dp))
            Text(if (days == 1L) "Leaves tomorrow" else "Leaves in $days days", style = small.copy(fontSize = 12.sp, color = Color(0xFFC9C2E6)))
        }
        Text(buildString { append(title); sl.get("by").s()?.let { append(" · $it") }; append(". Each card comes into your Trunk and unlocks its Secret Lair art for your copies.") },
            style = small.copy(fontSize = 13.sp, lineHeight = 19.sp, color = Color(0xFFC9CED6)))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            sl.objs("cards").forEach { c ->
                Box(Modifier.width(96.dp).clickable { onCard(CardPick(c.get("n").s() ?: "", c.get("o").s() ?: "", c.get("id").s(), "nonfoil")) }) {
                    CardPicture(scryfallImage(c.get("id").s() ?: ""), null, null, Modifier.fillMaxWidth().aspectRatio(.716f), RoundedCornerShape(6.dp), ContentScale.Crop)
                    if (c.get("o").s() in owned) Text("Owned", style = small.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF2A1C06)),
                        modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).clip(RoundedCornerShape(8.dp)).background(Site.Gold).padding(horizontal = 6.dp, vertical = 2.dp))
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            if (sl.get("bought").b()) Text("In your Trunk", style = small.copy(fontWeight = FontWeight.Bold, color = Site.Gold))
            else GoldCta("%,d".format(price), enabled = !busy && coins(s) >= price, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 16.dp) }) { onBuy(sl.get("week").s() ?: "", title) }
        }
    }
}

/** The Seal press: find any card by name (Scryfall fuzzy), then stamp it with a seal of its rarity. */
@Composable
private fun SealPress(s: JsonObject, busy: Boolean, onStamp: (String, String) -> Unit, onCard: (CardPick) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var finding by remember { mutableStateOf(false) }
    var card by remember { mutableStateOf<JsonObject?>(null) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val shape = RoundedCornerShape(22.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(if (AppSettings.theme == "light") Color(0x94FFFFFF) else Color(0xCC0D0F14)).border(1.dp, if (AppSettings.theme == "light") Site.GlassLine else Color(0x33D6AD64), shape).padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Seal press", style = h2)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f)) { SearchField(query, "Card name") { query = it.take(160) } }
            GoldCta(if (finding) "Finding…" else "Find", enabled = !finding && query.isNotBlank(), radius = 12.dp) {
                finding = true; error = ""
                scope.launch {
                    val got = withContext(Dispatchers.IO) { runCatching { Http.call("GET", "https://api.scryfall.com/cards/named?fuzzy=" + java.net.URLEncoder.encode(query.trim(), "UTF-8")) as? JsonObject } }
                    card = got.getOrNull()?.takeIf { it.get("object").s() == "card" }
                    error = when { card != null -> ""; got.isFailure -> "Could not search right now."; else -> "No card by that name." }
                    finding = false
                }
            }
        }
        card?.let { c ->
            val key = mapOf("common" to "c", "uncommon" to "u", "rare" to "r", "mythic" to "m")[c.get("rarity").s()] ?: "r"
            val have = s.objs("cards").firstOrNull { it.get("o").s() == c.get("oracle_id").s() }?.get("c").i()
            val seals = s.getAsJsonObject("wallet")?.get("seal_$key").i()
            val img = (c.get("image_uris") as? JsonObject)?.get("normal").s() ?: (c.objs("card_faces").firstOrNull()?.get("image_uris") as? JsonObject)?.get("normal").s()
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                CardPicture(img, null, null, Modifier.width(110.dp).aspectRatio(.716f).clickable { onCard(CardPick(c.get("name").s() ?: "", c.get("oracle_id").s() ?: "", c.get("id").s(), "nonfoil")) })
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(c.get("name").s() ?: "", style = bold)
                    Text("$have of 4 owned", style = small)
                    GoldCta(if (have >= 4) "All 4 owned" else "Stamp it", enabled = have < 4 && seals > 0 && !busy, radius = 12.dp, leading = { Icon(SiteIcons.Seals.getValue(key), 18.dp) }) {
                        onStamp(c.get("id").s() ?: "", c.get("name").s() ?: "") }
                }
            }
        }
        if (error.isNotEmpty()) Text(error, style = small.copy(fontSize = 14.sp))
    }
}

// ---------------------------------------------------------------- the Play set lens (views.js setPage, lens = play)

private data class LensCard(val id: String, val oracle: String, val name: String, val number: String, val rarity: String, val image: String)

private val gray = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })
private val setCache = HashMap<String, List<LensCard>>()

/** One search page; Scryfall's 429 (too many requests), a 5xx or a dropped connection is tried again with a growing wait. */
private suspend fun page(url: String): JsonObject? {
    var wait = 400L
    repeat(4) { n ->
        try { return Http.call("GET", url, timeoutMs = 20_000) as? JsonObject }
        catch (e: Http.Failure) { if (e.status == 404) return null; if (e.status != 429 && e.status < 500) throw e; if (n == 3) throw e }
        catch (e: java.io.IOException) { if (n == 3) throw e }
        kotlinx.coroutines.delay(wait); wait *= 2
    }
    return null
}

/** Every printing of the set in set order, from Scryfall (the site's set page reads the same search). */
private suspend fun setCards(code: String): List<LensCard> = setCache[code] ?: withContext(Dispatchers.IO) {
    val out = ArrayList<LensCard>()
    val start = "https://api.scryfall.com/cards/search?order=set&unique=prints&q=" + java.net.URLEncoder.encode("e:$code game:paper", "UTF-8")
    // Offline, a set this phone already saved (art/ThumbStore) still opens, from its saved printings.
    val first = page(start) ?: return@withContext dev.cardstashy.nativeplay.art.ThumbStore.savedSet(code).map { lens(it) }.also { if (it.isNotEmpty()) setCache[code] = it }
    var next: JsonObject? = first
    var url: String? = start
    while (url != null) {
        val page = next ?: page(url) ?: break
        next = null
        page.objs("data").forEach { c -> out += lens(c) }
        url = if (page.get("has_more").b()) page.get("next_page").s() else null
        if (url != null) kotlinx.coroutines.delay(100) // Scryfall asks for 50-100 ms between requests
    }
    out.also { if (it.isNotEmpty()) setCache[code] = it }
}

private fun lens(c: JsonObject): LensCard {
    val img = (c.get("image_uris") as? JsonObject)?.get("normal").s() ?: (c.objs("card_faces").firstOrNull()?.get("image_uris") as? JsonObject)?.get("normal").s() ?: ""
    return LensCard(c.get("id").s() ?: "", c.get("oracle_id").s() ?: c.objs("card_faces").firstOrNull()?.get("oracle_id").s() ?: "", c.get("name").s() ?: "",
        c.get("collector_number").s() ?: "", c.get("rarity").s() ?: "", img)
}

@Composable
private fun SetLens(s: JsonObject, code: String, busy: Boolean, onBack: () -> Unit, onBuy: () -> Unit, onOpen: (String) -> Unit, onCard: (CardPick) -> Unit) {
    val row = remember(s, code) { Trunk.allSets(s).firstOrNull { it.code == code } }
    val name = row?.name ?: SetFacts.set(code)?.name ?: code.uppercase()
    val owned = remember(s) { s.objs("cards").associate { (it.get("o").s() ?: "") to it.get("c").i() } }
    var attempt by remember(code) { mutableStateOf(0) }
    val cards = produceState<List<LensCard>?>(null, code, attempt) { value = null; value = runCatching { setCards(code) }.getOrDefault(emptyList()) }.value
    // Offline art plan: the first visit saves the whole set's thumbnails quietly, so the grid is instant from then on.
    LaunchedEffect(code) { dev.cardstashy.nativeplay.art.ThumbStore.ensureSet(code) }
    val waiting = s.objs("packs").filter { it.get("set").s() == code }
    val sold = s.objs("shop").any { it.get("code").s() == code } || (s.get("rewardSet") as? JsonObject)?.get("code").s() == code
    var query by rememberSaveable(code) { mutableStateOf("") }
    var filter by rememberSaveable(code) { mutableStateOf("all") }
    var rarity by rememberSaveable(code) { mutableStateOf("") }
    // Until the list arrives (or if it can't), the numbers come from the set row, never "0 of 0".
    val distinct = cards?.takeIf { it.isNotEmpty() }?.map { it.oracle }?.toSet()
    val have = distinct?.count { (owned[it] ?: 0) > 0 } ?: (row?.owned ?: 0)
    val total = distinct?.size ?: row?.total ?: 0
    val pct = if (total > 0) have.toFloat() / total else 0f
    val q = query.trim().lowercase()
    val shown = cards.orEmpty().filter { c -> val n = owned[c.oracle] ?: 0
        (q.isEmpty() || c.name.lowercase().contains(q)) && (rarity.isEmpty() || c.rarity == rarity) && when (filter) { "owned" -> n > 0; "missing" -> n == 0; else -> true } }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val cols = if (maxWidth < 600.dp) 3 else maxOf(4, (maxWidth / 150.dp).toInt())
        LazyVerticalGrid(GridCells.Fixed(cols), Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    PageHeader(name, "Shop · ${code.uppercase()}${row?.released?.take(4)?.let { " · $it" } ?: ""}", onBack = onBack)
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Booster(code, name, Modifier.width(120.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("YOUR COLLECTION", style = Site.Eyebrow)
                            Text("${"%,d".format(have)} of ${"%,d".format(total)} unique cards", style = bold)
                            ProgressBar(pct)
                            Text("${(pct * 100).toInt()}%", style = h2.copy(fontSize = 22.sp, color = Site.Gold))
                        }
                    }
                    // Stacked full width so neither label is ever cut on a narrow phone.
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (waiting.isNotEmpty()) GoldCta(if (waiting.size == 1) "Open your pack" else "Open a pack · ${waiting.size} waiting", Modifier.fillMaxWidth(), enabled = !busy) { onOpen(waiting.first().get("id").s() ?: "") }
                        if (sold) GoldCta("Buy a pack · %,d".format(price(s)), Modifier.fillMaxWidth(), enabled = !busy && coins(s) >= price(s), muted = waiting.isNotEmpty(),
                            leading = { Icon(SiteIcons.Coin, 16.dp) }, onClick = onBuy)
                    }
                    SearchField(query, "Search this set") { query = it }
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("all" to "All", "owned" to "Owned", "missing" to "Missing").forEach { (k, l) -> Chip(l, filter == k) { filter = k } }
                        Spacer(Modifier.width(6.dp))
                        listOf("" to "All rarities", "common" to "Common", "uncommon" to "Uncommon", "rare" to "Rare", "mythic" to "Mythic").forEach { (k, l) -> Chip(l, rarity == k) { rarity = k } }
                    }
                    Text(if (cards == null) "Loading the set…" else "${"%,d".format(shown.size)} cards", style = small)
                }
            }
            if (cards != null && shown.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                if (cards.isEmpty()) Column(Modifier.padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("The set's cards didn't come through. Check your connection and try again.", style = small.copy(fontSize = 15.sp))
                    GoldCta("Try again", Modifier.fillMaxWidth(), muted = true) { attempt++ }
                } else Text("No cards match. Change the filters above.", style = small.copy(fontSize = 15.sp), modifier = Modifier.padding(vertical = 24.dp))
            }
            items(shown, key = { it.id }) { c ->
                val n = owned[c.oracle] ?: 0
                Column(Modifier.clickable { onCard(CardPick(c.name, c.oracle, c.id, "nonfoil")) }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box {
                        coil3.compose.AsyncImage(c.image, c.name, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader, contentScale = ContentScale.Crop,
                            colorFilter = if (n == 0) gray else null, alpha = if (n == 0) .72f else 1f,
                            modifier = Modifier.fillMaxWidth().aspectRatio(.716f).clip(RoundedCornerShape(7.dp)).background(Color(0xFF1F232B)))
                        if (n > 0) Text("×$n", style = small.copy(fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF2A1C06)),
                            modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).clip(RoundedCornerShape(8.dp)).background(Site.Gold).padding(horizontal = 6.dp, vertical = 1.dp))
                    }
                    Text("#${c.number} ${c.name}", style = small.copy(fontSize = 11.sp, color = if (n > 0) Ink else Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(if (n > 0) "$n of 4" else "Not owned", style = small.copy(fontSize = 11.sp, color = if (n > 0) Site.Gold else Site.Muted))
                }
            }
        }
    }
}
