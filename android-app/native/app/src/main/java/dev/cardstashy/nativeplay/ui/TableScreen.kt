package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.StackItem
import kotlin.math.sign
import kotlinx.coroutines.launch
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.layoutId
import kotlin.math.PI
import kotlin.math.sin
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.withFrameNanos
import androidx.compose.runtime.SideEffect
import kotlinx.coroutines.delay
import androidx.compose.animation.core.animateFloat
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.unit.em
import androidx.compose.animation.core.spring
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import dev.cardstashy.nativeplay.audio.TableAudio
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Prompt
import dev.cardstashy.nativeplay.match.Beat
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.Stage

/** Sizes per screen profile, fixed for the match (phone 844×390; Fold/tablet scaled once at open). */
private data class Sizes(val sidebar: Dp, val field: Dp, val land: Dp, val hand: Dp, val back: Dp) {
    fun h(w: Dp) = w * 1.4f
}

@Composable
fun TableScreen(controller: MatchController, onHome: () -> Unit, onRematch: () -> Unit, resultNote: String? = null, cpuPlate: dev.cardstashy.nativeplay.match.Plate? = null,
    youPlate: dev.cardstashy.nativeplay.match.Plate? = null,
    storyMusic: dev.cardstashy.nativeplay.audio.TableMusic.StoryMusic? = null, mat: String? = null) {
    val context = LocalContext.current
    val decks = DemoDecks.load(context)
    val shown by controller.shown.collectAsState()
    val beat by controller.beat.collectAsState()
    // A TRIGGER SHOWS ITSELF: the trigger beat now playing (the board draws it; on two screens it stays on the top screen with the board).
    val trig by controller.trigger.collectAsState()
    val travel by controller.travel.collectAsState()
    // The CPU's last action stays in the feed, quieter, until the next turn's banner.
    var lastBeat by remember { mutableStateOf<Beat?>(null) }
    LaunchedEffect(beat) { beat?.let { lastBeat = it } }
    val banner by controller.banner.collectAsState()
    LaunchedEffect(banner) { if (banner != null) lastBeat = null }
    val stage by controller.stage.collectAsState()
    val live by controller.live.collectAsState()
    val failure by controller.failure.collectAsState()
    val audio = remember { TableAudio(context) }
    val musicScope = rememberCoroutineScope()
    // The map on this table, chosen once here (a Story battle's own act mat, else play-playmats.js nextPlaymat): the scene draws it
    // and the music plays its two songs (specs/stage-music-brief.md), so the two can never differ.
    val matId = mat ?: remember { Playmats.next(context) }
    val music = remember { dev.cardstashy.nativeplay.audio.TableMusic.init(context); dev.cardstashy.nativeplay.audio.TableMusic(context, musicScope, storyMusic, matId) }
    // The music lasts only while the table is on screen.
    DisposableEffect(Unit) { onDispose { audio.release(); music.release() } }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { audio.muted = true; music.muted = true; controller.setPaused(true) }
    LifecycleEventEffect(Lifecycle.Event.ON_START) { audio.muted = false; music.muted = false; controller.setPaused(false) }
    var previous by remember { mutableStateOf<MatchState?>(null) }
    // Keyed on the shown state itself: the board can advance within one revision (one CPU action at a time).
    LaunchedEffect(shown) { shown?.let { audio.update(previous, it); music.update(it); previous = it } }
    audio.fxCues = !Motion.still
    audio.paying = travel?.travel?.leg.let { it == dev.cardstashy.nativeplay.match.Director.Leg.TAPS || it == dev.cardstashy.nativeplay.match.Director.Leg.TO_POOL }
    val cuePlan = remember(audio) { { rev: Long, cues: Set<String> -> audio.planned(rev, cues) } }
    val cue = remember(audio) { { id: String, vol: Float, rate: Float -> audio.play(id, vol, rate) } }
    // The turn clock (cue map, butter pass B1): silent as a window opens, TT-007 softly for the last 5 s, TT-008 at zero. Yours only.
    // One loop for the whole match (ClockCues keeps the count across the clock's per-second re-emissions, so no tick is lost).
    LaunchedEffect(audio) {
        val cues = ClockCues { id, vol -> audio.play(id, vol) }
        while (true) { cues.step(controller.clock.value, android.os.SystemClock.elapsedRealtime()); delay(100) }
    }
    var inspect by remember { mutableStateOf<Card?>(null) }
    var selectedHand by remember { mutableStateOf<Int?>(null) }
    var menu by remember { mutableStateOf(false) }
    val matchMenu = remember { MatchMenu(controller.input, onConcede = { controller.concede() }, onLeave = onHome) }
    // Two screens: the hand chip walks every card (A plays it, or opens it when it can't be played), so the lift stays while the
    // card is in your hand (U8). One screen: a lift that can no longer be played drops, as before, unless it is a card to discard.
    LaunchedEffect(shown?.revision) {
        val s = shown
        val keep = if (DualScreen.active) s?.me?.hand?.any { it.id == selectedHand } == true
            else s?.selection?.actionable?.contains(selectedHand) == true || (dev.cardstashy.nativeplay.match.TurnClock.discardCount(s) != null && s?.selection?.cards?.contains(selectedHand) == true)
        if (!keep) selectedHand = null
    }

    // On two screens the card shows below while play goes on above: the clock keeps running (test4: it froze at 90 and 30).
    LaunchedEffect(inspect != null) { controller.hold("inspect", inspect != null && !DualScreen.active) }
    // ...and the next decision or step puts the bottom screen back to your hand.
    LaunchedEffect(shown?.turn, shown?.phase, shown?.waitingOnMe) { if (DualScreen.active) inspect = null }
    LaunchedEffect(menu) { controller.hold("menu", menu) }
    LaunchedEffect(matchMenu.ask) { controller.hold("leave", matchMenu.ask != null) }
    val afk by controller.afkNote.collectAsState()
    // A line from the table itself ("Block not assigned. Try again."), the site's localError.
    val note by controller.note.collectAsState()
    val told by controller.told.collectAsState()
    val anchors = remember { Anchors() }
    // 0.4.60 G6 (glow-rules.md "The ability opens on the card"): the open card's ability rows, and Activate while Forge lets you use
    // one: it puts the card down and runs Forge's own activation path (the tap that used to fire at once).
    val boardLive = live && beat == null && trig == null && travel == null
    val abilityNow = remember(inspect, shown, boardLive) { inspect?.let { c -> shown?.let { abilityView(c, it, boardLive) } } }
    val activate: (() -> Unit)? = inspect?.takeIf { abilityNow?.usable == true }?.let { c -> { inspect = null; controller.intents.card(c.id) } }
    // A tap or A on a ringed permanent opens it with its rows. On two screens the table stays in view above while it is open, so a
    // second press on the same card is the tag's own: A activates, a tap puts it down.
    val onAbility: (Card) -> Unit = { c ->
        when (abilityPress(DualScreen.active, inspect?.id, c.id, TablePad.byPad, activate != null)) {
            AbilityPress.OPEN -> inspect = c; AbilityPress.ACTIVATE -> activate?.invoke(); AbilityPress.CLOSE -> inspect = null
        }
    }
    // The match owns the controller while it is on: the screens under it lend no buttons (ForgeBoard sets X and Start).
    PadScreen(PadActs(opaque = true))
    // A controller's B on the bare table opens the match menu (Concede, Return to Play setup are in it) instead of doing nothing.
    // Only with a pad and nothing else up; a phone keeps its back exactly as it was. Overlays' own B handlers come later and win.
    val padOn by Pad.connected.collectAsState()
    val bareTable = padOn && stage == Stage.PLAYING && inspect == null && !menu && !matchMenu.open && !matchMenu.history &&
        shown?.prompt == null && !TableEmotes.menuOpen && matchMenu.ask == null
    androidx.activity.compose.BackHandler(bareTable) { matchMenu.open = true }
    if (bareTable) PadScreen(PadActs(b = "Menu"))
    // Any touch of the table says you are here (the clock's missed-turn count clears); the touch still reaches the table.
    // A controller's key press says the same (seen first, never consumed).
    Box(Modifier.fillMaxSize().background(Palette.Night).pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial); if (e.type == androidx.compose.ui.input.pointer.PointerEventType.Press) controller.poke() } } }
        .onPreviewKeyEvent { if (Pad.connected.value && it.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN) controller.poke(); false }) {
      CompositionLocalProvider(LocalAnchors provides anchors, LocalTableCue provides cue, LocalTablePlan provides cuePlan) {
        PlaymatScene(matId, Modifier.fillMaxSize()) // this match's mat, its own shade, the table root see-through
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            val k = if (maxHeight >= 600.dp) 1.45f else if (maxHeight >= 480.dp) 1.2f else 1f
            val sizes = Sizes(sidebar = if (maxWidth >= 1000.dp) 280.dp else 168.dp, field = 46.dp * k, land = 36.dp * k, hand = 60.dp * k, back = 20.dp * k)
            val st = shown
            when {
                stage == Stage.TOSS -> { val t = controller.toss.collectAsState().value; if (t != null) TossScreen(t, cpuPlate, onDone = { controller.tossFinished() }, you = youPlate) else Loading() }
                st == null || stage == Stage.STARTING -> Loading()
                // The keep is a decision with the same clock as the table's: the ring on Keep (the site's ok key), from LocalMatchClock.
                stage == Stage.MULLIGAN -> CompositionLocalProvider(LocalMatchClock provides controller.clock.collectAsState().value) {
                    Mulligan(st, live, onOk = { controller.ok() }, onCancel = { controller.cancel() },
                        onCard = { controller.card(it) }, onDeal = { audio.play("QP-012", .55f) }, onHold = { inspect = it },
                        deck = remember(youPlate) { mullDeckOf(controller.input, youPlate?.name) }) }
                else -> {
                    var handOrder by remember { mutableStateOf(emptyList<Int>()) }
                    // table-emotes.mjs mount(): the CPU's hello once the match is on; everything goes with the table.
                    LaunchedEffect(Unit) { TableEmotes.start(this) }
                    DisposableEffect(Unit) { onDispose { TableEmotes.destroy() } }
                    CompositionLocalProvider(LocalMatchClock provides controller.clock.collectAsState().value, LocalTrigger provides trig, LocalTravel provides travel,
                        LocalLastMoves provides controller.moves.collectAsState().value, LocalHeld provides controller.held.collectAsState().value) {
                    ForgeBoard(st, live && beat == null && trig == null && travel == null, controller.intents, selectedHand, { selectedHand = it }, { inspect = it }, { menu = true },
                        handOrder, { handOrder = it }, menu = matchMenu, afk = if (DualScreen.active) afk else null, onAbility = onAbility,
                        abilityOpen = inspect?.id?.takeIf { abilityNow != null }) {
                        TableSide(st, controller, beat, live, lastBeat) { inspect = it }
                    }
                    }
                }
            }
            // Better table scene 7: the turn banner waits for a hit still landing on a player, then plays its own time.
            WaitedBanner(banner)
        }
        ((if (DualScreen.active) null else afk) ?: note)?.let { Text(it, style = Type.Label.copy(color = Color(0xFFFFB4A8), fontSize = 14.sp), modifier = Modifier.align(Alignment.TopCenter).padding(top = 96.dp)
            .clip(RoundedCornerShape(999.dp)).background(Color(0xD90C0C0E)).border(1.dp, Palette.Red, RoundedCornerShape(999.dp)).padding(horizontal = 16.dp, vertical = 8.dp)) }
        // Better table scene 1: what a choice did ("Scry: 0 top, 1 bottom"), three seconds on the table; under the red note when both show.
        told?.let { t -> BoxWithConstraints(Modifier.fillMaxSize()) { TableBubble(t, Du(chromeU(maxWidth, maxHeight)),
            Modifier.align(Alignment.TopCenter).padding(top = if ((if (DualScreen.active) null else afk) ?: note != null) 140.dp else 96.dp)) } }
      }
        // Two screens: a card you look at opens on the bottom screen, so the table stays in full view on top (B closes it).
        // Start still opens the match menu from an open inspect (U8: on two screens the ring can't come down to it).
        val inspectStart = PadAct("Menu") { inspect = null; matchMenu.open = true }
        // 0.4.60 G3: the one inspect view lists what is attached to the card; a tap on one of those opens it in the same view.
        // Randall 15 Nov (Disenchant on Weakness): an attached card the question offers is picked from the row, and the page closes.
        inspect?.let { c -> val att = attachedOf(shown, shown?.card(c.id)?.takeIf { it.zone == c.zone } ?: c)
            val picks = attachedPicks(shown, boardLive, att)
            val openAtt: (Card) -> Unit = { a -> if (a.id in picks) { inspect = null; controller.intents.card(a.id) } else inspect = a }
            if (DualScreen.active) BottomScreen { CardInspect(c, shown?.viewer, inspectStart, beside = true, attached = att, onAttached = openAtt, picks = picks, ability = abilityNow, onActivate = activate) { inspect = null } }
            else {
                // Better table scene 13: a card on the battlefield opens beside its tile (its anchor, read once as it opens; an Aura
                // read from the Attached row stands beside its card edge).
                val near = remember(c.id) { if (c.zone == "Battlefield") anchors.rects["c${c.id}"] ?: anchors.rects["aura${c.id}"] else null }
                CardInspect(c, shown?.viewer, inspectStart, attached = att, onAttached = openAtt, picks = picks, ability = abilityNow, onActivate = activate, near = near) { inspect = null }
            } }
        if (menu) Menu(onConcede = { menu = false; matchMenu.ask = "concede" }, onLeave = { menu = false; matchMenu.ask = "leave" }, onClose = { menu = false })
        MatchLeaveConfirm(matchMenu)
        // Living table F7: the result card waits for the winning hit to be seen (not after a concession).
        if (stage == Stage.FINISHED) shown?.let { Result(it, audio, onHome, onRematch, resultNote, endReason(it, controller.conceded), holdMs = { if (controller.conceded) 0L else TableFeel.resultWaitFor(it) }) }
        if (stage == Stage.FAILED) Failed(failure ?: "The match stopped.", onHome)
    }
}

