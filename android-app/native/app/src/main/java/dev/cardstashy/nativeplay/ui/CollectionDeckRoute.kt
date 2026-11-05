package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The deck page drawn last, so coming back to the same deck paints at once. */
private object DeckCache {
    var id: String? = null
    var model: CollectionDeckModel? = null
    var q = ""
    /** The tab open (tcg.js S.ui.tdeckTab): Cards, or one drawn from the site's own markup (TCG_SITE_TABS). */
    var tab = "cards"
}

/** The Yu-Gi-Oh! and Pokémon deck tabs drawn here from the site's own markup and listeners (SitePanel); the others open the website's tab. */
private val TCG_SITE_TABS = setOf("rules", "matchups", "playtest")

/**
 * A deck's page (views.js deckPage, its Cards tab; for Yu-Gi-Oh! and Pokémon tcg.js tcgDeck) through the site's own code, drawn natively. Search, the type chips,
 * the grouping and the four views ask the site's code again (app.js deckSearch / deckChip / deckSort / deckView);
 * Practice seats the deck in the native Practice lobby as A.deckPlayCpu does. The − / ＋, the swaps and "+ Add" save here
 * (app.js deckQty / deckEmbSwap / deckAdd through CollectionWrites), and the ⋯ menu is native (DeckMenuSheet). Review, Share,
 * the footer and the other tabs (Rules, Power, Matchups, Upgrade lab, Versions, War Chest) open the website's page, which does
 * them there.
 * A Yu-Gi-Oh! or Pokémon deck ([game]): its view, Find and Close results are the site's handlers in the engine; − / ＋, → side,
 * a found card's ＋ and a staple's Swap save here (tcg.js tDeckQty / tDeckMove / tDeckAdd / tDeckEmbSwap); its cards open the native
 * card page. Its ⋯ menu, the other tabs, Export, Game Night and the price tools open the website's page (the game chosen first).
 */
