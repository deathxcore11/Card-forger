// Pokémon foil, rendered with WebGL on the card page, zoom, and gallery cards at every size. Coverage
// comes from the app's measured frame masks (art window for holo rares, surround for reverse holos,
// whole card for full arts); inside a holo window the Pokémon sits on white ink and only the
// background shines (the same subject analysis as Yu-Gi-Oh!). The pattern is the era's or variant's
// own foil sheet (ptcg-foil-recipes.js). Approximate simulation, not a physical-foil capture.
import {analyzeYgoArt} from './ygo-foil-analysis.js';
import {PTCG_FOIL_RECIPES} from './ptcg-foil-recipes.js';
import {foilProgram,foilAnalyzer,readFoilPixels,readableCopy,mountFoilCanvas} from './foil-gl.js';
export const PTCG_FOIL_FRAGMENT=`precision highp float;
varying vec2 v;
uniform sampler2D u_card;   // card image, resampled to the display size
uniform sampler2D u_mask;   // R foil-through behind the Pokémon, G coloured energy, A measured coverage
uniform sampler2D u_relief; // R height, G/B stroke direction, A stroke strength
uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;
uniform vec4 u_r1; // pattern, tint, underbase (1 = Pokémon on white ink), relief
uniform vec4 u_r2; // sparkle, soft (lower half lighter on full arts)
const float PI=3.14159265;
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+17.31));}
// Smooth value noise: neighbouring cells blend, so a foil's streaks flow into each other instead of tiling.
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec3 spectrum(float l){vec3 c=vec3(exp(-pow((l-600.)/70.,2.))+.35*exp(-pow((l-440.)/30.,2.)),exp(-pow((l-540.)/60.,2.)),exp(-pow((l-455.)/40.,2.)));return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));}
// Reflection grating: light reaching the eye satisfies (L+V)·g = mλ/d along grating vector g.
vec3 grating(vec3 L,vec3 V,vec2 g,float d,float off){float s=abs(dot(L.xy+V.xy,g))+off;vec3 c=vec3(0.);for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);return c;}
vec3 shoulder(vec3 x){vec3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
vec3 voro(vec2 q){vec2 n=floor(q),f=fract(q);float d1=8.,d2=8.;vec2 id=n;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;id=n+o;}else if(d<d2)d2=d;}
 return vec3(id,sqrt(d2)-sqrt(d1));}
// A ball on a tiled sheet: 1 inside, with the centre band and button left bare (seam 0).
vec2 ball(vec2 q,float scale){vec2 p=q*scale;p.x+=mod(floor(p.y),2.)*.5;vec2 f=fract(p)-.5;float r=length(f);
 float inside=1.-smoothstep(.3,.32,r),band=smoothstep(.025,.045,abs(f.y)),button=smoothstep(.07,.09,r);return vec2(inside*band*button,f.y);}
// Pattern -> foil radiance. N is the surface normal (relief included).
vec3 foil(float pat,float tint,vec2 uv,vec3 L,vec3 V,vec3 N,float spot,vec2 grad,float height,vec2 stroke){
 vec3 H=normalize(L+V);vec2 q=vec2(uv.x,uv.y*u_aspect),px=uv*u_px;vec2 g=normalize(vec2(.86,.5));
 float d=1550.,lines=0.,glint=0.,mirror=.35,ex=14.,amp=.75,off=0.;
 if(pat<1.5){  // WotC: vertical starlight streaks that flow into one another (smooth across and along each streak)
  vec2 sp=vec2(q.x*55.,q.y*.7);vec2 j=vec2(vnoise(sp),vnoise(sp+vec2(31.7,11.3)));g=normalize(vec2(1.,(j.x-.5)*.12));d=1400.;off=j.y*.55;  // each streak carries its own colour
  lines=.5+.5*vnoise(vec2(q.x*160.,q.y*6.));vec3 w=voro(q*60.);glint=step(.93,hash(w.xy))*pow(max(dot(normalize(vec3((hash2(w.xy)-.5)*.6,1.)),H),0.),60.)*1.1;amp=.85;
  // Four-point stars on three parallax depths: each layer drifts with the tilt and every star lights at its own angle.
  for(int k=0;k<3;k++){float s=10.+float(k)*9.;vec2 p=q*s+u_tilt*(.35/(1.+float(k))),cc=floor(p),f=fract(p)-.5-(hash2(cc+float(k)*13.)-.5)*.5;vec2 r=hash2(cc+float(k)*29.);
   float on=step(.72,r.y),star=on*(1.-smoothstep(0.,.012+.01*r.x,abs(f.x*f.y)*14.+length(f)*.09)),fire=pow(max(cos(dot(u_tilt,vec2(3.5))+r.x*6.28),0.),8.);glint+=star*fire*(1.6-.35*float(k));}}
 else if(pat<2.5){vec3 w=voro(q*110.);vec2 sm=vec2(vnoise(q*28.),vnoise(q*28.+7.3));vec2 j=mix(hash2(w.xy),sm,.6);float a=j.x*PI;g=vec2(cos(a),sin(a));d=1100.+j.y*800.;mirror=.25;  // e-Card crystal: fine facets whose colours blend into their neighbours
  glint=pow(max(dot(normalize(vec3((hash2(w.xy)-.5)*.7,1.)),H),0.),160.)*.8;amp=.72;}
 else if(pat<3.5){g=normalize(vec2(1.,1.));d=1400.;lines=.5+.5*sin((px.x+px.y)*1.1);mirror=.3;amp=.8;}          // EX: fine diagonal lines
 else if(pat<4.5){}                                                                                              // broad sheen
 else if(pat<5.5){vec3 w=voro(q*170.);vec2 j=mix(hash2(w.xy*1.7),vec2(vnoise(q*22.),vnoise(q*22.+5.1)),.65);float a=j.x*PI;  // fine sparkle; neighbouring specks share their colourg=vec2(cos(a),sin(a));d=1000.+j.y*900.;mirror=.25;  // sparkle
  glint=pow(max(dot(normalize(vec3((hash2(w.xy*3.1)-.5)*.5,1.)),H),0.),300.)*.95;amp=.7;}
 else if(pat<6.5){float on=0.;for(int k=0;k<2;k++){float s=k==0?9.:17.;vec2 p=q*s,c=floor(p),f=fract(p)-.5-(hash2(c+float(k)*7.)-.5)*.4;  // cosmos circles
   float rad=.12+.26*hash(c+3.+float(k));float circ=1.-smoothstep(rad-.03,rad,length(f));if(circ>on){on=circ;float a=hash(c+9.)*PI;g=vec2(cos(a),sin(a));d=1050.+hash(c+5.)*900.;}}
  amp=mix(.45,1.4,on);mirror=.3;lines=on;}
 else if(pat<7.5){vec2 p=q*5.,c=floor(p),f=fract(p)-.5;float a=atan(f.y,f.x),rr=length(f);  // Legendary Collection firework
  g=normalize(f+1e-4);d=1200.+hash(c)*600.;float rays=pow(.5+.5*cos(a*18.+hash(c)*6.28),6.)*(1.-smoothstep(.15,.5,rr));lines=rays;amp=mix(.55,1.5,rays);mirror=.3;}
 else if(pat<8.5){mirror=.6;amp=.55;ex=10.;}                                                                    // plain mirror reverse
 else if(pat<10.5){vec2 b=ball(q,pat<9.5?7.:6.);float a=b.y>0.?.3:-.6;if(pat>9.5)a+=.9;g=mix(g,vec2(cos(a),sin(a)),b.x);  // Poké / Master Ball
  d=mix(1500.,b.y>0.?1150.:1350.,b.x);amp=mix(.35,1.35,b.x);lines=b.x;mirror=.3;
  if(pat>9.5){vec2 p=q*6.;p.x+=mod(floor(p.y),2.)*.5;vec2 f=fract(p)-.5;float bumps=(1.-smoothstep(.06,.08,length(f-vec2(-.15,-.12))))+(1.-smoothstep(.06,.08,length(f-vec2(.15,-.12))));glint=bumps*b.x*pow(max(H.z,0.),20.);}}
 else if(pat<11.5){float ph=height*55.,gr=sin(ph);vec2 gn=length(grad)>1e-4?normalize(grad):vec2(1.,0.);         // textured: contours of the art
  g=gn;d=1250.;lines=.5+.15*gr;N=normalize(N+vec3(gn*cos(ph)*.07,0.));mirror=.4;ex=24.;amp=.72;}
 else if(pat<12.5){g=normalize(vec2(-stroke.y,stroke.x)+1e-4);d=1350.;mirror=.35;amp=.7;}                       // texture that follows the brushwork
 else if(pat>13.5){float band=pow(.5+.5*sin((q.x+q.y)*5.5-(u_tilt.x+u_tilt.y)*4.5),3.);g=normalize(vec2(1.,1.));d=1500.;  // modern smooth 45° oil-slick band
  lines=band;amp=mix(.3,1.35,band);mirror=.45;ex=8.;}
 else{vec3 w=voro(q*200.);vec2 j=hash2(w.xy);float a=j.x*PI;g=vec2(cos(a),sin(a));d=1000.+j.y*900.;mirror=.2;    // shiny glitter
  glint=pow(max(dot(normalize(vec3((j-.5)*.5,1.)),H),0.),260.)*2.;amp=.7;}
 vec3 dif=grating(L,V,g,d,off)*amp;float spec=pow(max(dot(N,H),0.),ex);
 vec3 metal=tint<.5?vec3(1.):tint<1.5?vec3(1.,.74,.32):vec3(.86,.9,.96);
 vec3 col=tint<.5?dif*1.9:tint<1.5?metal*(.5*spot+.9*length(dif))*1.3:metal*(.6*spot+.5*length(dif))*1.3+dif*.25;
 return vec3(.18)*metal+spot*(mirror*spec*metal+col)*(.7+.3*lines)+glint*metal;
}
vec3 overInk(vec3 base,vec3 F,float cover){vec3 T=mix(base,base/max(max(base.r,max(base.g,base.b)),.04),.32);return mix(base,shoulder(T*F*1.35),clamp(cover,0.,1.));}
void main(){
 vec2 uv=vec2(v.x,1.-v.y);vec3 base=toLin(texture2D(u_card,v).rgb);vec4 mk=texture2D(u_mask,v),rl=texture2D(u_relief,v);
 // The cut-out behind a holo Pokémon is measured on a coarse grid: soften it so the foil tucks in behind
 // the art along its outline instead of stopping on a stepped edge. The frame's own edge (A) stays exact.
 vec2 bt=u_texel*1.5;mk.r=(mk.r*4.+texture2D(u_mask,v+vec2(bt.x,0.)).r+texture2D(u_mask,v-vec2(bt.x,0.)).r+texture2D(u_mask,v+vec2(0.,bt.y)).r+texture2D(u_mask,v-vec2(0.,bt.y)).r)/8.;
 vec2 lp=vec2(.5,.45)+u_tilt*.6;vec3 P=vec3(uv.x,uv.y*u_aspect,0.);
 vec3 L=normalize(vec3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(vec3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 vec2 dl=(uv-lp)*vec2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.3);
 vec2 e=u_texel*2.;vec2 grad=vec2(texture2D(u_relief,v+vec2(e.x,0.)).r-texture2D(u_relief,v-vec2(e.x,0.)).r,texture2D(u_relief,v-vec2(0.,e.y)).r-texture2D(u_relief,v+vec2(0.,e.y)).r);
 float rel=u_r1.w;vec3 N=normalize(vec3(-grad*rel*9.,1.));vec2 stroke=normalize(rl.gb*2.-1.+1e-4);
 // Coverage: the measured mask; behind a holo Pokémon only where the white underbase was left out.
 // The mask is measured at analysis resolution; its edge is re-sharpened so it stays as crisp as the CSS clip.
 float cov=smoothstep(.35,.65,mk.a)*mix(1.,mk.r,u_r1.z)*(1.-.5*u_r2.y*smoothstep(.52,.64,uv.y));
 vec3 F=foil(u_r1.x,u_r1.y,uv,L,V,N,spot,grad,rl.r,stroke)*(1.+mk.g*u_r1.z*.6);
 // Reverse holos print their text, symbols and outlines in opaque ink over the foil: dark ink stays solid
 // and the foil shows through the lighter areas only. (Holo windows and full arts keep their own rules.)
 float rev=(1.-step(.5,u_r1.z))*(1.-step(.5,u_r2.y)),ink=smoothstep(.03,.22,dot(base,vec3(.2126,.7152,.0722)));
 cov*=mix(1.,ink,rev);
 // Full-art cards print the illustration in heavy white-backed ink over the foil, so the art keeps half its
 // weight there; holo windows and reverse frames show the bare foil.
 vec3 outC=overInk(base,F,cov*mix(.92,.5,u_r2.y));
 if(rel>0.){float rim=pow(max(dot(N,H),0.),24.)*(.35+.65*spot)*clamp(length(grad)*30.,0.,1.);outC+=(1.-outC)*vec3(1.,.97,.92)*rim*rel*cov*.8;}
 if(u_r2.x>0.){vec2 sq=vec2(uv.x,uv.y*u_aspect)*70.,sc=floor(sq);vec2 j=hash2(sc);float on=step(1.-.22*u_r2.x,j.x);
  float pt=1.-smoothstep(.0,.1+.12*j.y,length(fract(sq)-.2-.6*hash2(sc*1.3)));
  float tw=pow(max(dot(normalize(vec3((hash2(sc+5.)-.5)*.6,1.)),H),0.),30.);outC+=on*pt*(.2+tw*3.)*cov*(.4+.6*spot)*vec3(1.,.97,.9);}
 // Outside the foil the canvas is clear, so the card shows through exactly as printed.
 float a=smoothstep(0.,.03,cov);gl_FragColor=vec4(toSrgb(clamp(outC,0.,1.))*a,a);
}`;
// Measured masks are CSS clip-path shapes; drawn once into the analysis grid as foil coverage.
export function maskShape(clip){
 const s=String(clip||'').trim(),num=v=>parseFloat(v)/100;
 if(s.startsWith('inset(')){const parts=s.slice(6,-1).split(/\s+round\s+/)[0].trim().split(/\s+/).map(num);const [t,r=t,b=t,l=r]=parts;return {rule:'nonzero',rings:[[[l,t],[1-r,t],[1-r,1-b],[l,1-b]]]};}
 if(!s.startsWith('polygon('))return null;
 let body=s.slice(8,-1),rule='nonzero';if(/^evenodd\s*,/.test(body)){rule='evenodd';body=body.replace(/^evenodd\s*,/,'');}
 const pts=body.split(',').map(p=>p.trim().split(/\s+/).map(num)).filter(p=>p.length===2&&p.every(Number.isFinite));
 return pts.length>2?{rule,rings:[pts]}:null;
}
export function shapeBox(shape){let x0=1,y0=1,x1=0,y1=0;for(const ring of shape.rings)for(const [x,y] of ring){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return [x0,y0,x1,y1];}
// The art window is the shape's inner box: for an evenodd surround, the hole it cuts out.
export function artBox(shape){if(shape.rule!=='evenodd')return shapeBox(shape);const pts=shape.rings[0],k=pts.findIndex((p,i)=>i>0&&p[0]===pts[0][0]&&p[1]===pts[0][1]);return k>0&&k<pts.length-3?shapeBox({rings:[pts.slice(k+1)]}):shapeBox(shape);}
// Illustration that breaks out of its window (a head over the name bar, a tail over the attack text)
// is printed ink, not reverse-holo frame. Learn the frame's colours away from the art, then grow from
// the window edge through pixels that do not match them; an opening removes thin window borders,
// which really are foil. Returns 0..1 per pixel. Pure.
export function artOverflow(rgba,W,H,box,{reach=.18,threshold=.16}={}){
 const N=W*H,out=new Float32Array(N),x0=Math.round(box[0]*W),y0=Math.round(box[1]*H),x1=Math.round(box[2]*W),y1=Math.round(box[3]*H);
 const inside=(x,y)=>x>=x0&&x<x1&&y>=y0&&y<y1,gap=(x,y)=>Math.max(x0-x,x-x1+1,y0-y,y-y1+1,0),c=k=>[rgba[k*4]/255,rgba[k*4+1]/255,rgba[k*4+2]/255];
 const samples=[];for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3)if(!inside(x,y)&&gap(x,y)>.05*W)samples.push(c(y*W+x));
 if(samples.length<12||x1-x0<8||y1-y0<8)return out;
 let C=Array.from({length:6},(_,k)=>samples[Math.floor((k+.5)*samples.length/6)].slice());
 for(let it=0;it<8;it++){const sum=C.map(()=>[0,0,0,0]);for(const p of samples){let b=0,bd=9;C.forEach((q,k)=>{const d=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(d<bd){bd=d;b=k;}});const t=sum[b];t[0]+=p[0];t[1]+=p[1];t[2]+=p[2];t[3]++;}
  C=sum.map((t,k)=>t[3]?[t[0]/t[3],t[1]/t[3],t[2]/t[3]]:C[k]);if(it===7)C=C.filter((_,k)=>sum[k][3]>=samples.length*.05);}
 const off=new Uint8Array(N);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(inside(x,y)||gap(x,y)>reach*H)continue;const p=c(y*W+x);let bd=9;for(const q of C)bd=Math.min(bd,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]));if(bd>threshold)off[y*W+x]=1;}
 // Grow from just outside the window edge through off-palette pixels.
 const seen=new Uint8Array(N),queue=[];
 for(let y=Math.max(0,y0-2);y<Math.min(H,y1+2);y++)for(let x=Math.max(0,x0-2);x<Math.min(W,x1+2);x++){const k=y*W+x;if(off[k]&&gap(x,y)<=2){seen[k]=1;queue.push(k);}}
 for(let q=0;q<queue.length;q++){const k=queue[q],x=k%W,y=(k-x)/W;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*W+nx;if(nx<0||ny<0||nx>=W||ny>=H||seen[n]||!off[n])continue;seen[n]=1;queue.push(n);}}
 // Opening (erode 2, dilate 3): thin frame lines vanish, real overflow survives with a soft edge.
 const morph=(src,r,keep)=>{const dst=new Uint8Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let all=1,any=0;for(let j=-r;j<=r&&(keep?all:!any);j++)for(let i=-r;i<=r;i++){const v=src[Math.min(H-1,Math.max(0,y+j))*W+Math.min(W-1,Math.max(0,x+i))];if(!v)all=0;else any=1;}dst[y*W+x]=keep?all:any;}return dst;};
 const opened=morph(morph(seen,2,true),3,false);
 for(let k=0;k<N;k++)if(opened[k]){const x=k%W,y=(k-x)/W;if(!inside(x,y))out[k]=1;}
 return out;
}
// e-Card holo rares stamp the e-Reader dashes down the left border in holo foil. In that strip, the dashes
// are whatever is not border yellow, so the foil follows each printed mark, softened at its edges.
export function ecardStrip(rgba,mask,W,H){
 const x1=Math.round(W*.085);
 for(let y=0;y<H;y++)for(let x=0;x<x1;x++){const k=(y*W+x)*4,r=rgba[k],g=rgba[k+1],b=rgba[k+2];
  const dash=Math.max(0,Math.min(1,(170-Math.min(r,g))/60))*(b<200?1:0);if(dash>0){mask[k+3]=Math.max(mask[k+3],Math.round(255*dash));mask[k]=255;}}
}
function coverage(shape,W,H){
 const c=(globalThis.document).createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';
 const path=new Path2D();for(const ring of shape.rings){ring.forEach(([px,py],i)=>i?path.lineTo(px*W,py*H):path.moveTo(px*W,py*H));path.closePath();}
 x.fill(path,shape.rule);return x.getImageData(0,0,W,H).data;
}
const analyze=foilAnalyzer(new URL('./ygo-foil-worker.js',import.meta.url),(data,W,H,{box})=>analyzeYgoArt(data,W,H,box));
let shared=null;
function renderer(doc){
 if(shared?.lost)return null;
 if(!shared)shared=foilProgram(doc,PTCG_FOIL_FRAGMENT,['u_card','u_mask','u_relief','u_tilt','u_px','u_texel','u_aspect','u_r1','u_r2'],{alpha:true});
 return shared;
}
// Returns a handle, or null when this surface keeps the CSS finish (unknown treatment or mask, no WebGL).
// clip: the CSS clip-path of the measured mask the CSS layer already uses (or none for full art).
export function mountPtcgFoil(overlay,img,treatment,{surface='detail',clip='',artClip=''}={}){
 const r=PTCG_FOIL_RECIPES[treatment];if(!r||!overlay||!img)return null;
 const shape=clip?maskShape(clip):{rule:'nonzero',rings:[[[0,0],[1,0],[1,1],[0,1]]]},art=artClip?maskShape(artClip):shape;if(!shape||!art)return null;
 const src=img.currentSrc||img.src;if(!src)return null;
 const box=r.underbase?artBox(art):[.1,.1,.9,.5],key=src+'|'+treatment+'|'+clip;
 const copy=()=>readableCopy(src);
 return mountFoilCanvas(overlay,{source:copy,key,surface,program:()=>renderer(overlay.ownerDocument),
  analysis:()=>copy().then(i=>analyze(src+'|'+box.join(),()=>readFoilPixels(i),{layout:'',box}).then(a=>{
   // Coverage is per mask, so it is stamped onto a copy of the cached analysis.
   const cov=coverage(shape,a.W,a.H),mask=a.mask.slice(),spill=shape.rule==='evenodd'?artOverflow(readFoilPixels(i).data,a.W,a.H,artBox(shape)):null;
   for(let k=3;k<mask.length;k+=4)mask[k]=Math.round(cov[k-3]*(spill?1-spill[(k-3)/4]:1));
   if(r.strip)ecardStrip(readFoilPixels(i).data,mask,a.W,a.H);return {...a,mask};})),
  setUniforms:({gl,U})=>{gl.uniform4f(U.u_r1,r.pat,r.tint,r.underbase,r.relief);gl.uniform4f(U.u_r2,r.sparkle,r.soft,0,0);}});
}
