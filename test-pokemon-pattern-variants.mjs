import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePtcg,pokemonVariants} from './ptcg.js';
import {finishChoices,resolveFinish} from './finish-effects.js';
import {pokemonConditionPrintings} from './condition-feed-route.js';
import {conditionBuyLink} from './pricing-presentation.js';
import {applyProductPrices} from './pokemon-prices.js';
import {needsCardRefresh} from './tcg.js';
// Exact public TCGdex responses captured 2026-10-18. Prices are fixture values,
// not a current price promise. Source: /v2/en/cards/{fixture id}.
const raw=JSON.parse(readFileSync('tests/fixtures/golurk-sv10.5b-043.json'));
const c=normalizePtcg(raw),v=c.variants;
assert.equal(c.variantSchema,13);assert.equal(v.length,4);
assert.deepEqual(v.map(x=>x.label),['Normal','Reverse Holo','Reverse Holo · Poké Ball','Reverse Holo · Master Ball']);
assert.deepEqual(v.map(x=>x.key),['normal','reverse-holofoil','detail:3739bbtj3i910y5ynn9xc6ryf','detail:2asus05yghmpd1ud1sdmlq3as4e'],'Existing collection variant keys stay stable');
assert.deepEqual(v.map(x=>x.productId),[642495,642495,642739,642666]);
assert.deepEqual(v.map(x=>x.usd),[.03,.22,.39,13.06]);
assert.deepEqual(v.map(x=>x.foil),['','','pokeball','masterball']);
assert(v.slice(1).every(x=>x.finish==='reverse-holofoil'));
assert.equal(resolveFinish('ptcg',c,{priceFinish:'reverse-holofoil'}).effect,'ptcg-reverse');
// Poké Ball and Master Ball reverses foil the measured surround with their own pattern sheet.
for(const [x,t] of [[v[2],'ptcg-pokeball'],[v[3],'ptcg-masterball']]){const p=resolveFinish('ptcg',c,{priceFinish:x.key});assert.equal(p.status,'approximate');assert.equal(p.effect,'ptcg-reverse');assert.deepEqual(p.layers.map(l=>l.mask),['pk-sv-evolved-surround'],'Stage 1 Golurk uses the measured evolved surround');assert.equal(p.treatment,t);assert.equal(p.pattern,x.foil);assert.equal(p.label,x.label);}
assert.equal(resolveFinish('ptcg',c,{priceFinish:'reverse-holofoil'}).treatment,'ptcg-sv-reverse');
const bad=structuredClone(raw);bad.variants_detailed[2].pricing.tcgplayer.holofoil.productId=642666;
assert.equal(pokemonVariants(bad)[2].usd,null,'Mismatched patterned product quote is rejected');
const unknown=structuredClone(raw);unknown.variants_detailed[2].foil='future-pattern';
assert.equal(pokemonVariants(unknown)[2].usd,null,'Unknown pattern cannot borrow Holofoil pricing');
assert.equal(finishChoices('ptcg',normalizePtcg(unknown))[2].status,'unknown');
const t=normalizePtcg(JSON.parse(readFileSync('tests/fixtures/typhlosion-swsh10-052.json')));
assert.equal(t.variants.length,3);const stamped=t.variants.find(x=>x.stamps.includes('set-logo'));
assert.equal(stamped.label,'Set-logo stamped · Holofoil');assert.equal(stamped.cmProduct,660427);assert.equal(stamped.productId,undefined);assert.equal(stamped.usd,null);
assert.notEqual(stamped.key,'holofoil');
const fresh={...c,priceFallbackSchema:3,fetchedAt:new Date().toISOString()};
assert.equal(needsCardRefresh('ptcg',fresh),false);assert.equal(needsCardRefresh('ptcg',{...fresh,variantSchema:10}),true);
console.log('PASS: real Golurk pattern identities, exact price buckets, unchanged saved keys, honest unsupported effects, stamped Typhlosion retained, schema refresh.');

