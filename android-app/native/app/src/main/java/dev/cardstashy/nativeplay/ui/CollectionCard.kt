package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.draw.blur
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * What a press on the card page does. The tabs, the finish chips, the history ranges and sources, the other printings, the flip, a card named in
 * the guide and a rule word are the app's own; the rest ([press]) are the site's handlers, which the route opens on the website.
 */
class CollectionCardActions(
    val tab: (String) -> Unit = {},
    val finish: (String) -> Unit = {},
    val print: (Int) -> Unit = {},
    val face: () -> Unit = {},
    val card: (String) -> Unit = {},
    val rule: (String) -> Unit = {},
    val profile: () -> Unit = {},
    /** Prices: a history range (30, 90, 180, 365, all), a Market details source, and a history source for a quote's series. */
    val range: (String) -> Unit = {},
    val source: (String) -> Unit = {},
    val historySource: (key: String, source: String) -> Unit = { _, _ -> },
    val press: (CardPress) -> Unit = {},
    /** A picker's change (Yu-Gi-Oh!'s Edition, Printing & rarity): its data-change and the value picked. */
    val select: (name: String, value: String) -> Unit = { _, _ -> },
)

private val Ink = Color(0xFFEEF0F4)
private val Mute = Color(0xFF9AA2B1)
private val Foot = Color(0xFF8B93A3)
private val LineC = Color(0xFF2A2F39)
/** #sheet: rgba(18, 20, 26, .6) over the blurred, darkened page. */
private val SheetBg = Color(0xFF12141A)
private val Surface = Color(0xFF171A20)
private val Surface2 = Color(0xFF1F232B)
/**
 * The page's --gold and --gold-ink (style.css 13, 742-743: Magic's gold, Yu-Gi-Oh!'s violet, Pokémon's coral) with polish.css --pill's
 * two mixes of it: 78 % with 22 % white over, 86 % with 14 % black under.
 */
internal class SheetPal(val gold: Color, val ink: Color) {
    private fun mix(c: Color, f: Float) = Color(gold.red + (c.red - gold.red) * f, gold.green + (c.green - gold.green) * f, gold.blue + (c.blue - gold.blue) * f)
    val light = mix(Color.White, .22f); val dark = mix(Color.Black, .14f)
}
internal fun sheetPal(game: CardGame) = SheetPal(game.gold, when (game) { CardGame.YGO -> Color(0xFF150A2C); CardGame.PTCG -> Color(0xFF2A0D09); else -> Color(0xFF1B1406) })
internal val LocalSheetPal = androidx.compose.runtime.staticCompositionLocalOf { sheetPal(CardGame.MTG) }
private val GoldC: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalSheetPal.current.gold
private val BtnInk: Color @Composable @androidx.compose.runtime.ReadOnlyComposable get() = LocalSheetPal.current.ink
private val Bad = Color(0xFFF08A7E)
private val Good = Color(0xFF6FD29A)
private val Warn = Color(0xFFF2C66D)
/** --glass-edge: color-mix(gold 19%) as the site computes it, srgb(237 200 127 / .19). */
private val Edge = Color(0x30EDC87F)

private fun sans(size: Float, weight: Int = 400, color: Color = Ink, lh: Float = 1.45f, ls: Float = 0f) =
    TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)
private fun manrope(size: Float, weight: Int, color: Color = Ink, lh: Float = 1.15f, ls: Float = 0f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lh).sp, letterSpacing = ls.sp, color = color)
/** .eyebrow: 11 / 700, 1.32 apart, upper case, muted. */
private val Eyebrow = sans(11f, 700, Mute, lh = 1.45f, ls = 1.32f)

/** CSS linear-gradient(<deg>, …) over this box, as the browser lays its line: through the centre, long enough to reach the corners. */
private fun DrawScope.cssLinear(deg: Float, vararg stops: Pair<Float, Color>, corner: CornerRadius? = null) {
    val a = Math.toRadians(deg.toDouble()); val dx = sin(a).toFloat(); val dy = -cos(a).toFloat()
    val len = abs(size.width * dx) + abs(size.height * dy)
    val c = Offset(size.width / 2, size.height / 2); val half = Offset(dx * len / 2, dy * len / 2)
    val brush = Brush.linearGradient(*stops, start = c - half, end = c + half)
    if (corner != null) drawRoundRect(brush, cornerRadius = corner) else drawRect(brush)
}

/**
 * The site's glass card (.imp-chip, .cd-text, .panel.tight, the guide rows): 46 % surface, a 160° sheen to 45 %, the gold
 * edge and the 1 px top highlight. (Its 10 / 30 drop shadow is near black on near black: left out.)
 */
private fun Modifier.siteGlass(r: Dp): Modifier = this.clip(RoundedCornerShape(r)).drawBehind {
    val cr = CornerRadius(r.toPx())
    drawRoundRect(Color(0x75171A1F), cornerRadius = cr)
    cssLinear(160f, 0f to Color(0x0BFFFFFF), .45f to Color(0x00FFFFFF), corner = cr)
    drawRect(Color(0x12FFFFFF), topLeft = Offset(r.toPx() * .5f, 0f), size = Size(size.width - r.toPx(), 1.dp.toPx()))
}.border(1.dp, Edge, RoundedCornerShape(r))

/** The site's frosted panel (.card-set-summary, .guide-hero, .guide-panel): the art behind it blurred, a 135° sheen, the line edge. */
@Composable
private fun Modifier.sitePanel(r: Dp, fill: Color? = null): Modifier {
    val frost = LocalFrost.current
    val at = remember { mutableStateOf(Offset.Zero) }
    return this.onGloballyPositioned { at.value = it.positionInRoot() }.clip(RoundedCornerShape(r)).drawBehind {
        val f = frost?.frosted
        if (frost != null && f != null) {
            val d = frost.origin - at.value
            drawImage(f, dstOffset = IntOffset(d.x.roundToInt(), d.y.roundToInt()), dstSize = androidx.compose.ui.unit.IntSize(f.width * 2, f.height * 2),
                filterQuality = androidx.compose.ui.graphics.FilterQuality.Low)
            drawRect(Color(0x66101318))
        }
        if (fill != null) drawRect(fill)
        cssLinear(135f, 0f to Color(0x09FFFFFF), 1f to Color(0x03FFFFFF))
        drawRect(Color(0x0AFFFFFF), topLeft = Offset(r.toPx() * .5f, 0f), size = Size(size.width - r.toPx(), 1.dp.toPx()))
    }.border(1.dp, LineC, RoundedCornerShape(r))
}

/** .btn.ghost: the 52 % surface with the gold edge and the top highlight; 11 corners (999 for a pill). */
@Composable
private fun Ghost(label: String, icon: SiteSvg?, modifier: Modifier = Modifier, r: Dp = 11.dp, h: Dp = 44.dp, fs: Float = 13.5f, pad: Dp = 12.dp, onClick: () -> Unit) {
    Row(modifier.heightIn(min = h).clip(RoundedCornerShape(r)).drawBehind {
        drawRect(Color(0x851F232A))
        drawRect(Color(0x12FFFFFF), topLeft = Offset(r.toPx() * .5f, 0f), size = Size(size.width - r.toPx(), 1.dp.toPx()))
    }.border(1.dp, Edge, RoundedCornerShape(r)).clickable(onClick = onClick).padding(horizontal = pad + 1.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        // .btn .gl: the 18 icon, then .btn .ico's 4, .gl's .15em and the button's 6 gap: 12 to the words; the 1 px border outside the padding.
        if (icon != null) { SiteIcon(icon, 18.dp, Ink); Spacer(Modifier.width(12.dp)) }
        Text(label, style = sans(fs, 700, Ink, lh = 1.35f), textAlign = TextAlign.Center)
    }
}

/** .btn (gold): the gold plate, ink words, 11 corners. */
@Composable
private fun Gold(modifier: Modifier = Modifier, h: Dp = 48.dp, pad: Dp = 12.dp, onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(modifier.heightIn(min = h).clip(RoundedCornerShape(11.dp)).background(GoldC).clickable(onClick = onClick).padding(horizontal = pad, vertical = 8.dp),
        contentAlignment = Alignment.Center) { content() }
}

/** .chip: 25 tall pill, 12 / 700, the ghost surface. */
@Composable
private fun Chip(label: String, color: Color = Ink, h: Dp = 25.dp, onClick: (() -> Unit)? = null) {
    Box(Modifier.heightIn(min = h).clip(RoundedCornerShape(999.dp)).drawBehind { drawRect(Color(0x851F232A)) }.border(1.dp, Edge, RoundedCornerShape(999.dp))
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(horizontal = 9.dp, vertical = 3.dp), contentAlignment = Alignment.Center) {
        Text(label, style = sans(12f, 700, color, lh = 1.45f))
    }
}

/** A mana symbol (Scryfall's SVG) with the site's small drop shadow. */
@Composable
private fun Sym(src: String, alt: String, size: Dp) {
    val p = heroPainter(src.takeIf { it.isNotBlank() }?.let(homeArt))
    Box(Modifier.size(size).drawBehind { drawCircle(Color(0x8C000000), this.size.minDimension / 2, center + Offset(-1.dp.toPx(), 1.dp.toPx())) }.semantics { contentDescription = alt }) {
        if (p != null) Image(p, null, Modifier.fillMaxSize().clip(CircleShape)) else Box(Modifier.fillMaxSize().clip(CircleShape).background(Color(0xFFCAC5C0)))
    }
}

/**
 * Rules text with its symbols inline and its rule words marked (rule-dex.js ruleText); a rule word opens its reminder.
 * .rule-word (style.css 2577): the text's own colour (its --accent is unset in the dark theme) over a 1 px dotted line in that
 * colour, at the bottom of the word's box. [pretty] is text-wrap: pretty (.effect-line), wrapped so a line never ends a word short.
 */
@Composable
private fun Rich(runs: List<CardRun>, style: TextStyle, onRule: (String) -> Unit, modifier: Modifier = Modifier, pretty: Boolean = false) {
    val inline = HashMap<String, InlineTextContent>()
    val words = ArrayList<IntRange>()
    val text = buildAnnotatedString {
        for (r in runs) when {
            r.sym != null -> { val id = "sym:" + r.sym
                inline.getOrPut(id) { InlineTextContent(Placeholder(1.05.em, 1.05.em, PlaceholderVerticalAlign.TextCenter)) { Sym(r.sym, r.alt, 15.dp) } }
                appendInlineContent(id, r.alt) }
            r.rule != null -> { val from = length
                withLink(LinkAnnotation.Clickable("rule:" + r.rule, TextLinkStyles(SpanStyle(fontWeight = if (r.bold) FontWeight.Bold else null, fontStyle = if (r.italic) FontStyle.Italic else null))) { onRule(r.rule) }) { append(r.t.orEmpty()) }
                if (length > from) words += from until length }
            else -> withStyle(SpanStyle(fontWeight = if (r.bold) FontWeight.Bold else null, fontStyle = if (r.italic) FontStyle.Italic else null)) { append(r.t.orEmpty()) }
        }
    }
    var layout by remember { mutableStateOf<androidx.compose.ui.text.TextLayoutResult?>(null) }
    val ink = style.color.takeIf { it != Color.Unspecified } ?: Ink
    if (pretty) BoxWithConstraints(modifier) {
        // Chrome's text-wrap: pretty keeps a lone word off the last line: the width that first pulls a second word down to it.
        val measurer = rememberTextMeasurer()
        val full = constraints.maxWidth
        val holes = remember(text) { text.getStringAnnotations("androidx.compose.foundation.text.inlineContent", 0, text.length).mapNotNull { a ->
            inline[a.item]?.let { androidx.compose.ui.text.AnnotatedString.Range(it.placeholder, a.start, a.end) } } }
        val width = remember(text, full, style) {
            fun lone(r: androidx.compose.ui.text.TextLayoutResult) = r.lineCount >= 2 && text.text.substring(r.getLineStart(r.lineCount - 1), r.getLineEnd(r.lineCount - 1)).trim().none { it == ' ' }
            fun at(w: Int) = measurer.measure(text, style, constraints = androidx.compose.ui.unit.Constraints(maxWidth = w), placeholders = holes)
            val base = if (full == androidx.compose.ui.unit.Constraints.Infinity) null else at(full)
            var best = full
            if (base != null && lone(base)) for (i in 1..8) { val r = at((full * (1f - .03f * i)).toInt()); if (r.lineCount > base.lineCount) break; if (!lone(r)) { best = (full * (1f - .03f * i)).toInt(); break } }
            best
        }
        RichText(text, style, inline, words, ink, { layout = it }, { layout }, Modifier.width(with(LocalDensity.current) { width.toDp() }))
    } else RichText(text, style, inline, words, ink, { layout = it }, { layout }, modifier)
}

@Composable
private fun RichText(text: androidx.compose.ui.text.AnnotatedString, style: TextStyle, inline: Map<String, InlineTextContent>, words: List<IntRange>, ink: Color,
                     onLayout: (androidx.compose.ui.text.TextLayoutResult) -> Unit, layoutNow: () -> androidx.compose.ui.text.TextLayoutResult?, modifier: Modifier) {
    Text(text, style = style, inlineContent = inline, onTextLayout = onLayout,
        modifier = modifier.drawBehind {
            val layout = layoutNow()
            val l = layout ?: return@drawBehind
            val dot = 1.dp.toPx(); val drop = style.fontSize.toPx() * .27f
            for (w in words) {
                val a = l.getLineForOffset(w.first); val b = l.getLineForOffset(w.last)
                for (line in a..b) {
                    val x0 = if (line == a) l.getHorizontalPosition(w.first, true) else l.getLineLeft(line)
                    val x1 = if (line == b) l.getHorizontalPosition(w.last + 1, true) else l.getLineRight(line)
                    val y = l.getLineBaseline(line) + drop
                    var x = minOf(x0, x1); val end = maxOf(x0, x1)
                    while (x < end) { drawRect(ink, Offset(x, y), Size(minOf(dot, end - x), dot)); x += dot * 2 }
                }
            }
        })
}

// ---------------------------------------------------------------- the sheet

/**
 * A card's page in the Collection (views.js cardSheet, drawn from the site's own markup by CollectionEngine.card): it rises
 * over the screen (92 % tall on a phone; a centred 780 wide card on an unfolded screen), the art bleeding down behind the
 * glass. The head is the close button over the art until the page scrolls 110 past the top, then a bar with the name; the
 * tabs pin under it.
 */
@Composable
fun CollectionCardSheet(m: CollectionCardModel, act: CollectionCardActions, onBack: (() -> Unit)? = null, onClose: () -> Unit) {
    val y = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()
    // style.css dialog.sheet[open]: rise .22 s ease-out.
    LaunchedEffect(Unit) { if (Motion.still) y.snapTo(0f) else y.animateTo(0f, tween(220, easing = androidx.compose.animation.core.LinearOutSlowInEasing)) }
    fun close() { scope.launch { if (!Motion.still) y.animateTo(1f, tween(200)); onClose() } }
    var zoom by remember { mutableStateOf(false) }
    BackHandler(enabled = !zoom) { close() }
    FoilFocus.Cover()
    androidx.compose.runtime.CompositionLocalProvider(LocalSheetPal provides sheetPal(m.game)) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val screenW = maxWidth; val screenH = maxHeight
        val landscape = screenW > screenH
        val big = screenW >= 700.dp
        val h = constraints.maxHeight.toFloat()
        // ::backdrop rgba(0,0,0,.6); a tap outside closes.
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = 1f - y.value }.background(Color(0x99000000)).pointerInput(Unit) { detectTapGestures { close() } })
        // The card sheet: a phone's bottom sheet 8 % from the top; from 700 wide a centred 780 card 4 % from each end.
        val sheetW = if (big) minOf(780.dp, screenW - 104.dp) else screenW
        val top = if (big) screenH * .04f else screenH * .08f
        val shape = if (big) RoundedCornerShape(22.dp) else RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
        Box(Modifier.align(if (big) Alignment.TopCenter else Alignment.BottomCenter).padding(top = top, bottom = if (big) screenH * .04f else 0.dp)
            .width(sheetW).fillMaxHeight().offset { IntOffset(0, (y.value * h).roundToInt()) }
            .clip(shape).background(SheetBg).border(1.dp, Color(0x31EDC87F), shape)) {
            val gutter = if (big) 22.dp else 16.dp
            // --hero-h (polish.css 692-700): 74vw from 240 to 340; from 700 wide 38 % of the height (340-460) upright,
            // 46 % (300-420) sideways; a short sideways screen 48 % (170-220).
            val heroH = when {
                landscape && screenH <= 500.dp -> (screenH * .48f).coerceIn(170.dp, 220.dp)
                big && landscape -> (screenH * .46f).coerceIn(300.dp, 420.dp)
                big -> (screenH * .38f).coerceIn(340.dp, 460.dp)
                // A phone upright: Pokémon's header is lower (64vw, 220-300) and Yu-Gi-Oh!'s taller (82vw, 250-360) (polish.css 692-693).
                m.game == CardGame.PTCG -> (screenW * .64f).coerceIn(220.dp, 300.dp)
                m.game == CardGame.YGO -> (screenW * .82f).coerceIn(250.dp, 360.dp)
                else -> (screenW * .74f).coerceIn(240.dp, 340.dp)
            }
            val frostLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
            val frost = remember(frostLayer) { Frost(frostLayer) }
            GlassBackdrop(m.head?.art?.ifBlank { null }, frost) { p -> CardBleed(if (m.head?.crop == "pokemon") remember(p) { PkArtCrop(p) } else p, heroH, m.game) }
            androidx.compose.runtime.CompositionLocalProvider(LocalFrost provides frost) {
                val list = rememberLazyListState()
                // Past 110 scrolled (app.js scrollTop > 110) the head becomes the bar with the card's name.
                val past = with(LocalDensity.current) { 110.dp.toPx() }
                val scrolled by remember(past) { derivedStateOf { list.firstVisibleItemIndex > 0 || list.firstVisibleItemScrollOffset > past } }
                val pinTabs by remember { derivedStateOf { list.firstVisibleItemIndex >= 1 } }
                LazyColumn(state = list, modifier = Modifier.fillMaxSize()) {
                    item(key = "banner") { m.head?.let { Banner(it, heroH, big, gutter) } }
                    item(key = "tabs") { Box(Modifier.padding(horizontal = gutter).padding(top = 10.dp, bottom = 6.dp).graphicsLayer { alpha = if (pinTabs) 0f else 1f }) { CardTabs(m.tabs, big, act) } }
                    when (m.tab) {
                        "meta" -> item(key = "meta") { MetaPanel(m, act, gutter) }
                        "guide" -> item(key = "guide") { GuidePanel(m, act, gutter) }
                        "prices" -> item(key = "prices") { m.prices?.let { PricesPanel(it, act, gutter, screenW, screenH) } }
                        else -> {
                            item(key = "head") { OverviewHead(m, act, big, gutter) }
                            item(key = "overview") { m.overview?.let { Overview(m, it, act, sheetW - gutter * 2 > 600.dp, gutter) { zoom = true } } }
                        }
                    }
                    item(key = "end") { Spacer(Modifier.navigationBarsPadding().height(22.dp)) }
                }
                SheetHead(m.head?.title.orEmpty(), scrolled, gutter, back = onBack?.takeIf { m.head?.back == true }?.let { b -> { scope.launch { if (!Motion.still) y.animateTo(1f, tween(200)); b() } } }) { close() }
                if (pinTabs) Box(Modifier.padding(top = if (scrolled) 57.dp else 0.dp).fillMaxWidth().background(Brush.verticalGradient(0f to Color(0xFF111318), .8f to Color(0xF2111318), 1f to Color(0x00111318)))
                    .padding(horizontal = gutter).padding(top = 6.dp, bottom = 8.dp)) { CardTabs(m.tabs, big, act) }
            }
        }
        if (zoom) {
            val o = m.overview
            val data = dev.cardstashy.nativeplay.play.CardData.ready.collectAsStateValue()
            val look = if (m.game != CardGame.MTG) null else data?.let { Foil.look(it, m.shown, Foil.finishFor(m.shown, o?.finishKey ?: "nonfoil")) }
            val ctx = androidx.compose.ui.platform.LocalContext.current
            val tcg = remember(o?.tcgFinish, o?.image) { o?.tcgFinish?.let { tcgFinishOf(ctx, m.game, it, o.image) } }
            if (o != null) CardZoom(o.zoomSrc.ifBlank { o.image }, o.zoomHi.ifBlank { null }, o.zoomArt.ifBlank { null }, look, finish = tcg) { zoom = false }
        }
    }
    }
}

