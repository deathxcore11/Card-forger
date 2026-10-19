import {classicEvidence} from './pokemon-classic-evidence.js';
// Exact product histories, displayed with provider attribution. No interpolated dates.
import {ygoProductMatches} from './ygo-prices.js';
import {ptcgProduct,sameSubtype} from './ptcg-product.js';
import {readExactYgoHistoryRequest,exactYgoHistoryCacheKey,resolveExactYgoHistoryPrinting,exactYgoHistoryGroup,exactYgoHistoryProduct,exactYgoHistoryRows,exactYgoHistoryStatus,validateExactYgoProvider} from './ygo-history-identity.js';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function recentPoints(raw,now=Date.now()){
 const today=new Date(now).toISOString().slice(0,10),cutoff=new Date(now-365*864e5).toISOString().slice(0,10),days=new Map();
 for(const p of raw || []){const date=p.snapshot_date,value=Number(p.market);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date>today||date<cutoff||p.market==null||!Number.isFinite(value)||value<=0||value>1e7)continue;days.set(date,{date,value});}
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
// Preserve legacy Number-coercion behavior outside the new exact path. A
// boolean/array/object is never a quote; decimal strings must be explicit.
export function exactYgoRecentPoints(raw,now=Date.now()){
 const rows=raw.filter(p=>p&&typeof p==='object'&&!Array.isArray(p)&&typeof p.snapshot_date==='string'&&(typeof p.market==='number'||typeof p.market==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(p.market)));
 return recentPoints(rows,now).filter(p=>Number.isFinite(Date.parse(p.date))&&new Date(p.date).toISOString().slice(0,10)===p.date);
}
export async function recentHistoryRoute(url,ctx,fetchImpl=fetch,now=Date.now()){
 const game=url.searchParams.get('game'),id=url.searchParams.get('id') || '',finish=url.searchParams.get('finish') || 'reference',edition=url.searchParams.get('edition') || '',rarity=url.searchParams.get('rarity') || '';
 let exact;try{exact=readExactYgoHistoryRequest(url);}catch{return Response.json({error:'Invalid exact history request'},{status:400});}
 if(!['ptcg','ygo'].includes(game)||!/^[A-Za-z0-9.!%?_:-]{1,89}$/.test(id)||!/^[A-Za-z0-9:_-]{1,99}$/.test(finish)||!/^[-A-Za-z0-9]{0,60}$/.test(edition)||rarity.length>100)return Response.json({error:'Invalid history request'},{status:400});
 const cache=globalThis.caches?.default,k=exact?exactYgoHistoryCacheKey(url,exact):new Request(classicEvidence(id)?url.href+(url.search?'&':'?')+'classicSchema=1':url.href),saved=await cache?.match(k);if(saved)return saved;
 const empty=(notice,status='unsupported')=>Response.json({game,cardId:id,finish,...exact,...(exact?{status}:{}),series:[],notice});
 const get=async u=>{const key=new Request(u),old=await cache?.match(key);if(old){const d=await old.json();return exact?validateExactYgoProvider(d,u):d;}const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.38 (cached printing history; github.com/deathxcore11/Card-forger)'},signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error(`History provider ${new URL(u).hostname} returned ${r.status}`);const d=await r.json();if(exact)validateExactYgoProvider(d,u);ctx?.waitUntil?.(cache?.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age=3600'}})));return d;};
 try{
  let productId,subtype,label;
  if(game==='ptcg'){
   const c=await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id));if(c.id!==id)return empty('Printing identity mismatch.');
   const hit=ptcgProduct(c,finish);if(!hit)return empty('Choose an exact finish to load recent history.');
   productId=hit.productId;subtype=hit.subtype;label=`${c.set?.name} #${classicEvidence(c)?[classicEvidence(c).number,classicEvidence(c).total].filter(Boolean).join('/'):c.localId}`;
  }else{
   const c=(await get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(id))).data?.[0];if(String(c?.id)!==id)return empty('Card identity mismatch.');
   const resolved=exact?await resolveExactYgoHistoryPrinting(c,exact,get):null;
   const sets=resolved?[resolved.set]:(c.card_sets || []).filter(s=>s.set_code===edition && (!rarity || norm(s.set_rarity)===norm(rarity)));if(sets.length!==1)return empty('Choose the exact set printing and rarity.');const set=sets[0];
   const groups=await get('https://tcgcsv.com/tcgplayer/2/groups'),matches=exact?[exactYgoHistoryGroup(groups.results,resolved.release)].filter(Boolean):(groups.results || []).filter(g=>norm(g.name)===norm(set.set_name));if(matches.length!==1)return empty('No unambiguous set mapping.');
   const products=await get(`https://tcgcsv.com/tcgplayer/2/${matches[0].groupId}/products`),hits=exact?[exactYgoHistoryProduct(products.results,exact,matches[0].groupId)].filter(Boolean):ygoProductMatches({code:edition,rarity:set.set_rarity},products.results || []);if(hits.length!==1)return empty('No unambiguous product mapping for this rarity.');productId=hits[0].productId;label=`${set.set_name} · ${edition} · ${set.set_rarity}`;
  }
  const data=await get(`https://api.tickermint.cards/products/${productId}/prices`),series=[];
  const rows=exact?exactYgoHistoryRows(data,exact):Object.entries(data);
  if(!rows)return empty('No separate history for this physical edition.');
  for(const [sub,raw] of rows){
   if(!Array.isArray(raw)||game==='ptcg'&&!sameSubtype(sub,subtype))continue;const points=exact?exactYgoRecentPoints(raw,now):recentPoints(raw,now);if(!points.length)continue;
   series.push({source:`TCGplayer market via TickerMint · ${productId} · ${sub}`,currency:'USD',finish,...exact,...(exact?{subtype:sub}:{}),label:`${label} · ${sub}`,productId:Number(productId),provenance:`https://tickermint.cards/card/${productId}`,attribution:'Prices: TickerMint',points});
  }
  const response=Response.json({game,cardId:id,finish,...exact,...(exact?{status:series.length?'ready':'empty'}:{}),series,notice:series.length?'':'No recorded market history for this exact product.'},{headers:{'Cache-Control':'public,max-age=3600'}});ctx?.waitUntil?.(cache?.put(k,response.clone()));return response;
 }catch(e){return empty(e.message,exactYgoHistoryStatus(e));}
}
