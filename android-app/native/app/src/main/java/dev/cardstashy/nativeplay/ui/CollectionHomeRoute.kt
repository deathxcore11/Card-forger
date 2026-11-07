package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
    /** Each account's Home by game ("<user>|mtg"), as last drawn this run. */
    val models = java.util.concurrent.ConcurrentHashMap<String, CollectionHomeModel>()
    /** The engine's text of each, as drawn (the next paint is compared with it, and its Card of the Day's set kept while today's loads). */
    val raw = java.util.concurrent.ConcurrentHashMap<String, String>()
    var hints: SearchHints? = null
    /** account id + workspace revision the engine holds. */
    var loaded: String? = null
    /** The engine holds a catalog (card names already looked up): a reload carries it over instead of the saved file. */
    var warm = false
    /** The game [hints] were drawn for. */
    var hintsGame: CardGame? = null
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
internal suspend fun ensureCollection(context: android.content.Context, userId: String?, signedIn: Boolean, revision: Long, warming: Boolean = false): Boolean {
    // A screen wants the engine: the launch warm-up (if still running) steps aside and the engine's thread is back at normal priority.
    if (!warming && !dev.cardstashy.nativeplay.collection.CollectionWarm.wanted) { dev.cardstashy.nativeplay.collection.CollectionWarm.wanted = true; CollectionEngine.nice(false) }
    return ensureLoaded(context, userId, signedIn, revision)
}
private suspend fun ensureLoaded(context: android.content.Context, userId: String?, signedIn: Boolean, revision: Long): Boolean = loadLock.withLock {
    CollectionEngine.init(context)
    val key = "$userId|$revision"
    if (HomeCache.loaded == key) return@withLock true
    val raw = withContext(Dispatchers.IO) { Decks.fullCopy(context) }
    if (signedIn && raw == null) return false
    run {
        // Deck covers come from the catalog: starting a reload from less than the engine already knows would blank them.
        val catalog = if (HomeCache.warm) CollectionEngine.catalog() else withContext(Dispatchers.IO) { catalogFile(context).takeIf { it.isFile }?.readText() }
        // tcg.js loadCache: the Yu-Gi-Oh! and Pokémon card data kept from the last visit, once for a fresh engine.
        if (!HomeCache.warm) CollectionEngine.tcgCacheLoad(withContext(Dispatchers.IO) { tcgCacheFile(context).takeIf { it.isFile }?.readText() })
        // Every deck's Power from the last visit (the site's own signature decides what is still current).
        if (!HomeCache.warm) CollectionEngine.powerLoad(withContext(Dispatchers.IO) { powerFile(context).takeIf { it.isFile }?.readText() })
        CollectionEngine.load(raw ?: "", catalog)
        HomeCache.loaded = key; HomeCache.warm = true
    }
    true
}
/** One check-and-load at a time: a page's load can never land between a save's load and its write (CollectionWrites). */
private val loadLock = kotlinx.coroutines.sync.Mutex()
internal fun catalogFile(context: android.content.Context) = File(context.filesDir, "collection-catalog.json")
internal fun tcgCacheFile(context: android.content.Context) = File(context.filesDir, "collection-tcg-cache.json")
internal fun powerFile(context: android.content.Context) = File(context.filesDir, "collection-power.json")
/** The card names a visit looked up (and the Yu-Gi-Oh! / Pokémon cards it fetched), kept for the next one. */
/** Keeps [raw] (a page the engine drew) for the next launch, at most every 5 s ([now]: the last one, always). */
internal class LastSeenWriter(private val user: String?, private val name: String) {
    private var at = 0L; private var last = 0
    suspend fun keep(raw: String, now: Boolean = false) {
        val h = raw.hashCode(); if (h == last) return
        val t = System.currentTimeMillis(); if (!now && t - at < 5000) return
        at = t; last = h
        withContext(Dispatchers.IO) { LastSeen.write(user, name, raw) }
    }
}

