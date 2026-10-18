import assert from 'node:assert/strict';
import {conditionProviderFailure,ConditionPriceCache} from './condition-cache.js';
import {conditionFeedRoute} from './condition-feed-route.js';
import {createConditionRefreshScheduler} from './condition-refresh-scheduler.js';
import {loadConditionQuotes,clearConditionAttempts,forgetConditionAttempt,conditionRequest,conditionRetryMs} from './condition-feed.js';
import {conditionPriceHtml,conditionValue} from './condition-value.js';

const now=Date.now();
for(const [code,reason] of Object.entries({RATE_LIMIT_EXCEEDED:'provider_rate',DAILY_LIMIT_EXCEEDED:'provider_daily',REQUEST_LIMIT_EXCEEDED:'provider_monthly',EXCESSIVE_FREE_TIER_USAGE:'provider_shared_limit'})){
 const result=await conditionProviderFailure(Response.json({code,error:'Must not expose a raw provider response'},{status:429}),now);
 assert.equal(result.reason,reason);assert.equal(result.providerCode,code);assert(!JSON.stringify(result).includes('raw provider'));
 if(code==='RATE_LIMIT_EXCEEDED')assert.equal(result.retryAfterMs,60000,'Missing Retry-After does not turn a minute limit into an hour');
}
assert.equal((await conditionProviderFailure(new Response('',{status:429,headers:{'Retry-After':'120'}}),now)).retryAfterMs,120000);
assert.equal((await conditionProviderFailure(new Response('',{status:429,headers:{'Retry-After':new Date(now+180000).toUTCString()}}),now)).retryAfterMs,Date.parse(new Date(now+180000).toUTCString())-now);
assert.equal((await conditionProviderFailure(Response.json({code:'INVALID_API_KEY'},{status:401}))).reason,'provider_auth');

// The real route must carry the reason and retry timing through to the client.
const failed={status:'rate_limited',reason:'provider_shared_limit',providerCode:'EXCESSIVE_FREE_TIER_USAGE',retryAfterMs:60000,nextRetryAt:now+60000};
const env={JUSTTCG_API_KEY:'fixture',CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json(failed)})}};
const url=new URL('https://fixture/api/prices/conditions?game=ptcg&id=base1-63&variant=normal');
const response=await (await conditionFeedRoute(url,env,null,async()=>Response.json({id:'base1-63',pricing:{tcgplayer:{normal:{productId:42408}}}}))).json();
assert.equal(response.reason,failed.reason);assert.equal(response.retryAfterMs,60000);assert.equal(response.nextRetryAt,now+60000);assert.match(response.notice,/even when your own lookup allowance remains/);
clearConditionAttempts();
const card={id:'base1-63'},entry={cardId:card.id,variant:'normal',condition:'Moderately Played'};
const client=await loadConditionQuotes(card,entry,'ptcg',async()=>Response.json(response));
assert.equal(client.providerCode,failed.providerCode);assert.equal(client.reason,failed.reason);assert.equal(client.nextRetryAt,failed.nextRetryAt);
assert.equal(conditionRetryMs(client,3600000,now+30000),30000,'An absolute deadline must count down, not restart its original relative duration');
assert.equal(conditionRetryMs(client,3600000,now+60001),0,'Expired absolute deadline must not fall back to the old relative delay');
const html=conditionPriceHtml(null,entry,[],{...client,reference:6.74,retryAction:'retryConditionPrice'});
assert.match(html,/\$6.74/);assert.match(html,/Condition lookup paused/);assert.match(html,/Check saved condition prices/);assert.match(html,/even with requests left/);assert.match(html,/Next lookup attempt/);assert.match(html,/Recovery is not guaranteed/);assert.match(html,/not a verified Moderately Played price/);
const expiredHtml=conditionPriceHtml(null,entry,[],{...client,nextRetryAt:Date.now()-1000,retryAction:'retryConditionPrice'});
assert.match(expiredHtml,/wait has ended/);assert.match(expiredHtml,/>Retry condition price</);assert.doesNotMatch(expiredHtml,/Check saved/);
const manualHtml=conditionPriceHtml(4, {...entry,manualValue:4,manualValueCondition:entry.condition},[],client);assert.match(manualHtml,/Your recorded value/);assert.doesNotMatch(manualHtml,/Next lookup attempt/);
const appBudgetHtml=conditionPriceHtml(null,entry,[],{status:'rate_limited',reason:'app_budget',notice:'The app’s shared lookup allowance has been reached.',nextRetryAt:now+60000,retryAction:'retryConditionPrice'});
assert.match(appBudgetHtml,/App lookup allowance reached/);assert.match(appBudgetHtml,/Next lookup attempt/);assert.doesNotMatch(appBudgetHtml,/provider attempt|JustTCG|hosting limit|Check saved/);
assert.equal(conditionValue(6.74,entry).price,null,'Reference display must not silently value a played copy');
forgetConditionAttempt(conditionRequest(card,entry,'ptcg'));
const recovered=await loadConditionQuotes(card,entry,'ptcg',async()=>Response.json({status:'available',quotes:[{condition:'Moderately Played',currency:'USD',price:2.5,priceStatus:'current',validUntil:new Date(now+86400000).toISOString()}]}));
assert.equal(recovered.status,'available');assert.equal(conditionValue(null,entry,card.conditionQuotes).price,2.5);

