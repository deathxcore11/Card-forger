package dev.cardstashy.nativeplay

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.key
import androidx.compose.ui.platform.LocalContext
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import dev.cardstashy.nativeplay.engine.ForgeService
import android.os.SystemClock
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.art.CardArt
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.match.Pick
import dev.cardstashy.nativeplay.match.Plate
import dev.cardstashy.nativeplay.match.QuickPlay
import dev.cardstashy.nativeplay.ui.Backdrop
import dev.cardstashy.nativeplay.ui.CollectionScreen
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.SignInScreen
import dev.cardstashy.nativeplay.ui.Type
import dev.cardstashy.nativeplay.ui.glass
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.ui.DeckPickScreen
import dev.cardstashy.nativeplay.ui.HomeScreen
import dev.cardstashy.nativeplay.ui.TableScreen
import dev.cardstashy.nativeplay.ui.VersusScreen
import kotlinx.coroutines.delay

/** The new Quick Play / Practice lobby ships once every part of the site's lobby is ported (Randall's no-gaps rule). */
private const val LOBBY_LIVE = false

private sealed interface Screen {
    data object Home : Screen
    data object Decks : Screen
    /** The Quick Play or Practice lobby (style "quick" or "practice"). */
    data class Lobby(val style: String) : Screen
    data object SignIn : Screen
    data object Collection : Screen
    /** Play's own collection (the Trunk) with its card view. */
    data object Trunk : Screen
    /** Play decks: the list, precons and Paste a list. */
    data object PlayDecks : Screen
    /** The Trunk opened on its Sets tab at one set (pack goals; the Merchant until it is native). */
    data class TrunkSet(val code: String) : Screen
    /** The Shop: sets and packs, your packs, the Forge; [set] opens one set's page. */
    data class Shop(val tab: String = "sets", val set: String? = null) : Screen
    /** A Play page not yet native: the site's own, in the web view (Planeswalk stays here for good). */
    data class Web(val url: String) : Screen
    data class Match(val pick: Pick) : Screen
    /** Achievements with the daily and weekly quests (one page, like the site's Trophies). */
    data class Achievements(val tab: String? = null) : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // First, so a stall anywhere in start-up is caught too (the 0.3.2 freeze hit 2 s after launch).
        // Silent: a stall or crash report uploads itself; nothing shows on screen (test strip and frame watch off since 0.3.8).
        FreezeReport.init(this); dev.cardstashy.nativeplay.ui.HomeTest.init(this)
        enableEdgeToEdge()
        // The card database starts loading as the app opens, so it is ready before Quick Play is.
        ForgeService.prepare(this)
        Account.init(this); dev.cardstashy.nativeplay.ui.AppSettings.init(this); CardArt.init(this); Speed.init(this)
        dev.cardstashy.nativeplay.play.Progress.init(this); dev.cardstashy.nativeplay.play.SetFacts.init(this); dev.cardstashy.nativeplay.play.CardFacts.init(this); dev.cardstashy.nativeplay.play.DeckEngine.init(this); dev.cardstashy.nativeplay.play.CraftRarity.init(this)
        dev.cardstashy.nativeplay.play.CardData.warm(this); dev.cardstashy.nativeplay.ui.PackSfx.warm(this)
        setContent { androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.fillMaxSize()) { App(this@MainActivity); dev.cardstashy.nativeplay.ui.ProfileArtPickerHost() } }
    }

    override fun dispatchTouchEvent(ev: android.view.MotionEvent): Boolean { FreezeReport.touched(ev); return super.dispatchTouchEvent(ev) }

    /** Games lock landscape like a video game; menus turn freely (standing rule, 2 Nov). */
    fun inGame(on: Boolean) {
        requestedOrientation = if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        val c = WindowCompat.getInsetsController(window, window.decorView)
        if (on) { c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE; c.hide(WindowInsetsCompat.Type.systemBars()) }
        else c.show(WindowInsetsCompat.Type.systemBars())
        if (on) window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}

/** After a freeze: one glass strip that sends the phone's own report of the stuck line (share sheet), or goes away. */
@Composable
private fun FreezeBanner() {
    val report by FreezeReport.text.collectAsState()
    if (report == null) return
    val ctx = androidx.compose.ui.platform.LocalContext.current
    androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.fillMaxSize().navigationBarsPadding().padding(16.dp), contentAlignment = androidx.compose.ui.Alignment.BottomCenter) {
        androidx.compose.foundation.layout.Row(androidx.compose.ui.Modifier.widthIn(max = 560.dp).fillMaxWidth()
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(16.dp)).background(androidx.compose.ui.graphics.Color(0xF0171A20))
            .border(1.dp, androidx.compose.ui.graphics.Color(0x55D6AD64), androidx.compose.foundation.shape.RoundedCornerShape(16.dp)).padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            androidx.compose.material3.Text("The app froze. Send the report so the exact cause gets fixed.", style = dev.cardstashy.nativeplay.ui.Type.Body, modifier = androidx.compose.ui.Modifier.weight(1f))
            androidx.compose.material3.TextButton(onClick = { FreezeReport.dismiss() }) { androidx.compose.material3.Text("Later", color = androidx.compose.ui.graphics.Color(0xFF9AA2B1)) }
            androidx.compose.material3.TextButton(onClick = { FreezeReport.share(ctx) }) { androidx.compose.material3.Text("Send", color = androidx.compose.ui.graphics.Color(0xFFD6AD64)) }
        }
    }
}

