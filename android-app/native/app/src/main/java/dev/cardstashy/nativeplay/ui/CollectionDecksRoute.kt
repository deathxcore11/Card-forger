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
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** What the Decks tab showed last, so coming back paints at once. */
private object DecksCache {
    /** Each game's page as last drawn. */
    val models = HashMap<CardGame, CollectionDecksModel>()
    var q = ""
}

/**
 * Collection's Decks tab (My decks): the account's decks through the site's own views.js decks() / deckTile, drawn natively.
 * Search asks the site's code again; a deck, Ideas, Meta decks, War Chest, Import, New and the random buttons open the
 * website's page, which does them there.
 */
@Composable
fun CollectionDecksRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, web: (url: String, press: String?) -> Unit,
                         onDeck: ((id: String) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    // The game the header's tabs chose (tcg.js A.setGame): Home, Cards and Decks follow it.
    remember { CollectionGame.init(context) }
    val game by CollectionGame.current.collectAsState()
    var model by remember(game) { mutableStateOf(DecksCache.models[game]) }
    var query by remember { mutableStateOf(DecksCache.q) }
    var failed by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    suspend fun paint() {
        val o = JsonObject().apply { addProperty("q", DecksCache.q) }
        val g = game
        val m = withContext(Dispatchers.Default) { CollectionDecksModel.parse(CollectionEngine.decks(g.id, o)) }
        if (g == CollectionGame.current.value) { model = m; DecksCache.models[g] = m }
    }
    // The account's copy, then the names the catalog lacks (art and power fill in as they arrive).
    LaunchedEffect(session?.userId, revision, game) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        paint()
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            try { CollectionEngine.refresh(game.id) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        paint()
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (model == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "Your decks couldn’t be opened here."
    } }
    // Typing waits a beat before it searches (I.shelfSearch).
    LaunchedEffect(query) {
        if (query == DecksCache.q) return@LaunchedEffect
        delay(180); DecksCache.q = query
        if (HomeCache.loaded != null) runCatching { paint() }
    }
    val site = "https://cardstashy.com/"
    val decks = site + "#decks"
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    // The website, for what isn't native yet: on Yu-Gi-Oh! or Pokémon it picks that game first (A.setGame), then presses [sel].
    fun page(url: String, sel: String?) { val g = CollectionGame.current.value
        web(url, if (g == CardGame.MTG) sel else listOfNotNull("[data-act=\"setGame\"][data-game=\"${g.id}\"]", sel).joinToString("\n")) }
    val act = remember {
        CollectionDecksActions(
            game = { g -> CollectionGame.set(g) },
            button = { a -> if (a.isNotBlank()) page(decks, "[data-act=\"${css(a)}\"]") },
            tab = { k -> page(decks, "[data-act=\"decksTab\"][data-id=\"${css(k)}\"]") },
            search = { q -> query = q },
            deck = { d ->
                val id = Regex("^#deck/([^/]+)").find(d.to)?.groupValues?.get(1)?.let(android.net.Uri::decode)
                // A Yu-Gi-Oh! or Pokémon deck (#tdeck/<id>) opens on the website for now.
                if (onDeck != null && id != null) onDeck(id) else page(site + d.to.ifBlank { "#decks" }, null)
            },
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
                CollectionTab.DECKS -> {}
                CollectionTab.SCAN -> web(site + "#scan", null)
            }
        }
    }
    val m = model
    if (m != null) CollectionDecks(m, top, act, nav, query)
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your account…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Your decks will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
}
