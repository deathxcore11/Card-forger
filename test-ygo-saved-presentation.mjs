// Actual collection renderer; cached catalogue order cannot change owned identity.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {cache,ui,tcgCollection,savedYgoPresentation,tcgRarityAttrs} from './tcg.js';
import {resolveFinish} from './finish-effects.js';
import {tcgSetBadge} from './emblems.js';
const records=new Map();globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,String(v))};
globalThis.fetch=async()=>{throw Error('No network permitted in presentation');};
S.state=blank();S.state.settings.game='ygo';S.state.tcg={ygo:blankGame(),ptcg:blankGame()};
const card={id:'99032001',game:'ygo',name:'Saved printing fixture',category:'Monster',sets:[
 {name:'Different cached release',code:'DIFF-EN001',rarity:"Collector's Rare",price:25},
 {name:'Owned release',code:'OWN-EN002',rarity:'Ultra Rare',price:1.4},
 {name:'Owned release',code:'OWN-EN002',rarity:'Common',price:.1}],prices:{usd:25},stats:[],artSchema:1,printPriceSchema:1};
const lot={id:'ultra',cardId:card.id,name:card.name,qty:2,printing:'OWN-EN002',rarity:'Ultra Rare',edition:'1st-edition',condition:'NM',manualValue:1.4,manualValueCondition:'NM'};
cache.ygo[card.id]=card;S.state.tcg.ygo.collection=[lot];ui('ygo').coll.tab='cards';
const before=JSON.stringify({state:S.state,card});
const view=savedYgoPresentation(card,lot);
assert.match(tcgSetBadge(view),/>UR</);assert.doesNotMatch(tcgSetBadge(view),/>CR</);
assert.match(tcgRarityAttrs(view,lot),/data-rarity-flair="yr3".*Ultra Rare/);
assert.equal(resolveFinish('ygo',view,{priceEdition:lot.printing+'::'+lot.rarity}).effect,'ygo-ultra');
let html=tcgCollection();assert.match(html,/>UR</);assert.doesNotMatch(html,/>CR</);assert.match(html,/data-finish-effect="ygo-ultra"/);assert.match(html,/data-tier="t0"/,'price frame remains the low-price band independently of Ultra rarity');
for(const [rarity,code,effect]of [["Collector's Rare",'CR','none'],['Common','C','none']]){
 const row={...lot,printing:rarity==='Common'?'OWN-EN002':'DIFF-EN001',rarity};
 const projected=savedYgoPresentation(card,row);assert.match(tcgSetBadge(projected),new RegExp('>'+code+'<'));
 const finish=resolveFinish('ygo',projected,{priceEdition:row.printing+'::'+row.rarity});
 if(rarity==='Common')assert.equal(finish.effect,'plain');else assert.equal(finish.status,'unknown','unsupported Collector texture remains explicitly unavailable');
}
for(const missing of [{printing:'',rarity:''},{printing:'MISSING-EN001',rarity:'Ultra Rare'},{printing:'OWN-EN002',rarity:''},{setReleaseUnverified:true},{setReleaseId:'unverified-release'}]){
 const row={...lot,...missing},projected=savedYgoPresentation(card,row);
 assert.equal(projected.savedPrintingUnresolved,true);assert.doesNotMatch(tcgSetBadge(projected),/>CR<|>UR<|>C</);
 assert.equal(tcgRarityAttrs(projected,row),'');assert.equal(resolveFinish('ygo',projected,{priceEdition:row.printing&&row.rarity?row.printing+'::'+row.rarity:''}).status,'unknown');
 S.state.tcg.ygo.collection=[row];html=tcgCollection();assert.match(html,/class="tile-set"><span class="tset" title="Saved printing identity has not been verified"><b>Printing not verified<\/b>/,'gallery has a visible neutral uncertainty badge outside hidden lot-sub');assert.doesNotMatch(html,/data-rarity-flair=|data-finish-effect="ygo-ultra"/);
}
const duplicate={...card,sets:[...card.sets,{...card.sets[1]}]};assert.equal(savedYgoPresentation(duplicate,lot).savedPrintingUnresolved,true,'ambiguous rows cannot be treated as verified');
S.state.tcg.ygo.collection=[lot];assert.equal(JSON.stringify({state:S.state,card}),before,'rendering never mutates ownership or cached identity');
S.state.tcg.ygo.collection=[lot,{...lot,id:'unlimited',edition:'unlimited',qty:3}];html=tcgCollection();assert.equal((html.match(/class="lot"/g)||[]).length,2);assert.match(html,/First Edition/);assert.match(html,/Unlimited/);assert.deepEqual(S.state.tcg.ygo.collection.map(e=>[e.id,e.qty,e.edition]),[['ultra',2,'1st-edition'],['unlimited',3,'unlimited']]);
console.log('PASS: saved YGO badge/rim/finish use one exact identity; missing/ambiguous identity borrows none; price frame, editions, quantities and cache remain independent.');
