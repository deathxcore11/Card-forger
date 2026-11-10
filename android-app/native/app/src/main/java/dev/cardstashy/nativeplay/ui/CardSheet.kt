@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.focusable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Http
import dev.cardstashy.nativeplay.play.CardData
import dev.cardstashy.nativeplay.play.CardFacts
import dev.cardstashy.nativeplay.play.Progress
import dev.cardstashy.nativeplay.play.SetFacts
import dev.cardstashy.nativeplay.play.Trunk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/** Where the card view sends the player next (the web's playCardGet, playLensSet, playCardPrecon, playCardNewDeck). */
class CardSheetActions(
    /** Null: the Shop's set page, where the set's pack is sold (LocalShopSetNav). */
    val merchant: ((code: String, name: String) -> Unit)? = null,
    /** Null: the Shop's set page (LocalShopSetNav); a host can send it elsewhere. */
    val set: ((code: String) -> Unit)? = null,
    val precon: (name: String, code: String) -> Unit = { _, _ -> },
    val newDeck: (name: String) -> Unit = {},
    val toast: (String) -> Unit = {},
    /** app.js play.edit: a deck open in the builder; the card view steps copies there and can make the card its cover. */
    val edit: DeckEditCtx? = null,
)

class DeckEditCtx(val name: String, val qty: (String) -> Int, val copies: Int, val step: (String, Int) -> Unit)

private val Ink get() = Site.Text
private fun t(size: Float, weight: FontWeight = FontWeight.Medium, color: Color = Ink, line: Float = size * 1.4f) =
    TextStyle(fontFamily = Site.Manrope, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp, color = color)
private val RARITY = mapOf("common" to "Common", "uncommon" to "Uncommon", "rare" to "Rare", "mythic" to "Mythic", "special" to "Special", "bonus" to "Bonus")
private val FINISH_ORDER = listOf("nonfoil", "foil", "etched")
private val FINISH_NAME = mapOf("nonfoil" to "Nonfoil", "foil" to "Traditional foil", "etched" to "Etched foil")
private fun JsonObject?.s(k: String) = this?.get(k)?.takeIf { it.isJsonPrimitive }?.asString ?: ""

/**
 * The card view in Play (views.js cardSheet with the Play lens): it slides up over the screen, art on
 * top bleeding into the glass, then name, type with "Play · N of 4", mana cost; pinned tabs Overview,
 * Play guide, Get it. Overview = set line with Play set progress, the card in its real finish (drag it to
 * move the light, tap to enlarge), the finish rail, rules text with tappable rule words, facts and the
 * Play actions. Get it = craft with seals, holo, the Merchant, the set and precons. Never prices.
 */
@Composable
fun CardSheet(pick: CardPick, state: JsonObject?, act: CardSheetActions, onClose: () -> Unit, startTab: String = "overview") {
    // Two screens (Randall 9 Nov, approved): this same sheet as one tall strip across both screens (see CollectionCardSheet).
    val part = LocalSpanPart.current
    // Two screens (specs/thor-card-popup-dual.md, approved 10 Nov 14:48Z): the page uses the top screen's full width and the
    // bottom screen is the card, whole, with its keys. The look is the same; only the placement changes.
    if (DualScreen.active && part == null) { DualCardSheet(pick, state, act, onClose, startTab); return }
    val span = part?.second; val slice = part?.first
    val context = LocalContext.current
    val data = CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) }
    val prints by CardFacts.prints.collectAsState()
    val facts by CardFacts.cards.collectAsState()
    LaunchedEffect(pick) { pick.printId?.let { CardFacts.wantPrint(it) } ?: CardFacts.want(listOf(pick.oracle to null)) }
    val shown: JsonObject? = pick.printId?.let { prints[it] } ?: facts[pick.oracle]?.card
    // On two screens both slices share the tab, the finish and the face, so the strip reads as one page.
    val ownTab = remember(pick) { mutableStateOf(startTab) }; val ownAsked = remember(pick) { mutableStateOf(pick.finish) }; val ownFace = remember(pick) { mutableStateOf(0) }
    val tabState: androidx.compose.runtime.MutableState<String> = span?.tab ?: ownTab
    val askedState: androidx.compose.runtime.MutableState<String> = span?.asked ?: ownAsked
    val faceState: androidx.compose.runtime.MutableState<Int> = span?.face ?: ownFace
    var tab by tabState
    var asked by askedState
    val finish = Foil.finishFor(shown, asked)
    var face by faceState
    var rule by remember { mutableStateOf<CardData.Rule?>(null) }
    var zoom by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Slide in from below; drag the head down (or Back) to let it go.
    val y = remember { Animatable(1f) }
    LaunchedEffect(Unit) { if (Motion.still) y.snapTo(0f) else y.animateTo(0f, tween(320, easing = androidx.compose.animation.core.FastOutSlowInEasing)) }
    fun close() { scope.launch { if (!Motion.still) y.animateTo(1f, tween(220)); onClose() } }
    BackHandler(enabled = rule == null && !zoom) { close() }
    // A controller: B closes the sheet (the BackHandler above), LB/RB step through Overview, Play guide and Get it.
    PadScreen(remember(pick) { PadActs(b = "Close", opaque = true, tabs = { d -> val i = CardSheetTabs.indexOfFirst { it.first == tab }.coerceAtLeast(0); tab = CardSheetTabs[(i + d).coerceIn(0, CardSheetTabs.lastIndex)].first }) })
    // The grid under the sheet holds its foil still: only this card moves.
    FoilFocus.Cover()

    BoxWithConstraints(Modifier.fillMaxSize().padLayer()) {
        val h = constraints.maxHeight.toFloat()
        var zoomed: (@Composable () -> Unit)? = null
        if (span == null) Box(Modifier.fillMaxSize().graphicsLayer { alpha = 1f - y.value }.background(Color(0x99000000))
            .pointerInput(Unit) { detectTapGestures { close() } })
        else { if (slice == 1) { span.w = maxWidth; span.botH = maxHeight } else span.topH = maxHeight
            Box(Modifier.fillMaxSize().background(Color(0xFF0B0C10))) }
        val sheetShape = if (span != null) RoundedCornerShape(0.dp) else RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
        Column((if (span != null) Modifier.align(Alignment.TopCenter).width(if (span.w > 0.dp) span.w else maxWidth * .62f).fillMaxHeight()
            else Modifier.align(Alignment.BottomCenter).widthIn(max = 720.dp).fillMaxWidth().fillMaxHeight(.94f).offset { IntOffset(0, (y.value * h).roundToInt()) })
            .clip(sheetShape).background(Color(0xFF12151B))
            .border(1.dp, Color(0x17FFFFFF), sheetShape)) {
            if (shown == null) { Loading(pick.name) { close() }; return@Column }
            val name = shown.s("name").ifBlank { pick.name }
            val faces = shown.getAsJsonArray("card_faces")?.mapNotNull { it as? JsonObject }?.takeIf { it.isNotEmpty() } ?: listOf(shown)
            val imgFaces = faces.filter { it.getAsJsonObject("image_uris") != null }
            val f = faces.getOrElse(face) { faces[0] }
            val heroArt = (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null }
                ?: shown.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null } ?: faces[0].getAsJsonObject("image_uris")?.s("art_crop")
            val image = (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("normal")?.ifBlank { null }
                ?: shown.getAsJsonObject("image_uris")?.s("normal")?.ifBlank { null } ?: faces[0].getAsJsonObject("image_uris")?.s("normal")
            val owned = Trunk.owned(state, name, shown.s("oracle_id").ifBlank { null }).coerceAtMost(4)
            val list = rememberLazyListState()
            // Native-plus (Randall 4 Nov 00:13Z): the art runs down the whole sheet, blurred and tinted, so every panel
            // below the banner sits on it as tinted glass instead of a flat sheet.
            val frostLayer = androidx.compose.ui.graphics.rememberGraphicsLayer()
            val frost = remember(frostLayer) { Frost(frostLayer) }
            Box(Modifier.fillMaxSize()) {
            GlassBackdrop(heroArt, frost)
            androidx.compose.runtime.CompositionLocalProvider(LocalFrost provides frost) {
            if (span != null && slice != null) SpanStrip(span, slice) {
                run {
                    Header(name, f.s("type_line").ifBlank { shown.s("type_line") }, f.s("mana_cost").ifBlank { shown.s("mana_cost") }, owned, heroArt, { list.firstVisibleItemScrollOffset },
                        onDrag = { dy -> scope.launch { y.snapTo((y.value + dy / h).coerceAtLeast(0f)) } },
                        onDragEnd = { scope.launch { if (y.value > .18f) close() else y.animateTo(0f, tween(200)) } }, onClose = { close() })
                }
                Tabs(tab) { tab = it }
                when (tab) {
                    "overview" -> run {
                        // Randall 6 Nov 01:41Z: a finish shows only when a copy is in it (or the card was opened in it), so a preview never reads as owned.
                        val mine = state?.let { Trunk.finishesOwned(it, name, shown.s("oracle_id").ifBlank { null }) + pick.finish }
                        Overview(name, shown, faces, imgFaces, face, image, finish, data, state, owned, mine, act, { asked = it }, { face = 1 - face }, { rule = it }, { zoom = true }, { tab = "get" })
                    }
                    "guide" -> Guide(shown, data) { rule = it }
                    else -> GetIt(name, shown, state, owned, act)
                }
                Spacer(Modifier.navigationBarsPadding().height(40.dp))
            } else             LazyColumn(state = list, modifier = Modifier.fillMaxSize()) {
                item {
                    Header(name, f.s("type_line").ifBlank { shown.s("type_line") }, f.s("mana_cost").ifBlank { shown.s("mana_cost") }, owned, heroArt, { list.firstVisibleItemScrollOffset },
                        onDrag = { dy -> scope.launch { y.snapTo((y.value + dy / h).coerceAtLeast(0f)) } },
                        onDragEnd = { scope.launch { if (y.value > .18f) close() else y.animateTo(0f, tween(200)) } }, onClose = { close() })
                }
                stickyHeader { Tabs(tab) { tab = it } }
                when (tab) {
                    "overview" -> item {
                        // Randall 6 Nov 01:41Z: a finish shows only when a copy is in it (or the card was opened in it), so a preview never reads as owned.
                        val mine = state?.let { Trunk.finishesOwned(it, name, shown.s("oracle_id").ifBlank { null }) + pick.finish }
                        Overview(name, shown, faces, imgFaces, face, image, finish, data, state, owned, mine, act, { asked = it }, { face = 1 - face }, { rule = it }, { zoom = true }, { tab = "get" })
                    }
                    "guide" -> item { Guide(shown, data) { rule = it } }
                    else -> item { GetIt(name, shown, state, owned, act) }
                }
                item { Spacer(Modifier.navigationBarsPadding().height(40.dp)) }
            }
            }
            }
            // views.js:461 .cd-zoom: data-src = the normal image, data-hi = this face's png, data-art = the hero art crop.
            val hi = (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("png")?.ifBlank { null }
                ?: shown.getAsJsonObject("image_uris")?.s("png")?.ifBlank { null }
            val look = data?.let { Foil.look(it, shown, finish) }
            zoomed = if (zoom && image != null) ({ CardZoom(image, hi, heroArt, look,
                gallery = heroArt?.takeIf { it.isNotBlank() && DualScreen.active }?.let { a -> Gallery(listOf(galleryPiece(a, f.s("name").ifBlank { name },
                    f.s("artist").ifBlank { shown.s("artist") }, f.s("flavor_text").ifBlank { shown.s("flavor_text") }, shown))) }) { zoom = false } }) else null
        }
        // Over the whole screen, not inside the sheet's column: there the list took all the height, so the enlarged
        // card was pushed below the sheet and stayed half drawn over every tab (Randall 3 Nov 20:51Z).
        // Two screens: the enlarged card takes the top screen.
        if (span != null) zoomed?.let { z -> TopScreen(z) } else zoomed?.invoke()
        rule?.let { RuleCard(it) { rule = null } }
    }
}

