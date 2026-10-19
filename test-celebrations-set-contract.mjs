import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPokemonSetContract} from './tests/pokemon-set-contract.mjs';
import {CELEBRATIONS_CARDS,pokemonCatalogueCard} from './pokemon-set-evidence.js';
import {CLASSIC_CARDS} from './pokemon-classic-evidence.js';
import {normalizePtcg,applyFallbackPrices} from './ptcg.js';
import {applyProductPrices,pokemonPriceRoute} from './pokemon-prices.js';
import {pokemonVariantChoices,pokemonVariantProductConflict} from './pokemon-variant-options.js';
import {presentationQuote,sellerModels,quoteForContext,compactPriceSummary} from './pricing-presentation.js';
import {entryPrice,tcgCardSheet,cache,cardOf} from './tcg.js';
import {conditionRequest} from './condition-feed.js';
import {conditionFeedRoute} from './condition-feed-route.js';
import {historyKey,validateHistory,reviewedLastObservedQuote} from './shared-history.js';
import {resolveFinish} from './finish-effects.js';
import {trackedQuote} from './pricehist.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const raws=CELEBRATIONS_CARDS.map(e=>read(`review/celebrations-20261019/sources/${e.id}.json`));
const primary=read('review/celebrations-20261019/verified-product-mapping.json');
for(const e of CELEBRATIONS_CARDS){const p=primary.find(x=>x.id===e.id);assert.equal(p.tcgplayerId,e.productId);assert.equal(p.cardmarketId,e.cmProduct);assert.equal(p.cardmarketIdentityStatus==='CATALOGUE_UNIQUE_IDENTITY_MATCH',e.cardmarketVerified);}
const reports=[verifyPokemonSetContract({setId:'cel25',raws,expected:CELEBRATIONS_CARDS,visual:Object.fromEntries(CELEBRATIONS_CARDS.filter(e=>e.id!=='cel25-23').map(e=>[e.id,[1,2,3,4,10,11,12,13,14,15,17,19,20,21,22].includes(Number(e.number))?'line-holo':[7,9,24].includes(Number(e.number))?'textured-holo':'standard']))})];
reports.push(verifyPokemonSetContract({setId:'cel25cc',raws:CLASSIC_CARDS.map(e=>read(`review/classic-collection-20261019/sources/${e.id}.json`)),expected:CLASSIC_CARDS.map(e=>({...e,cmQuoteAbsent:['cel25cc-CC020','cel25cc-CC021'].includes(e.id)})),usdPolicy:'absent'}));
let cases=0;const oldCaches=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
try{for(let i=0;i<25;i++){
 const raw=raws[i],e=CELEBRATIONS_CARDS[i],c=normalizePtcg(raw),key=pokemonVariantChoices(c)[0].key;
 const unpriced=()=>{const card=structuredClone(c);for(const v of card.variants){v.usd=null;v.market=null;}card.prices.usd=null;return card;};
 for(const k of ['normal','reverseHolofoil']){for(const stamp of [undefined,'not-a-date','2999-01-01']){const unknownDate=unpriced();assert.equal(applyFallbackPrices(unknownDate,{name:c.name,number:e.number,set:{name:'Celebrations'},tcgplayer:{updatedAt:stamp,prices:{holofoil:{market:9}}}}),true);assert.equal(unknownDate.prices.updated,null);}cases++;
 const copy=unpriced();assert.equal(applyFallbackPrices(copy,{name:c.name,number:e.number,set:{name:'Celebrations'},tcgplayer:{prices:{[k]:{market:99}}}}),false);assert.deepEqual(pokemonVariantChoices(copy).map(v=>v.finish),['holofoil']);cases++;}
 for(const changes of [{name:'Wrong card'},{number:'999'},{set:{name:'Celebrations Classic Collection'}}])assert.equal(applyFallbackPrices(unpriced(),{name:c.name,number:e.number,set:{name:'Celebrations'},...changes,tcgplayer:{prices:{holofoil:{market:99}}}}),false);
 for(const stamp of [undefined,'not-a-date','2999-01-01']){const unknownDate=unpriced();assert.equal(applyFallbackPrices(unknownDate,{name:c.name,number:e.number,set:{name:'Celebrations'},tcgplayer:{updatedAt:stamp,prices:{holofoil:{market:9}}}}),true);assert.equal(unknownDate.prices.updated,null);}cases++;
 const copy=unpriced();assert.equal(applyFallbackPrices(copy,{name:c.name,number:e.number,set:{name:'Celebrations'},tcgplayer:{updatedAt:'2020-01-01',prices:{holofoil:{market:9}}}}),true);assert.equal(copy.prices.usd,9);assert.equal(copy.prices.updated,'2020-01-01');
 const noQuotes=unpriced();assert.equal(applyProductPrices(noQuotes,{cardId:e.id,matchedProduct:e.productId,quotes:[{productId:e.productId,subTypeName:'Normal',marketPrice:99},{productId:e.productId+10000,subTypeName:'Holofoil',marketPrice:99}]}),false);assert.equal(noQuotes.prices.usd,null);
 assert.equal(applyProductPrices(noQuotes,{cardId:e.id,updatedAt:null,quotes:[{productId:e.productId,subTypeName:'Holofoil',marketPrice:9}]}),true);assert.equal(noQuotes.prices.usd,9);assert.equal(noQuotes.prices.updated,null);cases++;
 // A legacy fallback may already have introduced Normal. Quarantine only the
 // view, keeping its saved key/manual condition value/source bytes unchanged.
 const old={...structuredClone(c),variants:[...c.variants,{key:'normal',label:'Normal',finish:'normal',productId:e.productId,usd:99,market:99}],prices:{...c.prices,usd:99},setContext:{game:'ptcg',cardId:e.id,releaseId:'cel25',status:'resolved',variantKey:'normal',referencePrice:99,price:99,variant:{key:'normal',usd:99}}};
 const lot={cardId:e.id,variant:'normal',productId:e.productId,condition:'Near Mint',manualValue:12.34,manualValueCondition:'Near Mint',qty:2,conditionQuotes:[{cardId:e.id,variant:'normal',condition:'Near Mint',currency:'USD',price:99}]};const before=JSON.stringify({old,lot});
 assert(!pokemonCatalogueCard(old).variants.some(v=>v.key==='normal'));assert.equal(presentationQuote('ptcg',old,'normal').value,null);assert.equal(presentationQuote('ptcg',old,'reference').value,c.prices.usd);assert(pokemonVariantProductConflict(old,lot));assert.equal(entryPrice(old,lot),12.34);assert.equal(entryPrice(old,{...lot,manualValue:null}),null);assert.equal(conditionRequest(old,lot,'ptcg'),null);assert(!tcgCardSheet(old,{tab:'prices'}).includes('<span class="pt-label">Normal</span>'));cache.ptcg[e.id]=old;assert(!cardOf('ptcg',e.id).variants.some(v=>v.key==='normal'));delete cache.ptcg[e.id];assert.equal(JSON.stringify({old,lot}),before);cases++;
 assert.equal(quoteForContext('ptcg',c,{priceFinish:key,savedVariant:key,savedProductId:e.productId+10000}).selectionVerified,false);
 const corrupt={...old,name:'Wrong card'};assert.equal(presentationQuote('ptcg',corrupt,'reference').value,null);
 assert.equal(applyFallbackPrices(corrupt,{name:'Wrong card',number:e.number,set:{name:'Celebrations'},tcgplayer:{prices:{holofoil:{market:999}}}}),false);
 const cmExtra={...structuredClone(c),cardmarket:{...c.cardmarket,holoLow:998,holoAvg:999,holoTrend:999}};assert(!tcgCardSheet(cmExtra,{tab:'prices'}).includes('<span class="pt-label">Holo / reverse</span>'));
 const oldLot={cardId:e.id,condition:'Near Mint',conditionQuotes:[{cardId:e.id,productId:e.productId,condition:'Near Mint',currency:'USD',price:999}]};assert.equal(entryPrice(corrupt,oldLot),null);assert.equal(entryPrice(corrupt,{...oldLot,manualValue:12.34,manualValueCondition:'Near Mint'}),12.34);cases++;
 for(const [badKey,label] of [['normal','Normal'],['reverse-holofoil','Reverse Holo']]){const bad={...structuredClone(c),variants:[{key:badKey,finish:'holofoil',label,productId:e.productId,usd:999,market:999}],prices:{usd:999}};assert.equal(presentationQuote('ptcg',bad,'reference').value,null);assert(!sellerModels('ptcg',bad,{priceFinish:badKey}).some(r=>r.direct));}cases++;
 const wrongSet={...old,set:{...old.set,name:'Celebrations Classic Collection'}};assert.equal(presentationQuote('ptcg',wrongSet,'reference').value,null);
 assert.equal(resolveFinish('ptcg',c,{priceFinish:key,face:1}).status,'unknown');
 if(e.number==='5')assert.equal(resolveFinish('ptcg',c,{priceFinish:key}).layers[0].mask,'card');
 if(e.number==='25')assert.equal(resolveFinish('ptcg',c,{priceFinish:key}).layers[0].material,'gold');
 if(['23','24'].includes(e.number))assert.equal(presentationQuote('ptcg',{...c,name:"Professor's Research"},key).value,c.prices.usd,'Known printed-title alias preserves exact card/number identity');
 const q={game:'ptcg',cardId:e.id,finish:key,currency:'USD',selectionVerified:true};assert(historyKey(q).includes('product:'+e.productId));assert(trackedQuote('ptcg',c).id.includes('product:'+e.productId));
 for(const productId of [undefined,e.productId+10000])assert.throws(()=>validateHistory({...q,series:[{productId}]},q),/product history mismatch/);
 assert.equal(validateHistory({...q,series:[{productId:e.productId,currency:'USD',finish:key,source:'Synthetic fixture',points:[{date:'2020-01-01',value:9}]}]},q).series.length,1);cases++;
 const history={game:'ptcg',cardId:e.id,finish:'reference',series:[{productId:e.productId,subtype:'Holofoil',currency:'USD',finish:'reference',source:'Synthetic fixture',points:[{date:'2020-01-01',value:9}]}]};
 const dated=reviewedLastObservedQuote(c,history);assert.equal(dated.productId,e.productId);assert.match(compactPriceSummary('ptcg',unpriced(),{},dated),/\$9.00/);
 for(const changed of [{productId:999},{finish:'normal'},{cardId:'wrong'},{currency:'EUR'}])assert(!compactPriceSummary('ptcg',unpriced(),{},{...dated,...changed,value:999}).includes('$999.00'));assert.equal(reviewedLastObservedQuote(c,{...history,series:[{...history.series[0],subtype:'Normal'}]}),null);assert(!compactPriceSummary('ptcg',corrupt,{},dated).includes('$9.00'));cases++;
 let publication=null;const get=async input=>{const u=String(input);if(u.includes('api.tcgdex.net'))return Response.json(raw);if(u.endsWith('/groups'))return Response.json({results:[{groupId:2867,name:'Celebrations'}]});if(u.endsWith('/prices'))return Response.json({...(publication?{updatedAt:publication}:{}),results:[{productId:e.productId,subTypeName:'Holofoil',marketPrice:9},{productId:e.productId,subTypeName:'Normal',marketPrice:99}]});throw Error('Unexpected fixture request '+u);};
 for(const stamp of [null,'not-a-date','2999-01-01','2020-01-01']){publication=stamp;const body=await(await pokemonPriceRoute(new URL('https://fixture.invalid/api/prices/pokemon?id='+e.id),{},get)).json();assert.equal(body.quotes.length,1);assert.equal(body.updatedAt,stamp==='2020-01-01'?stamp:null);assert(Number.isFinite(Date.parse(body.checkedAt)));cases++;}
 const sparse={id:e.id,name:e.name,localId:e.number,set:{id:'cel25',name:'Celebrations'}};const sparseBody=await(await pokemonPriceRoute(new URL('https://fixture.invalid/api/prices/pokemon?id='+e.id),{},async u=>String(u).includes('api.tcgdex.net')?Response.json(sparse):get(u))).json();assert.equal(sparseBody.quotes[0].productId,e.productId);cases++;
 let paid=0;const env={JUSTTCG_API_KEY:'synthetic-not-a-key',CONDITION_PRICES:{idFromName:()=>1,get:()=>({fetch:async u=>{paid++;assert.equal(new URL(u).searchParams.get('product'),String(e.productId));return Response.json({status:'available',cachedAt:Date.now(),data:[{tcgplayerId:e.productId,variants:[{condition:'Near Mint',printing:'Holofoil',language:'English',price:9,priceStatus:'current',lastUpdated:Date.now()/1000}]}]});}})}};
 const noPriceRaw=structuredClone(raw);delete noPriceRaw.pricing.tcgplayer;for(const d of noPriceRaw.variants_detailed)if(d.pricing)delete d.pricing.tcgplayer;
 for(const productId of [e.productId,e.productId+10000]){const body=await(await conditionFeedRoute(new URL('https://fixture.invalid/api/prices/conditions?'+new URLSearchParams({game:'ptcg',id:e.id,variant:key,productId,language:'en'})),env,{},async u=>{assert(String(u).includes('api.tcgdex.net'),'identity must not depend on a quote');return Response.json(noPriceRaw);})).json();if(productId===e.productId)assert.equal(body.quotes[0].productId,e.productId);else assert.equal(body.status,'unmapped');}assert.equal(paid,1);cases++;
 if(!e.cardmarketVerified){
  const legacyCm={...structuredClone(c),cmProduct:e.cmProduct,cardmarket:{trend:99,avg:99},prices:{...c.prices,eur:99},variants:c.variants.map(v=>({...v,cmProduct:e.cmProduct}))},saved=JSON.stringify(legacyCm);
  for(const viewed of [c,legacyCm]){const sellers=sellerModels('ptcg',viewed,{priceFinish:key},[['Cardmarket','https://www.cardmarket.com/en/Pokemon/Products?idProduct='+e.cmProduct]]);assert(!sellers.some(s=>s.key==='cardmarket'&&(s.value!==null||s.direct)));assert.equal(pokemonCatalogueCard(viewed).prices.eur,null);}
  assert.equal(JSON.stringify(legacyCm),saved);
 }
}}
finally{globalThis.caches=oldCaches;}
console.log(JSON.stringify({result:'PASS',sets:reports,adversarialCases:cases,network:'local fixtures only',savedDataWrites:0,browserExecuted:false},null,2));
