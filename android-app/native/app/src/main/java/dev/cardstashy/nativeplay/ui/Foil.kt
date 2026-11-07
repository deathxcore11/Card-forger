package dev.cardstashy.nativeplay.ui

import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import androidx.compose.animation.core.animateFloat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardData

/**
 * Magic foil, the site's own: MTG_FOIL_FRAGMENT (mtg-foil.js) ported line for line to AGSL and drawn
 * over the card image as a render effect, with the same recipe (pattern, tint, coverage, relief, film,
 * sparkle, stamp, keep) picked by mtgFoilProfile from the printing's Scryfall data, the same frame boxes
 * and the M15 oval holo stamp. Each card's inks and relief are measured from its own image like the site's worker
 * (foil/MtgFoil.kt, analyzeMtgCard); until that lands (a fraction of a second, once per card) covers read as the whole card.
 * Below Android 13 a rainbow sheen stands in.
 */
object Foil {
    // Comments trimmed; the structure and every constant follow mtg-foil.js. pow(x, 2.) is written x*x
    // (AGSL leaves pow undefined for negative bases), and texture reads become u_card.eval.
    const val AGSL = """
uniform shader u_card;uniform shader u_mask;uniform shader u_relief;uniform shader u_stroke;uniform shader u_facet;
uniform float2 u_size;uniform float2 u_px;uniform float2 u_tilt;uniform float u_aspect;uniform float u_on;uniform float2 u_map;uniform float u_maps;
uniform float4 u_art;uniform float4 u_text;uniform float4 u_r1;uniform float4 u_r2;
const float PI=3.14159265;
float sq(float x){return x*x;}
float3 toLin(float3 c){return mix(c/12.92,pow((c+.055)/1.055,float3(2.4)),step(float3(.04045),c));}
float3 toSrgb(float3 c){return mix(c*12.92,1.055*pow(max(c,float3(0.)),float3(1./2.4))-.055,step(float3(.0031308),c));}
float hash(float2 p){p=fract(p*float2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float2 hash2(float2 p){return float2(hash(p),hash(p+17.31));}
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
float3 spectrum(float l){float3 c=float3(exp(-sq((l-600.)/70.))+.35*exp(-sq((l-440.)/30.)),exp(-sq((l-540.)/60.)),exp(-sq((l-455.)/40.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
float3 spread(float s,float d){float3 c=float3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
float3 grating(float3 L,float3 V,float2 g,float d){return spread(abs(dot(L.xy+V.xy,g)),d);}
float3 film(float cosT,float t){float3 ph=4.*PI*1.45*t*cosT/float3(650.,532.,450.);return .5+.5*cos(ph);}
float3 shoulder(float3 x){float3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
float3 voro(float2 q){float2 n=floor(q),f=fract(q);float d1=8.,d2=8.;float2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return float3(id,sqrt(d2)-sqrt(d1));}
// gs: the drawn line under this pixel, its direction as (cos 2t, sin 2t) in xy and its strength in z (0 off the steered patterns).
float3 foil(float pat,float tint,float2 uv,float3 L,float3 V,float3 N,float spot,float2 grad,float height,float3 gs){
 float3 H=normalize(L+V);float2 q=float2(uv.x,uv.y*u_aspect),px=uv*u_px;float2 g=normalize(float2(.86,.5));
 float d=1550.,lines=0.,glint=0.,mirror=.35,ex=14.,amp=.7,seam=1.;float spec=-1.;
 if(pat<1.5){}
 else if(pat<2.5){g=normalize(float2(.6,.8));d=1750.;mirror=.1;ex=8.;amp=.65;}
 else if(pat<3.5){g=float2(1.,0.);d=1300.;mirror=.9;amp=.6;spec=exp(-sq(H.x/.07))+.35*exp(-sq(H.x/.22));}
 else if(pat<4.5){float3 w=voro(q*260.);float2 j=hash2(w.xy);float3 n=normalize(float3((j-.5)*.9,1.));
  spec=pow(max(dot(n,H),0.),70.)*2.2+.45*exp(-sq(dot(H.xy,float2(.7071,.7071))/.12));mirror=1.;g=normalize(float2(1.,(j.x-.5)*.7));amp=.42;d=1450.+j.y*400.;}
 else if(pat<5.5){float ph=height*55.,gr=sin(ph);float2 gn=length(grad)>1e-4?normalize(grad):float2(1.,0.);
  g=gn;d=1250.;N=normalize(N+float3(gn*cos(ph)*.04,0.));mirror=.3;ex=24.;amp=.6;lines=.5+.2*gr;}
 else if(pat<6.5){float w1=sin(q.x*30.+sin(q.y*9.)*2.),w2=sin((q.x+q.y)*24.+sin(q.x*7.)*2.5);
  g=normalize(float2(cos(w1*1.6+q.y*3.),sin(w2*1.6))+1e-4);d=1250.+300.*w1;lines=.5+.5*w1*w2;mirror=.35;amp=.9;}
 else if(pat<7.5){}
 else if(pat<8.5){float2 c=q-float2(.5,.5*u_aspect);float rr=length(c),a=atan(c.y,c.x),sw=a+rr*9.;
  g=float2(-sin(sw),cos(sw));d=1100.+rr*900.;lines=.5+.5*sin(a*6.+rr*40.);mirror=.25;amp=.6;}
 else if(pat<9.5){float3 w=voro(q*30.);float2 j=hash2(w.xy);float on=step(.55,j.x)*smoothstep(0.,.05,w.z);
  float a=j.y*PI;g=mix(g,float2(cos(a),sin(a)),on);d=mix(1550.,1050.+j.x*900.,on);amp=mix(.5,1.4,on);mirror=.3;}
 else if(pat<10.5){amp=0.;}
 else if(pat<11.5){float3 w=voro(q*float2(9.,6.));float2 j=hash2(w.xy);float a=j.x*PI;g=float2(cos(a),sin(a));d=1150.+j.y*800.;
  float edge=1.-smoothstep(0.,.03,w.z);glint=edge*pow(max(dot(normalize(float3((j-.5)*.8,1.)),H),0.),20.)*1.2;mirror=.3;amp=.9;}
 else if(pat<12.5){float2 c=q-float2(.5,.42*u_aspect);float rr=length(c);g=normalize(c+1e-4);d=1300.;lines=.5+.5*sin(rr*170.);mirror=.35;amp=.8;}
 else if(pat<13.5){float2 p=q*float2(9.,9.),c=floor(p),f=fract(p)-.5;float rr=length(f),a=atan(f.y,f.x);
  float ring=1.-smoothstep(.02,.05,abs(rr-.32)),pip=0.;for(int k=0;k<5;k++){float ak=float(k)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.04,.07,length(f-.16*float2(cos(ak),sin(ak)))));}
  float sym=max(ring,pip);float ca=hash(c+3.1)*PI;g=mix(g,float2(cos(ca),sin(ca)),sym);d=mix(1550.,1150.,sym);amp=mix(.55,1.3,sym);lines=sym;}
 else if(pat<14.5){float2 p=q*float2(16.,22.);float row=floor(p.y);p.x+=mod(row,2.)*.5;float2 f=fract(p)-float2(.5,0.);
  float sc=length(f*float2(1.,1.3));N=normalize(N+float3(f*float2(.6,.4),0.));g=normalize(f+1e-3);d=1300.+400.*sc;lines=smoothstep(.45,.5,sc);mirror=.4;}
 else if(pat<15.5){g=float2(0.,1.);d=900.;lines=.5+.5*sin(px.y*2.4);mirror=.3;amp=1.15;}
 else if(pat<16.5){float2 p=q*14.,f=fract(p)-.5;float dm=abs(f.x)+abs(f.y);
  glint=(smoothstep(.34,.36,dm)-smoothstep(.42,.44,dm))*pow(max(dot(N,H),0.),26.)*1.8;}
 else if(pat<17.5){}
 else if(pat<18.5){mirror=.9;amp=.3;ex=16.;}
 else if(pat<19.5){float2 c=(uv-float2(.5,.4))*float2(1.,u_aspect);
  float top=abs(length(c-float2(-.02,-.13))-.075)-.022,bot=abs(length(c-float2(0.,.07))-.12)-.026,tail=max(abs(dot(c-float2(.05,.03),normalize(float2(.62,.78))))-.024,length(c-float2(.05,.03))-.2);
  float amp_=1.-smoothstep(0.,.012,min(min(top,bot),tail));glint=amp_*(.35+pow(max(dot(N,H),0.),12.)*1.4);lines=1.-.3*amp_;}
 else if(pat<20.5){g=float2(0.,1.);d=1400.;lines=.55+.45*sin(px.y*1.2);mirror=.35;amp=.75;}
 else{d=1900.;amp=.45;mirror=.2;} // facet: the finer, quieter sheet behind the shards, so they pop off it
 // Line art steers the grating: grooves follow the drawn line, so the rainbow streaks run along it (traditional, raised, textured).
 // The steer blends what the grating sees (its spacing along the light), never the direction itself: blending two directions has no
 // answer where they cross at a right angle and the rainbow would jump there, drawing rings and seams. A line and its reverse agree.
 // The shift is soft-limited (.08): the rainbow is so sensitive to it that a full shift would trace a ring wherever the line field
 // starts; limited, the hue still runs along the lines, and the band only bends where it crosses them.
 float2 lv=L.xy+V.xy;float s=abs(dot(lv,g));
 if(gs.z>0.&&dot(gs.xy,gs.xy)>1e-3){float th=.5*atan(gs.y,gs.x);float ds=abs(dot(lv,float2(cos(th),sin(th))))-s;s+=gs.z*ds*.08/(.08+abs(ds));}
 float3 dif=spread(s,d)*amp;
 if(pat>9.5&&pat<10.5)dif=grating(L,V,normalize(float2(.86,.5)),1450.)*.8+grating(L,V,normalize(float2(-.5,.86)),1650.)*.8;
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
 float3 metal=tint<.5?float3(1.):tint<1.5?float3(1.,.74,.32):float3(.86,.9,.96);
 float3 col=tint<.5?dif*1.9:tint<1.5?metal*(.5*spot+.9*length(dif))*1.3:metal*(.6*spot+.5*length(dif))*1.3+dif*.25;
 return (float3(.18)*metal+spot*(mirror*spec*metal+col)*(.7+.3*lines)+glint*metal)*seam;
}
// Ink on metal: printed ink filters the foil under it, so the print's own contrast is kept and the band is light the metal adds.
// The band: where the foil is lit past its rest level (Fb, past q) the ink glows in its own hue with a hot core (Fb squared); the
// light an ink lets through is capped by the ink itself, so a dark or mid print never blows out to white; under a metal sheet's broad
// highlight (gold, silver) a dark ink passes at most a few times itself, per channel, so a navy sky glows navy and never goes milky.
// Off the band the metal faces the dark room and coloured ink sits a little deeper; black ink takes no colour and stays black.
// Pale neutral paint and paper are the metal itself: the rainbow on the band and, off it, at most a light silver below the print,
// except where the recipe's foil is the paper itself ([silver]): there it is the deep silver of the bare metal, well below the
// print. [q]: a metal sheet (gold, silver) is lit broadly, so its band starts higher.
float3 overInk(float3 base,float3 F,float cover,float silver,float q){float y=dot(base,float3(.2126,.7152,.0722));float mx=max(base.r,max(base.g,base.b));float3 T=mix(base,base/max(mx,.04),.32*smoothstep(.004,.04,mx));
 float f=dot(F,float3(.3333));float3 chroma=F-f,Fb=max(F-q,0.);
 float3 lift=base*min(f-q-.02,0.)*6.+(T+.03)*Fb*(5.+24.*Fb)+chroma*T*smoothstep(.02,.4,y)*1.8;float3 cap=min(float3(max(.92-y,.02)),base*(q>.3?5.:60.)+.015);
 float3 up=max(lift,0.);float3 fl=base*mix(.93,.8,silver);
 float3 ink=max(base+up*cap/(cap+up)+min(lift,0.),mix(base*.72,fl,smoothstep(.18,.4,y)));
 float3 paper=max(F*1.3+base*mix(.5,.25,silver)*exp(-f*4.)+chroma*.9,fl);
 float neutral=1.-smoothstep(.12,.35,length(base-y));
 float3 lit=mix(max(shoulder(ink),base*.72),max(shoulder(paper),fl),smoothstep(.25,.7,y)*neutral);
 // [silver] (the foil is the paper itself: step-and-compleat, scroll): pale print is a deep silver blade, the metal through the
 // paper (T*F), allowed well below the scan so it reads as silver and never as white paper with a sheen. Ink keeps its cap.
 if(silver>.5)lit=mix(max(shoulder(ink),base*.72),shoulder(T*F*1.35),smoothstep(.25,.7,y)*neutral);
 return mix(base,lit,clamp(cover,0.,1.));}
float shootingStar(float2 uv){float2 c=float2(u_text.x+.035,u_text.w-.03),d=(uv-c)*float2(1.,u_aspect);
 float star=max(0.,1.-(abs(d.x)+abs(d.y))*95.)+max(0.,1.-length(d)*140.);
 float2 t=d;float arc=.004*sin(clamp(t.x*40.,0.,PI));float tail=step(0.,t.x)*step(t.x,.05)*smoothstep(.0022,0.,abs(t.y+arc))*(1.-t.x*20.);
 return clamp(star*2.+tail,0.,1.);}
half4 main(float2 fc){
 half4 src=u_card.eval(fc);float a=float(src.a);if(a<.002)return src;
 float2 uv=fc/u_size;float3 base=toLin(clamp(float3(src.rgb)/a,0.,1.));
 float art=inBox(uv,u_art),text=inBox(uv,u_text);
 float2 lp=float2(.5,.45)+u_tilt*.6;float3 P=float3(uv.x,uv.y*u_aspect,0.);
 float3 L=normalize(float3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(float3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 float2 dl=(uv-lp)*float2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.3);
 float2 mp=uv*u_map;half4 mk=u_mask.eval(mp),rl=u_relief.eval(mp);
 float hx=float(u_relief.eval(mp+float2(2.,0.)).r-u_relief.eval(mp-float2(2.,0.)).r),hy=float(u_relief.eval(mp+float2(0.,2.)).r-u_relief.eval(mp-float2(0.,2.)).r);
 float2 grad=float2(hx,hy)*u_maps;float rel=u_r1.w*(1.-.7*text);float3 N=normalize(float3(-grad*rel*9.,1.));
 float pat=u_r1.x,tint=u_r1.y,mode=u_r1.z;
 float cov=1.;
 if(mode>.5&&mode<1.5)cov=1.-art;else if(mode>1.5&&mode<2.5)cov=mix(1.,float(mk.r),u_maps);else if(mode>3.5&&mode<4.5)cov=mix(1.,float(mk.b),u_maps);else if(mode>4.5)cov=mix(1.,float(rl.g),u_maps);
 if(mode>1.5&&(mode<2.5||mode>3.5))cov*=1.-text;
 // Facet foil (MtgFoil.facets): R the shard's tilt seed, G the matte figure (printed without foil), B the shard, soft to its outline.
 // The finer sheet behind the shards stays off the text box and the figure.
 half4 fm=half4(0.);if(pat>20.5){if(u_maps>.5)fm=u_facet.eval(mp);cov*=(1.-text)*(1.-float(fm.g));}
 float patterned=step(4.5,pat)*(1.-step(6.5,pat)*step(pat,7.5))*(1.-step(16.5,pat));cov*=1.-.45*text*patterned;
 float3 outC=base;
 // The measured stroke (MtgFoil stroke map) for the steered patterns once the maps land: traditional, textured, raised.
 float3 gs=float3(0.);
 if(u_maps>.5&&(pat<1.5||pat>16.5&&pat<17.5||pat>4.5&&pat<5.5)){half4 st=u_stroke.eval(mp);gs=float3(float(st.r)*2.-1.,float(st.g)*2.-1.,float(st.b)*(1.-.6*text));}
 float3 F=foil(pat,tint,uv,L,V,N,spot,grad,float(rl.r)*u_maps,gs);
 if(u_on>.5){
  if(u_r2.x>.5){float t=320.+260.*float(rl.r)*u_maps+120.*hash(floor(uv*u_px/3.));float3 f=film(dot(N,V),t);F=f*(.15+spot*(1.4*pow(max(dot(N,H),0.),16.)+.5));}
  float keep=u_r2.w;outC=overInk(base,F,cov*.92*(1.-keep),step(3.5,mode)*step(mode,4.5),tint>1.5?.44:tint>.5?.16:.22);
  // Raised relief: glossy rims where the embossed height turns toward the light.
  if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.35+.65*spot)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*float3(1.,.97,.92)*rim*rel*cov*.8;}
  // Facet foil: each printed glass shard (cut once per card, MtgFoil.facets) is a flat mirror with its own fixed tilt; it flashes
  // in one piece and its printed neon outline is a cut edge that throws the rainbow along the line. The glass is ink on metal too:
  // its own print is lit (never covered by a grey or white sheet), deeper while it faces away, bright as it turns to the light, with
  // its tilt's rainbow on it. Over the dark text box the glass stays dark glass with a rainbow on it, never a pale lump. The shard
  // fades to its outline (B is its depth inside the piece).
  if(pat>20.5&&u_maps>.5){float shard=float(fm.b);
   // The tilt seed is read at its texel's centre: filtering two pieces' seeds together would give the pixels between them random
   // tilts, a dotted line of flashes along the seam.
   if(shard>.004){float sd=float(u_facet.eval(floor(mp)+.5).r);float2 j=float2(sd,fract(sd*7.31+.17));float3 fn=normalize(float3((j-.5)*1.1,1.));float nh=max(dot(fn,H),0.);
    float flash=pow(nh,22.),sheen=pow(nh,8.);float3 fc=grating(L,V,normalize(float2(cos(j.x*PI),sin(j.x*PI))),1100.+j.y*900.);
    float yb=dot(base,float3(.2126,.7152,.0722));
    float3 face=base*(.68+.5*sheen+1.6*flash*(.4+.6*spot))+fc*sheen*(.6+.9*spot)*(.25+.75*smoothstep(.03,.3,yb))+float3(.86,.93,1.)*flash*.12*spot*smoothstep(.05,.4,yb);
    outC=mix(outC,clamp(shoulder(face),base*mix(.68,.93,smoothstep(.18,.4,yb)),max(base,float3(.96))),smoothstep(0.,.35,shard));}
   float edge=float(rl.b);
   if(edge>.004){half4 st=u_stroke.eval(mp);float2 sd=float2(st.rg)*2.-1.;float th=.5*atan(sd.y,sd.x);
    float3 ge=grating(L,V,float2(cos(th),sin(th)),1300.)*1.2*(.45+.8*spot);outC=mix(outC,shoulder(outC+ge),edge);}}
  if(u_r2.y>0.){float2 sq2=float2(uv.x,uv.y*u_aspect)*70.,sc=floor(sq2);float2 j=hash2(sc);float on=step(1.-.22*u_r2.y,j.x);
   float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sq2)-.2-.6*hash2(sc*1.3)));
   float tw=pow(max(dot(normalize(float3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=on*pt*(.25+tw*3.)*cov*(.4+.6*spot)*float3(1.,.97,.9);}
  // Fluorescent ink glows under any light, on top of its foil.
  if(mode>2.5&&mode<3.5)outC+=base*float(mk.g)*.45*(.6+.4*spot)*u_maps;
  if(u_r2.z>.5&&u_r2.z<1.5){float s=shootingStar(uv);outC=mix(outC,shoulder(F*1.6+float3(.15)),s*.9);}
 }
 if(u_r2.z>1.5){float2 o=(uv-float2(.5,.925))/float2(.03,.012);float ov=1.-smoothstep(.8,1.,length(o));float3 hs=grating(L,V,normalize(float2(.3,1.)),1500.)*1.5+float3(.75,.78,.82)*pow(max(dot(N,H),0.),30.)*spot;outC=mix(outC,shoulder(hs+float3(.2)),ov*.85);}
 return half4(half3(toSrgb(clamp(outC,0.,1.))*a),half(a));
}
"""

