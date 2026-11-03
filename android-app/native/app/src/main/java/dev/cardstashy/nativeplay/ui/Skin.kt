package dev.cardstashy.nativeplay.ui

import android.os.Build
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.ui.draw.alpha
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.R
import dev.cardstashy.nativeplay.play.PlayMath

/**
 * The site's shared skin (style.css + play-menu.css), section 0 of the approved mockups:
 * tokens, top bar, page header, purse bar, bottom nav and section card. Every value here is
 * read off the site's CSS; the comment beside it names the rule.
 */
object Site {
    val Bg = Color(0xFF0F1115)            // --bg
    val Surface = Color(0xFF171A20)       // --surface
    val Surface2 = Color(0xFF1F232B)      // --surface-2
    val Line = Color(0xFF2A2F39)          // --line
    val GlassLine = Color(0x17FFFFFF)     // --glass-line rgba(255,255,255,.09)
    val GlassHi = Color(0x12FFFFFF)       // --glass-hi: inset 0 1px 0 rgba(255,255,255,.07)
    val GlassRing = Color(0x06FFFFFF)     // --glass-hi second ring: inset 0 0 0 1px rgba(255,255,255,.025)
    val Text = Color(0xFFEEF0F4)          // --text
    val Muted = Color(0xFF9AA2B1)         // --muted
    val Gold = Color(0xFFE8B95B)          // --gold: one primary per screen, the nav pill, earned things
    val GoldInk = Color(0xFF1B1406)       // --gold-ink
    val Unread = Color(0xFFE5484D)        // the profile orb's red dot
    val Radius = 14.dp                    // --radius
    /** 0a.5: one spring for all motion (stiffness 600, damping 0.8). */
    fun <T> spring() = androidx.compose.animation.core.spring<T>(dampingRatio = .8f, stiffness = 600f)

    val Manrope = FontFamily(
        Font(R.font.manrope_regular, FontWeight.Normal), Font(R.font.manrope_medium, FontWeight.Medium),
        Font(R.font.manrope_semibold, FontWeight.SemiBold), Font(R.font.manrope_bold, FontWeight.Bold),
        Font(R.font.manrope_extrabold, FontWeight.ExtraBold))
    private val tnum = "tnum"

    // 0a.4: Cinzel at two sizes only (28 title, 12 tracked eyebrow); Manrope at four (20 / 16 / 14 / 12). No italic, shadow or outline.
    val Title = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 32.sp, letterSpacing = .02.em, color = Text)
    val Eyebrow = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = .2.em, color = Text.copy(alpha = .82f))
    val CardTitle = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp, color = Text)
    val Body = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 22.sp, color = Text)
    val Meta = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp, color = Muted, fontFeatureSettings = tnum)
    val Label = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp, color = Muted)
    val Count = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Text, fontFeatureSettings = tnum)
    val Button = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Text)
}

// ---------------------------------------------------------------- icons, the site's own SVG paths

/** Builds an ImageVector from the site's SVG path strings (24 or 32 unit grid). */
private fun svg(size: Float, vararg parts: VPath): ImageVector =
    ImageVector.Builder(defaultWidth = size.dp, defaultHeight = size.dp, viewportWidth = size, viewportHeight = size).apply {
        for (p in parts) addPath(pathData = addPathNodes(p.d), fill = p.fill, stroke = p.stroke, strokeLineWidth = p.width,
            strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, strokeAlpha = p.alpha)
    }.build()

private class VPath(val d: String, val fill: Brush? = null, val stroke: Brush? = null, val width: Float = 0f, val alpha: Float = 1f)

private fun circle(cx: Float, cy: Float, r: Float) = "M${cx - r},${cy}a$r,$r 0 1,0 ${2 * r},0a$r,$r 0 1,0 ${-2 * r},0z"
private fun rrect(x: Float, y: Float, w: Float, h: Float, r: Float) =
    "M${x + r},${y}h${w - 2 * r}a$r,$r 0 0 1 $r,$r v${h - 2 * r}a$r,$r 0 0 1 ${-r},$r h${-(w - 2 * r)}a$r,$r 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a$r,$r 0 0 1 $r,${-r}z"

