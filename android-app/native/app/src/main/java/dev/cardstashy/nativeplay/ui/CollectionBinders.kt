package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.LinearGradientShader
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Collection › Binders for one game, from the site's own code through the engine: the shelf (binders.js binderShelf, under the Cards
 * tab's head), an open binder (app.js showBinder → binders.js binderPage: nine pockets a page, the page turned by a swipe, its edges,
 * Back and Next; a ★ puts a card on the clear cover) and the editor (app.js binderEditor: New binder / Binder settings, cover colour,
 * a background link or an uploaded photo, Save and Delete). Drawn to style.css as the live page computes it (Binders 3.9.3: clear
 * acrylic covers and page sheets that turn around the rings), measured in Chrome.
 */

private fun JsonObject.s(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""
private fun JsonObject.b(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
private fun JsonObject.i(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
private fun JsonObject.o(k: String) = get(k)?.takeIf { it.isJsonObject }?.asJsonObject
private fun JsonObject.objs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf(JsonElement::isJsonObject)?.asJsonObject }.orEmpty()
private fun JsonObject.strs(k: String) = get(k)?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
private fun JsonObject.has2(k: String) = get(k)?.isJsonArray == true

// style.css tokens (dark) as the live page computes them.
private val BInk = Color(0xFFEEF0F4)
private val BMute = Color(0xFF9AA2B1)
private val BFaint = Color(0xFF8B93A3)
private val BLine = Color(0xFF2A2F39)
/** --gold and a .btn's ink on it: the open game's accent (body[data-game]). */
private val BGold: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalGameGold.current
private val BGoldInk: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalSheetPal.current.ink
private val BBad = Color(0xFFF08A7E)
private val BStar = Color(0xFFFFD76A)

private fun bt(size: Float, weight: Int = 400, color: Color = BInk, lh: Float = 1.45f, ls: Float = 0f) = cssType(size, weight, size * lh, color, ls)
/** h2: Manrope 19 / 800, -0.02em. */
private val H2 = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.ExtraBold, fontSize = 19.sp, lineHeight = 21.85.sp, letterSpacing = (-.38).sp, color = BInk, lineHeightStyle = CSS_LINE)

/** color-mix(in srgb, [a] [pa], [b] [pb]): the two mixed in proportion, the alpha scaled when the shares come short of 100 %. */
private fun mix(a: Color, pa: Float, b: Color, pb: Float): Color {
    val t = pa + pb; val wa = pa / t; val wb = pb / t
    val alpha = (a.alpha * wa + b.alpha * wb)
    if (alpha == 0f) return Color.Transparent
    fun ch(x: Float, y: Float) = (x * a.alpha * wa + y * b.alpha * wb) / alpha
    return Color(ch(a.red, b.red), ch(a.green, b.green), ch(a.blue, b.blue), alpha * min(1f, t))
}

/** linear-gradient(<deg>, stops) over whatever box it paints: the line through the centre, long enough to reach the corners. */
private fun cssLinear(deg: Float, vararg stops: Pair<Float, Color>) = object : ShaderBrush() {
    override fun createShader(size: Size): Shader {
        val a = Math.toRadians(deg.toDouble()); val dir = Offset(sin(a).toFloat(), -cos(a).toFloat())
        val half = (abs(size.width * dir.x) + abs(size.height * dir.y)) / 2f
        val c = Offset(size.width / 2, size.height / 2)
        return LinearGradientShader(c - dir * half, c + dir * half, stops.map { it.second }, stops.map { it.first }, TileMode.Clamp)
    }
}

/** A rounded rect's outline as a framework path, each corner its own radius (left, then right). */
private fun roundPath(l: Float, t: Float, r: Float, b: Float, left: Float, right: Float) = android.graphics.Path().apply {
    addRoundRect(l, t, r, b, floatArrayOf(left, left, right, right, right, right, left, left), android.graphics.Path.Direction.CW)
}

/** box-shadow (outer): the shape [path] moved by [dx] / [dy], blurred by [blur]. */
private fun DrawScope.outerShadow(path: android.graphics.Path, color: Color, dx: Float, dy: Float, blur: Float) = drawIntoCanvas { c ->
    val p = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply {
        isAntiAlias = true; this.color = color.toArgb(); if (blur > 0f) maskFilter = android.graphics.BlurMaskFilter(blur / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
    }
    c.nativeCanvas.save(); c.nativeCanvas.translate(dx, dy); c.nativeCanvas.drawPath(path, p); c.nativeCanvas.restore()
}

/** box-shadow: inset 0 0 [blur] [color] inside [path]: the dark outside of the shape, blurred in over its edge. */
private fun DrawScope.insetGlow(path: android.graphics.Path, color: Color, blur: Float) = drawIntoCanvas { c ->
    val ring = android.graphics.Path().apply { fillType = android.graphics.Path.FillType.EVEN_ODD; addRect(-blur * 3, -blur * 3, size.width + blur * 3, size.height + blur * 3, android.graphics.Path.Direction.CW); addPath(path) }
    val p = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply {
        isAntiAlias = true; this.color = color.toArgb(); maskFilter = android.graphics.BlurMaskFilter(blur / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
    }
    c.nativeCanvas.save(); c.nativeCanvas.clipPath(path); c.nativeCanvas.drawPath(ring, p); c.nativeCanvas.restore()
}

/** A cover's own picture: an uploaded photo (a data: URL, decoded here) or its HTTPS link. */
@Composable
private fun coverArt(url: String): Any? {
    if (!url.startsWith("data:")) return url.ifBlank { null }
    return remember(url) {
        runCatching {
            val bytes = android.util.Base64.decode(url.substringAfter(","), android.util.Base64.DEFAULT)
            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
        }.getOrNull()
    }
}

// ---------------------------------------------------------------- the shelf

/** What the shelf's taps do: ＋ New binder (A.newBinder), a binder (A.openBinder), a held binder (app.js tileMenu). */
class BinderShelfActions(val add: () -> Unit = {}, val open: (String) -> Unit = {}, val hold: (String) -> Unit = {})

/** binders.js binderShelf as lazy items under the Cards tab's head ([gutter] its side margins): the head, its line, then the covers or the empty state. */
fun LazyListScope.binderShelfItems(m: JsonObject?, a: BinderShelfActions, gutter: Dp) {
    if (m == null) return
    item(key = "b:head") { ShelfHead(m, a, gutter) }
    val empty = m.o("empty")
    if (empty != null) item(key = "b:empty") { ShelfEmpty(empty, a, gutter) }
    else item(key = "b:shelf") { Shelf(m.objs("binders"), m.s("game"), a, gutter) }
}

/** .binder-shelf > .row.between (the eyebrow and h2; ＋ New binder, btn small) and p.muted.small (6 above and below). */
@Composable
private fun ShelfHead(m: JsonObject, a: BinderShelfActions, gutter: Dp) {
    Column(Modifier.fillMaxWidth().padding(horizontal = gutter)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(m.s("eyebrow"), Modifier.padding(bottom = 4.dp), style = bt(11f, 700, BMute, 1.45f, 1.32f), maxLines = 1)
                Text(m.s("title"), style = H2)
            }
            m.o("add")?.let { add -> SmallButton(add.s("label"), CollectionCardsModel.svg(add.o("icon")), gold = true, onClick = a.add) }
        }
        Text(m.s("line"), Modifier.padding(vertical = 6.dp), style = bt(13f, 400, BMute))
    }
}

/** .binder-empty-state: a dashed box (28 / 20 in, 16 corners, 20 above), its h3, the line (at most 340 wide) and the ghost button. */
@Composable
private fun ShelfEmpty(e: JsonObject, a: BinderShelfActions, gutter: Dp) {
    Column(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(top = 20.dp, bottom = 12.dp)
        .drawBehind {
            val px = 1.dp.toPx(); val r = 16.dp.toPx()
            drawRoundRect(BLine, Offset(px / 2, px / 2), Size(size.width - px, size.height - px), CornerRadius(r),
                style = Stroke(px, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(3 * px, 3 * px))))
        }.padding(horizontal = 20.dp, vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(e.s("title"), Modifier.padding(bottom = 8.dp), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 15.sp, lineHeight = 17.25.sp,
            letterSpacing = (-.3).sp, color = BInk, lineHeightStyle = CSS_LINE), textAlign = TextAlign.Center)
        Text(e.s("text"), Modifier.widthIn(max = 340.dp).padding(bottom = 18.dp), style = bt(13f, 400, BMute), textAlign = TextAlign.Center)
        SiteGhost(e.s("button"), fs = 15f, pad = 16.dp, onClick = a.add)
    }
}

