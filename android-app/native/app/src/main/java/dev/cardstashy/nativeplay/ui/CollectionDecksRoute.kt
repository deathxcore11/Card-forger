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
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
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
    /** Each game's page as last drawn, by the tab it was drawn with ("mtg|ideas"). */
    val models = HashMap<String, CollectionDecksModel>()
    var q = ""
    /** The tab open (S.ui.decksTab): My decks or Ideas here. A game switch keeps it (app.js gameSwitchRoute keeps the route's tab). */
    var tab = "mine"
    /** icons.js's leading glyphs, read once. */
    var glyphs: Map<String, SiteSvg>? = null
}

/**
 * Collection's Decks tab (My decks): the account's decks through the site's own views.js decks() / deckTile, drawn natively.
 * Search asks the site's code again; Magic's Random Commander and Random deck open Build a deck here (CollectionBuildDeckSheet),
 * its Import and New their sheets (DeckImportSheet, NewDeckSheet).
 * Ideas is drawn here from the site's markup and listeners (CollectionEngine.decksPanel, DecksTabBody): Magic's Analyze, Owned commanders
 * only, the strategy filter, Show more and the idea cards, whose deck idea sheet is native (IdeaSheet); Yu-Gi-Oh! and Pokémon's
 * archetype cards open their card pages here, and Import my collection its sheet. Meta decks, War Chest, the other games' head buttons
 * and Ideas' builders (⚒ Use my whole collection, ☑ Pick cards, ⚒ Build, a tournament deck) open the website's page, which does them there.
 */