object SiteIcons {
    private fun line(vararg d: String): ImageVector = svg(24f, *d.map { VPath(it, stroke = SolidColor(Color.White), width = 1.75f) }.toTypedArray())

    // index.html's nav icons, stroke 1.75 on a 24 grid; tinted by the caller.
    val Sync = line("M19.5 9A8 8 0 0 0 6 5.5L3.5 8M3.5 4v4h4M4.5 15A8 8 0 0 0 18 18.5l2.5-2.5M20.5 20v-4h-4")
    val Trunk = line(rrect(4f, 3.5f, 16f, 17f, 2f), "M8 3.5v17M11.5 8h5M11.5 12h5")
    val Decks = line("m6 18-2.5-1a1.5 1.5 0 0 1-.8-2L7 4.5a1.5 1.5 0 0 1 2-.8l5 2", rrect(8f, 5.5f, 11.5f, 15f, 1.8f), "M11.5 10h4.5M11.5 13.5h4.5")
    val Bag = line("M5.5 8h13l-1 12h-11z", "M9 10V7a3 3 0 0 1 6 0v3")
    val Trophy = line("M8 4h8v5.5a4 4 0 0 1-8 0z", "M8 6H5.2a.7.7 0 0 0-.7.8A4 4 0 0 0 8 10.3M16 6h2.8a.7.7 0 0 1 .7.8 4 4 0 0 1-3.5 3.5", "M12 13.5V17M8.5 20h7l-.8-3H9.3z")
    val Back = line("m15 5-7 7 7 7")

    // play-econ-ui.js: the stamped gold (#peGold radial), coin, seals and pack.
    private val peGold = Brush.radialGradient(0f to Color(0xFFFFF3C9), .45f to Color(0xFFF0C66D), 1f to Color(0xFFA8761F), center = Offset(11.2f, 9.6f), radius = 24f)
    val Coin = svg(32f,
        VPath(circle(16f, 16f, 14f), fill = peGold, stroke = SolidColor(Color(0xFF6B4612)), width = 1.6f),
        VPath(circle(16f, 16f, 10.5f), stroke = SolidColor(Color(0xFF6B4612)), width = 1.5f),
        VPath("M16 8.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z", fill = SolidColor(Color(0xFF5C3C0C))))
    private val sealInk = mapOf("c" to (0xFF9AA1A9 to 0xFF5D636B), "u" to (0xFFD9E3EA to 0xFF7E8D99), "r" to (0xFFF1CF7C to 0xFFA77A23), "m" to (0xFFF28A4B to 0xFFA8381B))
    val Seals: Map<String, ImageVector> = sealInk.mapValues { (_, ink) ->
        val (a, b) = ink
        svg(32f,
            VPath("M16 2.5c2 0 2.6 1.9 4.4 2.5s3.6-.6 5 .8.1 3.2.8 5 2.5 2.4 2.5 4.4-1.9 2.6-2.5 4.4.6 3.6-.8 5-3.2.1-5 .8-2.4 2.5-4.4 2.5-2.6-1.9-4.4-2.5-3.6.6-5-.8-.1-3.2-.8-5S2.5 18 2.5 16s1.9-2.6 2.5-4.4-.6-3.6.8-5 3.2-.1 5-.8S14 2.5 16 2.5z", fill = SolidColor(Color(a))),
            VPath(circle(16f, 16f, 8.4f), stroke = SolidColor(Color(b)), width = 1.6f),
            VPath("M16 10.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z", fill = SolidColor(Color(b))))
    }
    val Pack = svg(32f,
        VPath("M8 4h16l-1 3 1 3v15l-1 3 1 3H8l1-3-1-3V10l1-3z", fill = peGold, stroke = SolidColor(Color(0xFF7A5418)), width = 1f),
        VPath("M12 14h8M12 18h8", stroke = SolidColor(Color(0xFF7A5418)), width = 1.4f, alpha = .6f))
}

@Composable
fun Icon(v: ImageVector, size: Dp, tint: Color? = null, modifier: Modifier = Modifier) =
    Image(rememberVectorPainter(v), null, modifier.size(size), colorFilter = tint?.let { androidx.compose.ui.graphics.ColorFilter.tint(it) })