/** .stash-shelf: auto-fill columns at least 180 wide, 20 apart (two, 12 apart, up to 540 wide), 18 above and below. */
@Composable
private fun Shelf(list: List<JsonObject>, game: String, a: BinderShelfActions, gutter: Dp) {
    val narrow = LocalConfiguration.current.screenWidthDp <= 540
    BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = gutter).padding(vertical = 18.dp)) {
        val gap = if (narrow) 12.dp else 20.dp
        val cols = if (narrow) 2 else max(1, ((maxWidth + gap) / (180.dp + gap)).toInt())
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap)) {
            list.chunked(cols).forEach { row ->
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(gap)) {
                    row.forEach { b -> BinderTile(b, game, narrow, a, Modifier.weight(1f).fillMaxHeight()) }
                    repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/** button.stash-binder: the book, then its label (14 below at least), centred, 12 / 10 in; pressed, the book straightens and settles. Held: tileMenu. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BinderTile(b: JsonObject, game: String, narrow: Boolean, a: BinderShelfActions, modifier: Modifier) {
    val id = b.s("id")
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    Column(modifier.clip(RoundedCornerShape(10.dp))
        .combinedClickable(press, LocalIndication.current, onLongClickLabel = "Binder actions", onLongClick = { a.hold(id) }, onClick = { a.open(id) })
        .testTag("binder:$id")
        .padding(horizontal = 10.dp, vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        BinderBook(b, game, narrow, pressed)
        Spacer(Modifier.heightIn(min = 14.dp).weight(1f))
        // .stash-binder-label: the name (14 / 650), what it holds (12, muted), Open binder (11, muted), 5 apart.
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(b.s("title"), style = bt(14f, 650), textAlign = TextAlign.Center)
            if (b.s("subtitle").isNotEmpty()) Text(b.s("subtitle"), style = bt(12f, 400, BMute), textAlign = TextAlign.Center)
            if (b.s("hint").isNotEmpty()) Text(b.s("hint"), style = bt(11f, 400, BMute), textAlign = TextAlign.Center)
        }
    }
}

/**
 * .stash-book (156 × 214, 132 × 182 up to 540 wide; rotateY(-6deg), drop-shadow 4 10 12 #0006): the page block behind (4 in, 4 past the
 * right edge, its edge lines), and the clear cover over it: tinted acrylic (the pages seen through it, softened by its 1.5 px blur), the
 * custom picture, the window of starred cards, the spine, the sheen and the name in its pill.
 */
@Composable
private fun BinderBook(b: JsonObject, game: String, narrow: Boolean, pressed: Boolean) {
    val w = if (narrow) 132.dp else 156.dp; val h = if (narrow) 182.dp else 214.dp
    val tint = cssColor(b.s("color"), BGold) ?: when (game) { "ptcg" -> Color(0xFF176B69); "ygo" -> Color(0xFF634198); else -> Color(0xFF805B24) }
    // .stash-binder:active .stash-book { transform: rotateY(0) scale(.97) }, .45 s cubic-bezier(.2, .8, .2, 1).
    val ease = CubicBezierEasing(.2f, .8f, .2f, 1f)
    val turn by animateFloatAsState(if (pressed) 0f else -6f, tween(if (Motion.still) 0 else 450, easing = ease), label = "book")
    val k by animateFloatAsState(if (pressed) .97f else 1f, tween(if (Motion.still) 0 else 450, easing = ease), label = "bookScale")
    val coverPad = if (narrow) arrayOf(16.dp, 8.dp, 7.dp, 7.dp) else arrayOf(19.dp, 10.dp, 9.dp, 8.dp)
    Box(Modifier.size(w, h).clearAndSetSemantics { }
        .graphicsLayer { rotationY = turn; scaleX = k; scaleY = k; cameraDistance = 1100.dp.toPx() }
        .drawBehind {
            val u = 1.dp.toPx()
            // filter: drop-shadow(4px 10px 12px #0006) around the cover and the pages behind it.
            outerShadow(roundPath(0f, 0f, size.width + 4 * u, size.height, 4 * u, 10 * u), Color(0x66000000), 4 * u, 10 * u, 12 * u)
            // .stash-pages: inset 4 -4 4 12, corners 3 / 8; a 20 % shade along its first 12 %, over 1 px #c9ced6 lines every 3 px on #eef0f3;
            // inset 0 0 0 1px #fff4.
            val l = 12 * u; val t = 4 * u; val r = size.width + 4 * u; val btm = size.height - 4 * u
            val pages = roundPath(l, t, r, btm, 3 * u, 8 * u)
            drawIntoCanvas { c ->
                val cv = c.nativeCanvas; cv.save(); cv.clipPath(pages)
                val p = android.graphics.Paint().apply { isAntiAlias = false }
                p.color = 0xFFEEF0F3.toInt(); cv.drawRect(l, t, r, btm, p)
                p.color = 0xFFC9CED6.toInt(); var x = l; while (x < r) { cv.drawRect(x, t, x + u, btm, p); x += 3 * u }
                cv.restore()
            }
            clipPath(Path().apply { addRoundRect(RoundRect(l, t, r, btm, topLeftCornerRadius = CornerRadius(3 * u), topRightCornerRadius = CornerRadius(8 * u),
                bottomRightCornerRadius = CornerRadius(8 * u), bottomLeftCornerRadius = CornerRadius(3 * u))) }) {
                drawRect(Brush.horizontalGradient(0f to Color(0x33000000), 1f to Color.Transparent, startX = l, endX = l + (r - l) * .12f), Offset(l, t), Size(r - l, btm - t))
                drawRoundRect(Color(0x44FFFFFF), Offset(l + u / 2, t + u / 2), Size(r - l - u, btm - t - u), CornerRadius(3 * u), style = Stroke(u))
            }
        }) {
        // .stash-cover.clear: corners 4 / 10, a 1 border of the colour lifted 20 % toward white (at 90 %).
        val coverShape = RoundedCornerShape(topStart = 4.dp, bottomStart = 4.dp, topEnd = 10.dp, bottomEnd = 10.dp)
        val border = mix(tint, .7f, Color.White, .2f)
        Box(Modifier.fillMaxSize().clip(coverShape)
            .drawBehind {
                val u = 1.dp.toPx()
                // What shows through the acrylic: the pages, blurred 1.5 px (their lines melt into one grey), and their shade.
                val l = 12 * u; val t = 4 * u; val btm = size.height - 4 * u
                drawRect(Color(0xFFE2E5E9), Offset(l, t), Size(size.width - l, btm - t))
                drawRect(Brush.horizontalGradient(0f to Color(0x33000000), 1f to Color.Transparent, startX = l, endX = l + (size.width + 4 * u - l) * .12f), Offset(l, t), Size(size.width - l, btm - t))
                // linear-gradient(140deg, colour 30 %, colour 12 % at 60 %, colour 26 %).
                drawRect(cssLinear(140f, 0f to tint.copy(alpha = tint.alpha * .3f), .6f to tint.copy(alpha = tint.alpha * .12f), 1f to tint.copy(alpha = tint.alpha * .26f)))
                // box-shadow: inset 0 0 0 1px #ffffff26, inset 0 0 18px colour 35 %.
                val shape = roundPath(u, u, size.width - u, size.height - u, 3 * u, 9 * u)
                insetGlow(shape, tint.copy(alpha = tint.alpha * .35f), 18 * u)
                drawRoundRect(Color(0x26FFFFFF), Offset(1.5f * u, 1.5f * u), Size(size.width - 3 * u, size.height - 3 * u), CornerRadius(3 * u), style = Stroke(u))
                drawOutline(coverShape.createOutline(size, layoutDirection, this), border, style = Stroke(2 * u))
            }) {
            // .stash-custom-background: the binder's own picture, cover-fit, 35 %, luminosity over the tint.
            val bg = coverArt(b.s("background"))
            if (bg != null) {
                val painter = heroPainter(bg)
                if (painter != null) Canvas(Modifier.fillMaxSize()) {
                    val ps = painter.intrinsicSize
                    val sc = if (ps.width > 0 && ps.height > 0) max(size.width / ps.width, size.height / ps.height) else 1f
                    val dw = ps.width * sc; val dh = ps.height * sc
                    // mix-blend-mode: luminosity keeps the picture's light and the tint's colour: drawn without its own colour.
                    translate((size.width - dw) / 2, (size.height - dh) / 2) { with(painter) { draw(Size(dw, dh), alpha = .35f, colorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })) } }
                }
            }
            Column(Modifier.fillMaxSize().padding(start = coverPad[0], top = coverPad[1], end = coverPad[2], bottom = coverPad[3]),
                verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CoverWindow(b, Modifier.weight(1f))
                // .stash-cover-title: a pill (3 / 7 in, #0b0f15b8) at the left, 10 / 700 white, one line.
                Box(Modifier.align(Alignment.Start).clip(RoundedCornerShape(999.dp)).background(Color(0xB80B0F15)).padding(horizontal = 7.dp, vertical = 3.dp)) {
                    Text(b.s("cover"), style = bt(10f, 700, Color.White, 1.4f, .25f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            // .stash-spine: 5 in from the left edge, 10 wide; the colour darkened 15 % into the colour at 55 %, a light line left, a dark one right.
            Box(Modifier.padding(start = 6.dp, top = 1.dp, bottom = 1.dp).width(10.dp).fillMaxHeight().drawBehind {
                drawRect(Brush.horizontalGradient(0f to mix(tint, .85f, Color.Black, .15f), 1f to tint.copy(alpha = tint.alpha * .55f)))
                drawRect(Color(0x18FFFFFF), size = Size(1.dp.toPx(), size.height))
                drawRect(Color(0x55000000), Offset(size.width - 1.dp.toPx(), 0f), Size(1.dp.toPx(), size.height))
            })
            // .stash-sheen: a light band at 118deg and a glow down from the top.
            Box(Modifier.fillMaxSize().drawBehind {
                drawRect(cssLinear(118f, .3f to Color(0x00FFFFFF), .42f to Color(0x2EFFFFFF), .5f to Color(0x08FFFFFF), .58f to Color(0x00FFFFFF)))
                drawRect(cssLinear(180f, 0f to Color(0x14FFFFFF), .3f to Color(0x00FFFFFF)))
            })
        }
    }
}

/**
 * .stash-window.w1 / w4 / w9: one, two by two (3 apart) or three by three (2 apart) slots, each card contained on a faint plate with a
 * ★ when starred; none at all: the CardStashy mark at 55 % in an empty slot (Chrome sizes that window 71.7 wide around it).
 */
@Composable
private fun CoverWindow(b: JsonObject, modifier: Modifier) {
    val slots = b.objs("slots")
    val n = b.i("n").coerceIn(1, 9).let { if (it == 4 || it == 9) it else 1 }
    if (slots.size == 1 && slots[0].b("only")) {
        Box(modifier.width(71.7.dp).fillMaxHeight().slotPlate(empty = true), contentAlignment = Alignment.Center) {
            BrandMark(48.dp, Modifier.alpha(.55f).clearAndSetSemantics { }, static = true)
        }
        return
    }
    val cols = when (n) { 9 -> 3; 4 -> 2; else -> 1 }
    val gap = if (n == 9) 2.dp else 3.dp
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap)) {
        (0 until (n / cols)).forEach { r ->
            Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(gap)) {
                (0 until cols).forEach { c ->
                    val s = slots.getOrNull(r * cols + c)
                    val pic = s?.o("picture")?.s("src")?.ifBlank { null }
                    Box(Modifier.weight(1f).fillMaxHeight().slotPlate(empty = pic == null), contentAlignment = Alignment.Center) {
                        if (pic != null) CardPicture(pic, null, null, Modifier.fillMaxSize(), RoundedCornerShape(0.dp))
                        if (s?.b("starred") == true) Text("★", Modifier.align(Alignment.TopEnd).padding(top = 1.dp, end = 2.dp),
                            style = bt(if (n == 9) 7f else 9f, 400, BStar, 1.2f).copy(shadow = androidx.compose.ui.graphics.Shadow(Color.Black, blurRadius = with(LocalDensity.current) { 3.dp.toPx() })))
                    }
                }
            }
        }
    }
}

/** .stash-slot: 3 corners, #ffffff10 and an inner 1 px #ffffff1f ring; empty, faint stripes at 135deg (6 px each). */
private fun Modifier.slotPlate(empty: Boolean): Modifier = this.clip(RoundedCornerShape(3.dp)).drawBehind {
    val u = 1.dp.toPx()
    // repeating-linear-gradient(135deg, #ffffff08 0 6px, #ffffff03 6px 12px): 6 px bands across the diagonal.
    if (empty) drawRect(Brush.linearGradient(0f to Color(0x08FFFFFF), .5f to Color(0x08FFFFFF), .5f to Color(0x03FFFFFF), 1f to Color(0x03FFFFFF),
        start = Offset.Zero, end = Offset(12 * u * .70711f, 12 * u * .70711f), tileMode = TileMode.Repeated))
    else drawRect(Color(0x10FFFFFF))
    drawRoundRect(Color(0x1FFFFFFF), Offset(u / 2, u / 2), Size(size.width - u, size.height - u), CornerRadius(2.5f * u), style = Stroke(u))
}

/** .btn.small: 34 tall (a 44 touch area), 12 in, 13.5 / 700; gold, or the glass ghost; an icon (.gl, 1.2em, 12 to the words). */
@Composable
private fun SmallButton(label: String, icon: SiteSvg?, gold: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Box(Modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else .45f).clickable(enabled = enabled, onClick = onClick).semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        val r = RoundedCornerShape(11.dp)
        Row(Modifier.height(34.dp).clip(r).then(if (gold) Modifier.background(BGold) else Modifier.siteGlassField(11.dp)).padding(horizontal = 13.dp),
            verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) { SiteIcon(icon, 16.2.dp, if (gold) BGoldInk else BInk, stroke = 2f); Spacer(Modifier.width(8.dp)) }
            Text(label, style = bt(13.5f, 700, if (gold) BGoldInk else BInk, 1.35f), maxLines = 1)
        }
    }
}