/** artwork.js pokemonArtCrop (style.css 2132-2134): a Pokémon card picture cut to its art window, 122 % wide moved 9 % left and 10.8 % up, 1.68 : 1. */
internal class PkArtCrop(private val base: androidx.compose.ui.graphics.painter.Painter) : androidx.compose.ui.graphics.painter.Painter() {
    private val l = .09f; private val w = 1f / 1.22f; private val t = .108f
    private val h get() = base.intrinsicSize.let { s -> if (s.width > 0f && s.height > 0f && s.width.isFinite()) w * s.width / 1.68f / s.height else w / 1.68f * 63f / 88f }
    override val intrinsicSize: Size get() = base.intrinsicSize.let { s -> if (s.width > 0f && s.height > 0f && s.width.isFinite()) Size(s.width * w, s.width * w / 1.68f) else Size.Unspecified }
    override fun DrawScope.onDraw() {
        val full = Size(size.width / w, size.height / h)
        clipRect { translate(-full.width * l, -full.height * t) { with(base) { draw(full) } } }
    }
}

@Composable
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectAsStateValue(): T = collectAsState().value

/**
 * polish.css 700-722 #sheetBody > .cs-bleed: the art carried on behind the sheet under the banner, as on the website.
 * It is (hero × 1.25 + 300) tall and fades out from 120 under the hero. A glow of the whole art (blur 40, saturate 1.45,
 * brightness .62); the frosted art and its mirror in the hero's own crop (blur 18, saturate 1.3, brightness .72) fading
 * from 60 to 340 under the hero; the soft art (blur 6, saturate 1.15, brightness .9) fading from 10 over to 130 under it;
 * then the veil (::after) darkening downwards. The sheet's own colour is under it all (so the glass panels have a backdrop).
 */
@Composable
private fun CardBleed(p: androidx.compose.ui.graphics.painter.Painter, heroH: Dp, game: CardGame = CardGame.MTG) {
    val density = LocalDensity.current
    fun px(d: Dp) = with(density) { d.toPx() }
    val h = heroH * 1.25f + 300.dp
    // .cs-bleed.ygo: Yu-Gi-Oh!'s art sits 28 % down, not 32 %; Pokémon's is its art window (.pk-crop), zoomed past the frame.
    val oy = if (game == CardGame.YGO) .28f else .32f
    val pk = game == CardGame.PTCG
    Box(Modifier.fillMaxSize().background(SheetBg)) {
        Box(Modifier.fillMaxWidth().height(h).fadeDown(px(heroH + 120.dp), px(h))) {
            Image(p, null, Modifier.fillMaxSize().blur(40.dp), contentScale = ContentScale.Crop,
                alignment = if (pk) Alignment.Center else androidx.compose.ui.BiasAlignment(0f, -.4f), colorFilter = tone(1.45f, .62f))
            BleedFit(p, heroH, tone(1.3f, .72f), Modifier.fillMaxSize().fadeDown(px(heroH + 60.dp), px(heroH + 340.dp)).blur(18.dp), oy, pk)
            BleedFit(p, heroH, tone(1.15f, .9f), Modifier.fillMaxSize().fadeDown(px(heroH - 10.dp), px(heroH + 130.dp)).blur(6.dp), oy, pk)
            Box(Modifier.fillMaxSize().drawBehind {
                val hh = px(heroH); val bottom = size.height
                fun at(y: Float) = (y / bottom).coerceIn(0f, 1f)
                drawRect(Brush.verticalGradient(0f to Color.Transparent, at(hh * .45f) to Color.Transparent, at(hh * .85f) to Color(0x470A0B10), at(hh) to Color(0x610A0B10),
                    at(hh + px(70.dp)) to Color(0x990A0B10), at(hh + px(220.dp)) to Color(0xA80A0B10), 1f to Color(0xB30A0B10)))
            })
        }
    }
}

/** .cs-bleed-fit: the art at full width (at least the hero tall) placed as the banner crops it (32 % down), its mirror under it. */
@Composable
private fun BleedFit(p: androidx.compose.ui.graphics.painter.Painter, heroH: Dp, filter: androidx.compose.ui.graphics.ColorFilter, modifier: Modifier, oy: Float = .32f, pk: Boolean = false) = BoxWithConstraints(modifier) {
    val w = maxWidth
    if (pk) {
        // .cs-bleed-fit.pk-crop: the window (max(width, 1.68 × hero) wide, 1.68 : 1) at the top, zoomed 1.22 about (50 %, 88 %), its last
        // 6 % fading; the mirror flips the whole fit about the zoomed window's lower edge, 1.0264 of the window down (polish.css 715-720).
        val winH = maxOf(w / 1.68f, heroH); val winW = winH * 1.68f
        val dens = LocalDensity.current
        val fadeFrom = with(dens) { (winH * .94f).toPx() }; val fadeTo = with(dens) { winH.toPx() }
        for (mirror in listOf(false, true)) Box(Modifier.fillMaxWidth().height(heroH).graphicsLayer {
            if (mirror) { scaleY = -1f; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, winH * 1.0264f / heroH) }
        }) {
            Box(Modifier.align(Alignment.TopCenter).wrapContentSize(Alignment.TopCenter, unbounded = true).requiredSize(winW, winH)
                .graphicsLayer { scaleX = 1.22f; scaleY = 1.22f; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, .88f) }
                .fadeDown(fadeFrom, fadeTo)) {
                Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds, colorFilter = filter)
            }
        }
        return@BoxWithConstraints
    }
    val ar = p.intrinsicSize.let { if (it.width > 0f && it.height > 0f && it.width.isFinite()) it.width / it.height else 626f / 457f }
    val imgH = maxOf(w / ar, heroH)
    val top = heroH * oy - imgH * oy
    val crop = androidx.compose.ui.BiasAlignment(0f, oy * 2f - 1f)
    Image(p, null, Modifier.offset(y = top).requiredWidth(w).requiredHeight(imgH), contentScale = ContentScale.Crop, alignment = crop, colorFilter = filter)
    Image(p, null, Modifier.offset(y = top + imgH).requiredWidth(w).requiredHeight(imgH).graphicsLayer { scaleY = -1f }, contentScale = ContentScale.Crop, alignment = crop, colorFilter = filter)
}

/** .sheet-head.overlay: the close button over the art; past 110 scrolled, the bar with the card's name (style.css 1352-1355). */
@Composable
private fun SheetHead(title: String, scrolled: Boolean, gutter: Dp, back: (() -> Unit)? = null, onClose: () -> Unit) {
    Row(Modifier.fillMaxWidth().then(if (scrolled) Modifier.background(Color(0xFF171A20)).drawBehind {
        drawRect(LineC, topLeft = Offset(0f, size.height - 1.dp.toPx()), size = Size(size.width, 1.dp.toPx()))
    } else Modifier).padding(horizontal = gutter).padding(top = if (scrolled) 4.dp else 16.dp, bottom = if (scrolled) 8.dp else 0.dp),
        verticalAlignment = Alignment.CenterVertically) {
        // views.js cardSheet: the ← (data-act sheetBack, "Back to deck idea") before the name when the page came from the idea sheet.
        if (back != null) Box(Modifier.padding(end = 8.dp).size(44.dp).clip(RoundedCornerShape(12.dp)).background(if (scrolled) Surface2 else Color(0x8C0A0C10)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(12.dp))
            .clickable(onClick = back).semantics { contentDescription = "Back to deck idea" }, contentAlignment = Alignment.Center) {
            Text("←", style = sans(17f, 400, Color.White))
        }
        if (scrolled) Text(title, style = manrope(16f, 700, Ink, lh = 1.3f), maxLines = 2, modifier = Modifier.weight(1f))
        else Spacer(Modifier.weight(1f))
        Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(if (scrolled) Surface2 else Color(0x8C0A0C10)).border(1.dp, Color(0x2EFFFFFF), RoundedCornerShape(12.dp))
            .clickable(onClick = onClose).semantics { contentDescription = "Close" }, contentAlignment = Alignment.Center) {
            Text("✕", style = sans(17f, 400, Color.White))
        }
    }
}

/** .cs-banner: the art crop (cover, 30 % from the top) with its shade, the name, the type with "Owned · n", and the mana cost. */
@Composable
private fun Banner(h: CardHead, heroH: Dp, big: Boolean, gutter: Dp) {
    Box(Modifier.fillMaxWidth().height(heroH)) {
        val p0 = heroPainter(h.art.ifBlank { null }?.let(homeArt))
        // Pokémon: the art window (pokemonArtCrop), centred, scaled 1.05 about 50 % 60 % (style.css 2680-2681).
        val pk = h.crop == "pokemon"
        val p = if (pk && p0 != null) remember(p0) { PkArtCrop(p0) } else p0
        // .cs-art: cover at 50 % 32 %, masked solid to half way, .533 at 74 %, gone at 94 %.
        if (p != null) Image(p, null, Modifier.fillMaxSize().graphicsLayer { val k = if (pk) 1.05f else 1.02f; scaleX = k; scaleY = k
                if (pk) transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, .6f); compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
            .drawWithContent { drawContent(); drawRect(Brush.verticalGradient(0f to Color.Black, .5f to Color.Black, .74f to Color(0x88000000), .94f to Color.Transparent), blendMode = androidx.compose.ui.graphics.BlendMode.DstIn) },
            contentScale = ContentScale.Crop, alignment = if (pk) Alignment.Center else androidx.compose.ui.BiasAlignment(0f, -.36f))
        Box(Modifier.fillMaxSize().drawBehind { drawRect(Brush.verticalGradient(0f to Color(0x52000000), .3f to Color(0x00000000))) })
        // .cs-title: 20 over / 18 under, the gutter in from each side, sitting on the foot of the art.
        Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = gutter).padding(top = 20.dp, bottom = 18.dp), verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                val size = if (big) 32f else 24f
                Text(h.title, style = manrope(size, 800, Color.White, lh = 1.12f, ls = -size * .02f).copy(shadow = Shadow(Color(0x99000000), Offset(0f, 2f), 14f)))
                Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    val shadow = Shadow(Color.Black, Offset(0f, 2f), 10f)
                    if (h.type.isNotBlank()) Text(h.type, style = sans(14f, 600, Color.White, lh = 1.45f).copy(shadow = shadow))
                    h.owned?.let { Text(it, style = sans(11f, 600, Color.White, lh = 1.4f).copy(shadow = shadow), modifier = Modifier.padding(start = 8.dp)
                        .clip(RoundedCornerShape(999.dp)).background(Color(0x8811151C)).border(1.dp, Color(0x38FFFFFF), RoundedCornerShape(999.dp))
                        .padding(horizontal = 8.dp, vertical = 3.dp).semantics { contentDescription = h.ownedAria }) }
                }
            }
            if (h.emblems.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) { h.emblems.forEach { TitleEmblem(it) } }
            else Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { h.mana.forEach { Sym(it.src, it.alt, 22.dp) } }
        }
    }
}

