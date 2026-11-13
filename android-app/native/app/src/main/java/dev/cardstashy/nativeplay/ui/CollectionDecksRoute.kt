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
    /** Each account's pages as last drawn, by game and the tab drawn with ("<user>|mtg|ideas"). */
    val models = java.util.concurrent.ConcurrentHashMap<String, CollectionDecksModel>()
    /** The engine's text of each, as drawn: the next paint is compared with it. */
    val raw = java.util.concurrent.ConcurrentHashMap<String, String>()
    var q = ""
    /** The tab open (S.ui.decksTab): My decks or Ideas here. A game switch keeps it (app.js gameSwitchRoute keeps the route's tab). */
    var tab = "mine"
    /** icons.js's leading glyphs, read once. */
    var glyphs: Map<String, SiteSvg>? = null
    /** A link to a tab drawn here ([decksOpenOn]) while the Decks page may already be open: (count, tab), which the open page follows. */
    val asked = kotlinx.coroutines.flow.MutableStateFlow(0 to "")
}

/**
 * A website link that names a Decks tab drawn here (#decks/ideas, #decks/inspiration: Settings' Explore deck ideas, Home's All meta
 * decks, a deck import that saved an idea), with no press but the game's own (A.setGame): that tab, the game chosen; null otherwise.
 * The Decks page then opens on it ([decksOpenOn]).
 */
fun nativeDecksTab(url: String, press: String?): String? {
    val tab = Regex("^https://cardstashy\\.com/#decks/(ideas|inspiration)$").find(url)?.groupValues?.get(1) ?: return null
    if (press.isNullOrBlank()) return tab
    val g = Regex("^\\[data-act=\"setGame\"]\\[data-game=\"(\\w+)\"]$").find(press.trim())?.groupValues?.get(1) ?: return null
    CollectionGame.set(CardGame.of(g)); return tab
}

internal fun decksCacheClear() { DecksCache.models.clear(); DecksCache.raw.clear() }
/** My decks drawn by the launch warm-up (no search typed): shown at once on the first open, and kept for the next launch. */
internal suspend fun warmDecks(user: String, game: String) {
    val k = "$user|$game|mine"
    if (DecksCache.q.isNotBlank() || DecksCache.models[k] != null) return
    val raw = CollectionEngine.decksRaw(game, JsonObject().apply { addProperty("q", ""); addProperty("tab", "mine") })
    val m = withContext(Dispatchers.Default) { CollectionDecksModel.parse(com.google.gson.JsonParser.parseString(raw).asJsonObject) }
    if (DecksCache.models.putIfAbsent(k, m) == null) { DecksCache.raw[k] = raw; withContext(Dispatchers.IO) { LastSeen.write(user, LastSeen.decksName(game, "mine"), raw) } }
}

/** The Decks page opens next on [tab] (S.ui.decksTab: "mine", "ideas" or "inspiration"). */
fun decksOpenOn(tab: String) { DecksCache.tab = tab; DecksCache.asked.value = DecksCache.asked.value.first + 1 to tab }

