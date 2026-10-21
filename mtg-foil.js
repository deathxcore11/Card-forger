// Magic foil, rendered with WebGL on the card page, zoom, and gallery cards at every size in
// collections, binders and decks. Every treatment, from 1999 old-border foil to surge,
// galaxy, oil slick and gilded, is a recipe (mtg-foil-recipes.js) chosen from the card's own Scryfall
// data and drawn by one shader. Magic prints its inks straight onto the foil, so the whole card is
// foil unless the treatment says otherwise; dark ink absorbs it and light ink lets it through.
// Approximate simulation on reference images, not a physical-foil capture.
import {analyzeMtgCard,MTG_FRAMES} from './mtg-foil-analysis.js';
import {MTG_FOIL_RECIPES} from './mtg-foil-recipes.js';
import {foilProgram,foilAnalyzer,readFoilPixels,mountFoilCanvas} from './foil-gl.js';
export const MTG_FOIL_FRAGMENT=`precision highp float;
varying vec2 v;
uniform sampler2D u_card;   // card image, resampled to the display size
uniform sampler2D u_mask;   // R gold ink, G neon ink, B bare paper, A drawn lines
uniform sampler2D u_relief; // R height, G/B stroke direction, A stroke strength
uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;
uniform vec4 u_art;uniform vec4 u_text;
uniform vec4 u_r1; // pattern, tint, coverage, relief
uniform vec4 u_r2; // film, sparkle, stamp, unused
const float PI=3.14159265;
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+17.31));}
float inBox(vec2 p,vec4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
vec3 spectrum(float l){vec3 c=vec3(exp(-pow((l-600.)/70.,2.))+.35*exp(-pow((l-440.)/30.,2.)),exp(-pow((l-540.)/60.,2.)),exp(-pow((l-455.)/40.,2.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
// Reflection grating: light reaching the eye satisfies (L+V)·g = mλ/d along grating vector g.
vec3 grating(vec3 L,vec3 V,vec2 g,float d){float s=abs(dot(L.xy+V.xy,g));vec3 c=vec3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
// Thin film (oil on water): interference between the film's two surfaces, thickness t in nm.
vec3 film(float cosT,float t){vec3 ph=4.*PI*1.45*t*cosT/vec3(650.,532.,450.);return .5+.5*cos(ph);}
vec3 shoulder(vec3 x){vec3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
vec3 voro(vec2 q){vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return vec3(id,sqrt(d2)-sqrt(d1));}
// Pattern -> foil radiance. N is the surface normal (relief included), grad the height gradient.
vec3 foil(float pat,float tint,vec2 uv,vec3 L,vec3 V,vec3 N,float spot,vec2 grad,float height){
 vec3 H=normalize(L+V);vec2 q=vec2(uv.x,uv.y*u_aspect),px=uv*u_px;vec2 g=normalize(vec2(.86,.5));
 float d=1550.,lines=0.,glint=0.,mirror=.35,ex=14.,amp=.7,seam=1.;float spec=-1.;
 if(pat<1.5){}                                                                                  // traditional
 else if(pat<2.5){g=normalize(vec2(.6,.8));d=1750.;mirror=.1;ex=8.;amp=.65;}                 // old border: wide, hazy, saturated
 else if(pat<3.5){g=vec2(1.,0.);d=1300.;mirror=.9;amp=.6;spec=exp(-pow(H.x/.07,2.))+.35*exp(-pow(H.x/.22,2.));} // FTV: vertical mirror bar
 else if(pat<4.5){vec3 w=voro(q*260.);vec3 n=normalize(vec3((hash2(w.xy)-.5)*.9,1.));        // etched: frosted metal grain
  spec=pow(max(dot(n,H),0.),70.)*2.2+.45*exp(-pow(dot(H.xy,vec2(.7071,.7071))/.12,2.));mirror=1.;amp=.25;d=1650.;}
 else if(pat<5.5){float ph=height*55.,gr=sin(ph);vec2 gn=length(grad)>1e-4?normalize(grad):vec2(1.,0.); // textured: contours of the art
  g=gn;d=1250.;lines=.5+.5*gr;N=normalize(N+vec3(gn*cos(ph)*.12,0.));mirror=.4;ex=24.;amp=.8;lines=.5+.25*gr;}
 else if(pat<6.5){float w1=sin(q.x*30.+sin(q.y*9.)*2.),w2=sin((q.x+q.y)*24.+sin(q.x*7.)*2.5);      // surge: crossing waves
  g=normalize(vec2(cos(w1*1.6+q.y*3.),sin(w2*1.6))+1e-4);d=1250.+300.*w1;lines=.5+.5*w1*w2;mirror=.35;amp=.9;}
 else if(pat<7.5){}                                                                              // galaxy: traditional + stars (sparkle)
 else if(pat<8.5){vec2 c=q-vec2(.5,.5*u_aspect);float rr=length(c),a=atan(c.y,c.x),sw=a+rr*9.;   // halo: swirl
  g=vec2(-sin(sw),cos(sw));d=1100.+rr*900.;lines=.5+.5*sin(a*6.+rr*40.);mirror=.25;amp=.6;}
 else if(pat<9.5){vec3 w=voro(q*30.);vec2 j=hash2(w.xy);float on=step(.55,j.x)*smoothstep(0.,.05,w.z); // confetti
  float a=j.y*PI;g=mix(g,vec2(cos(a),sin(a)),on);d=mix(1550.,1050.+j.x*900.,on);amp=mix(.5,1.4,on);mirror=.3;}
 else if(pat<10.5){amp=0.;}                                                                      // double rainbow (below)
 else if(pat<11.5){vec3 w=voro(q*vec2(9.,6.));vec2 j=hash2(w.xy);float a=j.x*PI;g=vec2(cos(a),sin(a));d=1150.+j.y*800.; // fracture
  float edge=1.-smoothstep(0.,.03,w.z);glint=edge*pow(max(dot(normalize(vec3((j-.5)*.8,1.)),H),0.),20.)*1.2;mirror=.3;amp=.9;}
 else if(pat<12.5){vec2 c=q-vec2(.5,.42*u_aspect);float rr=length(c);g=normalize(c+1e-4);d=1300.;lines=.5+.5*sin(rr*170.);mirror=.35;amp=.8;} // ripple
 else if(pat<13.5){vec2 p=q*vec2(9.,9.),c=floor(p),f=fract(p)-.5;float rr=length(f),a=atan(f.y,f.x);  // mana-symbol rings
  float ring=1.-smoothstep(.02,.05,abs(rr-.32)),pip=0.;for(int k=0;k<5;k++){float ak=float(k)*1.2566+hash(c)*6.28;pip=max(pip,1.-smoothstep(.04,.07,length(f-.16*vec2(cos(ak),sin(ak)))));}
  float sym=max(ring,pip);float ca=hash(c+3.1)*PI;g=mix(g,vec2(cos(ca),sin(ca)),sym);d=mix(1550.,1150.,sym);amp=mix(.55,1.3,sym);lines=sym;}
 else if(pat<14.5){vec2 p=q*vec2(16.,22.);float row=floor(p.y);p.x+=mod(row,2.)*.5;vec2 f=fract(p)-vec2(.5,0.);  // dragonscale
  float sc=length(f*vec2(1.,1.3));N=normalize(N+vec3(f*vec2(.6,.4),0.));g=normalize(f+1e-3);d=1300.+400.*sc;lines=smoothstep(.45,.5,sc);mirror=.4;}
 else if(pat<15.5){g=vec2(0.,1.);d=900.;lines=.5+.5*sin(px.y*2.4);mirror=.3;amp=1.15;}           // rainbow (fine, high dispersion)
 else if(pat<16.5){vec2 p=q*14.,f=fract(p)-.5;float dm=abs(f.x)+abs(f.y);                       // invisible ink: hidden lattice
  glint=(smoothstep(.34,.36,dm)-smoothstep(.42,.44,dm))*pow(max(dot(N,H),0.),26.)*1.8;}
 else if(pat<17.5){}                                                                             // raised / embossed: traditional + relief
 else{mirror=.9;amp=.3;ex=16.;}                                                                  // silver
 vec3 dif=grating(L,V,g,d)*amp;
 if(pat>9.5&&pat<10.5)dif=grating(L,V,normalize(vec2(.86,.5)),1450.)*.8+grating(L,V,normalize(vec2(-.5,.86)),1650.)*.8;
 if(spec<0.)spec=pow(max(dot(N,H),0.),ex);
 vec3 metal=tint<.5?vec3(1.):tint<1.5?vec3(1.,.74,.32):vec3(.86,.9,.96);
 vec3 col=tint<.5?dif*1.9:tint<1.5?metal*(.5*spot+.9*length(dif))*1.3:metal*(.6*spot+.5*length(dif))*1.3+dif*.25;
 return (vec3(.18)*metal+spot*(mirror*spec*metal+col)*(.7+.3*lines)+glint*metal)*seam;
}
vec3 overInk(vec3 base,vec3 F,float cover){vec3 T=mix(base,base/max(max(base.r,max(base.g,base.b)),.04),.32);return mix(base,shoulder(T*F*1.35),clamp(cover,0.,1.));}
float shootingStar(vec2 uv){vec2 c=vec2(u_text.x+.035,u_text.w-.03),d=(uv-c)*vec2(1.,u_aspect);
 float star=max(0.,1.-(abs(d.x)+abs(d.y))*95.)+max(0.,1.-length(d)*140.);
 vec2 t=d;float arc=.004*sin(clamp(t.x*40.,0.,PI));float tail=step(0.,t.x)*step(t.x,.05)*smoothstep(.0022,0.,abs(t.y+arc))*(1.-t.x*20.);
 return clamp(star*2.+tail,0.,1.);}
void main(){
 vec2 uv=vec2(v.x,1.-v.y);vec3 base=toLin(texture2D(u_card,v).rgb);vec4 mk=texture2D(u_mask,v),rl=texture2D(u_relief,v);
 float art=inBox(uv,u_art),text=inBox(uv,u_text);
 vec2 lp=vec2(.5,.45)+u_tilt*.6;vec3 P=vec3(uv.x,uv.y*u_aspect,0.);
 vec3 L=normalize(vec3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(vec3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 vec2 dl=(uv-lp)*vec2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.3);
 vec2 e=u_texel*2.;float hx=texture2D(u_relief,v+vec2(e.x,0.)).r-texture2D(u_relief,v-vec2(e.x,0.)).r,hy=texture2D(u_relief,v-vec2(0.,e.y)).r-texture2D(u_relief,v+vec2(0.,e.y)).r;
 vec2 grad=vec2(hx,hy);float rel=u_r1.w*(1.-.7*text);vec3 N=normalize(vec3(-grad*rel*9.,1.));
 float pat=u_r1.x,tint=u_r1.y,mode=u_r1.z;
 // Where the foil shows: whole card; frame only (etched art is printed on white); or one ink.
 float cov=1.;
 if(mode>.5&&mode<1.5)cov=1.-art;else if(mode>1.5&&mode<2.5)cov=mk.r;else if(mode>3.5&&mode<4.5)cov=mk.b;else if(mode>4.5)cov=mk.a;
 // Ink-selective treatments never reach the rules box (its letters are lines, its paper is bare);
 // patterned sheets are softer there so the text stays easy to read.
 if(mode>1.5&&(mode<2.5||mode>3.5))cov*=1.-text;
 float patterned=step(4.5,pat)*(1.-step(6.5,pat)*step(pat,7.5))*(1.-step(16.5,pat));cov*=1.-.45*text*patterned;
 vec3 F=foil(pat,tint,uv,L,V,N,spot,grad,rl.r);
 // Thin film replaces the grating colour (oil slick): colour depends on view angle and film thickness.
 if(u_r2.x>.5){float t=320.+260.*rl.r+120.*hash(floor(uv*u_px/3.));vec3 f=film(dot(N,V),t);F=f*(.15+spot*(1.4*pow(max(dot(N,H),0.),16.)+.5));}
 vec3 outC=overInk(base,F,cov*.92);
 // Raised relief: glossy rims where the embossed height turns toward the light.
 if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.35+.65*spot)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*vec3(1.,.97,.92)*rim*rel*cov*.8;}
 // Galaxy / surge sparks: sparse star points that twinkle as the light moves.
 if(u_r2.y>0.){vec2 sq=vec2(uv.x,uv.y*u_aspect)*70.,sc=floor(sq);vec2 j=hash2(sc);float on=step(1.-.22*u_r2.y,j.x);
  float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sq)-.2-.6*hash2(sc*1.3)));
  float tw=pow(max(dot(normalize(vec3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=on*pt*(.25+tw*3.)*cov*(.4+.6*spot)*vec3(1.,.97,.9);}
 // Fluorescent ink glows under any light, on top of its foil.
 if(mode>2.5&&mode<3.5)outC+=base*mk.g*.45*(.6+.4*spot);
 if(u_r2.z>.5){float s=shootingStar(uv);outC=mix(outC,shoulder(F*1.6+vec3(.15)),s*.9);}
 gl_FragColor=vec4(toSrgb(clamp(outC,0.,1.)),1.);
}`;
// Scryfall serves card images with open CORS, but the app's <img> tags load them without it, so their
// pixels are not readable. The foil loads its own CORS copy of the same image for analysis and drawing.
const copies=new Map();
export function readableCopy(src){
 if(copies.has(src))return copies.get(src);
 const job=new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.decoding='async';i.onload=()=>resolve(i);i.onerror=()=>reject(Error('image unavailable'));i.src=src;});
 job.catch(()=>copies.delete(src));
 if(copies.size>=24)copies.delete(copies.keys().next().value);
 copies.set(src,job);return job;
}
const analyze=foilAnalyzer(new URL('./mtg-foil-worker.js',import.meta.url),(data,W,H)=>analyzeMtgCard(data,W,H));
let shared=null;
function renderer(doc){
 if(shared?.lost)return null;
 if(!shared)shared=foilProgram(doc,MTG_FOIL_FRAGMENT,['u_card','u_mask','u_relief','u_tilt','u_px','u_texel','u_aspect','u_art','u_text','u_r1','u_r2']);
 return shared;
}
// Returns a handle, or null when this surface keeps the CSS finish (unknown treatment, no WebGL).
export function mountMtgFoil(overlay,img,treatment,{surface='detail',frame='2015'}={}){
 const r=MTG_FOIL_RECIPES[treatment],box=MTG_FRAMES[frame]||MTG_FRAMES['2015'];if(!r||!overlay||!img)return null;
 const src=img.currentSrc||img.src;if(!src)return null;
 const copy=()=>readableCopy(src);
 return mountFoilCanvas(overlay,{source:copy,key:src,surface,program:()=>renderer(overlay.ownerDocument),
  analysis:()=>copy().then(i=>analyze(src,()=>readFoilPixels(i,372))),
  setUniforms:({gl,U})=>{gl.uniform4f(U.u_art,...box.art);gl.uniform4f(U.u_text,...box.text);gl.uniform4f(U.u_r1,r.pat,r.tint,r.cover,r.relief);gl.uniform4f(U.u_r2,r.film,r.sparkle,r.stamp,0);}});
}
