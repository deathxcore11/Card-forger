import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePtcg,applyFallbackPrices} from './ptcg.js';
import {applyProductPrices} from './pokemon-prices.js';
import {applyPokemonCorrections,SHINY_VAULT_FINISH_CORRECTION} from './pokemon-corrections.js';
import {finishChoices,resolveFinish} from './finish-effects.js';
import {pokemonLegacySelection} from './pokemon-variant-options.js';
import {needsCardRefresh} from './tcg.js';

// Public TCGdex response captured 2026-10-23, /v2/en/cards/sma-SV68.
// Physical availability is checked against the official checklist linked in
// the correction. Hypothetical conflicting quotes below are test data only.
const raw=JSON.parse(readFileSync('tests/fixtures/buzzwole-sma-SV68.json'));
const before=JSON.stringify(raw),card=normalizePtcg(raw);
assert.equal(JSON.stringify(raw),before,'Normalization does not mutate provider evidence');
assert.deepEqual(card.variants.map(v=>v.key),['holofoil']);
assert.equal(card.prices.usd,null,'Correcting availability invents no quote');
assert.deepEqual(card.finishAvailability.sourceDetails,raw.variants_detailed);
assert.equal(card.finishAvailability.source,SHINY_VAULT_FINISH_CORRECTION.source);
assert.deepEqual(applyPokemonCorrections(applyPokemonCorrections(raw)),applyPokemonCorrections(raw),'Correction is idempotent');
assert.deepEqual(card.printVariants,['holo']);
assert.deepEqual(finishChoices('ptcg',card).map(v=>v.key),['holofoil']);
const foil=resolveFinish('ptcg',card,{priceFinish:'holofoil'});
assert.equal(foil.effect,'ptcg-full-art');assert.equal(foil.coverage,'full');
assert.equal(foil.texture,'micro-ridges');assert.equal(foil.treatment,'ptcg-shiny');
assert(foil.layers.every(l=>l.mask==='card'),'Shiny GX uses the card face, never a rectangular illustration window');
assert.equal(resolveFinish('ptcg',card,{priceFinish:'normal'}).status,'unknown','Old saved Normal is not silently rebound to holo');
assert.equal(pokemonLegacySelection(card,'normal').status,'unknown');
assert(needsCardRefresh('ptcg',{...card,variantSchema:13}),'Old cached choices refresh without deleting saved lots');

// Other Shiny Vault cards have the same foil-only availability, but a baby
// shiny still has an illustration window. Controls outside the exact scope stay intact.
const baby=normalizePtcg({...raw,id:'sma-SV24',localId:'SV24',name:'Buzzwole'});
assert.deepEqual(baby.variants.map(v=>v.key),['holofoil']);
const babyFoil=resolveFinish('ptcg',baby,{priceFinish:'holofoil'});
assert.equal(babyFoil.effect,'ptcg-holo');assert.equal(babyFoil.treatment,'ptcg-rainbow-glitter');
assert(babyFoil.layers.every(l=>l.mask!=='card'));
for(const input of [{...raw,id:'sm11-1',localId:'1',set:{id:'sm11'}},{...raw,id:'sma-SV95',localId:'SV95'},{...raw,localId:'SV67'}]){
 assert.equal(applyPokemonCorrections(input),input);assert(normalizePtcg(input).variants.some(v=>v.key==='normal'));
}
const changed={...raw,variants_detailed:[{type:'normal',size:'standard',variantId:'real-provider-record',thirdParty:{tcgplayer:123}}]};
const conflict=applyPokemonCorrections(changed);assert.deepEqual(conflict.variants_detailed,changed.variants_detailed);assert(conflict.correctionConflicts.includes(SHINY_VAULT_FINISH_CORRECTION.correctionId));
const oldEx=normalizePtcg({...raw,id:'ex1-1',localId:'1',set:{id:'ex1'},name:'Test-EX',rarity:'Rare',variants:{holo:true},variants_detailed:[{type:'holo',size:'standard'}]});
assert.notEqual(resolveFinish('ptcg',oldEx,{priceFinish:'holofoil'}).effect,'ptcg-full-art','Old ex layouts stay scoped');

// Primary and fallback quote sources cannot reintroduce the disproven finish
// or transfer its price to Holofoil. Existing Holofoil quotes still work.
const priced=normalizePtcg({...raw,pricing:{tcgplayer:{normal:{marketPrice:99,productId:1},holofoil:{marketPrice:12,productId:2}}}});
assert.deepEqual(priced.variants.map(v=>v.key),['holofoil']);assert.equal(priced.prices.usd,12);
const fallback=normalizePtcg(raw);
assert.equal(applyFallbackPrices(fallback,{tcgplayer:{prices:{normal:{market:99},reverseHolofoil:{market:88}}}}),false);
assert.equal(applyFallbackPrices(fallback,{tcgplayer:{prices:{holofoil:{market:12}}}}),true);
assert.deepEqual(fallback.variants.map(v=>v.key),['holofoil']);assert.equal(fallback.prices.usd,12);
const product=normalizePtcg(raw);
applyProductPrices(product,{cardId:raw.id,matchedProduct:2,quotes:[{productId:2,subTypeName:'Normal',marketPrice:99},{productId:2,subTypeName:'Reverse Holofoil',marketPrice:88},{productId:2,subTypeName:'Holofoil',marketPrice:12}]});
assert.deepEqual(product.variants.map(v=>v.key),['holofoil']);assert.equal(product.prices.usd,12);
console.log('PASS: captured Buzzwole GX is foil-only with full-face shiny texture; baby/old-ex coverage, source conflicts, saved keys and exact finish prices remain isolated.');
