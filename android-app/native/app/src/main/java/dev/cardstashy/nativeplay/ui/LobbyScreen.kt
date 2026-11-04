package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.engine.ForgeService
import dev.cardstashy.nativeplay.match.EngineNames
import dev.cardstashy.nativeplay.match.MetaDecks
import dev.cardstashy.nativeplay.match.Pick
import dev.cardstashy.nativeplay.match.QuickOpponent
import dev.cardstashy.nativeplay.play.CardFacts
import kotlinx.coroutines.delay
import androidx.compose.ui.platform.LocalDensity
import dev.cardstashy.nativeplay.play.FriendRooms
import dev.cardstashy.nativeplay.play.Decks as PlayRules
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.RandomBuild
import dev.cardstashy.nativeplay.play.TableDecks
import dev.cardstashy.nativeplay.play.PlayDeckImport
import dev.cardstashy.nativeplay.play.PlayDeckSaver
import dev.cardstashy.nativeplay.play.Trunk
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import dev.cardstashy.nativeplay.account.Decks as Workspace

/**
 * The Quick Play and Practice lobby, play-menu.js playMenuMarkup (lobby view) with app.js's handlers:
 * the head (back, format sheet, Invite a friend in Practice), the two seats with the VS medallion, the start
 * bar (status, CPU level in Practice, the gold plate), and the deck browser for the seat being filled.
 * Quick Play lists only your decks (Play + Collection) and greys out any deck missing Trunk cards
 * (Randall 3 Nov 22:31Z-23:06Z); Practice browses Mine / Precons / Community / Meta / Random for either seat.
 */

// ---------------------------------------------------------------- model (play-setup.js, the parts the lobby reads)

/** A deck in a seat: [raw] is the whole list ({name, format, commander, cards, side}); [source] "saved" or a source kind. */
data class SeatDeck(val raw: JsonObject, val source: String) {
    private fun s(k: String) = raw.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
    val id get() = s("id"); val name get() = s("name").ifBlank { "Untitled deck" }; val format get() = s("format"); val commander get() = s("commander")
    val count get() = raw.getAsJsonArray("cards")?.sumOf { (it as? JsonObject)?.get("qty")?.takeIf { q -> q.isJsonPrimitive }?.asDouble?.toInt() ?: 0 } ?: 0
    val side get() = raw.getAsJsonArray("side")?.sumOf { (it as? JsonObject)?.get("qty")?.takeIf { q -> q.isJsonPrimitive }?.asDouble?.toInt() ?: 0 } ?: 0
}

class LobbyModel(style: String) {
    var style by mutableStateOf(style)                   // "quick" | "practice"
    var format by mutableStateOf("Commander")             // play-setup.js reset(): Commander
    var difficulty by mutableStateOf("Medium")
    var player by mutableStateOf<SeatDeck?>(null)
    var opponent by mutableStateOf<SeatDeck?>(null)
    var inspected by mutableStateOf("player")
    var source by mutableStateOf("yours")
    var query by mutableStateOf("")
    var inspectOpen by mutableStateOf(false)
    var formatOpen by mutableStateOf(false)
    var quickBusy by mutableStateOf(false)
    var quickError by mutableStateOf<String?>(null)
    var quickMatch by mutableStateOf<QuickOpponent.Result?>(null)
    var error by mutableStateOf<String?>(null)
    // play-setup.js draft / import state (importPaste, reviewImport).
    var pasteOpen by mutableStateOf(false)
    var draftName by mutableStateOf("")
    var draftText by mutableStateOf("")
    var importStatus by mutableStateOf("idle")             // idle | parsing | resolving | review | selected | error
    var importBusy by mutableStateOf(false)
    var warnings by mutableStateOf<List<String>>(emptyList())
    var unresolved by mutableStateOf<List<String>>(emptyList())
    var candidate by mutableStateOf<JsonObject?>(null)
    var importTicket = 0
    val importReady get() = importStatus == "review" || importStatus == "ready"
    val quick get() = style == "quick"
    val social get() = style == "social"
    /** Friends: the room you opened or the invite you hold (play-forge-host-client.js createFriendRooms). */
    sealed interface Room {
        data object Idle : Room
        data object Busy : Room
        data class Waiting(val roomId: String, val invite: String) : Room
        data class Guest(val invite: String, val format: String, val from: String? = null, val roomId: String? = null) : Room
    }
    var room by mutableStateOf<Room>(Room.Idle)
    var roomNote by mutableStateOf<String?>(null)
    var inviteText by mutableStateOf("")
    var challenges by mutableStateOf<List<FriendRooms.Challenge>>(emptyList())
    /** updateDraft: any change retires the previous preview. */
    fun updateDraft(name: String = draftName, text: String = draftText) {
        if (name != draftName || text != draftText) { draftName = name; draftText = text; importTicket++; candidate = null; importBusy = false; importStatus = "idle"; error = null; warnings = emptyList(); unresolved = emptyList() }
    }
    /** The seat the browser fills: always yours in Quick Play. */
    val browseSeat get() = if (quick || social) "player" else inspected
    fun seat(k: String) = if (k == "player") player else opponent
    fun put(k: String, d: SeatDeck?) { if (k == "player") { player = d; if (quick) { opponent = null; quickMatch = null } } else opponent = d }
    fun configureFormat(f: String) { if (f != format) { player = null; opponent = null; inspected = "player"; quickMatch = null; importTicket++; candidate = null; importBusy = false; importStatus = "idle"; warnings = emptyList(); unresolved = emptyList() }; format = f; error = null; quickError = null }
}

/** The lobby's sources besides your decks (play-deck-sources.js PLAY_DECK_SOURCES). */
private val SOURCES = listOf("yours" to "Your decks", "precons" to "Precons", "community" to "Community", "meta" to "Meta", "random" to "Random")
private val LIVE_FORMATS = listOf("Standard", "Commander", "Modern", "Pioneer", "Legacy", "Vintage", "Pauper", "Standard Brawl")
private val FORMAT_GROUPS = listOf(
    "60-card constructed · 20 life" to listOf("Standard" to "Recent sets", "Pioneer" to "Return to Ravnica onward", "Modern" to "8th Edition onward",
        "Legacy" to "All sets, ban list", "Vintage" to "All sets, restricted list", "Pauper" to "Commons only"),
    "Singleton with a commander" to listOf("Commander" to "100 cards · 40 life", "Standard Brawl" to "60 cards · 25 life", "Oathbreaker" to "Planeswalker + signature spell"))
private val CPU_LABELS = mapOf("Easy" to "Easy", "Medium" to "Normal", "Hard" to "Hard")
/** play-opponent-build.js RANDOM_DECK_FORMATS. */
private val RANDOM_FORMATS = listOf("Standard", "Commander")

// ---------------------------------------------------------------- look (play-menu.css, computed at 390 px)

// Page-surface tokens follow the colour mode (settings-theme.css); the VS stage keeps its own dark gold (StageGold) as on the site.
private val Gold: Color get() = Site.Gold
private val Muted: Color get() = Site.Muted
private val Line: Color get() = Site.Line
private val StageGold = Color(0xFFE8B95B)
private val lightMode: Boolean get() = AppSettings.theme == "light"
/** .play-source-tabs / .pl-cpu-level: surface-2 at 65 %. */
private val TabsFill: Color get() = if (lightMode) Color(0xA6E7ECF3) else Color(0xA61F232B)
/** Copy on page surfaces (#d3d9df dark; --muted in light). */
private val SoftInk: Color get() = if (lightMode) Site.Muted else Color(0xFFD3D9DF)
private fun sans(size: Float, weight: FontWeight = FontWeight.Normal, color: Color = Site.Text, spacing: Float = 0f, line: Float = size * 1.45f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size.sp, color = color, letterSpacing = spacing.sp, lineHeight = line.sp)
private fun cinzel(size: Float, color: Color = Color(0xFFF6EEDB), spacing: Float = .01f * size, line: Float = size * 1.12f) =
    TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = size.sp, color = color, letterSpacing = spacing.sp, lineHeight = line.sp)
private val SeatFill = Brush.radialGradient(listOf(Color(0xFF1D2333), Color(0xFF0E1016)), center = Offset(.3f, .2f), radius = 1f)
private val GoldPlate = Brush.verticalGradient(0f to Color(0xFFF8E2A8), .44f to Color(0xFFE9BF6C), .56f to Color(0xFFC08A3A), 1f to Color(0xFFDDB064))
private val Picked = Brush.linearGradient(listOf(Color(0x25E3C37C), Color(0x0AC4A85C)))

private fun Modifier.pill(fill: Color, edge: Color, shape: RoundedCornerShape = RoundedCornerShape(999.dp)) = clip(shape).background(fill).border(1.dp, edge, shape)
private fun Modifier.tap(onClick: () -> Unit) = clickable(MutableInteractionSource(), dev.cardstashy.nativeplay.ui.PadFocus.Ring, onClick = onClick)

/** The site's colour filter on a deck missing Trunk cards: grayscale(1) brightness(.7), opacity .6. */
private val Greyed = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f); timesAssign(ColorMatrix(floatArrayOf(.7f, 0f, 0f, 0f, 0f, 0f, .7f, 0f, 0f, 0f, 0f, 0f, .7f, 0f, 0f, 0f, 0f, 0f, 1f, 0f))) })

/** meta(name): a card's facts by name, from what the app has fetched from Scryfall. */
private fun factByName(name: String?): CardFacts.Fact? = name?.takeIf { it.isNotBlank() }?.let { n ->
    CardFacts.cards.value.values.firstOrNull { val cn = it.card.get("name")?.asString ?: ""; cn == n || cn.substringBefore(" // ") == n } }

private val BASIC = setOf("Forest", "Plains", "Island", "Mountain", "Swamp")
private fun rowNames(raw: JsonObject) = raw.getAsJsonArray("cards")?.mapNotNull { (it as? JsonObject)?.get("name")?.takeIf { n -> n.isJsonPrimitive }?.asString } ?: emptyList()