    /** What one card face wears: the recipe for its finish (null = nonfoil), the frame boxes and the holo stamp. */
    data class Look(val recipe: CardData.Recipe?, val frame: CardData.Frame, val stamp: Boolean, val label: String, val image: String? = null) {
        val shines get() = recipe != null || stamp
        /** The printing's scan to measure inks from, when this recipe reads them (gilded, neon, textured, raised, oil slick...). */
        val measure: String? get() = image?.takeIf { recipe != null && dev.cardstashy.nativeplay.foil.MtgFoil.needsMaps(recipe.cover, recipe.relief, recipe.film, recipe.pat) }
        /** Facet foil: its shards are cut with the maps, outside this frame's text box. */
        val facetText: FloatArray? get() = frame.text.takeIf { recipe != null && kotlin.math.abs(recipe.pat - dev.cardstashy.nativeplay.foil.MtgFoil.FACET) < .5f }
    }

    /** The finish a printing is shown in: the one asked for when the printing comes in it, else the one it does come in, so a
     *  foil-only printing opens in its foil (Randall 5 Nov, Omnipresence FRA #459) even from a copy not marked holo. */
    fun finishFor(card: JsonObject?, want: String): String {
        val have = card?.getAsJsonArray("finishes")?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }.orEmpty()
        if (have.isEmpty() || want in have) return want
        return listOf("nonfoil", "foil", "etched").firstOrNull { it in have } ?: want
    }

    fun look(data: CardData, card: JsonObject?, finish: String): Look {
        val p = data.profile(card, finish)
        val recipe = data.recipes[p.treatment]
        val frame = data.frames[CardData.frameKey(card)] ?: data.frames.getValue("2015")
        val label = when { recipe == null -> "Nonfoil"; p.name.isNotBlank() -> "${p.name} · shown with ${recipe.label.lowercase()}"; else -> recipe.label }
        val image = card?.let { c -> (c.get("image_uris") as? JsonObject ?: (c.getAsJsonArray("card_faces")?.firstOrNull() as? JsonObject)?.get("image_uris") as? JsonObject)?.get("normal")?.takeIf { it.isJsonPrimitive }?.asString }
        return Look(recipe, frame, CardData.holoStamp(card), label, image)
    }

    val supported: Boolean get() = Build.VERSION.SDK_INT >= 33 && !testFallback
    /** Robolectric has no runtime shaders: screenshots use the stand-in sheen. */
    @Volatile var testFallback = false
}