/**
 * emblems.js gameEmblems beside the name (style.css 856-866): an orb 28 across; a Level / Rank star 22 with its number at 18 / 800, or a
 * Link rating's LINK tag (9 / 900 on #1d4fa5) and number; HP at 18 / 800.
 */
@Composable
private fun TitleEmblem(e: TcgEmblem) {
    val num = sans(18f, 800, Ink, lh = 1.2f)
    when {
        e.icon != null && e.text.isBlank() -> Box(Modifier.semantics { contentDescription = e.label }) { SiteIcon(e.icon, 28.dp, Ink) }
        e.hp -> Text(e.text, style = num, modifier = Modifier.padding(start = 2.dp))
        else -> Row(Modifier.semantics { contentDescription = e.label }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            if (e.mark.isNotBlank()) Text(e.mark, style = sans(9f, 900, Color.White, lh = 1.2f, ls = .54f), modifier = Modifier.padding(end = 3.dp).clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1D4FA5)).padding(horizontal = 4.dp, vertical = 1.dp))
            e.icon?.let { SiteIcon(it, 22.dp, Ink) }
            Text(e.text, style = num)
        }
    }
}

/**
 * .cs-tabs: the pill bar (94 % dark, 999 corners, 4 in) with a gold indicator under the open tab; each tab takes its own
 * width and an equal share of what is left. Icons show from 700 wide.
 */
@Composable
private fun CardTabs(tabs: List<CollTab>, big: Boolean, act: CollectionCardActions) {
    val pal = LocalSheetPal.current
    GrowRow(Modifier.fillMaxWidth().drawBehind {
        // box-shadow -11 -5 0 5 and 11 -5 0 5 in #111318: the bar's pill, 5 larger, moved 11 out and 5 up each way.
        val g = 5.dp.toPx(); val dx = 11.dp.toPx(); val dy = 5.dp.toPx(); val r = CornerRadius(size.height / 2 + g)
        for (sx in listOf(-1f, 1f)) drawRoundRect(Color(0xFF111318), Offset(-g + sx * dx, -g - dy), Size(size.width + g * 2, size.height + g * 2), r)
    }.clip(RoundedCornerShape(999.dp)).background(Color(0xF0121419)).border(1.dp, Color(0xCC2A2F38), RoundedCornerShape(999.dp)).padding(4.dp), gap = 2.dp) {
        tabs.forEach { t ->
            Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).then(if (t.on) Modifier.drawBehind {
                cssLinear(180f, 0f to pal.light, .58f to pal.gold, 1f to pal.dark, corner = CornerRadius(size.height / 2))
                drawRoundRect(Color(0x70FFFFFF), topLeft = Offset(size.height / 2, 0f), size = Size(size.width - size.height, 1.dp.toPx()))
            } else Modifier).clickable { act.tab(t.key) }.padding(horizontal = if (big) 16.dp else 8.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                if (big && t.icon != null) { SiteIcon(t.icon, 16.dp, if (t.on) BtnInk else Mute); Spacer(Modifier.width(7.dp)) }
                Text(t.label, style = sans(14f, 650, if (t.on) BtnInk else Mute, lh = 1.3f, ls = -.14f), maxLines = 1, softWrap = false)
            }
        }
    }
}

/** A row whose children take their natural width plus an equal share of what is left (flex: 1 1 auto), all as tall as the tallest. */
@Composable
private fun GrowRow(modifier: Modifier, gap: Dp, content: @Composable () -> Unit) = androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
    val g = gap.roundToPx(); val n = ms.size.coerceAtLeast(1)
    val natural = ms.map { it.maxIntrinsicWidth(c.maxHeight) }
    val room = c.maxWidth - g * (n - 1)
    val widths = if (room >= natural.sum()) natural.map { it + (room - natural.sum()) / n } else natural.map { it * room / natural.sum().coerceAtLeast(1) }
    val h = ms.mapIndexed { i, m -> m.maxIntrinsicHeight(widths[i]) }.maxOrNull() ?: 0
    val ps = ms.mapIndexed { i, m -> m.measure(androidx.compose.ui.unit.Constraints.fixed(widths[i], h)) }
    layout(c.maxWidth, h) { var x = 0; ps.forEach { it.place(x, 0); x += it.width + g } }
}

// ---------------------------------------------------------------- Overview's head: emblems, the set, the quick price

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OverviewHead(m: CollectionCardModel, act: CollectionCardActions, big: Boolean, gutter: Dp) {
    Column(Modifier.padding(horizontal = gutter)) {
        if (m.emblems.isNotEmpty()) FlowRow(Modifier.padding(top = 10.dp, bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            m.emblems.forEach { e ->
                Row(Modifier.widthIn(max = 360.dp).siteGlass(12.dp).padding(start = 6.dp, end = 10.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.padding(horizontal = 1.dp)) { SiteIcon(e.icon, 20.dp, Ink) }
                    Column { Text(e.title, style = sans(13f, 700, Ink, lh = 1.45f)); if (e.line.isNotBlank()) Text(e.line, style = sans(11.5f, 400, Mute, lh = 1.35f)) }
                }
            }
        }
        Column(Modifier.padding(top = 12.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            m.set?.let { SetSummary(it, big) { act.press(it.press ?: CardPress("", null, "set", mapOf("act" to "set", "code" to it.code), "", "", "", false, false, false, false, false)) } }
            // .card-archetype: Yu-Gi-Oh!'s archetype and its printings, a gold link (13 / 600, 4 over and under).
            m.archetype?.let { a -> Text(a.label, style = sans(13f, 600, GoldC, lh = 1.45f), modifier = Modifier.clickable { act.press(a) }.padding(vertical = 4.dp)) }
            m.price?.let { PriceSummary(it, m.glyphs, big, act) }
        }
    }
}

/** .card-set-summary: the set's symbol, name ›, code # rarity year; then the collection's progress through it (side by side from 600). */
@Composable
private fun SetSummary(s: CardSetSummary, big: Boolean, onClick: () -> Unit) {
    val identity: @Composable (Modifier) -> Unit = { mod ->
        Row(mod, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            when {
                // .ygo-pack: 34 × 48, cover, 4 corners, a soft shadow under; img.pks.big: 34 square in light ink.
                s.pictureKind == "ygo-pack" -> firstOf(s.picture).let { p -> Box(Modifier.size(34.dp, 48.dp).drawBehind { drawRoundRect(Color(0x80000000), Offset(0f, 1.dp.toPx()), size, CornerRadius(4.dp.toPx())) }
                    .clip(RoundedCornerShape(4.dp)).background(Surface2)) { if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) } }
                s.picture.isNotEmpty() -> PkSymbol(s.picture, 34.dp)
                else -> SetSymbol(s, 24.dp)
            }
            Column(Modifier.weight(1f, fill = false)) {
                Text(buildAnnotatedString { append(s.name); if (s.go) withStyle(SpanStyle(color = GoldC)) { append(" ›") } }, style = sans(14f, 700, Ink, lh = 1.4f))
                if (s.parts.isNotEmpty()) PartsLine(s.parts, sans(12f, 400, Mute, lh = 1.45f), Modifier.padding(top = 4.dp))
                else Text(s.line, style = sans(12f, 400, Mute, lh = 1.45f), modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
    val progress: @Composable (Modifier) -> Unit = { mod -> s.progress?.let { p ->
        Column(mod) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(p.eyebrow.uppercase(), style = Eyebrow); Text(p.label, style = sans(12f, 400, Ink, lh = 1.4f))
                }
                if (p.pct.isNotBlank()) Text(p.pct, style = sans(20f, 650, Ink, lh = 1.45f, ls = -.8f))
            }
            if (p.track) Box(Modifier.padding(vertical = 8.dp).fillMaxWidth().height(5.dp).clip(RoundedCornerShape(99.dp)).background(Color(0x14EDEFF4))) {
                Box(Modifier.fillMaxHeight().fillMaxWidth(p.fill.coerceIn(0f, 1f)).clip(RoundedCornerShape(99.dp))
                    .background(Brush.horizontalGradient(listOf(Color(0xFFC69F78), Color(0xFFA3D7AD)))))
            }
            Text(p.caption, style = sans(11f, 400, Mute, lh = 1.5f))
        }
    } }
    val mod = Modifier.fillMaxWidth().sitePanel(18.dp).clickable(onClick = onClick)
    if (big) Row(mod.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        identity(Modifier.weight(1.18f)); progress(Modifier.weight(1f))
    } else Column(mod.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { identity(Modifier); progress(Modifier) }
}

/**
 * A line with its set badge or rarity mark in place (style.css .tset: an 11 / 700 chip on the second surface, 6 corners, 1 6 in, the code
 * at 14 / 900 and the rarity code 4 lower at 10 / 800 in its foil; .cd-set small img.pkr: 9 tall).
 */
@Composable
private fun PartsLine(parts: List<TcgPart>, style: TextStyle, modifier: Modifier = Modifier) {
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    val density = LocalDensity.current
    val code = sans(14f, 900, Ink, lh = 1.4f); val rx = sans(10f, 800, Ink, lh = 1.45f)
    val inline = HashMap<String, InlineTextContent>()
    val text = buildAnnotatedString {
        parts.forEachIndexed { i, p -> when {
            p.tset != null -> { val b = p.tset
                val w = with(density) { (measurer.measure(b.code, code).size.width + (if (b.rarity.isNotBlank()) measurer.measure(b.rarity, rx).size.width else 0)).toDp() } +
                    (if (b.rarity.isNotBlank()) 3.dp else 0.dp) + 14.dp
                inline["p$i"] = InlineTextContent(Placeholder(with(density) { w.toSp() }, 24.sp, PlaceholderVerticalAlign.TextCenter)) {
                    Row(Modifier.fillMaxSize().clip(RoundedCornerShape(6.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 1.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(b.code, style = code, maxLines = 1, softWrap = false)
                        if (b.rarity.isNotBlank()) Box(Modifier.padding(top = 4.dp)) { RxCode(b.rarity, b.rarityKind, 10f, Motion.still) }
                    }
                }
                appendInlineContent("p$i", b.code + " " + b.rarity)
            }
            p.img.isNotEmpty() -> {
                inline["p$i"] = InlineTextContent(Placeholder(2.4.em, .75.em, PlaceholderVerticalAlign.TextCenter)) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { PkSymbol(p.img, 28.dp, ink = p.ink, glow = !p.ink, height = 9.dp) }
                }
                appendInlineContent("p$i", p.alt)
            }
            else -> withStyle(SpanStyle(fontWeight = if (p.bold) FontWeight.Bold else null)) { append(p.t.orEmpty()) }
        } }
    }
    Text(text, style = style, inlineContent = inline, modifier = modifier)
}

/** A set's symbol masked with its rarity's colours (the site's .set-icon over --icon). */
@Composable
private fun SetSymbol(s: CardSetSummary, size: Dp) {
    if (s.icon.isNotBlank()) {
        val p = heroPainter(s.icon.let(homeArt))
        if (p != null) { Box(Modifier.size(size)) { Image(p, s.iconTitle, Modifier.fillMaxSize().graphicsLayerOffscreen().drawWithBrush(rarityBrush(s.rarity)),
            colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(Color.White, androidx.compose.ui.graphics.BlendMode.SrcIn)) }; return }
    }
    RaritySetIcon(s.code, s.rarity, size)
}

/**
 * .card-price-summary: TCGplayer Buy, the market reference (a tap jumps to its history), "Your price" and "Add to collection".
 * A phone puts them two by two; from 600 wide they share one line.
 */
@Composable
private fun PriceSummary(p: CardPrice, glyphs: Map<String, SiteSvg>, big: Boolean, act: CollectionCardActions) {
    val uri = LocalUriHandler.current
    val buy: @Composable (Modifier) -> Unit = { mod -> p.buy?.let { b ->
        Gold(mod, h = 48.dp, onClick = { runCatching { uri.openUri(b.href) } }) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(b.brand, style = sans(11f, 700, BtnInk, lh = 1.35f, ls = .22f)); Text(b.label, style = sans(13.5f, 700, BtnInk, lh = 1.35f))
            }
        }
    } }
    val ref: @Composable (Modifier) -> Unit = { mod -> p.ref?.let { r ->
        Column(mod.clip(RoundedCornerShape(8.dp)).clickable { r.press?.let(act.press) }.padding(vertical = 4.dp, horizontal = if (big) 0.dp else 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(r.value, style = sans(if (big) 22f else 18f, 700, Ink, lh = 1.2f)); Text(r.label, style = sans(11f, 400, Mute, lh = 1.4f))
            if (r.finish.isNotBlank()) Text(r.finish, style = sans(11f, 400, Mute, lh = 1.4f))
        }
    } }
    val mine: @Composable (Modifier) -> Unit = { mod -> p.mine?.let { Ghost(it.label, null, mod, h = 48.dp, fs = 12f) { act.press(it) } } }
    val add: @Composable (Modifier) -> Unit = { mod -> p.add?.let { a ->
        Gold(mod, h = 48.dp, onClick = { act.press(a) }) {
            Row(verticalAlignment = Alignment.CenterVertically) { (a.icon ?: glyphs["plus"])?.let { SiteIcon(it, 18.dp, BtnInk); Spacer(Modifier.width(4.dp + 6.dp)) }
                Text(a.label, style = sans(13.5f, 700, BtnInk, lh = 1.35f)) }
        }
    } }
    if (big) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        buy(Modifier.width(100.dp)); ref(Modifier.weight(1f)); mine(Modifier); add(Modifier)
    } else Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) { buy(Modifier.weight(.4f).fillMaxHeight()); ref(Modifier.weight(.6f)) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { mine(Modifier.weight(.4f)); add(Modifier.weight(.6f)) }
    }
}

// ---------------------------------------------------------------- Overview

/** .cs-card: the card and its finishes and printings; beside it (over 600 wide) or under it, the rules text and what you do with it. */
@Composable
private fun Overview(m: CollectionCardModel, o: CardOverview, act: CollectionCardActions, two: Boolean, gutter: Dp, onZoom: () -> Unit) {
    Column(Modifier.padding(horizontal = gutter).padding(top = 6.dp, bottom = 12.dp)) {
        if (o.pickers.isNotEmpty()) Pickers(o.pickers, act, Modifier.padding(bottom = 12.dp), o.pickersFoot)
        if (two) Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
            Box(Modifier.weight(.45f)) { ArtStack(m, o, act, onZoom) }
            Box(Modifier.weight(.55f)) { Side(m, o, act, 14.dp) }
        } else Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) { Box(Modifier.widthIn(max = 310.dp)) { ArtStack(m, o, act, onZoom) } }
            Side(m, o, act, 8.dp)
        }
    }
}

/** workbench-ui.js's pickers (.ygo-price-preview, .price-selectors): each label (12.5 / 600, muted) over its glass select, 10 apart; then the note. */
@Composable
private fun Pickers(pickers: List<TcgPicker>, act: CollectionCardActions, modifier: Modifier = Modifier, foot: String = "") {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        pickers.forEach { p -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(p.title, style = sans(12.5f, 600, Mute, lh = 1.45f))
            SiteSelect(p.options, 12.5f, p.options.indexOfFirst { it.on }.coerceAtLeast(0)) { i -> act.select(p.name, p.options[i].value) }
        } }
        if (foot.isNotBlank()) Text(foot, style = sans(12f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(bottom = 6.dp))
    }
}

