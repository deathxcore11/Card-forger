import {POKEMON_VARIANT_SCHEMA} from './pokemon-variant-options.js';
import assert from 'node:assert/strict';
import {referenceQuote} from './price-reference.js';
import {pickProduct,pickGroup} from './pokemon-art.js';
import {applyProductPrices,pokemonPriceRoute} from './pokemon-prices.js';
import {setTcgPrices,tcgFallback} from './mtg-tcgprice.js';
import {needsCardRefresh} from './tcg.js';
import {ConditionPriceCache} from './condition-cache.js';
import {conditionFeedRoute} from './condition-feed-route.js';
import {conditionValue,conditionValueNote,conditionPriceHtml} from './condition-value.js';
const num=n=>[{name:'Number',value:n}];
assert.deepEqual(referenceQuote({marketPrice:null,midPrice:15,lowPrice:3}),{value:15,kind:'mid'});
assert.deepEqual(referenceQuote({marketPrice:0,midPrice:-3,lowPrice:2}),{value:2,kind:'low'});
assert.equal(referenceQuote({marketPrice:'',midPrice:NaN,lowPrice:-1}),null);
assert.equal(pickProduct([{name:'Reshiram ex',productId:1,extendedData:num('1')}],{name:'Reshiram',localId:'001'}),null);
assert.equal(pickProduct([{name:'Ho-Oh - 001/100',productId:1,extendedData:num('1')}],{name:'Ho-Oh',localId:'001'}).productId,1);
assert.equal(pickProduct([1,2].map(productId=>({name:'Charizard',productId,extendedData:num('1')})),{name:'Charizard',localId:'1'}),null);
assert.equal(pickGroup([{name:'Test: A'},{name:'Test: B'}],'Test'),null);
const card={id:'a-1',variants:[{key:'holofoil',label:'Holofoil'},{key:'detail:shadowless',label:'Shadowless · Holofoil'}],prices:{}};
assert.equal(applyProductPrices(card,{cardId:card.id,matchedProduct:7,quotes:[{productId:7,subTypeName:'Holofoil',marketPrice:null,midPrice:15,lowPrice:3}]}),true);
assert.equal(card.prices.usd,15);assert.equal(card.prices.referenceKind,'mid');assert.equal(card.variants[1].productId,undefined);assert.equal(card.variants[1].usd,undefined);
assert.equal(conditionValue(15,{condition:'Lightly Played'}).price,null,'mixed-condition listing reference cannot price LP');
const oldNow=Date.now;let now=oldNow();Date.now=()=>now;
try{
 setTcgPrices('test',{7:{Normal:{market:2}}});const c={set:'test',tcgplayer_id:7};assert.equal(tcgFallback(c).value,2);now+=86400001;assert.equal(tcgFallback(c),null,'in-memory price expires without restart');
 assert.equal(needsCardRefresh('ptcg',{variantSchema:POKEMON_VARIANT_SCHEMA,priceFallbackSchema:3,fetchedAt:new Date(now).toISOString()}),false);
 assert.equal(needsCardRefresh('ptcg',{variantSchema:POKEMON_VARIANT_SCHEMA,priceFallbackSchema:3,fetchedAt:'bad'}),true);
 assert.equal(needsCardRefresh('ptcg',{variantSchema:9,priceFallbackSchema:3,fetchedAt:new Date(now).toISOString()}),true,'Refresh prior rules schema');
}finally{Date.now=oldNow;}
// The actual durable coordinator: simultaneous clients, region-independent persistence,
// all five conditions sharing one call, atomic caps, next-day refresh and provider backoff.
const savedFetch=globalThis.fetch;const rows=new Map();let alarm=null,chain=Promise.resolve();
const storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>{rows.set(k,structuredClone(v));},delete:async k=>rows.delete(k),list:async()=>new Map([...rows].filter(([k])=>k.startsWith('product:'))),getAlarm:async()=>alarm,setAlarm:async n=>{alarm=n;},transaction:fn=>{const job=chain.then(()=>fn(storage));chain=job.catch(()=>{});return job;}};
const env={JUSTTCG_API_KEY:'fixture',CONDITION_DAILY_LIMIT:'2',CONDITION_MONTHLY_LIMIT:'3',CONDITION_MINUTE_LIMIT:'2'};
let requests=0,fail=false;
globalThis.fetch=async(u,opts)=>{requests++;assert.equal(opts.headers['x-api-key'],'fixture');await new Promise(r=>setTimeout(r,5));return fail?new Response('',{status:429,headers:{'Retry-After':'120'}}):Response.json({data:[{tcgplayerId:new URL(u).searchParams.get('tcgplayerId'),variants:[]}]});};
const call=async(obj,id)=>(await obj.fetch(new Request('https://cache/?product='+id))).json();
try{
 const cache=new ConditionPriceCache({storage},env);
 const results=await Promise.all(Array.from({length:8},()=>call(cache,7)));assert.ok(results.every(r=>r.status==='available'));assert.equal(requests,1);
 assert.equal((await call(new ConditionPriceCache({storage},env),7)).status,'available');assert.equal(requests,1,'durable cache survives isolate replacement');
 assert.equal((await call(cache,8)).status,'available');assert.equal((await call(cache,9)).status,'rate_limited');assert.equal(requests,2);
 now=oldNow()+86400001;Date.now=()=>now;
 assert.equal((await call(cache,7)).status,'available');assert.equal(requests,3,'one new call after 24h');
 assert.equal((await call(cache,9)).status,'rate_limited');assert.equal(requests,3,'monthly cap persists across day change');
 Date.now=oldNow;rows.clear();requests=0;fail=true;
 assert.equal((await call(cache,7)).status,'rate_limited');assert.equal((await call(cache,8)).status,'rate_limited');assert.equal(requests,1,'429 backs off globally');
}finally{globalThis.fetch=savedFetch;Date.now=oldNow;}
// Missing aggregate market data must not prevent resolving a real condition SKU.
const originalCaches=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
try{
 let productSeen='';const id='repair-1';
 const fetcher=async u=>{
  if(u.includes('tcgdex'))return Response.json({id,name:'Sample',localId:'1',set:{name:'Sample Set'}});
  if(u.endsWith('/groups'))return Response.json({results:[{groupId:99,name:'Sample Set'}]});
  if(u.endsWith('/products'))return Response.json({results:[{productId:42,name:'Sample',extendedData:num('1')}]});
  if(u.endsWith('/prices'))return Response.json({results:[{productId:42,subTypeName:'Holofoil',marketPrice:null,lowPrice:4}]});
  throw Error('Unexpected '+u);
 };
 const env={JUSTTCG_API_KEY:'fixture',CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:async u=>{productSeen=new URL(u).searchParams.get('product');return Response.json({status:'available',cachedAt:Date.now(),data:[{tcgplayerId:42,variants:[{condition:'Lightly Played',price:3,priceStatus:'current',printing:'Holofoil',language:'English',lastUpdated:Math.floor(Date.now()/1000)}]}]});}})}};
 const result=await (await conditionFeedRoute(new URL('https://app/api/prices/conditions?game=ptcg&id='+id+'&variant=holofoil'),env,null,fetcher)).json();
 assert.equal(productSeen,'42');assert.equal(result.status,'available');assert.equal(result.quotes[0].price,3);
 const entry={condition:'Lightly Played'},quotes=result.quotes;assert.equal(conditionValue(99,entry,quotes).price,3);assert.match(conditionPriceHtml(3,entry,quotes),/Provider estimate/);assert.match(conditionValueNote(entry,quotes),/JustTCG/);
}finally{globalThis.caches=originalCaches;}
console.log('PASS: exact-name/edition safety, listing estimates, daily cache expiry, damaged-copy isolation, durable request deduplication and daily/monthly caps, provider backoff, recovered condition mapping and quote labels.');
const {ygoPriceRoute,editionPrice}=await import('./ygo-prices.js');
const originalCache2=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
let groupFetches=0;
const yg=async u=>{
 if(u.includes('cardinfo'))return Response.json({data:[{id:99123,card_sets:[{set_name:'Repair Group',set_code:'RPR-EN001',set_rarity:'Ultra Rare'},{set_name:'Repair Group',set_code:'RPR-EN002',set_rarity:'Ultra Rare'}]}]});
 if(u.endsWith('/groups')){groupFetches++;return Response.json({results:[{groupId:9988,name:'Repair Group'}]});}
 if(u.endsWith('/products'))return Response.json({results:[1,2].map(i=>({productId:90+i,extendedData:[{name:'Number',value:'RPR-EN00'+i},{name:'Rarity',value:'Ultra Rare'}]}))});
 if(u.endsWith('/prices'))return Response.json({results:[{productId:91,subTypeName:'1st Edition',marketPrice:null,midPrice:8,lowPrice:2}]});
 throw Error('Unexpected '+u);
};
try{
 const url=new URL('https://app/api/prices/yugioh?id=99123');const data=await (await ygoPriceRoute(url,null,yg)).json();
 assert.equal(data.printings.length,2,'unpriced products retain their exact identity for condition lookup');
 assert.equal(editionPrice(data.printings[0],'1st-edition'),8);assert.equal(editionPrice(data.printings[0],'unlimited'),null);
 now=oldNow()+86400001;Date.now=()=>now;await ygoPriceRoute(url,null,yg);assert.equal(groupFetches,2,'warm-isolate group cache expires');
}finally{globalThis.caches=originalCache2;Date.now=oldNow;}
console.log('PASS: Yu-Gi-Oh rarity/edition listing estimates, unpriced product identities and warm-isolate refresh.');