/** .btn.ghost: the glass ghost, at least [minW] wide and 44 tall, 16 in, 15 / 700; dimmed (45 %) and still while it can't be used. */
@Composable
private fun GhostButton(label: String, modifier: Modifier = Modifier, minW: Dp = 0.dp, enabled: Boolean = true, desc: String = "", fs: Float = 15f, onClick: () -> Unit) {
    Box(modifier.widthIn(min = minW).heightIn(min = 44.dp).alpha(if (enabled) 1f else .45f).siteGlassField(11.dp).clip(RoundedCornerShape(11.dp))
        .clickable(enabled = enabled, onClick = onClick)
        .semantics { role = Role.Button; if (desc.isNotEmpty()) contentDescription = desc; if (!enabled) disabled() }
        .padding(horizontal = 17.dp, vertical = 4.dp), contentAlignment = Alignment.Center) {
        Text(label, style = bt(fs, 700, BInk, 1.45f), maxLines = 1)
    }
}

// ---------------------------------------------------------------- an open binder

/** A page turned by a button or an edge (binders.js animateTurn): the old page's model, the way it went, and its start. */
internal class BinderLeaf(val model: JsonObject, val dir: Int, val id: Long = System.nanoTime())

/**
 * app.js showBinder in the site's #sheet: CARDSTASHY BINDER and its name, Binder options and the count, the open book (rings, the page
 * with nine pockets, the next page under it), Back and Next with the page dots, the set checklist link (a set binder) and the foot.
 * A pocket opens its card (the binder comes back when the card closes); its ★ puts it on the cover; the page turns by swipe, edge or button.
 */
