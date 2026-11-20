package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector2D
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import dev.cardstashy.nativeplay.art.CardImage
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Scry 1 with the card on screen (specs/scry-view-brief.md L1, approved 11 Nov; gaps list 1, 15 Nov: "Bottom" and "Top" with no card,
 * he sat 10 s on it). Forge asks a one-card scry as a plain InputConfirm with no prompt: "Put <card> on the top or bottom of your
 * library?" with Top as its OK and Bottom as its cancel (PlayerControllerHuman.willPutCardOnTop). The card is named only in that line.
 */
object ScryOne {
    private val ASK = Regex("^Put (.+) on the top or bottom of your library\\?$")

    /**
     * Explains itself E4: Forge's one-card surveil, seen in an engine run on 11 Nov (builder/surveil-prompt-brief.md): the same plain
     * InputConfirm, "Put <card> on the top of library or graveyard?", Library as its OK and Graveyard as its cancel. It showed two
     * buttons and no card.
     */
    private val ASK_SURVEIL = Regex("^Put (.+) on the top of (?:your )?library or (?:your )?graveyard\\?$")

    /** Which question this is, or null when it is neither a one-card scry nor a one-card surveil. */
    fun kind(st: MatchState): ScryKind? {
        val input = st.inputType ?: return null
        if (st.prompt != null || !input.startsWith("InputConfirm") || input == "InputConfirmMulligan") return null
        return when {
            st.buttons.ok.equals("Top", true) && st.buttons.cancel.equals("Bottom", true) -> ScryKind.SCRY
            st.buttons.ok.equals("Library", true) && st.buttons.cancel.equals("Graveyard", true) -> ScryKind.SURVEIL
            else -> null
        }
    }

    /** The card a one-card scry or surveil is about, or null when this is not that question. */
    fun of(st: MatchState): String? {
        val ask = when (kind(st)) { ScryKind.SCRY -> ASK; ScryKind.SURVEIL -> ASK_SURVEIL; null -> return null }
        return st.message.lines().map { it.trim() }.firstNotNullOfOrNull { ask.find(it)?.groupValues?.get(1) }
    }

    /** The zone the card leaves the top for: the bottom of your deck (scry) or your graveyard (surveil). */
    fun awayWord(kind: ScryKind) = if (kind == ScryKind.SURVEIL) "Graveyard" else "Bottom"
    /** The line under the title. */
    fun subtitle(kind: ScryKind) = if (kind == ScryKind.SURVEIL) "Top of your deck or your graveyard" else "Top or bottom of your deck"

    /** What asked: your own spell or trigger on top of the stack (the Sorcerer Role's attack trigger), when the table knows it. */
    fun trigger(st: MatchState): StackItem? = st.stack.firstOrNull()?.takeIf { it.controller == st.viewer }

    /** The name of what asked ([trigger]'s source), or null. */
    fun from(st: MatchState): String? = trigger(st)?.source?.name

    /** Where the card sits: the middle (not placed yet), the Bottom zone or the Top zone. Done in the middle keeps it on top. */
    const val MIDDLE = 0; const val BOTTOM = -1; const val TOP = 1
    /** What Done answers for a [place]: true = Top (Forge's OK). Done alone keeps the card on top, as the brief's row does. */
    fun keepsOnTop(place: Int) = place != BOTTOM
    /** The bubble Done leaves on the table ("Scry: 0 top, 1 bottom"). */
    fun result(place: Int, kind: ScryKind = ScryKind.SCRY) = if (keepsOnTop(place)) ScryArrange.resultFor(kind, 1, 0) else ScryArrange.resultFor(kind, 0, 1)
}

private val ScryGold = Color(0xFFE8B95B)
private val ScryIce = Color(0xFF5CC8FF)
private val ScryCream = Color(0xFFEEE6D4)
private val ScryDim = Color(0xFF9AA2B1)