// ---------------------------------------------------------------- glass (0a.1: the art is the light source)

/**
 * Real glass: the art behind a panel, blurred 24 dp (RenderEffect, Android 12+) under a 46 % surface
 * tint. Older phones get a heavier tint and no blur. [art] is drawn at the hero's size and shifted
 * by the panel's position in it, so the panel shows exactly the art it sits on: one blur layer.
 */
@Composable
fun GlassOverArt(art: Painter?, heroSize: IntSize, panelOffset: IntOffset, shape: Shape, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val blurs = Build.VERSION.SDK_INT >= 31
    val d = LocalDensity.current
    Box(modifier.clip(shape).background(Site.Bg)) {
        if (art != null && heroSize.width > 0) Image(art, null, Modifier.matchParentSize().wrapContentSize(Alignment.TopStart, unbounded = true)
            .offset { IntOffset(-panelOffset.x, -panelOffset.y) }
            .size(with(d) { heroSize.width.toDp() }, with(d) { heroSize.height.toDp() })
            .let { if (blurs) it.blur(24.dp, BlurredEdgeTreatment.Unbounded) else it }, contentScale = ContentScale.Crop,
            // Only the light comes through, never the art's hue: a glass control is neutral.
            colorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(.12f) }))
        Box(Modifier.matchParentSize().background(Site.Surface.copy(alpha = if (blurs) .46f else .82f)))
        Box(Modifier.matchParentSize().border(1.dp, Site.GlassLine, shape).padding(1.dp).border(1.dp, Site.GlassRing, shape).drawBehind {
            drawLine(Site.GlassHi, Offset(size.height / 2, 1f), Offset(size.width - size.height / 2, 1f), 1.dp.toPx())
        })
        content()
    }
}

/** The art painter for a hero: an in-memory bitmap (tests, bundled art) or a URL through the 2 GB Coil cache, faded in 150 ms. */
@Composable
fun heroPainter(art: Any?): Painter? = when (art) {
    null -> null
    is ImageBitmap -> remember(art) { BitmapPainter(art) }
    else -> coil3.compose.rememberAsyncImagePainter(art, imageLoader = dev.cardstashy.nativeplay.art.CardArt.loader)
}

// ---------------------------------------------------------------- 0.1 top bar

/** The OTHER mode's emblem (tap switches mode, press = scale) and the profile orb with the unread dot. No bar of its own: it floats on the hero. */
@Composable
fun TopBarItems(mode: Mode, avatarUrl: String?, name: String?, unread: Boolean, onSwitch: () -> Unit, onProfile: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().height(56.dp).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        val other = if (mode == Mode.PLAY) Mode.COLLECTION else Mode.PLAY
        Emblem(other, 44.dp, onClick = onSwitch, modifier = Modifier.semantics { contentDescription = if (other == Mode.PLAY) "Play" else "Collection" })
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(44.dp).clickable(onClick = onProfile).semantics { contentDescription = "Account" }) {
            Avatar(avatarUrl, name, 44.dp)
            if (unread) Box(Modifier.align(Alignment.TopEnd).size(11.dp).clip(CircleShape).background(Site.Unread).border(1.5.dp, Site.Bg, CircleShape))
        }
    }
}

// ---------------------------------------------------------------- 0a.1 hero header

/** What the hero shows: Play = the Story act you are in (or your last deck), Collection = Card of the Day. */
data class HeroSlide(val art: Any?, val eyebrow: String, val title: String, val meta: String?, val action: String?, val onAction: () -> Unit = {},
                     /** Story: the act's battles as pips (storyHeader), [won] filled, the last one the boss. */
                     val battles: Int = 0, val won: Int = 0)

/**
 * The hero: art bleeds edge to edge under the status bar (220 dp plus the inset) with a bottom-up
 * scrim, black 0 to 72 % over 160 dp; eyebrow, Cinzel title, one meta line, one glass button, pager
 * dots when there are several slides. [under] is the pill that overlaps its bottom edge by 24 dp,
 * drawn as glass over the same art.
 */
