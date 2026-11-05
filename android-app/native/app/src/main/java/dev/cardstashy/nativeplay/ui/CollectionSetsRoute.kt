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
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/** The set browser and the last set page drawn, so coming back paints at once. */
private object SetsCache {
    var model: CollectionSetsModel? = null
    var q = ""
    var code: String? = null
    var set: CollectionSetModel? = null
    var setQ = ""
}

private const val SITE = "https://cardstashy.com/"
private fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")

/** The holding page while the account's copy arrives (as the deck page has it). */
@Composable
private fun Waiting(top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, nav: @Composable (Boolean) -> Unit, failed: String?, title: String, text: String) {
    Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else title, style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: text, style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
}

/**
 * Every Magic set (views.js setsPage, the site's #sets) through the site's own code, drawn natively: the search, the release
 * families, the Filters (type, availability, year, order, Reset, Refresh) and Show more are app.js's own handlers in the engine;
 * a set opens its page. Sets live under Search on the site, so Search is the lit tab.
 */
@Composable
fun CollectionSetsRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSet: (String) -> Unit,
                        web: (url: String, press: String?) -> Unit) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    var model by remember { mutableStateOf(SetsCache.model) }
    var query by remember { mutableStateOf(SetsCache.q) }
    var failed by remember { mutableStateOf<String?>(null) }
    var asked by remember { mutableStateOf<Pair<String, String>?>(null) }
    fun show(j: JsonObject) { if (j.size() > 0) CollectionSetsModel.parse(j).let { model = it; SetsCache.model = it } }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        show(withContext(Dispatchers.Default) { CollectionEngine.sets("mtg", JsonObject().apply { addProperty("q", SetsCache.q) }) })
        // app.js loadSetIndex: the list from Scryfall (or its day-old copy), drawn as it lands.
        CollectionEngine.setsLoad()
        CollectionEngine.settle(30_000, CollectionEngine.SETS_MODEL, ::show)
        show(CollectionEngine.setsModel())
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (model == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "The sets couldn’t be opened here."
    } }
    // Typing waits a beat before it searches (app.js setsSearch).
    LaunchedEffect(query) {
        if (query == SetsCache.q) return@LaunchedEffect
        delay(180); SetsCache.q = query; asked = "search" to query
    }
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        if (HomeCache.loaded != null) runCatching {
            show(withContext(Dispatchers.Default) { CollectionEngine.setsDo(kind, value) })
            if (kind == "reload") CollectionEngine.settle(30_000, CollectionEngine.SETS_MODEL, ::show)
        }
        asked = null
    }
    val act = remember {
        CollectionSetsActions(
            game = { g -> if (g != CardGame.MTG) web(SITE + "#sets", "[data-act=\"setGame\"][data-game=\"${g.id}\"]") },
            search = { q -> query = q },
            family = { v -> asked = "family" to v },
            facet = { name, v -> when (name) { "setsType" -> asked = "type" to v; "setsRelease" -> asked = "release" to v; "setsYear" -> asked = "year" to v; "setsSort" -> asked = "sort" to v } },
            press = { p -> when (p.act) {
                "setsReset" -> { query = ""; SetsCache.q = ""; asked = "reset" to "" }
                "setsReload" -> asked = "reload" to ""
                else -> if (p.act.isNotBlank()) web(SITE + "#sets", "[data-act=\"${css(p.act)}\"]")
            } },
            more = { asked = "more" to "" },
            set = onSet,
        )
    }
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(CollectionTab.SEARCH, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> onHome()
                CollectionTab.CARDS -> onCards()
                CollectionTab.SEARCH -> web(SITE + "#search", null)
                CollectionTab.DECKS -> onDecks()
                CollectionTab.SCAN -> web(SITE + "#scan", null)
            }
        }
    }
    val m = model
    if (m != null) CollectionSets(m, top, act, nav, query)
    else Waiting(top, nav, failed, "Opening every set…", "Every release will appear here.")
}

/**
 * One set's page (views.js setPage, the site's #set/<code>) through the site's own code, drawn natively. Search, All / Owned /
 * Missing, rarity, finish, order, the view and Show more are app.js's own handlers in the engine; a card opens the card page
 * (native when [nativeCard]) on that printing, priced in the finish the page shows; Open Pack opens the website's simulator.
 */
