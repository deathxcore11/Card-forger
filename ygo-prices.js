// Exact Yu-Gi-Oh! set code + rarity + edition pricing from the daily TCGCSV feed.
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const rarityKey=s=>norm(({ScR:'Secret Rare',StR:'Starlight Rare',UR:'Ultra Rare',SR:'Super Rare',R:'Rare',C:'Common',QCR:'Quarter Century Secret Rare'})[s] || s);
export function ygoProductMatches(set,products){
 return products.filter(p=>{
  const fields=Object.fromEntries((p.extendedData || []).map(x=>[norm(x.name),x.value]));
  return norm(fields.number || fields.cardnumber)===norm(set.code) && rarityKey(fields.rarity)===rarityKey(set.rarity);
 });
}
export function applyYgoPrices(card,body){
 if(body?.cardId!==card.id)return false;let changed=false;
 for(const s of card.sets || []){
  const matches=(body.printings || []).filter(x=>x.code===s.code && rarityKey(x.rarity)===rarityKey(s.rarity));
  if(matches.length!==1)continue;const q=matches[0];
  s.quotes=q.quotes;s.productId=q.productId;s.url=q.url;s.priceSource=body.source;s.checkedAt=body.updatedAt;
  // Edition-unspecified printing price is a reference only; exact edition quotes stay attached.
  if(q.quotes.length===1)s.price=q.quotes[0].market;
  changed=true;
 }if(changed)card.printPriceSchema=1;return changed;
}
export async function ygoPriceRoute(url,ctx,fetchImpl=fetch){
 const id=url.searchParams.get('id') || '';if(!/^\d{1,12}$/.test(id))return Response.json({error:'Invalid card'},{status:400});
 const cache=globalThis.caches?.default,k=new Request(url.href),cached=await cache?.match(k);if(cached)return cached;
 const get=async u=>{const key=new Request(u),old=await cache?.match(key);if(old)return old.json();const r=await fetchImpl(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Price feed unavailable');const d=await r.json();ctx?.waitUntil?.(cache?.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age=21600'}})));return d;};
 try{
  const [data,groups]=await Promise.all([get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+id),get('https://tcgcsv.com/tcgplayer/2/groups')]),card=data.data?.[0];
  if(String(card?.id)!==id)throw Error('Card identity mismatch');
  const sets=(card.card_sets||[]).map(s=>({code:s.set_code,rarity:s.set_rarity,name:s.set_name}));const printings=[];
  // Fetch each distinct set once. Avoid arbitrary name/cheapest-product fallbacks.
  const names=[...new Set(sets.map(s=>s.name))];
  for(let i=0;i<names.length;i+=3)await Promise.all(names.slice(i,i+3).map(async name=>{
   const matches=(groups.results||[]).filter(g=>norm(g.name)===norm(name));if(matches.length!==1)return;
   const group=matches[0];try{
    const [products,prices]=await Promise.all([get(`https://tcgcsv.com/tcgplayer/2/${group.groupId}/products`),get(`https://tcgcsv.com/tcgplayer/2/${group.groupId}/prices`)]);
    for(const set of sets.filter(s=>s.name===name)){
     const hits=ygoProductMatches(set,products.results||[]);if(hits.length!==1)continue;const product=hits[0];
     const quotes=(prices.results||[]).filter(q=>q.productId===product.productId && Number(q.marketPrice)>0).map(q=>({edition:q.subTypeName,market:Number(q.marketPrice),low:q.lowPrice}));
     if(quotes.length)printings.push({...set,productId:product.productId,url:`https://www.tcgplayer.com/product/${product.productId}`,quotes});
    }
   }catch{}
  }));
  const response=Response.json({cardId:id,printings,source:'TCGplayer market via TCGCSV',updatedAt:new Date().toISOString()},{headers:{'Cache-Control':'public,max-age=21600'}});ctx?.waitUntil?.(cache?.put(k,response.clone()));return response;
 }catch{return Response.json({error:'Exact printing prices temporarily unavailable'},{status:503});}
}
export function editionPrice(set,edition){
 const subtype={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'}[edition];
 const matches=(set?.quotes || []).filter(q=>norm(q.edition)===norm(subtype));return matches.length===1?matches[0].market:null;
}
