// Exercise the production idea budget/load/save callbacks, production planner,
// and production preview/reopened deck renderers. All providers and persistence
// are deterministic local fakes; no account, network, or paid AI requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { S, blank, meta, cacheCard, priceOf } from './store.js';
import { cardKey, cardPrice, commanderEligible, sumQty, typeText } from './core.js';
import { completionPlan, commanderTheme } from './planner.js';
import { findCheapestPrinting } from './mtg-cheap.js';
import { ideaSheet, deckPage, buildSheet } from './views.js';
import { mtgPower, shownPower, powerPanel } from './power.js';
import { formatOf } from './formats.js';
import { customBudget, usd } from './ui.js';
import { tierCardHtml } from './tier-card.js';

let networkCalls=0;
globalThis.fetch=()=>{networkCalls++;throw Error('Live network forbidden in this regression');};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const app=fs.readFileSync('app.js','utf8');
const leader={name:'The Master, Multiplied',type_line:'Legendary Creature — Time Lord Rogue',oracle_text:'Myriad. The legend rule does not apply to creature tokens you control.',mana_cost:'{4}{B}{R}',cmc:6,color_identity:['B','R'],legalities:{commander:'legal'},prices:{usd:'1'}};
const spells=Array.from({length:80},(_,i)=>({name:`Fixture support ${i}`,type_line:'Creature — Rogue',oracle_text:i%3===0?'When this creature enters, draw a card.':i%3===1?'When this creature enters, destroy target artifact.':'',mana_cost:'{1}{R}',cmc:2,color_identity:['R'],legalities:{commander:'legal'},prices:{usd:'.25'}}));
const basic=(name,price=null)=>({name,games:["paper"],type_line:`Basic Land — ${name}`,oracle_text:`{T}: Add {${name==='Swamp'?'B':'R'}}.`,produced_mana:[name==='Swamp'?'B':'R'],mana_cost:'',cmc:0,color_identity:[name==='Swamp'?'B':'R'],legalities:{commander:'legal'},prices:{usd:price}});

async function scenario({budget=25,landMode='missing',fallback=false,auto=false}={}) {
 // Isolate each synthetic scenario from the prior one's week-long checked quotes.
 for (const name of ['Swamp','Mountain']) await findCheapestPrinting(name,{api:async()=>({data:[]})});
 S.state=blank();S.state.settings.game='mtg';S.state.settings.budget=25;S.catalog={};
 for(const c of [leader,...spells,...(landMode==='unpriced'?[basic('Swamp'),basic('Mountain')]:landMode==='priced'?[basic('Swamp','.05'),basic('Mountain','.05')]:[])])cacheCard(c);
 const seed={id:'idea',format:'Commander',commander:leader.name,strategy:'Auto',budget:null,cards:[{name:leader.name,qty:1}],versions:[]};
 const idea={commander:leader,plan:'Random',deck:seed};
 S.ui.ideas={cache:[idea],open:null,sel:new Set()};S.ui.deckTab='cards';S.ui.deckId=null;
 const A={},C={},queue=[],pending=[],previews=[],commits=[],routes=[],requests=[];
 const context={A,C,S,URLSearchParams,structuredClone,key:cardKey,cardPrice,typeText,commanderEligible,commanderTheme,completionPlan,findCheapestPrinting,priceOf,sumQty,usd,customBudget,
  meta,cacheCard,formatOf,mtgPower,resolve:async name=>{const c=meta(name);if(c)return c;throw Error('Fixture basic lookup unavailable');},
  api:async path=>{requests.push(path);const q=new URL(path,'https://fixture.invalid').searchParams.get('q');if(q.includes('t:basic')){if(!fallback)throw Error('Fixture fallback unavailable');return {data:[basic(q.includes('Swamp')?'Swamp':'Mountain','.05')]};}return{data:spells};},
  V:{ideaSheet},openSheet:(html,ctx)=>{previews.push(html);S.ui.sheetCtx=ctx;},$:()=>null,queueMicrotask:fn=>queue.push(fn),safely:p=>pending.push(p),saveCatalogSoon:()=>{},render:()=>{},
  toast:s=>commits.push({toast:s}),scopedCommit:()=>async(fn,opts)=>{fn(S.state);commits.push(opts);},uid:()=>`saved-${budget}-${landMode}`,withSnapshot:(d,label)=>({...d,fixtureSnapshotLabel:label}),closeSheet:()=>S.ui.sheetCtx=null,go:path=>routes.push(path)};
 vm.createContext(context);
 vm.runInContext(app.slice(app.indexOf('function ideaDeck()'),app.indexOf('C.ideaPick =')),context);
 vm.runInContext(app.slice(app.indexOf('async function loadCandidates('),app.indexOf('A.fillBudget =')),context);
 vm.runInContext(app.slice(app.indexOf('A.ideaSaveAll ='),app.indexOf('A.ideaToDeck =')),context);
 if(auto){A.openIdea({dataset:{i:'0'}});queue.splice(0).forEach(fn=>fn());await Promise.all(pending);}
 else {S.ui.ideas.open={i:0,budget,custom:null,busy:false,initialized:true};await A.ideaBudget({dataset:{v:String(budget)}});}
 return {A,context,previews,commits,routes,requests,get deck(){return S.ui.ideas.open.custom || seed;},get open(){return S.ui.ideas.open;}};
}