clearConditionAttempts();
const legacyStart=Date.now();
const legacy=await loadConditionQuotes(card,entry,'ptcg',async()=>Response.json({...response,nextRetryAt:undefined}));
assert(legacy.nextRetryAt>=legacyStart+60000&&legacy.nextRetryAt<=Date.now()+60000,'Legacy relative-only responses receive one absolute deadline on arrival');

clearConditionAttempts();
const expiredAt=Date.now()-1000;
const expiredClient=await loadConditionQuotes(card,entry,'ptcg',async()=>Response.json({...response,nextRetryAt:expiredAt}));assert.equal(expiredClient.nextRetryAt,expiredAt,'An already expired server deadline must remain unchanged');

const scheduler=createConditionRefreshScheduler({intervalMs:0});let calls=0;
const first=scheduler.request('first',()=>{calls++;return {...client};});
const queued=scheduler.request('queued',()=>{calls++;return {status:'available'};});
await first;const paused=await queued;
assert.equal(paused.limitReason,'provider_shared_limit');assert.equal(paused.notice,client.notice);assert.equal(calls,1);
const retry=await scheduler.request('first',()=>{calls++;return {status:'available'};},{source:'search',retry:true});
assert.equal(retry.status,'available');assert.equal(calls,2);

// Cached prices still work during provider backoff, including for the owner.
const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),transaction:fn=>fn(storage),getAlarm:async()=>1};
const savedFetch=globalThis.fetch;let providerCalls=0;
try{
 globalThis.fetch=async()=>{providerCalls++;return Response.json({code:'EXCESSIVE_FREE_TIER_USAGE'},{status:429,headers:{'Retry-After':'60'}});};
 const cache=new ConditionPriceCache({storage},{JUSTTCG_API_KEY:'fixture',CONDITION_DAILY_LIMIT:0});
 const owner=id=>cache.fetch(new Request('https://fixture/?product='+id,{headers:{'X-Condition-Owner':'verified'}})).then(r=>r.json());
 const initialBlock=await owner(1);assert.equal(initialBlock.reason,'provider_shared_limit');
 const repeatedBlock=await owner(2);assert.equal(repeatedBlock.providerCode,'EXCESSIVE_FREE_TIER_USAGE');assert.equal(repeatedBlock.nextRetryAt,initialBlock.nextRetryAt,'Server retries retain the original provider deadline');assert.equal(rows.get('usage').blockedUntil,initialBlock.nextRetryAt);assert.equal(providerCalls,1,'Owner retries respect real provider backoff');
 rows.set('product:3',{cachedAt:Date.now(),data:[]});assert.equal((await owner(3)).status,'available','Known prices remain usable during a provider block');
 rows.clear();globalThis.fetch=async()=>{providerCalls++;return Response.json({data:[]});};
 const guest=cache.fetch(new Request('https://fixture/?product=4'));
 const verified=owner(4);
 assert.equal((await (await guest).json()).reason,'app_budget');assert.equal((await verified).status,'available','Concurrent guest rejection cannot cap the owner');
}finally{globalThis.fetch=savedFetch;clearConditionAttempts();}
console.log('PASS: provider error diagnostics, exact Retry-After, queued notice retention, explicit retry recovery, reference/condition separation, cache availability and concurrent owner exemption.');