/** The sheet's art backdrop: the art crop filling the sheet, blurred, under a dark tint that deepens downwards. */
/** The art the glass panels frost: the backdrop drawn into a layer, and where that backdrop sits on screen. */
internal class Frost(val layer: androidx.compose.ui.graphics.layer.GraphicsLayer) {
    var origin by mutableStateOf(Offset.Zero)
    /**
     * The finished backdrop and the 28 dp frost of it, kept as two pictures once the art has drawn. Scrolling then only
     * copies pixels: live, every glass panel blurred the whole sheet again on every frame (Randall 5 Nov "pop up big card
     * lag city"). The frost is kept at half size; blurred that much, it looks the same scaled back up.
     */
    var backdrop by mutableStateOf<androidx.compose.ui.graphics.ImageBitmap?>(null)
    var frosted by mutableStateOf<androidx.compose.ui.graphics.ImageBitmap?>(null)

    /** Returns false when the picture came out without the art (nothing changes then and the live glass stays). */
    suspend fun bake(scratch: androidx.compose.ui.graphics.layer.GraphicsLayer, density: androidx.compose.ui.unit.Density, dir: androidx.compose.ui.unit.LayoutDirection): Boolean {
        val s = layer.size; if (s.width <= 0 || s.height <= 0) return false
        val back = layer.toImageBitmap()
        // An 8 x 8 copy proves the art is in it: the art fills the sheet, so its top and bottom rows are solid. A bare
        // picture would leave the sheet empty, so then the live glass stays.
        scratch.renderEffect = null
        scratch.record(density, dir, androidx.compose.ui.unit.IntSize(8, 8)) { drawImage(back, dstSize = androidx.compose.ui.unit.IntSize(8, 8)) }
        val probe = scratch.toImageBitmap().asAndroidBitmap().let { it.copy(android.graphics.Bitmap.Config.ARGB_8888, false) ?: return false }
        if (listOf(probe.getPixel(4, 0), probe.getPixel(4, 7)).any { android.graphics.Color.alpha(it) < 200 }) return false
        val r = with(density) { 14.dp.toPx() }
        scratch.renderEffect = androidx.compose.ui.graphics.BlurEffect(r, r, androidx.compose.ui.graphics.TileMode.Clamp)
        scratch.record(density, dir, androidx.compose.ui.unit.IntSize((s.width + 1) / 2, (s.height + 1) / 2)) {
            scale(.5f, .5f, Offset.Zero) { drawImage(back) }
        }
        val frost = scratch.toImageBitmap()
        backdrop = back; frosted = frost
        return true
    }
}
internal val LocalFrost = androidx.compose.runtime.staticCompositionLocalOf<Frost?> { null }

internal fun tone(saturation: Float, brightness: Float) = ColorFilter.colorMatrix(androidx.compose.ui.graphics.ColorMatrix().apply {
    setToSaturation(saturation); timesAssign(androidx.compose.ui.graphics.ColorMatrix(floatArrayOf(brightness, 0f, 0f, 0f, 0f, 0f, brightness, 0f, 0f, 0f, 0f, 0f, brightness, 0f, 0f, 0f, 0f, 0f, 1f, 0f))) })

