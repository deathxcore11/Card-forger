// Live Forge table (fixture board, no transport): combat by drag. A blocker dropped on an
// attacker sends the attacker, then the blocker (Forge's own two-click pairing); an attacker
// dropped on the CPU sends the CPU, then the attacker. Legal drops are lit while dragging, and a
// pairing Forge already has is not sent again (a second click would undo it).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
// Card types are all the table needs to know which permanents are creatures.
const TYPES={'Hill Giant':['Creature — Giant','3','3'],'Grizzly Bears':['Creature — Bear','2','2'],'Goblin Guide':['Creature — Goblin Scout','2','2'],Mountain:['Basic Land — Mountain'],Forest:['Basic Land — Forest'],Island:['Basic Land — Island']};
async function open(state){
 const context=await browser.newContext({viewport:{width:1366,height:925}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{if(!r.request().url().includes('api.scryfall.com/cards/collection'))return r.abort();const ids=JSON.parse(r.request().postData()).identifiers;return r.fulfill({contentType:'application/json',body:JSON.stringify({data:ids.filter(i=>TYPES[i.name]).map((i,k)=>({id:`fixture-${k}`,name:i.name,set:'tst',type_line:TYPES[i.name][0],power:TYPES[i.name][1],toughness:TYPES[i.name][2],mana_cost:'',oracle_text:''}))})});});
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state='+state);await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(700);
 await page.evaluate(()=>{window.calls=[];window.fixture.session.nativeSelect=(kind,id)=>{window.calls.push([kind,id]);return Promise.resolve();};});
 return {context,page,errors};
}
const center=async(page,selector)=>{const b=await page.locator(selector).first().boundingBox();return [b.x+b.width/2,b.y+b.height/2];};
const idOf=(page,seat,name)=>page.evaluate(([seat,name])=>window.fixture.session.snapshot().status.surface.cards.find(c=>c.zone==='Battlefield'&&c.name===name&&(c.controller===window.fixture.session.snapshot().status.surface.seat)===(seat==='you')).id,[seat,name]);
async function drag(page,from,to,check){
 const [ax,ay]=await center(page,from),[bx,by]=await center(page,to);
 await page.mouse.move(ax,ay);await page.mouse.down();await page.mouse.move(ax+20,ay-20,{steps:3});await page.mouse.move(bx,by,{steps:8});
 const lit=await check?.();await page.mouse.up();await sleep(250);return lit;
}
try{
 {const {context,page,errors}=await open('block');
  const blocker=await idOf(page,'you','Goblin Guide'),attacker=await idOf(page,'cpu','Hill Giant');
  const lit=await drag(page,`.play-match-card[data-instance="${blocker}"]`,`.play-match-card[data-instance="${attacker}"]`,()=>page.evaluate(()=>({mode:document.querySelector('.play-match-table').dataset.forgeDragMode,drops:[...document.querySelectorAll('[data-forge-drop]')].map(e=>e.dataset.forgeDrop)})));
  assert.equal(lit.mode,'block','the table knows a block is being dragged');
  assert.deepEqual(lit.drops.sort(),['over','true'],'both CPU attackers are lit, the one under the pointer brightest');
  assert.deepEqual(await page.evaluate(()=>window.calls),[['card',attacker],['card',blocker]],'attacker first, then the blocker');
  assert.equal(await page.locator('[data-forge-drop]').count(),0,'the lit drops clear when the drag ends');
  // Forge already pairs this blocker with that attacker: nothing is sent, so the block stays.
  await page.evaluate(([b,a])=>{const raw=structuredClone(window.fixture.native);raw.revision=8;for(const p of raw.players)for(const c of p.zones.Battlefield.cards)if(c.id===b)Object.assign(c,{blocking:true,blockingIds:[a]});window.fixture.session.acceptState(raw);window.calls=[];},[blocker,attacker]);await sleep(300);
  await drag(page,`.play-match-card[data-instance="${blocker}"]`,`.play-match-card[data-instance="${attacker}"]`);
  assert.deepEqual(await page.evaluate(()=>window.calls),[],'an existing pairing is not toggled off');
  assert.deepEqual(errors,[],'no page errors');await context.close();}
 {const {context,page,errors}=await open('attack');
  const attacker=await idOf(page,'you','Grizzly Bears'),cpuSeat=await page.evaluate(()=>{const v=window.fixture.session.snapshot().status.surface;return v.players.find(p=>p.seat!==v.seat);});
  await drag(page,`.play-match-card[data-instance="${attacker}"]`,`.play-match-seat[data-player-seat="${cpuSeat.seat}"]`);
  assert.deepEqual(await page.evaluate(()=>window.calls),[['player',cpuSeat.nativeId],['card',attacker]],'the defender first, then the attacker');
  assert.deepEqual(errors,[],'no page errors');await context.close();}
 console.log('PASS: dragging a blocker onto an attacker, or an attacker onto the CPU, sends Forge both halves of the pairing in order; legal drops are lit; an existing pairing is left alone.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
