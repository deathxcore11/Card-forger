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
 }if(changed&&!body.partial)card.printPriceSchema=1;return changed;
}
export async function ygoPriceRoute(url,ctx,fetchImpl=fetch){
 const id=url.searchParams.get('id') || '';if(!/^\d{1,12}$/.test(id))return Response.json({error:'Invalid card'},{status:400});
 const cache=globalThis.caches?.default,k=new Request(url.href),cached=await cache?.match(k);if(cached)return cached;
 // Cloudflare allows about 50 outside requests per call. Cached responses don't count; a card in
 // many sets is priced over a few calls (partial answers aren't cached, the app asks again).
 let budget=44,partial=false;const errors=[];
 const get=async u=>{const key=new Request(u),old=await cache?.match(key);if(old)return old.json();if(budget--<=0){partial=true;throw Error('Request budget used');}const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.38 (cached exact printing prices; github.com/deathxcore11/Card-forger)'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Price provider ${new URL(u).hostname} returned ${r.status}`);const d=await r.json();ctx?.waitUntil?.(cache?.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age=21600'}})));return d;};
 try{
  const [data,groups]=await Promise.all([get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+id),get('https://tcgcsv.com/tcgplayer/2/groups')]),card=data.data?.[0];
  if(String(card?.id)!==id)throw Error('Card identity mismatch');
  const sets=(card.card_sets||[]).map(s=>({code:s.set_code,rarity:s.set_rarity,name:s.set_name}));const printings=[];
  // Each printing's TCGplayer set: the one group with the set's name, else the one whose code is
  // the printing's code prefix (LOB-EN001 → LOB; sneak peeks and tin packs are listed under their
  // parent's code). Each group is fetched once; a product still has to carry the exact code and rarity.
  const all=groups.results||[],groupFor=s=>{const byName=all.filter(g=>norm(g.name)===norm(s.name));if(byName.length===1)return byName[0];const pre=String(s.code||'').split('-')[0].toUpperCase(),byCode=all.filter(g=>String(g.abbreviation||'').toUpperCase()===pre);return byCode.length===1?byCode[0]:null;};
  const byGroup=new Map();for(const set of sets){const g=groupFor(set);if(g)(byGroup.get(g.groupId)||byGroup.set(g.groupId,[]).get(g.groupId)).push(set);}
  const ids=[...byGroup.keys()];
  for(let i=0;i<ids.length;i+=3)await Promise.all(ids.slice(i,i+3).map(async groupId=>{
   try{
    const [products,prices]=await Promise.all([get(`https://tcgcsv.com/tcgplayer/2/${groupId}/products`),get(`https://tcgcsv.com/tcgplayer/2/${groupId}/prices`)]);
    for(const set of byGroup.get(groupId)){
     const hits=ygoProductMatches(set,products.results||[]);if(hits.length!==1)continue;const product=hits[0];
     const quotes=(prices.results||[]).filter(q=>q.productId===product.productId && Number(q.marketPrice)>0).map(q=>({edition:q.subTypeName,market:Number(q.marketPrice),low:q.lowPrice}));
     if(quotes.length)printings.push({...set,productId:product.productId,url:`https://www.tcgplayer.com/product/${product.productId}`,quotes});
    }
   }catch(e){partial=true;errors.push(String(e.message||e).slice(0,80));}
  }));
  const response=Response.json({cardId:id,printings,partial,errors:errors.slice(0,5),source:'TCGplayer market via TCGCSV',updatedAt:new Date().toISOString()},{headers:{'Cache-Control':partial?'no-store':'public,max-age=21600'}});if(!partial)ctx?.waitUntil?.(cache?.put(k,response.clone()));return response;
 }catch(e){return Response.json({error:'Exact printing prices temporarily unavailable',notice:e.message},{status:503});}
}
export function editionPrice(set,edition){
 const subtype={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'}[edition];
 const matches=(set?.quotes || []).filter(q=>norm(q.edition)===norm(subtype));return matches.length===1?matches[0].market:null;
}
