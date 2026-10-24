// Actual retrieved Arahbo responses are the negative fixture. The successful
// nonfoil quote below is synthetic, not a claimed available Arahbo printing.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareMtgDeck} from './ai-deck-builder.js';import {cardKey,cardPrice} from './core.js';import {lowestEligiblePrinting} from './mtg-cheap.js';
const evidence=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/arahbo-printing-recovery.json',import.meta.url))),original=evidence.responses[0].data,actual=evidence.responses[1].data;
assert.equal(original.prices.usd,null);assert.equal(lowestEligiblePrinting(actual.data,original.name,{reference:original,format:'commander'}),null,'Actual retained response has no usable nonfoil quote; foil prices are not substituted');
const replacement={...structuredClone(original),id:'synthetic-priced-paper-printing',finishes:['nonfoil'],prices:{...original.prices,usd:'5'},games:['paper'],digital:false,border_color:'black',oversized:false};
async function run({data=[replacement],locked=false,cancel=false,full=false,extraArgs={}}={}){
 const catalog={[cardKey(original.name)]:structuredClone(original)};let calls=0,active=true;
 const x={S:{state:{priceChoices:locked?{[cardKey(original.name)]:{price:null}}:{}},catalog},meta:n=>catalog[cardKey(n)],resolve:async n=>catalog[cardKey(n)]||null,cacheCard:c=>catalog[cardKey(c.name)]=c,priceOf:n=>cardPrice(catalog[cardKey(n)]),inv:()=>({available:0}),api:async()=>{calls++;if(cancel)active=false;return {data,has_more:true};}};
 const result=await prepareMtgDeck({format:'Commander',seed:original.name,commander:original.name,budget:50,flow:true,required_cards:full?[]:['Unresolved test-only requirement'],...extraArgs,current:()=>active},x);
 return {result,calls,card:catalog[cardKey(original.name)],catalog};
}
let r=await run();assert.equal(r.calls,1,'Same named seed and commander needs one bounded print page');assert.equal(r.card.id,replacement.id);assert.equal(r.card.oracle_id,original.oracle_id);assert.equal(r.card.prices.usd,'5');
r=await run({locked:true});assert.equal(r.calls,0);assert.equal(r.card.id,original.id,'Explicit quote/printing choice is not replaced');
r=await run({data:actual.data});assert.equal(r.calls,1);assert.equal(r.card.prices.usd,null);assert(r.result.requiresChoice,'An unresolved explicit requirement does not manufacture a ready result after quote recovery');
r=await run({data:[{...replacement,oracle_id:'synthetic-other-oracle'}]});assert.equal(r.card.id,original.id,'Same name/art with wrong logical identity cannot recover the quote');
r=await run({cancel:true});assert(r.result.cancelled);assert.equal(r.card.id,original.id,'Late replacement cannot update catalog after cancellation');


