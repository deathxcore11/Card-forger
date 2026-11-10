package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.layout.onPlaced

import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.ui.BiasAlignment
import androidx.compose.runtime.collectAsState
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.asImageBitmap
import coil3.toBitmap
import coil3.request.allowHardware
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.produceState
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.play.SetFacts

/**
 * The Play homepage, block for block as the live site's (play-home.js playHomeMarkup + play-menu.js
 * mode cards + play-deeds-ui.js): the PLAY title with the mastery ring, the purse, the four mode
 * cards, the Story card, Today and Achievements, Your packs and the Forge, Your decks and Your
 * collection, then the Merchant. Copy, order and numbers are the web's; look is play-menu.css.
 */
data class PlayHomeData(
    val state: JsonObject,
    val rules: PlayRules,
    val story: PlayMath.StoryHome,
    val day: String,
    val user: String = "",
    /** The site's glass ambient: the Collection home's hero art (today's card), blurred behind every page. */
    val ambient: String? = null,
    /** GET /api/progress/achievements when it has answered; the golden-tested PlayMath until then. */
    val deeds: JsonObject? = null,
)

class PlayHomeActions(
    val mode: (String) -> Unit = {},          // social / quick / practice / planeswalk
    val story: () -> Unit = {},
    val view: (String) -> Unit = {},          // deeds / packs / decks / collection / shop / finder
    val claim: (kind: String, id: String) -> Unit = { _, _ -> },
    val claimDeed: (id: String, step: Int) -> Unit = { _, _ -> },
    val forge: (to: String, times: Int) -> Unit = { _, _ -> },
    val openPack: (id: String) -> Unit = {},
    val buy: (code: String) -> Unit = {},
    val deck: (id: String) -> Unit = {},
    val set: (code: String) -> Unit = {},
)

// play-menu.css tokens for the Play side.
private object P {
    val Ink = Color(0xFFF6EEDB)
    val Copy = Color(0xFFD6DBE2)
    val Gold = Color(0xFFE8B95B)
    val GoldSoft = Color(0xFFE9CF93)
    val CtaEdge = Color(0xFFF6DFA8); val CtaTop = Color(0xFFF2D18E); val CtaBottom = Color(0xFFC99A4B); val CtaInk = Color(0xFF1B1408)
    // settings-theme.css light: page-surface rows, ink and links follow the tokens; text over art keeps Ink.
    private val light: Boolean get() = AppSettings.theme == "light"
    val PageInk: Color get() = if (light) Site.Text else Ink
    val PageSoft: Color get() = if (light) Site.Muted else Color(0xFFC9CED6)
    val PageFaint: Color get() = if (light) Site.Muted else Color(0xFFB9BFC9)
    val Track: Color get() = if (light) Site.Surface2 else Color(0xFF1F2430)
    val RowBg: Color get() = if (light) Color(0x94FFFFFF) else Color(0x0DFFFFFF); val RowLine: Color get() = if (light) Site.GlassLine else Color(0x1AFFFFFF)
    val CardLine = Color(0xFF5B4D33)          // color-mix(gold 22-26%, line)
    val Muted: Color get() = Site.Muted
    val Sans = Type.Sans
    val h2: TextStyle get() = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = .02.em, color = if (light) Site.Text else Color(0xFFF1EDE4))
    val link: TextStyle get() = TextStyle(fontFamily = Type.Sans, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = if (light) Site.Gold else Gold)
    val shadow = Shadow(Color(0xCC000000), Offset(0f, 4f), 28f)
}

private val MODE_ART = mapOf(
    "social" to "https://cards.scryfall.io/art_crop/front/5/a/5a7241f5-4d69-47fe-b037-95037008184c.jpg?1783934878",
    "quick" to "https://cards.scryfall.io/art_crop/front/4/1/4101e3fe-b0e7-4f0f-b9ac-9b61a4d628b3.jpg?1783912843",
    "practice" to "https://cards.scryfall.io/art_crop/front/c/a/ca10e2b8-a317-4c98-a866-43bf274e82cb.jpg?1783931052",
    "planeswalk" to "https://cards.scryfall.io/art_crop/front/a/8/a83ca3a1-82a9-4f47-b0b8-21687afd705b.jpg?1783931174")
private val MODE_FOCUS = mapOf("social" to BiasAlignment(0f, -.3f), "quick" to BiasAlignment(.16f, -.2f), "practice" to BiasAlignment(.04f, -.1f), "planeswalk" to BiasAlignment(0f, -.76f))
private const val BUILD_ART = "https://cards.scryfall.io/art_crop/front/f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg"
const val FORGE_ART_NAME = "Great Furnace"

/** Art for the home: an in-memory bitmap (screenshots) or a URL through the Coil cache. [art] maps a URL to what to load. */
var homeArt: (String) -> Any? = { it }

@Composable
internal fun Art(url: String?, modifier: Modifier, align: Alignment = Alignment.Center, scale: ContentScale = ContentScale.Crop, filter: ColorFilter = artFilter) {
    if (HomeTest.noPictures) { Box(modifier.background(Color(0xFF121318))); return }
    val p: Painter? = heroPainter(url?.let(homeArt))
    if (p != null) androidx.compose.foundation.Image(p, null, modifier, alignment = align, contentScale = scale, colorFilter = filter)
    else Box(modifier.background(Color(0xFF121318)))
}

private val artFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(1.12f) })

@Composable
fun PlayHome(d: PlayHomeData, top: @Composable () -> Unit, act: PlayHomeActions = PlayHomeActions(), nav: @Composable () -> Unit) {
    if (d.rules.acts.isEmpty()) { RulesMissing(null); return }
    val s = d.state
    val purse = PlayMath.purse(s) ?: return
    val level = PlayMath.mastery(s, purse.xp)
    val lens = rememberLens()
    BottomScreen { PlayHomeBottom(d, act, lens, purse, level) }
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        if (!HomeTest.noPictures) { if (AppSettings.glass || AppSettings.theme == "aura") Ambient(d.ambient); LaunchedEffect(d.ambient) { Aura.remember(d.ambient) } }
        Column(Modifier.fillMaxSize()) {
            var dash by remember { mutableStateOf(false) }
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                val wide = maxWidth >= 600.dp; val duo = maxWidth >= 840.dp // pe-home-duo pairs at 960 css px; the Fold's inner screen (884 dp) pairs too, as on the site
                // Held sideways (a phone or a handheld): the game dashboard.
                val short = HomeTest.forceShort ?: (wide && maxHeight < 500.dp)
                androidx.compose.runtime.SideEffect { dash = short }
                if (short) Dashboard(d, act, purse, level, 64.dp + statusTop(), maxHeight, lens) else
                LazyColumn(Modifier.fillMaxSize().testTag("playHome"), contentPadding = PaddingValues(top = (if (short) 64.dp else 72.dp) + statusTop(), bottom = 28.dp, start = 16.dp, end = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(if (short) 18.dp else 26.dp)) {
                    if (short) item("head") {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text("Play", style = Site.Display.copy(fontSize = 28.sp, letterSpacing = .04.em))
                            Box(Modifier.weight(1f)) { PurseRow(purse, onCoins = { act.view("shop") }, onSeals = { act.view("forge") }, onPacks = { act.view("packs") }) }
                            LevelRing(level, framed = true)
                        }
                    } else item("head") {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Play", style = Site.Display.copy(fontSize = 34.sp, letterSpacing = .04.em), modifier = Modifier.weight(1f))
                                LevelRing(level, framed = true)
                            }
                            PurseRow(purse, onCoins = { act.view("shop") }, onSeals = { act.view("forge") }, onPacks = { act.view("packs") })
                        }
                    }
                    item("modes") { Probe("modes") { Modes(wide, act, if (short) (maxHeight - 120.dp).coerceIn(170.dp, 240.dp) else null) } }
                    item("story") { Probe("story") { StoryCard(d, wide, act, short) } }
                    val g = HomeTest.groups
                    when (HomeTest.piece) {
                        "D1" -> item("t-cal") { Probe("today") { Shelf("Today", "Quests", { act.view("deeds") }) { Calendar(d) } } }
                        "D2" -> item("t-cal2") { Probe("today") { Shelf("Today", "Quests", { act.view("deeds") }) { PlainCalendar(d) } } }
                        "D3" -> item("t-quests") { Probe("today") { Shelf("Today", "Quests", { act.view("deeds") }) { Quests(d, act) } } }
                        "D4" -> item("t-deeds") { Probe("deeds") { Deeds(d, act) } }
                    }
                    if (g >= 1) item("today") { Duo(duo, { Probe("today") { Today(d, act) } }, { Probe("deeds") { Deeds(d, act) } }) }
                    if (g >= 2) item("packs") { Duo(duo, { Probe("packs") { Packs(s, act) } }, { Probe("forge") { Forge(s, act) } }) }
                    if (g >= 3) item("decks") { Duo(duo, { Probe("decks") { Decks(s, wide, act) } }, { Probe("collection") { Collection(s, act) } }) }
                    if (g >= 4 && ((s.get("shop") as? JsonArray)?.size() ?: 0) > 0) item("shop") { Probe("shop") { Merchant(s, act) } }
                }
                // The site's sticky glass top bar.
                Box(Modifier.fillMaxWidth().background(Rule.Color.Bar).drawBehind { // light: settings-theme.css .topbar
                    drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x80D6AD64), Color.Transparent)), Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
                }.statusBarsPadding()) {
                    top()
                    // The dashboard's purse rides in the bar between the brand and the avatar.
                    if (dash && !DualScreen.active) Box(Modifier.align(Alignment.Center).padding(start = 248.dp, end = 64.dp).widthIn(max = 560.dp).fillMaxWidth()) { PurseRow(purse, onCoins = { act.view("shop") }, onSeals = { act.view("forge") }, onPacks = { act.view("packs") }) }
                }
            }
            if (!dash) nav()
            // Controller: X = Quick Play's Play. Sideways the nav bar is hidden, so RB goes on to Trunk as its next tab would (Home is the first).
            PadScreen(PadActs(x = PadAct("Quick Play") { act.mode("quick") }, tabs = if (dash) ({ k: Int -> if (k > 0) act.view("collection") }) else null, root = true))
        }
    }
}

/** Test variant B draws no shadows either. */
private fun Modifier.testShadow(elevation: Dp, shape: androidx.compose.ui.graphics.Shape, clip: Boolean = elevation > 0.dp, ambientColor: Color = androidx.compose.ui.graphics.DefaultShadowColor, spotColor: Color = androidx.compose.ui.graphics.DefaultShadowColor): Modifier =
    if (HomeTest.noPictures) this else shadow(elevation, shape, clip, ambientColor, spotColor)

/** Counts each section's compositions, layouts and draws for the freeze report, so a stuck or looping section names itself. */
@Composable
private fun Probe(name: String, content: @Composable () -> Unit) {
    dev.cardstashy.nativeplay.FreezeReport.section(name, 0)
    androidx.compose.runtime.SideEffect { dev.cardstashy.nativeplay.FreezeReport.section(name, 1) }
    Box(Modifier.onPlaced { dev.cardstashy.nativeplay.FreezeReport.section(name, 2) }.drawBehind { dev.cardstashy.nativeplay.FreezeReport.section(name, 3) }) { content() }
}

@Composable private fun statusTop(): Dp = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

/**
 * body.glass #ambient (style.css): the hero art blurred 42 px, saturate 1.35, brightness .5, at 85 %,
 * under the game-colour glows and the dark wash. One layer for the whole page.
 */
@Composable
fun Ambient(art: String?) {
    val theme = AppSettings.theme
    // aura.css: #ambient on #272a33, the art at full strength (blur 38, saturate .62); light (settings-theme.css): saturate 1.15, brightness 1.08, at 80 %.
    Box(Modifier.fillMaxSize().then(if (theme == "aura") Modifier.background(Color(0xFF272A33)) else Modifier)) {
        val ctx = LocalContext.current
        // Blurred once, small, off the main thread, and kept per art; a full-screen live blur cost every scroll frame at Fold size.
        val soft = produceState(Aura.cachedSoft(art), art) { value = art?.let { a -> Aura.cachedSoft(a) ?: softArt(ctx, a)?.also { Aura.keepSoft(a, it) } } }.value
        // aura.css .aura-art: a new art fades in over 1 s; the layer drifts slowly (22 s, alternate) unless motion is reduced.
        val still = Motion.still || remember { Playmats.reduced(ctx) }
        val drift = if (theme == "aura" && !still) androidx.compose.animation.core.rememberInfiniteTransition(label = "aura").animateFloat(0f, 1f,
            androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(22000, easing = androidx.compose.animation.core.FastOutSlowInEasing), androidx.compose.animation.core.RepeatMode.Reverse), label = "drift") else null
        androidx.compose.animation.Crossfade(soft, androidx.compose.ui.Modifier.fillMaxSize(), animationSpec = androidx.compose.animation.core.tween(if (theme == "aura" && !still) 1000 else 0), label = "ambient") { bmp ->
            if (bmp != null) androidx.compose.foundation.Image(bmp, null, Modifier.fillMaxSize().graphicsLayer {
                alpha = when (theme) { "light" -> .8f; "aura" -> 1f; else -> .85f }
                if (theme == "aura") { val p = drift?.value ?: .5f; translationX = size.width * (-.004f + .008f * p); translationY = size.height * (.003f - .006f * p); val k = 1.015f + .01f * p; scaleX = k * 1.24f; scaleY = k * 1.24f }
            }, alignment = BiasAlignment(0f, -.4f),
            contentScale = ContentScale.Crop, colorFilter = when (theme) { "light" -> ambientLight; "aura" -> ambientAura; else -> ambientFilter }, filterQuality = androidx.compose.ui.graphics.FilterQuality.High)
        }
        Box(Modifier.fillMaxSize().drawBehind {
            when (theme) {
                // :root[data-theme="light"] body.glass #ambient::after
                "light" -> drawRect(Brush.verticalGradient(0f to Color(0xBDF3F5F8), .65f to Color(0xC7F3F5F8), 1f to Color(0xD1F3F5F8)))
                // :root[data-theme="aura"] body #ambient::after
                "aura" -> drawRect(Brush.verticalGradient(0f to Color(0xB30F1115), .65f to Color(0xC40F1115), 1f to Color(0xD60F1115)))
                else -> {
                    val game = Color(0xFFF08A5D)
                    drawRect(Brush.radialGradient(listOf(game.copy(alpha = .26f), Color.Transparent), center = Offset(size.width * .85f, 0f), radius = size.width * .8f))
                    drawRect(Brush.radialGradient(listOf(game.copy(alpha = .16f), Color.Transparent), center = Offset(0f, size.height), radius = size.width * .7f))
                    drawRect(Brush.verticalGradient(0f to Color(0x590A0C10), .6f to Color(0xC70A0C10), 1f to Color(0xEB0A0C10)))
                }
            }
        })
    }
}

