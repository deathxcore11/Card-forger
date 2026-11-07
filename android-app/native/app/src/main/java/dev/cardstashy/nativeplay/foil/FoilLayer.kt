package dev.cardstashy.nativeplay.foil

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import dev.cardstashy.nativeplay.art.CardArt
import dev.cardstashy.nativeplay.ui.Foil
import dev.cardstashy.nativeplay.ui.foil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

/**
 * The one foil layer every card face wears (foil-anchor-spec.md: "one FoilLayer node shared by grid, deck, detail, zoom, pack
 * and table, so foil upgrades happen in one place"). A finish says which game's foil and recipe; the layer it is applied to is
 * the card plane (CardFace), so every recipe coordinate is card space and the foil is glued to the card at any size.
 */
sealed interface CardFinish {
    /** Magic: the site's mtg-foil recipe for this printing (Foil.look). */
    data class Magic(val look: Foil.Look) : CardFinish
    /** Yu-Gi-Oh!: [effect] is a YgoFoil.RECIPES key (from YgoFoil.effectFor + setEffect), [image] the card picture's address. */
    data class Ygo(val effect: String, val image: String, val layout: YgoFoil.Layout = YgoFoil.Layout.STANDARD, val stars: Float = 0f) : CardFinish {
        val recipe get() = YgoFoil.RECIPES[effect]
    }
    /** Pokémon: [treatment] a PtcgFoil.RECIPES key, [mask] the measured coverage shape, [clip] a printed-mark clear mask over the whole face (anniversary stamps),
     *  [window] when the mask was measured on this exact picture (foil-through everywhere in it), [image] the card picture's address. */
    data class Ptcg(val treatment: String, val mask: String, val image: String, val clip: String? = null, val window: Boolean = false) : CardFinish {
        val recipe get() = PtcgFoil.RECIPES[treatment]
    }
    companion object {
        /** A Pokémon printing's finish from the site's resolver (PtcgFoil.resolve): null for plain, unknown or unmodelled sheets. */
        fun ptcg(card: PtcgFoil.Card, variant: PtcgFoil.Variant, image: String, masks: PtcgFoil.Masks): Ptcg? {
            val p = PtcgFoil.resolve(card, variant, masks)
            val t = p.treatment ?: return null; var mask = p.mask ?: return null
            val stamp = PtcgFoil.stampFor(card, image, masks)
            stamp?.artMask?.let { mask = it }
            if (masks.shape(mask) == null) return null
            return Ptcg(t, mask, image, stamp?.mask?.takeIf { masks.shape(it) != null }, stamp != null)
        }
        /** A Yu-Gi-Oh! printing's finish from its catalogue rarity, set code (OP16-EN001 or OP16), print date and frame/type text.
         *  Null for Common and anything without a recipe (Rush Duel stays plain). */
        fun ygo(rarity: String, setCode: String, date: String, frameText: String, image: String): Ygo? {
            if (Regex("rush", RegexOption.IGNORE_CASE).containsMatchIn(frameText)) return null
            val code = Regex("^([A-Z0-9]+)(?:-|$)", RegexOption.IGNORE_CASE).find(setCode)?.groupValues?.get(1) ?: ""
            val effect = YgoFoil.setEffect(YgoFoil.effectFor(rarity), code, date).takeIf { it in YgoFoil.RECIPES } ?: return null
            return Ygo(effect, image, YgoFoil.layoutOf(frameText), YgoFoil.starFoil(rarity, date))
        }
    }
}