r=await run({data:actual.data,full:true});
const selected=r.result.candidates[0].draft.referencePriceSelections[cardKey(original.name)];assert.equal(selected.finish,'foil');assert.equal(selected.printingId,actual.data[0].id);assert.equal(selected.price,Number(actual.data[0].prices.usd_foil));assert.equal(r.card.prices.usd,null,'Foil quote is never assigned to nonfoil field');
r=await run({data:actual.data,extraArgs:{finish:'nonfoil'}});assert.equal(r.calls,0,'Explicit nonfoil remains unresolved, never silently foil');
r=await run({data:actual.data.map(c=>({...c,finishes:['nonfoil','foil']})),full:true});assert(!r.result.candidates[0].draft.referencePriceSelections[cardKey(original.name)],'Mixed-finish default is not automatic foil fallback');
const {createDeckPipeline}=await import('./deck-pipeline.js'),{priceDeck,withinBudgetCap}=await import('./deck-construction.js');
const picked=structuredClone(actual.data[0]),basic=(name,color)=>({id:name,oracle_id:name,name,type_line:'Basic Land — '+name,oracle_text:'{T}: Add {'+color+'}.',produced_mana:[color],color_identity:[color],colors:[],legalities:{commander:'legal'},prices:{usd:'.1'}}),forest=basic('Forest','G'),plains=basic('Plains','W');
const catalog=Object.fromEntries([picked,forest,plains].map(c=>[cardKey(c.name),c])),deck={format:'Commander',commander:picked.name,cards:[{name:picked.name,qty:1},{name:'Forest',qty:50},{name:'Plains',qty:49}],referencePriceSelections:{[cardKey(picked.name)]:selected},referencePrices:{[cardKey(picked.name)]:selected.price}};
const pipeline=createDeckPipeline({S:{catalog,state:{}},T:{SOURCES:{ygo:{formats:[]},ptcg:{formats:[]}}},meta:n=>catalog[cardKey(n)],priceOf:n=>cardPrice(catalog[cardKey(n)]),inv:()=>({available:0})}),request={game:'mtg',format:'Commander',budgetBasis:'total',budget:45,budgetMode:'cap'};
let assessed=pipeline.assess(deck,request,{withPower:false}),priced=priceDeck(assessed.rows);assert(assessed.rows[0].referencePriceSelection.verified);assert.equal(priced.estimate,40.38);assert(withinBudgetCap(priced.estimate,request));assert(!withinBudgetCap(priced.estimate,{...request,budget:40}));
const {deckResultMarkup}=await import('./deck-experience.js');
const html=deckResultMarkup({ok:true,request:{...request,formatName:'Commander'},deck,rows:assessed.rows,pricing:priced,plan:{combo:null,mechanics:null,notes:[],engine:{links:[],unsupported:[],conflicts:[]}},compared:1,delta:null},'foil-evidence');assert.match(html,/Foil estimate/);assert(html.includes(selected.printingId));assert(html.includes(selected.retrievedAt));assert(html.includes('Scryfall'));
const clone=structuredClone(deck);assert.deepEqual(pipeline.assess(clone,request,{withPower:false}).rows[0].referencePriceSelection,assessed.rows[0].referencePriceSelection,'Cloned/refined selection retains exact finish identity');
catalog[cardKey(picked.name)]={...picked,id:'other-printing'};assessed=pipeline.assess(clone,request,{withPower:false});assert.equal(assessed.rows[0].price,null);assert(!assessed.rows[0].referencePriceSelection.verified);assert.equal(priceDeck(assessed.rows).estimate,null,'Recheck cannot carry a foil scalar onto another printing');
console.log('PASS: foil-only actual Arahbo selects its retained foil record/quote with explicit evidence and full-list cap accounting; locks, mixed finishes, wrong Oracle and changed printing cannot inherit it.');

const unavailable=await run({data:actual.data.map(c=>({...c,prices:{...c.prices,usd_foil:null}})),full:true});assert(unavailable.result.candidates.every(c=>!c.result.ready));assert(!unavailable.result.candidates[0].draft.referencePriceSelections[cardKey(original.name)]);
const nonfoilRun=await run({full:true}),nonfoilSelection=nonfoilRun.result.candidates[0].draft.referencePriceSelections[cardKey(original.name)];assert.equal(nonfoilSelection.finish,'nonfoil');assert.equal(nonfoilSelection.quoteField,'usd');assert.equal(nonfoilSelection.printingId,replacement.id);
const nonfoilDeck={...deck,referencePriceSelections:{[cardKey(picked.name)]:nonfoilSelection},referencePrices:{[cardKey(picked.name)]:5}};
catalog[cardKey(picked.name)]=replacement;let nonfoilAssessed=pipeline.assess(nonfoilDeck,request,{withPower:false});assert(nonfoilAssessed.rows[0].referencePriceSelection.verified);assert.equal(nonfoilAssessed.rows[0].price,5);
const nonfoilHtml=deckResultMarkup({ok:true,request:{...request,formatName:'Commander'},deck:nonfoilDeck,rows:nonfoilAssessed.rows,pricing:priceDeck(nonfoilAssessed.rows),plan:{notes:[],engine:{links:[],unsupported:[],conflicts:[]}},compared:1,delta:null},'nonfoil-evidence');assert.match(nonfoilHtml,/Nonfoil estimate/);assert.doesNotMatch(nonfoilHtml,/>Foil estimate</);
for(const changed of [{...replacement,id:'different-print',prices:{usd:'500'}},{...replacement,prices:{usd:'500'}}]){catalog[cardKey(picked.name)]=changed;assert.equal(pipeline.assess(nonfoilDeck,request,{withPower:false}).rows[0].price,null,'Recovered nonfoil quote cannot survive changed printing or same-id changed price');}
catalog[cardKey(picked.name)]=picked;
for(const field of ['provider','retrievedAt']){const altered=structuredClone(deck);delete altered.referencePriceSelections[cardKey(picked.name)][field];const a=pipeline.assess(altered,request,{withPower:false});assert.equal(a.rows[0].price,null);assert(!a.rows[0].referencePriceSelection.verified,'Missing provenance is not a verified quote');}
console.log('PASS: recovered nonfoil and foil quotes share exact identity/current-price/provenance guards and finish-specific presentation.');
