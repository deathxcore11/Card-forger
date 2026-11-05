package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.draw.clip
import coil3.request.allowHardware
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.draw.drawWithContent
import com.google.gson.JsonParser
import coil3.toBitmap
import dev.cardstashy.nativeplay.art.CardArt

/**
 * The pack opener's template pack (pack-wrappers.js packTemplateArt, pack-preview.js, sets-ui.css .pack-tpl): Randall's wrapper with
 * an empty art window, the set's real art under it clipped to the window (pack-window.png), and the art layer drifting against
 * the fixed frame as the phone tilts or a finger moves over the pack. Rigid layers only: the frame never moves, nothing warps.
 * Until the art has loaded, or if it fails, the set's painted wrapper shows instead; never the bare template.
 */
object PackTemplate {
    class Art(val card: String, val url: String, val x: Float, val y: Float)

    @Volatile private var map: Map<String, Art>? = null

    /** The set's template art (assets/pack-art.json, exported from pack-art-data.js), or null for a set without one. */
    fun art(context: Context, code: String): Art? = load(context)[code.lowercase()]

    /** The sets' art once drawn (the Shop's grid scrolls tiles in and out): kept so a tile comes back with its art at once. */
    internal val pictures = object : android.util.LruCache<String, ImageBitmap>(32 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap) = value.width * value.height * 4
    }

    private fun load(context: Context): Map<String, Art> = map ?: synchronized(this) {
        map ?: runCatching {
            JsonParser.parseString(context.assets.open("pack-art.json").use { String(it.readBytes()) }).asJsonObject.entrySet().associate { (k, v) ->
                val o = v.asJsonObject
                k to Art(o["card"].asString, o["art"].asString, o["x"]?.asFloat ?: 50f, o["y"]?.asFloat ?: 35f)
            }
        }.getOrElse { emptyMap() }.also { map = it }
    }

    /** .pack-tpl-art: left 3 %, top 9 %, 94 % x 57 % of the pack, object-fit cover at the art's focus, scale 1.07. */
    const val LEFT = .03f; const val TOP = .09f; const val W = .94f; const val H = .57f
    /** translate(-2.4 %, -2 %) of the art box at full deflection. */
    const val DX = .024f; const val DY = .02f
}

/**
 * The set's template pack when its art is ready, else [fallback] (the painted wrapper). [drift] is the parallax, -1..1 on each axis,
 * read only while drawing. Returns true while the template shows, so the opener can drop the effects the site hides on it.
 */
@Composable
fun TemplatePack(code: String, name: String?, drift: () -> Offset, modifier: Modifier, brand: Boolean = false,
                 /** A Yu-Gi-Oh! or Pokémon simulator's template art (packTemplateArt, from the engine): not in pack-art.json. */
                 override: PackTemplate.Art? = null,
                 /** A pack on a page (the Shop, Play's packs): sized like Booster's, small ones without the band's words, a Collector's sheen. */
                 fill: Boolean = true, mini: Boolean = false, collector: Boolean = false, fallback: @Composable () -> Unit): Boolean {
    val ctx = LocalContext.current
    val art = override ?: remember(code) { PackTemplate.art(ctx, code) }
    if (art == null || HomeTest.noPictures) { fallback(); return false }
    // The band's name, as Booster names it.
    val label = name?.ifBlank { null } ?: dev.cardstashy.nativeplay.play.SetFacts.sets.collectAsState().value[code]?.name ?: code.uppercase()
    val frame = produceState(AssetImages.cached("play/pack-template.webp@600"), code) { value = AssetImages.load(ctx, "play/pack-template.webp", maxWidth = 600) }.value
    val mask = produceState(AssetImages.cached("play/pack-window.png@0"), code) { value = AssetImages.load(ctx, "play/pack-window.png") }.value
    // Loaded off screen while the painted wrapper shows (the image cache keeps it for the next pack of this set).
    val picture = produceState(PackTemplate.pictures.get(art.url), art.url) {
        if (value != null) return@produceState
        // (Screenshots hand their saved copy of the art in through homeArt.)
        value = (homeArt(art.url) as? ImageBitmap ?: run {
            val r = coil3.request.ImageRequest.Builder(ctx).data(art.url).size(coil3.size.Size.ORIGINAL).build()
            (CardArt.loader.execute(r) as? coil3.request.SuccessResult)?.image?.toBitmap()?.asImageBitmap()
        })?.also { PackTemplate.pictures.put(art.url, it) }
    }.value
    if (frame == null || mask == null || picture == null) { fallback(); return false }
    TemplatePackDrawn(code, label, art, frame, mask, picture, drift, modifier, brand, fill, mini, collector)
    return true
}

