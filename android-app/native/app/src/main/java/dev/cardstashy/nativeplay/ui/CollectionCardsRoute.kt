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

/** What the Cards tab showed last, so coming back paints at once. How it is sorted and filtered lives in the engine (S.ui), as on the site. */
private object CardsCache {
    /** Each game's page as last drawn (Magic, Yu-Gi-Oh!, Pokémon). */
    val models = HashMap<CardGame, CollectionCardsModel>()
    val q = HashMap<CardGame, String>()
    val tab = HashMap<CardGame, String>()
    val value = HashMap<CardGame, CollectionValueModel>()
    val binders = HashMap<CardGame, com.google.gson.JsonObject>()
}

/**
 * Collection's Cards tab: the account's collection through the site's own views.js collection(), drawn natively. Sort,
 * direction, filter, search, the view (Gallery, Compact, Symbols) and Show more ask the site's code again; the steppers and a wanted
 * card's × save from here (CollectionWrites); Value and Binders are drawn here (CollectionValue, CollectionBinders); Select and the ⋯ menu still
 * open the website's page.
 */
@Composable
fun CollectionCardsRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, web: (url: String, press: String?) -> Unit, onDecks: (() -> Unit)? = null, nativeCard: Boolean = false,
                         onSet: ((String) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    // The game the header's tabs chose (tcg.js A.setGame): Home, Cards and Decks all follow it.
    remember { CollectionGame.init(context) }
    val game by CollectionGame.current.collectAsState()
    var model by remember(game) { mutableStateOf(CardsCache.models[game]) }
    var query by remember(game) { mutableStateOf(CardsCache.q[game] ?: "") }
    var asked by remember { mutableStateOf<Pair<String, String>?>(null) }
    /** The card pages open over the list, the last on top (a card opened from a card goes back to it). */
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    var failed by remember { mutableStateOf<String?>(null) }
    // Cards, Binders or Value (views.js collection's segmented collTab; tcg.js tCollTab), and Value's page once read.
    var tab by remember(game) { mutableStateOf(CardsCache.tab[game] ?: "cards") }
    var value by remember(game) { mutableStateOf(CardsCache.value[game]) }
    var refreshing by remember(game) { mutableStateOf(false) }
    var shelf by remember(game) { mutableStateOf(CardsCache.binders[game]) }
    /** A binder whose pocket opened a card: it opens again, at its page, once that card page closes (app.js sheet history). */
    var parked by remember { mutableStateOf<CollectionWrites.BinderOpen?>(null) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    // The view last chosen here (the site keeps it in the account's settings.displayModes; the app keeps it too, as the set page does).
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    val viewKey = if (game == CardGame.MTG) "cardsView" else "cardsView-" + game.id
    suspend fun paint(control: Pair<String, String>? = null) {
        val g = game
        val m = withContext(Dispatchers.Default) {
            prefs.getString(viewKey, null)?.let { v -> if (control?.first != "view") runCatching { CollectionEngine.cardsDo(g.id, "view", v) } }
            CollectionCardsModel.parse(if (control != null) CollectionEngine.cardsDo(g.id, control.first, control.second) else CollectionEngine.cards(g.id))
        }
        if (g == CollectionGame.current.value) { model = m; CardsCache.models[g] = m }
    }
    // The account's copy, then the names the catalog lacks (prices and pictures fill in as they arrive); for Yu-Gi-Oh! and Pokémon the
    // shown cards' data (app.js route's tcgEnsureMany), kept for the next visit.
    LaunchedEffect(session?.userId, revision, game) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        paint()
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            try { CollectionEngine.refresh(game.id) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        paint()
        // app.js render() on the Magic Collection view: the day's price refresh (refreshMagicCollectionPrices).
        if (session != null && game == CardGame.MTG) CollectionWrites.refreshMagicPrices(context)
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (model == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "Your collection couldn’t be opened here."
    } }
    // A control changed: the site's handler runs, then the page is read again. Typing waits a beat before it searches.
    LaunchedEffect(asked) { asked?.let { c -> if (HomeCache.loaded != null) runCatching { paint(c) }; asked = null } }
    // A save (here or on a card page over the list): the list is read again.
    val written by CollectionWrites.written.collectAsState()
    var seen by remember { mutableStateOf(written) }
    LaunchedEffect(written) { if (written != seen) { seen = written; if (HomeCache.loaded != null) runCatching { paint() } } }
    // Value: the site's page read again when it opens, after a save, and as the collection's prices arrive (paint's model changes).
    LaunchedEffect(tab, game, written, model) {
        CardsCache.tab[game] = tab
        // Binders: the shelf as binders.js draws it, read again after a save.
        if (tab == "binders" && HomeCache.loaded != null) {
            val g = game
            runCatching { withContext(Dispatchers.Default) { CollectionEngine.binders(g.id) } }.getOrNull()
                ?.let { b -> if (g == CollectionGame.current.value) { shelf = b; CardsCache.binders[g] = b } }
            return@LaunchedEffect
        }
        if (tab != "value" || HomeCache.loaded == null) return@LaunchedEffect
        val g = game
        runCatching { withContext(Dispatchers.Default) { CollectionValueModel.parse(CollectionEngine.value(g.id)) } }.getOrNull()
            ?.let { v -> if (g == CollectionGame.current.value) { value = v; CardsCache.value[g] = v } }
    }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    LaunchedEffect(query, game) {
        if (query == (CardsCache.q[game] ?: "")) return@LaunchedEffect
        delay(180); CardsCache.q[game] = query
        if (HomeCache.loaded != null) runCatching { paint("search" to query) }
    }
    val site = "https://cardstashy.com/"
    val coll = site + "#collection"
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    // The website, for what isn't native yet: on Yu-Gi-Oh! or Pokémon it picks that game first (A.setGame), then presses [sel].
    fun site(sel: String) { val g = CollectionGame.current.value; web(coll, if (g == CardGame.MTG) sel else "[data-act=\"setGame\"][data-game=\"${g.id}\"]\n$sel") }
    val act = remember(game) {
        val tcg = game != CardGame.MTG
        CollectionCardsActions(
            game = { g -> CollectionGame.set(g) },
            // Cards, Binders and Value are drawn here.
            tab = { k -> if (k == "cards" || k == "value" || k == "binders") tab = k else site(if (tcg) "[data-act=\"tCollTab\"][data-id=\"${css(k)}\"]" else "[data-act=\"collTab\"][data-id=\"${css(k)}\"]") },
            view = { mode -> prefs.edit().putString(viewKey, mode).apply(); asked = "view" to mode },
            select = { site("[data-act=\"batchStart\"]") },
            menu = { web(coll, "[data-act=\"collMenu\"]") },
            sort = { v -> asked = "sort" to v },
            direction = { v -> asked = "direction" to v },
            filter = { v -> asked = "filter" to v },
            search = { q -> query = q },
            more = { asked = "more" to "" },
            card = { r ->
                // tcg.js A.tCard (data-id, data-entry): the Yu-Gi-Oh! and Pokémon card page is native; Magic's follows NATIVE_CARD.
                if (tcg) cards = cards + CardOpen(r.name, entry = if (r.wanted) "" else r.id, page = coll, tile = "[data-act=\"tCard\"][data-id=\"${css(r.cardId)}\"]", game = game.id, id = r.cardId)
                else { val tile = if (r.wanted) "[data-act=\"card\"][data-name=\"${css(r.name)}\"]" else "[data-act=\"card\"][data-entry=\"${css(r.id)}\"]"
                    if (nativeCard) cards = cards + CardOpen(r.name, entry = if (r.wanted) "" else r.id, page = coll, tile = tile) else web(coll, tile) } },
            set = { code -> if (code.isNotBlank()) onSet?.invoke(code.lowercase()) ?: web(site + "#set/" + android.net.Uri.encode(code.lowercase()), null) },
            price = { r -> web(coll, "[data-act=\"buyCard\"][data-lot=\"${css(r.id)}\"]") },
            // app.js A.qty and A.wishRemove (tcg.js A.tEntryQty and A.tWish), saved here (CollectionWrites).
            qty = { r, d -> scope.launch { if (tcg) CollectionWrites.act(context, "tEntryQty", com.google.gson.JsonObject().apply { addProperty("game", game.id); addProperty("id", r.id); addProperty("delta", d.toString()) })
                else CollectionWrites.act(context, "qty", com.google.gson.JsonObject().apply { addProperty("id", r.id); addProperty("delta", d.toString()) }) } },
            // app.js A.editLot and A.own: the add sheet, saved here (AddLotSheet).
            edit = { r -> CollectionWrites.openAdd(com.google.gson.JsonObject().apply { addProperty("entry", r.id) }) },
            // tcg.js A.tOwn (data-id): the site's Add to collection sheet, saved here (TcgAddSheet).
            got = { r -> if (tcg) CollectionWrites.tAdding.value = CollectionWrites.TcgAddOpen(com.google.gson.JsonObject().apply { addProperty("id", r.cardId); addProperty("game", game.id) })
                else CollectionWrites.openAdd(com.google.gson.JsonObject().apply { addProperty("own", r.name) }) },
            unwish = { r -> scope.launch { if (tcg) CollectionWrites.act(context, "tWish", com.google.gson.JsonObject().apply { addProperty("game", game.id); addProperty("id", r.wishId) })
                else CollectionWrites.act(context, "wishRemove", com.google.gson.JsonObject().apply { addProperty("id", r.wishId) }) } },
            pick = { name, v -> asked = "filter" to "$name=$v" },
            // tcg.js A.tRefreshPrices, run here (CollectionWrites): the button reads "Refreshing…" until it ends.
            refresh = { if (!refreshing) scope.launch { refreshing = true; try { CollectionWrites.act(context, "tRefreshPrices", com.google.gson.JsonObject().apply { addProperty("game", game.id) }) } finally { refreshing = false } } },
            button = { a -> site("[data-act=\"${css(a)}\"]") },
            // A.addCard opens the add sheet here; its "Paste or upload a list" (A.importCollection) is still the website's.
            emptyAct = { a -> if (tcg) { if (a == "go") web(site + "#search", null) else site("[data-act=\"${css(a)}\"]") }
                else if (a == "addCard") CollectionWrites.openAdd(com.google.gson.JsonObject()) { web(coll, "[data-act=\"importCollection\"]") }
                else web(coll, "[data-act=\"${css(a)}\"]") },
        )
    }
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(CollectionTab.CARDS, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> onHome()
                CollectionTab.CARDS -> {}
                CollectionTab.SEARCH -> web(site + "#search", null)
                CollectionTab.DECKS -> onDecks?.invoke() ?: web(site + "#decks", null)
                CollectionTab.SCAN -> web(site + "#scan", null)
            }
        }
    }
    // Value's taps: Refresh prices (app.js A.refreshPrices / tcg.js A.tRefreshPrices), a card (as the list opens it), Copy list (A.copySpare);
    // a price alert is the card page's tool, still the website's (A.priceAlert).
    val valueAct = remember(game) {
        val tcg = game != CardGame.MTG
        CollectionValueActions(
            refresh = { a -> if (!refreshing) scope.launch { refreshing = true
                try { CollectionWrites.act(context, a, com.google.gson.JsonObject().apply { if (tcg) addProperty("game", game.id) }) } finally { refreshing = false } } },
            open = { a, d, name -> fun ds(k: String) = d[k]?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                when (a) {
                    "tCard" -> cards = cards + CardOpen(name, entry = ds("entry"), page = coll, tile = "[data-act=\"tCard\"][data-id=\"${css(ds("id"))}\"]", game = game.id, id = ds("id"))
                    "card" -> { val n = ds("name").ifBlank { name }; val entry = ds("entry")
                        val tile = if (entry.isBlank()) "[data-act=\"card\"][data-name=\"${css(n)}\"]" else "[data-act=\"card\"][data-entry=\"${css(entry)}\"]"
                        if (nativeCard) cards = cards + CardOpen(n, entry = entry, page = coll, tile = tile) else web(coll, tile) }
                    "priceAlert" -> site("[data-act=\"priceAlert\"][data-game=\"${css(ds("game"))}\"][data-id=\"${css(ds("id"))}\"][data-name=\"${css(ds("name"))}\"]")
                    else -> if (a.isNotBlank()) site("[data-act=\"${css(a)}\"]")
                } },
            copySpare = { scope.launch { CollectionWrites.act(context, "copySpare", com.google.gson.JsonObject()) } },
        )
    }
    // Binders' taps: a binder opens over the page (app.js showBinder), its pocket's card over that (the binder comes back after), the set
    // checklist link; ＋ New binder and Binder options open the editor; holding a binder, tileMenu.
    val openBinder: (String, Int) -> Unit = remember(game) { { id, p ->
        val tcg = game != CardGame.MTG
        CollectionWrites.binder.value = CollectionWrites.BinderOpen(game.id, id, p,
            card = { a, d, name, back ->
                fun ds(k: String) = d[k]?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                parked = back
                if (tcg || a == "tCard") cards = cards + CardOpen(name, entry = ds("entry"), page = coll, tile = "[data-act=\"tCard\"][data-id=\"${css(ds("id"))}\"]", game = game.id, id = ds("id"))
                else { val n = ds("name").ifBlank { name }; val entry = ds("entry")
                    val tile = if (entry.isBlank()) "[data-act=\"card\"][data-name=\"${css(n)}\"]" else "[data-act=\"card\"][data-entry=\"${css(entry)}\"]"
                    if (nativeCard) cards = cards + CardOpen(n, entry = entry, page = coll, tile = tile) else { parked = null; web(coll, tile) } }
            },
            set = { code -> if (code.isNotBlank()) onSet?.invoke(code.lowercase()) ?: web(site + "#set/" + android.net.Uri.encode(code.lowercase()), null) })
    } }
    val shelfAct = remember(game) {
        BinderShelfActions(
            add = { CollectionWrites.binderEditing.value = CollectionWrites.BinderEditOpen(game.id, "", open = openBinder) },
            open = { id -> openBinder(id, 0) },
            hold = { id -> CardsCache.binders[game]?.get("hold")?.takeIf { it.isJsonObject }?.asJsonObject?.let { h ->
                CollectionWrites.binderHold.value = CollectionWrites.BinderHoldOpen(game.id, id, h, openBinder) } },
        )
    }
    LaunchedEffect(cards.isEmpty()) { if (cards.isEmpty()) parked?.let { b -> parked = null; CollectionWrites.binder.value = b.copy(id = System.nanoTime()) } }
    val m = model
    Box(Modifier.fillMaxSize()) {
    if (m != null) CollectionCards(m, top, act, nav, query, tab,
        when (tab) {
            "value" -> ({ gutter, narrow -> collectionValueItems(value, valueAct, gutter, narrow, refreshing) })
            "binders" -> ({ gutter, _ -> binderShelfItems(shelf, shelfAct, gutter) })
            else -> null
        })
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your account…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Your cards and profile will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) { CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web, onSet = onSet) } }
    }
}
