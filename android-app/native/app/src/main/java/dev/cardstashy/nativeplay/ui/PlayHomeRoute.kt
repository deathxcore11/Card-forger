package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.SetFacts
import kotlinx.coroutines.launch

internal const val SITE_PLAY = "https://cardstashy.com/#play"

/**
 * Play mode's root: the native Play home on the account's /api/progress state (the device copy
 * first, then the server's), with the day's log-in stamp and Story progress like the web asks for
 * them. Signed out, the old home with its sign-in panel. Pages not ported yet open the site's own.
 */
@Composable
fun PlayHomeRoute(onQuickPlay: () -> Unit, onLobby: (String) -> Unit = { onQuickPlay() }, onCollection: () -> Unit, onSignIn: () -> Unit, onWeb: (String) -> Unit, onTrunk: () -> Unit = {}, onDecks: () -> Unit = {}, onStory: () -> Unit = {}, onAchievements: (String?) -> Unit = {}, onShop: (tab: String, set: String?) -> Unit = { _, _ -> }) {
    val session by Account.session.collectAsState()
    val profile by Account.profile.collectAsState()
    val state by Progress.state.collectAsState()
    val refs by Progress.storyRefs.collectAsState()
    val deeds by Progress.deeds.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    if (session == null) {
        SignedOutHome(PlayRules.load(context), top = { TopBarItems(Mode.PLAY, null, null, unread = false, onSwitch = onCollection, onProfile = onSignIn) }, onQuickPlay = onQuickPlay, onSignIn = onSignIn)
        return
    }
    // The day's log-in reward shows once, as a pop-up, on the first visit of the day (fresh from the server).
    var daily by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<JsonObject?>(null) }
    LaunchedEffect(session?.userId) {
        Progress.loadCached()
        Progress.refresh()
        Progress.login()?.takeIf { it.get("fresh")?.let { f -> f.isJsonPrimitive && f.asBoolean } == true }?.let { daily = it }
        Progress.refreshStory(); Progress.refreshDeeds()
    }
    val rules = PlayRules.load(context)
    // Wrapper art and set names for the sets this page shows (the web's facts.ensure); the Trunk asks for its own.
    LaunchedEffect(state, refs) {
        val s = state ?: return@LaunchedEffect
        val codes = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { buildList {
            // The Story card's packs first: they are the first thing on the page.
            val now = PlayMath.storyHome(refs ?: emptyList(), rules.acts.size).act
            rules.acts.firstOrNull { it.act == now }?.packs?.forEach { add(it.first) }
            (s.get("packs") as? JsonArray)?.forEach { (it as? JsonObject)?.get("set")?.takeIf { e -> e.isJsonPrimitive }?.asString?.let(::add) }
            (s.get("shop") as? JsonArray)?.take(12)?.forEach { (it as? JsonObject)?.get("code")?.takeIf { e -> e.isJsonPrimitive }?.asString?.let(::add) }
            rules.acts.forEach { a -> a.sets.forEach { add(it.first) } }
        }.distinct() }
        SetFacts.ensure(codes)
    }
    // The site's glass ambient: today's card (the Collection home's hero), blurred behind Play.
    val ambient by androidx.compose.runtime.produceState<String?>(null) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching { (dev.cardstashy.nativeplay.account.Http.call("GET", "https://cardstashy.com/api/daily-card?game=mtg") as? JsonObject)
                ?.getAsJsonObject("card")?.get("art")?.asString }.getOrNull()
        }
    }
    var opener by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<PackResult?>(null) }
    val s = state
    // E6a: how long Play Home took from opening to its first drawn frame with the binder in hand (one log line per open).
    val openedAt = androidx.compose.runtime.remember { android.os.SystemClock.elapsedRealtime() }
    if (s != null) LaunchedEffect(Unit) { androidx.compose.runtime.withFrameNanos { }; val ms = android.os.SystemClock.elapsedRealtime() - openedAt; if (HomeStart.ms == null) HomeStart.ms = ms; android.util.Log.i("CardStashy", "home first frame $ms ms") }
    if (s == null) {
        Box(Modifier.fillMaxSize().playBackdrop(), contentAlignment = Alignment.Center) { StateLoading("Opening your binder…") }
        return
    }
    val tz = java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000
    val story = PlayMath.storyHome(refs ?: emptyList(), rules.acts.size)
    fun setName(code: String) = (s.get("shop") as? JsonArray)?.firstNotNullOfOrNull { (it as? JsonObject)?.takeIf { o -> o["code"]?.asString == code }?.get("name")?.asString }
        ?: SetFacts.set(code)?.name ?: code.uppercase()
    // Opening: the server rolls the pack, then the opener plays it (app.js playEconOpen).
    var why: String? = null
    suspend fun openOne(id: String): PackResult? = runCatching { Progress.open(id) }.onFailure { why = it.message }.getOrNull()?.let { out ->
        runCatching { packResult(out, setName((out.get("pack") as? JsonObject)?.get("set")?.asString ?: "")) }.onFailure { why = "Your pack opened. Find the cards in Trunk." }.getOrNull() }
    // Progress rethrows a refused claim or buy; say why, as the Shop does, instead of letting it end the app.
    fun run(block: suspend () -> Unit) { scope.launch {
        try { block() } catch (e: kotlinx.coroutines.CancellationException) { throw e }
        catch (e: Exception) { android.widget.Toast.makeText(context, e.message ?: "Try again in a moment.", android.widget.Toast.LENGTH_LONG).show() }
        runCatching { Progress.refresh(); Progress.refreshDeeds() }
    } }
    val act = PlayHomeActions(
        mode = { when (it) { "quick", "practice", "social" -> onLobby(it); "planeswalk" -> onWeb("https://cardstashy.com/planeswalk.html"); else -> onWeb(SITE_PLAY) } },
        story = { onStory() },
        view = { when (it) { "switch" -> onCollection(); "collection" -> onTrunk(); "decks" -> onDecks(); "deeds" -> onAchievements(null); "quests" -> onAchievements("quests"); "shop" -> onShop("sets", null); "packs" -> onShop("packs", null); "forge" -> onShop("forge", null); else -> onWeb(SITE_PLAY) } },
        claim = { kind, id -> run { Progress.claim(kind, id, null) } },
        claimDeed = { id, step -> run { Progress.claim("ach", id, step) } },
        forge = { to, times -> run { Progress.forge(to, times) } },
        openPack = { id ->
            // The pack is on screen the instant it is tapped and gathers power while the server rolls it.
            if (opener == null) {
                val code = (s.get("packs") as? JsonArray)?.firstNotNullOfOrNull { (it as? JsonObject)?.takeIf { o -> o["id"]?.asString == id }?.get("set")?.asString } ?: ""
                opener = loadingPack(code, setName(code))
                scope.launch { val r = openOne(id); if (opener?.note == LOADING) { opener = r; if (r == null) android.widget.Toast.makeText(context, why ?: "That pack didn't open. Try again in a moment.", android.widget.Toast.LENGTH_LONG).show() } }
            } },
        buy = { code -> run { Progress.buy(code) } },
        deck = { onWeb(SITE_PLAY) },
        set = { onShop("sets", it) },
    )
    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
    // .pack-dialog::backdrop: #05060be6 over a 16 px blur of the page.
    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().then(if (opener != null) Modifier.blur(16.dp) else Modifier)) {
    PlayHome(PlayHomeData(s, rules, story, PlayMath.playDay(tz), session?.userId ?: "", ambient, deeds),
        top = { TopBarItems(Mode.PLAY, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onCollection, onProfile = onSignIn) },
        act = act,
        nav = { PlayNav(PlayTab.HOME, { t -> when (t) { PlayTab.HOME -> {}; PlayTab.TRUNK -> onTrunk(); PlayTab.DECKS -> onDecks(); PlayTab.TROPHIES -> onAchievements(null); PlayTab.SHOP -> onShop("sets", null) } }) })
    }
    daily?.let { LoginRewardPopup(it, rules.loginWeek) { daily = null } }
    opener?.let { first ->
        val close = { opener = null; scope.launch { Progress.refresh(); Progress.refreshDeeds() }; Unit }
        androidx.activity.compose.BackHandler(onBack = close)
        PackOpening(first, onNext = {
            val left = (Progress.state.value?.get("packs") as? JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()
            val nx = left.firstOrNull { it["set"]?.asString == first.set } ?: left.firstOrNull()
            nx?.get("id")?.asString?.let { openOne(it) }
        }, onClose = close)
    }
    }
}

/** E6a: how long Play Home took to its first drawn frame the first time it opened in this run (Settings, Help shows it). */
object HomeStart { @Volatile var ms: Long? = null }