/** The template pack once its three pictures are in: the frame, the window mask and the set's art. */
@Composable
internal fun TemplatePackDrawn(code: String, label: String, art: PackTemplate.Art, frame: ImageBitmap, mask: ImageBitmap, picture: ImageBitmap, drift: () -> Offset, modifier: Modifier,
                               brand: Boolean = false, fill: Boolean = true, mini: Boolean = false, collector: Boolean = false) {
    WrappedBooster(code, label, PACK_TEMPLATE_WRAP, frame, modifier, mini = mini, collector = collector, fill = fill, brand = brand, under = {
        // The window: everything under it is clipped to the mask's shape (it tucks under the gold curve and stops at the silver sides).
        BoxWithConstraints(Modifier.matchParentSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }.drawWithContent {
            drawContent()
            drawImage(mask, dstOffset = IntOffset.Zero, dstSize = IntSize(size.width.toInt(), size.height.toInt()), blendMode = BlendMode.DstIn)
        }) {
            val bw = maxWidth; val bh = maxHeight
            Image(picture, art.card, Modifier.offset(bw * PackTemplate.LEFT, bh * PackTemplate.TOP).size(bw * PackTemplate.W, bh * PackTemplate.H).graphicsLayer {
                val d = drift()
                translationX = -d.x * PackTemplate.DX * size.width; translationY = -d.y * PackTemplate.DY * size.height
                scaleX = 1.07f; scaleY = 1.07f
            }, contentScale = ContentScale.Crop, alignment = BiasAlignment(art.x / 50f - 1f, art.y / 50f - 1f))
        }
    })
}

/** pack-preview.js packArtUrl: the worker's address for a set's real booster pack (TCGplayer product art), its query as URLSearchParams writes it. */
fun packArtUrl(code: String, name: String): String {
    fun enc(v: String) = java.net.URLEncoder.encode(v, "UTF-8").replace("+", "%20").replace("*", "%2A")
    val c = code.lowercase()
    val q = listOfNotNull(c.takeIf { Regex("^[a-z0-9]{1,8}$").matches(it) }?.let { "code=" + enc(it) }, name.takeIf { it.isNotBlank() }?.let { "name=" + enc(it.take(120)) }).joinToString("&")
    return if (q.isEmpty()) "" else "https://cardstashy.com/img/pack/mtg.jpg?$q"
}

/** sets-ui.css .pack-wrap-art: radius 6 and the crimped top and bottom edges (a 4 %-step zigzag 3 % deep). */
private val CrimpedPack = androidx.compose.foundation.shape.GenericShape { size, _ ->
    val w = size.width; val h = size.height
    moveTo(0f, h * .03f)
    for (i in 1..25) lineTo(w * i * .04f, if (i % 2 == 1) 0f else h * .03f)
    lineTo(w, h * .97f)
    for (i in 24 downTo 0) lineTo(w * i * .04f, if (i % 2 == 0) h * .97f else h)
    lineTo(0f, h)
    close()
}

/**
 * The set's real booster pack for the Open Pack simulator when it has neither template art nor a painted wrapper (pack-preview.js:
 * packArtSources → the worker's product photo), trimmed to the pack itself (trimPackArt) and cut like .pack-wrap-art (object-fit:
 * cover). False until it has loaded, or when it can't; the caller then draws its own pack.
 */
@Composable
fun RemotePack(code: String, name: String, modifier: Modifier): Boolean = RemotePackFrom(remember(code, name) { listOf(packArtUrl(code, name)).filter { it.isNotEmpty() } }, name, modifier)

/** [RemotePack] from a list of pictures, the first that loads (a Yu-Gi-Oh! or Pokémon pack: packArtSources, then setArtworkSources). */
@Composable
fun RemotePackFrom(urls: List<String>, name: String, modifier: Modifier): Boolean {
    val ctx = LocalContext.current
    if (urls.isEmpty()) return false
    val picture = produceState<ImageBitmap?>(null, urls) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            urls.firstNotNullOfOrNull { url ->
                val r = coil3.request.ImageRequest.Builder(ctx).data(url).size(coil3.size.Size.ORIGINAL).allowHardware(false).build()
                (CardArt.loader.execute(r) as? coil3.request.SuccessResult)?.image?.toBitmap()?.let(::trimPackArt)?.asImageBitmap()
            }
        }
    }.value ?: return false
    androidx.compose.foundation.layout.Box(modifier.clip(CrimpedPack)
        .then(Modifier.drawWithContent {
            drawRect(androidx.compose.ui.graphics.Brush.linearGradient(listOf(androidx.compose.ui.graphics.Color(0xFF2B2836), androidx.compose.ui.graphics.Color(0xFF121218)),
                Offset(size.width * .33f, 0f), Offset(size.width * .67f, size.height)))
            drawContent()
        })) {
        Image(picture, name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
    }
    return true
}


