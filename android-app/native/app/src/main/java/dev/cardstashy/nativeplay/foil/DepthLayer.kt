package dev.cardstashy.nativeplay.foil

import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.Foil
import kotlinx.coroutines.delay
import kotlin.math.hypot

/**
 * App-only 3D cards (Randall 4 Nov, take 3 approved): the card is rigid printed layers, never a warped picture.
 *
 * Window cards: the art inside the printed art window is a flat plate sitting a little behind the frame. As the card tilts the plate
 * slides (at most 2% of the window's width), the frame never moves, and everything is cut hard at the window's edge, so nothing bleeds.
 * Where the slide uncovers the window's inner wall, the wall shows the frame's own material in shadow, and the frame's lip on the
 * opposite edge catches a one-pixel glint. Both grow with the tilt from zero: at rest the card is the scan, pixel for pixel.
 *
 * The layer sits under the foil (the foil wears the moved card), so every recipe keeps working exactly as before. Settings "3D cards"
 * off, a small tile, Android below 13 or a card without a measured window: no layer at all, the card draws exactly as it did.
 * Figure plane (take 3): the first time a card shows big, the phone measures its depth and cuts the figure out of the window
 * (DepthModel, DepthMatte). The figure then stays at the glass with a faint shadow on the backdrop receding behind it. A cut that
 * fails the quality gate leaves the window alone.
 *
 * Full arts (borderless Magic, Secret Lairs, Pokémon full arts): no window. The whole card is cut; the figure, the printed panels
 * (the depth model reads name bars and text boxes as near) and the printed words stay at the glass while the art slides behind them,
 * clipped only by the card's own edge. A full art that fails the gate, or the seam checks (DepthMatte.cutFull), stays the flat card.
 */
object Depth {
    /** Backdrop slide at full tilt, as a share of the window's width. */
    const val K = .02f
    /** The plate moves with the viewer: a positive rotationY (tilt.x > 0, CardZoom and PackOpen) brings the card's left edge
     *  toward the eye, i.e. the eye sits off to the card's left, so the plate behind the window slides left. Measured, not assumed
     *  (graphicsLayer probe on Android's renderer). */
    const val SIGN_X = -1f
    const val SIGN_Y = -1f
    /** Tiles narrower than this stay flat: the slide would be under a pixel and the extra layer costs scrolling. */
    val MIN_WIDTH = 220.dp
    /** How long a card not measured yet must stay in view before the phone measures it. */
    const val SETTLE_MS = 450L

    /** Where a card face's art recedes: [win] the printed art window in card space (x0, y0, x1, y1); for a full art ([open]) the whole
     *  card, whose own edge is the only clip. */
    class Plane(val win: FloatArray, val open: Boolean)

    fun plane(finish: CardFinish?, context: android.content.Context): Plane? = when (finish) {
        is CardFinish.Magic -> finish.look.frame.art
        is CardFinish.Ygo -> finish.layout.art
        is CardFinish.Ptcg -> runCatching {
            val masks = PtcgFoil.Masks.load(context)
            val shape = masks.shape(finish.mask) ?: return@runCatching null
            PtcgFoil.artBox(shape)
        }.getOrNull()
        else -> null
    }?.let { if (full(it)) Plane(floatArrayOf(0f, 0f, 1f, 1f), true) else Plane(it, false) }
    private fun full(b: FloatArray) = b[0] <= .01f && b[1] <= .01f && b[2] >= .99f && b[3] >= .99f

    /** The card picture the figure is measured from. */
    fun image(finish: CardFinish): String? = when (finish) {
        is CardFinish.Magic -> finish.look.image
        is CardFinish.Ygo -> finish.image
        is CardFinish.Ptcg -> finish.image
        else -> null
    }

