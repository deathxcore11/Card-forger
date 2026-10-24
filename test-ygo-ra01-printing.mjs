// Real provider identity/quote fixture, captured for this regression. No live
// network, account or cache service is used. The quoted amount is historical.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeYgo,normalizeYgoSet} from './ygo.js';
import {ygoProductMatches,ygoPriceRoute,applyYgoPrices,rarityKey,needsYgoPriceJoinRefresh,YGO_PRICE_JOIN_SCHEMA} from './ygo-prices.js';
import {ygoSetPriceRoute,applyYgoSetPrices} from './ygo-set-prices.js';
import {ygoPricePreview} from './ygo-price-selection.js';
import {selectedYgoCard,needsCardRefresh} from './tcg.js';
import {POKEMON_VARIANT_SCHEMA} from './pokemon-variant-options.js';
import {exactYgoHistoryProduct,resolveExactYgoHistoryPrinting,canRequestExactYgoHistory,exactYgoHistoryCacheKey,exactYgoRarityKey} from './ygo-history-identity.js';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/ygo-ra01-ghost-belle-prices.json','utf8'));
const original=normalizeYgo(fixture.card),collector=original.sets.find(p=>p.rarity==="Collector's Rare"),ultimate=original.sets.find(p=>p.rarity==='Ultimate Rare');
assert.equal(ygoProductMatches(collector,fixture.products).length,1,'RA01 catalog CR maps to its unique PCR provider product');
assert.equal(ygoProductMatches(collector,fixture.products)[0].productId,524883);
assert.equal(ygoProductMatches(ultimate,fixture.products)[0].productId,524881,'the distinct PUR sibling never inherits the PCR price');
assert.equal(rarityKey("Prismatic Collector's Rare"),'','no global CR/PCR equivalence');
for(const patch of [{name:'Other release'},{code:'RA02-EN011'}])assert.equal(ygoProductMatches({...collector,...patch},fixture.products).length,0,'the evidenced alias is limited to this exact release');

let requests=0;
const fetcher=async url=>{requests++;if(url.includes('db.ygoprodeck.com'))return Response.json({data:[fixture.card]});if(url.endsWith('/groups'))return Response.json({results:[fixture.group]});if(url.endsWith('/products'))return Response.json({results:fixture.products});if(url.endsWith('/prices'))return Response.json({results:fixture.prices});throw Error('Unexpected fixture request '+url);};
const release=normalizeYgoSet({set_name:fixture.group.name,set_code:'RA01',tcg_date:'2023-11-03'}),url=new URL('https://fixture.invalid/api/prices/yugioh-set?'+new URLSearchParams({name:release.name,code:release.code}));
const body=await (await ygoSetPriceRoute(url,{},fetcher)).json();
const enriched=applyYgoSetPrices(original,release,body),key=collector.code+'::'+collector.rarity,quote=enriched.sets.find(p=>p.rarity===collector.rarity);
assert.equal(quote.productId,524883);assert.equal(quote.quotes[0].edition,'1st Edition');assert.equal(quote.quotes[0].market,5.08);assert.equal(original.sets.find(p=>p.rarity===collector.rarity).quotes,undefined,'hydration does not alter the source card');
assert.equal(quote.rarity,collector.rarity,'stable catalogue/saved/foil identity is preserved');
assert.equal(selectedYgoCard(enriched,key,'').prices.usd,null,'missing physical edition remains unknown');
assert.equal(selectedYgoCard(enriched,key,'unlimited').prices.usd,null,'an unavailable edition never borrows First Edition');
assert.equal(selectedYgoCard(enriched,key,'1st-edition').prices.usd,5.08,'explicit First Edition uses this product reference, never the screenshot seller ask');
assert.equal(ygoPricePreview(enriched,{game:'ygo',id:enriched.id,priceEdition:key}).priceYgoEdition,'1st-edition','new browsing preview may use the one supported edition');
assert.equal(ygoPricePreview(enriched,{game:'ygo',id:enriched.id,priceEdition:key,ygoEditionExplicit:true}).priceYgoEdition,undefined,'explicit unspecified edition is respected');
const duplicate={...body,products:[...body.products,body.products.find(p=>p.productId===524883)]};
assert.equal(applyYgoSetPrices(original,release,duplicate).sets.find(p=>p.rarity===collector.rarity).quotes,undefined,'duplicate product evidence remains ambiguous');
const wrongSuffix={...body,products:body.products.map(p=>p.productId===524883?{...p,name:fixture.card.name+' (PUR)'}:p)};
assert.equal(applyYgoSetPrices(original,release,wrongSuffix).sets.find(p=>p.rarity===collector.rarity).quotes,undefined,'product name suffix must agree with actual rarity');

