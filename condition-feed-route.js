// Optional server-only condition feed. No key is shipped with the static app.
import {pokemonPriceRoute} from './pokemon-prices.js';
import {ygoPriceRoute} from './ygo-prices.js';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const CONDITIONS=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
const UA={'Accept':'application/json','User-Agent':'CardStashy/3.73.12 (cached condition valuation; github.com/deathxcore11/Card-forger)'};
export function normalizeConditionVariants(body,product,printings,language='English',now=Date.now()){
 const cards=(body?.data||[]).filter(c=>String(c.tcgplayerId)===String(product));
 if(cards.length!==1)return [];
 const buckets=new Map();
 for(const v of cards[0].variants||[]){
  if(!CONDITIONS.includes(v.condition)||v.priceStatus!=='current'||v.price===null||typeof v.price!=='number'||!Number.isFinite(v.price)||v.price<0||!printings.some(p=>norm(p)===norm(v.printing))||norm(v.language||'English')!==norm(language))continue;
  const time=Number(v.lastUpdated)*1000;if(!Number.isFinite(time)||time<=0||time>now+300000)continue;
  const q={condition:v.condition,price:v.price,currency:'USD',source:'JustTCG',sku:String(v.tcgplayerSkuId||v.uuid||v.id||''),observedAt:new Date(time).toISOString(),validUntil:new Date(now+86400000).toISOString(),priceStatus:'current'};
  const list=buckets.get(v.condition)||[];list.push(q);buckets.set(v.condition,list);
 }
 // Ambiguous parallel variants are unavailable, not whichever came first.
 return [...buckets.values()].filter(xs=>xs.length===1).map(xs=>xs[0]);
}
export async function conditionFeedRoute(url,env,ctx,fetchImpl=fetch){
 const game=url.searchParams.get('game'),id=url.searchParams.get('id')||'';
 const empty=(status,notice)=>Response.json({status,quotes:[],notice},{headers:{'Cache-Control':'no-store'}});
 if(!['mtg','ptcg','ygo'].includes(game)||!(/^[a-zA-Z0-9.!?_-]{1,80}$/.test(id)))return Response.json({error:'Invalid card'},{status:400});
 if(!env?.JUSTTCG_API_KEY)return empty('not_configured','Condition pricing is not connected yet.');
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
   const exact=(d.printings||[]).filter(p=>p.code===url.searchParams.get('printing')&&p.rarity===url.searchParams.get('rarity'));
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
    if(v){const edition=v.stamp==='1st-edition'?'1st Edition':v.subtype==='unlimited'?'Unlimited':'';printings=[edition || ({normal:'Normal',holo:'Holofoil',reverse:'Reverse Holofoil'}[v.type])].filter(Boolean);}
   }else{
    const v=c.pricing?.tcgplayer?.[variant];product=v?.productId;
    printings=({'normal':['Normal'],'holofoil':['Holofoil'],'reverse-holofoil':['Reverse Holofoil'],'1st-edition':['1st Edition'],'1st-edition-holofoil':['1st Edition Holofoil','1st Edition'],'unlimited':['Unlimited'],'unlimited-holofoil':['Unlimited Holofoil','Unlimited']})[variant]||[];
   }
  }
  if(!Number.isInteger(Number(product))||Number(product)<=0||!printings.length)return empty('unmapped','No exact condition product mapping for this version.');
  const lang=url.searchParams.get('language')||'English',language={en:'English',ja:'Japanese',de:'German',fr:'French',es:'Spanish',it:'Italian',pt:'Portuguese',ko:'Korean',zh:'Chinese'}[lang.toLowerCase()]||lang;
  if(!/^[A-Za-z ]{2,30}$/.test(language))return empty('unmapped','Language is not supported.');
  // One compact shared product response per day, reused across all conditions and clients.
  const key=new Request('https://cardstashy.cache/condition-v1/'+product);let data=await cache?.match(key).then(r=>r?.json());
  if(!data){
   const r=await fetchImpl('https://api.justtcg.com/v1/cards?tcgplayerId='+product,{headers:{...UA,'x-api-key':env.JUSTTCG_API_KEY},signal:AbortSignal.timeout(12000)});
   if(!r.ok)return empty(r.status===429?'rate_limited':'unavailable','Condition pricing is temporarily unavailable.');
   const raw=await r.json();data={data:(raw.data||[]).filter(c=>String(c.tcgplayerId)===String(product)).map(c=>({tcgplayerId:c.tcgplayerId,variants:(c.variants||[]).map(v=>({condition:v.condition,printing:v.printing,language:v.language,price:v.price,priceStatus:v.priceStatus,lastUpdated:v.lastUpdated,tcgplayerSkuId:v.tcgplayerSkuId}))})),cachedAt:Date.now()};
   ctx?.waitUntil?.(cache?.put(key,Response.json(data,{headers:{'Cache-Control':'public,max-age=86400'}})));
  }
  const quotes=normalizeConditionVariants(data,product,printings,language,data.cachedAt||Date.now());
  return Response.json({status:quotes.length?'available':'unpriced',quotes,productId:product,source:'JustTCG',notice:quotes.length?'':'No current quote matches this version, language and condition.'},{headers:{'Cache-Control':'public,max-age=3600'}});
 }catch{return empty('unavailable','Condition pricing is temporarily unavailable.');}
}
