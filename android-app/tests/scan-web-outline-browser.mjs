// The app's scanner engine (assets/scan-web.js, built by native/scripts/prepare-assets.sh) in a browser standing in for the app's
// hidden WebView: the owner's real photos go in as camera frames (ScanWeb.frame), and the engine must hand the app the card's
// edge (NativeScan.outline) in the frame's own size, then nothing once the card is gone.
// Run from the repo root: node android-app/tests/scan-web-outline-browser.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=process.cwd(),photos=(process.env.OUTLINE_PHOTOS||'ygo/twin2,ygo/twin,ptcg/vulpix').split(',');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/host.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta charset="utf-8"><body></body>');}
 const file=resolve(root,'.'+url.pathname.replace(/^\/__native\//,'/android-app/native/app/src/main/assets/'));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),results=[];
try{
 for(const photo of photos){
  const page=await browser.newPage({viewport:{width:412,height:706}});
  await page.goto(base+'/host.html');
  await page.evaluate(()=>{window.__out=[];window.__models=0;window.NativeScan={model(){window.__models++;},toast(){},acted(){},call(){},torch(){},ready(){},outline(j){window.__out.push(j);}};});
  await page.addScriptTag({url:base+'/__native/scan-web.js'});
  const got=await page.evaluate(async src=>{
   const find=(n,ok)=>{if(!n||typeof n==='string')return null;if(ok(n))return n;for(const k of n.k||[]){const hit=find(k,ok);if(hit)return hit;}return null;};
   const model=JSON.parse(ScanWeb.open({game:'ygo',camera:true,torch:false,preview:{w:412,h:706},state:{}}));
   const start=find(model.body,n=>n.a?.['data-act']==='scanStart');if(!start)return {error:'no Start camera button'};
   ScanWeb.tap(start.i);
   const blob=await (await fetch(src)).blob(),b64=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(blob);});
   const bmp=await createImageBitmap(blob),size=[bmp.width,bmp.height];
   const plain=document.createElement('canvas');plain.width=size[0];plain.height=size[1];const x=plain.getContext('2d');x.fillStyle='#5a5348';x.fillRect(0,0,size[0],size[1]);
   const none=plain.toDataURL('image/jpeg',.8).split(',')[1];
   const feed=async(data,ms)=>{const end=Date.now()+ms;while(Date.now()<end){ScanWeb.frame(data);await new Promise(r=>setTimeout(r,150));}};
   await feed(b64,6000);const shown=window.__out.filter(Boolean).map(j=>JSON.parse(j));
   const before=window.__out.length;await feed(none,3000);
   return {size,shown:shown.length,last:shown.at(-1)||null,cleared:window.__out.length>before&&window.__out.at(-1)==='',pushes:window.__out.length};
  },'/test-fixtures/scan-real/'+photo+'.jpg');
  results.push({photo,...got});console.log(JSON.stringify(results.at(-1)));
  await page.close();
 }
}finally{await browser.close();server.close();}
for(const r of results){
 assert(!r.error,r.photo+': '+r.error);
 assert(r.shown>0,r.photo+': the engine gave the app an outline');
 assert(['amber','green'].includes(r.last.tone));assert.equal(r.last.quad.length,4);
 assert(r.last.w>0&&r.last.h>0&&Math.abs(r.last.w/r.last.h-r.size[0]/r.size[1])<.01,r.photo+': in the frame\'s own shape');
 assert(r.last.quad.every(p=>p.x>0&&p.x<1&&p.y>0&&p.y<1),r.photo+': corners inside the frame');
 assert.equal(r.cleared,true,r.photo+': the outline is taken away when the card leaves');
}
console.log(`app scanner engine: outline handed to the app on ${results.length} of ${results.length} real photos`);
