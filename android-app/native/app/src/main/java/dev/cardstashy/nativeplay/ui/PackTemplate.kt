package dev.cardstashy.nativeplay.ui

import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
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
fun TemplatePack(code: String, name: String?, drift: () -> Offset, modifier: Modifier, fallback: @Composable () -> Unit): Boolean {
    val ctx = LocalContext.current
    val art = remember(code) { PackTemplate.art(ctx, code) }
    if (art == null || HomeTest.noPictures) { fallback(); return false }
    // The band's name, as Booster names it.
    val label = name?.ifBlank { null } ?: dev.cardstashy.nativeplay.play.SetFacts.sets.collectAsState().value[code]?.name ?: code.uppercase()
    val frame = produceState(AssetImages.cached("play/pack-template.webp@600"), code) { value = AssetImages.load(ctx, "play/pack-template.webp", maxWidth = 600) }.value
    val mask = produceState(AssetImages.cached("play/pack-window.png@0"), code) { value = AssetImages.load(ctx, "play/pack-window.png") }.value
    // Loaded off screen while the painted wrapper shows (the image cache keeps it for the next pack of this set).
    val picture = produceState<ImageBitmap?>(null, art.url) {
        val r = coil3.request.ImageRequest.Builder(ctx).data(art.url).size(coil3.size.Size.ORIGINAL).build()
        value = (CardArt.loader.execute(r) as? coil3.request.SuccessResult)?.image?.toBitmap()?.asImageBitmap()
    }.value
    if (frame == null || mask == null || picture == null) { fallback(); return false }
    TemplatePackDrawn(code, label, art, frame, mask, picture, drift, modifier)
    return true
}

/** The template pack once its three pictures are in: the frame, the window mask and the set's art. */
@Composable
internal fun TemplatePackDrawn(code: String, label: String, art: PackTemplate.Art, frame: ImageBitmap, mask: ImageBitmap, picture: ImageBitmap, drift: () -> Offset, modifier: Modifier) {
    WrappedBooster(code, label, PACK_TEMPLATE_WRAP, frame, modifier, mini = false, fill = true, under = {
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