@Composable
fun CollectionDecksRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, web: (url: String, press: String?) -> Unit,
                         onDeck: ((id: String, game: CardGame) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    // The game the header's tabs chose (tcg.js A.setGame): Home, Cards and Decks follow it.
    remember { CollectionGame.init(context) }
    val game by CollectionGame.current.collectAsState()
    var tab by remember { mutableStateOf(DecksCache.tab) }
    // The pages drawn here, by game and tab: one state for the route's life, so a paint started before a tab or game switch (the
    // refresh's repaint) lands under its own key, never in a state the screen no longer reads.
    val painted = remember { androidx.compose.runtime.mutableStateMapOf<String, CollectionDecksModel>() }
    val model = painted[game.id + "|" + tab] ?: DecksCache.models[game.id + "|" + tab]
    var query by remember { mutableStateOf(DecksCache.q) }
    var failed by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    suspend fun paint() {
        val t = tab
        val o = JsonObject().apply { addProperty("q", DecksCache.q); addProperty("tab", t) }
        val g = game
        val m = withContext(Dispatchers.Default) { CollectionDecksModel.parse(CollectionEngine.decks(g.id, o)) }
        painted[g.id + "|" + t] = m; DecksCache.models[g.id + "|" + t] = m
    }
    // The account's copy, then the names the catalog lacks (art and power fill in as they arrive).
    /** The collection is in the engine and the page drawn once: the open tab's body can be asked for. */
    var ready by remember { mutableStateOf(false) }
    LaunchedEffect(session?.userId, revision, game) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) return@LaunchedEffect
        paint(); ready = true
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            try { CollectionEngine.refresh(game.id) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        paint()
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (painted[game.id + "|" + tab] == null && DecksCache.models[game.id + "|" + tab] == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "Your decks couldn’t be opened here."
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
    /** A.decksTab: My decks and Ideas here; Meta decks on the website (its tab, the game chosen first). */
    fun openTab(k: String) {
        if (k == "mine" || k == "ideas") { tab = k; DecksCache.tab = k }
        else page(site + "#decks/" + android.net.Uri.encode(k), null)
    }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val searchTab = LocalCollectionSearch.current
    /** The open tab's body as the site's listeners leave it (CollectionEngine.decksPanel). */
    var panel by remember(game, tab) { mutableStateOf<SitePanelModel?>(null) }
    var glyphs by remember { mutableStateOf(DecksCache.glyphs ?: emptyMap()) }
    /** The deck idea sheet open over the page (app.js openIdea), by the idea's place in the list. */
    var idea by remember { mutableStateOf<Int?>(null) }
    /** The card pages open over the page, the last on top. */
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    fun magicCard(name: String, back: String = "") {
        cards = cards + CardOpen(name, page = site + "#decks/ideas", tile = "[data-act=\"card\"][data-name=\"${css(name)}\"]", back = back)
    }
    /**
     * What the panel's buttons leave to app.js (panel.acted): the idea sheet, the importer and the example collection, the Search tab and the
     * archetype's card are here; Meta decks and the builders open the website's Ideas (the game chosen first) and press the same button.
     */
    fun take(m: SitePanelModel) {
        panel = m
        m.toasts.lastOrNull()?.let { CollectionWrites.show(it) }
        val a = m.acted ?: return
        val act = a.get("act")?.takeIf { it.isJsonPrimitive }?.asString ?: return
        val got = { k: String -> a.getAsJsonObject("data")?.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty() }
        val g = CollectionGame.current.value
        when {
            act == "openIdea" && got("i").toIntOrNull() != null -> { idea = got("i").toInt(); return }
            // app.js A.importCollection / tcg.js A.tImportColl: the paste sheet; its import opens Collection's Cards (go("#collection/cards")).
            act == "importCollection" -> { CollectionWrites.importing.value = CollectionWrites.ImportOpen("mtg", one = { CollectionWrites.openAdd(JsonObject()) }, imported = onCards); return }
            act == "tImportColl" -> { CollectionWrites.importing.value = CollectionWrites.ImportOpen(g.id, imported = onCards); return }
            // app.js A.loadExample: asked first, then the example collection, and Collection opens.
            act == "loadExample" -> { scope.launch { CollectionWrites.act(context, "loadExample", JsonObject()) { r ->
                if (r["made"]?.takeIf { it.isJsonPrimitive }?.asString?.contains("collection") == true) onCards() } }; return }
            act == "decksTab" -> { openTab(got("id")); return }
            act == "go" && got("to") == "#search" -> { searchTab?.invoke() ?: web(site + "#search", null); return }
            act == "go" && got("to").startsWith("#decks/") -> { openTab(got("to").removePrefix("#decks/")); return }
            // tcg.js A.tCard: the archetype's cover card, its page here.
            act == "tCard" && got("id").isNotEmpty() && g != CardGame.MTG -> {
                cards = cards + CardOpen("", page = site + "#decks/ideas", tile = "[data-act=\"tCard\"][data-id=\"${css(got("id"))}\"]", game = g.id, id = got("id")); return }
        }
        val data = a.getAsJsonObject("data")?.entrySet().orEmpty()
            .filter { (k, v) -> k != "act" && v.isJsonPrimitive && v.asString.length < 400 && !v.asString.startsWith("{") && !v.asString.startsWith("[") }
        val sel = "[data-act=\"${css(act)}\"]" + data.joinToString("") { (k, v) -> "[data-" + k.replace(Regex("[A-Z]")) { "-" + it.value.lowercase() } + "=\"${css(v.asString)}\"]" }
        page(site + "#decks/" + android.net.Uri.encode(tab), sel)
    }
    /** A tap or a change in the panel: the site's listeners, then what they start (Analyze, the meta) as it lands; its saves kept. */
    fun panelDo(call: suspend () -> JsonObject) = scope.launch {
        if (HomeCache.loaded == null) return@launch
        runCatching {
            take(SitePanelModel.parse(call()))
            CollectionEngine.settle(120_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) }
            CollectionWrites.keepBackground(context)
        }
    }
    // The tab's body when it opens (and for another game): the site's markup with its route's loads started (app.js route()).
    LaunchedEffect(tab, game, ready) {
        if (!ready || HomeCache.loaded == null) return@LaunchedEffect
        runCatching { paint() }
        if (tab == "mine") { panel = null; return@LaunchedEffect }
        if (DecksCache.glyphs == null) runCatching { glyphMap(CollectionEngine.glyphs()) }.getOrNull()?.let { DecksCache.glyphs = it; glyphs = it }
        panelDo { CollectionEngine.decksPanel(game.id, tab) }
    }
    // A save (an idea saved, an import, an Undo): the tab again from the account as it is now, as app.js render() draws it.
    val written by CollectionWrites.written.collectAsState()
    var seenWrite by remember { mutableStateOf(written) }
    LaunchedEffect(written) { if (written != seenWrite) { seenWrite = written; if (tab != "mine" && panel != null) panelDo { CollectionEngine.panelRedraw() } } }
    val screenW = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
    // Keyed as `panel` is: its taps write the panel state this composition shows.
    val siteUi = remember(screenW, game, tab) {
        SiteUi(tap = { id -> panelDo { CollectionEngine.panelTap(id) } }, type = { id, v -> panelDo { CollectionEngine.panelType(id, v) } },
            open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
            screen = screenW)
    }
    fun button(a: String) {
                // app.js A.randomDeck / A.randomDeckOptions: Magic's Build a deck runs here (Commander locked for Random Commander); the
                // other games' (and anything else) open the website.
                // app.js A.newDeck / A.importDeck on Magic's Decks: the sheets here; the new or imported deck's page opens on the site's tab.
                val mtg = CollectionGame.current.value == CardGame.MTG
                val open = { id: String, tab: String -> deckOpensOn("mtg", id, tab); onDeck?.invoke(id, CardGame.MTG) ?: page(site + "#deck/" + android.net.Uri.encode(id), null) }
                if (mtg && a == "newDeck") CollectionWrites.newDeck.value = CollectionWrites.NewDeckOpen(openDeck = open)
                else if (mtg && a == "importDeck") CollectionWrites.deckImport.value = CollectionWrites.DeckImportOpen(openDeck = open, web = { u -> page(u, null) })
                else if (a in listOf("randomDeck", "randomDeckOptions") && mtg)
                    CollectionWrites.building.value = CollectionWrites.BuildOpen(JsonObject().apply {
                        addProperty("game", "mtg"); if (a == "randomDeck") { addProperty("format", "Commander"); addProperty("commanderLock", true) } }, a, web)
                else if (a.isNotBlank()) page(decks, "[data-act=\"${css(a)}\"]")
    }
    val act = remember {
        CollectionDecksActions(
            game = { g -> CollectionGame.set(g) },
            button = { a -> button(a) },
            tab = { k -> openTab(k) },
            search = { q -> query = q },
            deck = { d ->
                // A Magic deck (#deck/<id>) or a Yu-Gi-Oh! / Pokémon deck (#tdeck/<id>, the open game's): its page here.
                val hit = Regex("^#(t?)deck/([^/]+)").find(d.to)?.groupValues
                val id = hit?.get(2)?.let(android.net.Uri::decode)
                val g = if (hit?.get(1) == "t") CollectionGame.current.value else CardGame.MTG
                if (onDeck != null && id != null) onDeck(id, g) else page(site + d.to.ifBlank { "#decks" }, null)
            },
            press = { b ->
                // A button and what it carries: decksTab opens its tab (data-id); Yu-Gi-Oh! / Pokémon's head buttons with a data-format or
                // data-home (tNewDeck, Random deck) press the same on the website.
                val mtg = CollectionGame.current.value == CardGame.MTG
                when {
                    b.act == "decksTab" && b.id.isNotBlank() -> openTab(b.id)
                    mtg && b.act in setOf("newDeck", "importDeck", "randomDeck", "randomDeckOptions") -> button(b.act)
                    b.act.isNotBlank() -> page(site + "#decks/" + android.net.Uri.encode(DecksCache.tab), "[data-act=\"${css(b.act)}\"]" +
                        listOf("id" to b.id, "format" to b.format, "deck" to b.deck, "home" to b.home, "to" to b.to).filter { it.second.isNotBlank() }
                            .joinToString("") { (k, v) -> "[data-$k=\"${css(v)}\"]" })
                }
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
                CollectionTab.SEARCH -> searchTab?.invoke() ?: web(site + "#search", null)
                CollectionTab.DECKS -> {}
                CollectionTab.SCAN -> web(site + "#scan", null)
            }
        }
    }
    val m = model
    GameAccent(game.id) { Box(Modifier.fillMaxSize()) {
    // The page is recorded as it draws, so the idea sheet's glass can blur what is under it.
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    if (m != null) Box(Modifier.fillMaxSize().drawWithContent { pageLayer.record { this@drawWithContent.drawContent() }; drawLayer(pageLayer) }) {
        CollectionDecks(m, top, act, nav, query, body = if (m.tab == "ideas") ({ gutter, screen -> DecksTabBody(panel, siteUi, glyphs, gutter, screen) }) else null) }
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your account…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Your decks will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center)
        }
        nav(false)
    }
    idea?.let { i -> androidx.compose.runtime.key(i) {
        IdeaSheet(i, pageLayer, IdeaSheetActions(close = { idea = null },
            // A.card from the sheet: its page, with "Back to deck idea" (S.ui.sheetBack).
            card = { n -> idea = null; magicCard(n, back = "idea:$i") },
            deck = { id -> idea = null; onDeck?.invoke(id, CardGame.MTG) ?: page(site + "#deck/" + android.net.Uri.encode(id), null) }))
    } }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
        CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web,
            onBack = c.back.removePrefix("idea:").toIntOrNull()?.let { i -> { cards = cards.dropLast(1); idea = i } })
    } }
    } }
}
