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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import dev.cardstashy.nativeplay.play.Decks
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
fun ShopRoute(onBack: () -> Unit, nav: @Composable () -> Unit, startTab: String = "sets", startSet: String? = null, precon: PreconUi = remember { PreconUi() }) {
    val state by Progress.state.collectAsState()
    val busy by Progress.busy.collectAsState()
    val context = LocalContext.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    // The storefront ("shop"), Your packs ("packs") or Every set ("sets"); the purse's seals land on the Forge aisle.
    var page by rememberSaveable { mutableStateOf(if (startTab == "packs") "packs" else "shop") }
    var set by rememberSaveable { mutableStateOf(startSet) }
    var open by remember { mutableStateOf<CardPick?>(null) }
    var opener by remember { mutableStateOf<PackResult?>(null) }
    preconCacheDir = context.cacheDir; PreconStore.dir = context.cacheDir
    LaunchedEffect(Unit) { Progress.loadCached(); Progress.refresh() }
    LaunchedEffect(Unit) { loadPreconIndex(precon) }
    val s = state ?: run { Box(Modifier.fillMaxSize().background(Site.Bg), contentAlignment = Alignment.Center) { Text("Opening the Shop…", style = Site.Body) }; return }
    LaunchedEffect(s) { SetFacts.ensure(Trunk.allSets(s).map { it.code }) }
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    fun setName(code: String) = Trunk.allSets(s).firstOrNull { it.code == code }?.name ?: SetFacts.set(code)?.name ?: code.uppercase()
    var why: String? = null
    suspend fun openOne(id: String): PackResult? = runCatching { Progress.open(id) }.onFailure { why = it.message }.getOrNull()?.let { out ->
        runCatching { packResult(out, setName(out.getAsJsonObject("pack")?.get("set").s() ?: "")) }.onFailure { why = "Your pack opened. Find the cards in Trunk." }.getOrNull() }
    fun act(label: String, done: String? = null, block: suspend () -> Unit) {
        if (busy.isNotEmpty()) return
        scope.launch { runCatching { block() }.onSuccess { done?.let(toast); Feel.perform(view, "success") }.onFailure { toast(it.message ?: "Try again in a moment.") }; Progress.refreshDeeds() }
    }
    val buy = { code: String -> act("buy", "Pack bought. It is waiting in Your packs.") { Progress.buy(code) } }
    // The pack is on screen the instant it is tapped and gathers power while the server rolls it.
    val openPack = { id: String ->
        if (busy.isEmpty() && opener == null) {
            val code = s.getAsJsonArray("packs")?.firstNotNullOfOrNull { (it as? JsonObject)?.takeIf { o -> o["id"].s() == id }?.get("set").s() } ?: ""
            opener = loadingPack(code, setName(code))
            scope.launch { val r = openOne(id); if (opener?.note == LOADING) { opener = r; if (r == null) toast(why ?: "That pack didn't open. Try again in a moment.") } }
        }; Unit }
    val actions = PlayHomeActions(forge = { to, times -> act("forge", "Forged $times ${mapOf("u" to "uncommon", "r" to "rare", "m" to "mythic")[to]} seal${if (times > 1) "s" else ""}.") { Progress.forge(to, times) } })
    // This week's store precons (state.preconStore.files) as the precon list knows them, and what each still needs.
    val owned = remember(s) { Decks.ownedByName(s) }
    val weekly = remember(s) { weeklyPrecons(s) }
    val storePrecons = remember(precon.index, weekly) { precon.index?.filter { it.fileName.removeSuffix(".json") in weekly } }
    val needs = remember(s, owned) { HashMap<String, PreconNeed>() }
    fun needOf(file: String): PreconNeed? = PreconStore.summaries[file]?.let { x -> needs.getOrPut(file) { preconNeed(x.rows, owned, s, file) } }
    val calm = open == null && opener == null && precon.open == null

    BackHandler(enabled = set != null && calm) { set = null }
    BackHandler(enabled = set == null && page != "shop" && calm) { page = "shop" }
    BackHandler(enabled = set == null && page == "shop" && calm, onBack = onBack)
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        val code = set
        // .pack-dialog::backdrop: #05060be6 over a 16 px blur of the page.
        Box(Modifier.fillMaxSize().then(if (opener != null) Modifier.blur(16.dp) else Modifier)) {
        when {
            code != null -> SetLens(s, code, busy.isNotEmpty(), onBack = { set = null }, onBuy = { buy(code) }, onOpen = openPack, onCard = { open = it })
            page == "packs" -> PacksPage(s, busy.isNotEmpty(), onBack = { page = "shop" }, onOpen = openPack)
            page == "sets" -> EverySet(s, busy.isNotEmpty(), onBack = { page = "shop" }, onSet = { set = it }, onBuy = buy)
            else -> Storefront(s, busy.isNotEmpty(), startTab, weekly, storePrecons, ::needOf, onBack = onBack, onPage = { page = it }, onSet = { set = it }, onBuy = buy, actions = actions,
                onSecretLair = { c -> act("sloffer", "${c.get("n").s() ?: "The card"} is yours, in its Secret Lair art.") {
                    Progress.secretLairCard(c.get("id").s() ?: "", (s.get("secretLairStore") as? JsonObject)?.get("week").s()) } },
                onStamp = { id, name -> act("craft", "$name added to your Play collection.") { Progress.craft(id) } }, onCard = { open = it },
                onPrecon = { e -> openPrecon(scope, precon, e, toast) })
        }
        Box(Modifier.align(Alignment.BottomCenter)) { nav() }
        }
        // A store precon opens as the Decks tab's precon page, over the Shop.
        PreconLayer(precon) { o, back -> PreconPage(s, o, owned, precon, onBack = back, onCard = { n -> open = CardPick(n, "", null, "nonfoil") }, toast = toast, nav = nav) }
        if (precon.opening) Box(Modifier.fillMaxSize().background(Color(0x66000000)), contentAlignment = Alignment.Center) { BrandMark(52.dp) }
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

// ---------------------------------------------------------------- the storefront

/*
 * The Shop as one storefront (Randall 5 Nov 18:54Z: "make it look like a real video game shop"; everything in it is
 * coins only). An aisle bar stays at the top: Secret Lair (the week's 20 cards, the showcase), Packs (the featured
 * set, the shelf of this week's sets, then every set), Precons (this week's store precons by format) and the Forge
 * (seals and the Seal press); Your packs opens from the bar. Same routes as the site: /sloffer, /buy, /precon, /forge, /craft.
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun Storefront(s: JsonObject, busy: Boolean, start: String, weekly: Set<String>, precons: List<Decks.PreconEntry>?, needOf: (String) -> PreconNeed?,
                       onBack: () -> Unit, onPage: (String) -> Unit, onSet: (String) -> Unit, onBuy: (String) -> Unit, actions: PlayHomeActions,
                       onSecretLair: (JsonObject) -> Unit, onStamp: (String, String) -> Unit, onCard: (CardPick) -> Unit, onPrecon: (Decks.PreconEntry) -> Unit) {
    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val store = s.get("secretLairStore") as? JsonObject
    val offers = store?.objs("offers").orEmpty()
    val aisles = buildList { if (offers.isNotEmpty()) add("sl" to "Secret Lair"); add("packs" to "Packs"); if (weekly.isNotEmpty()) add("precons" to "Precons"); add("forge" to "Forge") }
    // The head is row 0 and the aisle bar row 1; each aisle follows in order.
    fun rowOf(k: String) = 2 + aisles.indexOfFirst { it.first == k }.coerceAtLeast(0)
    LaunchedEffect(start) { if (start == "forge") list.scrollToItem(rowOf("forge")) }
    val at by remember(aisles) { androidx.compose.runtime.derivedStateOf { aisles.getOrNull(list.firstVisibleItemIndex - 2)?.first ?: aisles.first().first } }
    LazyColumn(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars), state = list,
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item(key = "head") {
            Box(Modifier.padding(top = 12.dp)) {
                PlayHead("Shop", "Play", onBack) { dev.cardstashy.nativeplay.play.PlayMath.purse(s)?.let { p ->
                    PurseRow(p, { scope.launch { list.animateScrollToItem(rowOf("packs")) } }, { scope.launch { list.animateScrollToItem(rowOf("forge")) } }, { onPage("packs") },
                        level = dev.cardstashy.nativeplay.play.PlayMath.mastery(s, p.xp)) } }
            }
        }
        stickyHeader(key = "aisles") { AisleBar(aisles, at, onAisle = { k -> scope.launch { list.animateScrollToItem(rowOf(k)) } }) }
        if (store != null && offers.isNotEmpty()) item(key = "sl") { SecretLairShowcase(s, store, busy, onSecretLair, onCard, onBrowse = { onSet("sld") }) }
        item(key = "packs") { PacksAisle(s, busy, onBuy, onSet, onAll = { onPage("sets") }) }
        if (weekly.isNotEmpty()) item(key = "precons") { PreconAisle(precons, remember(s) { weeklyPreconFormats(s) }, needOf, onPrecon) }
        item(key = "forge") { Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { Forge(s, actions); SealPress(s, busy, onStamp, onCard) } }
    }
}

/**
 * The aisle bar: one glass rail split evenly into Secret Lair · Packs · Precons · Forge, the aisle in view lit gold. Your
 * packs stay on the purse above (its pack count opens them), so the rail never repeats it.
 */
@Composable
private fun AisleBar(aisles: List<Pair<String, String>>, at: String, onAisle: (String) -> Unit) {
    val light = AppSettings.theme == "light"
    Box(Modifier.bleed(16.dp).fillMaxWidth().background(Brush.verticalGradient(0f to Site.Bg, .78f to Site.Bg.copy(alpha = .94f), 1f to Site.Bg.copy(alpha = 0f)))
        .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp)) {
        val rail = RoundedCornerShape(22.dp)
        Row(Modifier.fillMaxWidth().height(44.dp).clip(rail).background(if (light) Color(0xB3FFFFFF) else Color(0x14FFFFFF))
            .border(1.dp, if (light) Brush.verticalGradient(listOf(Site.GlassLine, Site.GlassLine)) else SoftRim, rail).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            for ((k, l) in aisles) {
                val on = k == at; val seg = RoundedCornerShape(18.dp)
                // A long name ("✦ Secret Lair") gets a wider segment so no label is ever cut.
                Box(Modifier.weight(maxOf(1f, (l.length + if (k == "sl") 2 else 0) / 9f)).fillMaxHeight().clip(seg)
                    .then(if (on) Modifier.background(Brush.verticalGradient(listOf(Color(0x47E8B95B), Color(0x1FE8B95B))))
                        .border(1.dp, Brush.verticalGradient(listOf(Color(0xD9E8B95B), Color(0x59E8B95B))), seg) else Modifier)
                    .semantics { selected = on; role = Role.Tab }.clickable { onAisle(k) }, contentAlignment = Alignment.Center) {
                    Text(if (k == "sl") "✦ $l" else l, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp,
                        color = if (on) (if (light) Site.Text else Color(0xFFF3E3BD)) else Site.Muted), maxLines = 1, softWrap = false)
                }
            }
        }
    }
}