for(const budget of [25,10000,Infinity])for(const landMode of (budget===Infinity?['missing']:['missing','unpriced'])){
 const run=await scenario({budget,landMode});
 assert.equal(sumQty(run.deck.cards),64,`${budget}: absence of usable basic data reproduces 64 nonlands, not a budget shortage`);
 assert.equal(run.open.diagnostics.missingLands,36);assert.equal(run.open.diagnostics.lands,0);
 assert.equal(run.open.budget,budget,'the explicit budget remains selected');
 assert.equal(shownPower(mtgPower(run.deck)),null,'incomplete list has no overall Power');
 const html=run.previews.at(-1);assert.match(html,/64\/100/);assert.match(html,/Power unavailable/);assert.match(html,/Save 64-card draft/);assert.match(html,/>Save draft<\/button>/);assert.doesNotMatch(html,/Save entire|<small>Engine<\/small>/);
 assert.match(html,landMode==='missing'?/Basic land details are unavailable/:/No purchase price is available/);
 assert.match(run.open.msg,/Incomplete draft/);assert.doesNotMatch(run.open.msg,/Complete 100-card list/);
 await run.A.ideaSaveAll();
 const saved=S.state.decks[0];assert.equal(sumQty(saved.cards),64);assert.match(run.commits.at(-1).msg,/Saved incomplete draft \(64\/100 cards\)/);assert.match(saved.fixtureSnapshotLabel,/incomplete draft/);
 const reloaded=JSON.parse(JSON.stringify(S.state));S.state=reloaded;S.ui.deckId=reloaded.decks[0].id;
 const reopened=deckPage();assert.match(reopened,/64\/100/);assert.match(reopened,/power unavailable/);assert.match(reopened,/Incomplete draft: 36 slots remain/);assert.match(reopened,/not in your collection yet/);assert.doesNotMatch(reopened,/to finish/);assert.doesNotMatch(reopened,/<b>55<\/b>power|<b>null<\/b>/);
 assert.equal(shownPower(mtgPower(S.state.decks[0])),null,'save + serialized reopen cannot restore a numeric Power');
 const panel=powerPanel(mtgPower(S.state.decks[0]));assert.match(panel,/Finish the deck before rating Power/);
}

for(const budget of [25,10000,Infinity]){
 const run=await scenario({budget,landMode:'unpriced',fallback:true});
 assert.equal(sumQty(run.deck.cards),100,'exact priced basic fallback completes the real planner');
 assert.equal(run.open.diagnostics.lands,36);assert.equal(run.open.diagnostics.missingLands,0);
 assert.ok(run.open.diagnostics.basicCandidates.every(c=>c.price===.05));
 const cost=run.deck.cards.reduce((n,r)=>n+cardPrice(meta(r.name))*r.qty,0);assert.ok(cost<=budget);assert.ok(cost>17,'basic lands are included in purchase cost, not assumed free');
 assert.match(run.previews.at(-1),/Save 100-card list/);assert.match(run.open.msg,/Complete 100-card list/);
 await run.A.ideaSaveAll();assert.match(run.commits.at(-1).msg,/Saved complete 100-card list/);
}

const unknownUncapped=await scenario({budget:Infinity,landMode:'unpriced'});
assert.equal(sumQty(unknownUncapped.deck.cards),100,'no cap permits verified legal identities despite unavailable price, not invented free lands');
assert.equal(unknownUncapped.open.diagnostics.lands,36);
assert.equal(unknownUncapped.open.diagnostics.unpricedPurchaseCopies,36);
assert.equal(unknownUncapped.open.diagnostics.purchaseEstimateVerified,false);
assert.match(unknownUncapped.open.msg,/purchase cost unverified/);
assert.match(unknownUncapped.previews.at(-1),/Known purchase subtotal/);
assert.match(unknownUncapped.previews.at(-1),/36 missing card copies have no purchase price/);
assert.match(unknownUncapped.previews.at(-1),/Total purchase cost is unverified, not free/);
await unknownUncapped.A.ideaSaveAll();assert.equal(S.state.decks[0].buildDiagnostics.purchaseEstimateVerified,false);

