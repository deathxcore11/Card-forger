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
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.platform.LocalContext
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** The Search tab every Collection page's nav opens: native when MainActivity provides it, else null (the website's #search). */
val LocalCollectionSearch = androidx.compose.runtime.staticCompositionLocalOf<(() -> Unit)?> { null }

/** Each game's last search page, so coming back paints at once. */
private object SearchCache { val models = mutableMapOf<String, CollectionSearchModel>(); @Volatile var asked = false
    /** The deck whose Deck review sheet stays open over Search (app.js A.formatSearch has no closeSheet). */
    @Volatile var review: String? = null }

/**
 * A search left in the engine by another page (Magic's Deck review: app.js A.findRole, A.formatSearch, which set S.ui.db and go("#search")):
 * the Search tab opens on its words and filters, and pumps the search it started until it lands.
 */
/** Words typed in Home's search box (game-feel home G3), by game: the Search tab opens with them in its box and searched. Taken once. */
private val handed = java.util.concurrent.ConcurrentHashMap<String, String>()
fun searchFor(game: String, words: String) { if (words.isNotBlank()) handed[game] = words.trim() }

fun searchAsked(review: String? = null) { SearchCache.models.remove("mtg"); SearchCache.asked = true; SearchCache.review = review }

private const val SITE = "https://cardstashy.com/"
private fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")

/**
 * The Search tab (views.js search() for Magic, tcg.js tcgSearch() for Yu-Gi-Oh! and Pokémon; the site's #search) through the
 * site's own code, drawn natively. The search box, Filters, filter chips, saved searches, Try:, Load more and Random are the
 * site's own handlers in the engine (app.js dbSearch against Scryfall, tcg.js tSearch against YGOPRODeck / TCGdex); a result
 * opens the native card page; Sets opens the native set list; Compare, Wiki and Ask open the website's and press the same control there.
 */