/**
 * The art behind every screen, as the site's #ambient: the game's daily hero art, remembered on this device so every screen
 * shares it (app.js updateAmbient, AMBIENT_KEY). On Aura (aura.js) the card you open in the pop-up, or the deck you open,
 * takes over until you change screens. Glass off hides it, except on Aura, which always shows its atmosphere.
 */
object Aura {
    private const val KEY = "cardstashy-ambient-v1"
    var home by androidx.compose.runtime.mutableStateOf<String?>(null); private set
    var focus by androidx.compose.runtime.mutableStateOf<String?>(null)
    val art: String? get() = (if (AppSettings.theme == "aura") focus else null) ?: home
    private var prefs: android.content.SharedPreferences? = null
    private val soft = object : LinkedHashMap<String, ImageBitmap>(8, .75f, true) { override fun removeEldestEntry(e: MutableMap.MutableEntry<String, ImageBitmap>) = size > 6 }
    fun init(context: android.content.Context) { val p = context.applicationContext.getSharedPreferences("play", android.content.Context.MODE_PRIVATE); prefs = p; home = p.getString(KEY, null) }
    fun remember(art: String?) { if (art.isNullOrBlank() || art == home) return; home = art; prefs?.edit()?.putString(KEY, art)?.apply() }
    @Synchronized fun cachedSoft(art: String?): ImageBitmap? = art?.let { soft[it] }
    @Synchronized fun keepSoft(art: String, bmp: ImageBitmap) { soft[art] = bmp }
}

/** #ambient behind a screen: --bg, then the shared art when glass is on (or always on Aura). A new screen drops Aura's pop-up pick. */
@Composable
fun Backdrop() {
    LaunchedEffect(Unit) { Aura.focus = null }
    if (!HomeTest.noPictures && (AppSettings.glass || AppSettings.theme == "aura")) Ambient(Aura.art)
}

private val ambientLight = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(1.15f); timesAssign(ColorMatrix(floatArrayOf(1.08f,0f,0f,0f,0f, 0f,1.08f,0f,0f,0f, 0f,0f,1.08f,0f,0f, 0f,0f,0f,1f,0f))) })
private val ambientAura = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(.62f) })
private val ambientFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(1.35f); timesAssign(ColorMatrix(floatArrayOf(.5f,0f,0f,0f,0f, 0f,.5f,0f,0f,0f, 0f,0f,.5f,0f,0f, 0f,0f,0f,1f,0f))) })
/**
 * The ambient art at 96 px wide, box-blurred three times (close to a Gaussian): the site's 42 px blur on a
 * ~400 px viewport is about a tenth of the width, so radius 5 at 96 px matches it. Scaled up it reads the same.
 */
private suspend fun softArt(ctx: android.content.Context, art: String): ImageBitmap? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
    val src: android.graphics.Bitmap = when (val a = homeArt(art)) {
        is ImageBitmap -> a.asAndroidBitmap()
        null -> return@withContext null
        else -> {
            val req = coil3.request.ImageRequest.Builder(ctx).data(a).size(96, 96).precision(coil3.size.Precision.INEXACT)
                .allowHardware(false).build()
            (dev.cardstashy.nativeplay.art.CardArt.loader.execute(req) as? coil3.request.SuccessResult)?.image?.toBitmap() ?: return@withContext null
        }
    }
    val w = 96; val h = maxOf(1, (src.height * w / maxOf(1, src.width)))
    val small = android.graphics.Bitmap.createScaledBitmap(src.copy(android.graphics.Bitmap.Config.ARGB_8888, false), w, h, true)
    val px = IntArray(w * h); small.getPixels(px, 0, w, 0, 0, w, h)
    repeat(3) { boxBlur(px, w, h, 5) }
    android.graphics.Bitmap.createBitmap(px, w, h, android.graphics.Bitmap.Config.ARGB_8888).asImageBitmap()
}

private fun boxBlur(px: IntArray, w: Int, h: Int, r: Int) {
    val tmp = IntArray(px.size)
    fun pass(from: IntArray, to: IntArray, len: Int, lines: Int, at: (Int, Int) -> Int) {
        for (l in 0 until lines) for (i in 0 until len) {
            var a = 0; var rr = 0; var g = 0; var b = 0; var n = 0
            for (k in maxOf(0, i - r)..minOf(len - 1, i + r)) { val c = from[at(l, k)]; a += c ushr 24; rr += (c shr 16) and 255; g += (c shr 8) and 255; b += c and 255; n++ }
            to[at(l, i)] = ((a / n) shl 24) or ((rr / n) shl 16) or ((g / n) shl 8) or (b / n)
        }
    }
    pass(px, tmp, w, h) { y, x -> y * w + x }
    pass(tmp, px, h, w) { x, y -> y * w + x }
}

/** The Play page's backdrop without art (signed out, loading): --bg. */
fun Modifier.playBackdrop() = this.background(Site.Bg)

@Composable
private fun Duo(two: Boolean, a: @Composable () -> Unit, b: @Composable () -> Unit) {
    if (two) Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.Top) { Box(Modifier.weight(1f)) { a() }; Box(Modifier.weight(1f)) { b() } }
    else Column(verticalArrangement = Arrangement.spacedBy(26.dp)) { a(); b() }
}

// ---------------------------------------------------------------- purse (pe-purse, full width on phones)

/** Where the wallet's badges lead from any screen (Randall 4 Nov): coins to the Shop, seals to the Forge, packs to Your packs. */
val LocalShopNav = androidx.compose.runtime.staticCompositionLocalOf<(String) -> Unit> { {} }
/** A set's page in the Shop (where Play's set pages live), for a card view whose host has no set link of its own. */
val LocalShopSetNav = androidx.compose.runtime.staticCompositionLocalOf<((String) -> Unit)?> { null }

/** The wallet pill with the app's own routes (screens other than Play home and the Shop). */
@Composable
internal fun PurseRow(p: PlayMath.Purse, level: PlayMath.Level? = null) {
    val nav = LocalShopNav.current
    PurseRow(p, { nav("sets") }, { nav("forge") }, { nav("packs") }, level)
}

@Composable
internal fun PurseRow(p: PlayMath.Purse, onCoins: () -> Unit, onSeals: () -> Unit, onPacks: () -> Unit, level: PlayMath.Level? = null) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // One line always (the site's pill never wraps): measure what the numbers need at full size and,
        // on a narrow screen or with large text, tighten the whole pill evenly instead of squeezing one cell.
        val fs = androidx.compose.ui.platform.LocalDensity.current.fontScale
        fun digits(n: Int) = "%,d".format(n).length
        val sealDigits = listOf("c", "u", "r", "m").sumOf { digits(p.seals[it] ?: 0) }
        val text = (digits(p.coins) + sealDigits + digits(p.packs)) * 9.4f * fs
        val need = 8f + 3 * 16f + (18 + 6) + 4 * (18 + 4) + 3 * 6f + (18 + 6) + text + (if (level != null) 50f else 0f)
        val k = (maxWidth.value / need).coerceIn(.6f, 1f)
        val icon = 18.dp * k; val gap = 6.dp * k; val pad = 8.dp * k; val num = 14f * maxOf(k, .8f)
        Row(Modifier.fillMaxWidth().testShadow(10.dp, CircleShape).clip(CircleShape).background(Color(0xB80D0F14))
            .border(1.dp, Color(0xFF6A5838), CircleShape).padding(4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceEvenly) {
            PurseCell(onCoins, "${p.coins} coins", pad, gap) { Icon(SiteIcons.Coin, icon); Num(p.coins, num) }
            PurseCell(onSeals, "Seals", pad, gap) {
                for (k2 in listOf("c", "u", "r", "m")) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(gap * .66f)) { Icon(SiteIcons.Seals.getValue(k2), icon); Num(p.seals[k2] ?: 0, num) }
            }
            PurseCell(onPacks, "${p.packs} packs", pad, gap) { Icon(SiteIcons.Pack, icon); Num(p.packs, num) }
            // purseMarkup's levelMarkup: on head() screens the mastery ring closes the pill.
            if (level != null) LevelRing(level)
        }
    }
}

@Composable private fun PurseCell(onClick: () -> Unit, label: String, pad: Dp, gap: Dp, content: @Composable () -> Unit) =
    Row(Modifier.height(44.dp).clip(CircleShape).clickable(onClick = onClick).semantics { contentDescription = label }.padding(horizontal = pad),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(gap)) { content() }

@Composable private fun Num(n: Int, size: Int, color: Color = P.Ink) = Num(n, size.toFloat(), color)
@Composable private fun Num(n: Int, size: Float = 14f, color: Color = P.Ink) = Text("%,d".format(n), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = size.sp, color = color, fontFeatureSettings = "tnum"), maxLines = 1, softWrap = false)

// ---------------------------------------------------------------- gold CTA (pl-mode-cta / pe-buy / pd-claim)

/** .btn.cs-plate: the bevelled gold plate with an inner line and diamonds either side of a Cinzel label (Story's Begin). */
@Composable
fun GoldPlate(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) = GoldCta(label, modifier, onClick = onClick)


// ---------------------------------------------------------------- mode cards (pl-modes)

@Composable
private fun Modes(wide: Boolean, act: PlayHomeActions, row: Dp? = null, lens: LensHost? = null) {
    val modes = listOf(
        Triple("social", "Multiplayer", "Your deck against a friend's.") to "Invite",
        Triple("quick", "Quick Play", "Your deck against a matched CPU.") to "Play",
        Triple("practice", "Practice", "Any two decks, head to head.") to "Set up",
        Triple("planeswalk", "Planeswalk", "Climb Innistrad. Take down Sorin.") to "Open")
    val rows = if (row != null) listOf(modes) else if (wide) modes.chunked(2) else modes.map { listOf(it) }
    Column(verticalArrangement = Arrangement.spacedBy(if (wide) 18.dp else 12.dp)) {
        rows.forEach { r -> Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            r.forEach { (m, cta) -> ModeCard(m.first, m.second, m.third, cta, wide, Modifier.weight(1f).let { if (lens != null) it.dualLens(lens, if (m.first == "quick") "quick" else null) else it }, row) { act.mode(m.first) } }
        } }
    }
}

@Composable
private fun ModeCard(key: String, name: String, copy: String, cta: String, wide: Boolean, modifier: Modifier, short: Dp? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(if (wide) 22.dp else 18.dp)
    val press = remember { MutableInteractionSource() }
    val pressed by press.collectIsPressedAsState()
    val k by animateFloatAsState(if (pressed) .98f else 1f, Site.spring(), label = "mode")
    Box(modifier.scale(k).then(if (short != null) Modifier.height(short) else Modifier.heightIn(min = if (wide) 300.dp else 200.dp)).testShadow(22.dp, shape).clip(shape).background(Color(0xFF121318))
        .clickable(press, dev.cardstashy.nativeplay.ui.PadFocus.Ring, onClick = onClick).semantics { contentDescription = name }) {
        // Planeswalk's old scan is zoomed to trim its black frame (pl-mode-art--trim).
        Art(MODE_ART[key], Modifier.matchParentSize().let { if (key == "planeswalk") it.scale(1.16f) else it }, MODE_FOCUS[key] ?: Alignment.Center)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color(0x000C0C0E), .34f to Color(0x000C0C0E), .66f to Color(0xB80C0C0E), 1f to Color(0xF20C0C0E))))
        Box(Modifier.matchParentSize().background(Brush.radialGradient(.55f to Color.Transparent, 1f to Color(0x8C0C0C0E))))
        Box(Modifier.matchParentSize().border(if (key == "quick") 1.5.dp else 1.dp, if (key == "quick") Brush.linearGradient(listOf(Color(0x40E8B95B), P.Gold, Color(0xFFFFF3D0), P.Gold, Color(0x40E8B95B))) else Brush.linearGradient(listOf(P.CardLine, P.CardLine)), shape))
        if (short != null) Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 14.sp, letterSpacing = 0.em, color = P.Ink, shadow = P.shadow), maxLines = 1, softWrap = false)
            GoldCta(cta, Modifier.fillMaxWidth(), radius = 11.dp, onClick = onClick)
        } else Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(start = if (wide) 22.dp else 16.dp, end = if (wide) 22.dp else 16.dp, bottom = if (wide) 22.dp else 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (wide) 28.sp else 24.sp, letterSpacing = .03.em, color = P.Ink, shadow = P.shadow))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(copy, style = TextStyle(fontFamily = P.Sans, fontSize = 14.sp, lineHeight = 21.sp, color = P.Copy), modifier = Modifier.weight(1f).padding(end = 12.dp, bottom = if (wide) 0.dp else 2.dp))
                GoldCta(cta, onClick = onClick)
            }
        }
    }
}