// Regression for the photographed Base Set Nidoking: exact product and a
// provider printing label that includes its edition. All amounts are synthetic.
const nidoking={id:'base1-11',pricing:{tcgplayer:{holofoil:{productId:42351}}},variants_detailed:[{type:'holo',subtype:'unlimited',variantId:'unlimited',thirdParty:{tcgplayer:42351},pricing:{tcgplayer:{holofoil:{productId:42351}}}},{type:'holo',subtype:'shadowless',stamp:['1st-edition'],variantId:'first',thirdParty:{tcgplayer:107006}},{type:'holo',subtype:'shadowless',variantId:'shadowless',thirdParty:{tcgplayer:107006}}]};
const provider=product=>({status:'available',cachedAt:Date.now(),data:[{tcgplayerId:product,variants:['Unlimited Holofoil','1st Edition Holofoil'].map((printing,i)=>({condition:'Moderately Played',printing,price:i?250:12,priceStatus:'current',lastUpdated:Math.floor(Date.now()/1000)}))}]});
const env2={JUSTTCG_API_KEY:'fixture',CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:async u=>Response.json(provider(new URL(u).searchParams.get('product')))})}};
for(const [variant,expected] of [['holofoil',12],['detail:first',250],['detail:shadowless',12]]){
 const result=await(await conditionFeedRoute(new URL('https://app/api/prices/conditions?game=ptcg&id=base1-11&variant='+encodeURIComponent(variant)),env2,null,async()=>Response.json(nidoking))).json();assert.equal(result.status,'available');assert.equal(result.quotes[0].price,expected);assert.equal(result.quotes.length,1);
}
assert.doesNotMatch(conditionPriceHtml(null,{condition:'Moderately Played'}),/Connect a condition/);assert.match(conditionPriceHtml(null,{},[],{status:'rate_limited'}),/lookup paused/);assert.match(conditionPriceHtml(null,{},[],{status:'unmapped'}),/Version not matched/);assert.match(conditionPriceHtml(null,{},[],{status:'loading'}),/Checking condition/);
console.log('PASS: photographed Nidoking edition/finish mismatch is repaired without borrowing First Edition quotes; failures show their actual status.');
