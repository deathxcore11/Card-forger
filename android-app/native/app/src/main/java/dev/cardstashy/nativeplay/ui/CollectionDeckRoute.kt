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

/** The deck page drawn last, so coming back to the same deck paints at once. */
private object DeckCache {
    var id: String? = null
    var model: CollectionDeckModel? = null
    var q = ""
}

/**
 * A deck's page (views.js deckPage, its Cards tab) through the site's own code, drawn natively. Search, the type chips,
 * the grouping and the four views ask the site's code again (app.js deckSearch / deckChip / deckSort / deckView);
 * Practice seats the deck in the native Practice lobby as A.deckPlayCpu does. A card, the ±, the menu, review, Share,
 * "+ Add", the swaps, the footer and the other tabs (Rules, Power, Matchups, Upgrade lab, Versions, War Chest) open the
 * website's page, which does them there.
 */
@Composable
fun CollectionDeckRoute(deckId: String, onPlay: () -> Unit, onProfile: () -> Unit, onBack: () -> Unit, onHome: () -> Unit, onCards: () -> Unit,
                        onPractice: (id: String, format: String) -> Unit, web: (url: String, press: String?) -> Unit, nativeCard: Boolean = false,
                        onSet: ((String) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    if (DeckCache.id != deckId) { DeckCache.id = deckId; DeckCache.model = null; DeckCache.q = "" }
    var model by remember(deckId) { mutableStateOf(DeckCache.model) }
    var query by remember(deckId) { mutableStateOf(DeckCache.q) }
    var failed by remember(deckId) { mutableStateOf<String?>(null) }
    /** A control waiting for the site's handler (kind to value), applied on the engine's thread. */
    var asked by remember(deckId) { mutableStateOf<Pair<String, String>?>(null) }
    /** The card pages open over the deck, the last on top (a card opened from a card goes back to it). */
    var cards by remember(deckId) { mutableStateOf(listOf<CardOpen>()) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    suspend fun paint() {
        // The search as typed and the view last chosen (the site keeps the view in the account's settings; the app keeps it here).
        val o = com.google.gson.JsonObject().apply { addProperty("search", DeckCache.q); prefs.getString("deckView", null)?.let { addProperty("view", it) } }
        val m = withContext(Dispatchers.Default) { CollectionDeckModel.parse(CollectionEngine.deck("mtg", deckId, o)) }
        model = m; DeckCache.model = m
    }
    LaunchedEffect(deckId, session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        paint()
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            try { CollectionEngine.refresh("mtg", deckId = deckId) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
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
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        if (HomeCache.loaded != null) runCatching {
            val m = withContext(Dispatchers.Default) { CollectionDeckModel.parse(CollectionEngine.deckDo("mtg", deckId, kind, value)) }
            model = m; DeckCache.model = m
        }
        asked = null
    }
    val site = "https://cardstashy.com/"
    val page = site + "#deck/" + android.net.Uri.encode(deckId)
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    val act = remember(deckId) {
        CollectionDeckActions(
            game = { g -> if (g != CardGame.MTG) web(site + "#decks", "[data-act=\"setGame\"][data-game=\"${g.id}\"]") },
            back = onBack,
            act = { a, id ->
                when {
                    a == "deckPlayCpu" -> onPractice(deckId, model?.format.orEmpty())
                    a.isBlank() -> {}
                    id.isNotBlank() -> web(page, "[data-act=\"${css(a)}\"][data-id=\"${css(id)}\"]")
                    else -> web(page, "[data-act=\"${css(a)}\"]")
                }
            },
            tab = { k -> if (k == "cards") Unit else web("$page/" + android.net.Uri.encode(k), null) },
            search = { q -> query = q },
            chip = { v -> asked = "filter" to v },
            group = { v -> asked = "sort" to v },
            view = { v -> prefs.edit().putString("deckView", v).apply(); asked = "view" to v },
            card = { n -> val tile = "[data-act=\"card\"][data-name=\"${css(n)}\"]"
                if (nativeCard) cards = cards + CardOpen(n, deck = deckId, page = page, tile = tile) else web(page, tile) },
            set = { code -> if (code.isNotBlank()) onSet?.invoke(code.lowercase()) ?: web(site + "#set/" + android.net.Uri.encode(code.lowercase()), null) },
            qty = { n, d -> web(page, "[data-act=\"deckQty\"][data-name=\"${css(n)}\"][data-delta=\"$d\"]") },
            swap = { o, i -> web(page, "[data-act=\"deckEmbSwap\"][data-out=\"${css(o)}\"][data-in=\"${css(i)}\"]") },
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
    if (m != null) CollectionDeck(m, top, act, nav, query)
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your deck…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Its cards will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) { CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web, onSet = onSet) } }
    }
}