/**
 * Collection's Decks tab (My decks): the account's decks through the site's own views.js decks() / deckTile, drawn natively.
 * Search asks the site's code again; Magic's Random Commander and Random deck open Build a deck here (CollectionBuildDeckSheet),
 * its Import and New their sheets (DeckImportSheet, NewDeckSheet).
 * Ideas is drawn here from the site's markup and listeners (CollectionEngine.decksPanel, DecksTabBody): Magic's Analyze, Owned commanders
 * only, the strategy filter, Show more and the idea cards, whose deck idea sheet is native (IdeaSheet); Yu-Gi-Oh! and Pokémon's
 * archetype cards open their card pages here, and Import my collection its sheet. Meta decks (#decks/inspiration) is drawn here the same
 * way (MetaTabBody): Magic's format chips, reload, the archetypes, the tournament lists, Find a precon and Saved decks; Yu-Gi-Oh! and
 * Pokémon's format, Refresh and the decks with % owned. A tournament deck (mtgProven / tMetaDeck, here and in Ideas) opens its sheet
 * here (MetaDeckHost), and its cards their pages over it. War Chest, the other games' head buttons, Create a deck (tNewDeck), Ideas'
 * builders (⚒ Use my whole collection, ☑ Pick cards, ⚒ Build), the precon list and preview, and Saved decks' Save / Export / Remove
 * open the website's page, which does them there.
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
    remember { LastSeen.init(context) }
    val pageKey = "${session?.userId}|${game.id}|$tab"
    val model = painted[pageKey] ?: DecksCache.models[pageKey]
    var query by remember { mutableStateOf(DecksCache.q) }
    var failed by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableStateOf(0) }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    // Nothing drawn yet this run: the page as the last launch drew it (this account, game and tab), until the engine's paint lands.
    LaunchedEffect(pageKey) {
        if (model != null || DecksCache.q.isNotBlank()) return@LaunchedEffect
        val u = session?.userId; val g = game.id; val t = tab
        val j = withContext(Dispatchers.IO) { LastSeen.read(u, LastSeen.decksName(g, t)) } ?: return@LaunchedEffect
        val m = withContext(Dispatchers.Default) { runCatching { CollectionDecksModel.parse(j) }.getOrNull() } ?: return@LaunchedEffect
        if (painted[pageKey] == null && DecksCache.models[pageKey] == null) painted[pageKey] = m
    }
    /** What the last paint drew ("<user>|<game>|<tab>|<query>|<revision>"): the tab's own effect doesn't draw it again. */
    val lastPaint = remember { arrayOf("") }
    val writers = remember { HashMap<String, LastSeenWriter>() }
    suspend fun paint(final: Boolean = false) {
        val t = tab; val g = game; val u = session?.userId; val q = DecksCache.q
        val k = "$u|${g.id}|$t"
        val o = JsonObject().apply { addProperty("q", q); addProperty("tab", t) }
        val raw = CollectionEngine.decksRaw(g.id, o)
        lastPaint[0] = "$k|$q|${Decks.fullRevision.value}"
        val keep = if (q.isBlank()) writers.getOrPut(k) { LastSeenWriter(u, LastSeen.decksName(g.id, t)) } else null
        if (raw == DecksCache.raw[k] && painted[k] != null) { if (final) keep?.keep(raw, true); return }
        val m = withContext(Dispatchers.Default) { CollectionDecksModel.parse(com.google.gson.JsonParser.parseString(raw).asJsonObject) }
        painted[k] = m; DecksCache.models[k] = m; DecksCache.raw[k] = raw
        keep?.keep(raw, final)
    }
    // The account's copy, then the names the catalog lacks (art and power fill in as they arrive).
    /** The collection is in the engine and the page drawn once: the open tab's body can be asked for. */
    var ready by remember { mutableStateOf(false) }
    LaunchedEffect(session?.userId, revision, game, retry) { try {
        if (!ensureCollection(context, session?.userId, session != null, revision)) {
            // Signed in, and this device has never had the account's copy: read it now, and say so if it can't be (never an endless wait).
            if (model == null) try { Decks.load(context, rethrow = true)
                if (withContext(Dispatchers.IO) { Decks.fullCopy(context) } == null) failed = "Your decks couldn’t be read from your account. Tap to try again."
            } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) { failed = "Your decks couldn’t be read from your account. Check your connection, then tap to try again." }
            return@LaunchedEffect
        }
        failed = null
        paint(); ready = true
        coroutineScope {
            val repaint = launch { while (true) { delay(1200); paint() } }
            // After the last paint, so the Power it worked out is kept for the next launch too.
            try { CollectionEngine.refresh(game.id); repaint.cancel(); paint(final = true) } finally { repaint.cancel(); withContext(kotlinx.coroutines.NonCancellable) { keepCatalog(context) } }
        }
        failed = null
    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
        HomeCache.loaded = null
        if (painted[pageKey] == null && DecksCache.models[pageKey] == null) failed = e.message?.takeIf { it.isNotBlank() } ?: "Your decks couldn’t be opened here."
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
    /** A.decksTab: My decks, Ideas and Meta decks (#decks/inspiration) here; anything else on the website (its tab, the game chosen first). */
    fun openTab(k: String) {
        if (k == "mine" || k == "ideas" || k == "inspiration") { tab = k; DecksCache.tab = k }
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
        cards = cards + CardOpen(name, page = site + "#decks/" + android.net.Uri.encode(tab), tile = "[data-act=\"card\"][data-name=\"${css(name)}\"]", back = back)
    }
    /** The tournament deck's sheet (tcg.js openProven: Meta decks' rows and tiles, Ideas' Tournament decks you're closest to) open over the page. */
    var proven by remember { mutableStateOf(false) }
    /** tcg.js A.tPickSeeds' sheet, open for that game. */
    var seedPick by remember { mutableStateOf<String?>(null) }
    // A link to #decks/<tab> while this page is open (MainActivity's go() keeps the screen): app.js A.go closes the sheets, then the tab.
    val asked by DecksCache.asked.collectAsState()
    var seenAsk by remember { mutableStateOf(asked.first) }
    LaunchedEffect(asked) { if (asked.first != seenAsk) { seenAsk = asked.first; cards = emptyList(); idea = null
        if (proven) { proven = false; runCatching { CollectionEngine.provenClose() } }
        if (tab != asked.second) openTab(asked.second) } }
    /** A Magic deck the sheets saved: its page here on the site's tab (go(`#deck/<id>/<tab>`)). */
    val mtgDeckOpen = { id: String, t: String -> deckOpensOn("mtg", id, t); onDeck?.invoke(id, CardGame.MTG) ?: page(site + "#deck/" + android.net.Uri.encode(id), null) }
    /** A Yu-Gi-Oh! / Pokémon deck the sheets saved: its page here (go("#tdeck/<id>")). */
    fun tcgDeckOpen(g: CardGame): (String) -> Unit = { id -> onDeck?.invoke(id, g) ?: page(site + "#tdeck/" + android.net.Uri.encode(id), null) }
    /** The War Chest window (app.js A.warChest: war-chest.js openWarChest) over the page, as its panel draws it. */
    var chest by remember { mutableStateOf<SitePanelModel?>(null) }
    /** take (below): the tab's panel as it comes back from under the window, with what it left to the app meanwhile (a precon's Preview). */
    var takeBack: (SitePanelModel) -> Unit = { panel = it }
    fun chestClose() {
        chest = null
        scope.launch { if (HomeCache.loaded == null) return@launch
            runCatching { val back = CollectionEngine.warChestClose(); if (tab != "mine" && back.has("key")) takeBack(SitePanelModel.parse(back)) } }
    }
    /** The window's model; a tool it leaves to app.js chestTool closes the window first (openWarChest's click listener) and runs there. */
    fun chestTake(m: SitePanelModel) {
        chest = m
        m.toasts.lastOrNull()?.let { CollectionWrites.show(it) }
        val tool = m.acted?.getAsJsonObject("data")?.get("tool")?.takeIf { it.isJsonPrimitive }?.asString ?: return
        chestClose()
        // Card lookup: go("#search"), the Search tab here. Game Night, Share table and Table Spirit: the website's War Chest, the same tool.
        if (tool == "lookup") searchTab?.invoke() ?: web(site + "#search", null)
        // Ask the Judge (app.js chestTool: A.askRules with the game): the app's own chat.
        else if (tool == "judge") CollectionWrites.judge(null, CollectionGame.current.value.id)
        // The website's Decks has no War Chest button while it has no decks of its own (not signed in there): the table tools then
        // open from its Rules page's Tabletop button (A.tabletop), the same Game Night.
        else page(decks, "[data-act=\"warChest\"]\n.war-chest-dialog [data-tool=\"${css(tool)}\"]" +
            (if (tool in setOf("gameNight", "share", "spirit")) "\n||\n#rules\n[data-act=\"tabletop\"]" else ""))
    }
    fun chestOpen() = scope.launch {
        if (HomeCache.loaded == null) { page(decks, "[data-act=\"warChest\"]"); return@launch }
        runCatching { chestTake(SitePanelModel.parse(CollectionEngine.warChest(CollectionGame.current.value.id))) }
    }
    // A.dImpSave with the library destination: closeSheet(); go("#decks/inspiration"), the Meta tab, which is drawn here.
    val inspirationHere: (String) -> Unit = { u -> if (u.endsWith("#decks/inspiration")) openTab("inspiration") else page(u, null) }
    /**
     * What the panel's buttons leave to app.js (panel.acted): the idea sheet, the importer and the example collection, the Search tab and the
     * archetype's card are here; Meta decks and the builders open the website's Ideas (the game chosen first) and press the same button.
     */
    fun take(m: SitePanelModel) {
        // A card page's rule glass (CollectionEngine.ruleGlass) has the panel while it is open; it isn't this page's.
        if (m.key.startsWith("rulehint|")) return
        // The War Chest window's panel (app.js A.warChest) reads back while it is open: it is the window's, not the tab's.
        if (m.key.startsWith("chest|")) { chestTake(m); return }
        panel = m
        m.toasts.lastOrNull()?.let { CollectionWrites.show(it) }
        val a = m.acted ?: return
        val act = a.get("act")?.takeIf { it.isJsonPrimitive }?.asString ?: return
        val got = { k: String -> a.getAsJsonObject("data")?.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty() }
        val g = CollectionGame.current.value
        when {
            act == "openIdea" && got("i").toIntOrNull() != null -> { idea = got("i").toInt(); return }
            // app.js A.mtgProven / tcg.js A.tMetaDeck: the deck's sheet, drawn here (MetaDeckHost).
            act == "proven" -> { proven = true; return }
            // A deck the Meta tab saved (app.js makeMyVersion, a precon's Save, Build this deck): its page here.
            // The new deck is kept (this device's copy and the account) before its page opens: leaving this page ends panelDo's scope.
            act == "go" && got("to").startsWith("#deck/") -> { val id = android.net.Uri.decode(got("to").removePrefix("#deck/").substringBefore('/'))
                val to = got("to")
                CollectionWrites.keepThen(context) { deckOpensOn("mtg", id, to.removePrefix("#deck/").substringAfter('/', "cards")); onDeck?.invoke(id, CardGame.MTG) ?: page(site + to, null) }
                return }
            act == "card" && got("name").isNotEmpty() && g == CardGame.MTG -> { magicCard(got("name")); return }
            // app.js A.importCollection / tcg.js A.tImportColl: the paste sheet; its import opens Collection's Cards (go("#collection/cards")).
            act == "importCollection" -> { CollectionWrites.importing.value = CollectionWrites.ImportOpen("mtg", one = { CollectionWrites.openAdd(JsonObject()) }, imported = onCards); return }
            act == "tImportColl" -> { CollectionWrites.importing.value = CollectionWrites.ImportOpen(g.id, imported = onCards); return }
            // app.js A.loadExample: asked first, then the example collection, and Collection opens.
            act == "loadExample" -> { scope.launch { CollectionWrites.act(context, "loadExample", JsonObject()) { r ->
                if (r["made"]?.takeIf { it.isJsonPrimitive }?.asString?.contains("collection") == true) onCards() } }; return }
            act == "decksTab" -> { openTab(got("id")); return }
            // tcg.js openBuild / A.tBuild (⚒ Use my whole collection, an archetype's ⚒ Build): app.js openDeckFlow, Build a deck here on its cards.
            act == "openDeckFlow" -> { val r = runCatching { com.google.gson.JsonParser.parseString(got("request")).asJsonObject }.getOrNull() ?: return
                CollectionWrites.building.value = CollectionWrites.BuildOpen(r, "openDeckFlow", web); return }
            // tcg.js A.tPickSeeds: its sheet here (SeedPickSheet), whose ⚒ Build runs A.tSeedGo.
            act == "tPickSeeds" && g != CardGame.MTG -> { seedPick = g.id; return }
            // tcg.js metaView's Create a <format> deck (A.tNewDeck with data-format): the New deck sheet here.
            act == "tNewDeck" && g != CardGame.MTG -> { CollectionWrites.tNewDeck.value = CollectionWrites.TcgDeckOpen(g.id, got("format"), openDeck = tcgDeckOpen(g)); return }
            // app.js A.importReference: Import a deck as "Save a deck idea" (deckImportSheet, the library destination).
            act == "importReference" && g == CardGame.MTG -> { CollectionWrites.deckImport.value = CollectionWrites.DeckImportOpen(
                JsonObject().apply { addProperty("destination", "library"); addProperty("kind", "Community deck") }, openDeck = mtgDeckOpen, web = inspirationHere); return }
            // app.js A.previewPrecon: the precon's list in that sheet (the library destination, credited), previewed as it opens.
            act == "previewPrecon" -> { val preset = runCatching { com.google.gson.JsonParser.parseString(got("preset")).asJsonObject }.getOrNull() ?: return
                CollectionWrites.deckImport.value = CollectionWrites.DeckImportOpen(preset, openDeck = mtgDeckOpen, web = inspirationHere, preview = true); return }
            // app.js A.exportRef (the file, saved to Downloads) and A.deleteRef (asked first): the site's own handlers (CollectionWrites).
            act in setOf("exportRef", "deleteRef") && g == CardGame.MTG -> { scope.launch { CollectionWrites.act(context, act, JsonObject().apply { addProperty("id", got("id")) }) }; return }
            act == "go" && got("to") == "#search" -> { searchTab?.invoke() ?: web(site + "#search", null); return }
            act == "go" && got("to").startsWith("#decks/") -> { openTab(got("to").removePrefix("#decks/")); return }
            // tcg.js A.tCard: the archetype's cover card, its page here.
            act == "tCard" && got("id").isNotEmpty() && g != CardGame.MTG -> {
                cards = cards + CardOpen("", page = site + "#decks/" + android.net.Uri.encode(tab), tile = "[data-act=\"tCard\"][data-id=\"${css(got("id"))}\"]", game = g.id, id = got("id")); return }
        }
        val data = a.getAsJsonObject("data")?.entrySet().orEmpty()
            .filter { (k, v) -> k != "act" && v.isJsonPrimitive && v.asString.length < 400 && !v.asString.startsWith("{") && !v.asString.startsWith("[") }
        val sel = "[data-act=\"${css(act)}\"]" + data.joinToString("") { (k, v) -> "[data-" + k.replace(Regex("[A-Z]")) { "-" + it.value.lowercase() } + "=\"${css(v.asString)}\"]" }
        page(site + "#decks/" + android.net.Uri.encode(tab), sel)
    }
    takeBack = ::take
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
        if (lastPaint[0] != "${session?.userId}|${game.id}|$tab|${DecksCache.q}|${Decks.fullRevision.value}") runCatching { paint() }
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
    val chestUi = remember(screenW) {
        SiteUi(tap = { id -> scope.launch { runCatching { chestTake(SitePanelModel.parse(CollectionEngine.panelTap(id))) } } }, type = { _, _ -> }, open = { }, screen = screenW)
    }
    fun button(a: String, format: String = "") {
                // app.js A.randomDeck / A.randomDeckOptions: Magic's Build a deck runs here (Commander locked for Random Commander); the
                // other games' (and anything else) open the website.
                // app.js A.newDeck / A.importDeck on Magic's Decks: the sheets here; the new or imported deck's page opens on the site's tab.
                val mtg = CollectionGame.current.value == CardGame.MTG
                val open = { id: String, tab: String -> deckOpensOn("mtg", id, tab); onDeck?.invoke(id, CardGame.MTG) ?: page(site + "#deck/" + android.net.Uri.encode(id), null) }
                if (mtg && a == "newDeck") CollectionWrites.newDeck.value = CollectionWrites.NewDeckOpen(openDeck = open)
                else if (mtg && a == "importDeck") CollectionWrites.deckImport.value = CollectionWrites.DeckImportOpen(openDeck = open, web = inspirationHere)
                // tcg.js A.tImport / A.tNewDeck on Yu-Gi-Oh! and Pokémon's Decks: their sheets here; the saved deck's page opens.
                else if (!mtg && a == "tImport") CollectionWrites.tDeckImport.value = CollectionWrites.TcgDeckOpen(CollectionGame.current.value.id, openDeck = tcgDeckOpen(CollectionGame.current.value))
                else if (!mtg && a == "tNewDeck") CollectionWrites.tNewDeck.value = CollectionWrites.TcgDeckOpen(CollectionGame.current.value.id, format, openDeck = tcgDeckOpen(CollectionGame.current.value))
                // app.js A.warChest (every game): its window here.
                else if (a == "warChest") chestOpen()
                else if (a in listOf("randomDeck", "randomDeckOptions") && mtg)
                    CollectionWrites.building.value = CollectionWrites.BuildOpen(JsonObject().apply {
                        addProperty("game", "mtg"); if (a == "randomDeck") { addProperty("format", "Commander"); addProperty("commanderLock", true) } }, a, web)
                // app.js A.randomDeckOptions on Yu-Gi-Oh! and Pokémon: deckExperience.open({game}) then A.flowRandom, built in the engine.
                else if (a == "randomDeckOptions" && !mtg)
                    CollectionWrites.building.value = CollectionWrites.BuildOpen(JsonObject().apply { addProperty("game", CollectionGame.current.value.id) }, a, web)
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
            // app.js tileMenu: a held deck tile opens that deck's menu (A.deckMenu / A.tDeckMenu), the same DeckMenuSheet its page opens.
            menu = if (onDeck == null) null else { d ->
                val hit = Regex("^#(t?)deck/([^/]+)").find(d.to)?.groupValues
                val id = hit?.get(2)?.let(android.net.Uri::decode)
                if (id != null) {
                    val tcg = hit[1] == "t"; val g = if (tcg) CollectionGame.current.value else CardGame.MTG
                    val url = site + d.to
                    CollectionWrites.menu.value = CollectionWrites.DeckMenuOpen(id,
                        tab = { k -> deckOpensOn(g.id, id, k); onDeck(id, g) },
                        web = { x, sc -> page(url, "[data-act=\"" + (if (tcg) "tDeckMenu" else "deckMenu") + "\"]\n[data-act=\"" + x.replace("\"", "") + "\"]" + (if (sc.isNotEmpty()) "[data-scope=\"" + sc.replace("\"", "") + "\"]" else "")) },
                        // A delete from the tile menu: the list is painted again at once, so the tile goes without waiting for the next sync.
                        openDeck = { other -> onDeck(other, g) }, deleted = { retry++ }, game = g.id,
                        share = { CollectionWrites.share.value = CollectionWrites.ShareOpen(id, g.id, preview = { l -> page(l, null) }) },
                        site = { u -> page(u, null) })
                }
            },
            press = { b ->
                // A button and what it carries: decksTab opens its tab (data-id); Yu-Gi-Oh! / Pokémon's head buttons with a data-format or
                // data-home (tNewDeck, Random deck) press the same on the website.
                val mtg = CollectionGame.current.value == CardGame.MTG
                when {
                    b.act == "decksTab" && b.id.isNotBlank() -> openTab(b.id)
                    mtg && b.act in setOf("newDeck", "importDeck", "randomDeck", "randomDeckOptions") -> button(b.act)
                    !mtg && b.act == "randomDeckOptions" -> button(b.act)
                    b.act in setOf("warChest") || (!mtg && b.act in setOf("tImport", "tNewDeck")) -> button(b.act, b.format)
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
        // Controller (PadPrompts): LB/RB step through My decks, Ideas and Meta decks (the tabs drawn here; openTab sends the rest to the
        // website), X is the head's gold button (Import / New deck, as the page has it).
        val here = setOf("mine", "ideas", "inspiration")
        val main = m.actions.firstOrNull { !it.ghost && it.label.isNotBlank() }
        PadScreen(PadActs(x = main?.let { b -> PadAct(b.label) { act.press(b) } },
            tabs = if (m.tabs.size > 1) ({ d -> padTab(m.tabs.map { it.key }, m.tab, d) { it in here }?.let { openTab(it) } }) else null))
        CollectionDecks(m, top, act, nav, query, body = when (m.tab) {
            "ideas" -> ({ gutter, screen -> DecksTabBody(panel, siteUi, glyphs, gutter, screen) })
            "inspiration" -> ({ gutter, screen -> MetaTabBody(panel, siteUi, glyphs, gutter, screen) })
            else -> null }) }
    else Column(Modifier.fillMaxSize().background(Site.Bg)) {
        Box(Modifier.windowInsetsPadding(WindowInsets.statusBars)) { top(null) }
        Column(Modifier.weight(1f).fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (failed != null) "Your saved data is protected" else "Opening your account…", style = Site.CardTitle.copy(fontWeight = FontWeight.ExtraBold, fontSize = 18.sp), textAlign = TextAlign.Center)
            Text(failed ?: "Your decks will appear here.", style = Site.Meta.copy(color = Site.Muted), textAlign = TextAlign.Center,
                modifier = if (failed != null) Modifier.clickable { failed = null; retry++ }.padding(12.dp) else Modifier)
        }
        nav(false)
    }
    idea?.let { i -> androidx.compose.runtime.key(i) {
        IdeaSheet(i, pageLayer, IdeaSheetActions(close = { idea = null },
            // A.card from the sheet: its page, with "Back to deck idea" (S.ui.sheetBack).
            card = { n -> idea = null; magicCard(n, back = "idea:$i") },
            deck = { id -> idea = null; onDeck?.invoke(id, CardGame.MTG) ?: page(site + "#deck/" + android.net.Uri.encode(id), null) }))
    } }
    if (proven) MetaDeckHost(site + "#decks/" + android.net.Uri.encode(tab), close = { proven = false },
        // A.provenSave: the saved deck's page (Magic's on its Cards tab; Yu-Gi-Oh! / Pokémon's #tdeck/<id>).
        deck = { d -> proven = false
            val id = d.get("id")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
            val tg = if (d.get("go")?.asString == "tdeck") CardGame.entries.firstOrNull { it.id == d.get("game")?.asString } ?: CollectionGame.current.value else CardGame.MTG
            if (tg == CardGame.MTG) deckOpensOn("mtg", id, d.get("tab")?.takeIf { it.isJsonPrimitive }?.asString ?: "cards")
            if (id.isNotBlank()) onDeck?.invoke(id, tg) ?: page(site + (if (tg == CardGame.MTG) "#deck/" else "#tdeck/") + android.net.Uri.encode(id), null) },
        site = { u, sel -> page(u, sel) }, web = web)
    chest?.let { c -> WarChestWindow(c, chestUi, pageLayer, onClose = { chestClose() }) }
    seedPick?.let { g -> androidx.compose.runtime.key(g) { SeedPickSheet(g, pageLayer, onClose = { seedPick = null },
        onBuild = { r -> CollectionWrites.building.value = CollectionWrites.BuildOpen(r, "openDeckFlow", web) }) } }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
        CollectionCardHost(c, onClose = { cards = cards.dropLast(1) }, onOpen = { cards = cards + it }, web = web,
            onBack = c.back.removePrefix("idea:").toIntOrNull()?.let { i -> { cards = cards.dropLast(1); idea = i } })
    } }
    } }
}
