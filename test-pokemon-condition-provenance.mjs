import assert from 'node:assert/strict';
import {CLASSIC_CARDS} from './pokemon-classic-evidence.js';
import {CELEBRATIONS_CARDS,pokemonConditionQuoteMatches} from './pokemon-set-evidence.js';
import {conditionValue,lastKnownConditionQuote,conditionValueNote,conditionBadge} from './condition-value.js';
import {normalizePtcg} from './ptcg.js';
import {entryPrice} from './tcg.js';
import {priceOverview} from './workbench-ui.js';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {readFileSync} from 'node:fs';
const old=S.state;let checks=0;S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:blankGame(),ygo:blankGame()};
try{for(const e of [...CLASSIC_CARDS,...CELEBRATIONS_CARDS]){
 const folder=e.id.startsWith('cel25cc')?'classic-collection':'celebrations',raw=JSON.parse(readFileSync(new URL(`review/${folder}-20261019/sources/${e.id}.json`,import.meta.url))),card=normalizePtcg(raw),variant=card.variants[0].key;
 const lot={id:'condition-provenance-fixture',cardId:e.id,name:e.name,variant,productId:e.productId,condition:'Lightly Played',language:'en',qty:1},quote={...lot,price:7.89,currency:'USD',source:'Synthetic',priceStatus:'current',observedAt:new Date().toISOString(),validUntil:new Date(Date.now()+600000).toISOString()},before=JSON.stringify({card,lot});
 assert(pokemonConditionQuoteMatches(lot,quote));assert.equal(conditionValue(null,lot,[quote]).price,7.89);assert.equal(entryPrice(card,{...lot,conditionQuotes:[quote]}),7.89);checks++;
 for(const productId of [undefined,999999]){const wrong={...quote,productId,price:999},stale={...wrong,priceStatus:'last_known',validUntil:'2020-01-01'};assert.equal(conditionValue(null,lot,[wrong]).price,null);assert.equal(lastKnownConditionQuote(lot,[stale]),null);assert(!conditionValueNote(lot,[wrong,stale]).includes('999'));assert(!conditionBadge(lot,[wrong,stale]).includes('999'));assert.equal(entryPrice(card,{...lot,conditionQuotes:[wrong]}),null);
  for(const holder of ['card','lot']){const c={...card,conditionQuotes:holder==='card'?[wrong]:[]},saved={...lot,conditionQuotes:holder==='lot'?[wrong]:[]};S.state.tcg.ptcg.collection=[saved];const html=priceOverview('ptcg',c,{entryId:lot.id,priceFinish:variant});assert(!html.includes('$999.00'));saved.manualValue=12.34;saved.manualValueCondition='Lightly Played';assert.equal(entryPrice(c,saved),12.34);assert.equal(conditionValue(null,saved,[wrong]).price,12.34);assert(priceOverview('ptcg',c,{entryId:lot.id,priceFinish:variant}).includes('$12.34'));}
  checks++;
 }
 for(const variant of ['old-unknown','firstEdition','1st-edition-holofoil','normal','reverse-holofoil']){const entry={...lot,variant},q={...quote,variant},stale={...q,priceStatus:'last_known',validUntil:'2020-01-01'};assert.equal(conditionValue(null,entry,[q]).price,null);assert.equal(lastKnownConditionQuote(entry,[stale]),null);assert.equal(conditionValue(null,{...entry,manualValue:12.34,manualValueCondition:'Lightly Played'},[q]).price,12.34);checks++;}
 const missingCardId={...lot,cardId:undefined,conditionQuotes:[{...quote,cardId:undefined,productId:999999,price:999}]};assert.equal(entryPrice(card,missingCardId),null);assert.equal(entryPrice(card,{...missingCardId,manualValue:12.34,manualValueCondition:'Lightly Played'}),12.34);checks++;
 // The evidence registry can validate a quote when an old lot lacks productId;
 // it cannot validate a quote which itself omits product provenance.
 assert.equal(conditionValue(null,{...lot,productId:undefined},[quote]).price,7.89);assert.equal(conditionValue(null,{...lot,productId:999999},[quote]).price,null);assert.equal(JSON.stringify({card,lot}),before);checks++;
}
// No unrelated game/card condition behavior is changed.
for(const cardId of ['fixture-mtg-1','12345678','xy9-41']){const e={cardId,condition:'Lightly Played'},q={...e,price:9,currency:'USD'};assert.equal(conditionValue(null,e,[q]).price,9);checks++;}
}finally{S.state=old;}
console.log('PASS:',checks,'condition provenance groups across all50 reviewed Pokémon cards, current/last-known/UI/totals/badges, wrong/missing products, valid/manual values and unrelated controls. Local synthetic fixtures only.');
