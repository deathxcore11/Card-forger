package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState

/**
 * The match on a dual-screen handheld's bottom screen (specs/dual-screen-native.md, screens 1 and 2). Hand: your hand fan on the
 * left (the same fan, taps and slides as the table's) and the lifted card large on the right with its words. Stack: whenever
 * something is on the stack the bottom turns to it by itself, newest on top, with Resolve (the table's gold button) and Respond
 * (back to your hand). The top screen keeps the table and the stack's moment on the felt; its hand fan becomes a small count.
 */
@Composable
internal fun MatchBottom(st: MatchState, hand: List<Card>, lifted: Card?, gold: PadAct?, fan: @Composable (Dp) -> Unit, onInspect: (Card) -> Unit, afk: String? = null,
                         ask: String? = null, carried: Card? = null, live: Boolean = false,
                         canPlay: (Card) -> Boolean = { false }, why: (Card) -> String? = { null },
                         onAnswer: (Answer) -> Unit = {}, onCancel: (() -> Unit)? = null) {
    var zone by remember { mutableStateOf("hand") }
    val stackUp = st.stack.isNotEmpty()
    var seenStack by remember { mutableStateOf(0) }
    // The stack takes the bottom when it grows; Respond goes back to the hand.
    if (st.stack.size > seenStack) { zone = "stack"; seenStack = st.stack.size } else if (st.stack.size < seenStack) seenStack = st.stack.size
    val words = bottomWords(st, live, hand, lifted, carried, ask)
    // A question keeps the hand view: live 0.4.57 put a target prompt over a CPU spell on the stack and the bottom asked nothing.
    val shown = if (zone == "stack" && stackUp && words !is BottomWords.Ask) "stack" else "hand"
    // 0.4.59 T6 on two screens: while you pick on the table the question is the bottom's top strip (the asking card's name in the
    // aim colour, then what to do) and the hand under it fades and takes no taps; the top screen only rings the legal targets.
    val tablePick = words is BottomWords.Ask && handTucked(st, live, anyScreen = true)
    val parts = if (tablePick) askParts(st) else null
    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            ZoneChip("Hand ${hand.size}", shown == "hand") { zone = "hand" }
            // The clock's line ("Time's up. Choose a card to discard.") beside the hand it is about (V13); the top screen leaves it out.
            if (afk != null) Text(afk, Modifier.weight(1f), style = small(13f, Rule.Color.Coral, FontWeight.Bold), maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (stackUp) ZoneChip("Stack ${st.stack.size}", shown == "stack") { zone = "stack" }
            // Life totals and the gold button stay on the top screen only (each fact in one place, Randall's rule).
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val h = maxHeight
            if (shown == "stack") StackView(st, gold, onInspect) { zone = "hand" }
            else Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // A question (or the discard's line) is the bottom's top strip; the card it is about is read in the panel below.
                when (words) {
                    // Tidy rules (preview v9): the asking card's name is a small orange eyebrow, the question one centred Cinzel line under
                    // it; never side by side, never cut.
                    is BottomWords.Ask -> if (parts != null) Column(Modifier.fillMaxWidth().anchorRect("b.question"), horizontalAlignment = Alignment.CenterHorizontally) {
                            parts.name?.let { n -> Text(n.uppercase(), style = small(11f, Color(0xFFFF9D5C), FontWeight.ExtraBold).copy(letterSpacing = 1.4.sp), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            Text(parts.question, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Site.Text, textAlign = androidx.compose.ui.text.style.TextAlign.Center))
                        }
                        else Text(words.text, style = small(15f, Site.Gold, FontWeight.ExtraBold))
                    is BottomWords.Line -> Text(words.text, style = small(13f, Site.Muted))
                    is BottomWords.Words -> {}
                }
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    // As big as the room allows: the height, then the width shared by the cards with a generous overlap. The size eases as
                    // cards come and go, so the fan breathes instead of jumping.
                    val n = hand.size.coerceAtLeast(1)
                    // HandFan sets each card 2*t*t dp lower toward the ends and tilts it about its foot, below its own box (U15: the right-hand
                    // cards touched the hint bar). Keep that sag plus a margin clear, so every card stays whole above the bar.
                    val mid = (n - 1) / 2f
                    val sag = 2.dp * (mid * mid) + 8.dp
                    val sagA by androidx.compose.animation.core.animateDpAsState(sag, androidx.compose.animation.core.spring(dampingRatio = .9f, stiffness = 220f), label = "sag")
                    // 0.4.59 T7: a lifted card does not grow here (the cards are already full size); it rises [BOTTOM_LIFT] with a thicker ring.
                    val byH = (maxHeight - BOTTOM_LIFT - 8.dp - sag) / 1.4f
                    val byW = maxWidth / (1f + (n - 1) * .46f)
                    val target = minOf(minOf(byH, byW), 190.dp).coerceAtLeast(56.dp)
                    val cardW by androidx.compose.animation.core.animateDpAsState(target, androidx.compose.animation.core.spring(dampingRatio = .9f, stiffness = 220f), label = "fan")
                    if (hand.isNotEmpty()) Box(Modifier.fillMaxWidth().padding(bottom = 4.dp + sagA).then(if (tablePick) Modifier.askDim() else Modifier).anchorRect("b.hand")) {
                        fan(cardW)
                        if (tablePick) Box(Modifier.matchParentSize().pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } })
                    }
                }
                // 0.4.59 T7: under the hand, one glass panel reads the card that matters now (bottomReading).
                // While you pick on the table the reading sits left and the answers right ("Answer here or on the table").
                val answers = if (tablePick && st.inputType == "InputSelectTargets") bottomAnswers(st) else emptyList()
                // The hand only dims while it asks, so the answers may take half the room: four buttons and Cancel, whole, no scrolling.
                Row(Modifier.fillMaxWidth().heightIn(max = h * if (answers.isNotEmpty()) .5f else .42f), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    bottomReading(st, live, hand, lifted, carried, ask, canPlay, why)?.let { r ->
                        ReadingPanel(r, Modifier.weight(1f).anchorRect("b.read"))
                    }
                    if (answers.isNotEmpty() || (tablePick && onCancel != null)) AnswerList(answers, onAnswer, if (tablePick) onCancel else null, Modifier.weight(.8f).anchorRect("b.answers"))
                }
            }
        }
    }
}

