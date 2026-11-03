package dev.cardstashy.nativeplay.ui

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
    val banner by controller.banner.collectAsState()
    val stage by controller.stage.collectAsState()
    val live by controller.live.collectAsState()
    val failure by controller.failure.collectAsState()
    val audio = remember { TableAudio(context) }
    DisposableEffect(Unit) { onDispose { audio.release() } }
    var previous by remember { mutableStateOf<MatchState?>(null) }
    LaunchedEffect(shown?.revision) { shown?.let { audio.update(previous, it); previous = it } }
    var inspect by remember { mutableStateOf<Card?>(null) }
    var selectedHand by remember { mutableStateOf<Int?>(null) }
    var menu by remember { mutableStateOf(false) }
    LaunchedEffect(shown?.revision) { if (shown?.selection?.actionable?.contains(selectedHand) != true) selectedHand = null }

    Box(Modifier.fillMaxSize().background(Palette.Night)) {
        AssetImage("play/playmat-charcoal-table.webp", Modifier.fillMaxSize(), maxWidth = 1600)
        Box(Modifier.fillMaxSize().background(Color(0x55000000)))
        BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            val k = if (maxHeight >= 600.dp) 1.45f else if (maxHeight >= 480.dp) 1.2f else 1f
            val sizes = Sizes(sidebar = if (maxWidth >= 1000.dp) 280.dp else 168.dp, field = 46.dp * k, land = 36.dp * k, hand = 60.dp * k, back = 20.dp * k)
            val st = shown
            when {
                st == null || stage == Stage.STARTING -> Loading()
                stage == Stage.MULLIGAN -> Mulligan(st, controller, live, sizes, onHold = { inspect = it })
                else -> Row(Modifier.fillMaxSize()) {
                    Board(st, controller, live, sizes, selectedHand, Modifier.weight(1f).fillMaxHeight(),
                        onSelectHand = { selectedHand = it }, onInspect = { inspect = it }, onMenu = { menu = true })
                    Sidebar(st, controller, beat, live, sizes, selectedHand, Modifier.width(sizes.sidebar).fillMaxHeight(), onInspect = { inspect = it })
                }
            }
            banner?.let { b -> BannerView(b.text, b.yours, Modifier.align(Alignment.Center)) }
        }
        inspect?.let { c -> Inspect(c) { inspect = null } }
        if (menu) Menu(onConcede = { menu = false; controller.concede() }, onLeave = { menu = false; onHome() }, onClose = { menu = false })
        if (stage == Stage.FINISHED) shown?.let { Result(it, onHome, onRematch) }
        if (stage == Stage.FAILED) Failed(failure ?: "The match stopped.", onHome)
    }
}

@Composable
private fun Loading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Shuffling…", style = Type.Title) }
}

// ---- The opening hand: nothing else is drawn before the keep ----