@Composable
private fun Loading() {
    // The library waiting to be dealt; no words.
    val breathe = androidx.compose.animation.core.rememberInfiniteTransition(label = "deck").animateFloat(.55f, 1f,
        androidx.compose.animation.core.infiniteRepeatable(tween(700), androidx.compose.animation.core.RepeatMode.Reverse), label = "a")
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CardBack(Modifier.size(64.dp, 90.dp).alpha(breathe.value).clip(RoundedCornerShape(5.dp))) }
}

// ---- The opening hand: nothing else is drawn before the keep ----

/**
 * The opening hand (table-feel spec 1, Randall 4 Nov 18:18Z; better table scene 11, 16 Nov). The table dims under it (its seats keep
 * their corners there); who goes first is the title, in gold, with what the CPU kept under it once Forge says so, and the mulligan
 * pips. The seven cards fan large across the screen. Mulligan (dark glass, "to 6" under it) and Keep 7 (the gold main button with the
 * decision's clock) stand side by side under the hand. A held "View table" (top right, or the controller's Y held) hides it all.
 */
@Composable
internal fun Mulligan(st: MatchState, live: Boolean, onOk: () -> Unit, onCancel: () -> Unit, onCard: (Int) -> Unit, onDeal: () -> Unit, onHold: (Card) -> Unit,
                      deck: MullDeck? = null) {
    // 0.4.59 T9: every number from Forge (MulliganProbe on the real engine): it puts the cards on the bottom right after a
    // mulligan (InputLondonMulligan, "Return N card(s)"), then asks Keep or Mulligan again with the smaller hand.
    val lines = mulliganLines(st)
    val mulls = lines.mulls
    val london = st.inputType == "InputLondonMulligan"
    // Forge lists no cards to pick while it asks for the bottom; every card in the opening hand is the pick (live 0.4.58: a tap
    // there only opened the card, so only Auto could answer).
    val choosing = london || (st.inputType != "InputConfirmMulligan" && st.selection.cards.isNotEmpty())
    fun pickable(card: Card) = mullPickable(st, live, card)
    var ringed by remember { mutableStateOf<Int?>(null) }
    val yours = live && st.waitingOnMe
    val youFirst = Regex("(?i)\\byou (are|go|will go)( going)? first").containsMatchIn(st.message) ||
        !Regex("(?i)going first|goes first").containsMatchIn(st.message) && st.activePlayer == st.viewer
    val kept = cpuKeptLine(st, youFirst)
    val keep = keepLabel(st)
    // Better table scene 11: "View table", held. Not while cards go to the bottom: then every tap is a pick.
    val peek = rememberTablePeek()
    LaunchedEffect(choosing) { if (choosing) peek.held = false }
    // Cue map: the coin lands as the title comes in (QP-010 you / QP-011 CPU), Keep QP-013, Mulligan QP-014, a card to the bottom QP-015.
    val cue = LocalTableCue.current
    LaunchedEffect(youFirst) { cue?.invoke(if (youFirst) "QP-010" else "QP-011", .8f, 1f) }
    // A controller's X is the gold Keep (its words and its tap) while it is yours to press; Y held shows the table.
    PadScreen(PadActs(x = if (yours && st.buttons.okEnabled) PadAct(keep) { if (!choosing) cue?.invoke("QP-013", 1f, 1f); onOk() } else null,
        yHold = if (choosing) null else { held -> peek.held = held }))
    val ctx = androidx.compose.ui.platform.LocalContext.current.applicationContext
    val calm = Motion.still || remember { Playmats.reduced(ctx) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val W = maxWidth; val H = maxHeight
        val d = Du(chromeU(W, H))
        with(d) {
            // The table under the hand: the two seats in their corners, dimmed with it (View table shows them clear). The CPU's
            // sits top left, so the top right is View table's.
            Medallion(st.cpu, mine = false, pickable = false, picked = false, modifier = Modifier.offset(x = 80.du, y = 26.du), d = d) {}
            Medallion(st.me, mine = true, pickable = false, picked = false, modifier = Modifier.offset(x = 80.du, y = H - 78.du), d = d) {}
            Box(Modifier.fillMaxSize().peekHides(peek).background(MULL_DIMMER)) {
                // Sizes: the cards take 17 % of the width (held by the height on a phone); the pair stands at 84 % of the height,
                // or higher when its line would leave the screen.
                val cardW = minOf(W * .17f, H * .46f / 1.4f)
                val pairTop = minOf(H * .84f, H - 48.du - 30.du)
                val titleSp = minOf(W.value * .034f, H.value * .062f).coerceIn(20f, 32f)
                // Who goes first, the title: it settles in from above (a spring, 0 to 1); Motion.still and reduced motion stand still.
                val enter = remember(youFirst) { Animatable(if (calm) 1f else 0f) }
                LaunchedEffect(youFirst) { if (!calm) enter.animateTo(1f, spring(dampingRatio = .78f, stiffness = 170f)) }
                val short = H < 480.dp
                Column(Modifier.align(Alignment.TopCenter).padding(top = if (short) H * .035f else H * .055f).graphicsLayer {
                        val q = enter.value; alpha = q.coerceIn(0f, 1f); translationY = (1f - q) * -18.du.toPx(); val s = 1.06f - .06f * q; scaleX = s; scaleY = s },
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.du)) {
                        MullFlourish(false, Modifier.size(54.du, 12.du))
                        Text(if (youFirst) "You go first" else "CPU goes first", Modifier.anchorRect("mull.title"),
                            style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = titleSp.sp,
                                letterSpacing = .1.em, color = MULL_GOLD, shadow = androidx.compose.ui.graphics.Shadow(Color(0x99C4903A), Offset(0f, 0f), 18f)), maxLines = 1)
                        MullFlourish(true, Modifier.size(54.du, 12.du))
                    }
                    // Under the title: what the CPU kept, then three pips (7, 6, 5), the gold one the hand you are on. A short screen (a
                    // phone) puts the pips beside the line so the hand keeps its size.
                    val keptLine: @Composable () -> Unit = {
                        if (kept != null && !choosing) Text(buildAnnotatedString {
                                withStyle(androidx.compose.ui.text.SpanStyle(color = CpuRed.copy(alpha = .95f), fontWeight = FontWeight.Bold)) { append("CPU") }
                                append(kept.removePrefix("CPU"))
                            }, Modifier.anchorRect("mull.kept"), style = sans(sp(14f), FontWeight.SemiBold, Color(0xFFB9B1A0)), maxLines = 1)
                    }
                    val pips: @Composable () -> Unit = {
                        Row(Modifier.anchorRect("mull.pips"), horizontalArrangement = Arrangement.spacedBy(9.du), verticalAlignment = Alignment.CenterVertically) {
                            repeat(3) { i -> val on = i == mulls.coerceAtMost(2)
                                Box(Modifier.size(if (on) 8.du else 6.du).drawBehind {
                                    if (on) drawCircle(MULL_GOLD.copy(alpha = .35f), radius = size.minDimension)
                                }.clip(CircleShape).background(if (on) MULL_GOLD else Color(0x40F3E9D2))) }
                        }
                    }
                    if (short) Row(Modifier.padding(top = 1.du), horizontalArrangement = Arrangement.spacedBy(14.du), verticalAlignment = Alignment.CenterVertically) { keptLine(); pips() }
                    else { Box(Modifier.padding(top = 2.du)) { keptLine() }; Box(Modifier.padding(top = 8.du)) { pips() } }
                }
                // The hand, large across the felt: seven cards step about 12.6 % of the width, on a shallow arc.
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    HandFan(keepHand(st.me.hand), cardW, Modifier.width(W * .926f).offset(y = -(H * .025f)).anchorRect("mull.fan"), angleDeg = 3.2f, dealIn = true, arc = H * .0053f,
                        markOf = { card -> if (card.id in st.selection.chosenCards) Mark.PICKED else if (pickable(card)) Mark.PICKABLE else Mark.NONE },
                        onTap = { card -> if (pickable(card)) { if (choosing) cue?.invoke("QP-015", .8f, 1f); onCard(card.id) } else onHold(card) },
                        onHold = onHold, onDeal = onDeal, pop = 1.2f, onCarry = { id -> if (id != null) ringed = id })
                }
                // Two screens: Keep and Mulligan live on the bottom screen with the card under the ring (MulliganBottom); the top is the hand.
                if (DualScreen.active) BottomScreen { MulliganBottom(st, lines, st.me.hand.firstOrNull { it.id == ringed } ?: st.me.hand.firstOrNull(), deck, yours, choosing, youFirst,
                    peek = peek, kept = kept,
                    onKeep = { if (!choosing) cue?.invoke("QP-013", 1f, 1f); onOk() }, onMull = { if (!choosing) cue?.invoke("QP-014", 1f, 1f); onCancel() }) }
                else if (yours) Box(Modifier.fillMaxWidth().padding(top = pairTop)) {
                    val minW = maxOf(W * .17f, 128.du)
                    val mull = if (choosing) null else st.buttons.cancel?.takeIf { st.buttons.cancelEnabled }
                    // The pair splits either side of the middle; alone (while cards go to the bottom) the gold button stands in the middle.
                    if (mull != null) Row(Modifier.align(Alignment.TopEnd).padding(end = W * .52f), horizontalArrangement = Arrangement.spacedBy(12.du), verticalAlignment = Alignment.CenterVertically) {
                        // The turn clock's ring is on Keep (GoldPill); its last-10 count stands before the pair, never on Mulligan.
                        TurnCount(d.u)
                        MullGlass(mull, mullTo(st), Modifier.height(48.du).widthIn(min = minW).anchorRect("mull"), d) { cue?.invoke("QP-014", 1f, 1f); onCancel() }
                    }
                    CompositionLocalProvider(LocalTurnCountOutside provides (mull != null)) {
                        GoldPill(keep, st.buttons.okEnabled, Modifier.align(if (mull != null) Alignment.TopStart else Alignment.TopCenter)
                            .padding(start = if (mull != null) W * .52f else 0.dp).widthIn(min = minW).height(48.du).anchorRect("gold"), d, height = 48.du, press = null) {
                            if (!choosing) cue?.invoke("QP-013", 1f, 1f); onOk() }
                    }
                    // T9: one line under the pair says what Mulligan does, with Forge's numbers; while cards go to the bottom, Forge's own line.
                    val under = if (choosing) lines.caption else if (mull != null) lines.mullLine else null
                    under?.let { Text(it, Modifier.align(Alignment.TopCenter).padding(top = 48.du + 8.du).anchorRect(if (choosing) "mull.caption" else "mull.line"),
                        style = sans(sp(12.5f), FontWeight.Medium, Color(0xFFCFC6B2)), maxLines = 1) }
                }
                // Not yours to answer (the CPU is deciding): Forge's line where the pair would stand.
                else if (choosing) Text(lines.caption, Modifier.align(Alignment.TopCenter).padding(top = pairTop + 14.du).anchorRect("mull.caption"),
                    style = sans(sp(14f), FontWeight.Medium, Color(0xFFE6DCC6)), textAlign = TextAlign.Center)
            }
            if (!DualScreen.active && !choosing) PeekTablePill(peek, d, Modifier.align(Alignment.TopEnd).padding(top = H * .03f, end = W * .02f))
        }
    }
}