@Composable
fun Hero(slides: List<HeroSlide>, page: Int, onPage: (Int) -> Unit, top: @Composable () -> Unit, under: (@Composable (art: Painter?, heroSize: IntSize, pillTop: Int) -> Unit)? = null) {
    val slide = slides.getOrNull(page) ?: return
    val art = heroPainter(slide.art)
    var heroSize by remember { mutableStateOf(IntSize.Zero) }
    val inset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val d = LocalDensity.current
    Column(Modifier.fillMaxWidth()) {
        // 220 dp plus the inset, growing with big text so the words never run under the emblem or get cut.
        Box(Modifier.fillMaxWidth().heightIn(min = 220.dp + inset).onSizeChanged { heroSize = it }) {
            if (art != null) Image(art, null, Modifier.matchParentSize(), contentScale = ContentScale.Crop) else Box(Modifier.matchParentSize().background(Site.Surface))
            Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(.8f).heightIn(min = 160.dp).background(Brush.verticalGradient(0f to Color.Transparent, .45f to Color.Black.copy(alpha = .5f), 1f to Color.Black.copy(alpha = .72f))))
            // Text protection under the title column, always on: 55 % black at the left edge fading out.
            Box(Modifier.align(Alignment.BottomStart).fillMaxWidth(.75f).fillMaxHeight(.8f).heightIn(min = 160.dp).background(Brush.horizontalGradient(listOf(Color.Black.copy(alpha = .55f), Color.Transparent))))
            // Status bar legibility: a short top scrim, not a bar.
            Box(Modifier.fillMaxWidth().height(inset + 56.dp).background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = .45f), Color.Transparent))))
            Box(Modifier.padding(top = inset)) { top() }
            Column(Modifier.align(Alignment.BottomCenter).padding(top = inset + 56.dp + 8.dp).pageColumn().padding(bottom = if (under != null) 32.dp else 16.dp)) {
                Text(slide.eyebrow.uppercase(), style = Site.Eyebrow)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Column(Modifier.weight(1f)) {
                        Text(slide.title, style = Site.Title)
                        if (slide.meta != null) Text(slide.meta, style = Site.Meta.copy(color = Site.Text.copy(alpha = .78f)))
                        if (slide.battles > 0) Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                            for (b in 0 until slide.battles) {
                                val boss = b == slide.battles - 1; val done = b < slide.won
                                Box(Modifier.size(if (boss) 22.dp else 16.dp, 6.dp).clip(CircleShape)
                                    .background(if (done) Site.Gold else Site.Text.copy(alpha = .22f))
                                    .then(if (boss) Modifier.border(1.dp, Site.Text.copy(alpha = .5f), CircleShape) else Modifier))
                            }
                        }
                    }
                    if (slide.action != null) {
                        Spacer(Modifier.width(12.dp))
                        GoldButton(slide.action, slide.onAction)
                    }
                }
                if (slides.size > 1) Row(Modifier.padding(top = 8.dp).height(16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    slides.indices.forEach { i ->
                        val w by animateDpAsState(if (i == page) 16.dp else 6.dp, Site.spring(), label = "dot")
                        Box(Modifier.size(w, 6.dp).clip(CircleShape).background(Site.Text.copy(alpha = if (i == page) .95f else .4f)).clickable { onPage(i) })
                    }
                }
            }
        }
        if (under != null) BoxWithConstraints(Modifier.offset(y = (-24).dp).pageColumn()) {
            // Where the pill sits in the hero's frame, so its glass shows the art right behind it.
            val left = with(d) { ((heroWidthDp(heroSize, d) - maxWidth) / 2).roundToPx() }
            CompositionLocalProvider(LocalPillLeft provides left) { under(art, heroSize, heroSize.height - with(d) { 24.dp.roundToPx() }) }
        }
    }
}

private val LocalPillLeft = androidx.compose.runtime.staticCompositionLocalOf { 0 }
private fun heroWidthDp(size: IntSize, d: androidx.compose.ui.unit.Density) = with(d) { size.width.toDp() }

/** The screen's one gold primary (0a rule 3): gold like metal, ink text, press = scale. */
@Composable
fun GoldButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .96f else 1f, Site.spring(), label = "press")
    Box(modifier.scale(k).height(44.dp).clip(CircleShape)
        .background(Brush.verticalGradient(listOf(Color(0xFFF2CF7E), Site.Gold, Color(0xFFC9963A))))
        .clickable(press, null, onClick = onClick).padding(horizontal = 20.dp), contentAlignment = Alignment.Center) {
        Text(label, style = Site.Button.copy(color = Site.GoldInk), maxLines = 1, softWrap = false)
    }
}

