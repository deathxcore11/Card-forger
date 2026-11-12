package dev.cardstashy.nativeplay.ui

import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.StackItem
import kotlin.math.sign
import kotlinx.coroutines.launch
import androidx.compose.ui.layout.boundsInRoot
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
    // The turn clock (cue map): a quiet TT-006 as a fresh prompt window opens, TT-007 each second of the last 10, TT-008 at zero. Yours only.
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
                stage == Stage.TOSS -> { val t = controller.toss.collectAsState().value; if (t != null) TossScreen(t, cpuPlate, onDone = { controller.tossFinished() }) else Loading() }
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
                    CompositionLocalProvider(LocalMatchClock provides controller.clock.collectAsState().value, LocalTrigger provides trig, LocalTravel provides travel) {
                    ForgeBoard(st, live && beat == null && trig == null && travel == null, controller.intents, selectedHand, { selectedHand = it }, { inspect = it }, { menu = true },
                        handOrder, { handOrder = it }, menu = matchMenu, afk = if (DualScreen.active) afk else null, onAbility = onAbility,
                        abilityOpen = inspect?.id?.takeIf { abilityNow != null }) {
                        TableSide(st, controller, beat, live, lastBeat) { inspect = it }
                    }
                    }
                }
            }
            banner?.let { b -> BannerView(b.text, b.yours, Modifier) }
        }
        ((if (DualScreen.active) null else afk) ?: note)?.let { Text(it, style = Type.Label.copy(color = Color(0xFFFFB4A8), fontSize = 14.sp), modifier = Modifier.align(Alignment.TopCenter).padding(top = 96.dp)
            .clip(RoundedCornerShape(999.dp)).background(Color(0xD90C0C0E)).border(1.dp, Palette.Red, RoundedCornerShape(999.dp)).padding(horizontal = 16.dp, vertical = 8.dp)) }
      }
        // Two screens: a card you look at opens on the bottom screen, so the table stays in full view on top (B closes it).
        // Start still opens the match menu from an open inspect (U8: on two screens the ring can't come down to it).
        val inspectStart = PadAct("Menu") { inspect = null; matchMenu.open = true }
        // 0.4.60 G3: the one inspect view lists what is attached to the card; a tap on one of those opens it in the same view.
        inspect?.let { c -> val att = attachedOf(shown, shown?.card(c.id)?.takeIf { it.zone == c.zone } ?: c); val openAtt: (Card) -> Unit = { inspect = it }
            if (DualScreen.active) BottomScreen { CardInspect(c, shown?.viewer, inspectStart, beside = true, attached = att, onAttached = openAtt, ability = abilityNow, onActivate = activate) { inspect = null } }
            else CardInspect(c, shown?.viewer, inspectStart, attached = att, onAttached = openAtt, ability = abilityNow, onActivate = activate) { inspect = null } }
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
 * The opening hand (table-feel spec 1, Randall 4 Nov 18:18Z): no side panel. The hand fans across the felt, the seats keep
 * their corners, a small glass pill says who goes first, three pips and a caption count the mulligans, and the table's own
 * pair sits bottom right: Mulligan (dark glass) and Keep (the gold main button) with the decision's clock running round it.
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
    // Cue map: the coin lands as the pill comes in (QP-010 you / QP-011 CPU), Keep QP-013, Mulligan QP-014, a card to the bottom QP-015.
    val cue = LocalTableCue.current
    LaunchedEffect(youFirst) { cue?.invoke(if (youFirst) "QP-010" else "QP-011", .8f, 1f) }
    // A controller's X is the gold Keep (its words and its tap) while it is yours to press.
    PadScreen(PadActs(x = if (yours && st.buttons.okEnabled) PadAct(st.buttons.ok ?: "Keep") { if (!choosing) cue?.invoke("QP-013", 1f, 1f); onOk() } else null))
    BoxWithConstraints(Modifier.fillMaxSize().background(Color(0x59000000))) {
        val W = maxWidth; val H = maxHeight
        val d = Du(chromeU(W, H))
        with(d) {
            Medallion(st.cpu, mine = false, pickable = false, picked = false, modifier = Modifier.offset(x = W - 132.du, y = 26.du), d = d) {}
            Medallion(st.me, mine = true, pickable = false, picked = false, modifier = Modifier.offset(x = 80.du, y = H - 78.du), d = d) {}
            // Who goes first: one glass pill with a coin, centred above the hand.
            Row(Modifier.align(Alignment.TopCenter).padding(top = 20.du).clip(RoundedCornerShape(999.dp)).background(Color(0xD90C0D12)).border(1.dp, Color(0x33F2D496), RoundedCornerShape(999.dp))
                .padding(horizontal = 16.du, vertical = 8.du), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.du)) {
                androidx.compose.foundation.Canvas(Modifier.size(18.du)) {
                    drawCircle(Brush.verticalGradient(listOf(Color(0xFFF7DA97), Color(0xFFC4903A))))
                    drawCircle(Color(0xFF8A6424), radius = size.minDimension * .34f, style = androidx.compose.ui.graphics.drawscope.Stroke(1.2f * density))
                }
                Text(if (youFirst) "You go first" else "CPU goes first", style = sans(sp(15f), FontWeight.SemiBold, Color(0xFFF3E9D2)))
            }
            // The hand, full width on the felt; nothing is drawn over it.
            val cardW = minOf((W - 64.dp) / 6.2f, H * .5f / 1.4f)
            Box(Modifier.fillMaxSize().padding(horizontal = 24.dp), contentAlignment = Alignment.Center) {
                HandFan(st.me.hand, cardW, Modifier.fillMaxWidth().offset(y = (-8).du), angleDeg = 2.5f, dealIn = true,
                    markOf = { card -> if (card.id in st.selection.chosenCards) Mark.PICKED else if (pickable(card)) Mark.PICKABLE else Mark.NONE },
                    onTap = { card -> if (pickable(card)) { if (choosing) cue?.invoke("QP-015", .8f, 1f); onCard(card.id) } else onHold(card) },
                    onHold = onHold, onDeal = onDeal, pop = 1.2f, onCarry = { id -> if (id != null) ringed = id })
            }
            // Three pips (7, 6, 5) and the caption; while putting cards on the bottom, Forge's own line instead.
            Column(Modifier.align(Alignment.BottomCenter).padding(bottom = 22.du), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.du)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.du)) {
                    repeat(3) { i -> Box(Modifier.size(9.du).clip(CircleShape).background(if (i == mulls.coerceAtMost(2)) Color(0xFFE8B95B) else Color(0x40FFFFFF))) }
                }
                if (!DualScreen.active) Text(lines.caption, Modifier.anchorRect("mull.caption"),
                    style = sans(sp(14f), FontWeight.Medium, Color(0xFFE6DCC6)), textAlign = TextAlign.Center)
            }
            // Two screens: Keep and Mulligan live on the bottom screen with the card under the ring (MulliganBottom); the top is the hand.
            if (DualScreen.active) BottomScreen { MulliganBottom(st, lines, st.me.hand.firstOrNull { it.id == ringed } ?: st.me.hand.firstOrNull(), deck, yours, choosing, youFirst,
                onKeep = { if (!choosing) cue?.invoke("QP-013", 1f, 1f); onOk() }, onMull = { if (!choosing) cue?.invoke("QP-014", 1f, 1f); onCancel() }) }
            else if (yours) Column(Modifier.align(Alignment.BottomEnd).padding(end = 28.du, bottom = 12.du), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(5.du)) {
              Row(horizontalArrangement = Arrangement.spacedBy(14.du), verticalAlignment = Alignment.CenterVertically) {
                // The turn clock's ring is on Keep (GoldPill); its last-10 count stands first in the row, never on Mulligan beside it.
                TurnCount(d.u)
                CompositionLocalProvider(LocalTurnCountOutside provides true) {
                if (!choosing) st.buttons.cancel?.takeIf { st.buttons.cancelEnabled }?.let { label ->
                    Box(Modifier.height(48.du).widthIn(min = 128.du).clip(RoundedCornerShape(999.dp)).background(Color(0xE60C0D12)).border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(999.dp))
                        .clickable { cue?.invoke("QP-014", 1f, 1f); onCancel() }.padding(horizontal = 22.du).anchorRect("mull"), contentAlignment = Alignment.Center) {
                        Text(label, style = sans(sp(16f), FontWeight.Bold, Color(0xFFF3E9D2)), maxLines = 1)
                    }
                }
                GoldPill(st.buttons.ok ?: "Keep", st.buttons.okEnabled, Modifier.height(48.du).anchorRect("gold"), d, press = null) { if (!choosing) cue?.invoke("QP-013", 1f, 1f); onOk() }
                }
              }
              // T9: one line under Mulligan says what it does, with Forge's numbers (one line, under the pair, clear of the caption).
              if (!choosing && st.buttons.cancelEnabled) lines.mullLine?.let { Text(it, Modifier.anchorRect("mull.line"), style = sans(sp(12f), FontWeight.Medium, Color(0xFFCFC6B2)), maxLines = 1) }
            }
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

