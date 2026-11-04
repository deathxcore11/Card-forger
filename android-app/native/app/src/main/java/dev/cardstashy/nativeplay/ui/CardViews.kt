package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.draw.drawBehind
import dev.cardstashy.nativeplay.art.CardImage
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Animatable
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.geometry.Offset
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.unit.IntSize
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.animation.core.LinearEasing
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.match.DemoDecks

/** forge-table.mjs roles: playable, choice (PICKABLE), chosen (PICKED), target, discard. */
enum class Mark { NONE, PLAYABLE, PICKABLE, PICKED, TARGET, DISCARD }

/** Where each card and life orb sits on screen (root coordinates), for the attack and block lines. */
class Anchors {
    /** Plain map: written during layout, read only in draw lambdas and effects, never in composition. */
    val map = HashMap<String, Offset>()
    /** Bumped when an anchor really moves (more than 0.5 px), so draw-time readers redraw. */
    val version = mutableIntStateOf(0)
    fun put(key: String, at: Offset) { val old = map[key]; if (old == null || (old - at).getDistance() > .5f) { map[key] = at; version.intValue++ } }
    /** Whole boxes in root space, for lines that stop at an edge and rings that go round a target. */
    val rects = HashMap<String, androidx.compose.ui.geometry.Rect>()
    fun putRect(key: String, r: androidx.compose.ui.geometry.Rect) {
        val old = rects[key]
        if (old == null || (old.center - r.center).getDistance() > .5f || kotlin.math.abs(old.width - r.width) > .5f) { rects[key] = r; put(key, r.center); version.intValue++ }
    }
}
val LocalAnchors = staticCompositionLocalOf<Anchors?> { null }

/** One card on the table: the printed card image, turned 20° when tapped (standing tap angle). */
@Composable
fun CardFace(
    card: Card, w: Dp, h: Dp, mark: Mark = Mark.NONE, modifier: Modifier = Modifier,
    count: Int = 1, onTap: (() -> Unit)? = null, onHold: (() -> Unit)? = null, nudge: Dp = 0.dp,
) {
    val decks = DemoDecks.load(LocalContext.current)
    val shape = RoundedCornerShape(w * .06f)
    val turn by animateFloatAsState(if (card.tapped) 20f else 0f, tween(140, easing = androidx.compose.animation.core.FastOutSlowInEasing), label = "tap")
    val lift by animateFloatAsState(nudge.value, tween(150, easing = FastOutSlowInEasing), label = "nudge")
    // Damage: Randall's impact burst (piece 02, 8 frames in 333 ms) centred on the card; without it, a
    // white hit flash, 40 % to nothing in 90 ms. Both start on the frame the damage lands.
    val context = LocalContext.current
    val flash = remember { Animatable(0f) }
    val burstAt = remember { Animatable(1f) } // 0..1 through the burst; 1 = not playing
    val burst by produceState<List<ImageBitmap>?>(null) { value = Effects.burst(context) }
    var lastDamage by remember { mutableStateOf(card.damage) }
    LaunchedEffect(card.damage) {
        if (card.damage > lastDamage) {
            if (burst != null) { burstAt.snapTo(0f); burstAt.animateTo(1f, tween(Effects.BURST_MS, easing = LinearEasing)) }
            else { flash.snapTo(.4f); flash.animateTo(0f, tween(90)) }
        }
        lastDamage = card.damage
    }
    val anchors = LocalAnchors.current
    val pulse = if (mark == Mark.PICKABLE) rememberInfiniteTransition(label = "pick").animateFloat(.55f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "a").value else 1f
    val edge = when {
        mark == Mark.PICKED -> Palette.GoldBright
        mark == Mark.PICKABLE -> Palette.GoldBright.copy(alpha = pulse)
        card.attacking -> Palette.Red
        card.blocking -> Color(0xFF6FA8DC)
        mark == Mark.PLAYABLE -> Color(0xFF8FDCFF) // site: border #8fdcff, 0 0 18px 2px #5cc8ffa6
        mark == Mark.TARGET -> Color(0xFFFF9D5C) // --ob-target, 0 0 18px 2px #ff9d5ca6
        mark == Mark.DISCARD -> Color(0xFFFF7A6B) // 0 0 18px 2px #ff6a5aa6
        else -> Color(0x99000000)
    }
    val edgeW = if (mark != Mark.NONE || card.attacking || card.blocking) 2.dp else 1.dp
    val glowColor = when (mark) { Mark.PLAYABLE -> Color(0xA65CC8FF); Mark.TARGET -> Color(0xA6FF9D5C); Mark.DISCARD -> Color(0xA6FF6A5A); else -> null }
    val glow = if (glowColor != null && card.zone == "Hand") Modifier.drawBehind {
        val spread = 2.dp.toPx(); val r = 6.dp.toPx()
        drawIntoCanvas { c ->
            val p = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; color = glowColor!!.toArgb(); maskFilter = android.graphics.BlurMaskFilter(9.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
            c.nativeCanvas.drawRoundRect(-spread, -spread, size.width + spread, size.height + spread, r, r, p)
        }
    } else Modifier
    Box(modifier.size(w, h).then(glow).then(if (anchors != null && card.zone == "Battlefield") Modifier.onGloballyPositioned { anchors.put("c${card.id}", it.boundsInRoot().center) } else Modifier).graphicsLayer { rotationZ = turn; translationY = lift * density }
        .then(if (onTap == null && onHold == null) Modifier else Modifier.pointerInput(card.id, onTap, onHold) { detectTapGestures(onTap = { onTap?.invoke() }, onLongPress = { onHold?.invoke() }) })) {
        Box(Modifier.fillMaxSize().clip(shape).background(Color(0xFF15151A))) {
            if (card.hidden) CardBack(Modifier.fillMaxSize())
            else CardImage(card.name, Modifier.fillMaxSize()) { TokenFace(card) }
            if (mark == Mark.PICKED) Box(Modifier.fillMaxSize().background(Palette.GoldBright.copy(alpha = .22f)))
            if (flash.value > 0f) Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = flash.value)))
        }
        Box(Modifier.fillMaxSize().border(edgeW, edge, shape))
        if (card.damage > 0) Badge("-${card.damage}", Palette.Red, Modifier.align(Alignment.TopEnd).offset(4.dp, (-4).dp))
        val plus = card.counters["P1P1"] ?: card.counters["+1/+1"] ?: 0
        if (card.isCreature && (card.damage > 0 || card.counters.isNotEmpty()) && card.power != null)
            Badge("${card.power}/${(card.toughness ?: 0) - card.damage}", Color(0xEE1B1B1F), Modifier.align(Alignment.BottomEnd).offset(3.dp, 3.dp))
        else if (plus > 0) Badge("+$plus", Color(0xEE2F6B3A), Modifier.align(Alignment.BottomEnd).offset(3.dp, 3.dp))
        if (count > 1) Badge("×$count", Color(0xEE1B1B1F), Modifier.align(Alignment.TopStart).offset((-3).dp, (-3).dp))
        burst?.let { frames ->
            // Read in draw only, so a burst redraws one layer and never recomposes the card.
            Canvas(Modifier.align(Alignment.Center).requiredSize(w * 1.6f)) {
                val t = burstAt.value
                if (t >= 1f) return@Canvas
                val f = frames[(t * frames.size).toInt().coerceIn(0, frames.size - 1)]
                drawImage(f, dstSize = IntSize(size.width.toInt(), size.height.toInt()))
            }
        }
    }
}

