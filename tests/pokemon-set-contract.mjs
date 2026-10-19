// Reusable offline contract for independently reviewed Pokémon sets.
// The caller supplies primary-source identities, not expectations derived from
// the adapter output. Browser, image pixels and physical materials are separate.
import assert from 'node:assert/strict';
import {normalizePtcg,normalizePtcgBrief} from '../ptcg.js';
import {pokemonVariantChoices} from '../pokemon-variant-options.js';
import {setCardFacets,filterSortSetCards,setVariantKey} from '../set-list-ui.js';
import {ptcgProduct} from '../ptcg-product.js';
import {tcgCardSheet,setContextCard} from '../tcg.js';
import {presentationQuote,quoteIsStale,sellerModels} from '../pricing-presentation.js';
import {resolveFinish} from '../finish-effects.js';
import {finishMaterialProfile} from '../finish-materials.js';

export function verifyPokemonSetContract({setId,raws,expected,usdPolicy='preserve',visual={}}){
 const before=JSON.stringify(raws),cards=raws.map(normalizePtcg),ids=expected.map(e=>e.id);
 assert.equal(raws.length,expected.length);assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(cards.map(c=>c.id),ids);assert.equal(new Set(cards.map(c=>c.id)).size,ids.length);
 const dimensions={identity:0,availability:0,prices:0,sourceAge:0,markup:0,visualModels:0};
 for(let i=0;i<expected.length;i++){
  const e=expected[i],raw=raws[i],c=cards[i],choices=pokemonVariantChoices(c);
  assert.equal(c.set.id,setId);assert.equal(c.name,e.name);assert.equal(c.set.number,e.number);assert.equal(String(c.set.total??''),String(e.total??''));
  assert.equal(normalizePtcgBrief(raw).set.number,e.number);dimensions.identity++;
  assert.equal(choices.length,1);assert.equal(choices[0].finish,'holofoil');assert.equal(choices[0].productId,e.productId);assert.equal(setVariantKey(c,'holofoil'),choices[0].key);
  for(const key of ['reference','holofoil',choices[0].key])assert.equal(ptcgProduct(raw,key)?.productId,e.productId);
  for(const key of ['normal','reverse-holofoil'])assert.equal(ptcgProduct(raw,key),null);dimensions.availability++;
  assert.equal(c.prices.usd,usdPolicy==='absent'?null:raw.pricing.tcgplayer.holofoil.marketPrice);
  if(e.cardmarketVerified===false){assert.equal(c.prices.eur,null);assert.equal(c.cmProduct,null);assert.match(c.prices.integrityNotice,/Cardmarket printing identity unverified/);}
  else if(e.cmQuoteAbsent){assert.equal(c.prices.eur,null);}
  else {assert.equal(c.cmProduct,e.cmProduct);assert.equal(c.prices.eur,raw.pricing.cardmarket.trend||raw.pricing.cardmarket.avg);}
  const seller=sellerModels('ptcg',c,{priceFinish:choices[0].key}).find(s=>s.key==='tcgplayer');assert.equal(new URL(seller.url).pathname,'/product/'+e.productId);dimensions.prices++;
  const projected=setContextCard('ptcg',c,{id:setId,name:c.set.name,count:expected.length},[],{variantKey:choices[0].key});
  assert.equal(projected.prices.updated,c.prices.updated);assert.equal(presentationQuote('ptcg',projected,choices[0].key).sourceUpdatedAt,c.prices.updated);
  if(c.prices.updated)assert(quoteIsStale(presentationQuote('ptcg',projected,choices[0].key),Date.parse(c.prices.updated)+4*864e5));dimensions.sourceAge++;
  const html=tcgCardSheet(projected,{tab:'prices',priceFinish:choices[0].key});assert(!html.includes('<span class="pt-label">Normal</span>'));assert(html.includes('<span class="pt-label">Holofoil</span>'));dimensions.markup++;
  const model=resolveFinish('ptcg',c,{priceFinish:choices[0].key});
  if(visual[c.id]){assert.equal(model.status,'approximate');assert.equal(finishMaterialProfile('ptcg',c,model),visual[c.id]);}
  else {assert.equal(model.status,'unknown');assert.equal(model.layers.length,0);}dimensions.visualModels++;
 }
 assert.deepEqual(setCardFacets(cards,'ptcg').finishes,['holofoil']);
 assert.deepEqual(filterSortSetCards(cards,'ptcg',{finish:'holofoil'}).map(c=>c.id).sort(),[...ids].sort());
 assert.equal(JSON.stringify(raws),before,'Source snapshots must not be mutated');
 return {setId,cards:cards.length,dimensions,sourceImmutability:true,browserExecuted:false,physicalMaterialVerified:false};
}