/** One line of glass over the felt (.forge-narrate): what just happened, a hairline timer under it, red when it costs you life. Tap to move on. */
@Composable
private fun BeatCaption(b: Beat, modifier: Modifier, onTap: () -> Unit) {
    val timer = remember(b) { Animatable(1f) }
    LaunchedEffect(b) { timer.animateTo(0f, tween(b.durationMs.toInt(), easing = LinearEasing)) }
    val red = b.kind == Beat.Kind.AFFECTS_YOU
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

@Composable
internal fun Result(st: MatchState, audio: TableAudio, onHome: () -> Unit, onRematch: () -> Unit, note: String? = null, reason: String? = null, holdMs: () -> Long = { 0L }) {
    val won = !st.draw && st.winnerPlayerId == st.viewer
    val draw = st.draw || st.winnerPlayerId == null
    val rise = remember { Animatable(0f) }
    // Live 0.4.57: one X on Defeat started a Rematch. As in Arena, X and the ring's start leave to Home; Rematch is a
    // deliberate step (touch, or the ring right then A). Both wait for the card to finish rising, so an X carried in from the
    // table does nothing; the board under the result lends nothing either.
    var armed by remember { mutableStateOf(false) }
    val homeFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        delay(300 + holdMs()); audio.play(if (draw) "QP-019" else if (won) "QP-017" else "QP-018"); rise.animateTo(1f, tween(400, easing = FastOutSlowInEasing))
        armed = true
        // The ring start leaves touch mode first, as the table's does (live 0.4.56): in touch mode a button can't take focus.
        if (Pad.connected.value) { PadPrompts.inputModes?.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard); runCatching { homeFocus.requestFocus() } }
    }
    PadScreen(PadActs(x = if (armed) PadAct("Home") { onHome() } else null, opaque = true))
    Box(Modifier.fillMaxSize().background(Color(0xAA000000).copy(alpha = .67f * rise.value)), contentAlignment = Alignment.Center) {
        Column(Modifier.graphicsLayer { alpha = rise.value; translationY = (1f - rise.value) * 40.dp.toPx() }.width(380.dp).glass(16.dp).padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.fillMaxWidth().aspectRatio(5f), contentAlignment = Alignment.Center) {
                AssetImage(if (draw) "play/result-draw.webp" else if (won) "play/result-win.webp" else "play/result-loss.webp", Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                Text(if (draw) "Draw" else if (won) "Victory" else "Defeat", style = Type.Title.copy(fontSize = 26.sp))
            }
            // Why it ended (V14), then the final board's numbers.
            if (reason != null) Text(reason, style = Type.Body.copy(color = Palette.Ink), textAlign = TextAlign.Center)
            Text("Turn ${st.turn} · You ${st.me.life} · CPU ${st.cpu.life}", style = Type.Body.copy(color = Palette.InkSoft))
            if (note != null) Text(note, style = Type.Body.copy(color = Palette.Gold, fontSize = 13.sp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GoldButton("Home", true, Modifier.width(150.dp).focusRequester(homeFocus), primary = false, onClick = onHome)
                GoldButton("Rematch", true, Modifier.width(150.dp), onClick = onRematch)
            }
        }
    }
}

/**
 * Why the match ended (V14), read off the final board: your concession, else on the losing side life at 0, ten poison counters,
 * 21 damage from one commander, or an empty library. Null for a draw or when the board shows none of these.
 */
internal fun endReason(st: MatchState, conceded: Boolean): String? {
    if (st.draw || st.winnerPlayerId == null) return null
    val lost = st.winnerPlayerId != st.viewer
    if (lost && conceded) return "You conceded."
    val p = if (lost) st.me else st.cpu
    val cmd = p.commanderDamage.firstOrNull { it.damage >= 21 }
    return when {
        p.life <= 0 -> if (lost) "Your life reached 0." else "The CPU's life reached 0."
        (p.counters["POISON"] ?: 0) >= 10 -> if (lost) "You got ten poison counters." else "The CPU got ten poison counters."
        cmd != null -> "${cmd.damage} damage from ${cmd.commander}."
        p.libraryCount == 0 -> if (lost) "You had to draw from an empty library." else "The CPU had to draw from an empty library."
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

