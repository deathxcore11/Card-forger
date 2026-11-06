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
 * The Rules page (the site's #rules: rules.js rulesPage) for [game], through the site's own code in the Collection engine and drawn by
 * SitePanel: the interactive rules (rule-learning.js, rule words open their glass), Formats & deck limits, the ban lists loaded live
 * (A.rulesList) and the official documents. How to play · keywords (A.learnGame) shows learnSheet here, its ← back to the page.
 * Tabletop and Ask a Judge are the website's for now (opened there with the same press); a banned card opens its page. No tab of
 * the bar is lit (app.js lights none for the rules view).
 */
@Composable
fun CollectionRulesRoute(onPlay: () -> Unit, onProfile: () -> Unit, onHome: () -> Unit, onCards: () -> Unit, onDecks: () -> Unit, onSearch: () -> Unit,
                         web: (url: String, press: String?) -> Unit, game: String = "mtg", onGame: (String) -> Unit = {}, onWiki: ((topic: String) -> Unit)? = null) {
    val context = LocalContext.current
    val session by Account.session.collectAsState()
    val revision by Decks.fullRevision.collectAsState()
    val profile by Account.profile.collectAsState()
    val scope = rememberCoroutineScope()
    var learn by remember(game) { mutableStateOf(false) }
    var panel by remember(game) { mutableStateOf<SitePanelModel?>(null) }
    var failed by remember(game) { mutableStateOf(false) }
    var cards by remember { mutableStateOf(listOf<CardOpen>()) }
    val page = SITE + "#rules"
    fun css(v: String) = v.replace("\\", "\\\\").replace("\"", "\\\"")
    // What the page leaves to app.js (panel.acted).
    fun acted(a: JsonObject) {
        val act = a.get("act")?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
        val d = a.getAsJsonObject("data") ?: JsonObject()
        fun ds(k: String) = d.get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
        when (act) {
            "learnGame" -> learn = true
            "closeSheet" -> learn = false
            "go" -> when (val to = ds("to")) { "#rules" -> learn = false; "#search" -> onSearch(); "#decks" -> onDecks(); "#collection" -> onCards(); "#home" -> onHome(); else -> web(SITE + to, null) }
            "card" -> cards = cards + CardOpen(ds("name"), page = page, tile = "[data-act=\"card\"][data-name=\"${css(ds("name"))}\"]")
            "tCard" -> cards = cards + CardOpen("", page = page, tile = "[data-act=\"tCard\"][data-id=\"${css(ds("id"))}\"]", game = game, id = ds("id"))
            "mtgWikiOpen", "wikiOpen" -> onWiki?.invoke(ds("wikiTopic").ifBlank { ds("topic") }) ?: web(SITE + "#wiki", null)
            // tabletop.js openTabletop and the AI judge (A.askRules) are the website's: opened there, the same control pressed.
            else -> if (act.isNotBlank()) web(page, (if (learn) "[data-act=\"learnGame\"]\n#sheet[open] " else "") + "[data-act=\"${css(act)}\"]")
        }
    }
    val want = if (learn) "learn|$game" else "rulespage|$game"
    fun take(m: SitePanelModel) { if (m.key != want) return; panel = m; m.toasts.lastOrNull()?.let { CollectionWrites.show(it) }; m.acted?.let(::acted) }
    fun panelDo(call: suspend () -> JsonObject) = scope.launch {
        runCatching { take(SitePanelModel.parse(call())); CollectionEngine.settle(30_000, CollectionEngine.PANEL_MODEL) { j -> if (j.has("key")) take(SitePanelModel.parse(j)) } }
    }
    LaunchedEffect(session?.userId) { if (session != null) Decks.load(context) }
    LaunchedEffect(game, learn, session?.userId, revision) {
        failed = false
        val ok = runCatching { ensureCollection(context, session?.userId, session != null, revision) }.getOrDefault(false)
        if (!ok) { failed = true; return@LaunchedEffect }
        panelDo { if (learn) CollectionEngine.learnGame(game) else CollectionEngine.rulesPage(game) }
    }
    BackHandler(learn && cards.isEmpty()) { learn = false }
    val screenW = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp
    val siteUi = remember(screenW) {
        SiteUi(tap = { id -> panelDo { CollectionEngine.panelTap(id) } }, type = { id, v -> panelDo { CollectionEngine.panelType(id, v) } },
            open = { href -> runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(href)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } },
            screen = screenW)
    }
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val top: @Composable (tabs: (@Composable () -> Unit)?) -> Unit = { tabs ->
        TopBarItems(Mode.COLLECTION, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onPlay, onProfile = onProfile, middle = tabs)
    }
    val g = CardGame.of(game)
    val nav: @Composable (Boolean) -> Unit = { v ->
        CollectionNav(null, vertical = v) { t ->
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
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
                            top(if (wide) ({ GameTabs(g, { c -> if (c != g) onGame(c.id) }, compact = false, Modifier.widthIn(max = 560.dp)) }) else null)
                        }
                        Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = if (wide) 4.dp else 10.dp, bottom = 28.dp)) {
                            if (!wide) GameTabs(g, { c -> if (c != g) onGame(c.id) }, compact = true, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 280.dp).padding(bottom = 12.dp))
                            val p = panel
                            if (p == null) Text(if (failed) "The rules couldn’t open. Check your connection and try again." else "Opening the rules…",
                                Modifier.fillMaxWidth().padding(top = 40.dp), style = Site.Meta, textAlign = TextAlign.Center)
                            else Box(Modifier.widthIn(max = 1196.dp).align(Alignment.CenterHorizontally)) { SitePanel(p, siteUi, padded = false) }
                        }
                    }
                    panel?.let { p -> SiteGlass(p, siteUi, pageLayer) { p.glass?.find { n -> n.has("rule-dismiss") }?.let { n -> siteUi.tap(n.id) } } }
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