/** views.js coverOf: the commander's art, else the best-ranked card (creature or planeswalker, then spells, then lands) in list order. */
private fun coverOf(raw: JsonObject): String? {
    // views.js coverOf: the art the player picked as this deck's cover wins (PR #110).
    raw.getAsJsonObject("coverCard")?.get("image")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.startsWith("https://") }?.let { return it }
    val commander = raw.get("commander")?.takeIf { it.isJsonPrimitive }?.asString
    factByName(commander)?.a?.takeIf { it.isNotBlank() }?.let { return it }
    fun rank(t: String) = if (Regex("\\b(Creature|Planeswalker)\\b").containsMatchIn(t)) 0 else if (Regex("\\bLand\\b").containsMatchIn(t)) 2 else 1
    var best: CardFacts.Fact? = null
    for (n in rowNames(raw)) { val f = factByName(n) ?: continue; if (f.a.isBlank()) continue; if (best == null || rank(f.t) < rank(best.t)) best = f }
    return best?.a
}

// ---------------------------------------------------------------- screen

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LobbyScreen(model: LobbyModel, onBack: () -> Unit, onStart: (Pick) -> Unit, onOpenDecks: () -> Unit, onSignIn: () -> Unit, onFriends: () -> Unit, online: Boolean = true,
                onOpenSaved: (String) -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val session by Account.session.collectAsState()
    val state by Progress.state.collectAsState()
    val workspace by Workspace.decks.collectAsState()
    val facts by CardFacts.cards.collectAsState()
    val build by RandomBuild.state.collectAsState()
    val signedIn = session != null
    val toast = { m: String -> android.widget.Toast.makeText(context, m, android.widget.Toast.LENGTH_SHORT).show() }
    LaunchedEffect(session?.userId) { if (session != null && online) { Workspace.load(context); Progress.loadCached(); Progress.refresh() } }

    val typeOf = { n: String -> factByName(n)?.t ?: "" }
    val free by TableDecks.free.collectAsState()
    // loadFreePrecons once the wallet is there (playTableDecks: if(st.wallet)loadFreePrecons()).
    LaunchedEffect(state?.has("wallet") == true) { if (state?.has("wallet") == true && online) TableDecks.loadFree() }
    val decks = remember(state, workspace, facts, free) { TableDecks.list(state, workspace ?: emptyList(), typeOf, free.orEmpty()) }
    val locked = remember(decks) { TableDecks.locked(decks) }
    // Names the tiles, seats and covers need, fetched once by name (the site resolves them into its catalog).
    LaunchedEffect(decks) { if (online) CardFacts.wantNames(decks.flatMap { d -> listOf(d.commander) + d.cards.take(12).map { it.name } }.filter { it.isNotBlank() }) }

    val m = model
    val quickOnly = m.quick
    val source = if (quickOnly) "yours" else m.source
    val inFormat = decks.filter { it.format == m.format }
    val visible = inFormat.filter { d -> listOf(d.name, d.commander).any { it.lowercase().contains(m.query.lowercase().trim()) } }
    val browserSelected = m.seat(m.browseSeat)
    fun chosen(d: TableDecks.Deck) = browserSelected?.source == "saved" && browserSelected.id == d.id

    // Sources: precons, meta and community lists for the format, loaded on first open (A.playDeckSource).
    val sources = remember { LobbySources() }
    LaunchedEffect(source, m.format) { if (online && source in setOf("precons", "meta", "community") && sources.entries(source, m.format).isEmpty()) sources.load(context, source, m.format, signedIn) }

    fun selectDeck(d: TableDecks.Deck) {
        RandomBuild.cancel()
        if (m.quick && d.id in locked) { toast(TableDecks.LOCKED_TOAST); return }
        val seat = m.browseSeat
        m.put(seat, SeatDeck(d.raw.deepCopy().apply { if (!has("id")) addProperty("id", d.id); addProperty("format", d.format) }, "saved"))
        m.importTicket++; m.importBusy = false; m.candidate = null; m.importStatus = "idle"; m.warnings = emptyList(); m.unresolved = emptyList()
        m.error = null
        // In Practice, once your deck is in, the next pick goes to the CPU's seat.
        if (!m.quick && !m.social && seat == "player" && m.player != null && m.opponent == null) m.inspected = "opponent"
    }
    fun pickSource(e: LobbySources.Entry) {
        RandomBuild.cancel()
        m.put(m.browseSeat, SeatDeck(e.deck.deepCopy(), e.kind))
        if (!m.quick && !m.social && m.browseSeat == "player" && m.opponent == null) m.inspected = "opponent"
    }
    fun importPaste() {
        if (!signedIn) { onSignIn(); return }
        scope.launch { importPasteInto(m, online) }
    }
    /** reviewImport: the reviewed list goes to the seat being filled, temporary for this match. */
    fun useImport() {
        RandomBuild.cancel()
        if (!signedIn) { onSignIn(); return }
        val c = m.candidate
        if (m.importBusy || c == null || m.importStatus != "review") { m.error = "Finish reviewing a valid pasted list before selecting it."; return }
        val seat = if (m.quick || m.social) "player" else m.inspected
        m.inspected = seat; m.put(seat, SeatDeck(c.deepCopy(), "import"))
        m.candidate = null; m.importStatus = "selected"; m.error = null
    }
    // A finished random build lands in the seat it was built for.
    var buildSeat by remember { mutableStateOf("player") }
    LaunchedEffect(build.deck) { build.deck?.let { d -> d.addProperty("format", m.format); m.put(buildSeat, SeatDeck(d.deepCopy(), "random")); if (!m.quick && !m.social && buildSeat == "player" && m.opponent == null) m.inspected = "opponent" } }

    // ---- Friends (app.js playFriendCreate / playFriendJoin / playFriendLaunch)
    val rooms = remember { FriendRooms() }
    val profile by Account.profile.collectAsState()
    val card = remember(profile) { FriendRooms.playerCard(profile?.name ?: profile?.username, profile?.avatarUrl) }
    fun roomFailure(e: Throwable) { m.room = LobbyModel.Room.Idle; m.roomNote = (e as? FriendRooms.Failure)?.message ?: e.message ?: "The room could not be reached. Try again." }
    fun launch(you: SeatDeck, matchId: String, friendName: String?) { m.room = LobbyModel.Room.Idle; m.roomNote = null; onStart(Pick.Friend(you.raw, you.name, m.format, factName(you.raw), matchId, friendName)) }
    fun cancelRoom() { (m.room as? LobbyModel.Room.Waiting)?.let { r -> scope.launch { runCatching { rooms.cancel(r.roomId) } } }; m.room = LobbyModel.Room.Idle; m.roomNote = null }
    val friend = remember(m) { FriendActions(
        copy = { inv -> (context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("Invite link", FriendRooms.link(inv))); toast("Link copied") },
        share = { inv -> context.startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
            .putExtra(android.content.Intent.EXTRA_TEXT, "Play a Magic match with me on CardStashy: " + FriendRooms.link(inv)), "Send the invite")) },
        cancel = { cancelRoom() },
        useInvite = {
            val code = FriendRooms.inviteFrom(m.inviteText) ?: FriendRooms.inviteFrom((context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).primaryClip?.getItemAt(0)?.text?.toString())
            if (code == null) m.roomNote = "That isn’t an invite link. Paste the link your friend sent."
            else { m.roomNote = null; m.room = LobbyModel.Room.Busy
                scope.launch { try { val r = rooms.peek(code); val f = r.get("format")?.asString ?: m.format; if (f != m.format) m.configureFormat(f); m.inviteText = ""; m.room = LobbyModel.Room.Guest(code, f) } catch (e: Exception) { roomFailure(e) } } }
        },
        accept = { c -> if (c.format != m.format) m.configureFormat(c.format); m.roomNote = null; m.room = LobbyModel.Room.Guest(c.invite, c.format, c.fromName, c.roomId); m.challenges = m.challenges - c },
        decline = { c -> m.challenges = m.challenges - c; scope.launch { runCatching { rooms.decline(c.roomId) } } }) }
    // The host waits here: a started room brings the match both players open.
    val room = m.room
    LaunchedEffect(room) {
        if (room !is LobbyModel.Room.Waiting) return@LaunchedEffect
        while (true) {
            delay(2000)
            val d = try { rooms.read(room.roomId) } catch (e: Exception) { roomFailure(e); break }
            val status = d.get("status")?.takeIf { it.isJsonPrimitive }?.asString
            val matchId = d.get("matchId")?.takeIf { it.isJsonPrimitive }?.asString
            if (status == "started" && matchId != null) { m.player?.let { launch(it, matchId, d.getAsJsonObject("opponent")?.get("name")?.takeIf { n -> n.isJsonPrimitive }?.asString) }; break }
            if (status != null && status != "open") { m.room = LobbyModel.Room.Idle; m.roomNote = FriendRooms.MESSAGES[if (status == "expired") "invite_expired" else "room_closed"]; break }
        }
    }
    // Challenges from friends, while this page is open and nothing is under way.
    LaunchedEffect(m.social, signedIn) {
        if (!m.social || !signedIn || !online) return@LaunchedEffect
        while (true) { runCatching { m.challenges = rooms.challenges() }; delay(8000) }
    }

    fun start() {
        if (!signedIn) { onSignIn(); return }
        val you = m.player ?: return
        if (m.social) {
            when (val r = m.room) {
                is LobbyModel.Room.Idle -> { m.roomNote = null; m.room = LobbyModel.Room.Busy
                    scope.launch { try { val o = rooms.open(m.format, you.raw, card); m.room = LobbyModel.Room.Waiting(o["roomId"].asString, o["invite"].asString) } catch (e: Exception) { roomFailure(e) } } }
                is LobbyModel.Room.Guest -> { m.roomNote = null; m.room = LobbyModel.Room.Busy
                    scope.launch { try { val o = rooms.join(r.invite, r.format, you.raw, card); launch(you, o["matchId"].asString, o.getAsJsonObject("opponent")?.get("name")?.takeIf { it.isJsonPrimitive }?.asString ?: r.from) } catch (e: Exception) { roomFailure(e) } } }
                else -> {}
            }
            return
        }
        if (m.quick) {
            if (!TableDecks.quickReady(you.id, you.source == "saved", locked)) {
                m.player = null; toast(TableDecks.QUICK_NEEDS); return }
            if (m.quickMatch == null) {
                m.quickBusy = true; m.quickError = null
                scope.launch {
                    try {
                        // Random means every source: fetch the format's tournament lists too if there are none yet (bounded wait).
                        withTimeoutOrNull(4000) { MetaDecks.lists(context, m.format) }
                        val unknown = ForgeService.unknownNames(EngineNames.names(EngineNames.deck(you.raw)))
                        if (unknown.isNotEmpty()) throw QuickOpponent.NoOpponent(engineMissingText("Your deck", unknown.sorted()))
                        val candidates = (workspace ?: emptyList()).map { it.raw.deepCopy().apply { addProperty("format", it.format) } } +
                            listOf("precons", "community", "meta").flatMap { sources.entries(it, m.format).map { e -> e.deck } } +
                            MetaDecks.lists(context, m.format).map { it.deepCopy().apply { addProperty("format", m.format) } }
                        val r = QuickOpponent.choose(you.raw, candidates, eligible = { d -> forgeCpuDeckComplete(d) && ForgeService.unknownNames(EngineNames.names(EngineNames.deck(d))).isEmpty() })
                        m.quickMatch = r; m.opponent = SeatDeck(r.deck, "quick")
                        onStart(Pick.Table(you.raw, you.name, m.format, factName(you.raw), r.deck, "Medium", quick = true))
                    } catch (e: QuickOpponent.NoOpponent) { m.quickError = e.message } catch (e: Exception) { m.quickError = e.message ?: "Couldn’t find a CPU deck." }
                    finally { m.quickBusy = false }
                }
                return
            }
            onStart(Pick.Table(you.raw, you.name, m.format, factName(you.raw), m.quickMatch!!.deck, "Medium", quick = true)); return
        }
        val cpu = m.opponent ?: run { toast("Choose both Practice decks first."); return }
        onStart(Pick.Table(you.raw, you.name, m.format, factName(you.raw), cpu.raw, m.difficulty, quick = false))
    }

    var cardPick by remember { mutableStateOf<CardPick?>(null) }
    BackHandler(cardPick == null && (m.inspectOpen || m.formatOpen)) { m.inspectOpen = false; m.formatOpen = false }
    BackHandler(m.social && m.room is LobbyModel.Room.Waiting) { cancelRoom() }
    val grid = rememberLazyGridState()
    val density = androidx.compose.ui.platform.LocalDensity.current
    var barH by remember { mutableStateOf(0) }
    val pageLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val blurLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val gridAt = remember { mutableStateOf(Offset.Zero) }
    val barAt = remember { mutableStateOf(Offset.Zero) }
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Backdrop() // #ambient: the shared art (glass on, or Aura)
        // .play-library is a panel (surface 84 %, 1 px line, radius 20) from its head to the last deck, its contents 19 px in;
        // the grid is laid out at the panel's inner edge and the panel is drawn behind those items.
        LazyVerticalGrid(GridCells.Fixed(2), state = grid, modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)
            // The page is recorded so the pinned Play bar can blur what scrolls under it (.pl-startbar backdrop-filter: blur(14px)).
            .onGloballyPositioned { gridAt.value = it.positionInRoot() }
            .drawWithContent { pageLayer.record { this@drawWithContent.drawContent() }; drawLayer(pageLayer) }
            .drawBehind {
                val info = grid.layoutInfo; val head = info.visibleItemsInfo.firstOrNull { it.index == LIB_HEAD }
                val first = info.visibleItemsInfo.firstOrNull() ?: return@drawBehind
                if (first.index > LIB_HEAD || head != null) {
                    val top = if (head != null) head.offset.y.toFloat() - info.viewportStartOffset - 18.dp.toPx() else -40.dp.toPx()
                    // The last item is the start bar's resting slot (outside the panel); the panel ends at the item before it.
                    val last = info.visibleItemsInfo.lastOrNull { it.index < info.totalItemsCount - 1 } ?: return@drawBehind
                    val bottom = if (last.index == info.totalItemsCount - 2) last.offset.y - info.viewportStartOffset + last.size.height + 19.dp.toPx() else size.height + 40.dp.toPx()
                    val r = androidx.compose.ui.geometry.CornerRadius(20.dp.toPx()); val x = 16.dp.toPx()
                    drawRoundRect(if (lightMode) Color(0x94FFFFFF) else Color(0xD6171A20), Offset(x, top), Size(size.width - 2 * x, bottom - top), r)
                    drawRoundRect(Line, Offset(x, top), Size(size.width - 2 * x, bottom - top), r, style = Stroke(1.dp.toPx()))
                }
            },
            contentPadding = PaddingValues(start = 35.dp, end = 35.dp, top = 18.dp, bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            full { Box(Modifier.outset(19.dp)) { Head(m, onBack, onFriends) } }
            full { Box(Modifier.outset(19.dp)) { Arena(m, friend, onFocusDecks = { scope.launch { grid.animateScrollToItem(LIB_HEAD) } }) } }
            full {
                LibraryHead(m, source, signedIn, onOpenDecks)
            }
            when {
                source == "yours" && !signedIn -> full { Empty("Your decks, ready for the table", "Sign in above to choose your saved lists.") }
                source == "yours" -> {
                    if (!quickOnly && pasteShown(m)) full { PasteImport(m, ::importPaste, ::useImport) { cardPick = CardPick(it, "", null, "nonfoil") } }
                    full { Text("${visible.size} of ${inFormat.size} ${m.format} decks", style = sans(13f, color = Muted), modifier = Modifier.padding(horizontal = 3.dp)) }
                    if (visible.isEmpty()) full { Empty(if (m.query.isNotBlank()) "No matching decks" else "No ${m.format} decks yet",
                        if (quickOnly) "Build a Play deck, or open packs and the Merchant for cards." else "Paste a list or explore the other sources above.") }
                    else items(visible, key = { "d:" + it.id }) { d -> DeckChoice(d, chosen(d), quickOnly && d.id in locked) { selectDeck(d) } }
                }
                source == "random" -> full { RandomPanel(m, build, signedIn, onBuild = { bracket, style -> buildSeat = m.browseSeat; RandomBuild.start(m.format, bracket, style) }, onSignIn = onSignIn) }
                else -> {
                    full { SourceIntroAndTools(m, source, sources) }
                    val entries = sources.entries(source, m.format).filter { e -> listOf(e.deck.get("name")?.asString ?: "", e.deck.get("commander")?.takeIf { it.isJsonPrimitive }?.asString ?: "", e.detail).any { it.lowercase().contains(m.query.lowercase().trim()) } }
                    if (entries.isEmpty()) full { Empty("No ${SOURCES.first { it.first == source }.second.lowercase()} loaded for ${m.format}", emptyText(source, m.format)) }
                    else items(entries, key = { "s:" + it.key }, span = { GridItemSpan(maxLineSpan) }) { e -> SourceCard(e, browserSelected?.id == e.deck.get("id")?.asString, signedIn) { pickSource(e) } }
                }
            }
            // Phones (polish.css): the Play bar is laid out after the deck list and sticky, so it stays pinned to the
            // bottom while the list scrolls and rests here at the end.
            item(key = "startbar", span = { GridItemSpan(maxLineSpan) }) { Spacer(Modifier.height(with(density) { barH.toDp() } + 8.dp)) }
        }
        // position:sticky; bottom:0 — the bar sits at its slot, or at the bottom edge when the slot is further down.
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            // Read in the layout phase only: reading the grid's layout in composition would recompose it every frame.
            val gap = with(density) { 8.dp.roundToPx() }
            Box(Modifier.offset {
                val info = grid.layoutInfo
                val slot = info.visibleItemsInfo.firstOrNull { it.key == "startbar" }
                val restY = slot?.let { it.offset.y - info.viewportStartOffset + gap } ?: Int.MAX_VALUE
                androidx.compose.ui.unit.IntOffset(0, minOf(restY, info.viewportSize.height - barH).coerceAtLeast(0)) }.padding(horizontal = 16.dp).fillMaxWidth()
                .then(Modifier.onSizeChanged { sz -> barH = sz.height })) {
                // ::before: a short fade above the pinned bar so the panel reads as sliding under a dock.
                Box(Modifier.matchParentSize().drawBehind {
                    val h = 28.dp.toPx(); val ext = 20.dp.toPx()
                    drawRect(Brush.verticalGradient(listOf(Color.Transparent, Site.Bg.copy(alpha = .92f)), startY = -h + 1f, endY = 1f), Offset(-ext, -h + 1f), Size(size.width + 2 * ext, h))
                })
                Box(Modifier.onGloballyPositioned { barAt.value = it.positionInRoot() }.clip(RoundedCornerShape(18.dp)).drawBehind {
                    if (pageLayer.size.width > 0) {
                        blurLayer.renderEffect = androidx.compose.ui.graphics.BlurEffect(14.dp.toPx(), 14.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                        blurLayer.record(pageLayer.size) { drawLayer(pageLayer) }
                        val d = gridAt.value - barAt.value
                        translate(d.x, d.y) { drawLayer(blurLayer) }
                    }
                }) { StartBar(m, signedIn, statusText(m), friend) { start() } }
            }
        }
        if (m.formatOpen) FormatSheet(m)
        if (m.inspectOpen) Inspector(m, onRemove = { m.put(m.inspected, null); m.inspectOpen = false },
            onSave = { d -> scope.launch { try { PlayDeckSaver.save(context, d); toast("Deck saved to Your decks.") } catch (e: Exception) { toast(e.message ?: "Couldn’t save the deck.") } } },
            onOpenSaved = { id -> onOpenSaved(id) }, onCard = { cardPick = CardPick(it, "", null, "nonfoil") })
        cardPick?.let { pick -> BackHandler { cardPick = null }; CardSheet(pick, state, CardSheetActions(toast = toast), onClose = { cardPick = null }) }
    }
}

