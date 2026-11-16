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
    // The site's foil shader (mtg-foil-shader.js), as the site composes it: AGSL_TEMPLATE is MTG_FOIL_TEMPLATE written by
    // scripts/gen-foil-agsl.mjs (GLSL vector names as AGSL's, the one texture read as a map read; never edit it by hand), and
    // [compose] runs the site's composeFoil rules, so each foil type compiles only its own lines, exactly as on the site.
    // AGSL_HEAD and AGSL_MAIN are the app's own: the maps' layout on Android (opaque bitmaps), the card's alpha, the maps fading in
    // when they land, and the security stamp. scripts/check-foil-port.mjs draws every foil type here and on the site from the same
    // card and maps and compares them pixel by pixel.
    const val AGSL_HEAD = """
uniform shader u_card;uniform shader u_mask;uniform shader u_relief;uniform shader u_stroke;uniform shader u_smask;
uniform float2 u_size;uniform float2 u_px;uniform float2 u_tilt;uniform float u_aspect;uniform float u_on;uniform float2 u_map;uniform float u_maps;
uniform float4 u_art;uniform float4 u_text;uniform float4 u_r1;uniform float4 u_r2;uniform float3 u_star;uniform float4 u_stamp;uniform float4 u_stampk;
"""
    const val AGSL_TEMPLATE = """
const float PI=3.14159265;
float3 f_amb;float f_gloss;float f_leak;float3 f_top;float f_glare;float f_ac;float f_zone;float f_x0;float3 f_add;float f_et;float f_ink;
// How strongly the foil shows: between the preview's Soft and Natural for every type; oil slick goes past Natural.
float strength(){return u_r2.x>.5?.9:.5;}
float3 toLin(float3 c){return mix(c/12.92,pow((c+.055)/1.055,float3(2.4)),step(float3(.04045),c));}
float3 toSrgb(float3 c){return mix(c*12.92,1.055*pow(max(c,float3(0.)),float3(1./2.4))-.055,step(float3(.0031308),c));}
float hash(float2 p){p=fract(p*float2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float2 hash2(float2 p){return float2(hash(p),hash(p+17.31));}
// x*x: pow(x,2.) is undefined for a negative x in GLSL and AGSL (phones and Skia may return nothing).
float sq(float x){return x*x;}
float vnoise(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+float2(1.,0.)),f.x),mix(hash(i+float2(0.,1.)),hash(i+float2(1.,1.)),f.x),f.y);}
float inBox(float2 p,float4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
// Detail with this many repeats across the card's width is drawn only while a repeat covers a few pixels.
float lod(float cycles){return smoothstep(2.,5.,u_px.x/cycles);}
// The colour a holographic sheet sends to the eye turns through the spectrum as the angle changes.
float3 hue(float t){return .5+.5*cos(6.2832*(t+float3(0.,.33,.67)));}
float3 film(float cosT,float t){float3 ph=4.*PI*1.45*t*cosT/float3(650.,532.,450.);return .5+.5*cos(ph);}
float3 shoulder(float3 x){float3 e=max(x-.8,0.);return min(x,.8)+.2*e/(e+.2);}
float softBox(float2 p,float4 b){float2 e=float2(.004,.003);float2 lo=smoothstep(b.xy-e,b.xy+e,p),hi=1.-smoothstep(b.zw-e,b.zw+e,p);return lo.x*lo.y*hi.x*hi.y*step(1e-4,b.z-b.x);}
float3 scales(float2 q){q.x+=q.y*.5;float2 n=floor(q),f=fract(q);float d1=8.,d2=8.;float2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y)),r=o+.5+(hash2(n+o)-.5)*.5-f;r.x-=r.y*.5;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return float3(id,sqrt(d2)-sqrt(d1));}
float seg(float2 p,float2 a,float2 b){float2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
float3 spectrum(float l){float a=(l-600.)/70.,b=(l-440.)/30.,c=(l-540.)/60.,d=(l-455.)/40.;return float3(exp(-a*a)+.35*exp(-b*b),exp(-c*c),exp(-d*d))*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
float3 grating(float3 L,float3 V,float2 g,float d){float s=abs(dot(L.xy+V.xy,g));return spectrum(d*s)+spectrum(d*s/2.)/2.+spectrum(d*s/3.)/3.;}
float3 voro(float2 q){float2 n=floor(q),f=fract(q);float d1=8.,d2=8.;float2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float2 o=float2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return float3(id,sqrt(d2)-sqrt(d1));}
// Light the foil sheet sends back, relative to white paper (1.0). lq is where the light's glare sits on the
// card, near/wide how much key light reaches this spot (tight and broad), N the surface normal with relief.
float3 foil(float pat,float tint,float2 uv,float2 lq,float3 L,float3 V,float3 N,float near,float wide,float2 grad,float height){
 float3 H=normalize(L+V);float2 q=float2(uv.x,uv.y*u_aspect),r=q-lq;float2 g=normalize(float2(.6,.8));
 // k colour turns per card width, ph extra turn, w how much colour (set <0 to fade it out inside the glare)
 float k=1.3,ph=0.,w=-1.,lines=1.,glint=0.,mirror=.32,ex=7.,amp=1.4,sat=.88,off=.55,spec=-1.,streak=0.,widen=0.;
 f_amb=float3(.93);f_gloss=1.;f_leak=.05;f_top=float3(0.);
 if(pat<1.5){}                                                                                  // traditional
#if PAT==2
 else if(pat<2.5){g=normalize(float2(.6,.8));k=1.25;mirror=.3;ex=6.;amp=1.35;sat=.9;streak=0.;widen=.45;f_amb=float3(.86);f_leak=.08;} // old border: hazy, strong, a darker card
#endif
#if PAT==3
 else if(pat<3.5){g=float2(1.,0.);k=3.;mirror=1.;sat=.8;streak=0.;widen=.3;f_amb=float3(.86);f_gloss=1.8;f_leak=.08;   // From the Vault: thick gloss, upright bars
  spec=.7*exp(-sq(H.x/.05))+.3*exp(-sq(H.x/.2));}
#endif
#if PAT==4
 else if(pat<4.5){float fine=lod(260.);float3 c=voro(q*260.);float2 j=hash2(c.xy);float3 n=normalize(float3((j-.5)*.9,1.)); // etched: metal ink grain, no laminate
  float grain=pow(max(dot(n,H),0.),40.)*2.2,haze=0.;float bz=min(1.,exp(-f_ac*f_ac/.05)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.04)),core=exp(-f_ac*f_ac/.014)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.01);f_et=.56+.6*bz+.75*core+grain*mix(.5,1.,fine)*(.12+.9*bz);f_add=float3(1.,.96,.88)*(core*.16+grain*fine*bz*.4);
  spec=mix(haze,grain*.75+haze*.45,fine);mirror=1.;amp=.18;sat=.3;streak=0.;widen=.5;f_amb=float3(.95);f_gloss=0.;f_leak=.03;}
#endif
#if PAT==5
 else if(pat<5.5){float fine=lod(120.),hh=height*85.+vnoise(q*6.)*3.;float2 gn=length(grad)>1e-4?normalize(grad):float2(1.,0.);float sl=cos(hh),side=dot(gn,normalize(u_tilt+float2(.3,-.4)))*sl;
  ph=height*2.4+side*.16*fine;N=normalize(N+float3(gn*sl*.07*fine,0.));mirror=.5;ex=16.;amp=1.75;sat=.95;k=1.5;lines=mix(1.,.86+.22*smoothstep(-.6,.8,sin(hh)),fine);glint=fine*smoothstep(.55,1.,side)*.22;}
#endif
#if PAT==6
 else if(pat<6.5){float w1=sin(q.x*30.+sin(q.y*9.)*2.),w2=sin((q.x+q.y)*24.+sin(q.x*7.)*2.5);      // surge: crossing waves
  g=normalize(float2(.8,.6));k=2.2;ph=w1*.22+w2*.18;lines=.72+.28*w1*w2;amp=1.45;sat=.9;streak=0.;widen=.2;}
#endif
#if PAT==7
 else if(pat<7.5){}                                                                              // galaxy: traditional + stars (sparkle)
#endif
#if PAT==8
 else if(pat<8.5){float2 c=q-float2(.5,.5*u_aspect);float rr=length(c),a=atan(c.y,c.x);              // halo: arcs wheeling round the centre
  float arc=sin(a*6.+rr*40.);k=1.2;ph=a/PI+rr*2.5+arc*.12;w=1.;lines=.62+.38*arc;amp=1.7;streak=0.;widen=.45;}
#endif
#if PAT==9
 else if(pat<9.5){float3 c=voro(q*30.);float2 j=hash2(c.xy);float on=step(.55,j.x)*smoothstep(0.,.05,c.z); // confetti
  ph=on*j.y;amp=mix(1.,1.9,on);sat=mix(.7,.95,on);streak=.3*(1.-on);
  glint=on*pow(max(dot(normalize(float3((j-.5)*.7,1.)),H),0.),40.)*.6;}
#endif
#if PAT==10
 else if(pat<10.5){g=float2(1.,0.);k=5.5;amp=1.8;sat=.95;streak=.15;widen=.5;}                    // double rainbow (second sheet below)
#endif
#if PAT==11
 else if(pat<11.5){float3 c=voro(q*24.);float2 j=hash2(c.xy);float3 fn=normalize(float3((j-.5)*.55,1.));   // fracture: small shards, each with its own tilt
  float fine=lod(48.),edge=1.-smoothstep(0.,.06,c.z);ph=j.y*.7*fine;
  spec=mix(pow(max(dot(N,H),0.),8.)*.5,pow(max(dot(fn,H),0.),46.)*1.5,fine);glint=edge*fine*pow(max(dot(fn,H),0.),12.)*.3;mirror=1.;amp=.9;sat=.75;streak=0.;widen=.4;}
#endif
#if PAT==12
 else if(pat<12.5){float2 c=q-float2(.5,.42*u_aspect);float rr=length(c);                             // ripple
  k=.8;ph=rr*3.;w=1.;amp=1.35;sat=.85;lines=mix(.95,.72+.36*smoothstep(-.2,.9,sin(rr*52.-dot(u_tilt,c)*14.)),lod(40.));streak=0.;widen=.3;}
#endif
#if PAT==13
 else if(pat<13.5){float2 p=q*float2(9.,9.),c=floor(p),f=fract(p)-.5;float rr=length(f),fine=lod(60.); // mana: discs with a mana mark, pressed into the sheet
  float ring=1.-smoothstep(.02,.05,abs(rr-.32)),pip=0.;for(int i=0;i<5;i++){float ak=float(i)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.04,.07,length(f-.16*float2(cos(ak),sin(ak)))));}
  float disc=1.-smoothstep(.3,.34,rr),sym=max(ring,pip)*fine;g=float2(1.,0.);k=2.;ph=(hash(c+3.1)-.5)*.6*disc*fine;lines=1.+.22*disc*fine;
  glint=sym*(.25+pow(max(dot(N,H),0.),6.)*.7);streak=.15;widen=.25;}
#endif
#if PAT==14
 else if(pat<14.5){float3 vc=scales(q*float2(19.,20.));float2 id=vc.xy;float fine=lod(42.),j=hash(id),net=(1.-smoothstep(.04,.15,vc.z))*fine,cell=(1.-net)*fine;
  float ly=(.45+u_tilt.y*.6)*u_aspect,dy=q.y-ly;
  float bz=min(1.,exp(-f_ac*f_ac/.035)+.45*exp(-(f_ac+.5)*(f_ac+.5)/.02))*(.12+.88*exp(-dy*dy/.22));
  float hot=smoothstep(.45+j*.35,.7+j*.35,bz),var=.6+.4*vnoise(q*8.+u_tilt*2.);
  ph=j*.2*fine;mirror=.6;ex=14.;amp=1.1;lines=1.-.3*cell*bz*(1.-hot);glint=net*bz*bz*.6;
  float b1=exp(-f_ac*f_ac/.0008),b2=exp(-(f_ac+.5)*(f_ac+.5)/.0006);
  f_top=float3(.92,.96,1.)*(net*(.02+bz*bz*.8*var)+cell*hot*.45)+(hue(f_ac*11.+.05)*b1+hue((f_ac+.5)*13.+.3)*b2*.6)*.45;}
#endif
#if PAT==15
 else if(pat<15.5){g=float2(.3,.95);k=2.8;amp=1.8;sat=.95;widen=.5;lines=mix(.95,.88+.12*sin(q.y*PI*2.*95.),lod(190.));} // rainbow foil: more colour at every angle
#endif
#if PAT==16
 else if(pat<16.5){float2 p=q*14.,f=fract(p)-.5;float dm=abs(f.x)+abs(f.y);                       // invisible ink: clear pattern seen only in the reflection
  f_top=float3((smoothstep(.34,.36,dm)-smoothstep(.42,.44,dm))*lod(56.)*pow(max(dot(N,H),0.),22.)*.5);}
#endif
#if PAT==17
 else if(pat<17.5){}                                                                             // raised / embossed: traditional + relief
#endif
#if PAT==18||COVER==6
 else if(pat<18.5){mirror=1.;ex=12.;amp=.45;sat=.35;streak=.1;widen=.3;f_amb=float3(.9);f_leak=.1;float zb=min(1.,exp(-f_ac*f_ac/.07)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.05));glint=.7*zb;f_add=(tint>.5&&tint<1.5?float3(1.,.82,.46):float3(.9,.93,.98))*zb*.2;} // silver / gold mirror sheet
#endif
#if PAT==19
 else if(pat<19.5){f_gloss=1.6;amp=1.;sat=.8;mirror=.5;}                                                             // ampersand: the big & is already in the card picture; it sits under a glossier coat
#endif
#if PAT==20
 else if(pat<20.5){g=float2(.3,.95);k=1.9;lines=mix(.86,.72+.28*sin(q.y*PI*2.*80.),lod(160.));streak=0.;} // Vault Boy: CRT scanlines in the sheet
#endif
#if PAT==24
 else if(pat>23.5&&pat<24.5){float2 p=q*4.6,c=floor(p),f=fract(p)-.5;float2 j=hash2(c);float a=j.x*6.2832,ca=cos(a),sa=sin(a);f=float2(ca*f.x-sa*f.y,sa*f.x+ca*f.y)*1.2;
  float d=min(min(seg(f,float2(0.,-.08),float2(0.,.24))-.042,seg(f,float2(-.03,-.05),float2(-.16,.16))-.038),min(seg(f,float2(.03,-.05),float2(.16,.16))-.038,seg(f,float2(0.,-.1),float2(0.,-.22))-.035));
  float sym=(1.-smoothstep(-.012,.012,d))*step(.42,j.y)*lod(24.);float2 cc=(c+.5)/4.6;float am=dot(cc-float2(f_x0,.5*u_aspect),normalize(float2(1.,.22))),band=min(1.,exp(-am*am/.05)+.6*exp(-(am+.5)*(am+.5)/.035));
  f_top=sym*mix(float3(.9,.95,1.),hue(am*1.8+j.x+.2),.4)*(.05+.6*band);}
#endif
#if PAT==25
 else if(pat>24.5&&pat<25.5){float fine=lod(140.);float3 c=voro(q*70.);float2 j=hash2(c.xy);float3 fn=normalize(float3((j-.5)*.9,1.));float zb=min(1.,exp(-f_ac*f_ac/.06)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.04));
  ph=j.y*.8*fine;amp=1.2+.9*zb;sat=.95;k=1.5;glint=fine*pow(max(dot(fn,H),0.),24.)*1.1*zb;}
#endif
#if PAT==26
 else if(pat>25.5&&pat<26.5){float2 c=q-float2(.5,.36*u_aspect);float rr=length(c),a=atan(c.y,c.x),zb=min(1.,exp(-f_ac*f_ac/.05)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.035));
  k=.8;ph=a/PI*.5+rr*1.6;w=1.;amp=1.3;sat=.9;f_leak=0.;glint=.9*zb;mirror=.5;f_add=float3(.92,.94,1.)*zb*.34;}
#endif
#if PAT==27
 else if(pat>26.5&&pat<27.5){float3 c=voro(q*52.);float2 j=hash2(c.xy);float fine=lod(104.),on=step(.6,j.x)*smoothstep(0.,.08,c.z)*fine;
  ph=on*j.y;amp=mix(1.,1.8,on);sat=mix(.85,.95,on);glint=on*pow(max(dot(normalize(float3((j-.5)*1.1,1.)),H),0.),44.)*.9;}
#endif
#if PAT==28
 else if(pat>27.5&&pat<28.5){amp=1.75;sat=.95;k=1.5;}
#endif
#if PAT==29
 else if(pat>28.5){float3 vc=voro(float2x2(1.,.5,-.35,1.)*q*float2(26.,13.));float2 id=vc.xy,j=hash2(id);float3 fn=normalize(float3((j-.5)*1.4,1.));float fine=lod(26.),dark=step(hash(id+6.6),.18)*fine;
  ph=mix(.4,j.x<.82?.34+.16*j.y:j.y,fine);k=.3;w=1.;amp=2.2*(1.-dark)*mix(1.,.5+.9*hash(id+1.2),fine);sat=1.;off=.4;mirror=.9;spec=mix(pow(max(dot(N,H),0.),8.)*.5,pow(max(dot(fn,H),0.),12.)*1.4,fine)*(1.-dark);f_amb=float3(mix(.4,.05,dark));f_gloss=1.;}
#endif
#if PAT==23
 else if(pat>22.5){float fine=lod(120.),fib=sin(q.y*746.+sin(q.x*12.)*1.5),band=exp(-sq((q.x-f_x0)/.2))+.5*exp(-sq((q.x-f_x0+.55)/.16));
  mirror=.6;ex=5.;amp=.3;sat=.16;f_leak=.1;glint=band*(.95+.12*fib*fine);lines=1.+.04*fib*fine;f_add=float3(.95,.92,.86)*band*.2;}
#endif
#if PAT==21
 else if(pat<21.5){amp=1.;mirror=.3;}
#endif
#if PAT==22
 else{float2 p=q*float2(4.,5.3);p.x+=mod(floor(p.y),2.)*.5;float2 c=floor(p),m=(fract(p)-.5)/float2(4.,5.3);              // step-and-compleat: rows of the Phyrexian mark on top of the ink
  float ring=abs(length(m)-.024)-.0055,bar=max(abs(m.x)-.005,abs(m.y)-.043);float sym=(1.-smoothstep(0.,.004,min(ring,bar)))*lod(45.);
  float2 mcc=(c+.5-float2(mod(c.y,2.)*.5,0.))/float2(4.,5.3);float am=dot(mcc-float2(f_x0,.5*u_aspect),normalize(float2(1.,.22)));float2 mc=float2(am*.9,mcc.y*.35);float band=min(1.,exp(-am*am/.09)+.6*exp(-(am+.5)*(am+.5)/.06));
  f_top=sym*hue(mc.y*2.4+mc.x*.5+.3)*band*1.25;}
#endif
 float along=dot(r,g);
 // Fine dashes in the sheet, laid along the colour bands.
#if PAT==3
 float fs=lod(45.)*streak,n=vnoise(float2(dot(q,g)*45.,dot(q,float2(-g.y,g.x))*6.));
 if(w<0.)w=smoothstep(.05,.22,abs(along));
#else
 float fs=0.,n=.5;if(w<0.)w=smoothstep(0.,.3,abs(along));
#endif
 float t=abs(along)*k+ph+(n-.5)*fs+dot(N.xy,g)*2.;
 float3 rb=mix(float3(1.),hue(t),sat);
 if(pat>9.5&&pat<10.5)rb=.5*(rb+mix(float3(1.),hue(abs(dot(r,normalize(float2(-.5,.86))))*4.5),sat))*1.1;
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
 float3 metal=tint<.5?float3(1.):tint<1.5?float3(1.,.78,.4):float3(.9,.93,.98);
#if PAT==23
 metal=float3(.95,.92,.86);
#endif
#if FILM
 float3 col=w*amp*mix(.7,1.,strength())*(rb-off)*(1.+1.2*(n-.5)*fs);
 if(tint>.5)col=metal*w*amp*(.25+.3*dot(rb,float3(.333)))+col*.3*step(1.5,tint);
 float env=mix(wide,1.,near*.6);
 f_amb=max(f_amb,float3(1.));f_amb*=metal;f_glare=near*mirror*spec*.6;
 return f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines;
#elif PAT==4
 // Etched: no sheet at all. The metal ink only gets brighter or darker (f_et), in its own printed colour.
 f_amb=float3(1.);f_glare=0.;return float3(f_et);
#elif PAT==29
 // Emblem chips: dark metal that each chip lights in its own colour.
 float env=mix(wide,1.,near*.6);float3 o=f_amb*.45+env*rb*rb*amp*.8+spec*.7;f_amb=float3(1.);f_glare=0.;return o;
#elif PAT!=3
 // The soft sheet: wide slow colour over the whole sheet, a little stronger where the light is.
 float3 col=w*amp*mix(.7,1.,strength())*(rb-off);
 if(tint>.5)col=metal*w*amp*(.25+.3*dot(rb,float3(.333)))+col*.3*step(1.5,tint);
 float env=mix(wide,1.,near*.6);
#if PAT==1||PAT==2||PAT==10||PAT==15
 col*=mix(.3,1.,f_zone);  // out of the light a real foil is nearly a plain card
#endif
 f_amb=max(f_amb,float3(1.));f_amb*=metal;f_glare=near*mirror*spec*.6;
 return f_amb+env*(col*lines+glint*metal)+f_glare*metal*lines;
#else
 // From the Vault keeps the light-line model: relief and pressed patterns bend the light line, so each scale or groove catches it on its own.
 float a1=f_ac+dot(N.xy,float2(1.,.22))*.35+(lines-1.)*.02,a2=a1+.5;
 float s1=exp(-a1*a1/.012),s2=exp(-a2*a2/.009);
 // The spectrum runs across each line; the sheet's pattern (ph) shifts it, which is how the pattern shows.
 float3 h1=mix(float3(1.),hue(a1*4.2+ph+(n-.5)*fs),sat),h2=mix(float3(1.),hue(a2*4.8+.4+ph),sat);
 float3 sp=(h1-.45)*s1+(h2-.45)*s2*.5;
 float3 col=w*amp*.2*(rb-off);
 float sheen=.2*mix(.6,1.,mirror);
 f_add=(h1*s1+h2*s2*.5)*amp*.3*lines;
 if(tint>.5){sp=metal*(s1+.5*s2)*(.6+.3*dot(rb,float3(.333)));col=metal*w*amp*.1+col*.3*step(1.5,tint);sheen=.55;f_add=metal*(s1+.5*s2)*.4*lines;}
 f_amb=max(f_amb,float3(1.))*metal;f_glare=near*mirror*spec*.6;
 return f_amb*mix(.9,1.,f_zone)+f_zone*(col*lines+glint*metal+metal*sheen*lines)+sp*amp*lines+f_glare*metal*lines;
#endif
}
#if STAMP==1
float shootingStar(float2 uv,float fat){float2 d=(uv-u_star.xy)*float2(1.,u_aspect);
 float core=max(0.,1.-length(d)*(34./fat));
 float th=260./fat,rays=max(0.,1.-abs(d.x)*th)*max(0.,1.-abs(d.y)*(11./fat))+max(0.,1.-abs(d.y)*th)*max(0.,1.-abs(d.x)*(14./fat));
 float2 e=float2(d.x+d.y,d.x-d.y)*.7071;rays+=.8*(max(0.,1.-abs(e.x)*th)*max(0.,1.-abs(e.y)*(26./fat))+max(0.,1.-abs(e.y)*th)*max(0.,1.-abs(e.x)*(26./fat)));
 float u=clamp(d.x/.29,0.,1.),yc=-.052*sin(u*PI*.5),wd=mix(.011,.0015,u)*fat;
 float tail=step(0.,d.x)*step(d.x,.29)*smoothstep(wd,wd*.3,abs(d.y-yc))*pow(1.-u,.35);
 return clamp(core*1.8+rays+tail,0.,1.);}
#endif
// base: linear colour of the ink at this spot; uv: where on the card face (0,0 top left). Returns linear colour.
float3 foilShade(float3 base,float2 uv,float4 mk,float4 rl,float2 grad){
 float art=softBox(uv,u_art),text=softBox(uv,u_text);
#if PAT==23||PAT==28
 art=mk.g;text=mk.b;
#endif
 float2 lp=float2(.5,.45)+u_tilt*.6;float3 P=float3(uv.x,uv.y*u_aspect,0.);float2 lq=float2(lp.x,lp.y*u_aspect);
 float3 L=normalize(float3(lq,.85)-P),V=normalize(float3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 // How much key light reaches this spot: a tight share for the glare, a broad one for hazy sheets.
 float2 dl=P.xy-lq;float near=exp(-dot(dl,dl)/.3),wide=.3+.7*exp(-dot(dl,dl)/1.1);
 // A room light far away, as a phone is held: the card turns under it. Its mirror image sweeps the card as a long soft
 // bar, and the colour lies over the whole sheet in wide bands that move with the turn. No round spot.
 {float yaw=u_tilt.x*.5,pitch=u_tilt.y*.5,cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);
  float3 Lw=normalize(float3(.25,-.6,1.)),a=float3(Lw.x*cy+Lw.z*sy,Lw.y,-Lw.x*sy+Lw.z*cy);
  L=normalize(float3(a.x,a.y*cp+a.z*sp,-a.y*sp+a.z*cp));H=normalize(L+V);
  lq=float2(.5,.5*u_aspect)+L.xy/max(L.z,.25)*2.2;dl=P.xy-lq;
  float2 bn=normalize(float2(.8,1.));float across=dot(dl,bn);
  near=strength()*exp(-across*across/.006)*(.5+.5*exp(-dot(dl,dl)/3.));
  wide=.62+.38*exp(-dot(dl,dl)/2.5);
  f_x0=.7+u_tilt.x*.62-u_tilt.y*.15;f_add=float3(0.);f_ink=0.;
  f_ac=dot(P.xy-float2(f_x0,.5*u_aspect),normalize(float2(1.,.22)));float b2=f_ac+.5;
  f_zone=min(1.,exp(-f_ac*f_ac/.05)+.5*exp(-b2*b2/.035));
#if PAT==3
  near=strength()*min(1.,exp(-f_ac*f_ac/.012)+.5*exp(-b2*b2/.009));wide=.25+.75*f_zone;
#endif
 }
 float rel=u_r1.w*(1.-.7*text);float3 N=normalize(float3(-grad*rel*9.,1.));
 float pat=u_r1.x,tint=u_r1.y,mode=u_r1.z;
 // Where the foil shows: whole card; frame only (etched art is printed on white); or one ink.
 float cov=1.;
 if(mode>6.5)cov=(1.-art)*(1.-text);else if(mode>.5&&mode<1.5)cov=1.-art;else if(mode>1.5&&mode<2.5)cov=mk.r;else if(mode>3.5&&mode<4.5)cov=mk.b;else if(mode>4.5&&mode<5.5)cov=mk.a;
#if PAT==4
 // Mystical Archive etched (Tainted Pact, the owner's video): the gold ornaments and the name, type and rules panels are all
 // gold metal ink. A scan shows the panels as cream; any warm cream or gold ink outside the picture counts, letters stay print.
 if(mode>1.5&&mode<2.5){float3 sc=toSrgb(base);float mx=max(sc.r,max(sc.g,sc.b)),warm=smoothstep(.06,.16,sc.r-sc.b)*step(sc.b,sc.g)*smoothstep(.5,.65,mx)*(1.-smoothstep(.2,.32,sc.r-sc.g));cov=max(smoothstep(.5,.75,mk.r),warm)*(1.-art);}
#else
 if(mode>1.5&&(mode<2.5||(mode>3.5&&mode<5.5)))cov*=1.-text;
#endif
#if PAT==5
 cov*=1.-.7*text;
#endif
#if PAT==21
 cov*=1.-text;
#endif
#if PAT==29
 cov=mk.r;base=mix(base,float3(.34),.9*cov);
#endif
 float3 F=foil(pat,tint,uv,lq,L,V,N,near,wide,grad,rl.r);
#if PAT==29
 f_ink=1.;
#endif
#if PAT==23
 {float bl=dot(base,float3(.2126,.7152,.0722)),s0=smoothstep(.25,.6,mk.r),s=s0,x=f_ac+(bl-.3)*.25;
  s*=1.-smoothstep(.05,.14,dot(toSrgb(base),float3(.2126,.7152,.0722))-rl.r);  // letters and small print lighter than the metal around them are white ink
  float hot=exp(-x*x/.016)+.6*exp(-(x+.5)*(x+.5)/.012);
  float ch=.3+1.9*hot+.3*smoothstep(-.3,.3,sin(x*10.+1.));
  // The picture itself is printed on silver (the owner's video of Culling the Weak): where the scan is speckled grey the
  // card is bare silver and reads bright white; where the scan is tinted, coloured ink lies over the silver and reads as a
  // deep, rich colour out of the light and a pale washed one in it. Black ink stays black. No rainbow anywhere.
  float3 sg=toSrgb(base);float chroma=max(sg.r,max(sg.g,sg.b))-min(sg.r,min(sg.g,sg.b)),neu=smoothstep(.46,.58,rl.r)*(1.-smoothstep(.07,.12,chroma)),a=mk.g*(1.-s);
  float zb=min(1.,exp(-f_ac*f_ac/.05)+.5*exp(-(f_ac+.5)*(f_ac+.5)/.035)),body=smoothstep(.04,.3,bl);
  float gl=step(.985,hash(floor(uv*float2(220.,306.))+floor(f_ac*14.)))*zb;
  float3 tint=max(float3(0.),float3(bl)+(base-bl)*mix(4.5,2.,zb))*mix(float3(.5,.36,.58),float3(1.5),zb)+float3(.8,.78,.92)*zb*.12*body;
  float3 bare=mix(base*mix(1.,mix(2.1,2.8,zb),body),float3(.8,.82,.86)*mix(.9,1.2,zb),.9*smoothstep(.1,.26,bl))+float3(.9,.92,1.)*gl*.5*body;
  float3 want=mix(tint,bare,neu);
  F=mix(F,want/max(base,float3(.02)),a);f_amb=mix(f_amb,float3(1.),a);f_leak=mix(f_leak,0.,a);
  float zs=min(1.,exp(-x*x/.11)+.6*exp(-(x+.5)*(x+.5)/.08));ch=.07+1.55*zs+.5*hot;
  F=mix(F,float3(ch),s);f_amb=mix(f_amb,float3(1.),s);f_gloss=mix(f_gloss,2.,s);f_leak=mix(f_leak,.05,s);f_ink=max(s0,a);
  // Letters and small print on the metal are white ink: they stay white while the metal around them goes dark or bright.
  F=mix(F,float3(.9)/max(base,float3(.02)),s0-s);
  f_add=mix(f_add,float3(.96,.97,1.)*hot*.55,s);}
#endif
#if PAT==24
 f_top*=1.-.75*text;
#endif
 // Gold stamped on top of a foil card (gilded): the stamp is its own raised gold metal, the rest stays foil.
#if COVER==6
 if(mode>5.5){float s=smoothstep(.25,.6,mk.r)*(1.-text);
#if PAT==28
  s=(1.-art)*mix(.85,1.,smoothstep(.25,.6,mk.r));
#elif PAT==25
  s*=1.-art;
#endif
  float gb=min(1.,exp(-f_ac*f_ac/.05)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.04)),gc=exp(-f_ac*f_ac/.014)+.6*exp(-(f_ac+.5)*(f_ac+.5)/.01);
  float3 G=float3(.5+.75*gb+.8*gc)*mix(float3(1.),hue(f_ac*1.4+uv.y*.6+.15)*1.2,.25*gb);
  F=mix(F,G,s);f_amb=mix(f_amb,float3(1.),s);f_gloss=mix(f_gloss,1.6,s);f_leak=mix(f_leak,.1,s);f_top*=1.-s;f_add=float3(1.,.93,.75)*gc*.2*s;
#if PAT==28
  f_add=float3(1.,.84,.48)*(gb*.3+gc*.25)*s;
#endif
 }
#endif
 // Thin film replaces the sheet's colour (oil slick): colour depends on view angle and film thickness.
float3 fadd=float3(0.);
#if FILM
 if(u_r2.x>.5){float x=f_ac,x2=x+.5,b=min(1.,exp(-x*x/.016)+.5*exp(-x2*x2/.012));
  float blot=vnoise(uv*float2(3.,4.2)+u_tilt*.5);
  float3 sp=hue(x*1.7+uv.y*.3+blot*.55+rl.r*.2+.02);
  float hl=pow(max(dot(N,H),0.),16.);
  F=mix(float3(.4,.46,.56),mix(float3(1.),sp,.85)*2.1,b)*(1.+.6*hl);f_amb=float3(1.);f_ink=1.;
  float2 dq=P.xy-lq;float wash=exp(-dot(dq,dq)/.14);
  fadd=sp*b*.055+float3(.6,.64,.7)*wash*.26;}
#endif
 // Ink over metal: light ink lets the lit foil through, dark ink hides it; the darkest ink still passes a
 // faint glint of the highlight.
 float keep=u_r2.w,c=clamp(cov*(1.-keep),0.,1.);
 float lum=dot(base,float3(.2126,.7152,.0722)),top=max(base.r,max(base.g,base.b)),vis=mix(.25,1.,smoothstep(.01,.3,lum));
 if(u_r2.x>.5||tint>.5)vis=1.;
 // Respect the art: on the picture the sheet's colour stays a light veil (ink over foil filters it); on the frame and text box it is full.
#if PAT==26||PAT==28
 vis*=mix(1.,.9,art);
#elif PAT==12
 vis*=mix(1.,.7,art);
#elif PAT==1
 vis*=mix(1.,.75,art);
#elif FILM||PAT!=3
 vis*=mix(1.,.45,art*(1.-step(.5,mode)*step(mode,1.5)));
#else
 vis*=mix(1.,.55,art*(1.-step(.5,mode)*step(mode,1.5)));
#endif
#if FILM||PAT!=3
 float3 Fv=f_amb+(F-f_amb)*vis;
#else
 float3 Fv=(f_amb+(F-f_amb)*vis)*mix(1.,mix(.84,1.,f_zone),smoothstep(.3,.85,lum)*cov*(1.-.6*art));
#endif
 Fv=mix(Fv,F,f_ink);
#if FILM
 float3 inkc=mix(float3(lum),base,.35);
#else
 float3 inkc=base;
#endif
#if PAT==4
 if(mode>1.5&&mode<2.5)inkc=mix(base,base*float3(1.08,.9,.56),.6);
#endif
 float3 lit=inkc*(1.+.1*(1.-inkc))*Fv+(1.-top)*f_leak*f_glare*2.*f_amb*.5;
 float3 outC=mix(base,shoulder(lit),c);
#if PAT==4||COVER==6||PAT==18||PAT==23||PAT==26||PAT==29
 outC+=(1.-outC)*f_add*c*smoothstep(.02,.2,lum);
#endif
#if PAT==1||PAT==2||PAT==10||PAT==15
 // How a real foil meets the picture (the owner's video of four Edge of Eternities foils): inside the band of light the
 // colour is vivid, and it sits on the light ink only, so the bright shapes of the art light up in rainbow while dark ink
 // stays dark. The colour changes along the band. Straight at the light the whole card washes to pale silver.
 {float band=min(1.,exp(-f_ac*f_ac/.02)+.5*exp(-(f_ac+.5)*(f_ac+.5)/.014)),hi=pow(smoothstep(.05,.7,lum),1.3);
  float3 rbw=hue(f_ac*2.6+uv.y*.9+rl.r*.25+.1);rbw=clamp(mix(float3(dot(rbw,float3(.333))),rbw,1.4),0.,1.5);
  float3 tgt=outC*mix(float3(1.),rbw*1.55,.8)+rbw*.22*(1.-outC);
  outC=mix(outC,tgt,band*hi*c*strength());
  float2 dq=P.xy-lq;float g=exp(-dot(dq,dq)/.1)*c;
  outC=mix(outC,float3(dot(outC,float3(.2126,.7152,.0722)))*.55+float3(.42,.44,.47),g*.6);}
#endif
#if FILM||PAT!=3
#else
 outC+=(1.-outC)*f_add*vis*c*(.35+.65*smoothstep(.02,.35,lum))*(1.-.85*art);
#endif
#if FILM
 outC+=(1.-outC)*fadd*(1.-.6*top)*c;
#endif
 // Raised relief: glossy rims where the embossed height turns toward the light.
#if RELIEF
 if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.3+.7*near)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*float3(1.,.97,.92)*rim*rel*cov*.6;}
#endif
 // Galaxy / surge sparks: a few large stars and many fine ones; the fine ones only at sizes that can show them.
#if SPARK
 if(u_r2.y>0.){for(int i=0;i<2;i++){float n=i==0?26.:70.,fade=i==0?1.:lod(70.);float2 sq=float2(uv.x,uv.y*u_aspect)*n,sc=floor(sq);float2 j=hash2(sc+float(i)*9.);float on=step(1.-(i==0?.1:.2)*u_r2.y,j.x);
  float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sq)-.2-.6*hash2(sc*1.3)));
  float tw=pow(max(dot(normalize(float3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=(1.-outC)*on*pt*fade*(.1+tw*1.6)*cov*(.5+.6*f_zone)*float3(1.,.97,.9);}}
#if PAT==7
 {float2 sq=float2(uv.x,uv.y*u_aspect)*11.,sc=floor(sq);float2 j=hash2(sc+3.3),o=.25+.5*hash2(sc*1.7+.4);float on=step(.5,j.x)*u_r2.y,rad=.05+.13*j.y*j.y;
  float pt=1.-smoothstep(rad*.7,rad,length(fract(sq)-o)),tw=pow(max(dot(normalize(float3((hash2(sc+5.)-.5)*.7,1.)),H),0.),14.);
  outC+=(1.-outC)*on*pt*(.07+tw*1.1)*cov*mix(float3(1.),hue(j.y*3.+j.x),.7);}
#endif
#endif
 // Fluorescent ink glows under any light, on top of its foil.
 if(mode>2.5&&mode<3.5)outC+=base*mk.g*.4*(.6+.4*near);
#if STAMP==1
 if(u_r2.z>.5&&u_r2.z<1.5){float3 holo=mix(float3(1.),hue(f_ac*1.6+uv.x*1.8+uv.y*.9+.1),.5);
  if(u_star.z>1.5){float wht=smoothstep(.62,.9,min(base.r,min(base.g,base.b)))*clamp(shootingStar(uv,3.2)*3.,0.,1.);outC=mix(outC,base*holo*1.06,wht*.9);}
  else if(u_star.z>.5){float s=shootingStar(uv,1.);outC=mix(outC,holo*.98+.02,s*.95);}}
#endif
 // Marks pressed on top of the ink show over any ink.
#if PAT==21
 {float shard=mk.g;
  if(shard>.004){float sd=float(u_mask.eval(floor(uv*u_map)+.5).r);float2 j=float2(sd,fract(sd*7.31+.17));float3 fn=normalize(float3((j-.5)*1.1,1.));float nh=max(dot(fn,H),0.);
   float flash=pow(nh,22.),sheen=pow(nh,8.);float3 fc2=grating(L,V,normalize(float2(cos(j.x*PI),sin(j.x*PI))),1100.+j.y*900.);
   float3 face=base*(.68+.5*sheen+1.6*flash*(.4+.6*near))+fc2*sheen*(.6+.9*near)*(.25+.75*smoothstep(.03,.3,lum))+float3(.86,.93,1.)*flash*.12*near*smoothstep(.05,.4,lum);
   outC=mix(outC,clamp(shoulder(face),base*mix(.68,.93,smoothstep(.18,.4,lum)),max(base,float3(.96))),smoothstep(0.,.35,shard));}
  float edge=mk.b;
  if(edge>.004){float2 sd=rl.gb*2.-1.;float th=.5*atan(sd.y,sd.x);float3 ge=grating(L,V,float2(cos(th),sin(th)),1300.)*1.2*(.45+.8*near);outC=mix(outC,shoulder(outC+ge),edge);}}
#endif
 outC+=(1.-outC)*f_top;
 // Varnish: one clear coat over the whole face (not on metal-ink etched cards) returns a small white gloss.
 float coat=pow(max(dot(N,H),0.),60.)*.05*f_gloss;
 outC+=(1.-outC)*coat*mix(.35,1.,c);
 return clamp(outC,0.,1.);
}
"""
    // END AGSL_TEMPLATE
    const val AGSL_MAIN = """
// The security stamp's pastel rainbow (finish-effects.css .finish-holostamp): #ff8fc7 #ffd98a #9dffcf #8fdcff #bfa2ff, repeating.
float3 pastel(float i){float m=mod(i,5.);return m<.5?float3(1.,.5608,.7804):m<1.5?float3(1.,.851,.5412):m<2.5?float3(.6157,1.,.8118):m<3.5?float3(.5608,.8627,1.):float3(.749,.6353,1.);}
half4 main(float2 fc){
 half4 src=u_card.eval(fc);float a=float(src.a);if(a<.002)return src;
 float2 uv=fc/u_size;float3 base=toLin(clamp(float3(src.rgb)/a,0.,1.));
 float3 outC=base;
 // Measured maps (MtgFoil.cardMaps), opaque on Android: mask R/G/B as the site's, relief R height and G the drawn lines (the site's
 // mask alpha), stroke R/G direction and B strength (the site's relief G/B/A). Until they land nothing is drawn; then the foil fades in.
 if(u_on>.5&&u_maps>0.){
  float2 mp=uv*u_map;half4 m0=u_mask.eval(mp),r0=u_relief.eval(mp),s0=u_stroke.eval(mp);
  float4 mk=float4(float3(m0.rgb),float(r0.g)),rl=float4(float(r0.r),float(s0.r),float(s0.g),float(s0.b));
#if RELIEF||PAT==5
  float hx=float(u_relief.eval(mp+float2(2.,0.)).r-u_relief.eval(mp-float2(2.,0.)).r),hy=float(u_relief.eval(mp+float2(0.,2.)).r-u_relief.eval(mp-float2(0.,2.)).r);
#else
  float hx=0.,hy=0.;
#endif
  outC=mix(base,foilShade(base,uv,mk,rl,float2(hx,hy)),u_maps);
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

    /** Traditional foil's program (with the stamp), for checks that read the shader's text. */
    val AGSL: String get() = source(null)

    /** The defines a recipe composes with (mtg-foil-shader.js foilDefs). A card with no recipe (its stamp only) uses traditional's. */
    fun defs(r: CardData.Recipe?): Map<String, Int> = if (r == null) mapOf("PAT" to 1, "COVER" to 0, "FILM" to 0, "SPARK" to 0, "STAMP" to 0, "RELIEF" to 0)
        else mapOf("PAT" to r.pat.roundToInt(), "COVER" to r.cover.roundToInt(), "FILM" to if (r.film > .5f) 1 else 0, "SPARK" to if (r.sparkle > 0f) 1 else 0,
            "STAMP" to if (r.stamp == 1f) 1 else 0, "RELIEF" to if (r.relief > 0f) 1 else 0)

    private val composed = java.util.concurrent.ConcurrentHashMap<String, String>()
    /** The whole AGSL program for one recipe, composed once per foil type and kept. */
    fun source(r: CardData.Recipe?): String { val d = defs(r); val key = listOf("PAT", "COVER", "FILM", "SPARK", "STAMP", "RELIEF").joinToString(".") { "${d[it]}" }
        return composed.getOrPut(key) { compose(AGSL_HEAD + AGSL_TEMPLATE + AGSL_MAIN, d) } }

    private fun holds(expr: String, defs: Map<String, Int>): Boolean = expr.split("||").any { or -> or.split("&&").all { t ->
        val m = Regex("""^([A-Z_]+)\s*(?:(==|!=|>=|<=|>|<)\s*(-?\d+))?$""").matchEntire(t.trim()) ?: error("foil shader: bad condition \"${t.trim()}\"")
        val v = defs[m.groupValues[1]] ?: error("foil shader: unknown name ${m.groupValues[1]}")
        val op = m.groupValues[2]; val n = m.groupValues[3].toIntOrNull() ?: 0
        when (op) { "" -> v != 0; "==" -> v == n; "!=" -> v != n; ">" -> v > n; "<" -> v < n; ">=" -> v >= n; else -> v <= n } } }

    /** mtg-foil-shader.js composeFoil: #if / #elif / #else / #endif over whole lines, the same small rules; whole-line comments dropped. */
    fun compose(template: String, defs: Map<String, Int>): String {
        class Level(val outer: Boolean, var taken: Boolean)
        val out = StringBuilder(); val stack = ArrayList<Level>(); var on = true; var first = true
        for (line in template.split('\n')) {
            val m = Regex("""^#(if|elif|else|endif)\b\s*(.*)$""").matchEntire(line)
            if (m == null) { if (Regex("""^\s*#""").containsMatchIn(line)) error("foil shader: stray directive \"${line.trim()}\"")
                if (on && !Regex("""^\s*//""").containsMatchIn(line)) { if (!first) out.append('\n'); out.append(line); first = false }; continue }
            val d = m.groupValues[1]; val e = m.groupValues[2]
            when {
                d == "if" -> { val taken = on && holds(e, defs); stack.add(Level(on, taken)); on = taken }
                stack.isEmpty() -> error("foil shader: #$d without #if")
                d == "endif" -> on = stack.removeAt(stack.size - 1).outer
                else -> { val s = stack.last(); if (s.taken || !s.outer) on = false else { on = d == "else" || holds(e, defs); s.taken = on } }
            }
        }
        if (stack.isNotEmpty()) error("foil shader: #if without #endif")
        return out.toString()
    }

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
    // It fades in when it lands (no pop-in while a binder scrolls); a stamp already measured shows at once.
    val stampFade by androidx.compose.animation.core.animateFloatAsState(if (stamp != null) 1f else 0f,
        if (Motion.still) androidx.compose.animation.core.snap() else androidx.compose.animation.core.tween(220), label = "stamp")
    val stampOpacity = if (look.recipe != null) .5f else .6f
    val stampPaint = remember { Paint() }
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
                shader.setFloatUniform("u_stampk", (st?.mask?.width ?: 1).toFloat(), (st?.mask?.height ?: 1).toFloat(), stampOpacity * stampFade, 0f)
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
            stampPaint.alpha = stampOpacity * stampFade
            drawIntoCanvas { it.saveLayer(Rect(bx, by, bx + bw, by + bh), stampPaint) }
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
/** [follow]: the phone's tilt moves the light even when the card is not [live] (no drift): a plain card's security stamp answers the
 *  phone the way the site's light does (feel.js), while the card itself stays still. */
