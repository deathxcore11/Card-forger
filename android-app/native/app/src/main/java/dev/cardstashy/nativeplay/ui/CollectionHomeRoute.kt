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
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

/** What Home showed last, so coming back paints at once while the feeds refresh. */
internal object HomeCache {
    var model: CollectionHomeModel? = null
    var hints: SearchHints? = null
    /** account id + workspace revision the engine holds. */
    var loaded: String? = null
    /** The engine holds a catalog (card names already looked up): a reload carries it over instead of the saved file. */
    var warm = false
}

/**
 * Collection mode's Home: the account's workspace (this device's full copy, refreshed from the account) through the site's
 * own Home code, drawn natively. Everything Home links to that is not native yet opens the website's page: [web] takes the
 * site URL and, for buttons with no address of their own, the button to press once the page is up.
 */
/**
 * Puts this device's copy of the account's workspace into the engine (once per account and revision; Home and the Cards tab
 * share it). False while signed in but the account's copy has never been read here: show nothing rather than an empty collection.
 */
internal suspend fun ensureCollection(context: android.content.Context, userId: String?, signedIn: Boolean, revision: Long): Boolean = loadLock.withLock {
    CollectionEngine.init(context)
    val raw = withContext(Dispatchers.IO) { Decks.fullCopy(context) }
    if (signedIn && raw == null) return false
    val key = "$userId|$revision"
    if (HomeCache.loaded != key) {
        // Deck covers come from the catalog: starting a reload from less than the engine already knows would blank them.
        val catalog = if (HomeCache.warm) CollectionEngine.catalog() else withContext(Dispatchers.IO) { catalogFile(context).takeIf { it.isFile }?.readText() }
        CollectionEngine.load(raw ?: "", catalog)
        HomeCache.loaded = key; HomeCache.warm = true
    }
    true
}
/** One check-and-load at a time: a page's load can never land between a save's load and its write (CollectionWrites). */
private val loadLock = kotlinx.coroutines.sync.Mutex()
internal fun catalogFile(context: android.content.Context) = File(context.filesDir, "collection-catalog.json")
/** The card names a visit looked up, kept for the next one. */
internal suspend fun keepCatalog(context: android.content.Context) = withContext(Dispatchers.IO) {
    runCatching { val f = catalogFile(context); val tmp = File(f.path + ".tmp"); tmp.writeText(CollectionEngine.catalog()); tmp.renameTo(f) }
}

@Composable
fun CollectionHomeRoute(onPlay: () -> Unit, onProfile: () -> Unit, web: (url: String, press: String?) -> Unit, open: (String) -> Unit, onCards: (() -> Unit)? = null, onDecks: (() -> Unit)? = null,
                        onSet: ((String) -> Unit)? = null, onSets: (() -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    var model by remember { mutableStateOf(HomeCache.model) }
    var hints by remember { mutableStateOf(HomeCache.hints) }
    // The account copy refreshes on every visit; the saved copy shows meanwhile.
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    var failed by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        suspend fun paint() {
            val m = withContext(Dispatchers.Default) { CollectionHomeModel.parse(CollectionEngine.home("mtg")) }
            model = m; HomeCache.model = m
        }
        paint()
        if (hints == null) withContext(Dispatchers.Default) { CollectionHomeModel.hints(CollectionEngine.hints("mtg")) }.also { hints = it; HomeCache.hints = it }
        // Card names the catalog lacks, the Card of the Day, Meta and News: repaint as they arrive.
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            // Whatever names this visit looked up are kept, even when it is cut short.
            try { CollectionEngine.refresh("mtg") } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        paint()
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        // The site's guard for a workspace it can't open: say so and leave the account copy untouched.
        HomeCache.loaded = null
        if (model == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "Your collection couldn’t be opened here."
    } }
    val site = "https://cardstashy.com/"
    val act = remember {
        CollectionHomeActions(
            // Pokémon and Yu-Gi-Oh! Home are still the website's: open it and pick that game there.
            game = { g -> if (g != CardGame.MTG) web(site, "[data-act=\"setGame\"][data-game=\"${g.id}\"]") },
            go = { to -> if (to == "#sets" && onSets != null) onSets() else web(site + to, null) },
            open = open,
            search = { web(site + "#search", null) },
            daily = { web(site, "[data-act=\"homeDailyCard\"]") },
            set = { code -> if (code.isNotBlank()) onSet?.invoke(code.lowercase()) ?: web(site + "#set/" + android.net.Uri.encode(code.lowercase()), null) },
            // The deck itself opens from the site's own carousel; until that page is native, the Meta decks page.
            metaDeck = { web(site + "#decks/inspiration", null) },
        )
    }
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(CollectionTab.HOME, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> {}
                CollectionTab.CARDS -> onCards?.invoke() ?: web(site + "#collection", null)
                CollectionTab.SEARCH -> web(site + "#search", null)
                CollectionTab.DECKS -> onDecks?.invoke() ?: web(site + "#decks", null)
                CollectionTab.SCAN -> web(site + "#scan", null)
            }
        }
    }
    val m = model
    if (m != null) CollectionHome(m, hints, top, act, nav)
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        // app.js's account-opening card, while the account's copy arrives.
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your account…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Your cards and profile will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
}