const browse={id:'swsh10-097',name:'Absol',category:'Pokemon',rarity:'Rare',set:{id:'swsh10'},variants:[{key:'holofoil',finish:'holofoil',label:'Holofoil'},{key:'reverse-holofoil',finish:'reverse-holofoil',label:'Reverse Holo'},{key:'normal',finish:'normal',label:'Normal'}]};
const ctx={},snapshot=JSON.stringify(browse);assert.equal(resolveFinish('ptcg',browse,ctx).key,'holofoil');assert.equal(resolveFinish('ptcg',browse,{priceFinish:'reference'}).browseDefault,true);assert.deepEqual(ctx,{});assert.equal(JSON.stringify(browse),snapshot);
for(const key of ['normal','reverse-holofoil'])assert.equal(resolveFinish('ptcg',browse,{priceFinish:key}).key,key);
assert.equal(resolveFinish('ptcg',browse,{priceFinish:'missing'}).status,'unknown');
assert.equal(resolveFinish('ptcg',{...browse,variants:browse.variants.map(v=>v.key==='holofoil'?{...v,stamps:['set-logo']}:v)}).status,'unknown');
assert.equal(resolveFinish('mtg',{id:'magic',set:'tst',finishes:['nonfoil','foil']}).key,'nonfoil');
console.log('PASS: Pokémon-only ordinary holo browse default; explicit lot finishes and price context remain untouched.');

for(const i of [2,3]){
 assert.deepEqual(pokemonConditionPrintings(raw.variants_detailed[i]),['Holofoil']);
 const link=conditionBuyLink('ptcg',c,{variant:v[i].key,condition:'Near Mint'});
 assert(link);const url=new URL(link.url||link);assert.equal(url.searchParams.get('Printing'),'Holofoil');assert(url.pathname.includes('/'+v[i].productId));
}
assert.deepEqual(pokemonConditionPrintings(bad.variants_detailed[2]),[]);
assert.deepEqual(pokemonConditionPrintings(unknown.variants_detailed[2]),[]);
const legacyBucket=structuredClone(raw);legacyBucket.variants_detailed=legacyBucket.variants_detailed.slice(2,3);legacyBucket.variants_detailed[0].pricing.tcgplayer['reverse-holofoil']={productId:642739,marketPrice:.42};
assert.equal(pokemonVariants(legacyBucket)[0].key,'reverse-holofoil','Preserve existing provider bucket key rather than silently migrating saved ownership');
legacyBucket.variants_detailed[0].pricing.tcgplayer['reverse-holofoil'].productId=642666;
assert.equal(pokemonVariants(legacyBucket)[0].usd,.39,'Ignore wrong ordinary bucket and use only exact patterned product');
const noPrice=structuredClone(c);noPrice.variants[2].usd=null;assert(applyProductPrices(noPrice,{cardId:c.id,quotes:[{productId:642739,subTypeName:'Holofoil',marketPrice:.5}]}));assert.equal(noPrice.variants[2].usd,.5);assert.equal(noPrice.variants[3].usd,13.06);
for(const [id,name] of [['swsh10-100','Hisuian Samurott'],['swsh10-097','Absol']]){const card={...browse,id,name};assert.equal(resolveFinish('ptcg',card).key,'holofoil');assert.equal(resolveFinish('ptcg',card,{priceFinish:'reverse-holofoil'}).key,'reverse-holofoil');}
assert.notEqual(resolveFinish('ptcg',{...browse,variants:browse.variants.filter(v=>v.key!=='holofoil')}).key,'holofoil');
console.log('PASS: exact patterned seller/condition/fallback pricing, wrong-product rejection, legacy bucket compatibility, Samurott/Absol defaults.');

assert.equal(resolveFinish('ptcg',null).status,'unknown','Unhydrated/offline collection rows remain renderable');