/** Scene 11's dimmer: the preview's opening dimmer, rgba(6, 7, 13, .62), lighter than the views' [TableDimmer] so the felt reads. */
private val MULL_DIMMER = Color(0x9E06070D)
private val MULL_GOLD = Color(0xFFE8B95B)

/** A gold hairline that fades in toward the title, ending in a small diamond beside it ([right]: the right-hand one, mirrored). */
@Composable
private fun MullFlourish(right: Boolean, modifier: Modifier, tone: Color = MULL_GOLD) = androidx.compose.foundation.Canvas(modifier) {
    val cy = size.height / 2; val r = size.height * .3f
    val tip = if (right) r else size.width - r
    val far = if (right) size.width else 0f
    drawLine(Brush.horizontalGradient(if (right) listOf(tone, Color.Transparent) else listOf(Color.Transparent, tone), startX = minOf(tip, far), endX = maxOf(tip, far)),
        Offset(far, cy), Offset(tip, cy), strokeWidth = 1.dp.toPx())
    val p = androidx.compose.ui.graphics.Path().apply { moveTo(tip - r, cy); lineTo(tip, cy - r); lineTo(tip + r, cy); lineTo(tip, cy + r); close() }
    drawPath(p, tone)
}

/**
 * Mulligan: the dark glass pill (#161A27, a #3A4260 hairline), Forge's word with the hand it leaves under it ("to 6"). A press dips it
 * (96 %, 90 ms) and lets it back.
 */
@Composable
private fun MullGlass(label: String, sub: String?, modifier: Modifier, d: Du, onClick: () -> Unit) = with(d) {
    val src = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val down by src.collectIsPressedAsState()
    val k by animateFloatAsState(if (down && !Motion.still) .96f else 1f, tween(90), label = "mullDip")
    val shape = RoundedCornerShape(999.dp)
    Box(modifier.graphicsLayer { scaleX = k; scaleY = k }
        .drawBehind { drawRoundRect(Color(0x73000000), topLeft = Offset(0f, 6.du.toPx()), size = size, cornerRadius = CornerRadius(size.height / 2)) }
        .clip(shape).background(Brush.verticalGradient(listOf(Color(0xFF1E2333), Color(0xFF161A27), Color(0xFF11141E))))
        .drawWithContent { drawContent(); drawLine(Color(0x26FFFFFF), Offset(size.height / 2, 1.dp.toPx()), Offset(size.width - size.height / 2, 1.dp.toPx()), 1.dp.toPx()) }
        .border(1.dp, Color(0xFF3A4260), shape)
        .clickable(interactionSource = src, indication = null, onClick = onClick).padding(horizontal = 22.du), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, style = sans(sp(15f), FontWeight.Bold, Color(0xFFF3E9D2)).copy(lineHeight = sp(17f)), maxLines = 1)
            sub?.let { Text(it, Modifier.anchorRect("mull.to"), style = sans(sp(11f), FontWeight.Medium, Color(0xFFF3E9D2).copy(alpha = .8f)).copy(letterSpacing = .04.em, lineHeight = sp(13f)), maxLines = 1) }
        }
    }
}

// ---- The board: CPU half above, yours below, hand fan at the bottom ----

@Composable
private fun Board(st: MatchState, c: MatchController, live: Boolean, sizes: Sizes, selectedHand: Int?, modifier: Modifier,
                  onSelectHand: (Int?) -> Unit, onInspect: (Card) -> Unit, onMenu: () -> Unit) {
    val me = st.me; val cpu = st.cpu
    fun markOf(card: Card): Mark = when {
        !live -> Mark.NONE
        card.id in st.selection.chosenCards || (st.inputType == "InputAttack" && card.attacking && card.controller == st.viewer) ||
            (st.inputType == "InputBlock" && card.blocking && card.controller == st.viewer) -> Mark.PICKED
        card.id in st.selection.cards -> Mark.PICKABLE
        card.id in st.selection.actionable -> Mark.PLAYABLE
        else -> Mark.NONE
    }
    fun tapOf(card: Card): (() -> Unit)? = if (live && (card.id in st.selection.cards || card.id in st.selection.actionable || card.id in st.selection.chosenCards ||
        ((st.inputType == "InputAttack" || st.inputType == "InputBlock") && card.controller == st.viewer && (card.attacking || card.blocking)))) ({ c.card(card.id) }) else null

    val yours = st.activePlayer == st.viewer
    BoxWithConstraints(modifier) {
    val edgeY by androidx.compose.animation.core.animateDpAsState(if (yours) maxHeight - sizes.h(sizes.hand) - 12.dp else sizes.h(sizes.back) + 8.dp, tween(300, easing = FastOutSlowInEasing), label = "edge")
    Box(Modifier.fillMaxWidth().height(2.dp).graphicsLayer { translationY = edgeY.toPx() }
        .background(Brush.horizontalGradient(listOf(Color.Transparent, Palette.Gold.copy(alpha = .75f), Color.Transparent))))
    Column(Modifier.fillMaxSize().padding(start = 6.dp, end = 6.dp, top = 4.dp)) {
        // CPU strip: menu, CPU hand backs, library and graveyard.
        Row(Modifier.fillMaxWidth().height(sizes.h(sizes.back) + 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onMenu), contentAlignment = Alignment.Center) {
                Text("≡", style = Type.Title.copy(fontSize = 22.sp, color = Palette.Gold))
            }
            CardRow(sizes.back, 3.dp, Modifier.weight(1f)) { repeat(cpu.handCount) { CardBack(Modifier.size(sizes.back, sizes.h(sizes.back)).clip(RoundedCornerShape(3.dp))) } }
            Piles(cpu.libraryCount, cpu.graveyard.lastOrNull(), cpu.graveyard.size, Modifier.padding(end = 4.dp), onInspect)
        }
        // CPU half: lands at the back, creatures in front.
        Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.SpaceEvenly) {
            Permanents(lands(cpu.battlefield), sizes.land, ::markOf, ::tapOf, onInspect)
            Permanents(others(cpu.battlefield), sizes.field, ::markOf, ::tapOf, onInspect, nudge = 10.dp)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, Palette.Hairline, Color.Transparent))))
        // Your half: creatures in front, lands behind.
        Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.SpaceEvenly) {
            Permanents(others(me.battlefield), sizes.field, ::markOf, ::tapOf, onInspect, nudge = (-10).dp)
            Permanents(lands(me.battlefield), sizes.land, ::markOf, ::tapOf, onInspect)
        }
        // Your seat and hand.
        Row(Modifier.fillMaxWidth().height(sizes.h(sizes.hand) + 8.dp), verticalAlignment = Alignment.Bottom) {
            Seat(me.life, "orb${me.id}", me.libraryCount, me.graveyard.lastOrNull(), me.graveyard.size, onInspect, pickable = live && st.viewer in st.selection.players, picked = st.viewer in st.selection.chosenPlayers) { c.player(st.viewer) }
            Hand(st, c, live, sizes, selectedHand, Modifier.weight(1f), onSelectHand, onInspect, onDeal = {})
        }
    }
    }
}

private fun lands(cards: List<Card>) = cards.filter { it.isLand && !it.isCreature && it.attachedTo == null }
private fun others(cards: List<Card>) = cards.filter { !(it.isLand && !it.isCreature) && it.attachedTo == null }