// ---------------------------------------------------------------- page header (sub-pages)

/** .pl-head on sub-pages: round back button, eyebrow, Cinzel 28 title; [trailing] at the end. */
@Composable
fun PageHeader(title: String, eyebrow: String? = null, onBack: (() -> Unit)? = null, modifier: Modifier = Modifier, trailing: @Composable () -> Unit = {}) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        if (onBack != null) Box(Modifier.size(44.dp).clip(CircleShape).background(Site.Surface).border(1.dp, Site.Line, CircleShape)
            .clickable(onClick = onBack).semantics { contentDescription = "Back" }, contentAlignment = Alignment.Center) {
            Icon(SiteIcons.Back, 20.dp, Site.Text)
        }
        Column(Modifier.weight(1f)) {
            if (eyebrow != null) Text(eyebrow.uppercase(), style = Site.Eyebrow, maxLines = 1)
            Text(title, style = Site.Title)
        }
        trailing()
    }
}

/** .pe-level: the mastery ring, 3 dp track, gold fill from 12 o'clock (earned), level in the middle; fills on the spring. */
@Composable
fun LevelRing(level: PlayMath.Level, modifier: Modifier = Modifier) {
    val pct by animateFloatAsState(level.into.toFloat() / level.need.coerceAtLeast(1), Site.spring(), label = "ring")
    Box(modifier.size(44.dp).semantics { contentDescription = "Mastery level ${level.level}, ${level.into} of ${level.need} XP" }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(34.dp)) {
            val w = 3.dp.toPx()
            drawCircle(Color(0x24FFFFFF), radius = size.minDimension / 2 - w / 2, style = Stroke(w))
            drawArc(Site.Gold, -90f, 360f * pct, false, topLeft = Offset(w / 2, w / 2), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w), style = Stroke(w, cap = StrokeCap.Round))
        }
        Text("${level.level}", style = Site.Count)
    }
}

// ---------------------------------------------------------------- 0.3 purse pill

/**
 * .pe-purse in the site's order: coins, the four seals, packs, then the level ring. Glass over the
 * hero art it overlaps. Counts roll up on the spring when they change; tap opens where they go.
 */
@Composable
fun PursePill(purse: PlayMath.Purse, level: PlayMath.Level?, art: Painter?, heroSize: IntSize, pillTop: Int,
              onCoins: () -> Unit = {}, onSeals: () -> Unit = {}, onPacks: () -> Unit = {}) {
    GlassOverArt(art, heroSize, IntOffset(LocalPillLeft.current, pillTop), CircleShape, Modifier.fillMaxWidth().height(52.dp)) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            // Narrow phones and big text: tighter padding and smaller glyphs, never a wrap or overlap (site: max-width 420 rules).
            val compact = maxWidth.value / LocalDensity.current.fontScale < 340f
            val icon = if (compact) 16.dp else 18.dp
            CompositionLocalProvider(LocalCompact provides compact) {
                Row(Modifier.fillMaxSize().padding(horizontal = if (compact) 2.dp else 4.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = if (compact) Arrangement.SpaceBetween else Arrangement.SpaceEvenly) {
                    PurseItem(onCoins, "${purse.coins} coins") { Icon(SiteIcons.Coin, icon); Count(purse.coins) }
                    PurseItem(onSeals, "Seals: ${purse.seals["c"]} common, ${purse.seals["u"]} uncommon, ${purse.seals["r"]} rare, ${purse.seals["m"]} mythic") {
                        for (k in listOf("c", "u", "r", "m")) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (compact) 2.dp else 4.dp)) {
                            Icon(SiteIcons.Seals.getValue(k), icon); Count(purse.seals[k] ?: 0)
                        }
                    }
                    PurseItem(onPacks, "${purse.packs} unopened packs") { Icon(SiteIcons.Pack, icon); Count(purse.packs) }
                    if (level != null) LevelRing(level)
                }
            }
        }
    }
}

