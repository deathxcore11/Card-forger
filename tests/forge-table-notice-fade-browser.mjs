// Live Forge table (fixture board): Forge keeps its last notice ("X cannot be blocked with 1 creatures you've assigned")
// in every later state. The table shows it once for its fade and never brings it back on later redraws (it sat over
// the hand for whole turns, Randall 10 Nov). A new notice still shows.
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
 await page.clock.install({time:Date.now()});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
 await page.clock.runFor(1500);
 const push=(revision,message)=>page.evaluate(([revision,message])=>window.fixture.session.acceptState({...structuredClone(window.fixture.native),revision,notification:message?{title:'',message}:{}}),[revision,message]);
 const shown=()=>page.evaluate(()=>{const n=document.querySelector('#practicePlayerMat>.forge-notice');return n?n.textContent:null;});
 const BLOCK='Professional Face-Breaker cannot be blocked with 1 creatures you’ve assigned';
 await push(50,BLOCK);await page.clock.runFor(300);
 assert.equal(await shown(),'Professional Face-Breaker needs more blockers','a new notice shows, in the rule\u2019s words');
 // Later states still carry the same notice; each one redraws the table.
 for(let r=51;r<=60;r++){await push(r,BLOCK);await page.clock.runFor(800);}
 assert.equal(await shown(),null,'the old notice is gone after its fade and is not brought back by redraws');
 await push(61,'Not enough mana for Army of the Damned');await page.clock.runFor(300);
 assert.equal(await shown(),'Not enough mana for Army of the Damned','a different notice still shows');
 await page.clock.runFor(2600);assert.equal(await shown(),null,'a refusal goes after 2.5 s');await push(62,'CPU chose Incarnation');await page.clock.runFor(3000);assert.equal(await shown(),'CPU chose Incarnation','other notices stay 5 s');
 await push(63,null);await page.clock.runFor(300);
 assert.equal(await shown(),null,'a state with no notice clears it');
 console.log('forge table notice fade: ok');
}finally{await browser.close();server.close();}