/** .cd-art-stack: the card in its tier frame and finish (tap to enlarge), the flip, the finish chips, profile photo, other printings. */
@Composable
private fun ArtStack(m: CollectionCardModel, o: CardOverview, act: CollectionCardActions, onZoom: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val data = dev.cardstashy.nativeplay.play.CardData.ready.collectAsStateValue()
        val ctx = androidx.compose.ui.platform.LocalContext.current
        LaunchedEffect(Unit) { if (data == null) dev.cardstashy.nativeplay.play.CardData.warm(ctx) }
        val tcg = m.game != CardGame.MTG
        val finish = Foil.finishFor(m.shown, o.finishKey.ifBlank { "nonfoil" })
        val look = if (tcg) null else data?.let { Foil.look(it, m.shown, finish) }
        val worn = remember(o.tcgFinish, o.image) { o.tcgFinish?.let { tcgFinishOf(ctx, m.game, it, o.image) } }
        val lean = rememberCardLean()
        val touch = remember(lean) { derivedStateOf { lean.light } }
        val shines = look?.takeIf { it.shines }
        val tilt = rememberFoilTilt(live = look?.recipe != null || worn != null, touch = touch)
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            // --frame-w: clamp(6px, 2.4vw, 10px); the card inside at 6 corners.
            val frameW = (androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.dp * .024f).coerceIn(6.dp, 10.dp)
            // A Yu-Gi-Oh! card is 59 × 86.
            val w = maxWidth; val cardH = (w - frameW * 2) * (if (m.game == CardGame.YGO) 86f / 59f else 88f / 63f) + frameW * 2
            TierFrame(o.tier, w, cardH, frameW) {
                val mod = Modifier.fillMaxSize().cardLean(lean, foil = shines != null || worn != null, shape = RoundedCornerShape(6.dp))
                    .pointerInput(Unit) { detectTapGestures(onLongPress = {}) { onZoom() } }.semantics { contentDescription = "Enlarge ${m.name}" }
                if (!tcg) CardPicture(o.image, shines, tilt, mod, shape = RoundedCornerShape(6.dp))
                else firstOf(o.sources.ifEmpty { listOf(o.image) }).let { p -> if (p != null) CardFace(p, null, tilt, mod, RoundedCornerShape(6.dp), finish = worn)
                    else Box(mod.clip(RoundedCornerShape(6.dp)).background(Surface2)) }
            }
        }
        o.flip?.let { f -> Ghost(f.label, f.icon, Modifier.fillMaxWidth(), fs = 13.5f) { act.face() } }
        if (o.finishes.isNotEmpty()) Column(Modifier.padding(vertical = 10.dp)) {
            Text(o.finishLabel, style = sans(13f, 400, Mute, lh = 1.45f))
            Row(Modifier.padding(top = 5.6.dp).horizontalScroll(rememberScrollState()).padding(start = 1.6.dp, end = 1.6.dp, top = 2.4.dp, bottom = 5.6.dp),
                horizontalArrangement = Arrangement.spacedBy(5.6.dp)) {
                o.finishes.forEach { c ->
                    Row(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(999.dp)).background(Surface2).border(1.dp, if (c.on) GoldC else Color(0xFF353B46), RoundedCornerShape(999.dp))
                        .clickable { c.press?.takeIf { tcg }?.let(act.press) ?: act.finish(c.finish) }.padding(horizontal = 9.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.4.dp)) {
                        Swatch(c.swatch, glint = c.on && c.press?.act == "ygoPickRarity"); Text(c.label, style = sans(12f, 700, Ink, lh = 1.45f))
                    }
                }
            }
            if (o.finishFoot.isNotBlank()) Text(o.finishFoot, style = sans(12f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(vertical = 7.2.dp))
        }
        o.profile?.let { p -> Ghost(p.label, null, Modifier.fillMaxWidth()) { act.profile() } }
        o.printings?.let { Printings(it, act) }
    }
}

/**
 * .rarity-swatch (finish-effects.css 146-160): 16 square, 5 corners, a hair edge (the ink at 30 %), #8b8f96 unless its kind paints
 * it: plain, silver, rainbow, ultra (a 2 px gold ring inside), diagonal and parallel stripes, the prism's 6 px checks, gold, platinum
 * (a sheen over steel), glitter (three white sparks), ghost (greyed to 30 %), emboss (lit and shaded edges) and foilcard. The chosen
 * Yu-Gi-Oh! rarity glints (brightness 1 → 1.35 → 1 over 2.4 s) unless motion is reduced.
 */
@Composable
private fun Swatch(kind: String, glint: Boolean = false) {
    val k = if (glint && !Motion.still) rememberInfiniteTransition(label = "glint").animateFloat(0f, 1f, infiniteRepeatable(tween(1200, easing = androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse), label = "glint") else null
    Box(Modifier.size(16.dp).clip(RoundedCornerShape(5.dp)).drawBehind {
        paintSwatch(kind, 1f, null)
        // filter: brightness(1.35) at the peak: the same paint added again at up to .35.
        k?.value?.takeIf { it > 0f }?.let { paintSwatch(kind, .35f * it, androidx.compose.ui.graphics.BlendMode.Plus) }
    }.border(1.dp, Color(0x4DEDEFF4), RoundedCornerShape(5.dp)))
}

private fun hex(v: Long) = Color(v)
/** CSS saturate(s): each colour pulled toward its luminance. */
private fun Color.saturate(s: Float): Color { val l = .2126f * red + .7152f * green + .0722f * blue
    return Color((l + (red - l) * s).coerceIn(0f, 1f), (l + (green - l) * s).coerceIn(0f, 1f), (l + (blue - l) * s).coerceIn(0f, 1f), alpha) }

private fun DrawScope.paintSwatch(kind: String, a: Float, blend: androidx.compose.ui.graphics.BlendMode?) {
    val bm = blend ?: androidx.compose.ui.graphics.BlendMode.SrcOver
    fun lin(deg: Float, vararg st: Pair<Float, Color>) { val rad = Math.toRadians(deg.toDouble()); val dx = sin(rad).toFloat(); val dy = -cos(rad).toFloat()
        val len = abs(size.width * dx) + abs(size.height * dy); val c = Offset(size.width / 2, size.height / 2); val half = Offset(dx * len / 2, dy * len / 2)
        drawRect(Brush.linearGradient(*st, start = c - half, end = c + half), alpha = a, blendMode = bm) }
    // repeating-linear-gradient: hard bands [period] px long along [deg], from the gradient line's start.
    fun stripes(deg: Float, band: Float, cs: List<Color>) { val rad = Math.toRadians(deg.toDouble()); val dx = sin(rad).toFloat(); val dy = -cos(rad).toFloat()
        val len = abs(size.width * dx) + abs(size.height * dy); val c = Offset(size.width / 2, size.height / 2); val st = c - Offset(dx * len / 2, dy * len / 2)
        val period = band.dp.toPx() * cs.size; val stops = cs.flatMapIndexed { i, col -> listOf(i.toFloat() / cs.size to col, (i + 1f) / cs.size to col) }.toTypedArray()
        drawRect(Brush.linearGradient(*stops, start = st, end = st + Offset(dx * period, dy * period), tileMode = androidx.compose.ui.graphics.TileMode.Repeated), alpha = a, blendMode = bm) }
    fun ring(w: Float, col: Color) { val px = w.dp.toPx(); drawRoundRect(col, Offset(px / 2, px / 2), Size(size.width - px, size.height - px), CornerRadius(5.dp.toPx() - px / 2), style = androidx.compose.ui.graphics.drawscope.Stroke(px), alpha = a, blendMode = bm) }
    when (kind) {
        "plain" -> lin(135f, 0f to hex(0xFF6F737A), 1f to hex(0xFF9A9EA6))
        "silver" -> lin(135f, 0f to hex(0xFF7C8796), .45f to hex(0xFFEEF3F8), .6f to hex(0xFF9AA6B4), 1f to hex(0xFFDDE4EC))
        "rainbow" -> lin(135f, 0f to hex(0xFF4FB6E6), .3f to hex(0xFFA98BE6), .52f to hex(0xFFF0A0B8), .72f to hex(0xFFF2D27A), 1f to hex(0xFF7FD3A6))
        "ultra" -> { lin(135f, 0f to hex(0xFF4FB6E6), .3f to hex(0xFFA98BE6), .52f to hex(0xFFF0A0B8), 1f to hex(0xFF7FD3A6)); ring(2f, hex(0xFFE3B44F)) }
        "diagonal" -> stripes(135f, 2f, listOf(hex(0xFF9FD8EC), hex(0xFFD6B2EE), hex(0xFFF4D891)))
        "parallel" -> stripes(0f, 1.5f, listOf(hex(0xFFA5DCEF), hex(0xFFE2C2F2), hex(0xFFF6DDA0)))
        "prism" -> { val t = 6.dp.toPx(); val h = t / 2; var y = 0f
            // conic-gradient in 6 px tiles: from twelve o'clock, a quarter each.
            while (y < size.height) { var x = 0f
                while (x < size.width) {
                    drawRect(hex(0xFF9FD8EC), Offset(x + h, y), Size(h, h), alpha = a, blendMode = bm); drawRect(hex(0xFFF0B0D0), Offset(x + h, y + h), Size(h, h), alpha = a, blendMode = bm)
                    drawRect(hex(0xFFF4D891), Offset(x, y + h), Size(h, h), alpha = a, blendMode = bm); drawRect(hex(0xFFA6E4C2), Offset(x, y), Size(h, h), alpha = a, blendMode = bm)
                    x += t }
                y += t } }
        "gold" -> lin(135f, 0f to hex(0xFF8C5F17), .45f to hex(0xFFF4D27D), .62f to hex(0xFFB8862D), 1f to hex(0xFFFFE9A8))
        "platinum" -> { lin(135f, 0f to hex(0xFF6F7A8E), .4f to hex(0xFFDFE6F2), .64f to hex(0xFF8F9BB0), 1f to hex(0xFFC9D2E2))
            lin(135f, 0f to Color.Transparent, .38f to Color.Transparent, .46f to hex(0xAAB8E4F4), .52f to hex(0xAAE6C8F4), .58f to hex(0xAAF4E2B0), .66f to Color.Transparent, 1f to Color.Transparent) }
        "glitter" -> { lin(135f, 0f to hex(0xFF5AB6E8), .5f to hex(0xFFC08AE8), 1f to hex(0xFFF1C26E))
            for ((fx, fy, r) in listOf(Triple(.25f, .3f, 1f), Triple(.7f, .65f, 1f), Triple(.6f, .2f, .8f))) { val c = Offset(size.width * fx, size.height * fy); val rr = r.dp.toPx()
                drawCircle(Brush.radialGradient(0f to Color.White, .5f to Color.White, 1f to Color.Transparent, center = c, radius = rr * 2), rr * 2, c, alpha = a, blendMode = bm) } }
        "ghost" -> lin(135f, 0f to hex(0xFFC9D6E6).saturate(.3f), .4f to Color.White, .6f to hex(0xFFA9B8CC).saturate(.3f), 1f to hex(0xFFE8EEF6).saturate(.3f))
        "emboss" -> { lin(145f, 0f to hex(0xFFF2D690), .55f to hex(0xFF9A6D22), 1f to hex(0xFFF7E2A6)); val px = 1.dp.toPx()
            drawRect(hex(0x66FFFFFF), Offset.Zero, Size(size.width, px), alpha = a, blendMode = bm); drawRect(hex(0x66FFFFFF), Offset.Zero, Size(px, size.height), alpha = a, blendMode = bm)
            drawRect(hex(0x55000000), Offset(0f, size.height - px), Size(size.width, px), alpha = a, blendMode = bm); drawRect(hex(0x55000000), Offset(size.width - px, 0f), Size(px, size.height), alpha = a, blendMode = bm) }
        "foilcard" -> { lin(135f, 0f to hex(0xFF7FD0EA), .4f to hex(0xFFC8A6EE), .7f to hex(0xFFF3C6A0), 1f to hex(0xFF9FE0BF)); ring(1f, hex(0x88FFFFFF)) }
        else -> drawRect(hex(0xFF8B8F96), alpha = a, blendMode = bm)
    }
}

/**
 * .cd-zoom's tier frame (style.css 5073-5082): a band --frame-w wide around the card in its price tier's colours (silver, green,
 * blue, the swirling t3, the shining gold t4 and ember t5) with its two-tone aura.
 */
@Composable
private fun TierFrame(tier: String, w: Dp, h: Dp, frameW: Dp, content: @Composable () -> Unit) {
    val (a1, a2, mix) = when (tier) {
        "t1" -> Triple(Color(0xFF7BE3A8), Color(0xFF2FAE68), .55f); "t2" -> Triple(Color(0xFF8CC6FF), Color(0xFF2F7FE0), .6f)
        "t3" -> Triple(Color(0xFFB46CFF), Color(0xFF6FD0FF), .7f); "t4" -> Triple(Color(0xFFFFD34D), Color(0xFFFFB020), .7f)
        "t5" -> Triple(Color(0xFFFF7A1A), Color(0xFFFFD08A), .75f); else -> Triple(Color(0xFFA7AFB8), Color(0xFF6F7780), .3f)
    }
    val moving = tier in setOf("t3", "t4", "t5") && !Motion.still
    val p = if (moving) rememberInfiniteTransition(label = "tier").animateFloat(0f, 1f, infiniteRepeatable(tween(when (tier) { "t3" -> 6000; "t4" -> 3400; else -> 2600 }, easing = LinearEasing),
        if (tier == "t3") RepeatMode.Restart else RepeatMode.Reverse), label = "tier").value else 0f
    Box(Modifier.size(w, h).drawBehind {
        // The aura: -12/-9 and 12/9 at 52 blur, -8 spread, in the tier's two colours; then a 78 glow of the first.
        val rx = size.width * .0475f + frameW.toPx(); val ry = size.height * .035f + frameW.toPx()
        drawIntoAura(a1.copy(alpha = mix), Offset(-12f, -9f), rx, ry); drawIntoAura(a2.copy(alpha = mix), Offset(12f, 9f), rx, ry)
        val cr = CornerRadius(rx, ry)
        when (tier) {
            "t1" -> cssLinear(160f, 0f to Color(0xFF7BE3A8), 1f to Color(0xFF2FAE68), corner = cr)
            "t2" -> cssLinear(160f, 0f to Color(0xFF8CC6FF), 1f to Color(0xFF2F7FE0), corner = cr)
            "t3" -> { val path = androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, size.width, size.height, cr)) }
                clipPath(path) { rotate(p * 360f) { val b = maxOf(size.width, size.height) * 1.5f
                    drawRect(Brush.sweepGradient(listOf(Color(0xFFB46CFF), Color(0xFF6FD0FF), Color(0xFFFF7AD9), Color(0xFFB46CFF)), center = center),
                        topLeft = center - Offset(b, b), size = Size(b * 2, b * 2)) } } }
            "t4", "t5" -> { val stops = if (tier == "t4") listOf(Color(0xFFB8860B), Color(0xFFFFD34D), Color(0xFFFFF6C9), Color(0xFFFFD34D), Color(0xFFB8860B))
                else listOf(Color(0xFFC2410C), Color(0xFFFF7A1A), Color(0xFFFFD08A), Color(0xFFFF7A1A), Color(0xFFC2410C))
                // background-size 300 %: the gradient is three boxes wide and slides across.
                val span = size.width * 3f; val x0 = -p * (span - size.width)
                drawRoundRect(Brush.linearGradient(*stops.zip(listOf(0f, .3f, .45f, .6f, 1f)).map { it.second to it.first }.toTypedArray(), start = Offset(x0, 0f),
                    end = Offset(x0 + span, span * .47f)), cornerRadius = cr) }
            else -> cssLinear(160f, 0f to Color(0xFFA7AFB8), 1f to Color(0xFF6F7780), corner = cr)
        }
    }.padding(frameW)) { content() }
}

