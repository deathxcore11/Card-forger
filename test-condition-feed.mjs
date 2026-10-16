import assert from 'node:assert/strict';
import {conditionFeedRoute,normalizeConditionVariants} from './condition-feed-route.js';
import {loadConditionQuotes} from './condition-feed.js';
import {conditionValue} from './condition-value.js';
import {lotPrice} from './insights.js';
const now=Date.now(),v=(condition,price,extra={})=>({condition,price,printing:'Foil',lastUpdated:Math.floor(now/1000),priceStatus:'current',...extra});
const body={data:[{tcgplayerId:'42',variants:[v('Near Mint',100),v('Lightly Played',70),v('Moderately Played',50),v('Heavily Played',20),v('Damaged',5),v('Damaged',9,{printing:'Normal'}),v('Lightly Played',200,{language:'Japanese'}),v('Damaged',null,{priceStatus:'expired',printing:'Normal',lastKnownPrice:55})]}]};
const quotes=normalizeConditionVariants(body,42,['Foil']);assert.deepEqual(quotes.map(q=>q.price),[100,70,50,20,5]);assert.deepEqual(normalizeConditionVariants(body,999,['Foil']),[]);assert.deepEqual(normalizeConditionVariants(body,42,['Etched']),[]);
assert.deepEqual(normalizeConditionVariants({data:[{tcgplayerId:42,variants:[v('Near Mint',1),v('Near Mint',2)]}]},42,['Foil']),[],'ambiguous duplicate SKU not chosen arbitrarily');
const entry={name:'A',condition:'Damaged',finish:'foil',language:'en'};const bound=quotes.map(q=>({...q,finish:'foil',language:'en'}));assert.equal(conditionValue(100,entry,bound).price,5);assert.equal(conditionValue(100,{...entry,finish:'nonfoil'},bound).price,null);assert.equal(conditionValue(100,{...entry,language:'ja'},bound).price,null);assert.equal(conditionValue(null,entry,bound.map(q=>({...q,validUntil:'2000-01-01'}))).price,null);assert.equal(lotPrice({...entry,conditionQuotes:bound},{a:{prices:{usd:'100'}}}),5);
let calls=0;const disabled=await conditionFeedRoute(new URL('https://app.test/api/prices/conditions?game=mtg&id=abc'),{},null,async()=>{calls++;});assert.equal((await disabled.json()).status,'not_configured');assert.equal(calls,0);
const originalCaches=globalThis.caches;const cache=new Map(),pending=[];globalThis.caches={default:{match:async k=>cache.get(k.url||k)?.clone(),put:async(k,r)=>cache.set(k.url||k,r.clone())}};
const id='11111111-1111-1111-1111-111111111111',url=new URL('https://app.test/api/prices/conditions?game=mtg&id='+id+'&finish=foil&language=en');let paid=0;
try{
 const fetcher=async(u,opts)=>{if(u.includes('scryfall'))return Response.json({id,tcgplayer_id:42,finishes:['nonfoil','foil']});assert.equal(opts.headers['x-api-key'],'test-secret');paid++;return Response.json(body);};
 const ctx={waitUntil:p=>pending.push(p)};
 const a=await conditionFeedRoute(url,{JUSTTCG_API_KEY:'test-secret'},ctx,fetcher);assert.equal((await a.json()).quotes.length,5);await Promise.all(pending);
 await conditionFeedRoute(url,{JUSTTCG_API_KEY:'test-secret'},ctx,fetcher);assert.equal(paid,1,'all conditions share one cached provider product');
 const wrong=new URL(url);wrong.searchParams.set('finish','etched');assert.equal((await (await conditionFeedRoute(wrong,{JUSTTCG_API_KEY:'test-secret'},ctx,fetcher)).json()).status,'unmapped');assert.equal(paid,1);
}finally{globalThis.caches=originalCaches;}
// Server identity resolution is exercised independently for the other two catalogues.
for(const game of ['ptcg','ygo']){
 const memory=new Map();globalThis.caches={default:{match:async k=>memory.get(k.url||k)?.clone(),put:async(k,r)=>memory.set(k.url||k,r.clone())}};
 const wait=[];const ctx={waitUntil:p=>wait.push(p)};let providerCalls=0;
 try{
  const url=new URL(game==='ptcg'?'https://app.test/api/prices/conditions?game=ptcg&id=set-1&variant=holofoil':'https://app.test/api/prices/conditions?game=ygo&id=123&printing=SET-EN001&rarity=Ultra%20Rare&edition=1st-edition');
  const fetcher=async(u,opts)=>{
   if(u.includes('justtcg')){providerCalls++;return Response.json({data:[{tcgplayerId:42,variants:[v('Damaged',5,{printing:game==='ptcg'?'Holofoil':'1st Edition'})]}]});}
   if(u.includes('tcgdex'))return Response.json({id:'set-1',pricing:{tcgplayer:{holofoil:{productId:42}}}});
   if(u.includes('cardinfo'))return Response.json({data:[{id:123,card_sets:[{set_name:'Sample Set',set_code:'SET-EN001',set_rarity:'Ultra Rare'}]}]});
   if(u.endsWith('/groups'))return Response.json({results:[{groupId:777,name:'Sample Set',abbreviation:'SET'}]});
   if(u.endsWith('/products'))return Response.json({results:[{productId:42,extendedData:[{name:'Number',value:'SET-EN001'},{name:'Rarity',value:'Ultra Rare'}]}]});
   if(u.endsWith('/prices'))return Response.json({results:[{productId:42,marketPrice:100,subTypeName:'1st Edition'}]});
   throw Error('Unexpected fixture request '+u);
  };
  const result=await (await conditionFeedRoute(url,{JUSTTCG_API_KEY:'test-secret'},ctx,fetcher)).json();assert.equal(result.status,'available',game+' exact product resolution');assert.equal(result.quotes[0].price,5);assert.equal(providerCalls,1);await Promise.all(wait);
 }finally{globalThis.caches=originalCaches;}
}
for(const game of ['mtg','ptcg','ygo']){
 const card={id:'fixture-'+game},lot={cardId:card.id,variant:'foil',condition:'Lightly Played',language:'en'};let requests=0;
 const request=loadConditionQuotes(card,lot,game,async()=>{requests++;return Response.json({status:'available',quotes:[{...quotes[1],condition:'Lightly Played'}]});});assert.ok(request);assert.equal(loadConditionQuotes(card,{...lot,condition:'Damaged'},game,async()=>{}),null,'condition change reuses same version request');await request;assert.equal(requests,1);assert.equal(conditionValue(null,lot,card.conditionQuotes).price,70);assert.equal(conditionValue(null,{...lot,edition:'1st-edition'},card.conditionQuotes).price,null);
}
console.log('PASS: all five actual condition tiers, game/finish/language/edition isolation, null/expired/ambiguous refusal, disabled feed without upstream calls, server-only auth, daily shared cache, lot valuation and all-game client de-duplication.');
const retained={id:'retain',conditionQuotes:[{cardId:'retain',condition:'Damaged',currency:'USD',price:5,priceStatus:'current',validUntil:new Date(Date.now()+3600000).toISOString()}]};
const outage=await loadConditionQuotes(retained,{cardId:'retain',condition:'Damaged'},'ptcg',async()=>Response.json({status:'unavailable',quotes:[]}));assert.equal(outage.changed,false);assert.equal(conditionValue(null,{cardId:'retain',condition:'Damaged'},retained.conditionQuotes).price,5,'temporary outage retains a still-valid dated quote');
