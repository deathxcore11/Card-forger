// The app's Magic foil (ui/Foil.kt: AGSL_HEAD + AGSL_TEMPLATE + AGSL_MAIN, composed per foil type by Foil.compose) against the site's
// (mtg-foil-shader.js mtgFoilFragment, the owner-approved Foil Test Bench look of 16 Nov 2026): both drawn from the same card pixels
// and the same per-card maps (mtg-foil-analysis.js mtgCardMaps: inks, silver scroll plates, gold window, facets, emblem, boxes, the
// scan's own star), 1:1 with no resampling, the GLSL by WebGL in Chromium and the AGSL by Skia's own runtime-effect renderer
// (CanvasKit, CPU, the SkSL front end Android's RuntimeShader uses). Every recipe, three lights, on a real scan: the Avatar of
// Burgeoning Echoes promo for most, and the foil's own card where its maps need one (silver scroll SOA 157, gleaming gold HOB 249,
// facet FRA 455, retro frame P30A 12 with the star its scan carries). Software drawing on both sides: this proves the port draws
// what the site draws, not how a phone's GPU draws it or how fast.
// node android-app/native/scripts/check-foil-port.mjs [repo root]   (canvaskit-wasm from CANVASKIT_DIR, or resolvable; playwright resolvable)
// Exit 0: every recipe matches: within 2 of 255 on every pixel, or off by more than 1 on under 0.5% of pixels. 1: a recipe differs
// (printed). 2: no CanvasKit or browser to draw with. Not covered: the security stamp (u_stamp zero here; MtgStampTest measures it) and
// the maps fading in (u_maps 1 here).
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';import {createRequire} from 'node:module';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||path.join(here,'..','..','..'));
const require=createRequire(import.meta.url);
let chromium,CK;
try{({chromium}=await import('playwright'));}catch{try{({chromium}=require(require.resolve('playwright',{paths:[process.cwd(),root,'/opt/node-tools/node_modules']})));}catch{console.log('no playwright');process.exit(2);}}
try{CK=await require(process.env.CANVASKIT_DIR?path.join(process.env.CANVASKIT_DIR,'bin','canvaskit.js'):'canvaskit-wasm')();}catch{console.log('no canvaskit-wasm: set CANVASKIT_DIR to its folder');process.exit(2);}
const kt=readFileSync(path.join(here,'..','app','src','main','java','dev','cardstashy','nativeplay','ui','Foil.kt'),'utf8');
const raw=n=>{const m=kt.match(new RegExp(`const val ${n} = """([\\s\\S]*?)"""`));if(!m)throw Error('Foil.kt has no '+n);return m[1];};
const AGSL=raw('AGSL_HEAD')+raw('AGSL_TEMPLATE')+raw('AGSL_MAIN');
const {composeFoil,foilDefs}=await import(path.join(root,'mtg-foil-shader.js'));
const DEFAULT='/test-fixtures/finish-effects/avatar-of-burgeoning-echoes-pfra-122p.jpg',OWN={23:'silverscroll',28:'gleaming',21:'facet'};
const pictureFor=(k,r)=>OWN[r.pat]?`/test-fixtures/mtg-foil-maps/${OWN[r.pat]}.jpg`:k==='mtg-retro'?'/test-fixtures/mtg-foil-maps/retro_witness.jpg':DEFAULT;
const LIGHTS=[[.5,.45],[.22,.25],[.76,.72]];
const W=+(process.env.WIDTH||336),NL=Math.min(LIGHTS.length,+(process.env.NL||LIGHTS.length));
const page_js=`
window.run=async(width,lights,pick)=>{
 const {MTG_FOIL_RECIPES}=await import('/mtg-foil-recipes.js'),{mtgCardMaps,MTG_FRAMES,MTG_MAP_W,MTG_MAP_H}=await import('/mtg-foil-analysis.js'),{mtgFoilFragment}=await import('/mtg-foil-shader.js');
 const load=async src=>{const i=new Image();i.src=src;try{await i.decode();}catch(e){throw Error('cannot decode '+src);}return i;};
 const pix=(img,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);return x.getImageData(0,0,w,h).data;};
 const em=await load('/assets/finishes/mtg-emblem-rex.png'),emblem=pix(em,MTG_MAP_W,MTG_MAP_H);
 const b64=a=>{let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);};
 const out={};
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES)){if(!pick[k])continue;
  const img=await load(pick[k]),H=Math.round(width*img.naturalHeight/img.naturalWidth);
  const card=new Uint8Array(pix(img,width,H));for(let i=3;i<card.length;i+=4)card[i]=255;
  const frame=MTG_FRAMES[pick[k].includes('gleaming')?'smaug':pick[k].includes('retro')?'1997':'2015'],m=mtgCardMaps(pix(img,MTG_MAP_W,MTG_MAP_H),MTG_MAP_W,MTG_MAP_H,{pat:r.pat,frame,emblem});
  const box=m.box,st=m.star,star=[st?st.x:box.text[0]+.1,st?st.y:box.text[3]-.005,st?2:1];
  const c=document.createElement('canvas');c.width=width;c.height=H;const gl=c.getContext('webgl',{antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true});
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw Error(k+': '+gl.getShaderInfoLog(o));return o;};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 v;void main(){v=(a+1.0)*.5;gl_Position=vec4(a,0.0,1.0);}'));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,mtgFoilFragment(r)));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const tex=(unit,bytes,w,h,lin)=>{gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);const f=lin?gl.LINEAR:gl.NEAREST;for(const [q,v] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,f],[gl.TEXTURE_MAG_FILTER,f]])gl.texParameteri(gl.TEXTURE_2D,q,v);};
  tex(0,card,width,H,false);tex(1,new Uint8Array(m.mask.buffer?m.mask:m.mask),MTG_MAP_W,MTG_MAP_H,true);tex(2,new Uint8Array(m.relief),MTG_MAP_W,MTG_MAP_H,true);
  const U=n=>gl.getUniformLocation(p,n);gl.uniform1i(U('u_card'),0);gl.uniform1i(U('u_mask'),1);gl.uniform1i(U('u_relief'),2);gl.viewport(0,0,width,H);
  out[k]={W:width,H,card:b64(card),mask:b64(new Uint8Array(m.mask)),relief:b64(new Uint8Array(m.relief)),recipe:r,box,star,img:[]};
  for(const [lx,ly] of lights){
   gl.uniform2f(U('u_tilt'),(lx-.5)*2,(ly-.5)*2);gl.uniform2f(U('u_px'),width,H);gl.uniform2f(U('u_texel'),1/MTG_MAP_W,1/MTG_MAP_H);gl.uniform1f(U('u_aspect'),H/width);
   gl.uniform4f(U('u_art'),...box.art);gl.uniform4f(U('u_text'),...box.text);gl.uniform4f(U('u_r1'),r.pat,r.tint,r.cover,r.relief);gl.uniform4f(U('u_r2'),r.film,r.sparkle,r.stamp||0,r.keep||0);gl.uniform3f(U('u_star'),...star);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);const b=new Uint8Array(width*H*4);gl.readPixels(0,0,width,H,gl.RGBA,gl.UNSIGNED_BYTE,b);
   const f=new Uint8Array(width*H*4);for(let j=0;j<H;j++)f.set(b.subarray((H-1-j)*width*4,(H-j)*width*4),j*width*4);out[k].img.push(b64(f));}}
 return {out,MAP:[MTG_MAP_W,MTG_MAP_H]};
};window.ready=true;`;
const html=`<!doctype html><script type="module">${page_js}</script>`;
const types={'.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p==='/')return res.end(html);
 const body=await readFile(resolve(root,'.'+p));res.setHeader('Content-Type',types[extname(p)]||'application/octet-stream');res.end(body);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {MTG_FOIL_RECIPES}=await import(path.join(root,'mtg-foil-recipes.js'));
const ONLY=process.env.ONLY?process.env.ONLY.split(','):null;
const pick=Object.fromEntries(Object.entries(MTG_FOIL_RECIPES).filter(([k])=>!ONLY||ONLY.includes(k)).map(([k,r])=>[k,pictureFor(k,r)]));
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
let R;try{const pg=await browser.newPage();pg.on('pageerror',e=>console.log('page',e));await pg.goto(`http://127.0.0.1:${server.address().port}/`);await pg.waitForFunction(()=>window.ready);
 R=await pg.evaluate(([w,l,p])=>window.run(w,l,p),[W,LIGHTS.slice(0,NL),pick]);}finally{await browser.close();server.close();}
const dec=s=>Uint8Array.from(Buffer.from(s,'base64'));const [MW,MH]=R.MAP;
const report={};let worst=0,bad=0;
const composeAgsl=r=>composeFoil(AGSL,foilDefs(r));
for(const [k,o] of Object.entries(R.out)){
 const {W:CW,H:CH}=o,card=dec(o.card),mask=dec(o.mask),rel=dec(o.relief),r=o.recipe;
 // The app's maps (MtgFoil.Maps): opaque; the site's mask alpha (drawn lines) moves to relief G, its relief G/B/A to the stroke map.
 const appMask=new Uint8Array(MW*MH*4),appRel=new Uint8Array(MW*MH*4),appStroke=new Uint8Array(MW*MH*4),blank=new Uint8Array(4*4);
 for(let i=0;i<MW*MH;i++){const q=i*4;appMask.set([mask[q],mask[q+1],mask[q+2],255],q);appRel.set([rel[q],mask[q+3],0,255],q);appStroke.set([rel[q+1],rel[q+2],rel[q+3],255],q);}
 blank[3]=blank[7]=blank[11]=blank[15]=255;
 const info=(w,h)=>({width:w,height:h,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Premul,colorSpace:CK.ColorSpace.SRGB});
 const shaderOf=(b,w,h,lin)=>CK.MakeImage(info(w,h),b,w*4).makeShaderOptions(CK.TileMode.Clamp,CK.TileMode.Clamp,lin?CK.FilterMode.Linear:CK.FilterMode.Nearest,CK.MipmapMode.None);
 let err='';const fx=CK.RuntimeEffect.Make(composeAgsl(r),e=>err+=e);if(!fx){console.log('AGSL FAIL',k,err);process.exit(1);}
 const kids={u_card:shaderOf(card,CW,CH,false),u_mask:shaderOf(appMask,MW,MH,true),u_relief:shaderOf(appRel,MW,MH,true),u_stroke:shaderOf(appStroke,MW,MH,true),u_smask:shaderOf(blank,2,2,false)};
 const childNames=[...composeAgsl(r).matchAll(/uniform shader (\w+);/g)].map(m=>m[1]);
 const surf=CK.MakeSurface(CW,CH),cv=surf.getCanvas(),paint=new CK.Paint();report[k]=[];
 o.img.forEach((ref64,li)=>{const [lx,ly]=LIGHTS[li];
  const val={u_size:[CW,CH],u_px:[CW,CH],u_tilt:[(lx-.5)*2,(ly-.5)*2],u_aspect:[CH/CW],u_on:[1],u_map:[MW,MH],u_maps:[1],u_art:o.box.art,u_text:o.box.text,
   u_r1:[r.pat,r.tint,r.cover,r.relief],u_r2:[r.film,r.sparkle,r.stamp||0,r.keep||0],u_star:o.star,u_stamp:[0,0,0,0],u_stampk:[1,1,0,0]};
  const u=new Float32Array(fx.getUniformFloatCount());
  for(let i=0;i<fx.getUniformCount();i++){const n=fx.getUniformName(i),d=fx.getUniform(i),v=val[n];if(!v)throw Error('no value for '+n);if(v.length!==d.columns*d.rows)throw Error(n+' size');u.set(v,d.slot);}
  const s=fx.makeShaderWithChildren(u,childNames.map(n=>kids[n]));paint.setShader(s);cv.clear(CK.TRANSPARENT);cv.drawRect(CK.LTRBRect(0,0,CW,CH),paint);s.delete();
  const got=cv.readPixels(0,0,{width:CW,height:CH,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB});const ref=dec(ref64);
  let max=0,over=0;for(let i=0;i<CW*CH;i++){let m=0;for(let c=0;c<3;c++)m=Math.max(m,Math.abs(got[i*4+c]-ref[i*4+c]));if(m>max)max=m;if(m>1)over++;}
  if(process.env.DUMP){const fs=require('fs');fs.writeFileSync(`${process.env.DUMP}/${k}_${li}_app.rgba`,Buffer.from(got));fs.writeFileSync(`${process.env.DUMP}/${k}_${li}_site.rgba`,Buffer.from(ref));fs.writeFileSync(`${process.env.DUMP}/${k}.size`,CW+'x'+CH);}
  report[k].push({max,over1:+(over/(CW*CH)).toFixed(5)});worst=Math.max(worst,max);});
 surf.delete();
}
// Galaxy's star field picks its lit cells with a hash of the cell; WebGL and Skia's CPU round that hash differently near the cut-off, so a
// few specks light in different cells (same density and size; checked by eye 16 Nov 2026). It may differ on up to 3% of pixels.
const SPECKS=new Set(['mtg-galaxy']);
const same=(v,k)=>v.every(x=>x.max<=2||x.over1<(SPECKS.has(k)?.03:.005));
for(const [k,v] of Object.entries(report)){if(!same(v,k))bad++;console.log(`${same(v,k)?'ok  ':'DIFF'} ${k.padEnd(20)} ${pick[k].split('/').pop().padEnd(44)} largest ${Math.max(...v.map(x=>x.max))}/255, pixels off by more than 1: ${(100*Math.max(...v.map(x=>x.over1))).toFixed(3)}%`);}
console.log(`${Object.keys(report).length} foil types, card ${W} px wide, maps ${MW}x${MH}, worst ${worst}/255`);process.exit(bad?1:0);