private fun DrawScope.drawIntoAura(color: Color, off: Offset, rx: Float, ry: Float) {
    drawIntoCanvasCompat { c ->
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            this.color = android.graphics.Color.TRANSPARENT
            setShadowLayer(26.dp.toPx(), off.x.dp.toPx(), off.y.dp.toPx(), android.graphics.Color.argb((color.alpha * 255).roundToInt(), (color.red * 255).roundToInt(), (color.green * 255).roundToInt(), (color.blue * 255).roundToInt()))
        }
        val s = 8.dp.toPx()
        c.drawRoundRect(s, s, size.width - s, size.height - s, rx, ry, paint)
    }
}
private fun DrawScope.drawIntoCanvasCompat(block: (android.graphics.Canvas) -> Unit) = drawIntoCanvas { block(it.nativeCanvas) }

/** .card-printing-preview: "Other printings" and Sort & filter, the swipe rail of minis, its notes and foot. */
@Composable
private fun Printings(p: CardPrintings, act: CollectionCardActions) {
    Column(Modifier.padding(top = 18.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xD9171A1F)).border(1.dp, LineC, RoundedCornerShape(18.dp)).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(p.title, style = manrope(14f, 700, Ink, lh = 1.15f, ls = -.28f), modifier = Modifier.weight(1f))
            p.more?.let { b -> Text(b.label, style = sans(13f, 600, GoldC, lh = 1.45f), modifier = Modifier.clickable { act.press(b) }.padding(vertical = 4.dp)) }
        }
        if (p.rows.isNotEmpty()) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(start = 2.dp, end = 2.dp, top = 14.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            p.rows.forEach { r ->
                Column(Modifier.width(100.dp).clip(RoundedCornerShape(10.dp)).then(if (r.on) Modifier.border(1.dp, GoldC, RoundedCornerShape(10.dp)) else Modifier)
                    .clickable { r.press?.let(act.press) ?: act.print(r.i) }.padding(5.dp).semantics { contentDescription = r.aria }, horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    val pic = heroPainter(r.src.ifBlank { null }?.let(homeArt))
                    // img 88 × 123, contain; the set's name wraps anywhere, unclamped (a long name makes the whole rail taller).
                    // img[data-tier]: outline 2 px inside the box in --tier (t3-t5 glow 0 0 12 -3 in it too).
                    val ring = r.tier.takeIf { r.tierKey.isNotBlank() }?.let { cssColor(it, Ink) }
                    Box(Modifier.size(88.dp, 123.dp).then(if (ring != null && r.tierKey in setOf("t3", "t4", "t5")) Modifier.drawBehind {
                        drawRoundRect(Brush.radialGradient(listOf(ring.copy(alpha = .55f), Color.Transparent), center, size.maxDimension * .62f), Offset(-6.dp.toPx(), -6.dp.toPx()), Size(size.width + 12.dp.toPx(), size.height + 12.dp.toPx()), CornerRadius(8.dp.toPx()))
                    } else Modifier).clip(RoundedCornerShape(5.dp))) {
                        if (pic != null) Image(pic, null, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                        if (ring != null) Box(Modifier.fillMaxSize().border(2.dp, ring, RoundedCornerShape(5.dp)))
                    }
                    Text(r.name, style = sans(10f, 700, Ink, lh = 1.3f), textAlign = TextAlign.Center)
                    Text(r.num, style = sans(10f, 400, Mute, lh = 1.45f), textAlign = TextAlign.Center)
                }
            }
        }
        p.notes.forEach { n -> Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(n.text, style = sans(13f, 400, Mute, lh = 1.45f), modifier = Modifier.weight(1f, fill = false))
            n.retry?.let { r -> Text(r.label, style = sans(13f, 600, GoldC), modifier = Modifier.padding(start = 6.dp).clickable { act.press(r) }) }
        } }
        if (p.foot.isNotBlank()) Text(p.foot, style = sans(10f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(top = 8.dp))
    }
}

/** .cs-card-side: explore, the rules text, the rules chip, decks it is in, the open deck's stepper, chips, the fact, research, your copies, actions. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Side(m: CollectionCardModel, o: CardOverview, act: CollectionCardActions, gap: Dp) {
    val uri = LocalUriHandler.current
    fun go(p: CardPress) { if (p.href.isNotBlank() && p.act.isBlank()) runCatching { uri.openUri(p.href) } else act.press(p) }
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        Column {
            if (o.discoverySummary.isNotBlank()) Discovery(o, ::go)
            o.faces.forEach { f -> Face(f, act, ::go) }
            o.loading?.let { l -> Text(l.text, style = sans(13f, 400, Mute), textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) }
            o.rulesEntry?.let { r -> Box(Modifier.padding(top = 8.dp)) { Chip(r.label) { go(r) } } }
        }
        o.alert?.let { a -> Column(Modifier.fillMaxWidth().siteGlass(12.dp).clickable { go(a) }.padding(10.dp)) {
            Text(o.alertTitle, style = sans(13f, 700, Ink)); Text(o.alertLine, style = sans(12f, 400, Mute)) } }
        if (o.own.isNotBlank() && !o.ownInActions) Text(o.own, style = sans(13f, 400, if (o.ownMuted) Mute else Ink, lh = 1.5f), modifier = Modifier.padding(bottom = 4.dp))
        o.legal?.let { l -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            val c = when (l.level) { "ok" -> Good; "warn" -> Warn; else -> Bad }
            SiteIcon(l.icon, 14.dp, c)
            Text(buildAnnotatedString { append(l.text); if (l.deck.isNotBlank()) withStyle(SpanStyle(color = Mute)) { append(" " + l.deck) } }, style = sans(13f, 400, c))
        } }
        o.deck?.let { d -> DeckPanel(d, m.glyphs, ::go) }
        Secondary(o, ::go)
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(LineC))
            if (o.own.isNotBlank() && o.ownInActions) Text(o.own, style = sans(13f, 400, if (o.ownMuted) Mute else Ink, lh = 1.5f))
            o.owned.forEach { g -> OwnedGroup(g, m.glyphs, ::go) }
            if (o.owned.isNotEmpty()) Box(Modifier.fillMaxWidth().height(1.dp).background(LineC))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                o.main.forEach { b -> Ghost(b.label, b.icon, Modifier.fillMaxWidth(), r = 999.dp, fs = 15f) { go(b) } }
                // .cs-card-side .ca-more (style.css 3253): flex-wrap, each button flex 1 1 auto, 8 apart.
                if (o.more.isNotEmpty()) FlexWrap(Modifier.fillMaxWidth(), 8.dp, grow = true) { o.more.forEach { b -> Ghost(b.label, b.icon, Modifier.fillMaxWidth(), fs = 13f) { go(b) } } }
            }
        }
    }
}

/** details.card-discovery: "Explore types & abilities", closed; open, its note and a chip per property. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Discovery(o: CardOverview, go: (CardPress) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable { open = !open }, verticalAlignment = Alignment.CenterVertically) {
            // polish.css 646: the summary is a flex row, so it has no disclosure marker.
            Text(o.discoverySummary, style = sans(15f, 400, Ink))
        }
        if (open) {
            Text(o.discoveryText, style = sans(13f, 400, Mute, lh = 1.45f))
            FlowRow(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { o.discovery.forEach { c -> Chip(c.label) { go(c) } } }
        }
    }
}

/** .cd-text: "Spellcraft · Rules text", the oracle lines, the flavour (Georgia, italic) and P/T or loyalty with the artist. */
@Composable
private fun Face(f: CardFace, act: CollectionCardActions, go: (CardPress) -> Unit) {
    Column(Modifier.padding(bottom = 10.dp).fillMaxWidth().siteGlass(14.dp).padding(12.dp)) {
        Text(f.eyebrow.uppercase(), style = Eyebrow, modifier = Modifier.padding(bottom = 14.dp))
        f.pk?.let { PkFace(it, act) }
        if (f.name.isNotBlank()) Row(verticalAlignment = Alignment.CenterVertically) { Text(f.name, style = sans(15f, 700), modifier = Modifier.weight(1f)); f.mana.forEach { Sym(it.src, it.alt, 16.dp) } }
        if (f.type.isNotBlank()) Text(f.type, style = sans(14f, 600, Ink))
        // .effect-line (style.css 2575): 14 / 1.7, 16 between paragraphs, wrapped "pretty".
        if (f.lines.isNotEmpty() && f.pk == null) Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { f.lines.forEach { Rich(it, sans(14f, 400, Ink, lh = 1.7f), act.rule, pretty = true) } }
        f.flavor?.let { fl ->
            Column(Modifier.padding(top = 22.dp, bottom = 6.dp).padding(start = 18.dp, top = 16.dp)) {
                Text(fl.let { f.flavorLabel }.uppercase(), style = Eyebrow.copy(fontFamily = FontFamily.Serif), modifier = Modifier.padding(bottom = 8.dp))
                Text(fl, style = TextStyle(fontFamily = FontFamily.Serif, fontStyle = FontStyle.Italic, fontSize = 14.5.sp, lineHeight = 21.sp, color = Color(0xFFC8C2B3)))
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(f.pt, style = sans(13f, 400, Mute), modifier = Modifier.weight(1f))
            f.artist?.let { a -> Text("🖌 ", style = sans(13f, 400, Mute))
                Text(a, style = sans(13f, 400, Mute).copy(textDecoration = TextDecoration.Underline), modifier = Modifier.clickable { f.artistPress?.let(go) }) }
        }
    }
}

/**
 * tcg.js pokemonText (style.css 867-886, 4742): "Evolves from" and the Pokémon; each Ability on a red wash (its tag 11 / 900 coral, upper case);
 * each attack, a hairline between them, its Energy orbs (16, 2 apart) and name, its damage at 18 / 800 Manrope; the card's own rules; then
 * Weakness, Resistance and Retreat in a muted 13 strip under a hairline.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PkFace(pk: PkText, act: CollectionCardActions) {
    // .pk-ability p, .pk-attack p: 15 / 1.45, 4 under the name.
    val body = sans(15f, 400, Ink, lh = 1.45f)
    Column(Modifier.fillMaxWidth()) {
        pk.evolves?.let { e -> Text(buildAnnotatedString { withStyle(SpanStyle(color = Mute)) { append(pk.evolvesLabel) }; append(" "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(e) } },
            style = sans(13f, 400, Ink, lh = 1.5f), modifier = Modifier.padding(bottom = 12.dp)) }
        pk.abilities.forEach { a -> Column(Modifier.padding(bottom = 8.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0x1FDC3C3C)).padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(buildAnnotatedString { withStyle(SpanStyle(color = Color(0xFFFF8A7A), fontSize = 11.sp, fontWeight = FontWeight(900), letterSpacing = .66.sp)) { append(a.tag.uppercase()) }
                append(" "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(a.name) } }, style = sans(15f, 400, Ink, lh = 1.45f))
            if (a.runs.isNotEmpty()) Rich(a.runs, body, act.rule, Modifier.padding(top = 4.dp))
        } }
        pk.attacks.forEachIndexed { i, a -> Column(Modifier.fillMaxWidth().then(if (i > 0) Modifier.topLine() else Modifier).padding(vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.padding(end = 6.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) { a.costs.forEach { c -> Box(Modifier.semantics { contentDescription = c.label }) { SiteIcon(c.icon, 16.dp, Ink) } } }
                    Text(a.name, style = sans(15f, 700, Ink, lh = 1.45f))
                }
                if (a.damage.isNotBlank()) Text(a.damage, style = manrope(18f, 800, Ink, lh = 1.2f))
            }
            if (a.runs.isNotEmpty()) Rich(a.runs, body, act.rule, Modifier.padding(top = 4.dp))
        } }
        pk.rules.forEach { Rich(it, body, act.rule, Modifier.padding(vertical = 4.dp)) }
        if (pk.strip.isNotEmpty()) FlowRow(Modifier.padding(top = 10.dp).fillMaxWidth().topLine().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)) {
            pk.strip.forEach { part -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                part.forEach { o -> if (o.icon != null) Box(Modifier.semantics { contentDescription = o.label }) { SiteIcon(o.icon, 16.dp, Ink) } else Text(o.t.orEmpty().trim(), style = sans(13f, 400, Mute, lh = 1.45f)) }
            } }
        }
    }
}

/** .panel.tight: "In <deck>" with its − n ＋ stepper, and Remove from deck. */
@Composable
private fun DeckPanel(d: CardDeckPanel, glyphs: Map<String, SiteSvg>, go: (CardPress) -> Unit) {
    Column(Modifier.padding(vertical = 12.dp).fillMaxWidth().siteGlass(14.dp).padding(horizontal = 12.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(d.title, style = sans(15f, 700), modifier = Modifier.weight(1f))
            Row(Modifier.clip(RoundedCornerShape(10.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(10.dp)).padding(1.dp), verticalAlignment = Alignment.CenterVertically) {
                d.steps.getOrNull(0)?.let { s -> Box(Modifier.size(30.dp, 28.dp).clickable { go(s) }.semantics { contentDescription = s.aria }, contentAlignment = Alignment.Center) { SiteIcon(glyphs["minus"], 18.dp, Mute) } }
                Text(d.qty.toString(), style = sans(14f, 700), textAlign = TextAlign.Center, modifier = Modifier.width(22.dp))
                d.steps.getOrNull(1)?.let { s -> Box(Modifier.size(30.dp, 28.dp).clickable { go(s) }.semantics { contentDescription = s.aria }, contentAlignment = Alignment.Center) { SiteIcon(glyphs["plus"], 18.dp, Mute) } }
            }
        }
        d.remove?.let { r -> Text(r.label, style = sans(13f, 600, Bad), modifier = Modifier.padding(top = 2.dp).clickable { go(r) }.padding(vertical = 4.dp)) }
    }
}

/** .cs-secondary: role and EDHREC chips, "Did you know?", Research links. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Secondary(o: CardOverview, go: (CardPress) -> Unit) {
    val gold = GoldC
    var fact by remember(o.facts, o.fact) { mutableStateOf(o.facts.indexOf(o.fact).coerceAtLeast(0)) }
    Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(LineC))
        if (o.stats.isNotEmpty()) StatGrid(o.stats)
        o.statHelp?.let { (summary, runs) -> var open by remember { mutableStateOf(false) }
            Column {
                Text(summary, style = sans(13f, 400, Mute, lh = 1.45f), modifier = Modifier.clickable { open = !open }.padding(vertical = 2.dp))
                if (open) Rich(runs, sans(13f, 400, Mute, lh = 1.45f), {}, Modifier.padding(top = 6.dp))
            }
        }
        if (o.chips.isNotEmpty()) FlowRow(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            o.chips.forEach { c -> Chip(c.label, roleColor(c.role) ?: if (c.warn) Warn else Ink) }
        }
        if (o.fact.isNotBlank()) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(gold.copy(alpha = .08f)).drawBehind {
            drawRect(gold.copy(alpha = .7f), size = Size(3.dp.toPx(), size.height))
        }.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(o.factLabel.uppercase(), style = sans(11f, 700, gold, lh = 1.45f, ls = .66f), modifier = Modifier.padding(bottom = 3.dp))
            Text(o.facts.getOrNull(fact) ?: o.fact, style = sans(13f, 400, Ink, lh = 1.45f), modifier = Modifier.padding(bottom = 4.dp))
            // facts.js nextFact: "Another fact ›" shows the next one, round again after the last.
            o.factNext?.takeIf { o.facts.size > 1 }?.let { n -> Text(n.label, style = sans(13f, 600, gold, lh = 1.45f), modifier = Modifier.clickable { fact = (fact + 1) % o.facts.size }) }
        }
        if (o.research.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text(o.researchLabel, style = sans(13f, 400, Mute))
            o.research.forEach { l -> Text(l.label, style = sans(14f, if (l.link) 600 else 650, GoldC, lh = 1.45f), modifier = Modifier.clickable { go(l) }.padding(vertical = 4.dp)) }
        }
    }
}

/**
 * .cs-card-side .stat-grid (style.css 768-771, 806, 4104-4121): on a phone two columns 5 apart, each box 7 in with its label (11, upper case,
 * muted, .025em) 3 over its value (15 / 700); the regulation mark and a long value take the full width. Wider: as many 160 columns as fit, 6 apart, 8 10 in.
 */
@Composable
private fun StatGrid(stats: List<TcgStat>) = BoxWithConstraints(Modifier.fillMaxWidth()) {
    val phone = maxWidth <= 520.dp
    val gap = if (phone) 5.dp else 6.dp
    val cols = if (phone) 2 else ((maxWidth + gap) / (160.dp + gap)).toInt().coerceAtLeast(1)
    val rows = ArrayList<List<TcgStat>>(); var line = ArrayList<TcgStat>()
    for (st in stats) {
        val full = phone && (st.wide || st.note.isNotBlank()) || stats.size == 1
        if (full) { if (line.isNotEmpty()) { rows += line; line = ArrayList() }; rows += listOf(st) }
        else { line += st; if (line.size == cols) { rows += line; line = ArrayList() } }
    }
    if (line.isNotEmpty()) rows += line
    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
        rows.forEach { r -> Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(gap)) {
            val n = if (r.size == 1 && (phone && (r[0].wide || r[0].note.isNotBlank()) || stats.size == 1)) 1 else cols
            r.forEach { st -> Column(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(10.dp)).background(Surface).border(1.dp, LineC, RoundedCornerShape(10.dp))
                .padding(if (phone) PaddingValues(7.dp) else PaddingValues(horizontal = 10.dp, vertical = 8.dp)), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(st.label.uppercase(), style = sans(11f, 400, Mute, lh = 1.45f, ls = if (phone) .275f else .66f))
                Text(st.value, style = sans(15f, 700, Ink, lh = if (phone) 1.25f else 1.45f))
                // .stat-reg span: 12 / 600, 2 under, in its tone.
                if (st.note.isNotBlank()) Text(st.note, style = sans(12f, 600, when (st.tone) { "ok" -> Good; "warn" -> Warn; "bad" -> Bad; else -> Mute }, lh = 1.3f), modifier = Modifier.padding(top = 2.dp))
            } }
            repeat(n - r.size) { Spacer(Modifier.weight(1f)) }
        } }
    }
}