fun rememberFoilTilt(live: Boolean = true, phase: Float = 0f, touch: State<Offset?>? = null, tile: Boolean = false, rest: Offset? = null, follow: Boolean = false): State<Offset> {
    val context = LocalContext.current
    val tiltOn = AppSettings.tilt
    // "Card lighting & foil effects" off: the light holds still (finish-preview.js setFinishEffects). A grid [tile] also holds
    // still while a card view covers it (FoilFocus), so only the card in front moves and redraws.
    @Suppress("NAME_SHADOWING") val live = live && AppSettings.finish && !(tile && FoilFocus.covered)
    val phone = if ((live || (follow && AppSettings.finish)) && tiltOn) rememberTilt() else null
    val clock = if (live && !Motion.still) androidx.compose.animation.core.rememberInfiniteTransition(label = "foil")
        .animateFloat(0f, 1f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(9000, easing = androidx.compose.animation.core.LinearEasing)), label = "drift") else null
    return remember(phone, clock, touch, rest) {
        androidx.compose.runtime.derivedStateOf {
            touch?.value ?: run {
                if (rest != null && clock == null) return@run phone?.value?.takeIf { it.live }?.let { Offset(it.x * .9f, it.y * .9f) } ?: rest
                val p = phone?.value
                val k = ((clock?.value ?: .18f) + phase) * 2f * Math.PI.toFloat()
                val idle = Offset(kotlin.math.sin(k) * .55f, kotlin.math.sin(k * 2f) * .25f)
                if (p != null && p.live) Offset(p.x * .9f, p.y * .9f) + idle * .25f else idle
            }
        }
    }
}