const {conditionRetryTime}=await import('./condition-value.js');assert.equal(conditionRetryTime(1334*60000),'23 hours');assert.equal(conditionRetryTime(60000),'1 minute');assert.equal(conditionRetryTime(49*3600000),'3 days');

const {scanConditionNotice}=await import('./scancam.js');
const review={i:0,finish:'normal',condition:'Lightly Played',price:null,priceStatus:'rate_limited',priceReason:'provider_shared_limit',priceNotice:response.notice};
assert.match(scanConditionNotice(review),/even when your own lookup allowance remains/);
assert.match(scanConditionNotice(review),/data-act="scanRetryConditionPrice"/);
assert.doesNotMatch(scanConditionNotice({...review,price:.12}),/Retry/);
assert.doesNotMatch(scanConditionNotice({...review,i:-1}),/Retry/);
assert.match(scanConditionNotice({...review,priceNotice:'<img onerror=alert(1)>'}),/&lt;img/);
console.log('PASS: scanner exposes exact provider reason and deliberate retry without mislabeling an owner quota or rendering untrusted markup.');

// Calendar app budgets and provider Retry-After are independent clocks.
const monthRows=new Map([['usage',{month:'2000-01',monthly:900,blockedUntil:Date.now()+60000,blockedReason:'provider_shared_limit',providerCode:'EXCESSIVE_FREE_TIER_USAGE'}]]);
const monthStorage={get:async k=>structuredClone(monthRows.get(k)),put:async(k,v)=>monthRows.set(k,structuredClone(v)),transaction:fn=>fn(monthStorage)};
const monthCache=new ConditionPriceCache({storage:monthStorage},{JUSTTCG_API_KEY:'fixture'});
const rollover=await (await monthCache.fetch(new Request('https://fixture/?product=25'))).json();
assert.equal(rollover.reason,'provider_shared_limit','Monthly budget rollover must preserve active provider backoff');
assert.equal(rollover.nextRetryAt,monthRows.get('usage').blockedUntil);
const headerFailure=await conditionProviderFailure(new Response('',{status:429,headers:{'Retry-After':'120'}}),now);
assert.equal(headerFailure.retrySource,'provider-header');assert.equal(headerFailure.providerObservedAt,now);
const fallbackFailure=await conditionProviderFailure(new Response('',{status:429}),now);assert.equal(fallbackFailure.retrySource,'fallback');
const scanPaused=scanConditionNotice({...review,priceNextRetryAt:Date.now()+60000,priceRetryAfterMs:60000});
assert.match(scanPaused,/Check saved condition prices/);assert.match(scanPaused,/Next lookup attempt available/);
const scanExpired=scanConditionNotice({...review,priceNextRetryAt:Date.now()-1000,priceRetryAfterMs:60000});
assert.match(scanExpired,/wait has ended/);assert.match(scanExpired,/>Retry condition price</);
console.log('PASS: scan/editor deadline parity, safe retry provenance and provider cooldown survives month rollover.');