@Composable
internal fun BinderSheet(o: CollectionWrites.BinderOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val written by CollectionWrites.written.collectAsState()
    var page by remember(o.id) { mutableIntStateOf(o.page) }
    var model by remember(o.id) { mutableStateOf<JsonObject?>(null) }
    var leaf by remember(o.id) { mutableStateOf<BinderLeaf?>(null) }
    var arrived by remember(o.id) { mutableStateOf(0L) }
    var busy by remember(o.id) { mutableStateOf(false) }
    // The page as the site draws it now, and again after any save (a ★, a card changed on its page).
    LaunchedEffect(o.id, written) {
        val m = CollectionWrites.binderModel(context, o.game, o.binder, page)
        if (m == null || m.b("gone")) { onClose(); return@LaunchedEffect }
        model = m; page = m.i("page")
    }
    val m = model
    // A.binderPage: the next page drawn, then the turn played over it (animateTurn; a dragged page only fades the new one in).
    fun turn(dir: Int, dragged: Boolean) {
        val old = model ?: return
        if (busy) return
        busy = true
        scope.launch {
            try {
                val next = CollectionWrites.binderModel(context, o.game, o.binder, old.i("page") + dir) ?: return@launch
                if (next.b("gone")) { onClose(); return@launch }
                if (next.i("page") == old.i("page")) return@launch
                if (dragged) { leaf = null; arrived = System.nanoTime() } else leaf = BinderLeaf(old, dir)
                model = next; page = next.i("page")
            } finally { busy = false }
        }
    }
    SiteSheet(m?.s("title").orEmpty(), backdrop, onClose, eyebrow = m?.s("eyebrow").orEmpty().ifBlank { "CARDSTASHY BINDER" }) { _ ->
        if (m == null) return@SiteSheet
        BinderBody(m, leaf, arrived, onLeafDone = { leaf = null }, onTurn = { d, dragged -> turn(d, dragged) },
            onOptions = {
                onClose(); CollectionWrites.binderEditing.value = CollectionWrites.BinderEditOpen(o.game, o.binder, back = o.copy(page = page),
                    open = { id, p -> CollectionWrites.binder.value = o.copy(binder = id, page = p, id = System.nanoTime()) })
            },
            onClear = { scope.launch { CollectionWrites.act(context, "clearUnavailableBinderFavorites", JsonObject().apply { addProperty("game", o.game); addProperty("binder", o.binder) }) } },
            onPocket = { p ->
                // A.card / tcg.js A.tCard from the pocket: the card's page over this one; the binder comes back to this page after.
                val back = o.copy(page = page, id = System.nanoTime())
                onClose(); o.card(p.s("act"), p.o("data") ?: JsonObject(), p.s("name"), back)
            },
            onStar = { p -> scope.launch { CollectionWrites.act(context, "featureBinderCard", JsonObject().apply {
                addProperty("game", o.game); addProperty("binder", o.binder); addProperty("entry", p.s("entry")) }) } },
            onSet = { code -> onClose(); o.set(code) })
    }
}

/** The open binder under its head: the tools, the cover notice, the book, the turn bar, the set link and the foot. */
@Composable
internal fun BinderBody(m: JsonObject, leaf: BinderLeaf? = null, arrived: Long = 0L, onLeafDone: () -> Unit = {}, onTurn: (Int, Boolean) -> Unit = { _, _ -> },
                        onOptions: () -> Unit = {}, onClear: () -> Unit = {}, onPocket: (JsonObject) -> Unit = {}, onStar: (JsonObject) -> Unit = {}, onSet: (String) -> Unit = {}) {
        val narrow = LocalConfiguration.current.screenWidthDp <= 520
        // .stash-page-tools: Binder options (btn ghost small) and the count (12, muted), 10 above and 18 below.
        Row(Modifier.fillMaxWidth().padding(top = 5.dp, bottom = 13.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (m.s("options").isNotEmpty()) SmallButton(m.s("options"), null, gold = false, onClick = onOptions) else Spacer(Modifier.width(1.dp))
            Text(m.s("count"), Modifier.weight(1f), style = bt(12f, 400, BMute), textAlign = TextAlign.End)
        }
        m.o("notice")?.let { n ->
            // .binder-cover-notice: why some cover choices are gone, the button that drops only those, what stays.
            val lines = n.strs("lines")
            Column(Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                lines.firstOrNull()?.let { Text(it, Modifier.padding(top = 10.dp, bottom = 6.dp), style = bt(12f, 400, BFaint)) }
                SmallButton(n.s("button"), null, gold = false, onClick = onClear)
                lines.drop(1).forEach { Text(it, Modifier.padding(top = 10.dp, bottom = 6.dp), style = bt(12f, 400, BFaint)) }
            }
        }
        OpenBook(m, narrow, leaf, arrived, onLeafDone, onTurn, onPocket, onStar)
        // .stash-turn-bar: ‹ Back, the page dots (7, 5 apart; the page's gold and 1.3×), Next ›; 12 above, 4 below.
        Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            val back = m.o("back"); val fwd = m.o("forward")
            GhostButton(back?.s("label").orEmpty(), minW = 96.dp, enabled = back?.b("off") == false, desc = back?.s("aria").orEmpty()) { onTurn(-1, false) }
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                val pages = m.i("dots")
                repeat(pages) { i ->
                    val on = i == m.i("page")
                    Box(Modifier.size(7.dp).graphicsLayer { if (on) { scaleX = 1.3f; scaleY = 1.3f } }.clip(RoundedCornerShape(50)).background(if (on) BGold else Color(0x2EFFFFFF)))
                }
            }
            GhostButton(fwd?.s("label").orEmpty(), minW = 96.dp, enabled = fwd?.b("off") == false, desc = fwd?.s("aria").orEmpty()) { onTurn(1, false) }
        }
        if (m.s("none").isNotEmpty()) Text(m.s("none"), Modifier.fillMaxWidth().padding(vertical = 6.dp), style = bt(15f, 400, BMute), textAlign = TextAlign.Center)
        m.o("set")?.let { s ->
            Box(Modifier.padding(top = 6.dp)) { SmallButton(s.s("label"), null, gold = false) { onSet(s.s("code")) } }
        }
        if (m.s("foot").isNotEmpty()) Text(m.s("foot"), Modifier.padding(top = 10.dp, bottom = 6.dp), style = bt(12f, 400, BFaint))
}

/**
 * .stash-open-book: the binder's colour mixed into its edge, 8 corners, 12 / 8 (14 from 521 wide) / 12 / 5 in; the rings, 5 (8) apart
 * from the page. The page follows a sideways swipe (rotateY about the rings, darkening as it lifts, the page under it brightening);
 * past a third or on a flick it turns, else it settles back. An edge tap, Back and Next turn it with the leaf animation.
 */