/** Fade a layer out downwards between [from] and [to] (px from the top): polish.css mask-image on the bleed layers. */
internal fun Modifier.fadeDown(from: Float, to: Float) = graphicsLayer { compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
    .drawWithContent { drawContent(); val h = size.height.coerceAtLeast(1f)
        drawRect(Brush.verticalGradient((from / h).coerceIn(0f, 1f) to Color.Black, (to / h).coerceIn(0f, 1f) to Color.Transparent), blendMode = androidx.compose.ui.graphics.BlendMode.DstIn) }

/** One run of the art down the sheet: the hero-sized art, then mirrored copies (polish.css .cs-bleed-mirror) so it never ends. */
@Composable
private fun ArtRun(p: androidx.compose.ui.graphics.painter.Painter, heroH: androidx.compose.ui.unit.Dp, filter: ColorFilter?, modifier: Modifier) = Column(modifier) {
    repeat(6) { i -> Image(p, null, Modifier.fillMaxWidth().height(heroH).graphicsLayer { if (i % 2 == 1) scaleY = -1f }, contentScale = ContentScale.Crop, colorFilter = filter) }
}

/**
 * polish.css .cs-bleed, carried further down the sheet (Randall 4 Nov 00:13Z / 00:23Z "bleed more"): a glow of the whole
 * art (blur 40, saturate 1.45, brightness .62), the frosted run of the art and its mirror (blur 18) fading out far below
 * the banner, the soft run (blur 6) just under it, and the darkening veil, lighter than the site's so more art shows.
 * The finished backdrop is also recorded into [frost] so each glass panel can blur what is behind it.
 */
@Composable
internal fun GlassBackdrop(art: String?, frost: Frost, layers: (@Composable (androidx.compose.ui.graphics.painter.Painter) -> Unit)? = null) {
    val p = heroPainter(art?.let(homeArt)) ?: return
    val heroH = 210.dp
    // Bake once the art is in and has drawn: two frames after it loads (and again if the sheet changes size, as when a Fold opens).
    val ready = if (p is coil3.compose.AsyncImagePainter) p.state.collectAsState().value is coil3.compose.AsyncImagePainter.State.Success else true
    var size by remember { mutableStateOf(androidx.compose.ui.unit.IntSize.Zero) }
    val scratch = androidx.compose.ui.graphics.rememberGraphicsLayer()
    val density = androidx.compose.ui.platform.LocalDensity.current
    val dir = androidx.compose.ui.platform.LocalLayoutDirection.current
    LaunchedEffect(p, ready, size) {
        frost.backdrop = null; frost.frosted = null
        if (!ready || size.width <= 0) return@LaunchedEffect
        for (attempt in 0 until 3) {
            repeat(if (attempt == 0) 2 else 20) { androidx.compose.runtime.withFrameNanos { } }
            if (frost.layer.size == size && runCatching { frost.bake(scratch, density, dir) }.getOrDefault(false)) break
        }
    }
    val baked = frost.backdrop
    if (baked != null && baked.width == size.width && baked.height == size.height) {
        Box(Modifier.fillMaxSize().onGloballyPositioned { frost.origin = it.positionInRoot(); size = it.size }.drawBehind { drawImage(baked) })
        return
    }
    Box(Modifier.fillMaxSize().onGloballyPositioned { frost.origin = it.positionInRoot(); size = it.size }
        .drawWithContent { frost.layer.record { this@drawWithContent.drawContent() }; drawLayer(frost.layer) }) {
        if (layers != null) { layers(p); return@Box }
        Image(p, null, Modifier.fillMaxSize().blur(40.dp), contentScale = ContentScale.Crop, alignment = BiasAlignment(0f, -.4f), colorFilter = tone(1.45f, .62f))
        val hp = with(androidx.compose.ui.platform.LocalDensity.current) { heroH.toPx() }
        ArtRun(p, heroH, tone(1.3f, .78f), Modifier.fillMaxSize().blur(18.dp).fadeDown(hp + 60f * 3, hp + 900f * 3))
        ArtRun(p, heroH, tone(1.15f, .9f), Modifier.fillMaxSize().blur(6.dp).fadeDown(hp - 30f, hp + 130f * 3))
        Box(Modifier.fillMaxSize().drawBehind {
            drawRect(Brush.verticalGradient(0f to Color.Transparent, (hp * .45f) / size.height to Color.Transparent, (hp * .7f) / size.height to Color(0x2E0A0B10),
                hp / size.height to Color(0x570A0B10), ((hp + 220.dp.toPx()) / size.height).coerceAtMost(.99f) to Color(0x700A0B10), 1f to Color(0x8C0A0B10)))
        })
    }
}

/**
 * Frosted tinted glass: the backdrop right behind the panel, blurred again and lifted, under a smoked tint, a light sheen
 * from the top and a bright hairline edge. Without a backdrop (or before Android 12, no blur) it is plain smoked glass.
 */
@Composable
internal fun Modifier.glass(shape: androidx.compose.ui.graphics.Shape): Modifier {
    val frost = LocalFrost.current
    val at = remember { mutableStateOf(Offset.Zero) }
    val blurred = androidx.compose.ui.graphics.rememberGraphicsLayer()
    return this.onGloballyPositioned { at.value = it.positionInRoot() }.clip(shape)
        .drawBehind {
            val frosted = frost?.frosted
            if (frost != null && frosted != null) {
                // The baked frost, scaled back up to the sheet and placed so the panel shows the part right behind it.
                val d = frost.origin - at.value
                drawImage(frosted, dstOffset = IntOffset(d.x.roundToInt(), d.y.roundToInt()), dstSize = androidx.compose.ui.unit.IntSize(frosted.width * 2, frosted.height * 2),
                    filterQuality = androidx.compose.ui.graphics.FilterQuality.Low)
                drawRect(Color(0x14FFFFFF))
            } else if (frost != null && frost.layer.size.width > 0) {
                blurred.renderEffect = androidx.compose.ui.graphics.BlurEffect(28.dp.toPx(), 28.dp.toPx(), androidx.compose.ui.graphics.TileMode.Clamp)
                blurred.record(frost.layer.size) { drawLayer(frost.layer) }
                val d = frost.origin - at.value
                translate(d.x, d.y) { drawLayer(blurred) }
                drawRect(Color(0x14FFFFFF))
            }
        }
        .background(Color(0x5210131A))
        .background(Brush.verticalGradient(0f to Color(0x29FFFFFF), .35f to Color(0x0AFFFFFF), 1f to Color(0x05FFFFFF)))
        .border(1.dp, Brush.verticalGradient(0f to Color(0x59FFFFFF), .5f to Color(0x1FFFFFFF), 1f to Color(0x2EFFFFFF)), shape)
}

@Composable
private fun Loading(name: String, onClose: () -> Unit) = Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { CloseButton(onClose) }
    Text(name, style = t(22f, FontWeight.Bold)); Text("Loading flavor text and printings…", style = t(13f, color = Site.Muted))
}

@Composable
private fun CloseButton(onClick: () -> Unit) = Box(Modifier.size(40.dp).clip(CircleShape).background(Color(0x99101318)).border(1.dp, Color(0x22FFFFFF), CircleShape)
    .clickable(onClick = onClick), contentAlignment = Alignment.Center) { Text("✕", style = t(16f, FontWeight.Bold)) }

/** .cs-banner: the art crop with its shade, the blurred bleed behind, title and type over the foot of the art. */
@Composable
private fun Header(name: String, type: String, cost: String, owned: Int, art: String?, scrolled: () -> Int, onDrag: (Float) -> Unit, onDragEnd: () -> Unit, onClose: () -> Unit) {
    val p = heroPainter(art?.let(homeArt))
    Box(Modifier.fillMaxWidth().pointerInput(Unit) { detectVerticalDragGestures(onDragEnd = onDragEnd) { _, dy -> onDrag(dy) } }) {
        // The glassy bleed: the art blurred under the whole head, fading into the sheet (no hard edge).
        Column {
            Box(Modifier.fillMaxWidth().height(210.dp).graphicsLayer { translationY = scrolled() * .4f }) {
                // The sharp art melts into the blurred backdrop: masked to nothing over its last third, no edge.
                if (p != null) Image(p, null, Modifier.fillMaxSize()
                    .graphicsLayer { compositingStrategy = androidx.compose.ui.graphics.CompositingStrategy.Offscreen }
                    .drawWithContent { drawContent(); drawRect(Brush.verticalGradient(0f to Color.Black, .62f to Color.Black, 1f to Color.Transparent), blendMode = androidx.compose.ui.graphics.BlendMode.DstIn) },
                    contentScale = ContentScale.Crop)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), .5f to Color.Transparent, 1f to Color.Transparent)))
                Box(Modifier.align(Alignment.TopCenter).padding(top = 8.dp).size(40.dp, 4.dp).clip(CircleShape).background(Color(0x66FFFFFF)))
                Box(Modifier.align(Alignment.TopEnd).padding(12.dp)) { CloseButton(onClose) }
            }
            Row(Modifier.fillMaxWidth().layout { m, c -> val pl = m.measure(c); val lift = 34.dp.roundToPx(); layout(pl.width, pl.height - lift + 8.dp.roundToPx()) { pl.place(0, -lift) } }.padding(horizontal = 18.dp), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 28.sp, color = Ink,
                        shadow = androidx.compose.ui.graphics.Shadow(Color(0xCC000000), Offset(0f, 2f), 12f)))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(type, style = t(14f, color = Color(0xFFCDD3DC)).copy(shadow = androidx.compose.ui.graphics.Shadow(Color(0xB3000000), Offset(0f, 1f), 10f)))
                        Text("Play · $owned of 4", style = t(12f, FontWeight.Bold, Site.Gold), modifier = Modifier.clip(RoundedCornerShape(999.dp))
                            .background(Color(0x1FE8B95B)).border(1.dp, Color(0x4DE8B95B), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 2.dp))
                    }
                }
                ManaCost(cost, 20.dp, Modifier.padding(top = 4.dp))
            }
        }
    }
}


@Composable
private fun Tabs(on: String, pick: (String) -> Unit) = Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
    Segmented(CardSheetTabs, on, glass = true, pick = pick)
}
private val CardSheetTabs = listOf("overview" to "Overview", "guide" to "Play guide", "get" to "Get it")

// ---------------------------------------------------------------- Overview

