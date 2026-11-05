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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Each game's set browser and the last set page drawn, so coming back paints at once. */
private object SetsCache {
    val models = mutableMapOf<String, CollectionSetsModel>()
    val qs = mutableMapOf<String, String>()
    var code: String? = null
    var set: CollectionSetModel? = null
    var setQ = ""
}

/** The website's own set browser for [game]: Magic's #sets, or the game picked first. */
private fun siteSets(game: String) = if (game == "mtg") null else "[data-act=\"setGame\"][data-game=\"$game\"]"
/** tcg.js names its controls tSets… / tSet…: the app's names for them. */
private fun plain(name: String) = name.removePrefix("t").replaceFirstChar { it.lowercase() }

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
 * Every set of [game] (views.js setsPage, or tcg.js tcgSets for Yu-Gi-Oh! and Pokémon; the site's #sets) through the site's own
 * code, drawn natively: the search, the release families, the Filters (type, availability, year, order, Reset, Refresh) and Show
 * more are the site's own handlers in the engine; a set opens its page. Sets live under Search on the site, so Search is the lit
 * tab. The other games' tabs switch the list ([onGame]) when [tcg] (their native lists are on), else open the website's.
 */
@Composable
fun CollectionSetsRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSet: (game: String, code: String) -> Unit,
                        web: (url: String, press: String?) -> Unit, game: String = "mtg", tcg: Boolean = false, onGame: (String) -> Unit = {}) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    var model by remember(game) { mutableStateOf(SetsCache.models[game]) }
    var query by remember(game) { mutableStateOf(SetsCache.qs[game] ?: "") }
    var failed by remember(game) { mutableStateOf<String?>(null) }
    var asked by remember(game) { mutableStateOf<Pair<String, String>?>(null) }
    // A model only counts for the game this screen shows (the engine's last answer may still be another game's).
    fun show(j: JsonObject) { if (j.size() > 0) CollectionSetsModel.parse(j).takeIf { it.game.id == game }?.let { model = it; SetsCache.models[game] = it } }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(session?.userId, revision, game) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        show(withContext(Dispatchers.Default) { CollectionEngine.sets(game, JsonObject().apply { addProperty("q", SetsCache.qs[game] ?: "") }) })
        // app.js loadSetIndex (Scryfall, or its day-old copy) / tcg.js loadSets (YGOPRODeck, TCGdex): drawn as it lands.
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
        if (query == (SetsCache.qs[game] ?: "")) return@LaunchedEffect
        delay(180); SetsCache.qs[game] = query; asked = "search" to query
    }
    LaunchedEffect(asked) {
        val (kind, value) = asked ?: return@LaunchedEffect
        if (HomeCache.loaded != null) runCatching {
            show(withContext(Dispatchers.Default) { CollectionEngine.setsDo(kind, value) })
            if (kind == "reload") CollectionEngine.settle(30_000, CollectionEngine.SETS_MODEL, ::show)
        }
        asked = null
    }
    val act = remember(game) {
        CollectionSetsActions(
            game = { g -> if (g.id == game) Unit else if (g == CardGame.MTG || tcg) onGame(g.id) else web(SITE + "#sets", siteSets(g.id)) },
            search = { q -> query = q },
            family = { v -> asked = "family" to v },
            facet = { name, v -> when (plain(name)) { "setsType" -> asked = "type" to v; "setsRelease" -> asked = "release" to v; "setsYear" -> asked = "year" to v; "setsSort" -> asked = "sort" to v } },
            press = { p -> when (plain(p.act)) {
                "setsReset" -> { query = ""; SetsCache.qs[game] = ""; asked = "reset" to "" }
                "setsReload" -> asked = "reload" to ""
                else -> if (p.act.isNotBlank()) web(SITE + "#sets", listOfNotNull(siteSets(game), "[data-act=\"${css(p.act)}\"]").joinToString("\n"))
            } },
            more = { asked = "more" to "" },
            set = { code -> onSet(game, code) },
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
                       onSet: (String) -> Unit, web: (url: String, press: String?) -> Unit, nativeCard: Boolean = false, game: String = "mtg",
                       /** Another game's tab: its set list (native) or the website's. */
                       onGame: (String) -> Unit = {},
                       /** Open Pack drawn here (Magic): the site's own draw, in the app's pack opener; otherwise the website's simulator. */
                       nativePack: Boolean = false,
                       /** Yu-Gi-Oh! and Pokémon too: their Open Pack, and their card pages. */
                       nativeTcgCards: Boolean = false) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    if (SetsCache.code != "$game|$code") { SetsCache.code = "$game|$code"; SetsCache.set = null; SetsCache.setQ = "" }
    var model by remember(code) { mutableStateOf(SetsCache.set) }
    var query by remember(code) { mutableStateOf(SetsCache.setQ) }
    var failed by remember(code) { mutableStateOf<String?>(null) }
    var asked by remember(code) { mutableStateOf<Pair<String, String>?>(null) }
    var cards by remember(code) { mutableStateOf(listOf<CardOpen>()) }
    /** The Open Pack simulator over the page (app.js A.openSetPack → pack-preview.js openPackPreview); null when closed. */
    var pack by remember(code) { mutableStateOf<PackResult?>(null) }
    var packAsk by remember(code) { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("collection", android.content.Context.MODE_PRIVATE) }
    fun show(j: JsonObject) { if (j.size() > 0) CollectionSetModel.parse(j).takeIf { it.game.id == game }?.let { model = it; SetsCache.set = it } }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(code, session?.userId, revision) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        show(withContext(Dispatchers.Default) { CollectionEngine.set(game, code) })
        // The view last chosen (the site keeps it in the account's settings; the app keeps it here) and the search as typed.
        prefs.getString("setView", null)?.let { show(CollectionEngine.setDo("view", it)) }
        if (SetsCache.setQ.isNotBlank()) show(CollectionEngine.setDo("search", SetsCache.setQ))
        // app.js loadSet / tcg.js openSet: every page of the set's cards, drawn as each lands (and the set index for its name and symbol).
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
    // The pack is on screen at once, gathering itself while the set's booster sheets load and the pack is drawn; the site's
    // "Wait for this set to finish loading." (or any failure) closes it with that message, as the site's toast says it.
    LaunchedEffect(packAsk) {
        if (packAsk == 0) return@LaunchedEffect
        try {
            var j = withContext(Dispatchers.Default) { CollectionEngine.packOpen(game) }
            CollectionEngine.settle(120_000, CollectionEngine.PACK_MODEL) { j = it }
            j = CollectionEngine.packModel()
            val error = j.get("error")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            if (error.isNotBlank() || (j.getAsJsonArray("picks")?.size() ?: 0) == 0) {
                pack = null; android.widget.Toast.makeText(context, error.ifBlank { "Could not open this preview." }, android.widget.Toast.LENGTH_SHORT).show()
            } else pack = simPack(j)
        } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
            pack = null; android.widget.Toast.makeText(context, e.message?.takeIf { it.isNotBlank() } ?: "Could not open this preview.", android.widget.Toast.LENGTH_SHORT).show()
        }
    }
    // The website's page for this set: Magic's #set/<code>; another game's set is reached from its set list (pick the game, then the set).
    val page = if (game == "mtg") SITE + "#set/" + android.net.Uri.encode(code) else SITE + "#sets"
    val lead = if (game == "mtg") emptyList() else listOf("[data-act=\"setGame\"][data-game=\"$game\"]", "[data-act=\"tSet\"][data-id=\"${css(code)}\"]")
    fun site(vararg then: String) = web(page, (lead + then).joinToString("\n").ifBlank { null })
    val act = remember(code, game) {
        CollectionSetActions(
            game = { g -> if (g.id != game) onGame(g.id) },
            back = onSets,
            search = { q -> query = q },
            filter = { v -> asked = "filter" to v },
            select = { name, v -> when (plain(name)) { "setRarity" -> asked = "rarity" to v; "setFinish" -> asked = "finish" to v; "setEdition" -> asked = "edition" to v; "setSort" -> asked = "sort" to v } },
            view = { v -> prefs.edit().putString("setView", v).apply(); asked = "view" to v },
            more = { asked = "more" to "" },
            card = { t ->
                if (game != "mtg") {
                    val tile = "[data-act=\"tCard\"][data-id=\"${css(t.id)}\"]"
                    if (nativeTcgCards) cards = cards + CardOpen(t.r.name, page = page, tile = (lead + tile).joinToString("\n"), game = game, id = t.id,
                        setId = t.open["setId"].orEmpty(), setVariant = t.open["setVariant"].orEmpty(), printing = t.open["printing"].orEmpty(), edition = t.open["edition"].orEmpty())
                    else site(tile)
                } else {
                    val tile = "[data-act=\"card\"][data-set-i=\"${t.i}\"]"
                    val finish = model?.selects?.firstOrNull { it.name == "setFinish" }?.current?.value?.takeIf { it != "all" }.orEmpty()
                    if (nativeCard) cards = cards + CardOpen(t.r.name, page = page, tile = tile, setI = t.i, setFinish = finish) else web(page, tile)
                }
            },
            pack = { if (nativePack && (game == "mtg" || nativeTcgCards)) { if (pack == null) { pack = loadingPack(code, model?.title.orEmpty(), CardGame.of(game)); packAsk++ } } else site("[data-act=\"openSetPack\"]") },
            press = { p -> when (plain(p.act)) {
                "setReload", "setRetry" -> asked = "reload" to ""
                "setDetails" -> asked = "details" to ""
                else -> if (p.act.isNotBlank()) site("[data-act=\"${css(p.act)}\"]")
            } },
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
        pack?.let { first ->
            androidx.compose.runtime.key(packAsk) {
                PackOpening(first, onNext = { withContext(Dispatchers.Default) { simPack(CollectionEngine.packAgain()) }.takeIf { it.pulls.isNotEmpty() } },
                    onClose = { pack = null; scope.launch { runCatching { CollectionEngine.packClose() } } },
                    // pack-preview.js onDetails: a pulled card opens its card page in the printing and finish that came out of the pack,
                    // as the set page's own tile would when it is one of this set's cards.
                    onInspect = { i, p -> val sim = p.sim ?: return@PackOpening
                        if (game != "mtg") {
                            // pack-preview.js onDetails → A.tCard with the pull's own dataset (its set, the finish it came out in, Yu-Gi-Oh!'s printing).
                            val o = sim.open ?: return@PackOpening
                            fun v(k: String) = o.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                            if (nativeTcgCards && v("id").isNotBlank()) cards = cards + CardOpen(p.name, page = page,
                                tile = (lead + "[data-act=\"tCard\"][data-id=\"${css(v("id"))}\"]").joinToString("\n"), game = game, id = v("id"),
                                setId = v("setId"), setVariant = v("setVariant"), printing = v("printing"), edition = v("edition"))
                            return@PackOpening
                        }
                        cards = cards + if (sim.setI >= 0) CardOpen(p.name, page = page, tile = "[data-act=\"card\"][data-set-i=\"${sim.setI}\"]", setI = sim.setI, setFinish = sim.finish)
                            else CardOpen(p.name, page = page, tile = "", setFinish = sim.finish, pack = i) })
            }
        }
        cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
            CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web,
                onSet = { s -> if (s == code) cards = emptyList() else onSet(s) })
        } }
    }
}