@Composable
private fun Mulligan(st: MatchState, c: MatchController, live: Boolean, sizes: Sizes, onHold: (Card) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().padding(16.dp)) {
        val cardW = minOf((maxWidth - 32.dp) / 7.6f, maxHeight * .5f / 1.4f)
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)) {
            Text("Opening hand", style = Type.Title)
            if (st.prompt == null && st.inputType != "InputConfirmMulligan" && st.message.isNotBlank()) Text(shortMessage(st), style = Type.Body.copy(color = Palette.Ink), textAlign = TextAlign.Center)
            CardRow(cardW, 8.dp, Modifier.fillMaxWidth()) {
                st.me.hand.forEach { card ->
                    val pick = live && card.id in st.selection.cards
                    CardFace(card, cardW, cardW * 1.4f, mark = if (card.id in st.selection.chosenCards) Mark.PICKED else if (pick) Mark.PICKABLE else Mark.NONE,
                        onTap = if (pick) ({ c.card(card.id) }) else null, onHold = { onHold(card) })
                }
            }
            st.prompt?.let { PromptPanel(it, st, c, live, Modifier.width(360.dp)) } ?: Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                st.buttons.cancel?.let { GoldButton(it, live && st.buttons.cancelEnabled, primary = false, modifier = Modifier.width(150.dp)) { c.cancel() } }
                st.buttons.ok?.let { GoldButton(it, live && st.buttons.okEnabled, modifier = Modifier.width(150.dp)) { c.ok() } }
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

    Column(modifier.padding(start = 6.dp, end = 6.dp, top = 4.dp)) {
        // CPU strip: menu, CPU hand backs, library and graveyard.
        Row(Modifier.fillMaxWidth().height(sizes.h(sizes.back) + 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onMenu), contentAlignment = Alignment.Center) {
                Text("≡", style = Type.Title.copy(fontSize = 22.sp, color = Palette.Gold))
            }
            CardRow(sizes.back, 3.dp, Modifier.weight(1f)) { repeat(cpu.handCount) { CardBack(Modifier.size(sizes.back, sizes.h(sizes.back)).clip(RoundedCornerShape(3.dp))) } }
            Text("${cpu.libraryCount} · ${cpu.graveyard.size}", style = Type.Body.copy(fontSize = 11.sp), modifier = Modifier.padding(end = 4.dp))
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
            Seat(me.life, "You", me.libraryCount, me.graveyard.size, pickable = live && st.viewer in st.selection.players, picked = st.viewer in st.selection.chosenPlayers) { c.player(st.viewer) }
            Hand(st, c, live, sizes, selectedHand, Modifier.weight(1f), onSelectHand, onInspect)
        }
    }
}

private fun lands(cards: List<Card>) = cards.filter { it.isLand && !it.isCreature && it.attachedTo == null }
private fun others(cards: List<Card>) = cards.filter { !(it.isLand && !it.isCreature) && it.attachedTo == null }

/** Lands and identical untouched permanents pile as ×N; everything else stands alone. */
@Composable
private fun Permanents(cards: List<Card>, w: Dp, markOf: (Card) -> Mark, tapOf: (Card) -> (() -> Unit)?, onInspect: (Card) -> Unit, nudge: Dp = 0.dp) {
    val piles = cards.groupBy { if (it.isLand && markOf(it) == Mark.NONE && tapOf(it) == null) "${it.name}|${it.tapped}" else "id${it.id}" }.values.toList()
    CardRow(w, 6.dp, Modifier.fillMaxWidth().height(w * 1.4f + 8.dp)) {
        piles.forEach { pile ->
            val card = pile.first()
            CardFace(card, w, w * 1.4f, mark = markOf(card), count = pile.size, onTap = tapOf(card), onHold = { onInspect(card) },
                nudge = if (card.attacking) nudge else 0.dp)
        }
    }
}

