// The app's Magic foil (ui/Foil.kt, AGSL) against the site's approved first foil (test-fixtures/finish-effects/mtg-foil-first-approved.glsl):
// both drawn from the same card pixels and the same measured maps, 1:1 with no resampling, the GLSL by WebGL in Chromium and the AGSL
// by Skia's own runtime-effect renderer (CanvasKit, CPU, the SkSL front end Android's RuntimeShader uses). Every recipe, three lights,
// on the real Avatar of Burgeoning Echoes scan. Software drawing on both sides: this proves the port draws what the site draws, not
// how a phone's GPU draws it or how fast.
// node scripts/check-foil-port.mjs [repo root]   (canvaskit-wasm from CANVASKIT_DIR, or resolvable from here; playwright resolvable)
// Exit 0: every recipe matches: within 2 of 255 on every pixel, or off by more than 1 on under 0.5% of pixels (oil slick: the two renderers
// round its grain cells' edges differently). 1: a recipe differs (printed). 2: no CanvasKit or browser to draw with.
// Not covered: the maps-not-loaded-yet fallback (u_maps 0) and facet foil's shards, both app only, and the security stamp (u_stamp,
// u_stampk, u_smask: left at zero here, so none is drawn; the stamp is the site's mtg-stamp.js, measured by MtgStampTest).
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';import {createRequire} from 'node:module';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||path.join(here,'..','..','..'));
const require=createRequire(import.meta.url);
let chromium,CK;
try{({chromium}=await import('playwright'));}catch{try{({chromium}=require(require.resolve('playwright',{paths:[process.cwd(),'/opt/node-tools/node_modules']})));}catch{console.log('no playwright');process.exit(2);}}
try{CK=await require(process.env.CANVASKIT_DIR?path.join(process.env.CANVASKIT_DIR,'bin','canvaskit.js'):'canvaskit-wasm')();}catch{console.log('no canvaskit-wasm: set CANVASKIT_DIR to its folder');process.exit(2);}
const kt=readFileSync(path.join(here,'..','app','src','main','java','dev','cardstashy','nativeplay','ui','Foil.kt'),'utf8');
const AGSL=kt.match(/const val AGSL = """([\s\S]*?)"""/)[1];
const REF=readFileSync(path.join(root,'test-fixtures','finish-effects','mtg-foil-first-approved.glsl'),'utf8');
const PICTURE='/test-fixtures/finish-effects/avatar-of-burgeoning-echoes-pfra-122p.jpg';
const LIGHTS=[[.5,.45],[.22,.25],[.76,.72]];
// WIDTH: the card's width in px (372 by default; a phone's card view is about 1080, where the fine etched, rainbow-line and scanline
// detail is drawn instead of faded out). NL: how many of the lights to draw. Both slow CanvasKit down with size.
const WIDTH=+(process.env.WIDTH||372),NL=Math.min(LIGHTS.length,+(process.env.NL||LIGHTS.length));
const page_js=`
window.run=async(pic,ref,lights,width)=>{
 const {MTG_FOIL_RECIPES}=await import('/mtg-foil-recipes.js'),{analyzeMtgCard,MTG_FRAMES}=await import('/mtg-foil-analysis.js'),{readFoilPixels}=await import('/foil-gl.js');
 const img=new Image();img.src=pic;await img.decode();
 // The site's own reader below its cap (half the scan's width); above it, the scan drawn at that width, as a phone shows it.
 const px=width<=img.naturalWidth/2?readFoilPixels(img,width):(()=>{const W=width,H=Math.round(W*img.naturalHeight/img.naturalWidth),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);return {W,H,data:x.getImageData(0,0,W,H).data};})();
 const W=px.W,H=px.H,an=analyzeMtgCard(px.data,W,H);
 const c=document.createElement('canvas');c.width=W;c.height=H;const gl=c.getContext('webgl',{antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(o));return o;};
 const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 v;void main(){v=(a+1.0)*.5;gl_Position=vec4(a,0.0,1.0);}'));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,ref));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);gl.useProgram(p);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 const tex=(unit,bytes)=>{gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);for(const [k,v] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST]])gl.texParameteri(gl.TEXTURE_2D,k,v);};
 const card=new Uint8Array(px.data);for(let i=3;i<card.length;i+=4)card[i]=255;
 tex(0,card);tex(1,new Uint8Array(an.mask));tex(2,new Uint8Array(an.relief));
 const U=n=>gl.getUniformLocation(p,n);gl.uniform1i(U('u_card'),0);gl.uniform1i(U('u_mask'),1);gl.uniform1i(U('u_relief'),2);gl.viewport(0,0,W,H);
 const b64=a=>{let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);};
 const box=MTG_FRAMES['2015'],out={};
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES)){out[k]=[];for(const [lx,ly] of lights){
  gl.uniform2f(U('u_tilt'),(lx-.5)*2,(ly-.5)*2);gl.uniform2f(U('u_px'),W,H);gl.uniform2f(U('u_texel'),1/W,1/H);gl.uniform1f(U('u_aspect'),H/W);
  gl.uniform4f(U('u_art'),...box.art);gl.uniform4f(U('u_text'),...box.text);gl.uniform4f(U('u_r1'),r.pat,r.tint,r.cover,r.relief);gl.uniform4f(U('u_r2'),r.film,r.sparkle,r.stamp||0,r.keep||0);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);const b=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);
  const f=new Uint8Array(W*H*4);for(let j=0;j<H;j++)f.set(b.subarray((H-1-j)*W*4,(H-j)*W*4),j*W*4);out[k].push(b64(f));}}
 return {W,H,card:b64(card),mask:b64(new Uint8Array(an.mask)),relief:b64(new Uint8Array(an.relief)),recipes:MTG_FOIL_RECIPES,box,out};
};window.ready=true;`;
const html=`<!doctype html><script type="module">${page_js}</script>`;
const types={'.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://x').pathname);if(path==='/')return res.end(html);
 const body=await readFile(resolve(root,'.'+path));res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(body);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let R;try{const pg=await browser.newPage();pg.on('pageerror',e=>console.log('page',e));await pg.goto(`http://127.0.0.1:${server.address().port}/`);await pg.waitForFunction(()=>window.ready);
 R=await pg.evaluate(([p,ref,l,w])=>window.run(p,ref,l,w),[PICTURE,REF,LIGHTS.slice(0,NL),WIDTH]);}finally{await browser.close();server.close();}