/** Lands and identical untouched permanents pile as ×N; everything else stands alone. Arrivals fade and rise in 180 ms; leaves fade out in 160 ms. */
@Composable
private fun Permanents(cards: List<Card>, w: Dp, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?, onInspect: (Card) -> Unit, nudge: Dp = 0.dp) {
    val piles = cards.groupBy { if (it.isLand && markOf(it) == Mark.NONE && tapOf(it) == null) "${it.name}|${it.tapped}" else "id${it.id}" }.values.toList()
    // Piles that just left stay in their old place for one short fade.
    val ghosts = remember { mutableStateListOf<Pair<Int, List<Card>>>() }
    var before by remember { mutableStateOf(piles) }
    val ids = piles.map { it.first().id }
    val present = cards.map { it.id }.toSet()
    // Only cards that were already here skip the arrival; a pile regrouping (a land tapping) never fades.
    val known = remember { HashSet<Int>() }
    val firstFrame = remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { firstFrame.value = false }
    LaunchedEffect(ids) {
        val gone = before.withIndex().filter { (_, p) -> p.none { it.id in present } && ghosts.none { it.second.first().id == p.first().id } }
        before = piles
        if (gone.isEmpty()) return@LaunchedEffect
        gone.forEach { (i, p) -> ghosts.add(i to p) }
        delay(160)
        ghosts.removeAll { g -> gone.any { it.value.first().id == g.second.first().id } }
    }
    val shown = piles.map { it to false }.toMutableList()
    ghosts.sortedBy { it.first }.forEach { (i, p) -> if (p.none { it.id in present }) shown.add(i.coerceAtMost(shown.size), p to true) }
    CardRow(w, 6.dp, Modifier.fillMaxWidth().height(w * 1.4f + 8.dp)) {
        shown.forEach { (pile, leaving) ->
            val card = pile.first()
            key(card.id, leaving) {
                val fresh = !leaving && pile.none { it.id in known }
                SideEffect { pile.forEach { known.add(it.id) } }
                val arrive = remember { Animatable(if (leaving || !fresh) 1f else 0f) }
                LaunchedEffect(Unit) {
                    // A dying creature holds for a 60 ms hit-stop before it fades.
                    if (leaving) { if (card.isCreature) delay(60); arrive.animateTo(0f, tween(160)) } else arrive.animateTo(1f, tween(180, easing = androidx.compose.animation.core.FastOutSlowInEasing))
                }
                // A blocker leans 8 degrees toward its attacker over 120 ms.
                val anchors = LocalAnchors.current
                val lean = remember { Animatable(0f) }
                LaunchedEffect(leaving, card.blocking, card.blockingIds) {
                    withFrameNanos { } // positions from this frame's layout
                    val at = card.blockingIds.firstOrNull()
                    val me = anchors?.map?.get("c${card.id}"); val them = at?.let { anchors?.map?.get("c$it") }
                    val target = if (!leaving && card.blocking && me != null && them != null) 8f * sign(them.x - me.x) * (if (them.y < me.y) 1f else -1f) else 0f
                    lean.animateTo(target, tween(120))
                }
                CardFace(card, w, w * 1.4f, mark = if (leaving) Mark.NONE else markOf(card), count = pile.size,
                    onTap = if (leaving) null else tapOf(card), onHold = if (leaving) null else ({ onInspect(card) }),
                    nudge = if (card.attacking) nudge else 0.dp,
                    modifier = Modifier.graphicsLayer {
                        alpha = arrive.value
                        translationY = (1f - arrive.value) * (if (leaving) 6.dp.toPx() else 10.dp.toPx())
                        rotationZ = lean.value
                    })
            }
        }
    }
}

@Composable
private fun Seat(life: Int, anchor: String, library: Int, top: Card?, grave: Int, onInspect: (Card) -> Unit, pickable: Boolean, picked: Boolean, onPick: () -> Unit) {
    Column(Modifier.padding(end = 6.dp, bottom = 4.dp).width(64.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val profile by dev.cardstashy.nativeplay.account.Account.profile.collectAsState()
        LifeOrb(life, pickable, picked, anchor, picture = profile?.avatarUrl, fallback = "play/avatar-default.webp", onPick = onPick)
        Piles(library, top, grave, Modifier, onInspect)
    }
}

/** Library and graveyard as small piles (a back with its count; the top card of the graveyard), not words. */
@Composable
private fun Piles(library: Int, topNow: Card?, graveNow: Int, modifier: Modifier, onInspect: (Card) -> Unit) {
    // The graveyard takes its new card on the last frame of the leave fade; each count ticks.
    var top by remember { mutableStateOf(topNow) }; var grave by remember { mutableStateOf(graveNow) }
    val graveTick = remember { Animatable(1f) }; val libTick = remember { Animatable(1f) }
    LaunchedEffect(graveNow, topNow?.id) { if (graveNow > grave) delay(220); val up = graveNow != grave; top = topNow; grave = graveNow; if (up) { graveTick.snapTo(1.3f); graveTick.animateTo(1f, tween(220)) } }
    var lastLib by remember { mutableStateOf(library) }
    LaunchedEffect(library) { if (library != lastLib) { lastLib = library; libTick.snapTo(1.3f); libTick.animateTo(1f, tween(220)) } }
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(18.dp, 25.dp), contentAlignment = Alignment.Center) {
            CardBack(Modifier.fillMaxSize().clip(RoundedCornerShape(3.dp)))
            Text("$library", style = Type.Label.copy(fontSize = 10.sp, color = Color.White), modifier = Modifier.graphicsLayer { scaleX = libTick.value; scaleY = libTick.value }.background(Color(0xAA000000), RoundedCornerShape(3.dp)).padding(horizontal = 2.dp))
        }
        top?.let { t -> Box(Modifier.size(18.dp, 25.dp).alpha(.85f).graphicsLayer { scaleX = graveTick.value; scaleY = graveTick.value }, contentAlignment = Alignment.Center) {
            CardImage(t.name, Modifier.fillMaxSize().clickable { onInspect(t) }, contentScale = ContentScale.Crop, shape = RoundedCornerShape(3.dp)) { CardBack(Modifier.fillMaxSize()) }
            if (grave > 1) Text("$grave", style = Type.Label.copy(fontSize = 10.sp, color = Color.White), modifier = Modifier.background(Color(0xAA000000), RoundedCornerShape(3.dp)).padding(horizontal = 2.dp))
        } }
    }
}

@Composable
private fun LifeOrb(life: Int, pickable: Boolean, picked: Boolean, anchor: String? = null, picture: String? = null, fallback: String? = null, onPick: () -> Unit) {
    val flash = remember { Animatable(0f) }
    val drop = remember { Animatable(1f) } // the new number drops in from above, 240 ms
    var last by remember { mutableStateOf(life) }
    LaunchedEffect(life) {
        if (life != last) { if (life < last) launch { flash.snapTo(1f); flash.animateTo(0f, tween(900)) }; drop.snapTo(0f); last = life; drop.animateTo(1f, tween(240, easing = FastOutSlowInEasing)) }
    }
    val anchors = LocalAnchors.current
    Box(Modifier.size(52.dp).then(if (anchor != null && anchors != null) Modifier.onGloballyPositioned { anchors.put(anchor, it.boundsInRoot().center) } else Modifier).clip(CircleShape)
        .background(Brush.radialGradient(listOf(Color(0xFF2A2A31).copy(alpha = 1f), Color(0xFF111114))))
        .background(Palette.Red.copy(alpha = .55f * flash.value))
        .border(if (pickable || picked) 2.5.dp else 1.5.dp, if (pickable || picked) Palette.GoldBright else Palette.Gold, CircleShape)
        .clickable(enabled = pickable, onClick = onPick), contentAlignment = Alignment.Center) {
        // The player's picture under the number (your profile picture; the CPU's art), dimmed so the life total reads first.
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = .5f }) {
            if (fallback != null) AssetImage(fallback, Modifier.fillMaxSize(), maxWidth = 160)
            if (!picture.isNullOrBlank()) coil3.compose.AsyncImage(model = picture, contentDescription = null, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader,
                modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
        }
        Text("$life", style = Type.Title.copy(fontSize = 22.sp), modifier = Modifier.graphicsLayer { translationY = (drop.value - 1f) * 14.dp.toPx(); alpha = .3f + .7f * drop.value })
    }
}

/** The hand: the shared fan. Tap a playable card to lift it (tap again to open it); play it with the gold button or by sliding it up. */
@Composable
private fun Hand(st: MatchState, c: MatchController, live: Boolean, sizes: Sizes, selected: Int?, modifier: Modifier,
                 onSelect: (Int?) -> Unit, onInspect: (Card) -> Unit, onDeal: () -> Unit) {
    val cards = st.me.hand.sortedWith(compareBy({ if (it.isLand) 0 else 1 }, { manaValue(it.manaCost) }))
    Box(modifier, contentAlignment = Alignment.BottomCenter) {
        HandFan(cards, sizes.hand, Modifier.fillMaxWidth(), raised = selected, angleDeg = 3.5f,
            markOf = { card -> if (live && card.id in st.selection.cards) Mark.PICKABLE else if (live && card.id in st.selection.actionable) Mark.PLAYABLE else Mark.NONE },
            canPlay = { card -> live && card.id in st.selection.actionable },
            onTap = { card ->
                val playable = live && card.id in st.selection.actionable
                when {
                    live && card.id in st.selection.cards -> c.card(card.id)
                    playable && selected == card.id -> onInspect(card)
                    playable -> onSelect(card.id)
                    else -> onInspect(card)
                }
            },
            onPlay = { card -> onSelect(null); c.card(card.id) },
            onHold = onInspect, onDeal = onDeal)
    }
}



/** What the site shows on the right of the board: the CPU's action as it happens, or Forge's question (native-panel.mjs dock). */
@Composable
private fun TableSide(st: MatchState, c: MatchController, beat: Beat?, live: Boolean, lastBeat: Beat?, onInspect: (Card) -> Unit) {
    Box(Modifier.fillMaxSize()) {
        // Arena style: no window. A CPU trigger or ability gets the spotlight (the card big at the right and our glass box beside
        // it, table-feel spec 2); other beats keep their one line of glass. A cast, yours or the CPU's, has no side panel any more
        // (0.4.59 T5, which ends faults 6 and 11): the card itself travels to the stack, rests there with its rim and is read there.
        val spot = beat?.let { spotlightFor(st, it) }?.takeIf { it.verb != "casts" }
        when {
            spot != null -> CastSpotlight(spot) { c.next() }
            beat != null -> BeatCaption(beat, Modifier.align(Alignment.TopCenter).padding(top = 58.dp)) { c.next() }
        }
        // native-panel.mjs dock: Forge's own questions (triggers order, costs, damage split, search, choices). Called every frame: the
        // spell-mode back-out acts on the step after a prompt.
        if (beat == null) BoxWithConstraints(Modifier.fillMaxSize()) { DecisionDock(st, live, c.intents, onInspect, chromeU(maxWidth, maxHeight), replies = c.dockReplies) }
        // Gaps list 1 (15 Nov): a one-card scry shows its card (Top and Bottom alone sat 10 s with nothing to read).
        // Explains itself E4: a one-card surveil is the same view (Library and Graveyard alone showed no card).
        if (beat == null && live && st.waitingOnMe) ScryOne.of(st)?.let { name ->
            val kind = ScryOne.kind(st) ?: ScryKind.SCRY
            BoxWithConstraints(Modifier.fillMaxSize()) { ScryOneView(st, name, live, Du(chromeU(maxWidth, maxHeight)),
                onTop = { c.intents.ok(); c.intents.told(ScryOne.result(ScryOne.TOP, kind)) }, onBottom = { c.intents.cancel(); c.intents.told(ScryOne.result(ScryOne.BOTTOM, kind)) }) } }
    }
}

/** The spotlight for a CPU beat about one card: a cast, a trigger or an activation (Pacing's titles). */
internal fun spotlightFor(st: MatchState, b: Beat): Spotlight? {
    val verb = when {
        b.title.startsWith("CPU casts ") -> "casts"
        Regex(" triggers( ×\\d+)?$").containsMatchIn(b.title) -> "triggers"
        b.title.endsWith(" is activated") -> "activates"
        else -> return null
    }
    val card = b.cardId?.let { id -> st.card(id) ?: st.stack.firstOrNull { it.source?.id == id }?.source } ?: return null
    val targets = b.detail?.split(", ")?.mapNotNull { it.removePrefix("Targets ").takeIf { x -> x.isNotBlank() } }.orEmpty()
    return Spotlight(card, "CPU", verb, targets, b.durationMs, yours = false)
}

// ---- Sidebar: CPU seat, the feed, phase dots, the gold action ----