@Composable
private fun OpenBook(m: JsonObject, narrow: Boolean, leaf: BinderLeaf?, arrived: Long, onLeafDone: () -> Unit, onTurn: (Int, Boolean) -> Unit,
                     onPocket: (JsonObject) -> Unit, onStar: (JsonObject) -> Unit) {
    val scope = rememberCoroutineScope()
    val tint = cssColor(m.s("color"), Color(0xFF3B424D))
    val edge = if (tint != null) mix(tint, .55f, Color(0xFF3B424D), .45f) else Color(0xFF3B424D)
    val gap = if (narrow) 6.dp else 10.dp
    val pageKey = m.i("page")
    val canNext = m.has2("next"); val canPrev = m.has2("prev")
    fun can(d: Int) = if (d > 0) canNext else canPrev
    val progress = remember(m) { Animatable(0f) }
    val fade = remember(m) { Animatable(1f) }
    var dir by remember(m) { mutableIntStateOf(0) }
    var live by remember(m) { mutableStateOf(false) }
    // A dragged turn's new page: opacity .35 → 1, brightness .6 → 1 over 260 ms.
    val come = remember(arrived) { Animatable(if (arrived != 0L && !Motion.still) 0f else 1f) }
    LaunchedEffect(arrived) { if (come.value < 1f) come.animateTo(1f, tween(260, easing = CubicBezierEasing(0f, 0f, .58f, 1f))) }
    // The leaf: 560 ms, cubic-bezier(.3, .1, .2, 1) over keyframes at 0 / 30 % / 100 %; the shades ease in and out alongside.
    val leafT = remember(leaf?.id) { Animatable(if (leaf == null || Motion.still) 1f else 0f) }
    LaunchedEffect(leaf?.id) {
        if (leaf == null) return@LaunchedEffect
        if (!Motion.still) leafT.animateTo(1f, tween(560, easing = LinearEasing))
        onLeafDone()
    }
    val leafE = CubicBezierEasing(.3f, .1f, .2f, 1f).transform(leafT.value)
    val shadeE = CubicBezierEasing(.42f, 0f, .58f, 1f).transform(leafT.value)
    fun leafAngle(e: Float, from: Float, mid: Float, to: Float) = if (e < .3f) from + (mid - from) * (e / .3f) else mid + (to - mid) * ((e - .3f) / .7f)
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
        .drawBehind {
            drawRect(cssLinear(100f, 0f to Color(0xFF141920), 1f to Color(0xFF1C232D)))
            // inset 2px 0 8px #0003.
            insetGlow(roundPath(0f, 0f, size.width, size.height, 8.dp.toPx(), 8.dp.toPx()).apply { offset(2.dp.toPx(), 0f) }, Color(0x33000000), 8.dp.toPx())
            drawRoundRect(edge, Offset(.5f.dp.toPx(), .5f.dp.toPx()), Size(size.width - 1.dp.toPx(), size.height - 1.dp.toPx()), CornerRadius(7.5f.dp.toPx()), style = Stroke(1.dp.toPx()))
        }
        .padding(start = 6.dp, top = 13.dp, bottom = 13.dp, end = if (narrow) 9.dp else 15.dp)
        .height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(if (narrow) 5.dp else 8.dp)) {
        // .stash-rings: three 22 × 12 rings (3 #a1acb6, 5 corners, a shadow under, light inside), spaced around the page's height.
        Column(Modifier.width(20.dp).fillMaxHeight().clearAndSetSemantics { }, verticalArrangement = Arrangement.SpaceAround) {
            repeat(3) {
                Box(Modifier.size(22.dp, 12.dp).drawBehind {
                    val u = 1.dp.toPx()
                    outerShadow(roundPath(0f, 0f, size.width, size.height, 5 * u, 5 * u), Color(0x77000000), 0f, 2 * u, 3 * u)
                    drawRoundRect(Color(0xFFA1ACB6), Offset(1.5f * u, 1.5f * u), Size(size.width - 3 * u, size.height - 3 * u), CornerRadius(3.5f * u), style = Stroke(3 * u))
                    drawRoundRect(Color(0x66FFFFFF), Offset(3 * u, 4 * u), Size(size.width - 6 * u, size.height - 7 * u), CornerRadius(2 * u), style = Stroke(.8f * u))
                })
            }
        }
        Box(Modifier.weight(1f)) {
            // .stash-under: the page the swipe uncovers, dark until it shows (brightness .45 + reveal × .55).
            if (live && dir != 0 && can(dir)) {
                val under = (if (dir > 0) m.get("next") else m.get("prev"))?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull { it as? JsonObject }.orEmpty()
                val reveal = min(1f, progress.value * 1.6f)
                Box(Modifier.matchParentSize().drawWithContent { drawContent(); drawRect(Color.Black.copy(alpha = 1f - (.45f + reveal * .55f))) }) {
                    PageSheet(under, m.s("game"), gap, under = true, Modifier.fillMaxSize())
                }
            }
            // The old page left behind by a backward leaf turn sits under the new one, darkening as it is covered.
            if (leaf != null && leaf.dir < 0) Box(Modifier.matchParentSize().drawWithContent { drawContent(); drawRect(Color.Black.copy(alpha = .55f * shadeE)) }) {
                PageSheet(leaf.model.objs("pockets"), m.s("game"), gap, under = false, Modifier.fillMaxSize(), interactive = false)
            }
            val forwardLeaf = leaf != null && leaf.dir > 0
            val backLeaf = leaf != null && leaf.dir < 0
            val swing = if (backLeaf) leafAngle(leafE, -180f, -145f, 0f) else 0f
            Box(Modifier.fillMaxWidth()
                .graphicsLayer {
                    cameraDistance = 1600.dp.toPx()
                    if (backLeaf) { transformOrigin = TransformOrigin(0f, .5f); rotationY = swing; alpha = if (abs(swing) > 90f) 0f else 1f }
                    else if (live && dir != 0) {
                        transformOrigin = TransformOrigin(if (dir > 0) 0f else 1f, .5f)
                        val a = -dir * progress.value * 170f
                        rotationY = a; alpha = if (abs(a) > 90f) 0f else fade.value
                    } else alpha = .35f + .65f * come.value
                }
                .pointerInput(m) {
                    val tracker = VelocityTracker()
                    var total = 0f; var start = 0L
                    fun settle() = scope.launch { progress.animateTo(0f, tween(220)); live = false; dir = 0 }
                    detectHorizontalDragGestures(
                        onDragStart = { tracker.resetTracking(); total = 0f; dir = 0; start = System.currentTimeMillis() },
                        onDragCancel = { settle() },
                        onDragEnd = {
                            val d = dir; val w = size.width.toFloat()
                            val elapsed = max(1L, System.currentTimeMillis() - start)
                            val moved = progress.value * w / density
                            val flick = moved / elapsed > .45f && moved > 30f
                            if (d == 0 || !can(d) || !(progress.value > .3f || flick)) settle()
                            else scope.launch {
                                // The lift finishes (rotateY to 178°, fading to .1) in 200 ms, ease-in, then the next page.
                                if (!Motion.still) {
                                    launch { fade.animateTo(.1f, tween(200, easing = CubicBezierEasing(.42f, 0f, 1f, 1f))) }
                                    progress.animateTo(178f / 170f, tween(200, easing = CubicBezierEasing(.42f, 0f, 1f, 1f)))
                                }
                                onTurn(d, true)
                            }
                        },
                        onHorizontalDrag = { change, dx ->
                            change.consume(); tracker.addPosition(change.uptimeMillis, change.position)
                            total += dx
                            if (dir == 0) { if (abs(total) < 10f) return@detectHorizontalDragGestures; dir = if (total < 0) 1 else -1; live = true }
                            val w = size.width.toFloat()
                            val distance = -total * dir
                            // Rubber band at the first and last page.
                            val p = if (can(dir)) (distance / w).coerceIn(0f, .96f) else (distance / w / 6f).coerceIn(0f, .08f)
                            scope.launch { progress.snapTo(p) }
                        })
                }
                .drawWithContent {
                    // While turning: a shadow thrown away from the rings, and the lifted page darkening toward its free edge.
                    val turnP = if (live && dir != 0) progress.value else 0f
                    if (turnP > 0f) outerShadow(roundPath(0f, 0f, size.width, size.height, 6.dp.toPx(), 6.dp.toPx()), Color(0xAA000000), -18.dp.toPx() * turnP * dir, 6.dp.toPx(), 22.dp.toPx())
                    drawContent()
                    if (turnP > 0f) {
                        val stops = arrayOf(0f to Color.Transparent, .35f to Color.Transparent, .7f to Color(0x66000000), 1f to Color(0xBB000000))
                        drawRect(cssLinear(if (dir > 0) 90f else 270f, *stops), alpha = min(1f, turnP * 1.4f))
                    }
                    if (forwardLeaf) drawRect(Color.Black.copy(alpha = .55f * (1f - shadeE)))
                    if (come.value < 1f) drawRect(Color.Black.copy(alpha = .4f * (1f - come.value)))
                }) {
                PageSheet(m.objs("pockets"), m.s("game"), gap, under = false, Modifier.fillMaxWidth(), onPocket = onPocket, onStar = onStar)
                // .binder-page-edge: the previous page's (24 wide, 4 past the left) and the next's (30, 4 past the right, with the curl).
                if (canPrev) Box(Modifier.align(Alignment.CenterStart).offset(x = (-4).dp).width(24.dp).fillMaxHeight()
                    .clickable { onTurn(-1, false) }.semantics { contentDescription = "Turn to the previous page" })
                if (canNext) Box(Modifier.align(Alignment.CenterEnd).offset(x = 4.dp).width(30.dp).fillMaxHeight()
                    .clickable { onTurn(1, false) }.semantics { contentDescription = "Turn to the next page" }) {
                    PageCurl(Modifier.align(Alignment.BottomEnd).padding(end = 4.dp, bottom = 4.dp))
                }
            }
            // The page turned away by an edge, Back or Next: it lifts over the rings and folds away (rotateY 0 → -35° → -180°).
            if (forwardLeaf) {
                val a = leafAngle(leafE, 0f, -35f, -180f)
                Box(Modifier.matchParentSize().graphicsLayer { cameraDistance = 1600.dp.toPx(); transformOrigin = TransformOrigin(0f, .5f); rotationY = a; alpha = if (abs(a) > 90f) 0f else 1f }
                    .drawWithContent { drawContent(); drawRect(Color.Black.copy(alpha = .5f * shadeE)) }) {
                    PageSheet(leaf!!.model.objs("pockets"), m.s("game"), gap, under = false, Modifier.fillMaxSize(), interactive = false)
                }
            }
        }
    }
}

