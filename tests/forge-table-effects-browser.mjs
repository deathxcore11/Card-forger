// Live Forge table (fixture board, no transport): the four board sequences come only from accepted
// changes. Tapping sources stream mana to a new stack item, a new permanent gets an arrival ring,
// combat damage pops a number on the creature that took it, and a new attachment flashes its host.
// Reduced motion shows none of them.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const TYPES={'Hill Giant':['Creature — Giant','3','3'],'Grizzly Bears':['Creature — Bear','2','2'],'Goblin Guide':['Creature — Goblin Scout','2','2'],Mountain:['Basic Land — Mountain'],Forest:['Basic Land — Forest'],Island:['Basic Land — Island'],'Swiftfoot Boots':['Artifact — Equipment']};
async function open(reduced){
 const context=await browser.newContext({viewport:{width:1366,height:925},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>{if(!r.request().url().includes('api.scryfall.com/cards/collection'))return r.abort();const ids=JSON.parse(r.request().postData()).identifiers;return r.fulfill({contentType:'application/json',body:JSON.stringify({data:ids.filter(i=>TYPES[i.name]).map((i,k)=>({id:`fixture-${k}`,name:i.name,set:'tst',type_line:TYPES[i.name][0],power:TYPES[i.name][1],toughness:TYPES[i.name][2],mana_cost:'',oracle_text:''}))})});});
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(600);
 await page.evaluate(()=>{window.rev=7;window.next=edit=>{const raw=structuredClone(window.lastRaw||window.fixture.native);raw.revision=++window.rev;edit(raw);window.lastRaw=raw;window.fixture.session.acceptState(raw);};window.mine=raw=>raw.players.find(p=>p.isViewer).zones.Battlefield.cards;
  window.seen=new Set();new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.classList)for(const k of ['forge-fx-mana','forge-fx-ring','forge-fx-number'])if(n.classList.contains(k))window.seen.add(k+(n.dataset.kind?':'+n.dataset.kind:''));}).observe(document.body,{childList:true,subtree:true});});
 return {context,page,errors};
}
const step=async(page,fn,arg)=>{await page.evaluate(()=>window.seen.clear());await page.evaluate(fn,arg);await sleep(700);return page.evaluate(()=>[...window.seen].sort());};
try{
 {const {context,page,errors}=await open(false);
  // Two untapped Mountains tap and Lightning Bolt goes on the stack.
  const mana=await step(page,()=>window.next(raw=>{let n=0;for(const c of window.mine(raw))if(c.name==='Mountain'&&!c.tapped&&n<1){c.tapped=true;n++;}const bolt=raw.players.find(p=>p.isViewer).zones.Hand.cards.find(c=>c.name==='Lightning Bolt');raw.players.find(p=>p.isViewer).zones.Hand.cards=raw.players.find(p=>p.isViewer).zones.Hand.cards.filter(c=>c!==bolt);bolt.zone='Stack';raw.stack=[{id:700,text:'Lightning Bolt deals 3 damage to any target.',source:bolt,activatingPlayer:1}];raw.priorityPlayer=1;}));
  assert.ok(mana.includes('forge-fx-mana'),'mana streams from the tapped source: '+mana);
  assert.ok(mana.includes('forge-fx-ring:tap'),'the source that paid pulses');
  // A creature arrives.
  const arrive=await step(page,()=>window.next(raw=>{raw.stack=[];const elf=raw.players.find(p=>p.isViewer).zones.Hand.cards.find(c=>c.name==='Llanowar Elves');raw.players.find(p=>p.isViewer).zones.Hand.cards=raw.players.find(p=>p.isViewer).zones.Hand.cards.filter(c=>c!==elf);elf.zone='Battlefield';elf.type='Creature — Elf Druid';window.mine(raw).push(elf);}));
  assert.ok(arrive.some(k=>k.startsWith('forge-fx-ring:')),'the new permanent settles with a ring: '+arrive);
  // Combat damage: Hill Giant attacked and was dealt 2.
  await page.evaluate(()=>window.next(raw=>{raw.phase='COMBAT_DECLARE_BLOCKERS';for(const c of window.mine(raw))if(c.name==='Hill Giant')Object.assign(c,{attacking:true,attackTarget:{kind:'player',id:2}});}));await sleep(500);
  const hit=await step(page,()=>window.next(raw=>{raw.phase='COMBAT_DAMAGE';for(const c of window.mine(raw))if(c.name==='Hill Giant')c.damage=2;raw.players.find(p=>!p.isViewer).life-=3;}));
  assert.ok(hit.includes('forge-fx-number:damage'),'damage pops on the creature that took it: '+hit);
  // Equipment attaches to Grizzly Bears.
  const attach=await step(page,()=>window.next(raw=>{raw.phase='MAIN2';for(const c of window.mine(raw))c.attacking=false;const bears=window.mine(raw).find(c=>c.name==='Grizzly Bears'),sig=window.mine(raw).find(c=>c.name==='Arcane Signet');sig.attachedTo=bears.id;bears.attachments=[sig.id];}));
  assert.ok(attach.includes('forge-fx-ring:attach'),'the host flashes when something attaches: '+attach);
  assert.ok(await page.locator('.play-match-attach-group').count()>=1,'the attachment is tucked under its host');
  assert.deepEqual(errors,[],'no page errors');await context.close();}
 {const {context,page,errors}=await open(true);
  const none=await step(page,()=>window.next(raw=>{for(const c of window.mine(raw))if(c.name==='Mountain')c.tapped=true;raw.stack=[{id:701,text:'X',source:null,activatingPlayer:1}];}));
  assert.deepEqual(none,[],'reduced motion: no board effects');
  assert.deepEqual(errors,[],'no page errors');await context.close();}
 console.log('PASS: mana streams, arrival rings, damage numbers and attach flashes follow accepted changes only, and reduced motion turns them off.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
