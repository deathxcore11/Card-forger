package dev.cardstashy.nativeplay.foil

import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
 * fails the quality gate leaves the window alone. Not done yet: full arts, which need the text plates per frame family.
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

    /** The art window of a card face in card space (x0, y0, x1, y1), or null when it has none the layer can use yet. */
    fun window(finish: CardFinish?, context: android.content.Context): FloatArray? = when (finish) {
        is CardFinish.Magic -> finish.look.frame.art.takeUnless { full(it) }
        is CardFinish.Ygo -> finish.layout.art.takeUnless { full(it) }
        is CardFinish.Ptcg -> runCatching {
            val masks = PtcgFoil.Masks.load(context)
            val shape = masks.shape(finish.mask) ?: return@runCatching null
            PtcgFoil.artBox(shape).takeUnless { full(it) }
        }.getOrNull()
        else -> null
    }
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
uniform float u_layers;  // the figure plane's weight: 0 for the window alone, easing to 1 once the card's figure is measured
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
float2 lp(float2 uv){return (uv-u_win.xy)/(u_win.zw-u_win.xy)*u_lsize;}
// The backdrop at a window point: the card itself [c], except under the figure, where the plate holds what it hid.
half4 back(float2 uv,half4 c){float2 l=lp(uv);return mix(c,u_plate.eval(l),u_fig.eval(l).b);}
half4 main(float2 fc){
 float2 uv=fc/u_size;
 half4 c=u_card.eval(fc);
 float m=length(u_slide*u_size);
 if(m<.01||inBox(uv,u_win)<.5)return c;
 float2 q=uv-u_slide;
 half4 o,ob;
 if(inBox(q,u_win)>.5){o=u_card.eval(q*u_size);ob=o;if(u_layers>0.)ob=back(q,o);}
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
 float lip=(1.-inBox(uv+normalize(u_slide*u_size)/u_size,u_win))*clamp(length(u_slide)/max(u_full,1e-5),0.,1.)*float(1.-a);
 o.rgb+=(o.a-o.rgb)*half(.22*lip);
 return o;
}
"""
}

/**
 * Wears the depth layer on this card plane. Apply it inside the foil (after Modifier.finish in the chain) so the foil reads the moved card.
 * [tilt] is -1..1 on each axis, the same light the foil follows; reading it only re-draws the layer. A card shown big enough for 3D
 * gets its figure measured once (DepthLayers); until that lands, and wherever the gate says no, the window recedes alone.
 */
fun Modifier.depth(finish: CardFinish?, tilt: State<Offset>?): Modifier =
    if (tilt == null || finish == null || Build.VERSION.SDK_INT < 33 || Foil.testFallback) this else composed {
        val context = androidx.compose.ui.platform.LocalContext.current
        val win = remember(finish) { Depth.window(finish, context.applicationContext) } ?: return@composed this
        if (!AppSettings.depth) return@composed this
        val shader = remember { runCatching { RuntimeShader(Depth.AGSL) }.getOrNull() } ?: return@composed this
        val image = Depth.image(finish)
        val minPx = with(LocalDensity.current) { Depth.MIN_WIDTH.toPx() }
        var big by remember { mutableStateOf(false) }
        val layers by produceState<DepthLayers.Ready?>(null, big, image, win) {
            if (big && image != null) DepthLayers.layers(context.applicationContext, image, win).collect { value = it }
        }
        val blank = remember { FoilMaps.blank }
        val ease = remember { Animatable(0f) }
        LaunchedEffect(layers) { if (layers != null) ease.animateTo(1f, tween(450)) else ease.snapTo(0f) }
        this.onSizeChanged { big = it.width >= minPx }.graphicsLayer {
            val t by tilt
            val w = size.width; val h = size.height
            if (w >= minPx && h > 0f) {
                val ww = (win[2] - win[0]) * w
                // Px the plate moves; the sign follows the card's own turn (rotationY = tilt.x * 8 deg), so the plate reads as behind the frame.
                val sx = Depth.SIGN_X * t.x * Depth.K * ww; val sy = Depth.SIGN_Y * t.y * Depth.K * ww
                val l = layers
                shader.setInputShader("u_plate", l?.inputs?.first ?: blank.first); shader.setInputShader("u_fig", l?.inputs?.second ?: blank.second)
                shader.setFloatUniform("u_lsize", (l?.plate?.width ?: 1).toFloat(), (l?.plate?.height ?: 1).toFloat())
                shader.setFloatUniform("u_layers", if (l != null) ease.value else 0f)
                shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_win", win)
                shader.setFloatUniform("u_slide", sx / w, sy / h); shader.setFloatUniform("u_full", Depth.K * ww * hypot(1f, 1f) / w)
                renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
            } else renderEffect = null
        }
    }