private val LocalCompact = androidx.compose.runtime.staticCompositionLocalOf { false }

@Composable
private fun PurseItem(onClick: () -> Unit, label: String, content: @Composable () -> Unit) {
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .94f else 1f, Site.spring(), label = "press")
    val compact = LocalCompact.current
    Row(Modifier.height(44.dp).scale(k).clip(CircleShape).clickable(press, null, onClick = onClick).semantics { contentDescription = label }.padding(horizontal = if (compact) 3.dp else 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 6.dp)) { content() }
}

@Composable
private fun Count(n: Int) {
    val shown by animateIntAsState(n, Site.spring(), label = "count")
    Text("%,d".format(shown), style = Site.Count, maxLines = 1, softWrap = false)
}

// ---------------------------------------------------------------- 0.4 bottom nav

enum class PlayTab(val label: String) { SWITCH("Collection"), TRUNK("Trunk"), DECKS("Decks"), SHOP("Shop"), TROPHIES("Trophies") }

/**
 * .play-nav: five items on the site's 1.2/1/1/1/1.1 grid, 56x32 icon pills; the active one on the
 * gold pill (gold 20 %, gold 30 % inner line) that springs between items. Collection switches mode.
 * 80 dp plus the gesture inset; centred in 640 dp on wide screens like the site.
 */