// ---------------------------------------------------------------- Story (pe-story)

@Composable
private fun StoryCard(d: PlayHomeData, wide: Boolean, act: PlayHomeActions, short: Boolean = false) {
    val a = d.rules.acts.firstOrNull { it.act == d.story.act } ?: d.rules.acts.first()
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxWidth().heightIn(min = if (short) 250.dp else if (wide) 360.dp else 320.dp).testShadow(24.dp, shape).clip(shape).background(Color(0xFF101218)).border(1.dp, P.CardLine, shape)) {
        Art(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to Color(0xF2090B10), .38f to Color(0xC0090B10), .7f to Color(0x30090B10))))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.45f to Color.Transparent, 1f to Color(0xD0090B10))))
        val copy = @Composable { m: Modifier ->
            Column(m, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("STORY · ACT ${a.act}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = .16.em, color = P.GoldSoft))
                Text(a.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = if (short) 26.sp else if (wide) 36.sp else 30.sp, lineHeight = if (short) 30.sp else if (wide) 40.sp else 33.sp, color = Color(0xFFFBF3DF), shadow = P.shadow))
                Text("${a.years}. ${a.line}", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 22.sp, color = Color(0xFFDFE3EA)))
                Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (i in 0 until a.battles) { val boss = i == a.battles - 1; val on = i < d.story.won
                        Box(Modifier.size(if (boss) 30.dp else 22.dp, 8.dp).clip(CircleShape).background(if (on) P.Gold else Color(0x26FFFFFF))
                            .border(1.dp, if (on) P.Gold else if (boss) Color(0x88D6AD64) else Color(0x22FFFFFF), CircleShape)) }
                }
                // The dots alone read as decoration (Randall 4 Nov): say it in words too.
                Text(if (d.story.done) "All ${a.battles} battles won" else "${d.story.won} of ${a.battles} battles won",
                    style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Color(0xFFB9AE9C)))
                GoldPlate(if (d.story.done) "Replay" else if (d.story.won > 0) "Continue" else "Begin", onClick = act.story)
            }
        }
        // A balanced fan: the middle pack a little bigger and in front, the outer two tilted out by the same amount.
        // Upright on a phone the three always fit the card (Randall 4 Nov: the third pack was squeezed against the edge).
        val packs = @Composable { m: Modifier, cap: Dp ->
            BoxWithConstraints(m.fillMaxWidth(), contentAlignment = Alignment.Center) {
                val gap = if (wide) 24.dp else 12.dp
                val w = ((maxWidth - gap * 2) / 3.18f).coerceAtMost(cap)
                val list = a.packs.take(3)
                Row(horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Bottom) {
                    list.forEachIndexed { i, (code, name) ->
                        val middle = list.size == 3 && i == 1
                        val tilt = if (list.size == 3) listOf(-5f, 0f, 5f)[i] else 0f
                        Booster(code, name, Modifier.width(if (middle) w * 1.18f else w).zIndex(if (middle) 1f else 0f)
                            .graphicsLayer { rotationZ = tilt; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, 1f) }, mini = true)
                    }
                }
            }
        }
        // The copy keeps its width (at least 300 dp beside the packs); the packs shrink to the space left, and below 680 dp they go on top.
        // The card grows with its copy (the Fold put the button below a fixed 360 dp card and cut it off).
        if (wide) BoxWithConstraints(Modifier.fillMaxWidth().heightIn(min = if (short) 250.dp else 360.dp).padding(if (short) 24.dp else 32.dp)) {
            val room = maxWidth - 24.dp - 300.dp
            val w = ((room - 48.dp) / 3.18f).coerceIn(56.dp, if (short) 76.dp else 100.dp)
            if (maxWidth < 680.dp) Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.Bottom)) { packs(Modifier, 84.dp); copy(Modifier) }
            else Row(Modifier.fillMaxWidth().heightIn(min = if (short) 202.dp else 296.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                copy(Modifier.weight(1f).widthIn(min = 300.dp, max = 560.dp)); packs(Modifier.width(w * 3.18f + 48.dp), w)
            }
        } else Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            packs(Modifier, 96.dp); copy(Modifier)
        }
    }
}

// ---------------------------------------------------------------- booster wrapper (pe-booster)

@Composable
fun Booster(code: String, name: String?, modifier: Modifier = Modifier, mini: Boolean = false, collector: Boolean = false, fill: Boolean = false,
            /** The set page's Open Pack simulator: the site's own pack band (brand mark and name), and its product photo for a set Play has no wrapper for. */
            brand: Boolean = false,
            /** False for the opener's own stand-in while its template pack loads (it draws the template itself). */
            template: Boolean = true) {
    val facts: Map<String, SetFacts.Set> = SetFacts.sets.collectAsState().value
    val f = facts[code]
    val label = name?.ifBlank { null } ?: f?.name ?: code.uppercase()
    // The pack the opener tears (Randall 5 Nov: the Shop showed the old painted art): the template with the set's art under its
    // window, wherever the set has template art; its painted wrapper only until that art is in.
    if (template && !HomeTest.noPictures && !brand && PackTemplate.art(LocalContext.current, code) != null) {
        TemplatePack(code, label, { Offset.Zero }, modifier, fill = fill, mini = mini, collector = collector) {
            if (!PaintedBooster(code, label, modifier, mini, collector, fill)) FoilBooster(code, label, f, modifier, mini, collector, brand = false)
        }
        return
    }
    if (PaintedBooster(code, label, modifier, mini, collector, fill, brand)) return
    FoilBooster(code, label, f, modifier, mini, collector, brand)
}

/** The set's painted wrapper (Randall's art piece 16, or its theme wrapper) once its picture is in; false when it has none. */
@Composable
private fun PaintedBooster(code: String, label: String, modifier: Modifier, mini: Boolean, collector: Boolean, fill: Boolean, brand: Boolean = false): Boolean {
    if (!HomeTest.noPictures) wrapperFor(code)?.let { (asset, wrap) ->
        val ctx = LocalContext.current
        val img = produceState(AssetImages.cached("$asset@600"), asset) { value = AssetImages.load(ctx, asset, maxWidth = 600) }.value
        if (img != null) { WrappedBooster(code, label, wrap, img, modifier, mini, collector, fill, brand = brand); return true }
    }
    return false
}

/** The foil pack with the set's art (pe-booster), for a set with no wrapper; the Open Pack simulator's product photo or bare pack. */
@Composable
private fun FoilBooster(code: String, label: String, f: SetFacts.Set?, modifier: Modifier, mini: Boolean, collector: Boolean, brand: Boolean) {
    // Only a set with no template art: while a template set's art loads, this stands in without fetching the product photo.
    // A Yu-Gi-Oh! or Pokémon simulator walks its own pictures (packArtSources, then setArtworkSources).
    val look = LocalPackResult.current?.look
    if (brand && !HomeTest.noPictures && look != null) { if (look.template == null && RemotePackFrom(look.sources, label, modifier)) return }
    else if (brand && !HomeTest.noPictures && PackTemplate.art(LocalContext.current, code) == null && RemotePack(code, label, modifier)) return
    // The simulator with no picture (yet): the site's bare pack, its band showing (.pack-wrap-art>img[hidden] + .pack-wrap-brand).
    if (brand) { BarePack(label, modifier); return }
    val shape = RoundedCornerShape(6.dp)
    Box(modifier.aspectRatio(5f / 8.2f).testShadow(18.dp, shape).clip(shape)
        .background(Brush.linearGradient(listOf(Color(0xFF2A2F3A), Color(0xFF14171D), Color(0xFF262B35))))) {
        // Art window: from the crimp to 30 % above the bottom.
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val h = maxHeight; val w = maxWidth
            val dens = LocalDensity.current; val px = with(dens) { w.toPx() }
            val sp = { f: Float -> with(dens) { (px * f).toSp() } }
            Box(Modifier.padding(top = h * .055f, bottom = h * .30f).fillMaxSize()) {
                if (f?.art?.isNotBlank() == true) Art(f.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
                else ArtShimmer(Modifier.matchParentSize()) // never blank: a soft sweep in the art's own shape until the picture arrives
                Box(Modifier.matchParentSize().background(Brush.verticalGradient(.55f to Color.Transparent, 1f to Color(0xFF0C0E13))))
            }
            // The band: set icon in gold, Cinzel name, PLAY BOOSTER.
            Column(Modifier.align(Alignment.BottomCenter).padding(bottom = h * .055f).fillMaxWidth().heightIn(min = h * (if (mini) .2f else .25f))
                .background(Brush.verticalGradient(listOf(Color(0xFF0C0E13), Color(0xFF1B1F28)))).drawBehind { drawLine(Color(0x66D6AD64), Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }
                .padding(horizontal = 8.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically)) {
                SetIcon(code, Modifier.size(minOf(w * .22f, 30.dp)))
                if (!mini) {
                    BandName(label, w, .07f, .082f, w - 16.dp)
                    Text(if (collector) "COLLECTOR BOOSTER" else "PLAY BOOSTER", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = sp(.05f), letterSpacing = .14.em, color = if (collector) Color(0xFFF3D58C) else Color(0xFFD6AD64)), maxLines = 1)
                }
            }
            // Crimped foil edges top and bottom.
            Crimp(Modifier.align(Alignment.TopCenter).fillMaxWidth().height(h * .055f))
            Crimp(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(h * .055f))
        }
        // Sheen.
        if (collector) CollectorSheen(Modifier.matchParentSize())
        else Box(Modifier.matchParentSize().background(Brush.linearGradient(.3f to Color.Transparent, .45f to Color(0x26FFFFFF), .6f to Color.Transparent)))
        Box(Modifier.matchParentSize().border(1.dp, if (collector) Color(0xCCE9C77A) else Color(0x1FFFFFFF), shape))
    }
}

/** The art window while its picture is on the way: the dark gradient with one light sweep moving across it. */
@Composable
private fun ArtShimmer(modifier: Modifier) {
    val t = if (Motion.still) 0.3f else androidx.compose.animation.core.rememberInfiniteTransition(label = "shimmer").animateFloat(0f, 1f,
        androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(1400, easing = androidx.compose.animation.core.LinearEasing)), label = "x").value
    Box(modifier.background(Brush.radialGradient(listOf(Color(0xFF3B4152), Color(0xFF15181F)))).drawBehind {
        val x = (t * 1.6f - .3f) * size.width
        drawRect(Brush.linearGradient(listOf(Color.Transparent, Color(0x22FFFFFF), Color.Transparent), start = Offset(x - size.width * .3f, 0f), end = Offset(x + size.width * .3f, size.height)))
    })
}

/** Randall's pack wrappers (art piece 16): where each wrapper's black band sits, as fractions of its height. */
class Wrap(val aspect: Float, val notch: Float, val top: Float, val bottom: Float, val iconInNotch: Boolean = false)
/** Randall 3 Nov 21:37Z: one painted template for every set (1024×1536, silver crimps, gold art window, black band).
 *  Measured on the files: notch peak 59.6 %, band 63.2 % to 85.9 %. The empty-window template (PackTemplate) is the same frame. */
val PACK_TEMPLATE_WRAP = Wrap(1024f / 1536f, notch = .596f, top = .632f, bottom = .859f)
val WRAPPERS: Map<String, Wrap> = run {
    // hob, msh and mh2 are redrawn on the template; fra keeps its own.
    val template = PACK_TEMPLATE_WRAP
    listOf("acr", "aer", "afr", "akh", "blb", "bng", "bro", "dft", "dmu", "dom", "dsk", "ecl", "eld", "emn", "eoe", "fdn", "fin", "frf", "grn", "hob", "hou", "iko", "jou", "khm", "kld", "ktk", "lci", "m15", "m19", "m20", "m21", "mat", "mh1", "mh2", "mh3", "mid", "mkm", "mom", "msh", "neo", "ogw", "one", "otj", "rix", "rna", "snc", "soi", "sos", "spm", "stx", "tdm", "thb", "tla", "tmt", "vow", "war", "woe", "xln", "znr", "m14", "rtr", "gtc", "dgm", "ths", "m12", "m13", "isd", "dka", "avr", "nph", "mbs", "som", "m11", "roe", "wwk", "zen", "m10", "arb", "con", "ala", "eve", "shm", "mor", "lrw", "10e", "fut", "plc", "tsp", "csp", "2x2", "5dn", "8ed", "9ed", "bok", "chk", "clb", "clu", "cmm", "cmr", "dbl", "dis", "dmr", "dst", "gpt", "inr", "ltr", "mb2", "mbc", "mrd", "rav", "rvr", "sok", "tsr", "unf", "2xm", "a25", "apc", "bbd", "cn2", "cns", "ema", "ima", "jud", "lgn", "mm2", "mm3", "mma", "ody", "ons", "scg", "tor", "uma", "unh", "ust", "2ed", "3ed", "4ed", "5ed", "6ed", "7ed", "all", "arn", "atq", "chr", "drk", "exo", "fem", "hml", "ice", "inv", "lea", "leb", "leg", "mir", "mmq", "nem", "pcy", "pls", "ren", "rin", "sth", "sum", "tmp", "uds", "ugl", "ulg", "usg", "vis", "wth").associateWith { template } +
        ("fra" to Wrap(600f / 918f, notch = .641f, top = .676f, bottom = .892f))
}