internal suspend fun keepCatalog(context: android.content.Context) = withContext(Dispatchers.IO) {
    runCatching { val f = catalogFile(context); val tmp = File(f.path + ".tmp"); tmp.writeText(CollectionEngine.catalog()); tmp.renameTo(f) }
    runCatching { val f = tcgCacheFile(context); val tmp = File(f.path + ".tmp"); tmp.writeText(CollectionEngine.tcgCache()); tmp.renameTo(f) }
    runCatching { val t = CollectionEngine.powerSave(); if (t.isNotEmpty()) { val f = powerFile(context); val tmp = File(f.path + ".tmp"); tmp.writeText(t); tmp.renameTo(f) } }
}

/**
 * The game Collection has open (tcg.js game(): the header's game tabs). The site keeps it with the page's route; the app keeps it on
 * this device, so Home, Cards and Decks open on the game last picked.
 */
object CollectionGame {
    private var prefs: android.content.SharedPreferences? = null
    val current = kotlinx.coroutines.flow.MutableStateFlow(CardGame.MTG)
    fun init(context: android.content.Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE)
        current.value = CardGame.of(prefs?.getString("game", "mtg") ?: "mtg")
    }
    fun set(g: CardGame) { current.value = g; prefs?.edit()?.putString("game", g.id)?.apply() }
}

/** Today's pack on its way from Home to its set's page: "game|set", taken (once) when that page's cards are in. */
object TodayPack { @Volatile var want: String? = null; @Volatile var busy = false }