private const val LIB_HEAD = 2
/** Lay a child out wider than its slot by [by] on each side (the head and seats span the page, past the panel's inset). */
private fun Modifier.outset(by: Dp) = layout { m, c -> val px = by.roundToPx()
    val p = m.measure(c.copy(minWidth = c.minWidth + 2 * px, maxWidth = c.maxWidth + 2 * px)); layout(c.maxWidth, p.height) { p.place(-px, 0) } }
private fun LazyGridScope.full(content: @Composable () -> Unit) = item(span = { GridItemSpan(maxLineSpan) }) { content() }

/** The card name the versus plate and table art use for the deck's face (its cover card, in Forge's spelling). */
private fun factName(raw: JsonObject): String? {
    val commander = raw.get("commander")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() }
    return (commander ?: rowNames(raw).firstOrNull { it !in BASIC })?.let(EngineNames::name)
}

/** app.js engineMissingText. */
private fun engineMissingText(label: String, names: List<String>) = label + " has " + (if (names.size == 1) "a card the rules engine can’t load yet: " else "${names.size} cards the rules engine can’t load yet, including ") + names[0] + "."

/** play-forge-setup-review.js forgeCpuDeckComplete. */
fun forgeCpuDeckComplete(deck: JsonObject): Boolean {
    val format = deck.get("format")?.takeIf { it.isJsonPrimitive }?.asString ?: return false
    if (format !in LIVE_FORMATS) return false
    fun rows(k: String) = deck.getAsJsonArray(k)?.mapNotNull { it as? JsonObject } ?: emptyList()
    fun qty(o: JsonObject) = o.get("qty")?.takeIf { it.isJsonPrimitive }?.asDouble ?: 0.0
    val cards = rows("cards"); val side = rows("side")
    if (cards.isEmpty() || (cards + side).any { (it.get("name")?.asString ?: "").isBlank() || qty(it) < 1 || qty(it) > 1000 || qty(it) != Math.floor(qty(it)) }) return false
    fun key(n: String?) = java.text.Normalizer.normalize(n ?: "", java.text.Normalizer.Form.NFKC).trim().lowercase()
    val declared = ((deck.getAsJsonArray("commanders")?.map { if (it.isJsonPrimitive) it.asString else (it as? JsonObject)?.get("name")?.asString } ?: emptyList()) +
        listOf(deck.get("commander")?.takeIf { it.isJsonPrimitive }?.asString)).map(::key).filter { it.isNotEmpty() }.distinct()
    val total = cards.sumOf(::qty)
    val size = mapOf("Commander" to 100.0, "Standard Brawl" to 60.0)[format]
    if (size != null) return declared.size in 1..2 && declared.all { n -> cards.any { key(it.get("name")?.asString) == n } } && total == size
    return declared.isEmpty() && total >= 60 && side.sumOf(::qty) <= 15
}