/**
 * Randall's seven theme wrappers (3 Nov, "by set theme"): one painted template, notch emblem at 70 %,
 * name band 76 to 87 %. A set whose world fits a theme wears it; every other set takes one in turn
 * (stable per set code), so no pack is ever bare.
 */
private val THEME_WRAP = Wrap(320f / 497f, notch = .70f, top = .752f, bottom = .871f, iconInNotch = true)
val THEMES = listOf("desert-ruins", "dragon-hoard", "vampire-castle", "elf-forest", "shire-hill", "ghost-ship-swamp", "dwarf-forge")
/** Randall 3 Nov: each theme wrapper belongs to one set only. Every other set keeps its foil pack with its own art. */
val SET_THEME: Map<String, String> = mapOf("hob" to "shire-hill", "mh2" to "dwarf-forge")
fun themeFor(code: String): String? = SET_THEME[code.lowercase()]
/** The wrapper a set wears: its own painted pack, else its theme wrapper, else none (the foil pack with the set's art). */
fun wrapperFor(code: String): Pair<String, Wrap>? = WRAPPERS[code.lowercase()]?.let { "play/pack-${code.lowercase()}.webp" to it }
    ?: themeFor(code)?.let { "play/wrap-$it.webp" to THEME_WRAP }

/**
 * A wrapper pack: the painted foil wrapper, and on its black band the gold star emblem in the notch,
 * the set symbol in gold, the set name in Cinzel and PLAY BOOSTER, all moving as one with the sheen.
 */
@Composable
internal fun WrappedBooster(code: String, label: String, wrap: Wrap, img: ImageBitmap, modifier: Modifier, mini: Boolean, collector: Boolean = false, fill: Boolean = false,
                            under: (@Composable BoxScope.() -> Unit)? = null, brand: Boolean = false) {
    // fill: the caller already sized the box to the wrapper (the pack opener), so the picture takes all of it.
    Box(if (fill) modifier else modifier.aspectRatio(5f / 8.2f), contentAlignment = Alignment.BottomCenter) {
        BoxWithConstraints((if (fill) Modifier.fillMaxSize() else Modifier.fillMaxWidth().aspectRatio(wrap.aspect, matchHeightConstraintsFirst = true))
            .then(if (collector) Modifier.collectorGlow() else Modifier)
            .graphicsLayer { shadowElevation = 14.dp.toPx(); shape = RoundedCornerShape(4.dp); clip = false }) {
            val w = maxWidth; val h = maxHeight
            // The pack template's set art, under the frame's empty window (PackTemplate).
            under?.invoke(this)
            Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
            // Printed on the wrapper, so it sizes with the pack, not with the font setting.
            val dens = LocalDensity.current
            val px = with(dens) { w.toPx() }
            val sp = { f: Float -> with(dens) { (px * f).toSp() } }
            if (brand) {
                // sets-ui.css .pack-tpl / .pack-custom .pack-wrap-brand: inset auto 14 % 12.5 % 14 %, 21 % tall, centred; the static
                // mark at 26 % of the band over the set's name, bold, #f5ead0, clamp(11px, 3.6vw, 15px) at line-height 1.15, 4 px apart.
                val vw = with(dens) { LocalContext.current.resources.displayMetrics.widthPixels.toDp() }
                val fs = (vw.value * .036f).coerceIn(11f, 15f)
                // (The grid's content overflows its 21 % box when the name wraps, centred on it, as on the site.)
                // A Yu-Gi-Oh! or Pokémon template (packTemplateArt): Pokémon's set logo in place of the mark and name (.pack-has-logo,
                // 76 % of the band, until it fails to load); Yu-Gi-Oh!'s set code under the name instead of the mark (.pack-has-sub).
                val tpl = LocalPackResult.current?.look?.template
                val logo = tpl?.logo.orEmpty(); val sub = tpl?.sub.orEmpty()
                var logoOk by remember(logo) { mutableStateOf(logo.isNotBlank()) }
                Box(Modifier.align(Alignment.BottomCenter).padding(bottom = h * .125f).width(w * .72f).height(h * .21f), contentAlignment = Alignment.Center) {
                    val lp = if (logoOk) heroPainter(homeArt(logo)) else null
                    val ls = (lp as? coil3.compose.AsyncImagePainter)?.state?.collectAsState()?.value
                    if (ls is coil3.compose.AsyncImagePainter.State.Error) LaunchedEffect(logo) { logoOk = false }
                    if (lp != null) Image(lp, label, Modifier.fillMaxWidth().fillMaxHeight(.76f), contentScale = ContentScale.Fit)
                    else Column(Modifier.wrapContentHeight(unbounded = true), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(if (sub.isNotBlank()) 6.dp else 4.dp)) {
                        if (sub.isBlank()) BrandMark(w * .72f * .26f, static = true)
                        val nf = if (sub.isBlank()) fs else (vw.value * .034f).coerceIn(11f, 15f)
                        Text(label, style = TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = FontWeight.Bold, fontSize = nf.sp, lineHeight = (nf * 1.15f).sp,
                            letterSpacing = if (sub.isBlank()) TextUnit.Unspecified else .02.em, color = Color(0xFFF5EAD0), textAlign = TextAlign.Center))
                        if (sub.isNotBlank()) Text(sub, style = TextStyle(fontFamily = Site.Body.fontFamily, fontSize = (fs * .8f).sp, lineHeight = (fs * .8f * 1.15f).sp, letterSpacing = .14.em, color = Color(0xFFD6AD64), textAlign = TextAlign.Center))
                    }
                }
                return@BoxWithConstraints
            }
            // The star emblem, centred in the band's notch.
            if (wrap.iconInNotch) SetIcon(code, Modifier.align(Alignment.TopCenter).offset(y = h * wrap.notch - w * .05f).size(w * .1f))
            else StarEmblem(Modifier.align(Alignment.TopCenter).offset(y = h * wrap.notch - w * .045f).size(w * .09f))
            Column(Modifier.align(Alignment.TopCenter).offset(y = h * wrap.top).fillMaxWidth().height(h * (wrap.bottom - wrap.top)).padding(horizontal = w * .135f),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(w * .018f, Alignment.CenterVertically)) {
                if (!wrap.iconInNotch) SetIcon(code, Modifier.size(w * (if (mini) .2f else .1f)))
                if (!mini) {
                    BandName(label, w, .062f, .072f, w * .73f)
                    Text(if (collector) "COLLECTOR BOOSTER" else "PLAY BOOSTER", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = sp(.046f), letterSpacing = .14.em, color = if (collector) Color(0xFFF3D58C) else Color(0xFFD6AD64)), maxLines = 1)
                }
            }
            // Sheen across wrapper and lettering alike.
            if (collector) { CollectorSheen(Modifier.matchParentSize()); Box(Modifier.matchParentSize().border(1.dp, Color(0xCCE9C77A), RoundedCornerShape(4.dp))) }
            else Box(Modifier.matchParentSize().background(Brush.linearGradient(.32f to Color.Transparent, .45f to Color(0x1AFFFFFF), .58f to Color.Transparent)))
        }
    }
}

/**
 * The band's set name, printed on the pack (Cinzel, sized from the pack's width, not the font setting): one line, shrunk down to
 * 72 % to stay on one (Randall 5 Nov: "Double Masters 2022" wrapped and pushed PLAY BOOSTER off the band); a name still too long
 * takes two lines at 74 %.
 */
@Composable
private fun BandName(label: String, w: Dp, size: Float, line: Float, avail: Dp) {
    val dens = LocalDensity.current
    val tm = androidx.compose.ui.text.rememberTextMeasurer()
    val px = with(dens) { w.toPx() }; val room = with(dens) { avail.toPx() }
    fun style(k: Float) = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = with(dens) { (px * size * k).toSp() }, lineHeight = with(dens) { (px * line * k).toSp() },
        letterSpacing = .02.em, color = P.Ink, textAlign = TextAlign.Center)
    val text = label.uppercase()
    val k = remember(text, px, room) { listOf(1f, .94f, .88f, .82f, .76f, .72f).firstOrNull { tm.measure(text, style(it), maxLines = 1, softWrap = false).size.width <= room } }
    Text(text, style = style(k ?: .74f), maxLines = if (k != null) 1 else 2, softWrap = k == null, overflow = TextOverflow.Ellipsis)
}

/** .pe-booster--collector's glow: 0 0 22px #c9a4ff40 around the pack. */
private fun Modifier.collectorGlow() = drawBehind {
    drawIntoCanvas { c ->
        val p = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply { isAntiAlias = true; color = Color(0x40C9A4FF).toArgb(); maskFilter = android.graphics.BlurMaskFilter(11.dp.toPx(), android.graphics.BlurMaskFilter.Blur.NORMAL) }
        c.nativeCanvas.drawRoundRect(0f, 0f, size.width, size.height, 4.dp.toPx(), 4.dp.toPx(), p)
    }
}

/**
 * .pe-booster--collector .pe-booster-sheen: linear-gradient(115deg, pink 32 %, cyan 44 %, lime 56 %, yellow 68 % at 25 % alpha, clear at 20 / 80 %),
 * background-size 250 %, sliding from 100 % to -150 % over 4.5 s, linear, in color-dodge.
 */
@Composable
private fun CollectorSheen(modifier: Modifier) {
    val t = if (Motion.still) .5f else rememberInfiniteTransition(label = "collector").animateFloat(0f, 1f, infiniteRepeatable(tween(4500, easing = LinearEasing)), label = "c").value
    Box(modifier.drawWithContent {
        // background-position p% of a 250 % image: its left edge sits at p · (W − 2.5 W) = −1.5 W · p.
        val bw = size.width * 2.5f; val pos = 1f + (-1.5f - 1f) * t
        val left = -1.5f * size.width * pos
        val a = Math.toRadians(115.0 - 90.0); val dx = kotlin.math.cos(a).toFloat(); val dy = kotlin.math.sin(a).toFloat()
        val half = (bw * kotlin.math.abs(dx) + size.height * kotlin.math.abs(dy)) / 2f
        val c = Offset(left + bw / 2f, size.height / 2f)
        val brush = Brush.linearGradient(.2f to Color(0x00FF6AD5), .32f to Color(0x40FF6AD5), .44f to Color(0x406AD8FF), .56f to Color(0x40B6FF6A), .68f to Color(0x40FFE56A), .8f to Color(0x00FF6AD5),
            start = Offset(c.x - dx * half, c.y - dy * half), end = Offset(c.x + dx * half, c.y + dy * half), tileMode = androidx.compose.ui.graphics.TileMode.Repeated)
        drawRect(brush, blendMode = BlendMode.ColorDodge)
    })
}

/** The six-pointed star in a ring that every wrapper carries at the top of its band. */
@Composable
private fun StarEmblem(modifier: Modifier) = androidx.compose.foundation.Canvas(modifier) {
    val gold = Brush.linearGradient(listOf(Color(0xFFFFF0B8), Color(0xFFE0AC48), Color(0xFFFFF4CF), Color(0xFFC58A2C)), Offset.Zero, Offset(size.width, size.height))
    val c = center; val r = size.minDimension / 2f
    drawCircle(Color(0xFF0C0E13), r)
    drawCircle(gold, r * .9f, style = androidx.compose.ui.graphics.drawscope.Stroke(r * .1f))
    for (k in 0..1) {
        val path = androidx.compose.ui.graphics.Path()
        for (i in 0..2) {
            val a = Math.toRadians(-90.0 + k * 60 + i * 120)
            val x = c.x + r * .62f * kotlin.math.cos(a).toFloat(); val y = c.y + r * .62f * kotlin.math.sin(a).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close(); drawPath(path, gold)
    }
}

@Composable private fun Crimp(m: Modifier) = Box(m.drawBehind {
    val w = 3.dp.toPx(); var x = 0f; var i = 0
    while (x < size.width) { drawRect(if (i % 2 == 0) Color(0xE6D9DDE3) else Color(0xE68C939E), Offset(x, 0f), Size(w, size.height)); x += w; i++ }
})

/** The set's icon in the wrapper gold (masked like the web's pe-booster-icon). */
@Composable
fun SetIcon(code: String, modifier: Modifier, tint: Color = Color(0xFFE9C878)) {
    if (HomeTest.noPictures) return
    val p = heroPainter(SetFacts.icon(code).let(homeArt))
    if (p != null) Image(p, null, modifier, colorFilter = ColorFilter.tint(tint, BlendMode.SrcIn))
}


// ---------------------------------------------------------------- shelves

@Composable
private fun Shelf(title: String, link: String?, onLink: () -> Unit, content: @Composable ColumnScope.() -> Unit) = Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    // A heading never breaks inside a word (fix list C1): at large text the link drops under it instead.
    @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
    androidx.compose.foundation.layout.FlowRow(Modifier.fillMaxWidth().heightIn(min = 44.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalArrangement = Arrangement.Center) {
        Text(title, style = P.h2, maxLines = 1, softWrap = false, modifier = Modifier.align(Alignment.CenterVertically))
        if (link != null) Box(Modifier.heightIn(min = 44.dp).clickable(onClick = onLink).padding(horizontal = 6.dp), contentAlignment = Alignment.Center) { Text(link, style = P.link, maxLines = 1) }
    }
    content()
}

@Composable
private fun Bar(frac: Float, thin: Boolean = false, modifier: Modifier = Modifier) = Box(modifier.fillMaxWidth().height(if (thin) 5.dp else 8.dp).clip(CircleShape).background(P.Track)) {
    Box(Modifier.fillMaxWidth(frac.coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(Color(0xFFE2B866)))
}

private val rowShape = RoundedCornerShape(14.dp)
private fun Modifier.rowGlass() = this.clip(rowShape).background(P.RowBg).border(1.dp, P.RowLine, rowShape)

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun Rewards(r: PlayRules.Reward, column: Boolean = false, ink: Color = P.PageInk) {
    val items = buildList<@Composable () -> Unit> {
        if (r.coins > 0) add { Icon(SiteIcons.Coin, 16.dp); Num(r.coins, 13, ink) }
        r.seals.filter { it.value > 0 }.forEach { (k, v) -> add { Icon(SiteIcons.Seals.getValue(k), 16.dp); Num(v, 13, ink) } }
        if (r.packs > 0) add { Icon(SiteIcons.Pack, 16.dp); Num(r.packs, 13, ink) }
    }
    if (column) FlowRow(horizontalArrangement = Arrangement.spacedBy(3.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        items.forEach { Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) { it() } }
    } else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) { it() } }
        if (r.xp > 0) Text("${r.xp} XP", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = P.PageSoft))
    }
}

