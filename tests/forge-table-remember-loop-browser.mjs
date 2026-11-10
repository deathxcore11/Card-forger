// Live Forge table (fixture board): the menu's "Remember this moment" button must not rewrite its own text on every
// redraw. The table redraws on any child change, so an unchanged rewrite redrew it again forever and froze every web
// match right after Keep (10 Nov, seen on the live site). The page must stay responsive and settle.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 // Count the table's observer callbacks; a self-feeding loop never lets the timer below run.
 await page.addInitScript(()=>{window.__mo=0;const O=window.MutationObserver;window.MutationObserver=class extends O{constructor(cb){super((l,o)=>{window.__mo++;return cb(l,o);});}};});
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');
 await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true',null,{timeout:10000});
 const alive=await Promise.race([page.evaluate(()=>new Promise(r=>setTimeout(()=>r(true),1500))),new Promise(r=>setTimeout(()=>r(false),8000))]);
 assert.equal(alive,true,'the page keeps running timers after the match table draws');
 const r=await page.evaluate(()=>({stage:document.getElementById('practicePlayerMat').dataset.stage,mark:document.querySelector('.forge-remember')?.textContent||null,a:window.__mo}));
 assert.equal(r.stage,'match');assert.equal(r.mark,'Remember this moment','the menu carries the Remember button');
 const b=await page.evaluate(()=>new Promise(res=>setTimeout(()=>res(window.__mo),1000)));
 assert.ok(b-r.a<20,`the table settles instead of redrawing itself (${b-r.a} observer passes in 1 s)`);
 console.log('forge table remember loop: ok');
}finally{await browser.close();server.close();}
