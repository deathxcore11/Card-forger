package dev.cardstashy.nativeplay

import androidx.lifecycle.lifecycleScope
import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import dev.cardstashy.nativeplay.ui.padRoot
import dev.cardstashy.nativeplay.ui.PadPromptBar
import dev.cardstashy.nativeplay.ui.PadCursorLayer
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
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
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.ui.DeckPickScreen
import dev.cardstashy.nativeplay.ui.HomeScreen
import dev.cardstashy.nativeplay.ui.TableScreen
import dev.cardstashy.nativeplay.ui.VersusScreen
import kotlinx.coroutines.delay

/** The new Quick Play / Practice lobby ships once every part of the site's lobby is ported (Randall's no-gaps rule). */
private const val LOBBY_LIVE = true

/** Collection's native Cards tab. On since Randall approved the previews (5 Nov 08:36Z); false sends Home's Cards tab to the website's. */
private const val NATIVE_CARDS = true
/** Collection's native Decks tab (My decks). */
private const val NATIVE_DECKS = true
/** A deck's own page (its Cards tab), opened from the native Decks tab. */
private const val NATIVE_DECK = true
/** A card's page (Overview, Meta, Play guide, Prices), opened from the native Cards tab, deck page and set page. */
private const val NATIVE_CARD = true
/** Every set and a set's page, opened from set badges, the card page and Home's All sets link. Magic only; the other games' sets open the website. */
private const val NATIVE_SETS = true
/** Yu-Gi-Oh! and Pokémon in the native set list and set page (their game tabs there); off, they open the website's. On since Randall's yes (5 Nov). */
private const val NATIVE_TCG_SETS = true
/** Open Pack on a Magic set page drawn natively (the site's own draw in the app's pack opener, with its price frames); off, it opens the website's. On since Randall's yes (5 Nov). */
private const val NATIVE_PACK = true
/** Yu-Gi-Oh! and Pokémon card pages and their Open Pack, drawn natively from the site's tcg.js and pack-preview.js. On since Randall's "turn on all" (5 Nov). */
private const val NATIVE_TCG_CARDS = true
/** Collection's Search tab (all three games), opened from every Collection page's nav and Home's search. */
private const val NATIVE_SEARCH = true
/** The Scan tab: the site's scanner in ScanWeb's page, drawn natively, with the phone's camera (CollectionScanRoute). */
private const val NATIVE_SCAN = true

private sealed interface Screen {
    data object Home : Screen
    data object Decks : Screen
    /** The Quick Play or Practice lobby (style "quick" or "practice"). */
    data class Lobby(val style: String) : Screen
    data object SignIn : Screen
    data object Collection : Screen
    /** Collection's Cards tab (its card list; the rest of its pages are still the website's). */
    data object CollectionCards : Screen
    /** Collection's Decks tab (My decks; a deck page and the other tabs are still the website's). */
    data object CollectionDecks : Screen
    /** A deck's page, its Cards tab (its other tabs are still the website's). */
    /** A deck's page; [game] "ygo" / "ptcg" for a Yu-Gi-Oh! or Pokémon deck (tcg.js #tdeck). */
    data class CollectionDeck(val id: String, val game: String = "mtg") : Screen
    /** Every set of a game (the site's #sets). */
    data class CollectionSets(val game: String = "mtg") : Screen
    /** The Search tab for a game (the site's #search). */
    data class CollectionSearch(val game: String = "mtg") : Screen
    /** The Rules page (#rules) for a game. */
    /** [ref]: a judge's citation to open on the page (its title and quoted words shown in its place if the page can't open it). */
    data class CollectionRules(val game: String = "mtg", val learn: Boolean = false, val ref: com.google.gson.JsonObject? = null, val refTitle: String = "", val refQuote: String = "") : Screen
    /** The Wiki page (#wiki, #wiki/<topic>) for a game. */
    data class CollectionWiki(val game: String = "mtg", val topic: String = "") : Screen
    /** The Scan tab (the site's #scan) for a game. */
    data class CollectionScan(val game: String = "mtg") : Screen
    /** One set's page (the site's #set/<code or id>). */
    data class CollectionSet(val code: String, val game: String = "mtg") : Screen
    /** Play's own collection (the Trunk) with its card view. */
    data object Trunk : Screen
    /** Play decks: the list, precons and Paste a list. */
    data object PlayDecks : Screen
    /** The Trunk opened on its Sets tab at one set (pack goals; the Merchant until it is native). */
    data class TrunkSet(val code: String) : Screen
    /** The Shop: sets and packs, your packs, the Forge; [set] opens one set's page. */
    data class Shop(val tab: String = "sets", val set: String? = null) : Screen
    /** A Play page not yet native: the site's own, in the web view (Planeswalk stays here for good). */
    data class Web(val url: String, val press: String? = null) : Screen
    data class Match(val pick: Pick) : Screen
    /** Achievements with the daily and weekly quests (one page, like the site's Trophies). */
    data class Achievements(val tab: String? = null) : Screen
    /** Story: the road of acts and an act's battles (the duel setup is still the site's page). */
    data class Story(val act: Int? = null) : Screen
}