    const val AGSL = """
uniform shader u_card;
uniform shader u_plate;  // the backdrop plate over the art window, the figure filled in (DepthLayers)
uniform shader u_fig;    // R the figure, G its shadow, B where the plate was filled in, over the art window
uniform float2 u_size;   // layer size, px
uniform float4 u_win;    // art window, card space
uniform float2 u_slide;  // the backdrop plate's slide, card space
uniform float u_full;    // |slide| at full tilt, card-space x
uniform float2 u_lsize;  // plate and figure size, px
uniform float4 u_lbox;   // card-space box the plate and figure cover: the window, or for a full art the card and a margin past its edge
uniform float u_open;    // 1 for a full art: no frame, no wall, no lip; the card's own edge is the only clip
uniform float u_layers;  // the figure plane's weight: 0 for the window alone, easing to 1 once the card's figure is measured
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
float2 lp(float2 uv){return (uv-u_lbox.xy)/(u_lbox.zw-u_lbox.xy)*u_lsize;}
// The backdrop at a window point: the card itself [c], except under the figure, where the plate holds what it hid.
half4 back(float2 uv,half4 c){float2 l=lp(uv);return mix(c,u_plate.eval(l),u_fig.eval(l).b);}
half4 main(float2 fc){
 float2 uv=fc/u_size;
 half4 c=u_card.eval(fc);
 float m=length(u_slide*u_size);
 if(m<.01||inBox(uv,u_win)<.5)return c;
 if(u_open>.5&&u_layers<=0.)return c;
 float2 q=uv-u_slide;
 half4 o,ob;
 // a full art: the backdrop plate runs past the card's edge, so the slide only ever uncovers more backdrop
 if(u_open>.5){o=c;ob=back(q,u_card.eval(clamp(q,0.,1.)*u_size));}
 else if(inBox(q,u_win)>.5){o=u_card.eval(q*u_size);ob=o;if(u_layers>0.)ob=back(q,o);}
 else{
  // the window's inner wall: the frame's own material just past the edge the ray left through, in shadow, darker the deeper
  float2 d=normalize(-u_slide*u_size);
  float2 e=clamp(q,u_win.xy,u_win.zw)+d*2.5/u_size;
  float deep=clamp(length((q-clamp(q,u_win.xy,u_win.zw))*u_size)/m,0.,1.);
  o=u_card.eval(e*u_size);o.rgb*=half(mix(.62,.48,deep));ob=o;
 }
 half a=0.;
 if(u_layers>0.){
  // the figure stays at the glass; its shadow (20% at most, take 3) falls on the backdrop, moving 1.6 times as far, zero at rest
  a=u_fig.eval(lp(uv)).r;
  float2 s=uv-1.6*u_slide;
  float on=clamp(length(u_slide*float2(1.,u_size.y/u_size.x))*180.,0.,1.);
  ob.rgb*=half(1.-.2*on*inBox(s,u_win)*float(u_fig.eval(lp(s)).g));
  // rigid layers as a change to the card: at rest the backdrop is where it was, so this is the scan, pixel for pixel
  ob=c+(1.-a)*(ob-back(uv,c));
  // eased in when the measurement lands, so the figure never pops mid-tilt
  o=mix(o,ob,half(u_layers));a*=half(u_layers);
 }
 // the frame's lip on the opposite edge catches the light: one pixel, faint, growing with the tilt
 float lip=(1.-inBox(uv+normalize(u_slide*u_size)/u_size,u_win))*clamp(length(u_slide)/max(u_full,1e-5),0.,1.)*float(1.-a)*(1.-u_open);
 o.rgb+=(o.a-o.rgb)*half(.22*lip);
 return o;
}
"""
}

/**
 * Which big cards wear the 3D layer now: the card in focus (a card view, a zoom, a pull, two cards at most), never a grid of big
 * tiles on a tablet or an open foldable. Each card at least [Depth.MIN_WIDTH] wide registers its width; a card is live when it is
 * as big as the biggest on screen (within 10 %) and at most two cards are. The others draw as the flat card with its foil, as with
 * Settings "3D cards" off, so a grid never runs the depth pass per tile per frame and never queues the model.
 */