/** Measured maps per card picture, made once off the main thread and kept for the session (LRU). */
object FoilMaps {
    /** [stroke] and [facet]: Magic only (MtgFoil.Maps), the drawn lines' direction and the facet shards; null for the other games. */
    class Ready(val mask: Bitmap, val relief: Bitmap, val glyph: Bitmap?, val stroke: Bitmap? = null, val facet: Bitmap? = null)
    // A picture that can't be fetched or measured leaves its card plain (the layer waits for maps that never come); it must never
    // take the app down from a background thread.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + kotlinx.coroutines.CoroutineExceptionHandler { _, e ->
        android.util.Log.w("FoilMaps", "foil maps failed: $e")
    })
    private val gate = Semaphore(2) // phones: two analyses at a time keep scrolling smooth
    private val flows = object : LinkedHashMap<String, MutableStateFlow<Ready?>>(32, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, MutableStateFlow<Ready?>>) = size > 48
    }
    /** The site measures 813 x 1185 renders; analysing at that size keeps every threshold the site tuned. */
    private const val W = 813; private const val H = 1185

    fun ygo(context: android.content.Context, image: String, layout: YgoFoil.Layout): StateFlow<Ready?> = synchronized(flows) {
        val key = "ygo|$image|$layout"
        flows[key] ?: MutableStateFlow<Ready?>(null).also { f ->
            flows[key] = f
            scope.launch {
                gate.withPermit {
                    val req = ImageRequest.Builder(context).data(image).size(W, H).allowHardware(false).build()
                    val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return@withPermit
                    val bmp = if (src.width == W && src.height == H && src.config == Bitmap.Config.ARGB_8888) src else Bitmap.createScaledBitmap(src.copy(Bitmap.Config.ARGB_8888, false), W, H, true)
                    val px = IntArray(W * H); bmp.getPixels(px, 0, W, 0, 0, W, H)
                    val m = YgoFoil.analyze(px, W, H, layout)
                    f.value = Ready(rgba(m.mask, W, H), rgba(m.relief, W, H), if (m.glyphW > 0) gray(m.glyph, m.glyphW, m.glyphH) else null)
                }
            }
        }
    }

    fun ptcg(context: android.content.Context, f: CardFinish.Ptcg): StateFlow<Ready?> = synchronized(flows) {
        val key = "ptcg|${f.image}|${f.treatment}|${f.mask}|${f.clip}|${f.window}"
        flows[key] ?: MutableStateFlow<Ready?>(null).also { fl ->
            flows[key] = fl
            scope.launch {
                gate.withPermit {
                    val recipe = f.recipe ?: return@withPermit
                    val masks = PtcgFoil.Masks.load(context)
                    val shape = masks.shape(f.mask) ?: return@withPermit
                    val req = ImageRequest.Builder(context).data(f.image).allowHardware(false).build()
                    val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return@withPermit
                    val (w, h) = PtcgFoil.analysisSize(src.width, src.height)
                    val bmp = Bitmap.createScaledBitmap(if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false), w, h, true)
                    val px = IntArray(w * h); bmp.getPixels(px, 0, w, 0, 0, w, h)
                    val m = PtcgFoil.analyze(px, w, h, recipe, shape, shape, f.clip?.let { masks.shape(it) }, f.window)
                    fl.value = Ready(rgba(m.mask, w, h), rgba(m.relief, w, h), null)
                }
            }
        }
    }

    /** Magic: the printing's inks and drawn lines (MtgFoil.analyze) at the site's analysis size, half the scan's width; for a facet
     *  foil ([facetText] its frame's text box) its shards too, cut once here and kept with the maps. */
    fun mtg(context: android.content.Context, image: String, facetText: FloatArray? = null): StateFlow<Ready?> = synchronized(flows) {
        val key = "mtg|$image" + (facetText?.let { "|facet|" + it.joinToString(",") } ?: "")
        flows[key] ?: MutableStateFlow<Ready?>(null).also { fl ->
            flows[key] = fl
            scope.launch {
                gate.withPermit {
                    val req = ImageRequest.Builder(context).data(image).allowHardware(false).build()
                    val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return@withPermit
                    val (w, h) = MtgFoil.analysisSize(src.width, src.height)
                    val bmp = Bitmap.createScaledBitmap(if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false), w, h, true)
                    val px = IntArray(w * h); bmp.getPixels(px, 0, w, 0, 0, w, h)
                    val m = MtgFoil.analyze(px, w, h, facetText)
                    val facet = m.facet?.let { f -> synchronized(flows) { figures[image] }?.let { matte(f, it, w, h, facetText!!) } ?: f }
                    fl.value = Ready(rgba(m.mask, w, h), rgba(m.relief, w, h), null, rgba(m.stroke, w, h), facet?.let { rgba(it, w, h) })
                }
            }
        }
    }

    /** Facet foil's matte figure (spec zone 3), as DepthLayers measured it: [figure] over the whole card at [w] x [h]. Kept per picture, and
     *  laid into the facet map's G once (a new map, swapped in), so the foil sheet stays off the creature; nothing changes per frame. Only
     *  a cut that passed the depth gate gets here; without one the figure simply wears the background sheet. */
    fun figure(image: String, figure: FloatArray, w: Int, h: Int) {
        val ready = synchronized(flows) {
            figures[image] = Triple(figure, w, h)
            flows.entries.filter { it.key.startsWith("mtg|$image|facet|") }.map { it.key to it.value }
        }
        for ((key, fl) in ready) scope.launch {
            val r = fl.value ?: return@launch // still measuring: the analysis lays the figure in when it lands
            val f = r.facet ?: return@launch
            val text = key.substringAfter("|facet|").split(",").map { it.toFloat() }.toFloatArray()
            val fw = f.width; val fh = f.height
            val px = IntArray(fw * fh).also { f.getPixels(it, 0, fw, 0, 0, fw, fh) }
            val bytes = ByteArray(fw * fh * 4)
            for (i in px.indices) { val p = px[i]; bytes[i * 4] = (p shr 16).toByte(); bytes[i * 4 + 1] = (p shr 8).toByte(); bytes[i * 4 + 2] = p.toByte(); bytes[i * 4 + 3] = -1 }
            fl.value = Ready(r.mask, r.relief, r.glyph, r.stroke, rgba(matte(bytes, Triple(figure, w, h), fw, fh, text), fw, fh))
        }
    }
    private val figures = object : LinkedHashMap<String, Triple<FloatArray, Int, Int>>(8, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Triple<FloatArray, Int, Int>>) = size > 6
    }
    /** The figure scaled to the map, off the text box and the name bar (those are frame, not art). */
    private fun matte(facet: ByteArray, fig: Triple<FloatArray, Int, Int>, w: Int, h: Int, text: FloatArray): ByteArray {
        val m = DepthMatte.resize(fig.first, fig.second, fig.third, w, h)
        for (k in m.indices) {
            val u = (k % w + .5f) / w; val v = (k / w + .5f) / h
            if (u >= text[0] && u <= text[2] && (v >= text[1] && v <= text[3] || v >= .035f && v <= .105f)) m[k] = 0f
        }
        return MtgFoil.withFigure(facet, m)
    }

    /** A measured map as a shader input: clamped at the edges, bilinear like the site's textures. */
    fun input(b: Bitmap): Shader = BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR }
    /** Stand-in inputs before a card's maps land (the shader ignores them while u_maps is 0). */
    val blank: Pair<Shader, Shader> by lazy { val b = Bitmap.createBitmap(intArrayOf(-16777216), 1, 1, Bitmap.Config.ARGB_8888); input(b) to input(b) }

    private fun rgba(b: ByteArray, w: Int, h: Int): Bitmap {
        val px = IntArray(w * h) { i -> val k = i * 4; (255 shl 24) or ((b[k].toInt() and 255) shl 16) or ((b[k + 1].toInt() and 255) shl 8) or (b[k + 2].toInt() and 255) }
        return Bitmap.createBitmap(px, w, h, Bitmap.Config.ARGB_8888)
    }
    private fun gray(b: ByteArray, w: Int, h: Int): Bitmap {
        val px = IntArray(w * h) { i -> val v = b[i].toInt() and 255; (255 shl 24) or (v shl 16) or (v shl 8) or v }
        return Bitmap.createBitmap(px, w, h, Bitmap.Config.ARGB_8888)
    }
}

