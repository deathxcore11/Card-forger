import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLASSIC_CARDS,CLASSIC_SCHEMA,classicCatalogueCard,classicProviderCard} from './pokemon-classic-evidence.js';
import {normalizePtcg,normalizePtcgBrief,applyFallbackPrices,ptcgSource} from './ptcg.js';
import {pokemonVariantChoices,pokemonVariantProductConflict} from './pokemon-variant-options.js';
import {setCardFacets,filterSortSetCards,setVariantKey} from './set-list-ui.js';
import {ptcgProduct} from './ptcg-product.js';
import {pokemonProductId} from './pokemon-art.js';
import {applyProductPrices,pokemonPriceRoute} from './pokemon-prices.js';
import {presentationQuote,sellerModels,compactPriceSummary} from './pricing-presentation.js';
import {cache,cardOf,ensureCard,SOURCES,entryPrice,setContextCard,tcgCardSheet} from './tcg.js';
import {conditionRequest} from './condition-feed.js';
import {conditionFeedRoute} from './condition-feed-route.js';
import {trackedQuote} from './pricehist.js';
import {historyKey,validateHistory,loadSharedHistory} from './shared-history.js';
import {recentHistoryRoute} from './recent-history.js';
import {compileCatalog} from './scan-catalog.js';
const dir='review/classic-collection-20261019/';
const read=f=>JSON.parse(readFileSync(dir+f));
const raws=CLASSIC_CARDS.map(e=>read('sources/'+e.id+'.json'));
const evidence=read('verified-product-mapping.json');
const before=JSON.stringify(raws),cards=raws.map(normalizePtcg);
for(const [i,e] of CLASSIC_CARDS.entries()){
 const c=cards[i],v=pokemonVariantChoices(c),src=evidence.find(r=>r.id===e.id);
 assert.equal(src.tcgplayerId,e.productId);assert.equal(src.cardmarketId,e.cmProduct);
 assert.equal(c.id,e.id);assert.equal(c.set.id,'cel25cc');assert.equal(c.set.number,e.number);assert.equal(c.set.total,e.total);assert.equal(c.set.count,25);assert.equal(c.set.catalogueNumber,e.id.split('-').at(-1));
 assert.equal(normalizePtcgBrief(raws[i]).set.number,e.number);
 assert.equal(v.length,1);assert.equal(v[0].finish,'holofoil');assert.equal(v[0].productId,e.productId);assert.equal(v[0].label,'Holofoil');
 assert.equal(c.prices.usd,null,'all25 source USD is absent or quarantined, never zero/borrowed');
 const html=tcgCardSheet(c,{tab:'prices',priceFinish:v[0].key});assert(!html.includes('<span class="pt-label">Normal</span>'),'foil-only Classic products must not have a Normal Cardmarket price row');if(c.cardmarket.trend||c.cardmarket.avg)assert(html.includes('<span class="pt-label">Holofoil</span>'));
 assert.equal(ptcgProduct(raws[i],v[0].key).productId,e.productId);assert.equal(ptcgProduct(raws[i],'holofoil').productId,e.productId);assert.equal(ptcgProduct(raws[i],'normal'),null);assert.equal(ptcgProduct(raws[i],'reverse-holofoil'),null);
 assert.equal(await pokemonProductId(e.id,async()=>raws[i]),e.productId);
 assert.equal(setVariantKey(c,'holofoil'),v[0].key);
 const later=structuredClone(raws[i]);later.pricing.tcgplayer={updated:'2026-10-15',holofoil:{productId:e.productId,marketPrice:42.25}};later.variants_detailed[0].stamp=[];assert.equal(pokemonVariantChoices(normalizePtcg(later))[0].key,v[0].key,'quote arrivals and stamp metadata changes cannot rebind the saved detailed key');
}
assert.equal(JSON.stringify(raws),before,'source payloads never mutated');
assert.deepEqual(setCardFacets(cards,'ptcg').finishes,['holofoil']);assert.equal(filterSortSetCards(cards,'ptcg',{finish:'holofoil'}).length,25);
assert.equal(cards[7].set.total,null,'Birthday Pikachu has printed24 only, no invented /53 or /25');
for(const i of [19,20]){
 const c=cards[i],e=CLASSIC_CARDS[i],raw=raws[i],key=c.variants[0].key,wrong=raw.variants_detailed[0].thirdParty.tcgplayer;
 assert.equal(c.prices.eur,null);assert.equal(c.cardmarket.trend,null);assert.equal(c.cmProduct,e.cmProduct);assert.deepEqual(c.classicIntegrity.rejectedTcgplayerIds,[String(wrong)]);assert.equal(c.classicIntegrity.rejectedCardmarketIds.length,1);
 assert.equal(ptcgProduct(raw,key,wrong),null);
 assert.match(compactPriceSummary('ptcg',c,{priceFinish:key}),/Conflicting provider prices withheld/);
 assert.equal(new URL(sellerModels('ptcg',c,{priceFinish:key}).find(s=>s.key==='tcgplayer').url).pathname,'/product/'+e.productId);
 const old={...c,classicSchema:undefined,classicIntegrity:undefined,set:{id:'cel25cc',name:c.set.name,number:raw.localId,total:25},variants:[{key:'holofoil',label:'Holofoil',productId:wrong,usd:.28,market:.28}],prices:{usd:.28,eur:.26,updated:'2026-10-14'},cmProduct:raw.pricing.cardmarket.idProduct,conditionQuotes:[]};
 const lot={cardId:c.id,variant:'holofoil',productId:wrong,condition:'Near Mint',manualValue:12.34,manualValueCondition:'Near Mint',qty:2,conditionQuotes:[{cardId:c.id,variant:'holofoil',condition:'Near Mint',currency:'USD',price:.28}]};
 const snapshot=JSON.stringify({old,lot});
 assert.equal(classicCatalogueCard(old).prices.usd,null);assert.equal(presentationQuote('ptcg',old,'holofoil').value,null);assert.equal(entryPrice(old,lot),12.34);assert.equal(entryPrice(old,{...lot,manualValue:null}),null);assert(pokemonVariantProductConflict(old,lot));assert.equal(conditionRequest(old,lot,'ptcg'),null);
 assert.match(trackedQuote('ptcg',old).id,new RegExp('product:'+e.productId));assert.equal(trackedQuote('ptcg',old).value,null);
 assert.equal(JSON.stringify({old,lot}),snapshot,'saved identity, private/manual value and old cache unchanged');
 cache.ptcg[c.id]=old;assert.equal(cardOf('ptcg',c.id).prices.usd,null);const oldGet=SOURCES.ptcg.get;try{SOURCES.ptcg.get=async()=>{throw Error('Offline fixture');};assert.equal((await ensureCard('ptcg',c.id)).prices.usd,null);}finally{SOURCES.ptcg.get=oldGet;delete cache.ptcg[c.id];}
 const clone=structuredClone(c);assert.equal(applyProductPrices(clone,{cardId:c.id,quotes:[{productId:wrong,subTypeName:'Holofoil',marketPrice:99}]}),false);assert.equal(clone.prices.usd,null);
 assert.equal(applyProductPrices(clone,{cardId:c.id,quotes:[{productId:e.productId,subTypeName:'Normal',marketPrice:99}]}),false);
 assert.equal(applyProductPrices(clone,{cardId:c.id,updatedAt:'2026-10-15',quotes:[{productId:e.productId,subTypeName:'Holofoil',marketPrice:42.25}]}),true);assert.equal(clone.prices.usd,42.25);assert.equal(clone.prices.updated,'2026-10-15');
 assert.equal(applyFallbackPrices(structuredClone(c),{name:c.name,number:i===19?'2':'10',set:{name:'Celebrations'},tcgplayer:{prices:{holofoil:{market:99}}}}),false);
 const q={game:'ptcg',cardId:c.id,finish:key,currency:'USD',selectionVerified:true},series=productId=>({game:'ptcg',cardId:c.id,finish:key,series:[{source:'Source fixture',currency:'USD',finish:key,productId,points:[{date:'2026-10-18',value:42.25}]}]});
 assert.match(historyKey(q),new RegExp('product:'+e.productId));assert.throws(()=>validateHistory(series(wrong),q),/Classic product/);assert.throws(()=>validateHistory(series(undefined),q),/Classic product/);assert.equal(validateHistory(series(e.productId),q).series.length,1);
 const projected=setContextCard('ptcg',clone,{id:'cel25cc',name:c.set.name,count:25},[],{variantKey:key});assert.equal(projected.prices.updated,'2026-10-15');assert.equal(projected.set.count,25);assert.equal(projected.set.total,e.total);
}
const pack={schema:1,game:'ptcg',rows:raws.map(r=>[r.id,r.name,'cel25cc',r.localId,25,'Celebrations Classic Collection',''])};const savedPack=JSON.stringify(pack),compiled=compileCatalog(pack);
assert.equal(JSON.stringify(pack),savedPack);for(const e of CLASSIC_CARDS){const row=compiled.rows.find(r=>r[0]===e.id);assert.equal(row[3],e.number);assert.equal(row[4],e.total);}
const oldFetch=globalThis.fetch,oldCaches=globalThis.caches,oldStorage=globalThis.localStorage;const requests=[];globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
try{
 for(const i of [19,20]){
  const c=cards[i],e=CLASSIC_CARDS[i],raw=raws[i],key=c.variants[0].key;
  const fake=async input=>{const u=String(input);requests.push(u);if(u.includes('api.tcgdex.net'))return Response.json(raw);if(u.endsWith('/groups'))return Response.json({results:[{groupId:2931,name:'Celebrations: Classic Collection'}]});if(u.endsWith('/prices')&&u.includes('tcgcsv'))return Response.json({results:[{productId:e.productId,subTypeName:'Holofoil',marketPrice:42.25},{productId:raw.variants_detailed[0].thirdParty.tcgplayer,subTypeName:'Holofoil',marketPrice:.28},{productId:e.productId,subTypeName:'Normal',marketPrice:99}]});if(u.includes('tickermint')){assert(u.includes('/'+e.productId+'/'));return Response.json({Holofoil:[{snapshot_date:'2026-10-18',market:42.25}]});}throw Error('Unexpected network fixture '+u);};
  const body=await(await pokemonPriceRoute(new URL('https://fixture.invalid/api/prices/pokemon?id='+c.id),{},fake)).json();assert.equal(body.quotes.length,1);assert.equal(body.quotes[0].productId,e.productId);assert.equal(body.updatedAt,null,'fetch time must not manufacture a source publication date');assert(Number.isFinite(Date.parse(body.checkedAt)));
  const recent=await(await recentHistoryRoute(new URL('https://fixture.invalid/api/prices/recent?'+new URLSearchParams({game:'ptcg',id:c.id,finish:key})),{},fake)).json();assert.equal(recent.series[0].productId,e.productId);assert.match(recent.series[0].label,new RegExp('#'+e.number+'/'+e.total));
  let paid=0;const now=Date.now(),env={JUSTTCG_API_KEY:'unit-fixture-not-a-key',CONDITION_PRICES:{idFromName:()=>1,get:()=>({fetch:async url=>{paid++;assert.equal(new URL(url).searchParams.get('product'),String(e.productId));return Response.json({status:'available',cachedAt:now,data:[{tcgplayerId:e.productId,variants:[{condition:'Near Mint',printing:'Holofoil',language:'English',price:42.25,priceStatus:'current',lastUpdated:now/1000}]}]});}})}};
  let condition=await(await conditionFeedRoute(new URL('https://fixture.invalid/api/prices/conditions?'+new URLSearchParams({game:'ptcg',id:c.id,variant:key,productId:String(e.productId),language:'en'})),env,{},fake)).json();assert.equal(condition.quotes[0].productId,e.productId);assert.equal(paid,1);
  condition=await(await conditionFeedRoute(new URL('https://fixture.invalid/api/prices/conditions?'+new URLSearchParams({game:'ptcg',id:c.id,variant:'holofoil',productId:String(e.productId),language:'en'})),env,{},async input=>{assert(String(input).includes('api.tcgdex.net'),'legacy alias identity must not depend on an available price');return Response.json(raw);})).json();assert.equal(condition.quotes[0].productId,e.productId);assert.equal(paid,2);
  condition=await(await conditionFeedRoute(new URL('https://fixture.invalid/api/prices/conditions?'+new URLSearchParams({game:'ptcg',id:c.id,variant:key,productId:String(raw.variants_detailed[0].thirdParty.tcgplayer)})),env,{},fake)).json();assert.equal(condition.status,'unmapped');assert.equal(paid,2,'saved wrong product never reaches paid/cache provider');
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};globalThis.fetch=async u=>{requests.push(String(u));assert(!String(u).includes('supabase'),'unbound legacy card history is quarantined, not fetched');return Response.json({game:'ptcg',cardId:c.id,finish:key,series:[],notice:'No recorded market history for this exact product.'});};await loadSharedHistory({game:'ptcg',cardId:c.id,finish:key,currency:'USD',selectionVerified:true});
 }
}finally{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;globalThis.localStorage=oldStorage;}
const regular=readFileSync(dir+'sources/cel25-2.json','utf8');const regularCard=normalizePtcg(JSON.parse(regular));assert.equal(regularCard.prices.usd,.28);assert.equal(regularCard.set.id,'cel25');
const wrongIdentity={...raws[19],name:'Zekrom'};assert.equal(ptcgProduct(wrongIdentity),null);assert.equal(normalizePtcg(wrongIdentity).prices.usd,null);
console.log('PASS: all25 primary identities, printed numbers/count separation, Holofoil-only choices, wrong USD/EUR quarantine, verified sellers/art/products, saved lots/manual values/offline cache preservation, exact fallback/routes/conditions/history isolation, source immutability and regular-set disambiguation. All network/provider results in this test were local fixtures.');