/**
 * pack-preview.js trimPackArt: product photos come with studio background and padding around the pack; the corners give the
 * background colour and the crop keeps everything that differs from it (read at 320 px). A picture whose corners disagree, or
 * whose crop would be tiny or nearly everything, is left as it is.
 */
internal fun trimPackArt(src: android.graphics.Bitmap): android.graphics.Bitmap {
    val W = src.width; val H = src.height
    val k = minOf(1f, 320f / maxOf(W, H)); val w = maxOf(1, Math.round(W * k)); val h = maxOf(1, Math.round(H * k))
    val soft = if (src.config == android.graphics.Bitmap.Config.HARDWARE) src.copy(android.graphics.Bitmap.Config.ARGB_8888, false) else src
    val small = android.graphics.Bitmap.createScaledBitmap(soft, w, h, true)
    val d = IntArray(w * h); small.getPixels(d, 0, w, 0, 0, w, h)
    fun px(i: Int, j: Int) = d[j * w + i]
    val bg = listOf(0 to 0, w - 1 to 0, 0 to h - 1, w - 1 to h - 1).map { (i, j) -> px(i, j).let { intArrayOf((it shr 16) and 255, (it shr 8) and 255, it and 255) } }
    val ref = (0..2).map { n -> bg.sumOf { it[n] } / 4f }
    if (bg.any { kotlin.math.abs(it[0] - ref[0]) + kotlin.math.abs(it[1] - ref[1]) + kotlin.math.abs(it[2] - ref[2]) > 36 }) return soft
    fun fg(i: Int, j: Int): Boolean { val c = px(i, j); return ((c ushr 24) and 255) > 24 && kotlin.math.abs(((c shr 16) and 255) - ref[0]) + kotlin.math.abs(((c shr 8) and 255) - ref[1]) + kotlin.math.abs((c and 255) - ref[2]) > 48 }
    fun busy(n: Int, col: Boolean): Boolean { val len = if (col) h else w; var hits = 0; for (m in 0 until len) if (if (col) fg(n, m) else fg(m, n)) hits++; return hits > len * .02f }
    var l = 0; var r = w - 1; var t = 0; var b = h - 1
    while (l < r && !busy(l, true)) l++
    while (r > l && !busy(r, true)) r--
    while (t < b && !busy(t, false)) t++
    while (b > t && !busy(b, false)) b--
    val cw = r - l + 1; val ch = b - t + 1
    if (cw < w * .3f || ch < h * .3f || cw.toLong() * ch > w.toLong() * h * .94f) return soft
    val sx = W.toFloat() / w; val sy = H.toFloat() / h
    val x0 = Math.round(l * sx).coerceIn(0, W - 1); val y0 = Math.round(t * sy).coerceIn(0, H - 1)
    return android.graphics.Bitmap.createBitmap(soft, x0, y0, Math.round(cw * sx).coerceIn(1, W - x0), Math.round(ch * sy).coerceIn(1, H - y0))
}

/**
 * The site's pack with no picture (sets-ui.css): .pack-wrap-art's crimped linear-gradient(160deg, #2b2836, #121218), and its band
 * (.pack-wrap-brand: inset auto 10 % 12 % 10 %, the static mark at 44 % over the set's name, 14 px, #f5ead0, 10 px apart).
 */
@Composable
fun BarePack(name: String, modifier: Modifier) = androidx.compose.foundation.layout.BoxWithConstraints(modifier.clip(CrimpedPack).drawWithContent {
    // 160°: from the top-left-ish corner down to the bottom-right-ish one, as CSS draws it through the box's middle.
    val r = Math.toRadians(160.0); val dx = kotlin.math.sin(r).toFloat(); val dy = -kotlin.math.cos(r).toFloat()
    val half = (kotlin.math.abs(size.width * dx) + kotlin.math.abs(size.height * dy)) / 2f; val c = Offset(size.width / 2f, size.height / 2f)
    drawRect(androidx.compose.ui.graphics.Brush.linearGradient(listOf(androidx.compose.ui.graphics.Color(0xFF2B2836), androidx.compose.ui.graphics.Color(0xFF121218)),
        c - Offset(dx * half, dy * half), c + Offset(dx * half, dy * half)))
    drawContent()
}, contentAlignment = androidx.compose.ui.Alignment.BottomCenter) {
    val bw = maxWidth * .8f
    androidx.compose.foundation.layout.Column(Modifier.padding(bottom = maxHeight * .12f).width(bw), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
        BrandMark(bw * .44f, static = true)
        androidx.compose.material3.Text(name, style = androidx.compose.ui.text.TextStyle(fontFamily = Site.Body.fontFamily, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 14.sp,
            lineHeight = 20.sp, color = androidx.compose.ui.graphics.Color(0xFFF5EAD0), textAlign = androidx.compose.ui.text.style.TextAlign.Center))
    }
}
