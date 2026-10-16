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
// Group data kept in memory by the Worker isolate between calls (free; Cache API calls are not).
const memo=new Map();
export async function ygoPriceRoute(url,ctx,fetchImpl=fetch){
 const id=url.searchParams.get('id') || '';if(!/^\d{1,12}$/.test(id))return Response.json({error:'Invalid card'},{status:400});
 // Cloudflare allows about 50 subrequests per call, and every fetch, cache read and cache write
 // counts. Each TCGplayer set is kept as one compact cache entry (products + prices), so a cached
 // set costs one operation; a card in many sets is priced over a few calls (a partial answer
 // isn't cached and the app asks again).
 let ops=0,partial=false;const errors=[],LIMIT=46;
 const cache=globalThis.caches?.default,op=()=>{if(++ops>LIMIT){partial=true;throw Error('Request budget used');}};
 op();const k=new Request(url.href.replace(/[?&]more=\d+/,'')),cached=await cache?.match(k);if(cached)return cached;
 const fetchJson=async u=>{op();const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.60 (cached exact printing prices; github.com/deathxcore11/Card-forger)'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Price provider ${new URL(u).hostname} returned ${r.status}`);return r.json();};
 // One cached JSON per key, built by `make` on a miss.
 const stored=async(key,make)=>{if(memo.has(key))return memo.get(key);const req=new Request('https://cardstashy.cache/ygo/'+key);op();const old=await cache?.match(req);if(old){const d=await old.json();memo.set(key,d);return d;}const d=await make();memo.set(key,d);op();ctx?.waitUntil?.(cache?.put(req,Response.json(d,{headers:{'Cache-Control':'public,max-age=21600'}})));return d;};
 try{
  const [data,groups]=await Promise.all([fetchJson('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+id),stored('groups',async()=>((await fetchJson('https://tcgcsv.com/tcgplayer/2/groups')).results||[]).map(g=>({groupId:g.groupId,name:g.name,abbreviation:g.abbreviation})))]),card=data.data?.[0];
  if(String(card?.id)!==id)throw Error('Card identity mismatch');
  const wantedCode=url.searchParams.get('printing'),wantedRarity=url.searchParams.get('rarity');
  const sets=(card.card_sets||[]).map(s=>({code:s.set_code,rarity:s.set_rarity,name:s.set_name})).filter(s=>(!wantedCode||s.code===wantedCode)&&(!wantedRarity||s.rarity===wantedRarity));const printings=[];
  // Each printing's TCGplayer set: the one group with the set's name, else the one whose code is
  // the printing's code prefix (LOB-EN001 → LOB; sneak peeks and tin packs are listed under their
  // parent's code). A product still has to carry the exact code and rarity.
  const groupFor=s=>{const byName=groups.filter(g=>norm(g.name)===norm(s.name));if(byName.length===1)return byName[0];const pre=String(s.code||'').split('-')[0].toUpperCase(),byCode=groups.filter(g=>String(g.abbreviation||'').toUpperCase()===pre);return byCode.length===1?byCode[0]:null;};
  const byGroup=new Map();for(const set of sets){const g=groupFor(set);if(g)(byGroup.get(g.groupId)||byGroup.set(g.groupId,[]).get(g.groupId)).push(set);}
  // A set's products (number + rarity only) with their market prices, as one compact entry.
  const groupData=groupId=>stored('group-'+groupId,async()=>{const [products,prices]=await Promise.all([fetchJson(`https://tcgcsv.com/tcgplayer/2/${groupId}/products`),fetchJson(`https://tcgcsv.com/tcgplayer/2/${groupId}/prices`)]);const q=new Map();for(const p of prices.results||[])if(Number(p.marketPrice)>0)(q.get(p.productId)||q.set(p.productId,[]).get(p.productId)).push({edition:p.subTypeName,market:Number(p.marketPrice),low:p.lowPrice});return (products.results||[]).filter(p=>q.has(p.productId)).map(p=>({productId:p.productId,extendedData:(p.extendedData||[]).filter(x=>/number|rarity/i.test(x.name)),quotes:q.get(p.productId)}));});
  const ids=[...byGroup.keys()];
  for(let i=0;i<ids.length&&!partial;i+=3)await Promise.all(ids.slice(i,i+3).map(async groupId=>{
   try{
    const products=await groupData(groupId);
    for(const set of byGroup.get(groupId)){
     const hits=ygoProductMatches(set,products);if(hits.length!==1)continue;const product=hits[0];
     printings.push({...set,productId:product.productId,url:`https://www.tcgplayer.com/product/${product.productId}`,quotes:product.quotes});
    }
   }catch(e){partial=true;if(errors.length<5)errors.push(String(e.message||e).slice(0,80));}
  }));
  const response=Response.json({cardId:id,printings,partial,errors,source:'TCGplayer market via TCGCSV',updatedAt:new Date().toISOString()},{headers:{'Cache-Control':partial?'no-store':'public,max-age=21600'}});
  if(!partial&&ops<LIMIT)ctx?.waitUntil?.(cache?.put(k,response.clone()));return response;
 }catch(e){return Response.json({error:'Exact printing prices temporarily unavailable',notice:e.message},{status:503});}
}
export function editionPrice(set,edition){
 const subtype={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'}[edition];
 const matches=(set?.quotes || []).filter(q=>norm(q.edition)===norm(subtype));return matches.length===1?matches[0].market:null;
}