const dec=s=>Uint8Array.from(Buffer.from(s,'base64'));const {W,H}=R;const card=dec(R.card),mask=dec(R.mask),rel=dec(R.relief);
const appMask=new Uint8Array(W*H*4),appRel=new Uint8Array(W*H*4),blank=new Uint8Array(W*H*4);
for(let i=0;i<W*H;i++){const k=i*4;appMask.set([mask[k],mask[k+1],mask[k+2],255],k);appRel.set([rel[k],mask[k+3],0,255],k);blank[k+3]=255;}
const info={width:W,height:H,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Premul,colorSpace:CK.ColorSpace.SRGB};
const shaderOf=b=>CK.MakeImage(info,b,W*4).makeShaderOptions(CK.TileMode.Clamp,CK.TileMode.Clamp,CK.FilterMode.Nearest,CK.MipmapMode.None);
let err='';const fx=CK.RuntimeEffect.Make(AGSL,e=>err+=e);if(!fx){console.log('AGSL FAIL',err);process.exit(1);}
const kids=[shaderOf(card),shaderOf(appMask),shaderOf(appRel),shaderOf(blank),shaderOf(blank)];
while(kids.length<(AGSL.match(/uniform shader /g)||[]).length)kids.push(shaderOf(blank)); // u_smask: no stamp measured
const surf=CK.MakeSurface(W,H);const cv=surf.getCanvas();const paint=new CK.Paint();
const report={};let worst=0;
const ONLY=process.env.ONLY?process.env.ONLY.split(','):null;
for(const [k,r] of Object.entries(R.recipes)){if(ONLY&&!ONLY.includes(k))continue;report[k]=[];R.out[k].slice(0,NL).forEach((ref64,li)=>{const [lx,ly]=LIGHTS[li];
 const u=[W,H,W,H,(lx-.5)*2,(ly-.5)*2,H/W,1,W,H,1,...R.box.art,...R.box.text,r.pat,r.tint,r.cover,r.relief,r.film,r.sparkle,r.stamp||0,r.keep||0];
 while(u.length<fx.getUniformFloatCount())u.push(0); // u_stamp, u_stampk: zero, no stamp
 const s=fx.makeShaderWithChildren(u,kids);paint.setShader(s);cv.clear(CK.TRANSPARENT);cv.drawRect(CK.LTRBRect(0,0,W,H),paint);s.delete();
 const got=cv.readPixels(0,0,{width:W,height:H,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});const ref=dec(ref64);
 let max=0,over2=0;for(let i=0;i<W*H;i++){let m=0;for(let c=0;c<3;c++)m=Math.max(m,Math.abs(got[i*4+c]-ref[i*4+c]));if(m>max)max=m;if(m>1)over2++;}
 report[k].push({max,over1:+(over2/(W*H)).toFixed(5)});worst=Math.max(worst,max);
});}
const same=v=>v.every(x=>x.max<=2||x.over1<.005);
for(const [k,v] of Object.entries(report))console.log(`${same(v)?'ok  ':'DIFF'} ${k.padEnd(18)} largest ${Math.max(...v.map(x=>x.max))}/255, pixels off by more than 1: ${(100*Math.max(...v.map(x=>x.over1))).toFixed(3)}%`);
console.log(`${W}x${H}, worst ${worst}/255`);process.exit(Object.values(report).every(same)?0:1);
