// Experimental reader for the public data loaded by TCGplayer product pages.
// No account cookies, developer keys, challenges, or HTML price guessing.
import {TcgplayerConditionSource} from './tcgplayer-condition-source.js';
const DAY=86400000,RETAIN=30*DAY;
const DETAILS='https://mp-search-api.tcgplayer.com/v2/product/';
const PRICES='https://mpgateway.tcgplayer.com/v1/pricepoints/marketprice/skus/search';
const CONDITIONS=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
const validId=v=>/^[1-9]\d{0,11}$/.test(String(v||''));
const failure=(reason='tcgplayer_web_error',details={})=>({status:['app_budget','tcgplayer_rate'].includes(reason)?'rate_limited':'unavailable',reason,...details});
export const tcgplayerWebConfigured=env=>env?.TCGPLAYER_WEB_TEST==='true';

export function webConditionVariants(product,catalog,prices,checkedAt=Date.now()){
 if(String(catalog?.productId)!==String(product)||!Array.isArray(catalog.skus)||!Array.isArray(prices))return {variants:[],complete:false};
 const variants=[];let complete=catalog.skus.length>0;
 for(const sku of catalog.skus){
  const matches=prices.filter(p=>String(p?.skuId)===String(sku?.sku));
  const duplicates=catalog.skus.filter(s=>String(s?.sku)===String(sku?.sku));
  if(!validId(sku?.sku)||duplicates.length!==1||!CONDITIONS.includes(sku.condition)||typeof sku.variant!=='string'||!sku.variant.trim()||typeof sku.language!=='string'||!sku.language.trim()||matches.length!==1){complete=false;continue;}
  const row=matches[0],price=row.marketPrice,calculated=Date.parse(row.calculatedAt);
  if(typeof price!=='number'||!Number.isFinite(price)||price<0||row.calculatedAt!=null&&(!Number.isFinite(calculated)||calculated>checkedAt+300000)){complete=false;continue;}
  variants.push({condition:sku.condition,printing:sku.variant,language:sku.language,price,priceStatus:'current',tcgplayerSkuId:String(sku.sku),source:'TCGplayer',method:'public-web-test',checkedAt,cacheTime:checkedAt,...(Number.isFinite(calculated)?{calculatedAt:new Date(calculated).toISOString()}:{})});
 }
 return {variants,complete};
}

// Reuse the shared app budget and TCGplayer cooldown, including owner handling.
// A public reader never becomes a way around a paused TCGplayer connection.
export class TcgplayerWebSource extends TcgplayerConditionSource {
 async webRequest(url,options,owner){
  await this.reserve(owner);
  const step=url===PRICES?'prices':'catalog';
  let r;try{r=await fetch(url,{...options,headers:{Accept:'application/json',...options?.headers},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw failure('tcgplayer_web_error',{webDiagnostic:{step,result:'network'}});}
  if([401,403,429].includes(r.status)){
   const now=Date.now(),header=r.headers.get('Retry-After'),seconds=header?.trim()?Number(header):NaN;
   const advised=Number.isFinite(seconds)?seconds*1000:header?Date.parse(header)-now:NaN;
   const retryAfterMs=Math.max(1000,Number.isFinite(advised)&&advised>0?advised:r.status===429?60000:3600000);
   const result=failure(r.status===429?'tcgplayer_rate':'tcgplayer_web_access',{retryAfterMs,nextRetryAt:now+retryAfterMs,webDiagnostic:{step,result:'refused',httpStatus:r.status}});
   await this.storage.put('tcgplayer-pause',result);throw result;
  }
  if(!r.ok)throw failure('tcgplayer_web_error',{webDiagnostic:{step,result:'http_error',httpStatus:r.status}});
  // A challenge, login page or unexpected format must never become a price.
  if(!r.headers.get('Content-Type')?.toLowerCase().includes('application/json'))throw failure('tcgplayer_web_error',{webDiagnostic:{step,result:'unexpected_content',httpStatus:r.status}});
  try{return await r.json();}catch{throw failure('tcgplayer_web_error',{webDiagnostic:{step,result:'invalid_json',httpStatus:r.status}});}
 }
 async webCatalog(product,owner){
  const key='tcg-web-catalog:'+product,old=await this.storage.get(key);
  if(old&&Date.now()-old.cachedAt<7*DAY)return old.catalog;
  const catalog=await this.webRequest(DETAILS+product+'/details',{},owner);
  if(String(catalog?.productId)!==String(product)||!Array.isArray(catalog.skus)||catalog.skus.length>500)throw failure('tcgplayer_web_error',{webDiagnostic:{step:'catalog',result:'unexpected_schema'}});
  // Persist only identity fields, never the product-wide reference/listing price.
  const compact={productId:catalog.productId,productLineId:catalog.productLineId,skus:catalog.skus.map(s=>({sku:s.sku,condition:s.condition,variant:s.variant,language:s.language}))};
  await this.storage.put(key,{catalog:compact,cachedAt:Date.now()});
  if(!await this.storage.getAlarm())await this.storage.setAlarm(Date.now()+DAY);
  return compact;
 }
 async load(product,category,owner=false){
  if(!tcgplayerWebConfigured(this.env))return {status:'not_configured'};
  if(!validId(product)||![1,2,3].includes(Number(category)))return {status:'unmapped'};
  const key='tcg-web-product:'+product,now=Date.now(),old=await this.storage.get(key);
  if(old?.category===Number(category)&&now-old.cachedAt<DAY)return {status:'available',...old};
  try{
   const catalog=await this.webCatalog(product,owner);
   if(Number(catalog.productLineId)!==Number(category))return {status:'unmapped'};
   const ids=[...new Set(catalog.skus.map(s=>s.sku).filter(validId))],prices=[];
   for(let i=0;i<ids.length;i+=100){
    const batch=await this.webRequest(PRICES,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skuIds:ids.slice(i,i+100)})},owner);
    if(!Array.isArray(batch)||batch.length>500)throw failure('tcgplayer_web_error',{webDiagnostic:{step:'prices',result:'unexpected_schema'}});prices.push(...batch);
   }
   const checkedAt=Date.now(),{variants,complete}=webConditionVariants(product,catalog,prices,checkedAt);
   const data={category:Number(category),cachedAt:checkedAt,complete,source:'TCGplayer',method:'public-web-test',data:[{tcgplayerId:String(product),variants}]};
   await this.storage.put(key,data);return {status:'available',...data};
  }catch(error){
   const result=['app_budget','tcgplayer_rate','tcgplayer_auth','tcgplayer_web_access','tcgplayer_web_error'].includes(error?.reason)?error:failure();
   return old?.category===Number(category)&&now-old.cachedAt<RETAIN?{...result,...old,stale:true,complete:false}:result;
  }
 }
}
