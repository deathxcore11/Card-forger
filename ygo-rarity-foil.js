// Yu-Gi-Oh! rarity art foil, rendered with WebGL for full-size cards (card page, zoom, and Large
// gallery cards in collections, binders and decks). Foil is simulated under the ink: unlit it reads
// as dark metal; colour appears where a reflection grating sends light toward the viewer, so bands
// travel as the light moves. One shared WebGL context draws every card into ordinary 2D canvases
// (browsers cap live contexts at roughly 8-16). Approximate simulation, not a physical-foil capture.
import {analyzeYgoArt,YGO_ART_BOX} from './ygo-foil-analysis.js';
export const YGO_RARITY_KIND={'ygo-super':1,'ygo-ultra':2,'ygo-secret':3,'ygo-prismatic':4,'ygo-starlight':5};
export const YGO_TEXT_BOX=[.075,.735,.925,.955];
// Full-size only: medium and small gallery tiles keep the lighter CSS finish.
export const YGO_FULL_SIZE_PX=260;
export function ygoFoilFullSize(surface,width,gridSize){
 if(surface==='detail'||surface==='zoom')return true;
 return surface==='large'&&(gridSize==='large'||width>=YGO_FULL_SIZE_PX);
}
const VS='attribute vec2 a;varying vec2 v;void main(){v=(a+1.0)*.5;gl_Position=vec4(a,0.0,1.0);}';
export const YGO_RARITY_FRAGMENT=`precision highp float;
varying vec2 v;
uniform sampler2D u_card;uniform sampler2D u_mask;uniform sampler2D u_relief;
uniform vec2 u_tilt;uniform vec2 u_px;uniform vec2 u_texel;uniform float u_aspect;uniform float u_kind;
uniform vec4 u_art;uniform vec4 u_text;
const float PI=3.14159265;
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float hash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
vec2 hash2(vec2 p){return vec2(hash(p),hash(p+17.31));}
float inBox(vec2 p,vec4 b){return step(b.x,p.x)*step(p.x,b.z)*step(b.y,p.y)*step(p.y,b.w);}
vec3 spectrum(float l){
 vec3 c=vec3(exp(-pow((l-600.)/70.,2.))+.35*exp(-pow((l-440.)/30.,2.)),exp(-pow((l-540.)/60.,2.)),exp(-pow((l-455.)/40.,2.)));
 return c*smoothstep(380.,420.,l)*(1.-smoothstep(700.,750.,l));
}
// Reflection grating: light reaching the eye satisfies (L+V)·g = mλ/d along the grating vector g.
vec3 grating(vec3 L,vec3 V,vec2 g,float d){
 float s=abs(dot(L.xy+V.xy,g));vec3 c=vec3(0.);
 for(int m=1;m<=3;m++)c+=spectrum(d*s/float(m))/float(m);
 return c;
}
vec3 shoulder(vec3 x){vec3 e=max(x-.82,0.);return min(x,.82)+.18*e/(e+.18);}
void main(){
 vec2 uv=vec2(v.x,1.-v.y);
 vec3 base=toLin(texture2D(u_card,v).rgb);vec4 mk=texture2D(u_mask,v);
 float art=inBox(uv,u_art),text=inBox(uv,u_text),K=u_kind;
 vec2 lp=vec2(.5,.45)+u_tilt*.6;vec3 P=vec3(uv.x,uv.y*u_aspect,0.);
 vec3 L=normalize(vec3(lp.x,lp.y*u_aspect,.85)-P),V=normalize(vec3(.5,.5*u_aspect,2.2)-P),H=normalize(L+V);
 vec2 dl=(uv-lp)*vec2(1.,u_aspect);float spot=exp(-dot(dl,dl)/.28);
 float cover=art*mk.r,energy=mk.g,lines=0.,glint=0.,mirror=.55,period=1500.,expo=60.;vec2 g=vec2(1.,0.);
 vec2 px=uv*u_px; // screen pixels: groove textures never get finer than the display
 if(K<2.5){ // Super / Ultra: fine vertical grooves, smooth liquid sheen
  period=1350.;lines=.5+.5*sin(px.x*2.0944);mirror=.7;expo=14.;
 }else if(K<3.5){ // Secret: 45° grooves in stair-step segments that ignite in turn
  vec2 r=vec2(uv.x+uv.y*u_aspect,uv.x-uv.y*u_aspect);vec2 j=hash2(floor(r*vec2(90.,22.)));
  float a=PI*.25+(j.x-.5)*.16;g=vec2(cos(a),-sin(a));period=1250.+j.y*450.;lines=.5+.5*sin((px.x+px.y)*1.5708);mirror=.35;
 }else if(K<4.5){ // Prismatic Secret: checkerboard of vertical / horizontal grating cells
  vec2 q=vec2(uv.x,uv.y*u_aspect)*72.,cell=floor(q),f=fract(q);g=mod(cell.x+cell.y,2.)<.5?vec2(1.,0.):vec2(0.,1.);period=1150.+hash(cell)*600.;
  lines=smoothstep(0.,.12,f.x)*smoothstep(0.,.12,f.y)*smoothstep(1.,.88,f.x)*smoothstep(1.,.88,f.y);mirror=.3;
 }else{ // Starlight: whole-card glitter, each facet its own grating and mirror
  vec2 q=vec2(uv.x,uv.y*u_aspect)*150.,n=floor(q),f=fract(q);float md=8.;vec2 id=n;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),h=hash2(n+o),r=o+h-f;float dd=dot(r,r);if(dd<md){md=dd;id=n+o;}}
  vec2 j=hash2(id*1.7);float a=j.x*PI;g=vec2(cos(a),sin(a));period=1000.+j.y*900.;
  glint=pow(max(dot(normalize(vec3((hash2(id*3.1)-.5)*.5,1.)),H),0.),400.)*3.;
  cover=max(max(cover,art*.35),(1.-art)*(1.-text*.55)*.75);mirror=.25;
 }
 float spec=pow(max(H.z,0.),expo);
 vec3 F=vec3(.2)+spot*(mirror*spec+grating(L,V,g,period)*(1.9+energy*1.2))*(.7+.3*lines)+glint;
 // Ink printed over foil: thin inks let part of the foil through, brightened toward the ink's own
 // hue so a teal sky stays teal. Highlights roll off softly instead of clipping.
 vec3 T=mix(base,base/max(max(base.r,max(base.g,base.b)),.04),.32);
 vec3 outC=mix(base,shoulder(T*F*1.35),clamp(cover,0.,1.));
 if(K>4.5&&mk.b>.3){ // Starlight: level stars and attribute catch the light too
  vec2 e=u_texel*2.;
  float hx=texture2D(u_relief,v+vec2(e.x,0.)).r-texture2D(u_relief,v-vec2(e.x,0.)).r,hy=texture2D(u_relief,v-vec2(0.,e.y)).r-texture2D(u_relief,v+vec2(0.,e.y)).r;
  float s=pow(max(dot(normalize(vec3(-hx*6.,-hy*6.,1.)),H),0.),30.)*(.3+.7*spot);outC+=(1.-outC)*vec3(1.,.9,.6)*s*.9;
 }
 gl_FragColor=vec4(toSrgb(clamp(outC,0.,1.)),1.);
}`;
// ---- analysis (worker when available) ----
const analyses=new Map();let worker=null,workerFailed=false,seq=0;const pending=new Map();
function getWorker(){
 if(worker||workerFailed||typeof Worker==='undefined')return worker;
 try{worker=new Worker(new URL('./ygo-foil-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data);};
  worker.onerror=()=>{workerFailed=true;worker=null;for(const p of pending.values())p.retry();pending.clear();};
 }catch{workerFailed=true;worker=null;}
 return worker;
}
// Reads the card at analysis size. Cross-origin (tainted) images throw, which keeps the CSS finish.
function readPixels(img){
 const W=Math.max(64,Math.min(406,Math.round(img.naturalWidth/2))),H=Math.round(W*img.naturalHeight/img.naturalWidth);
 const c=img.ownerDocument.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);
 return {W,H,data:x.getImageData(0,0,W,H).data};
}
export function analyzeCardImage(img){
 const src=img?.currentSrc||img?.src||'';if(!src||!img.naturalWidth)return Promise.reject(Error('image not ready'));
 if(analyses.has(src))return analyses.get(src);
 const job=(async()=>{
  const {W,H,data}=readPixels(img);
  const local=()=>{const r=analyzeYgoArt(data,W,H);return {W,H,mask:r.mask,relief:r.relief};};
  const w=getWorker();if(!w)return local();
  return new Promise((resolve,reject)=>{const id=++seq,copy=data.slice().buffer;
   pending.set(id,{resolve:m=>resolve({W,H,mask:new Uint8ClampedArray(m.mask),relief:new Uint8ClampedArray(m.relief)}),reject,retry:()=>{try{resolve(local());}catch(e){reject(e);}}});
   w.postMessage({id,width:W,height:H,pixels:copy},[copy]);});
 })();
 job.catch(()=>analyses.delete(src));
 if(analyses.size>=32)analyses.delete(analyses.keys().next().value);
 analyses.set(src,job);return job;
}
// ---- shared renderer ----
let shared=null;
function renderer(doc){
 if(shared?.lost)return null;if(shared)return shared;
 const canvas=doc.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false});if(!gl)return null;
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null;};
 const vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,YGO_RARITY_FRAGMENT);if(!vs||!fs)return null;
 const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;
 gl.useProgram(prog);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const U={};for(const n of ['u_card','u_mask','u_relief','u_tilt','u_px','u_texel','u_aspect','u_kind','u_art','u_text'])U[n]=gl.getUniformLocation(prog,n);
 gl.uniform1i(U.u_card,0);gl.uniform1i(U.u_mask,1);gl.uniform1i(U.u_relief,2);gl.uniform4f(U.u_art,...YGO_ART_BOX);gl.uniform4f(U.u_text,...YGO_TEXT_BOX);
 shared={canvas,gl,U,maps:new Map(),cards:new Map(),lost:false};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();shared.lost=true;for(const h of handles)h.fallback();});
 return shared;
}
const pot=n=>2**Math.max(5,Math.round(Math.log2(n)));
function texture(gl,source,mip){
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 if(mip){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}
 else{gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);}
 return t;
}
function lru(map,key,make,limit,gl){if(map.has(key)){const v=map.get(key);map.delete(key);map.set(key,v);return v;}
 while(map.size>=limit){const [k,v]=map.entries().next().value;for(const t of [].concat(v))gl.deleteTexture(t);map.delete(k);}
 const v=make();map.set(key,v);return v;}