/** The role chips' colours (style.css .chip.role-*). */
private fun roleColor(role: String): Color? = when (role) {
    "removal" -> Color(0xFFF08A6C); "ramp" -> Color(0xFF7FD3A6); "draw" -> Color(0xFF8CC6FF); "wipe" -> Color(0xFFFF9A8A); "counter" -> Color(0xFF9EB6FF)
    "tutor" -> Color(0xFFD6A8FF); "protection" -> Color(0xFFF2D27A); "finisher" -> Color(0xFFFFB86B); else -> null
}

/** .owned-group: the copy's condition · set · # · finish · language, and its − n ＋ pill (the count opens the copy). */
@Composable
private fun OwnedGroup(g: CardOwnedGroup, glyphs: Map<String, SiteSvg>, go: (CardPress) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(g.label, style = sans(12f, 400, Mute, lh = 1.5f), modifier = Modifier.weight(1f))
        Row(Modifier.clip(RoundedCornerShape(999.dp)).drawBehind { cssLinear(135f, 0f to Color(0x0BFFFFFF), 1f to Color(0x03FFFFFF)) }.border(1.dp, LineC, RoundedCornerShape(999.dp)).padding(1.dp),
            verticalAlignment = Alignment.CenterVertically) {
            g.steps.getOrNull(0)?.let { s -> Box(Modifier.size(44.dp).clip(CircleShape).clickable { go(s) }.semantics { contentDescription = s.aria }, contentAlignment = Alignment.Center) { SiteIcon(glyphs["minus"], 18.dp, Ink) } }
            Box(Modifier.size(44.dp).clip(CircleShape).clickable { g.details?.let(go) }, contentAlignment = Alignment.Center) { Text(g.qty.toString(), style = sans(12f, 700)) }
            g.steps.getOrNull(1)?.let { s -> Box(Modifier.size(44.dp).clip(CircleShape).clickable { go(s) }.semantics { contentDescription = s.aria }, contentAlignment = Alignment.Center) { SiteIcon(glyphs["plus"], 18.dp, Ink) } }
        }
    }
}

// ---------------------------------------------------------------- Meta and Play guide

/** #card-panel-meta: a section per format (h3 with its share, who plays it, the lists), "Deck ideas around this card", the foot. */
@Composable
private fun MetaPanel(m: CollectionCardModel, act: CollectionCardActions, gutter: Dp) {
    Column(Modifier.padding(horizontal = gutter)) {
        m.meta.forEach { blocks -> Column(Modifier.padding(vertical = 14.dp)) { Blocks(blocks, act, meta = true) } }
        if (m.metaFoot.isNotBlank()) Text(m.metaFoot, style = sans(12f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(top = 10.dp, bottom = 6.dp))
    }
}

/** .card-guide: the hero (its job), then each section (panels framed, the rest open), and the foot. */
@Composable
private fun GuidePanel(m: CollectionCardModel, act: CollectionCardActions, gutter: Dp) {
    Column(Modifier.padding(horizontal = gutter).padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        m.guide.forEach { s ->
            val framed = s.hero || s.panel
            Column(if (framed) Modifier.fillMaxWidth().sitePanel(18.dp).padding(horizontal = 16.dp, vertical = 14.dp) else Modifier.fillMaxWidth(),
                verticalArrangement = if (s.hero) Arrangement.spacedBy(10.dp) else Arrangement.Top) { Blocks(s.blocks, act, meta = false) }
        }
    }
}

/** The site's guide and meta blocks, one composable per kind of markup. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Blocks(blocks: List<CardBlock>, act: CollectionCardActions, meta: Boolean) {
    val uri = LocalUriHandler.current
    val pal = LocalSheetPal.current
    fun go(p: CardPress) {
        when {
            p.act == "card" && p.data["name"] != null -> act.card(p.data.getValue("name"))
            p.href.isNotBlank() && p.act.isBlank() -> runCatching { uri.openUri(p.href) }
            else -> act.press(p)
        }
    }
    val titleGap = if (meta) 4 else 12
    for ((i, b) in blocks.withIndex()) when (b.kind) {
        "title" -> FlowRow(Modifier.padding(bottom = titleGap.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.Bottom) {
            Text(b.text, style = manrope(16f, 700, Ink, lh = if (meta) 1.15f else 1.4f, ls = -.32f))
            if (b.sub.isNotBlank()) Text(b.sub, style = manrope(13f, 700, Mute, lh = 1.15f, ls = -.32f))
        }
        "eyebrow" -> Text(b.text.uppercase(), style = Eyebrow)
        "roles" -> FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            b.items.forEach { r -> Box(Modifier.heightIn(min = 30.dp).clip(RoundedCornerShape(999.dp)).then(if (r.main) Modifier.drawBehind {
                cssLinear(180f, 0f to pal.light, .58f to pal.gold, 1f to pal.dark) } else Modifier.background(Surface2).border(1.dp, LineC, RoundedCornerShape(999.dp)))
                .padding(horizontal = 12.dp, vertical = 4.dp), contentAlignment = Alignment.Center) {
                Text(r.label, style = sans(13f, 700, if (r.main) BtnInk else Ink, lh = 1.45f)) } }
        }
        "text" -> Rich(b.runs, if (b.lead) sans(15f, 400, Ink, lh = 1.5f) else if (b.small || b.muted) sans(13f, 400, if (b.muted) Mute else Ink, lh = 1.45f) else sans(15f, 400, Ink, lh = 1.45f),
            act.rule, Modifier.padding(vertical = if (b.lead) 0.dp else 6.dp))
        "steps" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            b.items.forEachIndexed { i, s -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(26.dp).clip(CircleShape).background(pal.gold.copy(alpha = .1f)).border(1.dp, pal.gold.copy(alpha = .45f), CircleShape), contentAlignment = Alignment.Center) {
                    Text("${i + 1}", style = sans(12f, 700, GoldC, lh = 1.2f)) }
                Rich(s.runs, sans(15f, 400, Ink, lh = 1.5f), act.rule, Modifier.weight(1f))
            } }
        }
        // .card-guide .guide-list: 18 in, 8 apart; the disc marker in gold sits in that 18.
        "list" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            b.items.forEach { s -> Row { Box(Modifier.width(18.dp).padding(start = 3.dp)) { Text("•", style = sans(15f, 400, GoldC, lh = 1.5f)) }
                Rich(s.runs, sans(15f, 400, Ink, lh = 1.5f), act.rule, Modifier.weight(1f)) } }
        }
        "along" -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            b.items.forEach { r -> Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).siteGlass(12.dp).clickable { r.press?.let(::go) }.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(r.name, style = sans(15f, 400, Ink), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1.4f))
                Box(Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(999.dp)).background(LineC)) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(r.fill.coerceIn(0f, 1f)).clip(RoundedCornerShape(999.dp)).background(GoldC)) }
                Text(r.pct, style = sans(13f, 700, Ink), textAlign = TextAlign.End, modifier = Modifier.width(40.dp))
            } }
        }
        // .card-guide .pair-list: a grid of repeat(auto-fill, minmax(min(100%, 300px), 1fr)), 8 apart, so a wide sheet shows two or
        // more a row, each row as tall as its tallest. style.css .pair-row: 6 in plus its 1px line; the picture 54 wide at a card's 488:680.
        "pairs" -> BoxWithConstraints(Modifier.fillMaxWidth()) {
            val cols = ((maxWidth.value + 8f) / 308f).toInt().coerceAtLeast(1)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                b.items.chunked(cols).forEach { line -> Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (r in line) Row(Modifier.weight(1f).fillMaxHeight().siteGlass(12.dp).clickable { r.press?.let(::go) }.padding(7.dp), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        val pic = heroPainter(r.image.ifBlank { null }?.let(homeArt))
                        Box(Modifier.width(54.dp).aspectRatio(488f / 680f).clip(RoundedCornerShape(4.dp)).background(Surface2)) { if (pic != null) Image(pic, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(r.name, style = sans(14f, 700, Ink)); if (r.why.isNotBlank()) Text(r.why, style = sans(11.5f, 400, Mute, lh = 1.4f))
                        }
                        if (r.score.isNotBlank()) Text(r.score, style = sans(12f, 800, GoldC), modifier = Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, pal.gold.copy(alpha = .4f), RoundedCornerShape(999.dp)).padding(horizontal = 8.dp, vertical = 2.dp))
                    }
                    repeat(cols - line.size) { Spacer(Modifier.weight(1f)) }
                } }
            }
        }
        // .list-head's 12 top margin folds into the h3's 12 bottom one right above it (block margins collapse), as in "Works with".
        "head" -> Text(b.text.uppercase(), style = sans(13f, 700, Ink, lh = 1.45f, ls = .78f),
            modifier = Modifier.padding(top = if (blocks.getOrNull(i - 1)?.kind == "title") (12 - titleGap).coerceAtLeast(0).dp else 12.dp, bottom = 4.dp))
        "limits" -> FlowRowEqual2(b.items) { r ->
            val c = when (r.level) { "ok" -> Good; "warn" -> Warn; else -> Bad }
            // polish.css 636-639: 8 12 8 14 in, the level's 3 wide bar 8 from each end; a grid, so a box stretched to its row's
            // height shares the spare height between its two lines.
            StretchRows(Modifier.fillMaxSize().siteGlass(14.dp).drawBehind {
                val bw = 3.dp.toPx(); val r3 = 3.dp.toPx()
                drawPath(androidx.compose.ui.graphics.Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(-r3, 8.dp.toPx(), bw, size.height - 8.dp.toPx(), CornerRadius(r3))) }, c)
            }.padding(start = 14.dp, end = 12.dp, top = 8.dp, bottom = 8.dp), gap = 2.dp) {
                // Only a format it is banned in colours its words (polish.css 640).
                Text(r.formats, style = sans(11f, 400, Mute, lh = 1.45f)); Text(r.copies, style = sans(13f, 700, if (r.level == "bad") Bad else Ink, lh = 1.45f))
            }
        }
        "rulings" -> Column(Modifier.padding(top = 12.dp).fillMaxWidth().drawBehind { drawRect(LineC, size = Size(size.width, 1.dp.toPx())) }.padding(top = 12.dp)) {
            Text(b.head.uppercase(), style = sans(13f, 700, Ink, lh = 1.45f, ls = .78f), modifier = Modifier.padding(bottom = 4.dp))
            b.items.forEach { r -> Column(Modifier.padding(vertical = 6.dp)) { Rich(r.runs, sans(14f, 400, Ink, lh = 1.5f), act.rule); Text(r.source, style = sans(12f, 400, Mute)) } }
            if (b.note.isNotBlank() && b.items.isEmpty()) Text(b.note, style = sans(13f, 400, Mute, lh = 1.45f))
            // .guide-link-list (polish.css 642-643, 669): each official source a 44 tall glass row, 8 14 in, 650 words and its ↗, 6 apart.
            if (b.buttons.isNotEmpty()) Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                b.buttons.forEach { l -> Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).siteGlass(12.dp).clickable { go(l) }.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(l.label, style = sans(15f, 650, Ink, lh = 1.45f), modifier = Modifier.weight(1f)); Text("↗", style = sans(15f, 650, Ink, lh = 1.45f))
                } }
            }
        }
        "rows" -> Column {
            // .mini-row: 9 / 2 in, a hairline under each but the last.
            b.items.forEachIndexed { i, r -> Row(Modifier.fillMaxWidth().clickable { r.press?.let(::go) }
                .then(if (i < b.items.lastIndex) Modifier.drawBehind { drawRect(LineC, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }.padding(bottom = 1.dp) else Modifier)
                .padding(horizontal = 2.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f)) { Text(r.title, style = sans(14f, 700, Ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(r.line, style = sans(11.5f, 400, Mute, lh = 1.45f), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                Text(r.go, style = sans(13f, 600, GoldC))
            } }
        }
        "buttons" -> FlowRow(Modifier.padding(top = if (meta) 10.dp else 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            b.buttons.forEach { p -> when {
                p.chip -> Chip(p.label, h = 44.dp) { go(p) }
                p.ghost -> Ghost(p.label, p.icon, h = if (p.small) 34.dp else 44.dp, pad = if (p.small) 12.dp else 16.dp) { go(p) }
                else -> Gold(h = 44.dp, pad = 16.dp, onClick = { go(p) }) { Row(verticalAlignment = Alignment.CenterVertically) {
                    p.icon?.let { SiteIcon(it, 18.dp, BtnInk); Spacer(Modifier.width(6.dp)) }; Text(p.label, style = sans(15f, 700, BtnInk)) } }
            } }
        }
        "foot" -> Text(b.text, style = sans(12f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(top = 10.dp, bottom = 6.dp))
        "more" -> { var open by remember { mutableStateOf(false) }
            Column { Text((if (open) "▾ " else "▸ ") + b.text.ifBlank { "More" }, style = sans(14f, 600, Ink), modifier = Modifier.clickable { open = !open }.padding(vertical = 8.dp))
                if (open) Blocks(b.blocks, act, meta) } }
        "group" -> Column { Blocks(b.blocks, act, meta) }
    }
}

/** .guide-limits: two equal columns. */
@Composable
private fun FlowRowEqual2(items: List<CardItem>, cell: @Composable (CardItem) -> Unit) = BoxWithConstraints(Modifier.padding(bottom = 10.dp)) {
    // grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)), 8 apart; each row as tall as its tallest box.
    val cols = ((maxWidth + 8.dp) / 140.dp).toInt().coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.chunked(cols).forEach { row -> Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { Box(Modifier.weight(1f).fillMaxHeight()) { cell(it) } }; repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
        } }
    }
}