@Composable
private fun Sidebar(st: MatchState, c: MatchController, beat: Beat?, live: Boolean, sizes: Sizes, selectedHand: Int?, modifier: Modifier, onInspect: (Card) -> Unit, lastBeat: Beat? = null) {
    Column(modifier.padding(6.dp).glass(14.dp).padding(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LifeOrb(st.cpu.life, pickable = live && st.cpu.id in st.selection.players, picked = st.cpu.id in st.selection.chosenPlayers, anchor = "orb${st.cpu.id}", fallback = "play/avatar-cpu.webp") { c.player(st.cpu.id) }
            Text("CPU", style = Type.Title.copy(fontSize = 15.sp))
        }
        // Resolve: the item that just left the stack slides down and fades over 140 ms above whatever comes next.
        val topNow = st.stack.firstOrNull()
        var lastTop by remember { mutableStateOf<StackItem?>(null) }
        var resolving by remember { mutableStateOf<StackItem?>(null) }
        val out = remember { Animatable(0f) }
        LaunchedEffect(topNow?.id) {
            val gone = lastTop?.takeIf { g -> st.stack.none { it.id == g.id } }
            lastTop = topNow
            if (gone != null) { resolving = gone; out.snapTo(0f); out.animateTo(1f, tween(140)); resolving = null }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                beat != null -> BeatView(beat, st, Modifier.fillMaxSize()) { c.next() }
                live && st.prompt != null -> PromptPanel(st.prompt, st, c, live, Modifier.fillMaxSize())
                selectedHand != null -> st.card(selectedHand)?.let { FeedCard(it, null, Modifier.fillMaxSize(), onInspect) }
                st.stack.isNotEmpty() -> StackView(st, Modifier.fillMaxSize(), onInspect)
                lastBeat != null && decisionText(st, live).let { it.isEmpty() || it == "CPU's turn" } -> BeatView(lastBeat, st, Modifier.fillMaxSize().alpha(.6f), settled = true) {}
                else -> Text(decisionText(st, live), style = Type.Body.copy(color = Palette.Ink), modifier = Modifier.align(Alignment.Center), textAlign = TextAlign.Center)
            }
            resolving?.source?.let { src -> FeedCard(src, null, Modifier.fillMaxSize().graphicsLayer { alpha = 1f - out.value; translationY = out.value * 24.dp.toPx() }, onInspect) }
        }
        PhaseDots(st)
        Actions(st, c, live && beat == null, selectedHand)
    }
}

/**
 * Better table scene 6: a CPU spell's caption as its pieces, each with whether it is a name drawn in gold: "CPU · Flame Lash · 4 damage
 * to Veteran Survivor", or "CPU · Flame Lash → Veteran Survivor" when Forge gave no effect words. Null for any other beat, or a CPU
 * spell with no target (that keeps "CPU casts Goblin Chariot").
 */
internal fun castCaption(b: Beat): List<Pair<String, Boolean>>? {
    if (!b.title.startsWith("CPU casts ")) return null
    val name = b.cardName ?: return null
    val detail = b.detail?.takeIf { it.isNotBlank() } ?: return null
    val out = mutableListOf("CPU · " to false, name to true, (if (detail.startsWith("→")) " " else " · ") to false)
    // The target names inside the words, in gold (longest first, so a name inside another is not split).
    val marks = b.marks.filter { it.isNotBlank() }.sortedByDescending { it.length }
    var rest = detail
    while (rest.isNotEmpty()) {
        val hit = marks.mapNotNull { m -> rest.indexOf(m).takeIf { it >= 0 }?.let { it to m } }.minByOrNull { it.first }
        if (hit == null) { out += rest to false; break }
        if (hit.first > 0) out += rest.substring(0, hit.first) to false
        out += hit.second to true
        rest = rest.substring(hit.first + hit.second.length)
    }
    if (b.lifeFrom != null && b.lifeTo != null) out += " · ${b.lifeFrom} → ${b.lifeTo}" to false
    return out
}

/** One line of glass over the felt (.forge-narrate): what just happened, a hairline timer under it, red when it costs you life. Tap to move on. */
@Composable
internal fun BeatCaption(b: Beat, modifier: Modifier, onTap: () -> Unit) {
    val timer = remember(b) { Animatable(1f) }
    LaunchedEffect(b) { timer.animateTo(0f, tween(b.durationMs.toInt(), easing = LinearEasing)) }
    val red = b.kind == Beat.Kind.AFFECTS_YOU
    castCaption(b)?.let { parts -> CastLine(parts, red, timer.value, modifier, onTap); return }
    val tone = if (red) Color(0xFFFFB4A8) else Palette.Ink
    val text = listOfNotNull(b.title, b.detail?.takeIf { it.isNotBlank() }, if (b.lifeFrom != null && b.lifeTo != null) "${b.lifeFrom} → ${b.lifeTo}" else null).joinToString(" · ")
    Column(modifier.widthIn(max = 460.dp).clip(RoundedCornerShape(999.dp)).background(Color(0xB30C0C0E)).border(1.dp, if (red) Palette.Red else Color(0x55F2D496), RoundedCornerShape(999.dp))
        .clickable(onClick = onTap).padding(horizontal = 16.dp, vertical = 7.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text, style = Type.Label.copy(fontSize = 13.sp, color = tone), textAlign = TextAlign.Center, maxLines = 2)
        if (b.kind != Beat.Kind.LAND) Box(Modifier.padding(top = 4.dp).fillMaxWidth().height(2.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
            Box(Modifier.fillMaxWidth(timer.value).height(2.dp).background(if (red) Palette.Red else Palette.Gold))
        }
    }
}

/**
 * Better table scene 6, the CPU spell's line: a band of night glass that fades out at both ends between two gold hairlines (the
 * preview's .line), cream words with the spell and its target in gold, and the read timer as a hairline under it (red when it costs
 * you). It eases in, dropping 6 dp, so it lands with the card's pop.
 */
@Composable
private fun CastLine(parts: List<Pair<String, Boolean>>, red: Boolean, timer: Float, modifier: Modifier, onTap: () -> Unit) {
    val text = androidx.compose.ui.text.buildAnnotatedString {
        for ((t, gold) in parts) if (gold) withStyle(androidx.compose.ui.text.SpanStyle(color = Palette.Gold, fontWeight = FontWeight.Bold)) { append(t) } else append(t)
    }
    val enter = remember { Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(Unit) { if (!Motion.still) enter.animateTo(1f, tween(260, easing = FastOutSlowInEasing)) }
    val hair = if (red) Color(0x99E0533F) else Color(0x73E6B450)
    val band = Brush.horizontalGradient(0f to Color.Transparent, .18f to Color(0xEB08090F), .82f to Color(0xEB08090F), 1f to Color.Transparent)
    // It steps left off the CPU's card while that is held large at the right (a phone's pop is most of the height): only its
    // faded ends (its side padding) may lie over the card, never the words.
    val anchors = LocalAnchors.current
    val popping = LocalTravel.current?.travel?.leg == dev.cardstashy.nativeplay.match.Director.Leg.POP
    var at by remember { mutableStateOf(androidx.compose.ui.geometry.Rect.Zero) }
    var rootH by remember { mutableStateOf(0f) }
    Box(modifier.widthIn(max = 620.dp).onGloballyPositioned { at = it.boundsInRoot(); rootH = it.findRootCoordinates().size.height.toFloat() }.graphicsLayer {
            anchors?.version?.intValue
            // Review: the line lies in empty felt, not over the CPU's lands or creature names. From its top-centre place it moves
            // down (or up) to the nearest band where its words cover no tile, square, control or the popped card; where no band
            // is wholly free (a crowded phone) it takes the one covering least, nearest its place.
            val card = if (popping) anchors?.rects?.get("travelcard") else null
            val pad = 40.dp.toPx(); val inset = CAST_WORDS_INSET.dp.toPx()
            var dx = 0f
            if (card != null && !at.isEmpty && card.top < at.bottom && card.bottom > at.top) {
                val words = at.right - pad
                if (words > card.left - 8.dp.toPx()) dx = -minOf(words - card.left + 8.dp.toPx(), (at.left - 8.dp.toPx()).coerceAtLeast(0f))
            }
            var dy = 0f
            if (anchors != null && !at.isEmpty && rootH > 0f) {
                val words = androidx.compose.ui.geometry.Rect(at.left + pad + dx, at.top + inset, at.right - pad + dx, at.bottom - inset)
                val keep = tableObstacles(anchors) + listOfNotNull(card)
                dy = freeBandDy(words, keep, top = 8.dp.toPx(), bottom = rootH * .62f, step = 2.dp.toPx())
                // Moved down past the card's side: step off it again at the new height.
                if (card != null && dx == 0f && card.top < at.bottom + dy && card.bottom > at.top + dy && at.right - pad > card.left - 8.dp.toPx())
                    dx = -minOf(at.right - pad - card.left + 8.dp.toPx(), (at.left - 8.dp.toPx()).coerceAtLeast(0f))
            }
            alpha = enter.value; translationX = dx; translationY = dy - 6.dp.toPx() * (1f - enter.value)
        }
        .anchorRect("castline").semantics { contentDescription = parts.joinToString("") { it.first } }
        .clickable(onClick = onTap).background(band).drawBehind {
            val k = 1.dp.toPx()
            val line = Brush.horizontalGradient(0f to Color.Transparent, .18f to hair, .82f to hair, 1f to Color.Transparent)
            drawRect(line, size = Size(size.width, k)); drawRect(line, topLeft = Offset(0f, size.height - k), size = Size(size.width, k))
            // The read timer: a gold (red) hairline over the bottom one, running down.
            drawRect(if (red) Palette.Red else Palette.Gold, topLeft = Offset(size.width * .18f, size.height - k * 1.5f), size = Size(size.width * .64f * timer, k * 1.5f))
        }.padding(horizontal = 40.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(text, style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Medium, fontSize = 15.sp, letterSpacing = .9.sp, color = Color(0xFFF3E7C6)),
            textAlign = TextAlign.Center, maxLines = 2)
    }
}

/** The cast line's words sit this far (dp) inside its band top and bottom (its 8 dp padding and the letters' own air). */
internal const val CAST_WORDS_INSET = 10f

/**
 * Better table review (scene 6): how far (px) to move a line whose [words] sit where they are so they cover none of [keep]: the
 * nearest free band between [top] and [bottom], searched in [step]s both ways; when none is free, the band covering the least area
 * (nearest first). 0 when they already cover nothing.
 */
internal fun freeBandDy(words: androidx.compose.ui.geometry.Rect, keep: List<androidx.compose.ui.geometry.Rect>, top: Float, bottom: Float, step: Float): Float {
    fun cover(dy: Float): Float { val r = words.translate(0f, dy)
        return keep.sumOf { k -> r.intersect(k).let { if (it.width > 0f && it.height > 0f) (it.width * it.height).toDouble() else 0.0 } }.toFloat() }
    if (cover(0f) == 0f || step <= 0f) return 0f
    var best = 0f; var least = cover(0f)
    var k = 1
    while (true) {
        var any = false
        for (dy in listOf(k * step, -k * step)) {
            if (words.top + dy < top || words.bottom + dy > bottom) continue
            any = true
            val c = cover(dy)
            if (c == 0f) return dy
            if (c < least) { least = c; best = dy }
        }
        if (!any) return best
        k++
    }
}

@Composable
private fun BeatView(b: Beat, st: MatchState, modifier: Modifier, settled: Boolean = false, onTap: () -> Unit) {
    val decks = DemoDecks.load(LocalContext.current)
    val timer = remember(b) { Animatable(1f) }
    LaunchedEffect(b) { if (!settled) timer.animateTo(0f, tween(b.durationMs.toInt(), easing = LinearEasing)) }
    val red = b.kind == Beat.Kind.AFFECTS_YOU
    Column(modifier.clip(RoundedCornerShape(10.dp)).border(if (red) 2.dp else 1.dp, if (red) Palette.Red else Palette.Hairline, RoundedCornerShape(10.dp))
        .background(if (red) Color(0x33E0533F) else Color(0x22000000)).clickable(onClick = onTap).padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(b.title, style = Type.Label.copy(fontSize = 12.sp), textAlign = TextAlign.Center, maxLines = 3)
        if (b.kind != Beat.Kind.LAND && b.cardName != null) {
            FitCard(Modifier.weight(1f).fillMaxWidth()) {
                CardImage(b.cardName, Modifier.fillMaxSize(), contentScale = ContentScale.Fit, shape = RoundedCornerShape(6.dp))
            }
        } else Spacer(Modifier.weight(1f))
        b.detail?.let { Text(it, style = Type.Body.copy(color = if (red) Color(0xFFFFB4A8) else Palette.InkSoft), textAlign = TextAlign.Center) }
        if (b.lifeFrom != null && b.lifeTo != null) Text("${b.lifeFrom} → ${b.lifeTo}", style = Type.Title.copy(fontSize = 18.sp, color = Color(0xFFFFB4A8)))
        if (b.kind != Beat.Kind.LAND && !settled) Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
            Box(Modifier.fillMaxWidth(timer.value).height(3.dp).background(if (red) Palette.Red else Palette.Gold))
        }
    }
}

@Composable
private fun FeedCard(card: Card, caption: String?, modifier: Modifier, onInspect: (Card) -> Unit) {
    val decks = DemoDecks.load(LocalContext.current)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        caption?.let { Text(it, style = Type.Label, textAlign = TextAlign.Center) }
        FitCard(Modifier.weight(1f).fillMaxWidth(), Modifier.pointerInput(card.id) { detectTapGestures(onLongPress = { onInspect(card) }) }) {
            CardImage(card.name, Modifier.fillMaxSize(), contentScale = ContentScale.Fit, shape = RoundedCornerShape(6.dp))
        }
    }
}