// ---------------------------------------------------------------- Today (pd-today)

@Composable
private fun Today(d: PlayHomeData, act: PlayHomeActions) {
    // The log-in calendar left the home page (Randall 3 Nov 20:21Z): the day's reward is a one-time pop-up now.
    Shelf("Today", "Quests", { act.view("quests") }) {
        Quests(d, act)
    }
}

@Composable
private fun Quests(d: PlayHomeData, act: PlayHomeActions) {
    val s = d.state
    val q = remember(d.rules, s, d.day, d.user) { PlayMath.quests(d.rules, s, d.day, d.user) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        q.daily.forEach { r -> QuestRow(r, PlayMath.questReward(r.quest, s.get("config") as? JsonObject)) { act.claim("daily", r.quest.id) } }
    }
    Text("This week: ${q.weekly.count { it.done }} of ${q.weekly.size} weekly quests done", style = TextStyle(fontFamily = P.Sans, fontSize = 14.sp, color = P.Muted), modifier = Modifier.padding(top = 10.dp))
}

/** Test D2: the same 7-day calendar without IntrinsicSize or FlowRow: every cell one fixed height, rewards in rows of [perRow]. */
@Composable
private fun PlainCalendar(d: PlayHomeData) {
    val stamp = (d.state.get("login") as? JsonObject)?.get("stamp").int() ?: 0
    fun items(r: PlayRules.Reward) = buildList<@Composable () -> Unit> {
        if (r.coins > 0) add { Icon(SiteIcons.Coin, 16.dp); Num(r.coins, 13) }
        r.seals.filter { it.value > 0 }.forEach { (k, v) -> add { Icon(SiteIcons.Seals.getValue(k), 16.dp); Num(v, 13) } }
        if (r.packs > 0) add { Icon(SiteIcons.Pack, 16.dp); Num(r.packs, 13) }
    }
    BoxWithConstraints(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        val cellW = (maxWidth - 36.dp) / 7
        val perRow = maxOf(1, ((cellW - 4.dp) / 30.dp).toInt())
        val lines = d.rules.loginWeek.maxOf { r -> (items(r).size + perRow - 1) / perRow }.coerceAtLeast(1)
        val h = 8.dp + 15.dp + 6.dp + 36.dp * lines + 4.dp * (lines - 1) + 8.dp
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            d.rules.loginWeek.forEachIndexed { i, r ->
                val on = i < stamp; val sh = RoundedCornerShape(12.dp)
                Column(Modifier.weight(1f).height(maxOf(h, 72.dp)).clip(sh)
                    .background(if (on) Brush.verticalGradient(listOf(Color(0xFF2A2116), Color(0xFF17120D))) else Brush.verticalGradient(listOf(Color(0x05FFFFFF), Color(0x05FFFFFF))))
                    .border(1.dp, if (on) Color(0x66D6AD64) else Color(0x12FFFFFF), sh).padding(vertical = 8.dp, horizontal = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${i + 1}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = .04.em, color = if (on) Color(0xFFF3DFB4) else P.Muted))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        items(r).chunked(perRow).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            row.forEach { Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) { it() } } } }
                    }
                }
            }
        }
    }
}

/** The 7-day log-in calendar as shipped (equal-height cells via IntrinsicSize.Max, rewards in a FlowRow). */
@Composable
private fun Calendar(d: PlayHomeData) {
    val stamp = (d.state.get("login") as? JsonObject)?.get("stamp").int() ?: 0
    run {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp).height(androidx.compose.foundation.layout.IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            d.rules.loginWeek.forEachIndexed { i, r ->
                val on = i < stamp; val sh = RoundedCornerShape(12.dp)
                Column(Modifier.weight(1f).fillMaxHeight().heightIn(min = 72.dp).clip(sh)
                    .background(if (on) Brush.verticalGradient(listOf(Color(0xFF2A2116), Color(0xFF17120D))) else Brush.verticalGradient(listOf(Color(0x05FFFFFF), Color(0x05FFFFFF))))
                    .border(1.dp, if (on) Color(0x66D6AD64) else Color(0x12FFFFFF), sh).padding(vertical = 8.dp, horizontal = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${i + 1}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, letterSpacing = .04.em, color = if (on) Color(0xFFF3DFB4) else P.Muted))
                    Rewards(r.copy(xp = 0), column = true, ink = if (on) P.Ink else P.PageInk)
                }
            }
        }
    }
}

@Composable
private fun QuestRow(r: PlayMath.QuestRow, reward: PlayRules.Reward, claim: () -> Unit) {
    Column(Modifier.fillMaxWidth().rowGlass().border(1.dp, if (r.done) Color(0x55D6AD64) else Color.Transparent, rowShape).let { if (r.claimed) it.then(Modifier) else it }
        .padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(r.quest.label, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 21.sp, color = P.PageInk.copy(alpha = if (r.claimed) .6f else 1f)), modifier = Modifier.weight(1f).padding(end = 12.dp))
            when { r.claimed -> Text("Claimed", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = P.Muted))
                r.done -> GoldCta("Claim", onClick = claim)
                else -> Rewards(reward) }
        }
        if (!r.done) Row(verticalAlignment = Alignment.CenterVertically) {
            Bar(r.have.toFloat() / r.quest.need, thin = true, modifier = Modifier.weight(1f))
            Text("${r.have} / ${r.quest.need}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = P.PageSoft, fontFeatureSettings = "tnum"), modifier = Modifier.widthIn(min = 72.dp), textAlign = TextAlign.End)
        }
    }
}

// ---------------------------------------------------------------- Achievements (pd-deeds-home)

/** One "almost there" row, from the server's payload or PlayMath. */
internal data class Near(val title: String, val art: String?, val trim: Boolean, val value: Int, val need: Int, val hours: Boolean)

// The server sends JSON null for empty fields (unit, art, title on secrets): Gson's JsonNull is not Kotlin null and
// throws on asString/asInt. 0.3.x read "unit" with ?.asString, so 106 of 107 achievements threw, the Play home
// effect died and the screen stopped drawing (Randall's Fold freeze, isolated 3 Nov by the D4 test). Every read goes
// through these.
private fun com.google.gson.JsonElement?.str(): String? = this?.takeIf { it.isJsonPrimitive }?.asString
private fun com.google.gson.JsonElement?.int(): Int? = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble?.toInt()
private fun com.google.gson.JsonElement?.bool(): Boolean = this?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean == true
private fun com.google.gson.JsonElement?.obj(): JsonObject? = this as? JsonObject

internal fun nearFromServerForTest(p: JsonObject) = nearFromServer(p)

internal fun nearFromServer(p: JsonObject): Triple<PlayMath.Totals, List<Near>, Unit> {
    val t = p.get("totals").obj()
    val totals = PlayMath.Totals(t?.get("total").int() ?: 0, t?.get("earned").int() ?: 0, t?.get("ready").int() ?: 0)
    val near = (p.get("achievements") as? com.google.gson.JsonArray)?.mapNotNull { it.obj() }
        ?.filter { !it.get("complete").bool() && !it.get("secret").bool() && !it.get("hidden").bool() && it.get("kind").str() != "honour" }
        ?.mapNotNull { a -> val next = (a.get("steps") as? com.google.gson.JsonArray)?.mapNotNull { it.obj() }?.firstOrNull { !it.get("done").bool() } ?: return@mapNotNull null
            val art = a.get("art").obj()
            Near(a.get("title").str() ?: return@mapNotNull null, art?.get("url").str(), art?.get("trim").bool(), a.get("value").int() ?: 0,
                (next.get("need").int() ?: 1).coerceAtLeast(1), a.get("unit").str() == "h") }
        ?.sortedByDescending { it.value.toDouble() / it.need }?.take(2) ?: emptyList()
    return Triple(totals, near, Unit)
}

@Composable
private fun Deeds(d: PlayHomeData, act: PlayHomeActions) {
    // Off the main thread: the fallback walks every card once per achievement.
    val (t, near) = produceState(PlayMath.Totals(0, 0, 0) to emptyList<Near>(), d.deeds, d.state, d.rules) { value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
        // A payload this code can't read falls back to the golden-tested PlayMath, never takes the page down.
        d.deeds?.let { runCatching { nearFromServer(it) }.getOrNull() }?.let { it.first to it.second } ?: run {
        val rows = PlayMath.achievements(d.rules, d.state)
        PlayMath.totals(rows) to PlayMath.almostThere(rows, 2).mapNotNull { r -> r.next?.let { Near(r.a.title,
            "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(r.a.art, "UTF-8"), false, r.value, it.need, r.a.unit == "h") } }
    } } }.value
    Shelf("Achievements", if (t.ready > 0) "${t.ready} to claim" else "All achievements", { act.view("deeds") }) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
            Text("${t.earned}", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 30.sp, color = if (AppSettings.theme == "light") Site.Text else Color(0xFFF3E3BD)))
            Text("of ${t.total} earned", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = P.PageFaint), modifier = Modifier.padding(bottom = 3.dp))
        }
        Bar(if (t.total > 0) t.earned.toFloat() / t.total else 0f, modifier = Modifier.padding(vertical = 6.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            near.forEach { r ->
                Row(Modifier.fillMaxWidth().rowGlass().clickable { act.view("deeds") }.padding(start = 6.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    // trim: zoom about 116 % around (50 %, 45 %) so no frame line or corner shows; never letterbox.
                    Box(Modifier.size(72.dp, 50.dp).clip(RoundedCornerShape(10.dp))) {
                        Art(r.art, Modifier.matchParentSize().let { if (r.trim) it.scale(1.16f) else it }, BiasAlignment(0f, -.1f))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(r.title, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = P.PageInk))
                        Bar(r.value.toFloat() / r.need, thin = true)
                        Text(if (r.hours) "${r.value / 60} / ${r.need / 60} h" else "${"%,d".format(r.value)} / ${"%,d".format(r.need)}",
                            style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = P.Muted, fontFeatureSettings = "tnum"))
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Your packs + the Forge

@Composable
private fun Packs(s: JsonObject, act: PlayHomeActions) {
    val groups = remember(s) { (s.get("packs") as? JsonArray)?.mapNotNull { it as? JsonObject }?.groupBy { it.get("set").str() ?: "" } ?: emptyMap() }
    val names = remember(s) { buildMap { (s.get("shop") as? JsonArray)?.forEach { o -> (o as? JsonObject)?.let { put(it["code"].str() ?: "", it["name"].str() ?: "") } }
        (s.get("rewardSet") as? JsonObject)?.let { put(it["code"].str() ?: "", it["name"].str() ?: "") } } }
    Shelf("Your packs", "All packs", { act.view("packs") }) {
        if (groups.isEmpty()) Text("Every pack is open. Story battles, Planeswalk bosses and the Merchant give more.", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 22.sp, color = P.PageFaint), modifier = Modifier.padding(top = 8.dp))
        else PackGrid(groups.entries.take(6).toList()) { (code, list) ->
            Box(Modifier.padActs(PadActs(a = "Open")).clickable { act.openPack(list.first()["id"].str() ?: "") }) {
                Booster(code, names[code])
                Box(Modifier.align(Alignment.TopEnd).offset(6.dp, (-6).dp).size(28.dp).clip(CircleShape).background(P.Gold), contentAlignment = Alignment.Center) { Num(list.size, 13).let { } ; Text("${list.size}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = P.CtaInk)) }
            }
        }
    }
}

@Composable
private fun <T> PackGrid(items: List<T>, cell: @Composable (T) -> Unit) = BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 8.dp)) {
    val cols = maxOf(2, ((maxWidth + 12.dp) / (150.dp + 12.dp)).toInt())
    val shown = if (maxWidth < 560.dp) items.take(4) else items
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        shown.chunked(cols).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            row.forEach { Box(Modifier.weight(1f)) { cell(it) } }; repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
        } }
    }
}

