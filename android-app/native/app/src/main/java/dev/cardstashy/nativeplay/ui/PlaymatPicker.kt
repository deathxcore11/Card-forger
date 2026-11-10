package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.material3.Text
import kotlin.math.roundToInt

/**
 * Practice's playmat drop-down, port of play-playmats.js playmatPickerMarkup (17-20) with the .pl-mat rules in play-menu.css
 * (532-558) and the .pl-format summary/sheet rules it reuses: the button shows the current mat; the sheet lays Random and
 * every mat out as a painted tile. Picking one is A.playPlaymat: store the choice, close the sheet.
 */
@Composable
fun PlaymatPicker(modifier: Modifier = Modifier, startOpen: Boolean = false) {
    val context = LocalContext.current
    val mats = remember { Playmats.list(context) }
    var choice by remember { mutableStateOf(Playmats.readChoice(context)) }
    var open by remember { mutableStateOf(startOpen) }
    val name = if (choice == Playmats.ROTATE) "Random" else mats.first { it.first == choice }.second
    val turn by animateFloatAsState(if (open) 180f else 0f, tween(200), label = "chevron")
    // .pl-format>summary + .pl-mat>summary: 44 px pill, 4 12 4 4 padding, the art, "Playmat" over the name, the chevron.
    Row(modifier.height(44.dp).clip(Pill).background(Site.Surface.copy(alpha = .8f)).border(1.dp, PillEdge, Pill)
        .clickable(onClickLabel = "Change playmat") { open = !open }
        .padding(start = 4.dp, end = 12.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        MatArt(choice, Modifier.size(46.dp, 32.dp).clip(ArtShape).border(1.dp, Color(0x66D6AD64), ArtShape))
        Column(Modifier.weight(1f)) {
            Text("PLAYMAT", style = sans(11f, FontWeight.Bold, Site.Muted, .12f * 11f, 11f * 1.1f), maxLines = 1)
            Text(name, style = sans(14f, FontWeight.Bold, Site.Text, 0f, 14f * 1.1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Chevron(Modifier.size(16.dp).rotate(turn))
    }
    if (open) Sheet(mats, choice, onClose = { open = false }) { id -> choice = Playmats.setChoice(context, id); open = false }
}

@Composable
private fun Sheet(mats: List<Pair<String, String>>, choice: String, onClose: () -> Unit, onPick: (String) -> Unit) {
    val conf = LocalConfiguration.current
    val screenW = conf.screenWidthDp.dp; val screenH = conf.screenHeightDp.dp
    // @media(max-height:520px) and (orientation:landscape): five across, 12 px labels; phones (max-width 700): two across.
    val short = screenH <= 520.dp && screenW > screenH
    val cols = if (short) 5 else if (screenW <= 700.dp) 2 else 3
    val gap = if (cols == 3) 10.dp else 8.dp
    // The one sheet (rulebook R5): the same tiles, titled, on the bottom edge on a phone.
    RuleSheet("Choose your playmat", onClose, maxWidth = 720.dp) {
        val all = listOf(Playmats.ROTATE to "Random") + mats
        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            all.chunked(cols).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    row.forEach { (id, label) -> Tile(id, label, id == choice, short, Modifier.weight(1f)) { onPick(id) } }
                    repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/** .pl-mat-opt: a 16:9 painted tile, darkened toward its label; the chosen one gets the gold ring, glow and dot. */
@Composable
private fun Tile(id: String, label: String, on: Boolean, short: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Box(modifier.aspectRatio(16f / 9f).heightIn(min = 44.dp)
        // [aria-pressed=true]: box-shadow 0 0 0 1px gold, a ring just outside the gold border.
        .drawBehind { if (on) drawRoundRect(Site.Gold, Offset(-1.dp.toPx(), -1.dp.toPx()), androidx.compose.ui.geometry.Size(size.width + 2.dp.toPx(), size.height + 2.dp.toPx()), androidx.compose.ui.geometry.CornerRadius(13.dp.toPx())) }
        .then(if (on) Modifier.shadow(22.dp, shape, ambientColor = Color(0x55D6AD64), spotColor = Color(0x55D6AD64)) else Modifier.shadow(18.dp, shape, ambientColor = Color(0x88000000), spotColor = Color(0x88000000)))
        .clip(shape).background(Color(0xFF111111)).clickable(onClick = onClick)) {
        MatArt(id, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.45f to Color.Transparent, 1f to Color(0xCC000000))))
        Row(Modifier.align(Alignment.BottomStart).padding(start = 10.dp, end = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (on) Box(Modifier.padding(end = 6.dp).size(8.dp).shadow(8.dp, CircleShape, ambientColor = Site.Gold, spotColor = Site.Gold).clip(CircleShape).background(Site.Gold))
            val size = if (short) 12f else 13f
            Text(label, style = sans(size, FontWeight.Bold, if (on) Site.Gold else Color.White, 0f, size * 1.15f).copy(shadow = Shadow(Color.Black, Offset(0f, 1f), 3f)))
        }
        Box(Modifier.fillMaxSize().border(1.dp, if (on) Site.Gold else Color(0x1FFFFFFF), shape))
    }
}

/** .pl-mat-art: the mat's thumb, background cover; Random shows four thumbs in quarters (Ashen Forge, Star Observatory, Forest Temple, Ravnica). */
@Composable
private fun MatArt(id: String, modifier: Modifier) {
    Box(modifier.background(Color(0xFF111111))) {
        if (id == Playmats.ROTATE) Column(Modifier.fillMaxSize()) {
            listOf(listOf("ashen-forge", "star-observatory"), listOf("forest-temple", "ravnica-guild-city")).forEach { pair ->
                Row(Modifier.weight(1f).fillMaxWidth()) { pair.forEach { AssetImage("play/playmat-$it-thumb.webp", Modifier.weight(1f).fillMaxHeight(), contentScale = ContentScale.FillBounds) } }
            }
        } else AssetImage("play/playmat-$id-thumb.webp", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
    }
}

/** .pl-format summary svg: path "m6 9 6 6 6-6", stroke 2, round caps, gold. */
@Composable
private fun Chevron(modifier: Modifier) {
    val path = remember { PathParser().parsePathString("m6 9 6 6 6-6").toPath() }
    Canvas(modifier) {
        val k = size.width / 24f
        scale(k, k, Offset.Zero) {
            drawPath(path, Site.Gold, style = Stroke(2f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

private val Pill = RoundedCornerShape(999.dp)
/** border-radius: 999px 8px 8px 999px on the 32 px art. */
private val ArtShape = RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp, topEnd = 8.dp, bottomEnd = 8.dp)
/** color-mix(in srgb, var(--gold) 35%, var(--line)), as the lobby's format pill. */
private val PillEdge = Color(0xFF6C5F45)
private fun sans(size: Float, weight: FontWeight, color: Color, spacing: Float = 0f, line: Float = size * 1.45f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = weight, fontSize = size.sp, color = color, letterSpacing = spacing.sp, lineHeight = line.sp)