/** One legal target the bottom screen offers as a button: a card (with its art) or a player. Tapping it is tapping that target on top. */
internal data class Answer(val card: Card?, val player: Int?, val label: String, val pt: String?, val chosen: Boolean)

/**
 * 0.4.59 tidy rules: the answers the bottom screen lists while a target is asked, at most [max]: the picked ones first (ringed gold),
 * then the legal cards Forge offers (selection.targetCards, in the table's order: theirs, then yours), then the players among the
 * targets (the opponent before you). Nothing is listed that Forge did not offer.
 */
internal fun bottomAnswers(st: MatchState, max: Int = 4): List<Answer> {
    val sel = st.selection
    // Your own cards say so, so two of the same name on both sides tell apart.
    fun ofCard(id: Int) = st.card(id)?.let { c -> Answer(c, null, c.name, listOfNotNull(if (c.power != null && c.toughness != null) "${c.power}/${c.toughness}" else null,
        "Yours".takeIf { c.controller == st.viewer }).joinToString("  ·  ").ifEmpty { null }, id in sel.chosenCards) }
    fun ofPlayer(id: Int) = st.players.firstOrNull { it.id == id }?.let { p -> Answer(null, p.id, if (p.id == st.viewer) "You" else p.name, "${p.life} life", id in sel.chosenPlayers) }
    val cards = (sel.chosenCards + sel.targetCards).distinct().mapNotNull { ofCard(it) }.sortedBy { it.card!!.controller == st.viewer }
    val players = (sel.chosenPlayers + sel.players.filter { it in sel.targetPlayers }).distinct().sortedBy { it == st.viewer }.mapNotNull { ofPlayer(it) }
    return (cards + players).sortedByDescending { it.chosen }.take(max)
}