@Composable
private fun Overview(name: String, shown: JsonObject, faces: List<JsonObject>, imgFaces: List<JsonObject>, face: Int, image: String?, finish: String, data: CardData?, state: JsonObject?,
                     owned: Int, mine: Set<String>?, act: CardSheetActions, onFinish: (String) -> Unit, onFlip: () -> Unit, onRule: (CardData.Rule) -> Unit, onZoom: () -> Unit, onGet: () -> Unit,
                     /** Two screens: the bottom screen is the card, so the top shows no picture, no flip and no set line (pinned at its foot). */
                     dual: Boolean = false) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (!dual) SetLine(shown, state, act)
        if (!dual) run {
        // The card: drag across it to move the light (the phone's tilt moves it too); tap to enlarge.
        val look = data?.let { Foil.look(it, shown, finish) }
        // feel.js attachTilt + attachMotionTilt: the card leans to the finger or the phone, and its light (and foil) follows.
        val lean = rememberCardLean()
        val touch = remember(lean) { androidx.compose.runtime.derivedStateOf { lean.light } }
        val shines = look?.takeIf { it.shines }
        val tilt = rememberFoilTilt(live = look?.recipe != null, touch = touch)
        // A controller: Y enlarges the card (its tap), holding Y leans it under the light as a finger does; on the card itself A enlarges it.
        val zoomNow by androidx.compose.runtime.rememberUpdatedState(onZoom)
        val padScope = rememberCoroutineScope()
        PadScreen(remember(lean) { PadActs(y = PadAct("Inspect") { zoomNow() }, yHold = lean.padHold(padScope)) })
        val padSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
        val padPic = remember { PadActs(a = "Inspect") }
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            val w = minOf(maxWidth, 340.dp)
            CardPicture(image, shines, tilt, Modifier.size(w, w * 88f / 63f).cardLean(lean, foil = shines != null, shape = RoundedCornerShape(16.dp))
                // Site: a tap opens the zoom; a hold does nothing and the release after it opens nothing (card-actions.js press.held).
                .pointerInput(Unit) { detectTapGestures(onLongPress = {}) { onZoom() } }.padCardTap(padSource, padPic) { zoomNow() }, shape = RoundedCornerShape(16.dp))
        }
        if (imgFaces.size > 1) GhostButton("↻ Flip to ${imgFaces[if (face == 0) 1 else 0].s("name")}", Modifier.fillMaxWidth(), onClick = onFlip)
        }
        FinishRail(shown, finish, data, mine, onFinish)
        // card detail "Use as profile photo" (profile-art.js): opens the circle editor on this printing's art; never adds the card anywhere.
        val artCrop = (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null }
            ?: shown.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null } ?: faces.firstOrNull()?.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null }
        if (artCrop != null && dev.cardstashy.nativeplay.account.Account.session.collectAsState().value != null)
            GhostButton("Use as profile photo", Modifier.fillMaxWidth()) { ArtPick.open("avatar", ArtPick.Card("mtg", shown.s("id"), name, shown.s("set_name"), artCrop, artCrop)) }
        faces.forEachIndexed { i, f -> RulesBox(f, shown, faces.size > 1, i, data, onRule) }
        val inDecks = Trunk.decks(state).filter { d -> d.getAsJsonArray("cards")?.any { (it as? JsonObject)?.s("name") == name } == true }
        if (inDecks.isNotEmpty()) Text("In " + inDecks.joinToString(", ") { it.s("name") }, style = t(13f, color = Site.Muted))
        Chips(shown)
        Research(shown, name)
        PlayActions(name, shown, state, owned, act, onGet)
    }
}

@Composable
private fun SetLine(shown: JsonObject, state: JsonObject?, act: CardSheetActions) {
    val code = shown.s("set"); if (code.isBlank()) return
    SetFacts.sets.collectAsState().value
    val (have, total) = Trunk.setProgress(state, code)
    // Every card view links its set (Randall 6 Nov: Summer Magic's row on a deck's card did nothing); no link, no chevron.
    val go = act.set ?: LocalShopSetNav.current
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp))
        .then(if (go != null) Modifier.clickable { go(code) } else Modifier).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RaritySetIcon(code, shown.s("rarity"), 24.dp)
            Column(Modifier.weight(1f)) {
                Text(shown.s("set_name").ifBlank { code.uppercase() } + if (go != null) "  ›" else "", style = t(15f, FontWeight.Bold))
                Text("${code.uppercase()} #${shown.s("collector_number").ifBlank { "?" }} · ${RARITY[shown.s("rarity")] ?: shown.s("rarity")}" +
                    shown.s("released_at").take(4).let { if (it.isNotBlank()) " · $it" else "" }, style = t(12f, color = Site.Muted))
            }
        }
        // A set whose size is not known shows the count alone: no "/ ?", no percent, no bar (fix list C9; data only).
        val size = total?.takeIf { it > 0 }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (size == null) "$have in your Trunk" else "$have / $size in your Trunk", style = t(12f, color = Site.Muted), modifier = Modifier.weight(1f))
            if (size != null) Text("${have * 100 / size}%", style = t(12f, FontWeight.Bold, Color(0xFFC9CED6)))
        }
        if (size != null) ProgressBar(have.toFloat() / size)
    }
}

/**
 * finishPreview: "Finish" and a chip per finish the printing has, nonfoil, foil, etched; foil names its material. In Play only the
 * finishes of your copies ([mine]): a holo copy is the printing's foil, or its etched foil when it has no foil.
 */
@Composable
private fun FinishRail(shown: JsonObject, on: String, data: CardData?, mine: Set<String>?, pick: (String) -> Unit) {
    val have = shown.getAsJsonArray("finishes")?.map { it.asString }?.toSet() ?: setOf("nonfoil")
    val all = FINISH_ORDER.filter { it in have }.ifEmpty { listOf("nonfoil") }
    val holo = if ("foil" in have) "foil" else "etched"
    val list = if (mine == null) all else all.filter { it in mine || (it == holo && "foil" in mine) }.ifEmpty { listOf(on) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Finish", style = t(12f, color = Site.Muted))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            list.forEach { k ->
                val label = if (k == "foil" && data != null) Foil.look(data, shown, "foil").label else FINISH_NAME.getValue(k)
                Chip(label, k == on) { pick(k) }
            }
        }
    }
}

/** .cd-text: "Spellcraft · Rules text", oracle lines with symbols and rule words, flavour, P/T or loyalty, artist. */
@Composable
private fun RulesBox(f: JsonObject, shown: JsonObject, multi: Boolean, i: Int, data: CardData?, onRule: (CardData.Rule) -> Unit) {
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("SPELLCRAFT · RULES TEXT", style = Site.Eyebrow.copy(fontSize = 11.sp, color = Site.Gold.copy(alpha = .85f)))
        if (multi) Row(verticalAlignment = Alignment.CenterVertically) { Text(f.s("name"), style = t(15f, FontWeight.Bold), modifier = Modifier.weight(1f)); ManaCost(f.s("mana_cost"), 16.dp) }
        if (multi) Text(f.s("type_line"), style = t(13f, color = Site.Muted))
        f.s("oracle_text").split("\n").filter { it.isNotBlank() }.forEach { line -> RuleLine(line, data, onRule) }
        f.s("flavor_text").takeIf { it.isNotBlank() }?.let {
            Column(Modifier.fillMaxWidth().border(width = 0.dp, color = Color.Transparent).padding(start = 10.dp)) {
                Text("FLAVOUR", style = Site.Eyebrow.copy(fontSize = 10.sp, color = Site.Muted)); Text(flavourText(it), style = t(14f, color = Color(0xFFC7CCD4)).copy(fontStyle = FontStyle.Italic))
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            val pt = f.get("power")?.takeIf { it.isJsonPrimitive }?.let { "${f.s("power")}/${f.s("toughness")}" }
                ?: shown.s("loyalty").takeIf { it.isNotBlank() && i == 0 }?.let { "Loyalty $it" } ?: ""
            Text(pt, style = t(14f, FontWeight.Bold))
            (f.s("artist").ifBlank { shown.s("artist") }).takeIf { it.isNotBlank() }?.let { Text("Illus. $it", style = t(12f, color = Site.Muted)) }
        }
    }
}