/** An aisle's sign: its name in Cinzel and one line under it. */
@Composable
private fun AisleHead(title: String, sub: String?, trailing: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = h2.copy(fontSize = 24.sp))
            if (sub != null) Text(sub, style = small.copy(fontSize = 13.5.sp, lineHeight = 19.sp))
        }
        trailing()
    }
}

/** When the week's stock turns over: the store's own end, else next Monday 00:00 UTC (Play weeks). "2 days 5 h", or "5 hours" on the last day. */
private fun leftOf(ends: String?): String {
    val now = System.currentTimeMillis()
    val end = runCatching { java.time.Instant.parse(ends).toEpochMilli() }.getOrNull() ?: java.time.LocalDate.now(java.time.ZoneOffset.UTC)
        .with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.MONDAY)).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
    val ms = maxOf(0L, end - now); val d = ms / 86_400_000L; val h = ms % 86_400_000L / 3_600_000L
    return if (d > 0) "$d day${if (d == 1L) "" else "s"} $h h" else "$h hour${if (h == 1L) "" else "s"}"
}

/** secretLairOfferPrice: coins by rarity (config.secretLair.offerCoins can retune them), the sale taken off in tens. First is the price before the sale. */
private fun slPrice(c: JsonObject, config: JsonObject?): Pair<Int, Int> {
    val r = c.get("r").s() ?: ""
    val custom = config?.getAsJsonObject("secretLair")?.getAsJsonObject("offerCoins")?.get(r)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asInt
    val base = custom ?: mapOf("common" to 200, "uncommon" to 200, "rare" to 300, "mythic" to 500)[r] ?: 300
    val off = c.get("off").i()
    return base to if (off > 0) maxOf(10, Math.round(base * (100 - off) / 1000.0).toInt() * 10) else base
}