@Composable
private fun StackView(st: MatchState, modifier: Modifier, onInspect: (Card) -> Unit) {
    val top = st.stack.first()
    val rise = remember(top.id) { Animatable(0f) }
    LaunchedEffect(top.id) { rise.animateTo(1f, tween(120, easing = FastOutSlowInEasing)) }
    Column(modifier.graphicsLayer { alpha = rise.value; translationY = (1f - rise.value) * 12.dp.toPx() }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val who = if (top.controller == st.viewer) "Your" else "CPU's"
        top.source?.let { FeedCard(it, "$who ${it.name}", Modifier.weight(1f).fillMaxWidth(), onInspect) }
            ?: Text(top.text, style = Type.Body.copy(color = Palette.Ink), modifier = Modifier.weight(1f))
        if (st.stack.size > 1) Text("+${st.stack.size - 1} more on the stack", style = Type.Body.copy(fontSize = 11.sp))
    }
}

private fun shortMessage(st: MatchState): String {
    val first = st.message.lineSequence().map { it.trim() }.firstOrNull { it.isNotEmpty() } ?: return ""
    return first.replace(Regex("\\s*\\(\\d+\\)"), "").replace("Forge AI — ", "")
}

private fun decisionText(st: MatchState, live: Boolean): String = when {
    !live -> if (st.activePlayer == st.viewer) "" else "CPU's turn"
    st.inputType == "InputAttack" -> "Choose attackers"
    st.inputType == "InputBlock" -> "Choose blockers"
    st.inputType == "InputSelectTargets" -> shortMessage(st)
    st.inputType?.startsWith("InputPayMana") == true -> "Pay the cost"
    st.inputType == "InputPassPriority" -> ""
    else -> shortMessage(st)
}

@Composable
private fun PhaseDots(st: MatchState) {
    val steps = listOf("Begin" to setOf("UNTAP", "UPKEEP", "DRAW"), "Main" to setOf("MAIN1"),
        "Combat" to setOf("COMBAT_BEGIN", "COMBAT_DECLARE_ATTACKERS", "COMBAT_DECLARE_BLOCKERS", "COMBAT_FIRST_STRIKE_DAMAGE", "COMBAT_DAMAGE", "COMBAT_END"),
        "Main 2" to setOf("MAIN2"), "End" to setOf("END_OF_TURN", "CLEANUP"))
    val yours = st.activePlayer == st.viewer
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
        steps.forEach { (_, phases) ->
            val on = st.phase in phases
            val d by androidx.compose.animation.core.animateDpAsState(if (on) 10.dp else 7.dp, tween(140), label = "dot")
            Box(Modifier.size(d).clip(CircleShape).background(if (on) (if (yours) Palette.GoldBright else Color(0xFF8FB3E8)) else Color(0x44FFFFFF)))
        }
    }
}

/** The gold action button and the quiet second one, labelled like the web table's native panel. */
@Composable
private fun Actions(st: MatchState, c: MatchController, live: Boolean, selectedHand: Int?) {
    if (st.prompt != null) return
    // Forge leaves its last buttons (Keep / Mulligan) on while the CPU plays; only show them when they're yours to press.
    if (!st.waitingOnMe) return
    val myField = st.me.battlefield
    val selectedCard = selectedHand?.let { st.card(it) }
    val okLabel = when {
        selectedCard != null -> if (selectedCard.isLand) "Play land" else "Cast"
        st.inputType == "InputAttack" -> myField.count { it.attacking }.let { if (it > 0) "Attack with $it" else "No attacks" }
        st.inputType == "InputBlock" -> myField.count { it.blocking }.let { if (it > 0) "Block with $it" else "No blocks" }
        st.inputType == "InputSelectTargets" -> "Confirm"
        st.inputType?.startsWith("InputPayMana") == true -> if (st.buttons.ok.equals("Auto", true)) "Pay" else st.buttons.ok ?: "Pay"
        st.inputType == "InputPassPriority" -> when {
            st.stack.isNotEmpty() -> "Resolve"
            st.activePlayer == st.viewer && st.phase in setOf("MAIN2", "END_OF_TURN") -> "End turn"
            st.activePlayer == st.viewer -> "Next"
            else -> "Pass"
        }
        else -> st.buttons.ok ?: "OK"
    }
    val cancelLabel = when {
        selectedCard != null -> null
        st.inputType == "InputAttack" -> if (st.buttons.cancelEnabled) "All attack" else null
        st.inputType == "InputPassPriority" -> null
        else -> st.buttons.cancel?.takeIf { st.buttons.cancelEnabled }
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        cancelLabel?.let { GoldButton(it, live, primary = false, modifier = Modifier.fillMaxWidth()) { c.cancel() } }
        GoldButton(okLabel, live && (selectedCard != null || st.buttons.okEnabled), modifier = Modifier.fillMaxWidth()) {
            if (selectedCard != null) c.card(selectedCard.id) else c.ok()
        }
    }
}

@Composable
fun GoldButton(text: String, enabled: Boolean, modifier: Modifier = Modifier, primary: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Box(modifier.heightIn(min = 44.dp).clip(shape)
        .background(if (primary) goldButtonBrush(enabled) else Brush.verticalGradient(listOf(Color(0xCC26262C), Color(0xCC16161A))))
        .border(1.dp, if (primary) Color(0x66000000) else Palette.Hairline, shape)
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
        Text(text, style = Type.Label.copy(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (primary && enabled) Color(0xFF1B140A) else if (enabled) Palette.Ink else Palette.InkSoft), textAlign = TextAlign.Center, maxLines = 1)
    }
}

/** Forge's own questions: yes/no, pick from a list, a number, an order or an amount split. */
@Composable
private fun PromptPanel(p: Prompt, st: MatchState, c: MatchController, live: Boolean, modifier: Modifier) {
    val picked = remember(p.id) { mutableStateListOf<Int>() }
    Column(modifier.clip(RoundedCornerShape(10.dp)).border(2.dp, Palette.Red, RoundedCornerShape(10.dp)).background(Color(0x22000000)).padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(p.message.lineSequence().firstOrNull { it.isNotBlank() } ?: "Choose", style = Type.Label, maxLines = 4)
        when {
            p.method == "confirm" || p.method == "showConfirmDialog" -> {
                val labels = p.options.map { it.label }.takeIf { it.size == 2 } ?: listOf("Yes", "No")
                GoldButton(labels[0], live, Modifier.fillMaxWidth()) { c.reply(p.id, value = true) }
                GoldButton(labels[1], live, Modifier.fillMaxWidth(), primary = false) { c.reply(p.id, value = false) }
            }
            p.assignAmount != null -> GoldButton("Assign", live, Modifier.fillMaxWidth()) { c.reply(p.id, amounts = p.autoAssign()) }
            p.ordered -> GoldButton("Keep this order", live, Modifier.fillMaxWidth()) { c.reply(p.id, indexes = p.destinationIndexes.ifEmpty { p.options.indices.toList() }) }
            p.method == "showInputDialog" && p.options.isEmpty() -> GoldButton("OK", live, Modifier.fillMaxWidth()) { c.reply(p.id) }
            else -> {
                Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    p.options.forEach { o ->
                        val on = o.index in picked
                        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (on) Palette.Gold.copy(alpha = .35f) else Color(0x22FFFFFF))
                            .border(1.dp, if (on) Palette.GoldBright else Palette.Hairline, RoundedCornerShape(8.dp))
                            .clickable(enabled = live) {
                                if (p.max <= 1) { c.reply(p.id, indexes = listOf(o.index)) }
                                else if (on) picked.remove(o.index) else if (picked.size < p.max) picked.add(o.index)
                            }.padding(8.dp)) { Text(o.label, style = Type.Body.copy(color = Palette.Ink), maxLines = 2) }
                    }
                }
                if (p.max > 1 || p.min == 0) GoldButton(if (picked.isEmpty() && p.min == 0) (if (p.max == 0 || p.message.startsWith("Looking at cards", true)) "OK" else "None") else "Confirm", live && picked.size >= p.min, Modifier.fillMaxWidth()) {
                    c.reply(p.id, indexes = picked.toList())
                }
            }
        }
    }
}

// ---- Overlays ----

/**
 * Better table scene 7: the turn banner comes up only once the hits to a player still in flight have played out
 * ([TableFeel.hitWait]), so it never covers a hit. Once up it keeps its own time ([Director.BANNER_MS]): the controller
 * clearing its banner does not cut a late one short; a newer banner takes its place. Still frames show the controller's banner as is.
 */
@Composable
internal fun WaitedBanner(banner: dev.cardstashy.nativeplay.match.Banner?) {
    if (Motion.still) { banner?.let { b -> BannerView(b.text, b.yours, Modifier) }; return }
    var up by remember { mutableStateOf<dev.cardstashy.nativeplay.match.Banner?>(null) }
    // The last banner the controller raised; its clearing (null) is not a change here, so it never cancels a late banner.
    var asked by remember { mutableStateOf<dev.cardstashy.nativeplay.match.Banner?>(null) }
    LaunchedEffect(banner) { if (banner != null) asked = banner }
    LaunchedEffect(asked) {
        val b = asked ?: return@LaunchedEffect
        val w = TableFeel.hitWait(); if (w > 0L) delay(w)
        up = b; delay(dev.cardstashy.nativeplay.match.Director.BANNER_MS)
        if (up == b) up = null
    }
    up?.let { b -> key(b) { BannerView(b.text, b.yours, Modifier) } }
}