@Composable
fun CollectionSetRoute(code: String, onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSets: () -> Unit,
                       onSet: (String) -> Unit, web: (url: String, press: String?) -> Unit, nativeCard: Boolean = false) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    if (SetsCache.code != code) { SetsCache.code = code; SetsCache.set = null; SetsCache.setQ = "" }
    var model by remember(code) { mutableStateOf(SetsCache.set) }
    var query by remember(code) { mutableStateOf(SetsCache.setQ) }
    var failed by remember(code) { mutableStateOf<String?>(null) }
    var asked by remember(code) { mutableStateOf<Pair<String, String>?>(null) }
    var cards by remember(code) { mutableStateOf(listOf<CardOpen>()) }
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    fun show(j: JsonObject) { if (j.size() > 0) CollectionSetModel.parse(j).let { model = it; SetsCache.set = it } }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(code, session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        show(withContext(Dispatchers.Default) { CollectionEngine.set("mtg", code) })
        // The view last chosen (the site keeps it in the account's settings; the app keeps it here) and the search as typed.
        prefs.getString("setView", null)?.let { show(CollectionEngine.setDo("view", it)) }
        if (SetsCache.setQ.isNotBlank()) show(CollectionEngine.setDo("search", SetsCache.setQ))
        // app.js loadSet: every page of the set's cards, drawn as each lands (and the set index for its name and symbol).
        CollectionEngine.setLoad()
        CollectionEngine.settle(60_000, CollectionEngine.SET_MODEL, ::show)
        show(CollectionEngine.setModel())
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (model == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "This set couldn’t be opened here."
    } }
    LaunchedEffect(query) {
        if (query == SetsCache.setQ) return@LaunchedEffect
        delay(180); SetsCache.setQ = query; asked = "search" to query
    }
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        if (HomeCache.loaded != null) runCatching {
            show(withContext(Dispatchers.Default) { CollectionEngine.setDo(kind, value) })
            if (kind == "reload") CollectionEngine.settle(60_000, CollectionEngine.SET_MODEL, ::show)
        }
        asked = null
    }
    val page = SITE + "#set/" + android.net.Uri.encode(code)
    val act = remember(code) {
        CollectionSetActions(
            game = { g -> if (g != CardGame.MTG) web(SITE + "#sets", "[data-act=\"setGame\"][data-game=\"${g.id}\"]") },
            back = onSets,
            search = { q -> query = q },
            filter = { v -> asked = "filter" to v },
            select = { name, v -> when (name) { "setRarity" -> asked = "rarity" to v; "setFinish" -> asked = "finish" to v; "setSort" -> asked = "sort" to v } },
            view = { v -> prefs.edit().putString("setView", v).apply(); asked = "view" to v },
            more = { asked = "more" to "" },
            card = { t ->
                val tile = "[data-act=\"card\"][data-set-i=\"${t.i}\"]"
                val finish = model?.selects?.firstOrNull { it.name == "setFinish" }?.current?.value?.takeIf { it != "all" }.orEmpty()
                if (nativeCard) cards = cards + CardOpen(t.r.name, page = page, tile = tile, setI = t.i, setFinish = finish) else web(page, tile)
            },
            pack = { web(page, "[data-act=\"openSetPack\"]") },
            press = { p -> if (p.act == "setReload") asked = "reload" to "" else if (p.act.isNotBlank()) web(page, "[data-act=\"${css(p.act)}\"]") },
        )
    }
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(CollectionTab.SEARCH, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> onHome()
                CollectionTab.CARDS -> onCards()
                CollectionTab.SEARCH -> web(SITE + "#search", null)
                CollectionTab.DECKS -> onDecks()
                CollectionTab.SCAN -> web(SITE + "#scan", null)
            }
        }
    }
    val m = model
    Box(Modifier.fillMaxSize()) {
        if (m != null) CollectionSet(m, top, act, nav, query)
        else Waiting(top, nav, failed, "Opening this set…", "Its cards will appear here.")
        cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
            CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web,
                onSet = { s -> if (s == code) cards = emptyList() else onSet(s) })
        } }
    }
}