@Composable
private fun App(activity: MainActivity) {
    // One Back for the whole app, like the site's appBack(): the topmost layer closes first (a pack, a card,
    // each screen's own handler), then screens return along the app's own trail; Home is the root, where Back leaves.
    val trail = remember { androidx.compose.runtime.mutableStateListOf<Screen>(Screen.Home) }
    val lobbies = remember { HashMap<String, dev.cardstashy.nativeplay.ui.LobbyModel>() }
    val screen = trail.last()
    fun go(s: Screen) { if (s == Screen.Home) { trail.clear(); trail += Screen.Home } else if (trail.last() != s) trail += s }
    fun back() { if (trail.size > 1) trail.removeAt(trail.lastIndex) }
    BackHandler(enabled = trail.size > 1) { back() }
    fun tabTo(t: dev.cardstashy.nativeplay.ui.PlayTab) { when (t) {
        dev.cardstashy.nativeplay.ui.PlayTab.SWITCH -> go(Screen.Collection); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> go(Screen.Trunk)
        dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> go(Screen.PlayDecks); dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> go(Screen.Achievements())
        dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> { if (screen !is Screen.Shop) go(Screen.Shop()) }
    } }
    when (val s = screen) {
        Screen.Home -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.PlayHomeRoute(
                onQuickPlay = { go(Screen.Decks) }, onLobby = { if (LOBBY_LIVE) go(Screen.Lobby(it)) else go(Screen.Decks) }, onCollection = { go(Screen.Collection) },
                onSignIn = { go(Screen.SignIn) }, onWeb = { go(Screen.Web(it)) }, onTrunk = { go(Screen.Trunk) }, onDecks = { go(Screen.PlayDecks) }, onAchievements = { go(Screen.Achievements(it)) }, onShop = { t, set -> go(Screen.Shop(t, set)) })
        }
        Screen.Trunk -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.TrunkRoute(onBack = { back() }, onWeb = { go(Screen.Web(it)) }, onSet = { go(Screen.Shop("sets", it)) }, onNav = { t ->
                when (t) { dev.cardstashy.nativeplay.ui.PlayTab.SWITCH -> go(Screen.Collection); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> {}; dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> go(Screen.PlayDecks); dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> go(Screen.Achievements()); dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> go(Screen.Shop()) } })
        }
        Screen.PlayDecks -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.DecksRoute(onBack = { back() }, onWeb = { go(Screen.Web(it)) }, onTrunkSet = { go(Screen.TrunkSet(it)) }, onNav = { t ->
                when (t) { dev.cardstashy.nativeplay.ui.PlayTab.SWITCH -> go(Screen.Collection); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> go(Screen.Trunk); dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> {}; dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> go(Screen.Achievements()); dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> go(Screen.Shop()) } })
        }
        is Screen.TrunkSet -> {
            // Set pages live in the Shop now (Randall 3 Nov 20:00Z); older links that name a set land there.
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.ShopRoute(onBack = { back() }, startSet = s.code, nav = { dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.SHOP, { t -> tabTo(t) }) })
        }
        is Screen.Shop -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.ShopRoute(onBack = { back() }, startTab = s.tab, startSet = s.set, nav = { dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.SHOP, { t -> tabTo(t) }) })
        }
        Screen.Collection -> { LaunchedEffect(Unit) { activity.inGame(false) }; CollectionScreen(onPlay = { if (trail.size > 1) back() else go(Screen.Home) }) }
        is Screen.Web -> { LaunchedEffect(Unit) { activity.inGame(false) }; CollectionScreen(onPlay = { back() }, url = s.url) }
        Screen.SignIn -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            // The profile orb and every "Sign in" open the site's Settings: signed out it is the account card (Log in / Create account), signed in the account hub.
            dev.cardstashy.nativeplay.ui.SettingsScreen(onBack = { back() }, onWeb = { go(Screen.Web(it)) })
        }
        is Screen.Lobby -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            val model = lobbies.getOrPut(s.style) { dev.cardstashy.nativeplay.ui.LobbyModel(s.style) }
            dev.cardstashy.nativeplay.ui.LobbyScreen(model, onBack = { back() }, onStart = { go(Screen.Match(it)) }, onOpenDecks = { go(Screen.PlayDecks) },
                onSignIn = { go(Screen.SignIn) }, onFriends = { go(Screen.Web(dev.cardstashy.nativeplay.ui.SITE_PLAY)) })
        }
        Screen.Decks -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            DeckPickScreen(onPick = { go(Screen.Match(it)) }, onBack = { back() },
                onSignIn = { go(Screen.SignIn) })
        }
        is Screen.Achievements -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.AchievementsRoute(onBack = { back() }, startTab = s.tab, nav = {
                dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES, { t ->
                    when (t) { dev.cardstashy.nativeplay.ui.PlayTab.SWITCH -> go(Screen.Collection); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> go(Screen.Trunk); dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> go(Screen.PlayDecks); dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> {}; dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> go(Screen.Shop()) } })
            })
        }
        is Screen.Match -> MatchFlow(activity, s.pick, onHome = { go(Screen.Home) }, onDecks = { back() })
    }
}

