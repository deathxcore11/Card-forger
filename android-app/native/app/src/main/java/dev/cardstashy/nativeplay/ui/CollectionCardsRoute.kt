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
    var model: CollectionCardsModel? = null
    var q = ""
}

/**
 * Collection's Cards tab: the account's collection through the site's own views.js collection(), drawn natively. Sort,
 * direction, filter, search, the view (Gallery, Compact, Symbols) and Show more ask the site's code again; the steppers and a wanted
 * card's × save from here (CollectionWrites); Edit, Got it, Binders, Value, Select and the ⋯ menu still open the website's page.
 */
@Composable
fun CollectionCardsRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, web: (url: String, press: String?) -> Unit, onDecks: (() -> Unit)? = null, nativeCard: Boolean = false,
                         onSet: ((String) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    var model by remember { mutableStateOf(CardsCache.model) }
    var query by remember { mutableStateOf(CardsCache.q) }
    var asked by remember { mutableStateOf<Pair<String, String>?>(null) }
    /** The card pages open over the list, the last on top (a card opened from a card goes back to it). */
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    var failed by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    // The view last chosen here (the site keeps it in the account's settings.displayModes; the app keeps it too, as the set page does).
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    suspend fun paint(control: Pair<String, String>? = null) {
        val m = withContext(Dispatchers.Default) {
            prefs.getString("cardsView", null)?.let { v -> if (control?.first != "view") runCatching { CollectionEngine.cardsDo("mtg", "view", v) } }
            CollectionCardsModel.parse(if (control != null) CollectionEngine.cardsDo("mtg", control.first, control.second) else CollectionEngine.cards("mtg"))
        }
        model = m; CardsCache.model = m
    }
    // The account's copy, then the names the catalog lacks (prices and pictures fill in as they arrive).
    LaunchedEffect(session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        paint()
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            try { CollectionEngine.refresh("mtg") } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        paint()
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
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    LaunchedEffect(query) {
        if (query == CardsCache.q) return@LaunchedEffect
        delay(180); CardsCache.q = query
        if (HomeCache.loaded != null) runCatching { paint("search" to query) }
    }
    val site = "https://cardstashy.com/"
    val coll = site + "#collection"
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    val act = remember {
        CollectionCardsActions(
            game = { g -> if (g != CardGame.MTG) web(coll, "[data-act=\"setGame\"][data-game=\"${g.id}\"]") },
            tab = { k -> web(coll, "[data-act=\"collTab\"][data-id=\"${css(k)}\"]") },
            view = { mode -> prefs.edit().putString("cardsView", mode).apply(); asked = "view" to mode },
            select = { web(coll, "[data-act=\"batchStart\"]") },
            menu = { web(coll, "[data-act=\"collMenu\"]") },
            sort = { v -> asked = "sort" to v },
            direction = { v -> asked = "direction" to v },
            filter = { v -> asked = "filter" to v },
            search = { q -> query = q },
            more = { asked = "more" to "" },
            card = { r -> val tile = if (r.wanted) "[data-act=\"card\"][data-name=\"${css(r.name)}\"]" else "[data-act=\"card\"][data-entry=\"${css(r.id)}\"]"
                if (nativeCard) cards = cards + CardOpen(r.name, entry = if (r.wanted) "" else r.id, page = coll, tile = tile) else web(coll, tile) },
            set = { code -> if (code.isNotBlank()) onSet?.invoke(code.lowercase()) ?: web(site + "#set/" + android.net.Uri.encode(code.lowercase()), null) },
            price = { r -> web(coll, "[data-act=\"buyCard\"][data-lot=\"${css(r.id)}\"]") },
            // app.js A.qty and A.wishRemove, saved here (CollectionWrites).
            qty = { r, d -> scope.launch { CollectionWrites.act(context, "qty", com.google.gson.JsonObject().apply { addProperty("id", r.id); addProperty("delta", d.toString()) }) } },
            edit = { r -> web(coll, "[data-act=\"editLot\"][data-id=\"${css(r.id)}\"]") },
            got = { r -> web(coll, "[data-act=\"own\"][data-name=\"${css(r.name)}\"]") },
            unwish = { r -> scope.launch { CollectionWrites.act(context, "wishRemove", com.google.gson.JsonObject().apply { addProperty("id", r.wishId) }) } },
            emptyAct = { a -> web(coll, "[data-act=\"${css(a)}\"]") },
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
    val m = model
    Box(Modifier.fillMaxSize()) {
    if (m != null) CollectionCards(m, top, act, nav, query)
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
