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
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import kotlin.math.roundToInt
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.play.CardData

/**
 * Magic foil, the site's own: the first approved foil (test-fixtures/finish-effects/mtg-foil-first-approved.glsl, the shader behind
 * mtg-foil-shader.js) ported line for line to AGSL and drawn over the card image as a render effect, with the same recipe (pattern,
 * tint, coverage, relief, film, sparkle, stamp, keep) picked by mtgFoilProfile from the printing's Scryfall data and the same frame
 * boxes. Each card's inks and relief are measured from its own image like the site's worker (foil/MtgFoil.kt, analyzeMtgCard); until
 * that lands (a fraction of a second, once per card) covers read as the whole card. App only: facet foil (pattern 21). The holographic
 * security stamp, foil or not, is the site's (mtg-stamp.js): found on each card's own picture (foil/MtgStamp.kt, FoilMaps.stamp) and
 * drawn only there, through its measured outline; unmeasured, none. Below Android 13 a rainbow sheen stands in.
 */
object Foil {
    // Every constant follows the approved shader. pow(x, 2.) is written sq(x) (AGSL leaves pow undefined for negative bases), texture
    // reads become .eval, the site's global foil terms are inout parameters, and detail is faded by the card's device pixels (u_size).
    // scripts/check-foil-port.mjs draws this and the site's shader from the same inputs and compares them pixel by pixel.
    const val AGSL = """
uniform shader u_card;uniform shader u_mask;uniform shader u_relief;uniform shader u_stroke;uniform shader u_facet;uniform shader u_smask;
uniform float2 u_size;uniform float2 u_px;uniform float2 u_tilt;uniform float u_aspect;uniform float u_on;uniform float2 u_map;uniform float u_maps;
uniform float4 u_art;uniform float4 u_text;uniform float4 u_r1;uniform float4 u_r2;uniform float4 u_stamp;uniform float4 u_stampk;
const float PI=3.14159265;
float sq(float x){return x*x;}
float3 toLin(float3 c){return mix(c/12.92,pow((c+.055)/1.055,float3(2.4)),step(float3(.04045),c));}
float3 toSrgb(float3 c){return mix(c*12.92,1.055*pow(max(c,float3(0.)),float3(1./2.4))-.055,step(float3(.0031308),c));}
float hash(float2 p){p=fract(p*float2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float2 hash2(float2 p){return float2(hash(p),hash(p+17.31));}
float vnoise(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+float2(1.,0.)),f.x),mix(hash(i+float2(0.,1.)),hash(i+float2(1.,1.)),f.x),f.y);}
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
// Detail with this many repeats across the card's width is drawn only while a repeat covers a few pixels (device pixels).
float lod(float cycles){return smoothstep(2.,5.,u_size.x/cycles);}
// The colour a holographic sheet sends to the eye turns through the spectrum as the angle changes.
float3 hue(float t){return .5+.5*cos(6.2832*(t+float3(0.,.33,.67)));}
float3 film(float cosT,float t){float3 ph=4.*PI*1.45*t*cosT/float3(650.,532.,450.);return .5+.5*cos(ph);}
float3 shoulder(float3 x){float3 e=max(x-.8,0.);return min(x,.8)+.2*e/(e+.2);}
float3 voro(float2 q){float2 n=floor(q),f=fract(q);float d1=8.,d2=8.;float2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return float3(id,sqrt(d2)-sqrt(d1));}
// App only (facet shards and their cut edges): a diffraction grating's spectrum.
float3 spectrum(float l){float3 c=float3(exp(-sq((l-600.)/70.))+.35*exp(-sq((l-440.)/30.)),exp(-sq((l-540.)/60.)),exp(-sq((l-455.)/40.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
float3 spread(float s,float d){float3 c=float3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
float3 grating(float3 L,float3 V,float2 g,float d){return spread(abs(dot(L.xy+V.xy,g)),d);}
// Light the foil sheet sends back, relative to white paper (1.0). lq is where the light's glare sits on the
// card, near/wide how much key light reaches this spot (tight and broad), N the surface normal with relief.
// The site keeps amb, gloss, leak, top and glare in globals; here they are inout.
float3 foil(float pat,float tint,float2 uv,float2 lq,float3 L,float3 V,float3 N,float near,float wide,float2 grad,float height,
 inout float3 f_amb,inout float f_gloss,inout float f_leak,inout float3 f_top,inout float f_glare){
 float3 H=normalize(L+V);float2 q=float2(uv.x,uv.y*u_aspect),r=q-lq;float2 g=normalize(float2(.9,.44));
 float k=1.7,ph=0.,w=-1.,lines=1.,glint=0.,mirror=.5,ex=10.,amp=1.5,sat=.85,off=.55,spec=-1.,streak=.35,widen=0.;
 f_amb=float3(.93);f_gloss=1.;f_leak=.05;f_top=float3(0.);
 if(pat<1.5){}
 else if(pat<2.5){g=normalize(float2(.6,.8));k=1.25;mirror=.3;ex=6.;amp=1.35;sat=.9;streak=0.;widen=.45;f_amb=float3(.86);f_leak=.08;}
 else if(pat<3.5){g=float2(1.,0.);k=3.;mirror=1.;sat=.8;streak=0.;widen=.3;f_amb=float3(.86);f_gloss=1.8;f_leak=.08;
  spec=.7*exp(-sq(H.x/.05))+.3*exp(-sq(H.x/.2));}
 else if(pat<4.5){float fine=lod(260.);float3 c=voro(q*260.);float2 j=hash2(c.xy);float3 n=normalize(float3((j-.5)*.9,1.));
  float grain=pow(max(dot(n,H),0.),70.)*2.,haze=pow(max(dot(N,H),0.),5.)*.5;
  spec=mix(haze,grain*.75+haze*.45,fine);mirror=1.;amp=.18;sat=.3;streak=0.;widen=.5;f_amb=float3(.95);f_gloss=0.;f_leak=.03;}
 else if(pat<5.5){float gr=sin(height*55.);float2 gn=length(grad)>1e-4?normalize(grad):float2(1.,0.);
  ph=height*3.;N=normalize(N+float3(gn*cos(height*55.)*.05,0.));mirror=.5;ex=22.;amp=1.3;lines=.82+.18*gr;streak=0.;}
 else if(pat<6.5){float w1=sin(q.x*30.+sin(q.y*9.)*2.),w2=sin((q.x+q.y)*24.+sin(q.x*7.)*2.5);
  g=normalize(float2(.8,.6));k=2.2;ph=w1*.22+w2*.18;lines=.72+.28*w1*w2;amp=1.45;sat=.9;streak=0.;widen=.2;}
 else if(pat<7.5){}
 else if(pat<8.5){float2 c=q-float2(.5,.5*u_aspect);float rr=length(c),a=atan(c.y,c.x);
  float arc=sin(a*6.+rr*40.);k=1.2;ph=a/PI+rr*2.5+arc*.12;w=1.;lines=.62+.38*arc;amp=1.7;streak=0.;widen=.45;}
 else if(pat<9.5){float3 c=voro(q*30.);float2 j=hash2(c.xy);float on=step(.55,j.x)*smoothstep(0.,.05,c.z);
  ph=on*j.y;amp=mix(1.,1.9,on);sat=mix(.7,.95,on);streak=.3*(1.-on);
  glint=on*pow(max(dot(normalize(float3((j-.5)*.7,1.)),H),0.),40.)*.6;}
 else if(pat<10.5){g=float2(1.,0.);k=5.5;amp=1.8;sat=.95;streak=.15;widen=.5;}
 else if(pat<11.5){float3 c=voro(q*24.);float2 j=hash2(c.xy);float3 fn=normalize(float3((j-.5)*.55,1.));
  float fine=lod(48.),edge=1.-smoothstep(0.,.06,c.z);ph=j.y*.7*fine;
  spec=mix(pow(max(dot(N,H),0.),8.)*.5,pow(max(dot(fn,H),0.),46.)*1.5,fine);glint=edge*fine*pow(max(dot(fn,H),0.),12.)*.3;mirror=1.;amp=.9;sat=.75;streak=0.;widen=.4;}
 else if(pat<12.5){float2 c=q-float2(.5,.42*u_aspect);float rr=length(c);
  k=.8;ph=rr*5.;w=1.;lines=mix(.9,.8+.2*sin(rr*170.),lod(54.));streak=0.;widen=.3;}
 else if(pat<13.5){float2 p=q*float2(9.,9.),c=floor(p),f=fract(p)-.5;float rr=length(f),fine=lod(60.);
  float ring=1.-smoothstep(.02,.05,abs(rr-.32)),pip=0.;for(int i=0;i<5;i++){float ak=float(i)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.04,.07,length(f-.16*float2(cos(ak),sin(ak)))));}
  float disc=1.-smoothstep(.3,.34,rr),sym=max(ring,pip)*fine;g=float2(1.,0.);k=2.;ph=(hash(c+3.1)-.5)*.6*disc*fine;lines=1.+.22*disc*fine;
  glint=sym*(.25+pow(max(dot(N,H),0.),6.)*.7);streak=.15;widen=.25;}
 else if(pat<14.5){float2 p=q*float2(16.,22.);float row=floor(p.y);p.x+=mod(row,2.)*.5;float2 f=fract(p)-float2(.5,0.);
  float sc=length(f*float2(1.,1.3)),fine=lod(32.);N=normalize(N+float3(f*float2(.6,.4),0.)*fine);ph=sc*.8*fine;lines=1.-.45*smoothstep(.4,.5,sc)*fine;glint=fine*smoothstep(.3,.45,sc)*(1.-smoothstep(.45,.5,sc))*pow(max(dot(N,H),0.),6.)*.3;mirror=.6;ex=14.;streak=0.;widen=.3;}
 else if(pat<15.5){g=float2(.3,.95);k=2.8;amp=1.8;sat=.95;widen=.5;lines=mix(.95,.88+.12*sin(q.y*PI*2.*95.),lod(190.));}
 else if(pat<16.5){float2 p=q*14.,f=fract(p)-.5;float dm=abs(f.x)+abs(f.y);
  f_top=float3((smoothstep(.34,.36,dm)-smoothstep(.42,.44,dm))*lod(56.)*pow(max(dot(N,H),0.),22.)*.5);}
 else if(pat<17.5){}
 else if(pat<18.5){mirror=1.;ex=12.;amp=.45;sat=.35;streak=.1;widen=.3;f_amb=float3(.9);f_leak=.1;}
 else if(pat<19.5){f_gloss=1.35;}
 else if(pat<20.5){g=float2(.3,.95);k=1.9;lines=mix(.86,.72+.28*sin(q.y*PI*2.*80.),lod(160.));streak=0.;}
 else if(pat<21.5){k=2.4;amp=1.;mirror=.3;} // facet (app only): a finer, quieter sheet behind the shards, so they pop off it
 else{float2 p=q*float2(4.,5.3);p.x+=mod(floor(p.y),2.)*.5;float2 c=floor(p),m=(fract(p)-.5)/float2(4.,5.3);
  float ring=abs(length(m)-.024)-.0055,bar=max(abs(m.x)-.005,abs(m.y)-.043);float sym=(1.-smoothstep(0.,.004,min(ring,bar)))*lod(45.);
  float2 mc=(c+.5-float2(mod(c.y,2.)*.5,0.))/float2(4.,5.3)-lq;float band=exp(-dot(mc,mc)/.22)*smoothstep(.03,.12,length(mc)+.05*hash(c));
  f_top=sym*hue(mc.y*2.4+mc.x*.5+.3)*band*1.25;}
 float along=dot(r,g);
 float fs=lod(45.)*streak,n=vnoise(float2(dot(q,g)*45.,dot(q,float2(-g.y,g.x))*6.));
 if(w<0.)w=smoothstep(.05,.22,abs(along));
 float t=abs(along)*k+ph+(n-.5)*fs+dot(N.xy,g)*2.;
 float3 rb=mix(float3(1.),hue(t),sat);
 if(pat>9.5&&pat<10.5)rb=.5*(rb+mix(float3(1.),hue(abs(dot(r,normalize(float2(-.5,.86))))*4.5),sat))*1.1;
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
 float3 metal=tint<.5?float3(1.):tint<1.5?float3(1.,.78,.4):float3(.9,.93,.98);
 float3 col=w*amp*(rb-off)*(1.+1.2*(n-.5)*fs);
 if(tint>.5)col=metal*w*amp*(.25+.3*dot(rb,float3(.333)))+col*.3*step(1.5,tint);
 float env=mix(near,wide,widen);
 f_amb*=metal;f_glare=near*mirror*spec;
 return f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines;
}
// The security stamp's pastel rainbow (finish-effects.css .finish-holostamp): #ff8fc7 #ffd98a #9dffcf #8fdcff #bfa2ff, repeating.
float3 pastel(float i){float m=mod(i,5.);return m<.5?float3(1.,.5608,.7804):m<1.5?float3(1.,.851,.5412):m<2.5?float3(.6157,1.,.8118):m<3.5?float3(.5608,.8627,1.):float3(.749,.6353,1.);}
float shootingStar(float2 uv){float2 c=float2(u_text.x+.035,u_text.w-.03),d=(uv-c)*float2(1.,u_aspect);
 float star=max(0.,1.-(abs(d.x)+abs(d.y))*95.)+max(0.,1.-length(d)*140.);
 float2 t=d;float arc=.004*sin(clamp(t.x*40.,0.,PI));float tail=step(0.,t.x)*step(t.x,.05)*smoothstep(.0022,0.,abs(t.y+arc))*(1.-t.x*20.);
 return clamp(star*2.+tail,0.,1.);}
half4 main(float2 fc){
 half4 src=u_card.eval(fc);float a=float(src.a);if(a<.002)return src;
 float2 uv=fc/u_size;float3 base=toLin(clamp(float3(src.rgb)/a,0.,1.));
 float art=inBox(uv,u_art),text=inBox(uv,u_text);
 float2 lp=float2(.5,.45)+u_tilt*.6;float3 P=float3(uv.x,uv.y*u_aspect,0.);float2 lq=float2(lp.x,lp.y*u_aspect);
 float3 L=normalize(float3(lq,.85)-P),V=normalize(float3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 // How much key light reaches this spot: a tight share for the glare, a broad one for hazy sheets.
 float2 dl=P.xy-lq;float near=exp(-dot(dl,dl)/.3),wide=.3+.7*exp(-dot(dl,dl)/1.1);
 // Measured maps (MtgFoil): mask R gold ink, G neon ink, B bare paper; relief R height, G drawn lines, B facet cut edge.
 // Until they land (u_maps 0) the covers read as the whole card and the relief as flat.
 float2 mp=uv*u_map;half4 mk=u_mask.eval(mp),rl=u_relief.eval(mp);
 float hx=float(u_relief.eval(mp+float2(2.,0.)).r-u_relief.eval(mp-float2(2.,0.)).r),hy=float(u_relief.eval(mp+float2(0.,2.)).r-u_relief.eval(mp-float2(0.,2.)).r);
 float2 grad=float2(hx,hy)*u_maps;float height=float(rl.r)*u_maps;
 float rel=u_r1.w*(1.-.7*text);float3 N=normalize(float3(-grad*rel*9.,1.));
 float pat=u_r1.x,tint=u_r1.y,mode=u_r1.z;
 // Where the foil shows: whole card; frame only (etched art is printed on white); or one ink.
 float cov=1.;
 if(mode>.5&&mode<1.5)cov=1.-art;else if(mode>1.5&&mode<2.5)cov=mix(1.,float(mk.r),u_maps);else if(mode>3.5&&mode<4.5)cov=mix(1.,float(mk.b),u_maps);else if(mode>4.5&&mode<5.5)cov=mix(1.,float(rl.g),u_maps);
 if(mode>1.5&&(mode<2.5||(mode>3.5&&mode<5.5)))cov*=1.-text;
 // Facet foil (app only, MtgFoil.facets): R the shard's tilt seed, G the matte figure (printed without foil), B the shard.
 half4 fm=half4(0.);bool facet=pat>20.5&&pat<21.5;if(facet){if(u_maps>.5)fm=u_facet.eval(mp);cov*=(1.-text)*(1.-float(fm.g));}
 float3 f_amb=float3(.93);float f_gloss=1.,f_leak=.05,f_glare=0.;float3 f_top=float3(0.);
 float3 F=foil(pat,tint,uv,lq,L,V,N,near,wide,grad,height,f_amb,f_gloss,f_leak,f_top,f_glare);
 float3 outC=base;
 if(u_on>.5){
  // Gold stamped on top of a foil card (gilded): the stamp is its own raised gold metal, the rest stays foil.
  if(mode>5.5){float3 amb=f_amb,tp=f_top;float gl=f_gloss,lk=f_leak;float3 G=foil(18.,1.,uv,lq,L,V,N,near,wide,grad,height,f_amb,f_gloss,f_leak,f_top,f_glare);float s=smoothstep(.25,.6,float(mk.r))*u_maps*(1.-text);
   F=mix(F,G*1.1,s);f_amb=mix(amb,f_amb,s);f_gloss=mix(gl,1.6,s);f_leak=mix(lk,.3,s);f_top=tp;}
  // Thin film replaces the sheet's colour (oil slick): colour depends on view angle and film thickness.
  if(u_r2.x>.5){float t=320.+260.*height+120.*hash(floor(uv*float2(120.,168.)));float3 f=film(dot(N,V),t);f_amb=float3(.2);F=f*(.2+wide*(1.1*pow(max(dot(N,H),0.),16.)+.45));}
  // Ink over metal: light ink lets the lit foil through, dark ink hides it; the darkest ink still passes a faint glint of the highlight.
  float keep=u_r2.w,c=clamp(cov*(1.-keep),0.,1.);
  float lum=dot(base,float3(.2126,.7152,.0722)),top=max(base.r,max(base.g,base.b)),vis=mix(.25,1.,smoothstep(.01,.3,lum));
  if(u_r2.x>.5||tint>.5)vis=1.;
  float3 Fv=f_amb+(F-f_amb)*vis;
  float3 lit=base*(1.+.1*(1.-base))*Fv+(1.-top)*f_leak*(f_glare*2.+.5*near)*f_amb;
  outC=mix(base,shoulder(lit),c);
  // Raised relief: glossy rims where the embossed height turns toward the light.
  if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.3+.7*near)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*float3(1.,.97,.92)*rim*rel*cov*.6;}
  // Facet foil (app only): each printed glass shard is a flat mirror with its own fixed tilt; it flashes in one piece and its
  // printed neon outline is a cut edge that throws the rainbow along the line. The tilt seed is read at its texel's centre.
  if(facet&&u_maps>.5){float shard=float(fm.b);
   if(shard>.004){float sd=float(u_facet.eval(floor(mp)+.5).r);float2 j=float2(sd,fract(sd*7.31+.17));float3 fn=normalize(float3((j-.5)*1.1,1.));float nh=max(dot(fn,H),0.);
    float flash=pow(nh,22.),sheen=pow(nh,8.);float3 fc2=grating(L,V,normalize(float2(cos(j.x*PI),sin(j.x*PI))),1100.+j.y*900.);
    float yb=dot(base,float3(.2126,.7152,.0722));
    float3 face=base*(.68+.5*sheen+1.6*flash*(.4+.6*near))+fc2*sheen*(.6+.9*near)*(.25+.75*smoothstep(.03,.3,yb))+float3(.86,.93,1.)*flash*.12*near*smoothstep(.05,.4,yb);
    outC=mix(outC,clamp(shoulder(face),base*mix(.68,.93,smoothstep(.18,.4,yb)),max(base,float3(.96))),smoothstep(0.,.35,shard));}
   float edge=float(rl.b);
   if(edge>.004){half4 st=u_stroke.eval(mp);float2 sd=float2(st.rg)*2.-1.;float th=.5*atan(sd.y,sd.x);
    float3 ge=grating(L,V,float2(cos(th),sin(th)),1300.)*1.2*(.45+.8*near);outC=mix(outC,shoulder(outC+ge),edge);}}
  // Galaxy / surge sparks: a few large stars and many fine ones; the fine ones only at sizes that can show them.
  if(u_r2.y>0.){for(int i=0;i<2;i++){float n=i==0?26.:70.,fade=i==0?1.:lod(70.);float2 sq2=float2(uv.x,uv.y*u_aspect)*n,sc=floor(sq2);float2 j=hash2(sc+float(i)*9.);float on=step(1.-(i==0?.1:.2)*u_r2.y,j.x);
   float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sq2)-.2-.6*hash2(sc*1.3)));
   float tw=pow(max(dot(normalize(float3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=(1.-outC)*on*pt*fade*(.1+tw*1.6)*cov*(.4+.6*near)*float3(1.,.97,.9);}}
  // Fluorescent ink glows under any light, on top of its foil.
  if(mode>2.5&&mode<3.5)outC+=base*float(mk.g)*.4*(.6+.4*near)*u_maps;
  if(u_r2.z>.5&&u_r2.z<1.5){float s=shootingStar(uv);outC=mix(outC,shoulder(F*float3(.95,.97,1.)*1.1+float3(.08)),s*.85);}
  // Marks pressed on top of the ink show over any ink.
  outC+=(1.-outC)*f_top;
  // Varnish: one clear coat over the whole face (not on metal-ink etched cards) returns a small white gloss.
  float coat=pow(max(dot(N,H),0.),60.)*.05*f_gloss;
  outC+=(1.-outC)*coat*mix(.35,1.,c);
  outC=clamp(outC,0.,1.);
 }
 // Magic's holographic security stamp, foil or not (mtg-stamp.js, finish-effects.css .finish-holostamp): only inside the box measured on
 // this picture (u_stamp: left, top, width, height of the card; width 0 = not measured or none printed, nothing drawn), through its
 // measured mask (u_smask R, u_stampk.xy its size), so colour lands on the silver and the printed lines stay dark. A pastel rainbow
 // (112deg, 320%) and a white glint (100deg, 260%, .55) placed by the light: u_tilt is already the light as -1..1 ((mx - .5) * 2,
 // CardLean.light, CardZoom), so P = .5 + u_tilt * .5 is the site's --mx/--my itself (a finger: its position; the phone: 50% + tilt 45%);
 // never running alone, laid over at u_stampk.z (.6 plain, .5 on a foil) in sRGB like the page.
 if(u_stamp.z>0.){float2 s=(uv-u_stamp.xy)/u_stamp.zw;
  if(s.x>=0.&&s.y>=0.&&s.x<=1.&&s.y<=1.){float m=float(u_smask.eval(s*u_stampk.xy).r);
   if(m>.002){float2 bp=u_stamp.zw*u_size,P=clamp(float2(.5)+u_tilt*.5,0.,1.);
    float t=dot((s+2.2*P)*bp-1.6*bp,float2(.92718,.37461))/(3.2*(bp.x*.92718+bp.y*.37461))+.5;
    float f=clamp(t,0.,1.)*10.,i=min(floor(f),9.);float3 rb=mix(pastel(i),pastel(i+1.),f-i);
    float t2=dot(float2((s.x+1.6*P.x-1.3)*bp.x,(s.y-.5)*bp.y),float2(.98481,.17365))/(2.6*bp.x*.98481+bp.y*.17365)+.5;
    float g=clamp(1.-abs(t2-.5)/.1,0.,1.)*.55;
    outC=toLin(mix(toSrgb(clamp(outC,0.,1.)),mix(rb,float3(1.),g),m*u_stampk.z));}}}
 return half4(half3(toSrgb(clamp(outC,0.,1.))*a),half(a));
}
"""

