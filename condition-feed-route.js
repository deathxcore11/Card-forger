// Optional server-only condition feed. No key is shipped with the static app.
import {pokemonPriceRoute} from './pokemon-prices.js';
import {rarityKey,ygoPriceRoute} from './ygo-prices.js';
import {SUPABASE} from './config.js';
import {tcgplayerConfigured} from './tcgplayer-condition-source.js';
import {tcgplayerWebConfigured} from './tcgplayer-web-source.js';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const CONDITIONS=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
const UA={'Accept':'application/json','User-Agent':'CardStashy/3.73.13 (cached condition valuation; github.com/deathxcore11/Card-forger)'};
export function normalizeConditionVariants(body,product,printings,language='English',now=Date.now()){
 const cards=(body?.data||[]).filter(c=>String(c.tcgplayerId)===String(product));
 if(cards.length!==1)return [];
 const buckets=new Map();
 for(const v of cards[0].variants||[]){
  const source=v.source==='TCGplayer'||body.source==='TCGplayer'?'TCGplayer':'JustTCG';
  const expired=source==='JustTCG'&&v.priceStatus==='expired',price=expired?v.lastKnownPrice:v.price;
  if(!CONDITIONS.includes(v.condition)||!['current','expired'].includes(v.priceStatus)||price===null||typeof price!=='number'||!Number.isFinite(price)||price<0||!printings.some(p=>norm(p)===norm(v.printing))||norm(v.language||'English')!==norm(language))continue;
  const cacheTime=Number(v.cacheTime)||now,time=source==='TCGplayer'?Number(v.checkedAt):Number(v.lastUpdated)*1000;
  if(!Number.isFinite(time)||time<=0||time>cacheTime+300000||time>Date.now()+300000)continue;
  const lastKnown=expired||body.stale||v.stale||cacheTime+86400000<=Date.now();
  if(lastKnown&&time<=Date.now()-30*86400000)continue;
  const q={condition:v.condition,price,currency:'USD',source,kind:'provider-estimate',sku:String(v.tcgplayerSkuId||v.uuid||v.id||''),...(source==='TCGplayer'?{checkedAt:new Date(time).toISOString()}:{observedAt:new Date(time).toISOString()}),validUntil:new Date(cacheTime+86400000).toISOString(),priceStatus:lastKnown?'last_known':'current'};
  if(source==='TCGplayer'&&v.method==='public-web-test'){
   q.method=v.method;
   const calculated=Date.parse(v.calculatedAt);
   if(Number.isFinite(calculated)&&calculated<=time+300000)q.calculatedAt=new Date(calculated).toISOString();
  }
  const list=buckets.get(v.condition)||[];list.push(q);buckets.set(v.condition,list);
 }
 // Ambiguous parallel variants are unavailable, not whichever came first.
 const rank=q=>(q.priceStatus==='current'?0:2)+(q.source==='TCGplayer'?0:1);
 return [...buckets.values()].map(xs=>xs.filter(q=>rank(q)===Math.min(...xs.map(rank)))).filter(xs=>xs.length===1).map(xs=>xs[0]);
}
// Some Pokémon products encode the edition in the printing label (for example
// Unlimited Holofoil), while TCGdex calls that same finish simply holofoil.
// Derive aliases from the exact provider variant, never from the card name.
export function pokemonConditionPrintings(v,{bare=false}={}){
 const finish={normal:'Normal',holo:'Holofoil',reverse:'Reverse Holofoil'}[v?.type];if(!finish)return [];
 const stamps=Array.isArray(v.stamp)?v.stamp:[v.stamp],edition=stamps.includes('1st-edition')?'1st Edition':['unlimited','shadowless'].includes(v.subtype)?'Unlimited':'';
 return [...new Set(edition?[edition+' '+finish,edition,...(bare?[finish]:[])]:[finish])];
}
// Only the Auth server's verified user ID can grant the owner's exemption.
// Query parameters, client headers and editable profile metadata grant nothing.
export async function conditionOwner(request,env,fetchImpl=fetch){
 const id=env.CONDITION_OWNER_ID,authorization=request?.headers?.get('Authorization');
 if(!id||!authorization||!/^Bearer [A-Za-z0-9._-]+$/.test(authorization)||authorization.length>8192)return false;
 try{
  const url=(env.SUPABASE_URL||SUPABASE.url).replace(/\/$/,'')+'/auth/v1/user';
  const response=await fetchImpl(url,{headers:{apikey:env.SUPABASE_ANON_KEY||SUPABASE.key,Authorization:authorization},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return false;
  const user=await response.json();return user.id===id&&!!user.email_confirmed_at&&!user.is_anonymous;
 }catch{return false;}
}
export async function conditionFeedRoute(url,env,ctx,fetchImpl=fetch,{request}={}){
 const game=url.searchParams.get('game'),id=url.searchParams.get('id')||'';
 const empty=(status,notice,details={})=>Response.json({status,quotes:[],notice,...details},{headers:{'Cache-Control':'no-store'}});
 if(!['mtg','ptcg','ygo'].includes(game)||!(/^[a-zA-Z0-9.!?_-]{1,80}$/.test(id)))return Response.json({error:'Invalid card'},{status:400});
 if(!env?.JUSTTCG_API_KEY&&!tcgplayerConfigured(env)&&!tcgplayerWebConfigured(env))return empty('not_configured','Condition pricing requires a connected provider. Reference prices are still available; you can record your own value for this condition.');
 if(!env.CONDITION_PRICES)return empty('unavailable','Condition price cache is not configured.');
 const cache=globalThis.caches?.default;
 const get=async u=>{const key=new Request(u);const hit=await cache?.match(key);if(hit)return hit.json();const r=await fetchImpl(u,{headers:UA,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Card identity lookup unavailable');const d=await r.json();ctx?.waitUntil?.(cache?.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age=86400'}})));return d;};
 try{
  let product,printings=[];
  if(game==='mtg'){
   if(!/^[a-f0-9-]{36}$/.test(id))return empty('unmapped','Choose an exact printing first.');
   const c=await get('https://api.scryfall.com/cards/'+id),finish=url.searchParams.get('finish')||'nonfoil';
   if(c.id!==id||!['nonfoil','foil','etched'].includes(finish)||!c.finishes?.includes(finish))return empty('unmapped','Finish is not verified for this printing.');
   product=finish==='etched'?c.tcgplayer_etched_id:c.tcgplayer_id;
   printings=finish==='nonfoil'?['Normal']:finish==='foil'?['Foil']:['Etched','Etched Foil'];
  }else if(game==='ygo'){
   if(!/^\d{1,12}$/.test(id))return empty('unmapped','Invalid card identity.');
   const response=await ygoPriceRoute(new URL(url.origin+'/api/prices/yugioh?'+new URLSearchParams({id,printing:url.searchParams.get('printing')||'',rarity:url.searchParams.get('rarity')||''})),ctx,fetchImpl),d=await response.json();
   const exact=(d.printings||[]).filter(p=>p.code===url.searchParams.get('printing')&&rarityKey(p.rarity)===rarityKey(url.searchParams.get('rarity')));
   if(exact.length!==1)return empty('unmapped','Choose a verified set code and rarity.');
   product=exact[0].productId;const edition=url.searchParams.get('edition');
   printings={'1st-edition':['1st Edition'],unlimited:['Unlimited'],limited:['Limited','Limited Edition']}[edition]||[];
  }else{
   const c=await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id)),variant=url.searchParams.get('variant')||'';
   if(c.id!==id)return empty('unmapped','Card identity does not match.');
   if(variant.startsWith('product:')){
    const response=await pokemonPriceRoute(new URL(url.origin+'/api/prices/pokemon?id='+encodeURIComponent(id)),ctx,fetchImpl),d=await response.json();
    const exact=(d.quotes||[]).filter(q=>'product:'+q.productId+':'+q.subTypeName.toLowerCase().replace(/ /g,'-')===variant);
    if(exact.length===1){product=exact[0].productId;printings=[exact[0].subTypeName];if(/^1st Edition /.test(exact[0].subTypeName))printings.push('1st Edition');}
   }else if(variant.startsWith('detail:')){
    const v=c.variants_detailed?.find(v=>'detail:'+v.variantId===variant);product=v?.thirdParty?.tcgplayer;
    if(v)printings=pokemonConditionPrintings(v,{bare:(c.variants_detailed||[]).filter(d=>String(d.thirdParty?.tcgplayer)===String(product)).length===1});
   }else{
    const v=c.pricing?.tcgplayer?.[variant];product=v?.productId;
    printings=({'normal':['Normal'],'holofoil':['Holofoil'],'reverse-holofoil':['Reverse Holofoil'],'1st-edition':['1st Edition'],'1st-edition-holofoil':['1st Edition Holofoil','1st Edition'],'unlimited':['Unlimited'],'unlimited-holofoil':['Unlimited Holofoil','Unlimited']})[variant]||[];
    // Legacy selections can have a quote without a product ID at card level.
    // Recover only one exact detailed variant; conflicting editions stay unmapped.
    const candidates=(c.variants_detailed||[]).filter(d=>d.pricing?.tcgplayer?.[variant]);
    if(!product&&candidates.length>1)return empty('unmapped','Choose an exact detailed version; this legacy finish matches multiple variants.');
    if(!product&&candidates.length===1)product=candidates[0].pricing.tcgplayer[variant].productId||candidates[0].thirdParty?.tcgplayer;
    const details=(c.variants_detailed||[]).filter(d=>d.pricing?.tcgplayer?.[variant]&&String(d.pricing.tcgplayer[variant].productId||d.thirdParty?.tcgplayer)===String(product));
    if(details.length===1){const d=details[0],siblings=(c.variants_detailed||[]).filter(x=>String(x.thirdParty?.tcgplayer)===String(product));printings=pokemonConditionPrintings(d,{bare:siblings.length<=1});}

   }
   // Recover exact legacy finishes when TCGdex has no product, but the daily catalogue does.
   if(!product&&['normal','holofoil','reverse-holofoil'].includes(variant)){
    const response=await pokemonPriceRoute(new URL(url.origin+'/api/prices/pokemon?id='+encodeURIComponent(id)),ctx,fetchImpl),d=await response.json();
    const hits=(d.quotes||[]).filter(q=>printings.some(p=>norm(p)===norm(q.subTypeName)));
    const ids=[...new Set(hits.map(q=>Number(q.productId)))];if(ids.length===1)product=ids[0];
   }
  }
  if(!Number.isInteger(Number(product))||Number(product)<=0||!printings.length)return empty('unmapped','No exact condition product mapping for this version.');
  const lang=url.searchParams.get('language')||'English',language={en:'English',ja:'Japanese',de:'German',fr:'French',es:'Spanish',it:'Italian',pt:'Portuguese',ko:'Korean',zh:'Chinese'}[lang.toLowerCase()]||lang;
  if(!/^[A-Za-z ]{2,30}$/.test(language))return empty('unmapped','Language is not supported.');
  // Durable cache and atomic caps prevent each visitor or edge region spending a new credit.
  const stub=env.CONDITION_PRICES.get(env.CONDITION_PRICES.idFromName('shared-condition-prices'));
  const owner=await conditionOwner(request,env,fetchImpl);
  const cacheUrl='https://condition-cache/?product='+product+'&category='+{mtg:1,ygo:2,ptcg:3}[game],cacheOptions={headers:owner?{'X-Condition-Owner':'verified'}:{}};
  let data=await (await stub.fetch(cacheUrl,cacheOptions)).json();
  let quotes=normalizeConditionVariants(data,product,printings,language,data.cachedAt||Date.now());
  // A complete product response may not cover this language/finish. Ask the
  // backup once for all conditions; the primary result is already cached.
  if(data.status==='available'&&data.providers?.justtcg==='standby'&&quotes.length<CONDITIONS.length){
   data=await (await stub.fetch(cacheUrl+'&fallback=1',cacheOptions)).json();
   quotes=normalizeConditionVariants(data,product,printings,language,data.cachedAt||Date.now());
  }
  if(data.status!=='available'){
   const messages={provider_rate:'JustTCG is temporarily limiting requests. Saved quotes remain available.',provider_daily:'JustTCG reports its daily request allowance is used. It resets at midnight UTC.',provider_monthly:'JustTCG reports its monthly request allowance is used. Check the provider plan and billing reset.',provider_shared_limit:'JustTCG blocked this request under its shared-hosting Free tier protection. This can happen even when your own lookup allowance remains.',provider_auth:'JustTCG rejected the connected API key or subscription. Check the provider connection.',app_budget:owner?'Condition pricing is temporarily busy. Try again shortly.':'The app’s shared lookup allowance has been reached. Sign in to the owner account for owner access.'};
   messages.tcgplayer_auth='TCGplayer rejected the configured API connection. Saved prices remain available.';
   messages.tcgplayer_rate='TCGplayer is temporarily limiting requests. Saved prices remain available.';
   messages.tcgplayer_web_access='TCGplayer did not allow this web price request. Saved prices remain available.';
   messages.tcgplayer_web_error='TCGplayer’s web price data could not be read. Saved prices remain available.';
   return empty(data.status||'unavailable',messages[data.reason]||'Condition pricing is temporarily unavailable.',{quotes,providers:data.providers,reason:data.reason||'',providerCode:data.providerCode||'',retryAfterMs:data.retryAfterMs||60000,...(Number.isFinite(data.nextRetryAt)&&data.nextRetryAt>0?{nextRetryAt:data.nextRetryAt}:{}),ownerVerified:owner,...(Number.isFinite(data.providerObservedAt)&&data.providerObservedAt>0?{providerObservedAt:data.providerObservedAt}:{}),...(['provider-header','fallback'].includes(data.retrySource)?{retrySource:data.retrySource}:{})});
  }
  return Response.json({status:quotes.length?'available':'unpriced',quotes,providers:data.providers,productId:product,source:data.source||'JustTCG',notice:quotes.length?'':'No current quote matches this version, language and condition.'},{headers:{'Cache-Control':'public,max-age=3600'}});
 }catch{return empty('unavailable','Condition pricing is temporarily unavailable.');}
}
