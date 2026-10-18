// Official, credentialed TCGplayer API only. Product URLs identify a selection;
// seller HTML, listing prices and inferred condition discounts are not inputs.
const DAY=86400000, RETAIN=30*DAY, API='https://api.tcgplayer.com';
export const tcgplayerConfigured=env=>!!(env?.TCGPLAYER_PUBLIC_KEY&&env?.TCGPLAYER_PRIVATE_KEY);
const validId=v=>/^[1-9]\d{0,11}$/.test(String(v||''));
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const failure=(reason='tcgplayer_error',details={})=>({status:reason==='app_budget'||reason==='tcgplayer_rate'?'rate_limited':'unavailable',reason,...details});
const lookup=(rows,idKey,id)=>{const hits=rows.filter(r=>String(r[idKey])===String(id));return hits.length===1?hits[0].name:null;};

// IDs come from the category catalog, not guessed universal numeric constants.
// A 207 response can contain useful exact prices; missing/null rows stay missing.
export function tcgplayerVariants(product,skus,prices,catalog,checkedAt){
 const variants=[];let complete=skus.length>0;
 for(const sku of skus){
  const condition=lookup(catalog.conditions,'conditionId',sku.conditionId),printing=lookup(catalog.printings,'printingId',sku.printingId),language=lookup(catalog.languages,'languageId',sku.languageId);
  const matches=prices.filter(p=>String(p.skuId)===String(sku.skuId));
  if(String(sku.productId)!==String(product)||!validId(sku.skuId)||!condition||!printing||!language||matches.length!==1||!money(matches[0].marketPrice)){complete=false;continue;}
  variants.push({condition,printing,language,price:matches[0].marketPrice,priceStatus:'current',tcgplayerSkuId:String(sku.skuId),source:'TCGplayer',checkedAt,cacheTime:checkedAt});
 }
 return {variants,complete};
}

