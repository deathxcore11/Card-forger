import {TcgplayerConditionSource,tcgplayerConfigured,mergeConditionSources} from './tcgplayer-condition-source.js';
import {TcgplayerWebSource,tcgplayerWebConfigured} from './tcgplayer-web-source.js';
// A single durable coordinator shares product responses across users and edge regions.
// Limits are requests, not cards; provider failures count too. No browser can change the caps.
const DAY=86400000;
const RETAIN=30*DAY;
export const compactConditionData=(raw,product)=>({data:(raw?.data||[]).filter(c=>String(c.tcgplayerId)===String(product)).map(c=>({tcgplayerId:c.tcgplayerId,variants:(c.variants||[]).map(v=>({condition:v.condition,printing:v.printing,language:v.language,price:v.price,lastKnownPrice:v.lastKnownPrice,priceStatus:v.priceStatus,lastUpdated:v.lastUpdated,tcgplayerSkuId:v.tcgplayerSkuId}))})),cachedAt:Date.now()});
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Preserve the provider's public error code, never its raw response or API key.
export async function conditionProviderFailure(response,now=Date.now()){
 let body;try{body=await response.json();}catch{}
 const codes=['RATE_LIMIT_EXCEEDED','DAILY_LIMIT_EXCEEDED','REQUEST_LIMIT_EXCEEDED','EXCESSIVE_FREE_TIER_USAGE','INVALID_API_KEY','MISSING_API_KEY','SUBSCRIPTION_REQUIRED'];
 const providerCode=codes.includes(body?.code)?body.code:'';
 const limited=response.status===429||['DAILY_LIMIT_EXCEEDED','REQUEST_LIMIT_EXCEEDED','EXCESSIVE_FREE_TIER_USAGE'].includes(providerCode);
 const reason=providerCode==='EXCESSIVE_FREE_TIER_USAGE'?'provider_shared_limit':providerCode==='DAILY_LIMIT_EXCEEDED'?'provider_daily':providerCode==='REQUEST_LIMIT_EXCEEDED'?'provider_monthly':limited?'provider_rate':[401,403].includes(response.status)?'provider_auth':'provider_error';
 const header=response.headers.get('Retry-After'),seconds=header?.trim()!==''&&header!=null?Number(header):NaN;
 const advised=Number.isFinite(seconds)?seconds*1000:header?Date.parse(header)-now:NaN;
 const fallback=reason==='provider_daily'?DAY-now%DAY:reason==='provider_monthly'?3600000:60000;
 const retryAfterMs=Math.max(1000,Number.isFinite(advised)&&advised>0?advised:fallback);
 return {status:limited?'rate_limited':'unavailable',reason,providerCode,retryAfterMs,nextRetryAt:now+retryAfterMs,providerObservedAt:now,retrySource:Number.isFinite(advised)&&advised>0?'provider-header':'fallback'};
}
export class ConditionPriceCache {
 constructor(ctx,env){this.storage=ctx.storage;this.env=env;this.pending=new Map();this.primary=tcgplayerWebConfigured(env)?new TcgplayerWebSource(ctx.storage,env):new TcgplayerConditionSource(ctx.storage,env);}
 async fetch(request){
  const product=new URL(request.url).searchParams.get('product');
  if(!/^\d{1,12}$/.test(product||''))return reply({status:'unmapped'},400);
  if(!this.env.JUSTTCG_API_KEY&&!tcgplayerConfigured(this.env)&&!tcgplayerWebConfigured(this.env))return reply({status:'not_configured'});
  const owner=request.headers.get('X-Condition-Owner')==='verified';
  const params=new URL(request.url).searchParams,category=params.get('category'),forceBackup=params.get('fallback')==='1',pendingKey=product+':'+(category||'')+':'+forceBackup;
  if(this.pending.has(pendingKey)){
   const result=await this.pending.get(pendingKey);
   // A guest's app-budget rejection must not become the owner's result.
   if(!owner||result.reason!=='app_budget')return reply(result);
   return this.fetch(request);
  }
  const job=this.load(product,owner,category,forceBackup);this.pending.set(pendingKey,job);
  try{return reply(await job);}finally{this.pending.delete(pendingKey);}
 }
 async load(product,owner=false,category,forceBackup=false){
  if(!tcgplayerConfigured(this.env)&&!tcgplayerWebConfigured(this.env))return {...await this.loadBackup(product,owner),providers:{tcgplayer:'not_configured',justtcg:'configured'}};
  const primary=await this.primary.load(product,category,owner);
  if(primary.status==='unmapped'||primary.status==='available'&&primary.complete&&!forceBackup)return {...primary,providers:{tcgplayer:primary.status,justtcg:this.env.JUSTTCG_API_KEY?'standby':'not_configured'}};
  const backup=this.env.JUSTTCG_API_KEY?await this.loadBackup(product,owner):null;
  return {...mergeConditionSources(product,primary,backup),...(primary.webDiagnostic?{diagnostics:{tcgplayer:primary.webDiagnostic}}:{}),providers:{tcgplayer:primary.reason||primary.status,justtcg:backup?.reason||backup?.status||'not_configured'}};
 }
 async loadBackup(product,owner=false){
  const now=Date.now(),key='product:'+product,old=await this.storage.get(key);
  if(old&&now-old.cachedAt<DAY)return {status:'available',...old};
  // Keep the original observation/cache times. An outage never makes an old
  // quote current again, but every visitor can still read its last known value.
  const withSaved=result=>old&&now-old.cachedAt<RETAIN?{...result,...old,stale:true}:result;
  const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7),minute=Math.floor(now/60000);
  const cap=(key,fallback)=>{const n=Number(this.env[key]??fallback);return Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;};
  const allowed=await this.storage.transaction(async tx=>{
   let s=await tx.get('usage')||{};
   // App budget rollover must never clear an independent provider cooldown.
   if(s.month!==month)Object.assign(s,{month,monthly:0});
   if(s.day!==day)Object.assign(s,{day,daily:0});
   if(s.minute!==minute)Object.assign(s,{minute,perMinute:0});
   if(s.blockedUntil>now)return {status:'rate_limited',reason:s.blockedReason||'provider_rate',providerCode:s.providerCode||'',retryAfterMs:s.blockedUntil-now,nextRetryAt:s.blockedUntil,...(s.providerObservedAt?{providerObservedAt:s.providerObservedAt}:{}),...(s.retrySource?{retrySource:s.retrySource}:{})};
   if(!owner&&(s.daily>=cap('CONDITION_DAILY_LIMIT',30)||s.monthly>=cap('CONDITION_MONTHLY_LIMIT',900)||s.perMinute>=cap('CONDITION_MINUTE_LIMIT',8)))return {status:'rate_limited',reason:'app_budget',retryAfterMs:60000};
   s.daily++;s.monthly++;s.perMinute++;await tx.put('usage',s);return true;
  });
  if(allowed!==true)return withSaved(allowed);
  try{
   const r=await fetch('https://api.justtcg.com/v1/cards?tcgplayerId='+product,{headers:{Accept:'application/json','x-api-key':this.env.JUSTTCG_API_KEY,'User-Agent':'CardStashy/3.73.13 (condition pricing)'},signal:AbortSignal.timeout(12000)});
   if(!r.ok){const failure=await conditionProviderFailure(r);if(failure.status==='rate_limited')await this.storage.transaction(async tx=>{const s=await tx.get('usage')||{};Object.assign(s,{blockedUntil:failure.nextRetryAt,blockedReason:failure.reason,providerCode:failure.providerCode,providerObservedAt:failure.providerObservedAt,retrySource:failure.retrySource});await tx.put('usage',s);});return withSaved(failure);}
   const data=compactConditionData(await r.json(),product);await this.storage.put(key,data);
   // Expired entries are periodically removed so storage does not grow with the catalogue.
   if(!await this.storage.getAlarm())await this.storage.setAlarm(now+DAY);
   return {status:'available',...data};
  }catch{return withSaved({status:'unavailable'});}
 }
 async alarm(){let count=0;for(const prefix of ['product:','tcg-product:','tcg-catalog:','tcg-web-product:','tcg-web-catalog:','tcg-web-failure:']){const rows=await this.storage.list({prefix});for(const [key,value] of rows){if(Date.now()-value.cachedAt>=(prefix==='tcg-web-failure:'?60000:prefix.includes('catalog:')?7*DAY:RETAIN))await this.storage.delete(key);else count++;}}if(count)await this.storage.setAlarm(Date.now()+DAY);}
}
