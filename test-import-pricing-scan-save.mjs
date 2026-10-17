import assert from 'node:assert/strict';
import { S, blank } from './store.js';
import { registerTcg, cache, entryPrice } from './tcg.js';
import { conditionRequest, loadConditionQuotes } from './condition-feed.js';
import { normalizePtcg } from './ptcg.js';
import { normalizeYgo } from './ygo.js';
const p=normalizePtcg({id:'base1-4',name:'Charizard',localId:'4',category:'Pokemon',set:{id:'base1',name:'Base Set'},pricing:{tcgplayer:{normal:{marketPrice:5}}},variants_detailed:[{variantId:'shadowless',type:'holo',subtype:'shadowless',thirdParty:{tcgplayer:42}}]});
const y=normalizeYgo({id:46986414,name:'Dark Magician',type:'Normal Monster',card_prices:[{tcgplayer_price:'8'}],card_sets:[{set_code:'LOB-005',set_name:'Legend of Blue Eyes',set_rarity:'Ultra Rare',set_price:'9'}]});
y.sets[0].quotes=[{edition:'1st Edition',marketPrice:11},{edition:'Unlimited',marketPrice:4}];
S.state=blank();S.state.settings.game='mtg';
const A={},c={A,C:{},I:{},commit:async fn=>fn(S.state),render:()=>{},openSheet:()=>{},closeSheet:()=>{},toast:()=>{},writeRecord:async()=>{},go:()=>{},busy:()=>()=>{}};
registerTcg(c);
const item=(card,finish,extra={})=>({qty:1,finish,variantKey:finish,cand:{id:card.id,name:card.name,card,print:''},...extra});
await c.scanAddMany([item(p,'normal')],'ptcg');
await c.scanAddMany([item(p,'detail:shadowless',{productId:42,qty:2})],'ptcg');
assert.equal(S.state.settings.game,'mtg');assert.equal(S.state.collection.length,0);
assert.deepEqual(S.state.tcg.ptcg.collection.map(r=>[r.variant,r.qty,r.productId]),[['normal',1,''],['detail:shadowless',2,42]]);
assert.equal(c.scanPrice({card:p},'normal'),5);assert.equal(c.scanPrice({card:p},'detail:shadowless'),null,'unpriced Shadowless never receives ordinary finish price');
assert.equal(c.scanPrice({card:p},''),null);
const yItem=item(y,'unlimited',{print:'LOB-005|Ultra Rare'});await c.scanAddMany([yItem],'ygo');
const saved=S.state.tcg.ygo.collection[0];assert.equal(saved.printing,'LOB-005');assert.equal(saved.rarity,'Ultra Rare');assert.equal(saved.edition,'unlimited');
assert.equal(c.scanPrice({...yItem.cand,print:yItem.print},'unlimited'),4);assert.equal(c.scanPrice({...yItem.cand,print:yItem.print},'1st-edition'),11);assert.equal(c.scanPrice({...yItem.cand,print:yItem.print},'limited'),null);
const before=JSON.stringify(S.state);
for(const bad of [item(p,''),item(p,'missing'),item(p,'normal',{qty:0}),item(p,'detail:shadowless',{productId:99}),item(p,'normal',{variantKey:'detail:shadowless'})]) {
  await assert.rejects(c.scanAddMany([item(p,'normal'),bad],'ptcg'));
  assert.equal(JSON.stringify(S.state),before,'entire batch rejected without partial writes');
}
await assert.rejects(c.scanAddMany([item(y,'unlimited')],'ptcg'),/different game/);
await assert.rejects(c.scanAddMany([item(p,'normal')],'mtg'),/supported scan game/);
cache.ptcg[p.id]=p;assert.equal((await c.scanCandById('ptcg',p.id,'Fixture',true)).card.game,'ptcg');
console.log('PASS: detected-game scan saves, exact normal/detailed variants and product ids, YGO editions/printings, finish-specific missing-price safety and atomic rejection of unresolved or mismatched batches.');