private val SEAL_NAME = mapOf("c" to "Common", "u" to "Uncommon", "r" to "Rare", "m" to "Mythic")
private val FORGE_FROM = mapOf("u" to "c", "r" to "u", "m" to "r")

@Composable
internal fun Forge(s: JsonObject, act: PlayHomeActions) {
    val w = s.get("wallet") as? JsonObject ?: JsonObject()
    fun have(k: String) = w.get("seal_$k").int() ?: 0
    fun ratio(to: String) = ((s.get("config") as? JsonObject)?.get("forge") as? JsonObject)?.get(to)?.takeIf { it.isJsonPrimitive }?.asInt ?: 3
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxWidth().testShadow(24.dp, shape).clip(shape).background(Brush.verticalGradient(listOf(Color(0xFF1B1611), Color(0xFF120E0B), Color(0xFF2A1A10)))).border(1.dp, Color(0x55D6AD64), shape)) {
        Art("https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=Great+Furnace", Modifier.matchParentSize().let { it }, Alignment.Center)
        Box(Modifier.matchParentSize().background(Color(0xE6140F0B)))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.6f to Color.Transparent, 1f to Color(0x55B4501E))))
        BoxWithConstraints { val narrow = maxWidth < 520.dp
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            val purse = @Composable {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (k in listOf("c", "u", "r", "m")) Column(Modifier.widthIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x66000000)).border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(12.dp)).padding(horizontal = 8.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) { Icon(SiteIcons.Seals.getValue(k), 22.dp); Num(have(k)) }
                }
            }
            val headText = @Composable { m: Modifier -> Column(m, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("The Forge", style = P.h2.copy(fontSize = 24.sp, color = Color(0xFFF3DFB4)))
                Text("Three seals strike one of the next rarity.", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 21.sp, color = Color(0xFFDFD6C6)))
            } }
            if (narrow) { headText(Modifier); purse() } else Row(verticalAlignment = Alignment.Top) { headText(Modifier.weight(1f).padding(end = 12.dp)); purse() }
            for (to in listOf("u", "r", "m")) {
                val from = FORGE_FROM.getValue(to); val r = ratio(to); val h = have(from); val can = minOf(10, h / r); val lit = if (can > 0) r else h % r
                val sh = RoundedCornerShape(16.dp)
                val seals = @Composable {
                    Row(horizontalArrangement = Arrangement.spacedBy((-4).dp)) { repeat(r) { i -> Icon(SiteIcons.Seals.getValue(from), 18.dp, if (i < lit) null else Color(0xFF3A3632)) } }
                    Text("→", style = TextStyle(fontSize = 18.sp, color = if (can > 0) P.Gold else Color(0xFF55504A)))
                    Icon(SiteIcons.Seals.getValue(to), 30.dp, if (can > 0) null else Color(0xFF8A8A8A))
                }
                val text = @Composable { m: Modifier -> Column(m) {
                    Text("${SEAL_NAME[to]} Seal", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = P.Ink))
                    Text(if (can > 0) "$can ready to forge" else "${r - h} more ${SEAL_NAME[from]!!.lowercase()} needed", style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = Color(0xFFC9C2B6)))
                } }
                val acts = @Composable {
                    GoldCta("Forge", enabled = can > 0, radius = 22.dp) { act.forge(to, 1) }
                    if (can > 1) Box(Modifier.heightIn(min = 44.dp).clickable { act.forge(to, can) }.padding(start = 12.dp), contentAlignment = Alignment.Center) { Text("All $can", style = P.link) }
                }
                val box = Modifier.fillMaxWidth().clip(sh).background(if (can > 0) Brush.horizontalGradient(listOf(Color(0xFF2A1D10), Color(0xFF1A120B))) else Brush.horizontalGradient(listOf(Color(0xCC0E0B09), Color(0xCC0E0B09))))
                    .border(1.dp, if (can > 0) Color(0x88D6AD64) else Color(0x14FFFFFF), sh).padding(horizontal = 14.dp, vertical = 12.dp)
                if (narrow) Column(box, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) { seals(); Spacer(Modifier.weight(1f)); acts() }
                    text(Modifier)
                } else Row(box, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) { seals(); text(Modifier.weight(1f)); acts() }
            }
        } }
    }
}

// ---------------------------------------------------------------- Your decks + Your collection

private val BASICS = setOf("Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes")
private fun deckSize(format: String) = when (format.lowercase()) { "commander", "edh" -> 100; "brawl" -> 60; "standard brawl" -> 60; else -> 60 }

@Composable
private fun Decks(s: JsonObject, wide: Boolean, act: PlayHomeActions, lens: LensHost? = null) {
    val decks = (s.get("decks") as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
    Shelf("Your decks", "All decks", { act.view("decks") }) {
        val tiles = buildList<@Composable (Modifier) -> Unit> {
            add { m -> DeckTile(BUILD_ART, "Build a deck", "From the cards you own", lens?.let { m.dualLens(it, null) } ?: m, cinzel = true) { act.view("finder") } }
            decks.take(3).forEach { d ->
                val cards = (d.get("cards") as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
                val count = cards.sumOf { it.get("qty").int() ?: 0 }
                val lead = cards.firstOrNull { (it.get("name").str() ?: "") !in BASICS }?.get("name").str()
                val fmt = d.get("format").str()?.ifBlank { null } ?: "Standard"
                add { m -> DeckTile(lead?.let { "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(it, "UTF-8") },
                    d.get("name").str()?.ifBlank { null } ?: "Untitled deck", "$fmt · $count/${deckSize(fmt)} cards", lens?.let { m.dualLens(it, "deck:" + (d["id"].str() ?: "")) } ?: m) { act.deck(d["id"].str() ?: "") } }
            }
        }
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            tiles.chunked(if (wide) 2 else 1).forEach { row -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { it(Modifier.weight(1f)) }; if (wide && row.size == 1) Spacer(Modifier.weight(1f)) } }
        }
    }
}

@Composable
private fun DeckTile(art: String?, name: String, meta: String, modifier: Modifier, cinzel: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(modifier.height(136.dp).testShadow(14.dp, shape).clip(shape).background(Color(0xFF15171C)).border(1.dp, Color(0x1FFFFFFF), shape).clickable(onClick = onClick)) {
        Art(art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(.35f to Color.Transparent, 1f to Color(0xE60B0C10))))
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp)) {
            Text(name, style = if (cinzel) TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = P.Ink, shadow = P.shadow) else TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = P.Ink, shadow = P.shadow))
            Text(meta, style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = Color(0xFFC9CED6)))
        }
    }
}

@Composable
private fun Collection(s: JsonObject, act: PlayHomeActions) {
    val facts: Map<String, SetFacts.Set> = SetFacts.sets.collectAsState().value
    val owned = produceState(emptyMap<String, Int>(), s) { value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { LinkedHashMap<String, Int>().also { owned ->
        (s.get("cards") as? JsonArray)?.forEach { c -> ((c as? JsonObject)?.get("s") as? JsonArray)?.forEach { it.str()?.let { k -> owned[k] = (owned[k] ?: 0) + 1 } } }
        (s.get("rewardSet") as? JsonObject)?.get("code").str()?.let { owned.putIfAbsent(it, 0) } } } }.value
    val rows = owned.map { (code, have) -> val f = facts[code]; Triple(code, f, have) }
        .sortedWith(compareByDescending<Triple<String, SetFacts.Set?, Int>> { it.second?.released ?: "" }.thenBy { it.second?.name ?: it.first }).take(4)
    val total = (s.get("cards") as? JsonArray)?.size() ?: 0
    Shelf("Your collection", "${"%,d".format(total)} cards", { act.view("collection") }) {
        if (rows.isEmpty()) Text("Open a pack and your first set starts filling in.", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, color = P.PageFaint))
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            rows.forEach { (code, f, have) ->
                val pct = f?.total?.takeIf { it > 0 }?.let { have.toFloat() / it } ?: 0f
                Column(Modifier.fillMaxWidth().rowGlass().clickable { act.set(code) }.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x0FFFFFFF)), contentAlignment = Alignment.Center) { SetIcon(code, Modifier.size(34.dp), Color(0xFFE6E8EC)) }
                        Column(Modifier.weight(1f)) {
                            Text(f?.name ?: code.uppercase(), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = P.PageInk))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(code.uppercase(), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = P.Gold),
                                    modifier = Modifier.border(1.dp, Color(0x44D6AD64), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
                                Text(f?.released?.take(4) ?: "", style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted))
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(f?.total?.let { "%,d".format(it) } ?: "", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = P.PageInk))
                            Text("cards", style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted))
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("$have / ${f?.total ?: "?"} unique cards owned", style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted), modifier = Modifier.weight(1f))
                        Text("${(pct * 100).toInt()}%", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = P.PageSoft))
                    }
                    Bar(pct, thin = true)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Merchant (pe-home-shop)

@Composable
private fun Merchant(s: JsonObject, act: PlayHomeActions) {
    val price = (s.get("config") as? JsonObject)?.get("packPrice").int() ?: 500
    val coins = (s.get("wallet") as? JsonObject)?.get("coins").int() ?: 0
    val shop = (s.get("shop") as? JsonArray)!!.mapNotNull { it as? JsonObject }.take(12)
    Shelf("Merchant", "Every set", { act.view("shop") }) {
        PackGrid(shop) { o ->
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Booster(o["code"].str() ?: "", o["name"].str() ?: "")
                GoldCta("%,d".format(price), Modifier.fillMaxWidth(), enabled = coins >= price, muted = true, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 16.dp) }) { act.buy(o["code"].str() ?: "") }
            }
        }
    }
}

// ---------------------------------------------------------------- Sideways dashboard (phones and gaming handhelds)

/**
 * Held sideways on a phone or a handheld like the AYN Thor (Randall 4 Nov 17:48Z: "feels like a real game", borrowing from his
 * dashboard mockup): the Story banner, the four modes in one row and quick tiles in place of the bottom bar on the left; a
 * glass side column with the mastery level, the Trunk and a featured pack on the right. Same data and actions as the tall page.
 */