/**
 * The one-card scry over the dimmed table (Better table scene 1): "Scry 1" and "Top or bottom of your deck" at the top, the Bottom
 * zone left and the Top zone right, the card face up over your deck's back in the middle with the playable ice ring, your trigger at
 * the right, "View table" (held) top right and a gold Done. Drag the card onto a zone or tap a zone (review: a tap on the card itself
 * moves nothing, so looking again never flips the choice); Done answers Forge: Top is its OK ([onTop]), Bottom its cancel ([onBottom]). A controller: LB / RB pick Bottom or Top, X
 * is Done, Y held shows the table. Anchors: scrycard, scryzone:Bottom, scryzone:Top, scrydone, scrytrigger, peektable.
 */
@Composable
internal fun ScryOneView(st: MatchState, name: String, live: Boolean, d: Du, onTop: () -> Unit, onBottom: () -> Unit) = with(d) {
    // Explains itself E4: a one-card surveil is the same view with its own words (the Graveyard zone on the left).
    val kind = remember(name) { ScryOne.kind(st) ?: ScryKind.SCRY }
    val away = ScryOne.awayWord(kind)
    var place by remember(name) { mutableIntStateOf(ScryOne.MIDDLE) }
    var answered by remember(name) { mutableStateOf(false) }
    val peek = rememberTablePeek()
    // The table's controls the view hides (ForgeBoard's scryCover) come back while the table is peeked at.
    LaunchedEffect(peek.held) { TableCover.peek = peek.held }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { TableCover.peek = false } }
    val done = { if (live && !answered) { answered = true; if (ScryOne.keepsOnTop(place)) onTop() else onBottom() } }
    PadScreen(PadActs(x = if (live) PadAct("Done") { done() } else null, yHold = { peek.held = it },
        tabs = { dir -> place = if (dir < 0) ScryOne.BOTTOM else ScryOne.TOP }, tabsLabel = "$away / Top"))
    val reduced = Motion.still || LocalContext.current.applicationContext.let { c -> remember { Playmats.reduced(c) } }
    // The view comes in: the dimmer settles, the card rises off the deck and opens (420 ms, brief L6), the zones follow.
    val enter = remember(name) { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(name) { if (!reduced) enter.animateTo(1f, tween(420, easing = FastOutSlowInEasing)) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val W = maxWidth; val H = maxHeight
        // The card: about 44 % of the height (the preview's 27 % of the Fold's width), never wider than 27 % of the screen.
        val cardH = minOf(H * .44f, W * .27f * 680f / 488f)
        val cardW = cardH * 488f / 680f
        val zoneW = cardW * .9f; val zoneH = cardH * (if (H >= 600.dp) 1.14f else 1.22f)
        val zoneDx = maxOf(cardW / 2 + zoneW / 2 + 28.du, W * .29f)
        val cy = H * (if (H >= 600.dp) .05f else .03f)   // the card's centre sits a little below the middle, under the title
        val inZone = (zoneW * .86f) / cardW
        val labelH = 30.du
        val density = LocalDensity.current
        val dxPx = with(density) { zoneDx.toPx() }; val lift = with(density) { (labelH / 2).toPx() }
        fun target(p: Int) = Offset(p * dxPx, if (p == ScryOne.MIDDLE) 0f else -lift)
        val pos = remember(name) { Animatable(Offset.Zero, Offset.VectorConverter) }
        var dragging by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        // A weighty settle into the zone (the Match Punch feel): a soft spring, snapped under Motion.still and reduced motion.
        LaunchedEffect(place, dxPx) { if (!dragging) { if (reduced) pos.snapTo(target(place)) else pos.animateTo(target(place), spring(dampingRatio = .74f, stiffness = 300f)) } }
        val hover = if (dragging) (if (pos.value.x < -dxPx * .35f) ScryOne.BOTTOM else if (pos.value.x > dxPx * .35f) ScryOne.TOP else ScryOne.MIDDLE) else place

        // Everything but the pill hides while "View table" is held.
        Box(Modifier.fillMaxSize().peekHides(peek)) {
            Box(Modifier.fillMaxSize().graphicsLayer { alpha = enter.value.coerceIn(0f, 1f) }.background(TableDimmer).pointerInput(Unit) { detectTapGestures { } })
            // Title block.
            Column(Modifier.align(Alignment.TopCenter).padding(top = H * .04f).graphicsLayer { alpha = enter.value }, horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${kind.word} 1", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(28f), letterSpacing = .1.em,
                    brush = Brush.verticalGradient(listOf(Color(0xFFFFF0C8), Color(0xFFE8B95B), Color(0xFFB98D3A))), shadow = Shadow(Color(0x99000000), Offset(0f, 3f), 10f)), maxLines = 1)
                Box(Modifier.padding(top = 3.du).width(150.du).height(1.dp).background(Brush.horizontalGradient(listOf(Color.Transparent, ScryGold.copy(alpha = .7f), Color.Transparent))))
                Text(ScryOne.subtitle(kind), style = sans(sp(13f), FontWeight.SemiBold, ScryDim), maxLines = 1, modifier = Modifier.padding(top = 4.du))
            }
            // The two zones.
            for (side in listOf(ScryOne.BOTTOM, ScryOne.TOP)) {
                val word = if (side == ScryOne.BOTTOM) away else "Top"
                val lit by animateFloatAsState(if (hover == side) 1f else 0f, if (reduced) snap() else tween(180), label = "zone")
                Box(Modifier.align(Alignment.Center).offset(x = zoneDx * side, y = cy).size(zoneW, zoneH)
                    .graphicsLayer { alpha = enter.value; val s = .96f + .04f * enter.value; scaleX = s; scaleY = s }
                    .anchorRect("scryzone:$word")
                    .semantics { contentDescription = word; role = Role.Button; stateDescription = if (place == side) "Chosen" else ""; onClick { if (live) place = side; true } }
                    .pointerInput(live) { detectTapGestures { if (live) place = side } }
                    .drawBehind {
                        val r = CornerRadius(16.du.toPx())
                        drawRoundRect(Brush.verticalGradient(listOf(ScryGold.copy(alpha = .03f + .11f * lit), Color(0x14000000))), cornerRadius = r)
                        if (lit > 0f) drawRoundRect(ScryGold.copy(alpha = .16f * lit), topLeft = Offset(-5.du.toPx(), -5.du.toPx()),
                            size = Size(size.width + 10.du.toPx(), size.height + 10.du.toPx()), cornerRadius = CornerRadius(20.du.toPx()), style = Stroke(6.du.toPx()))
                        val w = (1.6f + .6f * lit).dp.toPx()
                        drawRoundRect(ScryGold.copy(alpha = .55f + .4f * lit), cornerRadius = r,
                            style = Stroke(w, pathEffect = if (lit > .5f) null else PathEffect.dashPathEffect(floatArrayOf(7.du.toPx(), 5.du.toPx()))))
                    }, contentAlignment = Alignment.BottomCenter) {
                    // "GRAVEYARD" is longer than "BOTTOM": a surveil sets both zone words a little tighter, so it never cuts and the two match.
                    Text(word.uppercase(), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = sp(if (away.length > 6) 13f else 15f), letterSpacing = if (away.length > 6) .08.em else .2.em,
                        color = ScryGold.copy(alpha = .8f + .2f * lit)), maxLines = 1, modifier = Modifier.height(labelH).padding(top = 4.du))
                }
            }
            // Your deck under the card: its back, a few degrees off, with a deep shadow.
            Box(Modifier.align(Alignment.Center).offset(x = -cardW * .05f, y = cy + cardH * .05f).size(cardW * .94f, cardH)
                .graphicsLayer { rotationZ = -5f; alpha = enter.value }
                .drawBehind { drawRoundRect(Color(0x99000000), topLeft = Offset(0f, 10.du.toPx()), size = size, cornerRadius = CornerRadius(10.du.toPx())) }
                .clip(RoundedCornerShape(9.du))) { CardBack(Modifier.fillMaxSize()) }
            // The card, face up, with the ice ring: drag it to a zone (a tap on it changes nothing).
            val p = pos.value
            val k = (abs(p.x) / dxPx).coerceIn(0f, 1f)
            Box(Modifier.align(Alignment.Center).offset(y = cy).offset { IntOffset(p.x.roundToInt(), p.y.roundToInt()) }.size(cardW, cardH)
                .graphicsLayer {
                    val e = enter.value; val s = (1f + (inZone - 1f) * k) * (.86f + .14f * e) * (if (dragging) 1.03f else 1f)
                    scaleX = s; scaleY = s; alpha = e; translationY = (1f - e) * 40.du.toPx()
                    rotationZ = if (dragging) (p.x / dxPx * 4f).coerceIn(-5f, 5f) else 0f
                }
                .anchorRect("scrycard")
                .semantics { contentDescription = "$name, the top card of your library" }
                .pointerInput(live, dxPx) {
                    if (!live) return@pointerInput
                    detectDragGestures(onDragStart = { dragging = true },
                        onDragEnd = { val x = pos.value.x; dragging = false
                            val to = if (x < -dxPx * .35f) ScryOne.BOTTOM else if (x > dxPx * .35f) ScryOne.TOP else if (abs(x) < dxPx * .2f) ScryOne.MIDDLE else place
                            if (to == place) scope.launch { if (reduced) pos.snapTo(target(place)) else pos.animateTo(target(place), spring(dampingRatio = .74f, stiffness = 300f)) }
                            place = to },
                        onDragCancel = { dragging = false; scope.launch { pos.snapTo(target(place)) } }) { change, amount -> change.consume(); scope.launch { pos.snapTo(pos.value + amount) } }
                }
                .drawBehind {
                    val r = 11.du.toPx()
                    drawRoundRect(Color(0xAA000000), topLeft = Offset(0f, 16.du.toPx()), size = size, cornerRadius = CornerRadius(r))
                    // The ice glow: three soft rings outward, then the ring itself.
                    for (i in 3 downTo 1) { val g = i * 5.du.toPx()
                        drawRoundRect(ScryIce.copy(alpha = .10f + (if (dragging) .04f else 0f)), topLeft = Offset(-g, -g), size = Size(size.width + 2 * g, size.height + 2 * g), cornerRadius = CornerRadius(r + g)) }
                    val ring = 2.5f.dp.toPx()
                    drawRoundRect(ScryIce, topLeft = Offset(-ring, -ring), size = Size(size.width + 2 * ring, size.height + 2 * ring), cornerRadius = CornerRadius(r + ring))
                }
                .clip(RoundedCornerShape(10.du))) {
                CardImage(name, Modifier.fillMaxSize())
            }
        }
        // Your trigger at the right, under the pill: the stack's own card, scaled, with its kind under it.
        ScryOne.trigger(st)?.let { s ->
            val trigH = minOf(maxOf(cardH * .44f, 120.dp), H * .34f)
            val trigW = trigH * 104f / 145f
            val scale = trigH.value / 145.du.value
            Column(Modifier.align(Alignment.TopEnd).padding(top = H * .03f + 36.du + 14.du, end = W * .02f).peekHides(peek).graphicsLayer { alpha = enter.value }.anchorRect("scrytrigger"),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(trigW, trigH), contentAlignment = Alignment.Center) {
                    StackCard(st, s, 1, Modifier.requiredSize(104.du, 145.du).graphicsLayer { scaleX = scale; scaleY = scale }, d, onInspect = {})
                }
                Text("Your ${if (s.trigger) "trigger" else if (s.ability) "ability" else "spell"}".uppercase(), maxLines = 1, modifier = Modifier.padding(top = 7.du),
                    style = sans(sp(11f), FontWeight.Bold, ScryGold).copy(letterSpacing = .14.em))
            }
        }
        PeekTablePill(peek, d, Modifier.align(Alignment.TopEnd).padding(top = H * .03f, end = W * .02f))
        Box(Modifier.align(Alignment.BottomEnd).padding(end = W * .02f, bottom = H * .04f).peekHides(peek).anchorRect("scrydone")) {
            GoldPill("Done", live && !answered, Modifier, d, padKey = live, height = 44.du, onClick = done)
        }
    }
}
