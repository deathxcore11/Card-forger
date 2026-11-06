package dev.cardstashy.nativeplay.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject

/** home-today.js todayPackMarkup: the set's real booster pack, its pictures best first; one past the first is the generic wrapper. */
class TodayPackArt(val label: String, val sources: List<Pair<String, Boolean>>) {
    companion object {
        fun of(j: JsonObject?): TodayPackArt? = j?.let { o ->
            val src = o.getAsJsonArray("sources")?.mapNotNull { e -> e.takeIf { it.isJsonObject }?.asJsonObject?.let { s ->
                (s.get("src")?.asString.orEmpty()) to (s.get("generic")?.asBoolean == true) }?.takeIf { it.first.isNotBlank() } }.orEmpty()
            TodayPackArt(o.get("label")?.asString.orEmpty(), src)
        }
    }
}

/**
 * .today-pack: 64 wide (76 from 900), 400:734, 4 corners, leaning -6° with a drop shadow (0 12 16 #000c), the game's foil wrapper
 * gradient under the picture and a sheen sweeping across every 4.2 s; it comes in from -14° and 10 below over half a second.
 * A picture past the first (.pack-generic) sits inside crimp bands (9 % each end) with its art from 18 % down.
 * When none loads (.pack-art-unavailable) the empty wrapper stays, crimped, in the game's colours.
 */
@Composable
internal fun TodayPack(pack: TodayPackArt, game: CardGame, screen: Dp, onOpen: () -> Unit) {
    var i by remember(pack) { mutableIntStateOf(0) }
    val cur = pack.sources.getOrNull(i)
    val p = heroPainter(cur?.first?.let(homeArt))
    val st = (p as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
    LaunchedEffect(st, i) { if (st is coil3.compose.AsyncImagePainter.State.Error && i < pack.sources.size) i++ }
    val none = cur == null
    val generic = none || cur!!.second
    // .today-pack[data-game]: --today-pack-a / -b.
    val (a, b) = when (game) { CardGame.MTG -> Color(0xFF7A4A1C) to Color(0xFF1D120A); CardGame.PTCG -> Color(0xFF2C5EA8) to Color(0xFF0E1B33); else -> Color(0xFF5B2F86) to Color(0xFF170C26) }
    val still = Motion.still
    val enter = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(Unit) { if (!still) enter.animateTo(1f, tween(500, easing = CubicBezierEasing(.25f, .1f, .25f, 1f))) }
    val sheen = if (still) 1.3f else rememberInfiniteTransition(label = "sheen").animateFloat(1.3f, -.3f, infiniteRepeatable(tween(4200, easing = CubicBezierEasing(.42f, 0f, .58f, 1f)), RepeatMode.Restart), label = "x").value
    val shape = RoundedCornerShape(4.dp)
    Box(Modifier.width(if (screen >= 900.dp) 76.dp else 64.dp).aspectRatio(400f / 734f)
        .graphicsLayer { val e = enter.value; alpha = e; rotationZ = -14f + 8f * e; translationY = (1f - e) * 10.dp.toPx() }
        .drawBehind {
            // filter: drop-shadow(0 12px 16px #000c), the pack's own outline.
            val paint = android.graphics.Paint().apply { color = Color.Black.copy(alpha = .8f).toArgb(); setShadowLayer(16.dp.toPx() / 2f, 0f, 12.dp.toPx(), Color.Black.copy(alpha = .8f).toArgb()) }
            drawContext.canvas.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, 4.dp.toPx(), 4.dp.toPx(), paint)
        }
        .clip(shape).background(Color(0xFF2A2733))
        .clickable(onClick = onOpen).semantics { contentDescription = pack.label; role = Role.Button }
        .drawWithContent {
            drawContent()
            // .today-pack::after: linear-gradient(105deg, transparent 30%, #fff5 46%, transparent 62%) at 260 % width, sliding 130 % → -30 %.
            val w = size.width * 2.6f; val x0 = (size.width - w) * sheen
            val rad = Math.toRadians(105.0 - 90.0); val dx = (Math.cos(rad) * w).toFloat(); val dy = (Math.sin(rad) * w).toFloat()
            drawRect(Brush.linearGradient(.30f to Color.Transparent, .46f to Color.White.copy(alpha = .33f), .62f to Color.Transparent,
                start = Offset(x0, size.height / 2 - dy / 2), end = Offset(x0 + dx, size.height / 2 + dy / 2)))
        }) {
        // .today-pack-wrap: a light at 30 % 20 % over the game's foil gradient (160°).
        Box(Modifier.fillMaxSize().drawBehind {
            // 160°: from the top-left-ish down to the bottom-right-ish, the gradient line through the centre.
            val t = Math.toRadians(160.0 - 90.0); val half = (size.width * Math.abs(Math.cos(t)) + size.height * Math.abs(Math.sin(t))).toFloat() / 2f
            val d = Offset((Math.cos(t) * half).toFloat(), (Math.sin(t) * half).toFloat()); val c = Offset(size.width / 2, size.height / 2)
            drawRect(Brush.linearGradient(listOf(a, b), start = c - d, end = c + d))
            drawRect(Brush.radialGradient(listOf(Color.White.copy(alpha = .18f), Color.Transparent), center = Offset(size.width * .3f, size.height * .2f), radius = size.height * .7f))
        })
        if (p != null && !none && st !is coil3.compose.AsyncImagePainter.State.Error) {
            if (generic) Image(p, null, Modifier.fillMaxWidth().fillMaxHeight(.82f).align(Alignment.Center), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.64f))
            else Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        // .pack-crimp-band: 9 % tall, 2 px stripes #d9dce4 / #8d93a3, a dark hairline each side.
        if (generic) for (top in listOf(true, false)) Box(Modifier.fillMaxWidth().fillMaxHeight(.09f).align(if (top) Alignment.TopCenter else Alignment.BottomCenter).drawBehind {
            val s = 2.dp.toPx(); var x = 0f; var k = 0
            while (x < size.width) { drawRect(if (k % 2 == 0) Color(0xFFD9DCE4) else Color(0xFF8D93A3), Offset(x, 0f), Size(s, size.height)); x += s; k++ }
            drawRect(Color.Black.copy(alpha = .4f), Offset(0f, if (top) size.height - 1.dp.toPx() else 0f), Size(size.width, 1.dp.toPx()))
        })
    }
}