// Scanner lots use the exact same condition-request identity and quote resolver as Search adds.
await c.scanAddMany([item(p,'detail:shadowless',{productId:42,condition:'Moderately Played',lang:'ja'})],'ptcg');
const scanLot=S.state.tcg.ptcg.collection.at(-1),searchSelection={cardId:p.id,variant:'detail:shadowless',condition:'Moderately Played',language:'ja',printing:'',rarity:'',edition:''};
assert.equal(scanLot.condition,searchSelection.condition);assert.equal(scanLot.language,searchSelection.language);
assert.equal(conditionRequest(p,scanLot,'ptcg'),conditionRequest(p,searchSelection,'ptcg'));
assert.equal(entryPrice(p,scanLot),null,'unpriced played condition cannot borrow the reference quote');
let requested;await loadConditionQuotes(p,scanLot,'ptcg',async url=>{requested=url;return {ok:true,json:async()=>({status:'available',quotes:[{condition:'Near Mint',price:7,currency:'USD',priceStatus:'current',validUntil:new Date(Date.now()+86400000).toISOString()},{condition:'Moderately Played',price:4,currency:'USD',priceStatus:'current',validUntil:new Date(Date.now()+86400000).toISOString()}]})};});
assert.equal(requested,conditionRequest(p,searchSelection,'ptcg'));assert.equal(entryPrice(p,scanLot),4);assert.equal(entryPrice(p,searchSelection),4);
assert.equal(entryPrice(p,{...scanLot,language:'en'}),null,'another language never borrows the scanner quote');
console.log('PASS: scanned condition, exact variant and language reuse Search provider-request identity and condition valuation.');


// Queued edits retain the game selected when the action was initiated.
S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:{collection:[{id:'same-lot',cardId:p.id,qty:1}],decks:[],wishlist:[]},ygo:{collection:[{id:'same-lot',cardId:y.id,qty:7}],decks:[],wishlist:[]}};
const queued=[];const delayed={...c,A:{},C:{},I:{},commit:fn=>new Promise(resolve=>queued.push(async()=>{await fn(S.state);resolve();}))};
registerTcg(delayed);const edit=delayed.A.tEntryQty({dataset:{id:'same-lot',delta:'1'}});assert.equal(queued.length,1);S.state.settings.game='ygo';await queued[0]();await edit;
assert.equal(S.state.tcg.ptcg.collection[0].qty,2);assert.equal(S.state.tcg.ygo.collection[0].qty,7);
console.log('PASS: queued TCG collection edits retain their initiating game after the active game changes.');

// A successful collection write remains idempotent if removing its queued capture fails.
S.state=blank();const atomic={...c,commit:async fn=>{const next=structuredClone(S.state);fn(next);S.state=next;}};registerTcg(atomic);
const repeat=item(p,'normal',{captureId:'capture-persisted-1',condition:'Lightly Played',lang:'en'});
await atomic.scanAddMany([repeat],'ptcg');await atomic.scanAddMany([repeat],'ptcg');
assert.equal(S.state.tcg.ptcg.collection.length,1);assert.equal(S.state.tcg.ptcg.collection[0].scanCaptureId,repeat.captureId);
await atomic.scanAddMany([{...repeat,captureId:'capture-persisted-2'}],'ptcg');assert.equal(S.state.tcg.ptcg.collection.length,1,'a different physical capture stacks');assert.equal(S.state.tcg.ptcg.collection[0].qty,2);
await atomic.scanAddMany([repeat],'ptcg');assert.equal(S.state.tcg.ptcg.collection[0].qty,2,'retry after stacking is still idempotent');
await assert.rejects(atomic.scanAddMany([{...repeat,qty:2}],'ptcg'),/already saved/);assert.equal(S.state.tcg.ptcg.collection.length,1);
await assert.rejects(atomic.scanAddMany([item(y,'unlimited',{captureId:repeat.captureId,print:'LOB-005|Ultra Rare'})],'ygo'),/already saved/);
console.log('PASS: stale queued-capture retries cannot double-add saved lots, distinct captures add normally, and conflicting retries stop.');