/** ruleText: rule words become taps (quoted names never do); {X} symbols draw inline. */
@Composable
private fun RuleLine(line: String, data: CardData?, onRule: (CardData.Rule) -> Unit, size: Int = 15) {
    val inline = HashMap<String, InlineTextContent>()
    val text = buildAnnotatedString {
        val parts = mutableListOf<Pair<String, Boolean>>()
        val q = Regex("(\"[^\"\\n]*\"|“[^”\\n]*”)"); var last = 0
        for (m in q.findAll(line)) { parts += line.substring(last, m.range.first) to false; parts += m.value to true; last = m.range.last + 1 }
        parts += line.substring(last) to false
        for ((part, isQuote) in parts) {
            if (isQuote || data == null) { symbols(part, inline); continue }
            var start = 0
            for (m in data.ruleRegex.findAll(part)) {
                symbols(part.substring(start, m.range.first), inline)
                val r = data.rule(m.value)
                if (r != null) withLink(LinkAnnotation.Clickable("rule:${r.key}", TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline, color = Color(0xFFE9CF93)))) { onRule(r) }) { append(m.value) }
                else append(m.value)
                start = m.range.last + 1
            }
            symbols(part.substring(start), inline)
        }
    }
    Text(text, style = t(size.toFloat(), line = size * 1.45f), inlineContent = inline)
}

internal fun AnnotatedString.Builder.symbols(s: String, inline: HashMap<String, InlineTextContent>) {
    var last = 0
    for (m in Regex("\\{([^}]+)\\}").findAll(s)) {
        append(s.substring(last, m.range.first)); val sym = m.groupValues[1]; val id = "sym:$sym"
        inline.getOrPut(id) { InlineTextContent(Placeholder(1.05.em, 1.05.em, PlaceholderVerticalAlign.TextCenter)) { Symbol(sym, 16.dp, Modifier.fillMaxSize()) } }
        appendInlineContent(id, "{$sym}"); last = m.range.last + 1
    }
    append(s.substring(last))
}

@Composable
private fun Chips(c: JsonObject) {
    val list = buildList {
        c.get("edhrec_rank")?.takeIf { it.isJsonPrimitive }?.asInt?.let { add("EDHREC #" + "%,d".format(it)) }
        if (c.get("reserved")?.asBoolean == true) add("Reserved List")
        if (c.get("game_changer")?.asBoolean == true) add("Game Changer")
    }
    if (list.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        list.forEach { Text(it, style = t(12f, FontWeight.Bold, if (it == "Game Changer") Color(0xFFFFB86B) else Color(0xFFC9CED6)),
            modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 4.dp)) }
    }
}

@Composable
private fun Research(c: JsonObject, name: String) {
    val uri = LocalUriHandler.current
    val edh = name.lowercase().split(" // ")[0].replace(Regex("[^a-z0-9]+"), "-").trim('-')
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Research", style = t(12f, color = Site.Muted))
        Text("Scryfall", style = t(14f, FontWeight.SemiBold, Site.Gold), modifier = Modifier.clickable { runCatching { uri.openUri(c.s("scryfall_uri").ifBlank { "https://scryfall.com/search?q=" + java.net.URLEncoder.encode(name, "UTF-8") }) } })
        Text("EDHREC", style = t(14f, FontWeight.SemiBold, Site.Gold), modifier = Modifier.clickable { runCatching { uri.openUri("https://edhrec.com/cards/$edh") } })
    }
}

// ---------------------------------------------------------------- Play actions and Get it

@Composable
private fun OwnLine(n: Int) = Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Pips(n); Text(if (n > 0) "$n of 4 in your Trunk" else "Not in your Trunk yet", style = t(14f, FontWeight.Bold))
}

/** views.js playEditActions: the copy stepper for the open deck (the deck cover is set by holding a tile in the builder). */
@Composable
private fun EditActions(e: DeckEditCtx, name: String) {
    val q = e.qty(name)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StepBtn("−", q > 0, gold = false) { e.step(name, -1) }
            Text("$q in deck", style = t(15f, FontWeight.Bold), textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.widthIn(min = 74.dp))
            StepBtn("+", q < e.copies, gold = true) { e.step(name, 1) }
        }
    }
}

@Composable
private fun StepBtn(label: String, enabled: Boolean, gold: Boolean, onClick: () -> Unit) = Box(Modifier.size(44.dp).alpha(if (enabled) 1f else .4f).clip(RoundedCornerShape(11.dp))
    .then(if (gold) Modifier.background(Site.Gold) else Modifier.background(Color(0x0FFFFFFF)).border(1.dp, Color(0x24FFFFFF), RoundedCornerShape(11.dp)))
    .clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) { Text(label, style = t(18f, FontWeight.Bold, if (gold) Color(0xFF1B1406) else Ink)) }

@Composable
private fun PlayActions(name: String, shown: JsonObject, state: JsonObject?, n: Int, act: CardSheetActions, onGet: () -> Unit) {
    val decks = Trunk.decks(state)
    val ownOpen = remember { mutableStateOf(false) }
    val openState: androidx.compose.runtime.MutableState<Boolean> = LocalDecksOpen.current ?: ownOpen
    var open by openState
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OwnLine(n)
        act.edit?.let { e -> EditActions(e, name) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (n < 4) GoldCta(if (n > 0) "Get more copies" else "Get it", onClick = onGet)
            if (decks.isNotEmpty()) GhostButton("Add to deck", gold = n >= 4) { open = !open }
            GhostButton("New deck") { act.newDeck(name) }
        }
        if (open) Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            decks.forEach { d -> GhostButton(d.s("name").ifBlank { "Untitled deck" }, Modifier.fillMaxWidth()) { scope.launch { addToDeck(d, name, state, act) } } }
            if (n == 0) Text("Greyed in the deck until it is in your Trunk.", style = t(12f, color = Site.Muted))
        }
    }
}

/** playCardToDeck: one more copy into a Play deck (owned forced to 4, the format's cap), saved on the server. */
private suspend fun addToDeck(d: JsonObject, name: String, state: JsonObject?, act: CardSheetActions) {
    val all = d.getAsJsonArray("cards")?.mapNotNull { it as? JsonObject } ?: emptyList()
    val main = all.filter { it.get("board") == null || it.get("board").isJsonNull || it.s("board").isBlank() }
    val next = Trunk.addOne(main.map { it.s("name") to (it.get("qty")?.asInt ?: 0) }, name, d.s("format"))
    if (next == null) { act.toast("No more copies of that card can go in ${d.s("name").ifBlank { "that deck" }}."); return }
    val cards = JsonArray().apply { next.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) }; (all - main.toSet()).forEach { add(it) } }
    runCatching { Progress.saveDeck(JsonObject().apply { addProperty("id", d.s("id")); addProperty("name", d.s("name")); addProperty("format", d.s("format")); add("cards", cards) }) }
        .onSuccess { act.toast("Added to ${d.s("name").ifBlank { "your deck" }}" + if (Trunk.byName(Trunk.cards(state)).containsKey(name)) "." else ". It stays greyed until it is in your Trunk.") }
        .onFailure { act.toast(it.message ?: "Could not save the deck.") }
}

@Composable
private fun GetIt(name: String, shown: JsonObject, state: JsonObject?, n: Int, act: CardSheetActions) {
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    val st = if (n < 4) Trunk.stamp(state, shown) else null
    val craft = Trunk.craft(state, name, shown)
    val holo = Trunk.holo(state, name, shown)
    val set = shown.s("set")
    fun run(block: suspend () -> Unit) = scope.launch { runCatching { block() }.onFailure { act.toast(it.message ?: "Something went wrong.") }; Progress.refresh() }
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        OwnLine(n)
        if (n < 4) Block("Craft with seals") {
            if (craft != null && craft.room > 0) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (k in 1..craft.room) CraftN(k, craft.seal, k <= craft.seals) { run {
                    var made = 0; repeat(k) { Progress.craft(craft.id); made++ }
                    Feel.perform(view, "reward-claim"); act.toast("$made $name crafted into your Trunk.") } }
            } else if (st != null) StampButton("Stamp it", 1, st, false) { run { Progress.craft(st.id, false); Feel.perform(view, "reward-claim"); act.toast("$name is in your Trunk.") } }
            else Text("This printing can't be stamped. Try another printing on Overview.", style = t(13f, color = Site.Muted))
        }
        if (st?.canFoil == true || holo?.can == true) Block("Holo") {
            if (st?.canFoil == true) StampButton("Stamp holo", st.holoCost, st, true) { run { Progress.craft(st.id, true); Feel.perform(view, "reward-claim"); act.toast("$name (holo) is in your Trunk.") } }
            else if (holo != null) GhostButton("Make holo · ${holo.cost} ${holo.seal} seals", enabled = holo.afford) { run { Progress.holo(holo.oracle); Feel.perform(view, "reward-claim"); act.toast("$name is now holo. It has its own tile in your Trunk.") } }
        }
        val shopSet = LocalShopSetNav.current
        val toMerchant = act.merchant ?: shopSet?.let { g -> { code: String, _: String -> g(code) } }
        val toSet = act.set ?: shopSet
        if (set.isNotBlank() && (toMerchant != null || toSet != null)) Block("Packs and precons") {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (toMerchant != null) { if (n < 4) GoldCta("Its pack at the Merchant") { toMerchant(set, name) } else GhostButton("Its pack at the Merchant") { toMerchant(set, name) } }
                if (toSet != null) GhostButton("See the whole set") { toSet(set) }
                if (n < 4) GhostButton("Find it in a precon") { act.precon(name, set) }
            }
        }
    }
}

