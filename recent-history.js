// Exact product histories, displayed with provider attribution. No interpolated dates.
import {ygoProductMatches} from './ygo-prices.js';
import {ptcgProduct,sameSubtype} from './ptcg-product.js';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function recentPoints(raw,now=Date.now()){
 const today=new Date(now).toISOString().slice(0,10),cutoff=new Date(now-365*864e5).toISOString().slice(0,10),days=new Map();
 for(const p of raw || []){const date=p.snapshot_date,value=Number(p.market);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date>today||date<cutoff||p.market==null||!Number.isFinite(value)||value<=0||value>1e7)continue;days.set(date,{date,value});}
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export async function recentHistoryRoute(url,ctx,fetchImpl=fetch,now=Date.now()){
 const game=url.searchParams.get('game'),id=url.searchParams.get('id') || '',finish=url.searchParams.get('finish') || 'reference',edition=url.searchParams.get('edition') || '',rarity=url.searchParams.get('rarity') || '';
 if(!['ptcg','ygo'].includes(game)||!/^[A-Za-z0-9.!%?_:-]{1,89}$/.test(id)||!/^[A-Za-z0-9:_-]{1,99}$/.test(finish)||!/^[-A-Za-z0-9]{0,60}$/.test(edition)||rarity.length>100)return Response.json({error:'Invalid history request'},{status:400});
 const cache=globalThis.caches?.default,k=new Request(url.href),saved=await cache?.match(k);if(saved)return saved;
 const empty=notice=>Response.json({game,cardId:id,finish,series:[],notice});
 const get=async u=>{const key=new Request(u),old=await cache?.match(key);if(old)return old.json();const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.38 (cached printing history; github.com/deathxcore11/Card-forger)'},signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error(`History provider ${new URL(u).hostname} returned ${r.status}`);const d=await r.json();ctx?.waitUntil?.(cache?.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age=3600'}})));return d;};
 try{
  let productId,subtype,label;
  if(game==='ptcg'){
   const c=await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id));if(c.id!==id)return empty('Printing identity mismatch.');
   const hit=ptcgProduct(c,finish);if(!hit)return empty('Choose an exact finish to load recent history.');
   productId=hit.productId;subtype=hit.subtype;label=`${c.set?.name} #${c.localId}`;
  }else{
   const c=(await get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(id))).data?.[0];if(String(c?.id)!==id)return empty('Card identity mismatch.');
   const sets=(c.card_sets || []).filter(s=>s.set_code===edition && (!rarity || norm(s.set_rarity)===norm(rarity)));if(sets.length!==1)return empty('Choose the exact set printing and rarity.');const set=sets[0];
   const groups=await get('https://tcgcsv.com/tcgplayer/2/groups'),matches=(groups.results || []).filter(g=>norm(g.name)===norm(set.set_name));if(matches.length!==1)return empty('No unambiguous set mapping.');
   const products=await get(`https://tcgcsv.com/tcgplayer/2/${matches[0].groupId}/products`),hits=ygoProductMatches({code:edition,rarity:set.set_rarity},products.results || []);if(hits.length!==1)return empty('No unambiguous product mapping for this rarity.');productId=hits[0].productId;label=`${set.set_name} · ${edition} · ${set.set_rarity}`;
  }
  const data=await get(`https://api.tickermint.cards/products/${productId}/prices`),series=[];
  for(const [sub,raw] of Object.entries(data)){
   if(!Array.isArray(raw)||game==='ptcg'&&!sameSubtype(sub,subtype))continue;const points=recentPoints(raw,now);if(!points.length)continue;
   series.push({source:`TCGplayer market via TickerMint · ${productId} · ${sub}`,currency:'USD',finish,label:`${label} · ${sub}`,productId:Number(productId),provenance:`https://tickermint.cards/card/${productId}`,attribution:'Prices: TickerMint',points});
  }
  const response=Response.json({game,cardId:id,finish,series,notice:series.length?'':'No recorded market history for this exact product.'},{headers:{'Cache-Control':'public,max-age=3600'}});ctx?.waitUntil?.(cache?.put(k,response.clone()));return response;
 }catch(e){return empty(e.message);}
}