/** A grid column of rows: each child at its own height, any spare height shared equally between them (align-content: stretch). */
@Composable
private fun StretchRows(modifier: Modifier, gap: Dp, content: @Composable () -> Unit) = androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
    val g = gap.roundToPx()
    val ps = ms.map { it.measure(c.copy(minWidth = 0, minHeight = 0)) }
    val natural = ps.sumOf { it.height } + g * (ps.size - 1).coerceAtLeast(0)
    val h = natural.coerceIn(c.minHeight, c.maxHeight)
    val extra = if (ps.isEmpty()) 0 else (h - natural).coerceAtLeast(0) / ps.size
    layout(c.maxWidth.takeIf { c.hasBoundedWidth } ?: (ps.maxOfOrNull { it.width } ?: 0), h) { var y = 0; ps.forEach { it.place(0, y); y += it.height + extra + g } }
}

// ---------------------------------------------------------------- Prices

/** Shots only: the Prices tab's folded parts (About these prices, Market details, a quote warning) drawn open. */
internal object CardSheetTest { var open = false }

private val Tnum = "tnum"
/** The site's glass field (select, .history-ranges): --glass-1 (31 35 43 / .52), the gold edge, a white top line (.07), a faint ring (.024). Not clipped. */
private fun Modifier.glassField(r: Dp): Modifier = this.drawBehind {
    val rr = minOf(r.toPx(), size.height / 2); val cr = CornerRadius(rr); val px = 1.dp.toPx()
    drawRoundRect(Color(0x851F232B), cornerRadius = cr)
    drawRoundRect(Color(0x06FFFFFF), topLeft = Offset(px, px), size = Size(size.width - px * 2, size.height - px * 2), cornerRadius = CornerRadius(rr - px),
        style = androidx.compose.ui.graphics.drawscope.Stroke(px))
    drawRect(Color(0x12FFFFFF), topLeft = Offset(rr * .7f, px), size = Size(size.width - rr * 1.4f, px))
}.border(1.dp, Edge, RoundedCornerShape(r))
/** A hairline along the top (border-top: 1px solid var(--line)). */
private fun Modifier.topLine(): Modifier = this.drawBehind { drawRect(LineC, size = Size(size.width, 1.dp.toPx())) }.padding(top = 1.dp)

/** <summary>: Chrome's disclosure triangle (right, or down when open), then the words. */
@Composable
private fun Summary(text: String, open: Boolean, style: TextStyle, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable(onClick = onClick).padding(horizontal = 2.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp, 7.dp).drawBehind {
            val w = size.width; val h = size.height
            drawPath(androidx.compose.ui.graphics.Path().apply { if (open) { moveTo(0f, h * .15f); lineTo(w, h * .15f); lineTo(w / 2, h * .95f) } else { moveTo(w * .1f, 0f); lineTo(w * .95f, h / 2); lineTo(w * .1f, h) }; close() }, style.color)
        })
        Spacer(Modifier.width(6.dp))
        Text(text, style = style)
    }
}

/** A <select> as glass-select.js draws it: the chosen option over the glass field and the arrow; a tap opens the list. */
@Composable
private fun SiteSelect(options: List<CardOpt>, fs: Float, selected: Int, onPick: (Int) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).glassField(11.dp).clip(RoundedCornerShape(11.dp)).clickable { open = true }.padding(horizontal = 12.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(options.getOrNull(selected)?.label.orEmpty(), style = sans(fs, 600, Ink, lh = 1.45f), modifier = Modifier.weight(1f))
            Box(Modifier.size(10.dp, 8.dp).drawBehind {
                drawPath(androidx.compose.ui.graphics.Path().apply { moveTo(0f, 0f); lineTo(size.width, 0f); lineTo(size.width / 2, size.height); close() }, Color(0xFFB4BAC6))
            })
        }
        androidx.compose.material3.DropdownMenu(open, { open = false }, containerColor = Color(0xFF1A1E26)) {
            options.forEachIndexed { i, o -> androidx.compose.material3.DropdownMenuItem(text = { Text(o.label, style = sans(14f, if (i == selected) 700 else 400, if (i == selected) GoldC else Ink)) },
                onClick = { open = false; if (i != selected) onPick(i) }) }
        }
    }
}

/** Words with their bold parts and tones, a control as a gold link (.link). */
@Composable
private fun Inline(runs: List<CardInline>, style: TextStyle, go: (CardPress) -> Unit) {
    Text(buildAnnotatedString {
        for (r in runs) when {
            r.press != null -> withLink(LinkAnnotation.Clickable("p:" + r.press.label, TextLinkStyles(SpanStyle(color = GoldC, fontWeight = FontWeight(600))) ) { go(r.press) }) { append(r.press.label) }
            else -> withStyle(SpanStyle(fontWeight = if (r.bold) FontWeight.Bold else null, color = when (r.tone) { "ok" -> Good; "warn" -> Warn; "bad" -> Bad; else -> Color.Unspecified })) { append(r.t.orEmpty()) }
        }
    }, style = style)
}

/**
 * The Prices tab (workbench-ui.js priceOverview, then views.js's Market details): the market price, your copy, the price
 * history for the finish chosen on Overview, the sellers, and the sources and finishes. [vw] and [vh] are the screen's, which
 * the site's media rules read (one column under 420, the roomier seller rows from 680, the shorter chart on a short sideways screen).
 */
@Composable
private fun PricesPanel(p: CardPrices, act: CollectionCardActions, gutter: Dp, vw: Dp, vh: Dp) {
    val uri = LocalUriHandler.current
    fun go(x: CardPress) = when {
        x.act == "marketRange" -> act.range(x.data["range"].orEmpty())
        x.act == "priceSource" -> act.source(x.data["src"].orEmpty())
        x.href.isNotBlank() && x.act.isBlank() -> { runCatching { uri.openUri(x.href) }; Unit }
        else -> act.press(x)
    }
    // Each piece with its CSS margins (top, bottom); siblings' margins collapse to the larger.
    val parts = ArrayList<Triple<Dp, Dp, @Composable () -> Unit>>()
    p.hero?.let { h -> parts += Triple(6.dp, 12.dp) { PriceHero(h, vw > 420.dp, act) } }
    p.copies.forEach { c -> parts += Triple(0.dp, 12.dp) { PriceCopy(c) } }
    p.warning?.let { w -> parts += Triple(12.dp, 12.dp) { QuoteWarning(w) } }
    p.history?.let { h -> parts += Triple(20.dp, 24.dp) { History(h, act, vw, vh, ::go) } }
    p.sellers?.let { s -> parts += Triple(0.dp, 24.dp) { Sellers(s, vw) { href -> runCatching { uri.openUri(href) } } } }
    p.details?.let { d -> parts += Triple(24.dp, 0.dp) { MarketDetails(d, act, ::go) } }
    Column(Modifier.padding(horizontal = gutter).fillMaxWidth()) {
        var prev = 0.dp
        parts.forEachIndexed { i, (top, bottom, draw) -> Spacer(Modifier.height(if (i == 0) top else maxOf(prev, top))); draw(); prev = bottom }
        Spacer(Modifier.height(prev))
    }
}

/** .price-fresh: a 28 pill, a 7 dot in its colour (green when fresh, amber when stale, muted when the date is unknown). */
@Composable
private fun Fresh(f: CardFresh) {
    val c = when (f.state) { "fresh" -> Good; "stale" -> Warn; else -> Mute }
    Row(Modifier.heightIn(min = 28.dp).clip(RoundedCornerShape(999.dp)).background(Color(0x851F232B)).border(1.dp, LineC, RoundedCornerShape(999.dp))
        .semantics { contentDescription = f.title.ifBlank { f.text } }.padding(horizontal = 10.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(c))
        Text(f.text, style = sans(12f, 700, c, lh = 1.45f), maxLines = 1, softWrap = false)
    }
}

/** .history-status: muted words behind a 2 gold rule. */
@Composable
private fun Status(text: String, modifier: Modifier = Modifier) {
    val gold = GoldC
    Text(text, style = sans(12f, 400, Mute, lh = 1.5f), modifier = modifier.fillMaxWidth().drawBehind { drawRect(gold, size = Size(2.dp.toPx(), size.height)) }.padding(start = 10.dp))
}

/** .price-hero: the market price, the printing it is for, and how fresh it is; the freshness sits beside it from 421 wide, under it below. */
@Composable
private fun PriceHero(h: CardPriceHero, two: Boolean, act: CollectionCardActions) {
    Column(Modifier.fillMaxWidth().sitePanel(18.dp).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(h.eyebrow.uppercase(), style = Eyebrow)
                Text(h.value, style = sans(32f, 800, Ink, lh = 1.15f, ls = -.64f).copy(fontFeatureSettings = Tnum))
                if (h.id.isNotBlank()) Text(h.id, style = sans(13f, 400, Mute, lh = 1.4f))
                if (h.rarity.isNotBlank()) Text(h.rarity, style = sans(12f, 700, GoldC, lh = 1.45f))
            }
            if (two) h.fresh?.let { Fresh(it) }
        }
        if (!two) h.fresh?.let { Fresh(it) }
        h.notes.forEach { Status(it, Modifier.padding(top = 4.dp)) }
        if (h.pickers.isNotEmpty()) Pickers(h.pickers, act, Modifier.padding(top = 6.dp))
    }
}

/** .price-copy: your saved copy at its condition, or your private value. */
@Composable
private fun PriceCopy(c: CardPriceCopy) {
    Column(Modifier.fillMaxWidth().sitePanel(18.dp).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) { Text(c.label, style = sans(12f, 400, Mute)); Text(c.title, style = sans(14f, 700, Ink)) }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(c.value, style = sans(18f, 700, Ink).copy(fontFeatureSettings = Tnum)); if (c.note.isNotBlank()) Text(c.note, style = sans(12f, 400, Mute), textAlign = TextAlign.End)
            }
        }
        if (c.foot.isNotBlank()) Text(c.foot, style = sans(12f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(top = 2.dp))
    }
}

/** .quote-warning: when the sources differ tenfold, a gold-edged note that opens to say why. */
@Composable
private fun QuoteWarning(w: Pair<String, String>) {
    var open by remember { mutableStateOf(CardSheetTest.open) }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x0CD6B35B)).border(1.dp, Color(0x66D6B35B), RoundedCornerShape(12.dp)).padding(horizontal = 14.dp)) {
        Summary(w.first, open, sans(12f, 400, Color(0xFFE6C780), lh = 1.5f)) { open = !open }
        if (open) Text(w.second, style = sans(12f, 400, Foot, lh = 1.45f), modifier = Modifier.padding(bottom = 12.dp))
    }
}

/** workbench-ui.js historyPanel: the series for the quote shown, its range buttons, the chart (or its one point), and what it covers. */
@Composable
private fun History(h: CardHistory, act: CollectionCardActions, vw: Dp, vh: Dp, go: (CardPress) -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    // padding: clamp(12px, 2.5vw, 22px); the panel's 160° wash of 5 % gold into the surface.
    val pad = (vw * .025f).coerceIn(12.dp, 22.dp)
    val ready = h.state == "ready" || h.state == "range-empty"
    val margins: (String) -> Pair<Dp, Dp> = { k -> when (k) {
        "identity" -> 10.dp to 14.dp; "status" -> 6.dp to 6.dp; "ranges" -> 14.dp to 14.dp; "chart" -> 12.dp to 6.dp; "single" -> 10.dp to 4.dp
        "coverage" -> 12.dp to 0.dp; "footStatus", "attribution" -> 10.dp to 6.dp; "about" -> 10.dp to 0.dp; else -> 0.dp to 0.dp } }
    Column(Modifier.fillMaxWidth().clip(shape).drawBehind { cssLinear(160f, 0f to Color(0xFF212223), 1f to Surface) }.border(1.dp, LineC, shape).padding(pad)) {
        var prev = 0.dp
        h.blocks.forEachIndexed { i, b ->
            val (top, bottom) = margins(b.kind)
            Spacer(Modifier.height(if (i == 0) top else maxOf(prev, top))); prev = bottom
            when (b.kind) {
                "head" -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    Text(b.title, style = manrope(16f, 700, Ink, lh = 1.4f, ls = -.32f), modifier = Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        if (b.value.isNotBlank()) Text(b.value, style = sans(20f, 700, Ink).copy(fontFeatureSettings = Tnum))
                        Text(b.label, style = sans(11f, 400, Mute), textAlign = TextAlign.End)
                    }
                }
                "title" -> Text(b.text, style = manrope(16f, 700, Ink, lh = 1.4f, ls = -.32f))
                "identity" -> Text(b.text, style = sans(11f, 400, Mute, lh = 1.6f))
                "status" -> Status(b.text)
                "footStatus" -> Status(b.text)
                "source" -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(b.label, style = sans(12.5f, 600, Mute))
                    SiteSelect(b.options, 12.5f, b.options.indexOfFirst { it.on }.coerceAtLeast(0)) { j -> act.historySource(b.key, b.options[j].value) }
                }
                "ranges" -> Row(Modifier.fillMaxWidth().glassField(999.dp).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    val pal = LocalSheetPal.current
                    b.ranges.forEach { r -> Box(Modifier.weight(1f).heightIn(min = 44.dp).then(if (r.on) Modifier.goldGlide(pal) else Modifier).clip(RoundedCornerShape(999.dp))
                        .clickable { if (!r.on) act.range(r.range) }.semantics { contentDescription = r.label }.padding(horizontal = 5.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                        Text(r.label, style = sans(12f, 650, if (r.on) BtnInk else Mute, ls = -.12f), maxLines = 1)
                    } }
                }
                "range" -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(b.text, style = sans(13f, 400, Mute), modifier = Modifier.weight(1f))
                    if (b.value.isNotBlank()) Text(b.value, style = sans(13f, 700, if (b.tone == "ok") Good else Bad))
                }
                "chart" -> PriceChart(b, if (vw > vh && vh <= 540.dp) 180.dp else 260.dp)
                "dates" -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { b.items.forEach { Text(it, style = sans(13f, 400, Mute)) } }
                "single" -> Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Ink.copy(alpha = .05f)).semantics { contentDescription = b.text }
                    .padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    // .history-start-dot: 10 across in the accent with a 4 ring of it at 22 %.
                    val gold = GoldC
                    Box(Modifier.size(10.dp).drawBehind { drawCircle(gold.copy(alpha = .22f), size.minDimension / 2 + 4.dp.toPx()); drawCircle(gold) })
                    Text(buildAnnotatedString { b.runs.forEach { r -> withStyle(SpanStyle(color = if (r.bold) Ink else Mute, fontWeight = if (r.bold) FontWeight.Bold else null)) { append(r.t.orEmpty()) } } },
                        style = sans(14f, 400, Mute))
                }
                "empty" -> Box(Modifier.fillMaxWidth().heightIn(min = if (ready) 140.dp else 80.dp), contentAlignment = Alignment.Center) {
                    Text(b.text, style = sans(13f, 400, Mute, lh = 1.6f), textAlign = TextAlign.Center)
                }
                "button" -> b.press?.let { x -> Ghost(x.label, x.icon, h = 34.dp, pad = 12.dp, fs = 13.5f) { go(x) } }
                "coverage" -> Text(b.text, style = sans(11f, 400, Foot, lh = 1.6f))
                "attribution" -> Text(b.text, style = sans(12f, 400, GoldC, lh = 1.45f), modifier = Modifier.clickable { go(CardPress(b.text, null, "", emptyMap(), b.href, "", "", false, false, true, false, false)) })
                "about" -> About(b)
                "text" -> Text(b.text, style = sans(13f, 400, Mute, lh = 1.6f))
            }
        }
    }
}

