import assert from 'node:assert/strict';
import {ConditionPriceCache} from './condition-cache.js';
import {conditionFeedRoute,normalizeConditionVariants} from './condition-feed-route.js';
import {loadConditionQuotes,clearConditionAttempts,applyConditionQuotes} from './condition-feed.js';
import {conditionValue,conditionPriceHtml,lastKnownConditionQuote} from './condition-value.js';
import {conditionBuyLink,sellerModels} from './pricing-presentation.js';
const day=86400000,now=Date.now(),observed=Math.floor((now-2*day)/1000);
const raw={cachedAt:now-2*day,data:[{tcgplayerId:89828,variants:[{condition:'Moderately Played',printing:'Holofoil',language:'English',price:93.45,priceStatus:'current',lastUpdated:observed}]}]};
const rows=new Map([['product:89828',raw],['usage',{blockedUntil:now+day,blockedReason:'provider_shared_limit'}]]);
const storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),transaction:fn=>fn(storage),getAlarm:async()=>1,list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix))),delete:async k=>rows.delete(k),setAlarm:async()=>{}};
const previous=globalThis.fetch;let requests=0;
try{
 globalThis.fetch=async()=>{requests++;throw Error('Cooldown must prevent upstream calls');};
 const cache=new ConditionPriceCache({storage},{JUSTTCG_API_KEY:'fixture'});
 for(const owner of [false,true]){
  const data=await (await cache.fetch(new Request('https://cache/?product=89828',{headers:owner?{'X-Condition-Owner':'verified'}:{}}))).json();
  assert.equal(data.status,'rate_limited');assert.equal(data.stale,true);assert.equal(data.cachedAt,raw.cachedAt);
  const quotes=normalizeConditionVariants(data,89828,['Holofoil'],'English',data.cachedAt);
  assert.equal(quotes[0].priceStatus,'last_known');assert.equal(quotes[0].observedAt,new Date(observed*1000).toISOString());
  const card={id:'ex4-10'},entry={cardId:card.id,variant:'holofoil',condition:'Moderately Played'};
  clearConditionAttempts();const response=await loadConditionQuotes(card,entry,'ptcg',async()=>Response.json({...data,quotes}));
  assert.equal(response.changed,true);assert.equal(response.status,'rate_limited');assert.equal(conditionValue(null,entry,card.conditionQuotes).price,null);
  assert.equal(lastKnownConditionQuote(entry,card.conditionQuotes).price,93.45);
  assert.match(conditionPriceHtml(null,entry,card.conditionQuotes,response),/\$93.45 · Last known condition price/);
  assert.equal(lastKnownConditionQuote({...entry,variant:'reverse-holofoil'},card.conditionQuotes),null);
  applyConditionQuotes(card,entry,[]);assert.equal(card.conditionQuotes.length,1,'Empty refresh does not erase last known condition');
 }
 assert.equal(requests,0);await cache.alarm();assert(rows.has('product:89828'),'Daily cleanup retains historical quotes');
 rows.set('product:old',{...raw,cachedAt:now-31*day});await cache.alarm();assert(!rows.has('product:old'));
}finally{globalThis.fetch=previous;clearConditionAttempts();}
const env={JUSTTCG_API_KEY:'fixture',CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:async u=>{assert.equal(new URL(u).searchParams.get('product'),'89828');return Response.json({status:'available',...raw,cachedAt:now});}})}};
const detail={type:'holo',variantId:'unlimited',thirdParty:{tcgplayer:89828},pricing:{tcgplayer:{holofoil:{marketPrice:190.17}}}};
for(const ambiguous of [false,true]){
 let identityCalls=0;
 const result=await (await conditionFeedRoute(new URL('https://app/api/prices/conditions?game=ptcg&id=ex4-10&variant=holofoil'),env,null,async u=>{identityCalls++;assert.match(u,/tcgdex/);return Response.json({id:'ex4-10',pricing:{tcgplayer:{holofoil:{marketPrice:190.17}}},variants_detailed:ambiguous?[detail,{...detail,variantId:'other',thirdParty:{tcgplayer:7}}]:[detail]});})).json();
 assert.equal(result.status,ambiguous?'unmapped':'available');assert.equal(identityCalls,1,'Exact detail avoids an unnecessary catalogue fallback');
}
const pk={id:'ex4-10',game:'ptcg',name:"Team Magma's Houndoom",variants:[{key:'holofoil',label:'Holofoil',subtype:'unlimited',finish:'holofoil',productId:89828},{key:'reverse-holofoil',label:'Reverse Holo',productId:89828}]};
assert.equal(conditionBuyLink('ptcg',pk,{condition:'Moderately Played'}),null,'Not sure must not claim an exact condition/version link');
for(const [variant,printing] of [['holofoil','Holofoil'],['reverse-holofoil','Reverse Holofoil']]){
 const link=conditionBuyLink('ptcg',pk,{variant,condition:'Moderately Played',language:'en'}),url=new URL(link.url);
 assert(link.direct);assert.equal(url.pathname,'/product/89828');assert.equal(url.searchParams.get('Printing'),printing);assert.equal(url.searchParams.get('Language'),'English');assert.equal(url.searchParams.get('Condition'),'Moderately Played');
}
const mtg={id:'m',finishes:['foil','etched'],tcgplayer_id:42,tcgplayer_etched_id:43};
const m=new URL(conditionBuyLink('mtg',mtg,{printingId:'m',finish:'etched',language:'ja',condition:'Damaged'}).url);assert.equal(m.pathname,'/product/43');assert.equal(m.searchParams.get('Language'),'Japanese');assert.equal(m.searchParams.get('Printing'),'Etched Foil');
const y={id:'1',sets:[{code:'S-1',rarity:'Ultra Rare',productId:9}]};
assert.equal(conditionBuyLink('ygo',y,{printing:'S-1',rarity:'Ultra Rare',condition:'Near Mint'}),null,'An unspecified YGO edition is not selected by a reference quote');
const yurl=new URL(conditionBuyLink('ygo',y,{printing:'S-1',rarity:'Ultra Rare',edition:'1st-edition',condition:'Lightly Played',language:'en'}).url);assert.equal(yurl.searchParams.get('Printing'),'1st Edition');
const unknown=sellerModels('ptcg',pk,{priceFinish:'missing',condition:'Damaged'})[0];assert(!unknown.direct);assert.equal(new URL(unknown.url).searchParams.has('Condition'),false);
console.log('PASS: shared stale cache during cooldown, original observation dates, no stale valuation, retention, exact legacy mapping, ambiguity refusal and game/condition/finish/language Buy filters.');
