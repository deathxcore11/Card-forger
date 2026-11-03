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
import androidx.compose.ui.platform.LocalContext
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.SetFacts
import kotlinx.coroutines.launch

private const val SITE_PLAY = "https://cardstashy.com/#play"

/**
 * Play mode's root: the native Play home on the account's /api/progress state (the device copy
 * first, then the server's), with the day's log-in stamp and Story progress like the web asks for
 * them. Signed out, the old home with its sign-in panel. Pages not ported yet open the site's own.
 */
@Composable
fun PlayHomeRoute(onQuickPlay: () -> Unit, onCollection: () -> Unit, onSignIn: () -> Unit, onWeb: (String) -> Unit) {
    val session by Account.session.collectAsState()
    val profile by Account.profile.collectAsState()
    val state by Progress.state.collectAsState()
    val refs by Progress.storyRefs.collectAsState()
    val deeds by Progress.deeds.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    if (session == null) { HomeScreen(onQuickPlay = onQuickPlay, onCollection = onCollection, onSignIn = onSignIn); return }
    LaunchedEffect(session?.userId) {
        Progress.loadCached()
        Progress.refresh(); Progress.login(); Progress.refreshStory(); Progress.refreshDeeds()
    }
    val rules = PlayRules.load(context)
    // Wrapper art and set names for every set the page shows (the web's facts.ensure).
    LaunchedEffect(state) {
        val s = state ?: return@LaunchedEffect
        val codes = buildList {
            s.getAsJsonArray("packs")?.forEach { (it as? JsonObject)?.get("set")?.asString?.let(::add) }
            s.getAsJsonArray("shop")?.take(12)?.forEach { (it as? JsonObject)?.get("code")?.asString?.let(::add) }
            s.getAsJsonArray("cards")?.forEach { c -> (c as? JsonObject)?.getAsJsonArray("s")?.forEach { add(it.asString) } }
            rules.acts.forEach { a -> a.sets.forEach { add(it.first) } }
        }
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
    if (s == null) {
        Box(Modifier.fillMaxSize().playBackdrop(), contentAlignment = Alignment.Center) { Text("Opening your binder…", style = Type.Body) }
        return
    }
    val tz = java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000
    val story = PlayMath.storyHome(refs ?: emptyList(), rules.acts.size)
    fun setName(code: String) = s.getAsJsonArray("shop")?.firstNotNullOfOrNull { (it as? JsonObject)?.takeIf { o -> o["code"]?.asString == code }?.get("name")?.asString }
        ?: SetFacts.set(code)?.name ?: code.uppercase()
    // Opening: the server rolls the pack, then the opener plays it (app.js playEconOpen).
    suspend fun openOne(id: String): PackResult? = runCatching { Progress.open(id) }.getOrNull()?.let { out ->
        packResult(out, setName(out.getAsJsonObject("pack")?.get("set")?.asString ?: "")) }
    fun run(block: suspend () -> Unit) { scope.launch { block(); Progress.refresh(); Progress.refreshDeeds() } }
    val act = PlayHomeActions(
        mode = { when (it) { "quick", "practice" -> onQuickPlay(); "planeswalk" -> onWeb("https://cardstashy.com/planeswalk.html"); else -> onWeb(SITE_PLAY) } },
        story = { onWeb(SITE_PLAY) },
        view = { onWeb(SITE_PLAY) },
        claim = { kind, id -> run { Progress.claim(kind, id, null) } },
        claimDeed = { id, step -> run { Progress.claim("ach", id, step) } },
        forge = { to, times -> run { Progress.forge(to, times) } },
        openPack = { id -> scope.launch { opener = openOne(id) } },
        buy = { code -> run { Progress.buy(code) } },
        deck = { onWeb(SITE_PLAY) },
        set = { onWeb(SITE_PLAY) },
    )
    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
    PlayHome(PlayHomeData(s, rules, story, PlayMath.playDay(tz), session?.userId ?: "", ambient, deeds),
        top = { TopBarItems(Mode.PLAY, profile?.avatarUrl, profile?.name, unread = false, onSwitch = onCollection, onProfile = onSignIn) },
        act = act,
        nav = { PlayNav(null, { t -> if (t == PlayTab.SWITCH) onCollection() else onWeb(SITE_PLAY) }) })
    opener?.let { first ->
        val close = { opener = null; scope.launch { Progress.refresh(); Progress.refreshDeeds() }; Unit }
        androidx.activity.compose.BackHandler(onBack = close)
        PackOpening(first, onNext = {
            val left = Progress.state.value?.getAsJsonArray("packs")?.mapNotNull { it as? JsonObject }.orEmpty()
            val nx = left.firstOrNull { it["set"]?.asString == first.set } ?: left.firstOrNull()
            nx?.get("id")?.asString?.let { openOne(it) }
        }, onClose = close)
    }
    }
}
