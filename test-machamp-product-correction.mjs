// Owner-approved product correction: TCGplayer 42425 is the two-player starter
// Machamp 8/102 priced only as 1st Edition Holofoil, not the Unlimited record.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePtcg} from './ptcg.js';
import {applyPokemonCorrections} from './pokemon-corrections.js';
import {pokemonVariantProductConflict} from './pokemon-variant-options.js';
import {conditionRequest} from './condition-feed.js';
import {conditionFeedRoute} from './condition-feed-route.js';
import {compactConditionData} from './condition-cache.js';
const raw=JSON.parse(readFileSync(new URL('./tests/fixtures/base1-8-machamp.json',import.meta.url),'utf8')),before=JSON.stringify(raw);
const c=normalizePtcg(raw),key=label=>c.variants.find(v=>v.label===label).key;
const first=key('First Edition · Shadowless · Holofoil'),unlimited=key('Unlimited · Holofoil');
assert.equal(JSON.stringify(raw),before,'Correction never mutates the provider record');
assert.deepEqual(c.corrections,['MACHAMP-BASE1-8-FIRST-EDITION-PRODUCT']);
assert.equal(c.variants.find(v=>v.key===first).productId,42425,'Product follows the 1st Edition printing');
assert.equal(c.variants.find(v=>v.key===unlimited).productId,undefined,'Unlimited no longer claims the starter product');
assert.deepEqual(c.variants.map(v=>v.key),['detail:4ffrmhcfiaejakhepqdkx7o','detail:mtltux8qtgdu4exu903oasum21juxbvx6lx','detail:3takscxpcqoqcfnxk1ivs2y6','detail:zqq5g2u9n0st0gren5bssktmac2ywqaw'],'Saved version keys are unchanged');
// Saved copies are never rewritten: an Unlimited copy carrying 42425 reports a mismatch instead of borrowing a price.
assert.equal(pokemonVariantProductConflict(c,{variant:unlimited,productId:42425}),true);
assert.equal(pokemonVariantProductConflict(c,{variant:first,productId:42425}),false);
assert.equal(conditionRequest(c,{variant:unlimited,productId:42425,condition:'Lightly Played'},'ptcg'),null);
assert.match(conditionRequest(c,{variant:first,condition:'Lightly Played'},'ptcg'),/productId=42425/);
// Preconditions: an already-corrected or reshaped provider record is never forced.
const fixed=structuredClone(raw);fixed.variants_detailed[0].thirdParty={cardmarket:273703};fixed.variants_detailed[1].thirdParty={...fixed.variants_detailed[1].thirdParty,tcgplayer:42425};
assert.equal(applyPokemonCorrections(fixed),fixed,'Upstream fix needs no correction');
const moved=structuredClone(raw);moved.variants_detailed[0].thirdParty.tcgplayer=99999;
assert.deepEqual(applyPokemonCorrections(moved).correctionConflicts,['MACHAMP-BASE1-8-FIRST-EDITION-PRODUCT']);
assert.equal(applyPokemonCorrections({...raw,name:'Machoke'}).corrections,undefined,'Identity must match');
// Server lookup applies the same correction and binds only the 1st Edition Holofoil quote.
const originalCaches=globalThis.caches,memory=new Map(),wait=[];globalThis.caches={default:{match:async k=>memory.get(k.url||k)?.clone(),put:async(k,r)=>memory.set(k.url||k,r.clone())}};
const now=Math.floor(Date.now()/1000),q=(condition,price,printing)=>({condition,price,printing,lastUpdated:now,priceStatus:'current'});
const fetcher=async u=>{
 if(u.includes('api.tcgdex.net'))return Response.json(raw);
 if(u.includes('justtcg'))return Response.json({data:[{tcgplayerId:42425,variants:[q('Lightly Played',19.5,'1st Edition Holofoil'),q('Lightly Played',7,'Unlimited Holofoil')]}]});
 throw Error('Unexpected fixture request '+u);
};
const binding={idFromName:n=>n,get:()=>({fetch:async u=>{const product=new URL(u).searchParams.get('product');return Response.json({status:'available',...compactConditionData(await (await fetcher('https://api.justtcg.com/v1/cards?tcgplayerId='+product)).json(),product)});}})};
try{
 const env={JUSTTCG_API_KEY:'test-secret',CONDITION_PRICES:binding},ctx={waitUntil:p=>wait.push(p)};
 const ok=await (await conditionFeedRoute(new URL('https://app.test/api/prices/conditions?game=ptcg&id=base1-8&productId=42425&variant='+encodeURIComponent(first)),env,ctx,fetcher)).json();
 assert.equal(ok.status,'available');assert.equal(ok.productId,42425);assert.deepEqual(ok.quotes.map(x=>[x.condition,x.price]),[['Lightly Played',19.5]],'Only the 1st Edition Holofoil quote binds');
 const stale=await (await conditionFeedRoute(new URL('https://app.test/api/prices/conditions?game=ptcg&id=base1-8&productId=42425&variant='+encodeURIComponent(unlimited)),env,ctx,fetcher)).json();
 assert.equal(stale.status,'unmapped','An Unlimited selection cannot claim the 1st Edition product');
 await Promise.all(wait);
}finally{globalThis.caches=originalCaches;}
console.log('PASS: Machamp 8/102 product 42425 follows the 1st Edition printing in app and server lookups; saved keys unchanged, stale Unlimited bindings refused, preconditions enforced.');
