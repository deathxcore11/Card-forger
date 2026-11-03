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
import dev.cardstashy.nativeplay.match.DemoDeck
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.ui.DeckPickScreen
import dev.cardstashy.nativeplay.ui.HomeScreen
import dev.cardstashy.nativeplay.ui.TableScreen
import dev.cardstashy.nativeplay.ui.VersusScreen
import kotlinx.coroutines.delay

private sealed interface Screen {
    data object Home : Screen
    data object Decks : Screen
    data class Match(val you: DemoDeck, val cpu: DemoDeck) : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // The card database starts loading as the app opens, so it is ready before Quick Play is.
        ForgeService.prepare(this)
        setContent { App(this) }
    }

    /** Games lock landscape like a video game; menus turn freely (standing rule, 2 Nov). */
    fun inGame(on: Boolean) {
        requestedOrientation = if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        val c = WindowCompat.getInsetsController(window, window.decorView)
        if (on) { c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE; c.hide(WindowInsetsCompat.Type.systemBars()) }
        else c.show(WindowInsetsCompat.Type.systemBars())
        if (on) window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}

@Composable
private fun App(activity: MainActivity) {
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    when (val s = screen) {
        Screen.Home -> { LaunchedEffect(Unit) { activity.inGame(false) }; HomeScreen(onQuickPlay = { screen = Screen.Decks }) }
        Screen.Decks -> {
            LaunchedEffect(Unit) { activity.inGame(false) }
            BackHandler { screen = Screen.Home }
            val decks = DemoDecks.load(LocalContext.current)
            DeckPickScreen(onPick = { you -> screen = Screen.Match(you, decks.decks.first { it.id != you.id }) }, onBack = { screen = Screen.Home })
        }
        is Screen.Match -> MatchFlow(activity, s.you, s.cpu, onHome = { screen = Screen.Home })
    }
}

@Composable
private fun MatchFlow(activity: MainActivity, you: DemoDeck, cpu: DemoDeck, onHome: () -> Unit) {
    var round by remember { mutableIntStateOf(0) }
    key(round) {
        val context = LocalContext.current
        val scope = rememberCoroutineScope()
        val controller = remember { MatchController(scope, DemoDecks.load(context).matchInput(you, cpu)) }
        var versus by remember { mutableStateOf(true) }
        DisposableEffect(Unit) { activity.inGame(true); controller.start(); onDispose { controller.close() } }
        // The versus beat covers the engine opening the match (art is bundled, so the art gate is already met).
        LaunchedEffect(Unit) { delay(1500); versus = false }
        BackHandler { /* the table's menu has Leave; Back never drops a match by accident */ }
        if (versus) VersusScreen(you, cpu) else TableScreen(controller, onHome = onHome, onRematch = { round++ })
    }
}
