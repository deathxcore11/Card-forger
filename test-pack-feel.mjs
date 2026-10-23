import assert from 'node:assert/strict';
import {trustedPackPrice,packRevealHaptic} from './pack-preview.js';
import {PACK_PATTERNS} from './feel.js';
// A value accent needs a trustworthy price for exactly what came out of the pack.
const mtg={prices:{usd:'0.30',usd_foil:'24.00',usd_etched:null}};
assert.equal(trustedPackPrice('mtg',mtg,{}),0.3);
assert.equal(trustedPackPrice('mtg',mtg,{finish:'foil'}),24);
assert.equal(trustedPackPrice('mtg',mtg,{finish:'etched'}),null,'no etched price is not the nonfoil price');
const ptcg={variants:[{key:'holofoil',usd:62},{key:'reverse-holofoil',market:3}]};
assert.equal(trustedPackPrice('ptcg',ptcg,{priceFinish:'holofoil'}),62);
assert.equal(trustedPackPrice('ptcg',ptcg,{priceFinish:'reverse-holofoil'}),3);
assert.equal(trustedPackPrice('ptcg',ptcg,{}),null,'a finish we did not resolve never borrows the holo price');
assert.equal(trustedPackPrice('ptcg',{prices:{usd:400}},{priceFinish:'holofoil'}),null,'a generic card price is not the pulled variant');
assert.equal(trustedPackPrice('ygo',{setContext:{printing:{price:900}}},{}),null,'Yu-Gi-Oh! uses only the pulled printing reference');
// Tier boundaries from tier.js: under $10 ordinary flip, then three restrained accents (t4 and t5 share one).
for(const [p,k] of [[null,'pack-reveal'],[1.99,'pack-reveal'],[10,'pack-reveal'],[10.01,'pack-value-2'],[50,'pack-value-2'],[50.5,'pack-value-3'],[200,'pack-value-3'],[201,'pack-value-4'],[5000,'pack-value-4']])assert.equal(packRevealHaptic(p),k,String(p));
// Web fallback patterns stay short: no long buzz.
for(const [k,v] of Object.entries(PACK_PATTERNS))assert((Array.isArray(v)?v.reduce((a,b)=>a+b,0):v)<=200,k+' stays under 200 ms');
console.log('PASS: pack reveal feel uses only exact-finish prices and tier.js bands; web patterns stay short.');