private val Velvet = Color(0xFF140C22)
private val Lilac = Color(0xFFC9B2FF)
private val Cream = Color(0xFFF3E3BD)

/**
 * The showcase (Randall: "near the top, a showstopper"): the week's Secret Lair cards (play-econ-ui secretLairStore) on
 * velvet, each the real printing in its Secret Lair art, four on sale, bought one at a time for coins; a card you have
 * says Yours. Every Secret Lair card opens the set's page with your progress.
 */
@Composable
private fun SecretLairShowcase(s: JsonObject, store: JsonObject, busy: Boolean, onBuy: (JsonObject) -> Unit, onCard: (CardPick) -> Unit, onBrowse: () -> Unit) {
    val offers = store.objs("offers")
    val coins = coins(s)
    val have = remember(s) { s.objs("styles").mapNotNull { it.get("id").s() }.toSet() }
    val onSale = offers.count { it.get("off").i() > 0 }
    val sld = remember(s) { Trunk.allSets(s).firstOrNull { it.code == "sld" } }
    val shape = RoundedCornerShape(28.dp)
    Column(Modifier.fillMaxWidth().clip(shape)
        .background(Brush.linearGradient(listOf(Color(0xFF2C1747), Velvet, Color(0xFF0B0911)), start = androidx.compose.ui.geometry.Offset.Zero, end = androidx.compose.ui.geometry.Offset(900f, 1400f)))
        .drawBehind {
            // Two soft lights on the velvet: violet from the top left, warm gold low on the right.
            drawCircle(Brush.radialGradient(listOf(Color(0x557A4DD8), Color.Transparent), center = androidx.compose.ui.geometry.Offset(size.width * .15f, 0f), radius = size.width * .9f), radius = size.width * .9f, center = androidx.compose.ui.geometry.Offset(size.width * .15f, 0f))
            drawCircle(Brush.radialGradient(listOf(Color(0x33E8B95B), Color.Transparent), center = androidx.compose.ui.geometry.Offset(size.width * .9f, size.height * .8f), radius = size.width * .7f), radius = size.width * .7f, center = androidx.compose.ui.geometry.Offset(size.width * .9f, size.height * .8f))
        }
        .border(1.dp, Brush.linearGradient(listOf(Color(0xB3E8B95B), Color(0x66B79CFF), Color(0x26B79CFF))), shape)
        .padding(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("✦  SECRET LAIR", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 2.4.sp, color = Lilac), modifier = Modifier.weight(1f))
                Text("New cards in ${leftOf(store.get("ends").s())}", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFFE6DDF7)),
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0x33000000)).border(1.dp, Color(0x40C9B2FF), RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 5.dp))
            }
            Text("This week's cards", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 27.sp, lineHeight = 31.sp, color = Cream))
            Text("${offers.size} Secret Lair cards, each in its own art. ${if (onSale > 0) "$onSale on sale. " else ""}Coins only.",
                style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.5.sp, lineHeight = 19.sp, color = Color(0xFFCFC6E2)))
        }
        val row = androidx.compose.foundation.lazy.rememberLazyListState()
        LazyRow(state = row, flingBehavior = androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior(row), contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            items(offers, key = { it.get("id").s() ?: it.toString() }) { c ->
                val (was, price) = slPrice(c, s.getAsJsonObject("config"))
                SlCard(c, was, price, owned = c.get("id").s() in have, canPay = !busy && coins >= price, onBuy = { onBuy(c) },
                    onOpen = { onCard(CardPick(c.get("n").s() ?: "", c.get("o").s() ?: "", c.get("id").s(), "nonfoil")) })
            }
        }
        Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x26000000)).border(1.dp, Color(0x26C9B2FF), RoundedCornerShape(14.dp))
            .clickable(onClick = onBrowse).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Text("Every Secret Lair card", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 14.5.sp, color = Color.White))
                Text(sld?.let { r -> r.total?.let { "${"%,d".format(r.owned)} of ${"%,d".format(it)} collected" } ?: "${"%,d".format(r.owned)} collected" } ?: "Browse the whole set",
                    style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 12.5.sp, color = Color(0xFFBFB4D6)))
            }
            Text("›", style = TextStyle(fontSize = 22.sp, color = Lilac))
        }
    }
}

