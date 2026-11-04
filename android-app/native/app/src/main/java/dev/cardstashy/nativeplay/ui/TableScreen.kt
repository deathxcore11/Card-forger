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
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
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
fun TableScreen(controller: MatchController, onHome: () -> Unit, onRematch: () -> Unit) {
    val context = LocalContext.current
    val decks = DemoDecks.load(context)
    val shown by controller.shown.collectAsState()
    val beat by controller.beat.collectAsState()
    // The CPU's last action stays in the feed, quieter, until the next turn's banner.
    var lastBeat by remember { mutableStateOf<Beat?>(null) }
    LaunchedEffect(beat) { beat?.let { lastBeat = it } }
    val banner by controller.banner.collectAsState()
    LaunchedEffect(banner) { if (banner != null) lastBeat = null }
    val stage by controller.stage.collectAsState()
    val live by controller.live.collectAsState()
    val failure by controller.failure.collectAsState()
    val audio = remember { TableAudio(context) }
    DisposableEffect(Unit) { onDispose { audio.release() } }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { audio.muted = true; controller.setPaused(true) }
    LifecycleEventEffect(Lifecycle.Event.ON_START) { audio.muted = false; controller.setPaused(false) }
    var previous by remember { mutableStateOf<MatchState?>(null) }
    // Keyed on the shown state itself: the board can advance within one revision (one CPU action at a time).
    LaunchedEffect(shown) { shown?.let { audio.update(previous, it); previous = it } }
    var inspect by remember { mutableStateOf<Card?>(null) }
    var selectedHand by remember { mutableStateOf<Int?>(null) }
    var menu by remember { mutableStateOf(false) }
    LaunchedEffect(shown?.revision) { if (shown?.selection?.actionable?.contains(selectedHand) != true) selectedHand = null }

    val anchors = remember { Anchors() }
    Box(Modifier.fillMaxSize().background(Palette.Night)) {
      CompositionLocalProvider(LocalAnchors provides anchors) {
        PlaymatScene(Modifier.fillMaxSize()) // play-playmats.js: this match's mat (nextPlaymat), its own shade, the table root see-through
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            val k = if (maxHeight >= 600.dp) 1.45f else if (maxHeight >= 480.dp) 1.2f else 1f
            val sizes = Sizes(sidebar = if (maxWidth >= 1000.dp) 280.dp else 168.dp, field = 46.dp * k, land = 36.dp * k, hand = 60.dp * k, back = 20.dp * k)
            val st = shown
            when {
                st == null || stage == Stage.STARTING -> Loading()
                stage == Stage.MULLIGAN -> Mulligan(st, controller, live, sizes, audio, onHold = { inspect = it })
                else -> {
                    var handOrder by remember { mutableStateOf(emptyList<Int>()) }
                    // table-emotes.mjs mount(): the CPU's hello once the match is on; everything goes with the table.
                    LaunchedEffect(Unit) { TableEmotes.start(this) }
                    DisposableEffect(Unit) { onDispose { TableEmotes.destroy() } }
                    ForgeBoard(st, live && beat == null, controller.intents, selectedHand, { selectedHand = it }, { inspect = it }, { menu = true },
                        handOrder, { handOrder = it }) {
                        TableSide(st, controller, beat, live, lastBeat) { inspect = it }
                    }
                }
            }
            banner?.let { b -> BannerView(b.text, b.yours, Modifier.align(Alignment.Center)) }
        }
        if (stage == Stage.PLAYING || stage == Stage.INTRO) shown?.let { CombatLines(it, anchors) }
      }
        inspect?.let { c -> Inspect(c) { inspect = null } }
        if (menu) Menu(onConcede = { menu = false; controller.concede() }, onLeave = { menu = false; onHome() }, onClose = { menu = false })
        if (stage == Stage.FINISHED) shown?.let { Result(it, audio, onHome, onRematch) }
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

@Composable
private fun Mulligan(st: MatchState, c: MatchController, live: Boolean, sizes: Sizes, audio: TableAudio, onHold: (Card) -> Unit) {
    // The same hand as the table, dealt in over the dimmed mat; Keep and Mulligan sit in the sidebar.
    Row(Modifier.fillMaxSize()) {
        BoxWithConstraints(Modifier.weight(1f).fillMaxHeight().background(Color(0x66000000)).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
            val cardW = minOf((maxWidth - 32.dp) / 5.2f, maxHeight * .55f / 1.4f)
            HandFan(st.me.hand, cardW, Modifier.fillMaxWidth(), angleDeg = 2.5f, dealIn = true,
                markOf = { card -> if (card.id in st.selection.chosenCards) Mark.PICKED else if (live && card.id in st.selection.cards) Mark.PICKABLE else Mark.NONE },
                onTap = { card -> if (live && card.id in st.selection.cards) c.card(card.id) else onHold(card) },
                onHold = onHold, onDeal = { audio.play("QP-012", .55f) }, pop = 1.2f)
        }
        Sidebar(st, c, null, live, sizes, null, Modifier.width(sizes.sidebar).fillMaxHeight(), onInspect = onHold)
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

/** Attack lines (attacker to the player it attacks) and block lines (blocker to its attacker): 1.5 dp gold, drawn in after the nudge. */
@Composable
private fun CombatLines(st: MatchState, anchors: Anchors) {
    val field = st.players.flatMap { it.battlefield }
    val pairs = buildList {
        field.filter { it.attacking }.forEach { a -> val defender = st.players.firstOrNull { it.id != a.controller } ?: return@forEach; add("c${a.id}" to "orb${defender.id}") }
        field.filter { it.blocking }.forEach { b -> b.blockingIds.forEach { add("c${b.id}" to "c$it") } }
    }
    val grow = remember { Animatable(0f) }
    LaunchedEffect(pairs) { if (pairs.isEmpty()) grow.snapTo(0f) else { grow.snapTo(0f); delay(150); grow.animateTo(1f, tween(200, easing = FastOutSlowInEasing)) } }
    if (pairs.isEmpty()) return
    Canvas(Modifier.fillMaxSize()) {
        anchors.version.intValue // redraw when an anchor moves
        for ((from, to) in pairs) {
            val a = anchors.map[from] ?: continue; val b = anchors.map[to] ?: continue
            val end = a + (b - a) * grow.value
            drawLine(Color(0x55000000), a, end, strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round)
            drawLine(Palette.GoldBright, a, end, strokeWidth = 1.5.dp.toPx(), cap = StrokeCap.Round)
            if (grow.value >= 1f) drawCircle(Palette.GoldBright, 3.dp.toPx(), b)
        }
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
        when {
            beat != null -> BeatView(beat, st, Modifier.align(Alignment.CenterEnd).padding(end = 12.dp).width(170.dp).fillMaxHeight(.62f)) { c.next() }
            live && st.prompt != null -> PromptPanel(st.prompt, st, c, live, Modifier.align(Alignment.BottomEnd).padding(end = 8.dp, bottom = 8.dp).width(240.dp).heightIn(max = 300.dp).glass(14.dp).padding(6.dp))
        }
    }
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
    val a = remember(text) { Animatable(0f) }
    LaunchedEffect(text) { a.animateTo(1f, tween(260)) }
    Box(modifier.alpha(a.value).width(420.dp).aspectRatio(5f), contentAlignment = Alignment.Center) {
        AssetImage(if (yours) "play/turn-you.webp" else "play/turn-cpu.webp", Modifier.fillMaxSize(), maxWidth = 1120, contentScale = ContentScale.Fit)
        Text(text, style = Type.Title.copy(fontSize = 20.sp), textAlign = TextAlign.Center)
    }
}

@Composable
private fun Inspect(card: Card, onClose: () -> Unit) {
    val decks = DemoDecks.load(LocalContext.current)
    Box(Modifier.fillMaxSize().background(Color(0xCC000000)).clickable(onClick = onClose).windowInsetsPadding(WindowInsets.safeDrawing).padding(20.dp), contentAlignment = Alignment.Center) {
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.fillMaxHeight(.92f).aspectRatio(.716f)) {
                if (!card.hidden) CardImage(card.name, Modifier.fillMaxSize(), contentScale = ContentScale.Fit, shape = RoundedCornerShape(12.dp))
            }
            Column(Modifier.width(260.dp).glass().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(card.name, style = Type.Title.copy(fontSize = 18.sp))
                Text(card.type, style = Type.Label.copy(color = Palette.Gold))
                if (card.text.isNotBlank()) Text(card.text, style = Type.Body.copy(color = Palette.Ink))
                if (card.isCreature && card.power != null) Text("${card.power}/${card.toughness}" + if (card.damage > 0) " · ${card.damage} damage" else "", style = Type.Label)
                card.counters.forEach { (k, v) -> Text("$v × $k counter", style = Type.Body) }
            }
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
private fun Result(st: MatchState, audio: TableAudio, onHome: () -> Unit, onRematch: () -> Unit) {
    val won = !st.draw && st.winnerPlayerId == st.viewer
    val draw = st.draw || st.winnerPlayerId == null
    val rise = remember { Animatable(0f) }
    LaunchedEffect(Unit) { delay(300); audio.play(if (draw) "QP-019" else if (won) "QP-017" else "QP-018"); rise.animateTo(1f, tween(400, easing = FastOutSlowInEasing)) }
    Box(Modifier.fillMaxSize().background(Color(0xAA000000).copy(alpha = .67f * rise.value)), contentAlignment = Alignment.Center) {
        Column(Modifier.graphicsLayer { alpha = rise.value; translationY = (1f - rise.value) * 40.dp.toPx() }.width(380.dp).glass(16.dp).padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.fillMaxWidth().aspectRatio(5f), contentAlignment = Alignment.Center) {
                AssetImage(if (draw) "play/result-draw.webp" else if (won) "play/result-win.webp" else "play/result-loss.webp", Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                Text(if (draw) "Draw" else if (won) "Victory" else "Defeat", style = Type.Title.copy(fontSize = 26.sp))
            }
            Text("Turn ${st.turn} · You ${st.me.life} · CPU ${st.cpu.life}", style = Type.Body.copy(color = Palette.Ink))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GoldButton("Home", true, Modifier.width(150.dp), primary = false, onClick = onHome)
                GoldButton("Rematch", true, Modifier.width(150.dp), onClick = onRematch)
            }
        }
    }
}

@Composable
private fun Failed(reason: String, onHome: () -> Unit) {
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