/**
 * Wears [finish] on this layer (the card plane). [tilt] is -1..1 on each axis; reading it only re-draws the layer.
 * Yu-Gi-Oh! draws as soon as its maps are measured (a fraction of a second, once per card); until then the card shows plain,
 * never a stand-in shine. Below Android 13 there are no runtime shaders, so the card stays plain there too.
 */
fun Modifier.finish(finish: CardFinish?, tilt: State<Offset>?): Modifier = when {
    finish == null || tilt == null -> this
    finish is CardFinish.Magic -> this.foil(finish.look, tilt)
    finish is CardFinish.Ygo -> if (Build.VERSION.SDK_INT < 33 || Foil.testFallback || finish.recipe == null) this else ygoFoil(finish, tilt)
    finish is CardFinish.Ptcg -> if (Build.VERSION.SDK_INT < 33 || Foil.testFallback || finish.recipe == null) this else ptcgFoil(finish, tilt)
    else -> this
}

@RequiresApi(33)
private fun Modifier.ygoFoil(f: CardFinish.Ygo, tilt: State<Offset>): Modifier = composed {
    val context = LocalContext.current
    val maps by remember(f.image, f.layout) { FoilMaps.ygo(context.applicationContext, f.image, f.layout) }.collectAsState()
    val m = maps ?: return@composed this
    val r = f.recipe ?: return@composed this
    val shader = remember { runCatching { RuntimeShader(YgoFoil.AGSL) }.getOrNull() } ?: return@composed this
    val inputs = remember(m) {
        fun s(b: Bitmap) = BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR }
        Triple(s(m.mask), s(m.relief), m.glyph?.let(::s))
    }
    this.graphicsLayer {
        val t by tilt
        val w = size.width; val h = size.height
        if (w > 0f && h > 0f) {
            shader.setInputShader("u_mask", inputs.first); shader.setInputShader("u_relief", inputs.second)
            shader.setInputShader("u_glyph", inputs.third ?: inputs.first)
            shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_px", w, h)
            shader.setFloatUniform("u_map", m.mask.width.toFloat(), m.mask.height.toFloat())
            shader.setFloatUniform("u_gmap", (m.glyph?.width ?: 1).toFloat(), (m.glyph?.height ?: 1).toFloat())
            shader.setFloatUniform("u_tilt", t.x, t.y); shader.setFloatUniform("u_aspect", h / w)
            shader.setFloatUniform("u_art", f.layout.art); shader.setFloatUniform("u_name", YgoFoil.NAME_BOX); shader.setFloatUniform("u_text", f.layout.text)
            shader.setFloatUniform("u_whole", r.whole?.v ?: FloatArray(3)); shader.setFloatUniform("u_frame", r.frame?.v ?: FloatArray(3))
            shader.setFloatUniform("u_artL", r.art?.v ?: FloatArray(3))
            shader.setFloatUniform("u_stars", if (f.stars > 0f) f.stars else if (r.stars) 1f else 0f)
            shader.setFloatUniform("u_metal", if (m.glyph != null) r.name.code else 0f)
            shader.setFloatUniform("u_maps", 1f)
            renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
        }
    }
}