/** The footer only speaks up for a real problem (quick error, then Quick Play's pick reason). */
private fun statusText(m: LobbyModel): String = m.roomNote ?: m.quickError ?: m.error ?: (if (m.quick) m.quickMatch?.reason ?: "" else "")

private fun emptyText(source: String, format: String) = when (source) {
    "precons" -> "Load more precons to see published lists that are legal in $format."
    "community" -> "Load shared decks from friends, or save online lists in Decks."
    else -> "Refresh Meta decks to load published $format lists."
}

// ---------------------------------------------------------------- head

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Head(m: LobbyModel, onBack: () -> Unit, onFriends: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(44.dp).clip(CircleShape).background(Site.Surface.copy(alpha = .7f)).border(1.dp, Line, CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                androidx.compose.foundation.Image(SiteIcons.Back, "Back to Play", Modifier.size(22.dp), colorFilter = ColorFilter.tint(Site.Text)) }
            Column {
                Text("PLAY", style = sans(11f, FontWeight.Bold, Gold, 3.3f, 16f))
                Text(if (m.quick) "Quick Play" else if (m.social) "Friends" else "Practice", style = if (lightMode) cinzel(24f, Site.Text, .48f, 25.2f) else cinzel(24f, spacing = .48f, line = 25.2f).copy(brush = Brush.verticalGradient(0.3f to Color(0xFFF8F0DC), 1f to Color(0xFFD6AD64))))
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.height(44.dp).pill(Site.Surface.copy(alpha = .8f), Color(0xFF6C5F45)).clickable { m.formatOpen = true }.padding(start = 16.dp, end = 14.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(m.format, style = sans(14f, FontWeight.Bold, Site.Text))
                androidx.compose.foundation.Image(SiteIcons.Chevron, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(Site.Text))
            }
            if (!m.quick) PlaymatPicker(Modifier.weight(1f)) // playmatPickerMarkup, Practice only (.pl-head-tools .pl-mat{flex:1})
            if (!m.quick && !m.social) Row(Modifier.height(44.dp).pill(Color(0xB30D0F14), Color(0xFF766647)).clickable(onClick = onFriends).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                androidx.compose.foundation.Image(SiteIcons.Friends, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(Color(0xFFF6E4BB)))
                Text("Invite a friend", style = sans(14f, FontWeight.Bold, Color(0xFFF6E4BB)))
            }
        }
    }
}

@Composable
private fun FormatSheet(m: LobbyModel) {
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).tap { m.formatOpen = false }, contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.fillMaxWidth().widthIn(max = 560.dp).clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)).background(Site.Surface).border(1.dp, Line, RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
            .tap { }.windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            FORMAT_GROUPS.map { (l, r) -> l to (if (m.social) r.filter { it.first in FriendRooms.FORMATS } else r) }.filter { it.second.isNotEmpty() }.forEach { (label, rows) ->
                Text(label, style = sans(12f, FontWeight.Bold, Muted, 1f))
                rows.chunked(2).forEach { pair -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    pair.forEach { (f, note) ->
                        val live = f in LIVE_FORMATS; val on = m.format == f
                        Column(Modifier.weight(1f).heightIn(min = 64.dp).clip(RoundedCornerShape(12.dp))
                            .background(if (on) Picked else SolidColor(Site.Surface2)).border(1.dp, if (on) Color(0x66D8B76C) else Line, RoundedCornerShape(12.dp))
                            .alpha(if (live) 1f else .55f).clickable(enabled = live) { m.configureFormat(f); m.formatOpen = false }.padding(12.dp)) {
                            Text(f, style = sans(14f, FontWeight.Bold, if (on) Gold else Site.Text))
                            Text(note, style = sans(12f, color = Muted))
                            if (!live) Text("Next engine update", style = sans(11.5f, FontWeight.SemiBold, Color(0xFFD6AD64)))
                        }
                    }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                } }
            }
        }
    }
}

// ---------------------------------------------------------------- arena

@Composable
private fun Arena(m: LobbyModel, friend: FriendActions, onFocusDecks: () -> Unit) {
    val practice = !m.quick
    var seam by remember { mutableStateOf(-1) }
    Box {
        Column {
            Box(Modifier.onSizeChanged { seam = it.height }) { Seat(m, "player", practice, onFocusDecks) }
            if (m.social) FriendSeat(m, friend) else Seat(m, "opponent", practice, onFocusDecks)
        }
        // The VS medallion: a 44 px diamond with a gold edge and a dark ring, centred on the seam.
        Box(Modifier.align(if (m.social && seam > 0) Alignment.TopCenter else Alignment.Center).offset(y = if (m.social && seam > 0) with(LocalDensity.current) { seam.toDp() - 31.dp } else 0.dp).size(62.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.size(44.dp).rotate(45f).drawBehind {
                drawRoundRect(Color(0x26E8B95B), Offset(-7.dp.toPx(), -7.dp.toPx()), Size(size.width + 14.dp.toPx(), size.height + 14.dp.toPx()), androidx.compose.ui.geometry.CornerRadius(16.dp.toPx()))
                drawRoundRect(Color(0xFF0C0D10), Offset(-6.dp.toPx(), -6.dp.toPx()), Size(size.width + 12.dp.toPx(), size.height + 12.dp.toPx()), androidx.compose.ui.geometry.CornerRadius(15.dp.toPx()))
            }.clip(RoundedCornerShape(10.dp)).background(Brush.linearGradient(listOf(Color(0xFF2A2416), Color(0xFF121008)))).border(2.dp, StageGold, RoundedCornerShape(10.dp)))
            Text("VS", style = cinzel(14f, StageGold, 0f, 14f))
        }
    }
}

@Composable
private fun Seat(m: LobbyModel, key: String, practice: Boolean, onFocusDecks: () -> Unit) {
    val cpu = key == "opponent"; val deck = m.seat(key); val randomCpu = cpu && m.quick; val active = practice && m.inspected == key
    val profile by Account.profile.collectAsState()
    val who = if (cpu) (if (randomCpu) "CPU · RANDOM" else "CPU DECK") else ((profile?.username?.takeIf { it.isNotBlank() }?.let { "@$it" } ?: profile?.name ?: "You") + " · Your deck").uppercase()
    val title = deck?.name ?: if (randomCpu) "Random opponent" else if (cpu) "Choose CPU deck" else "Choose your deck"
    val detail = deck?.let { listOf(it.commander, "${it.count} cards").filter { s -> s.isNotBlank() }.joinToString(" · ") }
        ?: if (randomCpu) (m.quickMatch?.let { "${it.candidateCount} compatible list${if (it.candidateCount == 1) "" else "s"} considered" } ?: "Any ${m.format} deck, drawn when you press Play") else ""
    val shape = if (cpu) RoundedCornerShape(bottomStart = 18.dp, bottomEnd = 18.dp) else RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)
    val seam = active || (!practice && !cpu)
    val art = deck?.raw?.let(::coverOf)
    Box(Modifier.fillMaxWidth().heightIn(min = 175.dp).shadow(22.dp, shape, ambientColor = Color(0x77000000), spotColor = Color(0x77000000)).clip(shape)
        .background(if (cpu) Brush.radialGradient(listOf(Color(0xFF1B2130), Color(0xFF0E1016)), center = Offset(.3f, .5f)) else SeatFill)
        .border(1.dp, if (seam) StageGold.copy(alpha = .75f) else Color(0x40D6AD64), shape)
        .then(if (practice) Modifier.clickable { m.inspected = key } else if (deck == null && !cpu) Modifier.clickable(onClick = onFocusDecks) else Modifier)) {
        if (art != null) {
            Pic(art, Modifier.matchParentSize(), contentScale = ContentScale.Crop, alpha = .55f)
            Box(Modifier.matchParentSize().background(Brush.horizontalGradient(if (cpu) listOf(Color(0x330E1016), Color(0xE60E1016)) else listOf(Color(0xE60E1016), Color(0x330E1016)))))
        }
        // Empty seats show a card slot on the side facing the other seat; Quick Play's CPU shows three stacked backs.
        when {
            randomCpu -> Backs(Modifier.align(Alignment.CenterStart).padding(start = 10.dp))
            deck == null -> Slot(Modifier.align(if (cpu) Alignment.CenterStart else Alignment.CenterEnd).padding(horizontal = 40.dp))
        }
        // An empty seat's copy fills the seat up to its slot (slot 40 px in, 66 wide, then a 6 px gap), as on the site.
        val slotSide = if (deck == null && !randomCpu) 112.dp else 18.dp
        Column(Modifier.align(if (cpu) Alignment.CenterEnd else Alignment.CenterStart).padding(top = 18.dp, bottom = 18.dp, start = if (cpu) slotSide else 18.dp, end = if (cpu) 18.dp else slotSide)
            .fillMaxWidth(if (randomCpu) .62f else 1f),
            horizontalAlignment = if (cpu) Alignment.End else Alignment.Start, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(who, style = sans(11f, FontWeight.Bold, if (cpu) Color(0xFF8EC5FF) else Color(0xFFF0C27A), 1.76f, 16f), textAlign = if (cpu) TextAlign.End else TextAlign.Start)
            Text(title, style = cinzel(21f, line = 23.5f), textAlign = if (cpu) TextAlign.End else TextAlign.Start)
            if (detail.isNotEmpty()) Text(detail, style = sans(13f, color = Color(0xFFD3D9DF)), textAlign = if (cpu) TextAlign.End else TextAlign.Start)
            if (deck != null) Box(Modifier.padding(top = 4.dp).height(44.dp).pill(Color(0xB30C0E13), Color(0x33FFFFFF)).clickable { m.inspected = key; m.inspectOpen = true }.padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center) { Text("Inspect", style = sans(13.5f, FontWeight.Bold, Color(0xFFF1E9D8))) }
        }
    }
}