/** .page-curl: a 22 corner (#cfd6df → #8e99a6 across its lower half, 6 round at the corner), its shadow; it swells twice to hint at a turn. */
@Composable
private fun PageCurl(modifier: Modifier) {
    val k = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        if (Motion.still) return@LaunchedEffect
        kotlinx.coroutines.delay(1000)
        repeat(2) { k.animateTo(1f, keyframes { durationMillis = 2400; 1f at 0 using CubicBezierEasing(.42f, 0f, .58f, 1f); 1.35f at 1200 using CubicBezierEasing(.42f, 0f, .58f, 1f) }) }
    }
    Box(modifier.size(22.dp).graphicsLayer { scaleX = k.value; scaleY = k.value }.drawBehind {
        val u = 1.dp.toPx()
        val tri = Path().apply { moveTo(size.width, 0f); lineTo(size.width, size.height - 6 * u); quadraticTo(size.width, size.height, size.width - 6 * u, size.height); lineTo(0f, size.height); close() }
        drawIntoCanvas { c ->
            val p = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; color = 0x66000000; maskFilter = android.graphics.BlurMaskFilter(2 * u, android.graphics.BlurMaskFilter.Blur.NORMAL) }
            c.nativeCanvas.save(); c.nativeCanvas.translate(-2 * u, -2 * u); c.nativeCanvas.drawPath(tri.asAndroidPath(), p); c.nativeCanvas.restore()
        }
        drawPath(tri, Brush.linearGradient(listOf(Color(0xFFCFD6DF), Color(0xFF8E99A6)), start = Offset(size.width / 2, size.height / 2), end = Offset(size.width, size.height)))
    })
}

/**
 * .stash-pocket-page (8 in, 6 corners, a shade along the ring side over #222a35 → #1a2029, a soft shadow): nine pockets, three across,
 * [gap] apart. [under] is .stash-under (#1f2631 → #171c24, pictures only).
 */
@Composable
private fun PageSheet(pockets: List<JsonObject>, game: String, gap: Dp, under: Boolean, modifier: Modifier, interactive: Boolean = true,
                      onPocket: (JsonObject) -> Unit = {}, onStar: (JsonObject) -> Unit = {}) {
    Column(modifier.drawBehind {
        val u = 1.dp.toPx(); val r = 6 * u
        if (!under) outerShadow(roundPath(0f, 0f, size.width, size.height, r, r), Color(0x55000000), 2 * u, 3 * u, 10 * u)
        clipPath(Path().apply { addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(r))) }) {
            if (under) drawRect(cssLinear(160f, 0f to Color(0xFF1F2631), 1f to Color(0xFF171C24)))
            else {
                drawRect(cssLinear(160f, 0f to Color(0xFF222A35), 1f to Color(0xFF1A2029)))
                drawRect(Brush.horizontalGradient(0f to Color(0x2E000000), 1f to Color.Transparent, endX = size.width * .06f))
                drawRect(Color(0x10FFFFFF), size = Size(size.width, u))
            }
        }
    }.padding(8.dp).then(if (!interactive) Modifier.clearAndSetSemantics { } else Modifier), verticalArrangement = Arrangement.spacedBy(gap)) {
        (0 until 3).forEach { r ->
            // Grid items with an aspect ratio sit at the top of their row (5:8 empties stay shorter than full pockets).
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Top) {
                (0 until 3).forEach { c ->
                    val p = pockets.getOrNull(r * 3 + c)
                    val cell = Modifier.weight(1f)
                    when {
                        p == null || p.b("empty") -> EmptyPocket(cell, if (under) "" else p?.s("mark").orEmpty().ifBlank { "◇" })
                        under -> UnderPocket(p, cell)
                        else -> Pocket(p, game, cell, interactive, onPocket, onStar)
                    }
                }
            }
        }
    }
}

/** .stash-pocket's sleeve: 1 #69778555 edge, 3 corners, #ffffff03, a light line inside the top; a starred one rings gold and glows. */
private fun Modifier.sleeve(starred: Boolean = false): Modifier = this.drawBehind {
    val u = 1.dp.toPx(); val r = 3 * u
    if (starred) outerShadow(roundPath(0f, 0f, size.width, size.height, r, r), Color(0x22FFD76A), 0f, 0f, 10 * u)
    drawRoundRect(Color(0x03FFFFFF), cornerRadius = CornerRadius(r))
    drawRect(Color(0x12FFFFFF), Offset(r, u), Size(size.width - 2 * r, u))
    drawRoundRect(Color(0x55697785), Offset(u / 2, u / 2), Size(size.width - u, size.height - u), CornerRadius(r), style = Stroke(u))
    if (starred) drawRoundRect(Color(0x88FFD76A), Offset(1.5f * u, 1.5f * u), Size(size.width - 3 * u, size.height - 3 * u), CornerRadius(r - u), style = Stroke(u))
}

/** .empty-pocket: the sleeve at 5:8, ◇ at 26 in white 14 %. */
@Composable
private fun EmptyPocket(modifier: Modifier, mark: String) {
    Box(modifier.aspectRatio(5f / 8f).sleeve().semantics { if (mark.isNotEmpty()) contentDescription = "Empty pocket" }, contentAlignment = Alignment.Center) {
        if (mark.isNotEmpty()) Text(mark, Modifier.clearAndSetSemantics { }, style = bt(26f, 400, Color(0x25FFFFFF), 1.45f))
    }
}

/** .under-pocket: the sleeve and the card's picture (5:7), nothing else. */
@Composable
private fun UnderPocket(p: JsonObject, modifier: Modifier) {
    Box(modifier.sleeve().padding(5.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(5f / 7f).clip(RoundedCornerShape(2.dp)).background(Color(0xFF101319))) {
            p.o("picture")?.s("src")?.ifBlank { null }?.let { CardPicture(it, null, null, Modifier.fillMaxSize(), RoundedCornerShape(2.dp)) }
        }
    }
}

/**
 * A pocket (button.pocket-open): the card (5:7 on #101319, its own finish on a Magic printing), a faint glint, the name (11, bold) and
 * version (9, muted) under it, ×qty at the top right; the ★ (28, 6 from the right, 31 from the bottom) puts it on the cover.
 */
