// Shared WebGL plumbing for the foil renderers (Yu-Gi-Oh! rarity foil, Magic foil): data-map upload,
// texture caches, analysis worker, canvas lifecycle and one throttled redraw loop for every card.
// Every finish surface draws the WebGL foil: the card page, zoom, gallery cards at every size and
// cards pulled in the pack opener.
// The lighter CSS finish is only the fallback when WebGL or the card's analysis is unavailable.
export const FOIL_SURFACES=['detail','zoom','large','pack','today'];
export const foilSurface=surface=>FOIL_SURFACES.includes(surface);
export const FOIL_VS='attribute vec2 a;varying vec2 v;void main(){v=(a+1.0)*.5;gl_Position=vec4(a,0.0,1.0);}';
// One full-screen quad program; returns null when the context or shader is unavailable.
// alpha: the fragment writes premultiplied coverage, so unfoiled pixels stay the page's own <img>.
export function foilProgram(doc,fragment,uniforms,{alpha=false}={}){
 const canvas=doc.createElement('canvas'),gl=canvas.getContext('webgl',{alpha,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:false});if(!gl)return null;
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null;};
 const vs=sh(gl.VERTEX_SHADER,FOIL_VS),fs=sh(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs)return null;
 const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;
 gl.useProgram(prog);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const U={};for(const n of uniforms)U[n]=gl.getUniformLocation(prog,n);
 gl.uniform1i(U.u_card,0);gl.uniform1i(U.u_mask,1);gl.uniform1i(U.u_relief,2);
 const r={canvas,gl,U,maps:new Map(),cards:new Map(),handles:new Set(),lost:false};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();r.lost=true;for(const h of r.handles)h.fallback();});
 return r;
}
const pot=n=>2**Math.max(5,Math.round(Math.log2(n)));
// Data maps carry independent values in all four channels, so they are resampled here: a 2D canvas
// would premultiply by alpha and corrupt them. Power-of-two size lets WebGL 1 build mipmaps.
export function potData(d,w,h){const W=pot(w),H=pot(h),o=new ImageData(W,H);
 for(let j=0;j<H;j++){const y=Math.min(h-1.001,Math.max(0,(j+.5)*h/H-.5)),y0=Math.floor(y),fy=y-y0;
  for(let i=0;i<W;i++){const x=Math.min(w-1.001,Math.max(0,(i+.5)*w/W-.5)),x0=Math.floor(x),fx=x-x0,k=(j*W+i)*4,a=(y0*w+x0)*4,b=a+4,c=a+w*4,e=c+4;
   for(let q=0;q<4;q++)o.data[k+q]=(d[a+q]*(1-fx)+d[b+q]*fx)*(1-fy)+(d[c+q]*(1-fx)+d[e+q]*fx)*fy;}}
 return o;}
export function foilTexture(gl,source,mip){
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 if(mip){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}
 else{gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);}
 return t;
}
export function foilLru(map,key,make,limit,gl){if(map.has(key)){const v=map.get(key);map.delete(key);map.set(key,v);return v;}
 while(map.size>=limit){const [k,v]=map.entries().next().value;for(const t of [].concat(v))gl.deleteTexture(t);map.delete(k);}
 const v=make();map.set(key,v);return v;}
// Data maps use power-of-two mipmaps (smooth at any size). The card image is resampled once per
// display size by the browser's own scaler and sampled 1:1, so it is exactly as sharp as the <img>.
export function bindFoilTextures(r,img,a,w,h,key){
 const {gl}=r,doc=globalThis.document||img.ownerDocument;
 const maps=foilLru(r.maps,key,()=>[a.mask,a.relief].map(bytes=>foilTexture(gl,potData(bytes,a.W,a.H),true)),12,gl);
 const card=foilLru(r.cards,key+'|'+w+'x'+h,()=>{const c=doc.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);return foilTexture(gl,c,false);},8,gl);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,card);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,maps[0]);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,maps[1]);
}
// One redraw loop for every mounted foil. Gallery light sweeps redraw at most ~30 times a second, and
// ~15 once more than 12 sweeping cards are on screen (Small grids), so phones stay smooth; pointer and
// gyro changes draw on the next frame.
const handles=new Set();let ticking=0,lastSweep=0;
function tick(now=0){ticking=0;let again=false,sweeping=0;for(const h of handles)if(h.animated())sweeping++;
 const sweep=now-lastSweep>=(sweeping>12?64:32);if(sweep)lastSweep=now;
 for(const h of handles){const anim=h.animated();if(anim)again=true;if(!anim||sweep)h.draw();}
 if(again)ticking=requestAnimationFrame(tick);}
export const foilLoop={
 add(h){handles.add(h);},delete(h){handles.delete(h);},
 kick(){if(!ticking&&typeof requestAnimationFrame!=='undefined')ticking=requestAnimationFrame(tick);}
};
// Redraw when the light moves (inline custom properties set on an ancestor by pointer, gyro and zoom)
// or the card changes size (gallery size setting, rotation).
export function watchFoilLight(overlay,draw){
 const doc=overlay.ownerDocument,mo=typeof MutationObserver==='undefined'?null:new MutationObserver(draw);
 for(let n=overlay.parentElement;n&&n!==doc.documentElement;n=n.parentElement)mo?.observe(n,{attributes:true,attributeFilter:['style','class']});
 mo?.observe(doc.documentElement,{attributes:true,attributeFilter:['data-grid-size']});
 const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{draw();foilLoop.kick();});ro?.observe(overlay);
 return ()=>{mo?.disconnect();ro?.disconnect();};
}
export const foilLight=overlay=>{const css=globalThis.getComputedStyle?.(overlay),pct=v=>{const n=parseFloat(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n))/100:.5;};
 return [pct(css?.getPropertyValue('--finish-x')),pct(css?.getPropertyValue('--finish-y'))];};