@Composable
private fun Slot(modifier: Modifier) {
    Box(modifier.size(66.dp, 92.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xB30C0E14))
        .background(Brush.radialGradient(listOf(Color(0x22E8B95B), Color.Transparent)))
        .drawBehind { drawRoundRect(Color(0x88D6AD64), style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))), cornerRadius = androidx.compose.ui.geometry.CornerRadius(10.dp.toPx())) },
        contentAlignment = Alignment.Center) {
        Text("+", style = sans(30f, FontWeight.Normal, StageGold, 0f, 30f))
    }
}

/** .pl-backs: three card backs fanned (navy stripes, gold rings), at .5 opacity on phones. */
@Composable
private fun Backs(modifier: Modifier) {
    Box(modifier.size(140.dp, 120.dp).alpha(.5f)) {
        listOf(-12f to 0.dp, -4f to 22.dp, 6f to 44.dp).forEach { (deg, x) ->
            Canvas(Modifier.offset(x = x, y = 8.dp).size(84.dp, 104.dp).rotate(deg).clip(RoundedCornerShape(8.dp)).border(2.dp, Color(0xFFB08A4A), RoundedCornerShape(8.dp))) {
                val stripe = 6.dp.toPx(); var i = -size.height
                drawRect(Color(0xFF1A2A44))
                while (i < size.width + size.height) { drawLine(Color(0xFF22365A), Offset(i, 0f), Offset(i + size.height, size.height), stripe); i += stripe * 2 }
                drawCircle(Color(0x66D6AD64), 25.dp.toPx(), center, style = Stroke(1.dp.toPx())); drawCircle(Color(0x55E8B95B), 16.dp.toPx(), center)
            }
        }
    }
}

// ---------------------------------------------------------------- start bar

@Composable
private fun StartBar(m: LobbyModel, signedIn: Boolean, status: String, friend: FriendActions, onStart: () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(if (lightMode) Color(0xB3F3F5F8) else Color(0xB30F1115)).padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (status.isNotEmpty()) Text(status, style = sans(13f, color = SoftInk), modifier = Modifier.padding(horizontal = 4.dp))
        if (m.social) FriendInvite(m, friend)
        if (!m.quick && !m.social) Row(Modifier.fillMaxWidth().height(54.dp).pill(TabsFill, Line).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("CPU", style = sans(11f, FontWeight.Normal, Muted), modifier = Modifier.padding(horizontal = 10.dp))
            listOf("Easy", "Medium", "Hard").forEach { lv -> val on = m.difficulty == lv
                Box(Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(999.dp)).then(if (on) Modifier.background(Picked).border(1.dp, Color(0x66D8B76C), RoundedCornerShape(999.dp)) else Modifier)
                    .clickable { m.difficulty = lv; m.quickMatch = null }, contentAlignment = Alignment.Center) { Text(CPU_LABELS.getValue(lv), style = sans(15f, color = if (on) Gold else Muted)) }
            }
        }
        val room = m.room
        val label = if (m.social) (if (!signedIn) "Sign in to play" else if (room is LobbyModel.Room.Busy) "Opening the room…" else if (m.player == null) "Pick your deck" else if (room is LobbyModel.Room.Waiting) "Waiting for your friend…"
            else if (room is LobbyModel.Room.Guest) "Join room" else "Create room")
            else if (!signedIn) "Sign in to play" else if (m.quickBusy) "Finding a CPU deck…" else if (m.player == null) "Pick your deck" else if (!m.quick && m.opponent == null) "Pick the CPU deck" else "Play vs CPU"
        val ready = if (m.social) (!signedIn || (m.player != null && room is LobbyModel.Room.Idle || m.player != null && room is LobbyModel.Room.Guest)) else (!signedIn || (!m.quickBusy && m.player != null && (m.quick || m.opponent != null)))
        val shape = RoundedCornerShape(10.dp)
        // .cs-plate:disabled — the dark plate at opacity .6 under saturate(.4) (#d6ad64 reads #bfaf92).
        Box(Modifier.fillMaxWidth().height(50.dp).then(if (ready) Modifier else Modifier.alpha(.6f)).clip(shape)
            .background(if (ready) GoldPlate else Brush.verticalGradient(listOf(Color(0xFF1B1A16), Color(0xFF121113))))
            .border(1.dp, Color(0xFF5A3B12), shape).clickable(enabled = ready, onClick = onStart), contentAlignment = Alignment.Center) {
            Text("◆  $label  ◆".let { if (signedIn) it else label }, style = cinzel(15f, if (ready) Color(0xFF2A1906) else Color(0xFFBFAF92), 1.5f, 15f))
        }
    }
}

// ---------------------------------------------------------------- deck browser

@Composable
private fun LibraryHead(m: LobbyModel, source: String, signedIn: Boolean, onOpenDecks: () -> Unit) {
    val seatName = when (m.browseSeat) { "player" -> "Your deck"; else -> "CPU deck" }
    Column(Modifier.fillMaxWidth().padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(seatName, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, letterSpacing = (-.36).sp, color = Site.Text))
            Text(" · ${m.format}", style = sans(13f, FontWeight.SemiBold, Muted))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (source == "yours" && signedIn && !m.quick) {
                val open = pasteShown(m)
                Row(Modifier.height(44.dp).pill(if (open) Gold.copy(alpha = .16f) else Site.Surface2, if (open) Gold else PasteEdge)
                    .clickable { m.pasteOpen = !open }.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Canvas(Modifier.size(15.dp)) { // play-menu.js clipboard icon, viewBox 24
                        val k = size.width / 24f
                        val path = androidx.compose.ui.graphics.Path().apply {
                            moveTo(9 * k, 4 * k); lineTo(15 * k, 4 * k); lineTo(15 * k, 7 * k); lineTo(9 * k, 7 * k); close()
                            moveTo(7 * k, 5.5f * k); lineTo(5.5f * k, 5.5f * k); lineTo(5.5f * k, 20.5f * k); lineTo(18.5f * k, 20.5f * k); lineTo(18.5f * k, 5.5f * k); lineTo(17 * k, 5.5f * k)
                            moveTo(9 * k, 12 * k); lineTo(15 * k, 12 * k); moveTo(9 * k, 16 * k); lineTo(13 * k, 16 * k) }
                        drawPath(path, Gold, style = Stroke(1.8f * k, cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
                    }
                    Text("Paste a deck list", style = sans(13.5f, FontWeight.Bold, Site.Text))
                }
            }
            Box(Modifier.height(44.dp).pill(Site.Surface2, Line).clickable(onClick = onOpenDecks).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                Text("Open Decks", style = sans(13.5f, FontWeight.Bold, Site.Text)) }
        }
        if (m.quick) Text(TableDecks.QUICK_INTRO, style = sans(13f, color = Muted, line = 19.5f))
        else Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(TabsFill).border(1.dp, Line, RoundedCornerShape(14.dp)).padding(3.dp)) {
            SOURCES.forEach { (k, label) -> val on = source == k
                Box(Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(10.dp)).then(if (on) Modifier.background(Picked).border(1.dp, Color(0x66D8B76C), RoundedCornerShape(10.dp)) else Modifier)
                    .clickable { m.source = k; m.query = "" }, contentAlignment = Alignment.Center) { Text(if (k == "yours") "Mine" else label, style = sans(11.5f, color = if (on) Site.Text else Muted)) }
            }
        }
        if (source != "random") Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Search ${SOURCES.first { it.first == source }.second.lowercase()}", style = sans(12f, color = Muted))
            Box(Modifier.fillMaxWidth().height(44.dp).clip(RoundedCornerShape(11.dp)).background(Site.Surface).border(1.dp, Line, RoundedCornerShape(11.dp)).padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                if (m.query.isEmpty()) Text("Deck name or commander", style = sans(15f, color = Muted.copy(alpha = .7f)))
                BasicTextField(m.query, { if (it.length <= 160) m.query = it }, singleLine = true, textStyle = sans(15f), cursorBrush = SolidColor(Gold), modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/** views.js deckTile in the lobby grid (square on phones; stats hidden): art, shade, deck box, colour identity, Cinzel name. */
@Composable
private fun DeckChoice(d: TableDecks.Deck, selected: Boolean, locked: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val cover = coverOf(d.raw)
    val filter = if (locked) Greyed else null
    Box(Modifier.aspectRatio(1f).then(if (selected) Modifier.border(2.dp, Gold, RoundedCornerShape(18.dp)).padding(3.dp) else Modifier)) {
        Box(Modifier.fillMaxSize().alpha(if (locked) .6f else 1f).clip(shape).background(Site.Surface2).border(1.dp, Line, shape).clickable(onClick = onClick)) {
            if (cover != null) Pic(cover, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, colorFilter = filter)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, .28f to Color.Transparent, .78f to Color(0xD907080B), 1f to Color(0xF507080B))))
            DeckBox(rowNames(d.raw).take(3), Modifier.padding(10.dp), filter)
            ColorDots(d.commander, Modifier.align(Alignment.TopEnd).padding(10.dp))
            Text(d.name, style = cinzel(14f, Color.White, .14f, 16.1f), maxLines = 3, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.BottomStart).padding(start = 12.dp, end = 12.dp, bottom = if (selected) 50.dp else if (locked) 30.dp else 16.dp))
        }
        if (selected) Text("✓ Selected", style = sans(12f, FontWeight.Bold, Color(0xFF1B1406)), modifier = Modifier.align(Alignment.BottomStart).padding(12.dp)
            .shadow(14.dp, RoundedCornerShape(999.dp)).clip(RoundedCornerShape(999.dp)).background(Gold).padding(horizontal = 10.dp, vertical = 4.dp))
        else if (locked) Text("Missing cards", style = sans(12f, FontWeight.SemiBold, Color(0xFFF3E6C4)), modifier = Modifier.align(Alignment.BottomStart).padding(8.dp)
            .clip(RoundedCornerShape(999.dp)).background(Color(0xA8000000)).padding(horizontal = 8.dp, vertical = 2.dp))
    }
}