class MainActivity : ComponentActivity() {
    /** Run at the screen's top refresh rate (120 Hz on the AYN Thor and most flagships) at its current resolution: foil, card
     *  lean and the table animate every frame the panel can show. Android still drops it for battery saver on its own. */
    private fun fastestRefresh() = runCatching {
        @Suppress("DEPRECATION") val d = if (android.os.Build.VERSION.SDK_INT >= 30) display else windowManager.defaultDisplay
        val now = d?.mode ?: return@runCatching
        val best = d.supportedModes.filter { it.physicalWidth == now.physicalWidth && it.physicalHeight == now.physicalHeight }.maxByOrNull { it.refreshRate } ?: return@runCatching
        if (best.modeId != now.modeId) window.attributes = window.attributes.apply { preferredDisplayModeId = best.modeId }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dev.cardstashy.nativeplay.play.PlayRules.warm(this)
        // First, so a stall anywhere in start-up is caught too (the 0.3.2 freeze hit 2 s after launch).
        // Silent: a stall or crash report uploads itself; nothing shows on screen (test strip and frame watch off since 0.3.8).
        FreezeReport.init(this); dev.cardstashy.nativeplay.ui.HomeTest.init(this)
        TestHooks.read(intent)
        // The sign-in return link on a cold start (gap audit S2).
        dev.cardstashy.nativeplay.account.AuthReturn.take(intent)
        enableEdgeToEdge()
        fastestRefresh()
        // The card database starts loading as the app opens, so it is ready before Quick Play is.
        ForgeService.prepare(this)
        Account.init(this); Account.onCleared = { dev.cardstashy.nativeplay.ui.WebSession.clear() }; dev.cardstashy.nativeplay.ui.AppSettings.init(this); dev.cardstashy.nativeplay.ui.Aura.init(this); dev.cardstashy.nativeplay.ui.TableEmotes.init(this); dev.cardstashy.nativeplay.ui.MatchMenu.init(this); Thread { dev.cardstashy.nativeplay.ui.BoardIcons.get(applicationContext, "tapped") }.start(); CardArt.init(this); CardArt.oracleOf = { dev.cardstashy.nativeplay.engine.ForgeService.oracleName(it) }; dev.cardstashy.nativeplay.engine.MatchState.shownName = CardArt::shown; dev.cardstashy.nativeplay.engine.MatchState.shownIn = CardArt::shownIn; Speed.init(this)
        // Gap audit S3: the return link finishes the Google or email-link sign-in waiting for it (never logged); signed in, as Log in does.
        lifecycleScope.launch {
            dev.cardstashy.nativeplay.account.AuthReturn.pending.collect { r ->
                r ?: return@collect
                dev.cardstashy.nativeplay.account.AuthReturn.pending.value = null
                val e = Account.finishReturn(r)
                if (e != null) dev.cardstashy.nativeplay.ui.CollectionWrites.show(e)
                else { dev.cardstashy.nativeplay.account.Decks.clear(); dev.cardstashy.nativeplay.account.Decks.load(this@MainActivity); dev.cardstashy.nativeplay.play.Progress.clear() }
            }
        }
        dev.cardstashy.nativeplay.play.Progress.init(this); dev.cardstashy.nativeplay.play.SetFacts.init(this); dev.cardstashy.nativeplay.play.CardFacts.init(this); dev.cardstashy.nativeplay.play.DeckEngine.init(this); dev.cardstashy.nativeplay.play.RandomBuild.init(this); dev.cardstashy.nativeplay.collection.ScanWeb.init(this); dev.cardstashy.nativeplay.play.CraftRarity.init(this)
        dev.cardstashy.nativeplay.play.CardData.warm(this); dev.cardstashy.nativeplay.ui.PackSfx.warm(this)
        // Offline play: when a network comes back, matches finished without signal are sent (the server still decides rewards).
        runCatching { (getSystemService(CONNECTIVITY_SERVICE) as android.net.ConnectivityManager).registerDefaultNetworkCallback(object : android.net.ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) { kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch { dev.cardstashy.nativeplay.play.Progress.flushQueue() }
                // Collection saves made without signal go to the account now (cloud.js: the online event starts a sync).
                dev.cardstashy.nativeplay.collection.WorkspaceSync.kick(applicationContext) }
        }) }
        dev.cardstashy.nativeplay.ui.Pad.watch(this); dev.cardstashy.nativeplay.ui.PadCursor.attach(window.decorView); dev.cardstashy.nativeplay.ui.DualScreen.init(this)
        dev.cardstashy.nativeplay.ui.CollectionWrites.init()
        // Collection's engine starts a moment after the first frame (not while Play's Home is drawing), so Collection opens at once.
        window.decorView.post { dev.cardstashy.nativeplay.collection.CollectionWarm.start(this) }
        setContent {
            // The app is recorded into a layer as it draws, so the toast pill can blur what is under it (backdrop-filter).
            val page = androidx.compose.ui.graphics.rememberGraphicsLayer()
            androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.fillMaxSize()) {
                androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.fillMaxSize().padRoot().drawWithContent { dev.cardstashy.nativeplay.ui.RootDraws.tick(); page.record { this@drawWithContent.drawContent() }; drawLayer(page) }) {
                    androidx.compose.runtime.CompositionLocalProvider(androidx.compose.foundation.LocalIndication provides dev.cardstashy.nativeplay.ui.PadFocus) {
                        App(this@MainActivity); dev.cardstashy.nativeplay.ui.ProfileArtPickerHost()
                    }
                }
                dev.cardstashy.nativeplay.ui.AchievementToastHost(page)
                dev.cardstashy.nativeplay.ui.CollectionWritesHost(page)
                UpdateHost(this@MainActivity)
                dev.cardstashy.nativeplay.ui.TopScreenHost()
                dev.cardstashy.nativeplay.ui.PlayInspectHost()
                dev.cardstashy.nativeplay.ui.RuleSheetHost()
                PadPromptBar()
                PadCursorLayer()
                // Menus idle after 20 s with no input (gap audit G4): checked once a second.
                androidx.compose.runtime.LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); dev.cardstashy.nativeplay.ui.MenuIdle.tick(android.os.SystemClock.uptimeMillis()) } }
                // Loading brief L1: the opening screen over everything until Play home's own waits are over (once per launch).
                if (!TestHooks.skipOpening) dev.cardstashy.nativeplay.ui.OpeningHost()
            }
        }
        Updater.check(this)
        // Deck Forge's WebView (Random deck) lives in this window, out of sight, so its builds run at full speed.
        dev.cardstashy.nativeplay.play.RandomBuild.attach(this)
        dev.cardstashy.nativeplay.collection.ScanWeb.attach(this)
    }

    override fun onDestroy() { dev.cardstashy.nativeplay.play.RandomBuild.detach(this); dev.cardstashy.nativeplay.collection.ScanWeb.detach(this); super.onDestroy() }
    override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent); setIntent(intent); TestHooks.read(intent); dev.cardstashy.nativeplay.account.AuthReturn.take(intent) }

    override fun onResume() { super.onResume(); Updater.resumed(this); dev.cardstashy.nativeplay.collection.WorkspaceSync.kick(this) }
    override fun onStart() { super.onStart(); dev.cardstashy.nativeplay.play.RandomBuild.hidden = false; dev.cardstashy.nativeplay.ui.DualScreen.attach(this) }
    override fun onStop() { super.onStop(); dev.cardstashy.nativeplay.play.RandomBuild.hidden = true; dev.cardstashy.nativeplay.ui.DualScreen.detach(this) }

    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); dev.cardstashy.nativeplay.ui.PadPrompts.windowFocused = hasFocus }

    override fun dispatchTouchEvent(ev: android.view.MotionEvent): Boolean { FreezeReport.touched(ev); dev.cardstashy.nativeplay.ui.MenuIdle.input(android.os.SystemClock.uptimeMillis()); return super.dispatchTouchEvent(ev) }

    /**
     * Controllers on handhelds (AYN Thor, Retroid and the like): A presses what has the gold focus ring
     * (sent on as d-pad centre, which every clickable answers), B goes back. Not every pad's key map
     * gives these fallbacks, so the app maps them itself. The left stick moves focus like the d-pad.
     */
    override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
        dev.cardstashy.nativeplay.ui.MenuIdle.input(android.os.SystemClock.uptimeMillis())
        if (event.isFromSource(android.view.InputDevice.SOURCE_GAMEPAD)) dev.cardstashy.nativeplay.ui.Pad.used()
        if (event.action == android.view.KeyEvent.ACTION_DOWN && (event.isFromSource(android.view.InputDevice.SOURCE_GAMEPAD) || event.isFromSource(android.view.InputDevice.SOURCE_DPAD)))
            dev.cardstashy.nativeplay.ui.PadPrompts.lastPress = android.os.SystemClock.uptimeMillis()
        // X, Y, the shoulders, the triggers and Start do what the prompt bar says for the focused thing and the screen.
        if (dev.cardstashy.nativeplay.ui.PadPrompts.key(event) { dir -> val now = android.os.SystemClock.uptimeMillis()
                super.dispatchKeyEvent(android.view.KeyEvent(now, now, android.view.KeyEvent.ACTION_DOWN, dir, 0))
                super.dispatchKeyEvent(android.view.KeyEvent(now, now, android.view.KeyEvent.ACTION_UP, dir, 0)) }) return true
        when (event.keyCode) {
            android.view.KeyEvent.KEYCODE_DPAD_UP, android.view.KeyEvent.KEYCODE_DPAD_DOWN, android.view.KeyEvent.KEYCODE_DPAD_LEFT, android.view.KeyEvent.KEYCODE_DPAD_RIGHT ->
                if (event.action == android.view.KeyEvent.ACTION_DOWN) { dev.cardstashy.nativeplay.ui.PadCursor.dpad()
                    // Nothing has the ring yet: the first press puts it on the screen instead of going nowhere.
                    val pad = event.isFromSource(android.view.InputDevice.SOURCE_GAMEPAD) || event.isFromSource(android.view.InputDevice.SOURCE_JOYSTICK) || event.source == android.view.InputDevice.SOURCE_DPAD
                    if (if (pad) dev.cardstashy.nativeplay.ui.PadPrompts.navigate(event.keyCode) else dev.cardstashy.nativeplay.ui.PadPrompts.enter(event.keyCode)) { dpadEntered = event.keyCode; return true } }
                else if (event.action == android.view.KeyEvent.ACTION_UP && dpadEntered == event.keyCode) { dpadEntered = 0; return true }
        }
        when (event.keyCode) {
            android.view.KeyEvent.KEYCODE_BUTTON_A -> {
                // The stick cursor over something the ring can't rest on: A presses it there.
                if (event.action == android.view.KeyEvent.ACTION_DOWN && event.repeatCount == 0 && dev.cardstashy.nativeplay.ui.PadCursor.pressA()) { android.util.Log.i("PadA", "stick cursor took A"); aTaken = true; return true }
                // Nothing has the ring (it was lost when the board changed): A puts it on the screen's first stop (the table's hand chip) instead of going nowhere.
                if (event.action == android.view.KeyEvent.ACTION_DOWN && event.repeatCount == 0 && !dev.cardstashy.nativeplay.ui.PadPrompts.anyFocus &&
                    dev.cardstashy.nativeplay.ui.PadPrompts.entry?.let { runCatching { it() }.getOrDefault(false) } == true) { android.util.Log.i("PadA", "A with no ring: ring to the screen's first stop (the table's hand chip, the Quick Play lobby's first deck)"); aTaken = true; return true }
                if (aTaken) { if (event.action == android.view.KeyEvent.ACTION_UP) aTaken = false; return true }
            }
        }
        when (event.keyCode) {
            android.view.KeyEvent.KEYCODE_BUTTON_A -> {
                if (event.action == android.view.KeyEvent.ACTION_DOWN && event.repeatCount == 0) android.util.Log.i("PadA", "A to the ring: ${dev.cardstashy.nativeplay.ui.PadPrompts.current().a} touch=${window.decorView.isInTouchMode} view=${currentFocus?.javaClass?.simpleName}")
                return super.dispatchKeyEvent(android.view.KeyEvent(event.downTime, event.eventTime, event.action, android.view.KeyEvent.KEYCODE_DPAD_CENTER, event.repeatCount, event.metaState, event.deviceId, event.scanCode, event.flags, event.source))
            }
            android.view.KeyEvent.KEYCODE_BUTTON_B -> {
                if (event.action == android.view.KeyEvent.ACTION_UP && !event.isCanceled) onBackPressedDispatcher.onBackPressed()
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private var hatDir = 0
    private var aTaken = false
    private var dpadEntered = 0
    override fun dispatchGenericMotionEvent(ev: android.view.MotionEvent): Boolean {
        dev.cardstashy.nativeplay.ui.MenuIdle.input(android.os.SystemClock.uptimeMillis())
        if (ev.isFromSource(android.view.InputDevice.SOURCE_JOYSTICK) && ev.action == android.view.MotionEvent.ACTION_MOVE) {
            dev.cardstashy.nativeplay.ui.Pad.used()
            // The d-pad on many handhelds (the AYN Portal among them) arrives as a hat, not keys: one ring step per press. Taking the
            // event here stops the system turning it into keys itself, so the hat has to be read here (0.4.44 missed it: no d-pad).
            val hx = ev.getAxisValue(android.view.MotionEvent.AXIS_HAT_X); val hy = ev.getAxisValue(android.view.MotionEvent.AXIS_HAT_Y)
            val dir = when { hy < -.5f -> android.view.KeyEvent.KEYCODE_DPAD_UP; hy > .5f -> android.view.KeyEvent.KEYCODE_DPAD_DOWN
                hx < -.5f -> android.view.KeyEvent.KEYCODE_DPAD_LEFT; hx > .5f -> android.view.KeyEvent.KEYCODE_DPAD_RIGHT; else -> 0 }
            if (dir != hatDir) {
                hatDir = dir
                if (dir != 0) { val now = android.os.SystemClock.uptimeMillis()
                    dev.cardstashy.nativeplay.ui.PadCursor.dpad(); dev.cardstashy.nativeplay.ui.PadPrompts.lastPress = now
                    // Through the app's own key handling (not straight to the views), so a hat press with nothing ringed still puts
                    // the ring on the screen (Randall 9 Nov: the d-pad could not reach Your packs after the bottom screen opened it).
                    dispatchKeyEvent(android.view.KeyEvent(now, now, android.view.KeyEvent.ACTION_DOWN, dir, 0, 0, ev.deviceId, 0, 0, android.view.InputDevice.SOURCE_DPAD))
                    dispatchKeyEvent(android.view.KeyEvent(now, now, android.view.KeyEvent.ACTION_UP, dir, 0, 0, ev.deviceId, 0, 0, android.view.InputDevice.SOURCE_DPAD)) }
            }
            // Left stick: the cursor. Right stick: scroll what is under it.
            dev.cardstashy.nativeplay.ui.PadCursor.left(ev.getAxisValue(android.view.MotionEvent.AXIS_X), ev.getAxisValue(android.view.MotionEvent.AXIS_Y))
            dev.cardstashy.nativeplay.ui.PadCursor.right(ev.getAxisValue(android.view.MotionEvent.AXIS_Z), ev.getAxisValue(android.view.MotionEvent.AXIS_RZ))
            return true
        }
        return super.dispatchGenericMotionEvent(ev)
    }

    /**
     * Games lock landscape like a video game; menus turn freely, portrait or sideways (Randall 4 Nov 17:40Z: keep portrait on
     * phones, and a strong sideways layout for handhelds). Planeswalk is the one web page that turns sideways on a regular phone.
     */
    private var lastGame = false; private var lastPlay = true
    fun inGame(on: Boolean, play: Boolean = false, force: Boolean = false) {
        if (!force && on && lastGame && lastPlay == play) return // V6: the match asks twice (MatchFlow, Table); the second must not resize the window again
        lastGame = on; lastPlay = play; Updater.inGame = on
        dev.cardstashy.nativeplay.ui.MenuIdle.onMenu = !on // the table keeps its motion; only menus go idle
        dev.cardstashy.nativeplay.art.ThumbStore.paused = on // the table gets the network and CPU
        dev.cardstashy.nativeplay.play.RandomBuild.paused = on // background random decks wait (app.js playRandomQueue idle())
        val sideways = on || (play && resources.configuration.smallestScreenWidthDp < 600)  // play = Planeswalk on a phone
        requestedOrientation = if (sideways) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        val c = WindowCompat.getInsetsController(window, window.decorView)
        if (sideways) { c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE; c.hide(WindowInsetsCompat.Type.systemBars()) }
        else c.show(WindowInsetsCompat.Type.systemBars())
        if (on) window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /** Folding or unfolding changes the smallest width: the phone rule is applied again for the screen on show. */
    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        inGame(lastGame, lastPlay, force = true)
    }
}

/** The update prompt over the menus; at the table it waits until the match is over. */
@Composable
private fun UpdateHost(activity: MainActivity) {
    val ui = Updater.ui ?: return
    if (Updater.inGame) return
    dev.cardstashy.nativeplay.ui.UpdatePrompt(ui, onUpdate = { Updater.start(activity) }, onAllow = { Updater.allow(activity) }, onInstall = { Updater.install(activity) },
        onRetry = { Updater.retry(activity) }, onCancel = { Updater.cancel() }, onLater = { Updater.later(activity) })
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
    /** The open screen becomes [s] (a game tab on the set list): back still goes where it went. */
    fun swap(s: Screen) { trail[trail.lastIndex] = s }
    /** Collection's website pages, but for a Decks tab drawn here (Ideas, Meta decks: dev.cardstashy.nativeplay.ui.nativeDecksTab), which opens natively. */
    fun site(url: String, press: String? = null) {
        // Every Collection page's Scan tab: the native Scanner for the open game.
        if (NATIVE_SCAN && press == null && url == "https://cardstashy.com/#scan") { go(Screen.CollectionScan(dev.cardstashy.nativeplay.ui.CollectionGame.current.value.id)); return }
        val tab = if (NATIVE_DECKS) dev.cardstashy.nativeplay.ui.nativeDecksTab(url, press) else null
        if (tab != null) { dev.cardstashy.nativeplay.ui.decksOpenOn(tab); go(Screen.CollectionDecks) } else go(Screen.Web(url, press))
    }
    BackHandler(enabled = trail.size > 1) { back() }
    // Test builds: adb opens a screen or starts a match (TestHooks).
    val testAsk by TestHooks.ask.collectAsState()
    LaunchedEffect(testAsk) {
        val a = testAsk ?: return@LaunchedEffect
        TestHooks.ask.value = null
        when (a.open) {
            "home" -> go(Screen.Home); "decks" -> go(Screen.PlayDecks); "finder" -> { TestHooks.finder.value = true; if (screen != Screen.PlayDecks) go(Screen.PlayDecks) }
            "trunk" -> go(Screen.Trunk); "shop" -> go(Screen.Shop()); "achievements" -> go(Screen.Achievements()); "story" -> go(Screen.Story())
            "settings" -> go(Screen.SignIn); "collection" -> go(Screen.Collection); "quick" -> go(Screen.Lobby("quick")); "practice" -> go(Screen.Lobby("practice"))
        }
        if (a.match != null) TestHooks.pick(a)?.let { p -> TestHooks.nextSeed = a.seed; go(Screen.Home); go(Screen.Match(p)) }
    }
    /** A set badge, the card page's set and Home's sets open the native set page when it is on; null keeps the website's. */
    val setOpen: ((String) -> Unit)? = if (NATIVE_SETS) ({ code -> go(Screen.CollectionSet(code)) }) else null
    fun tabTo(t: dev.cardstashy.nativeplay.ui.PlayTab) { when (t) {
        dev.cardstashy.nativeplay.ui.PlayTab.HOME -> go(Screen.Home); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> go(Screen.Trunk)
        dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> go(Screen.PlayDecks); dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> go(Screen.Achievements())
        dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> { if (screen !is Screen.Shop) go(Screen.Shop()) }
    } }
    // Every Collection page's Search tab: the open game's native Search (back returns there when it opened this page).
    val searchOpen: (() -> Unit)? = if (NATIVE_SEARCH) ({
        val g = dev.cardstashy.nativeplay.ui.CollectionGame.current.value.id
        val prev = trail.getOrNull(trail.size - 2)
        if (prev is Screen.CollectionSearch) { back(); if (prev.game != g) swap(Screen.CollectionSearch(g)) } else go(Screen.CollectionSearch(g))
    }) else null
    // An Ask tile's deck (gap audit H3): the app's own deck page.
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.ui.CollectionWrites.deckNav = if (NATIVE_DECK) ({ id, g -> go(Screen.CollectionDeck(id, g)) }) else null }
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.ui.CollectionWrites.rulesNav = { g, learn -> go(Screen.CollectionRules(g, learn)) } }
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.ui.CollectionWrites.wikiNav = { g, t -> go(Screen.CollectionWiki(g, t)) } }
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.ui.CollectionWrites.ruleRef = { g, ref, title, quote -> go(Screen.CollectionRules(g, ref = ref, refTitle = title, refQuote = quote)) } }
    androidx.compose.runtime.CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalShopNav provides { tab -> go(Screen.Shop(tab)) }, dev.cardstashy.nativeplay.ui.LocalShopSetNav provides { code -> go(Screen.Shop("sets", code)) }, dev.cardstashy.nativeplay.ui.LocalPlayDecksNav provides { if (screen != Screen.PlayDecks) go(Screen.PlayDecks) },
        dev.cardstashy.nativeplay.ui.LocalCollectionSearch provides searchOpen) {
    // The Play theme root: every Play screen draws dark whatever the theme setting says; Collection and the shell follow it.
    remember { dev.cardstashy.nativeplay.ui.AppSettings.playSide = { presenceWhere(trail.last()).view == "play" } }
    when (val s = screen) {
        Screen.Home -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            // app.js renderPlayPage → warmPlayRandom: random decks start building in the background while Play is open.
            val warmUser = dev.cardstashy.nativeplay.account.Account.session.collectAsState().value?.userId
            LaunchedEffect(warmUser) { dev.cardstashy.nativeplay.play.RandomBuild.warm(lobbies.values.firstOrNull()?.format ?: "Commander", warmUser) }
            dev.cardstashy.nativeplay.ui.PlayHomeRoute(
                onQuickPlay = { go(Screen.Decks) }, onLobby = { if (LOBBY_LIVE) go(Screen.Lobby(it)) else go(Screen.Decks) }, onCollection = { go(Screen.Collection) },
                onSignIn = { go(Screen.SignIn) }, onWeb = { go(Screen.Web(it)) }, onTrunk = { go(Screen.Trunk) }, onDecks = { go(Screen.PlayDecks) }, onAchievements = { go(Screen.Achievements(it)) }, onStory = { go(Screen.Story()) }, onShop = { t, set -> go(Screen.Shop(t, set)) })
        }
        Screen.Trunk -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.TrunkRoute(onBack = { back() }, onWeb = { go(Screen.Web(it)) }, onSet = { go(Screen.Shop("sets", it)) }, onNav = { t ->
                when (t) { dev.cardstashy.nativeplay.ui.PlayTab.HOME -> go(Screen.Home); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> {}; dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> go(Screen.PlayDecks); dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> go(Screen.Achievements()); dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> go(Screen.Shop()) } })
        }
        Screen.PlayDecks -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.DecksRoute(onBack = { back() }, onWeb = { go(Screen.Web(it)) }, onTrunkSet = { go(Screen.TrunkSet(it)) }, onNav = { t ->
                when (t) { dev.cardstashy.nativeplay.ui.PlayTab.HOME -> go(Screen.Home); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> go(Screen.Trunk); dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> {}; dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> go(Screen.Achievements()); dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> go(Screen.Shop()) } })
        }
        is Screen.TrunkSet -> {
            // Set pages live in the Shop now (Randall 3 Nov 20:00Z); older links that name a set land there.
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.ShopRoute(onBack = { back() }, startSet = s.code, nav = { dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.SHOP, { t -> tabTo(t) }) })
        }
        is Screen.Shop -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            // Each Shop entry on the trail is its own page: a card's set link pushes Shop(set) and it opens, back returns.
            androidx.compose.runtime.key(trail.size, s) { dev.cardstashy.nativeplay.ui.ShopRoute(onBack = { back() }, startTab = s.tab, startSet = s.set, nav = { dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.SHOP, { t -> tabTo(t) }) }) }
        }
        Screen.Collection -> {
            // Collection Home is native; its other tabs and the pages it opens are still the website's.
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionHomeRoute(onPlay = { if (trail.size > 1) back() else go(Screen.Home) }, onProfile = { go(Screen.SignIn) },
                web = { url, press -> site(url, press) },
                open = { url -> if (url.startsWith("https://") || url.startsWith("http://")) runCatching { activity.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))) } },
                onCards = if (NATIVE_CARDS) ({ go(Screen.CollectionCards) }) else null, onDecks = if (NATIVE_DECKS) ({ go(Screen.CollectionDecks) }) else null,
                onDeck = if (NATIVE_DECK) ({ id, g -> go(Screen.CollectionDeck(id, g.id)) }) else null,
                // The open game's sets (tcg.js: the today-set link and #sets follow the game Home shows).
                onSet = if (NATIVE_SETS) ({ code -> go(Screen.CollectionSet(code, dev.cardstashy.nativeplay.ui.CollectionGame.current.value.id)) }) else null,
                onSets = if (NATIVE_SETS) ({ go(Screen.CollectionSets(dev.cardstashy.nativeplay.ui.CollectionGame.current.value.id)) }) else null)
        }
        Screen.CollectionCards -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionCardsRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) },
                onHome = { if (trail.getOrNull(trail.size - 2) == Screen.Collection) back() else go(Screen.Collection) },
                web = { url, press -> site(url, press) }, onDecks = if (NATIVE_DECKS) ({ go(Screen.CollectionDecks) }) else null, nativeCard = NATIVE_CARD, onSet = setOpen)
        }
        Screen.CollectionDecks -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionDecksRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) },
                onHome = { if (trail.getOrNull(trail.size - 2) == Screen.Collection) back() else go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                web = { url, press -> site(url, press) }, onDeck = if (NATIVE_DECK) ({ id, g -> go(Screen.CollectionDeck(id, g.id)) }) else null)
        }
        is Screen.CollectionDeck -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionDeckRoute(s.id, onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) },
                onBack = { if (trail.getOrNull(trail.size - 2) == Screen.CollectionDecks) back() else go(Screen.CollectionDecks) },
                onHome = { go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                // A.deckPlayCpu: the Practice lobby with this deck in your seat.
                onPractice = { id, format -> lobbies.getOrPut("practice") { dev.cardstashy.nativeplay.ui.LobbyModel("practice") }.practiceWith(id, format); go(Screen.Lobby("practice")) },
                web = { url, press -> site(url, press) }, nativeCard = NATIVE_CARD, onSet = setOpen, onDeck = { id -> go(Screen.CollectionDeck(id)) },
                game = dev.cardstashy.nativeplay.ui.CardGame.of(s.game))
        }
        is Screen.CollectionSets -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionSetsRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) }, onHome = { go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                onDecks = { if (NATIVE_DECKS) go(Screen.CollectionDecks) else go(Screen.Web("https://cardstashy.com/#decks", null)) },
                onSet = { g, code -> go(Screen.CollectionSet(code, g)) }, web = { url, press -> site(url, press) },
                game = s.game, tcg = NATIVE_TCG_SETS, onGame = { g -> dev.cardstashy.nativeplay.ui.CollectionGame.set(dev.cardstashy.nativeplay.ui.CardGame.of(g)); swap(Screen.CollectionSets(g)) })
        }
        is Screen.CollectionSearch -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionSearchRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) },
                onHome = { if (trail.getOrNull(trail.size - 2) == Screen.Collection) back() else go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                onDecks = { if (NATIVE_DECKS) go(Screen.CollectionDecks) else go(Screen.Web("https://cardstashy.com/#decks", null)) },
                onSets = { g -> if (g == "mtg" || NATIVE_TCG_SETS) go(Screen.CollectionSets(g)) else go(Screen.Web("https://cardstashy.com/#sets", "[data-act=\"setGame\"][data-game=\"$g\"]")) },
                onSet = { g, code -> go(Screen.CollectionSet(code, g)) }, web = { url, press -> site(url, press) },
                game = s.game, onGame = { g -> dev.cardstashy.nativeplay.ui.CollectionGame.set(dev.cardstashy.nativeplay.ui.CardGame.of(g)); swap(Screen.CollectionSearch(g)) },
                onRules = { g -> go(Screen.CollectionRules(g)) }, onWiki = { g, t -> go(Screen.CollectionWiki(g, t)) })
        }
        is Screen.CollectionRules -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionRulesRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) }, onHome = { go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                onDecks = { if (NATIVE_DECKS) go(Screen.CollectionDecks) else go(Screen.Web("https://cardstashy.com/#decks", null)) },
                onSearch = { go(Screen.CollectionSearch(s.game)) }, web = { url, press -> site(url, press) }, game = s.game,
                onGame = { g -> dev.cardstashy.nativeplay.ui.CollectionGame.set(dev.cardstashy.nativeplay.ui.CardGame.of(g)); swap(Screen.CollectionRules(g)) },
                onWiki = { t -> go(Screen.CollectionWiki(s.game, t)) }, startLearn = s.learn, startRef = s.ref, refTitle = s.refTitle, refQuote = s.refQuote)
        }
        is Screen.CollectionWiki -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionWikiRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) }, onHome = { go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                onDecks = { if (NATIVE_DECKS) go(Screen.CollectionDecks) else go(Screen.Web("https://cardstashy.com/#decks", null)) },
                onSearch = { go(Screen.CollectionSearch(s.game)) },
                onSets = { if (s.game == "mtg" || NATIVE_TCG_SETS) go(Screen.CollectionSets(s.game)) else go(Screen.Web("https://cardstashy.com/#sets", "[data-act=\"setGame\"][data-game=\"${s.game}\"]")) },
                web = { url, press -> site(url, press) }, game = s.game, topic = s.topic,
                onGame = { g -> dev.cardstashy.nativeplay.ui.CollectionGame.set(dev.cardstashy.nativeplay.ui.CardGame.of(g)); swap(Screen.CollectionWiki(g)) })
        }
        is Screen.CollectionScan -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionScanRoute(onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) }, onHome = { go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                onDecks = { if (NATIVE_DECKS) go(Screen.CollectionDecks) else go(Screen.Web("https://cardstashy.com/#decks", null)) },
                onSearch = { go(Screen.CollectionSearch(s.game)) },
                onSets = { if (s.game == "mtg" || NATIVE_TCG_SETS) go(Screen.CollectionSets(s.game)) else go(Screen.Web("https://cardstashy.com/#sets", "[data-act=\"setGame\"][data-game=\"${s.game}\"]")) },
                web = { url, press -> site(url, press) }, game = s.game,
                onGame = { g -> dev.cardstashy.nativeplay.ui.CollectionGame.set(dev.cardstashy.nativeplay.ui.CardGame.of(g)); swap(Screen.CollectionScan(g)) })
        }
        is Screen.CollectionSet -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.CollectionSetRoute(s.code, game = s.game, onPlay = { go(Screen.Home) }, onProfile = { go(Screen.SignIn) }, onHome = { go(Screen.Collection) },
                onCards = { if (NATIVE_CARDS) go(Screen.CollectionCards) else go(Screen.Web("https://cardstashy.com/#collection", null)) },
                onDecks = { if (NATIVE_DECKS) go(Screen.CollectionDecks) else go(Screen.Web("https://cardstashy.com/#decks", null)) },
                // "‹ All sets" goes back when the list opened this set, as the site's back does.
                onSets = { if (trail.getOrNull(trail.size - 2) == Screen.CollectionSets(s.game)) back() else go(Screen.CollectionSets(s.game)) },
                onSet = { code -> go(Screen.CollectionSet(code, s.game)) }, web = { url, press -> site(url, press) }, nativeCard = NATIVE_CARD, nativePack = NATIVE_PACK, nativeTcgCards = NATIVE_TCG_CARDS,
                // Another game's tab: its set list here when those are native, else the website's.
                onGame = { g -> dev.cardstashy.nativeplay.ui.CollectionGame.set(dev.cardstashy.nativeplay.ui.CardGame.of(g)); if (g == "mtg" || NATIVE_TCG_SETS) swap(Screen.CollectionSets(g)) else go(Screen.Web("https://cardstashy.com/#sets", "[data-act=\"setGame\"][data-game=\"$g\"]")) })
        }
        is Screen.Web -> { LaunchedEffect(s.url) { activity.inGame(false, play = s.url.contains("planeswalk")) }; CollectionScreen(onPlay = { back() }, url = s.url, press = s.press) }
        Screen.SignIn -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            // The profile orb and every "Sign in" open the site's Settings: signed out it is the account card (Log in / Create account), signed in the account hub.
            dev.cardstashy.nativeplay.ui.SettingsScreen(onBack = { back() }, onWeb = { site(it) },
                onDeck = { g, id -> go(Screen.CollectionDeck(id, g)) },
                onChallenge = { p -> lobbies.getOrPut("social") { dev.cardstashy.nativeplay.ui.LobbyModel("social") }.challenge(p); go(Screen.Lobby("social")) })
        }
        is Screen.Lobby -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            val model = lobbies.getOrPut(s.style) { dev.cardstashy.nativeplay.ui.LobbyModel(s.style) }
            dev.cardstashy.nativeplay.ui.LobbyScreen(model, onBack = { back() }, onStart = { p ->
                    // Offline play is Practice only: Quick Play's rewards need the server at the end of the match.
                    if ((p as? Pick.Table)?.quick == true && !online(activity)) android.widget.Toast.makeText(activity, "Quick Play needs a connection. Practice works offline.", android.widget.Toast.LENGTH_LONG).show()
                    else go(Screen.Match(p)) }, onOpenDecks = { go(Screen.PlayDecks) },
                onSignIn = { go(Screen.SignIn) }, onFriends = { go(Screen.Lobby("social")) },
                onOpenSaved = { dev.cardstashy.nativeplay.ui.deckOpensOn("mtg", it, "cards"); go(Screen.CollectionDeck(it)) })
        }
        Screen.Decks -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            DeckPickScreen(onPick = { go(Screen.Match(it)) }, onBack = { back() },
                onSignIn = { go(Screen.SignIn) })
        }
        is Screen.Story -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.StoryRoute(startAct = s.act, onBack = { back() }, onDuel = { go(Screen.Match(it)) })
        }
        is Screen.Achievements -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            dev.cardstashy.nativeplay.ui.AchievementsRoute(onBack = { back() }, startTab = s.tab, nav = {
                dev.cardstashy.nativeplay.ui.PlayNav(dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES, { t ->
                    when (t) { dev.cardstashy.nativeplay.ui.PlayTab.HOME -> go(Screen.Home); dev.cardstashy.nativeplay.ui.PlayTab.TRUNK -> go(Screen.Trunk); dev.cardstashy.nativeplay.ui.PlayTab.DECKS -> go(Screen.PlayDecks); dev.cardstashy.nativeplay.ui.PlayTab.TROPHIES -> {}; dev.cardstashy.nativeplay.ui.PlayTab.SHOP -> go(Screen.Shop()) } })
            })
        }
        is Screen.Match -> MatchFlow(activity, s.pick, onHome = { if ((s.pick as? Pick.Table)?.story != null) back() else go(Screen.Home) }, onDecks = { back() })
    }
    }
    // Live achievement toasts (drawn over the app in setContent): at the table they sit just under the status bar; a tap opens the deed's tab.
    // Rich presence (play-presence.js): what the app shows now, beats only while the app is in front.
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.play.Presence.where = presenceWhere(screen) }
    val presenceUser = dev.cardstashy.nativeplay.account.Account.session.collectAsState().value?.userId
    LaunchedEffect(presenceUser) { if (presenceUser != null) dev.cardstashy.nativeplay.play.Presence.start() else dev.cardstashy.nativeplay.play.Presence.stop() }
    androidx.lifecycle.compose.LifecycleEventEffect(androidx.lifecycle.Lifecycle.Event.ON_START) { dev.cardstashy.nativeplay.play.Presence.shown(true) }
    androidx.lifecycle.compose.LifecycleEventEffect(androidx.lifecycle.Lifecycle.Event.ON_STOP) { dev.cardstashy.nativeplay.play.Presence.visible = false }
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.ui.AchievementToasts.overTable = screen is Screen.Match; dev.cardstashy.nativeplay.ui.AchievementToasts.open = { tab -> go(Screen.Achievements(tab)) } }
    // System bar icons follow the theme the page draws in (enableEdgeToEdge's default follows the system's night mode, not ours):
    // dark icons on Light; Play is always dark (U12: a white clock on the Light rail).
    val lightBars = dev.cardstashy.nativeplay.ui.AppSettings.theme == "light"
    androidx.compose.runtime.SideEffect { androidx.core.view.WindowCompat.getInsetsController(activity.window, activity.window.decorView).run { isAppearanceLightStatusBars = lightBars; isAppearanceLightNavigationBars = lightBars } }
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
    // Story: the intro scene plays over the match as it loads (a rematch has none). The table stays behind the scene, so
    // nothing of the match shows and the CPU cannot act (Forge waits on your keep) until the scene ends or is skipped.
    val story = (pick as? Pick.Table)?.story
    val outcome = remember { dev.cardstashy.nativeplay.ui.StoryOutcome() }
    var scene by remember { mutableStateOf(story?.let { c -> (if (c.firstVisit) c.intro else emptyList()) + (c.battle.get("scene")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asJsonObject } ?: emptyList()) +
        (if (c.seat == "villain") c.battle.get("villainScene")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asJsonObject } ?: emptyList() else emptyList()) }?.takeIf { it.isNotEmpty() }) }
    val sceneOn = scene != null && setup !is QuickPlay.Setup.Unknown && setup !is QuickPlay.Setup.Failed
    Box {
    when (val s = setup) {
        null -> VersusScreen(Plate(pick.name, "You", pick.face), null)
        is QuickPlay.Setup.Unknown -> { LaunchedEffect(Unit) { activity.inGame(false) }; Problem("Forge doesn’t know ${if (s.names.size == 1) "this card" else "these ${s.names.size} cards"} yet",
            s.names.joinToString("\n") + "\n\nThis deck can’t be played until they’re added to the rules. Pick another deck for now.", onDecks) }
        is QuickPlay.Setup.Failed -> { LaunchedEffect(Unit) { activity.inGame(false) }; Problem("Couldn’t start the match", s.reason, onDecks) }
        is QuickPlay.Setup.Ready -> Table(activity, s, t0, onHome, pick, holdForScene = sceneOn, outcome = outcome)
    }
    if (story != null) {
        val c = story
        dev.cardstashy.nativeplay.ui.StoryBubbleLayer(outcome.bubbles, c.cast, c.avatarUrl)
        if (sceneOn) dev.cardstashy.nativeplay.ui.StoryScene(scene!!, c.cast, dev.cardstashy.nativeplay.match.storyWho(c.battle, "hero"), dev.cardstashy.nativeplay.match.storyWho(c.battle, "villain"), c.avatarUrl, dev.cardstashy.nativeplay.match.storyTitle(c.battle)) { scene = null }
        outcome.ending?.let { lines -> dev.cardstashy.nativeplay.ui.StoryScene(lines, c.cast, dev.cardstashy.nativeplay.match.storyWho(c.battle, "hero"), dev.cardstashy.nativeplay.match.storyWho(c.battle, "villain"), c.avatarUrl,
            if (c.battle.get("slot")?.takeIf { it.isJsonPrimitive }?.asInt == 8) "Act ${c.act} finale" else dev.cardstashy.nativeplay.match.storyTitle(c.battle)) { outcome.ending = null } }
    }
    }
}

