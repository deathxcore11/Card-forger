// Production Magic loading, quote, planner and shopping callbacks. All reads,
// clipboard writes and account commits below are deterministic local fakes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const storage=new Map([['cardstashy-mtg-cheapest',JSON.stringify({mountain:{usd:.001,at:Date.now()}})]]);
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
let liveReads=0;globalThis.fetch=()=>{liveReads++;throw Error('Live network forbidden');};
const {findCheapestPrinting,cheapestKnown,lowestEligiblePrinting,refreshCheapest}=await import('./mtg-cheap.js');
const {S,blank,meta,cacheCard,priceOf}=await import('./store.js');
const {cardKey,cardPrice,namePrice,typeText,commanderEligible,sumQty,aggregateCards}=await import('./core.js');
const {completionPlan,commanderTheme}=await import('./planner.js');
const {formatOf}=await import('./formats.js');
const {prepareMtgDeck}=await import('./ai-deck-builder.js');
assert.equal(cheapestKnown('mountain'),null,'legacy first-row cache is not eligibility evidence');
assert.equal(cardPrice({prices:{usd:' \t '}}),null,'blank raw catalogue quote cannot become a free numeric quote upstream');
assert.equal(cardPrice({prices:{usd:0}}),0,'known raw catalogue zero is preserved');
assert.equal(namePrice({finishes:['nonfoil']},()=> ' \t '),null,'name-based injected blank quote is not free');
assert.equal(namePrice({finishes:['nonfoil']},()=>0),0,'known injected zero is preserved');
const card=(name,price,more={})=>({id:name+'-id',oracle_id:name+'-oracle',name,type_line:'Creature — Human',color_identity:['R'],cmc:2,mana_cost:'{1}{R}',oracle_text:'When this creature enters, draw a card.',games:['paper'],digital:false,oversized:false,border_color:'black',set_type:'core',legalities:{commander:'legal',standard:'legal'},set:'fix',set_name:'Fixture',collector_number:'1',prices:{usd:price},...more});
const mountain=(id,price,more={})=>card('Mountain',price,{id,type_line:'Basic Land — Mountain',cmc:0,mana_cost:'',produced_mana:['R'],...more});
const expensive=mountain('art-expensive','25',{full_art:true,image_uris:{normal:'fixture-art'}}),cheap=mountain('legal-cheap','.05',{set:'low',set_name:'Low set',collector_number:'22'}),illegal=mountain('illegal-cheap','.001',{legalities:{commander:'banned',standard:'not_legal'}});
const candidates=[expensive,illegal,mountain('gold','.001',{border_color:'gold'}),mountain('digital','.001',{games:['arena']}),mountain('wrong-oracle','.001',{oracle_id:'another-card'}),mountain('no-quote',null),cheap];
for(const layout of ['art_series','token','double_faced_token','emblem','planar','scheme','vanguard'])assert.equal(lowestEligiblePrinting([mountain('nonplayable','.001',{layout}),cheap],'Mountain',{reference:expensive,format:'standard'}).id,cheap.id,'Optimistic legality cannot make '+layout+' a playable printing');
let checks=0;
const result=await findCheapestPrinting('Mountain',{api:async()=>{checks++;return{data:candidates,has_more:true};},reference:expensive,format:'standard',basicOnly:true});
assert.equal(result.card.id,cheap.id,'numeric known price beats art and provider order');assert.equal(checks,1);assert.equal(result.coverage.hasMore,true);assert.equal(result.coverage.marketComplete,false);assert.equal(cheapestKnown('mountain').usd,.05);
assert.equal(lowestEligiblePrinting([mountain('empty',''),mountain('missing',null),mountain('blank',' \t\n ')],'Mountain',{format:'standard'}),null,'unknown is not free');
assert.equal(lowestEligiblePrinting([mountain('zero',0),cheap],'Mountain',{format:'standard'}).id,'zero','genuinely known zero remains a quote');
assert.equal(lowestEligiblePrinting([mountain('wrong-format','.001',{legalities:{commander:'legal',standard:'not_legal'}}),cheap],'Mountain',{format:'standard'}).id,cheap.id);
assert.equal(lowestEligiblePrinting([{...cheap,name:'Snow-Covered Mountain'}],'Mountain',{format:'standard'}),null,'a different gameplay name is not an equivalent');
const beforeChecks=checks;await refreshCheapest(['Mountain'],{api:async()=>{checks++;return{data:candidates};},format:'standard'});assert.equal(checks,beforeChecks,'fresh checked quote avoids a refresh loop');

