// A single durable coordinator shares paid product responses across users and edge regions.
// Limits are requests, not cards; provider failures count too. No browser can change the caps.
const DAY=86400000;
export const compactConditionData=(raw,product)=>({data:(raw?.data||[]).filter(c=>String(c.tcgplayerId)===String(product)).map(c=>({tcgplayerId:c.tcgplayerId,variants:(c.variants||[]).map(v=>({condition:v.condition,printing:v.printing,language:v.language,price:v.price,priceStatus:v.priceStatus,lastUpdated:v.lastUpdated,tcgplayerSkuId:v.tcgplayerSkuId}))})),cachedAt:Date.now()});
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export class ConditionPriceCache {
 constructor(ctx,env){this.storage=ctx.storage;this.env=env;this.pending=new Map();}
 async fetch(request){
  const product=new URL(request.url).searchParams.get('product');
  if(!/^\d{1,12}$/.test(product||''))return reply({status:'unmapped'},400);
  if(!this.env.JUSTTCG_API_KEY)return reply({status:'not_configured'});
  if(this.pending.has(product))return reply(await this.pending.get(product));
  const job=this.load(product);this.pending.set(product,job);
  try{return reply(await job);}finally{this.pending.delete(product);}
 }
 async load(product){
  const now=Date.now(),key='product:'+product,old=await this.storage.get(key);
  if(old&&now-old.cachedAt<DAY)return {status:'available',...old};
  const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7),minute=Math.floor(now/60000);
  const cap=(key,fallback)=>{const n=Number(this.env[key]??fallback);return Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;};
  const allowed=await this.storage.transaction(async tx=>{
   let s=await tx.get('usage')||{};
   if(s.month!==month)s={month,monthly:0};
   if(s.day!==day)Object.assign(s,{day,daily:0});
   if(s.minute!==minute)Object.assign(s,{minute,perMinute:0});
   if(s.daily>=cap('CONDITION_DAILY_LIMIT',30)||s.monthly>=cap('CONDITION_MONTHLY_LIMIT',900)||s.perMinute>=cap('CONDITION_MINUTE_LIMIT',8)||s.blockedUntil>now)return false;
   s.daily++;s.monthly++;s.perMinute++;await tx.put('usage',s);return true;
  });
  if(!allowed)return {status:'rate_limited'};
  try{
   const r=await fetch('https://api.justtcg.com/v1/cards?tcgplayerId='+product,{headers:{Accept:'application/json','x-api-key':this.env.JUSTTCG_API_KEY,'User-Agent':'CardStashy/3.73.13 (condition pricing)'},signal:AbortSignal.timeout(12000)});
   if(!r.ok){if(r.status===429)await this.storage.transaction(async tx=>{const s=await tx.get('usage')||{};s.blockedUntil=now+Math.min(DAY,Math.max(60000,Number(r.headers.get('Retry-After'))*1000||3600000));await tx.put('usage',s);});return {status:r.status===429?'rate_limited':'unavailable'};}
   const data=compactConditionData(await r.json(),product);await this.storage.put(key,data);
   // Expired entries are periodically removed so storage does not grow with the catalogue.
   if(!await this.storage.getAlarm())await this.storage.setAlarm(now+DAY);
   return {status:'available',...data};
  }catch{return {status:'unavailable'};}
 }
 async alarm(){const rows=await this.storage.list({prefix:'product:'});for(const [key,value] of rows)if(Date.now()-value.cachedAt>=DAY)await this.storage.delete(key);if(rows.size)await this.storage.setAlarm(Date.now()+DAY);}
}