@Composable
private fun Block(title: String, content: @Composable () -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(title, style = t(16f, FontWeight.Bold)); content() }

@Composable
private fun StampButton(label: String, cost: Int, st: Trunk.Stamp, ghost: Boolean, onClick: () -> Unit) {
    val text = "$label · $cost ${st.rarity} seal${if (cost == 1) "" else "s"}"
    if (ghost) GhostButton(text, enabled = st.seals >= cost, onClick = onClick) else GoldCta(text, enabled = st.seals >= cost, onClick = onClick)
}

/** .pe-craft-n: a seal of the card's rarity and the number of copies. */
@Composable
private fun CraftN(k: Int, seal: String, enabled: Boolean, onClick: () -> Unit) {
    Row(Modifier.alpha(if (enabled) 1f else .4f).clip(RoundedCornerShape(12.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(12.dp))
        .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        SealMini(seal); Text("$k", style = t(15f, FontWeight.Bold))
    }
}

private val SEAL_MINI = mapOf("c" to (0xFF9AA1A9 to 0xFF5D636B), "u" to (0xFFD9E3EA to 0xFF7E8D99), "r" to (0xFFF1CF7C to 0xFFA77A23), "m" to (0xFFF28A4B to 0xFFA8381B))
@Composable
fun SealMini(key: String, size: androidx.compose.ui.unit.Dp = 20.dp) = androidx.compose.foundation.Canvas(Modifier.size(size)) {
    val (a, b) = SEAL_MINI[key] ?: SEAL_MINI.getValue("c"); val u = this.size.width / 32f
    drawCircle(Color(a), 13.5f * u); drawCircle(Color(b), 8.4f * u, style = androidx.compose.ui.graphics.drawscope.Stroke(1.6f * u))
    val star = androidx.compose.ui.graphics.Path().apply { moveTo(16f * u, 10.5f * u); lineTo(17.6f * u, 13.9f * u); lineTo(21.3f * u, 14.3f * u); lineTo(18.5f * u, 16.8f * u)
        lineTo(19.3f * u, 20.5f * u); lineTo(16f * u, 18.6f * u); lineTo(12.7f * u, 20.5f * u); lineTo(13.5f * u, 16.8f * u); lineTo(10.7f * u, 14.3f * u); lineTo(14.4f * u, 13.9f * u); close() }
    drawPath(star, Color(b))
}

// ---------------------------------------------------------------- Play guide

private val FORMATS = listOf("standard" to "Standard", "pioneer" to "Pioneer", "modern" to "Modern", "legacy" to "Legacy", "vintage" to "Vintage", "pauper" to "Pauper", "commander" to "Commander")

/** Rules & legality (the Play guide's last block): format legality and the official rulings from Scryfall. */
@Composable
private fun Guide(shown: JsonObject, data: CardData?, onRule: (CardData.Rule) -> Unit) {
    val id = shown.s("id")
    val rulings by produceState<List<Pair<String, String>>?>(null, id) {
        value = withContext(Dispatchers.IO) { runCatching { (Http.call("GET", "https://api.scryfall.com/cards/$id/rulings", mapOf("Accept" to "application/json"), null, 12_000) as? JsonObject)
            ?.getAsJsonArray("data")?.mapNotNull { (it as? JsonObject)?.let { r -> r.s("comment") to "${if (r.s("source") == "wotc") "Wizards of the Coast" else "Scryfall"} · ${r.s("published_at")}" } } }.getOrNull() ?: emptyList() }
    }
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        val words = data?.let { d -> (shown.getAsJsonArray("keywords")?.map { it.asString } ?: emptyList()).mapNotNull { d.rule(it) } } ?: emptyList()
        if (words.isNotEmpty()) Block("Its keywords") {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { words.forEach { r -> Chip(r.label, false) { onRule(r) } } }
        }
        Block("Rules & legality") {
            val legal = shown.getAsJsonObject("legalities")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                FORMATS.forEach { (k, l) -> val v = legal.s(k); val ok = v == "legal" || v == "restricted"
                    Text("$l · ${v.replace("_", " ").ifBlank { "unknown" }}", style = t(12f, FontWeight.Bold, if (ok) Color(0xFF7FD6A2) else Site.Muted),
                        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 4.dp)) }
            }
            when {
                rulings == null -> StateLoading("Loading official rulings…")
                rulings!!.isEmpty() -> StateEmpty("No official rulings for this card.")
                else -> rulings!!.forEach { (c, src) -> Column { RuleLine(c, null, {}); Text(src, style = t(12f, color = Site.Muted)) } }
            }
        }
    }
}

// ---------------------------------------------------------------- overlays

/** The rule hint (rule-dex.js keywordHelp): label, the reminder, the tip, and the lesson. */
@Composable
private fun RuleCard(r: CardData.Rule, onClose: () -> Unit) {
    BackHandler(onBack = onClose)
    PadScreen(remember { PadActs(b = "Close", opaque = true) })
    Box(Modifier.fillMaxSize().background(Color(0x66000000)).pointerInput(Unit) { detectTapGestures { onClose() } }, contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.widthIn(max = 560.dp).fillMaxWidth().padding(12.dp).navigationBarsPadding().clip(RoundedCornerShape(20.dp)).background(Color(0xF21A1E26))
            .border(1.dp, Color(0x33E8B95B), RoundedCornerShape(20.dp)).pointerInput(Unit) { detectTapGestures { } }.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("RULE DEX", style = Site.Eyebrow.copy(fontSize = 11.sp, color = Site.Gold))
            Text(r.label, style = t(20f, FontWeight.Bold))
            Text(r.definition, style = t(15f, line = 22f))
            if (r.tip.isNotBlank()) Text(r.tip, style = t(13f, color = Site.Muted, line = 19f))
            if (r.title.isNotBlank()) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x0DFFFFFF)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(r.title, style = t(14f, FontWeight.Bold)); if (r.example.isNotBlank()) Text(r.example, style = t(13f, line = 19f)); if (r.detail.isNotBlank()) Text(r.detail, style = t(12f, color = Site.Muted, line = 17f))
            }
            GhostButton("Got it", Modifier.fillMaxWidth(), onClick = onClose)
        }
    }
}



/** Two screens: the bottom screen's X "Add to deck" opens the deck list in the top screen's Overview. */
private val LocalDecksOpen = androidx.compose.runtime.compositionLocalOf<androidx.compose.runtime.MutableState<Boolean>?> { null }


/** The official rulings (Scryfall, as the Play guide reads them): comment and its source line; null while loading. */
@Composable
private fun rulingsOf(shown: JsonObject?): List<Pair<String, String>>? {
    val id = shown.s("id")
    val live by produceState<List<Pair<String, String>>?>(null, id) {
        value = if (id.isBlank()) emptyList() else withContext(Dispatchers.IO) { runCatching { (Http.call("GET", "https://api.scryfall.com/cards/$id/rulings", mapOf("Accept" to "application/json"), null, 12_000) as? JsonObject)
            ?.getAsJsonArray("data")?.mapNotNull { (it as? JsonObject)?.let { r -> r.s("comment") to "${if (r.s("source") == "wotc") "Wizards of the Coast" else "Scryfall"} · ${r.s("published_at")}" } } }.getOrNull() ?: emptyList() }
    }
    return DualPage.testRulings ?: live
}

/** The size one step under [size] on the rulebook list, never under its smallest body size (13). */
private fun stepDown(size: Int): Int = Rule.Sizes.getOrElse(Rule.Sizes.indexOf(size) - 1) { 13 }.coerceAtLeast(13)

/**
 * The Play card sheet on two screens: "Card on the wall" (specs/thor-card-popup-dual.md, Revision 2). Top: the card's art as a dark bleed,
 * its facts on the left, the whole card in the middle, rules text and guide on the right. Bottom: a glass bleed of the art under tiles
 * (what you have, the set, where to get more, rulings) and the case keys: X the main action, Y the Art view, A flip (or zoom).
 */
