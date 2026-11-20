package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import kotlinx.coroutines.delay

/**
 * Explains itself E3 (specs/explains-itself-briefs.md, approved 19 Nov): any item on the stack can be read. A tap on a stack card
 * opens that one item at reading size beside the stack: whose it is, when it happens, only its own words, and the card it is
 * about. The whole card page is one more tap (the art). Seen in Randall's 19 Nov recording: four items, three of them only a
 * title, the top one's words tiny on the Fold.
 */
object StackRead {
    /** The stack item open for reading, by id; null = none. */
    var open by mutableStateOf<Int?>(null)
    /** How long the reader stays with no touch on it. */
    const val IDLE_MS = 8000L

    fun item(st: MatchState): StackItem? = open?.let { id -> st.stack.firstOrNull { it.id == id } }

    /** "CPU's trigger", "Your spell": the words under the top card, for any item. */
    fun whose(s: StackItem, st: MatchState): String = "${if (s.controller == st.viewer) "Your" else "CPU's"} ${if (s.trigger) "trigger" else if (s.ability) "ability" else "spell"}"

    /** When it happens: the top of the stack is next, the one under it 2nd, and so on. Null when it is not on the stack. */
    fun order(s: StackItem, st: MatchState): String? = when (val i = st.stack.indexOfFirst { it.id == s.id }) {
        -1 -> null; 0 -> "Happens next"; 1 -> "Happens 2nd"; 2 -> "Happens 3rd"; else -> "Happens ${i + 1}th"
    }

    /** Only the item's own words: an ability's text without the "Source — " lead; a spell's rules text. */
    fun words(s: StackItem): String {
        val src = s.source
        val ability = s.ability || src == null || src.zone != "Stack"
        return if (ability) s.text.substringAfter(" — ", s.text).trim() else src?.text?.trim().orEmpty().ifEmpty { s.text.trim() }
    }

    /** A card the item is about (a target, or a card Forge's note named), with where it is now. */
    data class About(val card: Card, val where: String)

    /** The cards [s] is about that the table can show: its targets first, then the cards Forge's note named. Never its own source. */
    fun about(s: StackItem, st: MatchState): List<About> =
        (s.targets + s.noted).asSequence().filter { it.kind == "card" && it.id != s.source?.id }.map { it.id }.distinct()
            .mapNotNull { id -> st.card(id)?.takeIf { !it.hidden } }.map { About(it, where(it, st)) }.take(2).toList()

    fun where(c: Card, st: MatchState): String {
        val mine = c.controller == st.viewer
        return when (c.zone) {
            "Battlefield" -> if (mine) "On your side" else "On the CPU's side"
            "Graveyard" -> if (c.owner == st.viewer) "In your graveyard" else "In the CPU's graveyard"
            "Hand" -> if (c.owner == st.viewer) "In your hand" else "In the CPU's hand"
            "Exile" -> "In exile"
            "Command" -> "In the command zone"
            else -> ""
        }
    }

    /**
     * Where the reader stands: [at] (beside the stack card) unless it would lie on [source], the item's own card on the table. Then
     * the first of these that fits on the screen: under the source, over it, left of it. No room anywhere: [at].
     */
    fun place(at: IntOffset, panel: IntSize, root: IntSize, source: androidx.compose.ui.geometry.Rect?, gap: Int, edge: Int): IntOffset {
        fun hits(o: IntOffset) = source != null && o.x < source.right && o.x + panel.width > source.left && o.y < source.bottom && o.y + panel.height > source.top
        if (source == null || !hits(at)) return at
        val tries = listOf(IntOffset(at.x, source.bottom.toInt() + gap), IntOffset(at.x, source.top.toInt() - gap - panel.height), IntOffset(source.left.toInt() - gap - panel.width, at.y))
        return tries.firstOrNull { it.x >= edge && it.y >= edge && it.x + panel.width <= root.width - edge && it.y + panel.height <= root.height - edge && !hits(it) } ?: at
    }

    /** The next item up (-1, towards the top) or down (+1) from the open one; the ends stay. */
    fun step(st: MatchState, by: Int) { val i = st.stack.indexOfFirst { it.id == open }; if (i >= 0) open = st.stack[(i + by).coerceIn(0, st.stack.lastIndex)].id }
}

private val ReadGold = Color(0xFFE8B95B)