@Composable
private fun Pocket(p: JsonObject, game: String, modifier: Modifier, interactive: Boolean, onPocket: (JsonObject) -> Unit, onStar: (JsonObject) -> Unit) {
    Box(modifier.sleeve(p.b("starred"))) {
        Column(Modifier.fillMaxWidth().padding(5.dp).then(if (interactive) Modifier.clip(RoundedCornerShape(4.dp)).clickable { onPocket(p) }
            .semantics(mergeDescendants = true) { contentDescription = p.s("aria"); role = Role.Button } else Modifier)) {
            Box(Modifier.fillMaxWidth().aspectRatio(5f / 7f).clip(RoundedCornerShape(2.dp)).background(Color(0xFF101319)), contentAlignment = Alignment.Center) {
                val url = p.o("picture")?.s("src")?.ifBlank { null }
                if (url != null) {
                    val print = p.o("print"); val fin = p.o("finish")
                    val context = LocalContext.current
                    val data = if (print != null) CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) } else null
                    val look = data?.let { Foil.look(it, print, Foil.finishFor(print, fin?.s("key")?.ifBlank { "nonfoil" } ?: "nonfoil")) }?.takeIf { it.shines }
                    val tilt = if (look != null) rememberFoilTilt(live = true, phase = (p.s("entry").hashCode() and 0xff) / 255f, tile = true) else null
                    CardPicture(url, look, tilt, Modifier.fillMaxSize(), RoundedCornerShape(2.dp))
                } else Text(p.s("fallback").ifBlank { p.s("name") }, Modifier.padding(8.dp), style = bt(10f, 400, BMute), textAlign = TextAlign.Center)
                // .pocket-glint: linear-gradient(115deg, transparent 48 %, #ffffff08 50 %, transparent 52 %).
                Box(Modifier.matchParentSize().drawBehind { drawRect(cssLinear(115f, .48f to Color.Transparent, .5f to Color(0x08FFFFFF), .52f to Color.Transparent)) })
            }
            // .pocket-caption: 6 / 1 / 2 in, the name and version 2 apart, one line each.
            Column(Modifier.fillMaxWidth().padding(start = 1.dp, end = 1.dp, top = 6.dp, bottom = 2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(p.s("name"), style = bt(11f, 700, BInk, 1.3f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                // An empty <small> is a grid row of no height on the site.
                if (p.s("version").isNotEmpty()) Text(p.s("version"), style = bt(9f, 400, BMute), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        // .pocket-qty: 10 / 1.45, 3 / 5 in, 5 corners, #0b111ee6; 6 from the top and right.
        if (p.s("qty").isNotEmpty()) Box(Modifier.align(Alignment.TopEnd).padding(top = 7.dp, end = 7.dp).clip(RoundedCornerShape(5.dp)).background(Color(0xE60B111E))
            .padding(horizontal = 5.dp, vertical = 3.dp).clearAndSetSemantics { }) {
            Text(p.s("qty"), style = bt(10f, 400, BInk, 1.45f))
        }
        p.o("star")?.let { st ->
            val on = st.b("on")
            // .pocket-star: 28 square, 5 corners, #171c23e8 with a #ffffff33 edge, ★ 15 in #b6c0ce (gold #f9d476 with its edge when on); a 44 touch area.
            // The site hangs it 31 px off the pocket's foot, where it takes the last few pixels of a long name; here it sits 3 dp inside the
            // picture's foot, 6 from the right, so it covers no caption at any text size.
            Box(Modifier.align(Alignment.TopEnd).offset(x = 2.dp).layout { m, c ->
                val pl = m.measure(c.copy(minWidth = 0, minHeight = 0))
                val img = (c.maxWidth - 10.dp.toPx()) * 7f / 5f
                layout(pl.width, pl.height) { pl.place(0, (5.dp.toPx() + img - 3.dp.toPx() - 36.dp.toPx()).roundToInt()) }
            }.size(44.dp)
                .then(if (interactive) Modifier.clickable { onStar(p) }.semantics { contentDescription = st.s("aria"); role = Role.Button; selected = on } else Modifier),
                contentAlignment = Alignment.Center) {
                val r = RoundedCornerShape(5.dp)
                Box(Modifier.size(28.dp).clip(r).background(Color(0xE8171C23)).drawBehind {
                    drawRoundRect(if (on) Color(0xFFF9D476) else Color(0x33FFFFFF), Offset(.5f.dp.toPx(), .5f.dp.toPx()), Size(size.width - 1.dp.toPx(), size.height - 1.dp.toPx()),
                        CornerRadius(4.5f.dp.toPx()), style = Stroke(1.dp.toPx()))
                }, contentAlignment = Alignment.Center) {
                    Text("★", style = bt(15f, 400, if (on) Color(0xFFF9D476) else Color(0xFFB6C0CE), 1.2f))
                }
            }
        }
    }
}

// ---------------------------------------------------------------- the editor

/**
 * app.js binderEditor in the site's #sheet: Binder name, Cards to include (C.binderRule shows the filter value's caption and hint, or
 * hides it), Cover appearance (colour, an HTTPS picture or an uploaded photo, shrunk to 800 px as JPEG .7), Save binder; Delete binder
 * for one that exists. The site's checks run in the engine (A.saveBinder); its words come back as the toast.
 */
@Composable
internal fun BinderEditSheet(e: CollectionWrites.BinderEditOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val model by produceState<JsonObject?>(null, e.id) {
        val m = CollectionWrites.binderEditModel(context, e.game, e.binder)
        if (m == null) { onClose(); return@produceState }
        value = m
    }
    val m = model
    val back = e.back
    SiteSheet(m?.s("heading").orEmpty(), backdrop, onClose, onBack = if (back != null) ({ onClose(); CollectionWrites.binder.value = back.copy(id = System.nanoTime()) }) else null) { _ ->
        if (m != null) BinderEditForm(m, e, backdrop, onClose)
    }
}

@Composable
internal fun BinderEditForm(m: JsonObject, e: CollectionWrites.BinderEditOpen, backdrop: GraphicsLayer?, onClose: () -> Unit, startOpen: Boolean = false) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember(m) { mutableStateOf(m.s("title")) }
    var rule by remember(m) { mutableStateOf(m.s("rule")) }
    var value by remember(m) { mutableStateOf(m.s("value")) }
    var color by remember(m) { mutableStateOf(m.s("color")) }
    var background by remember(m) { mutableStateOf(m.s("background")) }
    // #binderBgData: the uploaded photo as a data: URL (the binder's own while it has one).
    var bgData by remember(m) { mutableStateOf(m.s("bgData")) }
    var status by remember(m) { mutableStateOf(if (m.b("uploaded")) "Uploaded cover saved" else "") }
    var open by remember(m) { mutableStateOf(startOpen) }
    var picking by remember(m) { mutableStateOf(false) }
    var busy by remember(m) { mutableStateOf(false) }
    val hints = m.o("hints")
    val hint = hints?.o(rule)
    val noValue = rule in m.strs("noValue")
    // C.binderImage: the photo shrunk so its longer side is at most 800, as JPEG at .7; under 10 MB in, at most 350 000 characters out.
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { coverUpload(context, uri) } }
                .onSuccess { url -> bgData = url; background = ""; status = "Cover image ready · saved when you save the binder" }
                .onFailure { err -> CollectionWrites.show(err.message?.takeIf { it.isNotBlank() } ?: "The source image could not be decoded.") }
        }
    }
    fun save() {
        if (busy) return
        busy = true
        val d = JsonObject().apply {
            addProperty("game", m.s("game")); addProperty("binder", m.s("id")); addProperty("title", title); addProperty("rule", rule); addProperty("value", value)
            addProperty("color", color); addProperty("background", background)
            addProperty("bgData", bgData)
        }
        scope.launch {
            try {
                CollectionWrites.act(context, "saveBinder", d) { r ->
                    // closeSheet; Binders shows; a binder that already existed opens again at the page it was on.
                    onClose()
                    if (m.s("id").isNotEmpty()) e.open(r.s("made").ifBlank { m.s("id") }, e.back?.page ?: 0)
                }
            } finally { busy = false }
        }
    }
    Column(Modifier.fillMaxWidth()) {
        Spacer(Modifier.height(8.dp))
        FormLabeled("Binder name", Modifier.fillMaxWidth()) {
            FormInput(title, { if (it.length <= 60) title = it }, SHEET_IN_LABEL, placeholder = m.s("placeholder"), desc = "Binder name")
        }
        Spacer(Modifier.height(8.dp))
        FormLabeled("Cards to include", Modifier.fillMaxWidth()) {
            FormSelect(m.objs("rules").map { it.s("value") to it.s("label") }, rule, SHEET_IN_LABEL, desc = "Cards to include") { rule = it }
        }
        if (!noValue) {
            Spacer(Modifier.height(8.dp))
            FormLabeled(hint?.s("caption")?.ifBlank { null } ?: m.s("fallbackCaption"), Modifier.fillMaxWidth()) {
                FormInput(value, { if (it.length <= 100) value = it }, SHEET_IN_LABEL, placeholder = m.s("valuePlaceholder"), desc = hint?.s("caption").orEmpty())
            }
        }
        if (hint != null) Text(hint.s("hint"), Modifier.padding(top = 10.dp), style = bt(12f, 400, BFaint))
        Spacer(Modifier.height(6.dp))
        // details.binder-appearance: Cover appearance (15, Chrome's disclosure triangle).
        Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { open = !open }.semantics { stateDescription = if (open) "Expanded" else "Collapsed" },
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(15.dp).height(21.75.dp).drawBehind {
                val u = 1.dp.toPx(); val cy = size.height / 2
                val p = if (open) Path().apply { moveTo(0f, cy - 4f * u); lineTo(9.5f * u, cy - 4f * u); lineTo(4.75f * u, cy + 4.25f * u); close() }
                else Path().apply { moveTo(.5f * u, cy - 4.75f * u); lineTo(8.75f * u, cy); lineTo(.5f * u, cy + 4.75f * u); close() }
                drawPath(p, BInk)
            })
            Text("Cover appearance", style = bt(15f, 400, BInk))
        }
        if (open) {
            FormLabeled("Cover color", Modifier.fillMaxWidth()) { ColorField(color, "Cover color") { picking = true } }
            Spacer(Modifier.height(8.dp))
            FormLabeled("Background image URL (optional)", Modifier.fillMaxWidth()) {
                FormInput(background, { background = it }, SHEET_IN_LABEL, placeholder = "https://…", desc = "Background image URL (optional)", keyboard = KeyboardType.Uri)
            }
            Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(0.dp), verticalAlignment = Alignment.CenterVertically) {
                // label.btn.ghost.file: Upload cover image (12.5 / 700), then the status (13, muted) and Clear image (link small).
                Box(Modifier.heightIn(min = 44.dp).siteGlassField(11.dp).clip(RoundedCornerShape(11.dp))
                    .clickable { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                    .semantics { role = Role.Button }.padding(horizontal = 17.dp), contentAlignment = Alignment.Center) {
                    Text("Upload cover image", style = bt(12.5f, 700, BInk, 1.45f), maxLines = 1)
                }
                if (status.isNotEmpty()) Text(status, Modifier.weight(1f, fill = false), style = bt(13f, 400, BMute))
                Box(Modifier.heightIn(min = 44.dp).clickable { bgData = ""; background = ""; status = "" }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
                    Text("Clear image", style = bt(13f, 600, BGold))
                }
            }
            Text("Use an HTTPS image link or upload a photo. Star an owned card inside the binder to place it in the cover’s clear pocket.",
                Modifier.padding(top = 18.dp), style = bt(12f, 400, BFaint))
        }
        Spacer(Modifier.height(16.dp))
        FormGold("Save binder", enabled = !busy, modifier = Modifier.fillMaxWidth(), pal = LocalSheetPal.current) { save() }
        if (m.s("id").isNotEmpty()) {
            // button.link.danger: Delete binder (15 / 600); Undo brings it back. Then the foot.
            Box(Modifier.heightIn(min = 44.dp).clickable {
                if (!busy) { busy = true; scope.launch { try { CollectionWrites.act(context, "removeBinder", JsonObject().apply { addProperty("game", m.s("game")); addProperty("binder", m.s("id")) }) { onClose() } } finally { busy = false } } }
            }.semantics { role = Role.Button }, contentAlignment = Alignment.CenterStart) {
                Text("Delete binder", style = bt(15f, 600, BBad))
            }
            Text("Your cards stay in the collection.", Modifier.padding(bottom = 6.dp), style = bt(12f, 400, BFaint))
        }
    }
    if (picking) ColorPickerDialog(color, backdrop, onDone = { c -> picking = false; if (c != null) color = c })
}

