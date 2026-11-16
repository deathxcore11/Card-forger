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
import kotlinx.coroutines.flow.first
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
    class Ready(val mask: Bitmap, val relief: Bitmap, val glyph: Bitmap?, val stroke: Bitmap? = null, val facet: Bitmap? = null,
                /** Magic (mtgCard): the picture and rules boxes snapped to this card's printed frame lines, and the shooting star its scan carries. */
                val art: FloatArray? = null, val text: FloatArray? = null, val star: FloatArray? = null)
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

    /**
     * Magic foil: the card's own maps, exactly as the site makes them (mtg-foil.js, mtgCardMaps): the scan read at the maps' fixed
     * 336 x 468 (the Foil Test Bench's size, where every per-card rule was checked), its inks and drawn lines, the pattern's own map
     * (silver scroll's silver ink and plates, gleaming gold's picture window, the Jurassic emblem, facet shards), the picture and
     * rules boxes snapped to its printed frame lines, and the shooting star its scan already carries. Silver scroll is read on the
     * 'large' scan: on the 488 px one its plates are too noisy to read as flat. One flow per picture, pattern and frame.
     */
    fun mtgCard(context: android.content.Context, image: String, pat: Int, frameKey: String, frame: dev.cardstashy.nativeplay.play.CardData.Frame): StateFlow<Ready?> = synchronized(flows) {
        val key = "mtgcard|$image|$pat|$frameKey"
        flows[key] ?: MutableStateFlow<Ready?>(null).also { fl ->
            flows[key] = fl
            // A picture that did not load or could not be measured is forgotten, so the next view tries again (the site retries too);
            // so is a card that left the screen before its turn came (a fast-scrolled binder must not hold back the cards in front).
            fun forget() = synchronized(flows) { if (flows[key] === fl) flows.remove(key) }
            scope.launch {
                val watched = kotlinx.coroutines.withTimeoutOrNull(2000) { fl.subscriptionCount.first { it > 0 } } != null
                if (!watched) { forget(); return@launch }
                var done = false
                try {
                    gate.withPermit {
                        if (fl.subscriptionCount.value == 0) return@withPermit
                        // The large scan is only measured, never shown: kept on disk, out of the memory cache the card art lives in.
                        suspend fun load(url: String, large: Boolean) = (CardArt.loader.execute(ImageRequest.Builder(context).data(url).allowHardware(false)
                            .apply { if (large) memoryCachePolicy(coil3.request.CachePolicy.DISABLED) }.build()) as? SuccessResult)?.image?.toBitmap()
                        val src = (if (pat == 23) load(largeScan(image), true) else null) ?: load(image, false) ?: return@withPermit
                        val px = mapPixels(src)
                        val emblem = if (pat == 29) emblem(context) else null // like the site: no emblem picture, the card still gets its maps
                        val m = MtgFoil.cardMaps(px, MtgFoil.MAP_W, MtgFoil.MAP_H, pat, frame.art, frame.text, emblem)
                        fl.value = Ready(rgba(m.mask, MtgFoil.MAP_W, MtgFoil.MAP_H), rgba(m.relief, MtgFoil.MAP_W, MtgFoil.MAP_H), null,
                            rgba(m.stroke, MtgFoil.MAP_W, MtgFoil.MAP_H), null, m.art, m.text, m.star)
                        done = true
                    }
                } finally { if (!done) forget() }
            }
        }
    }
    /** mtg-foil.js largeScan: Scryfall's 'large' scan of the same printing. */
    fun largeScan(src: String): String = Regex("""^(https://cards\.scryfall\.io/)(small|normal)/""").replace(src) { it.groupValues[1] + "large/" }
    /** The card at the maps' size as ARGB, averaged over each target pixel's footprint (the site draws it with high-quality smoothing). */
    fun mapPixels(src: Bitmap): IntArray {
        val sw = src.width; val sh = src.height; val W = MtgFoil.MAP_W; val H = MtgFoil.MAP_H
        val b = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
        val sp = IntArray(sw * sh); b.getPixels(sp, 0, sw, 0, 0, sw, sh)
        if (sw == W && sh == H) return sp
        if (sw < W || sh < H) { val s = Bitmap.createScaledBitmap(b, W, H, true); return IntArray(W * H).also { s.getPixels(it, 0, W, 0, 0, W, H) } }
        return MapScale.area(sp, sw, sh, W, H)
    }
    @Volatile private var emblemPx: ByteArray? = null
    /** The Jurassic World emblem (one measured shape for every card, assets/finishes/mtg-emblem-rex.png) at the maps' size, RGBA. */
    private fun emblem(context: android.content.Context): ByteArray? = emblemPx ?: runCatching {
        val bmp = context.assets.open("finishes/mtg-emblem-rex.png").use { android.graphics.BitmapFactory.decodeStream(it) }
        val px = mapPixels(bmp)
        ByteArray(px.size * 4).also { b -> for (i in px.indices) { val p = px[i]; b[i * 4] = (p shr 16).toByte(); b[i * 4 + 1] = (p shr 8).toByte(); b[i * 4 + 2] = p.toByte(); b[i * 4 + 3] = (p ushr 24).toByte() } }
    }.getOrNull()?.also { emblemPx = it }

    /** Magic, the 3D window of a facet card (DepthLayers): the printing's inks and drawn lines (MtgFoil.analyze) at the site's analysis size, half the scan's width; for a facet
     *  foil ([facetText] its frame's text box) its shards too, cut once here and kept with the maps. */
    fun mtg(context: android.content.Context, image: String, facetText: FloatArray? = null): StateFlow<Ready?> = synchronized(flows) {
        val key = "mtg|$image" + (facetText?.let { "|facet|" + it.joinToString(",") } ?: "")
        // A facet card shown again whose figure was never measured (swiped past before it settled) asks for it again.
        flows[key]?.also { fl -> if (fl.value?.facet != null && figures[image] == null) DepthLayers.facetFigure(context, image) { fl.subscriptionCount.value > 0 } } ?:
        MutableStateFlow<Ready?>(null).also { fl ->
            flows[key] = fl
            scope.launch {
                gate.withPermit {
                    val req = ImageRequest.Builder(context).data(image).allowHardware(false).build()
                    val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap() ?: return@withPermit
                    val (w, h) = MtgFoil.analysisSize(src.width, src.height)
                    val bmp = Bitmap.createScaledBitmap(if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false), w, h, true)
                    val px = IntArray(w * h); bmp.getPixels(px, 0, w, 0, 0, w, h)
                    val m = MtgFoil.analyze(px, w, h, facetText)
                    val had = synchronized(flows) { figures[image] }
                    val facet = m.facet?.let { f -> had?.let { matte(f, it, w, h, facetText!!) } ?: f }
                    fl.value = Ready(rgba(m.mask, w, h), rgba(m.relief, w, h), null, rgba(m.stroke, w, h), facet?.let { rgba(it, w, h) })
                    if (m.facet != null) {
                        // A figure that landed while these maps were made is laid in now (figure() found no maps to put it in).
                        synchronized(flows) { figures[image] }?.takeIf { it !== had }?.let { figure(image, it.first, it.second, it.third) }
                        // Facet foil's matte figure comes from the depth cut, measured with the analysis even when 3D is off, while the card is shown.
                        if (had == null) DepthLayers.facetFigure(context, image) { fl.subscriptionCount.value > 0 }
                    }
                }
            }
        }
    }

    /** Facet foil's matte figure (spec zone 3), as DepthLayers measured it: [figure] over the whole card at [w] x [h]. Kept per picture, and
     *  laid into the facet map's G once (a new map, swapped in), so the foil sheet stays off the creature; nothing changes per frame. It is
     *  measured with the maps (DepthLayers.facetFigure), 3D on or off. Only a cut that passed the depth gate gets here; without one the
     *  figure simply wears the faint background sheet. */
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
    private fun matte(facet: ByteArray, fig: Triple<FloatArray, Int, Int>, w: Int, h: Int, text: FloatArray) = MtgFoil.figureMatte(facet, fig.first, fig.second, fig.third, w, h, text)

    /** Magic's security stamp, measured on this exact picture (MtgStamp, the site's measureStamp): [box] left, top, width, height as
     *  fractions of the card; [mask] the stamp's outline and print brightness as opaque gray (the shader's input, R = alpha), [alpha]
     *  the same as white with that alpha (the stand-in below Android 13). */
    class Stamp(val box: FloatArray, val mask: Bitmap, val alpha: Bitmap)
    private val stamps = object : LinkedHashMap<String, MutableStateFlow<Stamp?>>(32, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, MutableStateFlow<Stamp?>>) = size > 64
    }
    /** Stamps queue on their own gate, so a scrolled list of rares never holds back the card in front's foil maps (FoilMaps.mtg). */
    private val stampGate = Semaphore(1)
    /** The stamp of [image], measured once per picture off the main thread from the picture at its full size, like the site
     *  (mtg-stamp.js stampFor). Null until it lands, and null for good when the picture shows no stamp that can be read: then no
     *  stamp is drawn, never a guessed one. A picture that did not load (offline, a network error) is forgotten, so a later view
     *  tries again; so is one whose tile left the screen before its turn came (nobody watching its flow any more). */
    fun stamp(context: android.content.Context, image: String): StateFlow<Stamp?> = synchronized(stamps) {
        stamps[image] ?: MutableStateFlow<Stamp?>(null).also { fl ->
            stamps[image] = fl
            fun forget() = synchronized(stamps) { if (stamps[image] === fl) stamps.remove(image) }
            scope.launch {
                // The composable that asked starts watching a moment after this call; wait for it, then for a turn.
                val watched = kotlinx.coroutines.withTimeoutOrNull(2000) { fl.subscriptionCount.first { it > 0 } } != null
                if (!watched) { forget(); return@launch }
                stampGate.withPermit {
                    if (fl.subscriptionCount.value == 0) { forget(); return@withPermit }
                    val req = ImageRequest.Builder(context).data(image).size(coil3.size.Size.ORIGINAL).allowHardware(false)
                        // Reuses a decode already cached (the foil's maps), never adds a full-size picture to the cache.
                        .memoryCachePolicy(coil3.request.CachePolicy.READ_ONLY).build()
                    val src = (CardArt.loader.execute(req) as? SuccessResult)?.image?.toBitmap()
                    if (src == null) { forget(); return@withPermit }
                    val bmp = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
                    val w = bmp.width; val h = bmp.height
                    val px = IntArray(w * h); bmp.getPixels(px, 0, w, 0, 0, w, h)
                    val s = MtgStamp.measure(px, w, h) ?: return@withPermit
                    val gray = IntArray(s.mw * s.mh) { i -> val v = s.mask[i].toInt() and 255; (255 shl 24) or (v shl 16) or (v shl 8) or v }
                    val alpha = IntArray(s.mw * s.mh) { i -> ((s.mask[i].toInt() and 255) shl 24) or 0xFFFFFF }
                    fl.value = Stamp(floatArrayOf(s.x.toFloat(), s.y.toFloat(), s.w.toFloat(), s.h.toFloat()),
                        Bitmap.createBitmap(gray, s.mw, s.mh, Bitmap.Config.ARGB_8888), Bitmap.createBitmap(alpha, s.mw, s.mh, Bitmap.Config.ARGB_8888))
                }
            }
        }
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