@Composable
private fun Table(activity: MainActivity, s: QuickPlay.Setup.Ready, t0: Long, onHome: () -> Unit, pick: Pick, holdForScene: Boolean = false, outcome: dev.cardstashy.nativeplay.ui.StoryOutcome? = null) {
    var round by remember { mutableIntStateOf(0) }
    key(round) {
        val context = LocalContext.current
        val scope = rememberCoroutineScope()
        val bubbles = remember { (pick as? Pick.Table)?.story?.let { dev.cardstashy.nativeplay.play.StoryBubbles(it.battle, it.seat) } }
        val controller = remember { MatchController(scope, s.input, (pick as? Pick.Friend)?.let { f -> { dev.cardstashy.nativeplay.match.RemoteSession(f.matchId) } }).apply { onFinished = { st, f, ms -> reportMatch(context, pick, st, f, ms, conceded); (pick as? Pick.Table)?.story?.let { c -> outcome?.let { o -> storyFinished(scope, context, c, st, f, o, bubbles) } } } } }
        var versus by remember { mutableStateOf(round == 0) }
        DisposableEffect(Unit) { activity.inGame(true); controller.start(); onDispose { controller.close() } }
        if (round == 0) LaunchedEffect(Unit) {
            // Art and engine load side by side. The beat has been on screen since the pick (t0), so its 0.9 s counts from there,
            // not from now (U2); the CPU's plate still gets 0.4 s before the table opens.
            val minBeat = launch { delay(if ((pick as? Pick.Table)?.story != null) 0 else maxOf(400L, 900L - (SystemClock.elapsedRealtime() - t0))) }
            // Backstop (Randall 14 Nov: the table never opened): the screen stops waiting at the cap whatever the gate is still doing.
            val gate = QuickPlay.gateAsync(context, s, controller.firstHand)
            if (kotlinx.coroutines.withTimeoutOrNull(QuickPlay.GATE_CAP_MS + 500) { gate.await() } == null) android.util.Log.i("Speed", "art gate passed its cap; the table opens and art loads behind")
            minBeat.join(); versus = false
        }
        // Pick to table, one line per phase from the same start as the Speed line, so a slow run shows which step took the time (U2).
        if (round == 0) LaunchedEffect(Unit) {
            fun at() = SystemClock.elapsedRealtime() - t0
            android.util.Log.i("Speed", "setup done at ${at()} ms")
            launch { controller.firstHand.first { it != null }; android.util.Log.i("Speed", "opening hand dealt at ${at()} ms") }
            launch { androidx.compose.runtime.snapshotFlow { versus }.first { !it }; android.util.Log.i("Speed", "versus beat ends at ${at()} ms") }
            launch { controller.stage.first { it == dev.cardstashy.nativeplay.match.Stage.TOSS }; android.util.Log.i("Speed", "toss ready (Forge asked for the keep) at ${at()} ms") }
        }
        // V5: the table is ready when it takes over from the beat: the coin toss on screen (its own show), else the first board.
        // A rematch counts from its own start (no versus beat) under its own key.
        val tRound = remember { if (round == 0) t0 else SystemClock.elapsedRealtime() }
        val holding by androidx.compose.runtime.rememberUpdatedState(versus || holdForScene)
        LaunchedEffect(Unit) {
            kotlinx.coroutines.flow.combine(controller.stage, controller.shown, androidx.compose.runtime.snapshotFlow { holding }) { st, sh, h ->
                !h && (st == dev.cardstashy.nativeplay.match.Stage.TOSS || sh != null) }.first { it }
            Speed.record(if (round > 0) Speed.REMATCH else if (s.known) Speed.KNOWN else Speed.NEW, SystemClock.elapsedRealtime() - tRound)
            controller.shown.first { it != null }; android.util.Log.i("Speed", "opening hand on screen at ${SystemClock.elapsedRealtime() - tRound} ms")
        }
        if (bubbles != null && outcome != null) LaunchedEffect(Unit) { controller.shown.filterNotNull().collect { st -> bubbles.update(st).forEach { outcome.bubbles.add(it) } } }
        // Story lessons (story-lessons.js): the Rift's whispers on your side of a Story match, fed only what the table shows while play is on.
        val lessons = remember { (pick as? Pick.Table)?.story?.takeIf { it.seat == "hero" }?.let { c -> dev.cardstashy.nativeplay.ui.LessonTable(context, c.lessonBattle, c.seat) } }
        if (lessons != null) LaunchedEffect(Unit) { controller.shown.filterNotNull().collect { st ->
            when (controller.stage.value) { dev.cardstashy.nativeplay.match.Stage.PLAYING -> lessons.update(st); dev.cardstashy.nativeplay.match.Stage.FINISHED, dev.cardstashy.nativeplay.match.Stage.FAILED -> lessons.destroy(); else -> {} }
        } }
        // The Story scene over the table holds the clock and the first turn.
        LaunchedEffect(holdForScene) { controller.setScene(holdForScene) }
        BackHandler(!holdForScene) { /* the table's menu has Leave; Back never drops a match by accident. Off under a Story scene so B skips it (U14a). */ }
        // E3c: a choice the app cannot play ended this match as no result; nothing was recorded.
        val noResult by controller.noResult.collectAsState()
        if (noResult != null) { LaunchedEffect(Unit) { activity.inGame(false) }; NoResult(noResult!!, onHome) }
        else if (versus || holdForScene) VersusScreen(s.you, s.cpu, intro = false, preparing = versus) else Box {
          androidx.compose.runtime.CompositionLocalProvider(dev.cardstashy.nativeplay.ui.LocalLessonGlow provides (lessons?.glow ?: emptySet())) {
          TableScreen(controller, onHome = onHome, onRematch = { round++ }, resultNote = outcome?.note, cpuPlate = s.cpu, youPlate = s.you,
            mat = (pick as? Pick.Table)?.story?.let { c -> remember { dev.cardstashy.nativeplay.ui.StoryMats.forBattle(context, c.act, c.battle.get("slot")?.takeIf { it.isJsonPrimitive }?.asInt, c.battle.get("kind")?.takeIf { it.isJsonPrimitive }?.asString) } },
            storyMusic = (pick as? Pick.Table)?.story?.let { dev.cardstashy.nativeplay.audio.TableMusic.StoryMusic(it.act, it.battle.get("mood")?.takeIf { m -> m.isJsonPrimitive }?.asString, it.battle.get("kind")?.takeIf { m -> m.isJsonPrimitive }?.asString) })
          }
          lessons?.let { dev.cardstashy.nativeplay.ui.LessonWhisper(it) }
        }
    }
}