// Reads the card at analysis size. Cross-origin (tainted) images throw, which keeps the CSS finish.
// Scryfall and TCGdex serve card images with open CORS, but the app's <img> tags load them without it,
// so their pixels are not readable. A foil loads its own CORS copy of the same image for analysis and drawing.
const copies=new Map();
export function readableCopy(src){
 if(copies.has(src))return copies.get(src);
 const job=new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.decoding='async';i.onload=()=>resolve(i);i.onerror=()=>reject(Error('image unavailable'));i.src=src;});
 job.catch(()=>copies.delete(src));
 if(copies.size>=24)copies.delete(copies.keys().next().value);
 copies.set(src,job);return job;
}
export function readFoilPixels(img,maxWidth=406){
 const W=Math.max(64,Math.min(maxWidth,Math.round(img.naturalWidth/2))),H=Math.round(W*img.naturalHeight/img.naturalWidth);
 const c=(globalThis.document||img.ownerDocument).createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);
 return {W,H,data:x.getImageData(0,0,W,H).data};
}
// Per-card analysis, once per image: in a module worker when available (large galleries keep
// scrolling smoothly), else on the main thread. Results are cached for the 32 most recent cards.
export function foilAnalyzer(workerUrl,local){
 const cache=new Map(),pending=new Map();let worker=null,failed=false,seq=0;
 const get=()=>{
  if(worker||failed||typeof Worker==='undefined')return worker;
  try{worker=new Worker(workerUrl,{type:'module'});
   worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data);};
   worker.onerror=()=>{failed=true;worker=null;for(const p of pending.values())p.retry();pending.clear();};
  }catch{failed=true;worker=null;}
  return worker;
 };
 return (key,read,options={})=>{
  if(cache.has(key))return cache.get(key);
  const job=(async()=>{
   const {W,H,data}=read(),run=()=>{const r=local(data,W,H,options);return {W,H,mask:r.mask,relief:r.relief};};
   const w=get();if(!w)return run();
   return new Promise((resolve,reject)=>{const id=++seq,copy=data.slice().buffer;
    pending.set(id,{resolve:m=>resolve({W,H,mask:new Uint8ClampedArray(m.mask),relief:new Uint8ClampedArray(m.relief)}),reject,retry:()=>{try{resolve(run());}catch(e){reject(e);}}});
    w.postMessage({id,width:W,height:H,pixels:copy,...options},[copy]);});
  })();
  job.catch(()=>cache.delete(key));
  if(cache.size>=32)cache.delete(cache.keys().next().value);
  cache.set(key,job);return job;
 };
}
// Mounts a WebGL foil canvas over a card overlay. program() returns the shared renderer (or null),
// source() and analysis() resolve to the image to draw and its data maps, setUniforms(renderer) fills
// in the recipe. While the card is analysed it shows plain (no placeholder shine); the CSS layers
// return only if the context is lost or analysis fails. Returns a handle, or null when this surface
// keeps the CSS finish.
export function mountFoilCanvas(overlay,{source,key,surface='detail',program,analysis,setUniforms}){
 if(!foilSurface(surface))return null;
 const r0=program();if(!r0)return null;
 const doc=overlay.ownerDocument,canvas=doc.createElement('canvas');canvas.className='finish-rarity-gl';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;overlay.prepend(canvas);
 overlay.classList.add('rarity-gl');
 let data=null,img=null,last='',dead=false;
 const fail=()=>{canvas.hidden=true;overlay.classList.remove('rarity-gl');};
 const h={
  draw(){
   if(dead||!data||!img?.naturalWidth)return;if(r0.lost)return fail();
   const dpr=Math.min(2,globalThis.devicePixelRatio||1),w=Math.max(1,Math.min(1600,Math.round(overlay.clientWidth*dpr))),hh=Math.max(1,Math.round(w*img.naturalHeight/img.naturalWidth));
   const [lx,ly]=foilLight(overlay),id=[lx.toFixed(4),ly.toFixed(4),w,hh,key].join();
   if(id===last&&!canvas.hidden)return;last=id;
   const {gl,U}=r0;if(r0.canvas.width!==w||r0.canvas.height!==hh){r0.canvas.width=w;r0.canvas.height=hh;}
   bindFoilTextures(r0,img,data,w,hh,key);
   gl.viewport(0,0,w,hh);gl.uniform2f(U.u_tilt,(lx-.5)*2,(ly-.5)*2);gl.uniform2f(U.u_px,w,hh);gl.uniform2f(U.u_texel,1/data.W,1/data.H);gl.uniform1f(U.u_aspect,img.naturalHeight/img.naturalWidth);
   setUniforms(r0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   if(canvas.width!==w||canvas.height!==hh){canvas.width=w;canvas.height=hh;}
   const out=canvas.getContext('2d');out.clearRect(0,0,w,hh);out.drawImage(r0.canvas,0,0);
   canvas.hidden=false;
  },
  // Gallery cards sweep their light with a CSS animation; follow it only while one is running.
  animated:()=>!dead&&!canvas.hidden&&overlay.classList.contains('finish-auto')&&overlay.isConnected,
  fallback:fail,
  dispose(){dead=true;foilLoop.delete(h);r0.handles.delete(h);unwatch();canvas.remove();overlay.classList.remove('rarity-gl');}
 };
 foilLoop.add(h);r0.handles.add(h);
 const unwatch=watchFoilLight(overlay,()=>h.draw());
 Promise.all([source(),analysis()]).then(([s,a])=>{if(dead)return;img=s;data=a;h.draw();foilLoop.kick();}).catch(()=>{if(!dead)fail();});
 return h;
}