internal object DepthFocus {
    private val cards = mutableStateMapOf<Any, Float>()
    fun put(key: Any, width: Float) { if (cards[key] != width) cards[key] = width }
    fun remove(key: Any) { cards.remove(key) }
    fun live(key: Any): Boolean {
        val w = cards[key] ?: return false
        val top = cards.values.maxOrNull() ?: return false
        return w >= top * .9f && cards.values.count { it >= top * .9f } <= 2
    }
}

/**
 * Wears the depth layer on this card plane. Apply it inside the foil (after Modifier.finish in the chain) so the foil reads the moved card.
 * [tilt] is -1..1 on each axis, the same light the foil follows; reading it only re-draws the layer. A card shown big enough for 3D
 * gets its figure measured once (DepthLayers); until that lands, and wherever the gate says no, the window recedes alone.
 */
fun Modifier.depth(finish: CardFinish?, tilt: State<Offset>?): Modifier =
    if (tilt == null || finish == null || Build.VERSION.SDK_INT < 33 || Foil.testFallback) this else composed {
        val context = androidx.compose.ui.platform.LocalContext.current
        val plane = remember(finish) { Depth.plane(finish, context.applicationContext) } ?: return@composed this
        val win = plane.win; val open = plane.open
        if (!AppSettings.depth) return@composed this
        val shader = remember { runCatching { RuntimeShader(Depth.AGSL) }.getOrNull() } ?: return@composed this
        val image = Depth.image(finish)
        val minPx = with(LocalDensity.current) { Depth.MIN_WIDTH.toPx() }
        val me = remember { Any() }
        DisposableEffect(me) { onDispose { DepthFocus.remove(me) } }
        val live by remember { derivedStateOf { DepthFocus.live(me) } }
        val facetText = (finish as? CardFinish.Magic)?.look?.facetText
        val layers by produceState<DepthLayers.Ready?>(null, live, image, win) {
            if (!live || image == null) return@produceState
            // A card not measured yet waits until it has settled in view, so opening or swiping past it never starts the model.
            if (!DepthLayers.known(image, win, open, facetText)) delay(Depth.SETTLE_MS)
            DepthLayers.layers(context.applicationContext, image, win, open, facetText).collect { value = it }
        }
        val blank = remember { FoilMaps.blank }
        val ease = remember { Animatable(0f) }
        LaunchedEffect(layers) { if (layers != null) ease.animateTo(1f, tween(450)) else ease.snapTo(0f) }
        this.onSizeChanged { if (it.width >= minPx) DepthFocus.put(me, it.width.toFloat()) else DepthFocus.remove(me) }.graphicsLayer {
            val t by tilt
            val w = size.width; val h = size.height
            val l = layers
            // A full art stays the flat card until its layers are measured: with no frame, nothing may move before the cut is known.
            if (live && w >= minPx && h > 0f && (!open || l != null)) {
                val ww = (win[2] - win[0]) * w
                // Px the plate moves; the sign follows the card's own turn (rotationY = tilt.x * 8 deg), so the plate reads as behind the frame.
                val sx = Depth.SIGN_X * t.x * Depth.K * ww; val sy = Depth.SIGN_Y * t.y * Depth.K * ww
                shader.setInputShader("u_plate", l?.inputs?.first ?: blank.first); shader.setInputShader("u_fig", l?.inputs?.second ?: blank.second)
                shader.setFloatUniform("u_lsize", (l?.plate?.width ?: 1).toFloat(), (l?.plate?.height ?: 1).toFloat())
                shader.setFloatUniform("u_layers", if (l != null) ease.value else 0f)
                shader.setFloatUniform("u_lbox", l?.box ?: win); shader.setFloatUniform("u_open", if (open) 1f else 0f)
                shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_win", win)
                shader.setFloatUniform("u_slide", sx / w, sy / h); shader.setFloatUniform("u_full", Depth.K * ww * hypot(1f, 1f) / w)
                renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
            } else renderEffect = null
        }
    }