@RequiresApi(33)
private fun Modifier.ptcgFoil(f: CardFinish.Ptcg, tilt: State<Offset>): Modifier = composed {
    val context = LocalContext.current
    val maps by remember(f) { FoilMaps.ptcg(context.applicationContext, f) }.collectAsState()
    val m = maps ?: return@composed this
    val r = f.recipe ?: return@composed this
    val shader = remember { runCatching { RuntimeShader(PtcgFoil.AGSL) }.getOrNull() } ?: return@composed this
    val inputs = remember(m) {
        fun s(b: Bitmap) = BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR }
        s(m.mask) to s(m.relief)
    }
    this.graphicsLayer {
        val t by tilt
        val w = size.width; val h = size.height
        if (w > 0f && h > 0f) {
            shader.setInputShader("u_mask", inputs.first); shader.setInputShader("u_relief", inputs.second)
            shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_px", w, h)
            shader.setFloatUniform("u_map", m.mask.width.toFloat(), m.mask.height.toFloat())
            shader.setFloatUniform("u_tilt", t.x, t.y); shader.setFloatUniform("u_aspect", h / w)
            shader.setFloatUniform("u_r1", r.pat.toFloat(), r.tint.toFloat(), r.underbase.toFloat(), r.relief)
            shader.setFloatUniform("u_r2", r.sparkle, r.soft.toFloat(), r.strength, r.coat.toFloat())
            renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
        }
    }
}
