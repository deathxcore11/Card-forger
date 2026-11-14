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
import {chromium} from 'playwright';
const root=process.cwd(),PICTURE='/test-fixtures/finish-effects/avatar-of-burgeoning-echoes-pfra-122p.jpg';
const CARD={id:'pfra-122p',name:'Avatar of Burgeoning Echoes',set:'pfra',collector_number:'122p',layout:'normal',frame:'2015',border_color:'black',rarity:'mythic',promo_types:['promopack','stamped'],finishes:['nonfoil','foil'],image_uris:{normal:PICTURE}};
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
window.measure=async(x,y)=>{
 const card=stage.querySelector('.card');card.style.setProperty('--mx',x+'%');card.style.setProperty('--my',y+'%');
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,60))));
 const gl=shown();if(!gl)return null;
 const W=gl.width,H=gl.height,img=stage.querySelector('img'),c=document.createElement('canvas');c.width=W;c.height=H;
 const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';cx.drawImage(img,0,0,W,H);
 const A=cx.getImageData(0,0,W,H).data,B=gl.getContext('2d').getImageData(0,0,W,H).data;
 let n=0,dark=0,darkLift=0,colour=0,white=0,lit=0,litN=0,away=0,awayN=0;
 const lx=x/100*W,ly=y/100*H,lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=(j*W+i)*4,a=[A[k],A[k+1],A[k+2]],b=[B[k],B[k+1],B[k+2]];
  const amax=Math.max(...a),bmax=Math.max(...b),ac=amax-Math.min(...a),bc=bmax-Math.min(...b),d=Math.hypot(i-lx,j-ly)/W;n++;
  if(amax<=28){dark++;darkLift+=lin(bmax)-lin(amax);}
  if(bc-ac>32)colour++;
  if(Math.min(...b)>=250&&Math.min(...a)<235)white++;
  if(amax>90){const ch=(b[0]+b[1]+b[2]-a[0]-a[1]-a[2])/3;if(d<.16){litN++;lit+=ch;}else if(d>.6){awayN++;away+=(Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1])+Math.abs(b[2]-a[2]))/3;}}}
 return {W,H,dark:dark/n,darkLift:darkLift/Math.max(1,dark),colour:colour/n,white:white/n,lit:lit/Math.max(1,litN),away:away/Math.max(1,awayN),awayN:awayN/n};
};
// Every foil type's shader, with and without an emblem, compiled by this browser's own WebGL.
window.compileAll=async()=>{
 const {MTG_FOIL_RECIPES}=await import('/mtg-foil-recipes.js'),{mtgFoilFragment,foilDefs,foilKey}=await import('/mtg-foil-shader.js'),{FOIL_VS}=await import('/foil-gl.js');
 const gl=document.createElement('canvas').getContext('webgl'),seen=new Set(),bad=[];
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null;};
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES))for(const kind of [0,1,2]){const key=foilKey(foilDefs(r,kind));if(seen.has(key))continue;seen.add(key);
  const vs=sh(gl.VERTEX_SHADER,FOIL_VS),fs=sh(gl.FRAGMENT_SHADER,mtgFoilFragment(r,kind)),p=gl.createProgram();
  if(!vs||!fs){bad.push(k+'/'+kind);continue;}gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))bad.push(k+'/'+kind);gl.deleteProgram(p);}
 return {programs:seen.size,bad};
};
// Several foil types on one page share one WebGL context; two of them carry a big emblem on texture unit 3.
// Returns, per card, a hash of what was drawn and how far it is from the printed picture inside and outside the emblem.
window.gallery=async(pic,rows)=>{
 const {mountMtgFoil}=await import('/mtg-foil.js'),{MTG_EMBLEMS}=await import('/mtg-foil-recipes.js');stage.innerHTML='';
 for(const [t,emblem,w] of rows){stage.insertAdjacentHTML('beforeend','<div class="card" style="display:inline-block;width:'+w+'px;--mx:35%;--my:40%"><img src="'+pic+'"><div class="finish-overlay" style="inset:0"></div></div>');
  const d=stage.lastChild;await d.querySelector('img').decode();if(!mountMtgFoil(d.querySelector('.finish-overlay'),d.querySelector('img'),t,{surface:'card',emblem}))return null;}
 const cards=[...stage.children],canvases=()=>cards.map(d=>d.querySelector('canvas.finish-rarity-gl'));
 for(let i=0;i<150&&!canvases().every(k=>k&&!k.hidden);i++)await new Promise(r=>setTimeout(r,100));
 for(const d of cards)d.style.setProperty('--mx','45%');
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,120))));
 const out=[];
 for(const [i,d] of cards.entries()){const k=canvases()[i];if(!k||k.hidden){out.push(null);continue;}
  const W=k.width,H=k.height,B=k.getContext('2d').getImageData(0,0,W,H).data,flat=(src)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(src,0,0,W,H);return x.getImageData(0,0,W,H).data;};
  const sum=await crypto.subtle.digest('SHA-1',B),row={hash:[...new Uint8Array(sum)].map(b=>b.toString(16).padStart(2,'0')).join('')},mark=MTG_EMBLEMS[rows[i][1]];
  if(mark){const e=new Image();e.src='/'+mark.src;await e.decode();const A=flat(d.querySelector('img')),E=flat(e);let inN=0,inD=0,outN=0,outD=0;
   for(let p=0;p<W*H*4;p+=4){const ch=(Math.abs(B[p]-A[p])+Math.abs(B[p+1]-A[p+1])+Math.abs(B[p+2]-A[p+2]))/3;if(E[p]>=230){inN++;inD+=ch;}else if(E[p]<=4){outN++;outD+=ch;}}
   Object.assign(row,{inside:inD/Math.max(1,inN),outside:outD/Math.max(1,outN),share:inN/(W*H)});}
  out.push(row);}
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
 const rows=[];for(const [x,y] of LIGHTS)rows.push(await page.evaluate(([x,y])=>window.measure(x,y),[x,y]));
 if(process.env.FOIL_REPORT)console.log(JSON.stringify(rows));
 assert(rows.every(Boolean),'the foil is drawn at every light position');
 assert.deepEqual(errors,[],'no page or shader error');
 const worst=k=>Math.max(...rows.map(r=>r[k])),least=k=>Math.min(...rows.map(r=>r[k]));
 assert(least('dark')>.04&&least('awayN')>.05,'the picture has black ink and unlit card to check');
 assert(worst('away')<8,`out of the light the card looks like the printed card (changed by ${worst('away').toFixed(1)} of 255)`);
 assert(least('lit')>10,`the light adds brightness where it lands (${least('lit').toFixed(1)} of 255)`);
 assert(worst('darkLift')<.03,`black ink stays black under the foil (lift ${(worst('darkLift')*100).toFixed(1)}% of white)`);
 assert(least('colour')>.004,`the foil shows some colour at every light position (${(least('colour')*100).toFixed(2)}%)`);
 assert(worst('colour')<.1,`strong new colour stays a small part of the card (${(worst('colour')*100).toFixed(1)}%)`);
 assert(worst('white')<.02,`the card is not blown out to white (${(worst('white')*100).toFixed(1)}%)`);
 const built=await page.evaluate(()=>window.compileAll());
 assert.deepEqual(built.bad,[],'every foil type compiles');assert(built.programs>=20,'one program per foil type');
 // Three foil types together on one page, two with an emblem: each must draw exactly what it draws alone on a fresh page,
 // and the Jurassic World emblem must change the card inside its shape and leave the card around it as printed.
 // The picture is the Avatar scan again, not a Jurassic World or D&D card: this proves the draw path, not the look.
 const ROWS=[['mtg-traditional','',220],['mtg-embossed','rex',200],['mtg-ampersand','amp',180]];
 const fresh=async rows=>{const p=await browser.newPage({viewport:{width:760,height:560},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(/WebGL: INVALID|GL_INVALID/.test(m.text()))errors.push(m.text());});
  await p.goto(base+'/fixture');await p.waitForFunction(()=>window.ready);const r=await p.evaluate(([pic,rows])=>window.gallery(pic,rows),[PICTURE,rows]);await p.close();return r;};
 const together=await fresh(ROWS),alone=[];for(const row of ROWS)alone.push((await fresh([row]))?.[0]);
 if(process.env.FOIL_REPORT)console.log(JSON.stringify({together,alone}));
 assert(together?.every(Boolean)&&alone.every(Boolean),'every foil type on the shared context is drawn');
 ROWS.forEach((row,i)=>assert.equal(together[i].hash,alone[i].hash,row[0]+' draws the same beside other foil types as it does alone'));
 assert.equal(new Set(together.map(c=>c.hash)).size,ROWS.length,'each foil type draws its own look');
 const rex=together[1];assert(rex.share>.02,'the emblem picture has a shape to check');
 assert(rex.inside>40&&rex.outside<25,'the emblem is foil inside its shape ('+rex.inside.toFixed(1)+' of 255) and the card around it stays as printed ('+rex.outside.toFixed(1)+')');
 assert.deepEqual(errors,[],'no page or shader error in the gallery');
 // The same card set to Nonfoil draws no foil at all.
 await page.evaluate(c=>window.mount(c,'nonfoil'),CARD);await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>window.foilShown()),false,'Nonfoil draws no foil');
 console.log(`PASS browser: on the real Avatar of Burgeoning Echoes picture the foil leaves the unlit card as printed (changed by ${worst('away').toFixed(1)}/255), brightens it where the light lands (+${least('lit').toFixed(1)}/255), keeps black ink black and never whites out; all ${built.programs} foil-type shaders compile; three foil types on one page, two with an emblem, each draw as they do alone (software drawing, not a phone).`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