@Composable
private fun BannerView(text: String, yours: Boolean, modifier: Modifier) {
    // Match punch P4: the banner grows from half size with a bounce (280 ms) over a streak that widens across the board (380), holds
    // to 950 and fades out (240): gold for your turn, ice blue for the CPU's. It stands inside the board, on the centre line, and
    // takes no touch. Reduce motion: it fades in and out at full size, no streak.
    val still = Motion.still || Playmats.reduced(androidx.compose.ui.platform.LocalContext.current)
    val a = remember(text) { Animatable(if (Motion.still) 1f else 0f) }
    val grow = remember(text) { Animatable(if (still) 1f else .5f) }
    val streak = remember(text) { Animatable(0f) }
    LaunchedEffect(text) {
        if (Motion.still) return@LaunchedEffect
        launch { a.animateTo(1f, tween(120)) }
        if (!still) { launch { grow.animateTo(1f, tween(280, easing = androidx.compose.animation.core.Easing { backOut(it) })) }
            launch { streak.animateTo(1f, tween(380, easing = androidx.compose.animation.core.Easing { x -> if (x >= 1f) 1f else 1f - Math.pow(2.0, -10.0 * x).toFloat() })) } }
        delay(950); a.animateTo(0f, tween(240))
    }
    val tone = if (yours) Color(0xFFF3D27E) else Color(0xFF5CC8FF)
    androidx.compose.foundation.layout.BoxWithConstraints(modifier.fillMaxSize()) {
        val w = maxWidth.value; val h = maxHeight.value
        val zones = remember(w, h, DualScreen.active) { ZoneLayout.of(w, h, dual = DualScreen.active, k = ZoneLayout.scale(w, h)) }
        val mid = remember(zones) { ZoneLayout.rows(zones, DualScreen.active).divider }
        val bw = minOf(420f, zones.board.w * .92f)
        // The streak: a line of light along the centre line, widening out from the middle and staying inside the board.
        androidx.compose.foundation.Canvas(Modifier.offset(x = zones.board.x.dp, y = (mid - 30f).dp).size(zones.board.w.dp, 60.dp).alpha(a.value)) {
            val half = size.width / 2 * streak.value
            if (half > 1f) { val y = size.height / 2
                drawLine(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color.Transparent, tone.copy(alpha = .55f), Color.White.copy(alpha = .9f), tone.copy(alpha = .55f), Color.Transparent),
                    startX = size.width / 2 - half, endX = size.width / 2 + half), androidx.compose.ui.geometry.Offset(size.width / 2 - half, y), androidx.compose.ui.geometry.Offset(size.width / 2 + half, y), strokeWidth = 3.dp.toPx())
                drawLine(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color.Transparent, tone.copy(alpha = .16f), Color.Transparent),
                    startX = size.width / 2 - half, endX = size.width / 2 + half), androidx.compose.ui.geometry.Offset(size.width / 2 - half, y), androidx.compose.ui.geometry.Offset(size.width / 2 + half, y), strokeWidth = 26.dp.toPx()) }
        }
        Box(Modifier.offset(x = (zones.board.x + zones.board.w / 2 - bw / 2).dp, y = (mid - bw / 10f).dp).width(bw.dp).aspectRatio(5f)
            .graphicsLayer { alpha = a.value; scaleX = grow.value; scaleY = grow.value }, contentAlignment = Alignment.Center) {
            AssetImage(if (yours) "play/turn-you.webp" else "play/turn-cpu.webp", Modifier.fillMaxSize(), maxWidth = 1120, contentScale = ContentScale.Fit)
            Text(text, style = Type.Title.copy(fontSize = 20.sp), textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun Menu(onConcede: () -> Unit, onLeave: () -> Unit, onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onClose), contentAlignment = Alignment.Center) {
        Column(Modifier.width(240.dp).glass().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            GoldButton("Resume", true, Modifier.fillMaxWidth(), onClick = onClose)
            GoldButton("Concede", true, Modifier.fillMaxWidth(), primary = false, onClick = onConcede)
            GoldButton("Leave to Home", true, Modifier.fillMaxWidth(), primary = false, onClick = onLeave)
        }
    }
}

/**
 * Better table scene 12, an ending with weight. The last hit has burst on the loser's picture ([drawWin] on "orb<loser>",
 * [TableFeel.resultWaitFor] holds this back until it is seen); then the table dims ([TableDimmer]), a full-width band carries the
 * word (Defeat in coral, Victory in gold, Draw in plain ink), the match in three numbers (Turns, You, CPU: Forge's values as they
 * are), and Home and Rematch. The band's hairlines run out from the middle as the word lands with a bounce, a light crosses it
 * once, the numbers and the buttons rise in after it ([ResultMotion]). Reduce motion: everything only fades. Motion.still shows the
 * end frame at once; X and the buttons still wait for the rise to finish ([ResultMotion.IN_MS]), so an X carried in from the table
 * does nothing. Anchors: result.band, result.word, result.stats, result.stat:<label>, result.home, result.rematch, result.reason.
 */
@Composable
internal fun Result(st: MatchState, audio: TableAudio, onHome: () -> Unit, onRematch: () -> Unit, note: String? = null, reason: String? = null, holdMs: () -> Long = { 0L }) {
    val won = !st.draw && st.winnerPlayerId == st.viewer
    val draw = st.draw || st.winnerPlayerId == null
    val ctx = LocalContext.current.applicationContext
    val calm = remember { Playmats.reduced(ctx) }
    // The rise's own clock, in ms (0 .. IN_MS): every part reads its own window of it.
    val t = remember { Animatable(if (Motion.still) ResultMotion.IN_MS.toFloat() else 0f) }
    // Live 0.4.57: one X on Defeat started a Rematch. As in Arena, X and the ring's start leave to Home; Rematch is a
    // deliberate step (touch, or the ring right then A). Both wait for the result to finish rising, so an X carried in from the
    // table does nothing; the board under the result lends nothing either.
    var armed by remember { mutableStateOf(false) }
    val homeFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        delay(300 + holdMs()); audio.play(if (draw) "QP-019" else if (won) "QP-017" else "QP-018")
        if (Motion.still) delay(ResultMotion.IN_MS) else t.animateTo(ResultMotion.IN_MS.toFloat(), tween(ResultMotion.IN_MS.toInt(), easing = LinearEasing))
        armed = true
        // The ring start leaves touch mode first, as the table's does (live 0.4.56): in touch mode a button can't take focus.
        if (Pad.connected.value) { PadPrompts.inputModes?.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard); runCatching { homeFocus.requestFocus() } }
    }
    PadScreen(PadActs(x = if (armed) PadAct("Home") { onHome() } else null, opaque = true))
    val tone = ResultMotion.tone(won, draw)
    val ink = ResultMotion.ink(won, draw)
    val dens = LocalDensity.current.density
    BoxWithConstraints(Modifier.fillMaxSize().drawBehind { drawRect(TableDimmer.copy(alpha = TableDimmer.alpha * ResultMotion.dim(t.value))) }
        // The table under the result takes no touch.
        .pointerInput(Unit) { detectTapGestures { } }) {
        val W = maxWidth; val H = maxHeight
        val d = Du(chromeU(W, H))
        with(d) {
            val wordSp = ResultMotion.wordSp(W.value, H.value)
            val word = if (draw) "Draw" else if (won) "Victory" else "Defeat"
            androidx.compose.ui.layout.Layout(content = {
                // The band: the preview's .banner, a tone wash across the width with a hairline above and below.
                Box(Modifier.layoutId("band").fillMaxWidth().anchorRect("result.band")
                    .drawBehind {
                        val w = size.width; val h = size.height
                        val s = if (calm) 1f else ResultMotion.streak(t.value)
                        val a = if (calm) ResultMotion.dim(t.value) else 1f
                        if (s <= 0f || a <= 0f) return@drawBehind
                        val half = w / 2 * s; val l = w / 2 - half; val r = w / 2 + half
                        drawRect(Brush.horizontalGradient(0f to Color.Transparent, .3f to tone.copy(alpha = .28f * a), .7f to tone.copy(alpha = .28f * a), 1f to Color.Transparent, startX = l, endX = r),
                            topLeft = Offset(l, 0f), size = androidx.compose.ui.geometry.Size(r - l, h))
                        // A deeper core behind the word, so it reads on any mat.
                        drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color(0x5506070D), Color.Transparent)), topLeft = Offset(l, 0f), size = androidx.compose.ui.geometry.Size(r - l, h), alpha = a)
                        val hair = 1.dp.toPx()
                        val line = Brush.horizontalGradient(0f to Color.Transparent, .22f to tone.copy(alpha = .6f * a), .5f to ResultMotion.hot(tone).copy(alpha = .95f * a), .78f to tone.copy(alpha = .6f * a), 1f to Color.Transparent, startX = l, endX = r)
                        drawLine(line, Offset(l, hair / 2), Offset(r, hair / 2), hair)
                        drawLine(line, Offset(l, h - hair / 2), Offset(r, h - hair / 2), hair)
                        // The light that runs once along the band after the word lands.
                        if (!calm) { val q = ResultMotion.sweep(t.value)
                            if (q > 0f && q < 1f) { val bw = w * .22f; val x = -bw + q * (w + bw)
                                val k = sin(q * PI.toFloat())
                                drawRect(Brush.horizontalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .16f * k), Color.Transparent), startX = x, endX = x + bw), topLeft = Offset(x, 0f), size = androidx.compose.ui.geometry.Size(bw, h))
                                drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .9f * k), Color.Transparent), startX = x, endX = x + bw), Offset(x, hair / 2), Offset(x + bw, hair / 2), hair * 1.5f)
                                drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color.White.copy(alpha = .9f * k), Color.Transparent), startX = x, endX = x + bw), Offset(x, h - hair / 2), Offset(x + bw, h - hair / 2), hair * 1.5f) } }
                    }.padding(vertical = (W.value * .016f).coerceIn(10f, 18f).dp), contentAlignment = Alignment.Center) {
                    Row(Modifier.graphicsLayer {
                            val q = ResultMotion.word(t.value)
                            alpha = (q * 3f).coerceIn(0f, 1f) * (if (calm) ResultMotion.dim(t.value) else 1f)
                            if (!calm) { val k = .5f + .5f * backOut(q); scaleX = k; scaleY = k }
                        }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy((wordSp * .3f).dp)) {
                        MullFlourish(false, Modifier.size((wordSp * 1.1f).dp, (wordSp * .22f).dp), tone)
                        Text(word, Modifier.anchorRect("result.word"),
                            style = androidx.compose.ui.text.TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = wordSp.sp, letterSpacing = .24.em, color = ink,
                                shadow = androidx.compose.ui.graphics.Shadow(tone.copy(alpha = .9f), Offset.Zero, 24f * dens),
                                platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false)), maxLines = 1, softWrap = false)
                        MullFlourish(true, Modifier.size((wordSp * 1.1f).dp, (wordSp * .22f).dp), tone)
                    }
                }
                // The match in three numbers.
                Row(Modifier.layoutId("stats").anchorRect("result.stats"), horizontalArrangement = Arrangement.spacedBy(14.du)) {
                    ResultMotion.stats(st).forEachIndexed { i, (label, n) ->
                        ResultStat(label, n, low = i > 0 && lifeLow(n), d = d, modifier = Modifier.graphicsLayer {
                            val q = ResultMotion.stat(t.value, i); alpha = q
                            if (!calm) { translationY = (1f - q) * 14.du.toPx(); val k = .94f + .06f * q; scaleX = k; scaleY = k } })
                    }
                }
                // Why it ended (V14): one quiet line, left out where the screen is too short for it.
                if (reason != null) Text(reason, Modifier.layoutId("reason").anchorRect("result.reason").graphicsLayer { alpha = ResultMotion.stat(t.value, 2) },
                    style = sans(sp(12.5f), FontWeight.Medium, Color(0xFFCFC6B2)).copy(shadow = androidx.compose.ui.graphics.Shadow(Color(0xE606070D), Offset.Zero, 8f * dens)), textAlign = TextAlign.Center, maxLines = 1)
                Row(Modifier.layoutId("buttons").graphicsLayer {
                        val q = ResultMotion.buttons(t.value); alpha = q
                        if (!calm) translationY = (1f - q) * 18.du.toPx() },
                    horizontalArrangement = Arrangement.spacedBy(16.du), verticalAlignment = Alignment.CenterVertically) {
                    val minW = maxOf(W * .17f, 132.du)
                    MullGlass("Home", null, Modifier.height(48.du).widthIn(min = minW).anchorRect("result.home").focusRequester(homeFocus), d, onClick = onHome)
                    GoldPill("Rematch", true, Modifier.widthIn(min = minW).anchorRect("result.rematch"), d, height = 48.du, onClick = onRematch)
                }
                if (note != null) Text(note, Modifier.layoutId("note").graphicsLayer { alpha = ResultMotion.buttons(t.value) },
                    style = sans(sp(13f), FontWeight.SemiBold, MULL_GOLD), textAlign = TextAlign.Center, maxLines = 2)
            }, modifier = Modifier.fillMaxSize()) { ms, c ->
                val free = c.copy(minWidth = 0, minHeight = 0)
                val band = ms.first { it.layoutId == "band" }.measure(free.copy(minWidth = c.maxWidth))
                val parts = listOf("stats", "reason", "buttons", "note").mapNotNull { id -> ms.firstOrNull { it.layoutId == id }?.let { id to it.measure(free) } }.toMap()
                val gap = 14.du.roundToPx(); val margin = 10.du.roundToPx()
                val tops = ResultMotion.tops(c.maxHeight, band.height, parts["stats"]!!.height, parts["reason"]?.height, parts["buttons"]!!.height, parts["note"]?.height, gap, margin)
                layout(c.maxWidth, c.maxHeight) {
                    band.place(0, tops.band)
                    fun mid(p: androidx.compose.ui.layout.Placeable, y: Int) = p.place((c.maxWidth - p.width) / 2, y)
                    mid(parts["stats"]!!, tops.stats)
                    if (tops.reason != null) parts["reason"]?.let { mid(it, tops.reason) }
                    mid(parts["buttons"]!!, tops.buttons)
                    if (tops.note != null) parts["note"]?.let { mid(it, tops.note) }
                }
            }
        }
    }
}