@Composable
private fun Seat(life: Int, who: String, library: Int, grave: Int, pickable: Boolean, picked: Boolean, onPick: () -> Unit) {
    Column(Modifier.padding(end = 6.dp, bottom = 4.dp).width(64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        LifeOrb(life, pickable, picked, onPick)
        Text("$library · $grave", style = Type.Body.copy(fontSize = 11.sp))
    }
}

@Composable
private fun LifeOrb(life: Int, pickable: Boolean, picked: Boolean, onPick: () -> Unit) {
    val flash = remember { Animatable(0f) }
    var last by remember { mutableStateOf(life) }
    LaunchedEffect(life) { if (life < last) { flash.snapTo(1f); flash.animateTo(0f, tween(900)) }; last = life }
    Box(Modifier.size(52.dp).clip(CircleShape)
        .background(Brush.radialGradient(listOf(Color(0xFF2A2A31).copy(alpha = 1f), Color(0xFF111114))))
        .background(Palette.Red.copy(alpha = .55f * flash.value))
        .border(if (pickable || picked) 2.5.dp else 1.5.dp, if (pickable || picked) Palette.GoldBright else Palette.Gold, CircleShape)
        .clickable(enabled = pickable, onClick = onPick), contentAlignment = Alignment.Center) {
        Text("$life", style = Type.Title.copy(fontSize = 22.sp))
    }
}

/** The hand fan: never wraps, never rescales. Tap a playable card to lift it (tap again to inspect); play it with the gold button or by dragging it up. */
@Composable
private fun Hand(st: MatchState, c: MatchController, live: Boolean, sizes: Sizes, selected: Int?, modifier: Modifier,
                 onSelect: (Int?) -> Unit, onInspect: (Card) -> Unit) {
    val cards = st.me.hand.sortedWith(compareBy({ if (it.isLand) 0 else 1 }, { manaValue(it.manaCost) }))
    val density = LocalDensity.current
    CardRow(sizes.hand, 4.dp, modifier.fillMaxHeight()) {
        cards.forEachIndexed { i, card ->
            val playable = live && card.id in st.selection.actionable
            val pickable = live && card.id in st.selection.cards
            var drag by remember(card.id) { mutableStateOf(Offset.Zero) }
            val mid = (cards.size - 1) / 2f
            val lifted = selected == card.id
            Box(Modifier.zIndex(if (drag != Offset.Zero || lifted) 2f else 0f)
                .graphicsLayer {
                    translationX = drag.x; translationY = drag.y + (if (lifted) -18.dp.toPx() else 0f)
                    rotationZ = if (drag == Offset.Zero && !lifted) (i - mid) * 2.5f else 0f
                    val s = if (lifted || drag != Offset.Zero) 1.12f else 1f; scaleX = s; scaleY = s
                }
                .pointerInput(card.id, playable) {
                    if (playable) detectDragGestures(
                        onDragEnd = { if (drag.y < -with(density) { 70.dp.toPx() }) c.card(card.id); drag = Offset.Zero },
                        onDragCancel = { drag = Offset.Zero },
                    ) { change, amount -> change.consume(); drag += amount }
                }) {
                CardFace(card, sizes.hand, sizes.h(sizes.hand), mark = if (pickable) Mark.PICKABLE else if (playable) Mark.PLAYABLE else Mark.NONE,
                    onTap = when {
                        pickable -> ({ c.card(card.id) })
                        playable && lifted -> ({ onInspect(card) })
                        playable -> ({ onSelect(card.id) })
                        else -> ({ onInspect(card) })
                    }, onHold = { onInspect(card) })
            }
        }
    }
}

private fun manaValue(cost: String): Int = Regex("\\{([^}]+)\\}").findAll(cost).sumOf { m ->
    val s = m.groupValues[1]; s.toIntOrNull() ?: if (s in setOf("X", "Y", "Z")) 0 else 1
}

// ---- Sidebar: CPU seat, the feed, phase dots, the gold action ----

@Composable
private fun Sidebar(st: MatchState, c: MatchController, beat: Beat?, live: Boolean, sizes: Sizes, selectedHand: Int?, modifier: Modifier, onInspect: (Card) -> Unit) {
    Column(modifier.padding(6.dp).glass(14.dp).padding(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LifeOrb(st.cpu.life, pickable = live && st.cpu.id in st.selection.players, picked = st.cpu.id in st.selection.chosenPlayers) { c.player(st.cpu.id) }
            Column {
                Text("CPU", style = Type.Title.copy(fontSize = 15.sp))
                Text("${st.cpu.libraryCount} library · ${st.cpu.graveyard.size} grave", style = Type.Body.copy(fontSize = 11.sp))
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                beat != null -> BeatView(beat, st, Modifier.fillMaxSize()) { c.next() }
                live && st.prompt != null -> PromptPanel(st.prompt, st, c, live, Modifier.fillMaxSize())
                selectedHand != null -> st.card(selectedHand)?.let { FeedCard(it, null, Modifier.fillMaxSize(), onInspect) }
                st.stack.isNotEmpty() -> StackView(st, Modifier.fillMaxSize(), onInspect)
                else -> Text(decisionText(st, live), style = Type.Body.copy(color = Palette.Ink), modifier = Modifier.align(Alignment.Center), textAlign = TextAlign.Center)
            }
        }
        PhaseDots(st)
        Actions(st, c, live && beat == null, selectedHand)
    }
}

@Composable
private fun BeatView(b: Beat, st: MatchState, modifier: Modifier, onTap: () -> Unit) {
    val decks = DemoDecks.load(LocalContext.current)
    val timer = remember(b) { Animatable(1f) }
    LaunchedEffect(b) { timer.animateTo(0f, tween(b.durationMs.toInt(), easing = LinearEasing)) }
    val red = b.kind == Beat.Kind.AFFECTS_YOU
    Column(modifier.clip(RoundedCornerShape(10.dp)).border(if (red) 2.dp else 1.dp, if (red) Palette.Red else Palette.Hairline, RoundedCornerShape(10.dp))
        .background(if (red) Color(0x33E0533F) else Color(0x22000000)).clickable(onClick = onTap).padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(b.title, style = Type.Label.copy(fontSize = 12.sp), textAlign = TextAlign.Center, maxLines = 3)
        if (b.kind != Beat.Kind.LAND && b.cardName != null) {
            val img = decks.image(b.cardName)
            Box(Modifier.weight(1f).aspectRatio(.716f, matchHeightConstraintsFirst = true)) {
                if (img != null) AssetImage(img, Modifier.fillMaxSize(), maxWidth = 488, contentScale = ContentScale.Fit, shape = RoundedCornerShape(6.dp))
            }
        } else Spacer(Modifier.weight(1f))
        b.detail?.let { Text(it, style = Type.Body.copy(color = if (red) Color(0xFFFFB4A8) else Palette.InkSoft), textAlign = TextAlign.Center) }
        if (b.lifeFrom != null && b.lifeTo != null) Text("${b.lifeFrom} → ${b.lifeTo}", style = Type.Title.copy(fontSize = 18.sp, color = Color(0xFFFFB4A8)))
        Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
            Box(Modifier.fillMaxWidth(timer.value).height(3.dp).background(if (red) Palette.Red else Palette.Gold))
        }
    }
}