@Composable
fun CollectionSearchRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSets: (String) -> Unit,
                          onSet: (game: String, code: String) -> Unit, web: (url: String, press: String?) -> Unit, game: String = "mtg", onGame: (String) -> Unit = {},
                          /** The Rules page (#rules), native. */
                          onRules: ((String) -> Unit)? = null,
                          /** The Wiki page (#wiki[/<topic>]), native: the game and the topic (blank: its home). */
                          onWiki: ((game: String, topic: String) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    var model by remember(game) { mutableStateOf(SearchCache.models[game]) }
    var query by remember(game) { mutableStateOf(SearchCache.models[game]?.field?.value ?: "") }
    var failed by remember(game) { mutableStateOf<String?>(null) }
    var cards by remember(game) { mutableStateOf(listOf<CardOpen>()) }
    var focused by remember(game) { mutableStateOf(false) }
    var suggest by remember(game) { mutableStateOf<SearchSuggest?>(null) }
    val scope = rememberCoroutineScope()
    /** Magic's Deck review sheet left open over Search (A.formatSearch: go("#search") with the sheet still up), by its deck. */
    var review by remember { mutableStateOf(SearchCache.review.also { SearchCache.review = null }) }
    /** One control at a time, in the order pressed (a search runs on while the next waits). */
    val turn = remember { Mutex() }
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    /** Saved searches are the site's localStorage; the app keeps them per account. */
    val savedKey = "searchSaved:" + (session?.userId ?: "guest")
    fun show(j: JsonObject) { if (j.size() > 0) CollectionSearchModel.parse(j).takeIf { it.game.id == game }?.let { model = it; SearchCache.models[game] = it } }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(session?.userId, revision, game) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        turn.withLock {
            val first = model == null
            CollectionEngine.searchSavedSet(prefs.getString(savedKey, null) ?: "")
            show(withContext(Dispatchers.Default) { CollectionEngine.search(game) })
            // The view last chosen (the site keeps it in the account's settings; the app keeps it here).
            prefs.getString("searchView:$game", null)?.let { v -> if (model?.mode != v) show(CollectionEngine.searchDo("viewSave", JsonObject().apply {
                add("dataset", JsonObject().apply { addProperty("mode", v); addProperty("area", "search") }) })) }
            show(CollectionEngine.searchModel())
            if (SearchCache.asked && game == "mtg") { SearchCache.asked = false; CollectionEngine.settle(60_000, CollectionEngine.SEARCH_MODEL, ::show); show(CollectionEngine.searchModel()) }
            // The box takes the engine's words only on the first paint (a reload of the account's copy never changes them).
            if (first) query = model?.field?.value ?: query
        }
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        failed = e.message?.takeIf { it.isNotBlank() } ?: "Search couldn’t be opened here."
    } }

    // suggest.js: on focus (and 180 ms after each keystroke) the list for what is in the box; it closes 120 ms after the box loses focus.
    LaunchedEffect(focused, query) {
        if (!focused) { delay(120); suggest = null; return@LaunchedEffect }
        if (HomeCache.loaded == null) return@LaunchedEffect
        if (query.isNotBlank()) delay(180)
        val asked = query
        turn.withLock {
            var j = CollectionEngine.searchSuggest(game, asked)
            if (j == null) { CollectionEngine.settle(15_000); j = CollectionEngine.searchSuggestModel() }
            SearchSuggest.parse(j)?.takeIf { if (asked.isBlank()) it.recent else it.q == asked }?.let { suggest = it }
        }
    }
    fun site(sel: String) = web(SITE + "#search", if (game == "mtg") sel else "[data-act=\"setGame\"][data-game=\"$game\"]\n$sel")
    fun open(w: JsonObject) {
        fun v(k: String) = w.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
        val page = SITE + "#search"
        val random = v("random") == "1"
        val next = if (v("act") == "tCard" && v("id").isNotBlank()) CardOpen(v("name"), page = page, tile = "[data-act=\"tCard\"][data-id=\"${css(v("id"))}\"]", game = game, id = v("id"),
            setId = v("setId"), setVariant = v("setVariant"), printing = v("printing"), edition = v("edition"), random = random)
        else if (v("name").isNotBlank()) CardOpen(v("name"), page = page, tile = "[data-act=\"card\"][data-name=\"${css(v("name"))}\"]", random = random)
        else return
        // 🎲 Another on a random card's page: the site's sheet shows the next one in its place.
        cards = (if (random && cards.lastOrNull()?.random == true) cards.dropLast(1) else cards) + next
    }
    /** A site control: the engine runs the site's handler, then the page is pumped until its lookups land. */
    fun run(act: String, data: Map<String, String>, value: String) {
        if (HomeCache.loaded == null) { CollectionWrites.show(failed ?: "Search is still opening."); return }
        val typing = act == model?.field?.input
        /** What the box said when pressed: the engine's words go back into it only if nothing was typed since. */
        val before = query
        scope.launch { turn.withLock { try {
            // The box as typed (data-input): the words kept, and what they had found cleared (app.js I.dbTerm's render); Enter searches.
            if (typing) { show(withContext(Dispatchers.Default) { CollectionEngine.searchDo(act, JsonObject().apply { addProperty("value", value); add("dataset", JsonObject()) }) }); return@withLock }
            show(withContext(Dispatchers.Default) { CollectionEngine.searchDo(act, JsonObject().apply {
                addProperty("value", value); add("dataset", JsonObject().apply { data.forEach { (k, x) -> addProperty(k, x) } }) }) })
            // Saved and recent searches are written at once (the site's own writes are synchronous), before the lookups settle.
            prefs.edit().putString(savedKey, CollectionEngine.searchSaved()).apply()
            model?.field?.value?.let { if (query == before) query = it }
            CollectionEngine.settle(60_000, CollectionEngine.SEARCH_MODEL, ::show)
            show(CollectionEngine.searchModel())
            model?.field?.value?.let { if (query == before) query = it }
            CollectionEngine.searchToasts().lastOrNull()?.let { CollectionWrites.show(it) }
            CollectionEngine.searchWent()?.let(::open)
        } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
            CollectionWrites.show(e.message?.takeIf { it.isNotBlank() } ?: "That didn’t work here.")
        } } }
    }
    // Home's box handed its words over: they go in this box and its own Enter runs, once the page is up.
    val ready = model != null
    LaunchedEffect(game, ready) {
        if (!ready) return@LaunchedEffect
        val words = handed.remove(game) ?: return@LaunchedEffect
        query = words
        turn.withLock { runCatching { CollectionEngine.searchRemember(game, words) } }
        model?.field?.let { f -> if (f.input.isNotBlank()) run(f.input, emptyMap(), words); if (f.enter.isNotBlank()) run(f.enter, emptyMap(), words) }
    }
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val focusClear: (() -> Unit)? = { focusManager.clearFocus() }
    val act = remember(game, savedKey) {
        CollectionSearchActions(
            game = { g -> if (g.id != game) onGame(g.id) },
            type = { v -> query = v; model?.field?.input?.takeIf { it.isNotBlank() }?.let { a -> run(a, emptyMap(), v) } },
            // suggest.js keydown Enter: rememberSearch, close the list; then the box's own data-enter.
            enter = { val q = query; suggest = null; scope.launch { turn.withLock { CollectionEngine.searchRemember(game, q) } }
                model?.field?.let { f -> if (f.input.isNotBlank()) run(f.input, emptyMap(), q); if (f.enter.isNotBlank()) run(f.enter, emptyMap(), q) } },
            focus = { f -> focused = f },
            // suggest.js pick: the name fills the box, is remembered, the list closes and the box's Enter runs.
            pick = { name -> query = name; suggest = null; focusClear?.invoke()
                scope.launch { turn.withLock { CollectionEngine.searchRemember(game, name) } }
                model?.field?.let { f -> if (f.input.isNotBlank()) run(f.input, emptyMap(), name); if (f.enter.isNotBlank()) run(f.enter, emptyMap(), name) } },
            press = { a, data, value -> when {
                a == "go" -> data["to"].orEmpty().let { to -> if (to == "#sets") onSets(game) else if (to == "#rules" && onRules != null) onRules(game) else web(SITE + to, null) }
                // app.js A.wikiOpen: the Wiki at the button's topic.
                a in setOf("mtgWikiOpen", "wikiOpen") && onWiki != null -> onWiki(data["game"]?.takeIf { it.isNotBlank() } ?: game, data["topic"]?.takeIf { it.isNotBlank() } ?: data["wikiTopic"].orEmpty())
                // Compare and Ask (CardStashy AI) are the website's for now: open it there and press the same control.
                a in setOf("compareOpen", "tCompareOpen", "mtgWikiOpen", "askOpen") -> site("[data-act=\"${css(a)}\"]")
                a.isNotBlank() -> run(a, data, value)
            } },
            view = { v ->
                prefs.edit().putString("searchView:$game", v).apply()
                run("viewSave", mapOf("mode" to v, "area" to "search"), "")
            },
            card = { t ->
                val page = SITE + "#search"
                cards = cards + if (t.id.isNotEmpty()) CardOpen(t.r.name, page = page, tile = "[data-act=\"tCard\"][data-id=\"${css(t.id)}\"]", game = game, id = t.id,
                    setId = t.open["setId"].orEmpty(), setVariant = t.open["setVariant"].orEmpty(), printing = t.open["printing"].orEmpty(), edition = t.open["edition"].orEmpty())
                    else CardOpen(t.r.name, page = page, tile = "[data-act=\"card\"][data-name=\"${css(t.r.name)}\"]")
            },
            fan = { c -> open(JsonObject().apply { addProperty("act", c.act); addProperty("name", c.name); addProperty("id", c.id) }) },
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
                CollectionTab.SEARCH -> Unit
                CollectionTab.DECKS -> onDecks()
                CollectionTab.SCAN -> web(SITE + "#scan", null)
            }
        }
    }
    val m = model
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().drawWithContent { pageLayer.record { this@drawWithContent.drawContent() }; drawLayer(pageLayer) }) {
            if (m != null) CollectionSearch(m, top, act, nav, query, suggest)
            else SearchWaiting(top, nav, failed)
        }
        review?.takeIf { game == "mtg" }?.let { deck ->
            val deckPage = SITE + "#deck/" + android.net.Uri.encode(deck)
            DeckReviewHost(deck, pageLayer, DeckReviewActions(close = { review = null },
                // A.card (data-deck): the card's page in the deck's context, its ← back to the review (the sheet history).
                card = { n -> review = null; cards = cards + CardOpen(n, deck = deck, page = deckPage, tile = "[data-act=\"deckReview\"]\n[data-act=\"card\"][data-name=\"${css(n)}\"]", back = "review") },
                act = { x -> when (x.act) {
                    // A.refreshDeck: "Refreshing…", then the site's toast; the sheet reads the deck again.
                    "refreshDeck" -> scope.launch { CollectionWrites.act(context, "refreshDeck", JsonObject().apply { addProperty("deck", deck) }) }
                    // A.formatSearch (the sheet stays) / A.findRole (closeSheet): the search they set, on this tab.
                    "findRole", "formatSearch" -> scope.launch {
                        if (CollectionWrites.reviewSearch(context, x.act, deck, x.role) == null) return@launch
                        if (x.act == "findRole") review = null
                        turn.withLock { runCatching {
                            show(CollectionEngine.searchModel()); CollectionEngine.settle(60_000, CollectionEngine.SEARCH_MODEL, ::show); show(CollectionEngine.searchModel()) } }
                        model?.field?.value?.let { query = it }
                    }
                    // Anything else (A.deckTab among them: the deck's own tab): the website's deck page, its review pressed, then the button.
                    else -> { review = null; web(deckPage, "[data-act=\"deckReview\"]\n[data-act=\"${css(x.act)}\"]" + (if (x.id.isNotBlank()) "[data-id=\"${css(x.id)}\"]" else "") + (if (x.role.isNotBlank()) "[data-role=\"${css(x.role)}\"]" else "")) }
                } }))
        }
        cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
            CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web, onSet = { s -> onSet(c.game, s) },
                onRandom = { run(if (game == "mtg") "dbRandom" else "tRandomCard", emptyMap(), "") },
                onBack = if (c.back == "review") ({ cards = cards.dropLast(1); review = c.deck }) else null)
        } }
    }
}

/** The holding page while the account's copy arrives (as the set list has it). */
@Composable
private fun SearchWaiting(top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit, nav: @Composable (Boolean) -> Unit, failed: String?) {
    Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening search…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            if (failed != null) Text(failed, style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
}