export class TcgplayerConditionSource {
 constructor(storage,env){this.storage=storage;this.env=env;this.pending=new Map();this.token=null;this.tokenJob=null;}
 async reserve(owner){
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7),minute=Math.floor(now/60000);
  return this.storage.transaction(async tx=>{
   const pause=await tx.get('tcgplayer-pause');
   if(pause?.nextRetryAt>now)throw pause;
   const s=await tx.get('usage')||{};
   if(s.month!==month)Object.assign(s,{month,monthly:0});
   if(s.day!==day)Object.assign(s,{day,daily:0});
   if(s.minute!==minute)Object.assign(s,{minute,perMinute:0});
   const cap=(k,n)=>{const v=Number(this.env[k]??n);return Number.isFinite(v)?Math.max(0,Math.floor(v)):n;};
   if(!owner&&(s.daily>=cap('CONDITION_DAILY_LIMIT',30)||s.monthly>=cap('CONDITION_MONTHLY_LIMIT',900)||s.perMinute>=cap('CONDITION_MINUTE_LIMIT',8)))throw failure('app_budget',{retryAfterMs:60000,nextRetryAt:now+60000});
   // Both providers share the app's counters. JustTCG's existing provider pause
   // remains untouched and does not prevent a separately authorized source.
   s.daily++;s.monthly++;s.perMinute++;await tx.put('usage',s);
  });
 }
 async http(path,options,owner){
  await this.reserve(owner);
  // Workers supports manual/follow only. Reject returned redirects below so
  // authorization headers can never be forwarded to a different destination.
  let r;try{r=await fetch(API+path,{...options,redirect:'manual',signal:AbortSignal.timeout(8000)});}catch{throw failure();}
  if([401,403,429].includes(r.status)){
   const now=Date.now(),header=r.headers.get('Retry-After'),seconds=header?.trim()?Number(header):NaN;
   const delay=Number.isFinite(seconds)?seconds*1000:header?Date.parse(header)-now:NaN;
   const retryAfterMs=Math.max(1000,Number.isFinite(delay)&&delay>0?delay:r.status===429?60000:3600000);
   const result=failure(r.status===429?'tcgplayer_rate':'tcgplayer_auth',{retryAfterMs,nextRetryAt:now+retryAfterMs});
   await this.storage.put('tcgplayer-pause',result);this.token=null;throw result;
  }
  if(!r.ok)throw failure();
  let body;try{body=await r.json();}catch{throw failure();}
  return {body,status:r.status};
 }
 async access(owner){
  if(this.token?.expiresAt>Date.now()+60000)return this.token.value;
  if(!this.tokenJob)this.tokenJob=(async()=>{
   const {body}=await this.http('/token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:this.env.TCGPLAYER_PUBLIC_KEY,client_secret:this.env.TCGPLAYER_PRIVATE_KEY}).toString()},owner);
   if(typeof body.access_token!=='string'||!body.access_token||!(Number(body.expires_in)>60))throw failure('tcgplayer_auth');
   this.token={value:body.access_token,expiresAt:Date.now()+Number(body.expires_in)*1000};return this.token.value;
  })().finally(()=>{this.tokenJob=null;});
  return this.tokenJob;
 }
 async get(path,owner,{partial=false}={}){
  const token=await this.access(owner);
  const {body,status}=await this.http('/v1.39.0'+path,{headers:{Accept:'application/json',Authorization:'Bearer '+token}},owner);
  if(!Array.isArray(body.results)||body.success!==true&&!(partial&&status===207))throw failure();
  return body.results;
 }
 async catalog(path,owner){
  const key='tcg-catalog:'+path,old=await this.storage.get(key);
  if(old&&Date.now()-old.cachedAt<7*DAY)return old.rows;
  if(!this.pending.has(key))this.pending.set(key,(async()=>{const rows=await this.get(path,owner);await this.storage.put(key,{rows,cachedAt:Date.now()});return rows;})().finally(()=>this.pending.delete(key)));
  return this.pending.get(key);
 }
 async load(product,category,owner=false){
  if(!tcgplayerConfigured(this.env))return {status:'not_configured'};
  if(!validId(product)||![1,2,3].includes(Number(category)))return {status:'unmapped'};
  const key='tcg-product:'+product,old=await this.storage.get(key),now=Date.now();
  if(old?.category===Number(category)&&now-old.cachedAt<DAY)return {status:'available',...old};
  try{
   const products=await this.catalog('/catalog/products/'+product,owner);
   if(products.length!==1||String(products[0].productId)!==String(product)||Number(products[0].categoryId)!==Number(category))return {status:'unmapped'};
   const [conditions,printings,languages,skus]=await Promise.all(['conditions','printings','languages'].map(part=>this.catalog('/catalog/categories/'+category+'/'+part,owner)).concat(this.catalog('/catalog/products/'+product+'/skus',owner)));
   const ids=[...new Set(skus.map(s=>s.skuId).filter(validId))];
   if(ids.length>500)throw failure(); // bounded work for unexpected catalog data
   const prices=[];
   for(let i=0;i<ids.length;i+=100)prices.push(...await this.get('/pricing/sku/'+ids.slice(i,i+100).join(','),owner,{partial:true}));
   const checkedAt=Date.now(),{variants,complete}=tcgplayerVariants(product,skus,prices,{conditions,printings,languages},checkedAt);
   const data={category:Number(category),cachedAt:checkedAt,complete,source:'TCGplayer',data:[{tcgplayerId:String(product),variants}]};
   await this.storage.put(key,data);if(!await this.storage.getAlarm())await this.storage.setAlarm(checkedAt+DAY);
   return {status:'available',...data};
  }catch(error){
   const result=error?.reason&&['app_budget','tcgplayer_rate','tcgplayer_auth'].includes(error.reason)?error:failure();
   return old?.category===Number(category)&&now-old.cachedAt<RETAIN?{...result,...old,stale:true,complete:false}:result;
  }
 }
}

// Keep source and freshness per row: one stale provider must not age another.
export function mergeConditionSources(product,primary,backup){
 const variants=[];
 for(const body of [primary,backup])for(const card of body?.data||[])if(String(card.tcgplayerId)===String(product))for(const row of card.variants||[])variants.push({...row,source:body.source||row.source||'JustTCG',cacheTime:body.cachedAt,stale:!!body.stale});
 const current=variants.some(v=>v.priceStatus==='current'&&!v.stale&&v.cacheTime+DAY>Date.now()&&money(v.price));
 return {...(backup||primary),status:current?'available':backup?.status||primary.status,source:'TCGplayer / JustTCG',cachedAt:Date.now(),stale:false,data:[{tcgplayerId:String(product),variants}]};
}