@Composable
private fun AnswerList(answers: List<Answer>, onAnswer: (Answer) -> Unit, onCancel: (() -> Unit)?, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text("ANSWER HERE OR ON THE TABLE", style = small(10f, Site.Gold, FontWeight.ExtraBold).copy(letterSpacing = 1.4.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        answers.forEachIndexed { i, a ->
            val shape = RoundedCornerShape(10.dp)
            Row(Modifier.fillMaxWidth().height(34.dp).clip(shape).background(Color(0xC7121620))
                .border(if (a.chosen) 2.dp else 1.dp, if (a.chosen) Site.Gold else Color(0x61E3C070), shape)
                .clickable { onAnswer(a) }.anchorRect("b.answer$i").padding(end = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.width(44.dp).fillMaxHeight().background(Color(0xFF1B2230))) { a.card?.let { CardImage(it.name, Modifier.fillMaxSize(), crop = true) } }
                Text(a.label, Modifier.weight(1f), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 12.5f.sp, color = Site.Text), maxLines = 1, overflow = TextOverflow.Ellipsis)
                a.pt?.let { Text(it, style = small(12f, Site.Muted, FontWeight.ExtraBold)) }
            }
        }
        if (onCancel != null) {
            val shape = RoundedCornerShape(10.dp)
            Box(Modifier.fillMaxWidth().height(30.dp).clip(shape).border(1.dp, Color(0x66FFFFFF), shape).clickable { onCancel() }.anchorRect("b.cancel"), contentAlignment = Alignment.Center) {
                Text("Cancel", style = small(13f, Site.Text, FontWeight.ExtraBold))
            }
        }
    }
}

/** What the reading panel says: a small tag, the card, and one status line ([tone] picks its colour). */
internal data class Reading(val tag: String, val card: Card, val status: String?, val tone: Tone) {
    enum class Tone { ASK, STACK, OK, NO, NONE }
}

/** 0.4.59 T7: how high a lifted card stands on the bottom screen (it does not grow there). */
internal val BOTTOM_LIFT = 6.dp

/**
 * 0.4.59 T7, the bottom screen always reads the right card, in this order: the asking card, the top stack item, the lifted hand card,
 * the card under the ring or finger ([carried]), then the first card in the hand. While a discard asks and nothing is picked, no
 * card is read as if it were chosen (W12). The status line: what the question wants, that it is on the stack, or whether you can play
 * it ([canPlay]) and, when not, the table's own reason ([why]); words never written for a card.
 */
internal fun bottomReading(st: MatchState, live: Boolean, hand: List<Card>, lifted: Card?, carried: Card?, ask: String?,
                           canPlay: (Card) -> Boolean, why: (Card) -> String?): Reading? {
    val question = bottomAsk(st, live, ask)
    val asking = if (question != null) (carried ?: pendingCast(st)) else null
    if (asking != null) return Reading("Asking", asking, if (st.inputType == "InputSelectTargets") "Legal targets are ringed on the top screen." else null, Reading.Tone.ASK)
    // A question with no card of its own (attack, block) reads nothing: never a lift or a hand card left from before (fault 4).
    if (question != null) return null
    st.stack.firstOrNull()?.let { top ->
        // A trigger Forge sends with no source is named by its text ("Soul Warden — ..."): read the card of that name on the board.
        val src = top.source ?: stackSourceName(top.text)?.let { n -> (st.players.filter { it.id == top.controller } + st.players).flatMap { it.battlefield }
            .firstOrNull { it.name == n } } ?: return@let
        val tag = if (top.trigger) "Trigger on the stack" else if (top.ability) "Ability on the stack" else "On the stack"
        return Reading(tag, src, "On the stack now.", Reading.Tone.STACK)
    }
    if (dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null && lifted == null && carried == null) return null
    val c = lifted ?: carried ?: hand.firstOrNull() ?: return null
    if (c.zone != "Hand" || !live) return Reading("In your hand", c, null, Reading.Tone.NONE)
    if (canPlay(c)) return Reading("In your hand", c, if (c.isLand) "You can play this land." else "You can cast this. The lands that pay are lit in gold.", Reading.Tone.OK)
    return Reading("In your hand", c, why(c)?.let { it.trimEnd('.') + "." }, Reading.Tone.NO)
}