@Composable
private fun DualCardSheet(pick: CardPick, state: JsonObject?, act: CardSheetActions, onClose: () -> Unit, @Suppress("UNUSED_PARAMETER") startTab: String) {
    val context = LocalContext.current
    val view = LocalView.current
    val data = CardData.ready.collectAsState().value.also { if (it == null) CardData.warm(context) }
    val prints by CardFacts.prints.collectAsState()
    val facts by CardFacts.cards.collectAsState()
    LaunchedEffect(pick) { pick.printId?.let { CardFacts.wantPrint(it) } ?: CardFacts.want(listOf(pick.oracle to null)) }
    val shown: JsonObject? = pick.printId?.let { prints[it] } ?: facts[pick.oracle]?.card
    var asked by remember(pick) { mutableStateOf(pick.finish) }
    var face by remember(pick) { mutableStateOf(0) }
    var rule by remember { mutableStateOf<CardData.Rule?>(null) }
    var zoom by remember { mutableStateOf<String?>(null) }   // "card" or "art"
    var decksOpen by remember(pick) { mutableStateOf(false) }
    var rulingsOpen by remember(pick) { mutableStateOf(false) }
    BackHandler(enabled = rule == null && zoom == null && !decksOpen && !rulingsOpen) { onClose() }
    BackHandler(enabled = decksOpen) { decksOpen = false }
    BackHandler(enabled = rulingsOpen && !decksOpen) { rulingsOpen = false }
    FoilFocus.Cover()
    val scroll = androidx.compose.foundation.rememberScrollState()
    val scope = rememberCoroutineScope()
    val finish = Foil.finishFor(shown, asked)
    val name = shown?.s("name")?.ifBlank { null } ?: pick.name
    val faces = shown?.getAsJsonArray("card_faces")?.mapNotNull { it as? JsonObject }?.takeIf { it.isNotEmpty() } ?: listOfNotNull(shown)
    val imgFaces = faces.filter { it.getAsJsonObject("image_uris") != null }
    val owned = shown?.let { Trunk.owned(state, name, it.s("oracle_id").ifBlank { null }).coerceAtMost(4) } ?: 0
    val flip: (() -> Unit)? = if (imgFaces.size > 1) ({ face = 1 - face }) else null
    val decks = Trunk.decks(state)
    // Where to get it: what the Get it tab offered, now a tile and the X key.
    val st = if (owned < 4 && shown != null) Trunk.stamp(state, shown) else null
    val craft = shown?.let { Trunk.craft(state, name, it) }
    val shopSet = LocalShopSetNav.current
    val set = shown.s("set")
    val toMerchant = act.merchant ?: shopSet?.let { g -> { code: String, _: String -> g(code) } }
    fun run(block: suspend () -> Unit) = scope.launch { runCatching { block() }.onFailure { act.toast(it.message ?: "Something went wrong.") }; Progress.refresh() }
    val getNow: (() -> Unit)? = when {
        owned >= 4 || shown == null -> null
        craft != null && craft.room > 0 && craft.seals >= 1 -> ({ run { Progress.craft(craft.id); Feel.perform(view, "reward-claim"); act.toast("1 $name crafted into your Trunk.") } })
        st != null && st.seals >= 1 -> ({ run { Progress.craft(st.id, false); Feel.perform(view, "reward-claim"); act.toast("$name is in your Trunk.") } })
        set.isNotBlank() && toMerchant != null -> ({ toMerchant(set, name) })
        else -> null
    }
    val xAct: PadAct? = when {
        shown == null -> null
        act.edit != null -> PadAct("Add a copy") { act.edit.step(name, 1) }
        getNow != null -> PadAct(if (owned > 0) "Get more" else "Get it") { getNow() }
        decks.isNotEmpty() -> PadAct("Add to deck") { decksOpen = true }
        else -> null
    }
    val heroArt = shown?.let { sh -> (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null }
        ?: sh.getAsJsonObject("image_uris")?.s("art_crop")?.ifBlank { null } ?: faces.firstOrNull()?.getAsJsonObject("image_uris")?.s("art_crop") }
    val yAct: PadAct? = heroArt?.takeIf { it.isNotBlank() }?.let { PadAct("Art view") { zoom = "art" } }
    val aAct: PadAct? = if (flip != null) PadAct("Flip", flip) else null
    PadScreen(remember(pick, xAct?.label, yAct?.label, aAct?.label) { PadActs(b = "Close", opaque = true, x = xAct, y = yAct) })
    val rulings = rulingsOf(shown)?.filter { it.first.isNotBlank() }.orEmpty()

    // One tilt value for both screens: the card's foil light, and the art bleeds' parallax.
    val image = shown?.let { (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("normal")?.ifBlank { null }
        ?: it.getAsJsonObject("image_uris")?.s("normal")?.ifBlank { null } ?: faces.firstOrNull()?.getAsJsonObject("image_uris")?.s("normal") }
    val look = if (shown != null) data?.let { Foil.look(it, shown, finish) } else null
    val shines = look?.takeIf { it.shines }
    val tilt = rememberFoilTilt(live = true)

    TopScreen {
        Box(Modifier.fillMaxSize().background(Rule.Color.Bg)) {
            if (shown == null) { Loading(pick.name) { onClose() }; return@Box }
            val f = faces.getOrElse(face) { faces[0] }
            val formats = legalFormats(shown)
            val artist = f.s("artist").ifBlank { shown.s("artist") }
            val num = shown.s("collector_number")
            val keywords = data?.let { d -> (shown.getAsJsonArray("keywords")?.map { it.asString } ?: emptyList()).mapNotNull { d.rule(it) } } ?: emptyList()
            DualTop(heroArt, tilt, scroll,
                card = { m -> if (image != null) CardPicture(image, shines, tilt, m, shape = CardCorner) },
                left = {
                    DualSectionBox("The card") {
                        Text(listOf(shown.s("set_name").ifBlank { shown.s("set").uppercase() }, RARITY[shown.s("rarity")] ?: shown.s("rarity")).filter { it.isNotBlank() }.joinToString(" · ").uppercase(),
                            style = Rule.Type.sans(12, FontWeight.Bold, Rule.Color.Gold).copy(letterSpacing = 1.4.sp))
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(name, style = Rule.Type.cinzel(24), modifier = Modifier.weight(1f, fill = false))
                            ManaCost(f.s("mana_cost").ifBlank { shown.s("mana_cost") }, 20.dp, Modifier.padding(top = 4.dp))
                        }
                        Text(f.s("type_line").ifBlank { shown.s("type_line") }, style = Rule.Type.S14.copy(color = Rule.Color.Muted))
                    }
                    if (formats.isNotEmpty()) DualSectionBox("Where it plays") { FormatPills(formats) }
                    if (artist.isNotBlank() || num.isNotBlank()) DualSectionBox("The art") {
                        if (artist.isNotBlank()) Text("Art by $artist", style = Rule.Type.S14)
                        Text(listOf(shown.s("set").uppercase() + if (num.isNotBlank()) " #$num" else "", shown.s("released_at").take(4)).filter { it.isNotBlank() }.joinToString(" · "),
                            style = Rule.Type.S13.copy(color = Rule.Color.Muted))
                    }
                },
                right = { size, compact ->
                    val fi = face.coerceIn(0, faces.lastIndex); val fcur = faces[fi]
                    val ptHead = fcur.get("power")?.takeIf { it.isJsonPrimitive }?.let { "${fcur.s("power")}/${fcur.s("toughness")}" }
                        ?: shown.s("loyalty").takeIf { it.isNotBlank() && fi == 0 }?.let { "Loyalty $it" } ?: ""
                    DualSectionBox("Rules text", trailing = ptHead) {
                        // The face on the card: Flip turns the card and these words follow.
                        listOf(face.coerceIn(0, faces.lastIndex)).forEach { i -> val fc = faces[i]
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (faces.size > 1) {
                                    Row(verticalAlignment = Alignment.CenterVertically) { Text(fc.s("name"), style = Rule.Type.sans(size, FontWeight.Bold), modifier = Modifier.weight(1f)); ManaCost(fc.s("mana_cost"), 16.dp) }
                                    Text(fc.s("type_line"), style = Rule.Type.sans(13, FontWeight.Normal, Rule.Color.Muted))
                                }
                                fc.s("oracle_text").split("\n").filter { it.isNotBlank() }.forEach { line -> RuleLine(line, data, { rule = it }, size) }
                                fc.s("flavor_text").takeIf { it.isNotBlank() }?.let { Text(flavourText(it), style = t(stepDown(size).toFloat(), color = Rule.Color.Muted).copy(fontStyle = FontStyle.Italic)) }
                            }
                        }
                    }
                    if (keywords.isNotEmpty()) DualSectionBox("Play guide") {
                        // A keyword's first sentence when it is short; a long one is named and left to a tap on its word in the rules text.
                        fun brief(d: String) = d.substringBefore(". ").trimEnd('.').let { if (it.length <= 110) "$it." else null }
                        val said = if (compact) emptyList() else keywords.mapNotNull { r -> brief(r.definition)?.let { r to it } }
                        val named = keywords.filter { r -> said.none { it.first == r } }
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            said.forEach { (r, d) -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("•", style = Rule.Type.sans(stepDown(size), FontWeight.Bold, Rule.Color.Gold))
                                Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(r.label) }; append(" · $d") }, style = t(stepDown(size).toFloat()), modifier = Modifier.weight(1f))
                            } }
                            if (named.isNotEmpty()) FormatPills(named.map { it.label })
                        }
                    }
                },
                onKey = { e ->
                    val k = e.keyCode; val down = e.action == android.view.KeyEvent.ACTION_DOWN
                    when {
                        k == android.view.KeyEvent.KEYCODE_DPAD_UP || k == android.view.KeyEvent.KEYCODE_DPAD_DOWN -> {
                            if (down) scope.launch { scroll.animateScrollBy(if (k == android.view.KeyEvent.KEYCODE_DPAD_DOWN) 260f else -260f) }; true }
                        k == android.view.KeyEvent.KEYCODE_BUTTON_A || k == android.view.KeyEvent.KEYCODE_DPAD_CENTER -> { if (down && e.repeatCount == 0) aAct?.run?.invoke(); aAct != null }
                        else -> false
                    }
                })
            rule?.let { RuleCard(it) { rule = null } }
            if (rulingsOpen) RulingsPage(name, rulings) { rulingsOpen = false }
        }
    }

    BottomScreen {
        if (shown == null) return@BottomScreen
        val code = shown.s("set")
        val inDecks = decks.filter { d -> d.getAsJsonArray("cards")?.any { (it as? JsonObject)?.s("name") == name } == true }
        val getLinks = buildList<Pair<String, (() -> Unit)?>> {
            if (owned < 4) {
                if (craft != null && craft.room > 0) add(("Craft a copy · 1 seal") to (if (craft.seals >= 1) getNow else null))
                else if (st != null) add(("Stamp it · 1 ${st.rarity} seal") to (if (st.seals >= 1) getNow else null))
            }
            if (code.isNotBlank() && toMerchant != null) add("Its pack at the Merchant" to { toMerchant(code, name) })
            if (owned < 4 && code.isNotBlank()) add("Find it in a precon" to { act.precon(name, code) })
        }
        val sections = listOf(
            DualSection("Yours", .9f, listOfNotNull(
                DualTile { GlassTile(Modifier.fillMaxSize(), "In your Trunk") { BigFact("$owned of 4", FINISH_NAME[finish] ?: finish.replaceFirstChar { it.uppercase() }) } },
                if (inDecks.isEmpty()) null else DualTile { GlassTile(Modifier.fillMaxSize(), "In decks", onClick = { decksOpen = true }) {
                    BigFact("${inDecks.size}", "of your decks use it", inDecks.joinToString(", ") { it.s("name") }) } })),
            DualSection("The set", 1.1f, listOfNotNull(
                if (code.isBlank()) null else DualTile { GlassTile(Modifier.fillMaxSize(), onClick = (act.set ?: shopSet)?.let { go -> { go(code) } }) { SetTileBody(shown, state) } })),
            DualSection("Get more", 1.25f, listOfNotNull(
                if (getLinks.isEmpty()) null else DualTile { GlassTile(Modifier.fillMaxSize(), "Where to find it") {
                    // Rows are top-anchored under the label at a fixed touch height, so the first line sits where the rulings tile's first line does.
                    BoxWithConstraints(Modifier.fillMaxSize()) {
                        val rowH = 40.dp
                        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                            getLinks.forEach { (l, go) ->
                                if (go != null) TileLink(l, go, Modifier.height(rowH), size = 16)
                                else Box(Modifier.fillMaxWidth().height(rowH), contentAlignment = Alignment.CenterStart) { Text("$l · not enough seals", style = Rule.Type.S13.copy(color = Rule.Color.Muted)) }
                            }
                        }
                    } } },
                if (rulings.isEmpty()) null else DualTile(1.25f) { GlassTile(Modifier.fillMaxSize(), "Rulings", onClick = { rulingsOpen = true }, padKey = "A") { DualRulingsBody(rulings.map { it.first }) } })))
        val buttons = listOfNotNull(
            xAct?.let { CaseButton("X", it.label, gold = true) { it.run?.invoke() } },
            yAct?.let { CaseButton("Y", it.label) { it.run?.invoke() } },
            aAct?.let { CaseButton("A", it.label) { it.run?.invoke() } })
        Box(Modifier.fillMaxSize()) {
            DualBottom(heroArt, tilt, sections, buttons)
            if (decksOpen) DeckPicker(decks, owned) { d -> decksOpen = false; scope.launch { addToDeck(d, name, state, act) } }
        }
    }

    if (zoom != null && shown != null) {
        val hi = (if (imgFaces.size > 1) imgFaces.getOrNull(face) else null)?.getAsJsonObject("image_uris")?.s("png")?.ifBlank { null }
            ?: shown.getAsJsonObject("image_uris")?.s("png")?.ifBlank { null }
        val f = faces.getOrElse(face) { faces[0] }
        if (image != null) TopScreen {
            CardZoom(image, hi, heroArt, data?.let { Foil.look(it, shown, finish) },
                gallery = heroArt?.takeIf { it.isNotBlank() }?.let { a -> Gallery(listOf(galleryPiece(a, f.s("name").ifBlank { name },
                    f.s("artist").ifBlank { shown.s("artist") }, f.s("flavor_text").ifBlank { shown.s("flavor_text") }, shown))) },
                startArt = zoom == "art") { zoom = null }
        }
    }
}

