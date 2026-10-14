// Exact product/finish fallback. An asking price never replaces the market price.
export function applyProductPrices(card,body){
 if(body?.cardId!==card.id)return false;
 let changed=false;
 for(const v of card.variants || []){
  if(v.usd!=null||!v.productId)continue;
  const matches=(body.quotes || []).filter(q=>String(q.productId)===String(v.productId)&&q.subTypeName.toLowerCase()===(/reverse/i.test(v.label)?'reverse holofoil':/holo/i.test(v.label)?'holofoil':'normal'));
  if(matches.length!==1||!(Number(matches[0].marketPrice)>0))continue;
  const q=matches[0];Object.assign(v,{usd:Number(q.marketPrice),market:Number(q.marketPrice),low:q.lowPrice,mid:q.midPrice,productFallback:true});changed=true;
 }
 if(changed){const best=card.variants.find(v=>v.key==='normal'&&v.usd!=null)||card.variants.find(v=>v.usd!=null);card.prices.usd=best?.usd ?? null;card.prices.source='TCGplayer market via TCGCSV';card.prices.updated=body.updatedAt;}
 return changed;
}
const setKey=s=>String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
export async function pokemonPriceRoute(url,ctx,fetchImpl=fetch){
 const id=url.searchParams.get('id') || '';
 if(!/^[A-Za-z0-9.!?_-]{1,80}$/.test(id))return Response.json({error:'Invalid card'},{status:400});
 const cached=await caches.default.match(url.href);if(cached)return cached;
 const get=async u=>{const saved=await caches.default.match(u);if(saved)return saved.json();const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.34 (exact product pricing)'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Price source unavailable');const d=await r.json();ctx?.waitUntil?.(caches.default.put(u,Response.json(d,{headers:{'Cache-Control':'public,max-age=86400'}})));return d;};
 try{
  const c=await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id));if(c.id!==id)throw Error('Wrong printing');
  const products=new Set((c.variants_detailed || []).map(v=>Number(v.thirdParty?.tcgplayer)).filter(Boolean));
  if(!products.size)return Response.json({cardId:id,quotes:[],notice:'No exact product mapping'});
  const groups=await get('https://tcgcsv.com/tcgplayer/3/groups'),group=groups.results?.find(g=>setKey(g.name)===setKey(c.set?.name));
  if(!group)return Response.json({cardId:id,quotes:[],notice:'No exact set mapping'});
  const prices=await get('https://tcgcsv.com/tcgplayer/3/'+group.groupId+'/prices');
  const quotes=(prices.results || []).filter(q=>products.has(Number(q.productId))&&q.marketPrice>0);
  const response=Response.json({cardId:id,quotes,updatedAt:new Date().toISOString(),source:'TCGplayer market via TCGCSV'},{headers:{'Cache-Control':'public,max-age=86400'}});
  ctx?.waitUntil?.(caches.default.put(url.href,response.clone()));return response;
 }catch{return Response.json({error:'Price source temporarily unavailable'},{status:503});}
}