/** deck-box.js at phone size (42×46): the box's case wears the first card, the next two rest behind it at ∓5°. */
@Composable
private fun DeckBox(names: List<String>, modifier: Modifier, filter: ColorFilter?) {
    val imgs = names.map { factByName(it)?.i }
    Box(modifier.size(42.dp, 46.dp), contentAlignment = Alignment.Center) {
        imgs.drop(1).forEachIndexed { i, u -> if (u != null) Pic(u, Modifier.size(33.dp, 46.dp).graphicsLayer { translationX = (if (i == 0) -3 else 3).dp.toPx(); rotationZ = if (i == 0) -5f else 5f }
            .clip(RoundedCornerShape(5.dp)).border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(5.dp)), contentScale = ContentScale.Crop, colorFilter = filter) }
        Box(Modifier.size(33.dp, 46.dp).shadow(8.dp, RoundedCornerShape(5.dp)).clip(RoundedCornerShape(5.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF9A8BBB), Color(0xFF7664A0), Color(0xFF5C4E7D)))).border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(5.dp))) {
            imgs.firstOrNull()?.let { Pic(it, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = androidx.compose.ui.BiasAlignment(0f, -.56f), colorFilter = filter) }
                ?: Text("▱", style = sans(18f, color = Color.White), modifier = Modifier.align(Alignment.Center))
            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0x30FFFFFF), Color.Transparent), end = Offset(40f, 60f))))
        }
    }
}

/** ui.js colorDots(meta(commander)): the colour identity's symbols, the colourless one when there is none. */
@Composable
private fun ColorDots(commander: String, modifier: Modifier) {
    val id = factByName(commander)?.k?.map { it.toString() }?.takeIf { it.isNotEmpty() } ?: listOf("C")
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(2.dp)) { id.forEach { Symbol(it, 20.dp) } }
}

@Composable
private fun Empty(title: String, text: String) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Site.Surface2.copy(alpha = .6f)).border(1.dp, Line, RoundedCornerShape(16.dp)).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Site.Text))
        Text(text, style = sans(13.5f, color = Muted))
    }
}

// ---------------------------------------------------------------- sources

/** The lobby's loaded lists per source and format (app.js playSources + playSourceEntries). */
class LobbySources {
    data class Entry(val key: String, val kind: String, val detail: String, val deck: JsonObject)
    data class Status(val busy: Boolean = false, val message: String = "", val error: String = "")
    private val lists = androidx.compose.runtime.mutableStateMapOf<String, List<Entry>>()
    val statuses = androidx.compose.runtime.mutableStateMapOf<String, Status>()
    private var community: List<dev.cardstashy.nativeplay.play.CommunityDecks.Shared> = emptyList()
    /** playSourceEntries' community rows: friends' shared decks in the format, then your saved online lists in it. */
    private fun communityEntries(format: String) = community.filter { it.deck.get("format")?.asString == format }.map { Entry("community:" + it.key, "community", it.detail, it.deck.deepCopy()) } +
        Workspace.references.value.filter { it.get("format")?.takeIf { f -> f.isJsonPrimitive }?.asString == format && it.get("cards")?.isJsonArray == true }.map { d ->
            val src = d.getAsJsonObject("source")
            Entry("reference:" + (d.get("id")?.asString ?: ""), "community", src?.get("author")?.asString?.ifBlank { null } ?: src?.get("website")?.asString?.ifBlank { null } ?: "Saved online list", d.deepCopy()) }
    fun entries(source: String, format: String) = lists["$source:$format"] ?: emptyList()

    suspend fun load(context: android.content.Context, source: String, format: String, signedIn: Boolean) {
        val key = "$source:$format"; if (statuses[key]?.busy == true) return
        statuses[key] = Status(true, "Loading deck lists…")
        try {
            when (source) {
                "meta" -> {
                    val decks = MetaDecks.lists(context, format)
                    lists[key] = decks.mapNotNull { d -> val k = d.get("key")?.asString ?: d.get("id")?.asString ?: d.get("name")?.asString ?: return@mapNotNull null
                        Entry("meta:$k", "meta", listOf(d.get("place"), d.get("event"), d.get("date")).mapNotNull { it?.takeIf { e -> e.isJsonPrimitive }?.asString }.filter { it.isNotBlank() }
                            .plus(if (format == "Commander") listOf("Competitive Commander") else emptyList()).joinToString(" · "),
                            d.deepCopy().apply { addProperty("id", "play-meta:$k"); addProperty("format", format) }) }
                    statuses[key] = Status(message = MetaDecks.sourceLine(context, format))
                }
                "precons" -> {
                dev.cardstashy.nativeplay.play.LobbyPrecons.loadMore(format)
                    lists[key] = dev.cardstashy.nativeplay.play.LobbyPrecons.entries(format).map { (detail, d) -> Entry("precon:" + (d.get("file")?.asString ?: ""), "precons", detail, d) }
                    statuses[key] = Status(message = dev.cardstashy.nativeplay.play.LobbyPrecons.msg.ifBlank { "Precon catalog loaded." })
                }
                else -> {
                    if (!signedIn) throw IllegalStateException("Sign in to load decks shared with you.")
                    val got = dev.cardstashy.nativeplay.play.CommunityDecks.load()
                    community = got.decks
                    lists[key] = communityEntries(format); statuses[key] = Status(message = got.message)
                }
            }
            CardFacts.wantNames(entries(source, format).take(24).mapNotNull { e -> e.deck.get("commander")?.takeIf { it.isJsonPrimitive }?.asString?.takeIf { it.isNotBlank() } ?: rowNames(e.deck).firstOrNull { it !in BASIC } })
        } catch (e: Exception) { statuses[key] = Status(error = "Deck source could not load. Try again.") }
    }
}

@Composable
private fun SourceIntroAndTools(m: LobbyModel, source: String, sources: LobbySources) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val st = sources.statuses["$source:${m.format}"] ?: LobbySources.Status()
    val session by Account.session.collectAsState()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(when (source) {
            "precons" -> "Published preconstructed lists, with the original cards kept intact."
            "community" -> "Online lists you saved and decks shared with you by accepted friends."
            else -> if (m.format == "Commander") "Published competitive Commander lists. These are cEDH results." else "Published tournament lists for ${m.format}."
        }, style = sans(13f, color = Muted, line = 19.5f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.height(40.dp).pill(Site.Surface2, Line).clickable(enabled = !st.busy) { scope.launch { sources.load(context, source, m.format, session != null) } }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                Text(if (st.busy) "Loading…" else when (source) { "precons" -> "Load more precons"; "community" -> "Load shared decks"; else -> "Refresh Meta decks" }, style = sans(13.5f, FontWeight.Bold, Site.Text)) }
            Text(st.message, style = sans(12.5f, color = Muted), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        }
        if (st.error.isNotEmpty()) Text(st.error, style = sans(13f, color = Color(0xFFFFB86B)))
    }
}

/** .play-source-card: art, detail line, name, "N cards · format", support chip, Selected / Inspect & select. */
@Composable
private fun SourceCard(e: LobbySources.Entry, on: Boolean, signedIn: Boolean, onPick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val cover = coverOf(e.deck)
    val count = e.deck.getAsJsonArray("cards")?.sumOf { (it as? JsonObject)?.get("qty")?.takeIf { q -> q.isJsonPrimitive }?.asDouble?.toInt() ?: 0 } ?: 0
    Row(Modifier.fillMaxWidth().clip(shape).background(Site.Surface2).border(1.dp, if (on) Gold else Line, shape).clickable(enabled = signedIn, onClick = onPick).padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(92.dp, 68.dp).clip(RoundedCornerShape(10.dp)).background(Site.Surface), contentAlignment = Alignment.Center) {
            if (cover != null) Pic(cover, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Text("✦", style = sans(20f, color = Gold)) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (e.detail.isNotBlank()) Text(e.detail, style = sans(11.5f, color = Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(e.deck.get("name")?.asString ?: "Deck", style = sans(14.5f, FontWeight.Bold), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("$count cards · ${e.deck.get("format")?.asString ?: ""}", style = sans(12.5f, color = SoftInk))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (forgeCpuDeckComplete(e.deck) || e.deck.getAsJsonArray("cards")?.size() ?: 0 > 0) "Checked when you play" else "List needs review", style = sans(11.5f, FontWeight.SemiBold, Color(0xFFBFD7FF)))
                Text(if (on) "Selected" else "Inspect & select", style = sans(12f, FontWeight.Bold, Gold))
            }
        }
    }
}

@Composable
private fun RandomPanel(m: LobbyModel, build: RandomBuild.State, signedIn: Boolean, onBuild: (Int?, String) -> Unit, onSignIn: () -> Unit) {
    val seatLabel = if (m.browseSeat == "player") "you" else "the CPU"
    var bracket by remember { mutableStateOf<Int?>(null) }; var style by remember { mutableStateOf("classic") }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Site.Surface2.copy(alpha = .6f)).border(1.dp, Line, RoundedCornerShape(16.dp)).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        if (m.format !in RANDOM_FORMATS) {
            Text("${m.format} random decks are not available yet", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Site.Text))
            Text("Choose a saved ${m.format} deck, paste a list, or browse ${m.format} Meta and Community lists. Your selected format and exact decks stay unchanged.", style = sans(13.5f, color = Muted))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.height(44.dp).pill(Site.Surface2, Line).clickable { m.source = "yours" }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) { Text("Your ${m.format} decks", style = sans(13.5f, FontWeight.Bold)) }
                Box(Modifier.height(44.dp).pill(Site.Surface2, Line).clickable { m.source = "meta" }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) { Text("Browse ${m.format} Meta", style = sans(13.5f, FontWeight.Bold)) }
            }
            return@Column
        }
        Text("✦", style = sans(28f, color = Gold))
        Text("A new game plan", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = Site.Text))
        Text("Build a ${m.format} deck for $seatLabel. Inspect the complete list before playing. It stays temporary until you choose Save deck.", style = sans(13.5f, color = Muted), textAlign = TextAlign.Center)
        Text("Build preferences", style = sans(13f, FontWeight.Bold, Site.Text))
        if (m.format == "Commander") Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Aim for bracket", style = sans(12.5f, color = Muted))
            (listOf<Int?>(null) + (1..5)).forEach { b -> val on = bracket == b
                Box(Modifier.height(36.dp).pill(if (on) Color(0x33E8B95B) else Site.Surface, if (on) Gold else Line).clickable { bracket = b }.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                    Text(b?.toString() ?: "Any", style = sans(12.5f, FontWeight.Bold, if (on) Gold else Site.Text)) } }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("classic" to "Classic strategy", "infinite-mana" to "Infinite mana engine").forEach { (k, l) -> val on = style == k
                Box(Modifier.height(36.dp).pill(if (on) Color(0x33E8B95B) else Site.Surface, if (on) Gold else Line).clickable { style = k }.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                    Text(l, style = sans(12.5f, FontWeight.Bold, if (on) Gold else Site.Text)) } }
        }
        Box(Modifier.height(46.dp).clip(RoundedCornerShape(10.dp)).background(if (signedIn && !build.busy) GoldPlate else SolidColor(Site.Surface)).clickable(enabled = signedIn && !build.busy) { onBuild(bracket, style) }.padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center) { Text(if (build.busy) "Building deck…" else "Build random deck", style = sans(14f, FontWeight.Bold, if (signedIn && !build.busy) Color(0xFF2A1906) else Muted)) }
        if (build.busy) {
            BrandMark(44.dp)
            Text("Building your deck", style = sans(14f, FontWeight.Bold))
            Text(build.status.ifBlank { "Preparing your cards…" }, style = sans(13f, color = Muted), textAlign = TextAlign.Center)
            Box(Modifier.height(40.dp).pill(Site.Surface2, Line).clickable { RandomBuild.cancel() }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) { Text("Cancel build", style = sans(13.5f, FontWeight.Bold)) }
        }
        Text(build.error ?: build.status.ifBlank { "Construction checks and play support are checked separately." }, style = sans(12.5f, color = Muted), textAlign = TextAlign.Center)
        if (!signedIn) Box(Modifier.height(44.dp).pill(Site.Surface2, Line).clickable(onClick = onSignIn).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) { Text("Sign in to build", style = sans(13.5f, FontWeight.Bold)) }
    }
}