/** app.js storyPlay finished(): a win claims the battle (server-paid), the result gets its note, and the ending scene plays 2.6 s later. */
private fun storyFinished(scope: kotlinx.coroutines.CoroutineScope, context: android.content.Context, c: dev.cardstashy.nativeplay.match.StoryCtx, st: dev.cardstashy.nativeplay.engine.MatchState, f: dev.cardstashy.nativeplay.play.MatchFacts, o: dev.cardstashy.nativeplay.ui.StoryOutcome,
                          bubbles: dev.cardstashy.nativeplay.play.StoryBubbles?) {
    if (st.draw || st.winnerPlayerId == null) return
    val win = st.winnerPlayerId == st.viewer
    bubbles?.finish(win)?.forEach { o.bubbles.add(it) }
    if (!win) return
    val facts = f.snapshot(f.ownFirst)
    val b = c.battle; val id = b["id"].asString
    scope.launch {
        val out = dev.cardstashy.nativeplay.play.Progress.claimStory(id, c.seat, if (c.own) "own" else "loaner")
        // Story deeds: what this win earned; the server re-checks and pays each once, and the in-app pop-up fires from the refreshed achievements.
        runCatching {
            val refs = out?.getAsJsonArray("refs")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString } ?: emptyList()
            val deeds = dev.cardstashy.nativeplay.play.StoryDeeds.load(context).earned(id, c.seat, c.own, facts, refs)
            if (deeds.isNotEmpty()) scope.launch { dev.cardstashy.nativeplay.play.Progress.reportDeeds(id, deeds) }
        }
        val paid = out?.getAsJsonArray("paid")?.map { it.asString } ?: emptyList()
        val won = !c.own && paid.contains("story:$id:${if (c.seat == "villain") "villain" else "loaner"}")
        val coll = paid.contains("story:$id:collector")
        val rw = b.getAsJsonObject("reward")?.getAsJsonObject(if (c.seat == "villain") "villain" else "hero")
        val sets = dev.cardstashy.nativeplay.play.PlayRules.load(context).setNames
        o.note = when {
            won -> dev.cardstashy.nativeplay.play.StoryLogic.rewardText(rw, b["rewardSet"].asString, sets) + (if (coll) " and a Collector pack" else "") + " added"
            coll -> "A Collector pack added"
            out?.get("error") != null -> out.get("error").asString
            c.own -> "Your own deck earns XP. Win with the Story deck for the reward."
            else -> "Reward already claimed"
        }
        val ending = if (b["slot"].asInt == 8) (if (c.seat == "hero") c.finale else c.villainFinale) else b.get("after")?.takeIf { it.isJsonArray }?.asJsonArray?.map { it.asJsonObject } ?: emptyList()
        if (ending.isNotEmpty()) { delay(2600); o.ending = ending }
    }
}