    /** What one card face wears: the recipe for its finish (null = nonfoil), the frame boxes and the holo stamp. */
    /** [walker]: a planeswalker in the modern frame, whose 3D window is measured from its picture (foil/DepthLayer.kt). */
    data class Look(val recipe: CardData.Recipe?, val frame: CardData.Frame, val stamp: Boolean, val label: String, val image: String? = null,
                    val walker: Boolean = false) {
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

    /** [shown]: the picture on screen ("normal" image URL) when the view can flip a two-faced card: the Look, its 3D layers and the
     *  planeswalker check then follow that face. Null or no match = the front. */
    fun look(data: CardData, card: JsonObject?, finish: String, shown: String? = null): Look {
        val p = data.profile(card, finish)
        val recipe = data.recipes[p.treatment]
        val frame = data.frames[CardData.frameKey(card)] ?: data.frames.getValue("2015")
        val label = when { recipe == null -> "Nonfoil"; p.name.isNotBlank() -> "${p.name} · shown with ${recipe.label.lowercase()}"; else -> recipe.label }
        fun normal(o: JsonObject?) = (o?.get("image_uris") as? JsonObject)?.get("normal")?.takeIf { it.isJsonPrimitive }?.asString
        val faces = card?.getAsJsonArray("card_faces")?.mapNotNull { it as? JsonObject }.orEmpty()
        val face = faces.firstOrNull { shown != null && normal(it) == shown } ?: faces.firstOrNull()
        val image = normal(card) ?: normal(face)
        // The face shown decides: a transform card such as Ajani, Nacatl Pariah (MH3 237) joins both types at the top
        // ("Creature // Planeswalker") while its front picture is the creature, which must not get a planeswalker's window.
        val type = face?.get("type_line")?.takeIf { it.isJsonPrimitive }?.asString ?: card?.get("type_line")?.takeIf { it.isJsonPrimitive }?.asString ?: ""
        val walker = "Planeswalker" in type && CardData.frameKey(card) == "2015" // frameKey says "borderless" for borderless and full arts
        return Look(recipe, frame, CardData.holoStamp(card), label, image, walker)
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
    val context = LocalContext.current
    // The security stamp, measured once on this picture off the main thread (FoilMaps.stamp); until it lands, or when the picture shows
    // none that can be read, no stamp is drawn (Randall 15 Nov, Torrential Gearhulk KLD 67: a fixed oval sat half over the printed stamp).
    val stampImage = look.image?.takeIf { look.stamp }
    val stamp by remember(stampImage) { if (stampImage != null) dev.cardstashy.nativeplay.foil.FoilMaps.stamp(context.applicationContext, stampImage) else kotlinx.coroutines.flow.MutableStateFlow(null) }.collectAsState()
    val stampOpacity = if (look.recipe != null) .5f else .6f
    if (Foil.supported) {
        val shader = remember { runCatching { RuntimeShader(Foil.AGSL) }.getOrNull() }
        // The printing's own inks, measured once off the main thread (MtgFoil); the foil draws at once and narrows to them when they land.
        val measured = look.measure
        val facetText = look.facetText
        val maps by remember(measured, facetText) { if (measured != null) dev.cardstashy.nativeplay.foil.FoilMaps.mtg(context.applicationContext, measured, facetText) else kotlinx.coroutines.flow.MutableStateFlow(null) }.collectAsState()
        val inputs = remember(maps) { maps?.let { dev.cardstashy.nativeplay.foil.FoilMaps.input(it.mask) to dev.cardstashy.nativeplay.foil.FoilMaps.input(it.relief) } ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank }
        // Drawn-line direction and facet shards (stand-ins until they land, or for a recipe that has none; the shader skips them then).
        val extra = remember(maps) { maps?.let { m -> (m.stroke?.let(dev.cardstashy.nativeplay.foil.FoilMaps::input) ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank.first) to
            (m.facet?.let(dev.cardstashy.nativeplay.foil.FoilMaps::input) ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank.second) } ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank }
        val stampIn = remember(stamp) { stamp?.let { dev.cardstashy.nativeplay.foil.FoilMaps.input(it.mask) } ?: dev.cardstashy.nativeplay.foil.FoilMaps.blank.first }
        if (shader != null) return@composed this.graphicsLayer {
            val t by tilt
            val w = size.width; val h = size.height
            if (w > 0f && h > 0f) {
                val r = look.recipe
                shader.setFloatUniform("u_size", w, h); shader.setFloatUniform("u_px", w / dens, h / dens)
                shader.setFloatUniform("u_tilt", t.x, t.y); shader.setFloatUniform("u_aspect", h / w); shader.setFloatUniform("u_on", if (r != null) 1f else 0f)
                shader.setFloatUniform("u_art", look.frame.art); shader.setFloatUniform("u_text", look.frame.text)
                shader.setFloatUniform("u_r1", r?.pat ?: 1f, r?.tint ?: 0f, r?.cover ?: 0f, r?.relief ?: 0f)
                shader.setFloatUniform("u_r2", r?.film ?: 0f, r?.sparkle ?: 0f, r?.stamp ?: 0f, r?.keep ?: 0f)
                val st = stamp
                shader.setInputShader("u_smask", stampIn)
                shader.setFloatUniform("u_stamp", st?.box ?: FloatArray(4))
                shader.setFloatUniform("u_stampk", (st?.mask?.width ?: 1).toFloat(), (st?.mask?.height ?: 1).toFloat(), stampOpacity, 0f)
                val m = maps
                shader.setInputShader("u_mask", inputs.first); shader.setInputShader("u_relief", inputs.second)
                shader.setInputShader("u_stroke", extra.first); shader.setInputShader("u_facet", extra.second)
                shader.setFloatUniform("u_map", (m?.mask?.width ?: 1).toFloat(), (m?.mask?.height ?: 1).toFloat()); shader.setFloatUniform("u_maps", if (m != null) 1f else 0f)
                renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "u_card").asComposeRenderEffect()
            }
        }
    }
    // Stand-in: the diagonal rainbow band that rolls with the light, and the measured security stamp (none until measured).
    val stampArt = remember(stamp) { stamp?.let { it.alpha.asImageBitmap() } }
    this.drawWithContent {
        drawContent()
        val t = tilt.value
        if (look.recipe != null) {
            val shift = (t.x * .6f + t.y * .3f) * size.width
            val tint = when (look.recipe.tint) { 1f -> listOf(Color(0x00FFC86A), Color(0x88FFD98A), Color(0x00FFC86A)); 2f -> listOf(Color(0x00DDE6F2), Color(0x99EEF3FA), Color(0x00DDE6F2))
                else -> listOf(Color(0x00FF5A8C), Color(0x66FF6FA0), Color(0x66FFD36A), Color(0x667CFFB0), Color(0x6670C8FF), Color(0x66B58CFF), Color(0x00B58CFF)) }
            drawRect(Brush.linearGradient(tint, Offset(-size.width * .4f + shift, 0f), Offset(size.width * .9f + shift, size.height)), blendMode = BlendMode.Screen)
        }
        val st = stamp; val art = stampArt
        if (st != null && art != null) {
            // finish-effects.css .finish-holostamp: the mask's outline, a pastel rainbow (112deg, 320%) and a white glint (100deg, 260%)
            // placed by the light (the site's --mx/--my: tilt is already the light as -1..1), the whole at .6 (.5 on a foil).
            val bx = st.box[0] * size.width; val by = st.box[1] * size.height; val bw = st.box[2] * size.width; val bh = st.box[3] * size.height
            val px = (.5f + t.x * .5f).coerceIn(0f, 1f); val py = (.5f + t.y * .5f).coerceIn(0f, 1f)
            drawIntoCanvas { it.saveLayer(Rect(bx, by, bx + bw, by + bh), Paint().apply { alpha = stampOpacity }) }
            drawImage(art, srcOffset = IntOffset.Zero, srcSize = IntSize(art.width, art.height), dstOffset = IntOffset(bx.roundToInt(), by.roundToInt()),
                dstSize = IntSize(bw.roundToInt().coerceAtLeast(1), bh.roundToInt().coerceAtLeast(1)))
            val c1 = Offset(bx + (1.6f - 2.2f * px) * bw, by + (1.6f - 2.2f * py) * bh); val l1 = 3.2f * (bw * .92718f + bh * .37461f) / 2f
            drawRect(Brush.linearGradient(STAMP_RAINBOW, c1 - Offset(.92718f, .37461f) * l1, c1 + Offset(.92718f, .37461f) * l1), Offset(bx, by), Size(bw, bh), blendMode = BlendMode.SrcIn)
            val c2 = Offset(bx + (1.3f - 1.6f * px) * bw, by + .5f * bh); val l2 = (2.6f * bw * .98481f + bh * .17365f) / 2f
            drawRect(Brush.linearGradient(.4f to Color.White.copy(alpha = 0f), .5f to Color.White, .6f to Color.White.copy(alpha = 0f), start = c2 - Offset(.98481f, .17365f) * l2, end = c2 + Offset(.98481f, .17365f) * l2),
                Offset(bx, by), Size(bw, bh), alpha = .55f, blendMode = BlendMode.SrcAtop)
            drawIntoCanvas { it.restore() }
        }
    }
}


/** A list or grid tile's light (finish-preview.js on a thumbnail): a foil shimmers on its own; a nonfoil card shines only through its
 *  security stamp, which holds still at the centre (the site's --mx/--my 50%) and never drifts by itself. */
@Composable
fun rememberTileTilt(look: Foil.Look, phase: Float): State<Offset> =
    rememberFoilTilt(live = look.recipe != null, phase = phase, tile = true, rest = if (look.recipe == null) Offset.Zero else null)

/** The security stamp's pastel rainbow (finish-effects.css .finish-holostamp), its 11 stops. */
private val STAMP_RAINBOW = listOf(0xFFFF8FC7, 0xFFFFD98A, 0xFF9DFFCF, 0xFF8FDCFF, 0xFFBFA2FF).let { c -> List(11) { Color(c[it % 5]) } }

/** A card view (CardSheet) in front of a grid: while one is open the grid's foil tiles hold their light still, so the phone draws
 *  the shimmer only where you are looking. */
object FoilFocus {
    private var covers by androidx.compose.runtime.mutableIntStateOf(0)
    val covered: Boolean get() = covers > 0
    @Composable fun Cover() { androidx.compose.runtime.DisposableEffect(Unit) { covers++; onDispose { covers-- } } }
}

/** The light's drift when nothing tilts the card: a slow figure-eight, like the site's idle gallery shimmer. [rest]: where the light
 *  sits when nothing moves it (not live, no finger, no phone); a nonfoil card whose only shine is its security stamp passes
 *  Offset.Zero, the site's --mx/--my 50% (finish-effects.css .finish-holostamp never runs alone). */
@Composable
fun rememberFoilTilt(live: Boolean = true, phase: Float = 0f, touch: State<Offset?>? = null, tile: Boolean = false, rest: Offset? = null): State<Offset> {
    val context = LocalContext.current
    val tiltOn = AppSettings.tilt
    // "Card lighting & foil effects" off: the light holds still (finish-preview.js setFinishEffects). A grid [tile] also holds
    // still while a card view covers it (FoilFocus), so only the card in front moves and redraws.
    @Suppress("NAME_SHADOWING") val live = live && AppSettings.finish && !(tile && FoilFocus.covered)
    val phone = if (live && tiltOn) rememberTilt() else null
    val clock = if (live && !Motion.still) androidx.compose.animation.core.rememberInfiniteTransition(label = "foil")
        .animateFloat(0f, 1f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(9000, easing = androidx.compose.animation.core.LinearEasing)), label = "drift") else null
    return remember(phone, clock, touch, rest) {
        androidx.compose.runtime.derivedStateOf {
            touch?.value ?: run {
                if (rest != null && clock == null && phone == null) return@run rest
                val p = phone?.value
                val k = ((clock?.value ?: .18f) + phase) * 2f * Math.PI.toFloat()
                val idle = Offset(kotlin.math.sin(k) * .55f, kotlin.math.sin(k * 2f) * .25f)
                if (p != null && p.live) Offset(p.x * .9f, p.y * .9f) + idle * .25f else idle
            }
        }
    }
}