// ---------------------------------------------------------------- paste a deck list (play-menu.js #playImportDisclosure)

/** play-setup.js importPaste: parse, check, then match names (resolveNames: the names with no card data stay unmatched). */
internal suspend fun importPasteInto(m: LobbyModel, online: Boolean) {
    if (m.draftText.isBlank()) { m.error = "Paste a deck list to review."; return }
    val ticket = ++m.importTicket; val name = m.draftName; val text = m.draftText; val format = m.format
    m.candidate = null; m.importBusy = true; m.error = null; m.warnings = emptyList(); m.unresolved = emptyList(); m.importStatus = "parsing"
    fun current() = m.importTicket == ticket
    try {
        val parsed = PlayDeckImport.parse(text)
        fun note(p: PlayDeckImport.Problem) = "Line ${p.line}: ${p.reason}"
        val importErrors = parsed.errors.map(::note)
        val fatal = parsed.errors.filter { it.fatal }
        if (fatal.isNotEmpty()) throw IllegalStateException(PASTE_ERRORS + fatal.joinToString(" ") { note(it) })
        m.warnings = parsed.warnings.map(::note) + importErrors
        m.unresolved = parsed.unresolved.map { it.name }
        fun rows(l: List<PlayDeckImport.Card>) = JsonArray().apply { l.forEach { c -> add(JsonObject().apply { addProperty("name", c.name); addProperty("qty", c.qty) }) } }
        val deck = JsonObject().apply {
            addProperty("id", "play-import-$ticket"); addProperty("name", name.ifBlank { "Imported deck" }); addProperty("format", format)
            addProperty("commander", parsed.commander); if (parsed.commanders.isNotEmpty()) add("commanders", rows(parsed.commanders))
            add("cards", rows(parsed.cards)); add("side", rows(parsed.side)) }
        if (parsed.cards.size > 2500 || parsed.side.size > 2500) throw IllegalStateException("Main deck exceeds the 2500-row review limit.")
        m.importStatus = "resolving"
        val names = (parsed.cards + parsed.side).map { it.name }.distinct()
        if (online) runCatching { CardFacts.wantNames(names) }
        if (!current()) return
        val failed = names.filter { factByName(it) == null }
        val attempted = names.map { PlayDeckImport.key(it) }.toSet()
        m.unresolved = (m.unresolved.filter { PlayDeckImport.key(it) !in attempted } + failed).distinct()
        m.candidate = deck; m.importBusy = false; m.importStatus = "review"; m.error = null
    } catch (e: Exception) {
        if (!current()) return
        m.importBusy = false; m.candidate = null; m.importStatus = "error"
        m.error = e.message?.takeIf { it.startsWith(PASTE_ERRORS) } ?: "The pasted deck could not be reviewed. Check its rows, quantities and format."
    }
}

private const val PASTE_ERRORS = "The pasted list contains errors: "
private val PasteEdge = Color(0xFF806D48)                  // gold 45 % into the line colour
private val WarnFill = Color(0x1AF2C66D); private val WarnText = Color(0xFFF6DBA2)
/** The disclosure is open while there is a draft, a review, work or an error, or when the pill opened it. */
private fun pasteShown(m: LobbyModel) = m.pasteOpen || m.draftText.isNotEmpty() || m.importReady || m.importBusy || m.error != null

@Composable
private fun PasteImport(m: LobbyModel, onPreview: () -> Unit, onUse: () -> Unit, onCard: (String) -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().padding(bottom = 14.dp).clip(shape).background(Site.Surface2.copy(alpha = .58f)).border(1.dp, Color(0xFF635843), shape)
        .padding(start = 14.dp, end = 14.dp, top = 4.dp, bottom = 14.dp)) {
        Text("Import a deck list", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = (-.3).sp, color = Site.Text, lineHeight = 17.25.sp), modifier = Modifier.padding(bottom = 8.dp))
        Text("Paste a list, review the cards, then choose Use this list. The original rows and printing details are kept for review.", style = sans(13f, color = Muted, line = 18.85f))
        Field("Deck name", m.draftName, "Imported deck", 160, singleLine = true, size = 12.5f) { m.updateDraft(name = it) }
        Field("Deck list", m.draftText, (if (m.format == "Commander") "Commander\n1 Your commander\n\n" else "") + "Deck\n1 Card name", 100000, singleLine = false, size = 13.5f) { m.updateDraft(text = it) }
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.height(44.dp).clip(RoundedCornerShape(11.dp)).background(Gold.copy(alpha = if (m.importBusy) .55f else 1f)).clickable(enabled = !m.importBusy, onClick = onPreview).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                Text(if (m.importBusy) "Matching cards…" else "Preview & match", style = sans(15f, FontWeight.Bold, Site.GoldInk)) }
            if (m.importReady) Box(Modifier.height(44.dp).clip(RoundedCornerShape(11.dp)).background(Site.Surface2).border(1.dp, Line, RoundedCornerShape(11.dp)).clickable(onClick = onUse).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                Text("Use this list", style = sans(15f, FontWeight.Bold)) }
        }
        Text("Pasted lists stay here until you save a copy in Decks.", style = sans(13f, color = Muted, line = 18.85f), modifier = Modifier.padding(top = 6.dp))
        val status = when { m.importBusy -> "Matching card names…"; m.importStatus == "selected" -> "List selected. Review it in Your deck."; m.importReady -> "Review the entries, then choose Use this list."; else -> null }
        m.error?.let { Text(it, style = sans(13.5f, color = WarnText, line = 19.575f), modifier = Modifier.padding(top = 6.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WarnFill).padding(horizontal = 12.dp, vertical = 10.dp)) }
        status?.let { Text(it, style = sans(15f, color = Muted, line = 21.75f), modifier = Modifier.padding(top = 6.dp)) }
        Notices(m.warnings, "Import notes"); Notices(m.unresolved, "Unmatched cards")
        val c = m.candidate
        if (m.importReady && c != null) {
            fun count(k: String) = c.getAsJsonArray(k)?.sumOf { (it as JsonObject).get("qty").asInt } ?: 0
            Text("Review imported list", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = (-.3).sp, color = Site.Text, lineHeight = 17.25.sp), modifier = Modifier.padding(top = 10.dp, bottom = 8.dp))
            Text("${count("cards")} cards" + if (count("side") > 0) " · ${count("side")} sideboard" else "", style = sans(13f, color = Muted, line = 18.85f))
            val rows = c.getAsJsonArray("cards").map { r -> (r as JsonObject).let { it["name"].asString to it["qty"].asInt } }
            androidx.compose.foundation.layout.BoxWithConstraints(Modifier.padding(top = 10.dp)) { DeckViewerBody(rows, c.get("commander")?.asString ?: "", { n -> factByName(n)?.card }, maxWidth, onCard) }
        }
    }
}

@Composable
private fun Field(label: String, value: String, placeholder: String, max: Int, singleLine: Boolean, size: Float, onChange: (String) -> Unit) {
    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Text(label, style = sans(12.5f, FontWeight.SemiBold, Muted, line = 18.125f))
        val shape = RoundedCornerShape(11.dp)
        Box(Modifier.fillMaxWidth().then(if (singleLine) Modifier.height(44.dp) else Modifier.height(137.dp)).clip(shape).background(Site.Surface).border(1.dp, Line, shape).padding(horizontal = 12.dp, vertical = 9.dp),
            contentAlignment = if (singleLine) Alignment.CenterStart else Alignment.TopStart) {
            val style = sans(size, FontWeight.SemiBold, Site.Text, line = size * 1.45f)
            if (value.isEmpty()) Text(placeholder, style = style.copy(color = Muted.copy(alpha = .7f)))
            BasicTextField(value, { if (it.length <= max) onChange(it) }, singleLine = singleLine, textStyle = style, cursorBrush = SolidColor(Gold),
                modifier = Modifier.fillMaxWidth().then(if (singleLine) Modifier else Modifier.fillMaxHeight().verticalScroll(rememberScrollState())))
        }
    }
}