/** One store card: the printing (tap for its page), its sale ribbon, its name, and the price struck through and bought, or Yours. */
@Composable
private fun SlCard(c: JsonObject, was: Int, price: Int, owned: Boolean, canPay: Boolean, onBuy: () -> Unit, onOpen: () -> Unit) {
    val off = c.get("off").i()
    Column(Modifier.width(158.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(.716f)
            .drawBehind { drawOval(Brush.radialGradient(listOf(Color(0x667A4DD8), Color.Transparent)), topLeft = androidx.compose.ui.geometry.Offset(-size.width * .1f, size.height * .82f),
                size = androidx.compose.ui.geometry.Size(size.width * 1.2f, size.height * .3f)) }
            .clickable(onClick = onOpen).semantics { contentDescription = "Open ${c.get("n").s() ?: "card"}" }) {
            CardPicture(scryfallImage(c.get("id").s() ?: ""), null, null, Modifier.fillMaxSize(), RoundedCornerShape(9.dp), ContentScale.Crop)
            if (off > 0 && !owned) Text("$off% off", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 11.5.sp, color = Color.White),
                modifier = Modifier.padding(6.dp).clip(RoundedCornerShape(8.dp)).background(Brush.horizontalGradient(listOf(Color(0xFFE5484D), Color(0xFFFF7A59)))).padding(horizontal = 7.dp, vertical = 3.dp))
            if (owned) Box(Modifier.matchParentSize().clip(RoundedCornerShape(9.dp)).background(Color(0x59000000)), contentAlignment = Alignment.Center) {
                Text("✓ Yours", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Color(0xFF2A1C06)),
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Gold).padding(horizontal = 10.dp, vertical = 4.dp)) }
        }
        Text(c.get("n").s() ?: "", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, color = Color.White), maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (owned) Text("In your Trunk", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Site.Gold))
        else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GoldCta("%,d".format(price), enabled = canPay, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 15.dp) }, onClick = onBuy)
            if (off > 0) Text("%,d".format(was), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Color(0xFF9D93B5),
                textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough))
        }
    }
}