// Data maps use power-of-two mipmaps (smooth at any size). The card image is resampled once per
// display size by the browser's own scaler and sampled 1:1, so it is exactly as sharp as the <img>.
function bindTextures(r,img,a,w,h){
 const {gl}=r,src=img.currentSrc||img.src,doc=img.ownerDocument;
 const maps=lru(r.maps,src,()=>[a.mask,a.relief].map(bytes=>{
  const c=doc.createElement('canvas');c.width=a.W;c.height=a.H;c.getContext('2d').putImageData(new ImageData(bytes,a.W,a.H),0,0);
  const p=doc.createElement('canvas');p.width=pot(a.W);p.height=pot(a.H);const x=p.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(c,0,0,p.width,p.height);return texture(gl,p,true);}),12,gl);
 const card=lru(r.cards,src+'|'+w+'x'+h,()=>{const c=doc.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);return texture(gl,c,false);},8,gl);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,card);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,maps[0]);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,maps[1]);
}
// ---- mounted surfaces ----
const handles=new Set();let ticking=0;
function tick(){ticking=0;let again=false;for(const h of handles){h.draw();if(h.animated())again=true;}if(again)ticking=requestAnimationFrame(tick);}
const kick=()=>{if(!ticking&&typeof requestAnimationFrame!=='undefined')ticking=requestAnimationFrame(tick);};
// Returns a handle, or null when this surface keeps the CSS finish (unsupported rarity, no WebGL).
// The CSS layers stay underneath and come back automatically if the card shrinks or analysis fails.
export function mountYgoRarityFoil(overlay,img,effect,{surface='detail',gridSize=()=>globalThis.document?.documentElement?.dataset.gridSize}={}){
 const kind=YGO_RARITY_KIND[effect];if(!kind||!overlay||!img)return null;
 const doc=overlay.ownerDocument;if(!renderer(doc))return null;
 const canvas=doc.createElement('canvas');canvas.className='finish-rarity-gl';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;overlay.prepend(canvas);
 let analysis=null,last='',dead=false;
 const pct=v=>{const n=parseFloat(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n))/100:.5;};
 const active=()=>!dead&&analysis&&!shared?.lost&&ygoFoilFullSize(surface,overlay.clientWidth,gridSize());
 const h={
  draw(){
   if(!active()){if(!canvas.hidden){canvas.hidden=true;overlay.classList.remove('rarity-gl');}return;}
   const r=shared,dpr=Math.min(2,globalThis.devicePixelRatio||1),w=Math.max(1,Math.min(1600,Math.round(overlay.clientWidth*dpr))),hh=Math.max(1,Math.round(w*img.naturalHeight/img.naturalWidth));
   const css=globalThis.getComputedStyle?.(overlay),lx=pct(css?.getPropertyValue('--finish-x')),ly=pct(css?.getPropertyValue('--finish-y')),key=[lx.toFixed(4),ly.toFixed(4),w,hh,img.currentSrc].join();
   if(key===last&&!canvas.hidden)return;last=key;
   const {gl,U}=r;if(r.canvas.width!==w||r.canvas.height!==hh){r.canvas.width=w;r.canvas.height=hh;}
   bindTextures(r,img,analysis,w,hh);
   gl.viewport(0,0,w,hh);gl.uniform2f(U.u_tilt,(lx-.5)*2,(ly-.5)*2);gl.uniform2f(U.u_px,w,hh);gl.uniform2f(U.u_texel,1/analysis.W,1/analysis.H);gl.uniform1f(U.u_aspect,img.naturalHeight/img.naturalWidth);gl.uniform1f(U.u_kind,kind);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(canvas.width!==w||canvas.height!==hh){canvas.width=w;canvas.height=hh;}
   canvas.getContext('2d').drawImage(r.canvas,0,0);
   if(canvas.hidden){canvas.hidden=false;overlay.classList.add('rarity-gl');}
  },
  // Gallery cards sweep their light with a CSS animation; follow it only while one is running.
  animated:()=>!dead&&!canvas.hidden&&overlay.classList.contains('finish-auto')&&overlay.isConnected,
  fallback(){canvas.hidden=true;overlay.classList.remove('rarity-gl');},
  dispose(){dead=true;handles.delete(h);mo?.disconnect();ro?.disconnect();canvas.remove();overlay.classList.remove('rarity-gl');}
 };
 handles.add(h);
 // Light coordinates are inline custom properties set on an ancestor (pointer, gyro, zoom).
 const mo=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>h.draw());
 for(let n=overlay.parentElement;n&&n!==doc.documentElement;n=n.parentElement)mo?.observe(n,{attributes:true,attributeFilter:['style','class']});
 mo?.observe(doc.documentElement,{attributes:true,attributeFilter:['data-grid-size']});
 const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{h.draw();kick();});ro?.observe(overlay);
 analyzeCardImage(img).then(a=>{if(dead)return;analysis=a;h.draw();kick();}).catch(()=>{});
 return h;
}