/** One of the result's numbers: a dark glass tile, a gold hairline along its top, the value big and heavy, its name small under it. */
@Composable
private fun ResultStat(label: String, n: Int, low: Boolean, d: Du, modifier: Modifier) = with(d) {
    val shape = RoundedCornerShape(10.du)
    val glow = if (low) CpuRed else MULL_GOLD
    Column(modifier.anchorRect("result.stat:$label").widthIn(min = 88.du)
        .drawBehind { drawRoundRect(Color(0x66000000), topLeft = Offset(0f, 5.du.toPx()), size = size, cornerRadius = CornerRadius(10.du.toPx())) }
        .clip(shape).background(Brush.verticalGradient(listOf(Color(0xF5151926), Color(0xF20C0E16))))
        .drawWithContent { drawContent()
            drawLine(Brush.horizontalGradient(listOf(Color.Transparent, MULL_GOLD.copy(alpha = .7f), Color.Transparent)), Offset(size.width * .12f, .5.dp.toPx()), Offset(size.width * .88f, .5.dp.toPx()), 1.dp.toPx()) }
        .border(1.dp, Color(0xFF3A4260), shape).padding(horizontal = 18.du, vertical = 8.du),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Text("$n", style = sans(sp(26f), FontWeight.Black, if (low) Color(0xFFFF8F84) else Color(0xFFFFF4D8)).copy(fontFeatureSettings = "tnum", letterSpacing = (-.01).em,
            shadow = androidx.compose.ui.graphics.Shadow(glow.copy(alpha = .5f), Offset.Zero, 12f * LocalDensity.current.density)), maxLines = 1, softWrap = false)
        Text(label.uppercase(), style = sans(sp(11f), FontWeight.SemiBold, Color(0xFF9C978C)).copy(letterSpacing = .12.em), maxLines = 1, softWrap = false)
    }
}

/**
 * Scene 12's numbers and timing, kept pure for the tests. The rise takes [IN_MS] from the moment the result starts: the dimmer
 * (0..400 ms), the hairlines running out (0..380, an expo ease), the word growing in from half size with a bounce (60..340), the
 * light crossing the band (300..620), the three numbers one after another (200, 260, 320; 260 ms each) and the buttons (340..620).
 */
internal object ResultMotion {
    const val IN_MS = 620L
    private fun win(t: Float, from: Float, len: Float) = ((t - from) / len).coerceIn(0f, 1f)
    private fun cubicOut(x: Float) = 1f - (1f - x) * (1f - x) * (1f - x)
    fun dim(t: Float) = cubicOut(win(t, 0f, 400f))
    fun streak(t: Float) = win(t, 0f, 380f).let { x -> if (x >= 1f) 1f else 1f - Math.pow(2.0, -10.0 * x).toFloat() }
    fun word(t: Float) = win(t, 60f, 280f)
    fun sweep(t: Float) = win(t, 300f, 320f)
    fun stat(t: Float, i: Int) = cubicOut(win(t, 200f + 60f * i, 260f))
    fun buttons(t: Float) = cubicOut(win(t, 340f, 280f))

    /** The tone: coral for a defeat, gold for a victory, plain ink for a draw. */
    fun tone(won: Boolean, draw: Boolean) = when { draw -> Color(0xFFB9B2A4); won -> Color(0xFFE8B95B); else -> Color(0xFFF0564E) }
    /** The word's colour: a warm pale of its tone. */
    fun ink(won: Boolean, draw: Boolean) = when { draw -> Color(0xFFEEE6D4); won -> Color(0xFFFFF4D8); else -> Color(0xFFFFD9D2) }
    /** The hairline's bright middle. */
    fun hot(tone: Color) = androidx.compose.ui.graphics.lerp(tone, Color.White, .45f)
    /** The word's size (sp): 6 % of the width as in the preview, held by the height on a phone, never over 64. */
    fun wordSp(w: Float, h: Float) = minOf(64f, w * .06f, h * .12f)
    /** The three numbers, Forge's values as they are (a life below 0 shows below 0). */
    fun stats(st: MatchState) = listOf("Turns" to st.turn, "You" to st.me.life, "CPU" to st.cpu.life)

    class Tops(val band: Int, val stats: Int, val reason: Int?, val buttons: Int, val note: Int?)
    /**
     * Where each part stands: as the preview (the band's top at 30 % of the height, the numbers at 52 %, the buttons at 70 %),
     * pushed down to keep [gap] between them, then lifted together if the last would leave the screen. A short screen lets the reason
     * line go first, then the note, so the word, the numbers and the buttons always fit.
     */
    fun tops(h: Int, band: Int, stats: Int, reason: Int?, buttons: Int, note: Int?, gap: Int, margin: Int): Tops {
        fun lay(r: Int?, n: Int?): Tops {
            val b = (h * .30f).toInt()
            val s = maxOf((h * .52f).toInt(), b + band + gap)
            val rs = r?.let { s + stats + gap / 2 }
            val bu = maxOf((h * .70f).toInt(), (rs?.plus(r) ?: (s + stats)) + gap)
            val ns = n?.let { bu + buttons + gap * 2 / 3 }
            val end = (ns?.plus(n) ?: (bu + buttons))
            val lift = (end - (h - margin)).coerceAtLeast(0).coerceAtMost(maxOf(0, b - margin))
            return Tops(b - lift, s - lift, rs?.minus(lift), bu - lift, ns?.minus(lift))
        }
        fun fits(x: Tops, n: Int?) = (x.note?.plus(n ?: 0) ?: (x.buttons + buttons)) <= h - margin
        lay(reason, note).let { if (fits(it, note)) return it }
        lay(null, note).let { if (fits(it, note)) return it }
        return lay(null, null)
    }
}

/**
 * Why the match ended (V14), read off the final board: your concession, else on the losing side life at 0, ten poison counters,
 * 21 damage from one commander, or an empty library. Null for a draw or when the board shows none of these.
 */
internal fun endReason(st: MatchState, conceded: Boolean): String? {
    if (st.draw || st.winnerPlayerId == null) return null
    val lost = st.winnerPlayerId != st.viewer
    if (lost && conceded) return "Conceded"
    val p = if (lost) st.me else st.cpu
    val cmd = p.commanderDamage.firstOrNull { it.damage >= 21 }
    // Better table review: the cause by name, with Forge's own value where it has one; never a number of our own (the stat tile
    // above shows the life as Forge has it, -7 included, so "life reached 0" read wrong under it).
    return when {
        p.life <= 0 -> "Out of life"
        (p.counters["POISON"] ?: 0) >= 10 -> "Poison ${p.counters["POISON"]}"
        cmd != null -> "Commander damage ${cmd.damage} · ${cmd.commander}"
        p.libraryCount == 0 -> "Empty library"
        else -> null
    }
}

@Composable
private fun Failed(reason: String, onHome: () -> Unit) {
    PadScreen(PadActs(x = PadAct("Home") { onHome() }, opaque = true))
    Box(Modifier.fillMaxSize().background(Color(0xCC000000)), contentAlignment = Alignment.Center) {
        Column(Modifier.width(420.dp).glass().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("The match stopped", style = Type.Title)
            Text(reason.take(600), style = Type.Body.copy(color = Palette.Ink))
            GoldButton("Home", true, Modifier.fillMaxWidth(), onClick = onHome)
        }
    }
}

/** A whole card (63:88) as large as fits the space both ways, centred: never wider than the sidebar, never cropped. */
@Composable
private fun FitCard(modifier: Modifier, inner: Modifier = Modifier, content: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val w = minOf(maxWidth, maxHeight * .716f)
        Box(inner.size(w, w / .716f), content = content)
    }
}


/**
 * The opening hand in the order the table will hold it (lands first, then mana value). Randall's 19 Nov recording (item 8): the
 * Keep screen showed Forge's order (Archive, Get Lost, Day of Judgment…) and the table another (Archive, Floodfarm Verge, Get Lost…).
 */
internal fun keepHand(hand: List<dev.cardstashy.nativeplay.engine.Card>) = orderedHand(hand, emptyList())