@Composable
internal fun ReadingPanel(r: Reading, modifier: Modifier) {
    val shape = RoundedCornerShape(12.dp)
    val c = r.card
    Column(modifier.clip(shape).background(Color(0xC7121620)).border(1.dp, Color(0x61E3C070), shape).verticalScroll(rememberScrollState())
        .padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(r.tag.uppercase(), style = small(10f, Site.Gold, FontWeight.ExtraBold).copy(letterSpacing = 1.6.sp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(c.name, Modifier.weight(1f, fill = false), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Site.Text), maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (c.manaCost.isNotBlank()) SymText(c.manaCost, small(13f, Site.Gold))
        }
        Text(c.type + if (c.power != null && c.toughness != null) "  ·  ${c.power}/${c.toughness}" else "", style = small(12f, Site.Muted, FontWeight.Bold))
        // {1}{W} and {T} draw as their symbols, as on the card page (SymText), never as raw braces.
        if (c.text.isNotBlank()) SymText(c.text, TextStyle(fontFamily = Site.Manrope, fontSize = 13.5f.sp, lineHeight = 19.sp, color = Color(0xFFE4E7EA)))
        r.status?.let { line ->
            val col = when (r.tone) { Reading.Tone.ASK -> Color(0xFFFF9D4D); Reading.Tone.STACK -> Site.Gold; Reading.Tone.NO -> Color(0xFFFF6A4A); else -> Color(0xFF5CC8FF) }
            Text(line, Modifier.anchorRect("b.status"), style = small(12.5f, col, FontWeight.ExtraBold))
        }
    }
}

/** What the bottom's words area says: the question being asked, a card's words, or a plain line. */
internal sealed interface BottomWords {
    data class Ask(val text: String, val card: Card?) : BottomWords
    data class Words(val card: Card) : BottomWords
    data class Line(val text: String) : BottomWords
}

/**
 * The question the bottom screen asks, or null (table-info I5.1: on two screens the question lives on the bottom). [ask] is
 * askLine's. Attack has no askLine on purpose, so it reads "Choose attackers" (TableScreen's words). "Respond to X?" stays on the
 * top until the stack view says it, and the discard keeps its own line (W12).
 */
internal fun bottomAsk(st: MatchState, live: Boolean, ask: String?): String? {
    if (!live || st.prompt != null || dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null) return null
    return when (st.inputType) {
        "InputAttack" -> "Choose attackers"
        "InputPassPriority" -> null
        else -> ask
    }
}

/**
 * Live 0.4.57 (fault list 4, 12, 14): during targets, attack and block the bottom showed a hand card left lifted (or hand[0])
 * and no question. Now a question comes first, with the card under the finger or the spell being cast; never a stale hand card.
 * W12: while a discard asks and nothing is picked, no card's words stand in as if it were chosen.
 */
internal fun bottomWords(st: MatchState, live: Boolean, hand: List<Card>, lifted: Card?, carried: Card?, ask: String?): BottomWords {
    val question = bottomAsk(st, live, ask)
    if (question != null) return BottomWords.Ask(question, carried ?: pendingCast(st))
    (carried ?: lifted)?.let { return BottomWords.Words(it) }
    if (dev.cardstashy.nativeplay.match.TurnClock.discardCount(st) != null) return BottomWords.Line(if (hand.isNotEmpty()) "Choose a card to discard." else "Your hand is empty.")
    return hand.firstOrNull()?.let { BottomWords.Words(it) } ?: BottomWords.Line("Your hand is empty.")
}

@Composable
private fun StackView(st: MatchState, gold: PadAct?, onInspect: (Card) -> Unit, onRespond: () -> Unit) {
    // The gold button below prints its own X, so the bar under it does not say "X Resolve" a second time.
    val owner = remember { Any() }
    val goldShown = gold?.run != null
    androidx.compose.runtime.DisposableEffect(owner, goldShown) {
        if (goldShown) DualScreen.shownKeys[owner] = setOf("X")
        onDispose { DualScreen.shownKeys.remove(owner) }
    }
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1.25f).fillMaxHeight().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Newest first, as it will resolve: the top item large, the older ones stepped behind it.
            st.stack.asReversed().forEachIndexed { i, s ->
                val top = i == 0
                val shape = RoundedCornerShape(12.dp)
                Column(Modifier.fillMaxWidth().alpha(if (top) 1f else .72f).clip(shape).background(if (top) Color(0x24E8B95B) else Color(0x0DFFFFFF))
                    .border(1.dp, if (top) Color(0x99E8B95B) else Color(0x1FFFFFFF), shape)
                    .then(if (s.source != null) Modifier.clickable { onInspect(s.source) } else Modifier).padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(s.source?.name ?: if (s.ability) "Ability" else "Spell", style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = if (top) 16.sp else 13.sp, color = Site.Text),
                        maxLines = 2, overflow = TextOverflow.Ellipsis)
                    // X13: the words wrap to as many lines as the row can have (the list scrolls), never one line with an ellipsis.
                    Text(s.text, style = small(if (top) 13f else 12f, Color(0xFFE4E7EA)), maxLines = if (top) 10 else 6, overflow = TextOverflow.Ellipsis)
                    val who = if (s.controller == st.viewer) "Yours" else "Opponent's"
                    val targets = s.targets.mapNotNull { r -> r.name ?: (if (r.kind == "player") st.players.firstOrNull { it.id == r.id }?.let { if (it.isViewer) "you" else it.name } else st.card(r.id)?.name) }
                    Text(who + if (targets.isNotEmpty()) " · targets ${targets.joinToString(", ")}" else "", style = small(11.5f, if (targets.isNotEmpty() && top) Color(0xFFFF8A74) else Site.Muted))
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(10.dp, Alignment.Bottom)) {
            Text(if (st.waitingOnMe) "Your priority" else "Waiting", style = small(12f, if (st.waitingOnMe) Site.Gold else Site.Muted))
            GlassButton("Respond", st.waitingOnMe, onRespond)
            gold?.run?.let { GoldButton(gold.label, it) }
        }
    }
}