@Composable
private fun FeedCard(card: Card, caption: String?, modifier: Modifier, onInspect: (Card) -> Unit) {
    val decks = DemoDecks.load(LocalContext.current)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        caption?.let { Text(it, style = Type.Label, textAlign = TextAlign.Center) }
        Box(Modifier.weight(1f).aspectRatio(.716f, matchHeightConstraintsFirst = true).pointerInput(card.id) { detectTapGestures(onLongPress = { onInspect(card) }) }) {
            decks.image(card.name)?.let { AssetImage(it, Modifier.fillMaxSize(), maxWidth = 488, contentScale = ContentScale.Fit, shape = RoundedCornerShape(6.dp)) }
        }
    }
}

@Composable
private fun StackView(st: MatchState, modifier: Modifier, onInspect: (Card) -> Unit) {
    val top = st.stack.first()
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
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
            Box(Modifier.size(if (on) 10.dp else 7.dp).clip(CircleShape).background(if (on) (if (yours) Palette.GoldBright else Color(0xFF8FB3E8)) else Color(0x44FFFFFF)))
        }
    }
}

/** The gold action button and the quiet second one, labelled like the web table's native panel. */
@Composable
private fun Actions(st: MatchState, c: MatchController, live: Boolean, selectedHand: Int?) {
    if (st.prompt != null) return
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
                if (p.max > 1 || p.min == 0) GoldButton(if (picked.isEmpty() && p.min == 0) "None" else "Confirm", live && picked.size >= p.min, Modifier.fillMaxWidth()) {
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
                if (!card.hidden) decks.image(card.name)?.let { AssetImage(it, Modifier.fillMaxSize(), contentScale = ContentScale.Fit, shape = RoundedCornerShape(12.dp)) }
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
private fun Result(st: MatchState, onHome: () -> Unit, onRematch: () -> Unit) {
    val won = !st.draw && st.winnerPlayerId == st.viewer
    val draw = st.draw || st.winnerPlayerId == null
    Box(Modifier.fillMaxSize().background(Color(0xAA000000)), contentAlignment = Alignment.Center) {
        Column(Modifier.width(380.dp).glass(16.dp).padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
