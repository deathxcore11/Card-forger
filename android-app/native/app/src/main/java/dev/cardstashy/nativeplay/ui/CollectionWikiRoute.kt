package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.launch

private const val SITE = "https://cardstashy.com/"


/**
 * The Wiki page (the site's #wiki: mtg-wiki-ui.js mtgWikiPageMarkup with the game's createMtgWikiPageController) for [game], through
 * the site's own code in the Collection engine and drawn by SitePanel: today's article, the glossary, search with its suggestions
 * and the article reader. The site's routes (#wiki/<topic>, #wiki/<topic>/search) are kept here as its history is: a pick or a search
 * goes forward, back returns. Ask about this (the AI) and an article's printing links, card searches and source decks are the
 * website's for now (opened there at the same article with the same press). The Search tab is lit (app.js lights it for the wiki).
 */
@Composable
fun CollectionWikiRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSearch: () -> Unit,
                        onSets: () -> Unit, web: (url: String, press: String?) -> Unit, game: String = "mtg", topic: String = "", onGame: (String) -> Unit = {}) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    val scope = rememberCoroutineScope()
    // The routes visited, the last one shown (topic, search).
    var stack by remember(game) { mutableStateOf(listOf(topic.trim() to false)) }
    val route = stack.last()
    var panel by remember(game) { mutableStateOf<SitePanelModel?>(null) }
    var failed by remember(game) { mutableStateOf(false) }
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    fun hash(t: String, q: Boolean) = "#wiki" + (if (t.isBlank()) "" else "/" + android.net.Uri.encode(t) + (if (q) "/search" else ""))
    val page = SITE + hash(route.first, route.second)
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    // What the page leaves to app.js (panel.acted).
    fun acted(a: JsonObject) {
        val act = a.get("act")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
        val d = a.getAsJsonObject("data") ?: JsonObject()
        fun ds(k: String) = d.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
        when (act) {
            // The controller's navigate: app.js go('#wiki/…').
            "wikiRoute" -> { val next = ds("topic").trim() to (ds("query") == "true"); if (next != stack.last()) stack = stack + next }
            "go" -> when (val to = ds("to")) { "#sets" -> onSets(); "#search" -> onSearch(); "#decks" -> onDecks(); "#collection" -> onCards(); "#home" -> onHome(); else -> web(SITE + to, null) }
            "card" -> cards = cards + CardOpen(ds("name"), page = page, tile = "[data-act=\"card\"][data-name=\"${css(ds("name"))}\"]")
            // A.mtgWikiAsk: Ask CardStashy (gap audit H3) with the words in the field, else the article's topic, waiting in its bar.
            "mtgWikiAsk" -> CollectionWrites.asking.value = CollectionWrites.AskOpen(game,
                draft = ds("text").trim().ifBlank { route.first.trim() }.ifBlank { "Explain this card game topic." },
                go = { d -> askGo(d, page, card = { c -> cards = cards + c }, sets = { onSets() }, set = { _, code -> web(SITE + "#set/" + android.net.Uri.encode(code), null) },
                    wiki = { _, t -> val next = t.trim() to false; if (next != stack.last()) stack = stack + next }, web = web) }, web = web)
            // wikiCard (a printing), wikiCards (a card search) and wikiDeck (a source deck): the article on the site, the same link pressed.
            else -> if (act.isNotBlank()) web(page, "[data-act=\"${css(act)}\"]" + d.entrySet().filter { it.value.isJsonPrimitive }.joinToString("") { (k, v) ->
                "[data-" + k.replace(Regex("[A-Z]")) { "-" + it.value.lowercase() } + "=\"" + css(v.asString) + "\"]" })
        }
    }
    val want = "wiki|$game"
    fun take(m: SitePanelModel) { if (m.key != want) return; panel = m; m.toasts.lastOrNull()?.let { CollectionWrites.show(it) }; m.acted?.let(::acted) }
    fun panelDo(call: suspend () -> JsonObject) = scope.launch {
        runCatching { take(SitePanelModel.parse(call())); CollectionEngine.settle(30_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) } }
    }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(game, route, session?.userId, revision) {
        failed = false
        val ok = runCatching { ensureCollection(context, session?.userId, session != null, revision) }.getOrDefault(false)
        if (!ok) { failed = true; return@LaunchedEffect }
        panelDo { CollectionEngine.wikiPage(game, route.first, route.second) }
    }
    // Back walks the Wiki's own routes first, as the browser's history does; then the app's.
    BackHandler(cards.isEmpty() && stack.size > 1) { stack = stack.dropLast(1) }
    val screenW = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
    val siteUi = remember(screenW) {
        SiteUi(tap = { id -> panelDo { CollectionEngine.panelTap(id) } }, type = { id, v -> panelDo { CollectionEngine.panelType(id, v) } },
            open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
            screen = screenW, submit = { id -> panelDo { CollectionEngine.panelSubmit(id) } })
    }
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val g = CardGame.of(game)
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(CollectionTab.SEARCH, vertical = v) { t ->
            when (t) {
                CollectionTab.HOME -> onHome(); CollectionTab.CARDS -> onCards(); CollectionTab.SEARCH -> onSearch(); CollectionTab.DECKS -> onDecks()
                CollectionTab.SCAN -> web(SITE + "#scan", null)
            }
        }
    }
    GameAccent(game) {
        BoxWithConstraints(Modifier.fillMaxSize().background(Site.Bg)) {
            val wide = maxWidth >= 600.dp
            val gutter = if (wide) 22.dp else 16.dp
            val body: @Composable (Modifier) -> Unit = { mod ->
                Box(mod.drawWithContent { pageLayer.record { this@drawWithContent.drawContent() }; drawLayer(pageLayer) }) {
                    // A new route starts at the top, as the site's go() scrolls.
                    androidx.compose.runtime.key(route) {
                        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                            Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                                top(if (wide) ({ GameTabs(g, { c -> if (c != g) onGame(c.id) }, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
                            }
                            Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 4.dp else 10.dp, bottom = 28.dp)) {
                                if (!wide) GameTabs(g, { c -> if (c != g) onGame(c.id) }, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                                val p = panel
                                if (p == null) Text(if (failed) "The Wiki couldn’t open. Check your connection and try again." else "Opening the Wiki…",
                                    Modifier.fillMaxWidth().padding(top = 40.dp), style = Site.Meta, textAlign = TextAlign.Center)
                                else Box(Modifier.widthIn(max = 1196.dp).align(Alignment.CenterHorizontally)) { SitePanel(p, siteUi, padded = false) }
                            }
                        }
                    }
                }
            }
            if (sideways()) Row(Modifier.fillMaxSize()) { nav(true); body(Modifier.weight(1f).fillMaxHeight()) }
            else Column(Modifier.fillMaxSize()) { body(Modifier.weight(1f).fillMaxWidth()); nav(false) }
        }
    }
    cards.lastOrNull()?.let { c -> androidx.compose.runtime.key(c) {
        CollectionCardHost(c, onClose = { cards = emptyList() }, onOpen = { cards = cards + it }, web = web, onBack = { cards = cards.dropLast(1) })
    } }
}