/**
 * Draws [look] over this card image. [tilt] is -1..1 on each axis (the phone's tilt, a drag on the card,
 * or the idle drift); reading it here only re-draws the layer, it never recomposes.
 */
fun Modifier.foil(look: Foil.Look, tilt: State<Offset>): Modifier = if (!look.shines) this else composed {
    val dens = LocalDensity.current.density
    if (Foil.supported) {
        val shader = remember { runCatching { RuntimeShader(Foil.AGSL) }.getOrNull() }
        // The printing's own inks, measured once off the main thread (MtgFoil); the foil draws at once and narrows to them when they land.
        val context = LocalContext.current
        val measured = look.measure
        val facetText = look.facetText
        val maps by remember(measured, facetText) { if (measured != null) dev.cardstashy.nativeplay.foil.FoilMaps.mtg(context.applicationContext, measured, facetText) else kotlinx.coroutines.flow.MutableStateFlow(null) }.collectAsState()
        val inputs = remember(maps) { maps?.let { dev.cardstashy.nativeplay.foil.FoilMaps.input(it.mask) to dev.cardstashy.nativeplay.foil.FoilMaps.input(it.relief) } ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank }
        // Drawn-line direction and facet shards (stand-ins until they land, or for a recipe that has none; the shader skips them then).
        val extra = remember(maps) { maps?.let { m -> (m.stroke?.let(dev.cardstashy.nativeplay.foil.FoilMaps::input) ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank.first) to
            (m.facet?.let(dev.cardstashy.nativeplay.foil.FoilMaps::input) ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank.second) } ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank }
        if (shader != null) return@composed this.graphicsLayer {
            val t by tilt
            val w = size.width; val h = size.height
            if (w > 0f && h > 0f) {
                val r = look.recipe
                shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_px", w / dens, h / dens)
                shader.setFloatUniform("u_tilt", t.x, t.y); shader.setFloatUniform("u_aspect", h / w); shader.setFloatUniform("u_on", if (r != null) 1f else 0f)
                shader.setFloatUniform("u_art", look.frame.art); shader.setFloatUniform("u_text", look.frame.text)
                shader.setFloatUniform("u_r1", r?.pat ?: 1f, r?.tint ?: 0f, r?.cover ?: 0f, r?.relief ?: 0f)
                shader.setFloatUniform("u_r2", r?.film ?: 0f, r?.sparkle ?: 0f, (r?.stamp?.takeIf { it > 0f }) ?: if (look.stamp) 2f else 0f, r?.keep ?: 0f)
                val m = maps
                shader.setInputShader("u_mask", inputs.first); shader.setInputShader("u_relief", inputs.second)
                shader.setInputShader("u_stroke", extra.first); shader.setInputShader("u_facet", extra.second)
                shader.setFloatUniform("u_map", (m?.mask?.width ?: 1).toFloat(), (m?.mask?.height ?: 1).toFloat()); shader.setFloatUniform("u_maps", if (m != null) 1f else 0f)
                renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
            }
        }
    }
    // Stand-in: the diagonal rainbow band that rolls with the light, and the silver oval stamp.
    this.drawWithContent {
        drawContent()
        val t = tilt.value
        if (look.recipe != null) {
            val shift = (t.x * .6f + t.y * .3f) * size.width
            val tint = when (look.recipe.tint) { 1f -> listOf(Color(0x00FFC86A), Color(0x88FFD98A), Color(0x00FFC86A)); 2f -> listOf(Color(0x00DDE6F2), Color(0x99EEF3FA), Color(0x00DDE6F2))
                else -> listOf(Color(0x00FF5A8C), Color(0x66FF6FA0), Color(0x66FFD36A), Color(0x667CFFB0), Color(0x6670C8FF), Color(0x66B58CFF), Color(0x00B58CFF)) }
            drawRect(Brush.linearGradient(tint, Offset(-size.width * .4f + shift, 0f), Offset(size.width * .9f + shift, size.height)), blendMode = BlendMode.Screen)
        }
        if (look.stamp) {
            val c = Offset(size.width * .5f, size.height * .925f)
            drawOval(Brush.linearGradient(listOf(Color(0xFFBFC6D0), Color(0xFFF4F6FA), Color(0xFF9EA8B6)), c - Offset(size.width * .03f, 0f), c + Offset(size.width * .03f, 0f)),
                topLeft = c - Offset(size.width * .03f, size.height * .012f), size = Size(size.width * .06f, size.height * .024f), alpha = .85f)
        }
    }
}