const uncapped=await scenario({landMode:'unpriced',fallback:true,auto:true});
assert.equal(uncapped.open.budget,Infinity,'fresh idea ignores unrelated settings default25 instead of silently imposing it');
assert.match(uncapped.previews.at(-1),/chip pick on[^>]*data-v="Infinity"[^>]*>No purchase cap/);
assert.equal(uncapped.deck.budget,null,'no-cap draft stores a JSON-safe null, not Infinity');
assert.ok(uncapped.requests.some(path=>{const q=new URL(path,'https://fixture.invalid').searchParams.get('q');return q.includes('card')===false&&!q.includes('usd<=')&&!q.includes('t:basic');}),'no-cap candidate route has no invented numeric budget filter');
const before=uncapped.deck;uncapped.open.busy=true;await uncapped.A.ideaBudget({dataset:{v:'25'}});assert.equal(uncapped.open.budget,Infinity,'a blocked request cannot relabel an in-flight draft');uncapped.open.busy=false;
await uncapped.A.ideaBudget({dataset:{v:'25'}});assert.equal(uncapped.open.budget,25);assert.equal(S.ui.ideas.defaultBudget,25);assert.notEqual(uncapped.deck,before);

// Unsupported strategic coverage cannot reclassify a legal100 as partial;
// actual legality errors do keep the same save callback in draft mode.
const reviewDraft=await scenario({budget:25,landMode:'priced'});
const rows=reviewDraft.open.custom.cards;
rows.find(r=>r.name===leader.name).qty=2;rows.find(r=>r.name==='Swamp').qty--;
assert.equal(sumQty(rows),100);assert.equal(mtgPower(reviewDraft.deck).readiness.eligible,false);
await reviewDraft.A.ideaSaveAll();assert.match(reviewDraft.commits.at(-1).msg,/Saved draft \(100\/100 cards; deck checks need review\)/);

// A hard failure after an earlier successful preview must not leave that old
// list saveable under a newly selected cheaper budget.
const failed=await scenario({budget:10000,landMode:'priced'});
assert.equal(sumQty(failed.deck.cards),100);
failed.context.resolve=async()=>{throw Error('Fixture commander details offline');};
await failed.A.ideaBudget({dataset:{v:'25'}});
assert.equal(failed.open.custom,null);assert.match(failed.open.msg,/Build failed/);
assert.match(failed.previews.at(-1),/data-act="ideaSaveAll" disabled/);
const savedBefore=S.state.decks.length;await failed.A.ideaSaveAll();
assert.equal(S.state.decks.length,savedBefore);assert.match(failed.commits.at(-1).toast,/build failed/i);

// Under a finite cap, known land prices produce a real budget warning rather
// than a bogus missing-data diagnosis, and no free cards are fabricated.
const pricedTooSmall=await scenario({budget:1.50,landMode:'priced'});
assert.ok(sumQty(pricedTooSmall.deck.cards)<100);
assert.match(pricedTooSmall.open.diagnostics.warnings.join(' '),/do not fit the purchase budget/);
assert.doesNotMatch(pricedTooSmall.open.diagnostics.warnings.join(' '),/No purchase price|details are unavailable/);
assert.ok(pricedTooSmall.deck.cards.reduce((n,r)=>n+cardPrice(meta(r.name))*r.qty,0)<=1.500001);

const genericBasics=await scenario({budget:25,landMode:'priced'});
const completeTier={...genericBasics.deck,total:100,size:100,owned:0,cost:18.55,unknown:0,warnings:[],lands:36};
S.ui.build={seed:leader.name,format:'Commander',openTier:0,results:{Commander:[completeTier]},busy:false,avail:()=>0};
const basicPreview=buildSheet();assert.match(basicPreview,/Buy 100 on TCGplayer/,'unowned generic-builder basics remain on the buy list');assert.match(basicPreview,/Need 18/);assert.doesNotMatch(basicPreview,/>Basic land<|Basic lands count as owned/);

const partial=await scenario({budget:25,landMode:'unpriced'});
const draft={...partial.deck,total:64,size:100,owned:0,cost:16.75,unknown:0,warnings:[],lands:0,power:99,engine:99};
S.ui.build={seed:leader.name,format:'Commander',openTier:0,results:{Commander:[draft]},busy:false,avail:()=>0};
const builder=buildSheet();assert.match(builder,/power unavailable/);assert.match(builder,/Save draft/);assert.doesNotMatch(builder,/<b>99<\/b> (?:power|comp\.)/,'stale raw tier scores do not bypass canonical gating');
const generic=tierCardHtml({title:'Draft',format:'Commander',legal:{ok:false,text:'Incomplete'},cost:0,groups:[],sizeText:'64/100',powerUnavailable:true,complete:false});assert.match(generic,/power unavailable/);assert.match(generic,/Save draft/);
assert.equal(networkCalls,0);
console.log('PASS: actual idea/load/save/reopen handlers reproduce 64/100 for missing/unpriced basics at $25, $10,000 and missing identities at no cap; no overall Power or finished-save labels leak; priced fallback completes within real costs; no cap with verified unpriced basics completes with explicitly unknown cost; explicit budget survives and fresh ideas have no imposed $25 cap.');