/** The card sheet's site pieces for the other Collection sheets (the add sheet): the glass field, the gold glide, the glass button. */
internal fun Modifier.siteGlassField(r: Dp): Modifier = glassField(r)
internal fun Modifier.siteGoldGlide(pal: SheetPal): Modifier = goldGlide(pal)
@Composable
internal fun SiteGhost(label: String, modifier: Modifier = Modifier, h: Dp = 44.dp, fs: Float = 13.5f, pad: Dp = 12.dp, onClick: () -> Unit) =
    Ghost(label, null, modifier, h = h, fs = fs, pad = pad, onClick = onClick)

/** .glide on a segmented control: the gold plate, its 1 gold ring, its soft glow and the light along its top. */
private fun Modifier.goldGlide(pal: SheetPal): Modifier = this.drawBehind {
    val r = CornerRadius(size.height / 2)
    drawIntoCanvas { c ->
        val glow = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true }
        // 0 0 22 gold .22, then 0 6 18 -6 gold .7 (blur radius is twice the mask's sigma).
        glow.color = pal.gold.copy(alpha = .22f).toArgb(); glow.maskFilter = android.graphics.BlurMaskFilter(11.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL)
        c.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, r.x, r.y, glow)
        val s = 6.dp.toPx()
        glow.color = pal.gold.copy(alpha = .7f).toArgb(); glow.maskFilter = android.graphics.BlurMaskFilter(9.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL)
        c.nativeCanvas.drawRoundRect(s, s + s, size.width - s, size.height, r.x, r.y, glow)
    }
    drawRoundRect(pal.gold.copy(alpha = .65f), topLeft = Offset(-1.dp.toPx(), -1.dp.toPx()), size = Size(size.width + 2.dp.toPx(), size.height + 2.dp.toPx()), cornerRadius = CornerRadius(r.x + 1.dp.toPx()))
    cssLinear(180f, 0f to pal.light, .58f to pal.gold, 1f to pal.dark, corner = r)
    drawRoundRect(Color(0x70FFFFFF), topLeft = Offset(size.height / 2, 0f), size = Size(size.width - size.height, 1.dp.toPx()))
}

/**
 * The history chart: the site's own 360 × 154 drawing (12-348 across, 26-136 down), a gold line 2.5 wide over a gold wash
 * at 8 %, a dot at each point up to 60 of them. It is as tall as its width keeps it (120 to [maxH]); the drawing keeps its shape, centred.
 */
@Composable
private fun PriceChart(b: CardHistBlock, maxH: Dp) = BoxWithConstraints(Modifier.fillMaxWidth()) {
    val h = (maxWidth * (154f / 360f)).coerceIn(120.dp, maxH)
    val gold = GoldC
    androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(h).semantics { contentDescription = b.text }) {
        if (b.points.isEmpty()) return@Canvas
        val s = minOf(size.width / 360f, size.height / 154f); val ox = (size.width - 360f * s) / 2; val oy = (size.height - 154f * s) / 2
        fun at(p: Pair<Float, Float>) = Offset(ox + p.first * s, oy + p.second * s)
        val line = androidx.compose.ui.graphics.Path().apply { b.points.forEachIndexed { i, p -> val o = at(p); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) } }
        val area = androidx.compose.ui.graphics.Path().apply { addPath(line); lineTo(at(b.points.last()).x, oy + 150f * s); lineTo(at(b.points.first()).x, oy + 150f * s); close() }
        drawPath(area, gold.copy(alpha = .08f))
        drawPath(line, gold, style = androidx.compose.ui.graphics.drawscope.Stroke(2.5f * s, join = androidx.compose.ui.graphics.StrokeJoin.Round))
        if (b.dots) b.points.forEach { drawCircle(gold, 2.5f * s, at(it)) }
    }
}

/** .history-about: what the prices are and where they come from; a day can be looked up in it. */
@Composable
private fun About(b: CardHistBlock) {
    var open by remember { mutableStateOf(CardSheetTest.open) }
    var day by remember(b.options) { mutableStateOf(0) }
    Column(Modifier.fillMaxWidth().topLine()) {
        Summary(b.text, open, sans(12f, 400, Ink, lh = 1.5f)) { open = !open }
        if (open) {
            // .history-values (10 over, a hairline), the inspector 12 in; each foot 10 over and 6 under, margins collapsing.
            val inspect = b.inspect != null && b.options.isNotEmpty()
            if (inspect) Column(Modifier.padding(top = 10.dp).fillMaxWidth().topLine().padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(b.inspect.orEmpty(), style = sans(12f, 600, Mute))
                SiteSelect(b.options, 12f, day) { day = it }
            }
            var prev = if (inspect) 12.dp else 0.dp
            b.foots.forEach { f -> Spacer(Modifier.height(maxOf(prev, 10.dp))); Text(f, style = sans(12f, 400, Foot, lh = 1.45f)); prev = 6.dp }
            Spacer(Modifier.height(prev))
        }
    }
}

/** pricing-presentation.js sellerRows: each store's reference price and its link; one framed list. */
@Composable
private fun Sellers(s: CardSellers, vw: Dp, open: (String) -> Unit) {
    // Under 381: 12 in, 10 apart, 1fr .85fr, the price at 15. From 680: 18 20 in, 1.5fr 1fr. Between: 16 in, 16 apart, 1fr .8fr.
    val narrow = vw <= 380.dp; val wide = vw >= 680.dp
    val (w1, w2) = when { wide -> 1.5f to 1f; narrow -> 1f to .85f; else -> 1f to .8f }
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Text(s.title, style = manrope(16f, 700, Ink, lh = 1.4f, ls = -.32f), modifier = Modifier.weight(1f))
            if (s.sub.isNotBlank()) Text(s.sub, style = sans(13f, 400, Mute))
        }
        if (s.foot.isNotBlank()) Text(s.foot, style = sans(11f, 400, Foot, lh = 1.6f), modifier = Modifier.padding(top = 7.dp, bottom = 14.dp))
        val shape = RoundedCornerShape(16.dp)
        Column(Modifier.fillMaxWidth().clip(shape).background(Surface).border(1.dp, LineC, shape).padding(1.dp)) {
            s.rows.forEachIndexed { i, r ->
                Row(Modifier.fillMaxWidth().heightIn(min = 76.dp).clickable { open(r.href) }.semantics { contentDescription = r.aria }
                    .then(if (i < s.rows.lastIndex) Modifier.drawBehind { drawRect(LineC, Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }.padding(bottom = 1.dp) else Modifier)
                    .padding(horizontal = if (wide) 20.dp else if (narrow) 12.dp else 16.dp, vertical = if (wide) 18.dp else if (narrow) 12.dp else 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(if (narrow) 10.dp else 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(w1), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(r.name, style = sans(14f, 700, Ink, lh = 1.4f))
                        if (r.scope.isNotBlank()) Text(r.scope, style = sans(11f, 400, Mute, lh = 1.5f))
                        if (r.provenance.isNotBlank()) Text(r.provenance, style = sans(11f, 400, Mute, lh = 1.5f))
                    }
                    Column(Modifier.weight(w2), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(r.value, style = sans(if (narrow) 15f else 17f, 700, Ink, lh = 1.3f).copy(fontFeatureSettings = Tnum), textAlign = TextAlign.End)
                        if (r.unit.isNotBlank()) Text(r.unit, style = sans(11f, 400, Mute, lh = 1.5f), textAlign = TextAlign.End)
                        Text(r.action, style = sans(11f, 400, GoldC, lh = 1.5f), textAlign = TextAlign.End)
                    }
                }
            }
            if (s.rows.isEmpty() && s.empty.isNotBlank()) Text(s.empty, style = sans(13f, 400, Mute), modifier = Modifier.padding(16.dp))
        }
    }
}

/** .price-table with its source in the corner (style.css 810-813): the head on the second surface, 12.5 muted; each row 14, the cells right. */
@Composable
private fun PriceTable(corner: String, cols: List<Pair<String, String>>, rows: List<CardPriceRow>) {
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().clip(shape).border(1.dp, LineC, shape).padding(1.dp)) {
        Row(Modifier.fillMaxWidth().background(Surface2).padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(corner, style = sans(12.5f, 400, Mute), modifier = Modifier.weight(1.6f))
            cols.forEach { (f, l) -> Text(l, style = sans(12.5f, 700, if (f == "foil") Color(0xFFFF9F68) else Ink), textAlign = TextAlign.End, maxLines = 1, modifier = Modifier.weight(1f)) }
        }
        rows.forEach { r ->
            Row(Modifier.fillMaxWidth().topLine().padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(r.label, style = sans(14f, 400, Ink), overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1.6f))
                // The last column (the market price) is bold on the site.
                r.cells.forEachIndexed { i, c -> Text(c, style = sans(14f, if (i == r.cells.lastIndex) 700 else 400, Ink).copy(fontFeatureSettings = Tnum), textAlign = TextAlign.End, maxLines = 1, modifier = Modifier.weight(1f)) }
            }
        }
    }
}

/**
 * Yu-Gi-Oh!'s "Every printing" row (style.css 511-522, 616, 985, 1357-1361, 2586): the glass row 6 in, the 40 × 56 thumbnail, the set (13 / 700) over
 * its badge and rarity (11.5 muted); under it on a phone, Buy (gold) and the reference quotes in small boxes on the second surface.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PrintRow(r: TcgPrint, go: (CardPress) -> Unit) {
    val uri = LocalUriHandler.current
    val gold = GoldC
    Column(Modifier.fillMaxWidth().siteGlass(12.dp).padding(6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().clickable { r.press?.let(go) }, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            val p = heroPainter(r.thumb.ifBlank { null }?.let(homeArt))
            Box(Modifier.size(40.dp, 56.dp).clip(RoundedCornerShape(4.dp)).background(Surface2)) { if (p != null) Image(p, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
            Column(Modifier.weight(1f)) {
                Text(r.name, style = sans(13f, 700, Ink, lh = 1.45f))
                val parts = listOfNotNull(r.tset?.let { TcgPart(null, false, it, emptyList(), "", false) }, TcgPart(" " + r.line.trim(), false, null, emptyList(), "", false))
                PartsLine(parts, sans(11.5f, 400, Mute, lh = 1.45f))
            }
        }
        FlowRow(Modifier.padding(start = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val box = Modifier.clip(RoundedCornerShape(8.dp)).background(Surface2).border(1.dp, LineC, RoundedCornerShape(8.dp))
            if (r.buyHref.isNotBlank()) Box(box.heightIn(min = 44.dp).clickable { runCatching { uri.openUri(r.buyHref) } }.semantics { contentDescription = r.buyAria }.padding(horizontal = 7.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center) { Text(r.buyLabel, style = sans(13f, 700, gold)) }
            Column(box.padding(horizontal = 7.dp, vertical = 2.dp), horizontalAlignment = Alignment.End) {
                Text(r.refLabel.uppercase(), style = sans(9.5f, 600, Mute, lh = 1.45f))
                if (r.quotes.isEmpty()) Text(r.value, style = sans(13f, 700, Ink).copy(fontFeatureSettings = Tnum))
                r.quotes.forEach { (l, v) -> Column(Modifier.padding(horizontal = 6.dp, vertical = 4.dp), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(l.uppercase(), style = sans(9.5f, 600, Mute, lh = 1.45f)); Text(v, style = sans(13f, 700, Ink).copy(fontFeatureSettings = Tnum)) } }
            }
        }
    }
}

/** views.js Market details: the source chips, this printing's price in each finish, and the cheapest and dearest printings. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MarketDetails(d: CardMarket, act: CollectionCardActions, go: (CardPress) -> Unit) {
    var open by remember { mutableStateOf(CardSheetTest.open) }
    Column(Modifier.fillMaxWidth().topLine().padding(top = 13.dp)) {
        Summary(d.summary, open, sans(12f, 600, Ink, lh = 1.5f)) { open = !open }
        if (!open) return@Column
        FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            d.sources.forEach { x ->
                val shape = RoundedCornerShape(999.dp)
                Box(Modifier.clip(shape).then(if (x.on) Modifier.background(GoldC).border(1.dp, GoldC, shape) else Modifier.background(Color(0x851F232A)).border(1.dp, Edge, shape))
                    .clickable { if (!x.on) go(x) }.padding(horizontal = 12.dp, vertical = 7.dp)) {
                    Text(x.label, style = sans(13f, 700, if (x.on) BtnInk else Ink), maxLines = 1, softWrap = false)
                }
            }
        }
        if (d.tables.isNotEmpty()) d.tables.forEach { t -> Spacer(Modifier.height(12.dp)); PriceTable(t.corner, t.cols, t.rows) }
        else if (d.cols.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            val shape = RoundedCornerShape(14.dp)
            Column(Modifier.fillMaxWidth().clip(shape).border(1.dp, LineC, shape).padding(1.dp)) {
                // grid-template-columns: 1.6fr repeat(n, 1fr), 6 apart, 10 12 in.
                Row(Modifier.fillMaxWidth().background(Surface2).padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Spacer(Modifier.weight(1.6f))
                    d.cols.forEach { (f, l) -> Text(l, style = sans(12.5f, 700, if (f == "foil") Color(0xFFFF9F68) else Ink), textAlign = TextAlign.End, maxLines = 1, modifier = Modifier.weight(1f)) }
                }
                d.rows.forEach { r ->
                    Row(Modifier.fillMaxWidth().topLine().padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(buildAnnotatedString { append(r.label); if (r.sub.isNotBlank()) { append(" "); withStyle(SpanStyle(fontSize = 11.67.sp, color = Mute)) { append(r.sub) } } },
                            style = sans(14f, 400, Ink), overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1.6f))
                        r.cells.forEach { c -> Text(c, style = sans(14f, 400, Ink).copy(fontFeatureSettings = Tnum), textAlign = TextAlign.End, maxLines = 1, modifier = Modifier.weight(1f)) }
                    }
                }
            }
        }
        var prev = if (d.cols.isNotEmpty() || d.tables.isNotEmpty()) 8.dp else 12.dp
        if (d.prints.isNotEmpty()) {
            Spacer(Modifier.height(maxOf(prev, 12.dp)))
            // h3.price-printings-head: 15 / 700 Manrope, 8 under.
            Text(d.printsHead, style = manrope(15f, 700, Ink, lh = 1.15f, ls = -.3f), modifier = Modifier.padding(bottom = 8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { d.prints.forEach { PrintRow(it, go) } }
            if (d.printsFoot.isNotBlank()) { Spacer(Modifier.height(10.dp)); Text(d.printsFoot, style = sans(12f, 400, Foot, lh = 1.45f)) }
            prev = 6.dp
        }
        d.lines.forEach { (foot, runs) ->
            val top = if (foot) 10.dp else 6.dp
            Spacer(Modifier.height(maxOf(prev, top)))
            Inline(runs, if (foot) sans(12f, 400, Foot, lh = 1.45f) else sans(13f, 400, Ink), go)
            prev = 6.dp
        }
        Spacer(Modifier.height(prev))
    }
}
