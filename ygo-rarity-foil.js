// Yu-Gi-Oh! rarity foil, rendered with WebGL on the card page, zoom, and gallery cards at every size
// in collections, binders and decks. Every rarity is a recipe (ygo-foil-recipes.js) drawn by
// one shader: foil is simulated under the ink, so unlit it reads as dark metal and colour appears
// where a reflection grating sends light toward the viewer. One shared WebGL context draws every
// card into ordinary 2D canvases (browsers cap live contexts at roughly 8-16). Approximate
// simulation, not a physical-foil capture.
import {analyzeYgoArt,YGO_LAYOUT_ART} from './ygo-foil-analysis.js';
import {YGO_FOIL_RECIPES} from './ygo-foil-recipes.js';
import {foilProgram,foilAnalyzer,readFoilPixels,mountFoilCanvas} from './foil-gl.js';
export const YGO_TEXT_BOX=[.075,.735,.925,.955],YGO_NAME_BAR=[.072,.050,.828,.108];
// Text that foil must leave readable: Pendulum adds the scale box, Skill has a taller rules box.
export const YGO_LAYOUT_TEXT={standard:YGO_TEXT_BOX,pendulum:[.062,.613,.938,.955],skill:[.075,.67,.925,.955]};
const layoutOf=v=>YGO_LAYOUT_ART[v]?v:'standard';
// A recipe needs WebGL only when it foils something besides the name (the name has its own canvas).
export const ygoRecipeFor=effect=>{const r=YGO_FOIL_RECIPES[effect];return r&&(r.whole||r.frame||r.art)?r:null;};
export const YGO_RARITY_FRAGMENT=`precision highp float;
varying vec2 v;
uniform sampler2D u_card;uniform sampler2D u_mask;uniform sampler2D u_relief;
uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;
uniform vec4 u_art;uniform vec4 u_name;uniform vec4 u_text;
uniform vec3 u_whole;uniform vec3 u_frame;uniform vec3 u_artL;uniform float u_stars;
const float PI=3.14159265;
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+17.31));}
// Smooth value noise: neighbouring flakes share their colour, so glitter reads as one printed sheet.
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float inBox(vec2 p,vec4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
vec3 spectrum(float l){vec3 c=vec3(exp(-pow((l-600.)/70.,2.))+.35*exp(-pow((l-440.)/30.,2.)),exp(-pow((l-540.)/60.,2.)),exp(-pow((l-455.)/40.,2.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
// Reflection grating: light reaching the eye satisfies (L+V)·g = mλ/d along the grating vector g.
vec3 grating(vec3 L,vec3 V,vec2 g,float d){float s=abs(dot(L.xy+V.xy,g));vec3 c=vec3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
vec3 shoulder(vec3 x){vec3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
vec3 voro(vec2 q){vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return vec3(id,sqrt(d2)-sqrt(d1));}
// One pattern primitive -> foil radiance. Patterns: 1 lines 2 diagonal 3 prism 4 glitter 7 stroke
// 8 mosaic 9 shatter 10 stars 11 parallel 12 quarter century. Tints: 0 rainbow 1 gold 2 silver 3 platinum.
vec3 foil(float pat,float tint,vec2 uv,vec3 L,vec3 V,vec3 H,float spot,float energy,vec2 stroke){
 vec2 px=uv*u_px,q=vec2(uv.x,uv.y*u_aspect);vec2 g=vec2(1.,0.);float d=1400.,lines=0.,glint=0.,mirror=.5,ex=40.,seam=1.;
 if(pat<1.5){d=1350.;lines=.5+.5*sin(px.x*2.0944);mirror=.7;ex=14.;}
 else if(pat<2.5){vec2 r=vec2(uv.x+uv.y*u_aspect,uv.x-uv.y*u_aspect);vec2 j=hash2(floor(r*vec2(90.,22.)));float a=PI*.25+(j.x-.5)*.16;g=vec2(cos(a),-sin(a));d=1250.+j.y*450.;lines=.5+.5*sin((px.x+px.y)*1.5708);mirror=.35;}
 else if(pat<3.5){vec2 c=floor(q*72.),f=fract(q*72.);g=mod(c.x+c.y,2.)<.5?vec2(1.,0.):vec2(0.,1.);d=1150.+hash(c)*600.;lines=smoothstep(0.,.12,f.x)*smoothstep(0.,.12,f.y)*smoothstep(1.,.88,f.x)*smoothstep(1.,.88,f.y);mirror=.3;}
 else if(pat<4.5){vec3 w=voro(q*210.);vec2 j=mix(hash2(w.xy*1.7),vec2(vnoise(q*24.),vnoise(q*24.+5.1)),.6);float a=j.x*PI;g=vec2(cos(a),sin(a));d=1000.+j.y*900.;glint=pow(max(dot(normalize(vec3((hash2(w.xy*3.1)-.5)*.5,1.)),H),0.),400.)*1.8;mirror=.25;}  // fine glitter, flakes share colour regionally
 else if(pat<7.5){g=normalize(vec2(-stroke.y,stroke.x)+1e-4);mirror=.45;}
 else if(pat<8.5){vec3 w=voro(q*18.);vec2 j=hash2(w.xy);float a=j.x*PI;g=vec2(cos(a),sin(a));d=1100.+j.y*700.;seam=smoothstep(0.,.06,w.z);mirror=.4;}
 else if(pat<9.5){vec3 w=voro(q*vec2(7.,4.));vec2 j=hash2(w.xy);float a=j.x*PI;g=vec2(cos(a),sin(a));d=1200.+j.y*800.;glint=(1.-smoothstep(0.,.035,w.z))*pow(max(dot(normalize(vec3((j-.5)*.8,1.)),H),0.),20.)*1.5;mirror=.35;}
 else if(pat<10.5){vec2 c=floor(q*26.),f=fract(q*26.)-.5;float star=step(length(f),.18+.12*cos(atan(f.y,f.x)*5.+hash(c)*6.28));vec2 j=hash2(c);g=star>.5?vec2(cos(j.x*PI),sin(j.x*PI)):vec2(1.,0.);d=star>.5?1100.+j.y*700.:1600.;lines=star;mirror=.3;}
 else if(pat<11.5){g=vec2(0.,1.);d=1500.;lines=.5+.5*sin(px.y*2.0944);mirror=.6;ex=18.;}
 else{vec2 r=vec2(uv.x+uv.y*u_aspect,uv.x-uv.y*u_aspect);vec2 j=hash2(floor(r*vec2(130.,30.)));float a=PI*.25+(j.x-.5)*.3;g=vec2(cos(a),-sin(a));d=1150.+j.y*600.;vec3 w=voro(q*110.);glint=pow(max(dot(normalize(vec3((hash2(w.xy)-.5)*.5,1.)),H),0.),300.)*1.6;mirror=.3;}
 vec3 dif=grating(L,V,g,d)*seam;float spec=pow(max(H.z,0.),ex);
 vec3 metal=tint<.5?vec3(1.):tint<1.5?vec3(1.,.74,.32):tint<2.5?vec3(.86,.9,.96):vec3(.92,.94,1.);
 vec3 col=tint<.5?dif*(1.9+energy*1.2):tint<2.5?metal*(.55*spot+.8*length(dif))*1.4:mix(metal*(.5+.9*length(dif)),dif*1.6,.35);
 return (vec3(.2)*metal+spot*(mirror*spec*metal+col)*(.7+.3*lines)+glint*metal)*seam+vec3(.06)*(1.-seam);
}
// Ink over foil: thin inks pass part of the foil, brightened toward the ink's own hue, with a soft roll-off.
vec3 overInk(vec3 base,vec3 F,float cover){vec3 T=mix(base,base/max(max(base.r,max(base.g,base.b)),.04),.32);return mix(base,shoulder(T*F*1.35),clamp(cover,0.,1.));}
void main(){
 vec2 uv=vec2(v.x,1.-v.y);vec3 base=toLin(texture2D(u_card,v).rgb);vec4 mk=texture2D(u_mask,v),rl=texture2D(u_relief,v);
 float art=inBox(uv,u_art),name=inBox(uv,u_name),text=inBox(uv,u_text),frame=(1.-art)*(1.-text)*(1.-name);
 vec2 lp=vec2(.5,.45)+u_tilt*.6;vec3 P=vec3(uv.x,uv.y*u_aspect,0.);
 vec3 L=normalize(vec3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(vec3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 vec2 dl=(uv-lp)*vec2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.28);
 vec2 e=u_texel*2.;float hx=texture2D(u_relief,v+vec2(e.x,0.)).r-texture2D(u_relief,v-vec2(e.x,0.)).r,hy=texture2D(u_relief,v-vec2(0.,e.y)).r-texture2D(u_relief,v+vec2(0.,e.y)).r;
 vec3 nRel=normalize(vec3(-hx*6.,-hy*6.,1.));vec2 stroke=normalize(rl.gb*2.-1.+1e-4);
 vec3 outC=base;
 // Whole card (Starlight, Parallel, Shatterfoil, Starfoil): the rules box only gets a share and the name bar is left to the lettering.
 if(u_whole.x>.5)outC=overInk(outC,foil(u_whole.x,u_whole.y,uv,L,V,H,spot,0.,stroke),(1.-text*(1.-u_whole.z))*(1.-name)*.85);
 // Frame: the coloured frame, or only the outer border band (Gold, Platinum).
 if(u_frame.x>.5){float cov=u_frame.z>1.5?1.-inBox(uv,vec4(.045,.032,.955,.968)):frame;
  if(u_frame.x>5.5&&u_frame.x<6.5){float rim=pow(max(dot(nRel,H),0.),18.)*(.35+.65*spot);outC=outC*(1.-.06*cov)+(1.-outC)*mix(vec3(.95,.88,.7),outC*2.,.6)*rim*cov*.7;}
  else outC=overInk(outC,foil(u_frame.x,u_frame.y,uv,L,V,H,spot,0.,stroke),cov);}
 // Art: foil passes where the white underbase was left out, or across the whole art.
 if(u_artL.x>.5){float cov=art*(u_artL.z>1.5?1.:mk.r);if(u_artL.x>6.5&&u_artL.x<7.5)cov=art*max(mk.r,.22*rl.a);
  if(u_artL.x>4.5&&u_artL.x<5.5){vec3 silver=vec3(dot(outC,vec3(.2126,.7152,.0722)))*vec3(.9,.95,1.04);float rim=pow(max(dot(nRel,H),0.),10.);
   outC=mix(outC,shoulder(mix(silver,outC,.2)*(.55+.9*rim*(.4+.6*spot))+grating(L,V,vec2(.7071),1600.)*.35*spot),art);}
  else if(u_artL.x>5.5&&u_artL.x<6.5){float rim=pow(max(dot(nRel,H),0.),18.)*(.35+.65*spot);outC=outC*(1.-.06*art)+(1.-outC)*mix(vec3(.95,.88,.7),outC*2.,.6)*rim*art*.7;}
  else outC=overInk(outC,foil(u_artL.x,u_artL.y,uv,L,V,H,spot,mk.g,stroke),cov);}
 // Level stars and Attribute: 1 embossed glint, 2 holo, 3 rainbow (Secret), 4 gold.
 if(u_stars>.5&&mk.b>.3){float sc=smoothstep(.3,.8,mk.b);
  if(u_stars<1.5){float s=pow(max(dot(nRel,H),0.),30.)*(.3+.7*spot);outC+=(1.-outC)*vec3(1.,.9,.6)*s*.9*sc;}
  else outC=overInk(outC,foil(u_stars<2.5?1.:u_stars<3.5?2.:1.,u_stars>3.5?1.:0.,uv,L,V,H,spot,0.,stroke),sc*.9);}
 gl_FragColor=vec4(toSrgb(clamp(outC,0.,1.)),1.);
}`;
const analyze=foilAnalyzer(new URL('./ygo-foil-worker.js',import.meta.url),(data,W,H,{layout})=>analyzeYgoArt(data,W,H,YGO_LAYOUT_ART[layout]));
export function analyzeCardImage(img,layout='standard'){
 layout=layoutOf(layout);const src=img?.currentSrc||img?.src||'';if(!src||!img.naturalWidth)return Promise.reject(Error('image not ready'));
 return analyze(src+'|'+layout,()=>readFoilPixels(img),{layout});
}
// One shared WebGL context draws every card into ordinary 2D canvases.
let shared=null;
function renderer(doc){
 if(shared?.lost)return null;
 if(!shared&&(shared=foilProgram(doc,YGO_RARITY_FRAGMENT,['u_card','u_mask','u_relief','u_tilt','u_px','u_texel','u_aspect','u_art','u_name','u_text','u_whole','u_frame','u_artL','u_stars'])))shared.gl.uniform4f(shared.U.u_name,...YGO_NAME_BAR);
 return shared;
}
// Returns a handle, or null when this surface keeps the CSS finish (unsupported rarity, no WebGL).
export function mountYgoRarityFoil(overlay,img,effect,{surface='detail',layout='standard',stars}={}){
 layout=layoutOf(layout);
 const recipe=ygoRecipeFor(effect);if(!recipe||!overlay||!img)return null;
 const doc=overlay.ownerDocument,src=img.currentSrc||img.src;
 return mountFoilCanvas(overlay,{source:()=>img,key:src+'|'+layout,surface,program:()=>renderer(doc),analysis:()=>analyzeCardImage(img,layout),
  setUniforms:({gl,U})=>{gl.uniform4f(U.u_art,...YGO_LAYOUT_ART[layout]);gl.uniform4f(U.u_text,...YGO_LAYOUT_TEXT[layout]);gl.uniform3f(U.u_whole,...(recipe.whole||[0,0,0]));gl.uniform3f(U.u_frame,...(recipe.frame||[0,0,0]));gl.uniform3f(U.u_artL,...(recipe.art||[0,0,0]));gl.uniform1f(U.u_stars,stars??(recipe.stars?1:0));}});
}