/** play-forge-player-mat.js matchRow + the play:match-recorded detail: one finished match for quests and achievements. */
/** app.js presence read(): {view, playView, match} for the screen on show. Collection and the web pages are "In CardStashy". */
private fun presenceWhere(s: Screen): dev.cardstashy.nativeplay.play.Presence.Where = when (s) {
    is Screen.Match -> dev.cardstashy.nativeplay.play.Presence.Where("play", "", dev.cardstashy.nativeplay.play.Presence.Match(if (s.pick is Pick.Friend) "friend" else if ((s.pick as? Pick.Table)?.quick == false) "practice" else "quick", s.pick.format))
    Screen.Home -> dev.cardstashy.nativeplay.play.Presence.Where("play", "home")
    is Screen.Lobby, Screen.Decks -> dev.cardstashy.nativeplay.play.Presence.Where("play", "lobby")
    Screen.PlayDecks -> dev.cardstashy.nativeplay.play.Presence.Where("play", "decks")
    Screen.Trunk, is Screen.TrunkSet -> dev.cardstashy.nativeplay.play.Presence.Where("play", "collection")
    is Screen.Shop -> dev.cardstashy.nativeplay.play.Presence.Where("play", if (s.tab == "packs") "packs" else "shop")
    is Screen.Achievements -> dev.cardstashy.nativeplay.play.Presence.Where("play", "deeds")
    is Screen.Story -> dev.cardstashy.nativeplay.play.Presence.Where("play", "story")
    else -> dev.cardstashy.nativeplay.play.Presence.Where("app")
}

