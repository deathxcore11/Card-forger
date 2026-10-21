// Hosted pixel regression for the WebGL Yu-Gi-Oh! rarity foil: full-size card pages light the art
// (rules box untouched except Starlight), follow the light, and gallery tiles switch between the
// the WebGL foil at every size, with no placeholder CSS shine.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {YGO_ART_BOX} from '../ygo-foil-analysis.js';
import {YGO_TEXT_BOX} from '../ygo-rarity-foil.js';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is hosted-only.');
const {chromium}=await import('playwright'),root=resolve('.'),out='test-results/ygo-rarity-foil';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)){res.writeHead(403);return res.end();}const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),report={status:'FAIL',detail:[],gallery:{},limits:'Hosted Chromium (software GL), retained YGOPRODeck renders; approximate simulation, not physical foil or phone-hardware proof.'};
const compare=(page,a,b,regions)=>page.evaluate(async({a,b,regions})=>{
 const read=async s=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return {w:c.width,h:c.height,d:x.getImageData(0,0,c.width,c.height).data};};
 const A=await read(a),B=await read(b),out={};
 for(const [name,r] of Object.entries(regions)){let n=0,ch=0;for(let j=Math.ceil(r[1]*A.h);j<Math.floor(r[3]*A.h);j++)for(let i=Math.ceil(r[0]*A.w);i<Math.floor(r[2]*A.w);i++){const k=(j*A.w+i)*4;n++;if(Math.abs(A.d[k]-B.d[k])+Math.abs(A.d[k+1]-B.d[k+1])+Math.abs(A.d[k+2]-B.d[k+2])>3)ch++;}out[name]=ch/n;}
 return out;},{a:a.toString('base64'),b:b.toString('base64'),regions});
try{
 const context=await browser.newContext({viewport:{width:1000,height:1100},deviceScaleFactor:1});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.emulateMedia({reducedMotion:'no-preference'});
 // Inset regions so anti-aliased edges never count; the name bar has its own lettering canvas.
 const art=[YGO_ART_BOX[0]+.02,YGO_ART_BOX[1]+.02,YGO_ART_BOX[2]-.02,YGO_ART_BOX[3]-.02],text=[YGO_TEXT_BOX[0]+.01,YGO_TEXT_BOX[1]+.01,YGO_TEXT_BOX[2]-.01,YGO_TEXT_BOX[3]-.01];
 for(const key of ['ygo-abyss-ultra','ygo-omega-secret','ygo-gamma-super','ygo-lukias-starlight']){
  await page.goto(base+'/tests/finish-materials.html#'+key);await page.waitForFunction(k=>document.documentElement.dataset.case===k,key);
  await page.waitForFunction(()=>document.querySelector('.card img')?.naturalWidth>0);
  await page.waitForFunction(()=>{const c=document.querySelector('.card canvas.finish-rarity-gl');return c&&!c.hidden&&c.closest('.finish-overlay').classList.contains('rarity-gl');},null,{timeout:15000});
  const box=await page.locator('.card img').boundingBox(),clip={x:box.x,y:box.y,width:box.width,height:box.height};
  const shot=async(visible,mx)=>{await page.evaluate(([v,mx])=>{const s=document.querySelector('.card');s.style.setProperty('--mx',mx);document.querySelector('.card .finish-overlay').style.visibility=v?'':'hidden';},[visible,mx]);await page.waitForTimeout(150);return page.screenshot({clip,animations:'disabled'});};
  const plain=await shot(false,'20%'),left=await shot(true,'20%'),right=await shot(true,'80%');
  await writeFile(`${out}/${key}-left.png`,left);await writeFile(`${out}/${key}-right.png`,right);
  const lit=await compare(page,plain,left,{art,text}),moved=await compare(page,left,right,{art});
  assert(lit.art>.05,`${key}: art foil visible ${JSON.stringify(lit)}`);
  if(key==='ygo-lukias-starlight')assert(lit.text>.05,`${key}: Starlight glitter reaches the rules box ${JSON.stringify(lit)}`);
  else assert.equal(lit.text,0,`${key}: rules box untouched ${JSON.stringify(lit)}`);
  assert(moved.art>.05,`${key}: foil follows the light ${JSON.stringify(moved)}`);
  report.detail.push({key,lit,moved});
 }
 // Gallery: Small tiles draw the WebGL foil (the CSS layers stay hidden); switching size keeps it.
 await page.goto(base+'/tests/ygo-rarity-gallery.html#size=small&cols=4');await page.waitForFunction(()=>document.documentElement.dataset.ready==='1');
 await page.waitForFunction(()=>document.querySelectorAll('.finish-overlay').length>=4);
 await page.waitForFunction(()=>[...document.querySelectorAll('.lot-art')].every(t=>t.querySelector('canvas.finish-rarity-gl:not([hidden])')),null,{timeout:15000});
 const state=()=>page.evaluate(()=>[...document.querySelectorAll('.lot-art')].map(t=>({key:t.dataset.key,width:Math.round(t.getBoundingClientRect().width),gl:!!t.querySelector('canvas.finish-rarity-gl:not([hidden])'),css:[...t.querySelectorAll('.finish-overlay>.finish-layer:not(.finish-name-region)')].some(n=>getComputedStyle(n).display!=='none')})));
 const small=await state();report.gallery.small=small;
 assert(small.every(t=>t.width<260&&t.gl&&!t.css),'Small tiles draw the WebGL foil: '+JSON.stringify(small));
 await page.evaluate(()=>{document.documentElement.dataset.gridSize='medium';});
 await page.waitForFunction(()=>[...document.querySelectorAll('.lot-art')].every(t=>t.querySelector('canvas.finish-rarity-gl:not([hidden])')),null,{timeout:15000});
 const medium=await state();report.gallery.medium=medium;
 assert(medium.every(t=>t.gl&&!t.css),'Medium tiles keep the WebGL foil: '+JSON.stringify(medium));
 await page.screenshot({path:`${out}/gallery-medium.png`});
 // Reduced motion removes every overlay, WebGL included.
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.finish-overlay')&&!document.querySelector('canvas.finish-rarity-gl'));
 assert.deepEqual(errors,[]);report.status='PASS';
 console.log('PASS: full-size Yu-Gi-Oh! cards render the WebGL rarity foil (art lit, rules box untouched except Starlight, light-following); gallery Small and Medium draw the WebGL foil.');
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