@Composable
private fun Dashboard(d: PlayHomeData, act: PlayHomeActions, purse: PlayMath.Purse, level: PlayMath.Level, top: Dp, height: Dp, lens: LensHost) {
    val s = d.state
    Row(Modifier.fillMaxSize().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        LazyColumn(Modifier.weight(1f).fillMaxHeight().testTag("playHome"), contentPadding = PaddingValues(top = top, bottom = 24.dp + padBarSpace()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item("story") { Probe("story") { Box(Modifier.dualLens(lens, "story")) { StoryBanner(d, act) } } }
            item("modes") { Probe("modes") { Modes(true, act, (height - top - 160.dp).coerceIn(150.dp, 220.dp), lens) } }
            item("tiles") { Box(Modifier.dualLens(lens, null)) { QuickTiles(act) } }
            // With a bottom screen up, today's quests, deeds and packs live there (PlayHomeBottom), not twice.
            if (!DualScreen.active) {
                item("today") { Probe("today") { Today(d, act) } }
                item("deeds") { Probe("deeds") { Deeds(d, act) } }
                item("packs") { Duo(false, { Probe("packs") { Packs(s, act) } }, { Probe("forge") { Forge(s, act) } }) }
            }
            item("decks") { Probe("decks") { Decks(s, true, act, lens) } }
        }
        LazyColumn(Modifier.width(248.dp).fillMaxHeight(), contentPadding = PaddingValues(top = top, bottom = 24.dp + padBarSpace()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // The mastery level lives in the bottom screen's den while it is up.
            if (!DualScreen.active) item("me") { LevelCard(level) }
            item("featured") { (s.get("shop") as? JsonArray)?.firstOrNull()?.obj()?.let { o -> Box(Modifier.dualLens(lens, "shop:" + (o["code"].str() ?: ""))) { FeaturedPack(s, o, act) } } }
            item("collection") { Probe("collection") { Box(Modifier.dualLens(lens, null)) { Collection(s, act) } } }
        }
    }
}

/**
 * Play Home's bottom screen: one showcase case that follows the ring (plan "The Showcase", Randall 9 Nov). By default the den
 * (your mastery, today's quests, deeds, packs and seals, which leave the top screen); on the Story banner the next battle;
 * on Quick Play your last results; on a deck its box; on the Merchant's pack what buying it leaves you. The purse rides in the plaque.
 */
@Composable
private fun PlayHomeBottom(d: PlayHomeData, act: PlayHomeActions, lens: LensHost, purse: PlayMath.Purse, level: PlayMath.Level) {
    val s = d.state
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val wallet = @Composable { PurseRow(purse, onCoins = { act.view("shop") }, onSeals = { act.view("forge") }, onPacks = { act.view("packs") }) }
    val actData by produceState(StoryActs.cached(d.story.act), d.story.act) { value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { StoryActs.load(ctx, d.story.act) } }
    val history = remember(d.user) { runCatching { dev.cardstashy.nativeplay.play.MatchRecord.history(ctx, d.user.ifBlank { null }) }.getOrDefault(emptyList()) }
    ShowcaseLens(lens.key) { k ->
        val deck = k?.removePrefix("deck:")?.takeIf { k.startsWith("deck:") }?.let { id -> (s.get("decks") as? JsonArray)?.mapNotNull { it as? JsonObject }?.firstOrNull { it["id"].str() == id } }
        val offer = k?.removePrefix("shop:")?.takeIf { k.startsWith("shop:") }?.let { c -> (s.get("shop") as? JsonArray)?.mapNotNull { it as? JsonObject }?.firstOrNull { it["code"].str() == c } }
        val quick = history.filter { it["playStyle"].str() == "quick" }
        when {
            k == "story" -> ActCase(d, act, actData, wallet)
            k == "quick" && quick.isNotEmpty() -> QuickCase(quick, act, wallet)
            deck != null -> DeckCase(deck, history, act, wallet)
            offer != null -> OfferCase(s, offer, act, wallet)
            else -> DenCase(d, act, level, wallet)
        }
    }
}

/** The story acts' battle files from the app's own copy (the same files the Story page reads), parsed once each. */
internal object StoryActs {
    private val acts = java.util.concurrent.ConcurrentHashMap<Int, JsonObject>()
    fun cached(n: Int): JsonObject? = acts[n]
    fun load(ctx: android.content.Context, n: Int): JsonObject? = acts[n] ?: runCatching {
        com.google.gson.JsonParser.parseString(ctx.assets.open("story/act-$n.json").use { String(it.readBytes()) }) as? JsonObject }.getOrNull()?.also { acts[n] = it }
}

private fun cropUrl(name: String) = "https://api.scryfall.com/cards/named?format=image&version=art_crop&exact=" + java.net.URLEncoder.encode(name, "UTF-8")

/** The den: the act's art with its epigraph; your mastery, today's quests, deeds, packs waiting and your seals. */
@Composable
private fun DenCase(d: PlayHomeData, act: PlayHomeActions, level: PlayMath.Level, wallet: @Composable () -> Unit) {
    val s = d.state
    val a = d.rules.acts.firstOrNull { it.act == d.story.act } ?: d.rules.acts.first()
    val groups = remember(s) { (s.get("packs") as? JsonArray)?.mapNotNull { it as? JsonObject }?.groupBy { it.get("set").str() ?: "" }?.filterKeys { it.isNotEmpty() } ?: emptyMap() }
    val w = s.get("wallet") as? JsonObject ?: JsonObject()
    // The act's art and line live on the top screen's Story banner, so the den shows only you: no picture repeated across the gap
    // (Randall 9 Nov: "very redundant, we have a dual screen, it must know and adjust"). Quests sit under Achievements, so one button
    // opens both; the first button is a smart Continue that picks up what you were doing.
    val waiting = groups.values.sumOf { it.size }
    val cont = when {
        waiting > 0 -> CaseButton(null, "Open your packs · $waiting", gold = true, weight = 1.5f) { act.view("packs") }
        !d.story.done -> CaseButton(null, (if (d.story.won > 0) "Continue Act " else "Begin Act ") + a.act, gold = true, weight = 1.5f) { act.story() }
        else -> CaseButton("X", "Quick Play", gold = true, weight = 1.5f) { act.mode("quick") }
    }
    ShowcaseCase("Your den · Mastery", "Level ${level.level}", trailing = wallet,
        buttons = listOf(cont, CaseButton(null, "Achievements") { act.view("deeds") }, CaseButton(null, "The Forge") { act.view("forge") })) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Bar(level.into.toFloat() / level.need.coerceAtLeast(1))
            Text("%,d / %,d XP to level %d".format(level.into, level.need, level.level + 1), style = TextStyle(fontFamily = P.Sans, fontSize = 14.sp, color = P.Muted))
        }
        CaseLabel("Today")
        Quests(d, act)
        if (groups.isNotEmpty()) {
            CaseLabel("Packs waiting")
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState())) {
                groups.entries.take(8).forEach { (code, list) ->
                    Box(Modifier.width(64.dp).clickable { act.openPack(list.first()["id"].str() ?: "") }) {
                        Booster(code, null, Modifier.fillMaxWidth(), mini = true)
                        Box(Modifier.align(Alignment.TopEnd).offset(6.dp, (-6).dp).size(24.dp).clip(CircleShape).background(P.Gold), contentAlignment = Alignment.Center) {
                            Text("${list.size}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, color = P.CtaInk)) }
                    }
                }
            }
        }
        CaseLabel("Seals")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (k2 in listOf("c", "u", "r", "m")) Row(Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0x66000000)).border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(SiteIcons.Seals.getValue(k2), 20.dp); Num(w.get("seal_$k2").int() ?: 0, 15)
            }
        }
    }
}

/** The Story banner's case: the next battle (villain, what they play, what it teaches, the prize booster). Act cleared: the act's line. */
@Composable
private fun ActCase(d: PlayHomeData, act: PlayHomeActions, data: JsonObject?, wallet: @Composable () -> Unit) {
    val a = d.rules.acts.firstOrNull { it.act == d.story.act } ?: d.rules.acts.first()
    val battles = data?.getAsJsonArray("battles")?.mapNotNull { it as? JsonObject }?.filter { it["secret"]?.takeIf { e -> e.isJsonPrimitive }?.asBoolean != true }?.sortedBy { it["slot"].int() ?: 99 }.orEmpty()
    val next = if (d.story.done) null else battles.getOrNull(d.story.won)
    val cta = if (d.story.done) "Replay" else if (d.story.won > 0) "Continue" else "Begin"
    val buttons = listOf(CaseButton("A", cta, gold = true) { act.story() })
    if (next == null) {
        ShowcaseCase("Story · Act ${a.act}", if (d.story.done) "Act cleared" else a.name, trailing = wallet, buttons = buttons,
            hero = { Art(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.3f)) }) {
            if (a.line.isNotBlank()) Text(a.line, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 24.sp, color = Color(0xFFFBF3DF)))
            CaseFact("Era", a.years)
        }
        return
    }
    BattleCase(a, next, data, "Act ${a.act} · Battle ${d.story.won + 1} of ${a.battles}", buttons, wallet)
}

/** One battle in a case: the villain's portrait with the prize booster in its corner, the blurb, what they play, what it teaches. */
@Composable
private fun BattleCase(a: PlayRules.Act, next: JsonObject, data: JsonObject?, eyebrow: String, buttons: List<CaseButton>, wallet: @Composable () -> Unit) {
    val villain = next.getAsJsonObject("villain")
    val who = villain?.get("who").str()
    val face = who?.let { data?.getAsJsonObject("cast")?.getAsJsonObject(it) }
    val reward = next["rewardSet"].str()
    ShowcaseCase(eyebrow, next["title"].str() ?: "", trailing = wallet, buttons = buttons, heroWeight = .36f,
        hero = {
            Art(face?.getAsJsonObject("portrait")?.get("crop").str(), Modifier.matchParentSize(), BiasAlignment(0f, -.3f))
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(.45f to Color.Transparent, 1f to Color(0xF2090B10))))
            Column(Modifier.align(Alignment.BottomStart).padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(face?.get("name").str() ?: "", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFFFBF3DF), shadow = P.shadow))
                face?.get("title").str()?.let { Text(it, style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = P.GoldSoft)) }
            }
            // The prize they guard: the booster this battle gives, leaning in the portrait's corner.
            if (reward != null) Column(Modifier.align(Alignment.TopEnd).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Booster(reward, null, Modifier.width(46.dp).rotate(6f), mini = true)
            }
        }) {
        next["blurb"].str()?.let { Text(it, style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, lineHeight = 21.sp, color = Color(0xFFEDE7DA))) }
        Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
            villain?.getAsJsonObject("deck")?.get("name").str()?.let { CaseFact("They play", it) }
            next["difficulty"].str()?.let { CaseFact("Difficulty", it) }
        }
        val teaches = next.getAsJsonArray("teaches")?.mapNotNull { it.str() }.orEmpty()
        if (teaches.isNotEmpty()) CaseFact("You'll learn", teaches.joinToString(" · "))
        if (reward != null) CaseFact("Prize", "A ${a.packs.firstOrNull { it.first == reward }?.second ?: reward.uppercase()} booster")
    }
}

/**
 * The Story pages' bottom screen (wave 2). On the road: the act under the ring (its line, era, battles won, stars, the era's boosters).
 * On an act: that act by default, and the battle under the ring. A = the battle you are on (or the act you are in). The purse rides in the plaque.
 */