@Composable
fun CollectionDeckRoute(deckId: String, onPlay: () -> Unit, onProfile: () -> Unit, onBack: () -> Unit, onHome: () -> Unit, onCards: () -> Unit,
                        onPractice: (id: String, format: String) -> Unit, web: (url: String, press: String?) -> Unit, nativeCard: Boolean = false,
                        onSet: ((String) -> Unit)? = null, onDeck: ((String) -> Unit)? = null, game: CardGame = CardGame.MTG) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    if (DeckCache.id != game.id + ":" + deckId) { DeckCache.id = game.id + ":" + deckId; DeckCache.model = null; DeckCache.q = ""; DeckCache.tab = "cards" }
    var model by remember(deckId) { mutableStateOf(DeckCache.model) }
    var deckTab by remember(deckId) { mutableStateOf(DeckCache.tab) }
    /** The open tab's body when it is the site's markup (CollectionEngine.deckPanel), as its listeners leave it. */
    var panel by remember(deckId) { mutableStateOf<SitePanelModel?>(null) }
    /** The collection is loaded in the engine (ensureCollection) and the page drawn once: a tab's body can be asked for. */
    var ready by remember(deckId) { mutableStateOf(false) }
    var query by remember(deckId) { mutableStateOf(DeckCache.q) }
    var failed by remember(deckId) { mutableStateOf<String?>(null) }
    /** A control waiting for the site's handler (kind to value), applied on the engine's thread. */
    var asked by remember(deckId) { mutableStateOf<Pair<String, String>?>(null) }
    /** The card pages open over the deck, the last on top (a card opened from a card goes back to it). */
    var cards by remember(deckId) { mutableStateOf(listOf<CardOpen>()) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    // The site keeps each game's deck view (settings.displayModes[game].deck); the app keeps them here.
    val viewPref = if (game == CardGame.MTG) "deckView" else "deckView-" + game.id
    suspend fun paint() {
        // The search as typed and the view last chosen (the site keeps the view in the account's settings; the app keeps it here).
        val o = com.google.gson.JsonObject().apply { addProperty("search", DeckCache.q); prefs.getString(viewPref, null)?.let { addProperty("view", it) }; addProperty("tab", deckTab) }
        val m = withContext(Dispatchers.Default) { CollectionDeckModel.parse(CollectionEngine.deck(game.id, deckId, o)) }
        model = m; DeckCache.model = m
    }
    LaunchedEffect(deckId, session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        paint(); ready = true
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            try { CollectionEngine.refresh(game.id, deckId = deckId) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        paint()
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (model == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "This deck couldn’t be opened here."
    } }
    // Typing waits a beat before it searches (I.deckSearch).
    LaunchedEffect(query) {
        if (query == DeckCache.q) return@LaunchedEffect
        delay(180); DeckCache.q = query
        if (HomeCache.loaded != null) runCatching { paint() }
    }
    // A save (here, from a card page over this one, or its Undo): the page is read again, as app.js commit draws it again.
    val written by CollectionWrites.written.collectAsState()
    var seenWrite by remember(deckId) { mutableStateOf(written) }
    LaunchedEffect(written) { if (written != seenWrite) { seenWrite = written; if (HomeCache.loaded != null) runCatching { paint() } } }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    fun write(kind: String, vararg data: Pair<String, String>, done: (Boolean) -> Unit = {}) = scope.launch {
        done(CollectionWrites.act(context, kind, com.google.gson.JsonObject().apply { addProperty("deck", deckId); data.forEach { (k, v) -> addProperty(k, v) } }))
    }
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        if (HomeCache.loaded != null) runCatching {
            val m = withContext(Dispatchers.Default) { CollectionDeckModel.parse(CollectionEngine.deckDo(game.id, deckId, kind, value)) }
            model = m; DeckCache.model = m
            // A.tDeckFind: the results land when the card source answers; the page draws again as they come in.
            if (m.find?.busy == true) CollectionEngine.settle(15_000, "Collection.tdeckModel()") { j ->
                if (j.has("id")) CollectionDeckModel.parse(j).let { n -> model = n; DeckCache.model = n }
            }
        }
        asked = null
    }
    val site = "https://cardstashy.com/"
    val tcg = game != CardGame.MTG
    val page = site + (if (tcg) "#tdeck/" else "#deck/") + android.net.Uri.encode(deckId)
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    val webAt = web
    // A Yu-Gi-Oh! or Pokémon page of the website opens on its game (tcg.js A.setGame pressed first).
    fun web(url: String, press: String?) = webAt(url, if (!tcg) press else listOfNotNull("[data-act=\"setGame\"][data-game=\"${game.id}\"]", press).joinToString("\n"))
    /** tcg.js A.tDeckTab: Cards and the tabs drawn here open here; the others open the website's tab. */
    fun openTab(k: String) { if (k == "cards" || (tcg && k in TCG_SITE_TABS)) deckTab = k else web("$page/" + android.net.Uri.encode(k), null) }
    fun tcgWrite(kind: String, c: DeckCard?, vararg data: Pair<String, String>) = write(kind, "game" to game.id, *data,
        *(if (c == null) emptyArray() else listOfNotNull("zone" to c.zone, "id" to c.cardId, c.rowIndex?.let { "rowIndex" to it }, c.purchaseIdentity?.let { "purchaseIdentity" to it }).toTypedArray()))
    fun tcgOpen(id: String, name: String = "", open: Map<String, String> = emptyMap()) {
        val tile = "[data-act=\"tCard\"][data-id=\"${css(id)}\"]"
        if (nativeCard) cards = cards + CardOpen(name, deck = deckId, page = page, tile = tile, game = game.id, id = id,
            setVariant = open["setVariant"].orEmpty(), printing = open["printing"].orEmpty(), edition = open["edition"].orEmpty())
        else web(page, tile)
    }
    /**
     * The panel as the site's scripts leave it; a data-act they leave to app.js that runs elsewhere (Ask a Judge, the game's guide,
     * a rule's card search) opens the website's tab and presses the same button there.
     */
    fun take(m: SitePanelModel) {
        panel = m
        // What the site toasts (tcg.js's toast(), e.g. a chest tool's "Nothing to draw"): the app's toast.
        m.toasts.lastOrNull()?.let { CollectionWrites.show(it) }
        val a = m.acted ?: return
        val act = a.get("act")?.takeIf { it.isJsonPrimitive }?.asString ?: return
        val got = { k: String -> a.getAsJsonObject("data")?.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty() }
        when {
            // A card in the panel (the War Chest's sample hand, tcg.js A.tCard): its page here.
            act == "tCard" && got("id").isNotEmpty() -> { tcgOpen(got("id")); return }
            // A tab the panel opens (the War Chest's Goldfish, tcg.js A.tDeckTab): here when drawn here, else the website's.
            act == "tDeckTab" && got("id").isNotEmpty() -> { openTab(got("id")); return }
        }
        val data = a.getAsJsonObject("data")?.entrySet().orEmpty()
            .filter { (k, v) -> k != "act" && v.isJsonPrimitive && v.asString.length < 120 && !v.asString.startsWith("{") && !v.asString.startsWith("[") }
        val sel = "[data-act=\"${css(act)}\"]" + data.joinToString("") { (k, v) -> "[data-" + k.replace(Regex("[A-Z]")) { "-" + it.value.lowercase() } + "=\"${css(v.asString)}\"]" }
        web("$page/" + android.net.Uri.encode(deckTab), sel)
    }
    /** A tap or typing in the panel: the site's listeners, then what they start (the rulebook, a source) as it lands. */
    fun panelDo(call: suspend () -> com.google.gson.JsonObject) = scope.launch {
        if (HomeCache.loaded == null) return@launch
        runCatching {
            take(SitePanelModel.parse(call()))
            CollectionEngine.settle(15_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) }
        }
    }
    val screenW = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
    val siteUi = remember(deckId, screenW) {
        SiteUi(tap = { id -> panelDo { CollectionEngine.panelTap(id) } }, type = { id, v -> panelDo { CollectionEngine.panelType(id, v) } },
            open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
            screen = screenW)
    }
    // A tab (tcg.js A.tDeckTab): the page again with it open, and its body from the site's markup; the rest open the website's tab.
    LaunchedEffect(deckTab, ready) {
        DeckCache.tab = deckTab
        if (!ready || HomeCache.loaded == null) return@LaunchedEffect
        runCatching { paint() }
        if (deckTab == "cards") { panel = null; return@LaunchedEffect }
        runCatching {
            take(SitePanelModel.parse(CollectionEngine.deckPanel(game.id, deckId, deckTab)))
            CollectionEngine.settle(15_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) }
        }
    }
    val act = remember(game, deckId) {
        CollectionDeckActions(
            // The header's game tabs: that game's decks (tcg.js A.setGame), the native Decks tab.
            game = { g -> if (g != game) { CollectionGame.set(g); onBack() } },
            back = onBack,
            act = { a, id ->
                when {
                    a == "deckPlayCpu" -> onPractice(deckId, model?.format.orEmpty())
                    // tcg.js A.tDeckTab (War Chest, Power): that tab, here when it is drawn here (openTab), else the website's.
                    a == "tDeckTab" -> openTab(id)
                    // A.deckMenu: the menu here (DeckMenuSheet); what it still leaves to the website opens the site's menu and taps it.
                    // tcg.js A.tDeckMenu: the menu here too (DeckMenuSheet on tcg.js's sheet); Share deck opens the website's menu and taps it.
                    a == "tDeckMenu" && onDeck != null -> CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(deckId,
                        tab = { k -> openTab(k) },
                        web = { x, _ -> web(page, "[data-act=\"tDeckMenu\"]\n[data-act=\"${css(x)}\"]") },
                        openDeck = onDeck, deleted = onBack, game = game.id)
                    // tcg.js A.tDeckExport (the hero's and the price panel's): the game's file, saved to Downloads.
                    a == "tDeckExport" && tcg -> { scope.launch { exportTcgDeck(context, deckId, game.id) }; Unit }
                    // The price panel: tcg.js A.tDeckRefresh, A.tDeckCheapest and A.tDeckCopyMissing, the site's own (CollectionWrites).
                    tcg && a in setOf("tDeckRefresh", "tDeckCheapest", "tDeckCopyMissing") -> { write(a, "game" to game.id); Unit }
                    a == "deckMenu" && onDeck != null -> CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(deckId,
                        tab = { k -> if (k != "cards") web("$page/" + android.net.Uri.encode(k), null) },
                        web = { x, sc -> web(page, "[data-act=\"deckMenu\"]\n[data-act=\"${css(x)}\"]" + (if (sc.isNotEmpty()) "[data-scope=\"${css(sc)}\"]" else "")) },
                        openDeck = onDeck, deleted = onBack)
                    a.isBlank() -> {}
                    id.isNotBlank() -> web(page, "[data-act=\"${css(a)}\"][data-id=\"${css(id)}\"]")
                    else -> web(page, "[data-act=\"${css(a)}\"]")
                }
            },
            tab = { k -> openTab(k) },
            tcgCard = { id -> tcgOpen(id) },
            tcgRow = { c -> tcgOpen(c.cardId, c.r.name, c.open) },
            tcgQty = { c, d -> tcgWrite("tDeckQty", c, "delta" to d.toString()) },
            tcgMove = { c -> tcgWrite("tDeckMove", c) },
            find = { q -> asked = "find" to q },
            findClose = { asked = "close" to "" },
            foundAdd = { id -> tcgWrite("tDeckAdd", null, "id" to id) },
            tcgSwap = { o, i -> tcgWrite("tDeckEmbSwap", null, "out" to o, "in" to i) },
            search = { q -> query = q },
            chip = { v -> asked = "filter" to v },
            group = { v -> asked = "sort" to v },
            view = { v -> prefs.edit().putString(viewPref, v).apply(); asked = "view" to v },
            card = { n -> val tile = "[data-act=\"card\"][data-name=\"${css(n)}\"]"
                if (nativeCard) cards = cards + CardOpen(n, deck = deckId, page = page, tile = tile) else web(page, tile) },
            set = { code -> if (code.isNotBlank()) onSet?.invoke(code.lowercase()) ?: web(site + "#set/" + android.net.Uri.encode(code.lowercase()), null) },
            // The deck's − / ＋, a swap and a typed add save here: the site's handlers, then the page again (CollectionWrites).
            qty = { n, d -> write("deckQty", "name" to n, "delta" to d.toString()) },
            swap = { o, i -> write("deckEmbSwap", "out" to o, "in" to i) },
            addCard = { n, done -> write("deckAdd", "name" to n, done = done) },
        )
    }
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(CollectionTab.DECKS, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> onHome()
                CollectionTab.CARDS -> onCards()
                CollectionTab.SEARCH -> web(site + "#search", null)
                CollectionTab.DECKS -> onBack()
                CollectionTab.SCAN -> web(site + "#scan", null)
            }
        }
    }
    val m = model
    Box(Modifier.fillMaxSize()) {
    // The page is recorded as it draws, so the rule glass can blur what is under it (backdrop-filter).
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    if (m != null) Box(Modifier.fillMaxSize().drawWithContent { pageLayer.record { this@drawWithContent.drawContent() }; drawLayer(pageLayer) }) {
        CollectionDeck(m, top, act, nav, query, site = panel.takeIf { deckTab != "cards" }, siteUi = siteUi) }
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your deck…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Its cards will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
    // rule-dex.js showRuleHint's glass over the page; a tap outside it closes it (its ✕, as its own outside listener does).
    panel?.takeIf { deckTab != "cards" }?.let { p -> SiteGlass(p, siteUi, pageLayer) { p.glass?.find { it.has("rule-dismiss") }?.let { siteUi.tap(it.id) } } }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) { CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web, onSet = onSet) } }
    }
}
