// Renders one sample card per set and foil kind (from foil-set-audit.mjs) on the card-page surface and
// measures the drawn foil against the same card with the foil layer hidden:
//   missing  - the foil changes almost nothing inside the card (or never mounted)
//   clipping - the foil changes pixels outside the card's rounded edge (corner wedges, bleed)
// Usage: node scripts/foil-render-audit.mjs <audit.json> <imageCacheDir> <out.json> [pages=4]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const [auditFile,cacheDir,out,pagesArg]=process.argv.slice(2);
const audit=JSON.parse(fs.readFileSync(auditFile,'utf8')),game=audit.game,root=path.resolve(new URL('..',import.meta.url).pathname);
fs.mkdirSync(cacheDir,{recursive:true});
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const page=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/finish-effects.css"><style>body{margin:0;background:#20242b;padding:16px}.card{position:relative;width:330px}.card img{width:100%;display:block}</style></head><body><div id="stage"></div>
<script type="module">
import {finishAttrs,attachFinishPreview} from '/finish-preview.js';
import {artworkSources} from '/artwork.js';
import {normalizePtcg} from '/ptcg.js';
import {normalizeYgo} from '/ygo.js';
let dispose;
window.show=async(game,raw,ctx,finish)=>{
 dispose?.();const card=game==='ptcg'?normalizePtcg(raw):game==='ygo'?normalizeYgo(raw):{...raw,game:'mtg'};
 const src=artworkSources({...card,game},true)[0]||'';if(!src)return {error:'no image'};
 const c=game==='ptcg'?{...card,setContext:undefined}:card,context=game==='mtg'?{priceFinish:finish}:game==='ptcg'?{priceFinish:finish}:ctx;
 document.querySelector('#stage').innerHTML='<div class="card" '+finishAttrs(game,c,context,'detail')+' style="--mx:35%;--my:40%"><div class="cd-zoom"><img crossorigin="anonymous" src="'+src+'"></div></div>';
 const img=document.querySelector('#stage img');try{await img.decode();}catch{return {error:'image failed',src};}
 dispose=attachFinishPreview(document.querySelector('#stage'));
 const t0=performance.now();
 while(performance.now()-t0<6000){const o=document.querySelector('.finish-overlay');if(o&&(o.querySelector('canvas.finish-rarity-gl:not([hidden])')||(!o.classList.contains('rarity-gl')&&o.querySelector('.finish-layer'))))break;await new Promise(r=>setTimeout(r,100));}
 await new Promise(r=>setTimeout(r,400));
 const o=document.querySelector('.finish-overlay'),r=img.getBoundingClientRect();
 return {effect:document.querySelector('.card')?.dataset.finishEffect,src,overlay:!!o,gl:!!o?.querySelector('canvas.finish-rarity-gl:not([hidden])'),box:{x:r.x,y:r.y,w:r.width,h:r.height}};
};
window.hide=v=>{const o=document.querySelector('.finish-overlay');if(o)o.style.visibility=v?'hidden':'';};
window.measure=async(a,b,box,pad)=>{
 const read=async s=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height);};
 const A=await read(a),B=await read(b),W=A.width,H=A.height,rx=.0475*box.w,ry=.035*box.h;
 // Inside the card's rounded rectangle (inset by m px) for d<=0; distance-like test outside for d>0.
 const inRound=(x,y,m)=>{const l=pad+m,t=pad+m,r=pad+box.w-m,b=pad+box.h-m;if(x<l||x>r||y<t||y>b)return false;const cx=x<l+rx?l+rx:x>r-rx?r-rx:x,cy=y<t+ry?t+ry:y>b-ry?b-ry:y;const dx=(x-cx)/rx,dy=(y-cy)/ry;return dx*dx+dy*dy<=1;};
 let inN=0,inCh=0,outCh=0,cornerCh=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4,d=Math.abs(A.data[k]-B.data[k])+Math.abs(A.data[k+1]-B.data[k+1])+Math.abs(A.data[k+2]-B.data[k+2]);
  if(inRound(x,y,3)){inN++;if(d>9)inCh++;}
  else if(!inRound(x,y,-1.5)&&d>24){outCh++;if(x>=pad&&x<pad+box.w&&y>=pad&&y<pad+box.h)cornerCh++;}}
 return {inside:inCh/inN,outside:outCh,corners:cornerCh};
};
</script></body></html>`;
async function remote(url){const file=path.join(cacheDir,crypto.createHash('sha1').update(url).digest('hex'));
 if(!fs.existsSync(file)){try{const r=await fetch(url,{headers:{'User-Agent':'CardStashy-foil-audit/1.0','Accept':'image/*'}});if(!r.ok)return null;fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));fs.writeFileSync(file+'.type',r.headers.get('content-type')||'image/jpeg');}catch{return null;}}
 return {body:fs.readFileSync(file),type:fs.existsSync(file+'.type')?fs.readFileSync(file+'.type','utf8'):'image/jpeg'};}
// The app's worker serves card art under /img/ (YGOPRODeck full cards for Yu-Gi-Oh!); send those to the same source.
const WORKER_ART=[[/^\/img\/ygo\/(\d+)\.jpg$/,m=>`https://images.ygoprodeck.com/images/cards/${m[1]}.jpg`]];
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');if(u.pathname==='/audit.html'){res.writeHead(200,{'content-type':'text/html'});return res.end(page);}
 for(const [re,to] of WORKER_ART){const m=u.pathname.match(re);if(m){remote(to(m)).then(x=>{if(!x){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':x.type});res.end(x.body);});return;}}
 const f=path.join(root,decodeURIComponent(u.pathname));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:420,height:560},deviceScaleFactor:1});
// Remote images come from a disk cache and get CORS headers, as the app's readable copies do.
await context.route(/^https?:\/\//,async route=>{const url=route.request().url();if(url.startsWith(base))return route.continue();
 const x=await remote(url);if(!x)return route.fulfill({status:404});
 route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':x.type},body:x.body});});
const jobs=audit.sets.flatMap(s=>s.samples.map(x=>({set:s.code,setName:s.name,...x})));
const results=[];let done=0;
async function worker(){const p=await context.newPage();await p.emulateMedia({reducedMotion:'no-preference'});await p.goto(base+'/audit.html');await p.waitForFunction(()=>window.measure);
 while(jobs.length){const j=jobs.shift();let r;
  try{const st=await p.evaluate(([g,raw,ctx,f])=>window.show(g,raw,ctx,f),[game,j.raw,j.ctx||{},j.finish]);
   if(st.error)r={...st};else if(!st.overlay)r={...st,missing:true};
   else{const pad=6,clip={x:st.box.x-pad,y:st.box.y-pad,width:st.box.w+2*pad,height:st.box.h+2*pad};
    await p.evaluate(()=>window.hide(true));const plain=await p.screenshot({clip});await p.evaluate(()=>window.hide(false));const foil=await p.screenshot({clip});
    const m=await p.evaluate(([a,b,box,pad])=>window.measure(a,b,box,pad),[plain.toString('base64'),foil.toString('base64'),st.box,pad]);
    r={...st,...m,missing:m.inside<.02,clipping:m.outside>24};}
  }catch(e){r={error:String(e.message||e).slice(0,160)};}
  results.push({set:j.set,setName:j.setName,kind:j.kind,id:j.id,finish:j.finish,...r});
  if(++done%25===0)console.log(`${done} rendered`);}
 await p.close();}
await Promise.all(Array.from({length:Number(pagesArg)||4},worker));
await browser.close();server.close();
const bad=results.filter(r=>r.missing||r.clipping||r.error);
fs.writeFileSync(out,JSON.stringify({game,rendered:results.length,missing:results.filter(r=>r.missing).length,clipping:results.filter(r=>r.clipping).length,errors:results.filter(r=>r.error).length,bad,results},null,1)+'\n');
console.log(JSON.stringify({game,rendered:results.length,missing:results.filter(r=>r.missing).length,clipping:results.filter(r=>r.clipping).length,errors:results.filter(r=>r.error).length}));
