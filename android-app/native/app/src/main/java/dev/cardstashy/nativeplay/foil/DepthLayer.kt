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
 * App-only 3D cards: the card is rigid printed layers, never a warped picture. Only foil printings wear them (Randall 14 Nov).
 *
 * Window cards (take 5, the mock-up Randall approved on 14 Nov: "3d is good", "Way better"): the picture inside the printed art window
 * is a plate set back behind the frame; as the card tilts it slides (at most 2.5% of the window's width) and the frame never moves.
 * A figure is cut out only when the cut is near certain (DepthMatte.cut); it sits behind the frame too, at half the depth, so the
 * backdrop moves twice as far. A planeswalker's figure runs over the frame, so it stays at the glass, and the frame's cut corners stay.
 * Both planes end at the frame's printed outline (DepthMatte.rim); past a plane's edge the picture carries on folded back over that
 * edge, under the frame's shadow. The measured depth lights the picture (one light, the far parts a little darker) and never moves
 * it. At rest the card is the scan, pixel for pixel, apart from that light.
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
    /** Backdrop slide at full tilt, as a share of the window's width, until the card is measured (then its own room, DepthLayers.Ready). */
    const val K = DepthMatte.SLIDE
    /** Full arts keep take 3's slide (take 5 changed window cards only). */
    const val K_FULL = .02f
    /** The card's turn at full tilt (radians), for the light's direction in card space: the mock-up's (its plate slides its whole
     *  budget at this turn). */
    const val TURN = .42f
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

    /** The light (from the upper right, in front: the mock-up's) in card space, y up, for a card turned by [yaw] about its upright
     *  axis and [pitch] about its level one: the world light turned back by the card's own turn. */
    fun light(yaw: Float, pitch: Float): Triple<Float, Float, Float> {
        val n = kotlin.math.sqrt(.35f * .35f + .5f * .5f + 1f); var x = .35f / n; var y = .5f / n; var z = 1f / n
        val cp = kotlin.math.cos(-pitch); val sp = kotlin.math.sin(-pitch)
        val y1 = y * cp - z * sp; val z1 = y * sp + z * cp; y = y1; z = z1
        val cy = kotlin.math.cos(-yaw); val sy = kotlin.math.sin(-yaw)
        val x2 = x * cy + z * sy; val z2 = -x * sy + z * cy; x = x2; z = z2
        return Triple(x, y, z)
    }

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
uniform shader u_rel;    // relief light over the art window: R, G the surface normal (y up), B how far back
uniform float2 u_size;   // layer size, px
uniform float4 u_win;    // art window, card space
uniform float4 u_rim;    // the frame's printed outline inside the window, card space: left, top, right, bottom
uniform float2 u_slide;  // the backdrop plate's slide, card space
uniform float u_full;    // |slide| at full tilt, px
uniform float2 u_lsize;  // plate and figure size, px
uniform float2 u_rsize;  // relief size, px
uniform float4 u_lbox;   // card-space box the plate and figure cover: the window, or for a full art the card and a margin past its edge
uniform float u_open;    // 1 for a full art: no frame, no wall, no lip; the card's own edge is the only clip
uniform float u_layers;  // the figure plane's weight: 0 for the window alone, easing to 1 once the card's figure is measured
uniform float u_follow;  // how far the figure moves with the backdrop: 0 at the glass, 1 with it (no cut: one rigid plate)
uniform float u_walker;  // 1 on a planeswalker: the frame's cut corners stay
uniform float3 u_light;  // the light's direction in card space (y up), turned with the card
uniform float u_relon;   // the relief light's weight, eased in with the measurement
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
float2 lp(float2 uv){return (uv-u_lbox.xy)/(u_lbox.zw-u_lbox.xy)*u_lsize;}
half4 card(float2 p){return u_card.eval(p*u_size);}
// The backdrop at a window point: the card itself [c], except under the figure, where the plate holds what it hid.
half4 back(float2 uv,half4 c){float2 l=lp(uv);return mix(c,u_plate.eval(l),u_fig.eval(l).b*half(u_layers));}
// Past a plane's edge the picture carries on folded back over that edge, so no frame colour and no smear ever shows.
float2 fold(float2 v,float4 r){float2 f=v;if(v.x<r.x)f.x=2.*r.x-v.x;if(v.y<r.y)f.y=2.*r.y-v.y;if(v.x>r.z)f.x=2.*r.z-v.x;if(v.y>r.w)f.y=2.*r.w-v.y;return clamp(f,r.xy,r.zw);}
// The frame's shadow on a plane set back behind it: half dark at the frame, gone three slides in, zero at rest.
float shade(float k,float2 spx,float2 dpx){float2 a=abs(k*spx);
 return (1.-.5*(1.-smoothstep(0.,3.*a.x+1.,dpx.x))*min(1.,a.x/1.5))*(1.-.5*(1.-smoothstep(0.,3.*a.y+1.,dpx.y))*min(1.,a.y/1.5));}
// A planeswalker frame cuts the corners of its art window (measured on Jace 2XM 56 and Teferi DOM 207).
float pwPin(float2 p){float2 l=(p-u_win.xy)*u_size,wh=(u_win.zw-u_win.xy)*u_size;float d=min(l.y,wh.y-l.y),e=min(l.x,wh.x-l.x),run=.0208*u_size.x-.17*d;
 return u_walker*clamp((run>0.?run+.0045*u_size.x:0.)-e,0.,1.);}
// The measured depth lights the picture: one light on its relief, the far parts a little darker, the frame's shade round the window.
// It shades the picture, it never moves it.
float lightAt(float2 q,float ed){half4 t=u_rel.eval((q-u_win.xy)/(u_win.zw-u_win.xy)*u_rsize);float2 n=float2(t.rg)*2.-1.;float3 N=float3(n,sqrt(max(0.,1.-dot(n,n))));
 float lit=.86+.3*max(dot(N,u_light),0.);float b=float(t.b);
 return mix(1.,lit*(1.-.22*b)*mix(1.,mix(.5,1.,smoothstep(0.,.05,ed)),min(1.,b*3.)),u_relon);}
half4 main(float2 fc){
 float2 uv=fc/u_size;
 half4 c=u_card.eval(fc);
 float m=length(u_slide*u_size);
 if(inBox(uv,u_win)<.5)return c;
 if(u_open>.5){
  // Full arts (take 3): the backdrop plate runs past the card's edge, so the slide only ever uncovers more backdrop.
  if(m<.01||u_layers<=0.)return c;
  float2 q=uv-u_slide;half4 o=c,ob=back(q,u_card.eval(clamp(q,0.,1.)*u_size));
  half a=u_fig.eval(lp(uv)).r;float2 s=uv-1.6*u_slide;float on=clamp(length(u_slide*float2(1.,u_size.y/u_size.x))*180.,0.,1.);
  ob.rgb*=half(1.-.2*on*inBox(s,u_win)*float(u_fig.eval(lp(s)).g));
  ob=c+(1.-a)*(ob-back(uv,c));
  return mix(o,ob,half(u_layers));
 }
 // Window cards (take 5): both planes sit behind the frame and end at the frame's printed outline.
 float asp=u_size.y/u_size.x;
 float4 inr=float4(u_win.xy+u_rim.xy,u_win.zw-u_rim.zw);
 float2 e2=min(uv-inr.xy,inr.zw-uv);float ed=max(min(e2.x,e2.y*asp),0.);
 float2 spx=u_slide*u_size;
 float2 dpx=max(float2(u_slide.x>0.?uv.x-inr.x:inr.z-uv.x,u_slide.y>0.?uv.y-inr.y:inr.w-uv.y)*u_size,0.);
 half3 o;
 if(m>.01){
  // the backdrop plane, with the figure's shadow and the frame's shadow on it (both zero at rest)
  float2 q=uv-u_slide,qf=fold(q,inr);float past=1.-inBox(q,inr);
  float on=min(1.,m/max(.25*u_full,1e-3)),ks=u_follow+1.25*(1.-u_follow);
  float sh=float(u_fig.eval(lp(clamp(uv-ks*u_slide,u_win.xy,u_win.zw))).g)*(1.-past)*u_layers;
  half3 ob=back(qf,card(qf)).rgb*half((1.-.18*on*sh)*shade(1.,spx,dpx));
  // the figure plane, as a change to the card: at rest this is the printed card, pixel for pixel
  float2 pf=uv-u_follow*u_slide,ff=fold(pf,inr);float pastf=1.-inBox(pf,inr);
  float af=float(u_fig.eval(lp(ff)).r)*(1.-pastf)*u_layers;
  half4 cf=card(ff);
  half3 fg=(cf.rgb-half(1.-af)*back(ff,cf).rgb)*half((1.-pastf)*(1.-on*(1.-smoothstep(0.,.25,af))));
  o=fg*half(lightAt(ff,ed)*shade(u_follow,spx,dpx))+half(1.-af)*ob*half(lightAt(qf,ed));
 }else o=c.rgb*half(lightAt(uv,ed));
 o=mix(c.rgb*half(shade(1.,spx,dpx)),o,half(inBox(uv,inr)));   // the printed outline stays, in the frame's shadow
 o=mix(o,c.rgb,half(pwPin(uv)));                                // a planeswalker's frame corners stay
 return half4(o,c.a);
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
        // Only foils get 3D (Randall 14 Nov): a nonfoil Magic card stays the flat card (its holo stamp still shines).
        if (finish is CardFinish.Magic && finish.look.recipe == null) return@composed this
        val walker = !open && (finish as? CardFinish.Magic)?.look?.walker == true
        val shader = remember { runCatching { RuntimeShader(Depth.AGSL) }.getOrNull() } ?: return@composed this
        val image = Depth.image(finish)
        val minPx = with(LocalDensity.current) { Depth.MIN_WIDTH.toPx() }
        val me = remember { Any() }
        DisposableEffect(me) { onDispose { DepthFocus.remove(me) } }
        val live by remember { derivedStateOf { DepthFocus.live(me) } }
        val facetText = (finish as? CardFinish.Magic)?.look?.facetText
        val layers by produceState<DepthLayers.Ready?>(null, live, image, win) {
            // A new picture never wears the last one's layers (a printing switch or a flip changes the image in place).
            if (!live || image == null) { value = null; return@produceState }
            // A card not measured yet waits until it has settled in view, so opening or swiping past it never starts the model.
            if (!DepthLayers.known(image, win, open, facetText, walker)) { value = null; delay(Depth.SETTLE_MS) }
            DepthLayers.layers(context.applicationContext, image, win, open, facetText, walker).collect { value = it }
        }
        val blank = remember { FoilMaps.blank }
        val ease = remember { Animatable(0f) }
        LaunchedEffect(layers) { if (layers != null) ease.animateTo(1f, tween(450)) else ease.snapTo(0f) }
        this.onSizeChanged { if (it.width >= minPx) DepthFocus.put(me, it.width.toFloat()) else DepthFocus.remove(me) }.graphicsLayer {
            val t by tilt
            val w = size.width; val h = size.height
            val l = layers
            // Every card stays the flat card until its layers are measured: take 5 needs the frame's printed outline (rim), a full art
            // its cut, a planeswalker its window measured from the picture. The layers then ease in, so nothing pops mid-tilt.
            if (live && w >= minPx && h > 0f && l != null) {
                val wn = l.win
                val ww = (wn[2] - wn[0]) * w
                val room = l.room
                val e = ease.value
                // Px the plate moves; the sign follows the card's own turn (rotationY = tilt.x * 8 deg), so the plate reads as behind the
                // frame. It grows in with the layers, so a card measured while tilted settles into its slide instead of jumping.
                val sx = Depth.SIGN_X * t.x * room * ww * e; val sy = Depth.SIGN_Y * t.y * room * ww * e
                shader.setInputShader("u_plate", l.inputs.first); shader.setInputShader("u_fig", l.inputs.second)
                shader.setInputShader("u_rel", l.relInput ?: blank.first)
                shader.setFloatUniform("u_lsize", l.plate.width.toFloat(), l.plate.height.toFloat())
                shader.setFloatUniform("u_rsize", (l.rel?.width ?: 1).toFloat(), (l.rel?.height ?: 1).toFloat())
                shader.setFloatUniform("u_layers", e); shader.setFloatUniform("u_relon", if (l.rel != null) e else 0f)
                shader.setFloatUniform("u_lbox", l.box); shader.setFloatUniform("u_open", if (open) 1f else 0f)
                shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_win", wn); shader.setFloatUniform("u_rim", l.rim)
                shader.setFloatUniform("u_follow", l.follow); shader.setFloatUniform("u_walker", if (walker) 1f else 0f)
                shader.setFloatUniform("u_slide", sx / w, sy / h); shader.setFloatUniform("u_full", room * ww * hypot(1f, 1f))
                val (lx, ly, lz) = Depth.light(t.x * Depth.TURN, t.y * Depth.TURN); shader.setFloatUniform("u_light", lx, ly, lz)
                renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
            } else renderEffect = null
        }
    }