/** Any validated internet connection right now. */
private fun online(context: android.content.Context): Boolean = runCatching {
    val cm = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
    cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
}.getOrDefault(true)

private fun reportMatch(context: android.content.Context, pick: Pick, st: dev.cardstashy.nativeplay.engine.MatchState, f: dev.cardstashy.nativeplay.play.MatchFacts, durationMs: Long?, conceded: Boolean) {
    val outcome = when { st.draw -> "draw"; st.winnerPlayerId == null -> return; st.winnerPlayerId == st.viewer -> "win"; else -> "loss" }
    val table = pick as? Pick.Table
    val me = st.players.firstOrNull { it.id == st.viewer }; val them = st.players.firstOrNull { it.id != st.viewer }
    // play-match-record.js recordMatch (matchRow): this device's record. Quick Play, Story and friend matches are the site's 'quick'.
    runCatching { dev.cardstashy.nativeplay.play.MatchRecord.record(context, dev.cardstashy.nativeplay.account.Account.session.value?.userId, outcome, pick.raw,
        table?.cpu ?: com.google.gson.JsonObject().apply { addProperty("name", "Friend's deck") }, pick.format,
        if (table == null || table.quick || table.story != null) "quick" else "practice", f.ownFirst, st.turn.takeIf { it > 0 }, me?.life, them?.life, durationMs, conceded && outcome == "loss") }
    // basicColours: the basic lands in your main deck.
    val map = mapOf("plains" to "W", "island" to "U", "swamp" to "B", "mountain" to "R", "forest" to "G")
    val got = (pick.raw.getAsJsonArray("cards") ?: com.google.gson.JsonArray()).mapNotNull { e -> val o = e as? com.google.gson.JsonObject ?: return@mapNotNull null
        if (o.get("board")?.takeIf { it.isJsonPrimitive }?.asString == "side") null else map[(o.get("name")?.asString ?: "").lowercase().removePrefix("snow-covered ")] }.toSet()
    val facts = f.snapshot(f.ownFirst)
    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
        dev.cardstashy.nativeplay.play.Progress.reportMatch(mode = if (table == null || table.quick) "quick" else "practice", outcome = outcome, format = pick.format,
            turns = st.turn.takeIf { it > 0 }, life = me?.life, opponentLife = them?.life, onPlay = f.ownFirst, durationMs = durationMs,
            colors = "WUBRG".filter { it.toString() in got }, seats = st.players.size.takeIf { it > 0 }, difficulty = table?.level ?: "Medium", facts = facts)
    }
}

/** The no-result end (E3c): the one line and the way back. X or the button leaves. */
@Composable
private fun NoResult(text: String, onBack: () -> Unit) {
    dev.cardstashy.nativeplay.ui.PadScreen(remember(onBack) { dev.cardstashy.nativeplay.ui.PadActs(x = dev.cardstashy.nativeplay.ui.PadAct("Leave match", onBack), opaque = true) })
    BackHandler(onBack = onBack)
    Box(Modifier.fillMaxSize().background(dev.cardstashy.nativeplay.ui.Site.Bg).windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 460.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text, style = dev.cardstashy.nativeplay.ui.Rule.Type.S16, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            dev.cardstashy.nativeplay.ui.GoldCta("Leave match", onClick = onBack)
        }
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