@Composable
internal fun StoryBottom(a: PlayRules.Act, data: JsonObject?, p: dev.cardstashy.nativeplay.play.StoryLogic.Progress, lensKey: String?, here: Boolean,
                         cta: CaseButton?, onBattle: ((String) -> Unit)?, wallet: @Composable () -> Unit) {
    val L = dev.cardstashy.nativeplay.play.StoryLogic
    val battle = lensKey?.removePrefix("battle:")?.takeIf { lensKey.startsWith("battle:") }?.let { id -> data?.getAsJsonArray("battles")?.mapNotNull { it as? JsonObject }?.firstOrNull { it["id"].str() == id } }
    if (battle != null && onBattle != null) {
        val id = battle["id"].str() ?: ""
        val slot = battle["slot"].int() ?: 0
        val secret = battle["secret"]?.takeIf { it.isJsonPrimitive }?.asBoolean == true
        val done = L.battleCleared(p, id)
        val ahead = !secret && slot > L.currentBattle(p, a.act)
        val eyebrow = "Act ${a.act} · " + when { secret -> "Secret battle"; slot >= 8 -> "The boss"; else -> "Battle $slot of ${a.battles}" }
        val buttons = if (ahead) emptyList() else listOf(CaseButton("A", if (done) "Replay" else "Duel", gold = true) { onBattle(id) })
        BattleCase(a, battle, data, eyebrow, buttons, wallet)
        return
    }
    val won = L.actWon(p, a.act); val stars = L.actStars(p, a.act)
    ShowcaseCase("Story · Act ${a.act}", a.name, trailing = wallet, buttons = listOfNotNull(cta), heroWeight = .4f,
        hero = {
            Art(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.3f))
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(.4f to Color.Transparent, 1f to Color(0xF2090B10))))
            if (a.line.isNotBlank()) Text(a.line, Modifier.align(Alignment.BottomStart).padding(14.dp),
                style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp, color = Color(0xFFFBF3DF), shadow = P.shadow), maxLines = 6, overflow = TextOverflow.Ellipsis)
        }) {
        Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
            CaseFact("Era", a.years)
            CaseFact("Battles won", "$won of ${a.battles}")
            CaseFact("Stars", "$stars of ${a.battles * 5}")
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { Bar(won.toFloat() / a.battles.coerceAtLeast(1)) }
        if (a.packs.isNotEmpty()) {
            CaseLabel(if (here) "Boosters this act gives" else "The era's boosters")
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState())) {
                a.packs.take(6).forEach { (code, name) ->
                    Column(Modifier.width(70.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Booster(code, null, Modifier.fillMaxWidth(), mini = true)
                        Text(name, style = TextStyle(fontFamily = P.Sans, fontSize = 11.sp, color = P.Muted), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

/** Quick Play's case: your last five results there, newest first. Only shown once there is a history. */
@Composable
private fun QuickCase(rows: List<JsonObject>, act: PlayHomeActions, wallet: @Composable () -> Unit) {
    val last = rows.takeLast(5).reversed()
    val wins = rows.count { it["outcome"].str() == "win" }; val losses = rows.count { it["outcome"].str() == "loss" }
    ShowcaseCase("Quick Play · $wins–$losses", "Your last ${last.size} matches", trailing = wallet, buttons = listOf(CaseButton("A", "Play", gold = true) { act.mode("quick") })) {
        last.forEach { r ->
            val o = r["outcome"].str() ?: ""
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x12FFFFFF)).padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(when (o) { "win" -> P.Gold; "loss" -> Color(0xFF6B3A36); else -> Color(0xFF3A3D46) }), contentAlignment = Alignment.Center) {
                    Text(o.take(1).uppercase(), style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = if (o == "win") P.CtaInk else P.Ink)) }
                Column(Modifier.weight(1f)) {
                    Text((r.getAsJsonObject("deck")?.get("name").str() ?: "").ifBlank { "Your deck" }, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = P.Ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val opp = r.getAsJsonObject("opponent")?.get("name").str()?.ifBlank { null }
                    val turns = r["turns"].int()?.takeIf { it > 0 }
                    Text(listOfNotNull(opp?.let { "vs $it" }, turns?.let { "$it turns" }).joinToString(" · "), style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, color = P.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

/** A deck tile's case: its lead card large, the cards it leans on and how it has done. */
@Composable
private fun DeckCase(deck: JsonObject, history: List<JsonObject>, act: PlayHomeActions, wallet: @Composable () -> Unit) =
    DeckBoxCase(deck, null, history, listOf(CaseButton("A", "Open deck", gold = true) { act.deck(deck["id"].str() ?: "") }), wallet)

/**
 * A deck's box in the case: its lead card, how full it is, how much of it is in your Trunk and how many cards still need stamping
 * (when [owned] is known), your record with it, the cards it leans on and who you last played. Shared by Play Home and Decks.
 */
@Composable
internal fun DeckBoxCase(deck: JsonObject, owned: Map<String, Int>?, history: List<JsonObject>, buttons: List<CaseButton>, wallet: @Composable () -> Unit = {}) {
    val cards = (deck.get("cards") as? JsonArray)?.mapNotNull { it as? JsonObject }?.filter { it.get("board").str() != "side" } ?: emptyList()
    val count = cards.sumOf { it.get("qty").int() ?: 0 }
    val fmt = deck.get("format").str()?.ifBlank { null } ?: "Standard"
    val lead = cards.firstOrNull { (it.get("name").str() ?: "") !in BASICS }?.get("name").str()
    val cover = dev.cardstashy.nativeplay.account.Decks.pickedCover(deck.get("id").str()) ?: dev.cardstashy.nativeplay.play.Decks.cover(deck).ifBlank { null } ?: lead?.let(::cropUrl)
    val key = dev.cardstashy.nativeplay.play.MatchRecord.deckRecordKey(deck)
    val mine = history.filter { it.getAsJsonObject("deck")?.get("key").str() == key }
    val w = mine.count { it["outcome"].str() == "win" }; val l = mine.count { it["outcome"].str() == "loss" }
    val top = cards.filter { (it.get("name").str() ?: "") !in BASICS }.sortedByDescending { it.get("qty").int() ?: 0 }.take(6)
    val tile = owned?.let { dev.cardstashy.nativeplay.play.Decks.tile(deck, it) }
    ShowcaseCase("Deck · $fmt", deck.get("name").str()?.ifBlank { null } ?: "Untitled deck", trailing = wallet, heroWeight = .34f, buttons = buttons,
        // No empty frames: a deck with no cover and no lead card gives its width to the facts.
        hero = if (cover == null) null else ({ Art(cover, Modifier.matchParentSize(), BiasAlignment(0f, -.3f)) })) {
        Row(horizontalArrangement = Arrangement.spacedBy(26.dp)) {
            CaseFact("Cards", "$count / ${tile?.size ?: deckSize(fmt)}")
            if (tile != null) CaseFact("In your Trunk", "${Math.round(tile.share * 100)}%")
            if (mine.isNotEmpty()) CaseFact("Record", "$w–$l")
        }
        if (tile != null) {
            Bar(tile.share.toFloat())
            Text(if (tile.missing > 0) "${tile.missing} card${if (tile.missing == 1) "" else "s"} to stamp with seals" else "Every card is in your Trunk. Ready to play.",
                style = TextStyle(fontFamily = P.Sans, fontSize = 14.sp, color = P.Muted))
        }
        if (top.isNotEmpty()) {
            CaseLabel("It leans on")
            top.forEach { c -> Text("${c.get("qty").int() ?: 1}×  ${c.get("name").str()}", style = TextStyle(fontFamily = P.Sans, fontSize = 15.sp, color = Color(0xFFE4DFD3)), maxLines = 1, overflow = TextOverflow.Ellipsis) }
        }
        mine.lastOrNull()?.getAsJsonObject("opponent")?.get("name").str()?.ifBlank { null }?.let { CaseFact("Last played against", it) }
    }
}

/** The Merchant's pack: what it costs, what you'd have left and how many of it already wait to be opened. */
@Composable
private fun OfferCase(s: JsonObject, o: JsonObject, act: PlayHomeActions, wallet: @Composable () -> Unit) {
    val price = (s.get("config") as? JsonObject)?.get("packPrice").int() ?: 500
    val coins = (s.get("wallet") as? JsonObject)?.get("coins").int() ?: 0
    val code = o["code"].str() ?: return
    val waiting = (s.get("packs") as? JsonArray)?.count { (it as? JsonObject)?.get("set").str() == code } ?: 0
    ShowcaseCase("Pack · The Merchant", o["name"].str() ?: code.uppercase(), trailing = wallet, heroWeight = .3f,
        buttons = listOf(CaseButton("X", "Buy · %,d".format(price), gold = true, enabled = coins >= price) { act.buy(code) }, CaseButton(null, "The Shop") { act.view("shop") }),
        hero = { Booster(code, o["name"].str() ?: "", Modifier.align(Alignment.Center).padding(14.dp).fillMaxWidth()) }) {
        CaseFact("Price", "%,d coins".format(price), big = true)
        CaseFact(if (coins >= price) "After buying" else "You need", if (coins >= price) "%,d coins left".format(coins - price) else "%,d more coins".format(price - coins))
        if (waiting > 0) CaseFact("Already waiting", if (waiting == 1) "1 of these is unopened" else "$waiting of these are unopened")
    }
}

private val glassShape = RoundedCornerShape(20.dp)
/** The dashboard's glass: a dark pane with a soft gold edge over the ambient art. */
private fun Modifier.dashGlass() = this.clip(glassShape).background(Brush.verticalGradient(listOf(Color(0xCC171A22), Color(0xE00D0F14))))
    .border(1.dp, Brush.linearGradient(listOf(Color(0x66D6AD64), Color(0x22D6AD64), Color(0x55D6AD64))), glassShape)

/** pe-story in one band: the act's art, title, progress and button, its three era packs at the right. */
@Composable
private fun StoryBanner(d: PlayHomeData, act: PlayHomeActions) {
    val a = d.rules.acts.firstOrNull { it.act == d.story.act } ?: d.rules.acts.first()
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxWidth().height(140.dp).testShadow(18.dp, shape).clip(shape).background(Color(0xFF101218)).border(1.dp, P.CardLine, shape).clickable(onClick = act.story)) {
        Art(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to Color(0xF2090B10), .45f to Color(0xB0090B10), .8f to Color(0x30090B10))))
        Row(Modifier.matchParentSize().padding(horizontal = 22.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("STORY · ACT ${a.act}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .16.em, color = P.GoldSoft))
                Text(a.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 25.sp, color = Color(0xFFFBF3DF), shadow = P.shadow), maxLines = 1)
                Text(a.years, style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, lineHeight = 18.sp, color = Color(0xFFDFE3EA)), maxLines = 1)
                Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    GoldCta(if (d.story.done) "Replay" else if (d.story.won > 0) "Continue" else "Begin", onClick = act.story)
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        for (i in 0 until a.battles) { val boss = i == a.battles - 1; val on = i < d.story.won
                            Box(Modifier.size(if (boss) 22.dp else 14.dp, 6.dp).clip(CircleShape).background(if (on) P.Gold else Color(0x26FFFFFF))) }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
                a.packs.take(3).forEachIndexed { i, (code, name) -> Booster(code, name, Modifier.width(if (i == 1) 56.dp else 48.dp).rotate(listOf(-4f, 0f, 4f).getOrElse(i) { 0f }), mini = true) }
            }
        }
    }
}

/** The bottom bar's five places as glass tiles (the bar itself is hidden on the dashboard, so nothing shows twice). */
@Composable
private fun QuickTiles(act: PlayHomeActions) {
    val tiles = listOf(Triple(SiteIcons.Sync, "Collection", "switch"), Triple(SiteIcons.Trunk, "Trunk", "collection"), Triple(SiteIcons.Decks, "Decks", "decks"),
        Triple(SiteIcons.Bag, "Shop", "shop"), Triple(SiteIcons.Trophy, "Trophies", "deeds"))
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        tiles.forEach { (icon, label, to) ->
            Column(Modifier.weight(1f).height(64.dp).dashGlass().clickable { act.view(to) }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterVertically)) {
                Icon(icon, 22.dp, P.Gold)
                Text(label, style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = P.Ink), maxLines = 1)
            }
        }
    }
}

/** Mastery level, its ring and the XP still to go (the purse's level ring, made big). */
@Composable
private fun LevelCard(level: PlayMath.Level) {
    Column(Modifier.fillMaxWidth().dashGlass().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LevelRing(level, framed = true)
            Column {
                Text("MASTERY", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .16.em, color = P.GoldSoft))
                Text("Level ${level.level}", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = P.Ink))
            }
        }
        Bar(level.into.toFloat() / level.need.coerceAtLeast(1))
        Text("%,d / %,d XP".format(level.into, level.need), style = TextStyle(fontFamily = P.Sans, fontSize = 12.sp, color = P.Muted))
    }
}

/** The Merchant's newest set, as one pack you can buy from the side column. */
@Composable
private fun FeaturedPack(s: JsonObject, o: JsonObject, act: PlayHomeActions) {
    val price = (s.get("config") as? JsonObject)?.get("packPrice").int() ?: 500
    val coins = (s.get("wallet") as? JsonObject)?.get("coins").int() ?: 0
    val code = o["code"].str() ?: return
    Column(Modifier.fillMaxWidth().dashGlass().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("FEATURED PACK", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .16.em, color = P.GoldSoft))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Booster(code, o["name"].str() ?: "", Modifier.width(78.dp), mini = true)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(o["name"].str() ?: code.uppercase(), style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 20.sp, color = P.Ink), maxLines = 3)
                GoldCta("%,d".format(price), enabled = coins >= price, radius = 12.dp, leading = { Icon(SiteIcons.Coin, 16.dp) }) { act.buy(code) }
            }
        }
    }
}

/** The Error state for a rules file with no Story acts: say so plainly instead of crashing on a first act that is not there. */
@Composable
fun RulesMissing(onBack: (() -> Unit)?) {
    Column(Modifier.fillMaxSize().background(Site.Bg).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Story couldn’t load", style = Rule.Type.SheetTitle)
        Text("The app’s Story list is empty. Update the app, then open Play again.", style = Rule.Type.S14.copy(color = Site.Muted), textAlign = TextAlign.Center)
        if (onBack != null) GhostButton("Back", onClick = onBack)
    }
}

/**
 * Play before sign-in, in the dashboard's own look (Randall 4 Nov, Portal 2: "old ugly place holder"): the act 1 band,
 * the four modes and a glass sign-in card. Quick Play runs the demo decks; everything else asks for the account.
 * No purse, no level and no made-up numbers: those belong to an account.
 */
@Composable
fun SignedOutHome(rules: PlayRules, top: @Composable () -> Unit, onQuickPlay: () -> Unit, onSignIn: () -> Unit) {
    if (rules.acts.isEmpty()) { RulesMissing(null); return }
    val a1 = rules.acts.first()
    val act = PlayHomeActions(mode = { if (it == "quick") onQuickPlay() else onSignIn() }, story = onSignIn, view = { onSignIn() })
    Box(Modifier.fillMaxSize().background(Site.Bg)) {
        if (!HomeTest.noPictures && (AppSettings.glass || AppSettings.theme == "aura")) Ambient(a1.art)
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val short = HomeTest.forceShort ?: (maxWidth >= 600.dp && maxHeight < 500.dp)
            val wide = maxWidth >= 600.dp
            val topPad = (if (short) 64.dp else 72.dp) + statusTop()
            val modeH = (maxHeight - topPad - 160.dp).coerceIn(150.dp, 220.dp)
            if (short) Row(Modifier.fillMaxSize().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                LazyColumn(Modifier.weight(1f).fillMaxHeight().testTag("playHome"), contentPadding = PaddingValues(top = topPad, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    item("story") { WelcomeBanner(a1, onSignIn) }
                    item("modes") { Modes(true, act, modeH) }
                }
                Column(Modifier.width(248.dp).fillMaxHeight().padding(top = topPad, bottom = 24.dp)) { SignInCard(onSignIn) }
            } else LazyColumn(Modifier.fillMaxSize().testTag("playHome"), contentPadding = PaddingValues(top = topPad, bottom = 28.dp, start = 16.dp, end = 16.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
                item("story") { WelcomeBanner(a1, onSignIn) }
                item("me") { SignInCard(onSignIn) }
                item("modes") { Modes(wide, act) }
            }
            Box(Modifier.fillMaxWidth().background(Rule.Color.Bar).drawBehind {
                drawLine(Brush.horizontalGradient(listOf(Color.Transparent, Color(0x80D6AD64), Color.Transparent)), Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
            }.statusBarsPadding()) { top() }
        }
        // Controller: X = Quick Play, the one mode that runs before sign-in.
        PadScreen(PadActs(x = PadAct("Quick Play", onQuickPlay), root = true))
    }
}

/** The Story band for someone who has not started: act 1's art, its name and years, and the way in. */
@Composable
private fun WelcomeBanner(a: PlayRules.Act, onSignIn: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxWidth().height(140.dp).testShadow(18.dp, shape).clip(shape).background(Color(0xFF101218)).border(1.dp, P.CardLine, shape).clickable(onClick = onSignIn)) {
        Art(a.art, Modifier.matchParentSize(), BiasAlignment(0f, -.4f))
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to Color(0xF2090B10), .45f to Color(0xB0090B10), .8f to Color(0x30090B10))))
        Column(Modifier.matchParentSize().padding(horizontal = 22.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically)) {
            Text("STORY · ACT ${a.act}", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .16.em, color = P.GoldSoft))
            Text(a.name, style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 25.sp, color = Color(0xFFFBF3DF), shadow = P.shadow), maxLines = 1)
            Text(a.years, style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, lineHeight = 18.sp, color = Color(0xFFDFE3EA)), maxLines = 1)
            GoldCta("Sign in to begin", Modifier.padding(top = 2.dp), onClick = onSignIn)
        }
    }
}

/** Where the level card sits once signed in: the brand, one line on what the account keeps, and the gold Sign in. */
@Composable
private fun SignInCard(onSignIn: () -> Unit) {
    Column(Modifier.fillMaxWidth().dashGlass().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            BrandMark(44.dp)
            Column {
                Text("WELCOME", style = TextStyle(fontFamily = P.Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = .16.em, color = P.GoldSoft))
                Text("CardStashy", style = TextStyle(fontFamily = Type.Cinzel, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = P.Ink))
            }
        }
        Text("Sign in to play your own decks, open packs, climb the Story and earn trophies. Quick Play works now with the starter decks.",
            style = TextStyle(fontFamily = P.Sans, fontSize = 13.sp, lineHeight = 18.sp, color = P.Muted))
        GoldCta("Sign in", Modifier.fillMaxWidth(), radius = 12.dp, onClick = onSignIn)
    }
}