/**
 * Packs (shopMarkup): this week's featured set big, then the shelf of the sets on sale this week, each standing on a lit
 * shelf with its price, then the way into every set, every year.
 */
@Composable
private fun PacksAisle(s: JsonObject, busy: Boolean, onBuy: (String) -> Unit, onSet: (String) -> Unit, onAll: () -> Unit) {
    val price = price(s); val canBuy = coins(s) >= price && !busy
    val reward = s.get("rewardSet") as? JsonObject
    val rows = remember(s) { Trunk.allSets(s).associateBy { it.code } }
    val shelf = s.objs("shop").filter { it.get("code").s() != reward?.get("code").s() }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        AisleHead("Packs", "${"%,d".format(price)} coins a pack")
        reward?.let { r -> val code = r.get("code").s() ?: ""
            FeaturedPack(code, r.get("name").s() ?: rows[code]?.name ?: code.uppercase(), r.get("released").s() ?: rows[code]?.released ?: "", rows[code], price, canBuy, onBuy = { onBuy(code) }, onOpen = { onSet(code) }) }
        if (shelf.isNotEmpty()) {
            Text("On the shelf this week", style = Site.Eyebrow)
            LazyRow(Modifier.bleed(16.dp), contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(shelf, key = { it.get("code").s() ?: "" }) { x -> val code = x.get("code").s() ?: ""
                    ShelfPack(code, x.get("name").s() ?: code.uppercase(), rows[code], price, canBuy, onBuy = { onBuy(code) }, onOpen = { onSet(code) }) }
            }
        }
        val shape = RoundedCornerShape(18.dp)
        Row(Modifier.fillMaxWidth().clip(shape).background(if (AppSettings.theme == "light") Color(0x94FFFFFF) else Color(0x0DFFFFFF))
            .border(1.dp, if (AppSettings.theme == "light") Site.GlassLine else Color(0x40D6AD64), shape).clickable(onClick = onAll).padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(SiteIcons.Pack, 22.dp)
            Column(Modifier.weight(1f)) {
                Text("Every set, every year", style = bold.copy(fontSize = 15.sp))
                Text("${"%,d".format(rows.size)} sets · your progress in each", style = small.copy(fontSize = 12.5.sp))
            }
            Text("›", style = TextStyle(fontSize = 22.sp, color = Site.Gold))
        }
    }
}

/** The week's featured set (the reward set): its pack large, its name and year, how much of it you hold, and Buy. */
@Composable
private fun FeaturedPack(code: String, name: String, released: String, row: Trunk.SetRow?, price: Int, canBuy: Boolean, onBuy: () -> Unit, onOpen: () -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    val pct = row?.total?.takeIf { it > 0 }?.let { row.owned.toFloat() / it } ?: 0f
    Row(Modifier.fillMaxWidth().clip(shape)
        .background(Brush.linearGradient(listOf(Color(0xFF2A2114), Color(0xFF15120D), Color(0xFF0E0F13))))
        .drawBehind { drawCircle(Brush.radialGradient(listOf(Color(0x40F6D58F), Color.Transparent), center = androidx.compose.ui.geometry.Offset(size.width * .2f, size.height * .5f), radius = size.height),
            radius = size.height, center = androidx.compose.ui.geometry.Offset(size.width * .2f, size.height * .5f)) }
        .border(1.dp, Brush.verticalGradient(listOf(Color(0x99E8B95B), Color(0x33E8B95B))), shape).clickable(onClick = onOpen).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Booster(code, name, Modifier.width(118.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("FEATURED", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 11.5.sp, letterSpacing = 2.sp, color = Site.Gold))
            Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 24.sp, color = Cream), maxLines = 3, overflow = TextOverflow.Ellipsis)
            Text(listOfNotNull(code.uppercase(), released.take(4).ifBlank { null }).joinToString(" · "), style = small.copy(fontSize = 12.5.sp, color = Color(0xFFC9CED6)))
            if (row?.total != null) { ProgressBar(pct)
                Text("${"%,d".format(row.owned)} of ${"%,d".format(row.total)} cards", style = small.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC9CED6))) }
            GoldCta("%,d".format(price), Modifier.padding(top = 4.dp), enabled = canBuy, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 16.dp) }, onClick = onBuy)
        }
    }
}