const direct=await (await ygoPriceRoute(new URL('https://fixture.invalid/api/prices/yugioh?id=73642296&printing=RA01-EN011&rarity='+encodeURIComponent(collector.rarity)),{},fetcher)).json(),applied=structuredClone(original);
assert.equal(applyYgoPrices(applied,direct),true);assert.equal(applied.sets.find(p=>p.rarity===collector.rarity).productId,524883);assert.equal(selectedYgoCard(applied,key,'1st-edition').prices.usd,5.08);
assert.equal(applied.priceJoinSchema,undefined,'a printing-only response cannot certify the full-card migration');
// Existing, otherwise-fresh cards need one targeted rejoin. A completed attempt
// is stamped even when the provider has no price; outages/partials are not.
const oldCache={...structuredClone(original),printPriceSchema:1},before=JSON.stringify(oldCache);
assert.equal(needsCardRefresh('ygo',oldCache,true),true);assert.equal(needsYgoPriceJoinRefresh(oldCache),true);assert.equal(JSON.stringify(oldCache),before,'checking cache freshness never changes cards or saved values');
assert.equal(needsCardRefresh('ygo',oldCache,false),false,'metadata-only reads do not trigger a price migration');
const unrelated={...oldCache,sets:[{...collector,name:'Other release',code:'OTHER-EN011'}]};assert.equal(needsCardRefresh('ygo',unrelated,true),false);
assert.equal(needsCardRefresh('mtg',{...oldCache,game:'mtg'},true),false);assert.equal(needsCardRefresh('ptcg',{game:'ptcg',fetchedAt:oldCache.fetchedAt,variantSchema:POKEMON_VARIANT_SCHEMA,priceFallbackSchema:3},true),false);
const full=await (await ygoPriceRoute(new URL('https://fixture.invalid/api/prices/yugioh?id=73642296'),{},fetcher)).json();
assert.equal(full.joinComplete,true);applyYgoPrices(oldCache,full);assert.equal(oldCache.priceJoinSchema,YGO_PRICE_JOIN_SCHEMA);assert.equal(needsCardRefresh('ygo',oldCache,true),false,'completed migration does not refresh in a loop');
const noQuote={...structuredClone(original),printPriceSchema:1};applyYgoPrices(noQuote,{cardId:noQuote.id,printings:[],partial:false,joinSchema:YGO_PRICE_JOIN_SCHEMA,joinComplete:true});assert.equal(needsCardRefresh('ygo',noQuote,true),false,'an honest complete mapping miss waits for the ordinary TTL');
for(const patch of [{partial:true},{joinComplete:false},{joinSchema:2}]){const card={...structuredClone(original),printPriceSchema:1};applyYgoPrices(card,{...full,...patch});assert.equal(needsYgoPriceJoinRefresh(card),true,'partial/older evidence cannot certify the new join');}

// Exact histories use the same release-scoped provider identity. Other releases
// and ambiguous products keep the existing strict rejection behavior.
const historyQuery={game:'ygo',cardId:original.id,finish:'reference',releaseId:release.id,edition:collector.code,rarity:collector.rarity,selectedEdition:'1st-edition',currency:'USD'};
assert.equal(canRequestExactYgoHistory(historyQuery),true);assert.equal(exactYgoHistoryProduct(fixture.products,historyQuery,23233).productId,524883);
assert.equal(exactYgoHistoryProduct(fixture.products,{...historyQuery,rarity:'Ultimate Rare'},23233).productId,524881);
assert.equal(exactYgoHistoryProduct([...fixture.products,fixture.products.at(-1)],historyQuery,23233),null);
const mapped=await resolveExactYgoHistoryPrinting(fixture.card,historyQuery,async()=>[{set_name:release.name,set_code:release.code,tcg_date:release.date}]);assert.equal(mapped.set.set_rarity,collector.rarity);
assert.equal(exactYgoRarityKey("Prismatic Collector's Rare"),'','history alias is not global');
assert.equal(exactYgoHistoryProduct(fixture.products,{...historyQuery,releaseId:normalizeYgoSet({name:'Other release',code:'RA01'}).id},23233),null);
const historyUrl=new URL('https://fixture.invalid/api/history');assert.equal(new URL(exactYgoHistoryCacheKey(historyUrl,historyQuery).url).searchParams.get('printingJoin'),'ra01-v1');assert.equal(new URL(exactYgoHistoryCacheKey(historyUrl,{...historyQuery,rarity:'Super Rare'}).url).searchParams.has('printingJoin'),false,'unrelated history caches keep their keys');
assert(requests<12,'set and card hydration use bounded public-provider requests, not a request per tile');
console.log('PASS: real Ghost Belle RA01 CR/PCR and distinct PUR joins, exact editions, stable saved/foil identity, one-time targeted cache migration, honest missing-price cache, scoped exact-history aliases and unchanged unrelated cache keys.');