@Composable
fun CollectionHomeRoute(onPlay: () -> Unit, onProfile: () -> Unit, web: (url: String, press: String?) -> Unit, open: (String) -> Unit, onCards: (() -> Unit)? = null, onDecks: (() -> Unit)? = null,
                        onSet: ((String) -> Unit)? = null, onSets: (() -> Unit)? = null,
                        /** A deck's page here (Magic's #deck/<id>, Yu-Gi-Oh! / Pokémon's #tdeck/<id>): a tournament deck saved from its sheet. */
                        onDeck: ((id: String, game: CardGame) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    remember { CollectionGame.init(context) }
    val game by CollectionGame.current.collectAsState()
    remember { LastSeen.init(context) }
    val user = session?.userId
    val homeKey = "$user|${game.id}"
    // Home as drawn this run (by account and game), else as kept from the last launch (read below), until the engine's paint lands.
    val shown = remember { androidx.compose.runtime.mutableStateMapOf<String, CollectionHomeModel>() }
    val model = shown[homeKey] ?: HomeCache.models[homeKey]
    LaunchedEffect(homeKey) {
        if (model != null) return@LaunchedEffect
        val j = withContext(Dispatchers.IO) { LastSeen.read(user, LastSeen.homeName(game.id)) } ?: return@LaunchedEffect
        val m = withContext(Dispatchers.Default) { runCatching { CollectionHomeModel.parse(j) }.getOrNull() } ?: return@LaunchedEffect
        if (shown[homeKey] == null && HomeCache.models[homeKey] == null) { shown[homeKey] = m; HomeCache.raw.putIfAbsent(homeKey, j.toString()) }
    }
    var hints by remember { mutableStateOf(HomeCache.hints?.takeIf { HomeCache.hintsGame == game }) }
    // A card page opened from Home (the Card of the Day of Yu-Gi-Oh! or Pokémon), over it.
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    /** A Community Meta deck's sheet (home-ui.js home-meta-open: A.mtgProven / tcg.js A.tMetaDeck) open over Home. */
    var proven by remember { mutableStateOf(false) }
    // The account copy refreshes on every visit; the saved copy shows meanwhile.
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    var failed by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableStateOf(0) }
    LaunchedEffect(session?.userId, revision, game, retry) { try {
        // The account, game and page this effect draws for, fixed as it starts (a paint that ends after a switch is kept under its own).
        val u = session?.userId; val g = game; val k = "$u|${g.id}"; val keep = LastSeenWriter(u, LastSeen.homeName(g.id))
        if (!ensureCollection(context, u, session != null, revision)) {
            // Signed in, and this device has never had the account's copy: read it now, and say so if it can't be (never an endless wait).
            if (model == null) try { Decks.load(context, rethrow = true)
                if (withContext(Dispatchers.IO) { Decks.fullCopy(context) } == null) failed = "Your collection couldn’t be read from your account. Tap to try again."
            } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) { failed = "Your collection couldn’t be read from your account. Check your connection, then tap to try again." }
            return@LaunchedEffect
        }
        failed = null
        suspend fun paint(final: Boolean = false) {
            val raw = CollectionEngine.homeRaw(g.id)
            if (raw == HomeCache.raw[k] && (shown[k] != null || HomeCache.models[k] != null)) { if (final) keep.keep(raw, true); return }
            val m = withContext(Dispatchers.Default) {
                val j = com.google.gson.JsonParser.parseString(raw).asJsonObject
                keepHeroDetails(j, HomeCache.raw[k]?.let { runCatching { com.google.gson.JsonParser.parseString(it).asJsonObject }.getOrNull() })
                CollectionHomeModel.parse(j)
            }
            HomeCache.raw[k] = raw; shown[k] = m; HomeCache.models[k] = m
            keep.keep(raw, final)
        }
        paint()
        if (hints == null || HomeCache.hintsGame != game) withContext(Dispatchers.Default) { CollectionHomeModel.hints(CollectionEngine.hints(game.id)) }.also { hints = it; HomeCache.hints = it; HomeCache.hintsGame = game }
        // Card names the catalog lacks, the Card of the Day, Meta and News: repaint as they arrive.
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            // Whatever names this visit looked up are kept, even when it is cut short (after the last paint, so its Power is kept too).
            try { CollectionEngine.refresh(g.id); repaint.cancel(); paint(final = true) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        // The site's guard for a workspace it can't open: say so and leave the account copy untouched.
        HomeCache.loaded = null
        if (shown[homeKey] == null && HomeCache.models[homeKey] == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "Your collection couldn’t be opened here."
    } }
    val site = "https://cardstashy.com/"
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val searchOpen = LocalCollectionSearch.current
    val act = remember(searchOpen) {
        CollectionHomeActions(
            // tcg.js A.setGame: the header's game tabs switch Home (and Cards and Decks) to that game.
            game = { g -> CollectionGame.set(g) },
            go = { to -> if (to == "#sets" && onSets != null) onSets() else if (to == "#decks" && onDecks != null) onDecks() else web(site + to, null) },
            open = open,
            search = { searchOpen?.invoke() ?: web(site + "#search", null) },
            // A.homeDailyCard: Magic's opens the website's sheet for now; Yu-Gi-Oh!'s and Pokémon's open the native card page (A.tCard).
            daily = { d -> val g = CollectionGame.current.value
                // app.js A.homeDailyCard: Magic's opens in the printing Home shows (Randall 7 Nov: it opened the website).
                if (g == CardGame.MTG) scope.launch {
                    val a = runCatching { CollectionEngine.act("homeDailyCard", com.google.gson.JsonObject(), 30_000) }.getOrNull() ?: return@launch
                    a.get("error")?.takeIf { it.isJsonPrimitive }?.asString?.let { android.widget.Toast.makeText(context, it, android.widget.Toast.LENGTH_LONG).show(); return@launch }
                    if (CollectionGame.current.value == g) cards = cards + CardOpen(d.name, page = site, tile = "", daily = true)
                } else cards = cards + CardOpen(d.name, page = site, tile = "", game = g.id, id = d.id) },
            // Magic's set codes are lower case; a Pokémon set's id is kept as it is.
            set = { code -> val c = if (CollectionGame.current.value == CardGame.MTG) code.lowercase() else code
                if (c.isNotBlank()) onSet?.invoke(c) ?: web(site + "#set/" + android.net.Uri.encode(c), null) },
            setName = { name -> scope.launch { val id = CollectionEngine.setByName(CollectionGame.current.value.id, name); if (id.isNotBlank()) onSet?.invoke(id) } },
            // app.js A.homeTodayPack: today's set (Yu-Gi-Oh!'s found by its name), then its Open Pack with the Card of the Day as the hit
            // (TodayPack.want, which the set's page takes once its cards are in).
            todayPack = { d -> val g = CollectionGame.current.value
                if (onSet == null) web(site, "[data-act=\"homeTodayPack\"]") else if (!TodayPack.busy) scope.launch {
                    TodayPack.busy = true
                    try {
                        android.widget.Toast.makeText(context, "Loading the set for today’s pack…", android.widget.Toast.LENGTH_SHORT).show()
                        val j = CollectionEngine.todayPack(g.id)
                        val error = j.get("error")?.takeIf { it.isJsonPrimitive }?.asString
                        val id = when {
                            error != null || j.size() == 0 -> ""
                            g == CardGame.YGO -> CollectionEngine.setByName(g.id, j.get("name")?.asString.orEmpty())
                            g == CardGame.MTG -> j.get("set")?.asString.orEmpty().lowercase()
                            else -> j.get("set")?.asString.orEmpty()
                        }
                        if (id.isBlank() || CollectionGame.current.value != g) {
                            if (CollectionGame.current.value == g) android.widget.Toast.makeText(context, error ?: "Could not load today’s pack. Try again.", android.widget.Toast.LENGTH_SHORT).show()
                        } else { TodayPack.want = "${g.id}|$id"; onSet(id) }
                    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
                        android.widget.Toast.makeText(context, e.message?.takeIf { it.isNotBlank() } ?: "Could not load today’s pack. Try again.", android.widget.Toast.LENGTH_SHORT).show()
                    } finally { TodayPack.busy = false }
                } },
            // The deck's sheet, from the list Home shows (CollectionEngine.provenHome), drawn here (MetaDeckHost).
            metaDeck = { s -> val g = CollectionGame.current.value
                scope.launch { runCatching {
                    val j = CollectionEngine.provenHome(g.id, s.key)
                    j.get("toasts")?.takeIf { it.isJsonArray }?.asJsonArray?.lastOrNull()?.takeIf { it.isJsonPrimitive }?.asString?.let { CollectionWrites.show(it) }
                    if (MetaDeckSheetModel.parse(j) != null) proven = true
                } } },
        )
    }
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val nav: @Composable (Boolean) -> Unit = { v ->
        val searchTab = LocalCollectionSearch.current
        CollectionNav(CollectionTab.HOME, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> {}
                CollectionTab.CARDS -> onCards?.invoke() ?: web(site + "#collection", null)
                CollectionTab.SEARCH -> searchTab?.invoke() ?: web(site + "#search", null)
                CollectionTab.DECKS -> onDecks?.invoke() ?: web(site + "#decks", null)
                CollectionTab.SCAN -> web(site + "#scan", null)
            }
        }
    }
    val m = model
    Box(Modifier.fillMaxSize()) {
    if (m != null) CollectionHome(m, hints, top, act, nav)
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        // app.js's account-opening card, while the account's copy arrives.
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your account…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Your cards and profile will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center,
                modifier = if (failed != null) Modifier.clickable { failed = null; retry++ }.padding(12.dp) else Modifier)
        }
        nav(false)
    }
    if (proven) MetaDeckHost(site, close = { proven = false },
        // A.provenSave: the saved deck's page (Magic's on its Cards tab; Yu-Gi-Oh! / Pokémon's #tdeck/<id>).
        deck = { d -> proven = false
            val id = d.get("id")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            val tg = if (d.get("go")?.asString == "tdeck") CardGame.of(d.get("game")?.asString ?: CollectionGame.current.value.id) else CardGame.MTG
            if (tg == CardGame.MTG) deckOpensOn("mtg", id, d.get("tab")?.takeIf { it.isJsonPrimitive }?.asString ?: "cards")
            if (id.isNotBlank()) onDeck?.invoke(id, tg) ?: web(site + (if (tg == CardGame.MTG) "#deck/" else "#tdeck/") + android.net.Uri.encode(id), null) },
        // The website's Home, the game chosen first (tcg.js A.setGame), the deck's card pressed, then [sel] in its sheet.
        site = { u, sel -> val g = CollectionGame.current.value
            web(u, if (g == CardGame.MTG) sel else "[data-act=\"setGame\"][data-game=\"${g.id}\"]\n" + sel) }, web = web)
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) { CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web, onSet = onSet) } }
    }
}