/** One pack on the shelf: standing on a lit gold-edged board, its name under it and its price. */
@Composable
private fun ShelfPack(code: String, name: String, row: Trunk.SetRow?, price: Int, canBuy: Boolean, onBuy: () -> Unit, onOpen: () -> Unit) {
    Column(Modifier.width(112.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth().drawBehind {
            // The shelf board under the pack, wide enough to meet its neighbours' boards.
            val y = size.height - 3.dp.toPx(); val x0 = -8.dp.toPx(); val w = size.width + 16.dp.toPx()
            drawRect(Brush.verticalGradient(listOf(Color(0x00000000), Color(0x55000000)), startY = y + 9.dp.toPx(), endY = y + 22.dp.toPx()), androidx.compose.ui.geometry.Offset(x0, y + 9.dp.toPx()), androidx.compose.ui.geometry.Size(w, 13.dp.toPx()))
            drawRect(Brush.verticalGradient(listOf(Color(0xFF5A4126), Color(0xFF2E2014)), startY = y, endY = y + 9.dp.toPx()), androidx.compose.ui.geometry.Offset(x0, y), androidx.compose.ui.geometry.Size(w, 9.dp.toPx()))
            drawRect(Color(0xB3E8B95B), androidx.compose.ui.geometry.Offset(x0, y), androidx.compose.ui.geometry.Size(w, 1.dp.toPx()))
        }.padding(bottom = 3.dp).clickable(onClick = onOpen)) {
            Booster(code, name, Modifier.fillMaxWidth().padding(horizontal = 6.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(name, style = bold.copy(fontSize = 13.sp, lineHeight = 17.sp), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.heightIn(min = 34.dp))
        row?.total?.takeIf { it > 0 }?.let { t -> Text("${(row.owned * 100 / t)}% collected", style = small.copy(fontSize = 11.5.sp)) }
        GoldCta("%,d".format(price), enabled = canBuy, muted = true, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 15.dp) }, onClick = onBuy)
    }
}

/**
 * This week's store precons, each bought whole for coins. With the server's per-format store (preconStore.formats) it is
 * one shelf per format behind a row of format chips, Standard first; from a server that only sends the flat list, the
 * precons are grouped by the formats their cards are legal in.
 */
@Composable
private fun PreconAisle(precons: List<Decks.PreconEntry>?, byFormat: Map<String, List<String>>, needOf: (String) -> PreconNeed?, onOpen: (Decks.PreconEntry) -> Unit) {
    var format by rememberSaveable { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        AisleHead("Precons", "Whole decks for coins. You only pay for the cards you don't have yet.")
        if (precons == null) { Text("Opening the deck boxes…", style = small); return@Column }
        val shown = if (byFormat.isNotEmpty()) {
            val stocked = byFormat.mapValues { (_, files) -> files.mapNotNull { f -> precons.firstOrNull { it.fileName.removeSuffix(".json") == f } } }.filterValues { it.isNotEmpty() }
            val at = format.takeIf { it in stocked } ?: stocked.keys.firstOrNull().orEmpty()
            if (stocked.size > 1) ShelfRow { items(stocked.keys.toList(), key = { it }) { f -> ShelfChip(f, at == f, stocked.getValue(f).size) { format = f } } }
            stocked[at].orEmpty()
        } else {
            val formatsOf = { e: Decks.PreconEntry -> PreconStore.summaries[e.fileName]?.formats.orEmpty() }
            val formats = precons.flatMap(formatsOf).distinct().sortedBy { Decks.PLAY_FORMATS.indexOf(it).let { i -> if (i < 0) 99 else i } }
            if (formats.size > 1) ShelfRow {
                item(key = "all") { ShelfChip("All", format.isEmpty(), precons.size) { format = "" } }
                items(formats, key = { it }) { f -> ShelfChip(f, format == f, precons.count { f in formatsOf(it) }) { format = if (format == f) "" else f } }
            }
            precons.filter { format.isEmpty() || format in formatsOf(it) }
        }
        val row = androidx.compose.foundation.lazy.rememberLazyListState()
        LaunchedEffect(format) { row.scrollToItem(0) }
        LazyRow(Modifier.bleed(16.dp), state = row, contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(shown, key = { it.fileName }) { e -> PreconTile(e, needOf(e.fileName), Modifier.width(272.dp), shop = true) { onOpen(e) } }
        }
    }
}

/** Every set, every year (the Trunk's old Sets list): search, one row of shelf filters, then each year's sets with progress and Buy. */
@Composable
private fun EverySet(s: JsonObject, busy: Boolean, onBack: () -> Unit, onSet: (String) -> Unit, onBuy: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("") }
    val packs = s.objs("packs")
    val waiting = packs.groupingBy { it.get("set").s() ?: "" }.eachCount()
    val q = query.trim().lowercase()
    val all = remember(s) { Trunk.allSets(s) }
    val rows = all.filter { r -> (q.isEmpty() || r.name.lowercase().contains(q) || r.code == q) && when (filter) {
        "" -> true; "started" -> r.owned > 0; "waiting" -> (waiting[r.code] ?: 0) > 0; else -> r.format == filter } }
    val sold = remember(s) { s.objs("shop").mapNotNull { it.get("code").s() }.toSet() + listOfNotNull((s.get("rewardSet") as? JsonObject)?.get("code").s()) }
    LazyColumn(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(key = "head") { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PageHeader("Every set", "Shop", onBack = onBack)
            SearchField(query, "Search any set, any year") { query = it }
            ShelfRow { listOf("" to "All", "started" to "Collecting", "waiting" to "Packs waiting", "standard" to "Standard", "modern" to "Modern", "eternal" to "Vintage & Legacy")
                .forEach { (k, l) -> item(key = "f$k") { ShelfChip(l, filter == k, count = when (k) { "" -> all.size; "started" -> all.count { it.owned > 0 }; "waiting" -> all.count { (waiting[it.code] ?: 0) > 0 }; else -> all.count { it.format == k } }) { filter = k } } } }
        } }
        if (rows.isEmpty()) item(key = "none") { Text("No set by that name.", style = small.copy(fontSize = 15.sp), modifier = Modifier.padding(vertical = 24.dp)) }
        rows.groupBy { it.released.take(4).ifBlank { "Other" } }.forEach { (year, list) ->
            item(key = "y$year") { YearPlate(year) }
            items(list, key = { it.code }) { r ->
                ShopSetRow(r, waiting[r.code] ?: 0, price(s), coins(s) >= price(s) && !busy, sold = r.code in sold, onClick = { onSet(r.code) }, onBuy = { onBuy(r.code) })
            }
        }
    }
}