/** The dim over the board and the open item at reading size, left of the stack card. Draws nothing while no item is open. */
@Composable
internal fun StackReader(st: MatchState, d: Du, onInspect: (Card) -> Unit) = with(d) {
    val s = StackRead.item(st)
    // The item resolved or the match moved on: the reader goes with it.
    if (s == null) { if (StackRead.open != null) androidx.compose.runtime.SideEffect { StackRead.open = null }; return@with }
    val anchors = LocalAnchors.current
    // A press on the reader starts its wait again (a press only: a scroll's moves would restart it every frame).
    var touches by remember { mutableIntStateOf(0) }
    LaunchedEffect(s.id, touches) { delay(StackRead.IDLE_MS); StackRead.open = null }
    // F1/F4: it grows in over 140 ms (no motion: it is simply there).
    val grow = remember { androidx.compose.animation.core.Animatable(if (Motion.still) 1f else 0f) }
    LaunchedEffect(Unit) { if (!Motion.still) grow.animateTo(1f, androidx.compose.animation.core.tween(140, easing = androidx.compose.animation.core.FastOutSlowInEasing)) }
    androidx.activity.compose.BackHandler(true) { StackRead.open = null }
    val mine = s.controller == st.viewer
    val tone = if (mine) ReadGold else CpuRed
    val src = s.source
    val name = src?.name ?: stackSourceName(s.text) ?: "Ability"
    var root by remember { mutableStateOf(IntSize.Zero) }
    var self by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    var panel by remember { mutableStateOf(IntSize.Zero) }
    val focus = remember { FocusRequester() }
    val pad by Pad.connected.collectAsState()
    LaunchedEffect(s.id, pad) { if (pad) runCatching { focus.requestFocus() } }
    Box(Modifier.fillMaxSize().onSizeChanged { root = it }.onGloballyPositioned { self = it.boundsInRoot().topLeft }
        // I1 c: the rest of the board steps back 30 %; a tap anywhere on it puts the item back.
        // A tap on another stack card (or its row in the folded list) goes straight to that item: one tap each to walk the stack.
        .drawBehind { drawRect(Color(0x4D000000), alpha = grow.value) }
        .pointerInput(st.stack.map { it.id }) { detectTapGestures { at ->
            val p = at + self
            StackRead.open = st.stack.firstOrNull { i -> i.id != s.id && (anchors?.rects?.get("stack${i.id}")?.contains(p) == true || anchors?.rects?.get("stackrow${i.id}")?.contains(p) == true) }?.id
        } }.anchorRect("stackreaddim")) {
        val shape = RoundedCornerShape(10.du)
        Column(Modifier.offset {
            anchors?.version?.intValue
            // Beside the stack: its right edge a little left of the top card, its top level with that card, kept on the screen.
            val card = anchors?.rects?.get("stackcard")
            val gap = 10.du.roundToPx(); val edge = 8.du.roundToPx()
            val x = ((card?.left ?: root.width.toFloat()) - self.x).toInt() - gap - panel.width
            val y = ((card?.top ?: 0f) - self.y).toInt()
            val at = IntOffset(x.coerceIn(edge, maxOf(edge, root.width - panel.width - edge)), y.coerceIn(edge, maxOf(edge, root.height - panel.height - edge)))
            // U4: it does not lie on its own source, the card the arc points at, when there is room beside or past it.
            val source = src?.let { anchors?.rects?.get("c${it.id}") }?.translate(-self.x, -self.y)
            StackRead.place(at, panel, root, source, gap, edge)
        }.graphicsLayer { alpha = grow.value; val k = .94f + .06f * grow.value; scaleX = k; scaleY = k; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, .2f) }.width(206.du).onSizeChanged { panel = it }.anchorRect("stackread").clip(shape).background(Color(0xFF141210)).border(2.dp, tone, shape)
            .focusRequester(focus).focusable()
            .onPreviewKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (e.key) {
                    Key.DirectionUp -> { StackRead.step(st, -1); true }
                    Key.DirectionDown -> { StackRead.step(st, 1); true }
                    Key.ButtonA, Key.Enter, Key.DirectionCenter -> { src?.let(onInspect); true }
                    else -> false
                }
            }
            .pointerInput(Unit) { awaitPointerEventScope { while (true) { if (awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial).type == androidx.compose.ui.input.pointer.PointerEventType.Press) touches++ } } }
            .clickable(remember { MutableInteractionSource() }, null) { }
            .semantics { contentDescription = "$name, ${StackRead.whose(s, st)}" }.padding(10.du), verticalArrangement = Arrangement.spacedBy(7.du)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.du)) {
                Box(Modifier.size(7.du).clip(CircleShape).background(tone))
                Text(StackRead.whose(s, st), style = sans(sp(11.5f), FontWeight.Bold, tone), maxLines = 1, modifier = Modifier.weight(1f))
                StackRead.order(s, st)?.let { Text(it, style = sans(sp(11.5f), FontWeight.SemiBold, Color(0xFFD8C9A6)), maxLines = 1) }
            }
            Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(15f), color = Color(0xFFF3E7C6)), maxLines = 2, overflow = TextOverflow.Ellipsis)
            // The source's art: one more tap opens the whole card, as a tap on the stack card did before.
            if (src != null) Box(Modifier.fillMaxWidth().height(64.du).clip(RoundedCornerShape(5.du)).clickable { StackRead.open = null; onInspect(src) }.anchorRect("stackreadart")
                .semantics { contentDescription = "Open ${src.name}" }) { CardImage(src.name, Modifier.fillMaxSize(), crop = true) }
            Box(Modifier.fillMaxWidth().height(1.dp).background(tone.copy(alpha = .5f)))
            Text(StackRead.words(s), style = sans(sp(13f), FontWeight.Normal, Color(0xFFEEE6D4)).copy(lineHeight = sp(17.5f)),
                modifier = Modifier.heightIn(max = 132.du).verticalScroll(rememberScrollState()).anchorRect("stackreadwords"))
            val about = StackRead.about(s, st)
            if (about.isNotEmpty()) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x24FFFFFF)))
                for (a in about) Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(5.du)).clickable { StackRead.open = null; onInspect(a.card) }.anchorRect("stackreadabout${a.card.id}"),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.du)) {
                    Box(Modifier.size(44.du, 32.du).clip(RoundedCornerShape(4.du))) { CardImage(a.card.name, Modifier.fillMaxSize(), crop = true) }
                    Column(Modifier.weight(1f)) {
                        Text(a.card.name, style = sans(sp(12f), FontWeight.Bold, Color(0xFFF3E7C6)), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (a.where.isNotEmpty()) Text(a.where, style = sans(sp(11f), FontWeight.Normal, Color(0xFFD8C9A6)), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}
