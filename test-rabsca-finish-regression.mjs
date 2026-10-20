import assert from 'node:assert/strict';import fs from 'node:fs';
import {sellerModels} from './pricing-presentation.js';
import {normalizePtcg} from './ptcg.js';import {finishChoices,resolveFinish} from './finish-effects.js';import {needsCardRefresh} from './tcg.js';
const raw=JSON.parse(fs.readFileSync('tests/fixtures/rabsca-sv08-014.json'));
const card=normalizePtcg(raw),choices=finishChoices('ptcg',card),reverse=choices.filter(v=>/reverse holo/i.test(v.label));
assert.equal(reverse.length,1);assert.equal(reverse[0].effect,'ptcg-reverse');assert(reverse[0].layers.length>0);assert.equal(reverse[0].status,'approximate');
assert.equal(resolveFinish('ptcg',card,{priceFinish:reverse[0].key}).effect,'ptcg-reverse');assert(choices.some(v=>v.label==='Holofoil · Cosmos'),'distinct source pattern is retained');
const cosmos=choices.find(v=>v.label==='Holofoil · Cosmos');assert.equal(cosmos.effect,'ptcg-holo');assert.equal(cosmos.status,'approximate');assert(cosmos.layers.length>0);assert.match(cosmos.reason,/approximate/);
const cosmosVariant=card.variants.find(v=>v.key===cosmos.key);assert.equal(cosmosVariant.productId,636307);const link=sellerModels('ptcg',card,{priceFinish:cosmos.key}).find(r=>r.key==='tcgplayer');assert(link.direct);assert.equal(new URL(link.url).pathname,'/product/636307');assert.equal(new URL(link.url).searchParams.get('Printing'),'Holofoil');assert.equal(new URL(sellerModels('ptcg',card,{priceFinish:reverse[0].key}).find(r=>r.key==='tcgplayer').url).searchParams.get('Printing'),'Reverse Holofoil');
assert(needsCardRefresh('ptcg',{...card,variantSchema:12,fetchedAt:new Date().toISOString()}),'old cached options must be refreshed without deleting lots or caches');
// Controlled conflicting product fixture, NOT a claim about a real Rabsca quote.
// An unmatched legacy quote must not generate another physical reverse choice.
const conflict=structuredClone(raw);conflict.pricing.tcgplayer['reverse-holofoil'].productId=999999;for(const d of conflict.variants_detailed)delete d.pricing;
const c=normalizePtcg(conflict),visible=finishChoices('ptcg',c).filter(v=>/reverse holo/i.test(v.label));assert.equal(visible.length,1);assert.equal(visible[0].effect,'ptcg-reverse');
const reference=c.variants.find(v=>v.productId===999999);assert(reference.referenceOnly);assert.equal(reference.bindingStatus,'unbound-reference');assert.equal(c.variants.find(v=>v.productId===590033&&v.finish==='reverse-holofoil').usd,null);
console.log('PASS: captured Rabsca has one working reverse preview; cached schema12 refreshes; unbound pricing bucket cannot add a second finish; Cosmos remains distinct. Browser animation and physical foil are separate gates.');
