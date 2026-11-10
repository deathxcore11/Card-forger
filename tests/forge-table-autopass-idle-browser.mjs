// Smart auto-pass on your own turn (director spec 6a): when every action Forge lists is one the table can prove you cannot pay for
// ("unknown" affordability on a card with no mana to cast it), the turn moves on after one beat, then the rest of the turn walks past
// quickly. A playable card, Full Control or a prompt keeps the stop.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:884,height:830},hasTouch:true,isMobile:true}),page=await context.newPage();
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(600);
 await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;s.nativeButton=(...a)=>{window.calls.push([a[0],a[1],Math.round(performance.now())]);return Promise.resolve();};
  // Your lands are all tapped (or not), Forge lists what it lists.
  window.state=(revision,{tapped=true,actionable,...patch}={})=>{const n=structuredClone(window.fixture.native),me=n.players.find(p=>p.id===n.viewer);
   for(const c of me.zones.Battlefield.cards)if(/Land|Artifact/.test(c.type))c.tapped=tapped;
   me.mana={W:0,U:0,B:0,R:0,G:0,C:0};n.selection={...n.selection,actionable};return {...n,revision,...patch};};
  window.t0=()=>performance.now();});
 const accept=async(expr,wait=1300)=>{await page.evaluate(expr);await sleep(wait);return page.evaluate(()=>window.calls.splice(0));};
 const unknown=id=>({kind:'card',id,affordability:'unknown'});
 // Lightning Bolt {R} with every source tapped and no mana floating: provably unpayable, so it does not hold the turn.
 // One beat first (not instant), then the pass.
 await page.evaluate(()=>{window.calls.length=0;window.fixture.session.acceptState(window.state(20,{actionable:[{kind:'card',id:100,affordability:'unknown'}]}));});
 await sleep(350);assert.equal(await page.evaluate(()=>window.calls.length),0,'a beat first: nothing at 350 ms');
 await sleep(750);let calls=await page.evaluate(()=>window.calls.splice(0));
 assert.deepEqual(calls.map(c=>c.slice(0,2)),[['ok',20]],'an unpayable "unknown" card does not hold your turn: it passes after the beat, once');
 // The rest of the turn walks past quickly in the same turn.
 await page.evaluate(()=>{window.fixture.session.acceptState(window.state(21,{actionable:[{kind:'card',id:100,affordability:'unknown'}],phase:'MAIN2'}));});
 await sleep(450);calls=await page.evaluate(()=>window.calls.splice(0));
 assert.deepEqual(calls.map(c=>c.slice(0,2)),[['ok',21]],'the next step in the same turn passes within 450 ms, well under the first beat');
 // A card you can pay for keeps the stop.
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(30,{tapped:false,actionable:[{kind:'card',id:100,affordability:'unknown'}]}))),[],'a one-mana spell with a land open is playable');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(31,{actionable:[{kind:'card',id:105,affordability:'unknown'}]}))),[],'a land drop is always something to do');
 // Full control keeps the stop.
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(32,{actionable:[{kind:'card',id:100,affordability:'unknown'}],controlMode:'full'}))),[],'Full Control keeps the stop');
 // Mana-only lands never count.
 calls=await accept(()=>window.fixture.session.acceptState(window.state(33,{actionable:[{kind:'card',id:110,affordability:'available'}],phase:'MAIN2'})));
 assert.deepEqual(calls.map(c=>c.slice(0,2)),[['ok',33]],'a land you could only tap for mana is not something to do');
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS: Smart passes your turn after one beat when nothing listed can be paid for, then walks the rest of the turn; a payable card, a land drop and Full Control keep the stop.');
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