/** A year between hairlines, like an engraved shelf label. */
@Composable
private fun YearPlate(year: String) = Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(Modifier.weight(1f).height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x66E8B95B)))))
    Text(year, style = Site.Eyebrow)
    Box(Modifier.weight(1f).height(1.dp).background(Brush.horizontalGradient(listOf(Color(0x66E8B95B), Color.Transparent))))
}

/** Your packs (packsMarkup): one tile per set, Collector packs on their own tile in front of the set's ordinary packs. */
@Composable
private fun PacksPage(s: JsonObject, busy: Boolean, onBack: () -> Unit, onOpen: (String) -> Unit) {
    val packs = s.objs("packs")
    val groups = packs.sortedByDescending { collector(it) }.groupBy { (if (collector(it)) "*" else "") + (it.get("set").s() ?: "") }.toList()
    LazyVerticalGrid(GridCells.Adaptive(150.dp), Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) { PageHeader("Your packs", "Shop", onBack = onBack) {
            if (packs.isNotEmpty()) Text("%,d to open".format(packs.size), style = small.copy(fontWeight = FontWeight.Bold, color = Site.Gold)) } }
        if (groups.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
            Column(Modifier.fillMaxWidth().padding(vertical = 36.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Every pack is open", style = h2)
                Text("Packs come from Story battles, Planeswalk bosses, weekly quests and the Shop.", style = small.copy(fontSize = 15.sp, lineHeight = 21.sp))
                GoldCta("Back to the Shop", onClick = onBack)
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
/** A set's printings as they arrive: [total] from the first page, [name] the set's own (Scryfall set_name), [done] when the last page is in. */
private class LensLoad(val cards: List<LensCard>, val total: Int, val name: String?, val done: Boolean, val partial: Boolean = false)
private val setCache = HashMap<String, LensLoad>()

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
/**
 * Every printing of the set, page by page as the site's set page loads it ("Loading N of M cards…"). Each page is shown as it
 * lands ([each]); a page that fails after the first keeps what came in (a Secret Lair has 2,800+ printings over 17 pages).
 */
private suspend fun setCards(code: String, each: suspend (LensLoad) -> Unit = {}): LensLoad = setCache[code] ?: withContext(Dispatchers.IO) {
    val out = ArrayList<LensCard>()
    val start = "https://api.scryfall.com/cards/search?order=set&unique=prints&q=" + java.net.URLEncoder.encode("e:$code game:paper", "UTF-8")
    // Offline, a set this phone already saved (art/ThumbStore) still opens, from its saved printings.
    val first = runCatching { page(start) }.getOrNull() ?: return@withContext dev.cardstashy.nativeplay.art.ThumbStore.savedSet(code).map { lens(it) }
        .let { LensLoad(it, it.size, null, true) }.also { if (it.cards.isNotEmpty()) setCache[code] = it }
    val total = first.get("total_cards").i(); val name = first.objs("data").firstOrNull()?.get("set_name").s()
    var next: JsonObject? = first; var partial = false
    while (true) {
        val pg = next ?: break
        pg.objs("data").forEach { c -> out += lens(c) }
        val url = if (pg.get("has_more").b()) pg.get("next_page").s() else null
        if (url == null) break
        each(LensLoad(out.toList(), maxOf(total, out.size), name, false))
        kotlinx.coroutines.delay(100) // Scryfall asks for 50-100 ms between requests
        next = runCatching { page(url) }.getOrNull()
        if (next == null) partial = true
    }
    LensLoad(out.toList(), if (partial) maxOf(total, out.size) else out.size, name, true, partial).also { if (!partial && it.cards.isNotEmpty()) setCache[code] = it }
}

private fun lens(c: JsonObject): LensCard {
    val img = (c.get("image_uris") as? JsonObject)?.get("normal").s() ?: (c.objs("card_faces").firstOrNull()?.get("image_uris") as? JsonObject)?.get("normal").s() ?: ""
    return LensCard(c.get("id").s() ?: "", c.get("oracle_id").s() ?: c.objs("card_faces").firstOrNull()?.get("oracle_id").s() ?: "", c.get("name").s() ?: "",
        c.get("collector_number").s() ?: "", c.get("rarity").s() ?: "", img)
}

@Composable
private fun SetLens(s: JsonObject, code: String, busy: Boolean, onBack: () -> Unit, onBuy: () -> Unit, onOpen: (String) -> Unit, onCard: (CardPick) -> Unit) {
    val row = remember(s, code) { Trunk.allSets(s).firstOrNull { it.code == code } }
    var attempt by remember(code) { mutableStateOf(0) }
    val load = produceState<LensLoad?>(null, code, attempt) { value = null; value = setCards(code) { p -> withContext(Dispatchers.Main) { value = p } } }.value
    val cards = load?.cards
    // A set the phone has no facts for (a Secret Lair you bought into) takes the name Scryfall gives it, as the site's set page does.
    val name = row?.name?.takeIf { it != code.uppercase() } ?: SetFacts.set(code)?.name ?: load?.name ?: code.uppercase()
    val owned = remember(s) { s.objs("cards").associate { (it.get("o").s() ?: "") to it.get("c").i() } }
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
                        // Only a set with packs shows one: a Secret Lair you own cards from has no booster to buy or open.
                        if (sold || waiting.isNotEmpty()) Booster(code, name, Modifier.width(120.dp))
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
                    Text(if (load == null) "Loading the set…" else if (!load.done) "Loading ${"%,d".format(load.cards.size)} of ${"%,d".format(load.total)} cards…"
                        else "${"%,d".format(shown.size)} cards", style = small)
                    if (load?.partial == true && load.cards.isNotEmpty()) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("${"%,d".format(load.cards.size)} of ${"%,d".format(load.total)} cards came through.", style = small, modifier = Modifier.weight(1f))
                        GoldCta("Try again", muted = true) { attempt++ }
                    }
                }
            }
            if (load != null && load.done && shown.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
                if (load.cards.isEmpty()) Column(Modifier.padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