/**
 * Pick to table: the versus beat shows at once; behind it the CPU's list is chosen, Forge opens
 * the match and both decks' pictures load. The table opens when the art is in (or its budget is
 * spent) and the beat has had a moment; the time from pick to a ready table is logged.
 */
@Composable
private fun MatchFlow(activity: MainActivity, pick: Pick, onHome: () -> Unit, onDecks: () -> Unit) {
    val context = LocalContext.current
    val t0 = remember { SystemClock.elapsedRealtime() }
    var setup by remember { mutableStateOf<QuickPlay.Setup?>(null) }
    LaunchedEffect(Unit) {
        activity.inGame(true)
        QuickPlay.pauseBackground()
        setup = QuickPlay.setup(context, pick, DemoDecks.load(context))
    }
    BackHandler { if (setup !is QuickPlay.Setup.Ready) onDecks() }
    when (val s = setup) {
        null -> VersusScreen(Plate(pick.name, "You", pick.face), null)
        is QuickPlay.Setup.Unknown -> { LaunchedEffect(Unit) { activity.inGame(false) }; Problem("Forge doesn’t know ${if (s.names.size == 1) "this card" else "these ${s.names.size} cards"} yet",
            s.names.joinToString("\n") + "\n\nThis deck can’t be played until they’re added to the rules. Pick another deck for now.", onDecks) }
        is QuickPlay.Setup.Failed -> { LaunchedEffect(Unit) { activity.inGame(false) }; Problem("Couldn’t start the match", s.reason, onDecks) }
        is QuickPlay.Setup.Ready -> Table(activity, s, t0, onHome)
    }
}

@Composable
private fun Table(activity: MainActivity, s: QuickPlay.Setup.Ready, t0: Long, onHome: () -> Unit) {
    var round by remember { mutableIntStateOf(0) }
    key(round) {
        val context = LocalContext.current
        val scope = rememberCoroutineScope()
        val controller = remember { MatchController(scope, s.input) }
        var versus by remember { mutableStateOf(round == 0) }
        DisposableEffect(Unit) { activity.inGame(true); controller.start(); onDispose { controller.close() } }
        if (round == 0) LaunchedEffect(Unit) {
            // Art and engine load side by side; the beat holds at least 0.9 s so it reads as a beat, not a flicker.
            val minBeat = launch { delay(900) }
            QuickPlay.warmArt(context, s, budgetMs = if (s.known) 2000 else 4500)
            minBeat.join(); versus = false
        }
        LaunchedEffect(Unit) {
            controller.shown.first { it != null }
            if (round == 0) Speed.record(if (s.known) Speed.KNOWN else Speed.NEW, SystemClock.elapsedRealtime() - t0)
        }
        BackHandler { /* the table's menu has Leave; Back never drops a match by accident */ }
        if (versus) VersusScreen(s.you, s.cpu, intro = false) else TableScreen(controller, onHome = onHome, onRematch = { round++ })
    }
}

@Composable
private fun Problem(title: String, text: String, onBack: () -> Unit) {
    Backdrop("play/playmat-charcoal-table.webp", dim = .6f) {
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), contentAlignment = Alignment.Center) {
            Column(Modifier.widthIn(max = 460.dp).glass().verticalScroll(rememberScrollState()).padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(title, style = Type.Title)
                Text(text, style = Type.Body.copy(fontSize = 13.sp))
                Text("Back to decks", style = Type.Label.copy(color = Palette.Gold), modifier = Modifier.clickable(onClick = onBack).padding(vertical = 8.dp))
            }
        }
    }
}
