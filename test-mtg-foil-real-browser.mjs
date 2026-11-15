// A real traditional-foil card, drawn by the app's own foil path in a browser, must look like a foil
// layer on a printed card and not like a filter over a picture:
//   - out of the light the card looks like the printed card (the old shader repainted the whole card,
//     darker and harder, wherever the light was),
//   - the light adds brightness where it lands (the old shader left the card darker even there),
//   - black ink stays black, strong new colour stays a small part of the card, nothing is blown out to white.
// Input: the promo-pack printing (Reality Fracture Promos 122p) of Avatar of Burgeoning Echoes, the card the
// owner had open (FRA 122) when he said today's foil was "super rainbow hdr", "distracting", "doesn't look real".
// The picture is the unchanged Scryfall scan; set, number, frame, border, promo types and finishes are copied
// from its Scryfall record; the id is a placeholder and the rarity is the repo's own value for FRA 122.
// Software drawing in a desktop browser: this proves what the shader draws, not how fast a phone draws it.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {MTG_FOIL_RECIPES} from './mtg-foil-recipes.js';
import {MTG_FRAMES} from './mtg-foil-analysis.js';
import {chromium} from 'playwright';
const root=process.cwd(),APPROVED=await readFile(resolve(root,'test-fixtures/finish-effects/mtg-foil-new-approved.glsl'),'utf8'),PICTURE='/test-fixtures/finish-effects/avatar-of-burgeoning-echoes-pfra-122p.jpg';
const CARD={id:'pfra-122p',name:'Avatar of Burgeoning Echoes',set:'pfra',collector_number:'122p',layout:'normal',frame:'2015',border_color:'black',rarity:'mythic',promo_types:['promopack','stamped'],finishes:['nonfoil','foil'],image_uris:{normal:PICTURE}};
// The card the owner filmed on 0.4.82 (15 Nov): a white haze from the round spotlight over its art.
const DONLEO={id:'tmt-143',name:'Don & Leo, Problem Solvers',set:'tmt',collector_number:'143',layout:'normal',frame:'2015',border_color:'black',rarity:'rare',finishes:['nonfoil','foil'],image_uris:{normal:'/test-fixtures/finish-effects/don-and-leo-problem-solvers-tmt-143.jpg'}};
// Five places the light can be: the middle and toward each corner.
const LIGHTS=[[50,45],[22,25],[78,25],[25,75],[76,72]];
const fixture=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/finish-effects.css">
<style>body{margin:0;background:#20242b;padding:16px}.card{position:relative;width:330px}.card img{width:100%;display:block}</style>
<div id="stage"></div>
<script type="module">
import {finishAttrs,attachFinishPreview} from '/finish-preview.js';
const stage=document.querySelector('#stage');
window.mount=async(card,finish)=>{
 stage.innerHTML='<div class="card" '+finishAttrs('mtg',{...card,game:'mtg'},{priceFinish:finish},'detail')+'><div class="cd-zoom"><img src="'+card.image_uris.normal+'"></div></div>';
 await stage.querySelector('img').decode();attachFinishPreview(stage);
 return {effect:stage.querySelector('.card').dataset.finishEffect,model:JSON.parse(stage.querySelector('.card').dataset.finishModel||'{}')};
};
const shown=()=>stage.querySelector('canvas.finish-rarity-gl:not([hidden])');
window.foilShown=()=>!!shown();
// Moves the light the way the pointer and the gyro do (--mx / --my on the card), waits for the
// redraw, then compares the drawn card with the printed picture, pixel by pixel.
window.measure=async(x,y,art)=>{
 const card=stage.querySelector('.card');card.style.setProperty('--mx',x+'%');card.style.setProperty('--my',y+'%');
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,60))));
 const gl=shown();if(!gl)return null;
 const W=gl.width,H=gl.height,img=stage.querySelector('img'),c=document.createElement('canvas');c.width=W;c.height=H;
 const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';cx.drawImage(img,0,0,W,H);
 const A=cx.getImageData(0,0,W,H).data,B=gl.getContext('2d').getImageData(0,0,W,H).data;
 let n=0,dark=0,darkLift=0,colour=0,white=0,lit=0,litN=0,away=0,awayN=0,haze=0,hazeN=0,frameC=0,frameN=0,warm=0,cool=0;
 const lx=x/100*W,ly=y/100*H,lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=(j*W+i)*4,a=[A[k],A[k+1],A[k+2]],b=[B[k],B[k+1],B[k+2]];
  const amax=Math.max(...a),bmax=Math.max(...b),ac=amax-Math.min(...a),bc=bmax-Math.min(...b),d=Math.hypot(i-lx,j-ly)/W;n++;
  if(amax<=28){dark++;darkLift+=lin(bmax)-lin(amax);}
  if(bc-ac>32)colour++;
  if(Math.min(...b)>=250&&Math.min(...a)<235)white++;
  const inArt=i>=art[0]*W&&i<=art[2]*W&&j>=art[1]*H&&j<=art[3]*H;
  // White haze: every channel lifted together (the 0.4.82 spotlight left this over the art).
  if(inArt&&amax>40){hazeN++;haze+=Math.max(0,Math.min(b[0]-a[0],b[1]-a[1],b[2]-a[2]));}
  if(!inArt&&amax>150){frameN++;if(bc-ac>24)frameC++;warm+=b[0]-a[0];cool+=b[2]-a[2];}
  if(amax>90){const ch=(b[0]+b[1]+b[2]-a[0]-a[1]-a[2])/3;if(d<.16){litN++;lit+=ch;}else if(d>.6){awayN++;away+=(Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1])+Math.abs(b[2]-a[2]))/3;}}}
 return {W,H,dark:dark/n,darkLift:darkLift/Math.max(1,dark),colour:colour/n,white:white/n,lit:lit/Math.max(1,litN),away:away/Math.max(1,awayN),awayN:awayN/n,haze:haze/Math.max(1,hazeN),frameColour:frameC/Math.max(1,frameN),tint:(warm-cool)/Math.max(1,frameN)};
};
// Every foil type's shader, compiled by this browser's own WebGL.
window.compileAll=async()=>{
 const {MTG_FOIL_RECIPES}=await import('/mtg-foil-recipes.js'),{mtgFoilFragment,foilDefs,foilKey}=await import('/mtg-foil-shader.js'),{FOIL_VS}=await import('/foil-gl.js');
 const gl=document.createElement('canvas').getContext('webgl'),seen=new Set(),bad=[];
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null;};
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES)){const key=foilKey(foilDefs(r));if(seen.has(key))continue;seen.add(key);
  const vs=sh(gl.VERTEX_SHADER,FOIL_VS),fs=sh(gl.FRAGMENT_SHADER,mtgFoilFragment(r)),p=gl.createProgram();
  if(!vs||!fs){bad.push(k);continue;}gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))bad.push(k);gl.deleteProgram(p);}
 return {programs:seen.size,bad};
};
// The owner approved one foil shader for every type (the 15 Nov preview look "New"; the first foil before it).
// Each foil type's small composed shader must draw what that approved shader draws: same picture, same data
// maps, same uniforms, drawn by both programs on one context and read back pixel by pixel.
window.identity=async(pic,ref,lights)=>{
 const {MTG_FOIL_RECIPES}=await import('/mtg-foil-recipes.js'),{mtgFoilFragment,foilDefs,foilKey,MTG_FOIL_UNIFORMS}=await import('/mtg-foil-shader.js');
 const {foilContext,foilContextProgram,bindFoilTextures,readFoilPixels}=await import('/foil-gl.js'),{analyzeMtgCard,MTG_FRAMES}=await import('/mtg-foil-analysis.js');
 const img=new Image();img.src=pic;await img.decode();
 const px=readFoilPixels(img,372),an=analyzeMtgCard(px.data,px.W,px.H),data={W:px.W,H:px.H,mask:an.mask,relief:an.relief};
 const ctx=foilContext(document),W=240,H=Math.round(W*img.naturalHeight/img.naturalWidth),box=MTG_FRAMES['2015'],out={},bad=[];
 const approved=foilContextProgram(ctx,'approved',ref,MTG_FOIL_UNIFORMS);if(!approved)return {bad:['approved shader does not compile']};
 const draw=(r0,r,[lx,ly])=>{r0.use();const {gl,U}=r0;ctx.canvas.width=W;ctx.canvas.height=H;bindFoilTextures(r0,img,data,W,H,pic);gl.viewport(0,0,W,H);
  gl.uniform2f(U.u_tilt,(lx-.5)*2,(ly-.5)*2);gl.uniform2f(U.u_px,W,H);gl.uniform2f(U.u_texel,1/data.W,1/data.H);gl.uniform1f(U.u_aspect,img.naturalHeight/img.naturalWidth);
  gl.uniform4f(U.u_art,...box.art);gl.uniform4f(U.u_text,...box.text);gl.uniform4f(U.u_r1,r.pat,r.tint,r.cover,r.relief);gl.uniform4f(U.u_r2,r.film,r.sparkle,r.stamp||0,r.keep||0);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);const b=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES)){const own=foilContextProgram(ctx,foilKey(foilDefs(r)),mtgFoilFragment(r),MTG_FOIL_UNIFORMS);if(!own){bad.push(k);continue;}
  let max=0,changed=0;for(const l of lights){const a=draw(approved,r,l),b=draw(own,r,l);for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d>max)max=d;}
   const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);const P=x.getImageData(0,0,W,H).data;
   for(let j=0;j<H;j++)for(let i=0;i<W;i++){const q=(j*W+i)*4,p=((H-1-j)*W+i)*4;if(Math.abs(a[q]-P[p])+Math.abs(a[q+1]-P[p+1])+Math.abs(a[q+2]-P[p+2])>24)changed++;}}
  out[k]={max,changed:changed/(W*H*lights.length)};}
 return {out,bad};
};
// Several foil types on one page share one WebGL context. Returns, per card, a hash of what was drawn.
window.gallery=async(pic,rows)=>{
 const {mountMtgFoil}=await import('/mtg-foil.js');stage.innerHTML='';
 for(const [t,w] of rows){stage.insertAdjacentHTML('beforeend','<div class="card" style="display:inline-block;width:'+w+'px;--mx:35%;--my:40%"><img src="'+pic+'"><div class="finish-overlay" style="inset:0"></div></div>');
  const d=stage.lastChild;await d.querySelector('img').decode();if(!mountMtgFoil(d.querySelector('.finish-overlay'),d.querySelector('img'),t,{surface:'card'}))return null;}
 const cards=[...stage.children],canvases=()=>cards.map(d=>d.querySelector('canvas.finish-rarity-gl'));
 for(let i=0;i<150&&!canvases().every(k=>k&&!k.hidden);i++)await new Promise(r=>setTimeout(r,100));
 for(const d of cards)d.style.setProperty('--mx','45%');
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120))));
 const out=[];
 for(const [i,d] of cards.entries()){const k=canvases()[i];if(!k||k.hidden){out.push(null);continue;}
  const W=k.width,H=k.height,B=k.getContext('2d').getImageData(0,0,W,H).data,sum=await crypto.subtle.digest('SHA-1',B);
  out.push({hash:[...new Uint8Array(sum)].map(b=>b.toString(16).padStart(2,'0')).join('')});}
 return out;
};
window.ready=true;
</script>`;
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(path==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture);}
 const file=resolve(root,'.'+path);if(!file.startsWith(root))throw Error('outside');
 const body=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(body);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:420,height:560},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if((m.type()==='error'&&!/favicon/.test(m.text()))||/WebGL: INVALID|GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/fixture');await page.waitForFunction(()=>window.ready);
 const mounted=await page.evaluate(c=>window.mount(c,'foil'),CARD);
 assert.equal(mounted.model.treatment,'mtg-traditional','the card is a traditional foil');
 await page.waitForFunction(()=>window.foilShown(),{},{timeout:15000});
 const ART=MTG_FRAMES['2015'].art,rows=[];for(const [x,y] of LIGHTS)rows.push(await page.evaluate(([x,y,a])=>window.measure(x,y,a),[x,y,ART]));
 if(process.env.FOIL_REPORT)console.log(JSON.stringify(rows));
 assert(rows.every(Boolean),'the foil is drawn at every light position');
 assert.deepEqual(errors,[],'no page or shader error');
 const worst=k=>Math.max(...rows.map(r=>r[k])),least=k=>Math.min(...rows.map(r=>r[k]));
 assert(least('dark')>.04&&least('awayN')>.05,'the picture has black ink and unlit card to check');
 // The approved look (15 Nov) has no round spotlight: the 0.4.82 spot left a white haze over the art (Don & Leo, TMT 143).
 // The art keeps its own colours, the light-ink frame and text box carry the foil's colour, and that colour moves with the tilt.
 assert(least('frameColour')>.05,`the frame and text box show the foil's colour at every tilt (least ${(least('frameColour')*100).toFixed(1)}%)`);
 assert(worst('tint')-least('tint')>3,`the colour on the frame moves as the card tilts (warm-to-cool swing ${(worst('tint')-least('tint')).toFixed(1)} of 255)`);
 // Measured in software WebGL, 15 Nov: 0.4.82's spotlight gave mean 9.4 / worst 16.2 here and 13.8 / 21.5 on Don & Leo;
 // the approved look 2.9 / 7.8 and 5.6 / 15.2 (the soft bar of light still passes over the art when the card tips toward it).
 assert(rows.reduce((t,r)=>t+r.haze,0)/rows.length<8&&worst('haze')<18,`no white haze over the art (mean ${(rows.reduce((t,r)=>t+r.haze,0)/rows.length).toFixed(1)}, worst ${worst('haze').toFixed(1)} of 255)`);
 // The exact card from the owner's 0.4.82 recording.
 {await page.evaluate(c=>window.mount(c,'foil'),DONLEO);await page.waitForFunction(()=>window.foilShown(),{},{timeout:15000});
  const dl=[];for(const [x,y] of LIGHTS)dl.push(await page.evaluate(([x,y,a])=>window.measure(x,y,a),[x,y,ART]));
  if(process.env.FOIL_REPORT)console.log(JSON.stringify(dl));
  const mean=dl.reduce((t,r)=>t+r.haze,0)/dl.length,top=Math.max(...dl.map(r=>r.haze)),fc=Math.min(...dl.map(r=>r.frameColour));
  assert(mean<8&&top<18,`Don & Leo (TMT 143): no white haze over the art (mean ${mean.toFixed(1)}, worst ${top.toFixed(1)} of 255)`);
  assert(fc>.05,`Don & Leo (TMT 143): its frame and text box show the foil's colour at every tilt (least ${(fc*100).toFixed(1)}%)`);
  await page.evaluate(c=>window.mount(c,'foil'),CARD);await page.waitForFunction(()=>window.foilShown(),{},{timeout:15000});}
 assert(worst('darkLift')<.03,`black ink stays black under the foil (lift ${(worst('darkLift')*100).toFixed(1)}% of white)`);
 assert(least('colour')>.004,`the foil shows some colour at every light position (${(least('colour')*100).toFixed(2)}%)`);
 assert(worst('colour')<.25,`strong new colour stays on part of the card, not all of it (${(worst('colour')*100).toFixed(1)}%)`);
 assert(worst('white')<.02,`the card is not blown out to white (${(worst('white')*100).toFixed(1)}%)`);
 const built=await page.evaluate(()=>window.compileAll());
 assert.deepEqual(built.bad,[],'every foil type compiles');assert(built.programs>=19,'one program per foil type');
 // Every foil type draws exactly what the approved foil draws (the preview shader the owner said yes to on 15 Nov,
 // kept in test-fixtures as it was shown to him), at three light positions on the real Avatar picture.
 const same=await page.evaluate(([pic,ref,l])=>window.identity(pic,ref,l),[PICTURE,APPROVED,[[50,45],[22,25],[76,72]].map(([x,y])=>[x/100,y/100])]);
 if(process.env.FOIL_REPORT)console.log(JSON.stringify(same));
 assert.deepEqual(same.bad,[],'every foil type and the approved shader compile');
 assert.deepEqual(Object.keys(same.out).sort(),Object.keys(MTG_FOIL_RECIPES).sort(),'every foil type was compared');
 for(const [k,v] of Object.entries(same.out))assert(v.max<=1,`${k} draws what the approved foil draws (largest difference ${v.max} of 255)`);
 assert(Object.values(same.out).every(v=>v.changed>.002),'the comparison is not of two blank cards: every foil type visibly changes the card');
 // Three foil types together on one page: each must draw exactly what it draws alone on a fresh page.
 // The picture is the Avatar scan again: this proves the draw path, not the look of those types.
 const ROWS=[['mtg-traditional',220],['mtg-embossed',200],['mtg-ampersand',180]];
 const fresh=async rows=>{const p=await browser.newPage({viewport:{width:760,height:560},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(/WebGL: INVALID|GL_INVALID/.test(m.text()))errors.push(m.text());});
  await p.goto(base+'/fixture');await p.waitForFunction(()=>window.ready);const r=await p.evaluate(([pic,rows])=>window.gallery(pic,rows),[PICTURE,rows]);await p.close();return r;};
 const together=await fresh(ROWS),alone=[];for(const row of ROWS)alone.push((await fresh([row]))?.[0]);
 if(process.env.FOIL_REPORT)console.log(JSON.stringify({together,alone}));
 assert(together?.every(Boolean)&&alone.every(Boolean),'every foil type on the shared context is drawn');
 ROWS.forEach((row,i)=>assert.equal(together[i].hash,alone[i].hash,row[0]+' draws the same beside other foil types as it does alone'));
 assert.equal(new Set(together.map(c=>c.hash)).size,ROWS.length,'each foil type draws its own look');
 assert.deepEqual(errors,[],'no page or shader error in the gallery');
 // The same card set to Nonfoil draws no foil at all.
 await page.evaluate(c=>window.mount(c,'nonfoil'),CARD);await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>window.foilShown()),false,'Nonfoil draws no foil');
 console.log(`PASS browser: on the real Avatar of Burgeoning Echoes and Don & Leo pictures no white haze sits over the art (Avatar mean ${(rows.reduce((t,r)=>t+r.haze,0)/rows.length).toFixed(1)}/255), the frame and text box carry the foil's colour at every tilt and it moves with the tilt, black ink stays black and nothing whites out; all ${built.programs} foil-type shaders compile and each draws what the approved foil draws (largest difference ${Math.max(...Object.values(same.out).map(v=>v.max))}/255); three foil types on one page each draw as they do alone (software drawing, not a phone).`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