@Composable
fun PlayNav(active: PlayTab?, onSelect: (PlayTab) -> Unit, modifier: Modifier = Modifier) {
    val weights = listOf(1.2f, 1f, 1f, 1f, 1.1f)
    val icons = listOf(SiteIcons.Sync, SiteIcons.Trunk, SiteIcons.Decks, SiteIcons.Bag, SiteIcons.Trophy)
    BoxWithConstraints(modifier.fillMaxWidth().background(Color(0xF00C0E13)).drawBehind {
        drawLine(Site.Line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx())
    }.navigationBarsPadding()) {
        val inner = minOf(maxWidth, 640.dp)
        Box(Modifier.align(Alignment.TopCenter).width(inner).height(80.dp)) {
            val i = active?.ordinal ?: -1
            if (i >= 0) {
                val centre = inner * ((weights.take(i).sum() + weights[i] / 2) / weights.sum())
                val x by animateDpAsState(centre - 28.dp, Site.spring(), label = "pill")
                Box(Modifier.offset(x = x, y = 14.dp).size(56.dp, 32.dp).clip(RoundedCornerShape(16.dp))
                    .background(Site.Gold.copy(alpha = .2f)).border(1.dp, Site.Gold.copy(alpha = .3f), RoundedCornerShape(16.dp)))
            }
            Row(Modifier.fillMaxSize()) {
                PlayTab.entries.forEachIndexed { k, tab ->
                    val on = tab == active
                    val press = remember { MutableInteractionSource() }
                    val pressed by press.collectIsPressedAsState()
                    val s by animateFloatAsState(if (pressed) .92f else 1f, Site.spring(), label = "press")
                    Column(Modifier.weight(weights[k]).fillMaxSize().clickable(press, null) { onSelect(tab) }.semantics { contentDescription = tab.label }.padding(top = 14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(56.dp, 32.dp).scale(s), contentAlignment = Alignment.Center) {
                            Icon(icons[k], 24.dp, if (on || tab == PlayTab.SWITCH) Site.Gold else Site.Muted)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(tab.label, style = Site.Label.copy(color = if (on) Site.Text else Site.Muted), maxLines = 1, softWrap = false)
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- 0.5 section card

/** A content block with no art behind it: plain surface (not glass), thin white line, 20 dp inside, eyebrow heading. No gold hairline. */
@Composable
fun SectionCard(title: String? = null, action: String? = null, onAction: () -> Unit = {}, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(Site.Radius)).background(Site.Surface).border(1.dp, Site.GlassLine, RoundedCornerShape(Site.Radius))
        .padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (title != null) SectionTitle(title, action, onAction)
        content()
    }
}

/** A section heading (TODAY, ACHIEVEMENTS): the Cinzel eyebrow, the link at the right on the same line when both fit, otherwise under it. Nothing truncates. */
@Composable
fun SectionTitle(title: String, action: String? = null, onAction: () -> Unit = {}) {
    val eyebrow = @Composable { Box(Modifier.heightIn(min = 44.dp), contentAlignment = Alignment.CenterStart) { Text(title.uppercase(), style = Site.Eyebrow) } }
    if (action == null) { eyebrow(); return }
    val link = @Composable { Box(Modifier.height(44.dp).widthIn(min = 44.dp).clickable(onClick = onAction), contentAlignment = Alignment.CenterEnd) {
        Text(action, style = Site.Meta.copy(color = Site.Text, fontWeight = FontWeight.SemiBold)) } }
    Layout(contents = listOf(eyebrow, link), modifier = Modifier.fillMaxWidth()) { (e, l), c ->
        val gap = 16.dp.roundToPx()
        val lp = l.first().measure(c.copy(minWidth = 0))
        val oneLine = e.first().maxIntrinsicWidth(c.maxHeight) + gap + lp.width <= c.maxWidth
        val ep = e.first().measure(c.copy(minWidth = 0, maxWidth = if (oneLine) c.maxWidth - lp.width - gap else c.maxWidth))
        val h = if (oneLine) maxOf(ep.height, lp.height) else ep.height + lp.height
        layout(c.maxWidth, h) {
            ep.place(0, if (oneLine) (h - ep.height) / 2 else 0)
            if (oneLine) lp.place(c.maxWidth - lp.width, (h - lp.height) / 2) else lp.place(0, ep.height)
        }
    }
}

/** 0a.6: 8 dp grid, 16 dp page gutter, 12 dp between cards; content stays in a 640 dp column on wide screens (the site's nav width). */
object Gutter { val Side = 16.dp; val Gap = 12.dp; val Column = 640.dp }

/** The page's content column: full width on phones, 640 dp centred on tablets and unfolded Folds. */
fun Modifier.pageColumn(): Modifier = this.fillMaxWidth().wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = Gutter.Column).padding(horizontal = Gutter.Side)

// ---------------------------------------------------------------- the page frame

/**
 * A mode's root page: hero first, content below, and once the hero scrolls away a 56 dp bar with
 * only the emblem and orb takes its place (collapsing toolbar). [nav] is the Play bottom nav.
 */
@Composable
fun HeroPage(top: @Composable () -> Unit, hero: @Composable () -> Unit, nav: (@Composable () -> Unit)? = null, content: LazyListScope.() -> Unit) {
    val list = rememberLazyListState()
    val d = LocalDensity.current
    val inset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val collapsed by remember { derivedStateOf { list.firstVisibleItemIndex > 0 || list.firstVisibleItemScrollOffset > with(d) { (220.dp - 56.dp).roundToPx() } } }
    val barAlpha by animateFloatAsState(if (collapsed) 1f else 0f, Site.spring(), label = "bar")
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        Column(Modifier.fillMaxSize()) {
            LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(Gutter.Gap)) {
                item(key = "hero") { hero() }
                content()
            }
            nav?.invoke()
        }
        if (barAlpha > 0f) Box(Modifier.fillMaxWidth().alpha(barAlpha).background(Site.Bg.copy(alpha = .94f)).padding(top = inset)) { top() }
    }
}

/** Collection's pill under the Card of the Day hero: value, cards, decks, change since a date. Tabular figures, glass over the art. */
@Composable
fun ValuePill(value: String, cards: Int, decks: Int, change: String?, art: Painter?, heroSize: IntSize, pillTop: Int) {
    GlassOverArt(art, heroSize, IntOffset(LocalPillLeft.current, pillTop), RoundedCornerShape(Site.Radius), Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(value, style = Site.CardTitle.copy(fontFeatureSettings = "tnum"), maxLines = 1)
                if (change != null) Text(change, style = Site.Label, maxLines = 1)
            }
            Stat("%,d".format(cards), "cards"); Spacer(Modifier.width(16.dp)); Stat("%,d".format(decks), "decks")
        }
    }
}

@Composable
private fun Stat(n: String, label: String) = Column(horizontalAlignment = Alignment.End) {
    Text(n, style = Site.Count, maxLines = 1); Text(label, style = Site.Label, maxLines = 1)
}