const leader=card('Fixture Leader','1',{type_line:'Legendary Creature — Human'}),spells=Array.from({length:80},(_,i)=>card('Spell '+i,'.10'));
const app=fs.readFileSync('app.js','utf8');
function harness({choice=null,owned=0}={}){
 S.state=blank();S.catalog={};[leader,expensive,...spells].forEach(c=>cacheCard(c));
 S.state.collection=owned?[{id:'owned-basic',name:'Mountain',qty:owned,finish:'foil',printingId:'owned-not-cheapest',printingVerified:true}]:[];
 if(choice)S.state.priceChoices={mountain:structuredClone(choice)};
 const calls=[],copied=[],shops=[],notes=[],A={},ctx={A,S,URLSearchParams,encodeURIComponent,key:cardKey,cardPrice,typeText,commanderEligible,commanderTheme,completionPlan,findCheapestPrinting,cheapestKnown,priceOf,meta,cacheCard,aggregateCards,themeQueries:()=>[],saveCatalogSoon:()=>{},
  resolve:async n=>{const c=meta(n);if(!c)throw Error('Unresolved fixture');return c;},
  api:async path=>{calls.push(path);if(path.startsWith('/cards/')&&!path.includes('search'))throw Error('Legacy selected printing unavailable');const q=new URL(path,'https://fixture.invalid').searchParams.get('q');return {data:q.includes('t:basic')?candidates:spells,has_more:q.includes('t:basic')};},
  copyText:async(text,note)=>{copied.push(text);notes.push(note);},toast:s=>notes.push(s),massLines:async(game,rows)=>{shops.push(structuredClone(rows));return rows.map(r=>`${r.qty} ${r.name}`);},buyOnTcgplayer:async()=>true,scopedCommit:()=>async(fn)=>fn(S.state)};
 vm.createContext(ctx);
 vm.runInContext(app.slice(app.indexOf('const poolCache ='),app.indexOf('const tierList =')),ctx);
 vm.runInContext(app.slice(app.indexOf('async function loadCandidates('),app.indexOf('A.fillBudget =')),ctx);
 vm.runInContext(app.slice(app.indexOf('async function buyMtg('),app.indexOf('A.tierSaveGo =')),ctx);
 vm.runInContext(app.slice(app.indexOf('A.tierBuy ='),app.indexOf('A.tierSaveAll =')),ctx);
 vm.runInContext(app.slice(app.indexOf('A.choosePrint ='),app.indexOf('A.clearPrint =')),ctx);
 return {ctx,A,calls,copied,shops,notes};
}
let h=harness(),base={id:'fixture',format:'Commander',commander:leader.name,cards:[{name:leader.name,qty:1}],strategy:'Auto'};
const loaded=await h.ctx.loadCandidates(base,10,()=>{});assert.equal(meta('Mountain').id,cheap.id);assert.equal(loaded.basics[0].price,.05);
let plan=completionPlan(base,S.state.collection,[],S.catalog,{budget:10,price:c=>priceOf(c.name)});
assert.equal(sumQty(plan.deck.cards),100,'already-priced expensive basic no longer leaves a half deck at this real budget');assert.equal(plan.stats.lands,36);assert.ok(plan.cost<=10&&plan.cost>=9.09);assert.equal(S.state.decks.length,0);
h=harness();await h.ctx.loadFormatPool(formatOf('Standard'),['R'],leader,()=>{});assert.equal(meta('Mountain').id,cheap.id,'actual generic/random format pool also checks priced basics');
const selected={id:'chosen-premium',set:'sel',setName:'Selected set',cn:'99',finish:'foil',price:3,label:'SEL #99 · foil'};
h=harness({choice:selected,owned:12});const ownedBefore=JSON.stringify(S.state.collection),choiceBefore=JSON.stringify(S.state.priceChoices);await h.ctx.loadCandidates(base,10,()=>{});
assert.equal(priceOf('Mountain'),3,'selected finish price wins over a cheaper global quote');assert.equal(JSON.stringify(S.state.collection),ownedBefore);assert.equal(JSON.stringify(S.state.priceChoices),choiceBefore);
plan=completionPlan(base,S.state.collection,[],S.catalog,{budget:10,price:c=>priceOf(c.name)});assert.ok(plan.stats.lands<36,'a selected expensive printing cannot be silently budgeted as the cheap one');
plan=completionPlan(base,S.state.collection,[],S.catalog,{budget:0,price:c=>priceOf(c.name)});assert.equal(plan.stats.lands,12,'only actual available basic copies are free');
for (const missing of [null,' \t\n ']) { S.state.priceChoices.mountain.price=missing;plan=completionPlan(base,S.state.collection,[],S.catalog,{budget:Infinity,price:c=>priceOf(c.name)});assert.equal(plan.cost,null);assert.equal(plan.diagnostics.unpricedPurchaseCopies,24,'an explicit unknown or whitespace-only selected price cannot borrow a cheap generic quote'); }
S.state.priceChoices.mountain.price=0;plan=completionPlan(base,S.state.collection,[],S.catalog,{budget:10,price:c=>priceOf(c.name)});assert.equal(plan.diagnostics.unpricedPurchaseCopies,0,'genuine selected numeric zero stays known');assert.equal(plan.stats.lands,36);S.state.priceChoices.mountain.price=3;