/** The set tile: its name and number and how much of it is in your Trunk, a bar, the count; spread over the whole tile (no empty top). */
@Composable
private fun SetTileBody(shown: JsonObject, state: JsonObject?) {
    val code = shown.s("set")
    SetFacts.sets.collectAsState().value
    val (have, total) = Trunk.setProgress(state, code)
    val size = total?.takeIf { it > 0 }
    val num = shown.s("collector_number").ifBlank { "?" }
    // At least 1 % once you own any, so a card in the set never reads "0% of the set".
    val pct = if (size != null) (if (have <= 0) 0 else maxOf(1, Math.round(have * 100f / size))).let { "$it%" } else null
    DualSetBody({ RaritySetIcon(code, shown.s("rarity"), 28.dp) }, "${shown.s("set_name").ifBlank { code.uppercase() }} · ${code.uppercase()} #$num", null,
        if (size != null) "$have of $size in your Trunk" else "$have in your Trunk", pct, size?.let { have.toFloat() / it })
}

/** Over the bottom board: pick the deck the card goes into. */
@Composable
private fun DeckPicker(decks: List<JsonObject>, owned: Int, pick: (JsonObject) -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .5f)).pointerInput(Unit) { detectTapGestures { } }, contentAlignment = Alignment.Center) {
        Column(Modifier.padding(DualPage.Gutter).fillMaxWidth().glass(Rule.Radius.shape(Rule.Radius.Sheet)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("ADD TO DECK", style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Gold).copy(letterSpacing = 1.6.sp))
            Column(Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                decks.forEach { d -> GhostButton(d.s("name").ifBlank { "Untitled deck" }, Modifier.fillMaxWidth()) { pick(d) } }
            }
            if (owned == 0) Text("Greyed in the deck until it is in your Trunk.", style = Rule.Type.S12.copy(color = Rule.Color.Muted))
        }
    }
}

/** Every official ruling, over the top screen (B closes). */
@Composable
private fun RulingsPage(name: String, rulings: List<Pair<String, String>>, onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .6f)).pointerInput(Unit) { detectTapGestures { onClose() } }, contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxHeight(.9f).widthIn(max = 640.dp).fillMaxWidth().glass(Rule.Radius.shape(Rule.Radius.Sheet)).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("RULINGS · ${name.uppercase()}", style = Rule.Type.sans(11, FontWeight.Bold, Rule.Color.Gold).copy(letterSpacing = 1.6.sp))
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                rulings.forEach { (c, src) -> Column { RuleLine(c, null, {}, 14); Text(src, style = Rule.Type.S12.copy(color = Rule.Color.Muted)) } }
            }
        }
    }
}