/** C.binderImage: [uri]'s photo (turned upright) shrunk to 800 on its longer side, as a JPEG .7 data: URL; the site's limits and words. */
private fun coverUpload(context: android.content.Context, uri: android.net.Uri): String {
    val r = context.contentResolver
    val bytes = r.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
    if (bytes > 10L * 1024 * 1024) error("Choose an image under 10 MB.")
    val full: android.graphics.Bitmap = if (android.os.Build.VERSION.SDK_INT >= 28) {
        android.graphics.ImageDecoder.decodeBitmap(android.graphics.ImageDecoder.createSource(r, uri)) { d, info, _ ->
            d.allocator = android.graphics.ImageDecoder.ALLOCATOR_SOFTWARE
            val w = info.size.width; val h = info.size.height
            val ratio = min(1f, 800f / max(w, h))
            if (ratio < 1f) d.setTargetSize(max(1, (w * ratio).roundToInt()), max(1, (h * ratio).roundToInt()))
        }
    } else {
        val b = r.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it) } ?: error("The source image could not be decoded.")
        val ratio = min(1f, 800f / max(b.width, b.height))
        if (ratio < 1f) android.graphics.Bitmap.createScaledBitmap(b, max(1, (b.width * ratio).roundToInt()), max(1, (b.height * ratio).roundToInt()), true) else b
    }
    // canvas.toDataURL("image/jpeg", .7) draws on a transparent canvas: what was see-through comes out black.
    val flat = android.graphics.Bitmap.createBitmap(full.width, full.height, android.graphics.Bitmap.Config.ARGB_8888)
    android.graphics.Canvas(flat).apply { drawColor(android.graphics.Color.BLACK); drawBitmap(full, 0f, 0f, null) }
    val out = java.io.ByteArrayOutputStream()
    flat.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, out)
    val url = "data:image/jpeg;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
    if (url.length > 350000) error("That cover is too large. Try a simpler or smaller image.")
    return url
}

// ---------------------------------------------------------------- holding a binder

/** app.js tileMenu for a held binder: "Binder" over a .menu-list of Open binder and Edit cover and cards (each icon over its words). */
@Composable
internal fun BinderHoldSheet(h: CollectionWrites.BinderHoldOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    SiteSheet(h.hold.s("title").ifBlank { "Binder" }, backdrop, onClose) { _ ->
        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            h.hold.objs("items").forEach { it ->
                // .menu-list button: 13 / 4 in, a line under it, 15; the 20 icon on its own line above the words.
                Column(Modifier.fillMaxWidth().clickable {
                    onClose()
                    when (it.s("act")) {
                        "openBinder" -> h.open(h.binder, 0)
                        "editBinder" -> CollectionWrites.binderEditing.value = CollectionWrites.BinderEditOpen(h.game, h.binder, open = h.open)
                    }
                }.semantics(mergeDescendants = true) { role = Role.Button }
                    .drawBehind { drawRect(BLine, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
                    .padding(horizontal = 4.dp, vertical = 13.dp)) {
                    SiteIcon(CollectionCardsModel.svg(it.o("icon")), 20.dp, BInk)
                    Spacer(Modifier.height(1.dp))
                    Text(it.s("label"), style = bt(15f, 400, BInk, 1.27f))
                }
            }
        }
    }
}