// Both regular and explicit-finish purchases keep every missing basic copy.
S.ui.build={format:'Commander',results:{Commander:[{cards:[{name:'Mountain',qty:36},{name:leader.name,qty:1}]}]},avail:n=>n==='Mountain'?12:1};
await h.A.tierBuy({dataset:{i:'0'}});assert.equal(h.shops.length,0,'finish cannot be dropped into the regular Mass Entry serializer');assert.match(h.copied[0],/^24 Mountain \[SEL\] 99 · foil$/);assert.doesNotMatch(h.notes.join(' '),/You own every/);assert.match(h.notes.join(' '),/no cart was opened or purchase made/);
await h.ctx.buyMtg([{name:'Mountain',qty:2},{name:leader.name,qty:1}]);assert.match(h.copied[1],/Mountain \[SEL\] 99 · foil\n1 Fixture Leader \[FIX\] 1 · nonfoil/,'mixed list retains exact finish per row');
S.state.priceChoices.mountain.finish='nonfoil';await h.ctx.buyMtg([{name:'Mountain',qty:2}]);assert.equal(h.shops.at(-1)[0].code,'sel');assert.equal(h.shops.at(-1)[0].num,'99');
S.state.priceChoices.mountain={id:'unresolved-legacy',finish:'foil',price:5};const count=h.shops.length;await h.ctx.buyMtg([{name:'Mountain',qty:1}]);assert.equal(h.shops.length,count);assert.match(h.notes.at(-1),/needs verification/);assert.equal(S.state.priceChoices.mountain.id,'unresolved-legacy');
delete S.state.priceChoices;await h.A.tierBuy({dataset:{i:'0'}});assert.equal(h.shops.at(-1)[0].qty,24);assert.equal(h.shops.at(-1)[0].code,'low');
S.ui.sheetCtx={prints:[{...expensive,id:'picker-chosen',prices:{usd_foil:'9'},set:'pick',collector_number:'9'}]};await h.A.choosePrint({dataset:{i:'0',finish:'foil',name:'Mountain'}});assert.equal(S.state.priceChoices.mountain.set,'pick');assert.equal(S.state.priceChoices.mountain.cn,'9');assert.equal(S.state.priceChoices.mountain.finish,'foil');assert.equal(JSON.stringify(S.state.collection),ownedBefore);

// AI preparation uses the same bounded legal basic lookup and selected price basis.
h=harness();let built=await prepareMtgDeck({format:'Commander',seed:leader.name,commander:leader.name,budget:10,budget_basis:'total'},{...h.ctx,inv:()=>({available:0})});
assert.equal(built.draft.total,100);assert.equal(built.draft.totalEstimate,9);assert.match(built.draft.priceBasis,/bounded Scryfall results, not the whole market/);
h=harness({choice:selected});built=await prepareMtgDeck({format:'Commander',seed:leader.name,commander:leader.name,budget:10,budget_basis:'total'},{...h.ctx,inv:()=>({available:0})});assert.equal(built.draft.complete,false,'AI must not replace an explicit premium-printing budget');assert.equal(S.state.priceChoices.mountain.finish,'foil');assert.equal(S.state.decks.length,0);
S.state.priceChoices.mountain.price=' \t ';built=await prepareMtgDeck({format:'Commander',seed:leader.name,commander:leader.name,budget:0,budget_basis:'total'},{...h.ctx,inv:()=>({available:0})});assert.equal(built.draft.totalEstimate,null);assert.equal(built.draft.unpricedCopies,38,'AI also treats a whitespace-only selected quote as unknown');
assert.equal(liveReads,0);
console.log('PASS: actual Magic idea/fill, generic/random basic pool, AI preparation and purchase callbacks choose lowest checked eligible quotes, charge all unowned basics, keep unknown prices unknown, disclose bounded coverage, preserve selected printing/finish and physical ownership, and never purchase or save.');