/** A card view (CardSheet) in front of a grid: while one is open the grid's foil tiles hold their light still, so the phone draws
 *  the shimmer only where you are looking. */
object FoilFocus {
    private var covers by androidx.compose.runtime.mutableIntStateOf(0)
    val covered: Boolean get() = covers > 0
    @Composable fun Cover() { androidx.compose.runtime.DisposableEffect(Unit) { covers++; onDispose { covers-- } } }
}

/** The light's drift when nothing tilts the card: a slow figure-eight, like the site's idle gallery shimmer. */
@Composable
fun rememberFoilTilt(live: Boolean = true, phase: Float = 0f, touch: State<Offset?>? = null, tile: Boolean = false): State<Offset> {
    val context = LocalContext.current
    val tiltOn = AppSettings.tilt
    // "Card lighting & foil effects" off: the light holds still (finish-preview.js setFinishEffects). A grid [tile] also holds
    // still while a card view covers it (FoilFocus), so only the card in front moves and redraws.
    @Suppress("NAME_SHADOWING") val live = live && AppSettings.finish && !(tile && FoilFocus.covered)
    val phone = if (live && tiltOn) rememberTilt() else null
    val clock = if (live && !Motion.still) androidx.compose.animation.core.rememberInfiniteTransition(label = "foil")
        .animateFloat(0f, 1f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(9000, easing = androidx.compose.animation.core.LinearEasing)), label = "drift") else null
    return remember(phone, clock, touch) {
        androidx.compose.runtime.derivedStateOf {
            touch?.value ?: run {
                val p = phone?.value
                val k = ((clock?.value ?: .18f) + phase) * 2f * Math.PI.toFloat()
                val idle = Offset(kotlin.math.sin(k) * .55f, kotlin.math.sin(k * 2f) * .25f)
                if (p != null && p.live) Offset(p.x * .9f, p.y * .9f) + idle * .25f else idle
            }
        }
    }
}