/** play-menu.js notices: a collapsed warn note "Title (n)" listing each entry. */
@Composable
private fun Notices(items: List<String>, title: String) {
    if (items.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    Column(Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(WarnFill).clickable { open = !open }.padding(horizontal = 12.dp, vertical = 10.dp)) {
        Box(Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.CenterStart) { Text("$title (${items.size})", style = sans(13.5f, color = WarnText, line = 19.575f)) }
        if (open) items.forEach { Text("•  $it", style = sans(13.5f, color = WarnText, line = 19.575f)) }
    }
}

// ---------------------------------------------------------------- inspector sheet

@Composable
private fun Inspector(m: LobbyModel, onRemove: () -> Unit, onSave: (JsonObject) -> Unit, onOpenSaved: (String) -> Unit, onCard: (String) -> Unit) {
    val deck = m.seat(m.inspected)
    val seatName = if (m.inspected == "player") "Your deck" else "CPU deck"
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).tap { m.inspectOpen = false }, contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.fillMaxWidth().widthIn(max = 640.dp).fillMaxHeight().clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)).background(Site.Surface)
            .border(1.dp, Line, RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)).tap { }.windowInsetsPadding(WindowInsets.safeDrawing)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(seatName, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Site.Text), modifier = Modifier.weight(1f))
                if (deck != null) Box(Modifier.height(44.dp).pill(Site.Surface2, Line).clickable(onClick = onRemove).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    Text("Remove from seat", style = sans(13.5f, FontWeight.Bold)) }
                Box(Modifier.size(44.dp).clip(CircleShape).background(Site.Surface2).border(1.dp, Line, CircleShape).clickable { m.inspectOpen = false }, contentAlignment = Alignment.Center) {
                    androidx.compose.foundation.Image(SiteIcons.Close, "Close deck details", Modifier.size(20.dp), colorFilter = ColorFilter.tint(Site.Text)) }
            }
            if (deck == null) {
                Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("◇", style = sans(22f, color = Gold)); Text("Choose your next game plan.", style = sans(14f)); Text("Choose a deck, then Inspect it from its seat.", style = sans(12.5f, color = Muted)) }
                return@Column
            }
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(14.dp)).background(Site.Surface2)) {
                    coverOf(deck.raw)?.let { Pic(it, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, .45f to Color.Transparent, 1f to Color(0xE607080B))))
                    Column(Modifier.align(Alignment.BottomStart).padding(16.dp)) {
                        Text(deck.name, style = cinzel(19f, Color.White))
                        Text("${deck.format} · ${deck.count} cards" + if (deck.side > 0) " · ${deck.side} sideboard" else "", style = sans(13.5f, color = Color(0xFFE6E8EC)))
                    }
                }
                val ok = forgeCpuDeckComplete(deck.raw) || (deck.raw.getAsJsonArray("cards")?.size() ?: 0) > 0
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Site.Surface2.copy(alpha = .5f)).border(1.dp, Line, RoundedCornerShape(14.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(if (ok) "Checked when you play" else "List needs review", style = sans(14f, FontWeight.Bold))
                    Text(if (ok) "Your exact cards will be checked for format legality and game support before the match begins." else "Choose a complete deck with valid card names, quantities and format.", style = sans(13f, color = Muted))
                }
                if (deck.source != "saved") {
                    PlayDeckSaver.version.collectAsState().value; Workspace.decks.collectAsState().value
                    val savedCopy = PlayDeckSaver.savedId(deck.raw); val pending = PlayDeckSaver.isSaving(deck.raw)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (savedCopy != null) {
                            Text("Saved to Your decks", style = sans(12.5f, color = Muted))
                            Box(Modifier.height(44.dp).clip(RoundedCornerShape(11.dp)).background(Site.Surface2).border(1.dp, Line, RoundedCornerShape(11.dp)).clickable { onOpenSaved(savedCopy) }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                                Text("Open saved deck", style = sans(13.5f, FontWeight.Bold)) }
                        } else {
                            Box(Modifier.height(44.dp).alpha(if (pending) .55f else 1f).clip(RoundedCornerShape(11.dp)).background(Site.Surface2).border(1.dp, Line, RoundedCornerShape(11.dp)).clickable(enabled = !pending) { onSave(deck.raw) }.padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                                Text(if (pending) "Saving deck…" else "Save deck", style = sans(15f, FontWeight.Bold)) }
                            Text("Temporary for this match", style = sans(12.5f, color = Muted))
                        }
                    }
                }
                val rows = deck.raw.getAsJsonArray("cards")?.mapNotNull { r -> (r as? JsonObject)?.let { (it.get("name")?.asString ?: "") to (it.get("qty")?.asDouble?.toInt() ?: 0) } } ?: emptyList()
                androidx.compose.foundation.layout.BoxWithConstraints { DeckViewerBody(rows, deck.commander, { n -> factByName(n)?.card }, maxWidth, onCard) }
            }
        }
    }
}

/** A picture by URL through the app's art loader (homeArt: the Coil cache on the phone, files in the screenshot tests). */
@Composable
private fun Pic(url: String?, modifier: Modifier, contentScale: ContentScale = ContentScale.Crop, alpha: Float = 1f, colorFilter: ColorFilter? = null,
                alignment: Alignment = Alignment.Center) {
    val p = heroPainter(url?.let(homeArt)) ?: return
    androidx.compose.foundation.Image(p, null, modifier, alignment = alignment, contentScale = contentScale, alpha = alpha, colorFilter = colorFilter)
}

// ---------------------------------------------------------------- friends

class FriendActions(val copy: (String) -> Unit, val share: (String) -> Unit, val cancel: () -> Unit, val useInvite: () -> Unit,
                    val accept: (FriendRooms.Challenge) -> Unit, val decline: (FriendRooms.Challenge) -> Unit)

private val FriendBlue = Color(0xFF8EC5FF)

/** The friend's seat: an open slot, the room waiting with its link, or the room you were invited to. */
@Composable
private fun FriendSeat(m: LobbyModel, f: FriendActions) {
    val shape = RoundedCornerShape(bottomStart = 18.dp, bottomEnd = 18.dp)
    val room = m.room
    val (who, title, detail) = when (room) {
        is LobbyModel.Room.Waiting -> Triple("FRIEND", "Waiting for your friend", "Send them the link. The room opens the match when they join.")
        is LobbyModel.Room.Guest -> Triple("FRIEND’S ROOM", "${room.format} match", room.from?.let { "Challenge from $it" } ?: "Pick your deck, then join.")
        LobbyModel.Room.Busy -> Triple("FRIEND", "Opening the room…", "")
        else -> Triple("FRIEND", "Invite a friend", "Create a room and send the link, or paste one you were sent.")
    }
    Box(Modifier.fillMaxWidth().heightIn(min = 175.dp).shadow(22.dp, shape, ambientColor = Color(0x77000000), spotColor = Color(0x77000000)).clip(shape)
        .background(Brush.radialGradient(listOf(Color(0xFF1B2130), Color(0xFF0E1016)), center = Offset(.3f, .5f))).border(1.dp, Color(0x40D6AD64), shape)) {
        if (room is LobbyModel.Room.Guest) Backs(Modifier.align(Alignment.CenterStart).padding(start = 10.dp)) else Slot(Modifier.align(Alignment.CenterStart).padding(horizontal = 40.dp))
        Column(Modifier.align(Alignment.CenterEnd).padding(top = 18.dp, bottom = 18.dp, start = 112.dp, end = 18.dp).fillMaxWidth(), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(who, style = sans(11f, FontWeight.Bold, FriendBlue, 1.76f, 16f), textAlign = TextAlign.End)
            Text(title, style = cinzel(21f, line = 23.5f), textAlign = TextAlign.End)
            if (detail.isNotEmpty()) Text(detail, style = sans(13f, color = Color(0xFFD3D9DF)), textAlign = TextAlign.End)
            if (room is LobbyModel.Room.Waiting) FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf<Pair<String, () -> Unit>>("Copy link" to { f.copy(room.invite) }, "Share" to { f.share(room.invite) }, "Cancel" to { f.cancel() }).forEach { (l, a) ->
                    Box(Modifier.height(44.dp).pill(Color(0xB30C0E13), Color(0x66D6AD64)).clickable(onClick = a).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) { Text(l, style = sans(13.5f, FontWeight.Bold, Color(0xFFF1E9D8))) }
                }
            }
            if (room is LobbyModel.Room.Guest) Box(Modifier.height(44.dp).pill(Color(0xB30C0E13), Color(0x33FFFFFF)).clickable { f.cancel(); m.room = LobbyModel.Room.Idle }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) { Text("Leave room", style = sans(13.5f, FontWeight.Bold, Color(0xFFF1E9D8))) }
        }
    }
}

/** Above the Create room button: a link you were sent, and the challenges friends have for you. */
@Composable
private fun FriendInvite(m: LobbyModel, f: FriendActions) {
    if (m.room !is LobbyModel.Room.Idle) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        m.challenges.forEach { c ->
            Row(Modifier.fillMaxWidth().pill(TabsFill, Color(0x66D6AD64)).padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${c.fromName ?: "A friend"} challenges you · ${c.format}", style = sans(13.5f, FontWeight.SemiBold, Site.Text), modifier = Modifier.weight(1f))
                Box(Modifier.height(40.dp).pill(Color(0x33E8B95B), Color(0x99D6AD64)).clickable { f.accept(c) }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) { Text("Accept", style = sans(13.5f, FontWeight.Bold, Gold)) }
                Box(Modifier.height(40.dp).clickable { f.decline(c) }.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) { Text("Not now", style = sans(13.5f, color = Muted)) }
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f).height(44.dp).pill(TabsFill, Line).padding(horizontal = 14.dp), contentAlignment = Alignment.CenterStart) {
                androidx.compose.foundation.text.BasicTextField(m.inviteText, { m.inviteText = it.take(400) }, singleLine = true, textStyle = sans(14f, color = Site.Text), cursorBrush = SolidColor(Gold), modifier = Modifier.fillMaxWidth(),
                    decorationBox = { inner -> if (m.inviteText.isEmpty()) Text("Paste a friend’s invite link", style = sans(14f, color = Muted)); inner() })
            }
            Box(Modifier.height(44.dp).pill(Color(0x33E8B95B), Color(0x99D6AD64)).clickable(onClick = f.useInvite).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) { Text("Join", style = sans(14f, FontWeight.Bold, Gold)) }
        }
    }
}