@Composable
private fun ZoneChip(label: String, on: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Box(Modifier.heightIn(min = 36.dp).clip(shape).background(if (on) Color(0x26E8B95B) else Color(0x0DFFFFFF)).border(1.dp, if (on) Color(0x99E8B95B) else Color(0x1FFFFFFF), shape)
        .clickable(onClick = onClick).semantics { role = Role.Tab; selected = on }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
        Text(label, style = small(13f, if (on) Site.Gold else Site.Muted, FontWeight.Bold))
    }
}

@Composable
private fun GoldButton(label: String, run: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(shape).background(Brush.verticalGradient(listOf(Color(0xFFF2D48F), Color(0xFFC99C4F)))).clickable(onClick = run)
        .semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (Pad.connected.value) PadKey("X", "")
            Text(label, style = small(15f, Color(0xFF2A1D0C), FontWeight.ExtraBold))
        }
    }
}

@Composable
private fun GlassButton(label: String, enabled: Boolean, run: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = 44.dp).alpha(if (enabled) 1f else .5f).clip(shape).background(Color(0x14FFFFFF)).border(1.dp, Color(0x33FFFFFF), shape)
        .clickable(enabled = enabled, onClick = run).semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        Text(label, style = small(14f, Site.Text, FontWeight.Bold))
    }
}

internal fun small(size: Float, color: Color, weight: FontWeight = FontWeight.SemiBold) = TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, color = color)

/** Tidy rules, two screens: while a question asks, the hand stays in its row, at about a third and greyed (desaturated), and takes no taps. */
internal const val BOTTOM_ASK_ALPHA = .34f
private fun Modifier.askDim() = this.drawWithContent {
    val paint = androidx.compose.ui.graphics.Paint().apply {
        colorFilter = androidx.compose.ui.graphics.ColorFilter.colorMatrix(androidx.compose.ui.graphics.ColorMatrix().apply { setToSaturation(.25f) })
        alpha = BOTTOM_ASK_ALPHA
    }
    drawIntoCanvas { c -> c.saveLayer(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height), paint); drawContent(); c.restore() }
}