@Composable
private fun Badge(text: String, color: Color, modifier: Modifier) {
    Box(modifier.clip(RoundedCornerShape(8.dp)).background(color).border(1.dp, Palette.Hairline, RoundedCornerShape(8.dp)).padding(horizontal = 4.dp, vertical = 1.dp)) {
        Text(text, style = Type.Label.copy(fontSize = 11.sp, color = Color.White))
    }
}

@Composable
private fun TokenFace(card: Card) {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF3A3326), Color(0xFF15151A)))), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(card.name, style = Type.Label.copy(fontSize = 11.sp), textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Clip)
            if (card.power != null && card.isCreature) Text("${card.power}/${card.toughness}", style = Type.Label.copy(color = Palette.Gold))
        }
    }
}

/** The card back of the web table (.play-match-card-back): navy, gold ring and hairline. */
@Composable
fun CardBack(modifier: Modifier) {
    // Randall's painted back (art piece 10) when the app carries it; the code-drawn back otherwise.
    Box(modifier.background(Brush.linearGradient(listOf(Color(0xFF22346A), Color(0xFF101A38), Color(0xFF22113D)))).border(1.5.dp, Color(0xFFC9A75A), RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFFF1D891), Color(0xFF9A7A35)))))
        AssetImage("play/card-back.webp", Modifier.fillMaxSize(), maxWidth = 372)
    }
}

/**
 * A row of cards that never wraps and never scales: cards keep their size and overlap more
 * when the row is full (no shared scale factor, the fitBoard bug the spec names).
 */
@Composable
fun CardRow(cardWidth: Dp, gap: Dp, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Layout(content, modifier) { measurables, constraints ->
        val loose = Constraints(maxWidth = constraints.maxWidth, maxHeight = constraints.maxHeight)
        val placeables = measurables.map { it.measure(loose) }
        val cw = cardWidth.roundToPx(); val g = gap.roundToPx()
        val n = placeables.size
        val natural = if (n == 0) 0 else n * cw + (n - 1) * g
        val step = if (n <= 1) 0 else if (natural <= constraints.maxWidth) cw + g else ((constraints.maxWidth - cw) / (n - 1)).coerceAtLeast(cw / 4)
        val used = if (n == 0) 0 else cw + step * (n - 1)
        val height = placeables.maxOfOrNull { it.height } ?: 0
        layout(constraints.maxWidth, height.coerceAtMost(constraints.maxHeight)) {
            val start = ((constraints.maxWidth - used) / 2).coerceAtLeast(0)
            placeables.forEachIndexed { i, p -> p.place(start + i * step, (height - p.height) / 2) }
        }
    }
}
